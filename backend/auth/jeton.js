const jwt = require('jsonwebtoken');

const DUREE_ACCES_S = 3600; // 1h
const PLAFOND_SESSION_S = 43200; // 12h

// Lit le secret au moment de l'usage (pas au chargement) pour rester testable.
function secret() {
  const valeur = process.env.JWT_SECRET;
  if (!valeur) {
    throw new Error('JWT_SECRET manquant.');
  }
  return valeur;
}

// Signe un JWT d'accès (expiration = maintenant + DUREE_ACCES_S).
function signerJeton({ id_utilisateur, role, session_debut }) {
  return jwt.sign(
    { sub: id_utilisateur, role, session_debut },
    secret(),
    { expiresIn: DUREE_ACCES_S }
  );
}

// Vérifie et décode un JWT ; lève si signature/expiration invalide.
function verifierJeton(jeton) {
  return jwt.verify(jeton, secret());
}

module.exports = { signerJeton, verifierJeton, DUREE_ACCES_S, PLAFOND_SESSION_S };
