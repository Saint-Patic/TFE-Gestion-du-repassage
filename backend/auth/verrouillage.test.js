const {
  enregistrerEchec,
  reinitialiser,
  etatVerrou,
  MAX_ECHECS,
  DUREE_VERROU_MS,
} = require('./verrouillage');

test('verrouille après MAX_ECHECS échecs consécutifs', () => {
  const id = 'compte-a';
  for (let i = 0; i < MAX_ECHECS; i++) enregistrerEchec(id);
  expect(etatVerrou(id).verrouille).toBe(true);
  reinitialiser(id);
});

test("un compte sans échec n'est pas verrouillé", () => {
  expect(etatVerrou('compte-b').verrouille).toBe(false);
});

// Le verrou dure une minute. Attendre réellement rendrait la suite inutilisable :
// on avance l'horloge. Les faux timers modernes de Jest simulent aussi Date.now(),
// sur lequel etatVerrou s'appuie — c'est ce qui rend l'expiration testable
// instantanément plutôt qu'en 60 secondes.
test('verrou expiré → ardoise vierge (US #320)', () => {
  jest.useFakeTimers();
  try {
    const id = 'compte-expire';
    for (let i = 0; i < MAX_ECHECS; i++) enregistrerEchec(id);
    expect(etatVerrou(id).verrouille).toBe(true);

    jest.advanceTimersByTime(DUREE_VERROU_MS + 1000);

    const etat = etatVerrou(id);
    expect(etat.verrouille).toBe(false);
    expect(etat.retryAfter).toBe(0);

    // L'entrée a été effacée, pas seulement ignorée : l'utilisatrice repart de zéro
    // et dispose à nouveau de MAX_ECHECS tentatives, sans se reverrouiller au 1er essai.
    enregistrerEchec(id);
    expect(etatVerrou(id).verrouille).toBe(false);
    reinitialiser(id);
  } finally {
    jest.useRealTimers();
  }
});

test('verrou encore actif → retryAfter cohérent (US #320)', () => {
  jest.useFakeTimers();
  try {
    const id = 'compte-actif';
    for (let i = 0; i < MAX_ECHECS; i++) enregistrerEchec(id);

    const etat = etatVerrou(id);
    expect(etat.verrouille).toBe(true);
    expect(etat.retryAfter).toBeGreaterThan(0);
    expect(etat.retryAfter).toBeLessThanOrEqual(DUREE_VERROU_MS / 1000);
    reinitialiser(id);
  } finally {
    jest.useRealTimers();
  }
});

test("des échecs sous le seuil ne verrouillent pas (US #320)", () => {
  const id = 'compte-sous-seuil';
  for (let i = 0; i < MAX_ECHECS - 1; i++) enregistrerEchec(id);
  const etat = etatVerrou(id);
  expect(etat.verrouille).toBe(false);
  expect(etat.retryAfter).toBe(0);
  reinitialiser(id);
});
