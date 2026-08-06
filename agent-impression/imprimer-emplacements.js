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

// Résume une exécution en annonçant le MODE de sortie. Dire « générée » sans dire
// « imprimée » laisse croire qu'une impression a eu lieu alors qu'on a seulement
// écrit un PDF sur le disque — confusion qui a coûté deux faux diagnostics.
function resumer(resultats) {
  const codes = resultats.map((r) => r.code).join(', ');
  const modes = [...new Set(resultats.map((r) => r.mode))];
  const mode = modes.length === 1 ? modes[0] : modes.join(' + ');
  if (mode === 'imprimante') {
    return `${resultats.length} étiquette(s) envoyée(s) à l'imprimante : ${codes}`;
  }
  return `${resultats.length} étiquette(s) écrite(s) sur disque, AUCUNE impression (MODE_SORTIE=${mode}) : ${codes}`;
}

module.exports = { imprimerEmplacements, resumer };

// Exécution directe : `node imprimer-emplacements.js A1G A1C B2D`
// Sans argument : imprime un petit lot de test.
if (require.main === module) {
  // Indispensable : ce script est un point d'entrée à part entière. Sans cette
  // ligne, MODE_SORTIE reste indéfini, sortie.js retombe sur « fichier » et rien
  // n'est jamais envoyé à l'imprimante, sans le moindre message d'erreur.
  require('dotenv').config();
  const args = process.argv.slice(2);
  const codes = args.length > 0 ? args : ['A1G', 'A1C', 'A1D'];
  imprimerEmplacements(codes)
    .then((r) => console.log(resumer(r)))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
