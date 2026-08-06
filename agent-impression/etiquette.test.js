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

// Un nom long ne doit ni déborder sur une seconde étiquette, ni écraser le code-barres :
// le texte est borné à deux lignes et tronqué au-delà.
test('un nom très long tient sur une seule page', async () => {
  const pdf = await generateEtiquette({
    nom: 'Vandenberghe-Delacroix',
    prenom: 'Marie-Christine Josephine',
    code_barre: 'ABCD2345',
  });
  expect(compterPages(pdf)).toBe(1);
});

// Sur une étiquette d'emplacement, le titre EST déjà le code : le répéter en clair
// sous le code-barres est une redondance. Un PDF sans ce texte est plus léger.
test('le gabarit emplacement n’écrit pas le code en clair', async () => {
  const commun = { nom: 'A1G', prenom: '', code_barre: 'A1G' };
  const client = await generateEtiquette(commun);
  const emplacement = await generateEtiquette({ ...commun, gabarit: 'emplacement' });
  expect(emplacement.length).toBeLessThan(client.length);
  expect(compterPages(emplacement)).toBe(1);
});

// Les deux gabarits ne doivent pas être ramenés à un seul : l'étiquette cliente a été
// agrandie au #340, celle d'un emplacement devait garder sa mise en page d'origine.
test('les deux gabarits produisent des mises en page différentes', async () => {
  const commun = { nom: 'A1G', prenom: '', code_barre: 'A1G' };
  const client = await generateEtiquette(commun);
  const emplacement = await generateEtiquette({ ...commun, gabarit: 'emplacement' });
  expect(emplacement.equals(client)).toBe(false);
});

test('un gabarit inconnu est refusé', async () => {
  await expect(
    generateEtiquette({ nom: 'A', prenom: '', code_barre: 'A', gabarit: 'etagere' })
  ).rejects.toThrow(/Gabarit/);
});
