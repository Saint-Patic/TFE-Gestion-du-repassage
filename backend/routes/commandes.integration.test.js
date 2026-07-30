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

  test('estampille id_repasseuse = utilisateur du jeton (US #200)', async () => {
    const appels = [];
    const pool = { query: async (sql, params) => { appels.push({ sql, params }); return { rows: [commandeCreee] }; } };
    const res = await request(creerApp(pool))
      .post('/api/commandes')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ id_client: UUID_CLIENT, nombre_mannes: 3 });
    expect(res.status).toBe(201);
    // params = [id_client, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus, id_repasseuse]
    expect(appels[0].params[5]).toBe(UUID_REPASSEUSE);
  });

  test('diffuse commandes:maj à l’encodeuse (US #200)', async () => {
    const spy = jest.fn();
    const ligne = { ...commandeCreee, id_repasseuse: UUID_REPASSEUSE };
    const app = creerApp({ query: async () => ({ rows: [ligne] }) }, spy);
    const res = await request(app)
      .post('/api/commandes')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ id_client: UUID_CLIENT, nombre_mannes: 3 });
    expect(res.status).toBe(201);
    expect(spy).toHaveBeenCalledWith(UUID_REPASSEUSE);
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
    expect(appels[0].params.slice(2, 5)).toEqual([false, false, false]);
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
    expect(appels[0].params.slice(2, 5)).toEqual([true, true, true]);
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
// options : { mannesCommande: number|null, idClient='cl1', conflitAutreClient=false, erreurInsert? }
function fauxPoolTransaction(options) {
  const client = {
    query: async (sql) => {
      if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(sql)) return {};
      if (/SELECT nombre_mannes.*FROM commande/i.test(sql)) {
        return options.mannesCommande == null
          ? { rowCount: 0, rows: [] }
          : { rowCount: 1, rows: [{ nombre_mannes: options.mannesCommande, id_client: options.idClient || 'cl1' }] };
      }
      if (/id_client <> \$3/i.test(sql)) {
        return { rowCount: options.conflitAutreClient ? 1 : 0, rows: [] };
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

  test('étagère cible occupée par un autre client → 409 (US #190)', async () => {
    const app = creerApp(fauxPoolTransaction({ mannesCommande: 3, conflitAutreClient: true }));
    const res = await request(app)
      .post(`/api/commandes/${UUID_CMD}/emplacements`)
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(409);
  });

  test('étagère du même client / re-placement / sol → 201 (US #190)', async () => {
    const app = creerApp(fauxPoolTransaction({ mannesCommande: 3, conflitAutreClient: false }));
    const res = await request(app)
      .post(`/api/commandes/${UUID_CMD}/emplacements`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/commandes (US #180)', () => {
  const lignesJoin = [{
    id_commande: 'c1', id_client: UUID_CLIENT, statut: 'a_faire', nombre_mannes: 2,
    prioritaire: false, cintres_client: false, cintres_entr_rendus: false,
    date_reception: 'x', client_nom: 'Dupont', client_prenom: 'Marie',
  }];

  test('sans jeton → 401', async () => {
    const app = creerApp({ query: async () => ({ rows: lignesJoin }) });
    const res = await request(app).get('/api/commandes');
    expect(res.status).toBe(401);
  });

  test('liste (gérante) → 200 + client_nom/prenom', async () => {
    const app = creerApp({ query: async () => ({ rows: lignesJoin }) });
    const res = await request(app).get('/api/commandes').set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(res.body[0].client_nom).toBe('Dupont');
    expect(res.body[0].client_prenom).toBe('Marie');
  });

  test('repasseuse autorisée → 200', async () => {
    const app = creerApp({ query: async () => ({ rows: lignesJoin }) });
    const res = await request(app).get('/api/commandes').set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);
  });

  test('repasseuse → requête filtrée par id_repasseuse (US #200)', async () => {
    let sqlVue = '', paramsVus = null;
    const app = creerApp({ query: async (sql, params) => { sqlVue = sql; paramsVus = params; return { rows: [] }; } });
    const res = await request(app).get('/api/commandes').set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);
    expect(sqlVue).toMatch(/id_repasseuse = \$1/);
    expect(paramsVus).toEqual([UUID_REPASSEUSE]);
  });

  test('gérante → requête non filtrée + Récupéré du jour (US #200)', async () => {
    let sqlVue = '', paramsVus = null;
    const app = creerApp({ query: async (sql, params) => { sqlVue = sql; paramsVus = params; return { rows: [] }; } });
    const res = await request(app).get('/api/commandes').set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(sqlVue).not.toMatch(/id_repasseuse = \$/);
    expect(sqlVue).toMatch(/CURRENT_DATE/);
    expect(paramsVus).toEqual([]);
  });
});

describe('PUT /api/commandes/:id (US #180)', () => {
  // Faux pool : UPDATE renvoie updateRow(s) ; SELECT statut renvoie selectRows.
  function poolPut({ updateRowCount, updateRow, selectRows }) {
    return {
      query: async (sql) => {
        if (/^\s*UPDATE commande/i.test(sql)) {
          return { rowCount: updateRowCount, rows: updateRow ? [updateRow] : [] };
        }
        if (/SELECT statut FROM commande/i.test(sql)) {
          return { rowCount: selectRows.length, rows: selectRows };
        }
        return { rowCount: 0, rows: [] };
      },
    };
  }
  const majOk = {
    id_commande: UUID_CMD, id_client: UUID_CLIENT, statut: 'a_faire', nombre_mannes: 4,
    prioritaire: true, cintres_client: false, cintres_entr_rendus: false, date_reception: 'x',
  };

  test('sans jeton → 401', async () => {
    const app = creerApp(poolPut({ updateRowCount: 1, updateRow: majOk, selectRows: [] }));
    const res = await request(app).put(`/api/commandes/${UUID_CMD}`).send({ nombre_mannes: 4 });
    expect(res.status).toBe(401);
  });

  test('maj valide d’une commande à faire → 200 + valeurs', async () => {
    const app = creerApp(poolPut({ updateRowCount: 1, updateRow: majOk, selectRows: [] }));
    const res = await request(app).put(`/api/commandes/${UUID_CMD}`)
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ nombre_mannes: 4, prioritaire: true });
    expect(res.status).toBe(200);
    expect(res.body.nombre_mannes).toBe(4);
    expect(res.body.prioritaire).toBe(true);
  });

  test('nombre_mannes < 1 → 400 sans accès DB', async () => {
    let requetesDB = 0;
    const app = creerApp({ query: async () => { requetesDB++; return { rowCount: 0, rows: [] }; } });
    const res = await request(app).put(`/api/commandes/${UUID_CMD}`)
      .set('Authorization', `Bearer ${jetonGerante()}`).send({ nombre_mannes: 0 });
    expect(res.status).toBe(400);
    expect(requetesDB).toBe(0);
  });

  test('flag non booléen → 400 sans accès DB', async () => {
    let requetesDB = 0;
    const app = creerApp({ query: async () => { requetesDB++; return { rowCount: 0, rows: [] }; } });
    const res = await request(app).put(`/api/commandes/${UUID_CMD}`)
      .set('Authorization', `Bearer ${jetonGerante()}`).send({ nombre_mannes: 2, prioritaire: 'oui' });
    expect(res.status).toBe(400);
    expect(requetesDB).toBe(0);
  });

  test('commande pas « à faire » → 409', async () => {
    const app = creerApp(poolPut({ updateRowCount: 0, updateRow: null, selectRows: [{ statut: 'en_cours' }] }));
    const res = await request(app).put(`/api/commandes/${UUID_CMD}`)
      .set('Authorization', `Bearer ${jetonGerante()}`).send({ nombre_mannes: 2 });
    expect(res.status).toBe(409);
  });

  test('commande absente → 404', async () => {
    const app = creerApp(poolPut({ updateRowCount: 0, updateRow: null, selectRows: [] }));
    const res = await request(app).put(`/api/commandes/${UUID_CMD}`)
      .set('Authorization', `Bearer ${jetonGerante()}`).send({ nombre_mannes: 2 });
    expect(res.status).toBe(404);
  });

  test('diffuse commandes:maj sur succès (US #200)', async () => {
    const spy = jest.fn();
    const app = creerApp(poolPut({ updateRowCount: 1, updateRow: { ...majOk, id_repasseuse: UUID_REPASSEUSE }, selectRows: [] }), spy);
    const res = await request(app).put(`/api/commandes/${UUID_CMD}`)
      .set('Authorization', `Bearer ${jetonGerante()}`).send({ nombre_mannes: 4 });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(UUID_REPASSEUSE);
  });

  test('ne diffuse pas sur 409 (US #200)', async () => {
    const spy = jest.fn();
    const app = creerApp(poolPut({ updateRowCount: 0, updateRow: null, selectRows: [{ statut: 'en_cours' }] }), spy);
    const res = await request(app).put(`/api/commandes/${UUID_CMD}`)
      .set('Authorization', `Bearer ${jetonGerante()}`).send({ nombre_mannes: 2 });
    expect(res.status).toBe(409);
    expect(spy).not.toHaveBeenCalled();
  });
});
