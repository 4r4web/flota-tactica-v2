import { SHIP_IDS } from '@flota/domain';
import { z } from 'zod';

export const ShipId = z.enum(SHIP_IDS);

/** Board cell index, 0-99. */
export const Cell = z.number().int().min(0).max(99);

export const Axis = z.enum(['row', 'column']);

export const Role = z.enum(['host', 'guest']);

export const Phase = z.enum(['placement', 'waiting', 'turn', 'opponent', 'finished']);

/** Ship placement sent to the authoritative server. Positions stay private. */
export const Placement = z.object({
  id: ShipId,
  at: Cell,
  vertical: z.boolean(),
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
    axis: Axis,
  }),
  z.object({
    kind: z.literal('ability'),
    ship: ShipId,
    target: Cell.optional(),
    ally: ShipId.optional(),
  }),
  z.object({ kind: z.literal('end') }),
]);

export const ActionResult = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('move'), ship: ShipId }),
  z.object({
    kind: z.literal('attack'),
    ship: ShipId,
    hits: z.array(Cell),
    sunk: z.array(ShipId),
  }),
  z.object({
    kind: z.literal('ability'),
    ship: ShipId,
    ability: z.enum(['sonar', 'cloak', 'selfrepair', 'repair']),
    contacts: z.array(Cell).optional(),
    healed: z.number().int().optional(),
  }),
  z.object({ kind: z.literal('end') }),
]);

export const OwnShip = z.object({
  id: ShipId,
  at: Cell,
  vertical: z.boolean(),
  hp: z.number().int().min(0),
  maxHp: z.number().int().positive(),
  cloaked: z.boolean(),
  charges: z.number().int().min(0),
  nextAbility: z.number().int(),
  usedThisTurn: z.object({
    move: z.boolean(),
    attack: z.boolean(),
    ability: z.boolean(),
  }),
});

export const EnemyShip = z.object({
  id: ShipId,
  sunk: z.boolean(),
});

export const PlayerView = z.object({
  gameId: z.string().uuid(),
  epoch: z.number().int().min(0),
  phase: Phase,
  turn: z.number().int().min(0),
  ap: z.number().int().min(0),
  role: Role,
  myFleet: z.array(OwnShip),
  enemyShips: z.array(EnemyShip),
  myShots: z.array(Cell),
  myIncoming: z.array(Cell),
  contacts: z.array(Cell),
  rematch: z.object({ host: z.boolean(), guest: z.boolean() }),
  winner: z.enum(['me', 'peer']).nullable(),
});

export type ShipId = z.infer<typeof ShipId>;
export type Cell = z.infer<typeof Cell>;
export type Axis = z.infer<typeof Axis>;
export type Role = z.infer<typeof Role>;
export type Phase = z.infer<typeof Phase>;
export type Placement = z.infer<typeof Placement>;
export type Command = z.infer<typeof Command>;
export type ActionResult = z.infer<typeof ActionResult>;
export type OwnShip = z.infer<typeof OwnShip>;
export type EnemyShip = z.infer<typeof EnemyShip>;
export type PlayerView = z.infer<typeof PlayerView>;
