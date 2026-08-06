require('dotenv').config();
const { Pool } = require('pg');
const { hacherPin, verifierPin } = require('../auth/pin');

// Met à jour le NOM et/ou le PIN des utilisatrices EXISTANTES, sans toucher à leurs UUID.
//
// Pourquoi un script distinct de seed-utilisateurs.js : celui-ci ne crée qu'une fois (il
// s'arrête dès que la table n'est pas vide). Sur une base déjà peuplée, modifier son
// contenu ou le .env n'a donc aucun effet.
//
// ⚠️ Ne JAMAIS supprimer puis re-semer les utilisatrices. `historique_statut.id_utilisateur`
// et `commande.id_repasseuse` les référencent : la clé étrangère bloquerait l'opération, ou
// bien on effacerait la trace de qui a fait quoi — exactement la valeur probante en cas de
// litige pour laquelle `historique_statut` a été conçue. On modifie en place.
//
// Chaque valeur est OPTIONNELLE : une variable absente laisse le champ correspondant tel
// quel. On peut donc ne changer qu'un seul PIN, ou seulement un nom.
//
// ⚠️ Les vrais prénoms vont dans .env, JAMAIS dans un fichier versionné : le dépôt est
// public. Les noms génériques du seed sont volontairement non identifiants.
//
// Usage :
//   node scripts/mettre-a-jour-utilisateurs.js --simuler   (n'écrit rien, affiche le plan)
//   node scripts/mettre-a-jour-utilisateurs.js

// Les postes, dans l'ordre. Le rang des repasseuses suit `ORDER BY id_utilisateur` :
// arbitraire mais STABLE, donc le script reste rejouable. Utiliser le nom actuel comme clé
// serait au contraire ininterprétable au second passage, une fois les noms changés.
// Pour une troisième repasseuse : ajouter une ligne { cle: 'REPASSEUSE_3', … , rang: 2 }.
const POSTES = [
  { cle: 'GERANTE', role: 'gerante', rang: 0 },
  { cle: 'REPASSEUSE_1', role: 'repasseuse', rang: 0 },
  { cle: 'REPASSEUSE_2', role: 'repasseuse', rang: 1 },
];

async function mettreAJour() {
  const simulation = process.argv.includes('--simuler');
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const { rows } = await pool.query(
      'SELECT id_utilisateur, nom, role, code_pin_hache FROM utilisateur ORDER BY role, id_utilisateur'
    );
    if (rows.length === 0) {
      throw new Error('Aucune utilisatrice en base : lancez d’abord scripts/seed-utilisateurs.js.');
    }

    const parRole = new Map();
    for (const u of rows) {
      if (!parRole.has(u.role)) parRole.set(u.role, []);
      parRole.get(u.role).push(u);
    }

    if (simulation) {
      console.log('— Simulation : aucune écriture en base —');
    }

    let modifiees = 0;

    for (const poste of POSTES) {
      const nomVoulu = process.env[`NOM_${poste.cle}`];
      const pinVoulu = process.env[`PIN_${poste.cle}`];
      if (!nomVoulu && !pinVoulu) continue;

      const utilisateur = (parRole.get(poste.role) || [])[poste.rang];
      if (!utilisateur) {
        console.warn(
          `${poste.cle} : aucune utilisatrice correspondante en base ` +
            `(rôle « ${poste.role} », rang ${poste.rang + 1}) — ignorée.`
        );
        continue;
      }

      const affectations = [];
      const valeurs = [];
      const resume = [];

      if (nomVoulu && nomVoulu !== utilisateur.nom) {
        valeurs.push(nomVoulu);
        affectations.push(`nom = $${valeurs.length}`);
        resume.push(`nom « ${utilisateur.nom} » → « ${nomVoulu} »`);
      }

      if (pinVoulu) {
        // Déjà le bon PIN ? On ne réécrit pas. bcrypt utilise un sel aléatoire : réhacher à
        // chaque passage produirait un hachage différent à état identique, et le script
        // annoncerait une modification qui n'en est pas une.
        const dejaBon = await verifierPin(pinVoulu, utilisateur.code_pin_hache);
        if (!dejaBon) {
          valeurs.push(await hacherPin(pinVoulu)); // lève si le PIN n'a pas 4 chiffres
          affectations.push(`code_pin_hache = $${valeurs.length}`);
          resume.push('PIN modifié');
        }
      }

      if (affectations.length === 0) {
        console.log(`${utilisateur.nom} : déjà à jour.`);
        continue;
      }

      // Le PIN n'est journalisé ni en clair ni haché — on n'annonce que le fait.
      console.log(`${poste.cle} : ${resume.join(', ')}${simulation ? ' (simulé)' : ''}`);

      if (!simulation) {
        valeurs.push(utilisateur.id_utilisateur);
        await pool.query(
          `UPDATE utilisateur SET ${affectations.join(', ')} WHERE id_utilisateur = $${valeurs.length}`,
          valeurs
        );
      }
      modifiees += 1;
    }

    if (modifiees === 0) {
      console.log('Aucune modification nécessaire.');
    } else {
      console.log(
        simulation
          ? `${modifiees} utilisatrice(s) seraient modifiée(s). Relancez sans --simuler pour appliquer.`
          : `${modifiees} utilisatrice(s) modifiée(s).`
      );
    }
  } finally {
    await pool.end();
  }
}

mettreAJour().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
