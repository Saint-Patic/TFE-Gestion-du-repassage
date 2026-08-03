require('dotenv').config();
const { Pool } = require('pg');

// Migration idempotente : crée la file d'attente des SMS (US #240) si elle n'existe pas.
async function migrer() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_en_attente (
          id_sms           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          id_commande      UUID NOT NULL REFERENCES commande(id_commande) ON DELETE CASCADE,
          message          TEXT NOT NULL,
          statut           VARCHAR(20) NOT NULL DEFAULT 'en_attente'
                               CHECK (statut IN ('en_attente','envoye','echec')),
          tentatives       SMALLINT NOT NULL DEFAULT 0,
          date_creation    TIMESTAMPTZ NOT NULL DEFAULT now(),
          date_envoi       TIMESTAMPTZ,
          derniere_erreur  TEXT
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_sms_statut ON sms_en_attente(statut)');
    console.log('Table sms_en_attente : présente (créée si nécessaire).');
  } finally {
    await pool.end();
  }
}

migrer().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
