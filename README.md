# TFE - La Manne à Bulles

Application web progressive (PWA) de traçabilité numérique pour un service de repassage
artisanal. Travail de fin d'études.

## Description

Le commerce compte une gérante et deux repasseuses. L'application remplace le suivi papier
des commandes et couvre tout le cycle de vie du linge, de la réception à la remise au
client.

Chaque client possède un code-barres imprimé une seule fois et réutilisé à chaque visite.
Tout le flux de travail se pilote au scan de ce code-barres, avec un scanner Bluetooth qui
se comporte comme un clavier :

1. **Réception** — scan du client, saisie du nombre de mannes, puis scan des emplacements
   d'étagère où elles sont rangées.
2. **Repassage** — un scan fait passer la commande en cours et démarre un chronomètre,
   avec pause et reprise.
3. **Clôture** — un scan termine le repassage, replace les mannes sur les étagères et
   dépose un SMS d'avertissement pour le client.
4. **Remise** — un dernier scan enregistre la récupération du linge.

Les commandes sont présentées dans un tableau Kanban à quatre colonnes, mis à jour en
temps réel sur tous les postes. Le passage d'une colonne à l'autre est strictement
linéaire et sans retour en arrière ; chaque changement est tracé avec son horodatage et
l'utilisatrice responsable, pour valeur probante en cas de litige.

La gérante dispose en plus de la gestion des profils clients, de l'historique complet des
commandes et des statistiques de temps de repassage.

## Technologies

| Domaine | Choix |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, PWA |
| Backend | Node.js, Express 4 |
| Temps réel | Socket.IO, authentifié par jeton au handshake |
| Base de données | PostgreSQL |
| Authentification | Code PIN individuel haché (bcryptjs), session JWT |
| Tests | Jest et Supertest côté serveur, Vitest côté navigateur |
| SMS | Passerelle Node.js sous Termux, sur téléphone Android |

## Organisation du dépôt

```
backend/              API Express, Socket.IO, accès PostgreSQL
  auth/                 hachage du PIN, jetons JWT, verrouillage anti-force-brute
  clients/              génération du code-barres, validation des numéros belges
  commandes/            règles métier pures : transitions, calcul du temps, placement
  emplacements/         génération des emplacements d'étagère
  sms/                  gabarit du message et dépôt en file
  statistiques/         calcul des indicateurs
  middlewares/          authentification, contrôle de rôle
  routes/               points d'entrée de l'API
  scripts/              seeds et migrations, toutes idempotentes
  tests-base/           tests exécutés sur une vraie base PostgreSQL
  app.js                fabrique de l'application Express
  server.js             point d'entrée du serveur
  temps-reel.js         serveur Socket.IO et diffusion ciblée

frontend/             interface React (PWA)
  src/api/              client HTTP et appels typés
  src/auth/             contexte de session et stockage du jeton
  src/composants/       composants réutilisables : cartes, modales, panneaux
  src/pages/            écrans de l'application
  src/temps-reel/       client Socket.IO

agent-impression/     service local d'impression des étiquettes (poste de la gérante)
  etiquette.js          composition du PDF (code-barres et texte)
  sortie.js             envoi vers un fichier ou vers l'imprimante
  serveur.js            petite API HTTP appelée par le navigateur

passerelle-sms/       agent d'envoi des SMS (téléphone Android, sous Termux)
  api.js                client de la file d'attente hébergée par le serveur
  boucle.js             traitement périodique des messages en attente
  envoi.js              envoi réel ou simulation

database/schema.sql   schéma complet de la base
deploiement/          services systemd, configuration nginx, scripts de sauvegarde
```

## Installation locale

### Prérequis

- Node.js 22 ou supérieur
- PostgreSQL 15 ou supérieur

### Base de données

L'extension `pgcrypto` est requise par les clés primaires UUID, et sa création demande le
superutilisateur. Déclarer `manne_bulles_admin` propriétaire de la base évite d'avoir à
accorder séparément les droits sur le schéma `public`.

```bash
sudo -u postgres psql -c "CREATE ROLE manne_bulles_admin LOGIN PASSWORD 'un_mot_de_passe';"
sudo -u postgres psql -c "CREATE DATABASE manne_bulles OWNER manne_bulles_admin;"
sudo -u postgres psql -d manne_bulles -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql -h localhost -U manne_bulles_admin -d manne_bulles -f database/schema.sql
```

Le schéma intègre toutes les migrations : sur une base neuve, aucun script de migration
n'est à rejouer.

### Serveur

```bash
cd backend
npm install
cp .env.example .env
```

Renseigner ensuite le fichier `.env` : identifiants de la base, `JWT_SECRET`
(`openssl rand -hex 32`) et les PIN à quatre chiffres des trois utilisatrices. Puis créer
les comptes et les emplacements d'étagère, avant de démarrer :

```bash
node scripts/seed-utilisateurs.js
node scripts/seed-emplacements.js
npm start
```

Le serveur écoute sur le port 3000.

### Interface

```bash
cd frontend
npm install
npm run dev
```

L'interface est servie sur `http://localhost:5173`. Vite redirige `/api` et `/socket.io`
vers le port 3000 : les deux parties partagent donc la même origine en développement, et
aucune configuration de CORS n'est nécessaire.

### Agent d'impression (facultatif)

Nécessaire uniquement pour imprimer les étiquettes. En mode `fichier`, il écrit les PDF
dans `agent-impression/sorties/` et ne demande aucune imprimante.

```bash
cd agent-impression
npm install
cp .env.example .env
npm start
```

### Passerelle SMS (facultatif)

Nécessaire uniquement pour l'envoi des SMS. En mode `console`, elle journalise les
messages au lieu de les envoyer et fonctionne donc sans carte SIM. Elle exige que
`JETON_PASSERELLE` soit identique dans son `.env` et dans celui du serveur.

```bash
cd passerelle-sms
npm install
cp .env.example .env
npm start
```

## Tests

Chaque projet possède sa propre suite. Les commandes se lancent depuis le dossier
concerné.

```bash
cd backend  && npm test              # suite complète, PostgreSQL requis
cd backend  && npm run test:rapide   # sans PostgreSQL
cd frontend && npm test
```

La suite complète du serveur comprend des tests exécutés sur une véritable base. Ils
utilisent exclusivement `manne_bulles_test`, à créer une fois :

```bash
sudo -u postgres psql -c "CREATE DATABASE manne_bulles_test OWNER manne_bulles_admin;"
sudo -u postgres psql -d manne_bulles_test -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

Une garde refuse le démarrage si la base visée ne porte pas un nom terminé par `_test`,
afin d'éviter toute mauvaise manipulation.

La couverture s'obtient avec `npm run test:coverage`. Côté serveur, des seuils minimaux
font échouer la commande en cas de régression.

Le résultat de `npm test` ne suffit pas à valider une modification du frontend. Il faut lui adjoindre `npm run build`, qui exécute le compilateur
TypeScript.

## Déploiement

L'application est en production sur un VPS Debian, derrière nginx.

- Code : `/opt/manne`, dépôt cloné en lecture seule
- Serveur : service systemd `manne-backend`, à l'écoute sur `127.0.0.1:3000`
- Interface : build statique servi par nginx depuis `/opt/manne/frontend/dist`
- Base : PostgreSQL local

nginx sert l'interface et redirige `/api` et `/socket.io` vers le port 3000. Ce port n'est
jamais exposé : le pare-feu n'ouvre que 22, 80 et 443.

### Première mise en place

Les deux fichiers de configuration se trouvent dans `deploiement/`.

```bash
sudo cp deploiement/manne-backend.service /etc/systemd/system/
sudo systemctl enable --now manne-backend

sudo cp deploiement/nginx-manne.conf /etc/nginx/sites-available/manne
sudo ln -s /etc/nginx/sites-available/manne /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Le certificat est ensuite obtenu par certbot, qui ajoute lui-même le vhost 443, la
redirection depuis le port 80 et le renouvellement automatique :

```bash
sudo certbot --nginx -d vps-a87c8d0b.vps.ovh.net
```

Une fois certbot passé, ne plus recopier `nginx-manne.conf` par-dessus la configuration du
serveur : ce fichier est le vhost HTTP de base, et l'écraser supprimerait la configuration
TLS. Les mises à jour applicatives, elles, n'y touchent pas.

Le `.env` de production suit le même modèle qu'en local, avec `ORIGINE_CORS` pointant sur
l'URL publique. Les comptes et les emplacements d'étagère se créent avec les mêmes seeds
que ceux de l'installation locale.

### Mettre à jour l'application

```bash
cd /opt/manne
git pull
cd backend && npm ci
cd ../frontend && npm ci && npm run build
sudo systemctl restart manne-backend
```

`npm ci` signale une vingtaine de vulnérabilités hautes. Elles proviennent toutes de Jest,
qui n'intervient jamais en production ; `npm audit --omit=dev` renvoie zéro.

### Migrations

Le schéma versionné intègre toutes les migrations : une base neuve n'en réclame aucune.
Sur une base déjà en service, les jouer dans cet ordre. Toutes sont idempotentes et
affichent une ligne de confirmation.

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

### Autres procédures

L'installation de l'agent d'impression et de la passerelle SMS, les sauvegardes
automatisées et la procédure de restauration sont décrites dans `deploiement/README.md`.
