// Règles de placement des mannes sur les étagères, partagées par l'encodage (#160/#180)
// et par la clôture (#260). Extraites de routes/commandes.js pour que la clôture puisse
// les appliquer À L'INTÉRIEUR de sa propre transaction, sans dupliquer l'invariant du #190.

// Erreur portant le statut HTTP à renvoyer, pour que l'appelant n'ait pas à le deviner.
function erreurPlacement(statut, message) {
  const erreur = new Error(message);
  erreur.statut = statut;
  return erreur;
}

// Valide la forme du tableau d'emplacements. Renvoie un message ou null.
function validerEmplacements(emplacements) {
  if (!Array.isArray(emplacements) || emplacements.length === 0) {
    return 'emplacements doit être un tableau non vide.';
  }
  for (const e of emplacements) {
    if (!e || typeof e.id_emplacement !== 'string' || !e.id_emplacement) {
      return 'Chaque emplacement doit avoir un id_emplacement.';
    }
    if (!Number.isInteger(e.nombre_mannes) || e.nombre_mannes < 1) {
      return 'nombre_mannes doit être un entier ≥ 1.';
    }
  }
  return null;
}

// Remplace la répartition des mannes d'une commande. À appeler DANS une transaction :
// `client` est un client transactionnel (pool.connect()), jamais le pool.
// Lève une erreur portant `.statut` : 400 si la somme ne correspond pas, 409 si une
// étagère cible est occupée par un autre client (invariant #190).
async function enregistrerPlacement(client, idCommande, idClient, nombreMannes, emplacements) {
  const total = emplacements.reduce((s, e) => s + e.nombre_mannes, 0);
  if (total !== nombreMannes) {
    throw erreurPlacement(400, `${total} manne(s) placée(s) pour ${nombreMannes} attendue(s).`);
  }

  // Invariant #190 : un emplacement (hors sol) ne peut contenir qu'un seul client.
  // La portée est bien la CASE et non l'étagère : un client peut répartir ses mannes sur
  // plusieurs emplacements, et deux clients peuvent occuper deux cases d'une même étagère.
  // (Formulation rectifiée au #330, où un test en base réelle a montré que la phrase
  // « une étagère = un seul client » ne correspondait à aucune ligne de code.)
  const ciblesDistinctes = [...new Set(emplacements.map((e) => e.id_emplacement))];
  for (const idEmp of ciblesDistinctes) {
    const conflit = await client.query(
      `SELECT 1
       FROM commande_emplacement ce
       JOIN commande c    ON c.id_commande = ce.id_commande
       JOIN emplacement e ON e.id_emplacement = ce.id_emplacement
       WHERE ce.id_emplacement = $1
         AND e.est_au_sol = FALSE
         AND ce.id_commande <> $2
         AND c.id_client <> $3
       LIMIT 1`,
      [idEmp, idCommande, idClient]
    );
    if (conflit.rowCount > 0) {
      throw erreurPlacement(409, 'Emplacement occupé par un autre client.');
    }
  }

  await client.query('DELETE FROM commande_emplacement WHERE id_commande = $1', [idCommande]);
  for (const e of emplacements) {
    await client.query(
      `INSERT INTO commande_emplacement (id_commande, id_emplacement, nombre_mannes)
       VALUES ($1, $2, $3)`,
      [idCommande, e.id_emplacement, e.nombre_mannes]
    );
  }
}

module.exports = { validerEmplacements, enregistrerPlacement };
