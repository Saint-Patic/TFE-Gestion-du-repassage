const express = require('express');

// Fabrique : renvoie un routeur alimenté par le pool pg fourni.
function creerRouteurUtilisateurs(pool) {
  const routeur = express.Router();

  // Liste des utilisatrices pour l'écran « choisir son nom ». Route PUBLIQUE : appelée
  // avant toute authentification, elle ne renvoie jamais code_pin_hache.
  //
  // Deux barrières, et non une : le SELECT ne demande pas la colonne, ET la projection
  // ci-dessous n'en laisserait rien passer si elle arrivait quand même (SELECT * introduit
  // par mégarde, colonne ajoutée à une vue). Défense en profondeur, comme au #110.
  routeur.get('/', async (req, res) => {
    try {
      const resultat = await pool.query(
        'SELECT id_utilisateur, nom, role FROM utilisateur ORDER BY nom'
      );
      res.json(
        resultat.rows.map(({ id_utilisateur, nom, role }) => ({
          id_utilisateur,
          nom,
          role,
        }))
      );
    } catch (err) {
      res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  return routeur;
}

module.exports = creerRouteurUtilisateurs;
