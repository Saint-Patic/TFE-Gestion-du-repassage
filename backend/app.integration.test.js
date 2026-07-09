const request = require('supertest');
const jwt = require('jsonwebtoken');
const creerApp = require('./app');
const { hacherPin } = require('./auth/pin');
const { signerJeton } = require('./auth/jeton');

const UUID_TEST = '11111111-1111-1111-1111-111111111111';
const PIN_TEST = '4321';

let app;
let hacheTest;

const maintenant = () => Math.floor(Date.now() / 1000);

// Jeton forgé directement pour maîtriser session_debut et l'expiration.
function forgerJeton({ session_debut, expiresIn }) {
  return jwt.sign(
    { sub: UUID_TEST, role: 'gerante', session_debut },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}

beforeAll(async () => {
  hacheTest = await hacherPin(PIN_TEST);
  // Faux pool : renvoie l'utilisatrice de test pour la requête de login, sinon vide.
  const fauxPool = {
    query: async (sql, params) => {
      if (
        sql.includes('FROM utilisateur WHERE id_utilisateur') &&
        params &&
        params[0] === UUID_TEST
      ) {
        return {
          rows: [
            {
              id_utilisateur: UUID_TEST,
              nom: 'Gérante Test',
              role: 'gerante',
              code_pin_hache: hacheTest,
            },
          ],
        };
      }
      return { rows: [] };
    },
  };
  app = creerApp(fauxPool);
});

describe('Cycle de session (US #55)', () => {
  test('1. POST /login avec bon PIN → 200 + jeton + utilisateur', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ id_utilisateur: UUID_TEST, pin: PIN_TEST });
    expect(res.status).toBe(200);
    expect(typeof res.body.jeton).toBe('string');
    expect(res.body.utilisateur.role).toBe('gerante');
  });

  test('2. POST /login avec mauvais PIN → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ id_utilisateur: UUID_TEST, pin: '0000' });
    expect(res.status).toBe(401);
  });

  test('3. GET /session avec jeton valide → 200', async () => {
    const jeton = signerJeton({
      id_utilisateur: UUID_TEST,
      role: 'gerante',
      session_debut: maintenant(),
    });
    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${jeton}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id_utilisateur: UUID_TEST, role: 'gerante' });
  });

  test('4. GET /session sans jeton → 401', async () => {
    const res = await request(app).get('/api/auth/session');
    expect(res.status).toBe(401);
  });

  test('5. GET /session avec jeton expiré → 401', async () => {
    const jeton = forgerJeton({ session_debut: maintenant(), expiresIn: -1 });
    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${jeton}`);
    expect(res.status).toBe(401);
  });

  test('6. POST /refresh dans la fenêtre → 200 + nouveau jeton', async () => {
    const jeton = signerJeton({
      id_utilisateur: UUID_TEST,
      role: 'gerante',
      session_debut: maintenant(),
    });
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${jeton}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.jeton).toBe('string');
  });

  test('7. POST /refresh après le plafond de 12h → 401', async () => {
    const jeton = forgerJeton({
      session_debut: maintenant() - 13 * 3600,
      expiresIn: 3600,
    });
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${jeton}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Session expirée/);
  });

  test('8. POST /refresh sans jeton → 401', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});
