import { describe, expect, it } from 'vitest';

import {
  attackCells,
  BOARD_SIZE,
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
} from '../src/index.js';

describe('board geometry', () => {
  it('maps cells to rows, columns and coordinates', () => {
    expect(BOARD_SIZE).toBe(10);
    expect(rowOf(54)).toBe(5);
    expect(colOf(54)).toBe(4);
    expect(coord(54)).toBe('F5');
    expect(coord(0)).toBe('A1');
    expect(coord(99)).toBe('J10');
    expect(cellAt(5, 4)).toBe(54);
    expect(manhattan(0, 9)).toBe(9);
    expect(manhattan(54, 44)).toBe(1);
  });

  it('validates cell indices', () => {
    expect(isValidCell(0)).toBe(true);
    expect(isValidCell(99)).toBe(true);
    expect(isValidCell(-1)).toBe(false);
    expect(isValidCell(100)).toBe(false);
    expect(isValidCell(1.5)).toBe(false);
  });
});

describe('ship cells', () => {
  it('lays out horizontal and vertical ships', () => {
    expect(shipCells('scout', 0, false)).toEqual([0, 1]);
    expect(shipCells('sub', 0, true)).toEqual([0, 10, 20]);
    expect(shipCells('dread', 0, false)).toEqual([0, 1, 2, 3]);
  });

  it('rejects placements that leave the board or wrap rows', () => {
    expect(placementFits('scout', 8, false)).toBe(true);
    expect(placementFits('dread', 8, false)).toBe(false);
    expect(placementFits('dread', 0, false)).toBe(true);
    expect(placementFits('sub', 90, true)).toBe(false);
    expect(() => cellsOf({ id: 'dread', at: 8, vertical: false })).toThrow(/does not fit/);
  });
});

describe('attack cells', () => {
  it('cannons hit a single cell', () => {
    expect(attackCells('cannon', 54, 'row')).toEqual([54]);
    expect(attackCells('cannon', 54, 'column')).toEqual([54]);
  });

  it('torpedoes hit up to three cells in a line', () => {
    expect(attackCells('torpedo', 0, 'row')).toEqual([0, 1, 2]);
    expect(attackCells('torpedo', 5, 'column')).toEqual([5, 15, 25]);
  });

  it('torpedo bounds do not wrap to another row', () => {
    expect(attackCells('torpedo', 9, 'row')).toEqual([9]);
    expect(attackCells('torpedo', 8, 'row')).toEqual([8, 9]);
    expect(attackCells('torpedo', 90, 'column')).toEqual([90]);
  });
});

describe('sonar cells', () => {
  it('covers a 3x3 area and clips at the edges', () => {
    expect(sonarCells(11)).toHaveLength(9);
    expect(sonarCells(0)).toEqual([0, 1, 10, 11]);
    expect(sonarCells(99)).toEqual([88, 89, 98, 99]);
    expect(sonarCells(9)).toEqual([8, 9, 18, 19]);
  });
});
