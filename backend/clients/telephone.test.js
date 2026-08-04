const { normaliserTelephone, validerTelephone, estMobile } = require('./telephone');

describe('normaliserTelephone (US #270)', () => {
  test('retire les séparateurs de saisie', () => {
    expect(normaliserTelephone('0475 66 41 01')).toBe('0475664101');
    expect(normaliserTelephone('0475.66.41.01')).toBe('0475664101');
    expect(normaliserTelephone('0475-66-41-01')).toBe('0475664101');
  });

  test('ramène +32 au format national', () => {
    expect(normaliserTelephone('+32 475 66 41 01')).toBe('0475664101');
  });

  test('ramène 0032 au format national', () => {
    expect(normaliserTelephone('0032475664101')).toBe('0475664101');
  });

  test('valeur absente ou non textuelle → chaîne vide', () => {
    expect(normaliserTelephone(undefined)).toBe('');
    expect(normaliserTelephone(null)).toBe('');
  });
});

describe('validerTelephone (US #270)', () => {
  test('mobile à 10 chiffres → valide', () => {
    expect(validerTelephone('0475664101')).toBeNull();
  });

  test('fixe à 9 chiffres → valide (encodable, mais pas de SMS)', () => {
    expect(validerTelephone('068123456')).toBeNull();
  });

  test('fixe liégeois en 04 à 9 chiffres → valide', () => {
    expect(validerTelephone('042234567')).toBeNull();
  });

  test('numéro sans le zéro initial → refusé (le bug trouvé en recette)', () => {
    expect(validerTelephone('475664101')).toMatch(/invalide/i);
  });

  test('chaîne non numérique → refusée', () => {
    expect(validerTelephone('abcdefghij')).toMatch(/invalide/i);
  });
});

describe('estMobile (US #270)', () => {
  test('mobile → vrai', () => {
    expect(estMobile('0475664101')).toBe(true);
  });

  test('fixe liégeois, même préfixe 04 mais 9 chiffres → faux', () => {
    expect(estMobile('042234567')).toBe(false);
  });

  test('fixe 068 → faux', () => {
    expect(estMobile('068123456')).toBe(false);
  });
});
