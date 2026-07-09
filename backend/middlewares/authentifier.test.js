const authentifier = require('./authentifier');
const { signerJeton } = require('../auth/jeton');

function fauxRes() {
  return {
    code: null,
    corps: null,
    status(c) { this.code = c; return this; },
    json(o) { this.corps = o; return this; },
  };
}

test('refuse une requête sans en-tête Authorization', () => {
  const res = fauxRes();
  let appele = false;
  authentifier({ headers: {} }, res, () => { appele = true; });
  expect(res.code).toBe(401);
  expect(appele).toBe(false);
});

test('accepte un Bearer valide et pose req.utilisateur', () => {
  const jeton = signerJeton({ id_utilisateur: 'u-1', role: 'repasseuse', session_debut: 1000 });
  const req = { headers: { authorization: 'Bearer ' + jeton } };
  const res = fauxRes();
  let appele = false;
  authentifier(req, res, () => { appele = true; });
  expect(appele).toBe(true);
  expect(req.utilisateur).toEqual({ id_utilisateur: 'u-1', role: 'repasseuse', session_debut: 1000 });
});
