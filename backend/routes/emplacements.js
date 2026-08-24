const express = require('express');
const authentifier = require('../middlewares/authentifier');
const exigerRole = require('../middlewares/exiger-role');

// Valide le corps d'un déplacement. Renvoie un message ou null.
function validerDeplacement({ id_source, id_destination, id_client }) {
  for (const [nom, val] of [
    ['id_source', id_source],
    ['id_destination', id_destination],
    ['id_client', id_client],
  ]) {
    if (typeof val !== 'string' || !val) return `${nom} est requis.`;
  }
  if (id_source === id_destination) return 'La source et la destination doivent être différentes.';
  return null;
}

// Fabrique : routeur emplacements alimenté par le pool pg fourni.
function creerRouteurEmplacements(pool) {
  const routeur = express.Router();

  // Liste les emplacements (42 étagères + sol) avec le client occupant de chaque case.
  // Sert au préchargement (validation instantanée des scans, placement et déplacement). Deux rôles.
  routeur.get('/', authentifier, exigerRole('gerante', 'repasseuse'), async (req, res) => {
    try {
      const resultat = await pool.query(
        `SELECT e.id_emplacement, e.code_barre, e.etagere, e.niveau, e.position, e.est_au_sol,
                occ.id_client AS id_client_occupant,
                occ.nom       AS client_nom_occupant,
                occ.prenom    AS client_prenom_occupant
         FROM emplacement e
         LEFT JOIN LATERAL (
           SELECT cl.id_client, cl.nom, cl.prenom
           FROM commande_emplacement ce
           JOIN commande c  ON c.id_commande = ce.id_commande
           JOIN client   cl ON cl.id_client  = c.id_client
           WHERE ce.id_emplacement = e.id_emplacement
           LIMIT 1
         ) occ ON TRUE
         ORDER BY e.est_au_sol, e.etagere, e.niveau, e.position`
      );
      res.json(resultat.rows);
    } catch (err) {
      res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Contenu d'un emplacement : commandes présentes + client. Réservé aux repasseuses (réorganisation).
  routeur.get('/:id/contenu', authentifier, exigerRole('repasseuse'), async (req, res) => {
    try {
      const resultat = await pool.query(
        `SELECT ce.id_commande, ce.nombre_mannes, c.statut, c.id_client,
                cl.nom AS client_nom, cl.prenom AS client_prenom
         FROM commande_emplacement ce
         JOIN commande c  ON c.id_commande = ce.id_commande
         JOIN client   cl ON cl.id_client  = c.id_client
         WHERE ce.id_emplacement = $1
         ORDER BY cl.nom, cl.prenom`,
        [req.params.id]
      );
      res.json(resultat.rows);
    } catch (err) {
      res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Déplace les mannes d'un client d'un emplacement source vers une destination (transaction).
  // Étagère mono-client : le lot du client part entièrement. Sol multi-client : seul ce client sort.
  routeur.post('/deplacer', authentifier, exigerRole('repasseuse'), async (req, res) => {
    const { id_source, id_destination, id_client } = req.body || {};
    const erreur = validerDeplacement({ id_source, id_destination, id_client });
    if (erreur) return res.status(400).json({ message: erreur });

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const lignes = await client.query(
        `SELECT ce.id_commande, ce.nombre_mannes
         FROM commande_emplacement ce
         JOIN commande c ON c.id_commande = ce.id_commande
         WHERE ce.id_emplacement = $1 AND c.id_client = $2`,
        [id_source, id_client]
      );
      if (lignes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Aucune manne de ce client à cet emplacement.' });
      }

      const dest = await client.query(
        'SELECT est_au_sol FROM emplacement WHERE id_emplacement = $1',
        [id_destination]
      );
      if (dest.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Emplacement destination introuvable.' });
      }

      // Invariant #190 : un emplacement (hors sol) ne peut contenir qu'un seul client.
      // La portée est la CASE, pas l'étagère (formulation rectifiée au #330).
      if (!dest.rows[0].est_au_sol) {
        const autre = await client.query(
          `SELECT 1 FROM commande_emplacement ce
           JOIN commande c ON c.id_commande = ce.id_commande
           WHERE ce.id_emplacement = $1 AND c.id_client <> $2 LIMIT 1`,
          [id_destination, id_client]
        );
        if (autre.rowCount > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ message: 'Destination occupée par les mannes d’un autre client.' });
        }
      }

      for (const l of lignes.rows) {
        await client.query(
          `INSERT INTO commande_emplacement (id_commande, id_emplacement, nombre_mannes)
           VALUES ($1, $2, $3)
           ON CONFLICT (id_commande, id_emplacement)
           DO UPDATE SET nombre_mannes = commande_emplacement.nombre_mannes + EXCLUDED.nombre_mannes`,
          [l.id_commande, id_destination, l.nombre_mannes]
        );
      }

      await client.query(
        `DELETE FROM commande_emplacement ce
         USING commande c
         WHERE ce.id_commande = c.id_commande
           AND ce.id_emplacement = $1 AND c.id_client = $2`,
        [id_source, id_client]
      );

      await client.query('COMMIT');
      return res.status(200).json({ id_source, id_destination, id_client, deplacees: lignes.rows });
    } catch (err) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (err.code === '23503') {
        return res.status(400).json({ message: 'Emplacement introuvable.' });
      }
      return res.status(500).json({ message: 'Erreur serveur.' });
    } finally {
      if (client) client.release();
    }
  });

  return routeur;
}

module.exports = creerRouteurEmplacements;
