# Déploiement — La Manne à Bulles

Ce dossier rassemble les fichiers de configuration du serveur et les procédures
d'exploitation. Le README principal donne la vue d'ensemble et la mise à jour courante ;
on trouve ici le détail, ainsi que les procédures qui ne concernent pas le serveur : la
passerelle SMS, les sauvegardes et leur restauration.

## Fichiers du dossier

| Fichier | Destination |
|---|---|
| `manne-backend.service` | `/etc/systemd/system/`, puis `sudo systemctl enable --now manne-backend` |
| `nginx-manne.conf` | `/etc/nginx/sites-available/manne`, puis lien dans `sites-enabled/` |
| `sauvegarder-base.sh` | `/usr/local/bin/` sur le serveur |
| `manne-sauvegarde.service`, `manne-sauvegarde.timer` | `/etc/systemd/system/` |
| `debiter-sauvegardes.sh` | `/usr/local/bin/debiter-sauvegardes` sur le serveur |
| `rapatrier-sauvegardes.sh`, `.cmd` | PC de la gérante |
| `installer-tache-rapatriement.ps1` | PC de la gérante, à exécuter une fois |
| `effectifs.sql` | requête de contrôle, utilisée à la restauration |

Le modèle du fichier d'environnement de production est `../backend/.env.example`. Les
valeurs réelles sont renseignées sur le serveur et ne sont jamais versionnées.

## Le serveur

### Emplacements

- Code : `/opt/manne`, dépôt cloné, propriétaire `debian`
- Backend : service systemd `manne-backend`, à l'écoute sur `127.0.0.1:3000`
- Frontend : build statique servi par nginx depuis `/opt/manne/frontend/dist`
- Base : PostgreSQL local, base `manne_bulles`

### Mettre à jour l'application

```bash
cd /opt/manne
git pull
cd backend && npm ci
cd ../frontend && npm ci && npm run build
sudo systemctl restart manne-backend
```

Le rebuild du frontend n'est pas facultatif dès qu'une modification touche l'interface :
sans lui, nginx continue de servir l'ancien build et la nouveauté reste invisible.

### Vulnérabilités signalées par npm

Après un `npm ci`, npm signale une vingtaine de vulnérabilités hautes. Elles proviennent
toutes de Jest, l'outil de test : le backend lance `node server.js` et ne charge jamais
Jest. `npm audit --omit=dev` renvoie zéro.

Pour ne même pas les voir apparaître, installer le backend avec `npm ci --omit=dev`, qui
ignore les dépendances de développement. Le frontend, lui, garde un `npm ci` complet : le
build a besoin de Vite et de TypeScript.

### HTTPS

Le TLS est géré par certbot, directement sur le serveur :

```bash
sudo certbot --nginx -d vps-a87c8d0b.vps.ovh.net
```

certbot ajoute le vhost `:443` et la redirection `:80 → :443` dans
`/etc/nginx/sites-available/manne`, et installe un renouvellement automatique par le timer
systemd `certbot.timer`.

Le `nginx-manne.conf` de ce dossier est le vhost HTTP de base. Une fois certbot passé, ne
pas le recopier par-dessus la configuration du serveur : cela écraserait la configuration
TLS. Les mises à jour applicatives, elles, ne touchent pas à nginx.

## La base de données

### Seeds initiaux

À lancer une fois sur une installation neuve. Les deux scripts sont idempotents.

```bash
cd /opt/manne/backend
node scripts/seed-utilisateurs.js
node scripts/seed-emplacements.js
```

Le second insère les emplacements physiques d'étagère, indispensables au scan à la
réception. Sortie attendue au premier passage, puis `0` aux suivants.

### Migrations

Le schéma versionné intègre toutes les migrations : une base neuve n'en réclame aucune.
Sur une base déjà en service, les jouer dans cet ordre. Toutes sont idempotentes,
rejouables sans risque, et affichent une ligne de confirmation. Elles lisent les
identifiants de la base dans `backend/.env`.

```bash
cd /opt/manne/backend
node scripts/ajouter-cintres-entr-rendus.js
node scripts/ajouter-au-sol.js
node scripts/ajouter-id-repasseuse.js
node scripts/ajouter-repassage-debut.js
node scripts/creer-sms-en-attente.js
node scripts/etendre-niveaux-emplacement.js
node scripts/rendre-id-client-nullable.js
```

## La passerelle SMS

Le serveur ne peut pas joindre le téléphone, qui est derrière un routeur domestique et
n'est pas toujours sur place. C'est donc la passerelle qui vient chercher les SMS à
envoyer, en HTTPS sortant. Aucun port n'est à ouvrir, et un message déposé pendant que le
téléphone est éteint partira au rallumage.

Le téléphone peut quitter le local sans aucune reconfiguration : l'appel étant sortant, la
passerelle fonctionne à l'identique sur le Wi-Fi de l'atelier et en 4G.

### Côté serveur

Générer le jeton partagé et le poser dans `backend/.env` :

```bash
openssl rand -hex 32
# puis dans backend/.env :  JETON_PASSERELLE=<la valeur générée>
sudo systemctl restart manne-backend
```

Le jeton est révocable à tout moment : on le change des deux côtés et on redémarre. S'il
est absent du `.env`, les routes `/api/sms` répondent `401` — elles ne deviennent jamais
publiques par omission.

### Côté téléphone

1. Installer F-Droid, ce qui suppose d'autoriser l'installation depuis une source inconnue.
2. Depuis F-Droid, installer Termux, Termux:API et Termux:Boot. Uniquement depuis F-Droid :
   les versions du Play Store sont abandonnées et l'API SMS n'y fonctionne plus.
3. Dans Termux :

   ```bash
   pkg install nodejs git termux-api
   git clone https://github.com/Saint-Patic/TFE-Gestion-du-repassage
   cd TFE-Gestion-du-repassage/passerelle-sms
   npm install --omit=dev
   cp .env.example .env
   ```

   Le dépôt étant public, `git clone` est plus commode qu'un transfert de fichiers.
4. Renseigner `.env` : `URL_API=https://vps-a87c8d0b.vps.ovh.net`, le même
   `JETON_PASSERELLE` que le serveur, et `MODE_ENVOI=console` pour la première mise en
   route.
5. Accorder la permission SMS à Termux:API, sans quoi `termux-sms-send` échoue.
6. Exclure Termux de l'optimisation de batterie, dans les réglages Android. Sans cela le
   mode Doze suspend la boucle après quelques minutes d'écran éteint.
7. Premier démarrage manuel, pour vérifier : `npm start`.

### Démarrage automatique

Le téléphone est éteint et rallumé régulièrement. Pour que la passerelle reparte seule,
créer `~/.termux/boot/demarrer-passerelle.sh` :

```sh
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
cd ~/TFE-Gestion-du-repassage/passerelle-sms
node index.js >> ~/passerelle.log 2>&1
```

Puis le rendre exécutable : `chmod +x ~/.termux/boot/demarrer-passerelle.sh`

Deux lignes de ce script ne sont pas cosmétiques :

- `termux-wake-lock` empêche Android d'endormir le processus dès l'écran éteint. Sans lui,
  les SMS partent avec des heures de retard, sans qu'aucune erreur n'apparaisse.
- Le `cd` est tout aussi obligatoire : `index.js` charge sa configuration avec dotenv, qui
  lit le `.env` du répertoire courant. Lancé depuis ailleurs, ce que fait Termux:Boot par
  défaut, le programme ne trouverait ni `URL_API` ni `JETON_PASSERELLE` et s'arrêterait sur
  son contrôle de démarrage, avec un message trompeur puisque le fichier existe.

Le journal s'accumule dans `~/passerelle.log`, consultable par `tail -f ~/passerelle.log`.

Un seul exemplaire de la passerelle doit tourner à la fois : le retrait d'un message ne
pose aucun verrou, donc deux instances enverraient les SMS en double. Avant tout démarrage
manuel, vérifier avec `pgrep -af "node index.js"`.

### Bascule en envoi réel

Une fois la mise en route validée en `MODE_ENVOI=console` — la passerelle vide la file et
journalise les envois sans consommer de SMS —, passer `MODE_ENVOI=sms` dans le `.env` et
relancer.

Toujours faire la première mise en route en `console` : c'est ce qui valide le jeton et la
connexion au serveur avant de consommer un vrai SMS. Un refus d'authentification apparaît
alors comme `Appel /en-attente refusé (HTTP 401)` dans le journal.

## Les sauvegardes

Un dump quotidien de `manne_bulles`, sept jours conservés sur le serveur, et une copie
rapatriée hors site. Le script tourne sous l'utilisateur `postgres` : l'authentification
`peer` s'applique, donc aucun mot de passe n'est stocké nulle part.

### Installation sur le serveur

```bash
# 1. Le script
sudo cp /opt/manne/deploiement/sauvegarder-base.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/sauvegarder-base.sh

# 2. Le dossier de destination
sudo mkdir -p /var/backups/manne
sudo chown postgres:debian /var/backups/manne
sudo chmod 2750 /var/backups/manne

# 3. Le service et son timer
sudo cp /opt/manne/deploiement/manne-sauvegarde.service /etc/systemd/system/
sudo cp /opt/manne/deploiement/manne-sauvegarde.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now manne-sauvegarde.timer
```

Le `2` en tête du `chmod` est le bit setgid : les fichiers créés héritent du groupe
`debian`, ce qui rend le rapatriement par SSH possible. `postgres` écrit, `debian` lit,
personne d'autre n'accède au dossier.

### Vérifier

```bash
# Le timer est-il armé, et pour quand ?
systemctl list-timers manne-sauvegarde

# Déclencher une sauvegarde immédiatement, sans attendre 2h30
sudo systemctl start manne-sauvegarde.service

# Qu'a-t-il fait ?
sudo journalctl -u manne-sauvegarde -n 20 --no-pager

# Le fichier est-il là, avec les bonnes permissions ?
ls -l /var/backups/manne
```

Attendu : un fichier `manne_bulles-AAAAMMJJ-HHMM.dump` en `-rw-r----- postgres debian`. Si
le groupe affiché est `postgres` et non `debian`, le bit setgid n'a pas été posé : reprendre
le `chmod 2750`.

Le `journalctl` demande `sudo`. Le service tourne sous `postgres`, et `debian` n'appartient
ni au groupe `adm` ni à `systemd-journal` : sans `sudo`, la commande répond « No entries »
alors que le journal existe.

### Restaurer

Procédure à connaître avant d'en avoir besoin.

```bash
# 1. Base temporaire
sudo -u postgres createdb manne_bulles_restauration

# 2. Restaurer le dump le plus récent, sélectionné automatiquement
DERNIER=$(ls -t /var/backups/manne/manne_bulles-*.dump | head -1)
echo "Restauration de $DERNIER"
sudo -u postgres pg_restore -d manne_bulles_restauration "$DERNIER"

# 3. Comparer les effectifs
sudo -u postgres psql -d manne_bulles              -f /opt/manne/deploiement/effectifs.sql
sudo -u postgres psql -d manne_bulles_restauration -f /opt/manne/deploiement/effectifs.sql

# 4. Supprimer la base temporaire
sudo -u postgres dropdb manne_bulles_restauration
```

Les deux sorties doivent être identiques ligne pour ligne. Si `postgres` ne peut pas lire
`/opt/manne`, copier d'abord le script : `cp /opt/manne/deploiement/effectifs.sql /tmp/`.

`effectifs.sql` utilise `count(*)` et non `n_live_tup` de `pg_stat_user_tables`. Cette
dernière est une estimation issue des statistiques du planificateur, qui ne sont pas encore
collectées sur une base fraîchement restaurée : elle afficherait des zéros et ferait
conclure à tort à une restauration ratée.

### Ce qui n'est pas sauvegardé

Seule la base l'est, et c'est voulu : le code applicatif, l'agent d'impression et la
passerelle SMS vivent dans Git. La base est la seule chose irremplaçable.

## Le rapatriement hors site

Les dumps ne vivent sur le serveur que sept jours, et sur une seule machine : perdre le
serveur, ce serait perdre la base. Une copie est donc rapatriée chaque jour sur le PC de la
gérante, allumé tous les jours ouvrables et où le dépôt est déjà cloné pour l'agent
d'impression.

Le mécanisme tient en une phrase : le PC de la gérante se connecte en SSH sans rien
demander, et le serveur lui débite une archive `tar` des sauvegardes. Ni `rsync` ni `scp`
ne sont utilisés — ils ne peuvent pas l'être, la clé étant associée à une commande forcée
côté serveur.

Cette clé n'ouvre pas de shell sur la production. Elle ne permet qu'une chose : recevoir
les sauvegardes. C'est délibéré, la machine étant un poste de bureau partagé dans un local
commercial. La clé d'Alexis, dans le même fichier, garde son accès complet : les
restrictions s'appliquent par clé.

### Sur le serveur

```bash
sudo cp /opt/manne/deploiement/debiter-sauvegardes.sh /usr/local/bin/debiter-sauvegardes
sudo chmod 755 /usr/local/bin/debiter-sauvegardes
```

Le script tourne sous `debian`, qui lit `/var/backups/manne` par le groupe, grâce au setgid
posé plus haut. Aucun `sudo`, aucun mot de passe. La ligne à ajouter dans
`~debian/.ssh/authorized_keys` est donnée à l'étape suivante, une fois la clé générée.

### Sur le PC de la gérante : la clé

Dans Git Bash, installé avec Git for Windows :

```bash
cd ~/chemin/vers/le/depot && git pull

ssh-keygen -t ed25519 -f ~/.ssh/manne-sauvegardes -C "pc-gerante-sauvegardes" -N ""
cat ~/.ssh/manne-sauvegardes.pub
```

La clé est générée sur place : sa partie privée ne transite jamais. Elle n'a pas de phrase
de passe, parce qu'une tâche planifiée ne peut pas en saisir une — ce qui est acceptable
précisément parce que la commande forcée réduit ce que la clé permet.

Copier la sortie de `cat`, puis, sur le serveur, ajouter une ligne à
`~debian/.ssh/authorized_keys` en préfixant la clé publique :

```
restrict,command="/usr/local/bin/debiter-sauvegardes" ssh-ed25519 AAAA... pc-gerante-sauvegardes
```

`restrict` désactive d'un coup le terminal, la redirection de ports, l'agent forwarding et
X11, et couvre aussi les capacités qu'OpenSSH ajouterait plus tard — ce qu'une liste de
`no-*` ne ferait pas.

Toujours dans Git Bash, créer `~/.ssh/config` :

```
Host manne-sauvegardes
    HostName vps-a87c8d0b.vps.ovh.net
    User debian
    IdentityFile ~/.ssh/manne-sauvegardes
    IdentitiesOnly yes
    ConnectTimeout 30
```

La première connexion se fait à la main, pour accepter l'empreinte du serveur :

```bash
ssh manne-sauvegardes > /tmp/essai.tar && tar -tf /tmp/essai.tar
```

Sans cette étape, la tâche planifiée échouerait à son premier tour : en `BatchMode`, ssh
refuse un hôte inconnu au lieu de poser la question.

### Sur le PC de la gérante : la tâche planifiée

```powershell
cd <depot>\deploiement
.\installer-tache-rapatriement.ps1
```

Si PowerShell refuse d'enregistrer la tâche, le relancer en tant qu'administrateur. Si la
politique d'exécution bloque le script :
`powershell -ExecutionPolicy Bypass -File .\installer-tache-rapatriement.ps1`.

La tâche tourne à 10h00 sous la session ouverte de la gérante, donc aucun mot de passe
n'est stocké. L'option `StartWhenAvailable` rattrape l'exécution si le PC était éteint —
c'est l'équivalent Windows du `Persistent=true` du timer systemd.

### Vérifier

```bash
# Dans Git Bash : lancer un rapatriement à la main
"$PROGRAMFILES/Git/bin/bash.exe" ~/chemin/vers/le/depot/deploiement/rapatrier-sauvegardes.sh
ls -l ~/sauvegardes-manne
tail -5 ~/sauvegardes-manne/rapatriement.log
```

Attendu : une ligne `OK — N rapatriee(s), M conservee(s)`. Le journal est le seul témoin
d'une tâche qui tourne sans que personne la regarde ; une ligne `ECHEC` répétée signale
qu'il n'y a plus de copie hors site, alors que tout semble normal par ailleurs.

Deux preuves à faire une fois. D'abord l'intégrité du transfert :

```bash
# sur le PC de la gérante
sha256sum ~/sauvegardes-manne/manne_bulles-*.dump
# sur le serveur
sha256sum /var/backups/manne/manne_bulles-*.dump
```

Les empreintes doivent être identiques, octet pour octet. Ensuite, que la clé est bien
bridée :

```bash
ssh manne-sauvegardes "cat /etc/passwd"
```

La commande doit renvoyer l'archive `tar`, et non le fichier demandé : l'argument du client
est ignoré.

### Rétention et protection des données

Sept jours des deux côtés, purgés automatiquement par le script, là où la conservation
était auparavant laissée à un ménage manuel que personne n'aurait fait sur ce poste.

La purge n'a lieu qu'après un rapatriement réussi. Si le serveur est injoignable, le script
s'arrête sans rien supprimer : le jour où il tombe pour de bon, la tâche planifiée ne doit
pas effacer la dernière copie qui reste.

Limite assumée : la copie hors site protège contre la perte du serveur, mais pas contre une
erreur logique découverte plus de sept jours après coup. Choix fait au nom de la
minimisation et de la limitation de conservation.

Ne pas placer `sauvegardes-manne` dans `Documents`, `Bureau` ou `OneDrive` : ces dossiers
sont souvent synchronisés vers un cloud sur un PC Windows grand public, et les données
personnelles des clients partiraient chez un sous-traitant non prévu. Le script utilise
`$HOME` — vérifier avec `echo $HOME` dans Git Bash que cela pointe bien sur un disque local
et non sur un lecteur réseau.

### Copie ponctuelle depuis un autre poste

La clé d'Alexis n'est pas restreinte : une copie ponctuelle reste possible sans passer par
ce dispositif.

```bash
mkdir -p ~/sauvegardes-manne
scp debian@vps-a87c8d0b.vps.ovh.net:/var/backups/manne/manne_bulles-*.dump ~/sauvegardes-manne/
```

## La base de test locale

Les tests en base réelle (`backend/tests-base/*.base.test.js`) tournent sur une base
dédiée, uniquement sur le poste de développement. À créer une seule fois :

```bash
sudo -u postgres psql -c "CREATE DATABASE manne_bulles_test OWNER manne_bulles_admin;"
sudo -u postgres psql -d manne_bulles_test -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

Deux raisons au `sudo -u postgres` et au `OWNER` :

- `CREATE EXTENSION` exige le superutilisateur. L'extension `pgcrypto` est nécessaire aux
  `DEFAULT gen_random_uuid()` des cinq clés primaires du schéma.
- `OWNER manne_bulles_admin` évite le piège PostgreSQL 15 et suivants déjà rencontré sur
  `manne_bulles` : le propriétaire de la base dispose des droits sur le schéma `public` via
  `pg_database_owner`, donc pas de `GRANT ALL ON SCHEMA public` à ajouter.

Le schéma est ensuite chargé automatiquement depuis `database/schema.sql` au démarrage de
chaque fichier de test. Rien à faire à la main, et aucune migration à rejouer.

### Jamais sur le serveur

Cette base n'existe que sur le poste de développement. Les tests ne doivent jamais viser la
base de production : un test de clôture insère dans `sms_en_attente`, et la passerelle
interroge cette file toutes les 30 secondes sans pouvoir distinguer une ligne de test. Elle
enverrait un vrai SMS à un vrai client. S'y ajoutent les `DELETE` et `UPDATE` sur des
commandes réelles.

Un garde-fou l'applique dans le code, `backend/tests-base/config-base.js` : la suite refuse
de démarrer si le nom de la base ne se termine pas par `_test`.

### Commandes

```bash
cd backend
npm test            # tout, en série : rapides et base réelle
npm run test:rapide # seulement les rapides, en parallèle, sans PostgreSQL
npm run test:coverage
```

`--runInBand`, présent dans le script `test`, est indispensable : plusieurs fichiers de test
qui vident et remplissent les mêmes tables en parallèle produiraient des échecs
intermittents. Coût mesuré sur l'ensemble de la suite : 1,2 seconde.
