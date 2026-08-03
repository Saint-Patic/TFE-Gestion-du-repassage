// Client HTTP de la file SMS du VPS.
// `fetchImpl` est injectable : les tests n'ouvrent aucune connexion réseau.
function creerApiSms({ urlApi, jeton, fetchImpl = fetch }) {
  const base = String(urlApi).replace(/\/$/, '');

  async function appeler(chemin, options = {}) {
    const reponse = await fetchImpl(`${base}/api/sms${chemin}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jeton}`,
        ...(options.headers || {}),
      },
    });
    if (!reponse.ok) {
      throw new Error(`Appel ${chemin} refusé (HTTP ${reponse.status}).`);
    }
    return reponse.json();
  }

  return {
    recupererEnAttente: (limite = 10) => appeler(`/en-attente?limite=${limite}`),
    confirmerEnvoye: (idSms) => appeler(`/${encodeURIComponent(idSms)}/envoye`, { method: 'POST' }),
    signalerEchec: (idSms, erreur) =>
      appeler(`/${encodeURIComponent(idSms)}/echec`, {
        method: 'POST',
        body: JSON.stringify({ erreur: String(erreur) }),
      }),
  };
}

module.exports = { creerApiSms };
