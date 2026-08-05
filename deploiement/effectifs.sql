-- Effectifs de chaque table (US #310).
-- Sert à comparer une base restaurée à la base d'origine : les deux sorties doivent être
-- identiques ligne pour ligne.
--
-- ⚠️ count(*) et NON n_live_tup de pg_stat_user_tables : cette dernière est une estimation
-- issue des statistiques du planificateur, qui ne sont pas encore collectées sur une base
-- fraîchement restaurée. Elle afficherait des zéros et ferait conclure à tort à un échec.
SELECT 'client' AS table_, count(*) FROM client
UNION ALL SELECT 'commande', count(*) FROM commande
UNION ALL SELECT 'commande_emplacement', count(*) FROM commande_emplacement
UNION ALL SELECT 'emplacement', count(*) FROM emplacement
UNION ALL SELECT 'historique_statut', count(*) FROM historique_statut
UNION ALL SELECT 'sms_en_attente', count(*) FROM sms_en_attente
UNION ALL SELECT 'utilisateur', count(*) FROM utilisateur
ORDER BY 1;
