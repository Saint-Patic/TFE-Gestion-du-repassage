const request = require('supertest');
const creerApp = require('../app');
const { signerJeton } = require('../auth/jeton');

const UUID_TEST = '11111111-1111-1111-1111-111111111111';
const maintenant = () => Math.floor(Date.now() / 1000);
const jetonValide = () =>
  signerJeton({ id_utilisateur: UUID_TEST, role: 'gerante', session_debut: maintenant() });

const corpsValide = { nom: 'Dupont', prenom: 'Marie', telephone: '0470000000' };

describe('POST /api/clients (US #90)', () => {
  test('sans jeton → 401', async () => {
    const app = creerApp({ query: async () => ({ rows: [] }) });
    const res = await request(app).post('/api/clients').send(corpsValide);
    expect(res.status).toBe(401);
  });

  test('champ requis manquant → 400', async () => {
    const app = creerApp({ query: async () => ({ rows: [] }) });
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send({ nom: 'Dupont' });
    expect(res.status).toBe(400);
  });

  test('création valide → 201 + code_barre de 8 caractères', async () => {
    const app = creerApp({
      query: async (sql, params) => ({
        rows: [{
          id_client: 'abc', nom: params[0], prenom: params[1], telephone: params[2],
          email: params[3], code_barre: params[4], date_creation: 'x',
        }],
      }),
    });
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send(corpsValide);
    expect(res.status).toBe(201);
    expect(res.body.code_barre).toHaveLength(8);
  });

  test('collision 23505 une fois puis succès → 201 (réessai)', async () => {
    let appels = 0;
    const app = creerApp({
      query: async (sql, params) => {
        appels++;
        if (appels === 1) {
          const err = new Error('doublon');
          err.code = '23505';
          throw err;
        }
        return {
          rows: [{
            id_client: 'abc', nom: params[0], prenom: params[1], telephone: params[2],
            email: params[3], code_barre: params[4], date_creation: 'x',
          }],
        };
      },
    });
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send(corpsValide);
    expect(res.status).toBe(201);
    expect(appels).toBe(2);
  });
});
