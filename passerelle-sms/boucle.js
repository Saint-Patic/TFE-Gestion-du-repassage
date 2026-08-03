// Traite une passe complète de la file : récupère, envoie EN SÉRIE, puis confirme ou signale.
// Toutes les dépendances sont injectées → testable sans réseau ni téléphone.
async function traiterUneFois({ api, envoyer, journal = console, limite = 10 }) {
  const enAttente = await api.recupererEnAttente(limite);
  let traites = 0;
  let echecs = 0;

  for (const sms of enAttente) {
    try {
      await envoyer(sms.telephone, sms.message);
      await api.confirmerEnvoye(sms.id_sms);
      traites += 1;
    } catch (err) {
      // Un numéro invalide ne doit pas bloquer les suivants : on signale et on continue.
      echecs += 1;
      journal.error(`Échec d'envoi du SMS ${sms.id_sms} : ${err.message}`);
      try {
        await api.signalerEchec(sms.id_sms, err.message);
      } catch (err2) {
        journal.error(`Échec du signalement pour ${sms.id_sms} : ${err2.message}`);
      }
    }
  }

  return { traites, echecs };
}

module.exports = { traiterUneFois };
