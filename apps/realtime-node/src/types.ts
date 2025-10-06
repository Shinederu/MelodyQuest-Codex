import { z } from 'zod';

export const HelloPayloadSchema = z.object({
  gameId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
  username: z.string().min(1).max(128),
  token: z.string().min(1)
});

export type HelloPayload = z.infer<typeof HelloPayloadSchema>;

export const RedisEventSchema = z
  .object({
    type: z.enum([
      'ROUND_START',
      'ROUND_SOLVED',
      'SCORE_UPDATE',
      'PLAYER_JOINED',
      'PLAYER_LEFT',
      'GAME_ENDED'
    ])
  })
  .passthrough();

export type RedisEvent = z.infer<typeof RedisEventSchema>;

export const BroadcastPayloadSchema = z.object({
  channel: z.string().min(1),
  payload: RedisEventSchema
});

export type BroadcastPayload = z.infer<typeof BroadcastPayloadSchema>;
