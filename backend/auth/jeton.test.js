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
