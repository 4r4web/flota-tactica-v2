import {
  CATALOG,
  cellsOf,
  placementFits,
  randomPlacement,
  RULES,
  SHIP_IDS,
  shipCells,
  validateFleet,
} from '@flota/domain';
import type { PlacementInput, ShipId } from '@flota/domain';
import { useMemo, useState } from 'react';

import { useGame } from '../store/game';
import { Board } from './Board';
import { CatalogCard } from './CatalogCard';

function canPlace(id: ShipId, at: number, vertical: boolean, others: PlacementInput[]): boolean {
  if (!placementFits(id, at, vertical)) {
    return false;
  }
  const occupied = new Set<number>();
  for (const other of others) {
    for (const cell of cellsOf(other)) {
      occupied.add(cell);
    }
  }
  return shipCells(id, at, vertical).every((cell) => !occupied.has(cell));
}

export function FleetBuilder() {
  const ready = useGame((state) => state.ready);
  const [picks, setPicks] = useState<ShipId[]>([]);
  const [placements, setPlacements] = useState<PlacementInput[]>([]);
  const [selected, setSelected] = useState<ShipId | null>(null);
  const [vertical, setVertical] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cost = useMemo(() => picks.reduce((total, id) => total + CATALOG[id].cost, 0), [picks]);

  const fleetReady = useMemo(() => {
    if (picks.length !== RULES.fleet || placements.length !== RULES.fleet) {
      return false;
    }
    try {
      validateFleet(placements);
      return true;
    } catch {
      return false;
    }
  }, [picks, placements]);

  const togglePick = (id: ShipId): void => {
    setError(null);
    if (picks.includes(id)) {
      const nextPicks = picks.filter((candidate) => candidate !== id);
      setPicks(nextPicks);
      setPlacements((current) => current.filter((placement) => placement.id !== id));
      if (selected === id) {
        setSelected(nextPicks[0] ?? null);
      }
      return;
    }
    if (picks.length >= RULES.fleet) {
      setError(`Solo puedes elegir ${RULES.fleet} barcos.`);
      return;
    }
    setPicks([...picks, id]);
    setSelected(id);
  };

  const placeShip = (cell: number): void => {
    if (selected === null) {
      return;
    }
    const others = placements.filter((placement) => placement.id !== selected);
    if (!canPlace(selected, cell, vertical, others)) {
      setError('Ahí no cabe. Prueba otra casilla u orientación.');
      return;
    }
    setError(null);
    const next = [...others, { id: selected, at: cell, vertical }];
    setPlacements(next);
    setSelected(picks.find((id) => !next.some((placement) => placement.id === id)) ?? selected);
  };

  const rotate = (): void => {
    setVertical((current) => !current);
    if (selected !== null) {
      setPlacements((current) => current.filter((placement) => placement.id !== selected));
    }
  };

  const randomize = (): void => {
    if (picks.length === 0) {
      return;
    }
    setError(null);
    setPlacements(randomPlacement(picks));
    setSelected(picks[0] ?? null);
  };

  const boardShips = placements.map((placement) => ({
    id: placement.id,
    at: placement.at,
    vertical: placement.vertical,
    hp: CATALOG[placement.id].hp,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <div className="rounded-xl border border-sea-700 bg-sea-900 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-mint">Elige tu flota</h2>
            <span className="text-xs text-muted">
              {picks.length}/{RULES.fleet} barcos · {cost}/{RULES.budget} puntos
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {SHIP_IDS.map((id) => (
              <CatalogCard
                key={id}
                id={id}
                selected={picks.includes(id)}
                disabled={picks.length >= RULES.fleet && !picks.includes(id)}
                onClick={() => togglePick(id)}
              />
            ))}
          </div>
        </div>

        {picks.length > 0 && (
          <Board
            label="Coloca tus barcos"
            ships={boardShips}
            selectedShipId={selected}
            onCellClick={placeShip}
          />
        )}
      </div>

      <aside className="space-y-3 rounded-xl border border-sea-700 bg-sea-900 p-4">
        <h2 className="text-sm font-bold text-mint">Preparación</h2>

        <div className="space-y-1">
          {picks.length === 0 && <p className="text-xs text-muted">Selecciona tres barcos.</p>}
          {picks.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              className={
                selected === id
                  ? 'flex w-full items-center justify-between rounded-md border border-mint bg-mint/10 px-3 py-2 text-xs text-ink'
                  : 'flex w-full items-center justify-between rounded-md border border-sea-700 px-3 py-2 text-xs text-muted hover:border-sea-600'
              }
            >
              <span>
                <span className="mr-2 font-mono text-mint">{CATALOG[id].mark}</span>
                {CATALOG[id].name}
              </span>
              <span>{placements.some((placement) => placement.id === id) ? '✓' : '…'}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={rotate}
            disabled={selected === null}
            className="rounded-md border border-sea-700 px-3 py-2 text-xs text-ink hover:border-mint disabled:opacity-50"
          >
            Girar
          </button>
          <button
            type="button"
            onClick={randomize}
            disabled={picks.length === 0}
            className="rounded-md border border-sea-700 px-3 py-2 text-xs text-ink hover:border-mint disabled:opacity-50"
          >
            Al azar
          </button>
        </div>

        <p className="text-[11px] text-muted">
          Toca una casilla para colocar el barco seleccionado. Orientación actual:{' '}
          <strong className="text-ink">{vertical ? 'vertical' : 'horizontal'}</strong>.
        </p>

        {error !== null && <p className="text-xs text-coral">{error}</p>}

        <button
          type="button"
          disabled={!fleetReady}
          onClick={() => ready(placements)}
          className="w-full rounded-lg bg-mint px-4 py-2 font-semibold text-sea-950 hover:brightness-110 disabled:opacity-50"
        >
          Flota preparada
        </button>
      </aside>
    </div>
  );
}
