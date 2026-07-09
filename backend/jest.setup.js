// Setup global exécuté avant chaque fichier de test.
// Secret JWT de test partagé (évite de le redéfinir dans chaque fichier).
process.env.JWT_SECRET = 'secret-de-test';
