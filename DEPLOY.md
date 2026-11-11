# 🚀 Déploiement — Dokploy (VPS)

NexusBot est un **worker** : pas de port HTTP, pas de domaine. On le déploie
en **Docker Compose** sur Dokploy, avec des **volumes nommés** pour ne jamais
perdre la session WhatsApp.

---

## 1. Pré-requis

- Le repo est poussé sur GitHub (privé).
- Dokploy tourne déjà sur le VPS (`169.58.232.189`).

---

## 2. Créer le service dans Dokploy

1. **Projects → Create Project** → nom : `nexusbot`.
2. Dans le projet : **Create Service → Compose**.
3. **Provider : GitHub** → autoriser Dokploy sur le repo privé `whatsapp-bot`.
   - Branch : `main`
   - Compose Path : `docker-compose.yml`
4. Onglet **Environment** → coller (adapter les valeurs) :

   ```env
   PREFIX=.
   BOT_NAME=NexusBot
   OWNER_NUMBER=224610447878
   TEMP_DIR=./tmp
   TELEGRAM_BOT_TOKEN=xxxxxxxx:yyyyyyyyyyyyyyyyyyyyyyyyyyyy
   TELEGRAM_CHAT_ID=123456789
   ```

   > Dokploy écrit ça dans un fichier `.env` à côté du `docker-compose.yml`
   > (le service le lit via `env_file`). **Pas de `SESSION_ID`** : la session
   > vit dans le volume `nexus_session`.

5. **Deploy**. Le premier build prend ~2-3 min (image multi-étapes).

Au premier démarrage, sans session, le bot affiche un **QR code dans les logs**
puis se met en attente. On règle ça à l'étape 3.

---

## 3. Injecter la session WhatsApp

Le bot a besoin de `/app/session/creds.json`. Deux options.

### Option A — réutiliser la session existante (recommandé, pas de re-scan)

On copie la session qui **marche déjà** dans le volume `nexus_session`.

```bash
# --- sur ta machine locale : arrêter le bot local (flush des creds) puis
#     envoyer la session fraîche sur le VPS ---
scp -r ./session root@169.58.232.189:/root/whatsapp-bot/session-fresh

# --- sur le VPS (ssh root@169.58.232.189) ---

# 1. nom réel du volume (Dokploy le préfixe avec le slug du projet)
docker volume ls | grep nexus_session
#   ex : nexusbot-abcd_nexus_session

# 2. nom du conteneur bot
docker ps --format '{{.Names}}' | grep -i bot

# 3. copier la session dans le volume
docker run --rm \
  -v nexusbot-abcd_nexus_session:/dest \
  -v /root/whatsapp-bot/session-fresh:/src:ro \
  alpine sh -c 'rm -rf /dest/* ; cp -a /src/. /dest/ ; echo OK ; ls /dest | head'

# 4. redémarrer le bot → depuis l'UI Dokploy (Redeploy), ou :
docker restart <nom-conteneur-bot>
```

> ⚠️ Une seule instance à la fois sur cette session. Si le bot local tourne
> encore quand celui du VPS se connecte, le local recevra `connectionReplaced`
> (440) et **s'arrêtera tout seul** (comportement voulu).

### Option B — appairer à neuf depuis le conteneur

```bash
# sur le VPS
docker exec -it <nom-conteneur-bot> npm run pair
# scanne le QR (ou : npm run pair 224610447878 pour un code par numéro)
```

> ⚠️ Chaque appairage crée un nouvel « appareil lié ». N'en fais qu'**un**.
> Voir `GALERES.md §1`.

---

## 4. Vérifier

Logs Dokploy → tu dois voir :

```
✅ 43 commandes chargées.
✅ CONNECTÉ — NexusBot est en ligne.
```

Puis, sur WhatsApp, `.ping` doit répondre.

---

## 5. Mises à jour

```bash
git add -A && git commit -m "..." && git push
```

Dans Dokploy → **Redeploy** (ou active l'auto-deploy par webhook GitHub).
Les volumes `nexus_session` / `nexus_data` / `nexus_tmp` **persistent** :
la session n'est jamais reperdue.

---

## Dépannage

| Symptôme | Cause | Fix |
|---|---|---|
| QR code en boucle dans les logs | volume `nexus_session` vide | refaire l'étape 3 |
| `⛔ ... logged out` | session invalidée par WhatsApp | étape 3 option B (re-pair) |
| `⛔ une autre instance a pris la connexion` | 2 bots sur la même session | arrêter l'autre (local, ou ancien conteneur) |
| build échoue sur `better-sqlite3` | pas de binaire pré-compilé | vérifier que l'image de base est bien `node:22` (pas alpine) |
