const crypto = require('crypto');

// Alphabet base32 Crockford, sans I, L, O, U (évite la confusion à la lecture/scan).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LONGUEUR = 8;

// Génère un code-barres client aléatoire de 8 caractères base32 Crockford.
// 256 est multiple de 32 → le modulo n'introduit aucun biais.
function genererCodeBarre() {
  const octets = crypto.randomBytes(LONGUEUR);
  let code = '';
  for (let i = 0; i < LONGUEUR; i++) {
    code += ALPHABET[octets[i] % ALPHABET.length];
  }
  return code;
}

module.exports = { genererCodeBarre, ALPHABET, LONGUEUR };
