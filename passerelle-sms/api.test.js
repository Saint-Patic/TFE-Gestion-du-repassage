const { creerApiSms } = require('./api');

// Faux fetch : mémorise les appels et renvoie une réponse contrôlée.
function fauxFetch(reponse = { ok: true, status: 200, json: async () => [] }) {
  const appels = [];
  const impl = async (url, options) => {
    appels.push({ url, options });
    return reponse;
  };
  return { impl, appels };
}

describe('creerApiSms (US #240)', () => {
  test('recupererEnAttente : GET avec la limite et le jeton Bearer', async () => {
    const { impl, appels } = fauxFetch();
    const api = creerApiSms({ urlApi: 'http://localhost:3000', jeton: 'secret', fetchImpl: impl });
    await api.recupererEnAttente(5);
    expect(appels[0].url).toBe('http://localhost:3000/api/sms/en-attente?limite=5');
    expect(appels[0].options.headers.Authorization).toBe('Bearer secret');
  });

  test('confirmerEnvoye : POST sur /:id/envoye, barre oblique finale tolérée', async () => {
    const { impl, appels } = fauxFetch({ ok: true, status: 200, json: async () => ({ ok: true }) });
    const api = creerApiSms({ urlApi: 'http://localhost:3000/', jeton: 'secret', fetchImpl: impl });
    await api.confirmerEnvoye('sms-1');
    expect(appels[0].url).toBe('http://localhost:3000/api/sms/sms-1/envoye');
    expect(appels[0].options.method).toBe('POST');
  });

  test('signalerEchec : POST avec le motif dans le corps', async () => {
    const { impl, appels } = fauxFetch({ ok: true, status: 200, json: async () => ({}) });
    const api = creerApiSms({ urlApi: 'http://localhost:3000', jeton: 'secret', fetchImpl: impl });
    await api.signalerEchec('sms-1', 'numéro invalide');
    expect(appels[0].url).toBe('http://localhost:3000/api/sms/sms-1/echec');
    expect(JSON.parse(appels[0].options.body)).toEqual({ erreur: 'numéro invalide' });
  });

  test('réponse non-2xx → erreur explicite', async () => {
    const { impl } = fauxFetch({ ok: false, status: 401, json: async () => ({}) });
    const api = creerApiSms({ urlApi: 'http://localhost:3000', jeton: 'mauvais', fetchImpl: impl });
    await expect(api.recupererEnAttente()).rejects.toThrow(/HTTP 401/);
  });
});
