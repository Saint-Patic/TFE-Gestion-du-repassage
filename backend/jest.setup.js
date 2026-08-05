// Setup global exécuté avant chaque fichier de test.
// Secret JWT de test partagé (évite de le redéfinir dans chaque fichier).
process.env.JWT_SECRET = 'secret-de-test';

// Force le nom de la base vers une base de test, et refuse toute autre valeur.
// Chargé ici — donc pour TOUTES les suites, y compris les rapides qui ne se connectent à
// rien : le résultat est qu'aucun test du projet ne peut atteindre la base de recette.
require('./tests-base/config-base');
