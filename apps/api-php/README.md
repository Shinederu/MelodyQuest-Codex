# MelodyQuest API

This service exposes the REST API for MelodyQuest using Slim 4 and Eloquent. It expects the infrastructure defined in the repository (MySQL, Redis, Nginx, realtime gateway) to be running through Docker Compose.

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
| `ALLOWED_ORIGINS` | Comma-separated list of allowed origins when `APP_ENV` is not `development`. | `*` |

Copy `.env.example` from the repository root to `.env` and adjust the values if needed before launching Docker Compose.

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

Additional endpoints for starting games, advancing rounds, and retrieving state follow the same JSON conventions. Refer to `PlayerRoutes.php` and `AdminRoutes.php` for the complete list.
