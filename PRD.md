📄 PRD : Projet de Bot WhatsApp "Tout-en-Un" (Nom de code : NexusBot)
1. 🎯 Objectif & Vision
Créer un bot WhatsApp personnel et expérimental, puissant et modulaire, qui centralise les fonctionnalités de téléchargement, de gestion de groupe et de contournement des limitations (comme les messages "view once"). L'objectif est d'apprendre en profondeur le fonctionnement des bibliothèques comme Baileys et de disposer d'un outil sur mesure, sans dépendre de projets tiers.

2. 👥 Utilisateurs Cibles
Utilisateur Principal (Toi) : Pour l'expérimentation, l'apprentissage et la gestion de tes propres groupes.

(Optionnel) Administrateurs de Groupe : Pour la modération et les outils de groupe.

(Optionnel) Membres de Groupe : Pour utiliser les fonctionnalités de divertissement et de recherche.

3. ✨ Fonctionnalités Principales (MVP)
Le cœur de ton bot reposera sur ces quatre piliers, directement inspirés de voidxd et des besoins que tu as exprimés .

A. Téléchargeur Universel de Médias

Objectif: Télécharger et envoyer des vidéos, audios et images depuis les plateformes les plus courantes.

Spécifications:

Support pour YouTube (vidéo/audio), Instagram (reels, posts, stories), TikTok (sans watermark), Facebook, Twitter/X, Spotify (playlist, piste), Pinterest, etc. .

Commandes dédiées : .song [titre] (recherche et envoie l'audio), .yt [lien], .insta [lien], .tiktok [lien], etc.

Backend: Utiliser des bibliothèques comme yt-dlp ou des APIs tierces comme @vdofy/apis pour simplifier l'extraction .

B. Contournement des Messages "View Once"

Objectif: Télécharger et sauvegarder les images et vidéos reçues en mode "affichage unique".

Spécifications:

Le bot doit détecter automatiquement un message "view once" reçu .

Fonctionnement technique : Décrypter le média en modifiant le flag viewOnce: true sur le message intercepté .

Commande principale : En réponse à un message "view once", utiliser .vv pour que le bot le sauvegarde et le renvoie dans le chat .

Fonctionnalité dérivée (comme dans voidxd) : .autoview on/off pour activer/désactiver le sauvegarde automatique de tous les "view once" reçus.

C. Gestion de Groupe & Modération

Objectif: Fournir des outils pour administrer les groupes efficacement.

Spécifications:

Commandes de base : .add, .kick, .promote, .demote, .tagall, .link (récupérer le lien d'invitation).

Anti-spam/Anti-link : Bannir automatiquement ou supprimer les messages contenant des liens interdits.

Commandes système : .restart (redémarrer le bot), .ping (vérifier la latence), .menu (afficher toutes les commandes) .

D. Personnalisation et Utilitaires

Objectif: Rendre le bot unique et utile au quotidien.

Spécifications:

Création de Stickers : .sticker (depuis une image/vidéo), .qsticker (depuis un texte) .

Conversation IA : Intégrer un modèle comme Gemini ou ChatGPT pour discuter via .chat [question] .

Personnalisation : Permettre de changer le nom du bot, le préfixe des commandes et l'image du menu (inspiré de .setmenuimage de voidxd).

4. 🛠️ Stack Technique & Architecture
Technologies de Base

Langage: Node.js (v18 ou supérieur) avec TypeScript pour un code plus robuste.

Bibliothèque WhatsApp: Baileys (@whiskeysockets/baileys), la librairie standard pour ces bots .

Base de Données: MongoDB ou SQLite. MongoDB est plus flexible pour un projet qui va évoluer. Elle stockera les paramètres des groupes, les sessions, les blacklists, etc.

Structure du Projet (Modulaire)

src/config/: Fichiers de configuration (.env).

src/commands/: Dossier contenant chaque commande dans un fichier séparé (ex: song.ts, vv.ts, kick.ts). Le bot chargera ces fichiers automatiquement.

src/handlers/: Gestionnaires d'événements (messages, participants, connexion).

src/lib/: Bibliothèques internes (connecteur Baileys, utilitaires de téléchargement, logger).

src/session/: Dossier pour sauvegarder les identifiants de connexion (fichier creds.json).

Sécurité & Authentification

SESSION_ID: Ton bot utilisera le système de session ID (comme voidxd) pour une connexion facile sur VPS . Un petit script pair.js pourra générer ce code via une liaison par numéro de téléphone.

Variables d'environnement :

SESSION_ID: Votre identifiant de session.

PREFIX: Le préfixe des commandes (ex: ., !).

BOT_NAME: Le nom du bot.

MONGODB_URL: L'URL de connexion à MongoDB.

5. 📈 Feuille de Route de Développement
Phase 1 : Fondations (Semaine 1)

Mettre en place le projet Node.js/TypeScript.

Installer et configurer la bibliothèque Baileys.

Implémenter le système d'authentification par SESSION_ID (avec un générateur simple).

Créer le cœur du moteur de commandes (lecture du message, parsing, routage vers le bon fichier).

Phase 2 : Cœur des Fonctionnalités (Semaines 2-3)

Téléchargement : Implémenter le support pour les APIs YouTube, Instagram, et TikTok. Commencer par .song et .yt.

"View Once" : Mettre en place le mécanisme de détection et de téléchargement des médias viewOnce. Tester avec .vv.

Gestion de base : Ajouter les commandes .ping et .menu.

Phase 3 : Extensions et Polissage (Semaines 4-5)

Ajouter la gestion de groupe (.add, .kick, .tagall).

Intégrer la personnalisation (changement de préfixe, de nom).

Ajouter des fonctionnalités bonus (création de stickers, recherche Google/Wikipedia).

Phase 4 : Tests et Documentation

Tester toutes les commandes dans différents scénarios.

Documenter le code et rédiger un README.md clair pour expliquer comment l'installer et l'utiliser.

(Optionnel) Mettre en place un système de logs pour suivre les erreurs.
