const { genererCodeBarre, ALPHABET, LONGUEUR } = require('./code-barre');

test('génère un code de la longueur attendue', () => {
  expect(genererCodeBarre()).toHaveLength(LONGUEUR);
});

test("n'utilise que l'alphabet Crockford (pas de I/L/O/U)", () => {
  const code = genererCodeBarre();
  for (const c of code) {
    expect(ALPHABET).toContain(c);
  }
  expect(code).not.toMatch(/[ILOU]/);
});

test('produit des valeurs distinctes sur plusieurs appels', () => {
  const codes = new Set();
  for (let i = 0; i < 100; i++) codes.add(genererCodeBarre());
  expect(codes.size).toBeGreaterThan(90);
});
