const { imprimerEmplacements, resumer } = require('./imprimer-emplacements');

test('produit une sortie par code emplacement', async () => {
  const resultats = await imprimerEmplacements(['A1G', 'E3D']);
  expect(resultats).toHaveLength(2);
  expect(resultats.map((r) => r.code)).toEqual(['A1G', 'E3D']);
});

// « Étiquette générée » ne doit jamais pouvoir se lire comme « étiquette imprimée » :
// l'ambiguïté du message a fait chercher un défaut d'imprimante inexistant (#340).
test('le résumé annonce une impression en mode imprimante', () => {
  expect(resumer([{ code: 'A1G', mode: 'imprimante' }])).toContain('imprimante');
});

test('le résumé dit explicitement qu_aucune impression n_a eu lieu en mode fichier', () => {
  const message = resumer([{ code: 'A1G', mode: 'fichier', chemin: '/tmp/A1G.pdf' }]);
  expect(message).toContain('AUCUNE impression');
});
