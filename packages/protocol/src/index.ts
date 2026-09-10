import { z } from 'zod';

/** Wire protocol version. Increment on incompatible changes. */
export const PROTOCOL_VERSION = 1;

export const SHIP_IDS = ['scout', 'sub', 'frigate', 'support', 'destroyer', 'dread'] as const;

export const ShipId = z.enum(SHIP_IDS);

/** Board cell index, 0-99. */
export const Cell = z.number().int().min(0).max(99);

/** Common envelope carried by every WebSocket message. */
export const Envelope = z.object({
  v: z.literal(PROTOCOL_VERSION),
  id: z.string().uuid(),
  type: z.string().min(1),
  ts: z.number().int().nonnegative(),
});

export const RegisterRequest = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
  displayName: z.string().min(1).max(32),
});

export const LoginRequest = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const Command = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('move'),
    ship: ShipId,
    dx: z.number().int(),
    dy: z.number().int(),
    distance: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal('attack'),
    ship: ShipId,
    target: Cell,
    axis: z.enum(['row', 'column']),
  }),
  z.object({
    kind: z.literal('ability'),
    ship: ShipId,
    target: Cell.optional(),
    ally: ShipId.optional(),
  }),
  z.object({ kind: z.literal('end') }),
]);

export type Envelope = z.infer<typeof Envelope>;
export type RegisterRequest = z.infer<typeof RegisterRequest>;
export type LoginRequest = z.infer<typeof LoginRequest>;
export type Command = z.infer<typeof Command>;
export type ShipId = z.infer<typeof ShipId>;
