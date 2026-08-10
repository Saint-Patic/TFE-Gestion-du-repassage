require('dotenv').config();
const { Pool } = require('pg');

// Migration idempotente : rend commande.id_client nullable, pour que la suppression d'une cliente
// puisse DÉTACHER ses commandes au lieu de les supprimer. La requête des statistiques (#300) ne
// joint jamais `client` : détacher préserve donc les chiffres, là où une cascade aurait fait
// disparaître les lignes de historique_statut sur lesquelles elle s'ancre.
//
// Rejouée sur une colonne déjà nullable, l'instruction ne lève rien : pas de IF EXISTS nécessaire.
// La clé étrangère reste volontairement SANS clause ON DELETE — un DELETE brut doit continuer
// d'échouer en 23503, le détachement doit rester explicite.
async function migrer() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    await pool.query('ALTER TABLE commande ALTER COLUMN id_client DROP NOT NULL');
    console.log('Colonne commande.id_client : nullable (modifiée si nécessaire).');
  } finally {
    await pool.end();
  }
}

migrer().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
