export {
  attackCells,
  BOARD_SIZE,
  CELL_COUNT,
  cellAt,
  cellsOf,
  colOf,
  coord,
  isValidCell,
  manhattan,
  placementFits,
  rowOf,
  shipCells,
  sonarCells,
} from './board.js';
export type { Axis } from './board.js';

export { DomainError, isDomainError } from './errors.js';
export type { DomainErrorCode } from './errors.js';

export { randomPlacement, selectionCost, validateFleet, validateSelection } from './fleet.js';
export type { PlacementInput } from './fleet.js';

export {
  applyCommand,
  createGame,
  lockFleet,
  opponentOf,
  phaseFor,
  requestRematch,
  turnRole,
  viewFor,
} from './game.js';

export { CATALOG, isShipId, RULES, SHIP_IDS, spec } from './rules.js';
export type { Ability, ShipId, ShipSpec, Weapon } from './rules.js';

export type {
  ActionResult,
  Command,
  EnemyShipView,
  GameState,
  GameStatus,
  OwnShipView,
  Phase,
  PlayerState,
  PlayerView,
  Role,
  ShipLedger,
  ShipState,
} from './types.js';
