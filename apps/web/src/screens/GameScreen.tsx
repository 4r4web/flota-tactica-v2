import type { PlayerView } from '@flota/protocol';

import { BattleView } from '../components/BattleView';
import { Board } from '../components/Board';
import { FleetBuilder } from '../components/FleetBuilder';
import { useGame } from '../store/game';

export function GameScreen({ view }: { view: PlayerView }) {
  const opponentOnline = useGame((state) => state.opponentOnline);

  let body: React.ReactNode;
  if (view.phase === 'placement') {
    body = <FleetBuilder />;
  } else if (view.phase === 'waiting') {
    body = (
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
  } else {
    body = <BattleView view={view} />;
  }

  return (
    <div className="space-y-4">
      {!opponentOnline && view.phase !== 'finished' && (
        <div className="rounded-lg border border-amber/60 bg-amber/10 px-4 py-2 text-center text-xs text-amber">
          El rival se ha desconectado. La partida espera su regreso.
        </div>
      )}
      {body}
    </div>
  );
}
