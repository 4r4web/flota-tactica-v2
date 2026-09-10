import { z } from 'zod';

/** Wire protocol version. Increment on incompatible changes. */
export const PROTOCOL_VERSION = 1;

/** Common envelope carried by every WebSocket message. */
export const Envelope = z.object({
  v: z.literal(PROTOCOL_VERSION),
  id: z.string().uuid(),
  type: z.string().min(1),
  ts: z.number().int().nonnegative(),
});

export const ERROR_CODES = [
  'AUTH_REQUIRED',
  'AUTH_INVALID',
  'TOKEN_EXPIRED',
  'EMAIL_TAKEN',
  'RATE_LIMITED',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'NOT_YOUR_TURN',
  'INVALID_ACTION',
  'STALE_EPOCH',
  'SEQ_MISMATCH',
  'MESSAGE_TOO_LARGE',
  'GAME_FINISHED',
  'INTERNAL',
] as const;

export const ErrorCode = z.enum(ERROR_CODES);

export const ApiError = z.object({
  error: z.object({ code: ErrorCode, message: z.string() }),
});

export type Envelope = z.infer<typeof Envelope>;
export type ErrorCode = z.infer<typeof ErrorCode>;
export type ApiError = z.infer<typeof ApiError>;
