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

    doc.fontSize(8).text(`${nom} ${prenom}`, { align: 'center' });
    doc.image(imageCodeBarre, { fit: [largeur - 8, hauteur - 30], align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(7).text(code_barre, { align: 'center' });

    doc.end();
  });
}

module.exports = { generateEtiquette };
