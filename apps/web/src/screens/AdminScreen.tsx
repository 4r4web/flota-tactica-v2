import type { AdminGameEvent, AdminMatch } from '@flota/protocol';
import { useEffect, useState } from 'react';

import { ApiError, api } from '../api/rest';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../store/auth';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminScreen() {
  const user = useAuth((state) => state.user);
  const accessToken = useAuth((state) => state.accessToken);

  const [matches, setMatches] = useState<AdminMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openGame, setOpenGame] = useState<string | null>(null);
  const [events, setEvents] = useState<AdminGameEvent[]>([]);

  const isAdmin = user?.isAdmin === true;

  useEffect(() => {
    if (accessToken === null || !isAdmin) {
      return;
    }
    api
      .adminMatches(accessToken, 100)
      .then((response) => setMatches(response.matches))
      .catch((caught) =>
        setError(caught instanceof ApiError ? errorMessage(caught.code, caught.message) : 'Error'),
      );
  }, [accessToken, isAdmin]);

  const toggleEvents = (gameId: string): void => {
    if (accessToken === null) {
      return;
    }
    if (openGame === gameId) {
      setOpenGame(null);
      return;
    }
    setOpenGame(gameId);
    setEvents([]);
    api
      .adminMatchEvents(accessToken, gameId)
      .then((response) => setEvents(response.events))
      .catch(() => setEvents([]));
  };

  if (user === null) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-sea-700 bg-sea-900 p-6 text-center text-sm text-muted">
        Inicia sesión para acceder a esta pantalla.
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-coral/60 bg-sea-900 p-6 text-center text-sm text-coral">
        No tienes permisos para ver esta pantalla.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-bold text-mint">Partidas registradas</h2>
        <span className="text-xs text-muted">{matches?.length ?? 0} partidas</span>
      </div>

      {error !== null && <p className="text-sm text-coral">{error}</p>}

      {matches !== null && matches.length === 0 && (
        <p className="text-sm text-muted">Todavía no hay partidas registradas.</p>
      )}

      {matches !== null && matches.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-sea-700">
          <table className="w-full text-left text-xs">
            <thead className="bg-sea-800 text-muted">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Modo</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Ganador</th>
                <th className="px-3 py-2">Jugadores</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <FragmentRow
                  key={match.id}
                  match={match}
                  open={openGame === match.id}
                  events={openGame === match.id ? events : []}
                  onToggle={() => toggleEvents(match.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  match,
  open,
  events,
  onToggle,
}: {
  match: AdminMatch;
  open: boolean;
  events: AdminGameEvent[];
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t border-sea-800 align-top">
        <td className="px-3 py-2 text-ink">{formatDate(match.createdAt)}</td>
        <td className="px-3 py-2 text-muted">{match.mode}</td>
        <td className="px-3 py-2 text-muted">{match.status}</td>
        <td className="px-3 py-2 text-mint">{match.winnerName ?? '—'}</td>
        <td className="px-3 py-2 text-muted">
          {match.players.map((player) => (
            <span key={player.role} className="mr-2 whitespace-nowrap">
              {player.role}: {player.name}
              {player.result !== null && ` (${player.result})`}
            </span>
          ))}
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-md border border-sea-700 px-2 py-1 text-ink hover:border-mint hover:text-mint"
          >
            {open ? 'Ocultar' : 'Acciones'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-sea-800 bg-sea-950">
          <td colSpan={6} className="px-3 py-2">
            {events.length === 0 ? (
              <span className="text-muted">Sin acciones registradas.</span>
            ) : (
              <ol className="space-y-1">
                {events.map((event) => (
                  <li key={event.seq} className="font-mono text-[11px] text-muted">
                    #{event.seq} T{event.turn} <span className="text-ink">{event.type}</span>{' '}
                    {JSON.stringify(event.payload)}
                  </li>
                ))}
              </ol>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
