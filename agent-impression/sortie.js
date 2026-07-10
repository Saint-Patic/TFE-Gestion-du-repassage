const fs = require('fs');
const path = require('path');

const DOSSIER_SORTIES = path.join(__dirname, 'sorties');

// Envoie le PDF selon MODE_SORTIE : 'fichier' (écrit sur disque) ou 'imprimante'.
async function envoyer(pdf, nomFichier) {
  const mode = process.env.MODE_SORTIE || 'fichier';
  fs.mkdirSync(DOSSIER_SORTIES, { recursive: true });
  const chemin = path.join(DOSSIER_SORTIES, `${nomFichier}.pdf`);
  fs.writeFileSync(chemin, pdf);

  if (mode === 'imprimante') {
    // require paresseux : le module Windows n'est chargé que dans cette branche.
    const { print } = require('pdf-to-printer');
    const options = process.env.NOM_IMPRIMANTE ? { printer: process.env.NOM_IMPRIMANTE } : {};
    await print(chemin, options);
    return { mode: 'imprimante' };
  }

  return { mode: 'fichier', chemin };
}

module.exports = { envoyer };
