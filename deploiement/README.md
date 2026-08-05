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
