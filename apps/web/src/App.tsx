import { useEffect, useState } from 'react';

import { AccountModal } from './components/AccountModal';
import { ErrorToast } from './components/ErrorToast';
import { RulesModal } from './components/RulesModal';
import { Topbar } from './components/Topbar';
import { AuthScreen } from './screens/AuthScreen';
import { AdminScreen } from './screens/AdminScreen';
import { GameScreen } from './screens/GameScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { StatusScreen } from './screens/StatusScreen';
import { ResetScreen } from './screens/ResetScreen';
import { useAuth } from './store/auth';
import { useGame } from './store/game';

export function App() {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

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

  const path = window.location.pathname;
  const waitingForOpponent = roomCode !== null && players < 2;

  let body: React.ReactNode;
  if (path === '/reset') {
    body = <ResetScreen />;
  } else if (path === '/status') {
    body = <StatusScreen />;
  } else if (path === '/admin') {
    body = <AdminScreen />;
  } else if (user === null) {
    body = <AuthScreen />;
  } else if (view === null || waitingForOpponent) {
    body = <LobbyScreen />;
  } else {
    body = <GameScreen view={view} />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <Topbar onOpenRules={() => setRulesOpen(true)} onOpenAccount={() => setAccountOpen(true)} />

      <main className="mx-auto w-full max-w-5xl flex-1 p-4">{body}</main>

      <ErrorToast />
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
