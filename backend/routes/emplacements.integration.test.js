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
