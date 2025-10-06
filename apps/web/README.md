# MelodyQuest Web

Application monopage React + Vite + Tailwind pour l'expérience MelodyQuest : administration du catalogue, préparation des parties et interface de jeu en temps réel.

## Configuration

Copiez le fichier `.env.example` en `.env` et adaptez si besoin :

```bash
cp .env.example .env
```

Variables disponibles :

- `VITE_API_URL` : URL de base de l'API PHP (par défaut `/api`).
- `VITE_WS_URL` : point d'entrée Socket.IO (par défaut `/socket.io`).
- `VITE_APP_ENV` : environnement courant (`development` active CORS permissif côté temps réel).

## Scripts

```bash
npm install
npm run dev      # démarre Vite (http://localhost:5173)
npm run build    # build production dans dist/
npm run preview  # prévisualise le build
```

En mode Docker Compose, le build est généré pendant la phase `docker compose up --build` et servi par Nginx sur http://localhost.

## Fonctionnalités principales

### Accueil (`/`)
- Vérification rapide de l'API via le bouton « API Health ».
- Liens rapides vers l'administration et le lobby.

### Administration (`/admin`)
- Gestion du token admin (stocké en `localStorage`).
- CRUD simplifié des catégories (activation/désactivation incluse).
- Ajout de nouveaux tracks YouTube avec réponses acceptées.
- Recherche et filtrage des tracks existants, ajout rapide de réponses.

### Lobby (`/lobby`)
- Création/connexion d'un joueur.
- Sélection des catégories actives et du nombre de manches.
- Création d'une partie, récupération du lien à partager, affichage des joueurs connectés via Socket.IO.
- Démarrage de la partie (hôte uniquement).

### Jeu (`/game/:id`)
- Récupération de l'état complet de la partie depuis l'API.
- Lecture audio/vidéo via YouTube IFrame API, révélation automatique à la résolution de la manche.
- Saisie des réponses, feedback instantané, scoreboard en direct.
- Navigation vers la manche suivante (hôte) et fin de partie.

## Tests manuels recommandés

1. `npm run build` — vérifie que la compilation Vite/TypeScript réussit.
2. Via l'interface :
   - `/admin` : renseigner le token admin, créer une catégorie puis un track avec quelques réponses.
   - `/lobby` : créer un utilisateur, une partie avec la catégorie précédente, copier le lien et démarrer la partie.
   - `/game/:id` : envoyer une bonne réponse, vérifier la révélation de la vidéo et la mise à jour du scoreboard.

## Notes

- Les appels API utilisent un client `fetch` centralisé (`src/lib/http.ts`) avec enveloppe `{ ok, data }` conforme aux réponses Slim.
- La fonction utilitaire `connectGameSocket` récupère d'abord un jeton invité via `POST /api/token/guest` puis initialise la connexion Socket.IO `/game` avec l'HMAC requis.
- Le lecteur YouTube s'appuie exclusivement sur l'IFrame API officielle (script chargé de manière lazy) conformément aux exigences du projet.
