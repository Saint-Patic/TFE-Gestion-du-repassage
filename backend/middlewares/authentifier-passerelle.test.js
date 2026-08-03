const authentifierPasserelle = require('./authentifier-passerelle');

// Faux objet réponse : mémorise le code et le corps renvoyés.
function fauxRes() {
  return {
    code: 0,
    corps: null,
    status(c) { this.code = c; return this; },
    json(c) { this.corps = c; return this; },
  };
}

describe('authentifierPasserelle (US #240)', () => {
  const ancien = process.env.JETON_PASSERELLE;

  afterEach(() => {
    if (ancien === undefined) delete process.env.JETON_PASSERELLE;
    else process.env.JETON_PASSERELLE = ancien;
  });

  test('sans en-tête Authorization → 401', () => {
    process.env.JETON_PASSERELLE = 'secret-passerelle';
    const res = fauxRes();
    const next = jest.fn();
    authentifierPasserelle({ headers: {} }, res, next);
    expect(res.code).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('jeton erroné → 401', () => {
    process.env.JETON_PASSERELLE = 'secret-passerelle';
    const res = fauxRes();
    const next = jest.fn();
    authentifierPasserelle({ headers: { authorization: 'Bearer mauvais-jeton' } }, res, next);
    expect(res.code).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("JETON_PASSERELLE absent de l'environnement → 401 même avec un jeton", () => {
    delete process.env.JETON_PASSERELLE;
    const res = fauxRes();
    const next = jest.fn();
    authentifierPasserelle({ headers: { authorization: 'Bearer peu importe' } }, res, next);
    expect(res.code).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('jeton correct → next() appelé, pas de réponse', () => {
    process.env.JETON_PASSERELLE = 'secret-passerelle';
    const res = fauxRes();
    const next = jest.fn();
    authentifierPasserelle({ headers: { authorization: 'Bearer secret-passerelle' } }, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.code).toBe(0);
  });
});
