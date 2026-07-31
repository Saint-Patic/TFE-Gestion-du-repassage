require('dotenv').config();
const { Pool } = require('pg');

// Migration idempotente : ajoute commande.repassage_debut (heure de démarrage du repassage) si absente.
async function migrer() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    await pool.query(
      'ALTER TABLE commande ADD COLUMN IF NOT EXISTS repassage_debut TIMESTAMPTZ'
    );
    console.log('Colonne commande.repassage_debut : présente (ajoutée si nécessaire).');
  } finally {
    await pool.end();
  }
}

migrer().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
