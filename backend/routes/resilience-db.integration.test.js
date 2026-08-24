const request = require('supertest');
const creerApp = require('../app');
const { signerJeton } = require('../auth/jeton');

const UUID_GERANTE = '11111111-1111-1111-1111-111111111111';
const UUID_REPASSEUSE = '22222222-2222-2222-2222-222222222222';
const UUID_CIBLE = '55555555-5555-5555-5555-555555555555';
const maintenant = () => Math.floor(Date.now() / 1000);
const jetonGerante = () =>
  signerJeton({ id_utilisateur: UUID_GERANTE, role: 'gerante', session_debut: maintenant() });
const jetonRepasseuse = () =>
  signerJeton({ id_utilisateur: UUID_REPASSEUSE, role: 'repasseuse', session_debut: maintenant() });

const emplacements = [{ id_emplacement: 'e1', nombre_mannes: 1 }];

// Les six routes transactionnelles du projet, avec un corps valide : la validation s'exécute
// avant pool.connect() et renverrait 400 sans atteindre le code visé.
const ROUTES = [
  ['DELETE /api/clients/:id', (app) =>
    request(app).delete(`/api/clients/${UUID_CIBLE}`)
      .set('Authorization', `Bearer ${jetonGerante()}`)],
  ['POST /api/commandes/:id/demarrer', (app) =>
    request(app).post(`/api/commandes/${UUID_CIBLE}/demarrer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)],
  ['POST /api/commandes/:id/cloturer', (app) =>
    request(app).post(`/api/commandes/${UUID_CIBLE}/cloturer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`).send({ emplacements })],
  ['POST /api/commandes/:id/recuperer', (app) =>
    request(app).post(`/api/commandes/${UUID_CIBLE}/recuperer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)],
  ['POST /api/commandes/:id/emplacements', (app) =>
    request(app).post(`/api/commandes/${UUID_CIBLE}/emplacements`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`).send({ emplacements })],
  ['POST /api/emplacements/deplacer', (app) =>
    request(app).post('/api/emplacements/deplacer')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ id_source: 'e1', id_destination: 'e2', id_client: 'cl1' })],
];

// PostgreSQL injoignable ou pool saturé : même l'obtention d'une connexion échoue.
const poolInjoignable = {
  query: async () => { throw new Error('base injoignable'); },
  connect: async () => { throw new Error('base injoignable'); },
};

// La connexion est obtenue puis meurt : toute requête échoue, ROLLBACK compris.
function poolMourant() {
  let relachee = false;
  const connexion = {
    query: async () => { throw new Error('connexion perdue'); },
    release: () => { relachee = true; },
  };
  return {
    pool: { query: async () => { throw new Error('connexion perdue'); }, connect: async () => connexion },
    estRelachee: () => relachee,
  };
}

// Le défaut visé n'est pas une erreur de requête mais l'ABSENCE de réponse : avant correctif,
// pool.connect() rejetait hors du try et Express 4 ne rattrape pas un handler async.
describe.each(ROUTES)('Base injoignable — %s', (_nom, faireAppel) => {
  test('répond 500 au lieu de ne pas répondre', async () => {
    const res = await faireAppel(creerApp(poolInjoignable));
    expect(res.status).toBe(500);
  });
});

// Ce que couvrent les gardes `.catch(() => {})` : un ROLLBACK qui échoue à son tour ne doit
// pas relancer depuis le catch, sinon on retombe dans l'absence de réponse.
describe.each(ROUTES)('Connexion perdue en cours de transaction — %s', (_nom, faireAppel) => {
  test('répond 500 et relâche la connexion', async () => {
    const f = poolMourant();
    const res = await faireAppel(creerApp(f.pool));
    expect(res.status).toBe(500);
    expect(f.estRelachee()).toBe(true);
  });
});
