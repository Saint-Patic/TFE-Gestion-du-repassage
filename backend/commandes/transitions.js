// Workflow linéaire des statuts d'une commande : a_faire → en_cours → fait → recupere.
// Chaque statut n'a qu'un seul suivant autorisé (pas de retour arrière, pas de saut).
const SUIVANT = {
  a_faire: 'en_cours',
  en_cours: 'fait',
  fait: 'recupere',
};

// Le passage `ancien → nouveau` est-il autorisé ?
function transitionValide(ancien, nouveau) {
  return SUIVANT[ancien] === nouveau;
}

// L'étape suivante autorisée pour `statut`, ou null (état terminal / statut inconnu).
function prochainStatut(statut) {
  return SUIVANT[statut] || null;
}

module.exports = { transitionValide, prochainStatut };
