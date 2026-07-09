require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET manquant : le serveur ne peut pas démarrer.');
  process.exit(1);
}

const http = require('http');
const { Pool } = require('pg');
const creerApp = require('./app');
const { initialiserTempsReel } = require('./temps-reel');

const port = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const app = creerApp(pool);
const serveur = http.createServer(app);
initialiserTempsReel(serveur);

serveur.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
