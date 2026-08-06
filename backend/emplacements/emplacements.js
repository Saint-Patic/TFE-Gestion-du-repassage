// Lettre de position pour le code-barres lisible.
const LETTRE_POSITION = { gauche: 'G', centre: 'C', droite: 'D' };

// Génère les 54 emplacements physiques. Les quatre grandes étagères ont 4 étages et
// 3 positions (12 cases) ; la petite, E, n'a que 3 étages et 2 positions (6 cases).
const NB_NIVEAUX = { A: 4, B: 4, C: 4, D: 4, E: 3 };

function genererEmplacements() {
  const emplacements = [];
  for (const etagere of ['A', 'B', 'C', 'D', 'E']) {
    const positions = etagere === 'E' ? ['gauche', 'droite'] : ['gauche', 'centre', 'droite'];
    for (let niveau = 1; niveau <= NB_NIVEAUX[etagere]; niveau++) {
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
