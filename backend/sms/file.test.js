const { mettreEnFileSms } = require('./file');

const UUID_CMD = '33333333-3333-3333-3333-333333333333';
const MESSAGE = 'Bonjour, votre linge est disponible au local. Merci. La Manne a Bulles';

// Faux exécuteur : mémorise la requête reçue. Il sert aussi bien de faux pool que de
// faux client transactionnel — c'est justement l'intérêt de la signature.
function fauxExecuteur(rows = [{ id_sms: 'sms-1' }]) {
  const appels = [];
  return {
    appels,
    query: async (sql, params) => {
      appels.push({ sql, params });
      return { rowCount: rows.length, rows };
    },
  };
}

describe('mettreEnFileSms (US #250)', () => {
  test('insère dans sms_en_attente la commande et le message', async () => {
    const ex = fauxExecuteur();
    await mettreEnFileSms(ex, UUID_CMD, MESSAGE);
    expect(ex.appels).toHaveLength(1);
    expect(ex.appels[0].sql).toMatch(/INSERT INTO sms_en_attente/i);
    expect(ex.appels[0].params).toEqual([UUID_CMD, MESSAGE]);
  });

  test("renvoie l'identifiant du SMS créé", async () => {
    const ex = fauxExecuteur([{ id_sms: 'sms-42' }]);
    await expect(mettreEnFileSms(ex, UUID_CMD, MESSAGE)).resolves.toBe('sms-42');
  });

  test('accepte un client transactionnel (usage prévu au #260)', async () => {
    // Un client issu de pool.connect() expose query ET release : la signature doit
    // l'accepter tel quel, pour que le dépôt ait lieu dans la même transaction que
    // la clôture « en cours → fait ».
    const client = { ...fauxExecuteur([{ id_sms: 'sms-7' }]), release: () => {} };
    await expect(mettreEnFileSms(client, UUID_CMD, MESSAGE)).resolves.toBe('sms-7');
  });

  test("propage l'erreur de clé étrangère au lieu de l'avaler", async () => {
    const erreur = Object.assign(new Error('violates foreign key constraint'), { code: '23503' });
    const ex = { query: async () => { throw erreur; } };
    await expect(mettreEnFileSms(ex, UUID_CMD, MESSAGE)).rejects.toMatchObject({ code: '23503' });
  });
});
