const express = require('express');
const { verifierPin, estFormatValide } = require('../auth/pin');
const {
  enregistrerEchec,
  reinitialiser,
  etatVerrou,
} = require('../auth/verrouillage');
const { signerJeton, PLAFOND_SESSION_S } = require('../auth/jeton');
const authentifier = require('../middlewares/authentifier');

const FORMAT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fabrique : renvoie un routeur d'authentification alimenté par le pool pg.
function creerRouteurAuth(pool) {
  const routeur = express.Router();

  // Vérifie le PIN de l'utilisatrice sélectionnée et délivre un jeton de session (JWT).
  routeur.post('/login', async (req, res) => {
    const { id_utilisateur, pin } = req.body || {};

    if (!id_utilisateur || !FORMAT_UUID.test(id_utilisateur) || !estFormatValide(pin)) {
      return res.status(400).json({ message: 'Requête invalide.' });
    }

    const verrou = etatVerrou(id_utilisateur);
    if (verrou.verrouille) {
      return res.status(429).json({
        message: 'Trop de tentatives. Réessayez plus tard.',
        retryAfter: verrou.retryAfter,
      });
    }

    try {
      const resultat = await pool.query(
        'SELECT id_utilisateur, nom, role, code_pin_hache FROM utilisateur WHERE id_utilisateur = $1',
        [id_utilisateur]
      );
      const utilisateur = resultat.rows[0];
      const pinValide = utilisateur
        ? await verifierPin(pin, utilisateur.code_pin_hache)
        : false;

      if (!pinValide) {
        enregistrerEchec(id_utilisateur);
        // Message générique : ne révèle pas si c'est le compte ou le PIN qui est faux.
        return res.status(401).json({ message: 'Identifiants invalides.' });
      }

      reinitialiser(id_utilisateur);
      const session_debut = Math.floor(Date.now() / 1000);
      const jeton = signerJeton({
        id_utilisateur: utilisateur.id_utilisateur,
        role: utilisateur.role,
        session_debut,
      });
      return res.json({
        jeton,
        utilisateur: {
          id_utilisateur: utilisateur.id_utilisateur,
          nom: utilisateur.nom,
          role: utilisateur.role,
        },
      });
    } catch (err) {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Renouvellement glissant : réémet un jeton tant que le plafond de 12h n'est pas atteint.
  routeur.post('/refresh', authentifier, (req, res) => {
    const maintenant = Math.floor(Date.now() / 1000);
    if (maintenant - req.utilisateur.session_debut >= PLAFOND_SESSION_S) {
      return res.status(401).json({ message: 'Session expirée, reconnectez-vous.' });
    }
    const jeton = signerJeton({
      id_utilisateur: req.utilisateur.id_utilisateur,
      role: req.utilisateur.role,
      session_debut: req.utilisateur.session_debut,
    });
    return res.json({ jeton });
  });

  // Utilisatrice de la session courante (restauration de session côté frontend).
  routeur.get('/session', authentifier, (req, res) => {
    return res.json({
      id_utilisateur: req.utilisateur.id_utilisateur,
      role: req.utilisateur.role,
    });
  });

  return routeur;
}

module.exports = creerRouteurAuth;
