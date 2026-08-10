const request = require('supertest');
const creerApp = require('../app');
const { signerJeton } = require('../auth/jeton');
const {
  creerPoolTest,
  preparerBase,
  viderTables,
  semerUtilisateurs,
  semerClient,
  UUID_GERANTE,
  UUID_REPASSEUSE,
} = require('./aide-base');

let pool;
let app;

const jetonGerante = () =>
  signerJeton({
    id_utilisateur: UUID_GERANTE,
    role: 'gerante',
    session_debut: Math.floor(Date.now() / 1000),
  });

// Une commande terminée PUIS récupérée, avec sa trace dans historique_statut : c'est cette trace
// que la requête des statistiques (#300) prend pour point d'ancrage.
async function creerCommandeTerminee(idClient, tempsS) {
  const r = await pool.query(
    `INSERT INTO commande (id_client, nombre_mannes, statut, id_repasseuse,
                           temps_repassage_s, date_recuperation)
     VALUES ($1, 2, 'recupere', $2, $3, now())
     RETURNING id_commande`,
    [idClient, UUID_REPASSEUSE, tempsS]
  );
  await pool.query(
    `INSERT INTO historique_statut (id_commande, ancien_statut, nouveau_statut, id_utilisateur)
     VALUES ($1, 'en_cours', 'fait', $2)`,
    [r.rows[0].id_commande, UUID_REPASSEUSE]
  );
  return r.rows[0].id_commande;
}

// Dates construites à la main : toISOString() convertit en UTC et décale d'un jour en début ou
// fin de mois — piège relevé au #300 puis au #330.
function periodeDuJour() {
  const d = new Date();
  const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  return { debut: jour, fin: jour };
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
});

describe('Suppression définitive d’une cliente', () => {
  // LA propriété demandée : les chiffres du #300 ne bougent pas d'un iota.
  test('supprimer une cliente ne change PAS les statistiques', async () => {
    const idClient = await semerClient(pool);
    await creerCommandeTerminee(idClient, 1800);
    const { debut, fin } = periodeDuJour();

    const avant = await request(app)
      .get(`/api/statistiques?debut=${debut}&fin=${fin}`)
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(avant.status).toBe(200);
    expect(avant.body.global.nbCommandes).toBe(1);
    expect(avant.body.global.tempsTotalS).toBe(1800);

    const suppression = await request(app)
      .delete(`/api/clients/${idClient}`)
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(suppression.status).toBe(200);
    expect(suppression.body.commandes_detachees).toBe(1);

    const apres = await request(app)
      .get(`/api/statistiques?debut=${debut}&fin=${fin}`)
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(apres.body.global).toEqual(avant.body.global);

    // L'état réel des trois tables — ce qu'aucun faux pool ne pourrait montrer.
    const clients = await pool.query('SELECT count(*)::int AS n FROM client');
    const commandes = await pool.query('SELECT id_client FROM commande');
    const historique = await pool.query('SELECT count(*)::int AS n FROM historique_statut');
    expect(clients.rows[0].n).toBe(0);
    expect(commandes.rows).toHaveLength(1);
    expect(commandes.rows[0].id_client).toBeNull();
    expect(historique.rows[0].n).toBe(1);
  });

  test('refuse en 409 tant qu’une commande n’est pas récupérée, et la cliente reste en base', async () => {
    const idClient = await semerClient(pool);
    await pool.query(
      `INSERT INTO commande (id_client, nombre_mannes, statut, id_repasseuse)
       VALUES ($1, 1, 'fait', $2)`,
      [idClient, UUID_REPASSEUSE]
    );

    const res = await request(app)
      .delete(`/api/clients/${idClient}`)
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(409);
    expect(res.body.commandes_actives).toBe(1);

    const reste = await pool.query('SELECT count(*)::int AS n FROM client');
    expect(reste.rows[0].n).toBe(1);
  });

  test('le Kanban affiche « Cliente supprimée » pour une commande détachée du jour', async () => {
    const idClient = await semerClient(pool);
    await creerCommandeTerminee(idClient, 600);
    await request(app)
      .delete(`/api/clients/${idClient}`)
      .set('Authorization', `Bearer ${jetonGerante()}`);

    const res = await request(app)
      .get('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].client_nom).toBe('Cliente supprimée');
    expect(res.body[0].client_mobile).toBeNull();
  });
});
