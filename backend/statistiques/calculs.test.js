const { calculerIndicateurs } = require('./calculs');

describe('calculerIndicateurs (US #300)', () => {
  test('cas nominal : moyennes par commande et par manne', () => {
    expect(calculerIndicateurs({ nbCommandes: 12, tempsTotalS: 43200, totalMannes: 34 })).toEqual({
      nbCommandes: 12, tempsTotalS: 43200, totalMannes: 34,
      moyenneParCommandeS: 3600, moyenneParManneS: 1271,
    });
  });

  test('aucune commande → moyennes à 0, jamais NaN', () => {
    const r = calculerIndicateurs({ nbCommandes: 0, tempsTotalS: 0, totalMannes: 0 });
    expect(r.moyenneParCommandeS).toBe(0);
    expect(r.moyenneParManneS).toBe(0);
    expect(Number.isNaN(r.moyenneParCommandeS)).toBe(false);
  });

  test('des commandes mais aucune manne → moyenne par manne à 0', () => {
    const r = calculerIndicateurs({ nbCommandes: 2, tempsTotalS: 600, totalMannes: 0 });
    expect(r.moyenneParManneS).toBe(0);
    expect(r.moyenneParCommandeS).toBe(300);
  });

  test('les moyennes sont arrondies à la seconde entière', () => {
    expect(calculerIndicateurs({ nbCommandes: 3, tempsTotalS: 100, totalMannes: 3 }).moyenneParCommandeS).toBe(33);
  });

  test('appelée sans donnée → tout à zéro', () => {
    expect(calculerIndicateurs({})).toEqual({
      nbCommandes: 0, tempsTotalS: 0, totalMannes: 0,
      moyenneParCommandeS: 0, moyenneParManneS: 0,
    });
  });
});
