const { validerEmplacements, enregistrerPlacement } = require('./placement');

const LIGNES = [
  { id_emplacement: 'e1', nombre_mannes: 2 },
  { id_emplacement: 'e2', nombre_mannes: 1 },
];

// Faux client transactionnel : mémorise les requêtes, simule ou non un conflit d'étagère.
function fauxClient({ conflit = false } = {}) {
  const appels = [];
  return {
    appels,
    query: async (sql, params) => {
      appels.push({ sql, params });
      if (/id_client <> \$3/i.test(sql)) return { rowCount: conflit ? 1 : 0, rows: [] };
      return { rowCount: 1, rows: [] };
    },
  };
}

describe('validerEmplacements (US #260)', () => {
  test('tableau vide → message', () => {
    expect(validerEmplacements([])).toMatch(/tableau non vide/);
  });

  test('id_emplacement manquant → message', () => {
    expect(validerEmplacements([{ nombre_mannes: 1 }])).toMatch(/id_emplacement/);
  });

  test('nombre_mannes < 1 → message', () => {
    expect(validerEmplacements([{ id_emplacement: 'e1', nombre_mannes: 0 }])).toMatch(/entier/);
  });

  test('tableau valide → null', () => {
    expect(validerEmplacements(LIGNES)).toBeNull();
  });
});

describe('enregistrerPlacement (US #260)', () => {
  test('somme différente du nombre de mannes → erreur 400', async () => {
    const client = fauxClient();
    await expect(enregistrerPlacement(client, 'cmd1', 'cl1', 5, LIGNES))
      .rejects.toMatchObject({ statut: 400 });
  });

  test('étagère occupée par un autre client → erreur 409 (invariant #190)', async () => {
    const client = fauxClient({ conflit: true });
    await expect(enregistrerPlacement(client, 'cmd1', 'cl1', 3, LIGNES))
      .rejects.toMatchObject({ statut: 409 });
  });

  test('cas nominal → DELETE puis un INSERT par ligne', async () => {
    const client = fauxClient();
    await enregistrerPlacement(client, 'cmd1', 'cl1', 3, LIGNES);
    const del = client.appels.filter((a) => /DELETE FROM commande_emplacement/i.test(a.sql));
    const ins = client.appels.filter((a) => /INSERT INTO commande_emplacement/i.test(a.sql));
    expect(del).toHaveLength(1);
    expect(ins).toHaveLength(2);
    expect(ins[0].params).toEqual(['cmd1', 'e1', 2]);
    expect(ins[1].params).toEqual(['cmd1', 'e2', 1]);
  });

  test("ne touche à rien avant d'avoir validé la somme", async () => {
    const client = fauxClient();
    await expect(enregistrerPlacement(client, 'cmd1', 'cl1', 5, LIGNES)).rejects.toBeDefined();
    expect(client.appels).toHaveLength(0);
  });
});
