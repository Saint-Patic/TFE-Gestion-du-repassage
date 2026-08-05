const jwt = require('jsonwebtoken');
const { signerJeton, verifierJeton } = require('./jeton');

test('aller-retour : un jeton signé se vérifie et contient le rôle', () => {
  const jeton = signerJeton({ id_utilisateur: 'u-1', role: 'gerante', session_debut: 1000 });
  const charge = verifierJeton(jeton);
  expect(charge.sub).toBe('u-1');
  expect(charge.role).toBe('gerante');
  expect(charge.session_debut).toBe(1000);
});

test('un jeton signé avec un autre secret est rejeté', () => {
  const jeton = signerJeton({ id_utilisateur: 'u-1', role: 'gerante', session_debut: 1000 });
  const ancien = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'autre-secret';
  expect(() => verifierJeton(jeton)).toThrow();
  process.env.JWT_SECRET = ancien;
});

test('un jeton expiré est rejeté', () => {
  const jeton = jwt.sign(
    { sub: 'u-1', role: 'gerante', session_debut: 1000 },
    process.env.JWT_SECRET,
    { expiresIn: -1 }
  );
  expect(() => verifierJeton(jeton)).toThrow();
});

// Le secret est lu à chaque usage, et non au chargement du module : c'est ce qui rend
// ce test possible. Sans cette garde, un serveur démarré sans JWT_SECRET signerait des
// jetons avec « undefined » — vérifiables par n'importe qui. L'échec doit être immédiat
// et bruyant, jamais silencieux.
test('JWT_SECRET absent de l’environnement → signerJeton lève (US #320)', () => {
  const ancien = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    expect(() =>
      signerJeton({ id_utilisateur: 'u-1', role: 'gerante', session_debut: 1000 })
    ).toThrow(/JWT_SECRET manquant/);
  } finally {
    // Restauration impérative : jest.setup.js pose cette variable pour TOUS les fichiers.
    // La laisser absente ferait échouer les tests suivants, avec un message sans rapport.
    process.env.JWT_SECRET = ancien;
  }
});
