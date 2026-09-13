import { CATALOG, cellsOf } from '@flota/domain';
import type { ShipId } from '@flota/domain';
import { Fragment, useState } from 'react';

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
  /** Cells fired at (misses are those not in `hits`). */
  shots?: number[];
  /** Cells that hit a ship (own incoming or enemy hits). */
  hits?: number[];
  onCellClick?: (cell: number) => void;
  disabled?: boolean;
}

/** Sprite sheet file for each ship class (a horizontal strip of N square tiles). */
const SHIP_IMAGE: Record<ShipId, string> = {
  scout: 'explorer',
  sub: 'submarine',
  frigate: 'frigate',
  support: 'shipyard',
  destroyer: 'destroyer',
  dread: 'battleship',
};

const COLUMNS = Array.from({ length: 10 }, (_, index) => index + 1);
const ROWS = Array.from({ length: 10 }, (_, index) => String.fromCharCode(65 + index));

interface Occupancy {
  shipId: ShipId;
  tile: number;
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
        tile: index,
        anchor: index === 0,
        sunk: (ship.hp ?? 1) <= 0,
        cloaked: ship.cloaked ?? false,
      });
    });
  }
  return map;
}

/** Renders a single square image, falling back to a text glyph on error. */
function BoardImage({ src, alt, fallback }: { src: string; alt: string; fallback: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="text-[10px] font-semibold">{fallback}</span>;
  }
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className="h-full w-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}

/** Shows one tile of a ship's horizontal sprite strip inside a cell. */
function ShipSprite({ id, tile, fallback }: { id: ShipId; tile: number; fallback: string }) {
  const [failed, setFailed] = useState(false);
  const [tiles, setTiles] = useState(CATALOG[id].size);

  if (failed) {
    return <span className="text-[10px] font-semibold">{fallback}</span>;
  }

  return (
    <span className="absolute inset-0 overflow-hidden">
      <img
        src={`/images/ships/${SHIP_IMAGE[id]}.png`}
        alt={CATALOG[id].name}
        draggable={false}
        className="absolute top-0 h-full max-w-none"
        style={{ width: `${tiles * 100}%`, left: `-${tile * 100}%` }}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalHeight > 0) {
            setTiles(Math.max(1, Math.round(image.naturalWidth / image.naturalHeight)));
          }
        }}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export function Board({
  label,
  ships = [],
  selectedShipId = null,
  aim = [],
  contacts = [],
  shots = [],
  hits = [],
  onCellClick,
  disabled = false,
}: BoardProps) {
  const occupancy = buildOccupancy(ships);
  const aimSet = new Set(aim);
  const contactSet = new Set(contacts);
  const shotSet = new Set(shots);
  const hitSet = new Set(hits);

  return (
    <section className="rounded-xl border border-sea-700 bg-sea-900 p-3" aria-label={label}>
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
              const isHit = hitSet.has(cell);
              const isMiss = shotSet.has(cell) && !isHit;
              const isContact = contactSet.has(cell);
              const isAim = aimSet.has(cell);
              const isSelected = occupied !== undefined && occupied.shipId === selectedShipId;

              return (
                <button
                  key={cell}
                  type="button"
                  disabled={disabled}
                  onClick={() => onCellClick?.(cell)}
                  title={`${row}${columnIndex + 1}`}
                  className={cn(
                    'relative flex aspect-square items-center justify-center rounded-[3px] transition-colors',
                    'bg-sea-800 text-muted',
                    occupied !== undefined && !occupied.sunk && 'bg-sea-600',
                    occupied?.sunk && 'bg-sea-700',
                    isContact && occupied === undefined && 'bg-amber/20 text-amber',
                    isSelected && 'ring-2 ring-mint',
                    isAim && 'outline outline-2 outline-amber',
                    disabled ? 'cursor-default' : 'cursor-pointer hover:brightness-125',
                  )}
                >
                  {occupied !== undefined && (
                    <span
                      className={cn(
                        'absolute inset-0',
                        occupied.sunk && 'opacity-50 grayscale',
                        occupied.cloaked && 'opacity-80',
                      )}
                    >
                      <ShipSprite
                        id={occupied.shipId}
                        tile={occupied.tile}
                        fallback={occupied.anchor ? CATALOG[occupied.shipId].mark : '━'}
                      />
                    </span>
                  )}

                  {isHit && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <BoardImage src="/images/impact.png" alt="Impacto" fallback="✕" />
                    </span>
                  )}
                  {isMiss && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <BoardImage src="/images/miss.png" alt="Agua" fallback="·" />
                    </span>
                  )}
                  {isContact && occupied === undefined && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-amber">
                      ◉
                    </span>
                  )}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
