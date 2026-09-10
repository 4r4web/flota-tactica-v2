import { useState } from 'react';

import { useGame } from '../store/game';

export function LobbyScreen() {
  const status = useGame((state) => state.status);
  const roomCode = useGame((state) => state.roomCode);
  const createRoom = useGame((state) => state.createRoom);
  const joinRoom = useGame((state) => state.joinRoom);
  const enqueue = useGame((state) => state.enqueue);
  const cancelQueue = useGame((state) => state.cancelQueue);
  const reset = useGame((state) => state.reset);

  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);

  const disabled = status !== 'connected';

  if (roomCode !== null) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-sea-700 bg-sea-900 p-6 text-center">
        <h2 className="text-base font-bold text-mint">Sala creada</h2>
        <p className="mt-2 text-sm text-muted">Comparte este código con tu rival:</p>
        <p className="mt-3 text-4xl font-black tracking-[0.3em] text-ink">{roomCode}</p>
        <p className="mt-4 animate-pulse text-xs text-amber">Esperando al rival…</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-md border border-sea-700 px-4 py-2 text-sm text-muted hover:border-coral hover:text-coral"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
      <section className="rounded-xl border border-sea-700 bg-sea-900 p-5">
        <h2 className="text-sm font-bold text-mint">Sala privada</h2>
        <p className="mt-1 text-xs text-muted">Crea una sala y comparte el código con tu rival.</p>
        <button
          type="button"
          disabled={disabled}
          onClick={createRoom}
          className="mt-4 w-full rounded-lg bg-mint px-4 py-2 font-semibold text-sea-950 hover:brightness-110 disabled:opacity-60"
        >
          Crear sala
        </button>
      </section>

      <section className="rounded-xl border border-sea-700 bg-sea-900 p-5">
        <h2 className="text-sm font-bold text-mint">Unirse con código</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim().length > 0) {
              joinRoom(code.trim().toUpperCase());
            }
          }}
        >
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={8}
            placeholder="CÓDIGO"
            className="w-full rounded-md border border-sea-700 bg-sea-950 px-3 py-2 text-center text-sm tracking-widest text-ink outline-none focus:border-mint"
          />
          <button
            type="submit"
            disabled={disabled}
            className="rounded-lg border border-mint px-4 py-2 text-sm font-semibold text-mint hover:bg-mint/10 disabled:opacity-60"
          >
            Entrar
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-sea-700 bg-sea-900 p-5 sm:col-span-2">
        <h2 className="text-sm font-bold text-mint">Partida rápida</h2>
        <p className="mt-1 text-xs text-muted">Buscamos un rival disponible para ti.</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (searching) {
              cancelQueue();
              setSearching(false);
            } else {
              enqueue();
              setSearching(true);
            }
          }}
          className="mt-4 w-full rounded-lg border border-amber px-4 py-2 font-semibold text-amber hover:bg-amber/10 disabled:opacity-60"
        >
          {searching ? 'Cancelar búsqueda' : 'Buscar partida'}
        </button>
        {searching && <p className="mt-2 text-center text-xs text-amber">Buscando rival…</p>}
      </section>
    </div>
  );
}
