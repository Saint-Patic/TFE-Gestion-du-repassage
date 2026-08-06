@echo off
REM Lanceur de l'agent d'impression, appele a l'ouverture de session Windows sur le poste
REM de la gerante. Procedure d'installation : deploiement/README.md.
REM
REM Le « cd /d %~dp0 » n'est PAS cosmetique : dotenv cherche le .env dans le repertoire
REM courant. Sans lui, MODE_SORTIE reste indefini, sortie.js retombe sur le mode
REM « fichier », et l'agent ecrit des PDF sans jamais imprimer — en repondant « ok »
REM a tout, donc sans aucun signe visible du probleme. Meme piege qu'au #270 avec la
REM passerelle SMS, dont le script de demarrage a besoin du meme « cd ».
cd /d "%~dp0"

title Agent d'impression - La Manne a Bulles
echo Agent d'impression : demarrage dans %CD%
node serveur.js

REM On n'arrive ici que si l'agent s'est arrete : garder la fenetre pour lire l'erreur.
echo.
echo L'agent d'impression s'est arrete. Lisez le message ci-dessus avant de fermer.
pause
