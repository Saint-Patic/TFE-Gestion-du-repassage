const bwipjs = require('bwip-js');
const PDFDocument = require('pdfkit');

const MM_VERS_PT = 2.834645669;

// Deux gabarits, parce que les deux étiquettes ne servent pas la même chose.
//
// - `client` : lue à bout de bras au comptoir, sur une carte qui reste des mois entre
//   les mains de la cliente. Nom et code-barres agrandis au #340, et le code répété en
//   clair sous le code-barres pour rester exploitable si les barres s'abîment.
// - `emplacement` : collée sur une étagère, scannée de près. Mise en page d'origine,
//   volontairement plus sobre : le code sert déjà de titre, le répéter en clair serait
//   un doublon, et il n'y a rien à lire à distance.
const GABARITS = {
  client: { tailleNomPt: 11, codeEnClair: true, etirerCodeBarre: true },
  emplacement: { tailleNomPt: 8, codeEnClair: false, etirerCodeBarre: false },
};

const TAILLE_CODE_PT = 8;
// Le nom est borné à deux lignes : sans cette limite, un nom long repousserait le
// code-barres jusqu'à ne plus lui laisser de place.
const MAX_LIGNES_NOM = 2;

function tailleEtiquette() {
  const l = Number(process.env.ETIQUETTE_L_MM || 50);
  const h = Number(process.env.ETIQUETTE_H_MM || 30);
  return [l * MM_VERS_PT, h * MM_VERS_PT];
}

// Génère un PDF d'étiquette (Buffer) : nom prénom + code-barres Code 128, selon le
// gabarit demandé (voir GABARITS ci-dessus).
async function generateEtiquette({ nom, prenom, code_barre, gabarit = 'client' }) {
  const modele = GABARITS[gabarit];
  if (!modele) {
    throw new Error(`Gabarit d'étiquette inconnu : « ${gabarit} ». Attendu : ${Object.keys(GABARITS).join(' ou ')}.`);
  }
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
    doc.fontSize(modele.tailleNomPt);
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

    // 2. Code-barres : toujours TOUTE la largeur utile — c'est la largeur des barres, et
    //    elle seule, qui conditionne le décodage d'un code 1D. La hauteur dépend du
    //    gabarit : `client` remplit tout l'espace restant (l'étirement vertical n'affecte
    //    pas la lecture et facilite la visée), `emplacement` conserve les proportions
    //    naturelles de l'image. Dans les deux cas la hauteur est PLAFONNÉE par la place
    //    disponible : c'est ce plafond qui empêche le débordement sur une seconde
    //    étiquette, que l'ancien calcul de rapport d'aspect provoquait (#340).
    const yCodeBarre = marge + hauteurNom + ecart;
    // Place réservée au code en clair : sa hauteur de ligne AVEC interligne, car c'est
    // celle que pdfkit utilise pour décider de changer de page. Rien à réserver si on
    // ne l'écrit pas.
    const placeCodeEnClair = modele.codeEnClair
      ? ecart + doc.fontSize(TAILLE_CODE_PT).currentLineHeight(true)
      : 0;
    const hauteurDispo = hauteur - yCodeBarre - placeCodeEnClair - marge;
    if (hauteurDispo <= 0) {
      throw new Error(
        `Étiquette trop petite (${largeur.toFixed(0)}×${hauteur.toFixed(0)} pt) : ` +
          `il ne reste aucune place pour le code-barres.`
      );
    }
    const img = doc.openImage(imageCodeBarre);
    const hauteurProportionnee = largeurUtile * (img.height / img.width);
    const hauteurCodeBarre = modele.etirerCodeBarre
      ? hauteurDispo
      : Math.min(hauteurDispo, hauteurProportionnee);
    doc.image(img, marge, yCodeBarre, { width: largeurUtile, height: hauteurCodeBarre });

    // 3. Code en clair, même écart sous le code-barres.
    if (modele.codeEnClair) {
      doc.text(code_barre, marge, yCodeBarre + hauteurCodeBarre + ecart, {
        width: largeurUtile,
        align: 'center',
      });
    }

    doc.end();
  });
}

module.exports = { generateEtiquette };
