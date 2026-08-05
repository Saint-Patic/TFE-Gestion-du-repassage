// Indicateurs de temps de repassage. Les moyennes sont une RÈGLE MÉTIER, pas de l'affichage :
// elles vivent ici, testées isolément, et le SQL ne fait que de l'agrégation.
//
// Division par zéro → 0, jamais NaN ni Infinity : une période sans commande est un cas normal,
// pas une erreur, et un NaN se propagerait jusqu'à l'écran.
function calculerIndicateurs({ nbCommandes = 0, tempsTotalS = 0, totalMannes = 0 }) {
  return {
    nbCommandes,
    tempsTotalS,
    totalMannes,
    moyenneParCommandeS: nbCommandes > 0 ? Math.round(tempsTotalS / nbCommandes) : 0,
    moyenneParManneS: totalMannes > 0 ? Math.round(tempsTotalS / totalMannes) : 0,
  };
}

module.exports = { calculerIndicateurs };
