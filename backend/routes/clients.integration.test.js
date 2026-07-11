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

describe('Unicité du code-barres (US #95)', () => {
  // Fabrique un app dont l'INSERT échoue `nbCollisions` fois avec 23505 avant de réussir.
  // `codeErreurAutre` force plutôt une autre erreur (non-collision) dès le 1er appel.
  function appAvecComportement({ nbCollisions = 0, codeErreurAutre = null } = {}) {
    let appels = 0;
    const codesEssayes = [];
    const app = creerApp({
      query: async (sql, params) => {
        appels++;
        codesEssayes.push(params[4]);
        if (codeErreurAutre) {
          const err = new Error('autre erreur');
          err.code = codeErreurAutre;
          throw err;
        }
        if (appels <= nbCollisions) {
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
    return { app, getAppels: () => appels, codesEssayes };
  }

  test('A. épuisement des tentatives (toujours 23505) → 500 + arrêt propre', async () => {
    const { app, getAppels, codesEssayes } = appAvecComportement({ nbCollisions: 999 });
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send(corpsValide);
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/code-barres unique/);
    expect(getAppels()).toBe(5); // MAX_TENTATIVES : la boucle ne part pas à l'infini
    expect(new Set(codesEssayes).size).toBe(5); // 5 codes distincts essayés
  });

  test('B. collisions multiples successives puis succès → 201', async () => {
    const { app, getAppels } = appAvecComportement({ nbCollisions: 3 });
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send(corpsValide);
    expect(res.status).toBe(201);
    expect(getAppels()).toBe(4); // 3 collisions + 1 succès
  });

  test('C. erreur non-23505 → 500 sans réessai', async () => {
    const { app, getAppels } = appAvecComportement({ codeErreurAutre: '23502' });
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send(corpsValide);
    expect(res.status).toBe(500);
    expect(getAppels()).toBe(1); // pas de régénération pour une erreur autre qu'une collision
  });
});

describe('GET /api/clients (US #100)', () => {
  test('sans jeton → 401', async () => {
    const app = creerApp({ query: async () => ({ rows: [] }) });
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
  });

  test('avec jeton → 200 + tableau', async () => {
    const clients = [{
      id_client: '1', nom: 'Dupont', prenom: 'Marie', telephone: '0470',
      email: null, code_barre: 'AB', date_creation: 'x',
    }];
    const app = creerApp({ query: async () => ({ rows: clients }) });
    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nom).toBe('Dupont');
  });
});

describe('PUT /api/clients/:id (US #100)', () => {
  const modif = { nom: 'Durand', prenom: 'Luc', telephone: '0480000000' };

  test('modification valide → 200 + client modifié', async () => {
    const app = creerApp({
      query: async (sql, params) => ({
        rowCount: 1,
        rows: [{
          id_client: params[4], nom: params[0], prenom: params[1], telephone: params[2],
          email: params[3], code_barre: 'AB', date_creation: 'x',
        }],
      }),
    });
    const res = await request(app)
      .put('/api/clients/abc')
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send(modif);
    expect(res.status).toBe(200);
    expect(res.body.nom).toBe('Durand');
  });

  test('champ requis manquant → 400', async () => {
    const app = creerApp({ query: async () => ({ rowCount: 1, rows: [] }) });
    const res = await request(app)
      .put('/api/clients/abc')
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send({ nom: 'Durand' });
    expect(res.status).toBe(400);
  });

  test('id inexistant → 404', async () => {
    const app = creerApp({ query: async () => ({ rowCount: 0, rows: [] }) });
    const res = await request(app)
      .put('/api/clients/zzz')
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send(modif);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/clients/:id (US #100)', () => {
  test('client sans commande → 200 { anonymise: false }', async () => {
    const app = creerApp({
      query: async (sql) => (sql.trim().startsWith('DELETE') ? { rowCount: 1 } : { rows: [] }),
    });
    const res = await request(app)
      .delete('/api/clients/abc')
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ anonymise: false });
  });

  test('client avec commandes (23503) → 200 { anonymise: true }', async () => {
    const app = creerApp({
      query: async (sql) => {
        if (sql.trim().startsWith('DELETE')) {
          const e = new Error('violation FK');
          e.code = '23503';
          throw e;
        }
        if (sql.trim().startsWith('UPDATE')) return { rowCount: 1 };
        return { rows: [] };
      },
    });
    const res = await request(app)
      .delete('/api/clients/abc')
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ anonymise: true });
  });

  test('id inexistant → 404', async () => {
    const app = creerApp({
      query: async (sql) => (sql.trim().startsWith('DELETE') ? { rowCount: 0 } : { rows: [] }),
    });
    const res = await request(app)
      .delete('/api/clients/zzz')
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(404);
  });

  test('sans jeton → 401', async () => {
    const app = creerApp({ query: async () => ({ rowCount: 0 }) });
    const res = await request(app).delete('/api/clients/abc');
    expect(res.status).toBe(401);
  });
});
