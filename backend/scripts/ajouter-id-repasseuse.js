require('dotenv').config();
const { Pool } = require('pg');

// Migration idempotente : ajoute commande.id_repasseuse (l'encodeuse) si absente.
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
       ADD COLUMN IF NOT EXISTS id_repasseuse UUID REFERENCES utilisateur(id_utilisateur)`
    );
    console.log('Colonne commande.id_repasseuse : présente (ajoutée si nécessaire).');
  } finally {
    await pool.end();
  }
}

migrer().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
