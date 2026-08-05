const request = require('supertest');
const creerApp = require('../app');
const { signerJeton } = require('../auth/jeton');
const {
  creerPoolTest,
  preparerBase,
  viderTables,
  semerUtilisateurs,
  semerClient,
  semerEmplacements,
  idEmplacement,
  UUID_REPASSEUSE,
} = require('./aide-base');

let pool;
let app;

const jetonRepasseuse = () =>
  signerJeton({
    id_utilisateur: UUID_REPASSEUSE,
    role: 'repasseuse',
    session_debut: Math.floor(Date.now() / 1000),
  });

// Une commande déjà « en cours », prête à être clôturée.
async function creerCommandeEnCours(idClient, mannes = 1) {
  const r = await pool.query(
    `INSERT INTO commande (id_client, nombre_mannes, statut, id_repasseuse, repassage_debut)
     VALUES ($1, $2, 'en_cours', $3, now() - interval '10 minutes')
     RETURNING id_commande`,
    [idClient, mannes, UUID_REPASSEUSE]
  );
  return r.rows[0].id_commande;
}

beforeAll(async () => {
  pool = creerPoolTest();
  await preparerBase(pool);
  app = creerApp(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await viderTables(pool);
  await semerUtilisateurs(pool);
  await semerEmplacements(pool);
});

// L'US #260 assemble cinq briques en UNE transaction. La garantie qui compte —
// « clôture échouée = ROLLBACK = aucun SMS » — n'était prouvée par rien : un faux pool
// ne peut ni annuler une transaction, ni montrer ce qui reste en base après coup.
describe('transaction de clôture (US #330)', () => {
  test('clôture réussie → statut, historique, SMS en file et emplacements replacés', async () => {
    const idClient = await semerClient(pool, { telephone: '0475123456' });
    const idCommande = await creerCommandeEnCours(idClient, 1);
    const a1g = await idEmplacement(pool, 'A1G');

    const res = await request(app)
      .post(`/api/commandes/${idCommande}/cloturer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: [{ id_emplacement: a1g, nombre_mannes: 1 }] });

    expect(res.status).toBe(200);

    const cmd = await pool.query(
      'SELECT statut, repassage_debut, temps_repassage_s FROM commande WHERE id_commande = $1',
      [idCommande]
    );
    expect(cmd.rows[0].statut).toBe('fait');
    expect(cmd.rows[0].repassage_debut).toBeNull();
    // Le chrono courait depuis 10 minutes : le temps final doit être crédité.
    expect(cmd.rows[0].temps_repassage_s).toBeGreaterThan(500);

    const hist = await pool.query(
      `SELECT ancien_statut, nouveau_statut, id_utilisateur FROM historique_statut
       WHERE id_commande = $1`,
      [idCommande]
    );
    expect(hist.rowCount).toBe(1);
    expect(hist.rows[0].ancien_statut).toBe('en_cours');
    expect(hist.rows[0].nouveau_statut).toBe('fait');
    expect(hist.rows[0].id_utilisateur).toBe(UUID_REPASSEUSE);

    const sms = await pool.query('SELECT statut FROM sms_en_attente WHERE id_commande = $1', [
      idCommande,
    ]);
    expect(sms.rowCount).toBe(1);
    expect(sms.rows[0].statut).toBe('en_attente');

    const place = await pool.query(
      'SELECT nombre_mannes FROM commande_emplacement WHERE id_commande = $1',
      [idCommande]
    );
    expect(place.rowCount).toBe(1);
    expect(place.rows[0].nombre_mannes).toBe(1);
  });

  test('deuxième scan → 409 et toujours UNE seule ligne SMS', async () => {
    const idClient = await semerClient(pool, { telephone: '0475123456' });
    const idCommande = await creerCommandeEnCours(idClient, 1);
    const a1g = await idEmplacement(pool, 'A1G');
    const corps = { emplacements: [{ id_emplacement: a1g, nombre_mannes: 1 }] };

    await request(app)
      .post(`/api/commandes/${idCommande}/cloturer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send(corps)
      .expect(200);

    const res = await request(app)
      .post(`/api/commandes/${idCommande}/cloturer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send(corps);

    expect(res.status).toBe(409);

    // Pas de doublon : la garde est la machine à états (#228), pas une contrainte dédiée.
    // Une cliente qui recevrait deux fois le même SMS n'est pas un détail cosmétique.
    const sms = await pool.query('SELECT count(*)::int AS n FROM sms_en_attente');
    expect(sms.rows[0].n).toBe(1);
  });

  test('cliente au fixe → clôture réussie mais AUCUNE ligne SMS', async () => {
    // 9 chiffres = fixe (068 = Tournai). Le 04 est à la fois préfixe mobile et indicatif
    // de Liège : c'est la LONGUEUR qui discrimine (#270).
    const idClient = await semerClient(pool, { telephone: '068123456' });
    const idCommande = await creerCommandeEnCours(idClient, 1);
    const a1g = await idEmplacement(pool, 'A1G');

    const res = await request(app)
      .post(`/api/commandes/${idCommande}/cloturer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: [{ id_emplacement: a1g, nombre_mannes: 1 }] });

    expect(res.status).toBe(200);

    const cmd = await pool.query('SELECT statut FROM commande WHERE id_commande = $1', [
      idCommande,
    ]);
    expect(cmd.rows[0].statut).toBe('fait');

    // Elle sera appelée à la main : encodable, mais aucune ligne de file.
    const sms = await pool.query('SELECT count(*)::int AS n FROM sms_en_attente');
    expect(sms.rows[0].n).toBe(0);
  });
});
