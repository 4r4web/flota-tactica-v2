import { z } from 'zod';

/** Admin-only match history. */

export const AdminMatchPlayer = z.object({
  role: z.enum(['host', 'guest']),
  name: z.string(),
  result: z.string().nullable(),
});

export const AdminMatch = z.object({
  id: z.string().uuid(),
  status: z.string(),
  mode: z.string(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
  finalEpoch: z.number().int(),
  winnerName: z.string().nullable(),
  players: z.array(AdminMatchPlayer),
});

export const AdminMatchesResponse = z.object({
  matches: z.array(AdminMatch),
});

export const AdminGameEvent = z.object({
  seq: z.number().int(),
  turn: z.number().int(),
  type: z.string(),
  actor: z.string().nullable(),
  payload: z.unknown(),
  createdAt: z.string(),
});

export const AdminGameEventsResponse = z.object({
  events: z.array(AdminGameEvent),
});

export type AdminMatchPlayer = z.infer<typeof AdminMatchPlayer>;
export type AdminMatch = z.infer<typeof AdminMatch>;
export type AdminMatchesResponse = z.infer<typeof AdminMatchesResponse>;
export type AdminGameEvent = z.infer<typeof AdminGameEvent>;
export type AdminGameEventsResponse = z.infer<typeof AdminGameEventsResponse>;
