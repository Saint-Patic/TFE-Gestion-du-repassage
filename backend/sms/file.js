// Dépose un SMS dans la file d'attente (table sms_en_attente, US #240).
//
// `executeur` : tout objet exposant une méthode `query` — le pool pg, OU un client
// transactionnel issu de pool.connect(). C'est ce qui permet au #260 de déposer le SMS
// DANS LA MÊME TRANSACTION que le passage « en cours → fait ». Deux conséquences voulues :
// si la clôture échoue, aucun SMS n'est mis en file ; et comme la mise à jour du statut
// est conditionnée à `statut='en_cours'`, un second scan ne modifie aucune ligne et ne
// dépose rien — les doublons sont écartés par la machine à états, sans garde dédiée.
//
// Aucune erreur n'est rattrapée : une commande inexistante lève une violation de clé
// étrangère (23503) que l'appelant doit traiter dans sa transaction. L'avaler ici
// laisserait croire qu'un SMS est parti alors que non.
//
// `statut` n'est pas passé : la valeur par défaut 'en_attente' de la colonne s'applique.
async function mettreEnFileSms(executeur, idCommande, message) {
  const resultat = await executeur.query(
    `INSERT INTO sms_en_attente (id_commande, message)
     VALUES ($1, $2)
     RETURNING id_sms`,
    [idCommande, message]
  );
  return resultat.rows[0].id_sms;
}

module.exports = { mettreEnFileSms };
