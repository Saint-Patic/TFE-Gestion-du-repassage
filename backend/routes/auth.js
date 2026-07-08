const express = require('express');
const { verifierPin, estFormatValide } = require('../auth/pin');
const {
  enregistrerEchec,
  reinitialiser,
  etatVerrou,
} = require('../auth/verrouillage');

const FORMAT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fabrique : renvoie un routeur d'authentification alimenté par le pool pg.
function creerRouteurAuth(pool) {
  const routeur = express.Router();

  // Vérifie le PIN de l'utilisatrice sélectionnée. Ne délivre pas de jeton (US #50).
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
      return res.json({
        id_utilisateur: utilisateur.id_utilisateur,
        nom: utilisateur.nom,
        role: utilisateur.role,
      });
    } catch (err) {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  return routeur;
}

module.exports = creerRouteurAuth;
