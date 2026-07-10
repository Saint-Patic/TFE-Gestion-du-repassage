const { generateEtiquette } = require('./etiquette');

test('génère un PDF valide (commence par %PDF)', async () => {
  const pdf = await generateEtiquette({ nom: 'Dupont', prenom: 'Marie', code_barre: 'CLI-0001' });
  expect(pdf.length).toBeGreaterThan(0);
  expect(pdf.slice(0, 4).toString()).toBe('%PDF');
});
