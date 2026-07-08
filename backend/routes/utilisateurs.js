const express = require('express');

// Fabrique : renvoie un routeur alimenté par le pool pg fourni.
function creerRouteurUtilisateurs(pool) {
  const routeur = express.Router();

  // Liste des utilisatrices pour l'écran « choisir son nom ».
  // Ne renvoie jamais code_pin_hache.
  routeur.get('/', async (req, res) => {
    try {
      const resultat = await pool.query(
        'SELECT id_utilisateur, nom, role FROM utilisateur ORDER BY nom'
      );
      res.json(resultat.rows);
    } catch (err) {
      res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  return routeur;
}

module.exports = creerRouteurUtilisateurs;
