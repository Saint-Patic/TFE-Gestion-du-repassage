# Déploiement — La Manne à Bulles

## Fichiers

- `manne-backend.service` → à copier dans `/etc/systemd/system/`, puis
  `sudo systemctl enable --now manne-backend`.
- `nginx-manne.conf` → à copier dans `/etc/nginx/sites-available/manne`, puis lien
  symbolique dans `/etc/nginx/sites-enabled/` ; `sudo nginx -t && sudo systemctl reload nginx`.
- `../backend/.env.example` → modèle du `.env` de prod (valeurs renseignées sur le serveur,
  **jamais** committé).

## Mettre à jour l'application

```bash
cd /opt/manne
git pull
cd backend && npm ci
cd ../frontend && npm ci && npm run build
sudo systemctl restart manne-backend
```

### Vulnérabilités signalées
Après un npm ci, npm signale **20 vulnérabilités high***. Elles proviennent uniquement de Jest, l'outil de test, et n'ont aucun impact en production : le backend lance `node server.js` et n'utilise jamais Jest. Vérifiable avec `npm audit --omit=dev`, qui renvoie **0 vulnerabilities**.
Pour ne même pas les voir apparaître sur le serveur, installer avec `npm ci --omit=dev : seules les dépendances de production sont installées (les devDependencies sont ignorées).

## Seed initial des emplacements (étagères)

Les 42 emplacements physiques (`A1G`…`E3D`) doivent exister en base pour l'encodage
(scan des emplacements, US #160). À lancer **une fois** après le premier déploiement qui
inclut #160. Le script est **idempotent** (relançable sans créer de doublon) :

```bash
cd /opt/manne/backend
node scripts/seed-emplacements.js
```

Sortie attendue : `Emplacements insérés : 42 (sur 42).` (puis `0 (sur 42).` aux relances).
Le script lit les identifiants de la base dans `backend/.env`.

## Migration — colonne cintres_entr_rendus (US #170)

La base prod existe déjà : la nouvelle colonne `commande.cintres_entr_rendus` (booléen « le client
a rendu des cintres entreprise ») est ajoutée par un script **idempotent** (`ADD COLUMN IF NOT
EXISTS`), à lancer **une fois** après le déploiement qui inclut #170 :

```bash
cd /opt/manne/backend
node scripts/ajouter-cintres-entr-rendus.js
```

Sortie attendue : `Colonne cintres_entr_rendus : présente (ajoutée si nécessaire).` Rejouable sans
risque. Le script lit les identifiants de la base dans `backend/.env`.

## Migrations de base de données (ordre d'exécution)

Liste complète des migrations, dans l'ordre. Toutes sont **idempotentes** (rejouables sans risque) et se
lancent depuis `/opt/manne/backend`. Utile pour une installation neuve comme pour vérifier qu'un
serveur existant est à jour :

```bash
cd /opt/manne/backend
node scripts/ajouter-au-sol.js              # US #190 — emplacement « au sol »
node scripts/ajouter-id-repasseuse.js       # US #200 — attribution des commandes
node scripts/ajouter-repassage-debut.js     # US #220 — démarrage du timer
node scripts/creer-sms-en-attente.js        # US #240 — file d'attente des SMS
```

Chacune affiche une ligne de confirmation. Les scripts lisent les identifiants de la base dans
`backend/.env`.

## Emplacements sur le serveur

- Code : `/opt/manne` (dépôt cloné, propriétaire `debian`)
- Backend : service systemd `manne-backend` (écoute `127.0.0.1:3000`)
- Frontend : build statique servi par nginx depuis `/opt/manne/frontend/dist`
- Base : PostgreSQL local, base `manne_bulles`

## HTTPS (Let's Encrypt)

Le TLS est géré par **certbot** (plugin nginx) directement sur le serveur :
`sudo certbot --nginx -d vps-a87c8d0b.vps.ovh.net`. certbot ajoute le vhost `:443`
et la redirection `:80 → :443` dans `/etc/nginx/sites-available/manne`, et installe
un **renouvellement automatique** (timer systemd `certbot.timer`).

⚠️ `nginx-manne.conf` de ce dossier est le **vhost de base HTTP** (server_name). Après
le passage de certbot, **ne pas re-copier** ce fichier par-dessus la conf serveur, sinon
on écrase la configuration TLS. Les mises à jour applicatives (`git pull` + rebuild +
`systemctl restart manne-backend`) ne touchent pas à la conf nginx.

## Passerelle SMS (US #240, mise en service #270)

Le backend ne peut pas joindre le téléphone (NAT domestique, et le téléphone n'est pas toujours sur
place) : c'est **la passerelle qui vient chercher** les SMS à envoyer, en HTTPS sortant. Aucun port
n'est à ouvrir, et un SMS déposé pendant que le téléphone est éteint partira au rallumage.

**Le téléphone peut quitter le local** — le soir, le week-end — **sans aucune reconfiguration** :
l'appel étant sortant, la passerelle fonctionne à l'identique sur le Wi-Fi de l'atelier et en 4G.

### Côté VPS

Générer le jeton partagé et le poser dans `backend/.env` :

```bash
openssl rand -hex 32
# puis dans backend/.env :  JETON_PASSERELLE=<la valeur générée>
sudo systemctl restart manne-backend
```

Le jeton est révocable à tout moment : on le change des deux côtés et on redémarre. S'il est absent du
`.env`, les routes `/api/sms` répondent `401` — elles ne deviennent jamais publiques par omission.

### Côté téléphone Android

1. Installer **F-Droid** (il faut autoriser l'installation depuis une source inconnue).
2. Depuis F-Droid, installer **Termux**, **Termux:API** et **Termux:Boot**.
   ⚠️ **Uniquement depuis F-Droid** : les versions du Play Store sont abandonnées et l'API SMS n'y
   fonctionne plus.
3. Dans Termux :

   ```bash
   pkg install nodejs git termux-api
   git clone https://github.com/Saint-Patic/TFE-Gestion-du-repassage
   cd TFE-Gestion-du-repassage/passerelle-sms
   npm install --omit=dev
   cp .env.example .env
   ```

   Le dépôt étant public, `git clone` est bien plus commode qu'un transfert de fichiers.
4. Renseigner `.env` : `URL_API=https://vps-a87c8d0b.vps.ovh.net`, le **même** `JETON_PASSERELLE` que
   le VPS, et `MODE_ENVOI=console` pour la première mise en route.
5. Accorder la **permission SMS** à Termux:API, sinon `termux-sms-send` échoue.
6. **Exclure Termux de l'optimisation de batterie** (Android → Batterie → applications non
   optimisées), sans quoi le mode Doze suspend la boucle après quelques minutes d'écran éteint.
7. Premier démarrage manuel, pour vérifier : `npm start`.

### Démarrage automatique (Termux:Boot)

Le téléphone sera éteint et rallumé régulièrement. Pour que la passerelle reparte seule, créer
`~/.termux/boot/demarrer-passerelle.sh` :

```sh
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
cd ~/TFE-Gestion-du-repassage/passerelle-sms
node index.js >> ~/passerelle.log 2>&1
```

Puis le rendre exécutable : `chmod +x ~/.termux/boot/demarrer-passerelle.sh`

Deux lignes de ce script ne sont pas cosmétiques :

- **`termux-wake-lock`** empêche Android d'endormir le processus dès l'écran éteint. Sans lui, les SMS
  partent avec des heures de retard, sans qu'aucune erreur n'apparaisse.
- **Le `cd`** est tout aussi obligatoire : `index.js` charge sa configuration avec `dotenv`, qui lit le
  `.env` du **répertoire courant**. Lancé depuis ailleurs — ce que fait Termux:Boot par défaut — le
  programme ne trouverait ni `URL_API` ni `JETON_PASSERELLE` et s'arrêterait sur son contrôle de
  démarrage, avec un message trompeur puisque le fichier existe bel et bien.

Le journal s'accumule dans `~/passerelle.log`, consultable par `tail -f ~/passerelle.log`.

### Bascule en envoi réel

Une fois la mise en route validée en `MODE_ENVOI=console` — la passerelle vide la file et journalise
les envois **sans consommer de SMS** —, passer `MODE_ENVOI=sms` dans le `.env` et relancer.

Toujours faire la première mise en route en `console` : c'est ce qui valide le jeton et la connexion au
VPS **avant** de consommer un vrai SMS. Un refus d'authentification apparaît alors comme
`Appel /en-attente refusé (HTTP 401)` dans le journal.

## Sauvegardes automatisées de la base (US #310)

Un dump quotidien de `manne_bulles`, sept jours conservés sur le VPS, et une copie rapatriée hors
site. Le script tourne sous l'utilisateur **`postgres`** : l'authentification `peer` s'applique, donc
**aucun mot de passe n'est stocké nulle part**.

### Installation sur le VPS

```bash
# 1. Le script
sudo cp /opt/manne/deploiement/sauvegarder-base.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/sauvegarder-base.sh

# 2. Le dossier de destination
#    setgid (le 2 en tête) : les fichiers créés héritent du groupe `debian`, ce qui permet le
#    rapatriement par SSH. postgres écrit, debian lit, personne d'autre n'accède.
sudo mkdir -p /var/backups/manne
sudo chown postgres:debian /var/backups/manne
sudo chmod 2750 /var/backups/manne

# 3. Le service et son timer
sudo cp /opt/manne/deploiement/manne-sauvegarde.service /etc/systemd/system/
sudo cp /opt/manne/deploiement/manne-sauvegarde.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now manne-sauvegarde.timer
```

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

Attendu : un fichier `manne_bulles-AAAAMMJJ-HHMM.dump` en `-rw-r----- postgres debian`.
Si le groupe affiché est `postgres` et non `debian`, le bit setgid n'a pas été posé — reprendre le
`chmod 2750`.

### Rapatriement hors site (PC de la gérante)

Les dumps ne vivent sur le VPS que sept jours, et sur une seule machine : **perdre le VPS, ce serait
perdre la base**. Une copie est donc rapatriée chaque jour sur le PC de la gérante — allumé tous les
jours ouvrables, sur place, et où le dépôt est déjà cloné pour l'agent d'impression.

Le mécanisme tient en une phrase : **le PC de la gérante se connecte en SSH sans rien demander, et le
VPS lui débite une archive `tar` des sauvegardes.** Ni `rsync` ni `scp` ne sont utilisés — ils ne
peuvent pas l'être, la clé étant associée à une **commande forcée** côté serveur.

⚠️ **La clé du PC de la gérante n'ouvre PAS de shell sur la production.** Elle ne permet qu'une chose :
recevoir les sauvegardes. C'est délibéré : cette machine est un poste de bureau partagé, dans un local
commercial. La clé d'Alexis, dans le même fichier, garde son accès complet — les restrictions
s'appliquent **par clé**.

#### 1. Sur le VPS

```bash
sudo cp /opt/manne/deploiement/debiter-sauvegardes.sh /usr/local/bin/debiter-sauvegardes
sudo chmod 755 /usr/local/bin/debiter-sauvegardes
```

Le script tourne sous `debian`, qui lit `/var/backups/manne` **par le groupe** grâce au setgid posé
plus haut. Aucun `sudo`, aucun mot de passe.

La ligne à ajouter dans `~debian/.ssh/authorized_keys` est donnée à l'étape 2, une fois la clé
générée.

#### 2. Sur le PC de la gérante — la clé

Dans **Git Bash** (installé avec Git for Windows) :

```bash
cd ~/chemin/vers/le/depot && git pull

ssh-keygen -t ed25519 -f ~/.ssh/manne-sauvegardes -C "pc-gerante-sauvegardes" -N ""
cat ~/.ssh/manne-sauvegardes.pub
```

La clé est générée **ici** : sa partie privée ne transite jamais. Pas de phrase de passe, parce
qu'une tâche planifiée ne peut pas en saisir une — c'est acceptable *précisément parce que* la
commande forcée réduit ce que la clé permet.

Copier la sortie de `cat`, puis sur le VPS ajouter **une ligne** à `~debian/.ssh/authorized_keys`, en
préfixant la clé publique par :

```
restrict,command="/usr/local/bin/debiter-sauvegardes" ssh-ed25519 AAAA... pc-gerante-sauvegardes
```

`restrict` désactive d'un coup terminal, redirection de ports, agent forwarding et X11 — et couvre
aussi les capacités qu'OpenSSH ajouterait plus tard, ce qu'une liste de `no-*` ne ferait pas.

Toujours dans Git Bash, créer `~/.ssh/config` :

```
Host manne-sauvegardes
    HostName vps-a87c8d0b.vps.ovh.net
    User debian
    IdentityFile ~/.ssh/manne-sauvegardes
    IdentitiesOnly yes
    ConnectTimeout 30
```

⚠️ **Première connexion à faire à la main**, pour accepter l'empreinte du serveur :

```bash
ssh manne-sauvegardes > /tmp/essai.tar && tar -tf /tmp/essai.tar
```

Sans cette étape, la tâche planifiée échouera à son premier tour : en `BatchMode`, ssh **refuse** un
hôte inconnu au lieu de poser la question.

#### 3. Sur le PC de la gérante — la tâche planifiée

```powershell
cd <depot>\deploiement
.\installer-tache-rapatriement.ps1
```

Si PowerShell refuse d'enregistrer la tâche, le relancer **en tant qu'administrateur**. Si la
politique d'exécution bloque le script :
`powershell -ExecutionPolicy Bypass -File .\installer-tache-rapatriement.ps1`.

La tâche tourne à **10h00 sous la session ouverte de la gérante** : aucun mot de passe n'est stocké.
L'option `StartWhenAvailable` rattrape l'exécution si le PC était éteint — c'est l'équivalent Windows
du `Persistent=true` du timer systemd.

#### Vérifier

```bash
# Dans Git Bash : lancer un rapatriement à la main
"$PROGRAMFILES/Git/bin/bash.exe" ~/chemin/vers/le/depot/deploiement/rapatrier-sauvegardes.sh
ls -l ~/sauvegardes-manne
tail -5 ~/sauvegardes-manne/rapatriement.log
```

Attendu : une ligne `OK — N rapatriee(s), M conservee(s)`. Le journal est le seul témoin d'une tâche
qui tourne sans que personne la regarde — **une ligne `ECHEC` répétée est le signal qu'il n'y a plus
de copie hors site**, alors que tout semble normal par ailleurs.

Preuve que le transfert est intègre, à faire une fois :

```bash
# sur le PC de la gérante
sha256sum ~/sauvegardes-manne/manne_bulles-*.dump
# sur le VPS
sha256sum /var/backups/manne/manne_bulles-*.dump
```

Les empreintes doivent être identiques, octet pour octet.

Preuve que la clé est bien bridée :

```bash
ssh manne-sauvegardes "cat /etc/passwd"
```

Doit renvoyer **l'archive tar**, pas le fichier demandé : l'argument du client est ignoré.

#### Rétention et RGPD

**7 jours des deux côtés**, purgés automatiquement par le script — là où la conservation était
auparavant laissée à un ménage manuel que personne n'aurait fait sur ce poste.

⚠️ **La purge n'a lieu qu'après un rapatriement réussi.** Si le VPS est injoignable, le script
s'arrête sans rien supprimer : le jour où le serveur tombe pour de bon, la tâche planifiée ne doit pas
effacer tranquillement la dernière copie qui reste.

Limite assumée : la copie hors site protège contre la perte du serveur, **pas contre une erreur
logique découverte plus de sept jours après coup**. Choix fait au nom de la minimisation et de la
limitation de conservation.

⚠️ **Ne pas placer `sauvegardes-manne` dans `Documents`, `Bureau` ou `OneDrive`.** Ces dossiers sont
souvent synchronisés vers le cloud sur un PC Windows grand public : les données personnelles des
clientes partiraient chez un sous-traitant non prévu. Le script utilise `$HOME` — vérifier avec
`echo $HOME` dans Git Bash que cela pointe bien sur un **disque local** et non sur un lecteur réseau.

#### Depuis le portable d'Alexis

Sa clé n'est pas restreinte : une copie ponctuelle reste possible sans passer par ce dispositif.

```bash
mkdir -p ~/sauvegardes-manne
scp debian@vps-a87c8d0b.vps.ovh.net:/var/backups/manne/manne_bulles-*.dump ~/sauvegardes-manne/
```

### Restaurer — procédure à connaître AVANT d'en avoir besoin

```bash
# 1. Base temporaire
sudo -u postgres createdb manne_bulles_restauration

# 2. Restaurer le dump le plus récent (pas de nom à recopier : on le sélectionne)
DERNIER=$(ls -t /var/backups/manne/manne_bulles-*.dump | head -1)
echo "Restauration de $DERNIER"
sudo -u postgres pg_restore -d manne_bulles_restauration "$DERNIER"

# 3. Comparer les effectifs (le script est versionné dans le dépôt)
sudo -u postgres psql -d manne_bulles -f /opt/manne/deploiement/effectifs.sql
sudo -u postgres psql -d manne_bulles_restauration -f /opt/manne/deploiement/effectifs.sql

# 4. Supprimer la base de test
sudo -u postgres dropdb manne_bulles_restauration
```

Le script `deploiement/effectifs.sql` est versionné : inutile de le retaper. Si `postgres` ne peut
pas lire `/opt/manne`, le copier d'abord : `cp /opt/manne/deploiement/effectifs.sql /tmp/`.

⚠️ Il utilise `count(*)` et **non** `n_live_tup` de `pg_stat_user_tables` : cette dernière est une
estimation issue des statistiques du planificateur, qui ne sont pas encore collectées sur une base
fraîchement restaurée. Elle afficherait des zéros et ferait conclure à tort à une restauration ratée.

Les deux sorties doivent être **identiques ligne pour ligne**.

### Ce qui n'est pas sauvegardé

Seule la base l'est, et c'est voulu : le code applicatif, l'agent d'impression et la passerelle SMS
vivent dans Git. La base est la seule chose irremplaçable.

## Base de test locale (US #330)

Les tests d'intégration en base réelle (`backend/tests-base/*.base.test.js`) tournent sur une base
dédiée, **uniquement sur le poste de développement**. À créer une seule fois :

```bash
sudo -u postgres psql -c "CREATE DATABASE manne_bulles_test OWNER manne_bulles_admin;"
sudo -u postgres psql -d manne_bulles_test -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

Deux raisons au `sudo -u postgres` et au `OWNER` :

- `CREATE EXTENSION` exige le **superutilisateur**. L'extension `pgcrypto` est nécessaire aux
  `DEFAULT gen_random_uuid()` des cinq clés primaires du schéma.
- `OWNER manne_bulles_admin` évite le piège **PostgreSQL 15+** déjà rencontré sur `manne_bulles` : le
  propriétaire de la base dispose des droits sur le schéma `public` via `pg_database_owner`, donc pas
  de `GRANT ALL ON SCHEMA public` à ajouter.

Le schéma est ensuite chargé automatiquement depuis `database/schema.sql` au démarrage de chaque
fichier de test — rien à faire à la main, et aucune migration à rejouer (le schéma les intègre toutes).

### ⚠️ Jamais sur le VPS

Cette base n'existe **que** sur le poste de développement. Les tests ne doivent jamais viser la base de
production : un test de clôture insère dans `sms_en_attente`, et la passerelle Termux interroge cette
file toutes les 30 s sans pouvoir distinguer une ligne de test — elle enverrait un **vrai SMS à une
vraie cliente**. S'y ajoutent les `DELETE`/`UPDATE` sur des commandes réelles.

Un garde-fou l'applique dans le code (`backend/tests-base/config-base.js`) : la suite refuse de démarrer
si le nom de la base ne finit pas par `_test`.

### Commandes

```bash
cd backend
npm test            # tout, en série (--runInBand) : rapides + base
npm run test:rapide # seulement les rapides, en parallèle, sans PostgreSQL
npm run test:coverage
```

`--runInBand` est indispensable : plusieurs fichiers de test qui vident et remplissent les mêmes tables
en parallèle produiraient des échecs intermittents. Coût mesuré sur l'ensemble de la suite : **+1,2 s**.
