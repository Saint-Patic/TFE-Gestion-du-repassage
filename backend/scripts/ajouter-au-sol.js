require('dotenv').config();
const { Pool } = require('pg');

// Migration idempotente : introduit l'emplacement « Au sol » (débordement partagé multi-client).
// - colonne est_au_sol
// - coordonnées d'étagère rendues nullables (le sol n'en a pas)
// - CHECK reformulés pour tolérer le sol
// - une ligne « SOL »
async function migrer() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    await pool.query('ALTER TABLE emplacement ADD COLUMN IF NOT EXISTS est_au_sol BOOLEAN NOT NULL DEFAULT FALSE');
    await pool.query('ALTER TABLE emplacement ALTER COLUMN etagere DROP NOT NULL');
    await pool.query('ALTER TABLE emplacement ALTER COLUMN niveau DROP NOT NULL');
    await pool.query('ALTER TABLE emplacement ALTER COLUMN position DROP NOT NULL');

    await pool.query('ALTER TABLE emplacement DROP CONSTRAINT IF EXISTS emplacement_etagere_check');
    await pool.query('ALTER TABLE emplacement DROP CONSTRAINT IF EXISTS emplacement_niveau_check');
    await pool.query('ALTER TABLE emplacement DROP CONSTRAINT IF EXISTS emplacement_position_check');

    await pool.query(
      "ALTER TABLE emplacement ADD CONSTRAINT emplacement_etagere_check CHECK (est_au_sol OR etagere IN ('A','B','C','D','E'))"
    );
    await pool.query(
      'ALTER TABLE emplacement ADD CONSTRAINT emplacement_niveau_check CHECK (est_au_sol OR niveau BETWEEN 1 AND 3)'
    );
    await pool.query(
      "ALTER TABLE emplacement ADD CONSTRAINT emplacement_position_check CHECK (est_au_sol OR position IN ('gauche','centre','droite'))"
    );

    await pool.query(
      "INSERT INTO emplacement (code_barre, est_au_sol) VALUES ('SOL', TRUE) ON CONFLICT (code_barre) DO NOTHING"
    );

    console.log('Migration « Au sol » terminée.');
  } finally {
    await pool.end();
  }
}

migrer().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
