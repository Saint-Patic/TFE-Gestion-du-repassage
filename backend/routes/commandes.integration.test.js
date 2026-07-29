const request = require('supertest');
const creerApp = require('../app');
const { signerJeton } = require('../auth/jeton');

const UUID_GERANTE = '11111111-1111-1111-1111-111111111111';
const UUID_REPASSEUSE = '22222222-2222-2222-2222-222222222222';
const UUID_CLIENT = '33333333-3333-3333-3333-333333333333';
const maintenant = () => Math.floor(Date.now() / 1000);
const jetonGerante = () =>
  signerJeton({ id_utilisateur: UUID_GERANTE, role: 'gerante', session_debut: maintenant() });
const jetonRepasseuse = () =>
  signerJeton({ id_utilisateur: UUID_REPASSEUSE, role: 'repasseuse', session_debut: maintenant() });

const commandeCreee = {
  id_commande: 'cmd1', id_client: UUID_CLIENT, statut: 'a_faire',
  nombre_mannes: 3, prioritaire: false, date_reception: 'x',
};

describe('POST /api/commandes (US #150)', () => {
  test('sans jeton → 401', async () => {
    const app = creerApp({ query: async () => ({ rows: [commandeCreee] }) });
    const res = await request(app)
      .post('/api/commandes')
      .send({ id_client: UUID_CLIENT, nombre_mannes: 3 });
    expect(res.status).toBe(401);
  });

  test('création valide (gérante) → 201 + statut a_faire', async () => {
    const app = creerApp({ query: async () => ({ rows: [commandeCreee] }) });
    const res = await request(app)
      .post('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ id_client: UUID_CLIENT, nombre_mannes: 3 });
    expect(res.status).toBe(201);
    expect(res.body.statut).toBe('a_faire');
    expect(res.body.nombre_mannes).toBe(3);
  });

  test('repasseuse autorisée → 201', async () => {
    const app = creerApp({ query: async () => ({ rows: [commandeCreee] }) });
    const res = await request(app)
      .post('/api/commandes')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ id_client: UUID_CLIENT, nombre_mannes: 3 });
    expect(res.status).toBe(201);
  });

  test('nombre_mannes < 1 → 400 sans accès DB', async () => {
    let requetesDB = 0;
    const app = creerApp({ query: async () => { requetesDB++; return { rows: [commandeCreee] }; } });
    const res = await request(app)
      .post('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ id_client: UUID_CLIENT, nombre_mannes: 0 });
    expect(res.status).toBe(400);
    expect(requetesDB).toBe(0);
  });

  test('id_client manquant → 400', async () => {
    const app = creerApp({ query: async () => ({ rows: [commandeCreee] }) });
    const res = await request(app)
      .post('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ nombre_mannes: 3 });
    expect(res.status).toBe(400);
  });

  test('client inexistant (FK 23503) → 400', async () => {
    const app = creerApp({
      query: async () => { const e = new Error('FK'); e.code = '23503'; throw e; },
    });
    const res = await request(app)
      .post('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ id_client: UUID_CLIENT, nombre_mannes: 3 });
    expect(res.status).toBe(400);
  });
});
