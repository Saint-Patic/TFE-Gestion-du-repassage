const express = require('express');
const authentifier = require('../middlewares/authentifier');
const exigerRole = require('../middlewares/exiger-role');
const { calculerTempsRepassageS } = require('../commandes/temps');
const { validerEmplacements, enregistrerPlacement } = require('../commandes/placement');

// Valide les champs scalaires d'une commande (mannes + flags). Renvoie un message ou null.
function validerScalairesCommande({ nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus }) {
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

// Valide le corps d'une commande à la réception. Renvoie un message ou null.
function validerCommande({ id_client, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus }) {
  if (!id_client || typeof id_client !== 'string') return 'id_client est requis.';
  return validerScalairesCommande({ nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus });
}

// Fabrique : routeur commandes alimenté par le pool pg fourni.
// diffuserMaj(idRepasseuse) : notifie le temps réel (défaut no-op → testable sans Socket.IO).
function creerRouteurCommandes(pool, diffuserMaj = () => {}) {
  const routeur = express.Router();

  // Liste les commandes du Kanban avec le nom du client. Repasseuse → seulement les siennes ;
  // gérante → tout. Colonnes : pipeline actif + Récupéré du jour. Accès gérante + repasseuse.
  routeur.get('/', authentifier, exigerRole('gerante', 'repasseuse'), async (req, res) => {
    try {
      const params = [];
      let filtreRepasseuse = '';
      if (req.utilisateur.role === 'repasseuse') {
        params.push(req.utilisateur.id_utilisateur);
        filtreRepasseuse = ` AND c.id_repasseuse = $${params.length}`;
      }
      const resultat = await pool.query(
        `SELECT c.id_commande, c.id_client, c.statut, c.nombre_mannes,
                c.prioritaire, c.cintres_client, c.cintres_entr_rendus, c.cintres_entr_nb, c.date_reception, c.id_repasseuse,
                c.repassage_debut, c.temps_repassage_s,
                cl.nom AS client_nom, cl.prenom AS client_prenom
         FROM commande c
         JOIN client cl ON cl.id_client = c.id_client
         WHERE ( c.statut IN ('a_faire', 'en_cours', 'fait')
                 OR (c.statut = 'recupere' AND c.date_recuperation::date = CURRENT_DATE) )${filtreRepasseuse}
         ORDER BY c.prioritaire DESC, c.date_reception ASC`,
        params
      );
      return res.json(resultat.rows);
    } catch {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Résout l'action à effectuer pour un scan de code-barres client. LECTURE PURE : ne modifie rien.
  // Priorité « en cours » d'abord : on termine ce qu'on a commencé avant d'en démarrer une autre,
  // ce qui rend impossible le cas d'une cliente ayant à la fois une commande à faire et une en cours.
  routeur.get('/a-scanner/:code_barre', authentifier, exigerRole('repasseuse'), async (req, res) => {
    try {
      const resultat = await pool.query(
        `SELECT c.id_commande, c.id_client, c.statut, c.nombre_mannes, c.prioritaire,
                c.date_reception, c.id_repasseuse, c.temps_repassage_s, c.repassage_debut
         FROM commande c
         JOIN client cl ON cl.id_client = c.id_client
         WHERE cl.code_barre = $1 AND c.id_repasseuse = $2 AND c.statut IN ('en_cours','a_faire')
         ORDER BY (c.statut = 'en_cours') DESC, c.prioritaire DESC, c.date_reception ASC
         LIMIT 1`,
        [req.params.code_barre, req.utilisateur.id_utilisateur]
      );
      if (resultat.rowCount === 0) {
        return res.status(404).json({ message: 'Aucune commande active pour ce client.' });
      }
      const commande = resultat.rows[0];
      return res.json({ action: commande.statut === 'en_cours' ? 'cloturer' : 'demarrer', commande });
    } catch {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Crée une commande (réception) : client + nombre de mannes + flags. Accès gérante + repasseuse.
  routeur.post('/', authentifier, exigerRole('gerante', 'repasseuse'), async (req, res) => {
    const { id_client, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus } = req.body || {};
    const erreur = validerCommande({ id_client, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus });
    if (erreur) return res.status(400).json({ message: erreur });
    try {
      const resultat = await pool.query(
        `INSERT INTO commande (id_client, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus, id_repasseuse)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id_commande, id_client, statut, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus, date_reception, id_repasseuse`,
        [id_client, nombre_mannes, Boolean(prioritaire), Boolean(cintres_client), Boolean(cintres_entr_rendus), req.utilisateur.id_utilisateur]
      );
      diffuserMaj(resultat.rows[0].id_repasseuse);
      return res.status(201).json(resultat.rows[0]);
    } catch (err) {
      if (err.code === '23503') {
        return res.status(400).json({ message: 'Client introuvable.' });
      }
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Démarre le repassage : scan du code-barres client → sa 1ʳᵉ commande « à faire » passe en_cours.
  // Effets : timer (repassage_debut), mannes hors étagères, trace historique, diffusion. Repasseuse.
  routeur.post('/demarrer', authentifier, exigerRole('repasseuse'), async (req, res) => {
    const { code_barre } = req.body || {};
    if (!code_barre || typeof code_barre !== 'string') {
      return res.status(400).json({ message: 'code_barre est requis.' });
    }
    const idRepasseuse = req.utilisateur.id_utilisateur;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const trouve = await client.query(
        `SELECT c.id_commande
         FROM commande c
         JOIN client cl ON cl.id_client = c.id_client
         WHERE cl.code_barre = $1 AND c.id_repasseuse = $2 AND c.statut = 'a_faire'
         ORDER BY c.prioritaire DESC, c.date_reception ASC
         LIMIT 1`,
        [code_barre, idRepasseuse]
      );
      if (trouve.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Aucune commande à faire pour ce client.' });
      }
      const idCommande = trouve.rows[0].id_commande;

      const maj = await client.query(
        `UPDATE commande SET statut='en_cours', repassage_debut=now()
         WHERE id_commande=$1
         RETURNING id_commande, id_client, statut, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus, date_reception, id_repasseuse`,
        [idCommande]
      );

      await client.query('DELETE FROM commande_emplacement WHERE id_commande=$1', [idCommande]);

      await client.query(
        `INSERT INTO historique_statut (id_commande, ancien_statut, nouveau_statut, id_utilisateur)
         VALUES ($1, 'a_faire', 'en_cours', $2)`,
        [idCommande, idRepasseuse]
      );

      await client.query('COMMIT');
      diffuserMaj(maj.rows[0].id_repasseuse);
      return res.status(200).json(maj.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(500).json({ message: 'Erreur serveur.' });
    } finally {
      client.release();
    }
  });

  // Met en pause le timer : fige temps_repassage_s = cumul + segment courant (calcul JS), repassage_debut = NULL.
  // Seulement une commande « en cours » en marche, appartenant à la repasseuse. Repasseuse.
  routeur.post('/:id/pause', authentifier, exigerRole('repasseuse'), async (req, res) => {
    const idRepasseuse = req.utilisateur.id_utilisateur;
    try {
      const cur = await pool.query(
        `SELECT repassage_debut, temps_repassage_s FROM commande
         WHERE id_commande = $1 AND id_repasseuse = $2 AND statut = 'en_cours' AND repassage_debut IS NOT NULL`,
        [req.params.id, idRepasseuse]
      );
      if (cur.rowCount === 0) return res.status(409).json({ message: 'Impossible de mettre en pause cette commande.' });

      const total = calculerTempsRepassageS(cur.rows[0].temps_repassage_s, cur.rows[0].repassage_debut, new Date());

      const maj = await pool.query(
        `UPDATE commande SET temps_repassage_s = $2, repassage_debut = NULL
         WHERE id_commande = $1 AND repassage_debut IS NOT NULL
         RETURNING id_commande, id_client, statut, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus, date_reception, id_repasseuse, repassage_debut, temps_repassage_s`,
        [req.params.id, total]
      );
      if (maj.rowCount === 0) return res.status(409).json({ message: 'Impossible de mettre en pause cette commande.' });
      diffuserMaj(maj.rows[0].id_repasseuse);
      return res.json(maj.rows[0]);
    } catch {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Reprend le timer : repose repassage_debut = now(). Seulement une commande « en cours » en pause,
  // appartenant à la repasseuse. Repasseuse.
  routeur.post('/:id/reprendre', authentifier, exigerRole('repasseuse'), async (req, res) => {
    try {
      const maj = await pool.query(
        `UPDATE commande SET repassage_debut = now()
         WHERE id_commande = $1 AND id_repasseuse = $2 AND statut = 'en_cours' AND repassage_debut IS NULL
         RETURNING id_commande, id_client, statut, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus, date_reception, id_repasseuse, repassage_debut, temps_repassage_s`,
        [req.params.id, req.utilisateur.id_utilisateur]
      );
      if (maj.rowCount === 0) return res.status(409).json({ message: 'Impossible de reprendre cette commande.' });
      diffuserMaj(maj.rows[0].id_repasseuse);
      return res.json(maj.rows[0]);
    } catch {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Enregistre le nombre de cintres entreprise utilisés (pendant le repassage). Repasseuse, en_cours, scopé.
  routeur.put('/:id/cintres-entreprise', authentifier, exigerRole('repasseuse'), async (req, res) => {
    const { cintres_entr_nb } = req.body || {};
    if (!Number.isInteger(cintres_entr_nb) || cintres_entr_nb < 0) {
      return res.status(400).json({ message: 'cintres_entr_nb doit être un entier ≥ 0.' });
    }
    try {
      const maj = await pool.query(
        `UPDATE commande SET cintres_entr_nb = $2
         WHERE id_commande = $1 AND id_repasseuse = $3 AND statut = 'en_cours'
         RETURNING id_commande, id_client, statut, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus, cintres_entr_nb, date_reception, id_repasseuse, repassage_debut, temps_repassage_s`,
        [req.params.id, cintres_entr_nb, req.utilisateur.id_utilisateur]
      );
      if (maj.rowCount === 0) return res.status(409).json({ message: 'Commande non modifiable (pas en cours ou non attribuée).' });
      diffuserMaj(maj.rows[0].id_repasseuse);
      return res.json(maj.rows[0]);
    } catch {
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
        'SELECT nombre_mannes, id_client FROM commande WHERE id_commande = $1',
        [req.params.id]
      );
      if (cmd.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Commande introuvable.' });
      }

      await enregistrerPlacement(
        client, req.params.id, cmd.rows[0].id_client, cmd.rows[0].nombre_mannes, emplacements
      );

      await client.query('COMMIT');
      return res.status(201).json({ id_commande: req.params.id, emplacements });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.statut) return res.status(err.statut).json({ message: err.message });
      if (err.code === '23503') {
        return res.status(400).json({ message: 'Emplacement introuvable.' });
      }
      return res.status(500).json({ message: 'Erreur serveur.' });
    } finally {
      client.release();
    }
  });

  // Modifie les scalaires d'une commande « à faire » (flags + nombre de mannes). Gérante + repasseuse.
  routeur.put('/:id', authentifier, exigerRole('gerante', 'repasseuse'), async (req, res) => {
    const { prioritaire, cintres_client, cintres_entr_rendus, nombre_mannes } = req.body || {};
    const erreur = validerScalairesCommande({ nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus });
    if (erreur) return res.status(400).json({ message: erreur });
    try {
      const maj = await pool.query(
        `UPDATE commande
         SET prioritaire = $2, cintres_client = $3, cintres_entr_rendus = $4, nombre_mannes = $5
         WHERE id_commande = $1 AND statut = 'a_faire'
         RETURNING id_commande, id_client, statut, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus, date_reception, id_repasseuse`,
        [req.params.id, Boolean(prioritaire), Boolean(cintres_client), Boolean(cintres_entr_rendus), nombre_mannes]
      );
      if (maj.rowCount === 1) {
        diffuserMaj(maj.rows[0].id_repasseuse);
        return res.json(maj.rows[0]);
      }
      // Rien mis à jour : distinguer 404 (absente) de 409 (existe mais pas « à faire »).
      const existe = await pool.query('SELECT statut FROM commande WHERE id_commande = $1', [req.params.id]);
      if (existe.rowCount === 0) return res.status(404).json({ message: 'Commande introuvable.' });
      return res.status(409).json({ message: 'Seules les commandes à faire sont modifiables.' });
    } catch {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  return routeur;
}

module.exports = creerRouteurCommandes;
