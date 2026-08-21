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
  UUID_GERANTE,
  UUID_REPASSEUSE,
} = require('./aide-base');

let pool;
let app;

const maintenant = () => Math.floor(Date.now() / 1000);
const jetonGerante = () =>
  signerJeton({ id_utilisateur: UUID_GERANTE, role: 'gerante', session_debut: maintenant() });

async function creerCommande(idClient, statut, idRepasseuse = null, mannes = 3) {
  const r = await pool.query(
    `INSERT INTO commande (id_client, nombre_mannes, statut, id_repasseuse)
     VALUES ($1, $2, $3, $4) RETURNING id_commande`,
    [idClient, mannes, statut, idRepasseuse]
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

describe('GET /api/commandes — détail en base réelle', () => {
  test('une commande sur deux emplacements → UNE ligne, deux emplacements triés', async () => {
    await semerEmplacements(pool);
    const idClient = await semerClient(pool);
    const idCommande = await creerCommande(idClient, 'a_faire', UUID_REPASSEUSE);
    // Insérés dans le désordre : le tri doit venir du ORDER BY du json_agg.
    await pool.query(
      `INSERT INTO commande_emplacement (id_commande, id_emplacement, nombre_mannes)
       VALUES ($1, $2, 2), ($1, $3, 1)`,
      [idCommande, await idEmplacement(pool, 'B2C'), await idEmplacement(pool, 'A1G')]
    );

    const res = await request(app)
      .get('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`);

    expect(res.status).toBe(200);
    // Avec un JOIN direct, cette commande sortirait en deux lignes.
    expect(res.body).toHaveLength(1);
    expect(res.body[0].emplacements).toEqual([
      { code_barre: 'A1G', nombre_mannes: 1 },
      { code_barre: 'B2C', nombre_mannes: 2 },
    ]);
    expect(res.body[0].repasseuse_nom).toBe('Repasseuse 1');
  });

  test('commande « en cours » → tableau vide, jamais null', async () => {
    const idClient = await semerClient(pool);
    await creerCommande(idClient, 'en_cours', UUID_REPASSEUSE);

    const res = await request(app)
      .get('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`);

    expect(res.status).toBe(200);
    expect(res.body[0].emplacements).toEqual([]);
  });

  test('commande sans repasseuse → reste dans le Kanban, repasseuse_nom null', async () => {
    const idClient = await semerClient(pool);
    await creerCommande(idClient, 'a_faire', null);

    const res = await request(app)
      .get('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`);

    expect(res.status).toBe(200);
    // Un JOIN strict sur utilisateur l'aurait fait disparaître.
    expect(res.body).toHaveLength(1);
    expect(res.body[0].repasseuse_nom).toBeNull();
  });
});
