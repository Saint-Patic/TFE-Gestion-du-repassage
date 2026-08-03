require('dotenv').config();
const { creerEnvoyeur } = require('./envoi');
const { creerApiSms } = require('./api');
const { traiterUneFois } = require('./boucle');

const urlApi = process.env.URL_API || 'http://localhost:3000';
const jeton = process.env.JETON_PASSERELLE;
const intervalleMs = Number(process.env.INTERVALLE_MS) || 30000;
const mode = process.env.MODE_ENVOI || 'console';
const limite = Number(process.env.LIMITE_SMS) || 10;

if (!jeton) {
  console.error('JETON_PASSERELLE manquant : la passerelle ne peut pas démarrer.');
  process.exit(1);
}

const api = creerApiSms({ urlApi, jeton });
const envoyer = creerEnvoyeur(mode);

// Une passe qui échoue (VPS injoignable, Wi-Fi coupé) est journalisée sans faire tomber
// le processus : la file vit côté serveur, rien n'est perdu, on retentera au tick suivant.
async function tick() {
  try {
    const { traites, echecs } = await traiterUneFois({ api, envoyer, limite });
    if (traites || echecs) {
      console.log(`Passe terminée : ${traites} envoyé(s), ${echecs} échec(s).`);
    }
  } catch (err) {
    console.error(`Passe impossible : ${err.message}`);
  }
}

console.log(`Passerelle SMS démarrée (mode ${mode}, toutes les ${intervalleMs} ms) → ${urlApi}`);
tick();
setInterval(tick, intervalleMs);
