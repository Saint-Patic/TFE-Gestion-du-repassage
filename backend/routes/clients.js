const express = require('express');
const authentifier = require('../middlewares/authentifier');
const { genererCodeBarre } = require('../clients/code-barre');

const MAX_TENTATIVES = 5;

// Fabrique : routeur clients alimenté par le pool pg fourni.
function creerRouteurClients(pool) {
  const routeur = express.Router();

  // Crée un client + code-barres unique. Bearer requis (rôle géré plus tard, #110).
  routeur.post('/', authentifier, async (req, res) => {
    const { nom, prenom, telephone, email } = req.body || {};

    if (!nom || !prenom || !telephone) {
      return res.status(400).json({ message: 'nom, prenom et telephone sont requis.' });
    }
    if (nom.length > 100 || prenom.length > 100 || telephone.length > 20) {
      return res.status(400).json({ message: 'Un champ dépasse la longueur autorisée.' });
    }
    if (email && (email.length > 255 || !email.includes('@'))) {
      return res.status(400).json({ message: 'Email invalide.' });
    }

    // Réessai si collision de code_barre (contrainte UNIQUE → code Postgres 23505).
    for (let tentative = 0; tentative < MAX_TENTATIVES; tentative++) {
      const code_barre = genererCodeBarre();
      try {
        const resultat = await pool.query(
          `INSERT INTO client (nom, prenom, telephone, email, code_barre)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id_client, nom, prenom, telephone, email, code_barre, date_creation`,
          [nom, prenom, telephone, email || null, code_barre]
        );
        return res.status(201).json(resultat.rows[0]);
      } catch (err) {
        if (err.code === '23505') continue; // collision → régénère
        return res.status(500).json({ message: 'Erreur serveur.' });
      }
    }
    return res.status(500).json({ message: 'Impossible de générer un code-barres unique.' });
  });

  return routeur;
}

module.exports = creerRouteurClients;
