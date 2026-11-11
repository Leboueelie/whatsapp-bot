#!/usr/bin/env bash
#
# setup.sh — Installe automatiquement les dépendances système de NexusBot :
#   • ffmpeg  (conversion des stickers vidéo)
#   • yt-dlp  (téléchargement des médias)
#
set -euo pipefail

info()  { printf '\033[1;34m[setup]\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m[setup]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[setup]\033[0m %s\n' "$*"; }

detect_pkg() {
  if command -v apt-get >/dev/null 2>&1; then echo "apt"
  elif command -v apk >/dev/null 2>&1; then echo "apk"
  elif command -v dnf >/dev/null 2>&1; then echo "dnf"
  elif command -v yum >/dev/null 2>&1; then echo "yum"
  elif command -v pacman >/dev/null 2>&1; then echo "pacman"
  elif command -v brew >/dev/null 2>&1; then echo "brew"
  else echo "unknown"; fi
}

install_ffmpeg() {
  info "Installation de ffmpeg..."
  local pkg
  pkg=$(detect_pkg)
  case "$pkg" in
    apt)   sudo apt-get update -y && sudo apt-get install -y ffmpeg ;;
    apk)   sudo apk add --no-cache ffmpeg ;;
    dnf)   sudo dnf install -y ffmpeg ;;
    yum)   sudo yum install -y ffmpeg ;;
    pacman) sudo pacman -Sy --noconfirm ffmpeg ;;
    brew)  brew install ffmpeg ;;
    *)     warn "Gestionnaire de paquets non reconnu. Installe ffmpeg manuellement." ;;
  esac
}

install_ytdlp() {
  info "Installation de yt-dlp..."
  if command -v pip3 >/dev/null 2>&1; then
    pip3 install -U yt-dlp || sudo pip3 install -U yt-dlp
  elif command -v pip >/dev/null 2>&1; then
    pip install -U yt-dlp || sudo pip install -U yt-dlp
  else
    # fallback : téléchargement du binaire autonome
    warn "pip introuvable, téléchargement du binaire yt-dlp..."
    local dest="${HOME}/.local/bin"
    mkdir -p "$dest"
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$dest/yt-dlp"
    chmod a+rx "$dest/yt-dlp"
    export PATH="$dest:$PATH"
    info "yt-dlp installé dans $dest (ajoute-le à ton PATH)."
  fi
}

main() {
  info "NexusBot — installation des dépendances..."

  if command -v ffmpeg >/dev/null 2>&1; then
    ok "ffmpeg déjà installé : $(ffmpeg -version 2>/dev/null | head -n1)"
  else
    install_ffmpeg
  fi

  if command -v yt-dlp >/dev/null 2>&1; then
    ok "yt-dlp déjà installé : $(yt-dlp --version 2>/dev/null)"
  else
    install_ytdlp
  fi

  echo
  ok "Terminé. Vérification :"
  command -v ffmpeg >/dev/null 2>&1 && echo "  ffmpeg : OK" || warn "  ffmpeg : MANQUANT"
  command -v yt-dlp >/dev/null 2>&1 && echo "  yt-dlp : OK" || warn "  yt-dlp : MANQUANT"
}

main "$@"
