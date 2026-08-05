const request = require('supertest');
const creerApp = require('../app');
const { reinitialiser } = require('../auth/verrouillage');
const {
  creerPoolTest,
  preparerBase,
  viderTables,
  semerUtilisateurs,
  UUID_GERANTE,
  PIN_TEST,
} = require('./aide-base');

let pool;
let app;

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
  // ⚠️ Le verrouillage vit en MÉMOIRE (une Map de module), pas en base : vider les tables
  // ne le remet pas à zéro. Sans cette ligne, un test hériterait des échecs du précédent
  // selon l'ordre d'exécution, et l'échec serait incompréhensible.
  reinitialiser(UUID_GERANTE);
});

// Ce scénario traverse route + bcrypt + verrouillage + base : le plus « intégration » de
// tous. auth/verrouillage.js est à 100 % depuis le #320, mais rien ne prouvait que la
// route s'en serve — un module parfaitement testé peut n'être branché nulle part.
describe('connexion et verrouillage en base réelle (US #330)', () => {
  test('PIN correct → 200, jeton et utilisatrice', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ id_utilisateur: UUID_GERANTE, pin: PIN_TEST });

    expect(res.status).toBe(200);
    expect(typeof res.body.jeton).toBe('string');
    expect(res.body.utilisateur.role).toBe('gerante');
    // Le hachage ne doit jamais franchir la frontière HTTP.
    expect(JSON.stringify(res.body)).not.toMatch(/code_pin_hache/);
  });

  test('cinq PIN faux consécutifs → 429 avec retryAfter', async () => {
    for (let i = 0; i < 5; i++) {
      const echec = await request(app)
        .post('/api/auth/login')
        .send({ id_utilisateur: UUID_GERANTE, pin: '0000' });
      expect(echec.status).toBe(401);
    }

    // Le sixième essai est refusé AVANT même de vérifier le PIN — et il l'est même avec
    // le BON code : c'est précisément ce qui rend le verrou utile face à une attaque.
    const res = await request(app)
      .post('/api/auth/login')
      .send({ id_utilisateur: UUID_GERANTE, pin: PIN_TEST });

    expect(res.status).toBe(429);
    expect(res.body.retryAfter).toBeGreaterThan(0);

    reinitialiser(UUID_GERANTE);
  });
});
