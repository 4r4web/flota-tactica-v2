import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';

import { healthHandler } from './http/health.js';

const DEFAULT_PORT = 3000;

export function createApp(): Server {
  return createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      healthHandler(req, res);
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: { code: 'NOT_FOUND' } }));
  });
}

function isMain(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && fileURLToPath(import.meta.url) === entry;
}

if (isMain()) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  createApp().listen(port, () => {
    process.stdout.write(`[server] listening on http://localhost:${port}\n`);
  });
}
