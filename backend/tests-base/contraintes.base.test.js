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
const jetonRepasseuse = () =>
  signerJeton({ id_utilisateur: UUID_REPASSEUSE, role: 'repasseuse', session_debut: maintenant() });

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

describe('comportements que seul PostgreSQL peut produire (US #330)', () => {
  // C'est PostgreSQL qui additionne. Aucun faux pool ne peut simuler une fusion : il
  // renverrait le total qu'on lui aurait soufflé.
  test('déplacement vers un emplacement du MÊME client → les mannes sont additionnées', async () => {
    const idClient = await semerClient(pool);
    const r = await pool.query(
      `INSERT INTO commande (id_client, nombre_mannes, statut, id_repasseuse)
       VALUES ($1, 3, 'a_faire', $2) RETURNING id_commande`,
      [idClient, UUID_REPASSEUSE]
    );
    const idCommande = r.rows[0].id_commande;
    const a1g = await idEmplacement(pool, 'A1G');
    const a2g = await idEmplacement(pool, 'A2G');

    // 1 manne en A1G, 2 en A2G — même client, deux cases : autorisé.
    await request(app)
      .post(`/api/commandes/${idCommande}/emplacements`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({
        emplacements: [
          { id_emplacement: a1g, nombre_mannes: 1 },
          { id_emplacement: a2g, nombre_mannes: 2 },
        ],
      })
      .expect(201);

    // On rapatrie A1G sur A2G : la ligne existe déjà, ON CONFLICT DO UPDATE (+=) doit jouer.
    const res = await request(app)
      .post('/api/emplacements/deplacer')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ id_source: a1g, id_destination: a2g, id_client: idClient });

    expect(res.status).toBe(200);

    const fusion = await pool.query(
      'SELECT nombre_mannes FROM commande_emplacement WHERE id_emplacement = $1',
      [a2g]
    );
    expect(fusion.rowCount).toBe(1);
    expect(fusion.rows[0].nombre_mannes).toBe(3); // 2 + 1, et non une seconde ligne

    const source = await pool.query(
      'SELECT count(*)::int AS n FROM commande_emplacement WHERE id_emplacement = $1',
      [a1g]
    );
    expect(source.rows[0].n).toBe(0);
  });

  // Le réessai anti-collision du #90 suppose que la base renvoie 23505.
  // Ce code était jusqu'ici INVENTÉ par les faux pools : personne n'avait vérifié que
  // PostgreSQL le produisait vraiment sur cette contrainte-là.
  test('code_barre client dupliqué → PostgreSQL renvoie bien 23505', async () => {
    await semerClient(pool, { code_barre: 'DOUBLON1' });

    let codeErreur = null;
    try {
      await semerClient(pool, { nom: 'Autre', code_barre: 'DOUBLON1' });
    } catch (err) {
      codeErreur = err.code;
    }

    expect(codeErreur).toBe('23505');
  });

  // Symétriquement, le 400 du #150 repose sur un 23503 réel.
  test('commande sur un client inexistant → 23503 réel, converti en 400', async () => {
    const res = await request(app)
      .post('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ id_client: '99999999-9999-9999-9999-999999999999', nombre_mannes: 1 });

    expect(res.status).toBe(400);

    const cmd = await pool.query('SELECT count(*)::int AS n FROM commande');
    expect(cmd.rows[0].n).toBe(0);
  });
});
