require('dotenv').config();
const { Pool } = require('pg');

// Migration idempotente : les grandes étagères A–D ont 4 étages, pas 3 (constaté sur
// le mobilier réel lors du #340). Seule la borne haute du CHECK sur `niveau` change ;
// les lignes existantes (niveaux 1 à 3) restent valides, aucune donnée n'est touchée.
//
// La contrainte est supprimée par LOOKUP et non par son nom : selon l'historique de la
// base, elle s'appelle `emplacement_niveau_check` (nom posé par la migration du #190)
// ou `emplacement_check1` (auto-nom de PostgreSQL sur une base créée depuis schema.sql
// avant que les noms n'y soient explicités). On cherche donc toute contrainte CHECK de
// la table portant sur `niveau`, quel que soit son nom, avant de reposer la bonne.
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
      DO $$
      DECLARE nom text;
      BEGIN
        FOR nom IN
          SELECT conname FROM pg_constraint
           WHERE conrelid = 'emplacement'::regclass
             AND contype = 'c'
             AND pg_get_constraintdef(oid) LIKE '%niveau%'
        LOOP
          EXECUTE format('ALTER TABLE emplacement DROP CONSTRAINT %I', nom);
        END LOOP;
      END $$;
    `);

    await pool.query(
      'ALTER TABLE emplacement ADD CONSTRAINT emplacement_niveau_check CHECK (est_au_sol OR niveau BETWEEN 1 AND 4)'
    );

    console.log('Migration « 4 étages sur A–D » terminée. Relancez ensuite seed-emplacements.js.');
  } finally {
    await pool.end();
  }
}

migrer().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
