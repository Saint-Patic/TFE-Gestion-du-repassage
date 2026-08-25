// Formats de téléphone belges.
//
// ⚠️ C'est la LONGUEUR qui distingue mobile et fixe, jamais le seul préfixe : « 04 » est à la
// fois l'indicatif des mobiles ET celui de Liège. `04 223 45 67` (9 chiffres) est un fixe,
// `0475 66 41 01` (10 chiffres) un mobile. Tous les fixes belges font 9 chiffres.
const MOBILE = /^04\d{8}$/;
const FIXE = /^0\d{8}$/;

// Retire les séparateurs de saisie et ramène un préfixe international au format national.
// On ne convertit JAMAIS vers +32 : la recette du #270 a montré que ce format ne passe pas
// avec termux-sms-send sur le téléphone de l'atelier.
function normaliserTelephone(brut) {
  if (typeof brut !== 'string') return '';
  const compact = brut.replace(/[\s.\-()/]/g, '');
  if (compact.startsWith('+32')) return '0' + compact.slice(3);
  if (compact.startsWith('0032')) return '0' + compact.slice(4);
  return compact;
}

// Valide un numéro DÉJÀ normalisé. Renvoie un message ou null.
// Les fixes sont acceptés : ces clients sont encodables et seront appelés manuellement.
function validerTelephone(normalise) {
  if (MOBILE.test(normalise) || FIXE.test(normalise)) return null;
  return 'Numéro belge invalide : 10 chiffres pour un mobile (0475…), 9 pour un fixe (068…).';
}

// Un SMS ne peut partir que vers un mobile.
function estMobile(normalise) {
  return MOBILE.test(normalise);
}

module.exports = { normaliserTelephone, validerTelephone, estMobile };
