const MAX_ECHECS = 5;
const DUREE_VERROU_MS = 60000;

// État en mémoire : id_utilisateur -> { echecs, verrouJusqua }.
// Non persistant : remis à zéro au redémarrage du serveur (limite connue).
const tentatives = new Map();

// Enregistre un échec ; au MAX_ECHECS-ième, pose un verrou temporaire.
function enregistrerEchec(id) {
  const entree = tentatives.get(id) || { echecs: 0, verrouJusqua: 0 };
  entree.echecs += 1;
  if (entree.echecs >= MAX_ECHECS) {
    entree.verrouJusqua = Date.now() + DUREE_VERROU_MS;
  }
  tentatives.set(id, entree);
}

// Réinitialise le compteur (appelé après un login réussi).
function reinitialiser(id) {
  tentatives.delete(id);
}

// Indique si le compte est verrouillé et le délai restant (secondes).
function etatVerrou(id) {
  const entree = tentatives.get(id);
  if (!entree) {
    return { verrouille: false, retryAfter: 0 };
  }
  if (entree.verrouJusqua && entree.verrouJusqua <= Date.now()) {
    // Le verrou a expiré : on repart d'une ardoise vierge.
    tentatives.delete(id);
    return { verrouille: false, retryAfter: 0 };
  }
  if (entree.verrouJusqua && entree.verrouJusqua > Date.now()) {
    const retryAfter = Math.ceil((entree.verrouJusqua - Date.now()) / 1000);
    return { verrouille: true, retryAfter };
  }
  return { verrouille: false, retryAfter: 0 };
}

module.exports = {
  enregistrerEchec,
  reinitialiser,
  etatVerrou,
  MAX_ECHECS,
  DUREE_VERROU_MS,
};
