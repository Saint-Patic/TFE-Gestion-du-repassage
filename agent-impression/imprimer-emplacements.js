const { generateEtiquette } = require('./etiquette');
const { envoyer } = require('./sortie');

// Génère (ou imprime, selon MODE_SORTIE) une étiquette par code emplacement.
// Réutilise la mise en page client : le code sert de titre ET de code-barres.
async function imprimerEmplacements(codes) {
  const resultats = [];
  for (const code of codes) {
    const pdf = await generateEtiquette({ nom: code, prenom: '', code_barre: code });
    const sortie = await envoyer(pdf, `emplacement-${code}`);
    resultats.push({ code, ...sortie });
  }
  return resultats;
}

module.exports = { imprimerEmplacements };

// Exécution directe : `node imprimer-emplacements.js A1G A1C B2D`
// Sans argument : imprime un petit lot de test.
if (require.main === module) {
  const args = process.argv.slice(2);
  const codes = args.length > 0 ? args : ['A1G', 'A1C', 'A1D'];
  imprimerEmplacements(codes)
    .then((r) => console.log(`Étiquettes emplacement générées : ${r.map((x) => x.code).join(', ')}`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
