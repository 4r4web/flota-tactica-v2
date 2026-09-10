import { useAuth } from '../store/auth';
import { useGame } from '../store/game';
import { cn } from '../lib/cn';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Sin conexión',
  connecting: 'Conectando…',
  connected: 'Conectado',
  reconnecting: 'Reconectando…',
  disconnected: 'Desconectado',
};

export function Topbar({ onOpenRules }: { onOpenRules: () => void }) {
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  const status = useGame((state) => state.status);
  const disconnect = useGame((state) => state.disconnect);

  const handleLogout = () => {
    disconnect();
    void logout();
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sea-700 bg-sea-900 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          ⚓
        </span>
        <h1 className="text-sm font-bold tracking-[0.2em] text-mint">FLOTA TÁCTICA</h1>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-muted">
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              status === 'connected' ? 'bg-mint' : 'bg-amber',
            )}
          />
          {STATUS_LABEL[status] ?? status}
        </span>

        <button
          type="button"
          onClick={onOpenRules}
          className="rounded-md border border-sea-700 px-3 py-1 text-ink hover:border-mint hover:text-mint"
        >
          Cómo jugar
        </button>

        {user !== null && (
          <>
            <span className="hidden text-muted sm:inline">{user.displayName}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-sea-700 px-3 py-1 text-ink hover:border-coral hover:text-coral"
            >
              Salir
            </button>
          </>
        )}
      </div>
    </header>
  );
}
