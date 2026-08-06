const bwipjs = require('bwip-js');
const PDFDocument = require('pdfkit');

const MM_VERS_PT = 2.834645669;

// Tailles de la mise en page, en points. Relevées à la hausse au #340 après impression
// réelle : le nom et le code-barres d'origine se lisaient mal à bout de bras.
const TAILLE_NOM_PT = 11;
const TAILLE_CODE_PT = 8;
// Le nom est borné à deux lignes : sans cette limite, un nom long repousserait le
// code-barres jusqu'à ne plus lui laisser de place.
const MAX_LIGNES_NOM = 2;

function tailleEtiquette() {
  const l = Number(process.env.ETIQUETTE_L_MM || 50);
  const h = Number(process.env.ETIQUETTE_H_MM || 30);
  return [l * MM_VERS_PT, h * MM_VERS_PT];
}

// Génère un PDF d'étiquette (Buffer) : nom prénom + code-barres Code 128, et le code
// en clair dessous. Ce dernier se supprime par `afficherCodeEnClair: false` — utile
// pour un emplacement, dont le titre est déjà le code : la place libérée revient au
// code-barres, qui devient plus haut et donc plus facile à scanner.
async function generateEtiquette({ nom, prenom, code_barre, afficherCodeEnClair = true }) {
  const imageCodeBarre = await bwipjs.toBuffer({
    bcid: 'code128',
    text: code_barre,
    scale: 3,
    height: 10,
    includetext: false,
  });

  const marge = 4;
  const ecart = 4; // même écart nom→code-barres et code-barres→numéro
  const [largeur, hauteur] = tailleEtiquette();
  // Marge basse à 0 : une étiquette DOIT tenir sur une seule page, sinon
  // l'imprimante consomme deux étiquettes. C'est la marge basse qui déclenche la
  // pagination automatique de pdfkit ; on la neutralise et on réserve nous-mêmes
  // la place nécessaire, puisque toute la mise en page est positionnée à la main.
  const doc = new PDFDocument({
    size: [largeur, hauteur],
    margins: { top: marge, bottom: 0, left: marge, right: marge },
  });
  const morceaux = [];

  return await new Promise((resolve, reject) => {
    doc.on('data', (c) => morceaux.push(c));
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
    doc.on('error', reject);

    const largeurUtile = largeur - marge * 2;

    // 1. Nom prénom en haut, deux lignes au maximum, tronqué au-delà. On mesure la
    //    hauteur réellement occupée au lieu de réserver deux lignes d'office : un nom
    //    court laisse ainsi sa place au code-barres.
    doc.fontSize(TAILLE_NOM_PT);
    const texteNom = `${nom} ${prenom}`.trim();
    const hauteurNom = Math.min(
      doc.heightOfString(texteNom, { width: largeurUtile, align: 'center' }),
      doc.currentLineHeight(true) * MAX_LIGNES_NOM
    );
    doc.text(texteNom, marge, marge, {
      width: largeurUtile,
      align: 'center',
      height: hauteurNom,
      ellipsis: true,
    });

    // 2. Code-barres : TOUTE la largeur utile et TOUTE la hauteur restante, les deux
    //    dimensions fixées explicitement. Sur un code-barres 1D, seule la largeur des
    //    barres compte pour le décodage : l'étirer verticalement ne gêne pas le lecteur,
    //    et gagner en hauteur facilite la visée. Fixer les deux dimensions supprime au
    //    passage tout calcul de rapport d'aspect — c'est lui qui rendait la hauteur
    //    dépendante de la longueur du code et faisait déborder les codes courts sur une
    //    seconde étiquette (#340).
    const yCodeBarre = marge + hauteurNom + ecart;
    // Place réservée au code en clair : sa hauteur de ligne AVEC interligne, car c'est
    // celle que pdfkit utilise pour décider de changer de page. Rien à réserver si on
    // ne l'écrit pas.
    const placeCodeEnClair = afficherCodeEnClair
      ? ecart + doc.fontSize(TAILLE_CODE_PT).currentLineHeight(true)
      : 0;
    const hauteurCodeBarre = hauteur - yCodeBarre - placeCodeEnClair - marge;
    if (hauteurCodeBarre <= 0) {
      throw new Error(
        `Étiquette trop petite (${largeur.toFixed(0)}×${hauteur.toFixed(0)} pt) : ` +
          `il ne reste aucune place pour le code-barres.`
      );
    }
    doc.image(doc.openImage(imageCodeBarre), marge, yCodeBarre, {
      width: largeurUtile,
      height: hauteurCodeBarre,
    });

    // 3. Code en clair, même écart sous le code-barres.
    if (afficherCodeEnClair) {
      doc.text(code_barre, marge, yCodeBarre + hauteurCodeBarre + ecart, {
        width: largeurUtile,
        align: 'center',
      });
    }

    doc.end();
  });
}

module.exports = { generateEtiquette };
