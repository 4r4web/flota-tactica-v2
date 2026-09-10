import type { IncomingMessage, ServerResponse } from 'node:http';

import { PROTOCOL_VERSION } from '@flota/protocol';

export function healthHandler(_req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ status: 'ok', protocol: PROTOCOL_VERSION }));
}
