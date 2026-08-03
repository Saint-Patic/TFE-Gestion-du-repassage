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

## Migrations à jouer après un déploiement (rattrapage)

Ces migrations existaient sans être documentées ici. Toutes sont **idempotentes** (rejouables sans
risque) et se lancent depuis `/opt/manne/backend`, dans cet ordre :

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

## Passerelle SMS (US #240)

Le backend ne peut pas joindre le téléphone de l'atelier (NAT domestique) : c'est **la passerelle qui
vient chercher** les SMS à envoyer, en HTTPS sortant. Aucun port n'est à ouvrir chez la gérante, et un
SMS déposé pendant que le téléphone est éteint partira au rallumage.

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

1. Installer **Termux** et **Termux:API** depuis **F-Droid** — les versions du Play Store sont
   obsolètes et l'API SMS n'y fonctionne pas.
2. Dans Termux : `pkg install nodejs git`, puis `pkg install termux-api`. Accorder la permission SMS
   à Termux:API.
3. Copier le dossier `passerelle-sms/` sur le téléphone, puis `npm install --omit=dev`.
4. Créer `.env` à partir de `.env.example` : `URL_API=https://vps-a87c8d0b.vps.ovh.net`, le même
   `JETON_PASSERELLE` que le VPS, et `MODE_ENVOI=console` tant que la validation matérielle (#340)
   n'est pas faite.
5. **Exclure Termux de l'optimisation de batterie** (Android → Batterie → applications non
   optimisées), sans quoi le mode Doze suspend la boucle après quelques minutes d'écran éteint.
6. Démarrer : `npm start`.

### Bascule en envoi réel

Elle appartient au **#340** (checklist matérielle) : passer `MODE_ENVOI=sms` et vérifier qu'une
cliente reçoit effectivement le message. Tant que `MODE_ENVOI=console`, la passerelle vide la file et
journalise les envois **sans consommer de SMS**.
