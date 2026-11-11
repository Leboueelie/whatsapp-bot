# syntax=docker/dockerfile:1

# ---------- Étape 1 : build (compile le TypeScript) ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# `npm ci` = installe EXACTEMENT ce qui est dans package-lock.json (reproductible).
# On installe tout (dev inclus) car il faut TypeScript/tsx pour compiler.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# on ne garde que les dépendances de production pour les copier dans l'image finale
RUN npm prune --omit=dev


# ---------- Étape 2 : image finale (légère, runtime seulement) ----------
FROM node:22-bookworm-slim

# Dépendances système : ffmpeg (stickers vidéo) + yt-dlp (téléchargements)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      python3-pip \
      ca-certificates \
      curl && \
    pip3 install --break-system-packages -U yt-dlp && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# on copie le résultat du build + les node_modules de prod
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Données persistées via volumes (déclarés dans docker-compose.yml)
#   /app/session  → identifiants WhatsApp (ne jamais perdre)
#   /app/data     → base SQLite + logs
#   /app/tmp      → fichiers temporaires (téléchargements)

CMD ["node", "dist/index.js"]
