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

  test('trie prioritaires en tête puis FIFO (US #210)', async () => {
    let sqlVue = '';
    const app = creerApp({ query: async (sql) => { sqlVue = sql; return { rows: [] }; } });
    const res = await request(app).get('/api/commandes').set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(sqlVue).toMatch(/ORDER BY c\.prioritaire DESC,\s*c\.date_reception ASC/);
  });

  test('expose repassage_debut + temps_repassage_s pour le chrono (US #220)', async () => {
    let sqlVue = '';
    const app = creerApp({ query: async (sql) => { sqlVue = sql; return { rows: [] }; } });
    const res = await request(app).get('/api/commandes').set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(sqlVue).toMatch(/c\.repassage_debut/);
    expect(sqlVue).toMatch(/c\.temps_repassage_s/);
  });

  test('expose cintres_entr_nb (US #230)', async () => {
    let sqlVue = '';
    const app = creerApp({ query: async (sql) => { sqlVue = sql; return { rows: [] }; } });
    const res = await request(app).get('/api/commandes').set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(sqlVue).toMatch(/c\.cintres_entr_nb/);
  });

  // Une commande détachée (client supprimé) ne doit pas DISPARAÎTRE du tableau à cause d'un
  // JOIN strict. Seule la colonne « Récupéré (aujourd'hui) » peut en afficher une, le garde-fou
  // de la suppression interdisant de supprimer un client ayant des commandes actives.
  test('tolère une commande sans client (LEFT JOIN + repli sur le nom)', async () => {
    let sqlVue = '';
    const app = creerApp({ query: async (sql) => { sqlVue = sql; return { rows: [] }; } });
    const res = await request(app).get('/api/commandes').set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(sqlVue).toMatch(/LEFT JOIN client/);
    expect(sqlVue).toMatch(/COALESCE\(cl\.nom, 'Client supprimé'\)/);
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

// Faux pool transactionnel pour POST /commandes/:id/demarrer.
// options : { statut: string|null, majRow, erreur? } — statut null = commande hors périmètre.
function fauxPoolDemarrer(options) {
  const appels = [];
  const client = {
    query: async (sql, params) => {
      appels.push({ sql, params });
      if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(sql)) return {};
      if (/^\s*SELECT statut FROM commande/i.test(sql)) {
        return options.statut
          ? { rowCount: 1, rows: [{ statut: options.statut }] }
          : { rowCount: 0, rows: [] };
      }
      if (/^\s*UPDATE commande/i.test(sql)) {
        if (options.erreur) throw new Error('boom');
        return { rowCount: 1, rows: [options.majRow] };
      }
      if (/DELETE FROM commande_emplacement/i.test(sql)) return { rowCount: 1 };
      if (/INSERT INTO historique_statut/i.test(sql)) return { rowCount: 1 };
      return { rowCount: 0, rows: [] };
    },
    release: () => {},
  };
  return { pool: { query: async () => ({ rows: [] }), connect: async () => client }, appels };
}

const majEnCours = {
  id_commande: 'cmd1', id_client: UUID_CLIENT, statut: 'en_cours', nombre_mannes: 3,
  prioritaire: false, cintres_client: false, cintres_entr_rendus: false,
  date_reception: 'x', id_repasseuse: UUID_REPASSEUSE,
};

describe('POST /api/commandes/:id/demarrer (US #220, révisée 2026-08-24)', () => {
  test('sans jeton → 401', async () => {
    const f = fauxPoolDemarrer({ statut: 'a_faire', majRow: majEnCours });
    const res = await request(creerApp(f.pool)).post('/api/commandes/cmd1/demarrer');
    expect(res.status).toBe(401);
  });

  test('gérante → 403', async () => {
    const f = fauxPoolDemarrer({ statut: 'a_faire', majRow: majEnCours });
    const res = await request(creerApp(f.pool))
      .post('/api/commandes/cmd1/demarrer')
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(403);
  });

  test('commande absente ou appartenant à une autre repasseuse → 404', async () => {
    const f = fauxPoolDemarrer({ statut: null });
    const res = await request(creerApp(f.pool))
      .post('/api/commandes/cmd1/demarrer')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(404);
    expect(f.appels.some((a) => /UPDATE commande/i.test(a.sql))).toBe(false);
  });

  test('commande déjà en cours → 409, sans écrire', async () => {
    const f = fauxPoolDemarrer({ statut: 'en_cours' });
    const res = await request(creerApp(f.pool))
      .post('/api/commandes/cmd1/demarrer')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(409);
    expect(f.appels.some((a) => /UPDATE commande/i.test(a.sql))).toBe(false);
  });

  test('succès → 200, en_cours, effets + diffusion', async () => {
    const spy = jest.fn();
    const f = fauxPoolDemarrer({ statut: 'a_faire', majRow: majEnCours });
    const res = await request(creerApp(f.pool, spy))
      .post('/api/commandes/cmd1/demarrer')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('en_cours');
    // la lecture est scopée à l'identifiant ET à la repasseuse du jeton
    const select = f.appels.find((a) => /^\s*SELECT statut FROM commande/i.test(a.sql));
    expect(select.params).toEqual(['cmd1', UUID_REPASSEUSE]);
    expect(select.sql).toMatch(/FOR UPDATE/i);
    expect(f.appels.some((a) => /UPDATE commande/i.test(a.sql) && /repassage_debut/i.test(a.sql))).toBe(true);
    expect(f.appels.some((a) => /DELETE FROM commande_emplacement/i.test(a.sql))).toBe(true);
    expect(f.appels.some((a) => /INSERT INTO historique_statut/i.test(a.sql))).toBe(true);
    expect(spy).toHaveBeenCalledWith(UUID_REPASSEUSE);
  });
});

describe('POST /api/commandes/:id/pause et /reprendre (US #220 + #225)', () => {
  // Pause = 2 requêtes : SELECT valeurs → UPDATE avec le total calculé en JS.
  function poolPause({ selectRows, updateRow, updateRowCount = 1 }) {
    const appels = [];
    const pool = {
      query: async (sql, params) => {
        appels.push({ sql, params });
        if (/SELECT repassage_debut, temps_repassage_s/i.test(sql)) return { rowCount: selectRows.length, rows: selectRows };
        if (/^\s*UPDATE commande/i.test(sql)) return { rowCount: updateRowCount, rows: updateRow ? [updateRow] : [] };
        return { rowCount: 0, rows: [] };
      },
    };
    return { pool, appels };
  }
  // Reprise = UPDATE unique.
  function poolMaj(rowCount, row) {
    const appels = [];
    const pool = { query: async (sql, params) => { appels.push({ sql, params }); return { rowCount, rows: row ? [row] : [] }; } };
    return { pool, appels };
  }
  const ligneEnCours = { ...majEnCours, id_repasseuse: UUID_REPASSEUSE };

  test('pause sans jeton → 401', async () => {
    const { pool } = poolPause({ selectRows: [{ repassage_debut: new Date().toISOString(), temps_repassage_s: 0 }], updateRow: ligneEnCours });
    const res = await request(creerApp(pool)).post(`/api/commandes/${UUID_CMD}/pause`).send();
    expect(res.status).toBe(401);
  });

  test('pause gérante → 403', async () => {
    const { pool } = poolPause({ selectRows: [{ repassage_debut: new Date().toISOString(), temps_repassage_s: 0 }], updateRow: ligneEnCours });
    const res = await request(creerApp(pool)).post(`/api/commandes/${UUID_CMD}/pause`)
      .set('Authorization', `Bearer ${jetonGerante()}`).send();
    expect(res.status).toBe(403);
  });

  test('pause succès → 200 : SELECT scopé, UPDATE fige le total calculé + NULL, diffuse', async () => {
    const spy = jest.fn();
    const { pool, appels } = poolPause({
      selectRows: [{ repassage_debut: new Date().toISOString(), temps_repassage_s: 5 }],
      updateRow: { ...ligneEnCours, repassage_debut: null, temps_repassage_s: 5 },
    });
    const res = await request(creerApp(pool, spy)).post(`/api/commandes/${UUID_CMD}/pause`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`).send();
    expect(res.status).toBe(200);
    // 1ʳᵉ requête = SELECT scopé [id, id_repasseuse]
    expect(appels[0].params).toEqual([UUID_CMD, UUID_REPASSEUSE]);
    // UPDATE : temps_repassage_s = $2 (total ≥ cumul) + repassage_debut = NULL
    const up = appels.find((a) => /^\s*UPDATE commande/i.test(a.sql));
    expect(up.sql).toMatch(/temps_repassage_s\s*=\s*\$2/i);
    expect(up.sql).toMatch(/repassage_debut\s*=\s*NULL/i);
    expect(up.params[0]).toBe(UUID_CMD);
    expect(typeof up.params[1]).toBe('number');
    expect(up.params[1]).toBeGreaterThanOrEqual(5);
    expect(spy).toHaveBeenCalledWith(UUID_REPASSEUSE);
  });

  test('pause état incorrect (SELECT vide) → 409', async () => {
    const { pool } = poolPause({ selectRows: [], updateRow: null });
    const res = await request(creerApp(pool)).post(`/api/commandes/${UUID_CMD}/pause`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`).send();
    expect(res.status).toBe(409);
  });

  test('reprendre succès → 200 : repose repassage_debut, scopé, diffuse', async () => {
    const spy = jest.fn();
    const { pool, appels } = poolMaj(1, ligneEnCours);
    const res = await request(creerApp(pool, spy)).post(`/api/commandes/${UUID_CMD}/reprendre`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`).send();
    expect(res.status).toBe(200);
    expect(appels[0].sql).toMatch(/repassage_debut\s*=\s*now\(\)/i);
    expect(appels[0].params).toEqual([UUID_CMD, UUID_REPASSEUSE]);
    expect(spy).toHaveBeenCalledWith(UUID_REPASSEUSE);
  });

  test('reprendre état incorrect → 409', async () => {
    const { pool } = poolMaj(0, null);
    const res = await request(creerApp(pool)).post(`/api/commandes/${UUID_CMD}/reprendre`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`).send();
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/commandes/:id/cintres-entreprise (US #230)', () => {
  function poolMaj(rowCount, row) {
    const appels = [];
    const pool = { query: async (sql, params) => { appels.push({ sql, params }); return { rowCount, rows: row ? [row] : [] }; } };
    return { pool, appels };
  }
  const ligne = { ...majEnCours, cintres_entr_nb: 4, id_repasseuse: UUID_REPASSEUSE };

  test('sans jeton → 401', async () => {
    const { pool } = poolMaj(1, ligne);
    const res = await request(creerApp(pool)).put(`/api/commandes/${UUID_CMD}/cintres-entreprise`).send({ cintres_entr_nb: 4 });
    expect(res.status).toBe(401);
  });

  test('gérante → 403', async () => {
    const { pool } = poolMaj(1, ligne);
    const res = await request(creerApp(pool)).put(`/api/commandes/${UUID_CMD}/cintres-entreprise`)
      .set('Authorization', `Bearer ${jetonGerante()}`).send({ cintres_entr_nb: 4 });
    expect(res.status).toBe(403);
  });

  test('valeur non entière / négative → 400 sans DB', async () => {
    let db = 0;
    const app = creerApp({ query: async () => { db++; return { rowCount: 0, rows: [] }; } });
    const res = await request(app).put(`/api/commandes/${UUID_CMD}/cintres-entreprise`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`).send({ cintres_entr_nb: -1 });
    expect(res.status).toBe(400);
    expect(db).toBe(0);
  });

  test('succès → 200 : UPDATE scopé (en_cours) + diffuse', async () => {
    const spy = jest.fn();
    const { pool, appels } = poolMaj(1, ligne);
    const res = await request(creerApp(pool, spy)).put(`/api/commandes/${UUID_CMD}/cintres-entreprise`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`).send({ cintres_entr_nb: 4 });
    expect(res.status).toBe(200);
    expect(appels[0].sql).toMatch(/SET cintres_entr_nb\s*=\s*\$2/i);
    expect(appels[0].sql).toMatch(/statut\s*=\s*'en_cours'/i);
    expect(appels[0].params).toEqual([UUID_CMD, 4, UUID_REPASSEUSE]);
    expect(spy).toHaveBeenCalledWith(UUID_REPASSEUSE);
  });

  test('pas en cours / pas à elle → 409', async () => {
    const { pool } = poolMaj(0, null);
    const res = await request(creerApp(pool)).put(`/api/commandes/${UUID_CMD}/cintres-entreprise`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`).send({ cintres_entr_nb: 4 });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/commandes/a-scanner/:code_barre (US #260)', () => {
  const cmdEnCours = {
    id_commande: UUID_CMD, id_client: UUID_CLIENT, statut: 'en_cours',
    nombre_mannes: 3, prioritaire: false, date_reception: 'x',
    id_repasseuse: UUID_REPASSEUSE, temps_repassage_s: 0, repassage_debut: null,
  };

  function poolResolution(rows) {
    const appels = [];
    const pool = {
      query: async (sql, params) => {
        appels.push({ sql, params });
        return { rowCount: rows.length, rows };
      },
    };
    return { pool, appels };
  }

  test('sans jeton → 401', async () => {
    const { pool } = poolResolution([]);
    const res = await request(creerApp(pool)).get('/api/commandes/a-scanner/ABC');
    expect(res.status).toBe(401);
  });

  test('gérante → 403', async () => {
    const { pool } = poolResolution([cmdEnCours]);
    const res = await request(creerApp(pool))
      .get('/api/commandes/a-scanner/ABC')
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(403);
  });

  test('commande en cours → action cloturer', async () => {
    const { pool } = poolResolution([cmdEnCours]);
    const res = await request(creerApp(pool))
      .get('/api/commandes/a-scanner/ABC')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);
    expect(res.body.commandes[0].action).toBe('cloturer');
    expect(res.body.commandes[0].id_commande).toBe(UUID_CMD);
  });

  test('seulement une commande à faire → action demarrer', async () => {
    const { pool } = poolResolution([{ ...cmdEnCours, statut: 'a_faire' }]);
    const res = await request(creerApp(pool))
      .get('/api/commandes/a-scanner/ABC')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);
    expect(res.body.commandes).toHaveLength(1);
    expect(res.body.commandes[0].action).toBe('demarrer');
  });

  test('aucune commande active → 404', async () => {
    const { pool } = poolResolution([]);
    const res = await request(creerApp(pool))
      .get('/api/commandes/a-scanner/ABC')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(404);
  });

  test('double périmètre : « fait » collectif, « en cours »/« à faire » scopés (US #280)', async () => {
    const { pool, appels } = poolResolution([cmdEnCours]);
    await request(creerApp(pool))
      .get('/api/commandes/a-scanner/ABC')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(appels[0].params).toEqual(['ABC', UUID_REPASSEUSE]);
    expect(appels[0].sql).toMatch(/c\.statut = 'fait'/i);
    expect(appels[0].sql).toMatch(/c\.statut IN \('en_cours','a_faire'\) AND c\.id_repasseuse = \$2/i);
    expect(appels[0].sql).toMatch(/ORDER BY \(c\.statut = 'fait'\) DESC/i);
  });

  test('commande prête → action recuperer (US #280)', async () => {
    const { pool } = poolResolution([{ ...cmdEnCours, statut: 'fait' }]);
    const res = await request(creerApp(pool))
      .get('/api/commandes/a-scanner/ABC')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);
    expect(res.body.commandes[0].action).toBe('recuperer');
  });

  test('expose le nom du client pour la confirmation (US #280)', async () => {
    const { pool, appels } = poolResolution([
      { ...cmdEnCours, statut: 'fait', client_nom: 'Dupont', client_prenom: 'Marie' },
    ]);
    const res = await request(creerApp(pool))
      .get('/api/commandes/a-scanner/ABC')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.body.commandes[0].client_nom).toBe('Dupont');
    expect(appels[0].sql).toMatch(/cl\.nom AS client_nom/i);
  });

  test('plusieurs commandes → toutes renvoyées, avec leur action (2026-08-24)', async () => {
    const { pool } = poolResolution([
      { ...cmdEnCours, id_commande: 'cmdA', statut: 'fait' },
      { ...cmdEnCours, id_commande: 'cmdB', statut: 'a_faire' },
    ]);
    const res = await request(creerApp(pool))
      .get('/api/commandes/a-scanner/ABC')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);
    expect(res.body.commandes).toHaveLength(2);
    expect(res.body.commandes.map((c) => c.action)).toEqual(['recuperer', 'demarrer']);
  });

  test('la requête ne borne plus le résultat à une ligne (2026-08-24)', async () => {
    const { pool, appels } = poolResolution([cmdEnCours]);
    await request(creerApp(pool))
      .get('/api/commandes/a-scanner/ABC')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(appels[0].sql).not.toMatch(/LIMIT 1/i);
  });
});

describe('POST /api/commandes/:id/cloturer (US #260)', () => {
  const enCours = {
    id_client: UUID_CLIENT, nombre_mannes: 3, statut: 'en_cours',
    temps_repassage_s: 100, repassage_debut: null, telephone: '0475664101',
  };
  const ligneFait = {
    id_commande: UUID_CMD, id_client: UUID_CLIENT, statut: 'fait', nombre_mannes: 3,
    prioritaire: false, date_reception: 'x', id_repasseuse: UUID_REPASSEUSE,
    repassage_debut: null, temps_repassage_s: 100,
  };

  // Faux pool transactionnel pour la clôture.
  // options : { commande: objet|null, conflitAutreClient=false, majRowCount=1 }
  function poolCloture(options) {
    const appels = [];
    const client = {
      query: async (sql, params) => {
        appels.push({ sql, params });
        if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(sql)) return {};
        if (/FOR UPDATE OF c/i.test(sql)) {
          return options.commande
            ? { rowCount: 1, rows: [options.commande] }
            : { rowCount: 0, rows: [] };
        }
        if (/UPDATE commande SET statut='fait'/i.test(sql)) {
          const n = options.majRowCount === undefined ? 1 : options.majRowCount;
          return { rowCount: n, rows: n ? [ligneFait] : [] };
        }
        if (/id_client <> \$3/i.test(sql)) {
          return { rowCount: options.conflitAutreClient ? 1 : 0, rows: [] };
        }
        if (/INSERT INTO sms_en_attente/i.test(sql)) {
          return { rowCount: 1, rows: [{ id_sms: 'sms-1' }] };
        }
        return { rowCount: 1, rows: [] };
      },
      release: () => {},
    };
    return { appels, pool: { query: async () => ({ rows: [] }), connect: async () => client } };
  }

  test('gérante → 403', async () => {
    const f = poolCloture({ commande: enCours });
    const res = await request(creerApp(f.pool))
      .post(`/api/commandes/${UUID_CMD}/cloturer`)
      .set('Authorization', `Bearer ${jetonGerante()}`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(403);
  });

  test('emplacements invalides → 400 sans toucher la DB', async () => {
    const f = poolCloture({ commande: enCours });
    const res = await request(creerApp(f.pool))
      .post(`/api/commandes/${UUID_CMD}/cloturer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: [] });
    expect(res.status).toBe(400);
    expect(f.appels).toHaveLength(0);
  });

  test('commande introuvable ou pas à elle → 404', async () => {
    const f = poolCloture({ commande: null });
    const res = await request(creerApp(f.pool))
      .post(`/api/commandes/${UUID_CMD}/cloturer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(404);
  });

  test('commande pas en cours → 409 (transitionValide refuse)', async () => {
    const f = poolCloture({ commande: { ...enCours, statut: 'a_faire' } });
    const res = await request(creerApp(f.pool))
      .post(`/api/commandes/${UUID_CMD}/cloturer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(409);
    expect(f.appels.some((a) => /INSERT INTO sms_en_attente/i.test(a.sql))).toBe(false);
  });

  test('succès → 200, statut fait, timer arrêté, historique, SMS déposé, COMMIT', async () => {
    let appelsALaDiffusion = -1;
    const f = poolCloture({ commande: enCours });
    const spy = jest.fn(() => { appelsALaDiffusion = f.appels.length; });
    const res = await request(creerApp(f.pool, spy))
      .post(`/api/commandes/${UUID_CMD}/cloturer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: lignesValides });

    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('fait');

    const maj = f.appels.find((a) => /UPDATE commande SET statut='fait'/i.test(a.sql));
    expect(maj.sql).toMatch(/repassage_debut=NULL/i);
    expect(maj.params).toEqual([UUID_CMD, 100]);

    expect(f.appels.some((a) => /INSERT INTO historique_statut/i.test(a.sql))).toBe(true);
    expect(f.appels.some((a) => /INSERT INTO sms_en_attente/i.test(a.sql))).toBe(true);

    const indexCommit = f.appels.findIndex((a) => /^\s*COMMIT/i.test(a.sql));
    expect(indexCommit).toBeGreaterThan(-1);
    expect(appelsALaDiffusion).toBeGreaterThan(indexCommit);
    expect(spy).toHaveBeenCalledWith(UUID_REPASSEUSE);
  });

  test('somme de mannes incorrecte → 400, ROLLBACK, aucun SMS déposé', async () => {
    const f = poolCloture({ commande: { ...enCours, nombre_mannes: 5 } });
    const res = await request(creerApp(f.pool))
      .post(`/api/commandes/${UUID_CMD}/cloturer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(400);
    expect(f.appels.some((a) => /^\s*ROLLBACK/i.test(a.sql))).toBe(true);
    expect(f.appels.some((a) => /INSERT INTO sms_en_attente/i.test(a.sql))).toBe(false);
  });

  test('étagère occupée par un autre client → 409, aucun SMS déposé', async () => {
    const f = poolCloture({ commande: enCours, conflitAutreClient: true });
    const res = await request(creerApp(f.pool))
      .post(`/api/commandes/${UUID_CMD}/cloturer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(409);
    expect(f.appels.some((a) => /INSERT INTO sms_en_attente/i.test(a.sql))).toBe(false);
  });

  test('client sans mobile (fixe) → clôture OK mais AUCUN SMS déposé (US #270)', async () => {
    const f = poolCloture({ commande: { ...enCours, telephone: '068123456' } });
    const res = await request(creerApp(f.pool, jest.fn()))
      .post(`/api/commandes/${UUID_CMD}/cloturer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: lignesValides });
    expect(res.status).toBe(200);
    expect(f.appels.some((a) => /INSERT INTO historique_statut/i.test(a.sql))).toBe(true);
    expect(f.appels.some((a) => /INSERT INTO sms_en_attente/i.test(a.sql))).toBe(false);
  });
});

describe('GET /api/commandes — client_mobile (US #270)', () => {
  test('expose client_mobile calculé en SQL, sans exposer le numéro', async () => {
    let sqlVue = '';
    const app = creerApp({ query: async (sql) => { sqlVue = sql; return { rows: [] }; } });
    const res = await request(app).get('/api/commandes').set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(sqlVue).toMatch(/AS client_mobile/i);
    expect(sqlVue).toMatch(/\^04\[0-9\]\{8\}\$/);
  });
});

describe('POST /api/commandes/:id/recuperer (US #280)', () => {
  const ligneRecuperee = {
    id_commande: UUID_CMD, id_client: UUID_CLIENT, statut: 'recupere', nombre_mannes: 3,
    prioritaire: false, date_reception: 'x', id_repasseuse: UUID_REPASSEUSE,
    date_recuperation: 'maintenant',
  };

  // Faux pool transactionnel pour la remise.
  // options : { statut: 'fait'|'en_cours'|null, majRowCount=1 }
  function poolRecuperer(options) {
    const appels = [];
    const client = {
      query: async (sql, params) => {
        appels.push({ sql, params });
        if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(sql)) return {};
        if (/SELECT statut FROM commande/i.test(sql)) {
          return options.statut
            ? { rowCount: 1, rows: [{ statut: options.statut }] }
            : { rowCount: 0, rows: [] };
        }
        if (/UPDATE commande SET statut='recupere'/i.test(sql)) {
          const n = options.majRowCount === undefined ? 1 : options.majRowCount;
          return { rowCount: n, rows: n ? [ligneRecuperee] : [] };
        }
        return { rowCount: 1, rows: [] };
      },
      release: () => {},
    };
    return { appels, pool: { query: async () => ({ rows: [] }), connect: async () => client } };
  }

  test('sans jeton → 401', async () => {
    const f = poolRecuperer({ statut: 'fait' });
    const res = await request(creerApp(f.pool)).post(`/api/commandes/${UUID_CMD}/recuperer`);
    expect(res.status).toBe(401);
  });

  test('gérante → 403', async () => {
    const f = poolRecuperer({ statut: 'fait' });
    const res = await request(creerApp(f.pool))
      .post(`/api/commandes/${UUID_CMD}/recuperer`)
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(403);
  });

  test('commande inexistante → 404', async () => {
    const f = poolRecuperer({ statut: null });
    const res = await request(creerApp(f.pool))
      .post(`/api/commandes/${UUID_CMD}/recuperer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(404);
  });

  test("commande qui n'est pas « fait » → 409 (transitionValide refuse)", async () => {
    const f = poolRecuperer({ statut: 'en_cours' });
    const res = await request(creerApp(f.pool))
      .post(`/api/commandes/${UUID_CMD}/recuperer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(409);
    expect(f.appels.some((a) => /DELETE FROM commande_emplacement/i.test(a.sql))).toBe(false);
  });

  test('succès → 200 : récupéré, date posée, étagère libérée, historique, diffusion après COMMIT', async () => {
    let appelsALaDiffusion = -1;
    const f = poolRecuperer({ statut: 'fait' });
    const spy = jest.fn(() => { appelsALaDiffusion = f.appels.length; });
    const res = await request(creerApp(f.pool, spy))
      .post(`/api/commandes/${UUID_CMD}/recuperer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);

    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('recupere');

    const maj = f.appels.find((a) => /UPDATE commande SET statut='recupere'/i.test(a.sql));
    expect(maj.sql).toMatch(/date_recuperation=now\(\)/i);
    expect(maj.sql).toMatch(/statut='fait'/i);

    const del = f.appels.find((a) => /DELETE FROM commande_emplacement/i.test(a.sql));
    expect(del.params).toEqual([UUID_CMD]);

    const hist = f.appels.find((a) => /INSERT INTO historique_statut/i.test(a.sql));
    expect(hist.params).toEqual([UUID_CMD, UUID_REPASSEUSE]);

    const indexCommit = f.appels.findIndex((a) => /^\s*COMMIT/i.test(a.sql));
    expect(indexCommit).toBeGreaterThan(-1);
    expect(appelsALaDiffusion).toBeGreaterThan(indexCommit);
  });

  test('remise NON scopée : la requête ne filtre pas sur id_repasseuse (US #280)', async () => {
    const f = poolRecuperer({ statut: 'fait' });
    await request(creerApp(f.pool, jest.fn()))
      .post(`/api/commandes/${UUID_CMD}/recuperer`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    const select = f.appels.find((a) => /SELECT statut FROM commande/i.test(a.sql));
    expect(select.params).toEqual([UUID_CMD]);
    expect(select.sql).not.toMatch(/id_repasseuse/i);
  });
});

describe('GET /api/commandes — colonnes collectives (US #280)', () => {
  test('repasseuse : « fait » et « récupéré » échappent au filtre par propriétaire', async () => {
    let sqlVue = '';
    const app = creerApp({ query: async (sql) => { sqlVue = sql; return { rows: [] }; } });
    const res = await request(app).get('/api/commandes')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(200);
    expect(sqlVue).toMatch(/c\.statut IN \('fait','recupere'\) OR c\.id_repasseuse = \$1/i);
  });
});

describe('GET /api/commandes — détail : repasseuse + emplacements', () => {
  test('joint utilisateur en LEFT JOIN et agrège les emplacements en LATERAL', async () => {
    let sqlVue = '';
    const app = creerApp({ query: async (sql) => { sqlVue = sql; return { rows: [] }; } });
    const res = await request(app).get('/api/commandes').set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(sqlVue).toMatch(/LEFT JOIN utilisateur u ON u\.id_utilisateur = c\.id_repasseuse/);
    expect(sqlVue).toMatch(/LEFT JOIN LATERAL/);
    expect(sqlVue).toMatch(/json_agg/);
    expect(sqlVue).toMatch(/COALESCE\(empl\.emplacements, '\[\]'::json\)/);
  });

  test('ni les lignes ni l’ordre ne changent', async () => {
    let sqlVue = '';
    const app = creerApp({ query: async (sql) => { sqlVue = sql; return { rows: [] }; } });
    await request(app).get('/api/commandes').set('Authorization', `Bearer ${jetonGerante()}`);
    expect(sqlVue).toMatch(/ORDER BY c\.prioritaire DESC,\s*c\.date_reception ASC/);
    expect(sqlVue).toMatch(/CURRENT_DATE/);
  });

  test('retransmet repasseuse_nom et emplacements au client', async () => {
    const ligne = {
      id_commande: 'c1', id_client: UUID_CLIENT, statut: 'a_faire', nombre_mannes: 3,
      prioritaire: false, cintres_client: false, cintres_entr_rendus: false,
      date_reception: 'x', client_nom: 'Dupont', client_prenom: 'Marie',
      repasseuse_nom: 'Repasseuse 1',
      emplacements: [{ code_barre: 'A1G', nombre_mannes: 1 }, { code_barre: 'B2C', nombre_mannes: 2 }],
    };
    const app = creerApp({ query: async () => ({ rows: [ligne] }) });
    const res = await request(app).get('/api/commandes').set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(res.body[0].repasseuse_nom).toBe('Repasseuse 1');
    expect(res.body[0].emplacements).toEqual([
      { code_barre: 'A1G', nombre_mannes: 1 },
      { code_barre: 'B2C', nombre_mannes: 2 },
    ]);
  });
});
