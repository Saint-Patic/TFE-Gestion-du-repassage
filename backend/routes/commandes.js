const express = require('express');
const authentifier = require('../middlewares/authentifier');
const exigerRole = require('../middlewares/exiger-role');

// Valide le corps d'une commande à la réception. Renvoie un message ou null.
function validerCommande({ id_client, nombre_mannes }) {
  if (!id_client || typeof id_client !== 'string') return 'id_client est requis.';
  if (!Number.isInteger(nombre_mannes) || nombre_mannes < 1) {
    return 'nombre_mannes doit être un entier ≥ 1.';
  }
  return null;
}

// Fabrique : routeur commandes alimenté par le pool pg fourni.
function creerRouteurCommandes(pool) {
  const routeur = express.Router();

  // Crée une commande (réception) : client + nombre de mannes. Accès gérante + repasseuse.
  routeur.post('/', authentifier, exigerRole('gerante', 'repasseuse'), async (req, res) => {
    const { id_client, nombre_mannes } = req.body || {};
    const erreur = validerCommande({ id_client, nombre_mannes });
    if (erreur) return res.status(400).json({ message: erreur });
    try {
      const resultat = await pool.query(
        `INSERT INTO commande (id_client, nombre_mannes)
         VALUES ($1, $2)
         RETURNING id_commande, id_client, statut, nombre_mannes, prioritaire, date_reception`,
        [id_client, nombre_mannes]
      );
      return res.status(201).json(resultat.rows[0]);
    } catch (err) {
      if (err.code === '23503') {
        return res.status(400).json({ message: 'Client introuvable.' });
      }
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  return routeur;
}

module.exports = creerRouteurCommandes;
