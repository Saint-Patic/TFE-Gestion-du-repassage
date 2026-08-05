const { diffuser, diffuserA } = require('./temps-reel');

// ⚠️ Ce fichier n'appelle JAMAIS initialiserTempsReel, et c'est tout son intérêt.
// `temps-reel.js` garde son instance io dans une variable de module ; le fichier
// temps-reel.integration.test.js l'initialise dans son beforeAll, donc la variable y est
// renseignée pour tous ses tests. Ces deux cas-ci ne peuvent donc pas y vivre.
// Jest isolant le registre de modules par fichier, on retrouve ici io = null.
//
// Ces gardes existent pour transformer une panne silencieuse — un événement diffusé
// dans le vide, une carte du Kanban qui ne bouge jamais chez la gérante — en échec
// bruyant au démarrage. Les tester, c'est vérifier que le garde-fou est bien armé.
describe("gardes d'initialisation de temps-reel (US #320)", () => {
  test('diffuser avant initialisation → lève', () => {
    expect(() => diffuser('commandes:maj', {})).toThrow(/Socket\.IO non initialisé/);
  });

  test('diffuserA avant initialisation → lève', () => {
    expect(() => diffuserA(['role:gerante'], 'commandes:maj', {})).toThrow(
      /Socket\.IO non initialisé/
    );
  });
});
