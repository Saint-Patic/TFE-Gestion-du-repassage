const express = require('express');
const creerRouteurUtilisateurs = require('./routes/utilisateurs');
const creerRouteurAuth = require('./routes/auth');
const creerRouteurClients = require('./routes/clients');
const creerRouteurCommandes = require('./routes/commandes');
const creerRouteurEmplacements = require('./routes/emplacements');
const creerRouteurSms = require('./routes/sms');
const creerRouteurStatistiques = require('./routes/statistiques');

// Fabrique : construit l'application Express à partir d'un pool pg (réel ou injecté
// en test). Ne démarre pas le serveur (pas de listen) — testable via Supertest.
function creerApp(pool, diffuserMaj = () => {}) {
  const app = express();

  app.use(express.json());

  app.get('/api/health', async (req, res) => {
    try {
      const result = await pool.query('SELECT NOW()');
      res.json({ status: 'ok', db_time: result.rows[0].now });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.use('/api/utilisateurs', creerRouteurUtilisateurs(pool));
  app.use('/api/auth', creerRouteurAuth(pool));
  app.use('/api/clients', creerRouteurClients(pool));
  app.use('/api/commandes', creerRouteurCommandes(pool, diffuserMaj));
  app.use('/api/emplacements', creerRouteurEmplacements(pool));
  app.use('/api/sms', creerRouteurSms(pool));
  app.use('/api/statistiques', creerRouteurStatistiques(pool));

  return app;
}

module.exports = creerApp;
