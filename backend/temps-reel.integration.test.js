const http = require('http');
const { io: clientIo } = require('socket.io-client');
const creerApp = require('./app');
const { initialiserTempsReel, diffuser, diffuserA } = require('./temps-reel');
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

function jetonRepasseuse() {
  return signerJeton({
    id_utilisateur: 'u-2',
    role: 'repasseuse',
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

test('diffuserA atteint la room de l’utilisateur ciblé', (done) => {
  const client = connecter({ jeton: jetonRepasseuse() }); // u-2
  client.on('connect', () => {
    client.on('commandes:maj', (donnees) => {
      expect(donnees).toEqual({ ok: 1 });
      client.close();
      done();
    });
    setTimeout(() => diffuserA(['utilisateur:u-2'], 'commandes:maj', { ok: 1 }), 60);
  });
  client.on('connect_error', (err) => { client.close(); done(err); });
});

test('diffuserA n’atteint pas un client hors room ciblée', (done) => {
  const client = connecter({ jeton: jetonRepasseuse() }); // u-2, repasseuse
  client.on('connect', () => {
    client.on('commandes:maj', () => {
      client.close();
      done(new Error('ne devrait pas recevoir'));
    });
    setTimeout(() => {
      diffuserA(['role:gerante'], 'commandes:maj', { ok: 1 }); // pas sa room
      setTimeout(() => { client.close(); done(); }, 150);
    }, 60);
  });
  client.on('connect_error', (err) => { client.close(); done(err); });
});
