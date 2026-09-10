import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/index.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createApp();
  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('GET /health', () => {
  it('returns ok and the protocol version', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok', protocol: 1 });
  });

  it('returns 404 for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/unknown`);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: { code: 'NOT_FOUND' } });
  });
});
