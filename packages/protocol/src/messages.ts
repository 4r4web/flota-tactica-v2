import { z } from 'zod';

import { ErrorCode, PROTOCOL_VERSION } from './common.js';
import { ActionResult, Command, PlayerView, Role, ShipId } from './game.js';

const base = {
  v: z.literal(PROTOCOL_VERSION),
  id: z.string().uuid(),
  ts: z.number().int().nonnegative(),
};

/** Messages sent from the client to the server. */
export const ClientMessage = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('auth'), accessToken: z.string().min(1) }),
  z.object({ ...base, type: z.literal('pong') }),
  z.object({ ...base, type: z.literal('room.create') }),
  z.object({ ...base, type: z.literal('room.join'), code: z.string().min(1).max(32) }),
  z.object({ ...base, type: z.literal('room.leave'), gameId: z.string().uuid() }),
  z.object({ ...base, type: z.literal('matchmaking.enqueue') }),
  z.object({ ...base, type: z.literal('matchmaking.cancel') }),
  z.object({
    ...base,
    type: z.literal('game.ready'),
    gameId: z.string().uuid(),
    ships: z.array(ShipId).length(3),
  }),
  z.object({
    ...base,
    type: z.literal('game.action'),
    gameId: z.string().uuid(),
    epoch: z.number().int().min(0),
    seq: z.number().int().min(0),
    cmd: Command,
  }),
  z.object({
    ...base,
    type: z.literal('game.rematch'),
    gameId: z.string().uuid(),
    epoch: z.number().int().min(0),
  }),
  z.object({ ...base, type: z.literal('game.resume'), gameId: z.string().uuid() }),
]);

const RoomPlayer = z.object({
  userId: z.string().uuid(),
  role: Role,
  ready: z.boolean(),
});

/** Messages sent from the server to the client. */
export const ServerMessage = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('auth.ok'), userId: z.string().uuid() }),
  z.object({ ...base, type: z.literal('ping') }),
  z.object({
    ...base,
    type: z.literal('room.created'),
    gameId: z.string().uuid(),
    code: z.string().min(1),
  }),
  z.object({
    ...base,
    type: z.literal('room.state'),
    gameId: z.string().uuid(),
    status: z.enum(['placement', 'active', 'finished']),
    players: z.array(RoomPlayer),
  }),
  z.object({ ...base, type: z.literal('matchmaking.matched'), gameId: z.string().uuid() }),
  z.object({
    ...base,
    type: z.literal('game.state'),
    gameId: z.string().uuid(),
    epoch: z.number().int().min(0),
    view: PlayerView,
  }),
  z.object({
    ...base,
    type: z.literal('game.actionResult'),
    seq: z.number().int().min(0),
    result: ActionResult,
  }),
  z.object({
    ...base,
    type: z.literal('game.turnChanged'),
    turn: z.number().int().min(0),
    ap: z.number().int().min(0),
    activeRole: Role,
  }),
  z.object({
    ...base,
    type: z.literal('game.finished'),
    winnerRole: Role,
    winnerId: z.string().uuid(),
  }),
  z.object({
    ...base,
    type: z.literal('game.rematchState'),
    host: z.boolean(),
    guest: z.boolean(),
  }),
  z.object({
    ...base,
    type: z.literal('game.resumed'),
    gameId: z.string().uuid(),
    epoch: z.number().int().min(0),
    view: PlayerView,
  }),
  z.object({
    ...base,
    type: z.literal('error'),
    code: ErrorCode,
    message: z.string(),
    ref: z.string().optional(),
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessage>;
export type ServerMessage = z.infer<typeof ServerMessage>;
export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];
