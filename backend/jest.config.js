module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Glob global plutôt qu'une énumération de dossiers : c'est justement l'énumération,
  // figée au #65, qui a laissé neuf modules de règles métier échapper à la mesure pendant
  // des semaines. Avec un glob et des exclusions explicites, un module créé demain dans un
  // nouveau dossier est mesuré d'office.
  collectCoverageFrom: [
    '**/*.js',
    '!**/*.test.js',
    '!jest.config.js',
    '!jest.setup.js',
    '!coverage/**',
    // Exclusions assumées, et non oubliées :
    // - server.js : point d'entrée. Il charge dotenv, crée un pool et appelle listen.
    //   Le tester reviendrait à vérifier que dotenv lit un fichier et que pg ouvre une connexion.
    // - scripts/ : migrations et seeds à usage unique, déjà éprouvés par leur exécution
    //   idempotente sur le VPS. Aucune règle métier n'y vit.
    '!server.js',
    '!scripts/**',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
};
