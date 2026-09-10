import { describe, expect, it } from 'vitest';

import { randomPlacement, selectionCost, validateFleet, validateSelection } from '../src/index.js';
import type { PlacementInput } from '../src/index.js';

describe('fleet selection', () => {
  it('accepts three distinct classes within budget', () => {
    expect(() => validateSelection(['scout', 'sub', 'support'])).not.toThrow();
    expect(selectionCost(['scout', 'sub', 'support'])).toBe(9);
    expect(selectionCost(['sub', 'frigate', 'destroyer'])).toBe(12);
  });

  it('rejects wrong counts, duplicates and unknown classes', () => {
    expect(() => validateSelection(['scout', 'sub'])).toThrow(/exactly 3/);
    expect(() => validateSelection(['scout', 'scout', 'sub'])).toThrow(/distinct/);
    expect(() => validateSelection(['scout', 'sub', 'carrier'])).toThrow(/unknown/);
  });

  it('rejects fleets over the 13-point budget', () => {
    expect(() => validateSelection(['dread', 'destroyer', 'sub'])).toThrow(/budget/);
    expect(selectionCost(['dread', 'destroyer', 'sub'])).toBe(14);
  });
});

describe('fleet placement', () => {
  it('accepts ships that touch but do not overlap', () => {
    const ships: PlacementInput[] = [
      { id: 'scout', at: 0, vertical: false },
      { id: 'sub', at: 2, vertical: false },
      { id: 'support', at: 30, vertical: false },
    ];
    expect(() => validateFleet(ships)).not.toThrow();
  });

  it('rejects overlapping ships', () => {
    const ships: PlacementInput[] = [
      { id: 'scout', at: 0, vertical: false },
      { id: 'sub', at: 1, vertical: false },
      { id: 'support', at: 30, vertical: false },
    ];
    expect(() => validateFleet(ships)).toThrow(/occupied/);
  });

  it('rejects ships that do not fit', () => {
    const ships: PlacementInput[] = [
      { id: 'scout', at: 0, vertical: false },
      { id: 'sub', at: 20, vertical: false },
      { id: 'dread', at: 8, vertical: false },
    ];
    expect(() => validateFleet(ships)).toThrow(/does not fit/);
  });
});

describe('random placement', () => {
  it('always produces valid fleets', () => {
    for (let i = 0; i < 100; i += 1) {
      const ships = randomPlacement(['scout', 'sub', 'support']);
      expect(() => validateFleet(ships)).not.toThrow();
    }
  });
});
