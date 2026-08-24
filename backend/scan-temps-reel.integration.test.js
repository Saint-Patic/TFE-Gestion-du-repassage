const http = require('http');
const request = require('supertest');
const { io: clientIo } = require('socket.io-client');
const creerApp = require('./app');
const { initialiserTempsReel, creerDiffuserMaj } = require('./temps-reel');
const { signerJeton } = require('./auth/jeton');

const UUID_REPASSEUSE = '22222222-2222-2222-2222-222222222222';
const UUID_CLIENT = '33333333-3333-3333-3333-333333333333';

function jetonRepasseuse() {
  return signerJeton({
    id_utilisateur: UUID_REPASSEUSE,
    role: 'repasseuse',
    session_debut: Math.floor(Date.now() / 1000),
  });
}

const UUID_AUTRE_REPASSEUSE = '55555555-5555-5555-5555-555555555555';

function jetonAutreRepasseuse() {
  return signerJeton({
    id_utilisateur: UUID_AUTRE_REPASSEUSE,
    role: 'repasseuse',
    session_debut: Math.floor(Date.now() / 1000),
  });
}

// Faux pool transactionnel pour POST /commandes/:id/demarrer, capturant les requêtes.
function fauxPoolDemarrer() {
  const appels = [];
  const client = {
    query: async (sql, params) => {
      appels.push({ sql, params });
      if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(sql)) return {};
      if (/^\s*SELECT statut FROM commande/i.test(sql)) return { rowCount: 1, rows: [{ statut: 'a_faire' }] };
      if (/^\s*UPDATE commande/i.test(sql)) {
        return { rowCount: 1, rows: [{
          id_commande: 'cmd1', id_client: UUID_CLIENT, statut: 'en_cours', nombre_mannes: 3,
          prioritaire: false, cintres_client: false, cintres_entr_rendus: false,
          date_reception: 'x', id_repasseuse: UUID_REPASSEUSE,
        }] };
      }
      if (/DELETE FROM commande_emplacement/i.test(sql)) return { rowCount: 1 };
      if (/INSERT INTO historique_statut/i.test(sql)) return { rowCount: 1 };
      return { rowCount: 0, rows: [] };
    },
    release: () => {},
  };
  return { pool: { query: async () => ({ rows: [] }), connect: async () => client }, appels };
}

let serveur, ioServer, port, app, appels;

beforeAll((done) => {
  const f = fauxPoolDemarrer();
  appels = f.appels;
  app = creerApp(f.pool, creerDiffuserMaj());
  serveur = http.createServer(app);
  ioServer = initialiserTempsReel(serveur);
  serveur.listen(0, () => { port = serveur.address().port; done(); });
});

afterAll((done) => {
  ioServer.close();
  serveur.close(done);
});

test('scan → écrit en DB (en_cours + historique) et diffuse commandes:maj reçu par la repasseuse', (done) => {
  const client = clientIo(`http://localhost:${port}`, {
    auth: { jeton: jetonRepasseuse() },
    reconnection: false,
    transports: ['websocket'],
  });

  client.on('connect', () => {
    client.on('commandes:maj', () => {
      // WebSocket reçu → vérifier les écritures DB capturées côté faux pool.
      expect(appels.some((a) => /UPDATE commande/i.test(a.sql) && /statut='en_cours'/i.test(a.sql))).toBe(true);
      expect(appels.some((a) => /INSERT INTO historique_statut/i.test(a.sql))).toBe(true);
      client.close();
      done();
    });

    // Laisser le join de room se faire, puis déclencher le scan.
    setTimeout(() => {
      request(app)
        .post('/api/commandes/cmd1/demarrer')
        .set('Authorization', `Bearer ${jetonRepasseuse()}`)
        .then((res) => { expect(res.status).toBe(200); })
        .catch((err) => { client.close(); done(err); });
    }, 60);
  });

  client.on('connect_error', (err) => { client.close(); done(err); });
});

test('une AUTRE repasseuse reçoit aussi commandes:maj (colonnes collectives, US #280)', (done) => {
  const autre = clientIo(`http://localhost:${port}`, {
    auth: { jeton: jetonAutreRepasseuse() },
    reconnection: false,
    transports: ['websocket'],
  });

  autre.on('connect', () => {
    autre.on('commandes:maj', () => { autre.close(); done(); });

    setTimeout(() => {
      request(app)
        .post('/api/commandes/cmd1/demarrer')
        .set('Authorization', `Bearer ${jetonRepasseuse()}`)
        .catch((err) => { autre.close(); done(err); });
    }, 60);
  });

  autre.on('connect_error', (err) => { autre.close(); done(err); });
});
