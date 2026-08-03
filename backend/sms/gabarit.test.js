const { construireMessagePret } = require('./gabarit');

// Alphabet GSM 7 bits (3GPP TS 23.038). Tant que le message n'utilise que ces caractères,
// un SMS tient en 160 caractères. Un seul caractère hors table le fait basculer en UCS-2,
// où la capacité tombe à 70 caractères par segment.
const ALPHABET_GSM =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const EXTENSION_GSM = '^{}\\[~]|€';

function caracteresHorsGsm(message) {
  return [...new Set([...message])].filter(
    (c) => !ALPHABET_GSM.includes(c) && !EXTENSION_GSM.includes(c)
  );
}

describe('construireMessagePret (US #250)', () => {
  test('annonce que le linge est disponible et nomme le commerce', () => {
    const message = construireMessagePret();
    expect(message).toMatch(/linge/i);
    expect(message).toMatch(/disponible/i);
    expect(message).toMatch(/La Manne a Bulles/);
  });

  test("n'utilise que l'alphabet GSM (sinon la capacité tombe de 160 à 70)", () => {
    expect(caracteresHorsGsm(construireMessagePret())).toEqual([]);
  });

  test('tient en un seul segment SMS (≤ 160 caractères)', () => {
    expect([...construireMessagePret()].length).toBeLessThanOrEqual(160);
  });
});
