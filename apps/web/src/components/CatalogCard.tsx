import { CATALOG } from '@flota/domain';
import type { ShipId } from '@flota/domain';

import { cn } from '../lib/cn';

export function CatalogCard({
  id,
  selected = false,
  disabled = false,
  onClick,
}: {
  id: ShipId;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const ship = CATALOG[id];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
        selected ? 'border-mint bg-mint/10' : 'border-sea-700 bg-sea-900 hover:border-sea-600',
        disabled && 'opacity-50',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">
          <span className="mr-2 font-mono text-mint">{ship.mark}</span>
          {ship.name}
        </span>
        <span className="rounded bg-sea-700 px-1.5 py-0.5 text-[10px] text-ink">
          {ship.cost} pt
        </span>
      </div>
      <dl className="grid grid-cols-4 gap-1 text-[10px] text-muted">
        <div>
          <dt>PV</dt>
          <dd className="text-ink">{ship.hp}</dd>
        </div>
        <div>
          <dt>Vel</dt>
          <dd className="text-ink">{ship.speed}</dd>
        </div>
        <div>
          <dt>Poder</dt>
          <dd className="text-ink">{ship.power}</dd>
        </div>
        <div>
          <dt>Arma</dt>
          <dd className="text-ink">{ship.weapon === 'cannon' ? 'Cañón' : 'Torpedo'}</dd>
        </div>
      </dl>
    </button>
  );
}
