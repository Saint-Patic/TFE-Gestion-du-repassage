require('dotenv').config();
const { Pool } = require('pg');

// Migration idempotente : ajoute commande.cintres_entr_rendus si absente.
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
      `ALTER TABLE commande
       ADD COLUMN IF NOT EXISTS cintres_entr_rendus BOOLEAN NOT NULL DEFAULT FALSE`
    );
    console.log('Colonne cintres_entr_rendus : présente (ajoutée si nécessaire).');
  } finally {
    await pool.end();
  }
}

migrer().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
