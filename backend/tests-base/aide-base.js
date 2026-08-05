const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { configBase } = require('./config-base');
const { hacherPin } = require('../auth/pin');
const { genererEmplacements } = require('../emplacements/emplacements');

const CHEMIN_SCHEMA = path.join(__dirname, '..', '..', 'database', 'schema.sql');

// Ordre de suppression : les tables portant des clés étrangères d'abord. CASCADE couvre
// le reste, mais l'ordre rend l'intention lisible.
const TABLES = [
  'sms_en_attente',
  'historique_statut',
  'commande_emplacement',
  'commande',
  'emplacement',
  'client',
  'utilisateur',
];

// UUID fixes : ils doivent correspondre aux jetons signés dans les tests.
// scripts/seed-utilisateurs.js ne convient pas ici — il génère des UUID aléatoires et
// exige les PIN d'environnement.
const UUID_GERANTE = '11111111-1111-1111-1111-111111111111';
const UUID_REPASSEUSE = '22222222-2222-2222-2222-222222222222';
const UUID_REPASSEUSE_2 = '44444444-4444-4444-4444-444444444444';
const PIN_TEST = '1234';

function creerPoolTest() {
  return new Pool(configBase);
}

// Repart d'un schéma neuf. Appelée une fois par fichier de test (beforeAll).
async function preparerBase(pool) {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    throw new Error(
      `Base de test injoignable (${configBase.database} sur ${configBase.host}:${configBase.port}).\n` +
        `Créez-la une fois avec :\n` +
        `  sudo -u postgres psql -c "CREATE DATABASE manne_bulles_test OWNER ${configBase.user};"\n` +
        `  sudo -u postgres psql -d manne_bulles_test -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"\n` +
        `Cause d'origine : ${err.message}`
    );
  }
  await pool.query(`DROP TABLE IF EXISTS ${TABLES.join(', ')} CASCADE`);
  await pool.query(fs.readFileSync(CHEMIN_SCHEMA, 'utf8'));
}

async function viderTables(pool) {
  await pool.query(`TRUNCATE ${TABLES.join(', ')} CASCADE`);
}

async function semerUtilisateurs(pool) {
  const hache = await hacherPin(PIN_TEST);
  await pool.query(
    `INSERT INTO utilisateur (id_utilisateur, nom, role, code_pin_hache) VALUES
       ($1, 'Gérante',      'gerante',    $4),
       ($2, 'Repasseuse 1', 'repasseuse', $4),
       ($3, 'Repasseuse 2', 'repasseuse', $4)`,
    [UUID_GERANTE, UUID_REPASSEUSE, UUID_REPASSEUSE_2, hache]
  );
}

// telephone : '0475123456' = mobile (SMS) ; '068123456' = fixe (pas de SMS, cf. #270).
async function semerClient(
  pool,
  { nom = 'Dupont', prenom = 'Marie', telephone = '0475123456', code_barre = 'CLIENT01' } = {}
) {
  const r = await pool.query(
    `INSERT INTO client (nom, prenom, telephone, code_barre)
     VALUES ($1, $2, $3, $4) RETURNING id_client`,
    [nom, prenom, telephone, code_barre]
  );
  return r.rows[0].id_client;
}

// Les 42 emplacements physiques + la ligne « SOL » (#190).
async function semerEmplacements(pool) {
  for (const e of genererEmplacements()) {
    await pool.query(
      `INSERT INTO emplacement (code_barre, etagere, niveau, position)
       VALUES ($1, $2, $3, $4)`,
      [e.code_barre, e.etagere, e.niveau, e.position]
    );
  }
  await pool.query("INSERT INTO emplacement (code_barre, est_au_sol) VALUES ('SOL', TRUE)");
}

// Renvoie l'id d'un emplacement à partir de son code lisible ('A1G', 'SOL', …).
async function idEmplacement(pool, codeBarre) {
  const r = await pool.query(
    'SELECT id_emplacement FROM emplacement WHERE code_barre = $1',
    [codeBarre]
  );
  return r.rows[0].id_emplacement;
}

module.exports = {
  creerPoolTest,
  preparerBase,
  viderTables,
  semerUtilisateurs,
  semerClient,
  semerEmplacements,
  idEmplacement,
  UUID_GERANTE,
  UUID_REPASSEUSE,
  UUID_REPASSEUSE_2,
  PIN_TEST,
};
