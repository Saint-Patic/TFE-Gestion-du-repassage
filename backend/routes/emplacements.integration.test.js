const request = require('supertest');
const creerApp = require('../app');
const { signerJeton } = require('../auth/jeton');

const UUID_GERANTE = '11111111-1111-1111-1111-111111111111';
const UUID_REPASSEUSE = '22222222-2222-2222-2222-222222222222';
const maintenant = () => Math.floor(Date.now() / 1000);
const jetonGerante = () =>
  signerJeton({ id_utilisateur: UUID_GERANTE, role: 'gerante', session_debut: maintenant() });
const jetonRepasseuse = () =>
  signerJeton({ id_utilisateur: UUID_REPASSEUSE, role: 'repasseuse', session_debut: maintenant() });

const emplacements = [
  { id_emplacement: 'e1', code_barre: 'A1G', etagere: 'A', niveau: 1, position: 'gauche' },
  { id_emplacement: 'e2', code_barre: 'B2C', etagere: 'B', niveau: 2, position: 'centre' },
];

describe('GET /api/emplacements (US #160)', () => {
  test('sans jeton → 401', async () => {
    const app = creerApp({ query: async () => ({ rows: emplacements }) });
    const res = await request(app).get('/api/emplacements');
    expect(res.status).toBe(401);
  });

  test('gérante → 200 + liste', async () => {
    const app = creerApp({ query: async () => ({ rows: emplacements }) });
    const res = await request(app)
      .get('/api/emplacements')
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].code_barre).toBe('A1G');
  });

  test('repasseuse autorisée → 200', async () => {
    const app = creerApp({ query: async () => ({ rows: emplacements }) });
    const res = await request(app)
      .get('/api/emplacements')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);
  });

  test('renvoie est_au_sol + client occupant (US #190)', async () => {
    let sqlVue = '';
    const rows = [
      { id_emplacement: 'e1', code_barre: 'A1G', etagere: 'A', niveau: 1, position: 'gauche',
        est_au_sol: false, id_client_occupant: 'cl1', client_nom_occupant: 'Dupont', client_prenom_occupant: 'Marie' },
      { id_emplacement: 'sol', code_barre: 'SOL', etagere: null, niveau: null, position: null,
        est_au_sol: true, id_client_occupant: null, client_nom_occupant: null, client_prenom_occupant: null },
    ];
    const app = creerApp({ query: async (sql) => { sqlVue = sql; return { rows }; } });
    const res = await request(app)
      .get('/api/emplacements')
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(res.body[0].id_client_occupant).toBe('cl1');
    expect(res.body[1].est_au_sol).toBe(true);
    expect(sqlVue).toMatch(/est_au_sol/);
    expect(sqlVue).toMatch(/LEFT JOIN LATERAL/i);
  });
});

describe('GET /api/emplacements/:id/contenu (US #190)', () => {
  const contenu = [
    { id_commande: 'c1', nombre_mannes: 2, statut: 'a_faire', id_client: 'cl1', client_nom: 'Dupont', client_prenom: 'Marie' },
  ];

  test('sans jeton → 401', async () => {
    const app = creerApp({ query: async () => ({ rows: contenu }) });
    const res = await request(app).get('/api/emplacements/e1/contenu');
    expect(res.status).toBe(401);
  });

  test('gérante → 403', async () => {
    const app = creerApp({ query: async () => ({ rows: contenu }) });
    const res = await request(app)
      .get('/api/emplacements/e1/contenu')
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(403);
  });

  test('repasseuse → 200 + contenu', async () => {
    const app = creerApp({ query: async () => ({ rows: contenu }) });
    const res = await request(app)
      .get('/api/emplacements/e1/contenu')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);
    expect(res.body[0].client_nom).toBe('Dupont');
  });

  test('emplacement vide → 200 + []', async () => {
    const app = creerApp({ query: async () => ({ rows: [] }) });
    const res = await request(app)
      .get('/api/emplacements/e9/contenu')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// Faux pool transactionnel pour POST /deplacer.
// options : { sourceRows, destExiste=true, destAuSol=false, autreClient=false, erreurInsert }
function fauxPoolDeplacer(options) {
  const appels = [];
  let connexions = 0;
  const client = {
    query: async (sql, params) => {
      appels.push({ sql, params });
      if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(sql)) return {};
      if (/INSERT INTO commande_emplacement/i.test(sql)) {
        if (options.erreurInsert) { const e = new Error('FK'); e.code = options.erreurInsert; throw e; }
        return { rowCount: 1 };
      }
      if (/DELETE FROM commande_emplacement/i.test(sql)) return { rowCount: options.sourceRows.length };
      if (/SELECT est_au_sol FROM emplacement/i.test(sql)) {
        return options.destExiste === false
          ? { rowCount: 0, rows: [] }
          : { rowCount: 1, rows: [{ est_au_sol: !!options.destAuSol }] };
      }
      if (/id_client <> \$2/i.test(sql)) {
        return { rowCount: options.autreClient ? 1 : 0, rows: [] };
      }
      // sinon : SELECT des lignes source du client
      return { rowCount: options.sourceRows.length, rows: options.sourceRows };
    },
    release: () => {},
  };
  const pool = {
    query: async () => ({ rows: [] }),
    connect: async () => { connexions++; return client; },
  };
  return { pool, appels, get connexions() { return connexions; } };
}

const UUID_SRC = '55555555-5555-5555-5555-555555555555';
const UUID_DST = '66666666-6666-6666-6666-666666666666';
const UUID_CLI = '33333333-3333-3333-3333-333333333333';
const sourceLot = [{ id_commande: 'cmd1', nombre_mannes: 2 }];

describe('POST /api/emplacements/deplacer (US #190)', () => {
  function corps(extra = {}) {
    return { id_source: UUID_SRC, id_destination: UUID_DST, id_client: UUID_CLI, ...extra };
  }

  test('sans jeton → 401', async () => {
    const f = fauxPoolDeplacer({ sourceRows: sourceLot });
    const res = await request(creerApp(f.pool)).post('/api/emplacements/deplacer').send(corps());
    expect(res.status).toBe(401);
  });

  test('gérante → 403', async () => {
    const f = fauxPoolDeplacer({ sourceRows: sourceLot });
    const res = await request(creerApp(f.pool))
      .post('/api/emplacements/deplacer')
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send(corps());
    expect(res.status).toBe(403);
  });

  test('source == destination → 400 sans transaction', async () => {
    const f = fauxPoolDeplacer({ sourceRows: sourceLot });
    const res = await request(creerApp(f.pool))
      .post('/api/emplacements/deplacer')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send(corps({ id_destination: UUID_SRC }));
    expect(res.status).toBe(400);
    expect(f.connexions).toBe(0);
  });

  test('aucune manne du client à la source → 400', async () => {
    const f = fauxPoolDeplacer({ sourceRows: [] });
    const res = await request(creerApp(f.pool))
      .post('/api/emplacements/deplacer')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send(corps());
    expect(res.status).toBe(400);
  });

  test('déplacement étagère → étagère → 200 + supprime seulement le client', async () => {
    const f = fauxPoolDeplacer({ sourceRows: sourceLot, destAuSol: false, autreClient: false });
    const res = await request(creerApp(f.pool))
      .post('/api/emplacements/deplacer')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send(corps());
    expect(res.status).toBe(200);
    expect(res.body.deplacees).toEqual(sourceLot);
    const del = f.appels.find((a) => /DELETE FROM commande_emplacement/i.test(a.sql));
    expect(del.params).toEqual([UUID_SRC, UUID_CLI]);
  });

  test('destination étagère occupée par un autre client → 409', async () => {
    const f = fauxPoolDeplacer({ sourceRows: sourceLot, destAuSol: false, autreClient: true });
    const res = await request(creerApp(f.pool))
      .post('/api/emplacements/deplacer')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send(corps());
    expect(res.status).toBe(409);
  });

  test('destination = sol (autre client présent) → 200 (exempt)', async () => {
    const f = fauxPoolDeplacer({ sourceRows: sourceLot, destAuSol: true, autreClient: true });
    const res = await request(creerApp(f.pool))
      .post('/api/emplacements/deplacer')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send(corps());
    expect(res.status).toBe(200);
  });

  test('destination inexistante (FK 23503 à l’INSERT) → 400', async () => {
    const f = fauxPoolDeplacer({ sourceRows: sourceLot, erreurInsert: '23503' });
    const res = await request(creerApp(f.pool))
      .post('/api/emplacements/deplacer')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send(corps());
    expect(res.status).toBe(400);
  });
});
