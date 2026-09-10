import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import { PROTOCOL_VERSION } from '@flota/protocol';
import type { ServerMessage } from '@flota/protocol';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { buildApp } from '../src/app.js';
import { createTokenService } from '../src/auth/tokens.js';
import type { Config } from '../src/config.js';
import type { AppDeps } from '../src/deps.js';
import { createDb } from '../src/infra/db.js';
import { createLogger } from '../src/infra/logger.js';
import { createRedis } from '../src/infra/redis.js';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

interface TestContext {
  baseUrl: string;
  wsUrl: string;
  deps: AppDeps;
  teardown: () => Promise<void>;
}

let context: TestContext;

function message(type: string, payload: Record<string, unknown> = {}) {
  return { v: PROTOCOL_VERSION, id: randomUUID(), ts: Date.now(), type, ...payload };
}

type MessagePredicate = (message: ServerMessage) => boolean;

interface TestClient {
  send: (payload: unknown) => void;
  waitFor: (
    type: string,
    predicate?: MessagePredicate,
    timeoutMs?: number,
  ) => Promise<ServerMessage>;
  close: () => void;
}

function phaseIs(phase: string): MessagePredicate {
  return (entry) => (entry as unknown as { view?: { phase?: string } }).view?.phase === phase;
}

function matchesMessage(entry: ServerMessage, type: string, predicate: MessagePredicate): boolean {
  return entry.type === type && predicate(entry);
}

function connect(url: string): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const queue: ServerMessage[] = [];
    const seen: string[] = [];
    const waiters: Array<{
      type: string;
      predicate: MessagePredicate;
      resolve: (message: ServerMessage) => void;
    }> = [];

    socket.on('message', (data) => {
      const parsed = JSON.parse(data.toString()) as ServerMessage;
      const phase = (parsed as unknown as { view?: { phase?: string } }).view?.phase;
      const code = (parsed as unknown as { code?: string }).code;
      const detail = phase ?? code;
      seen.push(detail === undefined ? parsed.type : `${parsed.type}:${detail}`);
      const index = waiters.findIndex((waiter) =>
        matchesMessage(parsed, waiter.type, waiter.predicate),
      );
      if (index >= 0) {
        const waiter = waiters.splice(index, 1)[0];
        waiter?.resolve(parsed);
      } else {
        queue.push(parsed);
      }
    });

    socket.on('error', reject);

    socket.on('open', () => {
      resolve({
        send(payload) {
          socket.send(JSON.stringify(payload));
        },
        waitFor(type, predicate = () => true, timeoutMs = 10_000) {
          const index = queue.findIndex((entry) => matchesMessage(entry, type, predicate));
          if (index >= 0) {
            const entry = queue.splice(index, 1)[0];
            return Promise.resolve(entry as ServerMessage);
          }
          return new Promise((resolveMessage, rejectMessage) => {
            const timer = setTimeout(() => {
              rejectMessage(
                new Error(`timed out waiting for ${type}; saw: ${seen.join(', ') || 'nothing'}`),
              );
            }, timeoutMs);
            waiters.push({
              type,
              predicate,
              resolve: (entry) => {
                clearTimeout(timer);
                resolveMessage(entry);
              },
            });
          });
        },
        close() {
          socket.close();
        },
      });
    });
  });
}

async function stopContainer(container: StartedTestContainer): Promise<void> {
  await container.stop();
}

async function startContext(): Promise<TestContext> {
  const postgres = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_USER: 'flota',
      POSTGRES_PASSWORD: 'flota',
      POSTGRES_DB: 'flota',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 1))
    .start();

  const redis = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/, 1))
    .start();

  const databaseUrl = `postgres://flota:flota@${postgres.getHost()}:${postgres.getMappedPort(5432)}/flota`;
  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

  const config: Config = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl,
    redisUrl,
    jwtSecret: 'test-secret-test-secret',
    accessTokenTtl: 900,
    refreshTokenTtl: 604_800,
    corsOrigin: '*',
    rateLimitMax: 10_000,
    rateLimitWindow: '1 minute',
    authRateLimitMax: 10_000,
    bodyLimit: 16_384,
  };

  const database = createDb(databaseUrl);
  await migrate(database.db, { migrationsFolder });

  const redisClient = createRedis(redisUrl);
  const logger = createLogger(config);
  const tokens = createTokenService(config);

  const deps: AppDeps = { config, db: database.db, redis: redisClient, logger, tokens };
  const app = await buildApp(deps);
  await app.listen({ port: 0, host: '127.0.0.1' });

  const address = app.server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('server did not bind to a port');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    wsUrl: `ws://127.0.0.1:${address.port}`,
    deps,
    async teardown() {
      await app.close();
      await database.close();
      redisClient.disconnect();
      await stopContainer(redis);
      await stopContainer(postgres);
    },
  };
}

async function register(baseUrl: string, email: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', displayName: 'Tester' }),
  });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

const HOST_FLEET = [
  { id: 'scout', at: 0, vertical: false },
  { id: 'sub', at: 20, vertical: false },
  { id: 'support', at: 40, vertical: false },
];

const GUEST_FLEET = [
  { id: 'scout', at: 90, vertical: false },
  { id: 'sub', at: 70, vertical: false },
  { id: 'support', at: 50, vertical: false },
];

async function openPrivateRoom(): Promise<{
  host: TestClient;
  guest: TestClient;
  gameId: string;
}> {
  const hostToken = await register(context.baseUrl, `host-${randomUUID()}@example.com`);
  const guestToken = await register(context.baseUrl, `guest-${randomUUID()}@example.com`);
  const host = await connect(`${context.wsUrl}/ws?token=${hostToken}`);
  const guest = await connect(`${context.wsUrl}/ws?token=${guestToken}`);

  host.send(message('room.create'));
  const created = await host.waitFor('room.created');
  const gameId = (created as unknown as { gameId: string }).gameId;
  const code = (created as unknown as { code: string }).code;

  guest.send(message('room.join', { code }));
  await guest.waitFor('game.state', phaseIs('placement'));
  await host.waitFor('game.state', phaseIs('placement'));

  return { host, guest, gameId };
}

beforeAll(async () => {
  context = await startContext();
}, 180_000);

afterAll(async () => {
  await context.teardown();
});

describe('REST auth', () => {
  it('reports a healthy service', async () => {
    const response = await fetch(`${context.baseUrl}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      postgres: 'ok',
      redis: 'ok',
    });
  });

  it('registers, logs in, reads the profile and refreshes tokens', async () => {
    const email = `user-${randomUUID()}@example.com`;
    const registerResponse = await fetch(`${context.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', displayName: 'Aram' }),
    });
    expect(registerResponse.status).toBe(201);
    const registered = (await registerResponse.json()) as {
      accessToken: string;
      refreshToken: string;
      user: { email: string };
    };
    expect(registered.user.email).toBe(email);

    const loginResponse = await fetch(`${context.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    expect(loginResponse.status).toBe(200);

    const meResponse = await fetch(`${context.baseUrl}/api/me`, {
      headers: { authorization: `Bearer ${registered.accessToken}` },
    });
    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({ email, displayName: 'Aram' });

    const refreshResponse = await fetch(`${context.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: registered.refreshToken }),
    });
    expect(refreshResponse.status).toBe(200);
    const refreshed = (await refreshResponse.json()) as { accessToken: string };
    expect(typeof refreshed.accessToken).toBe('string');
  });

  it('returns 400 for an invalid payload', async () => {
    const response = await fetch(`${context.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'x' }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_ACTION' },
    });
  });

  it('rate limits auth endpoints', async () => {
    const limited = await buildApp({
      ...context.deps,
      config: { ...context.deps.config, authRateLimitMax: 2 },
    });
    await limited.listen({ port: 0, host: '127.0.0.1' });
    const address = limited.server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}`;
    const body = JSON.stringify({ email: 'not-an-email', password: 'x' });
    const headers = { 'content-type': 'application/json' };

    const first = await fetch(`${url}/api/auth/login`, { method: 'POST', headers, body });
    const second = await fetch(`${url}/api/auth/login`, { method: 'POST', headers, body });
    const third = await fetch(`${url}/api/auth/login`, { method: 'POST', headers, body });

    expect(first.status).toBe(400);
    expect(second.status).toBe(400);
    expect(third.status).toBe(429);
    await expect(third.json()).resolves.toMatchObject({ error: { code: 'RATE_LIMITED' } });

    await limited.close();
  });

  it('rejects duplicate emails and bad credentials', async () => {
    const email = `dup-${randomUUID()}@example.com`;
    const payload = { email, password: 'password123', displayName: 'Dup' };
    const first = await fetch(`${context.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);

    const duplicate = await fetch(`${context.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(duplicate.status).toBe(409);

    const badLogin = await fetch(`${context.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong-password' }),
    });
    expect(badLogin.status).toBe(401);
  });
});

describe('WebSocket game flow', () => {
  it('plays a full private-room turn over the wire', async () => {
    const { host, guest, gameId } = await openPrivateRoom();

    host.send(message('game.ready', { gameId, ships: HOST_FLEET }));
    guest.send(message('game.ready', { gameId, ships: GUEST_FLEET }));

    const hostTurn = await host.waitFor('game.state', phaseIs('turn'));
    expect((hostTurn as unknown as { view: { role: string } }).view.role).toBe('host');
    await guest.waitFor('game.state', phaseIs('opponent'));

    host.send(message('game.action', { gameId, epoch: 0, seq: 0, cmd: { kind: 'end' } }));
    const result = await host.waitFor('game.actionResult');
    expect((result as unknown as { result: { kind: string } }).result.kind).toBe('end');

    await guest.waitFor('game.state', phaseIs('turn'));

    host.close();
    guest.close();
  });

  it('rejects an action sent out of turn', async () => {
    const { host, guest, gameId } = await openPrivateRoom();

    host.send(message('game.ready', { gameId, ships: HOST_FLEET }));
    guest.send(message('game.ready', { gameId, ships: GUEST_FLEET }));
    await guest.waitFor('game.state', phaseIs('opponent'));

    guest.send(message('game.action', { gameId, epoch: 0, seq: 0, cmd: { kind: 'end' } }));
    const error = await guest.waitFor('error');
    expect((error as unknown as { code: string }).code).toBe('NOT_YOUR_TURN');

    host.close();
    guest.close();
  });

  it('rejects a stale sequence number', async () => {
    const { host, guest, gameId } = await openPrivateRoom();

    host.send(message('game.ready', { gameId, ships: HOST_FLEET }));
    guest.send(message('game.ready', { gameId, ships: GUEST_FLEET }));
    await host.waitFor('game.state', phaseIs('turn'));

    host.send(message('game.action', { gameId, epoch: 0, seq: 99, cmd: { kind: 'end' } }));
    const error = await host.waitFor('error');
    expect((error as unknown as { code: string }).code).toBe('SEQ_MISMATCH');

    host.close();
    guest.close();
  });

  it('notifies the opponent when a player abandons', async () => {
    const { host, guest, gameId } = await openPrivateRoom();

    host.send(message('game.leave', { gameId }));
    const abandoned = await guest.waitFor('game.abandoned');
    expect((abandoned as unknown as { gameId: string }).gameId).toBe(gameId);

    host.close();
    guest.close();
  });

  it('notifies the opponent when a player disconnects', async () => {
    const { host, guest } = await openPrivateRoom();

    guest.close();
    const presence = await host.waitFor('game.presence');
    expect((presence as unknown as { opponentOnline: boolean }).opponentOnline).toBe(false);

    host.close();
  });
});
