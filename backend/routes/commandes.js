const express = require('express');
const authentifier = require('../middlewares/authentifier');
const exigerRole = require('../middlewares/exiger-role');
const { calculerTempsRepassageS } = require('../commandes/temps');
const { validerEmplacements, enregistrerPlacement } = require('../commandes/placement');
const { transitionValide } = require('../commandes/transitions');
const { mettreEnFileSms } = require('../sms/file');
const { construireMessagePret } = require('../sms/gabarit');
const { estMobile } = require('../clients/telephone');

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

// Correspondance statut courant → action à proposer au scan. Table plutôt que ternaires
// imbriqués : il y a désormais trois branches.
const ACTIONS = { fait: 'recuperer', en_cours: 'cloturer', a_faire: 'demarrer' };

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
        // « Fait » et « Récupéré » sont collectifs depuis le #280 : la remise au comptoir n'appartient
        // à personne en particulier, et on doit voir ce qu'on a le droit de remettre. `recupere` est
        // inclus volontairement, sans quoi la carte disparaîtrait juste après la remise.
        filtreRepasseuse = ` AND (c.statut IN ('fait','recupere') OR c.id_repasseuse = $${params.length})`;
      }
      // LEFT JOIN : une cliente supprimée laisse ses commandes détachées (id_client NULL). Le repli
      // sur le nom vit dans le SQL et non dans React, pour n'avoir qu'un seul endroit à corriger —
      // CarteCommande et ses tests restent inchangés. client_mobile vaut alors NULL, et le badge
      // « à appeler » du #270 teste === false : une commande sans cliente n'en affiche donc aucun.
      const resultat = await pool.query(
        `SELECT c.id_commande, c.id_client, c.statut, c.nombre_mannes,
                c.prioritaire, c.cintres_client, c.cintres_entr_rendus, c.cintres_entr_nb, c.date_reception, c.id_repasseuse,
                c.repassage_debut, c.temps_repassage_s,
                COALESCE(cl.nom, 'Cliente supprimée') AS client_nom,
                COALESCE(cl.prenom, '') AS client_prenom,
                (cl.telephone ~ '^04[0-9]{8}$') AS client_mobile
         FROM commande c
         LEFT JOIN client cl ON cl.id_client = c.id_client
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
  // DOUBLE PÉRIMÈTRE : une commande « fait » est trouvée quelle que soit la repasseuse (la remise au
  // comptoir est collective), tandis que « en cours » et « à faire » restent limitées aux siennes.
  // Priorité : remettre d'abord (la cliente est devant vous), puis terminer, puis démarrer.
  routeur.get('/a-scanner/:code_barre', authentifier, exigerRole('repasseuse'), async (req, res) => {
    try {
      const resultat = await pool.query(
        `SELECT c.id_commande, c.id_client, c.statut, c.nombre_mannes, c.prioritaire,
                c.date_reception, c.id_repasseuse, c.temps_repassage_s, c.repassage_debut,
                cl.nom AS client_nom, cl.prenom AS client_prenom
         FROM commande c
         JOIN client cl ON cl.id_client = c.id_client
         WHERE cl.code_barre = $1
           AND ( c.statut = 'fait'
              OR (c.statut IN ('en_cours','a_faire') AND c.id_repasseuse = $2) )
         ORDER BY (c.statut = 'fait') DESC, (c.statut = 'en_cours') DESC,
                  c.prioritaire DESC, c.date_reception ASC
         LIMIT 1`,
        [req.params.code_barre, req.utilisateur.id_utilisateur]
      );
      if (resultat.rowCount === 0) {
        return res.status(404).json({ message: 'Aucune commande active pour ce client.' });
      }
      const commande = resultat.rows[0];
      return res.json({ action: ACTIONS[commande.statut], commande });
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

  // Clôture d'un repassage : « en cours → fait » en UNE SEULE transaction —
  // timer arrêté, mannes replacées sur les étagères, historique tracé, SMS déposé en file.
  // Si une étape échoue, le ROLLBACK annule tout : aucun SMS pour une clôture qui n'a pas abouti.
  routeur.post('/:id/cloturer', authentifier, exigerRole('repasseuse'), async (req, res) => {
    const { emplacements } = req.body || {};
    const erreur = validerEmplacements(emplacements);
    if (erreur) return res.status(400).json({ message: erreur });

    const idRepasseuse = req.utilisateur.id_utilisateur;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const cur = await client.query(
        `SELECT c.id_client, c.nombre_mannes, c.statut, c.temps_repassage_s, c.repassage_debut,
                cl.telephone
         FROM commande c
         JOIN client cl ON cl.id_client = c.id_client
         WHERE c.id_commande = $1 AND c.id_repasseuse = $2
         FOR UPDATE OF c`,
        [req.params.id, idRepasseuse]
      );
      if (cur.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Commande introuvable.' });
      }
      const commande = cur.rows[0];

      // Garde de transition (#228) : couvre « pas en cours » comme « déjà clôturée ».
      if (!transitionValide(commande.statut, 'fait')) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: "Cette commande n'est plus en cours." });
      }

      // Temps final (#225) : cumul + segment courant, puis le chrono s'arrête.
      const temps = calculerTempsRepassageS(
        commande.temps_repassage_s, commande.repassage_debut, new Date()
      );

      const maj = await client.query(
        `UPDATE commande SET statut='fait', temps_repassage_s=$2, repassage_debut=NULL
         WHERE id_commande=$1 AND statut='en_cours'
         RETURNING id_commande, id_client, statut, nombre_mannes, prioritaire, cintres_client,
                   cintres_entr_rendus, cintres_entr_nb, date_reception, id_repasseuse,
                   repassage_debut, temps_repassage_s`,
        [req.params.id, temps]
      );
      // Le FOR UPDATE ci-dessus verrouille la ligne, donc ce cas ne devrait pas survenir ;
      // la condition reste comme filet si le verrou disparaissait un jour. Pas du code mort.
      if (maj.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: "Cette commande n'est plus en cours." });
      }

      await enregistrerPlacement(
        client, req.params.id, commande.id_client, commande.nombre_mannes, emplacements
      );

      await client.query(
        `INSERT INTO historique_statut (id_commande, ancien_statut, nouveau_statut, id_utilisateur)
         VALUES ($1, 'en_cours', 'fait', $2)`,
        [req.params.id, idRepasseuse]
      );

      // Dépôt du SMS DANS la transaction (#250) : pas de clôture, pas de SMS.
      // Un fixe ne peut pas recevoir de SMS : la cliente sera appelée manuellement (#270).
      // On ne dépose alors AUCUNE ligne, plutôt qu'une qui resterait éternellement en attente.
      if (estMobile(commande.telephone)) {
        await mettreEnFileSms(client, req.params.id, construireMessagePret());
      }

      await client.query('COMMIT');
      // Diffusion APRÈS le COMMIT : notifier avant annoncerait un état que la base peut annuler.
      diffuserMaj(maj.rows[0].id_repasseuse);
      return res.json(maj.rows[0]);
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

  // Remise du linge à la cliente : « fait → récupéré », la dernière transition du workflow.
  // NON SCOPÉ à la repasseuse : la remise se fait au comptoir, par qui est disponible — une cliente
  // ne doit pas repartir sans son linge parce que la repasseuse qui l'a encodé est absente.
  routeur.post('/:id/recuperer', authentifier, exigerRole('repasseuse'), async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const cur = await client.query(
        'SELECT statut FROM commande WHERE id_commande = $1 FOR UPDATE',
        [req.params.id]
      );
      if (cur.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Commande introuvable.' });
      }

      // Garde de transition (#228) : seule une commande « fait » peut être récupérée.
      if (!transitionValide(cur.rows[0].statut, 'recupere')) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: "Cette commande n'est pas prête à être remise." });
      }

      const maj = await client.query(
        `UPDATE commande SET statut='recupere', date_recuperation=now()
         WHERE id_commande=$1 AND statut='fait'
         RETURNING id_commande, id_client, statut, nombre_mannes, prioritaire, cintres_client,
                   cintres_entr_rendus, cintres_entr_nb, date_reception, date_recuperation,
                   id_repasseuse, repassage_debut, temps_repassage_s`,
        [req.params.id]
      );
      if (maj.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: "Cette commande n'est pas prête à être remise." });
      }

      // Le linge quitte l'étagère. Indispensable : l'invariant du #190 ne filtre pas sur le statut,
      // donc une commande récupérée qui garderait ses emplacements bloquerait l'étagère à vie.
      await client.query('DELETE FROM commande_emplacement WHERE id_commande=$1', [req.params.id]);

      // L'utilisatrice tracée est celle qui REMET, qui peut différer de celle qui a repassé.
      await client.query(
        `INSERT INTO historique_statut (id_commande, ancien_statut, nouveau_statut, id_utilisateur)
         VALUES ($1, 'fait', 'recupere', $2)`,
        [req.params.id, req.utilisateur.id_utilisateur]
      );

      await client.query('COMMIT');
      diffuserMaj(maj.rows[0].id_repasseuse);
      return res.json(maj.rows[0]);
    } catch {
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
