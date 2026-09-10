import { attackCells, CATALOG, cellsOf, sonarCells } from '@flota/domain';
import type { ShipId } from '@flota/domain';
import type { PlayerView } from '@flota/protocol';
import { useState } from 'react';

import { cn } from '../lib/cn';
import { useGame } from '../store/game';
import { Board } from './Board';

const PHASE_LABEL: Record<string, string> = {
  placement: 'Preparando flota',
  waiting: 'Esperando al rival',
  turn: 'Tu turno',
  opponent: 'Turno del rival',
  finished: 'Partida terminada',
};

export function BattleView({ view }: { view: PlayerView }) {
  const act = useGame((state) => state.act);
  const rematch = useGame((state) => state.rematch);

  const [selectedShip, setSelectedShip] = useState<ShipId | null>(null);
  const [aimMode, setAimMode] = useState<'attack' | 'sonar' | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [axis, setAxis] = useState<'row' | 'column'>('row');
  const [distance, setDistance] = useState(1);
  const [ally, setAlly] = useState<ShipId | null>(null);

  const active = view.phase === 'turn';
  const own = view.myFleet.find((ship) => ship.id === selectedShip) ?? null;
  const spec = selectedShip === null ? null : CATALOG[selectedShip];

  const aimCells =
    target === null || spec === null || aimMode === null
      ? []
      : aimMode === 'attack'
        ? attackCells(spec.weapon, target, axis)
        : sonarCells(target);

  const resetAim = (): void => {
    setAimMode(null);
    setTarget(null);
    setAlly(null);
  };

  const selectShip = (id: ShipId): void => {
    setSelectedShip(id);
    setDistance(1);
    resetAim();
  };

  const onEnemyCell = (cell: number): void => {
    if (active && aimMode !== null) {
      setTarget(cell);
    }
  };

  const confirmAim = (): void => {
    if (selectedShip === null || target === null) {
      return;
    }
    if (aimMode === 'attack') {
      act({ kind: 'attack', ship: selectedShip, target, axis });
    } else if (aimMode === 'sonar') {
      act({ kind: 'ability', ship: selectedShip, target });
    }
    resetAim();
  };

  const useAbility = (): void => {
    if (selectedShip === null || spec === null) {
      return;
    }
    if (spec.ability === 'sonar') {
      setAimMode('sonar');
      setTarget(null);
    } else if (spec.ability === 'repair') {
      if (ally !== null) {
        act({ kind: 'ability', ship: selectedShip, ally });
        setAlly(null);
      }
    } else if (spec.ability !== null) {
      act({ kind: 'ability', ship: selectedShip });
    }
  };

  const move = (dx: number, dy: number): void => {
    if (selectedShip !== null) {
      act({ kind: 'move', ship: selectedShip, dx, dy, distance });
    }
  };

  const canUseAbility =
    own !== null &&
    spec?.ability !== null &&
    own.charges > 0 &&
    view.turn >= own.nextAbility &&
    !own.usedThisTurn.ability;

  const repairTargets = view.myFleet.filter(
    (ship) => ship.id !== selectedShip && ship.hp > 0 && ship.hp < ship.maxHp,
  );

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3',
          active ? 'border-mint/60 bg-mint/5' : 'border-sea-700 bg-sea-900',
        )}
      >
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted">
            Turno {view.turn + 1} · {view.role === 'host' ? 'Anfitrión' : 'Invitado'}
          </p>
          <h2 className={cn('text-lg font-bold', active ? 'text-mint' : 'text-ink')}>
            {view.phase === 'finished'
              ? view.winner === 'me'
                ? '¡Has ganado!'
                : 'Has perdido'
              : (PHASE_LABEL[view.phase] ?? view.phase)}
          </h2>
        </div>
        <div className="text-right text-xs text-muted">
          <p>
            Acciones: <strong className="text-ink">{view.ap}</strong>
          </p>
          {view.contacts.length > 0 && (
            <p className="text-amber">Sonar: {view.contacts.length} contactos</p>
          )}
        </div>
      </div>

      {view.phase === 'finished' && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-sea-700 bg-sea-900 px-4 py-3 text-sm">
          <span className="text-muted">
            Revancha: anfitrión {view.rematch.host ? '✓' : '—'} · invitado{' '}
            {view.rematch.guest ? '✓' : '—'}
          </span>
          <button
            type="button"
            onClick={rematch}
            className="rounded-lg bg-mint px-4 py-2 font-semibold text-sea-950 hover:brightness-110"
          >
            Pedir revancha
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Board
          label="Aguas rivales"
          contacts={view.contacts}
          shots={view.myShots}
          aim={aimCells}
          onCellClick={onEnemyCell}
          disabled={!active || aimMode === null}
        />
        <Board
          label="Tu flota"
          ships={view.myFleet.map((ship) => ({
            id: ship.id,
            at: ship.at,
            vertical: ship.vertical,
            hp: ship.hp,
            cloaked: ship.cloaked,
          }))}
          selectedShipId={selectedShip}
          incoming={view.myIncoming}
          onCellClick={(cell) => {
            const ship = view.myFleet.find((candidate) => cellsOf(candidate).includes(cell));
            if (ship !== undefined) {
              selectShip(ship.id);
            }
          }}
          disabled={!active}
        />
      </div>

      <div className="rounded-xl border border-sea-700 bg-sea-900 p-4">
        <div className="flex flex-wrap gap-2">
          {view.myFleet.map((ship) => (
            <button
              key={ship.id}
              type="button"
              disabled={ship.hp <= 0}
              onClick={() => selectShip(ship.id)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left text-xs',
                selectedShip === ship.id
                  ? 'border-mint bg-mint/10 text-ink'
                  : 'border-sea-700 text-muted hover:border-sea-600',
                ship.hp <= 0 && 'opacity-40',
              )}
            >
              <span className="mr-2 font-mono text-mint">{CATALOG[ship.id].mark}</span>
              {ship.hp}/{ship.maxHp}
              {ship.cloaked && <span className="ml-1 text-mint">◈</span>}
            </button>
          ))}
        </div>

        {selectedShip !== null && spec !== null && own !== null && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">
                {spec.name} · {spec.weapon === 'cannon' ? 'Cañón' : 'Torpedo'} (poder {spec.power})
              </span>

              <button
                type="button"
                disabled={!active || own.usedThisTurn.attack}
                onClick={() => {
                  setAimMode('attack');
                  setTarget(null);
                }}
                className="rounded-md border border-amber px-3 py-1 text-xs text-amber hover:bg-amber/10 disabled:opacity-40"
              >
                Apuntar
              </button>

              {spec.weapon === 'torpedo' && aimMode === 'attack' && (
                <select
                  value={axis}
                  onChange={(event) => setAxis(event.target.value as 'row' | 'column')}
                  className="rounded-md border border-sea-700 bg-sea-950 px-2 py-1 text-xs text-ink"
                >
                  <option value="row">Hacia la derecha</option>
                  <option value="column">Hacia abajo</option>
                </select>
              )}

              {spec.ability !== null && (
                <button
                  type="button"
                  disabled={!active || !canUseAbility}
                  onClick={useAbility}
                  className="rounded-md border border-mint px-3 py-1 text-xs text-mint hover:bg-mint/10 disabled:opacity-40"
                >
                  {spec.ability === 'sonar'
                    ? 'Sonar'
                    : spec.ability === 'cloak'
                      ? 'Camuflaje'
                      : spec.ability === 'selfrepair'
                        ? 'Autorreparar'
                        : 'Reparar aliado'}
                </button>
              )}

              {spec.ability === 'repair' && repairTargets.length > 0 && (
                <select
                  value={ally ?? ''}
                  onChange={(event) => setAlly((event.target.value as ShipId) || null)}
                  className="rounded-md border border-sea-700 bg-sea-950 px-2 py-1 text-xs text-ink"
                >
                  <option value="">Aliado…</option>
                  {repairTargets.map((ship) => (
                    <option key={ship.id} value={ship.id}>
                      {CATALOG[ship.id].name} ({ship.hp}/{ship.maxHp})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {aimMode !== null && (
              <div className="flex items-center justify-between rounded-lg border border-sea-700 bg-sea-950 px-3 py-2 text-xs">
                <span className="text-muted">
                  {target === null
                    ? 'Selecciona una casilla rival'
                    : `${aimMode === 'attack' ? 'Atacar' : 'Explorar'} ${label(target)}`}
                </span>
                <button
                  type="button"
                  disabled={target === null}
                  onClick={confirmAim}
                  className="rounded-md bg-mint px-3 py-1 font-semibold text-sea-950 disabled:opacity-40"
                >
                  Confirmar · 1 acción
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted">Maniobrar</span>
              <select
                value={distance}
                onChange={(event) => setDistance(Number(event.target.value))}
                className="rounded-md border border-sea-700 bg-sea-950 px-2 py-1 text-ink"
              >
                {Array.from({ length: spec.speed }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              {(
                [
                  ['N', 0, -1],
                  ['O', -1, 0],
                  ['E', 1, 0],
                  ['S', 0, 1],
                ] as const
              ).map(([label_, dx, dy]) => (
                <button
                  key={label_}
                  type="button"
                  disabled={!active || own.usedThisTurn.move}
                  onClick={() => move(dx, dy)}
                  className="rounded-md border border-sea-700 px-3 py-1 text-ink hover:border-mint disabled:opacity-40"
                >
                  {label_}
                </button>
              ))}
              <button
                type="button"
                disabled={!active}
                onClick={() => act({ kind: 'end' })}
                className="ml-auto rounded-md border border-coral px-3 py-1 text-coral hover:bg-coral/10 disabled:opacity-40"
              >
                Terminar turno
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function label(cell: number): string {
  const row = String.fromCharCode(65 + Math.floor(cell / 10));
  return `${row}${(cell % 10) + 1}`;
}
