// Gabarit du SMS annonçant à la cliente que son linge est prêt.
//
// ⚠️ Contrainte d'encodage : un SMS tient en 160 caractères tant qu'il n'utilise que
// l'alphabet GSM 7 bits. Un seul caractère hors table — « ê », « ç » minuscule,
// apostrophe typographique « ’ » — fait basculer TOUT le message en UCS-2, où la
// capacité tombe à 70 caractères, soit deux segments facturés au lieu d'un.
// C'est pourquoi la formulation dit « est disponible » et non « peut être récupéré ».
// Les tests de gabarit.test.js verrouillent cette contrainte : ne pas reformuler sans
// les relancer.
const MESSAGE_PRET = 'Bonjour, votre linge est disponible au local. Merci. La Manne a Bulles';

// Message envoyé quand une commande passe à « fait » (câblé au #260).
// Fonction plutôt que constante exportée : l'ajout ultérieur d'une mention de congés
// se fera par un argument optionnel, sans toucher aux appelants.
function construireMessagePret() {
  return MESSAGE_PRET;
}

module.exports = { construireMessagePret };
