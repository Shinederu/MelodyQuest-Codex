import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { z } from 'zod';

const PORT = process.env.PORT || 3000;
const redisHost = process.env.REDIS_HOST || 'redis';
const redisPort = Number(process.env.REDIS_PORT || 6379);

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const redis = new Redis({ host: redisHost, port: redisPort });
const pub = new Redis({ host: redisHost, port: redisPort });

const gameNamespace = io.of('/game');

const joinSchema = z.object({
  gameId: z.string().min(1),
  playerId: z.string().min(1)
});

gameNamespace.on('connection', (socket) => {
  socket.on('join', (payload) => {
    const result = joinSchema.safeParse(payload);
    if (!result.success) {
      socket.emit('error', { message: 'Invalid join payload' });
      return;
    }

    const { gameId, playerId } = result.data;
    const room = `game:${gameId}`;
    socket.join(room);
    socket.emit('joined', { gameId, playerId });
  });

  socket.on('leave', (payload) => {
    const result = joinSchema.safeParse(payload);
    if (!result.success) {
      return;
    }
    const room = `game:${result.data.gameId}`;
    socket.leave(room);
  });

  socket.on('broadcast', (payload) => {
    const message = typeof payload === 'object' ? payload : { message: String(payload) };
    const channel = 'melodyquest:events';
    pub.publish(channel, JSON.stringify(message));
  });
});

redis.subscribe('melodyquest:events', (err) => {
  if (err) {
    console.error('Redis subscription error', err);
  }
});

redis.on('message', (channel, message) => {
  if (channel !== 'melodyquest:events') {
    return;
  }
  let payload = message;
  try {
    payload = JSON.parse(message);
  } catch (error) {
    // ignore json parse errors
  }
  gameNamespace.emit('event', payload);
});

httpServer.listen(PORT, () => {
  console.log(`Realtime server listening on port ${PORT}`);
});
