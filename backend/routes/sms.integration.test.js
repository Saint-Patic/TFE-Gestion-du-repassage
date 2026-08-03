const request = require('supertest');
const creerApp = require('../app');

const JETON = 'jeton-passerelle-de-test';
const UUID_SMS = '44444444-4444-4444-4444-444444444444';
const ancienJeton = process.env.JETON_PASSERELLE;

beforeEach(() => { process.env.JETON_PASSERELLE = JETON; });
afterAll(() => {
  if (ancienJeton === undefined) delete process.env.JETON_PASSERELLE;
  else process.env.JETON_PASSERELLE = ancienJeton;
});

// Faux pool : mémorise chaque requête et rejoue les résultats fournis, dans l'ordre.
function poolFactice(resultats = []) {
  const appels = [];
  const file = [...resultats];
  const pool = {
    query: async (sql, params) => {
      appels.push({ sql, params });
      return file.shift() || { rowCount: 0, rows: [] };
    },
  };
  return { pool, appels };
}

const entete = (jeton = JETON) => ({ Authorization: `Bearer ${jeton}` });

describe('GET /api/sms/en-attente (US #240)', () => {
  test('sans jeton → 401', async () => {
    const { pool } = poolFactice();
    const res = await request(creerApp(pool)).get('/api/sms/en-attente');
    expect(res.status).toBe(401);
  });

  test('jeton erroné → 401 sans toucher la DB', async () => {
    const { pool, appels } = poolFactice();
    const res = await request(creerApp(pool)).get('/api/sms/en-attente').set(entete('mauvais'));
    expect(res.status).toBe(401);
    expect(appels).toHaveLength(0);
  });

  test('succès → 200, FIFO, exclut les clientes anonymisées, limite par défaut 10', async () => {
    const lignes = [{ id_sms: UUID_SMS, telephone: '0470123456', message: 'Prêt.' }];
    const { pool, appels } = poolFactice([{ rowCount: 1, rows: lignes }]);
    const res = await request(creerApp(pool)).get('/api/sms/en-attente').set(entete());
    expect(res.status).toBe(200);
    expect(res.body).toEqual(lignes);
    expect(appels[0].sql).toMatch(/ORDER BY s\.date_creation ASC/i);
    expect(appels[0].sql).toMatch(/cl\.telephone <> ''/i);
    expect(appels[0].sql).toMatch(/s\.statut = 'en_attente'/i);
    expect(appels[0].params).toEqual([10]);
  });

  test('limite excessive → bornée à 50', async () => {
    const { pool, appels } = poolFactice([{ rowCount: 0, rows: [] }]);
    const res = await request(creerApp(pool)).get('/api/sms/en-attente?limite=999').set(entete());
    expect(res.status).toBe(200);
    expect(appels[0].params).toEqual([50]);
  });
});

describe('POST /api/sms/:id/envoye (US #240)', () => {
  test('succès → 200', async () => {
    const { pool, appels } = poolFactice([{ rowCount: 1, rows: [{ id_sms: UUID_SMS }] }]);
    const res = await request(creerApp(pool)).post(`/api/sms/${UUID_SMS}/envoye`).set(entete());
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(appels[0].sql).toMatch(/SET statut='envoye'/i);
    expect(appels[0].sql).toMatch(/statut='en_attente'/i);
    expect(appels[0].params).toEqual([UUID_SMS]);
  });

  test('accusé rejoué sur un SMS déjà envoyé → 200 (idempotent, pas de second envoi)', async () => {
    const { pool } = poolFactice([
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [{ statut: 'envoye' }] },
    ]);
    const res = await request(creerApp(pool)).post(`/api/sms/${UUID_SMS}/envoye`).set(entete());
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('SMS inconnu → 404', async () => {
    const { pool } = poolFactice([
      { rowCount: 0, rows: [] },
      { rowCount: 0, rows: [] },
    ]);
    const res = await request(creerApp(pool)).post(`/api/sms/${UUID_SMS}/envoye`).set(entete());
    expect(res.status).toBe(404);
  });

  test('SMS abandonné (echec) → 409', async () => {
    const { pool } = poolFactice([
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [{ statut: 'echec' }] },
    ]);
    const res = await request(creerApp(pool)).post(`/api/sms/${UUID_SMS}/envoye`).set(entete());
    expect(res.status).toBe(409);
  });
});

describe('POST /api/sms/:id/echec (US #240)', () => {
  test('échec → incrémente les tentatives et bascule en echec au plafond de 5', async () => {
    const { pool, appels } = poolFactice([
      { rowCount: 1, rows: [{ statut: 'en_attente', tentatives: 1 }] },
    ]);
    const res = await request(creerApp(pool))
      .post(`/api/sms/${UUID_SMS}/echec`)
      .set(entete())
      .send({ erreur: 'numéro invalide' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ statut: 'en_attente', tentatives: 1 });
    expect(appels[0].sql).toMatch(/tentatives = tentatives \+ 1/i);
    expect(appels[0].sql).toMatch(/CASE WHEN tentatives \+ 1 >= \$3 THEN 'echec'/i);
    expect(appels[0].params).toEqual([UUID_SMS, 'numéro invalide', 5]);
  });

  test('SMS inconnu → 404', async () => {
    const { pool } = poolFactice([
      { rowCount: 0, rows: [] },
      { rowCount: 0, rows: [] },
    ]);
    const res = await request(creerApp(pool))
      .post(`/api/sms/${UUID_SMS}/echec`).set(entete()).send({ erreur: 'x' });
    expect(res.status).toBe(404);
  });

  test('SMS déjà traité → 409', async () => {
    const { pool } = poolFactice([
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [{ statut: 'envoye' }] },
    ]);
    const res = await request(creerApp(pool))
      .post(`/api/sms/${UUID_SMS}/echec`).set(entete()).send({ erreur: 'x' });
    expect(res.status).toBe(409);
  });
});
