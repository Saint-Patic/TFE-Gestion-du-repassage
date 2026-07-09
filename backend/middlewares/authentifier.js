const { verifierJeton } = require('../auth/jeton');

// Middleware : exige un jeton Bearer valide ; pose req.utilisateur ou répond 401.
function authentifier(req, res, next) {
  const entete = req.headers.authorization || '';
  const [schema, jeton] = entete.split(' ');

  if (schema !== 'Bearer' || !jeton) {
    return res.status(401).json({ message: 'Jeton manquant.' });
  }

  try {
    const charge = verifierJeton(jeton);
    req.utilisateur = {
      id_utilisateur: charge.sub,
      role: charge.role,
      session_debut: charge.session_debut,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Jeton invalide ou expiré.' });
  }
}

module.exports = authentifier;
