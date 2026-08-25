const request = require('supertest');
const creerApp = require('../app');
const { signerJeton } = require('../auth/jeton');

const UUID_TEST = '11111111-1111-1111-1111-111111111111';
const UUID_REPASSEUSE = '22222222-2222-2222-2222-222222222222';
const maintenant = () => Math.floor(Date.now() / 1000);
const jetonValide = () =>
  signerJeton({ id_utilisateur: UUID_TEST, role: 'gerante', session_debut: maintenant() });
const jetonRepasseuse = () =>
  signerJeton({ id_utilisateur: UUID_REPASSEUSE, role: 'repasseuse', session_debut: maintenant() });

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

describe('DELETE /api/clients/:id — suppression définitive', () => {
  // Faux pool transactionnel qui JOURNALISE le SQL émis. C'est ce journal qui permet de prouver
  // non seulement ce qui a été fait, mais surtout ce qui ne l'a PAS été (cf. le test du 409).
  // Même technique que les tests de transaction du #160 et du #220.
  function fauxPool({ clientTrouve = true, nbActives = 0, nbDetachees = 0, erreur = false } = {}) {
    const appels = [];
    const connexion = {
      query: async (texte) => {
        const sql = texte.trim();
        appels.push(sql);
        if (erreur && /^UPDATE commande/i.test(sql)) throw new Error('boom');
        if (/^SELECT id_client FROM client/i.test(sql)) {
          return { rowCount: clientTrouve ? 1 : 0, rows: clientTrouve ? [{ id_client: 'c1' }] : [] };
        }
        if (/count\(\*\)/i.test(sql)) return { rowCount: 1, rows: [{ nb: nbActives }] };
        if (/^UPDATE commande/i.test(sql)) return { rowCount: nbDetachees };
        if (/^DELETE FROM client/i.test(sql)) return { rowCount: 1 };
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    };
    return {
      pool: { query: async () => ({ rows: [] }), connect: async () => connexion },
      appels,
    };
  }

  test('sans jeton → 401', async () => {
    const { pool } = fauxPool();
    const res = await request(creerApp(pool)).delete('/api/clients/abc');
    expect(res.status).toBe(401);
  });

  test('client sans commande → 200 et 0 commande détachée', async () => {
    const { pool, appels } = fauxPool({ nbDetachees: 0 });
    const res = await request(creerApp(pool))
      .delete('/api/clients/abc')
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ supprime: true, commandes_detachees: 0 });
    expect(appels).toContain('COMMIT');
  });

  // Le cœur de la fonctionnalité : les commandes ne sont pas supprimées, elles perdent leur
  // propriétaire. Sans cela, les statistiques du #300 diminueraient rétroactivement.
  test('client avec 3 commandes récupérées → 200, les commandes sont détachées', async () => {
    const { pool, appels } = fauxPool({ nbDetachees: 3 });
    const res = await request(creerApp(pool))
      .delete('/api/clients/abc')
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(200);
    expect(res.body.commandes_detachees).toBe(3);
    expect(appels.some((s) => /^UPDATE commande SET id_client = NULL/i.test(s))).toBe(true);
    expect(appels.some((s) => /^DELETE FROM client/i.test(s))).toBe(true);
    expect(appels).toContain('COMMIT');
  });

  // Le linge est physiquement dans l'atelier : refuser, et surtout ne RIEN écrire.
  test('client avec une commande non récupérée → 409 sans aucun UPDATE ni DELETE', async () => {
    const { pool, appels } = fauxPool({ nbActives: 2 });
    const res = await request(creerApp(pool))
      .delete('/api/clients/abc')
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(409);
    expect(res.body.commandes_actives).toBe(2);
    expect(res.body.message).toMatch(/2 commande/);
    expect(appels.some((s) => /^UPDATE|^DELETE/i.test(s))).toBe(false);
    expect(appels).toContain('ROLLBACK');
    expect(appels).not.toContain('COMMIT');
  });

  test('client inexistant → 404 + ROLLBACK', async () => {
    const { pool, appels } = fauxPool({ clientTrouve: false });
    const res = await request(creerApp(pool))
      .delete('/api/clients/zzz')
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(404);
    expect(appels).toContain('ROLLBACK');
  });

  test('erreur SQL → 500 + ROLLBACK', async () => {
    const { pool, appels } = fauxPool({ erreur: true });
    const res = await request(creerApp(pool))
      .delete('/api/clients/abc')
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(500);
    expect(appels).toContain('ROLLBACK');
  });
});

describe('Autorisation par rôle sur les routes clients (US #115)', () => {
  // Pool "compteur" : révèle si le handler a été atteint (le garde doit couper avant).
  // `connect` est indispensable depuis que DELETE travaille en transaction : sans lui, l'appel
  // à pool.connect() lèverait un TypeError qu'Express 4 ne rattrape pas sur un handler async —
  // la requête resterait sans réponse et le test attendrait indéfiniment au lieu d'échouer.
  function appCompteur() {
    let requetesDB = 0;
    const repondre = async (sql) => {
      requetesDB++;
      if (sql.trim().startsWith('DELETE')) return { rowCount: 1 };
      if (sql.trim().startsWith('UPDATE')) return { rowCount: 1, rows: [{ id_client: 'x' }] };
      return { rowCount: 1, rows: [{ id_client: 'x', nom: 'A', prenom: 'B', telephone: '0', email: null, code_barre: 'AB', date_creation: 'x', nb: 0 }] };
    };
    const app = creerApp({
      query: repondre,
      connect: async () => ({ query: repondre, release: () => {} }),
    });
    return { app, getRequetesDB: () => requetesDB };
  }

  // Chaque route sensible, décrite pour itérer proprement.
  const routes = [
    { methode: 'get', chemin: '/api/clients' },
    { methode: 'post', chemin: '/api/clients' },
    { methode: 'put', chemin: '/api/clients/abc' },
    { methode: 'delete', chemin: '/api/clients/abc' },
  ];

  describe('une repasseuse est refusée (403) et n’atteint jamais la DB', () => {
    test.each(routes)('$methode $chemin → 403', async ({ methode, chemin }) => {
      const { app, getRequetesDB } = appCompteur();
      const res = await request(app)[methode](chemin)
        .set('Authorization', `Bearer ${jetonRepasseuse()}`)
        .send(corpsValide);
      expect(res.status).toBe(403);
      expect(getRequetesDB()).toBe(0); // garde coupe avant tout accès DB
    });
  });

  describe('une gérante franchit le garde (jamais 403)', () => {
    test.each(routes)('$methode $chemin → pas 403', async ({ methode, chemin }) => {
      const { app } = appCompteur();
      const res = await request(app)[methode](chemin)
        .set('Authorization', `Bearer ${jetonValide()}`)
        .send(corpsValide);
      expect(res.status).not.toBe(403);
    });
  });
});

describe('GET /api/clients/code-barre/:code (US #150)', () => {
  const clientRow = {
    id_client: '1', nom: 'Dupont', prenom: 'Marie', telephone: '0470',
    email: null, code_barre: 'K7QF2M9X', date_creation: 'x',
  };

  test('sans jeton → 401', async () => {
    const app = creerApp({ query: async () => ({ rowCount: 0, rows: [] }) });
    const res = await request(app).get('/api/clients/code-barre/K7QF2M9X');
    expect(res.status).toBe(401);
  });

  test('code connu → 200 + client', async () => {
    const app = creerApp({ query: async () => ({ rowCount: 1, rows: [clientRow] }) });
    const res = await request(app)
      .get('/api/clients/code-barre/K7QF2M9X')
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(200);
    expect(res.body.code_barre).toBe('K7QF2M9X');
  });

  test('code inconnu → 404', async () => {
    const app = creerApp({ query: async () => ({ rowCount: 0, rows: [] }) });
    const res = await request(app)
      .get('/api/clients/code-barre/ZZZ')
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(404);
  });

  test('repasseuse autorisée → 200 (pas 403)', async () => {
    const app = creerApp({ query: async () => ({ rowCount: 1, rows: [clientRow] }) });
    const res = await request(app)
      .get('/api/clients/code-barre/K7QF2M9X')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);
  });
});

describe('Validation du téléphone (US #270)', () => {
  test('POST avec un numéro sans le zéro initial → 400 sans accès DB', async () => {
    let db = 0;
    const app = creerApp({ query: async () => { db++; return { rows: [] }; } });
    const res = await request(app).post('/api/clients')
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send({ ...corpsValide, telephone: '475664101' });
    expect(res.status).toBe(400);
    expect(db).toBe(0);
  });

  test('POST stocke le numéro normalisé (espaces retirés)', async () => {
    const appels = [];
    const app = creerApp({
      query: async (sql, params) => { appels.push({ sql, params }); return { rows: [{ id_client: 'c1' }] }; },
    });
    await request(app).post('/api/clients')
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send({ ...corpsValide, telephone: '0475 66 41 01' });
    expect(appels[0].params[2]).toBe('0475664101');
  });

  test('PUT stocke le numéro normalisé (+32 ramené au national)', async () => {
    const appels = [];
    const app = creerApp({
      query: async (sql, params) => { appels.push({ sql, params }); return { rowCount: 1, rows: [{ id_client: 'c1' }] }; },
    });
    await request(app).put(`/api/clients/${UUID_TEST}`)
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send({ ...corpsValide, telephone: '+32475664101' });
    expect(appels[0].params[2]).toBe('0475664101');
  });

  test('fixe accepté : le client est encodable, il sera appelé', async () => {
    const app = creerApp({ query: async () => ({ rows: [{ id_client: 'c1' }] }) });
    const res = await request(app).post('/api/clients')
      .set('Authorization', `Bearer ${jetonValide()}`)
      .send({ ...corpsValide, telephone: '068 12 34 56' });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/clients/:id/historique (US #290)', () => {
  const clientRow = { id_client: UUID_TEST, nom: 'Dupont', prenom: 'Marie' };
  const cmd = (id, date) => ({
    id_commande: id, statut: 'recupere', nombre_mannes: 3, prioritaire: false,
    cintres_client: false, cintres_entr_rendus: false, cintres_entr_nb: null,
    temps_repassage_s: 1840, date_reception: date, date_recuperation: date,
  });
  const evt = (idCommande, nouveau, qui) => ({
    id_commande: idCommande, ancien_statut: 'a_faire', nouveau_statut: nouveau,
    horodatage: '2026-08-01T10:00:00Z', utilisateur: qui,
  });

  // Faux pool : répond selon la table interrogée, et mémorise les appels.
  function poolHistorique({ client = clientRow, commandes = [], evenements = [] }) {
    const appels = [];
    const pool = {
      query: async (sql, params) => {
        appels.push({ sql, params });
        if (/FROM client WHERE id_client/i.test(sql)) {
          return client ? { rowCount: 1, rows: [client] } : { rowCount: 0, rows: [] };
        }
        if (/FROM historique_statut/i.test(sql)) {
          return { rowCount: evenements.length, rows: evenements };
        }
        if (/FROM commande/i.test(sql)) {
          return { rowCount: commandes.length, rows: commandes };
        }
        return { rowCount: 0, rows: [] };
      },
    };
    return { pool, appels };
  }

  test('sans jeton → 401', async () => {
    const { pool } = poolHistorique({});
    const res = await request(creerApp(pool)).get(`/api/clients/${UUID_TEST}/historique`);
    expect(res.status).toBe(401);
  });

  test('repasseuse → 403 (outil de gérante)', async () => {
    const { pool } = poolHistorique({});
    const res = await request(creerApp(pool))
      .get(`/api/clients/${UUID_TEST}/historique`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(403);
  });

  test('client inexistant → 404', async () => {
    const { pool } = poolHistorique({ client: null });
    const res = await request(creerApp(pool))
      .get(`/api/clients/${UUID_TEST}/historique`)
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(404);
  });

  test('client sans commande → 200 et liste vide, sans interroger historique_statut', async () => {
    const { pool, appels } = poolHistorique({ commandes: [] });
    const res = await request(creerApp(pool))
      .get(`/api/clients/${UUID_TEST}/historique`)
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(200);
    expect(res.body.commandes).toEqual([]);
    expect(res.body.client.nom).toBe('Dupont');
    expect(appels.some((a) => /FROM historique_statut/i.test(a.sql))).toBe(false);
  });

  test('regroupe chaque événement sous SA commande, tableau vide si aucun', async () => {
    const { pool } = poolHistorique({
      commandes: [cmd('c1', '2026-08-03'), cmd('c2', '2026-08-02'), cmd('c3', '2026-08-01')],
      evenements: [evt('c1', 'en_cours', 'Sophie'), evt('c1', 'fait', 'Sophie'), evt('c2', 'en_cours', 'Julie')],
    });
    const res = await request(creerApp(pool))
      .get(`/api/clients/${UUID_TEST}/historique`)
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(res.status).toBe(200);
    expect(res.body.commandes[0].evenements).toHaveLength(2);
    expect(res.body.commandes[1].evenements).toHaveLength(1);
    expect(res.body.commandes[2].evenements).toEqual([]);
    expect(res.body.commandes[1].evenements[0].utilisateur).toBe('Julie');
  });

  test("une SEULE requête d'événements quel que soit le nombre de commandes (anti N+1)", async () => {
    const { pool, appels } = poolHistorique({
      commandes: [cmd('c1', '2026-08-03'), cmd('c2', '2026-08-02'), cmd('c3', '2026-08-01')],
      evenements: [evt('c1', 'fait', 'Sophie')],
    });
    await request(creerApp(pool))
      .get(`/api/clients/${UUID_TEST}/historique`)
      .set('Authorization', `Bearer ${jetonValide()}`);
    expect(appels.filter((a) => /FROM historique_statut/i.test(a.sql))).toHaveLength(1);
    expect(appels).toHaveLength(3); // client + commandes + événements
  });

  test('commandes triées de la plus récente à la plus ancienne', async () => {
    const { pool, appels } = poolHistorique({ commandes: [cmd('c1', '2026-08-03')] });
    await request(creerApp(pool))
      .get(`/api/clients/${UUID_TEST}/historique`)
      .set('Authorization', `Bearer ${jetonValide()}`);
    const req = appels.find((a) => /FROM commande/i.test(a.sql));
    expect(req.sql).toMatch(/ORDER BY date_reception DESC/i);
  });
});
