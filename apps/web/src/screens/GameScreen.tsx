import type { PlayerView } from '@flota/protocol';

import { BattleView } from '../components/BattleView';
import { Board } from '../components/Board';
import { FleetBuilder } from '../components/FleetBuilder';

export function GameScreen({ view }: { view: PlayerView }) {
  if (view.phase === 'placement') {
    return <FleetBuilder />;
  }

  if (view.phase === 'waiting') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-sea-700 bg-sea-900 px-4 py-3 text-center">
          <h2 className="text-base font-bold text-mint">Flota lista</h2>
          <p className="mt-1 animate-pulse text-xs text-amber">
            Esperando a que el rival prepare su flota…
          </p>
        </div>
        <Board
          label="Tu flota"
          ships={view.myFleet.map((ship) => ({
            id: ship.id,
            at: ship.at,
            vertical: ship.vertical,
            hp: ship.hp,
          }))}
          disabled
        />
      </div>
    );
  }

  return <BattleView view={view} />;
}
