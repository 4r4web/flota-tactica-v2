import { collectDefaultMetrics, Counter, Registry } from 'prom-client';

export interface Metrics {
  registry: Registry;
  httpRequests: Counter;
  wsConnections: Counter;
  gamesStarted: Counter;
}

export function createMetrics(): Metrics {
  const registry = new Registry();
  registry.setDefaultLabels({ app: 'flota-server' });
  collectDefaultMetrics({ register: registry });

  const httpRequests = new Counter({
    name: 'flota_http_requests_total',
    help: 'Total HTTP requests handled',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
  });

  const wsConnections = new Counter({
    name: 'flota_ws_connections_total',
    help: 'Total WebSocket connections accepted',
    registers: [registry],
  });

  const gamesStarted = new Counter({
    name: 'flota_games_started_total',
    help: 'Total games created',
    labelNames: ['mode'],
    registers: [registry],
  });

  return { registry, httpRequests, wsConnections, gamesStarted };
}
