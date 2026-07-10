const fs = require('fs');
const request = require('supertest');
const creerAgent = require('./serveur');

const app = creerAgent();

test('GET /sante répond 200', async () => {
  const res = await request(app).get('/sante');
  expect(res.status).toBe(200);
  expect(res.body.statut).toBe('ok');
});

test('POST /imprimer avec données valides écrit un PDF (mode fichier)', async () => {
  process.env.MODE_SORTIE = 'fichier';
  const res = await request(app)
    .post('/imprimer')
    .send({ nom: 'Dupont', prenom: 'Marie', code_barre: 'CLI-TEST' });
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  expect(fs.existsSync(res.body.chemin)).toBe(true);
  fs.unlinkSync(res.body.chemin);
});

test('POST /imprimer avec payload incomplet répond 400', async () => {
  const res = await request(app).post('/imprimer').send({ nom: 'Dupont' });
  expect(res.status).toBe(400);
});
