// Lettre de position pour le code-barres lisible.
const LETTRE_POSITION = { gauche: 'G', centre: 'C', droite: 'D' };

// Génère les 42 emplacements physiques (A–D : 3 positions ; E : 2 positions).
function genererEmplacements() {
  const emplacements = [];
  for (const etagere of ['A', 'B', 'C', 'D', 'E']) {
    const positions = etagere === 'E' ? ['gauche', 'droite'] : ['gauche', 'centre', 'droite'];
    for (let niveau = 1; niveau <= 3; niveau++) {
      for (const position of positions) {
        emplacements.push({
          etagere,
          niveau,
          position,
          code_barre: `${etagere}${niveau}${LETTRE_POSITION[position]}`,
        });
      }
    }
  }
  return emplacements;
}

module.exports = { genererEmplacements };
