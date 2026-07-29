const { imprimerEmplacements } = require('./imprimer-emplacements');

test('produit une sortie par code emplacement', async () => {
  const resultats = await imprimerEmplacements(['A1G', 'E3D']);
  expect(resultats).toHaveLength(2);
  expect(resultats.map((r) => r.code)).toEqual(['A1G', 'E3D']);
});
