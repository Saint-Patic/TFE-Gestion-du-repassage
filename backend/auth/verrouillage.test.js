const {
  enregistrerEchec,
  reinitialiser,
  etatVerrou,
  MAX_ECHECS,
} = require('./verrouillage');

test('verrouille après MAX_ECHECS échecs consécutifs', () => {
  const id = 'compte-a';
  for (let i = 0; i < MAX_ECHECS; i++) enregistrerEchec(id);
  expect(etatVerrou(id).verrouille).toBe(true);
  reinitialiser(id);
});

test("un compte sans échec n'est pas verrouillé", () => {
  expect(etatVerrou('compte-b').verrouille).toBe(false);
});
