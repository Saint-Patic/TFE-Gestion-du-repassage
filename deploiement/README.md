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
