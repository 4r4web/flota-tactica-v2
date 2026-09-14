import { useState } from 'react';

import { ApiError, api } from '../api/rest';
import { errorMessage } from '../lib/errors';

export function ResetScreen() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? errorMessage(caught.code, caught.message) : 'Error inesperado',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 w-full max-w-sm rounded-xl border border-sea-700 bg-sea-900 p-6">
      <h2 className="text-center text-lg font-bold text-mint">Nueva contraseña</h2>

      {token === '' ? (
        <div className="mt-4 space-y-3 text-sm text-ink">
          <p className="text-coral">El enlace no es válido o ha caducado.</p>
          <a
            href="/"
            className="block w-full rounded-lg bg-mint px-4 py-2 text-center font-semibold text-sea-950 hover:brightness-110"
          >
            Volver
          </a>
        </div>
      ) : done ? (
        <div className="mt-4 space-y-3 text-sm text-ink">
          <p>Contraseña actualizada. Ya puedes iniciar sesión con ella.</p>
          <a
            href="/"
            className="block w-full rounded-lg bg-mint px-4 py-2 text-center font-semibold text-sea-950 hover:brightness-110"
          >
            Iniciar sesión
          </a>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-3">
          <label className="block text-xs text-muted">
            Nueva contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={10}
              className="mt-1 w-full rounded-md border border-sea-700 bg-sea-950 px-3 py-2 text-sm text-ink outline-none focus:border-mint"
            />
          </label>
          <label className="block text-xs text-muted">
            Repite la contraseña
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              minLength={10}
              className="mt-1 w-full rounded-md border border-sea-700 bg-sea-950 px-3 py-2 text-sm text-ink outline-none focus:border-mint"
            />
          </label>

          {error !== null && <p className="text-xs text-coral">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-mint px-4 py-2 font-semibold text-sea-950 hover:brightness-110 disabled:opacity-60"
          >
            {busy ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </div>
  );
}
