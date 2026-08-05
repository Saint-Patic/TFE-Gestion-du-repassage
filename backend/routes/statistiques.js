const express = require('express');
const authentifier = require('../middlewares/authentifier');
const exigerRole = require('../middlewares/exiger-role');
const { calculerIndicateurs } = require('../statistiques/calculs');

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Fabrique : routeur des statistiques de temps de repassage (US #300). Gérante uniquement.
// Routeur dédié plutôt qu'un ajout à routes/commandes.js, qui approche les 460 lignes.
function creerRouteurStatistiques(pool) {
  const routeur = express.Router();

  routeur.get('/', authentifier, exigerRole('gerante'), async (req, res) => {
    const { debut, fin } = req.query;
    if (!FORMAT_DATE.test(debut || '') || !FORMAT_DATE.test(fin || '')) {
      return res.status(400).json({ message: 'debut et fin sont requis au format AAAA-MM-JJ.' });
    }
    try {
      // Le travail est compté au moment où le repassage s'est TERMINÉ : on ancre sur la transition
      // vers « fait », ce qui restreint du même coup aux commandes dont le temps est définitif.
      // DISTINCT ON : si une commande portait plusieurs transitions vers « fait » — le workflow
      // linéaire l'interdit — on n'en compte qu'une, sans doubler le total.
      const resultat = await pool.query(
        `WITH terminees AS (
           SELECT DISTINCT ON (h.id_commande) h.id_commande, h.horodatage AS fin_repassage
           FROM historique_statut h
           WHERE h.nouveau_statut = 'fait'
           ORDER BY h.id_commande, h.horodatage ASC
         )
         SELECT u.id_utilisateur, u.nom AS repasseuse,
                count(*)::int AS nb_commandes,
                COALESCE(sum(c.temps_repassage_s), 0)::int AS temps_total_s,
                COALESCE(sum(c.nombre_mannes), 0)::int AS total_mannes
         FROM terminees t
         JOIN commande c ON c.id_commande = t.id_commande
         LEFT JOIN utilisateur u ON u.id_utilisateur = c.id_repasseuse
         WHERE t.fin_repassage >= $1::date AND t.fin_repassage < $2::date + 1
         GROUP BY u.id_utilisateur, u.nom
         ORDER BY u.nom`,
        [debut, fin]
      );

      const parRepasseuse = resultat.rows.map((r) => ({
        id_utilisateur: r.id_utilisateur,
        repasseuse: r.repasseuse,
        ...calculerIndicateurs({
          nbCommandes: r.nb_commandes,
          tempsTotalS: r.temps_total_s,
          totalMannes: r.total_mannes,
        }),
      }));

      // Le global est la SOMME des lignes, puis la même règle de calcul — jamais une moyenne de
      // moyennes, qui serait fausse dès que les repasseuses ont des volumes différents.
      const totaux = parRepasseuse.reduce(
        (acc, l) => ({
          nbCommandes: acc.nbCommandes + l.nbCommandes,
          tempsTotalS: acc.tempsTotalS + l.tempsTotalS,
          totalMannes: acc.totalMannes + l.totalMannes,
        }),
        { nbCommandes: 0, tempsTotalS: 0, totalMannes: 0 }
      );

      return res.json({ debut, fin, global: calculerIndicateurs(totaux), parRepasseuse });
    } catch {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
  });

  return routeur;
}

module.exports = creerRouteurStatistiques;
