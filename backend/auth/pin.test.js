const { hacherPin, verifierPin } = require('./pin');

test('un PIN correct est vérifié comme valide', async () => {
  const hache = await hacherPin('1234');
  expect(await verifierPin('1234', hache)).toBe(true);
});

test('un PIN incorrect est rejeté', async () => {
  const hache = await hacherPin('1234');
  expect(await verifierPin('0000', hache)).toBe(false);
});
