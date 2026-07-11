// Factory : renvoie un middleware qui n'autorise que les rôles listés.
// À placer APRÈS `authentifier` (qui pose req.utilisateur.role).
function exigerRole(...roles) {
  return (req, res, next) => {
    if (!req.utilisateur) {
      return res.status(401).json({ message: 'Authentification requise.' });
    }
    if (!roles.includes(req.utilisateur.role)) {
      return res.status(403).json({ message: 'Accès réservé.' });
    }
    return next();
  };
}

module.exports = exigerRole;
