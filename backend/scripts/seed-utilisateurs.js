require('dotenv').config();
const { Pool } = require('pg');
const { hacherPin } = require('../auth/pin');

const utilisateurs = [
  { nom: 'Gérante', role: 'gerante', pin: process.env.PIN_GERANTE },
  { nom: 'Repasseuse 1', role: 'repasseuse', pin: process.env.PIN_REPASSEUSE_1 },
  { nom: 'Repasseuse 2', role: 'repasseuse', pin: process.env.PIN_REPASSEUSE_2 },
];

async function seed() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM utilisateur');
    if (rows[0].n > 0) {
      console.log('Table utilisateur déjà peuplée, seed ignoré.');
      return;
    }
    for (const u of utilisateurs) {
      if (!u.pin) {
        throw new Error(`PIN manquant pour ${u.nom} (variable d'environnement).`);
      }
      const hache = await hacherPin(u.pin);
      await pool.query(
        'INSERT INTO utilisateur (nom, role, code_pin_hache) VALUES ($1, $2, $3)',
        [u.nom, u.role, hache]
      );
      console.log(`Utilisatrice créée : ${u.nom} (${u.role})`);
    }
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
