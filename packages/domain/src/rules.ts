/**
 * Core game rules and balance values.
 *
 * All tunable values live here so they can be adjusted without touching the
 * game logic. Values are ported from the prototype 0.1 specification.
 */

export const RULES = Object.freeze({
  /** Board is size x size cells. */
  size: 10,
  /** Exact number of ships per player. */
  fleet: 3,
  /** Maximum total point cost of a fleet. */
  budget: 13,
  /** Action points per player turn. */
  actions: 2,
  /** Maximum Manhattan distance between cells for ally repair. */
  repairRange: 2,
});

/** Canonical ship class identifiers. Order is the catalog display order. */
export const SHIP_IDS = ['scout', 'sub', 'frigate', 'support', 'destroyer', 'dread'] as const;

export type ShipId = (typeof SHIP_IDS)[number];

export type Weapon = 'cannon' | 'torpedo';

export type Ability = 'sonar' | 'cloak' | 'selfrepair' | 'repair' | null;

export interface ShipSpec {
  readonly id: ShipId;
  readonly mark: string;
  readonly name: string;
  readonly cost: number;
  readonly size: number;
  readonly hp: number;
  readonly speed: number;
  readonly power: number;
  readonly weapon: Weapon;
  readonly ability: Ability;
  readonly cooldown: number;
  readonly charges: number;
}

export const CATALOG: Readonly<Record<ShipId, ShipSpec>> = Object.freeze({
  scout: {
    id: 'scout',
    mark: 'EX',
    name: 'Explorador',
    cost: 2,
    size: 2,
    hp: 3,
    speed: 3,
    power: 1,
    weapon: 'cannon',
    ability: 'sonar',
    cooldown: 2,
    charges: 99,
  },
  sub: {
    id: 'sub',
    mark: 'SU',
    name: 'Submarino',
    cost: 4,
    size: 3,
    hp: 4,
    speed: 2,
    power: 1,
    weapon: 'torpedo',
    ability: 'cloak',
    cooldown: 3,
    charges: 3,
  },
  frigate: {
    id: 'frigate',
    mark: 'FR',
    name: 'Fragata',
    cost: 4,
    size: 3,
    hp: 6,
    speed: 2,
    power: 2,
    weapon: 'cannon',
    ability: 'selfrepair',
    cooldown: 3,
    charges: 2,
  },
  support: {
    id: 'support',
    mark: 'TA',
    name: 'Taller naval',
    cost: 3,
    size: 3,
    hp: 5,
    speed: 1,
    power: 1,
    weapon: 'cannon',
    ability: 'repair',
    cooldown: 2,
    charges: 2,
  },
  destroyer: {
    id: 'destroyer',
    mark: 'DE',
    name: 'Destructor',
    cost: 4,
    size: 3,
    hp: 5,
    speed: 3,
    power: 2,
    weapon: 'torpedo',
    ability: null,
    cooldown: 0,
    charges: 0,
  },
  dread: {
    id: 'dread',
    mark: 'AC',
    name: 'Acorazado',
    cost: 6,
    size: 4,
    hp: 9,
    speed: 1,
    power: 3,
    weapon: 'cannon',
    ability: null,
    cooldown: 0,
    charges: 0,
  },
});

export function spec(id: ShipId): ShipSpec {
  return CATALOG[id];
}

export function isShipId(value: string): value is ShipId {
  return (SHIP_IDS as readonly string[]).includes(value);
}
