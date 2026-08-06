const bwipjs = require('bwip-js');
const PDFDocument = require('pdfkit');

const MM_VERS_PT = 2.834645669;

function tailleEtiquette() {
  const l = Number(process.env.ETIQUETTE_L_MM || 50);
  const h = Number(process.env.ETIQUETTE_H_MM || 30);
  return [l * MM_VERS_PT, h * MM_VERS_PT];
}

// Génère un PDF d'étiquette (Buffer) : nom prénom + code-barres Code 128 + code en clair.
async function generateEtiquette({ nom, prenom, code_barre }) {
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

    // 1. Nom prénom en haut.
    doc.fontSize(8).text(`${nom} ${prenom}`, { align: 'center' });
    const basNom = doc.y;

    // 2. Code-barres sous le nom, CONTENU dans la place restante (jamais étiré).
    //    bwip-js produit une image de hauteur fixe dont la largeur croît avec le
    //    nombre de caractères : l'étirer sur toute la largeur utile rendait un code
    //    court (emplacement « A1G ») deux fois plus haut qu'un code client, le code
    //    en clair passait à la page suivante et l'imprimante sortait DEUX étiquettes.
    //    On retient donc le facteur d'échelle le plus contraignant des deux.
    const largeurUtile = largeur - marge * 2;
    const img = doc.openImage(imageCodeBarre);
    const yCodeBarre = basNom + ecart;
    // Hauteur de ligne AVEC interligne : c'est celle que pdfkit utilise pour
    // décider de changer de page, donc celle qu'il faut réserver.
    const hauteurTexteCode = doc.fontSize(7).currentLineHeight(true);
    const hauteurDispo = hauteur - yCodeBarre - ecart - hauteurTexteCode - marge;
    const echelle = Math.min(largeurUtile / img.width, hauteurDispo / img.height);
    const largeurCodeBarre = img.width * echelle;
    const hauteurCodeBarre = img.height * echelle;
    doc.image(img, (largeur - largeurCodeBarre) / 2, yCodeBarre, { width: largeurCodeBarre });

    // 3. Code en clair, même écart sous le code-barres.
    doc.text(code_barre, marge, yCodeBarre + hauteurCodeBarre + ecart, {
      width: largeurUtile,
      align: 'center',
    });

    doc.end();
  });
}

module.exports = { generateEtiquette };
