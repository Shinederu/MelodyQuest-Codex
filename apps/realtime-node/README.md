# MelodyQuest Realtime Gateway

Socket.IO gateway that relays MelodyQuest game updates over WebSockets and Redis.

## Prerequisites

- Node.js 20+
- Redis instance reachable at the configured host/port (defaults: `redis:6379`)

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `APP_ENV` | `development` | Enables permissive CORS when set to `development`. |
| `ALLOWED_ORIGINS` | `*` | Comma separated list of allowed origins when not in development. |
| `REDIS_HOST` | `redis` | Redis hostname. |
| `REDIS_PORT` | `6379` | Redis port. |
| `REALTIME_PORT` | `3000` | HTTP port to expose Express and Socket.IO. |
| `REALTIME_HMAC_SECRET` | _(required for token verification)_ | Secret used to verify handshake tokens. |
| `ADMIN_TOKEN` | _(optional)_ | Enables `/internal/broadcast` endpoint when set. |

## Sécurité minimale

- Hors développement, seules les origines déclarées dans `ALLOWED_ORIGINS` sont autorisées lors du handshake Socket.IO (`Origin` obligatoire).
- Les clients doivent fournir un jeton invité signé via `POST /api/token/guest`; toute connexion sans HMAC valide est immédiatement refusée.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build & Run

```bash
npm run build
npm start
```

The server listens on `REALTIME_PORT` (default `3000`).

## Docker

The provided `Dockerfile` builds the TypeScript sources into a minimal runtime image.

```bash
docker build -t melodyquest-realtime .
docker run --rm -p 3000:3000 \
  -e APP_ENV=development \
  -e REALTIME_HMAC_SECRET=change-me \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  melodyquest-realtime
```

## Health check

```bash
curl http://localhost:3000/healthz
```

## Manual broadcast (debug)

When `ADMIN_TOKEN` is set, the gateway exposes `POST /internal/broadcast` to relay a payload to connected clients.

```bash
curl -X POST http://localhost:3000/internal/broadcast \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: $ADMIN_TOKEN" \
  -d '{"channel":"game:1","payload":{"type":"ROUND_START","roundId":10,"track_id":5}}'
```

## Minimal security workflow

1. Ask the PHP API for a guest token:
   ```bash
   curl -X POST http://localhost/api/token/guest \
     -H "Content-Type: application/json" \
     -d '{"user_id":1,"username":"PlayerOne"}'
   ```
   The response contains a base64url token signed with `REALTIME_HMAC_SECRET`.
2. Connect to Socket.IO with the token (query string or `hello` event):
   ```javascript
   const socket = io('http://localhost/socket.io/game', {
     query: { gameId: 1, userId: 1, username: 'PlayerOne', token }
   });
   ```
3. In non-development environments the connection is accepted only if the request `Origin` matches one of `ALLOWED_ORIGINS` and the token signature is valid.

## Redis relay test

1. Connect a client to `ws://localhost:3000/socket.io/?gameId=1&userId=42&username=Tester`.
2. Publish a Redis message:
   ```bash
   redis-cli -h redis -p 6379 PUBLISH "game:1" '{"type":"ROUND_START","roundId":10,"track_id":5}'
   ```
3. The client in room `game:1` should receive the `round:start` event with the JSON payload above.
