import { CATALOG, RULES } from '@flota/domain';
import type { ShipId } from '@flota/domain';

export type PickBlock = 'full' | 'budget' | null;

/** Total point cost of the current picks. */
export function picksCost(picks: readonly ShipId[]): number {
  return picks.reduce((total, id) => total + CATALOG[id].cost, 0);
}

/**
 * Why a ship class cannot be added to the current selection, if at all.
 *
 * `full` means the fleet already has the maximum number of ships, `budget`
 * means adding it would exceed the point budget.
 */
export function pickBlock(picks: readonly ShipId[], id: ShipId): PickBlock {
  if (picks.includes(id)) {
    return null;
  }
  if (picks.length >= RULES.fleet) {
    return 'full';
  }
  if (picksCost(picks) + CATALOG[id].cost > RULES.budget) {
    return 'budget';
  }
  return null;
}
