import { useState } from 'react';

import { ApiError } from '../api/rest';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../store/auth';

type Mode = 'login' | 'register';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const login = useAuth((state) => state.login);
  const register = useAuth((state) => state.register);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ email, password, displayName });
      }
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
      <h2 className="text-center text-lg font-bold text-mint">Flota Táctica</h2>
      <p className="mt-1 text-center text-xs text-muted">
        Juego táctico naval por turnos para 2 jugadores
      </p>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-sea-800 p-1 text-sm">
        {(['login', 'register'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMode(option);
              setError(null);
            }}
            className={
              mode === option
                ? 'rounded-md bg-mint py-1.5 font-semibold text-sea-950'
                : 'rounded-md py-1.5 text-muted hover:text-ink'
            }
          >
            {option === 'login' ? 'Iniciar sesión' : 'Registrarse'}
          </button>
        ))}
      </div>

      <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-3">
        {mode === 'register' && (
          <label className="block text-xs text-muted">
            Nombre
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              maxLength={32}
              className="mt-1 w-full rounded-md border border-sea-700 bg-sea-950 px-3 py-2 text-sm text-ink outline-none focus:border-mint"
            />
          </label>
        )}

        <label className="block text-xs text-muted">
          Correo
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="mt-1 w-full rounded-md border border-sea-700 bg-sea-950 px-3 py-2 text-sm text-ink outline-none focus:border-mint"
          />
        </label>

        <label className="block text-xs text-muted">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={mode === 'register' ? 10 : 1}
            className="mt-1 w-full rounded-md border border-sea-700 bg-sea-950 px-3 py-2 text-sm text-ink outline-none focus:border-mint"
          />
        </label>

        {error !== null && <p className="text-xs text-coral">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-mint px-4 py-2 font-semibold text-sea-950 hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  );
}
