#!/bin/sh
# Rapatriement hors site des sauvegardes de manne_bulles, sur le PC de la gérante.
#
# Lancé par la tâche planifiée Windows via rapatrier-sauvegardes.cmd, dans Git Bash.
# Le VPS ne reçoit aucun argument : la clé SSH utilisée ici est associée, côté serveur, à
# une commande forcée qui débite l'archive et rien d'autre.
set -eu

HOTE=manne-sauvegardes          # alias défini dans ~/.ssh/config
DOSSIER="$HOME/sauvegardes-manne"
RETENTION_JOURS=7
JOURNAL="$DOSSIER/rapatriement.log"
ARCHIVE="$DOSSIER/.en-cours.tar"

mkdir -p "$DOSSIER"

journaliser() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$JOURNAL"
}

# Une tâche planifiée tourne sans que personne la regarde. Sans trace horodatée, un échec
# répété reste invisible et on CROIT avoir une copie hors site — le travers même contre
# lequel la procédure de restauration a été écrite. Toute sortie prématurée passe donc ici.
echouer() {
    journaliser "ECHEC — $1"
    rm -f "$ARCHIVE"
    exit 1
}

# BatchMode empêche toute question interactive (mot de passe, hôte inconnu) de figer la
# tâche planifiée : ssh échoue au lieu d'attendre indéfiniment.
#
# -T supprime la demande de terminal : la clé est posée avec « restrict », qui la refuse,
# et ssh écrirait sinon « PTY allocation request failed » sur stderr à chaque lancement
# manuel. Ce serait du bruit dans le journal, alors que celui-ci est le seul témoin du bon
# fonctionnement de la tâche planifiée.
ssh -T -o BatchMode=yes "$HOTE" > "$ARCHIVE" 2>> "$JOURNAL" \
    || echouer "connexion ou debit impossible"

# On vérifie AVANT de déballer : un transfert coupé (Wi-Fi, PC éteint en pleine tâche) ne
# doit jamais écraser une bonne copie par une copie tronquée. C'est la transposition exacte
# du « nom temporaire puis renommage » de sauvegarder-base.sh sur le VPS.
tar --list --file "$ARCHIVE" > /dev/null 2>&1 \
    || echouer "archive illisible (transfert interrompu ?)"

NOMBRE=$(tar --list --file "$ARCHIVE" | grep -c 'manne_bulles-.*\.dump$' || true)
[ "$NOMBRE" -gt 0 ] || echouer "archive valide mais sans aucune sauvegarde"

tar --extract --file "$ARCHIVE" --directory "$DOSSIER" || echouer "extraction impossible"
rm -f "$ARCHIVE"

# Purge UNIQUEMENT après un rapatriement réussi. Si le VPS est injoignable, le script s'est
# arrêté plus haut SANS rien supprimer : le jour où le serveur tombe pour de bon, la tâche
# planifiée ne doit pas effacer tranquillement la dernière copie qui restait. Une panne ne
# doit jamais détruire la sauvegarde censée la couvrir.
#
# tar restitue la date de modification d'origine des fichiers : l'âge mesuré ici est bien
# celui du dump, pas celui de son rapatriement. Sans cette propriété, plus rien ne serait
# jamais purgé.
find "$DOSSIER" -maxdepth 1 -type f -name 'manne_bulles-*.dump' \
     -mtime +$RETENTION_JOURS -delete

RESTANTES=$(find "$DOSSIER" -maxdepth 1 -type f -name 'manne_bulles-*.dump' | wc -l)
journaliser "OK — $NOMBRE rapatriee(s), $RESTANTES conservee(s)"
