# 🤖 NexusBot

Bot WhatsApp **personnel, modulaire et intuitif** (basé sur [Baileys](https://github.com/WhiskeySockets/Baileys)).
Le bot est lié à **ton propre numéro** (user-bot) : tes commandes s'envoient depuis ton téléphone.

## ✨ Fonctionnalités

| Catégorie | Commandes |
|---|---|
| 📥 **Téléchargement** | `.yt` `.song` `.insta` `.tiktok` `.spotify` `.fb` `.twitter` `.pinterest` |
| 🔒 **View Once** | envoi **auto** vers Telegram (voir plus bas) |
| 👥 **Groupe** | `.add` `.kick` `.promote` `.demote` `.tagall` `.hidetag` `.link` `.groupinfo` `.leave` |
| 🛡️ **Modération** | `.antilink` `.antispam` `.antidelete` `.welcome` `.groupsettings` |
| 🎨 **Stickers** | `.sticker` `.qsticker` `.toimg` |
| ✨ **Personnalisation** | `.setprefix` `.setname` `.setmenuimage` `.delmenuimage` |
| ⚙️ **Système** | `.menu` `.ping` `.uptime` `.restart` `.logout` `.info` `.addsudo` `.delsudo` `.listsudo` |
| 🧰 **Utilitaires** | `.tr` (traduction) `.tts` (voix) `.google` `.wiki` |
| 🤖 **IA** | `.chat` (Gemini / OpenAI — optionnel) |

## 📦 Prérequis

- **Node.js 22** (aligné sur l'image Docker de prod)
- **yt-dlp** + **ffmpeg** (téléchargements / stickers vidéo)
  → `npm run setup` les installe, et le bot vérifie leur présence au démarrage.

## 🚀 Installation locale

```bash
npm install
npm run setup            # ffmpeg + yt-dlp
cp .env.example .env      # remplis PREFIX, OWNER_NUMBER, TELEGRAM_*
npm run pair              # scanne le QR (une seule fois !)
npm run dev               # mode watch (dev)   —   ou : npm run build && npm start
```

## 🔐 Connexion

La session WhatsApp vit **uniquement** dans le dossier `./session/`
(pas de `SESSION_ID` à copier/coller).

```bash
npm run pair             # QR code
npm run pair 224610447878  # ou code d'appairage par numéro
```

`pair` attend que la session soit **complètement synchronisée** (creds +
app-state + pre-keys) avant de la copier dans `./session/`, puis tu lances
`npm start`.

> ⚠️ **UN SEUL appairage.** Chaque scan crée un « appareil lié ». Pour
> repartir de zéro : `rm -rf session session-pair && npm run pair`.
> Détails dans [`GALERES.md`](./GALERES.md).

### Migrer le bot vers une autre machine

Copie simplement le dossier `./session/`. C'est tout.

## 🔒 View Once → Telegram

Dès qu'un view-once arrive, il est **téléchargé et envoyé sur Telegram**
(légende `🔒 View once de <numéro>`), **sans aucune réaction ni réponse** sur
WhatsApp. Nécessite `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` dans `.env`.

Trois déclencheurs :

| Déclencheur | Fiabilité |
|---|---|
| view-once reçu | ✅ si ton téléphone principal est en ligne (il relaie le média à l'appareil lié) |
| tu **réponds** au view-once | ✅ **toujours** — le média est embarqué dans le message cité |
| tu **réagis** au view-once (emoji) | ⚠️ seulement si le média a déjà été reçu — best-effort |

> Limite WhatsApp : un appareil lié ne reçoit pas toujours le média view-once
> directement (`GALERES.md §7`). **La réponse est la méthode sûre.**

## ⚙️ Variables d'environnement (`.env`)

| Variable | Requis | Description |
|---|---|---|
| `PREFIX` | | Préfixe des commandes (défaut `.`) |
| `BOT_NAME` | | Nom du bot (défaut `NexusBot`) |
| `OWNER_NUMBER` | ✅ | Numéro(s) propriétaire, format international sans `+`, séparés par des virgules |
| `TEMP_DIR` | | Dossier temporaire (défaut `./tmp`) |
| `TELEGRAM_BOT_TOKEN` | | Token du bot Telegram (view-once) |
| `TELEGRAM_CHAT_ID` | | Chat ID Telegram destinataire |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | | Pour `.chat` (optionnel) |
| `LOG_LEVEL` | | `debug` pour tout voir (diagnostic Baileys) |

## 🐳 Déploiement (Docker / Dokploy)

Voir [`DEPLOY.md`](./DEPLOY.md). En résumé :

```bash
docker compose up -d --build
```

- Image **multi-étapes** (build TS séparé du runtime → image légère).
- **Volumes nommés** `nexus_session` / `nexus_data` / `nexus_tmp` :
  la session survit aux redéploiements.
- Pas de port exposé (worker).

## 🧪 Développement

```bash
npm run dev        # watch (tsx)
npm run build      # tsc → dist/
npm run typecheck
LOG_LEVEL=debug npm run dev   # logs Baileys complets
```

Diagnostic : `data/messages.log` (chaque message reçu), `data/viewonce.log`
(traitement des view-once).

## 📁 Structure

```
src/
├── index.ts              # point d'entrée (lock, chargement, démarrage)
├── config.ts             # configuration (.env)
├── database.ts           # SQLite (settings, groupes, sudo, cache messages)
├── commands/             # une commande par fichier (auto-chargées)
├── handlers/             # messages, groupes, view-once, modération, antidelete
└── lib/
    ├── client.ts         # connexion Baileys : reconnexion robuste, backoff,
    │                     #   gestion des DisconnectReason, getMessage
    ├── msg-store.ts       # cache des messages (répond aux retry receipts)
    ├── unavailable.ts     # relance la récupération des médias non livrés
    ├── session.ts         # dossier ./session/ (sessionExists, clearSession)
    ├── downloader.ts · sticker.ts · telegram.ts · deps.ts · ...
```

- `.nexus.lock` — verrou anti-double-instance (PID, libéré à l'arrêt propre).

## 🛠️ Dépannage

| Symptôme | Cause | Solution |
|---|---|---|
| `restart required` (515) après un scan | **normal** (WhatsApp force une reconnexion) | rien à faire, le bot se reconnecte |
| `⛔ ... logged out` (401) | session invalidée par WhatsApp | `rm -rf session session-pair && npm run pair` |
| `⛔ une autre instance a pris la connexion` (440) | 2 bots sur la même session | n'en garder qu'un (le bot s'arrête tout seul dans ce cas) |
| `Bad MAC` / `No sessions` | appairages multiples → appareils fantômes | nettoyage complet + **un seul** appairage |
| « Une autre instance tourne déjà » | `.nexus.lock` résiduel | `rm -f .nexus.lock` |

Historique détaillé des galères et de leurs causes racines : [`GALERES.md`](./GALERES.md).

## ⚠️ Avertissement

Projet **personnel et expérimental**. À utiliser conformément aux conditions
d'utilisation de WhatsApp.
