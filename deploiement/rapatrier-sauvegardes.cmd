@echo off
REM Enveloppe Windows du rapatriement des sauvegardes, appelee par la tache planifiee
REM « Manne - rapatriement des sauvegardes » sur le poste de la gerante.
REM Procedure d'installation : deploiement/README.md.
REM
REM (Pas d'accents dans ce fichier : la console cmd.exe ne les affiche pas correctement.)
REM
REM Le « cd /d %~dp0 » n'est PAS cosmetique : une tache planifiee demarre dans
REM C:\Windows\System32 et ne trouverait pas le script sh. Meme piege que pour
REM demarrer-agent.cmd et pour le script de demarrage de la passerelle SMS.
cd /d "%~dp0"

"%PROGRAMFILES%\Git\bin\bash.exe" rapatrier-sauvegardes.sh

REM Propage le code de sortie : sans cela le Planificateur afficherait « 0x0 » meme apres
REM un echec, et sa colonne « Resultat de la derniere execution » ne servirait a rien.
exit /b %ERRORLEVEL%
