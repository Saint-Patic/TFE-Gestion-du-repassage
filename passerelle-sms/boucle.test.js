const { traiterUneFois } = require('./boucle');

// Fausse API : mémorise ce qui a été confirmé et ce qui a été signalé en échec.
function fauxApi(enAttente) {
  const confirmes = [];
  const echecs = [];
  return {
    api: {
      recupererEnAttente: async () => enAttente,
      confirmerEnvoye: async (id) => { confirmes.push(id); },
      signalerEchec: async (id, erreur) => { echecs.push({ id, erreur }); },
    },
    confirmes,
    echecs,
  };
}

const journalMuet = { log: () => {}, error: () => {} };

describe('traiterUneFois (US #240)', () => {
  test('file vide → aucun envoi', async () => {
    const { api, confirmes } = fauxApi([]);
    const envoyer = jest.fn();
    const bilan = await traiterUneFois({ api, envoyer, journal: journalMuet });
    expect(envoyer).not.toHaveBeenCalled();
    expect(confirmes).toEqual([]);
    expect(bilan).toEqual({ traites: 0, echecs: 0 });
  });

  test('deux messages → deux envois dans l’ordre et deux confirmations', async () => {
    const { api, confirmes } = fauxApi([
      { id_sms: 's1', telephone: '0470111111', message: 'un' },
      { id_sms: 's2', telephone: '0470222222', message: 'deux' },
    ]);
    const envoyes = [];
    const envoyer = async (numero, message) => { envoyes.push(message); };
    const bilan = await traiterUneFois({ api, envoyer, journal: journalMuet });
    expect(envoyes).toEqual(['un', 'deux']);
    expect(confirmes).toEqual(['s1', 's2']);
    expect(bilan).toEqual({ traites: 2, echecs: 0 });
  });

  test('un envoi qui échoue est signalé, et le suivant est traité quand même', async () => {
    const { api, confirmes, echecs } = fauxApi([
      { id_sms: 's1', telephone: '0470111111', message: 'un' },
      { id_sms: 's2', telephone: '0470222222', message: 'deux' },
    ]);
    const envoyer = async (numero) => {
      if (numero === '0470111111') throw new Error('numéro invalide');
    };
    const bilan = await traiterUneFois({ api, envoyer, journal: journalMuet });
    expect(echecs).toEqual([{ id: 's1', erreur: 'numéro invalide' }]);
    expect(confirmes).toEqual(['s2']);
    expect(bilan).toEqual({ traites: 1, echecs: 1 });
  });
});
