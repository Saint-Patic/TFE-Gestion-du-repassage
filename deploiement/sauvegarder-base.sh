#!/bin/sh
# Sauvegarde quotidienne de la base manne_bulles (US #310).
#
# Exécuté par systemd sous l'utilisateur postgres : l'authentification `peer` s'applique,
# donc AUCUN mot de passe n'apparaît ici, ni dans une variable d'environnement, ni dans un
# fichier de configuration.
set -eu

DOSSIER=/var/backups/manne
RETENTION_JOURS=7
HORODATAGE=$(date +%Y%m%d-%H%M)
FINAL="$DOSSIER/manne_bulles-$HORODATAGE.dump"
TEMPORAIRE="$DOSSIER/.en-cours-$HORODATAGE.dump"

# 640 pour les fichiers créés : lisibles par le groupe (pour le rapatriement), par personne d'autre.
umask 027

# Nettoie un fichier temporaire laissé par une exécution interrompue : avec `set -e`, un
# pg_dump en échec sort du script avant le `mv` et abandonnerait sinon son fichier partiel.
find "$DOSSIER" -name '.en-cours-*.dump' -type f -mtime +1 -delete 2>/dev/null || true

# On écrit d'abord sous un nom temporaire, puis on renomme : un dump interrompu ne doit
# JAMAIS laisser un fichier qui ressemble à une sauvegarde valide. Une sauvegarde tronquée
# est pire que pas de sauvegarde du tout, parce qu'on croit l'avoir.
pg_dump --format=custom manne_bulles > "$TEMPORAIRE"
mv "$TEMPORAIRE" "$FINAL"

find "$DOSSIER" -name 'manne_bulles-*.dump' -type f -mtime +$RETENTION_JOURS -delete

echo "Sauvegarde terminée : $FINAL"
