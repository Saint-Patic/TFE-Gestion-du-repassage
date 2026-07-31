const { transitionValide, prochainStatut } = require('./transitions');

describe('transitionValide', () => {
  test('les 3 transitions linéaires autorisées → true', () => {
    expect(transitionValide('a_faire', 'en_cours')).toBe(true);
    expect(transitionValide('en_cours', 'fait')).toBe(true);
    expect(transitionValide('fait', 'recupere')).toBe(true);
  });

  test('même état → false', () => {
    expect(transitionValide('a_faire', 'a_faire')).toBe(false);
    expect(transitionValide('en_cours', 'en_cours')).toBe(false);
  });

  test('retour arrière → false', () => {
    expect(transitionValide('en_cours', 'a_faire')).toBe(false);
    expect(transitionValide('fait', 'en_cours')).toBe(false);
    expect(transitionValide('recupere', 'fait')).toBe(false);
  });

  test('saut d’étape → false', () => {
    expect(transitionValide('a_faire', 'fait')).toBe(false);
    expect(transitionValide('a_faire', 'recupere')).toBe(false);
    expect(transitionValide('en_cours', 'recupere')).toBe(false);
  });

  test('état terminal → false', () => {
    expect(transitionValide('recupere', 'en_cours')).toBe(false);
  });

  test('statut inconnu → false', () => {
    expect(transitionValide('x', 'en_cours')).toBe(false);
    expect(transitionValide('a_faire', 'y')).toBe(false);
  });
});

describe('prochainStatut', () => {
  test('renvoie l’étape suivante autorisée', () => {
    expect(prochainStatut('a_faire')).toBe('en_cours');
    expect(prochainStatut('en_cours')).toBe('fait');
    expect(prochainStatut('fait')).toBe('recupere');
  });

  test('recupere (terminal) → null', () => {
    expect(prochainStatut('recupere')).toBeNull();
  });

  test('statut inconnu/absent → null', () => {
    expect(prochainStatut('x')).toBeNull();
    expect(prochainStatut(undefined)).toBeNull();
  });
});
