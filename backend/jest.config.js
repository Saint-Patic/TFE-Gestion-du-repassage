module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'auth/**/*.js',
    'middlewares/**/*.js',
    'routes/**/*.js',
    'app.js',
    'temps-reel.js',
    '!**/*.test.js',
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
