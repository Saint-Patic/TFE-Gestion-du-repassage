const { Server } = require('socket.io');
const { verifierJeton } = require('./auth/jeton');

let io = null;

// Initialise Socket.IO sur le serveur HTTP fourni, avec authentification JWT au handshake.
function initialiserTempsReel(serveurHttp) {
  io = new Server(serveurHttp, {
    cors: {
      origin: process.env.ORIGINE_CORS || 'http://localhost:5173',
    },
  });

  // Middleware : exige un jeton valide au handshake, sinon refuse la connexion.
  io.use((socket, next) => {
    const jeton = socket.handshake.auth && socket.handshake.auth.jeton;
    if (!jeton) {
      return next(new Error('Authentification requise'));
    }
    try {
      const charge = verifierJeton(jeton);
      socket.utilisateur = { id_utilisateur: charge.sub, role: charge.role };
      return next();
    } catch (err) {
      return next(new Error('Authentification requise'));
    }
  });

  io.on('connection', (socket) => {
    // Rooms de ciblage : la personne (attribution) et son rôle (gérante = tout).
    socket.join('utilisateur:' + socket.utilisateur.id_utilisateur);
    socket.join('role:' + socket.utilisateur.role);
    console.log(`Socket connecté : ${socket.utilisateur.id_utilisateur}`);
    socket.on('disconnect', () => {
      console.log(`Socket déconnecté : ${socket.utilisateur.id_utilisateur}`);
    });
  });

  return io;
}

// Diffuse un événement à tous les clients authentifiés.
function diffuser(evenement, donnees) {
  if (!io) {
    throw new Error("Socket.IO non initialisé : appeler initialiserTempsReel d'abord.");
  }
  io.emit(evenement, donnees);
}

// Diffuse un événement vers une ou plusieurs rooms.
function diffuserA(rooms, evenement, donnees) {
  if (!io) {
    throw new Error("Socket.IO non initialisé : appeler initialiserTempsReel d'abord.");
  }
  io.to(rooms).emit(evenement, donnees);
}

// Fabrique le notificateur de mise à jour de commande :
// diffuse commandes:maj à l'encodeuse (sa room) + à toutes les gérantes.
function creerDiffuserMaj() {
  return (idRepasseuse) =>
    diffuserA(['utilisateur:' + idRepasseuse, 'role:gerante'], 'commandes:maj', {});
}

module.exports = { initialiserTempsReel, diffuser, diffuserA, creerDiffuserMaj };
