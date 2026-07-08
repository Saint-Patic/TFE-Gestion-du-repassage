const bcrypt = require('bcrypt');

const COUT_BCRYPT = 10;
const FORMAT_PIN = /^\d{4}$/;

// Valide qu'un PIN est une chaîne d'exactement 4 chiffres.
function estFormatValide(pin) {
  return typeof pin === 'string' && FORMAT_PIN.test(pin);
}

// Hache un PIN avec bcrypt (sel intégré). Lève si le format est invalide.
async function hacherPin(pin) {
  if (!estFormatValide(pin)) {
    throw new Error('Le PIN doit contenir exactement 4 chiffres.');
  }
  return bcrypt.hash(pin, COUT_BCRYPT);
}

// Vérifie un PIN candidat contre un hash bcrypt. Retourne false si format/hash invalide.
async function verifierPin(pin, hache) {
  if (!estFormatValide(pin) || typeof hache !== 'string') {
    return false;
  }
  return bcrypt.compare(pin, hache);
}

module.exports = { hacherPin, verifierPin, estFormatValide };
