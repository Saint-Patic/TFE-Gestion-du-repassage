const express = require('express');
const authentifier = require('../middlewares/authentifier');
const exigerRole = require('../middlewares/exiger-role');
const { genererCodeBarre } = require('../clients/code-barre');
const { normaliserTelephone, validerTelephone } = require('../clients/telephone');

const MAX_TENTATIVES = 5;

// Valide les champs client (partagé création/modification). Renvoie un message ou null.
// Valide un client. `telephone` doit être DÉJÀ normalisé : c'est l'appelant qui normalise,
// pour pouvoir stocker exactement la valeur qu'il a validée.
function validerClient({ nom, prenom, telephone, email }) {
  if (!nom || !prenom || !telephone) return 'nom, prenom et telephone sont requis.';
  if (nom.length > 100 || prenom.length > 100 || telephone.length > 20) {
    return 'Un champ dépasse la longueur autorisée.';
  }
  const erreurTelephone = validerTelephone(telephone);
  if (erreurTelephone) return erreurTelephone;
  if (email && (email.length > 255 || !email.includes('@'))) return 'Email invalide.';
  return null;
}

// Fabrique : routeur clients alimenté par le pool pg fourni.
function creerRouteurClients(pool) {
  const routeur = express.Router();

  // Liste des clients (recherche/filtrage fait côté frontend).
  routeur.get('/', authentifier, exigerRole('gerante'), async (req, res) => {
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

  // Recherche un client par son code-barres (encodage). Accès gérante + repasseuse.
  routeur.get('/code-barre/:code', authentifier, exigerRole('gerante', 'repasseuse'), async (req, res) => {
    try {
      const resultat = await pool.query(
        `SELECT id_client, nom, prenom, telephone, email, code_barre, date_creation
         FROM client WHERE code_barre = $1`,
        [req.params.code]
      );
      if (resultat.rowCount === 0) {
        return res.status(404).json({ message: 'Client inconnu.' });
      }
      return res.json(resultat.rows[0]);
    } catch (err) {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Historique complet des commandes d'une cliente, avec la chronologie de leurs changements de
  // statut. Outil de la gérante pour répondre à une contestation (#290) : c'est ici que la table
  // historique_statut, écrite depuis le #220, est enfin lue.
  routeur.get('/:id/historique', authentifier, exigerRole('gerante'), async (req, res) => {
    try {
      const client = await pool.query(
        'SELECT id_client, nom, prenom FROM client WHERE id_client = $1',
        [req.params.id]
      );
      if (client.rowCount === 0) {
        return res.status(404).json({ message: 'Client introuvable.' });
      }

      const commandes = await pool.query(
        `SELECT id_commande, statut, nombre_mannes, prioritaire, cintres_client, cintres_entr_rendus,
                cintres_entr_nb, temps_repassage_s, date_reception, date_recuperation
         FROM commande
         WHERE id_client = $1
         ORDER BY date_reception DESC`,
        [req.params.id]
      );
      if (commandes.rowCount === 0) {
        return res.json({ client: client.rows[0], commandes: [] });
      }

      // UNE seule requête pour TOUS les événements : ni jointure dupliquante, ni N+1.
      const ids = commandes.rows.map((c) => c.id_commande);
      const evenements = await pool.query(
        `SELECT h.id_commande, h.ancien_statut, h.nouveau_statut, h.horodatage, u.nom AS utilisateur
         FROM historique_statut h
         JOIN utilisateur u ON u.id_utilisateur = h.id_utilisateur
         WHERE h.id_commande = ANY($1)
         ORDER BY h.horodatage ASC`,
        [ids]
      );

      const parCommande = new Map(ids.map((id) => [id, []]));
      for (const e of evenements.rows) {
        parCommande.get(e.id_commande).push({
          ancien_statut: e.ancien_statut,
          nouveau_statut: e.nouveau_statut,
          horodatage: e.horodatage,
          utilisateur: e.utilisateur,
        });
      }

      return res.json({
        client: client.rows[0],
        commandes: commandes.rows.map((c) => ({ ...c, evenements: parCommande.get(c.id_commande) })),
      });
    } catch {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Crée un client + code-barres unique. Bearer requis (rôle géré plus tard, #110).
  routeur.post('/', authentifier, exigerRole('gerante'), async (req, res) => {
    const { nom, prenom, telephone, email } = req.body || {};
    const telephoneNormalise = normaliserTelephone(telephone);
    const erreur = validerClient({ nom, prenom, telephone: telephoneNormalise, email });
    if (erreur) return res.status(400).json({ message: erreur });

    // Réessai si collision de code_barre (contrainte UNIQUE → code Postgres 23505).
    for (let tentative = 0; tentative < MAX_TENTATIVES; tentative++) {
      const code_barre = genererCodeBarre();
      try {
        const resultat = await pool.query(
          `INSERT INTO client (nom, prenom, telephone, email, code_barre)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id_client, nom, prenom, telephone, email, code_barre, date_creation`,
          [nom, prenom, telephoneNormalise, email || null, code_barre]
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
  routeur.put('/:id', authentifier, exigerRole('gerante'), async (req, res) => {
    const { nom, prenom, telephone, email } = req.body || {};
    const telephoneNormalise = normaliserTelephone(telephone);
    const erreur = validerClient({ nom, prenom, telephone: telephoneNormalise, email });
    if (erreur) return res.status(400).json({ message: erreur });
    try {
      const resultat = await pool.query(
        `UPDATE client SET nom=$1, prenom=$2, telephone=$3, email=$4
         WHERE id_client=$5
         RETURNING id_client, nom, prenom, telephone, email, code_barre, date_creation`,
        [nom, prenom, telephoneNormalise, email || null, req.params.id]
      );
      if (resultat.rowCount === 0) {
        return res.status(404).json({ message: 'Client introuvable.' });
      }
      return res.json(resultat.rows[0]);
    } catch (err) {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Supprime DÉFINITIVEMENT une cliente. Ses commandes passées sont DÉTACHÉES (id_client → NULL),
  // jamais supprimées : la requête des statistiques (#300) ne joint pas `client`, les chiffres
  // restent donc exacts, alors qu'une cascade aurait fait disparaître les lignes de
  // historique_statut sur lesquelles elle s'ancre.
  //
  // Refus tant qu'il reste des commandes non récupérées : le linge est alors physiquement dans
  // l'atelier, et le Kanban ne doit jamais afficher une carte active sans cliente.
  //
  // La variable de connexion s'appelle `connexion` et non `client` comme ailleurs : ici `client`
  // désigne déjà le domaine métier, le contresens serait permanent.
  routeur.delete('/:id', authentifier, exigerRole('gerante'), async (req, res) => {
    let connexion;
    try {
      connexion = await pool.connect();
      await connexion.query('BEGIN');

      // FOR UPDATE : ce verrou entre en conflit avec le FOR KEY SHARE que prend le contrôle de clé
      // étrangère d'un INSERT INTO commande concurrent. Sans lui, une repasseuse pourrait encoder
      // une commande depuis sa tablette entre le comptage et la suppression, et on laisserait une
      // commande active orpheline. Avec lui, son encodage attend puis échoue proprement en 23503,
      // cas déjà traité par POST /commandes (400).
      const existe = await connexion.query(
        'SELECT id_client FROM client WHERE id_client=$1 FOR UPDATE',
        [req.params.id]
      );
      if (existe.rowCount === 0) {
        await connexion.query('ROLLBACK');
        return res.status(404).json({ message: 'Client introuvable.' });
      }

      // Le workflow n'a que quatre statuts : <> 'recupere' couvre exactement a_faire, en_cours, fait.
      const actives = await connexion.query(
        "SELECT count(*)::int AS nb FROM commande WHERE id_client=$1 AND statut <> 'recupere'",
        [req.params.id]
      );
      const nbActives = actives.rows[0].nb;
      if (nbActives > 0) {
        await connexion.query('ROLLBACK');
        return res.status(409).json({
          message: `${nbActives} commande(s) non récupérée(s) : terminez la remise avant de supprimer.`,
          commandes_actives: nbActives,
        });
      }

      const detachees = await connexion.query(
        'UPDATE commande SET id_client = NULL WHERE id_client = $1',
        [req.params.id]
      );
      await connexion.query('DELETE FROM client WHERE id_client = $1', [req.params.id]);

      await connexion.query('COMMIT');
      return res.json({ supprime: true, commandes_detachees: detachees.rowCount });
    } catch {
      if (connexion) await connexion.query('ROLLBACK').catch(() => {});
      return res.status(500).json({ message: 'Erreur serveur.' });
    } finally {
      if (connexion) connexion.release();
    }
  });

  return routeur;
}

module.exports = creerRouteurClients;
