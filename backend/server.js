require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET manquant : le serveur ne peut pas démarrer.');
  process.exit(1);
}

const http = require('http');
const { Pool } = require('pg');
const creerApp = require('./app');
const { initialiserTempsReel, diffuserA } = require('./temps-reel');

const port = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Diffuse une mise à jour de commande à son encodeuse + à toutes les gérantes.
const diffuserMaj = (idRepasseuse) =>
  diffuserA(['utilisateur:' + idRepasseuse, 'role:gerante'], 'commandes:maj', {});
const app = creerApp(pool, diffuserMaj);
const serveur = http.createServer(app);
initialiserTempsReel(serveur);

serveur.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
