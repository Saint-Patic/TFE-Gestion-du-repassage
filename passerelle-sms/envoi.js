// Masque le numéro dans les journaux : on ne garde que les 4 derniers chiffres.
// Un journal de passerelle ne doit pas devenir un fichier de numéros de clientes.
function masquer(numero) {
  const s = String(numero);
  if (s.length <= 4) return '****';
  return '*'.repeat(s.length - 4) + s.slice(-4);
}

// Envoi réel via Termux:API, sur le téléphone Android muni de la SIM.
function envoyerParTermux(numero, message) {
  // require paresseux : child_process n'est chargé que dans la branche d'envoi réel,
  // comme pdf-to-printer dans l'agent d'impression (#80).
  const { execFile } = require('child_process');
  return new Promise((resoudre, rejeter) => {
    execFile('termux-sms-send', ['-n', numero, message], (err) => {
      if (err) return rejeter(new Error(`termux-sms-send a échoué : ${err.message}`));
      return resoudre();
    });
  });
}

// Fabrique : renvoie la fonction d'envoi correspondant au mode.
// 'console' (défaut) = simulation journalisée, développable et démontrable sans SIM ;
// 'sms' = envoi réel, activé au #340 sur le téléphone de l'atelier.
function creerEnvoyeur(mode = 'console', journal = console) {
  if (mode === 'console') {
    return async (numero, message) => {
      journal.log(`[simulation] SMS vers ${masquer(numero)} : ${message}`);
    };
  }
  if (mode === 'sms') {
    return (numero, message) => envoyerParTermux(numero, message);
  }
  throw new Error(`MODE_ENVOI inconnu : ${mode} (attendu 'console' ou 'sms').`);
}

module.exports = { creerEnvoyeur, masquer };
