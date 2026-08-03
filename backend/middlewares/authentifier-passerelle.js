const crypto = require('crypto');

// Compare deux chaînes en temps constant : évite de fuiter le secret par chronométrage
// (une comparaison ordinaire s'arrête au premier caractère différent).
function egalTempsConstant(a, b) {
  const tamponA = Buffer.from(a, 'utf8');
  const tamponB = Buffer.from(b, 'utf8');
  if (tamponA.length !== tamponB.length) return false;
  return crypto.timingSafeEqual(tamponA, tamponB);
}

// Authentifie la passerelle SMS par jeton dédié (JETON_PASSERELLE), et non par session
// utilisatrice : c'est une machine, elle n'a ni PIN ni plafond de session de 12 h.
// Si la variable est absente, on refuse tout : une variable oubliée ne doit jamais
// transformer ces routes en endpoints publics.
function authentifierPasserelle(req, res, next) {
  const refus = () => res.status(401).json({ message: 'Authentification passerelle requise.' });

  const attendu = process.env.JETON_PASSERELLE;
  if (!attendu) return refus();

  const entete = req.headers.authorization || '';
  if (!entete.startsWith('Bearer ')) return refus();

  if (!egalTempsConstant(entete.slice(7), attendu)) return refus();

  return next();
}

module.exports = authentifierPasserelle;
