const request = require('supertest');
const creerApp = require('../app');

// Route PUBLIQUE : l'écran de connexion l'appelle avant toute authentification, pour
// proposer la liste des prénoms. C'est donc du code exposé, et il n'avait aucun test.
describe('GET /api/utilisateurs (US #320)', () => {
  const lignes = [
    { id_utilisateur: 'u1', nom: 'Julie', role: 'gerante' },
    { id_utilisateur: 'u2', nom: 'Sophie', role: 'repasseuse' },
  ];

  test('renvoie la liste des utilisatrices, sans jeton', async () => {
    const app = creerApp({ query: async () => ({ rows: lignes }) });

    const res = await request(app).get('/api/utilisateurs');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].nom).toBe('Julie');
    expect(res.body[1].role).toBe('repasseuse');
  });

  // Le handler fait `res.json(resultat.rows)` : il retransmet les lignes TELLES QUELLES,
  // sans projection. La seule barrière contre la fuite du hachage est donc la liste de
  // colonnes du SELECT — c'est précisément elle que ce test verrouille.
  // Le commentaire « Ne renvoie jamais code_pin_hache » est dans le fichier depuis le #40,
  // mais un commentaire n'empêche personne d'ajouter la colonne en voulant bien faire.
  test('le SELECT ne demande jamais code_pin_hache', async () => {
    let sqlVue = '';
    const app = creerApp({
      query: async (sql) => {
        sqlVue = sql;
        return { rows: lignes };
      },
    });

    const res = await request(app).get('/api/utilisateurs');

    expect(res.status).toBe(200);
    expect(sqlVue).not.toMatch(/code_pin_hache/i);
    expect(sqlVue).not.toMatch(/select\s+\*/i);
  });

  test('la réponse ne porte que les trois champs attendus', async () => {
    const app = creerApp({ query: async () => ({ rows: lignes }) });

    const res = await request(app).get('/api/utilisateurs');

    expect(Object.keys(res.body[0]).sort()).toEqual(['id_utilisateur', 'nom', 'role']);
  });

  // Seconde barrière : même si la requête ramenait le hachage — SELECT * introduit par
  // mégarde, colonne ajoutée à une vue —, le handler ne doit pas le laisser sortir.
  // Le faux pool le renvoie donc VOLONTAIREMENT : c'est un test adverse.
  test('même si la base renvoie code_pin_hache, il ne sort pas de la réponse', async () => {
    const app = creerApp({
      query: async () => ({
        rows: [{ ...lignes[0], code_pin_hache: '$2b$10$hachage-secret' }],
      }),
    });

    const res = await request(app).get('/api/utilisateurs');

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/code_pin_hache/i);
    expect(JSON.stringify(res.body)).not.toMatch(/hachage-secret/);
    expect(res.body[0].nom).toBe('Julie');
  });

  test('erreur base de données → 500', async () => {
    const app = creerApp({
      query: async () => {
        throw new Error('DB HS');
      },
    });

    const res = await request(app).get('/api/utilisateurs');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Erreur serveur.');
  });
});
