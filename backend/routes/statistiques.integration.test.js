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

// Faux pool : renvoie les lignes agrégées fournies, et mémorise le SQL.
function poolStats(lignes = []) {
  const appels = [];
  const pool = {
    query: async (sql, params) => {
      appels.push({ sql, params });
      return { rowCount: lignes.length, rows: lignes };
    },
  };
  return { pool, appels };
}

const URL = '/api/statistiques?debut=2026-08-01&fin=2026-08-31';

describe('GET /api/statistiques (US #300)', () => {
  test('sans jeton → 401', async () => {
    const { pool } = poolStats();
    const res = await request(creerApp(pool)).get(URL);
    expect(res.status).toBe(401);
  });

  test('repasseuse → 403', async () => {
    const { pool } = poolStats();
    const res = await request(creerApp(pool)).get(URL)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);
    expect(res.status).toBe(403);
  });

  test('paramètre manquant → 400 sans accès DB', async () => {
    const { pool, appels } = poolStats();
    const res = await request(creerApp(pool)).get('/api/statistiques?debut=2026-08-01')
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(400);
    expect(appels).toHaveLength(0);
  });

  test('format de date invalide → 400 sans accès DB', async () => {
    const { pool, appels } = poolStats();
    const res = await request(creerApp(pool)).get('/api/statistiques?debut=01-08-2026&fin=2026-08-31')
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(400);
    expect(appels).toHaveLength(0);
  });

  test('le global est la SOMME des lignes, pas une moyenne de moyennes', async () => {
    const { pool } = poolStats([
      { id_utilisateur: 'u1', repasseuse: 'Sophie', nb_commandes: 7, temps_total_s: 25200, total_mannes: 20 },
      { id_utilisateur: 'u2', repasseuse: 'Julie', nb_commandes: 1, temps_total_s: 600, total_mannes: 1 },
    ]);
    const res = await request(creerApp(pool)).get(URL)
      .set('Authorization', `Bearer ${jetonGerante()}`);

    expect(res.status).toBe(200);
    expect(res.body.global.nbCommandes).toBe(8);
    expect(res.body.global.tempsTotalS).toBe(25800);
    expect(res.body.global.totalMannes).toBe(21);
    // 25800 / 8 = 3225 — et surtout PAS (3600 + 600) / 2 = 2100
    expect(res.body.global.moyenneParCommandeS).toBe(3225);
    expect(res.body.global.moyenneParManneS).toBe(1229); // 25800 / 21 arrondi
    expect(res.body.parRepasseuse).toHaveLength(2);
    expect(res.body.parRepasseuse[0].moyenneParManneS).toBe(1260);
  });

  test('période sans commande → global à zéro et liste vide', async () => {
    const { pool } = poolStats([]);
    const res = await request(creerApp(pool)).get(URL)
      .set('Authorization', `Bearer ${jetonGerante()}`);
    expect(res.status).toBe(200);
    expect(res.body.global.nbCommandes).toBe(0);
    expect(res.body.global.moyenneParManneS).toBe(0);
    expect(res.body.parRepasseuse).toEqual([]);
  });

  test('ancrage sur la transition vers « fait », jour de fin inclus', async () => {
    const { pool, appels } = poolStats([]);
    await request(creerApp(pool)).get(URL).set('Authorization', `Bearer ${jetonGerante()}`);
    expect(appels[0].sql).toMatch(/nouveau_statut = 'fait'/i);
    expect(appels[0].sql).toMatch(/< \$2::date \+ 1/i);
    expect(appels[0].params).toEqual(['2026-08-01', '2026-08-31']);
  });
});
