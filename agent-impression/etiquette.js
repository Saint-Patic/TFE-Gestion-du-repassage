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

  const [largeur, hauteur] = tailleEtiquette();
  const doc = new PDFDocument({ size: [largeur, hauteur], margin: 4 });
  const morceaux = [];

  return await new Promise((resolve, reject) => {
    doc.on('data', (c) => morceaux.push(c));
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
    doc.on('error', reject);

    const marge = 4;
    const ecart = 4; // même écart nom→code-barres et code-barres→numéro

    // 1. Nom prénom en haut.
    doc.fontSize(8).text(`${nom} ${prenom}`, { align: 'center' });
    const basNom = doc.y;

    // 2. Code-barres sous le nom, mis à l'échelle sur la largeur dispo.
    const largeurUtile = largeur - marge * 2;
    const img = doc.openImage(imageCodeBarre);
    const hauteurCodeBarre = (img.height / img.width) * largeurUtile;
    const yCodeBarre = basNom + ecart;
    doc.image(img, marge, yCodeBarre, { width: largeurUtile });

    // 3. Code en clair, même écart sous le code-barres.
    doc.fontSize(7).text(code_barre, marge, yCodeBarre + hauteurCodeBarre + ecart, {
      width: largeurUtile,
      align: 'center',
    });

    doc.end();
  });
}

module.exports = { generateEtiquette };
