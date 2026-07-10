const fs = require('fs');
const { envoyer } = require('./sortie');

test('mode fichier écrit un PDF et renvoie le chemin', async () => {
  process.env.MODE_SORTIE = 'fichier';
  const pdf = Buffer.from('%PDF-1.4 test');
  const res = await envoyer(pdf, 'test-etiquette');
  expect(res.mode).toBe('fichier');
  expect(fs.existsSync(res.chemin)).toBe(true);
  fs.unlinkSync(res.chemin);
});
