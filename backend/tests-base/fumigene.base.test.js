const { creerPoolTest, preparerBase, viderTables, semerUtilisateurs } = require('./aide-base');

let pool;

beforeAll(async () => {
  pool = creerPoolTest();
  await preparerBase(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await viderTables(pool);
});

// Ce test ne vérifie aucune règle métier : il vérifie que le socle fonctionne.
// S'il tombe, inutile de chercher ailleurs — c'est l'outillage qui est en cause.
test('le schéma est chargé et les tables sont utilisables', async () => {
  await semerUtilisateurs(pool);

  const r = await pool.query('SELECT nom, role FROM utilisateur ORDER BY nom');

  expect(r.rowCount).toBe(3);
  expect(r.rows[0].role).toBe('gerante');

  // Preuve que gen_random_uuid() fonctionne, donc que pgcrypto est bien en place.
  const ids = await pool.query('SELECT id_utilisateur FROM utilisateur');
  expect(ids.rows[0].id_utilisateur).toMatch(/^[0-9a-f-]{36}$/);
});
