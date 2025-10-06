# MelodyQuest API

This service exposes the REST API for MelodyQuest using Slim 4 and Eloquent. It expects the infrastructure defined in the repository (MySQL, Redis, Nginx, realtime gateway) to be running through Docker Compose.

## Post-audit fixes

- `public/index.php` now boots the Slim instance returned by `bootstrap/app.php`, ensuring middlewares, rate-limiters and routes are registered.
- Added `POST /api/token/guest` to mint the HMAC used by the realtime gateway during Socket.IO handshakes.
- Redis `SCORE_UPDATE` events now broadcast a `scores: [{ "user_id": number, "points": number }]` payload compatible with the web client.
- `GET /api/games/:id/state` exposes `rules.points` so the frontend can display the scoring configuration driven by environment variables.

## Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `APP_ENV` | Runtime environment (`development` enables permissive CORS and verbose errors). | `development` |
| `ADMIN_TOKEN` | Shared secret required for the administrative endpoints. | `changeme` |
| `DB_HOST` | MySQL host name. | `mysql` |
| `DB_PORT` | MySQL port. | `3306` |
| `DB_DATABASE` | MySQL database name. | `melodyquest` |
| `DB_USERNAME` | MySQL user. | `root` |
| `DB_PASSWORD` | MySQL password. | `secret` |
| `REDIS_HOST` | Redis host. | `redis` |
| `REDIS_PORT` | Redis port. | `6379` |
| `RATE_LIMIT_PER_MIN` | Per-IP request limit per minute. | `60` |
| `RATE_LIMIT_WHITELIST` | Comma-separated list of IP addresses exempt from rate limiting. | _(empty)_ |
| `POINTS_CORRECT_GUESS` | Points awarded for a correct guess. | `1` |
| `BONUS_FIRST_BLOOD` | Bonus points granted for a player's first correct answer in a game. | `1` |
| `STREAK_N` | Number of consecutive wins required before streak bonuses apply. | `3` |
| `STREAK_BONUS` | Bonus points awarded once the streak threshold is reached and on each subsequent win while the streak is maintained. | `1` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed origins when `APP_ENV` is not `development`. | `*` |
| `REALTIME_HMAC_SECRET` | Secret used to mint guest tokens for the realtime gateway. | `change-me` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed origins when `APP_ENV` is not `development`. | `*` |

Copy `.env.example` from the repository root to `.env` and adjust the values if needed before launching Docker Compose.

## Production notes

- Configure the database charset through `DB_CHARSET` and `DB_COLLATION` (recommended: `utf8mb4` / `utf8mb4_unicode_ci`) to avoid incompatible MySQL settings.
- Load balancers such as HAProxy can monitor the service by sending `User-Agent: HAProxy-HealthCheck` to `/api/health`; the API responds with `{ "ok": true }` without going through Slim's middleware stack.

## Running locally

The Docker Compose stack already runs composer install and boots PHP-FPM. From the repository root, start everything with:

```bash
docker compose up -d --build
```

The API is exposed through Nginx at <http://localhost/api>. Health can be checked with:

```bash
curl http://localhost/api/health
```

## Response format

All endpoints return JSON payloads with the following envelope:

- Success: `{ "ok": true, "data": <payload> }`
- Error: `{ "ok": false, "error": { "code": "SOME_CODE", "message": "...", "details": [...] } }`

## Key endpoints

### Health

```bash
curl http://localhost/api/health
```

### Users

Create or fetch a user:

```bash
curl -X POST http://localhost/api/users \
  -H 'Content-Type: application/json' \
  -d '{"username":"PlayerOne"}'
```

### Admin categories (requires `X-Admin-Token` header)

```bash
curl -X POST http://localhost/api/admin/categories \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Token: changeme' \
  -d '{"name":"Pop"}'
```

### Admin tracks

```bash
curl -X POST http://localhost/api/admin/tracks \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Token: changeme' \
  -d '{
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
        "category_id": 1,
        "title": "Never Gonna Give You Up",
        "answers": ["Rick Astley", "Never Gonna Give You Up"]
      }'
```

### Games

Create a game:

```bash
curl -X POST http://localhost/api/games \
  -H 'Content-Type: application/json' \
  -d '{
        "host_user_id": 1,
        "round_count": 10,
        "category_ids": [1,2]
      }'
```

Join a game:

```bash
curl -X POST http://localhost/api/games/1/join \
  -H 'Content-Type: application/json' \
  -d '{"user_id":2}'
```

Submit a guess:

```bash
curl -X POST http://localhost/api/rounds/1/guess \
  -H 'Content-Type: application/json' \
  -d '{"user_id":2,"guess_text":"Never Gonna Give You Up"}'
```

Fuzzy matching (accents and punctuation are tolerated):

```bash
curl -X POST http://localhost/api/rounds/1/guess \
  -H 'Content-Type: application/json' \
  -d '{"user_id":2,"guess_text":"Névèr; gônna give you up!"}'
```

## Règles de points

- Première bonne réponse d'un joueur dans une partie : `POINTS_CORRECT_GUESS` + `BONUS_FIRST_BLOOD` (si activé).
- Chaque bonne réponse suivante rapporte `POINTS_CORRECT_GUESS`.
- Lorsqu'un joueur atteint `STREAK_N` victoires consécutives, il reçoit `STREAK_BONUS` en plus de la valeur de base, puis conserve ce bonus pour chaque victoire tant que la série reste ≥ `STREAK_N`.

### Guest realtime token

Request a signed token that can be used during the Socket.IO handshake:

```bash
curl -X POST http://localhost/api/token/guest \
  -H 'Content-Type: application/json' \
  -d '{"user_id":1,"username":"PlayerOne"}'
```

The response returns `{ "ok": true, "data": { "token": "..." } }`. Supply the returned token along with `userId`, `username`, and `gameId` when connecting to `/socket.io/game`.

Additional endpoints for starting games, advancing rounds, and retrieving state follow the same JSON conventions. Refer to `PlayerRoutes.php` and `AdminRoutes.php` for the complete list.
