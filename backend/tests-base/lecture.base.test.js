const request = require('supertest');
const creerApp = require('../app');
const { signerJeton } = require('../auth/jeton');
const {
  creerPoolTest,
  preparerBase,
  viderTables,
  semerUtilisateurs,
  semerClient,
  UUID_GERANTE,
  UUID_REPASSEUSE,
  UUID_REPASSEUSE_2,
} = require('./aide-base');

let pool;
let app;

const maintenant = () => Math.floor(Date.now() / 1000);
const jetonGerante = () =>
  signerJeton({ id_utilisateur: UUID_GERANTE, role: 'gerante', session_debut: maintenant() });
const jetonRepasseuse = () =>
  signerJeton({ id_utilisateur: UUID_REPASSEUSE, role: 'repasseuse', session_debut: maintenant() });

async function creerCommande(idClient, statut, idRepasseuse, extra = {}) {
  const r = await pool.query(
    `INSERT INTO commande (id_client, nombre_mannes, statut, id_repasseuse,
                           temps_repassage_s, date_recuperation)
     VALUES ($1, 1, $2, $3, $4, $5) RETURNING id_commande`,
    [idClient, statut, idRepasseuse, extra.temps || 0, extra.dateRecuperation || null]
  );
  return r.rows[0].id_commande;
}

// Date du jour au format AAAA-MM-JJ, construite à la main : jamais toISOString(), qui
// convertit en UTC et décale d'un jour en début et en fin de mois (piège du #300).
function jourLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

beforeAll(async () => {
  pool = creerPoolTest();
  await preparerBase(pool);
  app = creerApp(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await viderTables(pool);
  await semerUtilisateurs(pool);
});

// Le DISTINCT ON existe pour empêcher un double comptage : il faut de VRAIES lignes
// dupliquées pour prouver qu'il fait son travail.
describe('statistiques en base réelle (US #330)', () => {
  test('deux transitions vers « fait » pour une commande → comptée une seule fois', async () => {
    const idClient = await semerClient(pool);
    const idCommande = await creerCommande(idClient, 'fait', UUID_REPASSEUSE, { temps: 600 });

    await pool.query(
      `INSERT INTO historique_statut (id_commande, ancien_statut, nouveau_statut, id_utilisateur)
       VALUES ($1, 'en_cours', 'fait', $2), ($1, 'en_cours', 'fait', $2)`,
      [idCommande, UUID_REPASSEUSE]
    );

    const jour = jourLocal();
    const res = await request(app)
      .get(`/api/statistiques?debut=${jour}&fin=${jour}`)
      .set('Authorization', `Bearer ${jetonGerante()}`);

    expect(res.status).toBe(200);
    // Sans le DISTINCT ON, les deux lignes d'historique feraient compter la commande
    // deux fois : 2 commandes et 1200 s au lieu de 1 et 600.
    expect(res.body.global.nbCommandes).toBe(1);
    expect(res.body.global.tempsTotalS).toBe(600);
    expect(res.body.parRepasseuse).toHaveLength(1);
  });
});

// Le Kanban a deux régimes : « À faire » et « En cours » sont personnels,
// « Fait » et « Récupéré » sont collectifs (#280).
describe('filtrage du Kanban en base réelle (US #330)', () => {
  test('repasseuse : ne voit que SES commandes à faire', async () => {
    const idClient = await semerClient(pool);
    await creerCommande(idClient, 'a_faire', UUID_REPASSEUSE);
    await creerCommande(idClient, 'a_faire', UUID_REPASSEUSE_2);

    const res = await request(app)
      .get('/api/commandes')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);

    expect(res.status).toBe(200);
    const aFaire = res.body.filter((c) => c.statut === 'a_faire');
    expect(aFaire).toHaveLength(1);
    expect(aFaire[0].id_repasseuse).toBe(UUID_REPASSEUSE);
  });

  test('repasseuse : voit les commandes « fait » d’une AUTRE repasseuse (colonne collective)', async () => {
    const idClient = await semerClient(pool);
    await creerCommande(idClient, 'fait', UUID_REPASSEUSE_2);

    const res = await request(app)
      .get('/api/commandes')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`);

    expect(res.status).toBe(200);
    // Sans cela, une cliente ne pourrait pas repartir avec son linge si la repasseuse
    // qui l'a traité est absente.
    expect(res.body.filter((c) => c.statut === 'fait')).toHaveLength(1);
  });

  test('gérante : voit tout, et « récupéré » se limite au jour', async () => {
    const idClient = await semerClient(pool);
    await creerCommande(idClient, 'a_faire', UUID_REPASSEUSE);
    await creerCommande(idClient, 'recupere', UUID_REPASSEUSE_2, { dateRecuperation: new Date() });
    // Récupérée il y a trois jours : ne doit plus encombrer le tableau.
    const vieille = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    await creerCommande(idClient, 'recupere', UUID_REPASSEUSE_2, { dateRecuperation: vieille });

    const res = await request(app)
      .get('/api/commandes')
      .set('Authorization', `Bearer ${jetonGerante()}`);

    expect(res.status).toBe(200);
    expect(res.body.filter((c) => c.statut === 'a_faire')).toHaveLength(1);
    expect(res.body.filter((c) => c.statut === 'recupere')).toHaveLength(1);
  });
});
