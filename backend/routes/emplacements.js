const express = require('express');
const authentifier = require('../middlewares/authentifier');
const exigerRole = require('../middlewares/exiger-role');

// Fabrique : routeur emplacements alimenté par le pool pg fourni.
function creerRouteurEmplacements(pool) {
  const routeur = express.Router();

  // Liste les 42 emplacements (préchargement de l'écran d'encodage). Deux rôles.
  routeur.get('/', authentifier, exigerRole('gerante', 'repasseuse'), async (req, res) => {
    try {
      const resultat = await pool.query(
        `SELECT id_emplacement, code_barre, etagere, niveau, position
         FROM emplacement ORDER BY etagere, niveau, position`
      );
      res.json(resultat.rows);
    } catch (err) {
      res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  return routeur;
}

module.exports = creerRouteurEmplacements;
