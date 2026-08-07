#!/bin/sh
# Débite les sauvegardes de manne_bulles sur la sortie standard, sous forme d'archive tar.
#
# Ce script est la COMMANDE FORCÉE associée à la clé SSH du PC de la gérante : quoi que le
# client demande, c'est ceci qui s'exécute. Il ne lit donc AUCUN argument et ignore
# délibérément SSH_ORIGINAL_COMMAND — pas de paramètre, pas de surface d'injection, aucun
# chemin arbitraire lisible depuis cette clé.
#
# Il n'écrit rien et ne supprime rien : il est en lecture seule par construction.
#
# Installation : /usr/local/bin/debiter-sauvegardes (root:root, mode 755).
set -eu

DOSSIER=/var/backups/manne

# Les diagnostics partent sur stderr : stdout transporte l'archive et doit rester propre,
# faute de quoi le tar arriverait corrompu à l'autre bout.
cd "$DOSSIER" 2>/dev/null || {
    echo "debiter-sauvegardes : $DOSSIER introuvable ou illisible" >&2
    exit 1
}

# Sélection POSITIVE : on n'archive que ce qui porte le nom d'une sauvegarde terminée. Les
# fichiers .en-cours-*.dump de sauvegarder-base.sh sont donc exclus par construction, sans
# avoir à les nommer. Un dump en cours d'écriture ne doit JAMAIS quitter le serveur :
# rapatrier hors site un fichier tronqué serait pire que ne rien rapatrier, puisqu'on
# croirait avoir une copie.
if [ "$(find . -maxdepth 1 -type f -name 'manne_bulles-*.dump' | wc -l)" -eq 0 ]; then
    # Zéro sauvegarde est une anomalie en soi (le timer tourne toutes les nuits). On échoue
    # bruyamment : côté client, un échec empêche la purge locale, ce qui est exactement le
    # comportement voulu.
    echo "debiter-sauvegardes : aucune sauvegarde dans $DOSSIER" >&2
    exit 1
fi

find . -maxdepth 1 -type f -name 'manne_bulles-*.dump' -print0 |
    tar --create --file - --null --files-from -
