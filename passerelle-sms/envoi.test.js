const { creerEnvoyeur, masquer } = require('./envoi');

describe('masquer (US #240)', () => {
  test('ne laisse que les 4 derniers chiffres', () => {
    expect(masquer('0470123456')).toBe('******3456');
  });

  test('numéro très court → entièrement masqué', () => {
    expect(masquer('123')).toBe('****');
  });
});

describe('creerEnvoyeur (US #240)', () => {
  test('mode console : journalise sans envoyer, et ne révèle pas le numéro complet', async () => {
    const journal = { log: jest.fn() };
    const envoyer = creerEnvoyeur('console', journal);
    await envoyer('0470123456', 'Votre commande est prête.');
    expect(journal.log).toHaveBeenCalledTimes(1);
    const ligne = journal.log.mock.calls[0][0];
    expect(ligne).toContain('3456');
    expect(ligne).toContain('Votre commande est prête.');
    expect(ligne).not.toContain('0470123456');
  });

  test('mode inconnu → erreur explicite', () => {
    expect(() => creerEnvoyeur('pigeon-voyageur')).toThrow(/MODE_ENVOI inconnu/);
  });
});
