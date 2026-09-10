import { describe, expect, it } from 'vitest';

import { CATALOG, RULES, SHIP_IDS } from '../src/index.js';

describe('RULES', () => {
  it('defines a 10x10 board, a 3-ship fleet and a 13-point budget', () => {
    expect(RULES.size).toBe(10);
    expect(RULES.fleet).toBe(3);
    expect(RULES.budget).toBe(13);
    expect(RULES.actions).toBe(2);
    expect(RULES.repairRange).toBe(2);
  });
});

describe('CATALOG', () => {
  it('exposes exactly six ship classes', () => {
    expect(SHIP_IDS).toHaveLength(6);
    expect(Object.keys(CATALOG)).toHaveLength(6);
  });

  it('keeps every ship cost within the budget', () => {
    for (const ship of Object.values(CATALOG)) {
      expect(ship.cost).toBeGreaterThan(0);
      expect(ship.cost).toBeLessThanOrEqual(RULES.budget);
    }
  });

  it('matches the documented stats for key ships', () => {
    expect(CATALOG.dread).toMatchObject({ cost: 6, hp: 9, power: 3, speed: 1, weapon: 'cannon' });
    expect(CATALOG.sub).toMatchObject({ cost: 4, hp: 4, ability: 'cloak', weapon: 'torpedo' });
    expect(CATALOG.scout).toMatchObject({ cost: 2, speed: 3, ability: 'sonar' });
  });
});
