const express = require('express');
const authentifierPasserelle = require('../middlewares/authentifier-passerelle');

const LIMITE_DEFAUT = 10;
const LIMITE_MAX = 50;
const MAX_TENTATIVES = 5;

// Borne la limite demandée par la passerelle (défaut si absente ou non entière).
function normaliserLimite(valeur) {
  const n = Number.parseInt(valeur, 10);
  if (!Number.isInteger(n)) return LIMITE_DEFAUT;
  return Math.min(Math.max(n, 1), LIMITE_MAX);
}

// Fabrique : routeur de la file SMS, consommé par la passerelle Android (US #240).
// Le serveur ne joint jamais le téléphone : c'est la passerelle qui vient chercher le travail.
function creerRouteurSms(pool) {
  const routeur = express.Router();

  // Retire les SMS à envoyer, du plus ancien au plus récent (FIFO).
  // Le numéro n'est pas stocké dans la file : il est résolu ici par jointure (minimisation RGPD),
  // ce qui exclut au passage les clients anonymisés (téléphone vidé par le #100).
  routeur.get('/en-attente', authentifierPasserelle, async (req, res) => {
    try {
      const resultat = await pool.query(
        `SELECT s.id_sms, cl.telephone, s.message
         FROM sms_en_attente s
         JOIN commande c  ON c.id_commande = s.id_commande
         JOIN client   cl ON cl.id_client  = c.id_client
         WHERE s.statut = 'en_attente' AND cl.telephone <> ''
         ORDER BY s.date_creation ASC
         LIMIT $1`,
        [normaliserLimite(req.query.limite)]
      );
      return res.json(resultat.rows);
    } catch {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Accuse l'envoi. IDEMPOTENT : si le réseau coupe après l'envoi mais avant l'accusé,
  // la passerelle réessaiera l'accusé — répondre en erreur ferait repartir un SMS
  // déjà reçu par le client.
  routeur.post('/:id/envoye', authentifierPasserelle, async (req, res) => {
    try {
      const maj = await pool.query(
        `UPDATE sms_en_attente SET statut='envoye', date_envoi=now()
         WHERE id_sms=$1 AND statut='en_attente'
         RETURNING id_sms`,
        [req.params.id]
      );
      if (maj.rowCount === 1) return res.json({ ok: true });

      const existe = await pool.query('SELECT statut FROM sms_en_attente WHERE id_sms=$1', [req.params.id]);
      if (existe.rowCount === 0) return res.status(404).json({ message: 'SMS introuvable.' });
      if (existe.rows[0].statut === 'envoye') return res.json({ ok: true, deja: true });
      return res.status(409).json({ message: 'SMS abandonné après échecs répétés.' });
    } catch {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  // Signale un échec d'envoi : incrémente le compteur et abandonne au plafond,
  // pour qu'un numéro invalide ne bloque pas la file indéfiniment.
  routeur.post('/:id/echec', authentifierPasserelle, async (req, res) => {
    const { erreur } = req.body || {};
    const motif = typeof erreur === 'string' ? erreur.slice(0, 500) : null;
    try {
      const maj = await pool.query(
        `UPDATE sms_en_attente
         SET tentatives = tentatives + 1,
             derniere_erreur = $2,
             statut = CASE WHEN tentatives + 1 >= $3 THEN 'echec' ELSE 'en_attente' END
         WHERE id_sms = $1 AND statut = 'en_attente'
         RETURNING statut, tentatives`,
        [req.params.id, motif, MAX_TENTATIVES]
      );
      if (maj.rowCount === 1) return res.json(maj.rows[0]);

      const existe = await pool.query('SELECT statut FROM sms_en_attente WHERE id_sms=$1', [req.params.id]);
      if (existe.rowCount === 0) return res.status(404).json({ message: 'SMS introuvable.' });
      return res.status(409).json({ message: 'SMS déjà traité.' });
    } catch {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  return routeur;
}

module.exports = creerRouteurSms;
