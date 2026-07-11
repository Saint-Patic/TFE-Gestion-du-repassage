const express = require('express');
const authentifier = require('../middlewares/authentifier');
const { genererCodeBarre } = require('../clients/code-barre');

const MAX_TENTATIVES = 5;

// Valide les champs client (partagé création/modification). Renvoie un message ou null.
function validerClient({ nom, prenom, telephone, email }) {
  if (!nom || !prenom || !telephone) return 'nom, prenom et telephone sont requis.';
  if (nom.length > 100 || prenom.length > 100 || telephone.length > 20) {
    return 'Un champ dépasse la longueur autorisée.';
  }
  if (email && (email.length > 255 || !email.includes('@'))) return 'Email invalide.';
  return null;
}

// Fabrique : routeur clients alimenté par le pool pg fourni.
function creerRouteurClients(pool) {
  const routeur = express.Router();

  // Liste des clients (recherche/filtrage fait côté frontend).
  routeur.get('/', authentifier, async (req, res) => {
    try {
      const resultat = await pool.query(
        `SELECT id_client, nom, prenom, telephone, email, code_barre, date_creation
         FROM client ORDER BY nom, prenom`
      );
      res.json(resultat.rows);
    } catch (err) {
      res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Crée un client + code-barres unique. Bearer requis (rôle géré plus tard, #110).
  routeur.post('/', authentifier, async (req, res) => {
    const { nom, prenom, telephone, email } = req.body || {};
    const erreur = validerClient({ nom, prenom, telephone, email });
    if (erreur) return res.status(400).json({ message: erreur });

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

  // Modifie les champs éditables d'un client (jamais le code_barre).
  routeur.put('/:id', authentifier, async (req, res) => {
    const { nom, prenom, telephone, email } = req.body || {};
    const erreur = validerClient({ nom, prenom, telephone, email });
    if (erreur) return res.status(400).json({ message: erreur });
    try {
      const resultat = await pool.query(
        `UPDATE client SET nom=$1, prenom=$2, telephone=$3, email=$4
         WHERE id_client=$5
         RETURNING id_client, nom, prenom, telephone, email, code_barre, date_creation`,
        [nom, prenom, telephone, email || null, req.params.id]
      );
      if (resultat.rowCount === 0) {
        return res.status(404).json({ message: 'Client introuvable.' });
      }
      return res.json(resultat.rows[0]);
    } catch (err) {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Supprime un client ; s'il a des commandes (FK 23503), l'anonymise à la place (RGPD).
  routeur.delete('/:id', authentifier, async (req, res) => {
    const id = req.params.id;
    try {
      const resultat = await pool.query('DELETE FROM client WHERE id_client=$1', [id]);
      if (resultat.rowCount === 0) {
        return res.status(404).json({ message: 'Client introuvable.' });
      }
      return res.json({ anonymise: false });
    } catch (err) {
      if (err.code === '23503') {
        const anon = await pool.query(
          `UPDATE client
           SET nom='Anonymisé', prenom='', telephone='', email=NULL,
               code_barre='ANON-' || id_client
           WHERE id_client=$1`,
          [id]
        );
        if (anon.rowCount === 0) {
          return res.status(404).json({ message: 'Client introuvable.' });
        }
        return res.json({ anonymise: true });
      }
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  return routeur;
}

module.exports = creerRouteurClients;
