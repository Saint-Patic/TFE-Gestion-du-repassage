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

describe('POST /api/commandes — flags cintres/prioritaire (US #170)', () => {
  // Faux pool qui capture les paramètres passés à l'INSERT.
  function poolCapture() {
    const appels = [];
    const pool = {
      query: async (sql, params) => {
        appels.push({ sql, params });
        return { rows: [commandeCreee] };
      },
    };
    return { pool, appels };
  }

  test('sans flags → 201 et INSERT reçoit false, false, false', async () => {
    const { pool, appels } = poolCapture();
    const res = await request(creerApp(pool))
      .post('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ id_client: UUID_CLIENT, nombre_mannes: 3 });
    expect(res.status).toBe(201);
    // params = [id_client, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus]
    expect(appels[0].params.slice(2)).toEqual([false, false, false]);
  });

  test('avec les 3 flags à true → INSERT reçoit true, true, true', async () => {
    const { pool, appels } = poolCapture();
    const res = await request(creerApp(pool))
      .post('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({
        id_client: UUID_CLIENT, nombre_mannes: 3,
        prioritaire: true, cintres_client: true, cintres_entr_rendus: true,
      });
    expect(res.status).toBe(201);
    expect(appels[0].params.slice(2)).toEqual([true, true, true]);
  });

  test('flag non booléen (prioritaire: "oui") → 400 sans accès DB', async () => {
    let requetesDB = 0;
    const app = creerApp({ query: async () => { requetesDB++; return { rows: [commandeCreee] }; } });
    const res = await request(app)
      .post('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ id_client: UUID_CLIENT, nombre_mannes: 3, prioritaire: 'oui' });
    expect(res.status).toBe(400);
    expect(requetesDB).toBe(0);
  });
});

// Faux client transactionnel pour POST /:id/emplacements.
// options : { mannesCommande: number|null, erreurInsert?: string }
function fauxPoolTransaction(options) {
  const client = {
    query: async (sql) => {
      if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(sql)) return {};
      if (/SELECT nombre_mannes FROM commande/i.test(sql)) {
        return options.mannesCommande == null
          ? { rowCount: 0, rows: [] }
          : { rowCount: 1, rows: [{ nombre_mannes: options.mannesCommande }] };
      }
      if (/DELETE FROM commande_emplacement/i.test(sql)) return { rowCount: 0 };
      if (/INSERT INTO commande_emplacement/i.test(sql)) {
        if (options.erreurInsert) {
          const e = new Error('FK');
          e.code = options.erreurInsert;
          throw e;
        }
        return { rowCount: 1 };
      }
      return { rowCount: 0, rows: [] };
    },
    release: () => {},
  };
  return { query: async () => ({ rows: [] }), connect: async () => client };
}

const UUID_CMD = '44444444-4444-4444-4444-444444444444';
const lignesValides = [
  { id_emplacement: 'e1', nombre_mannes: 2 },
  { id_emplacement: 'e2', nombre_mannes: 1 },
];

describe('POST /api/commandes/:id/emplacements (US #160)', () => {
  test('sans jeton → 401', async () => {
    const app = creerApp(fauxPoolTransaction({ mannesCommande: 3 }));
    const res = await request(app)
      .post(`/api/commandes/${UUID_CMD}/emplacements`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(401);
  });

  test('répartition valide (somme = N) → 201', async () => {
    const app = creerApp(fauxPoolTransaction({ mannesCommande: 3 }));
    const res = await request(app)
      .post(`/api/commandes/${UUID_CMD}/emplacements`)
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(201);
    expect(res.body.id_commande).toBe(UUID_CMD);
  });

  test('repasseuse autorisée → 201', async () => {
    const app = creerApp(fauxPoolTransaction({ mannesCommande: 3 }));
    const res = await request(app)
      .post(`/api/commandes/${UUID_CMD}/emplacements`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(201);
  });

  test('tableau vide → 400 sans transaction', async () => {
    let connexions = 0;
    const base = fauxPoolTransaction({ mannesCommande: 3 });
    const app = creerApp({ query: base.query, connect: async () => { connexions++; return (await base.connect()); } });
    const res = await request(app)
      .post(`/api/commandes/${UUID_CMD}/emplacements`)
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ emplacements: [] });
    expect(res.status).toBe(400);
    expect(connexions).toBe(0);
  });

  test('nombre_mannes < 1 → 400', async () => {
    const app = creerApp(fauxPoolTransaction({ mannesCommande: 3 }));
    const res = await request(app)
      .post(`/api/commandes/${UUID_CMD}/emplacements`)
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ emplacements: [{ id_emplacement: 'e1', nombre_mannes: 0 }] });
    expect(res.status).toBe(400);
  });

  test('somme ≠ N → 400', async () => {
    const app = creerApp(fauxPoolTransaction({ mannesCommande: 5 }));
    const res = await request(app)
      .post(`/api/commandes/${UUID_CMD}/emplacements`)
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ emplacements: lignesValides }); // somme = 3, attendu 5
    expect(res.status).toBe(400);
  });

  test('commande absente → 404', async () => {
    const app = creerApp(fauxPoolTransaction({ mannesCommande: null }));
    const res = await request(app)
      .post(`/api/commandes/${UUID_CMD}/emplacements`)
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(404);
  });

  test('emplacement inexistant (FK 23503) → 400', async () => {
    const app = creerApp(fauxPoolTransaction({ mannesCommande: 3, erreurInsert: '23503' }));
    const res = await request(app)
      .post(`/api/commandes/${UUID_CMD}/emplacements`)
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(400);
  });
});
