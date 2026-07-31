// Calcule le temps de repassage total en secondes (hors pauses).
// tempsCumuleS   : secondes déjà cumulées (hors segment courant).
// repassageDebut : début du segment en cours (Date | chaîne ISO | null/undefined = en pause).
// maintenant     : Date (défaut : maintenant).
function calculerTempsRepassageS(tempsCumuleS, repassageDebut, maintenant = new Date()) {
  const cumul = Number(tempsCumuleS) || 0;
  if (!repassageDebut) return cumul;
  const debutMs = new Date(repassageDebut).getTime();
  const segment = Math.max(0, Math.floor((maintenant.getTime() - debutMs) / 1000));
  return cumul + segment;
}

module.exports = { calculerTempsRepassageS };
