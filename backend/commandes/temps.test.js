const { calculerTempsRepassageS } = require('./temps');

describe('calculerTempsRepassageS', () => {
  test('en pause (repassageDebut absent) → renvoie le cumul', () => {
    expect(calculerTempsRepassageS(120, null)).toBe(120);
    expect(calculerTempsRepassageS(0, undefined)).toBe(0);
  });

  test('en marche depuis 10 s, cumul 0 → 10', () => {
    const debut = new Date('2026-07-31T10:00:00Z');
    const maintenant = new Date('2026-07-31T10:00:10Z');
    expect(calculerTempsRepassageS(0, debut, maintenant)).toBe(10);
  });

  test('cumul non nul + 90 s en marche → 215', () => {
    const debut = new Date('2026-07-31T10:00:00Z');
    const maintenant = new Date('2026-07-31T10:01:30Z');
    expect(calculerTempsRepassageS(125, debut, maintenant)).toBe(215);
  });

  test('arrondi à la seconde inférieure (10,9 s → 10)', () => {
    const debut = new Date('2026-07-31T10:00:00.000Z');
    const maintenant = new Date('2026-07-31T10:00:10.900Z');
    expect(calculerTempsRepassageS(0, debut, maintenant)).toBe(10);
  });

  test('décalage d’horloge (maintenant < début) → segment 0', () => {
    const debut = new Date('2026-07-31T10:00:10Z');
    const maintenant = new Date('2026-07-31T10:00:05Z');
    expect(calculerTempsRepassageS(3, debut, maintenant)).toBe(3);
  });

  test('repassageDebut en chaîne ISO fonctionne', () => {
    const maintenant = new Date('2026-07-31T10:00:30Z');
    expect(calculerTempsRepassageS(0, '2026-07-31T10:00:00Z', maintenant)).toBe(30);
  });
});
