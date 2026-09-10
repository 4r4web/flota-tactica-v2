import {
  attackCells,
  cellsOf,
  isValidCell,
  manhattan,
  placementFits,
  sonarCells,
  BOARD_SIZE,
} from './board.js';
import { DomainError } from './errors.js';
import { validateFleet } from './fleet.js';
import type { PlacementInput } from './fleet.js';
import { CATALOG, RULES } from './rules.js';
import type { ShipId } from './rules.js';
import type {
  ActionResult,
  Command,
  GameState,
  OwnShipView,
  Phase,
  PlayerState,
  PlayerView,
  Role,
  ShipState,
} from './types.js';

const ROLES: readonly Role[] = ['host', 'guest'];

export function opponentOf(role: Role): Role {
  return role === 'host' ? 'guest' : 'host';
}

export function turnRole(state: GameState): Role {
  return state.turn % 2 === 0 ? 'host' : 'guest';
}

function emptyPlayer(): PlayerState {
  return { ready: false, rematch: false, fleet: [], shots: [], incoming: [], contacts: [] };
}

export function createGame(id: string): GameState {
  return {
    id,
    epoch: 0,
    turn: 0,
    ap: RULES.actions,
    seq: 0,
    status: 'placement',
    winner: null,
    players: { host: emptyPlayer(), guest: emptyPlayer() },
  };
}

function clonePlayer(player: PlayerState): PlayerState {
  return {
    ready: player.ready,
    rematch: player.rematch,
    fleet: player.fleet.map((ship) => ({ ...ship, ledger: { ...ship.ledger } })),
    shots: [...player.shots],
    incoming: [...player.incoming],
    contacts: [...player.contacts],
  };
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: {
      host: clonePlayer(state.players.host),
      guest: clonePlayer(state.players.guest),
    },
  };
}

function toShipState(placement: PlacementInput): ShipState {
  const spec = CATALOG[placement.id];
  return {
    id: placement.id,
    at: placement.at,
    vertical: placement.vertical,
    hp: spec.hp,
    cloakUntil: -1,
    ledger: {
      move: -1,
      attack: -1,
      ability: -1,
      nextAbility: 0,
      charges: spec.charges,
    },
  };
}

/** Locks a player's fleet. Starts the match once both players are ready. */
export function lockFleet(
  state: GameState,
  role: Role,
  ships: readonly PlacementInput[],
): GameState {
  if (state.status === 'finished') {
    throw new DomainError('GAME_FINISHED', 'cannot lock a fleet after the match ended');
  }
  if (state.players[role].ready) {
    throw new DomainError('ALREADY_READY', 'fleet already locked');
  }
  validateFleet(ships);

  const next = cloneState(state);
  next.players[role].fleet = ships.map(toShipState);
  next.players[role].ready = true;

  if (ROLES.every((r) => next.players[r].ready)) {
    next.status = 'active';
    next.turn = 0;
    next.ap = RULES.actions;
    next.seq = 0;
  }
  return next;
}

function requireShip(player: PlayerState, id: ShipId): ShipState {
  const ship = player.fleet.find((candidate) => candidate.id === id);
  if (ship === undefined) {
    throw new DomainError('SHIP_NOT_FOUND', `ship ${id} is not in this fleet`);
  }
  return ship;
}

function requireAlive(ship: ShipState): void {
  if (ship.hp <= 0) {
    throw new DomainError('SHIP_SUNK', `ship ${ship.id} is sunk`);
  }
}

function requireAvailable(
  ship: ShipState,
  kind: 'move' | 'attack' | 'ability',
  turn: number,
): void {
  if (ship.ledger[kind] === turn) {
    throw new DomainError('ACTION_ALREADY_USED', `ship ${ship.id} already used ${kind} this turn`);
  }
}

function assertTurn(state: GameState, role: Role): void {
  if (state.status !== 'active') {
    throw new DomainError('GAME_NOT_ACTIVE', `game is ${state.status}`);
  }
  if (role !== turnRole(state)) {
    throw new DomainError('NOT_YOUR_TURN', `it is ${turnRole(state)}'s turn`);
  }
  if (state.ap <= 0) {
    throw new DomainError('NO_ACTIONS_LEFT', 'no actions left this turn');
  }
}

function moveShip(
  player: PlayerState,
  ship: ShipState,
  dx: number,
  dy: number,
  distance: number,
): void {
  if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) + Math.abs(dy) !== 1) {
    throw new DomainError('INVALID_MOVE', 'direction must be a single orthogonal step');
  }
  const speed = CATALOG[ship.id].speed;
  if (!Number.isInteger(distance) || distance < 1 || distance > speed) {
    throw new DomainError('INVALID_MOVE', `distance must be between 1 and ${speed}`);
  }

  const blocked = new Set<number>();
  for (const other of player.fleet) {
    if (other.id === ship.id || other.hp <= 0) {
      continue;
    }
    for (const cell of cellsOf(other)) {
      blocked.add(cell);
    }
  }

  let current = ship.at;
  for (let step = 0; step < distance; step += 1) {
    const next = current + dx + dy * BOARD_SIZE;
    if (!isValidCell(next) || !placementFits(ship.id, next, ship.vertical)) {
      throw new DomainError('INVALID_MOVE', 'move leaves the board');
    }
    if (blocked.has(next)) {
      throw new DomainError('INVALID_MOVE', 'path is blocked');
    }
    current = next;
  }
  ship.at = current;
}

function resolveAttack(
  target: PlayerState,
  cells: readonly number[],
  power: number,
): { hits: number[]; sunk: ShipId[] } {
  const hitShips = new Set<ShipId>();
  const hits = new Set<number>();

  for (const cell of cells) {
    for (const ship of target.fleet) {
      if (ship.hp <= 0) {
        continue;
      }
      if (cellsOf(ship).includes(cell)) {
        hitShips.add(ship.id);
        hits.add(cell);
      }
    }
  }

  const sunk: ShipId[] = [];
  for (const ship of target.fleet) {
    if (!hitShips.has(ship.id)) {
      continue;
    }
    ship.hp = Math.max(0, ship.hp - power);
    if (ship.hp === 0) {
      sunk.push(ship.id);
    }
  }

  return { hits: [...hits].toSorted((a, b) => a - b), sunk };
}

function resolveSonar(target: PlayerState, area: readonly number[], turn: number): number[] {
  const contacts = new Set<number>();
  for (const ship of target.fleet) {
    if (ship.hp <= 0 || ship.cloakUntil > turn) {
      continue;
    }
    for (const cell of cellsOf(ship)) {
      if (area.includes(cell)) {
        contacts.add(cell);
      }
    }
  }
  return [...contacts].toSorted((a, b) => a - b);
}

function withinRepairRange(source: ShipState, ally: ShipState): boolean {
  for (const a of cellsOf(source)) {
    for (const b of cellsOf(ally)) {
      if (manhattan(a, b) <= RULES.repairRange) {
        return true;
      }
    }
  }
  return false;
}

function applyAbility(
  state: GameState,
  role: Role,
  ship: ShipState,
  cmd: Extract<Command, { kind: 'ability' }>,
): ActionResult {
  const actor = state.players[role];
  const opponent = state.players[opponentOf(role)];
  const ability = CATALOG[ship.id].ability;

  if (ability === null) {
    throw new DomainError('ABILITY_UNAVAILABLE', `ship ${ship.id} has no ability`);
  }
  if (ship.ledger.charges <= 0) {
    throw new DomainError('NO_CHARGES', `ship ${ship.id} has no charges left`);
  }
  if (state.turn < ship.ledger.nextAbility) {
    throw new DomainError('ON_COOLDOWN', `ship ${ship.id} is on cooldown`);
  }

  let result: ActionResult;

  switch (ability) {
    case 'sonar': {
      if (cmd.target === undefined || !isValidCell(cmd.target)) {
        throw new DomainError('INVALID_TARGET', 'sonar needs a valid target cell');
      }
      const contacts = resolveSonar(opponent, sonarCells(cmd.target), state.turn);
      actor.contacts = contacts;
      result = { kind: 'ability', ship: ship.id, ability, contacts };
      break;
    }
    case 'cloak': {
      ship.cloakUntil = state.turn + 4;
      result = { kind: 'ability', ship: ship.id, ability };
      break;
    }
    case 'selfrepair': {
      const max = CATALOG[ship.id].hp;
      if (ship.hp >= max) {
        throw new DomainError('INVALID_TARGET', 'ship is already at full health');
      }
      const healed = Math.min(2, max - ship.hp);
      ship.hp += healed;
      result = { kind: 'ability', ship: ship.id, ability, healed };
      break;
    }
    case 'repair': {
      if (cmd.ally === undefined) {
        throw new DomainError('INVALID_ALLY', 'ally repair needs a target ally');
      }
      const ally = requireShip(actor, cmd.ally);
      if (ally.id === ship.id) {
        throw new DomainError('INVALID_ALLY', 'cannot repair itself with ally repair');
      }
      if (ally.hp <= 0) {
        throw new DomainError('INVALID_ALLY', `ally ${ally.id} is sunk`);
      }
      const max = CATALOG[ally.id].hp;
      if (ally.hp >= max) {
        throw new DomainError('INVALID_ALLY', `ally ${ally.id} is at full health`);
      }
      if (!withinRepairRange(ship, ally)) {
        throw new DomainError('INVALID_ALLY', `ally ${ally.id} is out of repair range`);
      }
      const healed = Math.min(3, max - ally.hp);
      ally.hp += healed;
      result = { kind: 'ability', ship: ship.id, ability, healed };
      break;
    }
  }

  ship.ledger.ability = state.turn;
  ship.ledger.nextAbility = state.turn + CATALOG[ship.id].cooldown * 2;
  ship.ledger.charges -= 1;
  return result;
}

/**
 * Applies a command for the given role, returning the new state and the
 * public result. Throws a {@link DomainError} if the command is illegal.
 */
export function applyCommand(
  state: GameState,
  role: Role,
  cmd: Command,
): { state: GameState; result: ActionResult } {
  assertTurn(state, role);

  const next = cloneState(state);
  const actor = next.players[role];
  const opponent = next.players[opponentOf(role)];

  let result: ActionResult;

  switch (cmd.kind) {
    case 'move': {
      const ship = requireShip(actor, cmd.ship);
      requireAlive(ship);
      requireAvailable(ship, 'move', next.turn);
      moveShip(actor, ship, cmd.dx, cmd.dy, cmd.distance);
      ship.ledger.move = next.turn;
      result = { kind: 'move', ship: ship.id };
      break;
    }
    case 'attack': {
      const ship = requireShip(actor, cmd.ship);
      requireAlive(ship);
      requireAvailable(ship, 'attack', next.turn);
      if (!isValidCell(cmd.target)) {
        throw new DomainError('INVALID_TARGET', 'attack target is off the board');
      }
      const cells = attackCells(CATALOG[ship.id].weapon, cmd.target, cmd.axis);
      ship.cloakUntil = -1;
      const { hits, sunk } = resolveAttack(opponent, cells, CATALOG[ship.id].power);
      ship.ledger.attack = next.turn;
      actor.shots.push(...cells);
      opponent.incoming.push(...hits);
      result = { kind: 'attack', ship: ship.id, hits, sunk };

      if (opponent.fleet.length > 0 && opponent.fleet.every((candidate) => candidate.hp === 0)) {
        next.status = 'finished';
        next.winner = role;
      }
      break;
    }
    case 'ability': {
      const ship = requireShip(actor, cmd.ship);
      requireAlive(ship);
      requireAvailable(ship, 'ability', next.turn);
      result = applyAbility(next, role, ship, cmd);
      break;
    }
    case 'end': {
      result = { kind: 'end' };
      break;
    }
  }

  next.seq += 1;
  next.ap = cmd.kind === 'end' ? 0 : next.ap - 1;

  if (next.ap <= 0 && next.status !== 'finished') {
    next.turn += 1;
    next.ap = RULES.actions;
    next.players[role].contacts = [];
  }

  return { state: next, result };
}

/** Requests a rematch. Resets the match (new epoch) when both players agree. */
export function requestRematch(state: GameState, role: Role): GameState {
  if (state.status !== 'finished') {
    throw new DomainError('REMATCH_NOT_ALLOWED', 'the match is not finished');
  }
  const next = cloneState(state);
  next.players[role].rematch = true;

  if (ROLES.every((r) => next.players[r].rematch)) {
    return {
      id: next.id,
      epoch: next.epoch + 1,
      turn: 0,
      ap: RULES.actions,
      seq: 0,
      status: 'placement',
      winner: null,
      players: { host: emptyPlayer(), guest: emptyPlayer() },
    };
  }
  return next;
}

export function phaseFor(state: GameState, role: Role): Phase {
  if (state.status === 'finished') {
    return 'finished';
  }
  if (state.status === 'placement') {
    return state.players[role].ready ? 'waiting' : 'placement';
  }
  return role === turnRole(state) ? 'turn' : 'opponent';
}

function ownShipView(ship: ShipState, turn: number): OwnShipView {
  return {
    id: ship.id,
    at: ship.at,
    vertical: ship.vertical,
    hp: ship.hp,
    maxHp: CATALOG[ship.id].hp,
    cloaked: ship.cloakUntil > turn,
    charges: ship.ledger.charges,
    nextAbility: ship.ledger.nextAbility,
    usedThisTurn: {
      move: ship.ledger.move === turn,
      attack: ship.ledger.attack === turn,
      ability: ship.ledger.ability === turn,
    },
  };
}

/** Builds the filtered view for a player, hiding all rival private state. */
export function viewFor(state: GameState, role: Role): PlayerView {
  const own = state.players[role];
  const enemy = state.players[opponentOf(role)];

  return {
    gameId: state.id,
    epoch: state.epoch,
    phase: phaseFor(state, role),
    turn: state.turn,
    ap: state.ap,
    role,
    myFleet: own.fleet.map((ship) => ownShipView(ship, state.turn)),
    enemyShips: enemy.fleet.map((ship) => ({ id: ship.id, sunk: ship.hp <= 0 })),
    myShots: [...own.shots],
    myIncoming: [...own.incoming],
    contacts: [...own.contacts],
    rematch: { host: state.players.host.rematch, guest: state.players.guest.rematch },
    winner: state.winner === null ? null : state.winner === role ? 'me' : 'peer',
  };
}
