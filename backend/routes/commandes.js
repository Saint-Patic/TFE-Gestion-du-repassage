const express = require('express');
const authentifier = require('../middlewares/authentifier');
const exigerRole = require('../middlewares/exiger-role');

// Valide le corps d'une commande à la réception. Renvoie un message ou null.
function validerCommande({ id_client, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus }) {
  if (!id_client || typeof id_client !== 'string') return 'id_client est requis.';
  if (!Number.isInteger(nombre_mannes) || nombre_mannes < 1) {
    return 'nombre_mannes doit être un entier ≥ 1.';
  }
  for (const [nom, valeur] of [
    ['prioritaire', prioritaire],
    ['cintres_client', cintres_client],
    ['cintres_entr_rendus', cintres_entr_rendus],
  ]) {
    if (valeur !== undefined && typeof valeur !== 'boolean') {
      return `${nom} doit être un booléen.`;
    }
  }
  return null;
}

// Valide le corps de la répartition d'emplacements. Renvoie un message ou null.
function validerEmplacements(emplacements) {
  if (!Array.isArray(emplacements) || emplacements.length === 0) {
    return 'emplacements doit être un tableau non vide.';
  }
  for (const e of emplacements) {
    if (!e || typeof e.id_emplacement !== 'string' || !e.id_emplacement) {
      return 'Chaque emplacement doit avoir un id_emplacement.';
    }
    if (!Number.isInteger(e.nombre_mannes) || e.nombre_mannes < 1) {
      return 'nombre_mannes doit être un entier ≥ 1.';
    }
  }
  return null;
}

// Fabrique : routeur commandes alimenté par le pool pg fourni.
function creerRouteurCommandes(pool) {
  const routeur = express.Router();

  // Crée une commande (réception) : client + nombre de mannes + flags. Accès gérante + repasseuse.
  routeur.post('/', authentifier, exigerRole('gerante', 'repasseuse'), async (req, res) => {
    const { id_client, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus } = req.body || {};
    const erreur = validerCommande({ id_client, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus });
    if (erreur) return res.status(400).json({ message: erreur });
    try {
      const resultat = await pool.query(
        `INSERT INTO commande (id_client, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id_commande, id_client, statut, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus, date_reception`,
        [id_client, nombre_mannes, Boolean(prioritaire), Boolean(cintres_client), Boolean(cintres_entr_rendus)]
      );
      return res.status(201).json(resultat.rows[0]);
    } catch (err) {
      if (err.code === '23503') {
        return res.status(400).json({ message: 'Client introuvable.' });
      }
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Répartit les mannes d'une commande sur des emplacements (remplacement, transaction).
  routeur.post('/:id/emplacements', authentifier, exigerRole('gerante', 'repasseuse'), async (req, res) => {
    const { emplacements } = req.body || {};
    const erreur = validerEmplacements(emplacements);
    if (erreur) return res.status(400).json({ message: erreur });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const cmd = await client.query(
        'SELECT nombre_mannes FROM commande WHERE id_commande = $1',
        [req.params.id]
      );
      if (cmd.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Commande introuvable.' });
      }

      const attendu = cmd.rows[0].nombre_mannes;
      const total = emplacements.reduce((s, e) => s + e.nombre_mannes, 0);
      if (total !== attendu) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `${total} manne(s) placée(s) pour ${attendu} attendue(s).`,
        });
      }

      await client.query('DELETE FROM commande_emplacement WHERE id_commande = $1', [req.params.id]);
      for (const e of emplacements) {
        await client.query(
          `INSERT INTO commande_emplacement (id_commande, id_emplacement, nombre_mannes)
           VALUES ($1, $2, $3)`,
          [req.params.id, e.id_emplacement, e.nombre_mannes]
        );
      }

      await client.query('COMMIT');
      return res.status(201).json({ id_commande: req.params.id, emplacements });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23503') {
        return res.status(400).json({ message: 'Emplacement introuvable.' });
      }
      return res.status(500).json({ message: 'Erreur serveur.' });
    } finally {
      client.release();
    }
  });

  return routeur;
}

module.exports = creerRouteurCommandes;
