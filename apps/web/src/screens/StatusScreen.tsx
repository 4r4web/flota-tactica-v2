import { useEffect, useState } from 'react';

import { cn } from '../lib/cn';
import { useGame } from '../store/game';

interface Health {
  status: string;
  postgres: string;
  redis: string;
  protocol: number;
  version: string;
  uptime: number;
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} h ${minutes} min`;
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 rounded-full', ok ? 'bg-mint' : 'bg-coral')}
      aria-hidden
    />
  );
}

export function StatusScreen() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connection = useGame((state) => state.status);

  useEffect(() => {
    let active = true;
    const load = (): void => {
      fetch('/health')
        .then((response) => response.json() as Promise<Health>)
        .then((data) => {
          if (active) {
            setHealth(data);
            setError(null);
          }
        })
        .catch(() => {
          if (active) {
            setError('No se pudo contactar con el servidor.');
          }
        });
    };
    load();
    const timer = setInterval(load, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const ok = health !== null && health.status === 'ok';

  return (
    <div className="mx-auto mt-8 max-w-md space-y-4">
      <div className="rounded-xl border border-sea-700 bg-sea-900 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-mint">Estado del servicio</h2>
          <span className="rounded bg-amber/20 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-amber">
            BETA
          </span>
        </div>

        {error !== null && <p className="mt-3 text-sm text-coral">{error}</p>}

        {health !== null && (
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Servidor">
              <Dot ok={ok} /> <span className="ml-1">{health.status}</span>
            </Row>
            <Row label="PostgreSQL">
              <Dot ok={health.postgres === 'ok'} /> <span className="ml-1">{health.postgres}</span>
            </Row>
            <Row label="Redis">
              <Dot ok={health.redis === 'ok'} /> <span className="ml-1">{health.redis}</span>
            </Row>
            <Row label="Conexión WebSocket">{connection}</Row>
            <Row label="Versión">{health.version}</Row>
            <Row label="Protocolo">v{health.protocol}</Row>
            <Row label="Activo desde hace">{formatUptime(health.uptime)}</Row>
          </dl>
        )}
      </div>

      <a
        href="/"
        className="block rounded-lg border border-sea-700 px-4 py-2 text-center text-sm text-muted hover:border-mint hover:text-mint"
      >
        Volver al juego
      </a>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-sea-800 pb-1.5 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="flex items-center text-ink">{children}</dd>
    </div>
  );
}
