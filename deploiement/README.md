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

Les 54 emplacements physiques (`A1G`…`E3D`) doivent exister en base pour l'encodage
(scan des emplacements, US #160). À lancer **une fois** après le premier déploiement qui
inclut #160. Le script est **idempotent** (relançable sans créer de doublon) :

```bash
cd /opt/manne/backend
node scripts/seed-emplacements.js
```

Sortie attendue : `Emplacements insérés : 54 (sur 54).` (puis `0 (sur 54).` aux relances).
Le script lit les identifiants de la base dans `backend/.env`.

⚠️ Sur un serveur déployé **avant** le #340, la base ne contient que 42 emplacements : les
grandes étagères A–D ont un **4ᵉ étage** que le modèle ignorait. Jouer d'abord la migration
`etendre-niveaux-emplacement.js` (voir la liste ci-dessous), **puis** relancer ce seed, qui
insérera les 12 lignes manquantes (`A4G`…`D4D`). Dans l'autre ordre, la contrainte `CHECK`
encore bornée à 3 les rejetterait.

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
node scripts/etendre-niveaux-emplacement.js # US #340 — 4 étages sur A–D
node scripts/seed-emplacements.js           # US #340 — ajoute les 12 cases du 4e étage
```

Chacune affiche une ligne de confirmation. Les scripts lisent les identifiants de la base dans
`backend/.env`.

Les deux dernières lignes vont **de pair et dans cet ordre** : la migration élargit la contrainte
`CHECK` sur `niveau` (de 1–3 à 1–4), le seed crée ensuite les emplacements correspondants. La
migration ne touche **aucune donnée existante** — les niveaux 1 à 3 déjà en base restent valides.

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

## Agent d'impression (poste de la gérante, US #80, mise en service #340)

L'imprimante MUNBYN RW130B est branchée **en USB** sur le PC de la gérante. Le VPS ne peut donc
pas imprimer : comme pour la passerelle SMS, c'est un petit programme **local** qui pilote le
périphérique. Le navigateur de la gérante appelle `http://localhost:4000`, l'agent fabrique le
PDF et le remet au pilote Windows.

### Installation sur le PC de la gérante

Windows uniquement : `pdf-to-printer` n'existe que sur cette plateforme (c'est pourquoi il est
déclaré en `optionalDependencies` et chargé par un `require` paresseux).

1. Installer le **pilote ITPP130** de la MUNBYN, brancher l'imprimante, imprimer la page de test
   de Windows. Tant qu'elle ne sort pas, le problème n'est pas applicatif.
2. Régler le **format de papier par défaut** de l'imprimante sur celui du rouleau — **50 × 30 mm**.
   C'est le réglage le plus important : avec un format A4 par défaut, le pilote met l'étiquette à
   l'échelle d'une feuille et le contenu s'étale de travers sur plusieurs étiquettes.
3. Installer **Node.js LTS** et **Git for Windows**, puis :

```
cd %USERPROFILE%
git clone https://github.com/Saint-Patic/TFE-Gestion-du-repassage.git
cd TFE-Gestion-du-repassage\agent-impression
npm ci
npm ls pdf-to-printer
```

`npm ls` doit afficher une version. Si PowerShell refuse `npm` (« l'exécution de scripts est
désactivée »), c'est son `ExecutionPolicy` qui bloque le lanceur `npm.ps1` : utiliser l'**invite de
commandes**, ou autoriser les scripts locaux par
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` (sans droits
administrateur). Le démarrage automatique décrit plus bas appelle `node` directement et n'est donc
pas concerné.

### Configuration

Copier `.env.example` en `.env` dans `agent-impression`, et renseigner :

```
MODE_SORTIE=imprimante
NOM_IMPRIMANTE=Munbyn ITPP130
ORIGINE_CORS=https://vps-a87c8d0b.vps.ovh.net
PORT_AGENT=4000
```

Le nom de l'imprimante doit être **exact** ; le relever par
`Get-Printer | Select-Object Name, DriverName, PortName`. Ne pas créer ce fichier avec le
Bloc-notes : il l'enregistre volontiers en `.env.txt`, et un BOM UTF-8 se collerait au nom de la
première clé, qui deviendrait illisible. En PowerShell, depuis `agent-impression` :

```powershell
@"
MODE_SORTIE=imprimante
NOM_IMPRIMANTE=Munbyn ITPP130
ORIGINE_CORS=https://vps-a87c8d0b.vps.ovh.net
PORT_AGENT=4000
"@ | Set-Content -Path .env -Encoding ascii
```

### Démarrage automatique (ouverture de session)

La gérante ne doit avoir **rien à lancer** : elle allume son PC, l'agent est là. Le dépôt fournit
`agent-impression\demarrer-agent.cmd`, qui fait le `cd` indispensable avant d'appeler `node`.

1. Ouvrir le dossier de démarrage : `Win+R` → `shell:startup`.
2. Y créer un **raccourci** vers `%USERPROFILE%\TFE-Gestion-du-repassage\agent-impression\demarrer-agent.cmd`
   (clic droit → *Nouveau* → *Raccourci*).
3. Propriétés du raccourci → **Exécuter : Réduite**, pour que la fenêtre ne gêne pas.
4. Fermer la session et la réouvrir, puis vérifier `http://localhost:4000/sante` → `{"statut":"ok"}`.

Pourquoi ce mécanisme plutôt qu'un vrai service Windows (nssm, node-windows) : un service tourne
**hors session utilisateur**, et une imprimante USB installée pour un utilisateur donné y est
classiquement invisible. Le démarrage à l'ouverture de session est ici plus fiable, pas moins. Sa
limite est assumée : rien ne relance l'agent s'il s'arrête en cours de journée. Si cela se produit
en usage réel, la suite est une tâche du Planificateur avec « redémarrer en cas d'échec » — même
action, même script, seul le déclencheur change.

### Vérifier la chaîne complète

Trois contrôles, chacun éliminant une couche :

```
node -e "require('dotenv').config(); console.log(process.env.MODE_SORTIE, process.env.NOM_IMPRIMANTE)"
node imprimer-emplacements.js A1G
```

1. `http://localhost:4000/sante` → l'agent écoute. Attention : cette route ne touche **ni** le PDF
   **ni** l'imprimante, elle ne prouve que la liaison navigateur → agent.
2. La première commande doit afficher `imprimante Munbyn ITPP130`. Si `MODE_SORTIE` est vide, le
   `.env` n'est pas lu et rien ne sera jamais imprimé.
3. La seconde imprime une étiquette et **annonce le mode** : `envoyée(s) à l'imprimante` ou
   `AUCUNE impression`. Ce message est explicite depuis le #340, précisément parce qu'un
   « étiquette générée » muet avait fait chercher un défaut d'imprimante inexistant.

Puis le parcours réel : depuis le navigateur du poste, créer une cliente sur l'app en HTTPS et
cliquer « Imprimer l'étiquette ». Le PDF est toujours écrit dans `agent-impression\sorties\`, même
en mode imprimante : le comparer au papier permet de distinguer un défaut de mise en page (le PDF
est déjà faux) d'un défaut d'échelle du pilote (le PDF est bon, le papier ne l'est pas).

### Étiquettes des emplacements

```
node imprimer-emplacements.js A1G A1C A1D A2G A2C A2D A3G A3C A3D A4G A4C A4D B1G B1C B1D B2G B2C B2D B3G B3C B3D B4G B4C B4D C1G C1C C1D C2G C2C C2D C3G C3C C3D C4G C4C C4D D1G D1C D1D D2G D2C D2D D3G D3C D3D D4G D4C D4D E1G E1D E2G E2D E3G E3D
```

54 étiquettes, dans l'ordre des étagères. L'emplacement « au sol » n'en a **pas** : il se choisit
par bouton dans l'interface, jamais par scan (#190).

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

### Rapatriement hors site

⚠️ **`rsync` doit être installé des DEUX côtés** — il lance une instance distante pour comparer les
fichiers. Si le VPS ne l'a pas, l'erreur est trompeuse (`rsync: command not found` suivi d'un
`connection unexpectedly closed`) car elle semble venir de la machine locale :

```bash
# sur le VPS, une seule fois
sudo apt install rsync
```

Depuis la machine d'Alexis :

```bash
mkdir -p ~/sauvegardes-manne
rsync -az debian@vps-a87c8d0b.vps.ovh.net:/var/backups/manne/ ~/sauvegardes-manne/
```

⚠️ **Volontairement sans `--delete`.** Le VPS purge au bout de sept jours ; si `rsync` répercutait ces
suppressions, les copies locales disparaîtraient au même rythme et la copie hors site n'apporterait
aucune profondeur d'historique. En l'omettant, les copies s'accumulent localement — c'est là que vit
la conservation longue.

À planifier par une tâche `cron` utilisateur, par exemple tous les jours à 9h :

```
0 9 * * * rsync -az debian@vps-a87c8d0b.vps.ovh.net:/var/backups/manne/ ~/sauvegardes-manne/
```

Les copies locales n'ont **pas** de purge automatique : il revient à Alexis de supprimer celles qui ne
servent plus (elles contiennent des données personnelles).

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
