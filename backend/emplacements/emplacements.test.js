const { genererEmplacements } = require('./emplacements');

describe('genererEmplacements', () => {
  const emplacements = genererEmplacements();

  test('produit 54 emplacements', () => {
    expect(emplacements).toHaveLength(54);
  });

  test('E n’a que gauche/droite (6 emplacements, aucun centre)', () => {
    const e = emplacements.filter((x) => x.etagere === 'E');
    expect(e).toHaveLength(6);
    expect(e.some((x) => x.position === 'centre')).toBe(false);
  });

  test('A/B/C/D ont 4 étages, soit 12 emplacements chacune', () => {
    for (const etagere of ['A', 'B', 'C', 'D']) {
      const cases = emplacements.filter((x) => x.etagere === etagere);
      expect(cases).toHaveLength(12);
      expect(Math.max(...cases.map((x) => x.niveau))).toBe(4);
    }
  });

  // La petite étagère n'a que 3 étages : c'est la régression la plus probable si
  // quelqu'un uniformise la boucle des niveaux.
  test('E n’a pas de 4ᵉ étage', () => {
    const e = emplacements.filter((x) => x.etagere === 'E');
    expect(Math.max(...e.map((x) => x.niveau))).toBe(3);
    expect(e.some((x) => x.code_barre.startsWith('E4'))).toBe(false);
  });

  test('code_barre lisible : étagère+niveau+lettre-position', () => {
    const a1g = emplacements.find((x) => x.etagere === 'A' && x.niveau === 1 && x.position === 'gauche');
    const a4d = emplacements.find((x) => x.etagere === 'A' && x.niveau === 4 && x.position === 'droite');
    const e3d = emplacements.find((x) => x.etagere === 'E' && x.niveau === 3 && x.position === 'droite');
    expect(a1g.code_barre).toBe('A1G');
    expect(a4d.code_barre).toBe('A4D');
    expect(e3d.code_barre).toBe('E3D');
  });

  test('tous les code_barre sont uniques', () => {
    const codes = emplacements.map((x) => x.code_barre);
    expect(new Set(codes).size).toBe(54);
  });
});
