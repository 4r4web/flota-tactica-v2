import { CATALOG, cellsOf } from '@flota/domain';
import type { ShipId } from '@flota/domain';
import { Fragment } from 'react';

import { cn } from '../lib/cn';

export interface BoardShip {
  id: ShipId;
  at: number;
  vertical: boolean;
  hp?: number;
  cloaked?: boolean;
}

export interface BoardProps {
  label: string;
  ships?: BoardShip[];
  selectedShipId?: ShipId | null;
  aim?: number[];
  contacts?: number[];
  shots?: number[];
  incoming?: number[];
  onCellClick?: (cell: number) => void;
  disabled?: boolean;
}

const COLUMNS = Array.from({ length: 10 }, (_, index) => index + 1);
const ROWS = Array.from({ length: 10 }, (_, index) => String.fromCharCode(65 + index));

interface Occupancy {
  shipId: ShipId;
  anchor: boolean;
  sunk: boolean;
  cloaked: boolean;
}

function buildOccupancy(ships: BoardShip[]): Map<number, Occupancy> {
  const map = new Map<number, Occupancy>();
  for (const ship of ships) {
    const cells = cellsOf(ship);
    cells.forEach((cell, index) => {
      map.set(cell, {
        shipId: ship.id,
        anchor: index === 0,
        sunk: (ship.hp ?? 1) <= 0,
        cloaked: ship.cloaked ?? false,
      });
    });
  }
  return map;
}

export function Board({
  label,
  ships = [],
  selectedShipId = null,
  aim = [],
  contacts = [],
  shots = [],
  incoming = [],
  onCellClick,
  disabled = false,
}: BoardProps) {
  const occupancy = buildOccupancy(ships);
  const aimSet = new Set(aim);
  const contactSet = new Set(contacts);
  const shotSet = new Set(shots);
  const incomingSet = new Set(incoming);

  return (
    <section className="rounded-xl border border-sea-700 bg-sea-900 p-3">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink">{label}</h2>
        <span className="text-[10px] uppercase tracking-widest text-muted">10 × 10</span>
      </header>

      <div className="grid grid-cols-[auto_repeat(10,minmax(0,1fr))] gap-1">
        <div />
        {COLUMNS.map((column) => (
          <div key={`col-${column}`} className="text-center text-[9px] text-muted">
            {column}
          </div>
        ))}

        {ROWS.map((row, rowIndex) => (
          <Fragment key={row}>
            <div className="flex items-center text-[9px] text-muted">{row}</div>
            {COLUMNS.map((_, columnIndex) => {
              const cell = rowIndex * 10 + columnIndex;
              const occupied = occupancy.get(cell);
              const isAim = aimSet.has(cell);
              const isSelected = occupied !== undefined && occupied.shipId === selectedShipId;

              let content = '';
              if (occupied !== undefined) {
                if (occupied.sunk) {
                  content = '✕';
                } else if (occupied.anchor) {
                  content = CATALOG[occupied.shipId].mark;
                } else {
                  content = '━';
                }
              } else if (incomingSet.has(cell)) {
                content = '×';
              } else if (contactSet.has(cell)) {
                content = '◉';
              } else if (shotSet.has(cell)) {
                content = '·';
              }

              return (
                <button
                  key={cell}
                  type="button"
                  disabled={disabled}
                  onClick={() => onCellClick?.(cell)}
                  title={`${row}${columnIndex + 1}`}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-[3px] text-[10px] font-semibold transition-colors',
                    'bg-sea-800 text-muted',
                    occupied !== undefined && !occupied.sunk && 'bg-sea-600 text-mint',
                    occupied?.sunk && 'bg-sea-700 text-coral/70 line-through',
                    occupied?.cloaked && 'ring-1 ring-mint/60',
                    isSelected && 'ring-2 ring-mint',
                    incomingSet.has(cell) && occupied === undefined && 'text-coral',
                    contactSet.has(cell) && 'bg-amber/20 text-amber',
                    isAim && 'outline outline-2 outline-amber',
                    disabled ? 'cursor-default' : 'cursor-pointer hover:brightness-125',
                  )}
                >
                  {content}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
