const { generateEtiquette } = require('./etiquette');

// Compte les pages d'un PDF : un objet /Type /Page par page ( /Pages exclu ).
function compterPages(pdf) {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
}

test('génère un PDF valide (commence par %PDF)', async () => {
  const pdf = await generateEtiquette({ nom: 'Dupont', prenom: 'Marie', code_barre: 'CLI-0001' });
  expect(pdf.length).toBeGreaterThan(0);
  expect(pdf.slice(0, 4).toString()).toBe('%PDF');
});

// Une page = une étiquette. Un code court donne une image de code-barres étroite :
// l'étirer sur toute la largeur la rendait si haute que le code en clair passait
// à la page suivante, donc sur une SECONDE étiquette (constaté à l'impression, #340).
test('un code court tient sur une seule page', async () => {
  const pdf = await generateEtiquette({ nom: 'A1G', prenom: '', code_barre: 'A1G' });
  expect(compterPages(pdf)).toBe(1);
});

test('un code long tient sur une seule page', async () => {
  const pdf = await generateEtiquette({ nom: 'Dupont', prenom: 'Marie', code_barre: 'ABCD2345' });
  expect(compterPages(pdf)).toBe(1);
});
