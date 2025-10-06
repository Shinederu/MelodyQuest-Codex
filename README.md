# MelodyQuest Monorepo

This repository contains the MelodyQuest mono-repo including the web client, realtime gateway, and PHP API.

## Getting started

1. Copy `.env.example` to `.env` and adjust credentials if necessary.
2. Build and start the stack:

```bash
docker compose up -d --build
```

The initial build installs dependencies and prepares the static web assets that will be served by Nginx.

## Services

Once the stack is running, access the application via [http://localhost](http://localhost).

Exposed services:

- **Nginx** – http://localhost (serves the web SPA and proxies `/api` and `/socket.io`).
- **PHP API** – proxied via `/api` path (FastCGI to PHP-FPM).
- **Realtime Gateway** – proxied via `/socket.io` (Socket.IO over WebSocket/HTTP).
- **MySQL** – exposed on port `3306` for local development tooling.
- **Redis** – internal cache/pub-sub for realtime features.

Database schema initialization scripts live in `infra/db-init` and Redis configuration is stored under `infra/redis`.
