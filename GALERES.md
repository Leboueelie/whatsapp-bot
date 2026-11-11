# 📓 Journal des galères — NexusBot

Toutes les emmerdes rencontrées pendant le développement, leurs causes racines et leurs solutions. À relire avant de toucher au code.

> **MàJ (refonte connexion)** — le bug « répond puis meurt » a été traité :
> - `getMessage` + cache `lib/msg-store.ts` → le bot répond aux *retry receipts* (fini les réponses perdues).
> - `lib/client.ts` réécrit : plus de tempête de reconnexion (listeners retirés avant recréation), backoff exponentiel, gestion explicite de chaque `DisconnectReason` (401/440/500 → stop, 515 → reconnexion immédiate, reste → backoff).
> - Pipeline `messages.upsert` non bloquant (traitement détaché).
> - **`SESSION_ID` supprimé** : la session vit uniquement dans `./session/`. Les §4, §5 et §11 ci-dessous ne s'appliquent donc plus (gardés pour l'historique).

---

## 1. `SessionError: No sessions` / `Bad MAC` / `Invalid PreKey ID` / `No session record`

### Symptôme
Le bot est connecté mais ne peut **rien déchiffrer**. En debug :
```
Failed to decrypt message with any known session...
Session error: Error: Bad MAC
Error in ping: SessionError: No sessions
```

### Cause racine
**Plusieurs appairages successifs** ont créé des « appareils liés » orphelins sur le compte WhatsApp (limite : 4 appareils). Quand le bot envoie, Baileys chiffre le message pour **tous** les appareils du compte — y compris les fantômes — et n'a pas de session Signal valide avec eux → échec.

### Solution
Nettoyage **complet** puis **un seul** appairage :
```bash
rm -rf session session-pair data .nexus.lock
# WhatsApp → Appareils liés : ne garder QUE le téléphone
npm run pair   # UNE seule fois
npm start
```

### Leçon
- **Jamais plus d'un appairage.** Chaque scan ajoute un appareil fantôme.
- Le nettoyage côté WhatsApp ne suffit pas : les fichiers locaux `session/` gardent aussi les références fantômes.

---

## 2. `Stream Errored (restart required)` (code 515)

### Symptôme
Après un scan QR réussi, le bot affiche :
```
stream errored out
❌ Connexion fermée : Stream Errored (restart required)
```

### Cause racine
**Ce n'est pas une erreur.** Après un appairage réussi, WhatsApp envoie volontairement `restart required` pour forcer le client à se reconnecter avec les nouvelles credentials.

### Solution
`pair.ts` ne doit pas quitter sur `close`, mais **se reconnecter** :
- Ne sortir que sur `loggedOut` (401).
- Sur tout autre `close` (dont 515), relancer la connexion.

---

## 3. Commandes ignorées quand le bot = ton propre numéro (`fromMe`)

### Symptôme
Bot connecté, mais **aucune réponse aux commandes**. Les messages de ton téléphone arrivent avec `fromMe: true`.

### Cause racine
Le code faisait `if (msg.key.fromMe) return;` — or quand le bot est lié à **ton propre numéro**, tes commandes (envoyées depuis ton téléphone) arrivent avec `fromMe: true` et étaient donc toutes ignorées.

### Solution
Ne pas filtrer sur `fromMe`. Filtrer uniquement les messages émis par le **bot lui-même** via le préfixe d'ID :
```ts
function isBotSelfMessage(msg) {
  const id = msg.key.id ?? "";
  return id.startsWith("3EB0") || id.startsWith("BAE5");
}
```
(les messages envoyés par le bot ont un ID qui commence par `3EB0`/`BAE5`).

---

## 4. `SESSION_ID invalide`

### Symptôme
Collage du SESSION_ID dans `.env` → `❌ SESSION_ID invalide`.

### Cause racine
Le copier/coller depuis le terminal insérait des **retours à la ligne** dans la longue chaîne base64.

### Solution
- `decodeSession` nettoie les espaces/retours/guillemets avant de décoder.
- `npm run pair` écrit le SESSION_ID **directement dans `.env`** (plus de copier/coller manuel).

---

## 5. `spawn E2BIG` au démarrage

### Symptôme
```
❌ Erreur fatale : Error: spawn E2BIG
    at ChildProcess.spawn ...
    at deps.js
```

### Cause racine
Le `SESSION_ID` avait gonflé à **132 Ko** (encodage de *tous* les fichiers de session, dont `session-*.json` et `pre-key-*.json` qui s'accumulent). Chargé dans `process.env` par dotenv, il faisait dépasser `MAX_ARG_STRLEN` (128 Ko) à chaque `execFile` (yt-dlp/ffmpeg).

### Solution (double)
1. **Cause racine** : `encodeSession` ne garde que l'essentiel (`creds.json` + `app-state-sync-*`). Les `pre-key-*` et `session-*` sont régénérés à la reconnexion. → SESSION_ID passe de 132 Ko à ~16 Ko.
2. **Ceinture** : `cleanEnv()` retire `SESSION_ID` de l'environnement de tout process enfant (`deps.ts`, `downloader.ts`, `sticker.ts`).

---

## 6. View-once non détecté automatiquement (détection du format)

### Symptôme
`.vv` (manuel) fonctionne, mais l'auto-détection échoue :
```
DEBUG — clés: videoMessage | détecté: false
```

### Cause racine
Deux formats possibles pour un view-once :
- **Entrant** : enveloppé `viewOnceMessage.message.imageMessage`.
- **Cité** (dans `contextInfo.quotedMessage`, utilisé par `.vv`) : déplié `imageMessage.viewOnce`.

Le premier `isViewOnce` ne vérifiait que `imageMessage.viewOnce`, donc ratait le format entrant.

### Solution
Détecter les deux :
```ts
function isViewOnce(m) {
  if (m.imageMessage?.viewOnce || m.videoMessage?.viewOnce) return true;
  return !!(m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension);
}
```
Et `getViewOnceMedia()` pour déplier le wrapper avant de télécharger.

---

## 7. View-once « unavailable » — média non livré à l'appareil lié

### Symptôme
L'auto-forward ne se déclenche pas. En debug :
```
received unavailable message, acked and requested resend from phone
PDO message without response after 15 seconds. Phone possibly offline
```

### Cause racine
**Limitation WhatsApp.** L'appareil **lié** (le bot) ne reçoit **pas le média view-once directement** : il reçoit un « placeholder » (`unavailable`) et doit demander au **téléphone principal** de le lui renvoyer (placeholder resend / PDO). Si le téléphone est hors-ligne ou WhatsApp fermé, le média n'arrive jamais.

### Conséquence
- `.vv` marche : la réponse (depuis le téléphone) inclut le view-once **cité**, donc le média est dedans.
- L'auto ne marche que si **le téléphone est en ligne** avec WhatsApp ouvert.

### Atténuation
- Retry du `requestPlaceholderResend` après 20 s (Baileys ne le demande qu'une fois, timeout ~15 s).
- **Le téléphone doit être en ligne** pour que l'auto fonctionne. Limite inhérente au « bot = ton propre numéro ».

---

## 8. Session incomplète après `npm run pair` (copie trop tôt)

### Symptôme
Après appairage, le bot redémarre mais ne déchiffre pas correctement.

### Cause racine
`pair.ts` copiait `session-pair/` vers `session/` au moment du `open`, alors que seuls `creds.json` étaient encore écrits (les pre-keys et clés app-state arrivent plus tard).

### Solution
- Attendre **5 s** après `open` avant d'encoder/copier.
- **Vider** le dossier de destination avant la copie (pas de mélange ancien/nouveau).
- **Vider** `session-pair/` au démarrage du pairing (pas de réutilisation d'état corrompu).

---

## 9. Logs Baileys illisibles / bruit libsignal

### Symptôme
Flot de JSON pino + spam `Failed to decrypt message`, `Session error`, `Closing session`.

### Solution
- Logger custom silencieux (filtre les messages bénins).
- `installConsoleFilter()` masque le bruit libsignal (`Bad MAC`, `Failed to decrypt`, etc.) mais garde les vraies erreurs.
- `LOG_LEVEL=debug npm start` pour tout voir (diagnostic).

---

## 10. Double instance / verrou

### Symptôme
Session corrompue à cause de deux bots qui tournent en même temps.

### Solution
Verrou `.nexus.lock` (PID) acquis au démarrage, libéré à l'arrêt :
```bash
rm -f .nexus.lock   # si résidu après un kill -9
```

---

## 11. E2BIG sur les process enfants (bis)

Voir **§5**. Toujours passer `env: cleanEnv()` dans tout `execFile`/`spawn`, car le `SESSION_ID` (même petit) ou d'autres secrets peuvent gonfler l'environnement.

---

## 12. Filigrane & envoi view-once

Historique des demandes :
- ❌ Filigrane (`VV_TEXT`/`setvvtext`) supprimé → view-once envoyé **brut**.
- ✅ View-once envoyé **à soi-même** (pas à l'expéditeur), avec légende `🔒 View once de <numéro>`.
- ✅ **Telegram** : envoi auto de tous les view-once via `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (aucune commande nécessaire). Fonctionne indépendamment de `.autoview` (WhatsApp).

---

## 📌 Règles d'or récapitulatives

1. **Un seul appairage, jamais plus.**
2. **Nettoyage complet** (`rm -rf session session-pair data .nexus.lock`) avant tout re-pairage.
3. **Le téléphone principal doit rester en ligne** (WhatsApp ouvert) pour les view-once et la synchro des messages.
4. **Toujours `env: cleanEnv()`** dans les `execFile`/`spawn`.
5. **SESSION_ID minimal** (creds + app-state uniquement).
6. Diagnostic rapide :
   - `data/messages.log` → chaque message reçu.
   - `data/viewonce.log` → traitement des view-once.
   - `LOG_LEVEL=debug npm start` → tout Baileys.
