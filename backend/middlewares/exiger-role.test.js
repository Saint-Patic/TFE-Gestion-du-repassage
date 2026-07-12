const exigerRole = require('./exiger-role');

function fauxRes() {
  return {
    code: null,
    corps: null,
    status(c) { this.code = c; return this; },
    json(o) { this.corps = o; return this; },
  };
}

test('rôle autorisé → next() appelé', () => {
  const req = { utilisateur: { role: 'gerante' } };
  const res = fauxRes();
  let appele = false;
  exigerRole('gerante')(req, res, () => { appele = true; });
  expect(appele).toBe(true);
  expect(res.code).toBeNull();
});

test('rôle interdit → 403, next() non appelé', () => {
  const req = { utilisateur: { role: 'repasseuse' } };
  const res = fauxRes();
  let appele = false;
  exigerRole('gerante')(req, res, () => { appele = true; });
  expect(res.code).toBe(403);
  expect(appele).toBe(false);
});

test('req.utilisateur absent → 401, next() non appelé', () => {
  const req = {};
  const res = fauxRes();
  let appele = false;
  exigerRole('gerante')(req, res, () => { appele = true; });
  expect(res.code).toBe(401);
  expect(appele).toBe(false);
});

test('variadique : accepte plusieurs rôles', () => {
  const req = { utilisateur: { role: 'repasseuse' } };
  const res = fauxRes();
  let appele = false;
  exigerRole('gerante', 'repasseuse')(req, res, () => { appele = true; });
  expect(appele).toBe(true);
});
