import http from 'http';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { BroadcastPayloadSchema, HelloPayload, HelloPayloadSchema, RedisEvent, RedisEventSchema } from './types';

const appEnv = process.env.APP_ENV ?? 'development';
const isDev = appEnv === 'development';
const realtimePort = Number(process.env.REALTIME_PORT ?? 3000);
const redisHost = process.env.REDIS_HOST ?? 'redis';
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const allowedOriginsConfig = process.env.ALLOWED_ORIGINS ?? '*';
const allowedOrigins = allowedOriginsConfig
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const allowedOriginSet = new Set(allowedOrigins);
const allowAnyOrigin = isDev || allowedOriginSet.has('*');
const hmacSecret = process.env.REALTIME_HMAC_SECRET ?? '';
const internalToken = process.env.ADMIN_TOKEN;

const app = express();

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin || isOriginAllowed(origin)) {
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
      if (!origin || isOriginAllowed(origin)) {
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

function verifyHelloToken(payload: HelloPayload) {
  if (!payload.token) {
    return true;
  }
  if (!hmacSecret) {
    console.warn('[auth] token provided but REALTIME_HMAC_SECRET is not configured');
    return false;
  }
  try {
    const expected = crypto.createHmac('sha256', hmacSecret).update(`${payload.userId}.${payload.username}`).digest('hex');
    const received = payload.token;
    if (expected.length !== received.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'));
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

const gameNamespace = io.of('/game');

gameNamespace.on('connection', (socket: Socket) => {
  console.log('[socket] connection', socket.id, socket.handshake.address);
  const originHeader = socket.handshake.headers.origin as string | undefined;
  if (originHeader && !isOriginAllowed(originHeader)) {
    console.warn('[socket] rejected origin', originHeader);
    socket.disconnect(true);
    return;
  }

  const queryPayload = HelloPayloadSchema.safeParse(flattenQuery(socket.handshake.query));
  if (queryPayload.success) {
    handleHello(socket, queryPayload.data);
  }

  socket.on('hello', (raw) => {
    if ((socket.data as SocketData).joined) {
      return;
    }
    const parsed = HelloPayloadSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      socket.emit('hello:error', { message: 'INVALID_PAYLOAD', details: parsed.error.flatten() });
      return;
    }
    handleHello(socket, parsed.data);
  });

  socket.on('disconnect', () => {
    const data = socket.data as SocketData;
    if (!data.joined || !data.room || !data.userId) {
      return;
    }
    decrementPresence(data.room, data.userId);
  });
});

function handleHello(socket: Socket, payload: HelloPayload) {
  if (!verifyHelloToken(payload)) {
    socket.emit('hello:error', { message: 'INVALID_TOKEN' });
    socket.disconnect(true);
    return;
  }
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
