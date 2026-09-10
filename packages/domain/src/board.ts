import { DomainError } from './errors.js';
import { CATALOG, RULES } from './rules.js';
import type { ShipId, Weapon } from './rules.js';

export type Axis = 'row' | 'column';

export const BOARD_SIZE = RULES.size;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

export function isValidCell(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < CELL_COUNT;
}

export function rowOf(cell: number): number {
  return Math.floor(cell / BOARD_SIZE);
}

export function colOf(cell: number): number {
  return cell % BOARD_SIZE;
}

export function cellAt(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

/** Human readable coordinate, e.g. cell 54 -> "F5". */
export function coord(cell: number): string {
  const row = String.fromCharCode(65 + rowOf(cell));
  return `${row}${colOf(cell) + 1}`;
}

/** Cells occupied by a ship starting at `at`, without bounds checking. */
export function shipCells(id: ShipId, at: number, vertical: boolean): number[] {
  const size = CATALOG[id].size;
  const step = vertical ? BOARD_SIZE : 1;
  const cells: number[] = [];
  for (let i = 0; i < size; i += 1) {
    cells.push(at + i * step);
  }
  return cells;
}

/** Whether a ship of class `id` can be placed at `at` with the given orientation. */
export function placementFits(id: ShipId, at: number, vertical: boolean): boolean {
  if (!isValidCell(at)) {
    return false;
  }
  const cells = shipCells(id, at, vertical);
  if (!cells.every(isValidCell)) {
    return false;
  }
  if (!vertical) {
    const row = rowOf(at);
    return cells.every((cell) => rowOf(cell) === row);
  }
  return true;
}

/** Cells occupied by a placed ship, validating the placement first. */
export function cellsOf(ship: { id: ShipId; at: number; vertical: boolean }): number[] {
  if (!placementFits(ship.id, ship.at, ship.vertical)) {
    throw new DomainError('INVALID_PLACEMENT', `ship ${ship.id} does not fit at ${ship.at}`);
  }
  return shipCells(ship.id, ship.at, ship.vertical);
}

/**
 * Cells covered by a weapon fired at `target`.
 *
 * Cannons hit a single cell. Torpedoes hit up to three cells in a straight
 * line to the right (row) or downwards (column), clipped at the board edge so
 * they never wrap to another row.
 */
export function attackCells(weapon: Weapon, target: number, axis: Axis): number[] {
  if (!isValidCell(target)) {
    return [];
  }
  if (weapon === 'cannon') {
    return [target];
  }

  const cells: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const cell = axis === 'row' ? target + i : target + i * BOARD_SIZE;
    if (!isValidCell(cell)) {
      break;
    }
    if (axis === 'row' && rowOf(cell) !== rowOf(target)) {
      break;
    }
    cells.push(cell);
  }
  return cells;
}

/** 3x3 area centred on `target`, clipped at the board edges. */
export function sonarCells(target: number): number[] {
  if (!isValidCell(target)) {
    return [];
  }
  const row = rowOf(target);
  const col = colOf(target);
  const cells: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        cells.push(cellAt(r, c));
      }
    }
  }
  return cells;
}

/** Orthogonal (Manhattan) distance between two cells. */
export function manhattan(a: number, b: number): number {
  return Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b));
}
