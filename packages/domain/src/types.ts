import type { Axis } from './board.js';
import type { Ability, ShipId } from './rules.js';

export type Role = 'host' | 'guest';

export type GameStatus = 'placement' | 'active' | 'finished';

/** Per-player phase shown to the client. */
export type Phase = 'placement' | 'waiting' | 'turn' | 'opponent' | 'finished';

export interface ShipLedger {
  /** Turn index when the ship last moved. */
  move: number;
  /** Turn index when the ship last attacked. */
  attack: number;
  /** Turn index when the ship last used an ability. */
  ability: number;
  /** Earliest turn index at which the ability can be used again. */
  nextAbility: number;
  /** Remaining ability charges for the match. */
  charges: number;
}

export interface ShipState {
  id: ShipId;
  at: number;
  vertical: boolean;
  hp: number;
  /** Turn index until which the ship is cloaked (-1 when not cloaked). */
  cloakUntil: number;
  ledger: ShipLedger;
}

export interface PlayerState {
  ready: boolean;
  rematch: boolean;
  fleet: ShipState[];
  /** Cells this player has fired at (public history). */
  shots: number[];
  /** Cells where this player's ships were hit. */
  incoming: number[];
  /** Sonar contacts revealed this turn. */
  contacts: number[];
}

export interface GameState {
  id: string;
  epoch: number;
  turn: number;
  ap: number;
  seq: number;
  status: GameStatus;
  winner: Role | null;
  players: Record<Role, PlayerState>;
}

export type Command =
  | { kind: 'move'; ship: ShipId; dx: number; dy: number; distance: number }
  | { kind: 'attack'; ship: ShipId; target: number; axis: Axis }
  | { kind: 'ability'; ship: ShipId; target?: number; ally?: ShipId }
  | { kind: 'end' };

export type ActionResult =
  | { kind: 'move'; ship: ShipId }
  | { kind: 'attack'; ship: ShipId; hits: number[]; sunk: ShipId[] }
  | {
      kind: 'ability';
      ship: ShipId;
      ability: Exclude<Ability, null>;
      contacts?: number[];
      healed?: number;
    }
  | { kind: 'end' };

export interface OwnShipView {
  id: ShipId;
  at: number;
  vertical: boolean;
  hp: number;
  maxHp: number;
  cloaked: boolean;
  charges: number;
  nextAbility: number;
  usedThisTurn: { move: boolean; attack: boolean; ability: boolean };
}

export interface EnemyShipView {
  id: ShipId;
  sunk: boolean;
}

/** Filtered, per-player view of the game. Never leaks private rival data. */
export interface PlayerView {
  gameId: string;
  epoch: number;
  phase: Phase;
  turn: number;
  ap: number;
  role: Role;
  myFleet: OwnShipView[];
  enemyShips: EnemyShipView[];
  myShots: number[];
  myIncoming: number[];
  contacts: number[];
  rematch: { host: boolean; guest: boolean };
  winner: 'me' | 'peer' | null;
}
