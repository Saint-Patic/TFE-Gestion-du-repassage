require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET manquant : le serveur ne peut pas démarrer.');
  process.exit(1);
}

const express = require('express');
const { Pool } = require('pg');
const creerRouteurUtilisateurs = require('./routes/utilisateurs');
const creerRouteurAuth = require('./routes/auth');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

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

app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});