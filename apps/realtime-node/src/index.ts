import http from 'http';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { BroadcastPayloadSchema, HelloPayload, HelloPayloadSchema, RedisEvent, RedisEventSchema } from './types';

const APP_ENV = process.env.APP_ENV ?? 'development';
const isDev = APP_ENV === 'development';
const realtimePort = Number(process.env.REALTIME_PORT ?? 3000);
const redisHost = process.env.REDIS_HOST ?? 'redis';
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const rawAllowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const allowAnyOrigin = isDev || rawAllowedOrigins.includes('*');
const ALLOWED_ORIGINS = rawAllowedOrigins.filter((origin) => origin !== '*');
const allowedOriginSet = new Set(ALLOWED_ORIGINS);
const HMAC_SECRET = process.env.REALTIME_HMAC_SECRET ?? '';
const internalToken = process.env.ADMIN_TOKEN;

const app = express();

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(allowAnyOrigin ? null : new Error('Origin not allowed'), allowAnyOrigin);
    }
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed'), false);
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '100kb' }));

const rateLimitWindowMs = 60_000;
const rateLimitMax = 30;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/internal/broadcast', (req, res) => {
  if (!internalToken) {
    return res.status(404).json({ error: 'Not enabled' });
  }

  const headerToken = req.header('x-internal-token');
  if (headerToken !== internalToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const limitKey = `${req.ip}`;
  const now = Date.now();
  const entry = rateLimitStore.get(limitKey);
  if (entry && entry.resetAt > now) {
    if (entry.count >= rateLimitMax) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    entry.count += 1;
  } else {
    rateLimitStore.set(limitKey, { count: 1, resetAt: now + rateLimitWindowMs });
  }

  const parsedBody = BroadcastPayloadSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return res.status(400).json({ error: parsedBody.error.flatten() });
  }

  const { channel, payload } = parsedBody.data;
  dispatchRedisEvent(channel, payload);
  return res.json({ ok: true });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (!origin) {
        if (allowAnyOrigin) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed'));
      }
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed'));
    }
  }
});

const redisOptions = {
  host: redisHost,
  port: redisPort,
  retryStrategy: (times: number) => Math.min(times * 50, 2000)
};

const redisSubscriber = new Redis(redisOptions);

redisSubscriber.on('ready', () => {
  console.log('[redis] subscriber ready');
});

redisSubscriber.on('error', (err) => {
  console.error('[redis] subscriber error', err);
});

redisSubscriber.psubscribe('game:*').catch((err) => {
  console.error('[redis] failed to psubscribe', err);
});

redisSubscriber.on('pmessage', (_pattern, channel, message) => {
  try {
    const raw = JSON.parse(message);
    const parsed = RedisEventSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn('[redis] invalid payload', parsed.error.flatten());
      return;
    }
    dispatchRedisEvent(channel, parsed.data);
  } catch (err) {
    console.error('[redis] failed to parse message', err);
  }
});

type SocketData = {
  room?: string;
  userId?: number;
  username?: string;
  joined?: boolean;
  hello?: unknown;
};

const presence = new Map<string, Map<number, number>>();
const leaveTimers = new Map<string, NodeJS.Timeout>();

const eventMap: Record<RedisEvent['type'], string> = {
  ROUND_START: 'round:start',
  ROUND_SOLVED: 'round:solved',
  SCORE_UPDATE: 'score:update',
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  GAME_ENDED: 'game:ended'
};

function presenceKey(room: string, userId: number) {
  return `${room}:${userId}`;
}

function cancelLeave(room: string, userId: number) {
  const key = presenceKey(room, userId);
  const timer = leaveTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    leaveTimers.delete(key);
  }
}

function scheduleLeave(room: string, userId: number) {
  const key = presenceKey(room, userId);
  if (leaveTimers.has(key)) {
    return;
  }
  const timer = setTimeout(() => {
    leaveTimers.delete(key);
    const roomPresence = presence.get(room);
    if (roomPresence && roomPresence.get(userId)) {
      return;
    }
    const namespace = io.of('/game');
    namespace.to(room).emit('player:left', { userId });
    console.log(`[socket] user ${userId} left ${room}`);
  }, 2000);
  leaveTimers.set(key, timer);
}

function incrementPresence(room: string, userId: number) {
  const roomPresence = presence.get(room) ?? new Map<number, number>();
  const count = (roomPresence.get(userId) ?? 0) + 1;
  roomPresence.set(userId, count);
  presence.set(room, roomPresence);
  cancelLeave(room, userId);
}

function decrementPresence(room: string, userId: number) {
  const roomPresence = presence.get(room);
  if (!roomPresence) {
    return;
  }
  const count = roomPresence.get(userId) ?? 0;
  if (count <= 1) {
    roomPresence.delete(userId);
    if (roomPresence.size === 0) {
      presence.delete(room);
    }
    scheduleLeave(room, userId);
  } else {
    roomPresence.set(userId, count - 1);
  }
}

function isOriginAllowed(origin: string) {
  if (allowAnyOrigin) {
    return true;
  }
  return allowedOriginSet.has(origin);
}

function verifyToken(userId: number, username: string, token: string) {
  if (!token) {
    return false;
  }
  if (!HMAC_SECRET) {
    console.warn('[auth] REALTIME_HMAC_SECRET is not configured');
    return false;
  }
  try {
    const expected = crypto.createHmac('sha256', HMAC_SECRET)
      .update(`${userId}.${username}`)
      .digest();
    const provided = decodeBase64Url(token);
    if (expected.length !== provided.length) {
      return false;
    }
    return crypto.timingSafeEqual(expected, provided);
  } catch (err) {
    console.error('[auth] failed to verify token', err);
    return false;
  }
}

function dispatchRedisEvent(channel: string, event: RedisEvent) {
  const namespace = io.of('/game');
  const eventName = eventMap[event.type];
  if (!eventName) {
    console.warn('[redis] unknown event type', event.type);
    return;
  }
  const room = channel.startsWith('game:') ? channel : null;
  if (!room) {
    console.warn('[redis] unsupported channel', channel);
    return;
  }
  namespace.to(room).emit(eventName, event);
  console.log(`[redis] ${channel} -> ${eventName}`);
}

io.of('/game').use((socket, next) => {
  try {
    if (!isDev) {
      const origin = (socket.handshake.headers.origin as string | undefined) ?? '';
      if (!origin || !isOriginAllowed(origin)) {
        return next(new Error('Origin not allowed'));
      }
    }
    const data = socket.data as SocketData;
    data.hello = flattenQuery(socket.handshake.query);
    next();
  } catch (err) {
    next(err as Error);
  }
});

const gameNamespace = io.of('/game');

gameNamespace.on('connection', (socket: Socket) => {
  console.log('[socket] connection', socket.id, socket.handshake.address);
  const doJoin = (raw: unknown) => {
    const data = socket.data as SocketData;
    if (data.joined) {
      return;
    }
    const parsed = HelloPayloadSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      socket.emit('hello:error', { message: 'INVALID_PAYLOAD', details: parsed.error.flatten() });
      socket.disconnect(true);
      return;
    }
    const payload = parsed.data;
    if (!verifyToken(payload.userId, payload.username, payload.token)) {
      socket.emit('hello:error', { message: 'INVALID_TOKEN' });
      socket.disconnect(true);
      return;
    }
    joinGame(socket, payload);
  };

  const initialHello = (socket.data as SocketData).hello;
  if (initialHello) {
    doJoin(initialHello);
  }

  socket.on('hello', (raw) => {
    doJoin(raw);
  });

  socket.on('disconnect', () => {
    const data = socket.data as SocketData;
    if (!data.joined || !data.room || !data.userId) {
      return;
    }
    decrementPresence(data.room, data.userId);
  });
});

function joinGame(socket: Socket, payload: HelloPayload) {
  const room = `game:${payload.gameId}`;
  incrementPresence(room, payload.userId);
  Promise.resolve(socket.join(room)).catch((err: unknown) =>
    console.error('[socket] failed to join room', err)
  );
  const data = socket.data as SocketData;
  data.joined = true;
  data.room = room;
  data.userId = payload.userId;
  data.username = payload.username;
  gameNamespace.to(room).emit('player:joined', { userId: payload.userId, username: payload.username });
  console.log(`[socket] user ${payload.userId} joined ${room}`);
}

server.listen(realtimePort, () => {
  console.log(`[server] realtime service listening on port ${realtimePort}`);
});

process.on('unhandledRejection', (err) => {
  console.error('[process] unhandledRejection', err);
});

process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException', err);
});

process.on('SIGTERM', () => {
  console.log('[process] received SIGTERM, shutting down');
  server.close(() => process.exit(0));
  io.close();
  redisSubscriber.quit().catch(() => undefined);
});

process.on('SIGINT', () => {
  console.log('[process] received SIGINT, shutting down');
  server.close(() => process.exit(0));
  io.close();
  redisSubscriber.quit().catch(() => undefined);
});

function flattenQuery(query: Record<string, unknown>) {
  const flattened: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      flattened[key] = value[0];
    } else {
      flattened[key] = value;
    }
  }
  return flattened;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding === 0 ? normalized : normalized + '='.repeat(4 - padding);
  return Buffer.from(padded, 'base64');
}
