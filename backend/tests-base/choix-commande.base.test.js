const request = require('supertest');
const creerApp = require('../app');
const { signerJeton } = require('../auth/jeton');
const {
  creerPoolTest,
  preparerBase,
  viderTables,
  semerUtilisateurs,
  semerClient,
  UUID_REPASSEUSE,
  UUID_REPASSEUSE_2,
} = require('./aide-base');

let pool;
let app;

const maintenant = () => Math.floor(Date.now() / 1000);
const jetonRepasseuse = () =>
  signerJeton({ id_utilisateur: UUID_REPASSEUSE, role: 'repasseuse', session_debut: maintenant() });

// date_reception explicite : le tri FIFO doit être vérifiable, pas dépendant de l'ordre d'INSERT.
async function creerCommande(idClient, statut, idRepasseuse, mannes, dateReception) {
  const r = await pool.query(
    `INSERT INTO commande (id_client, nombre_mannes, statut, id_repasseuse, date_reception)
     VALUES ($1, $2, $3, $4, $5) RETURNING id_commande`,
    [idClient, mannes, statut, idRepasseuse, dateReception]
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
});

describe('Scan d’un client ayant plusieurs commandes — base réelle', () => {
  test('une commande « fait » (autre repasseuse) + une « à faire » → 2 lignes, « fait » en tête', async () => {
    const idClient = await semerClient(pool, { code_barre: 'CLIENT01' });
    // Le « fait » appartient à l'AUTRE repasseuse : il doit remonter quand même (périmètre
    // collectif du #280), ce qu'un faux pool ne peut pas démontrer.
    const idFait = await creerCommande(idClient, 'fait', UUID_REPASSEUSE_2, 1, '2026-08-21');
    const idAFaire = await creerCommande(idClient, 'a_faire', UUID_REPASSEUSE, 2, '2026-08-24');

    const res = await request(app)
      .get('/api/commandes/a-scanner/CLIENT01')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);

    expect(res.status).toBe(200);
    expect(res.body.commandes).toHaveLength(2);
    expect(res.body.commandes[0].id_commande).toBe(idFait);
    expect(res.body.commandes[0].action).toBe('recuperer');
    expect(res.body.commandes[1].id_commande).toBe(idAFaire);
    expect(res.body.commandes[1].action).toBe('demarrer');
  });

  test('démarrer la SECONDE commande à faire ne touche pas la première (2026-08-24)', async () => {
    const idClient = await semerClient(pool, { code_barre: 'CLIENT01' });
    const idPremiere = await creerCommande(idClient, 'a_faire', UUID_REPASSEUSE, 1, '2026-08-21');
    const idSeconde = await creerCommande(idClient, 'a_faire', UUID_REPASSEUSE, 2, '2026-08-24');

    // Le tri FIFO placerait la première en tête : c'est elle que l'ancienne route par
    // code-barres aurait démarrée, quel que soit le choix de la repasseuse.
    const scan = await request(app)
      .get('/api/commandes/a-scanner/CLIENT01')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(scan.body.commandes.map((c) => c.id_commande)).toEqual([idPremiere, idSeconde]);

    const res = await request(app)
      .post(`/api/commandes/${idSeconde}/demarrer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);

    const etats = await pool.query(
      'SELECT id_commande, statut FROM commande WHERE id_client = $1 ORDER BY date_reception',
      [idClient]
    );
    expect(etats.rows).toEqual([
      { id_commande: idPremiere, statut: 'a_faire' },
      { id_commande: idSeconde, statut: 'en_cours' },
    ]);
  });
});
