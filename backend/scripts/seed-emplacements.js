require('dotenv').config();
const { Pool } = require('pg');
const { genererEmplacements } = require('../emplacements/emplacements');

async function seed() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const emplacements = genererEmplacements();
    let crees = 0;
    for (const e of emplacements) {
      const r = await pool.query(
        `INSERT INTO emplacement (code_barre, etagere, niveau, position)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (etagere, niveau, position) DO NOTHING`,
        [e.code_barre, e.etagere, e.niveau, e.position]
      );
      crees += r.rowCount;
    }
    console.log(`Emplacements insérés : ${crees} (sur ${emplacements.length}).`);
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
