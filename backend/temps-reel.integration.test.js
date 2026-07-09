process.env.JWT_SECRET = 'secret-de-test';
const http = require('http');
const { io: clientIo } = require('socket.io-client');
const creerApp = require('./app');
const { initialiserTempsReel, diffuser } = require('./temps-reel');
const { signerJeton } = require('./auth/jeton');

let serveur;
let ioServer;
let port;

const fauxPool = { query: async () => ({ rows: [] }) };

function jetonValide() {
  return signerJeton({
    id_utilisateur: 'u-1',
    role: 'gerante',
    session_debut: Math.floor(Date.now() / 1000),
  });
}

function connecter(auth) {
  return clientIo(`http://localhost:${port}`, {
    auth,
    reconnection: false,
    transports: ['websocket'],
  });
}

beforeAll((done) => {
  const app = creerApp(fauxPool);
  serveur = http.createServer(app);
  ioServer = initialiserTempsReel(serveur);
  serveur.listen(0, () => {
    port = serveur.address().port;
    done();
  });
});

afterAll((done) => {
  ioServer.close();
  serveur.close(done);
});

test('connexion refusée sans jeton', (done) => {
  const client = connecter({});
  client.on('connect', () => {
    client.close();
    done(new Error('la connexion ne devrait pas aboutir'));
  });
  client.on('connect_error', (err) => {
    expect(err.message).toBe('Authentification requise');
    client.close();
    done();
  });
});

test('connexion acceptée avec un jeton valide', (done) => {
  const client = connecter({ jeton: jetonValide() });
  client.on('connect', () => {
    client.close();
    done();
  });
  client.on('connect_error', (err) => {
    client.close();
    done(err);
  });
});

test('un client authentifié reçoit un événement diffusé', (done) => {
  const client = connecter({ jeton: jetonValide() });
  client.on('connect', () => {
    client.on('commande:maj', (donnees) => {
      expect(donnees).toEqual({ test: true });
      client.close();
      done();
    });
    diffuser('commande:maj', { test: true });
  });
  client.on('connect_error', (err) => {
    client.close();
    done(err);
  });
});
