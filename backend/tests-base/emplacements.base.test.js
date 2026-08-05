const request = require('supertest');
const creerApp = require('../app');
const { signerJeton } = require('../auth/jeton');
const {
  creerPoolTest,
  preparerBase,
  viderTables,
  semerUtilisateurs,
  semerClient,
  semerEmplacements,
  idEmplacement,
  UUID_REPASSEUSE,
} = require('./aide-base');

let pool;
let app;

const jetonRepasseuse = () =>
  signerJeton({
    id_utilisateur: UUID_REPASSEUSE,
    role: 'repasseuse',
    session_debut: Math.floor(Date.now() / 1000),
  });

async function creerCommande(idClient, mannes) {
  const r = await pool.query(
    `INSERT INTO commande (id_client, nombre_mannes, statut, id_repasseuse)
     VALUES ($1, $2, 'a_faire', $3) RETURNING id_commande`,
    [idClient, mannes, UUID_REPASSEUSE]
  );
  return r.rows[0].id_commande;
}

beforeAll(async () => {
  pool = creerPoolTest();
  await preparerBase(pool);
  app = creerApp(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await viderTables(pool);
  await semerUtilisateurs(pool);
  await semerEmplacements(pool);
});

// Invariant du #190, réparti sur deux endpoints. Avec un faux pool on vérifiait qu'un 409
// sort quand le pool renvoie une ligne de conflit préfabriquée ; on ne pouvait pas voir
// SUR QUEL CRITÈRE le conflit était cherché. C'est ce que ces tests établissent.
//
// La règle, confirmée par Alexis au #330 : la portée est l'EMPLACEMENT, pas l'étagère.
//   - deux clients ne peuvent pas partager le même emplacement ;
//   - un client peut répartir ses mannes sur plusieurs emplacements (2 en A1D + 1 en A1C) ;
//   - deux clients peuvent donc occuper deux cases différentes d'une même étagère.
//
// La formule « une étagère = un seul client », qui traînait dans les commentaires et les
// notes du #190, était une imprécision de rédaction : aucune ligne de code ne l'appliquait.
// Corrigée à la source au #330.
describe("invariant « un emplacement = un seul client » (US #330)", () => {
  test('placement sur un emplacement libre → 201 et lignes écrites en base', async () => {
    const idClient = await semerClient(pool, { code_barre: 'CLIENTA' });
    const idCommande = await creerCommande(idClient, 2);
    const b1g = await idEmplacement(pool, 'B1G');

    const res = await request(app)
      .post(`/api/commandes/${idCommande}/emplacements`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: [{ id_emplacement: b1g, nombre_mannes: 2 }] });

    expect(res.status).toBe(201);

    const lignes = await pool.query(
      'SELECT nombre_mannes FROM commande_emplacement WHERE id_emplacement = $1',
      [b1g]
    );
    expect(lignes.rowCount).toBe(1);
    expect(lignes.rows[0].nombre_mannes).toBe(2);
  });

  test("placement d'un second client sur le même emplacement → 409, aucune ligne ajoutée", async () => {
    const idA = await semerClient(pool, { nom: 'A', code_barre: 'CLIENTA' });
    const idC = await semerClient(pool, { nom: 'C', code_barre: 'CLIENTC' });
    const cmdA = await creerCommande(idA, 1);
    const cmdC = await creerCommande(idC, 1);
    const b1g = await idEmplacement(pool, 'B1G');

    await request(app)
      .post(`/api/commandes/${cmdA}/emplacements`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: [{ id_emplacement: b1g, nombre_mannes: 1 }] })
      .expect(201);

    const res = await request(app)
      .post(`/api/commandes/${cmdC}/emplacements`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: [{ id_emplacement: b1g, nombre_mannes: 1 }] });

    expect(res.status).toBe(409);

    // Le point décisif : la transaction a bien été annulée, rien n'a été écrit.
    const surB1G = await pool.query(
      'SELECT count(*)::int AS n FROM commande_emplacement WHERE id_emplacement = $1',
      [b1g]
    );
    expect(surB1G.rows[0].n).toBe(1);
  });

  // L'exemple donné par Alexis : « client A peut avoir deux mannes sur A1D + une autre
  // sur A1C ». Un client n'est pas cantonné à une case ; c'est même le cas normal dès que
  // sa commande dépasse ce qu'une case peut contenir.
  test('un même client peut répartir ses mannes sur plusieurs emplacements', async () => {
    const idClient = await semerClient(pool);
    const idCommande = await creerCommande(idClient, 3);
    const a1d = await idEmplacement(pool, 'A1D');
    const a1c = await idEmplacement(pool, 'A1C');

    const res = await request(app)
      .post(`/api/commandes/${idCommande}/emplacements`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({
        emplacements: [
          { id_emplacement: a1d, nombre_mannes: 2 },
          { id_emplacement: a1c, nombre_mannes: 1 },
        ],
      });

    expect(res.status).toBe(201);

    const lignes = await pool.query(
      `SELECT e.code_barre, ce.nombre_mannes
       FROM commande_emplacement ce
       JOIN emplacement e ON e.id_emplacement = ce.id_emplacement
       WHERE ce.id_commande = $1
       ORDER BY e.code_barre`,
      [idCommande]
    );
    expect(lignes.rows).toEqual([
      { code_barre: 'A1C', nombre_mannes: 1 },
      { code_barre: 'A1D', nombre_mannes: 2 },
    ]);
  });

  // Corollaire direct de la portée par emplacement : puisque la case seule fait foi, deux
  // clients peuvent occuper deux cases distinctes de la même étagère. Ce test fixe ce point
  // noir sur blanc — c'est précisément lui que la formulation « une étagère = un seul
  // client » laissait croire interdit.
  test('deux clients sur deux cases de la MÊME étagère → accepté', async () => {
    const idA = await semerClient(pool, { nom: 'A', code_barre: 'CLIENTA' });
    const idC = await semerClient(pool, { nom: 'C', code_barre: 'CLIENTC' });
    const cmdA = await creerCommande(idA, 1);
    const cmdC = await creerCommande(idC, 1);
    const b1g = await idEmplacement(pool, 'B1G');
    const b2d = await idEmplacement(pool, 'B2D'); // même étagère B, autre case

    await request(app)
      .post(`/api/commandes/${cmdA}/emplacements`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: [{ id_emplacement: b1g, nombre_mannes: 1 }] })
      .expect(201);

    const res = await request(app)
      .post(`/api/commandes/${cmdC}/emplacements`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: [{ id_emplacement: b2d, nombre_mannes: 1 }] });

    expect(res.status).toBe(201);

    const surB = await pool.query(
      `SELECT count(*)::int AS n FROM commande_emplacement ce
       JOIN emplacement e ON e.id_emplacement = ce.id_emplacement
       WHERE e.etagere = 'B'`
    );
    expect(surB.rows[0].n).toBe(2);
  });

  test('déplacement vers un emplacement occupé par un autre client → 409', async () => {
    const idA = await semerClient(pool, { nom: 'A', code_barre: 'CLIENTA' });
    const idC = await semerClient(pool, { nom: 'C', code_barre: 'CLIENTC' });
    const cmdA = await creerCommande(idA, 1);
    const cmdC = await creerCommande(idC, 1);
    const b1g = await idEmplacement(pool, 'B1G');
    const c1g = await idEmplacement(pool, 'C1G');

    await request(app)
      .post(`/api/commandes/${cmdA}/emplacements`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: [{ id_emplacement: b1g, nombre_mannes: 1 }] })
      .expect(201);
    await request(app)
      .post(`/api/commandes/${cmdC}/emplacements`)
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ emplacements: [{ id_emplacement: c1g, nombre_mannes: 1 }] })
      .expect(201);

    // C tente de rejoindre B1G, la case exacte où A est déjà installé.
    const res = await request(app)
      .post('/api/emplacements/deplacer')
      .set('Authorization', `Bearer ${jetonRepasseuse()}`)
      .send({ id_source: c1g, id_destination: b1g, id_client: idC });

    expect(res.status).toBe(409);

    const resteEnC = await pool.query(
      'SELECT count(*)::int AS n FROM commande_emplacement WHERE id_emplacement = $1',
      [c1g]
    );
    expect(resteEnC.rows[0].n).toBe(1);
  });
});
