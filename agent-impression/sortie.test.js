const fs = require('fs');
const path = require('path');

const mockPrint = jest.fn().mockResolvedValue(undefined);
jest.mock('pdf-to-printer', () => ({ print: mockPrint }));

const { envoyer } = require('./sortie');

test('mode fichier écrit un PDF et renvoie le chemin', async () => {
  process.env.MODE_SORTIE = 'fichier';
  const pdf = Buffer.from('%PDF-1.4 test');
  const res = await envoyer(pdf, 'test-etiquette');
  expect(res.mode).toBe('fichier');
  expect(fs.existsSync(res.chemin)).toBe(true);
  fs.unlinkSync(res.chemin);
});

// Le pilote ITPP130 n'expose pas l'orientation : elle doit être imposée par le
// travail d'impression, sinon la MUNBYN sort l'étiquette en travers (#340).
test("mode imprimante impose l'orientation paysage et cible l'imprimante nommée", async () => {
  process.env.MODE_SORTIE = 'imprimante';
  process.env.NOM_IMPRIMANTE = 'Munbyn ITPP130';

  const res = await envoyer(Buffer.from('%PDF-1.4 test'), 'test-imprimante');

  expect(res.mode).toBe('imprimante');
  expect(mockPrint).toHaveBeenCalledTimes(1);
  const [, options] = mockPrint.mock.calls[0];
  expect(options).toMatchObject({ printer: 'Munbyn ITPP130', orientation: 'landscape' });

  fs.unlinkSync(path.join(__dirname, 'sorties', 'test-imprimante.pdf'));
  delete process.env.NOM_IMPRIMANTE;
  process.env.MODE_SORTIE = 'fichier';
});
