import { useState } from 'react';

import { ApiError, api } from '../api/rest';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../store/auth';

const inputClass =
  'mt-1 w-full rounded-md border border-sea-700 bg-sea-950 px-3 py-2 text-sm text-ink outline-none focus:border-mint';

export function AccountModal({ onClose }: { onClose: () => void }) {
  const user = useAuth((state) => state.user);
  const accessToken = useAuth((state) => state.accessToken);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (accessToken === null) {
      return;
    }
    if (next !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.changePassword(accessToken, current, next);
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? errorMessage(caught.code, caught.message) : 'Error inesperado',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-xl border border-sea-700 bg-sea-900 p-5">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-mint">Tu cuenta</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        {user !== null && <p className="mb-3 text-xs text-muted">Sesión: {user.email}</p>}

        {done ? (
          <div className="space-y-3 text-sm text-ink">
            <p>Contraseña actualizada correctamente.</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-mint px-4 py-2 font-semibold text-sea-950 hover:brightness-110"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            <label className="block text-xs text-muted">
              Contraseña actual
              <input
                type="password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                required
                className={inputClass}
              />
            </label>
            <label className="block text-xs text-muted">
              Nueva contraseña
              <input
                type="password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                required
                minLength={10}
                className={inputClass}
              />
            </label>
            <label className="block text-xs text-muted">
              Repite la nueva contraseña
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                minLength={10}
                className={inputClass}
              />
            </label>

            {error !== null && <p className="text-xs text-coral">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-mint px-4 py-2 font-semibold text-sea-950 hover:brightness-110 disabled:opacity-60"
            >
              {busy ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
