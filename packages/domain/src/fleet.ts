import { cellsOf, CELL_COUNT, placementFits, shipCells } from './board.js';
import { DomainError } from './errors.js';
import { CATALOG, isShipId, RULES } from './rules.js';
import type { ShipId } from './rules.js';

export interface PlacementInput {
  readonly id: ShipId;
  readonly at: number;
  readonly vertical: boolean;
}

/** Total point cost of a set of ship classes. */
export function selectionCost(ids: readonly string[]): number {
  return ids.reduce((total, id) => total + (isShipId(id) ? CATALOG[id].cost : 0), 0);
}

/**
 * Validates a fleet selection: exactly three distinct, known classes within
 * the point budget.
 */
export function validateSelection(ids: readonly string[]): void {
  if (ids.length !== RULES.fleet) {
    throw new DomainError('INVALID_SELECTION', `fleet must have exactly ${RULES.fleet} ships`);
  }
  if (new Set(ids).size !== ids.length) {
    throw new DomainError('INVALID_SELECTION', 'ship classes must be distinct');
  }
  for (const id of ids) {
    if (!isShipId(id)) {
      throw new DomainError('INVALID_SELECTION', `unknown ship class: ${id}`);
    }
  }
  const cost = selectionCost(ids);
  if (cost > RULES.budget) {
    throw new DomainError(
      'INVALID_SELECTION',
      `fleet costs ${cost}, over the ${RULES.budget} budget`,
    );
  }
}

/**
 * Validates a full placement: correct selection, every ship fits on the board
 * and no two ships overlap. Ships may touch but never share a cell.
 */
export function validateFleet(ships: readonly PlacementInput[]): void {
  validateSelection(ships.map((ship) => ship.id));

  const used = new Set<number>();
  for (const ship of ships) {
    if (!placementFits(ship.id, ship.at, ship.vertical)) {
      throw new DomainError('INVALID_PLACEMENT', `ship ${ship.id} does not fit at ${ship.at}`);
    }
    for (const cell of cellsOf(ship)) {
      if (used.has(cell)) {
        throw new DomainError('OVERLAP', `cell ${cell} is occupied by more than one ship`);
      }
      used.add(cell);
    }
  }
}

/**
 * Generates a valid random placement for the given ship classes.
 *
 * @param rng Injectable random source (0..1) for deterministic tests.
 */
export function randomPlacement(
  ids: readonly ShipId[],
  rng: () => number = Math.random,
): PlacementInput[] {
  const placements: PlacementInput[] = [];
  const used = new Set<number>();

  for (const id of ids) {
    let placed: PlacementInput | null = null;

    for (let attempt = 0; attempt < 10_000 && placed === null; attempt += 1) {
      const vertical = rng() < 0.5;
      const at = Math.floor(rng() * CELL_COUNT);
      if (!placementFits(id, at, vertical)) {
        continue;
      }
      const cells = shipCells(id, at, vertical);
      if (cells.some((cell) => used.has(cell))) {
        continue;
      }
      placed = { id, at, vertical };
    }

    if (placed === null) {
      throw new DomainError('INVALID_PLACEMENT', `could not place ${id} on the board`);
    }
    for (const cell of cellsOf(placed)) {
      used.add(cell);
    }
    placements.push(placed);
  }

  return placements;
}
