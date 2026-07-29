const { genererEmplacements } = require('./emplacements');

describe('genererEmplacements', () => {
  const emplacements = genererEmplacements();

  test('produit 42 emplacements', () => {
    expect(emplacements).toHaveLength(42);
  });

  test('E n’a que gauche/droite (6 emplacements, aucun centre)', () => {
    const e = emplacements.filter((x) => x.etagere === 'E');
    expect(e).toHaveLength(6);
    expect(e.some((x) => x.position === 'centre')).toBe(false);
  });

  test('A/B/C/D ont 9 emplacements chacune', () => {
    for (const etagere of ['A', 'B', 'C', 'D']) {
      expect(emplacements.filter((x) => x.etagere === etagere)).toHaveLength(9);
    }
  });

  test('code_barre lisible : étagère+niveau+lettre-position', () => {
    const a1g = emplacements.find((x) => x.etagere === 'A' && x.niveau === 1 && x.position === 'gauche');
    const e3d = emplacements.find((x) => x.etagere === 'E' && x.niveau === 3 && x.position === 'droite');
    expect(a1g.code_barre).toBe('A1G');
    expect(e3d.code_barre).toBe('E3D');
  });

  test('tous les code_barre sont uniques', () => {
    const codes = emplacements.map((x) => x.code_barre);
    expect(new Set(codes).size).toBe(42);
  });
});
