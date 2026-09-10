import { useEffect, useState } from 'react';

import { ErrorToast } from './components/ErrorToast';
import { RulesModal } from './components/RulesModal';
import { Topbar } from './components/Topbar';
import { AuthScreen } from './screens/AuthScreen';
import { GameScreen } from './screens/GameScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { useAuth } from './store/auth';
import { useGame } from './store/game';

export function App() {
  const [rulesOpen, setRulesOpen] = useState(false);

  const user = useAuth((state) => state.user);
  const accessToken = useAuth((state) => state.accessToken);
  const connect = useGame((state) => state.connect);
  const view = useGame((state) => state.view);
  const roomCode = useGame((state) => state.roomCode);
  const players = useGame((state) => state.players);

  useEffect(() => {
    if (accessToken !== null) {
      connect(accessToken);
    }
  }, [accessToken, connect]);

  const waitingForOpponent = roomCode !== null && players < 2;

  return (
    <div className="flex min-h-full flex-col">
      <Topbar onOpenRules={() => setRulesOpen(true)} />

      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        {user === null ? (
          <AuthScreen />
        ) : view === null || waitingForOpponent ? (
          <LobbyScreen />
        ) : (
          <GameScreen view={view} />
        )}
      </main>

      <ErrorToast />
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    </div>
  );
}
