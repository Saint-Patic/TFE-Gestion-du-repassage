const { hacherPin, verifierPin, estFormatValide } = require('./pin');

describe('estFormatValide', () => {
  test.each(['0000', '1234', '9999'])('accepte un PIN de 4 chiffres : %s', (pin) => {
    expect(estFormatValide(pin)).toBe(true);
  });

  test.each([
    ['123 (trop court)', '123'],
    ['12345 (trop long)', '12345'],
    ['12a4 (lettre)', '12a4'],
    ['12.4 (point)', '12.4'],
    ['chaîne vide', ''],
    ['espace devant', ' 123'],
    ['espace au milieu', '12 4'],
    ['espace derrière', '123 '],
  ])('rejette %s', (_libelle, pin) => {
    expect(estFormatValide(pin)).toBe(false);
  });

  test.each([
    ['null', null],
    ['undefined', undefined],
    ['un nombre', 1234],
  ])('rejette une valeur non-chaîne : %s', (_libelle, valeur) => {
    expect(estFormatValide(valeur)).toBe(false);
  });
});

describe('hacherPin', () => {
  test('produit un hash bcrypt (préfixe $2b$, longueur 60)', async () => {
    const hache = await hacherPin('1234');
    expect(hache).toMatch(/^\$2[aby]\$/);
    expect(hache).toHaveLength(60);
  });

  test.each(['abc', '123', ''])('lève une erreur sur un format invalide : %s', async (pin) => {
    await expect(hacherPin(pin)).rejects.toThrow('4 chiffres');
  });

  test('deux hachages du même PIN sont différents mais tous deux valides (salage)', async () => {
    const hache1 = await hacherPin('1234');
    const hache2 = await hacherPin('1234');
    expect(hache1).not.toBe(hache2);
    expect(await verifierPin('1234', hache1)).toBe(true);
    expect(await verifierPin('1234', hache2)).toBe(true);
  });
});

describe('verifierPin', () => {
  test('retourne true pour le bon PIN', async () => {
    const hache = await hacherPin('1234');
    expect(await verifierPin('1234', hache)).toBe(true);
  });

  test('retourne false pour un mauvais PIN', async () => {
    const hache = await hacherPin('1234');
    expect(await verifierPin('0000', hache)).toBe(false);
  });

  test('retourne false (sans lever) si le PIN est mal formé', async () => {
    const hache = await hacherPin('1234');
    expect(await verifierPin('12', hache)).toBe(false);
  });

  test.each([
    ['null', null],
    ['undefined', undefined],
  ])('retourne false si le hash n\'est pas une chaîne : %s', async (_libelle, hache) => {
    expect(await verifierPin('1234', hache)).toBe(false);
  });
});
