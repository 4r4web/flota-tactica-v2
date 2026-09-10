/**
 * Drives a full match between two WebSocket clients against a running server.
 *
 * Usage:
 *   pnpm db:up
 *   pnpm --filter @flota/server exec drizzle-kit migrate
 *   pnpm --filter @flota/server dev        # in another terminal
 *   pnpm --filter @flota/server demo:match
 */
import { randomUUID } from 'node:crypto';

import { PROTOCOL_VERSION } from '@flota/protocol';
import type { ServerMessage } from '@flota/protocol';
import { WebSocket } from 'ws';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const WS_URL = BASE_URL.replace(/^http/, 'ws');
const DELAY_MS = 200;

interface Placement {
  id: string;
  at: number;
  vertical: boolean;
}

const HOST_FLEET: Placement[] = [
  { id: 'dread', at: 0, vertical: false },
  { id: 'scout', at: 20, vertical: false },
  { id: 'support', at: 40, vertical: false },
];

const GUEST_FLEET: Placement[] = [
  { id: 'scout', at: 90, vertical: false },
  { id: 'sub', at: 70, vertical: false },
  { id: 'support', at: 50, vertical: false },
];

function envelope(type: string, payload: Record<string, unknown> = {}) {
  return { v: PROTOCOL_VERSION, id: randomUUID(), ts: Date.now(), type, ...payload };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Client {
  private readonly socket: WebSocket;
  private readonly queue: ServerMessage[] = [];
  private readonly waiters: Array<{ type: string; resolve: (message: ServerMessage) => void }> = [];

  constructor(
    readonly role: string,
    token: string,
  ) {
    this.socket = new WebSocket(`${WS_URL}/ws?token=${token}`);
    this.socket.on('message', (data) => {
      const parsed = JSON.parse(data.toString()) as ServerMessage;
      const index = this.waiters.findIndex((waiter) => waiter.type === parsed.type);
      if (index >= 0) {
        const waiter = this.waiters.splice(index, 1)[0];
        waiter?.resolve(parsed);
      } else {
        this.queue.push(parsed);
      }
    });
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.once('open', () => resolve());
      this.socket.once('error', reject);
    });
  }

  send(payload: unknown): void {
    this.socket.send(JSON.stringify(payload));
  }

  waitFor(type: string, timeoutMs = 10_000): Promise<ServerMessage> {
    const index = this.queue.findIndex((entry) => entry.type === type);
    if (index >= 0) {
      const entry = this.queue.splice(index, 1)[0];
      return Promise.resolve(entry as ServerMessage);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${this.role} timed out waiting for ${type}`)),
        timeoutMs,
      );
      this.waiters.push({
        type,
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message);
        },
      });
    });
  }

  close(): void {
    this.socket.close();
  }
}

async function register(email: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', displayName: email.slice(0, 8) }),
  });
  if (!response.ok) {
    throw new Error(`register failed with status ${response.status}`);
  }
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

async function main(): Promise<void> {
  console.log(`Flota Táctica — demo de partida contra ${BASE_URL}`);

  const hostToken = await register(`demo-host-${Date.now()}@flota.test`);
  const guestToken = await register(`demo-guest-${Date.now()}@flota.test`);

  const host = new Client('host', hostToken);
  const guest = new Client('guest', guestToken);
  await Promise.all([host.open(), guest.open()]);

  host.send(envelope('room.create'));
  const created = await host.waitFor('room.created');
  const gameId = (created as unknown as { gameId: string }).gameId;
  const code = (created as unknown as { code: string }).code;
  console.log(`Sala privada creada: código ${code}`);

  guest.send(envelope('room.join', { code }));
  await host.waitFor('game.state');
  await guest.waitFor('game.state');

  host.send(envelope('game.ready', { gameId, ships: HOST_FLEET }));
  guest.send(envelope('game.ready', { gameId, ships: GUEST_FLEET }));
  await host.waitFor('game.state');
  await guest.waitFor('game.state');
  console.log('Flotas preparadas. La partida comienza.\n');

  const guestSunk = new Set<string>();
  let seq = 0;
  let winner = '';

  for (let round = 1; round <= 10 && winner === ''; round += 1) {
    console.log(`— Turno del host (ronda ${round}) —`);
    for (const ship of ['dread', 'scout'] as const) {
      const target = GUEST_FLEET.find((candidate) => !guestSunk.has(candidate.id))?.at;
      if (target === undefined) {
        break;
      }
      host.send(
        envelope('game.action', {
          gameId,
          epoch: 0,
          seq,
          cmd: { kind: 'attack', ship, target, axis: 'row' },
        }),
      );
      const result = await host.waitFor('game.actionResult');
      seq += 1;
      const sunk = (result as unknown as { result: { sunk?: string[] } }).result.sunk ?? [];
      for (const id of sunk) {
        guestSunk.add(id);
        console.log(`  ${ship} ataca ${target} y hunde el ${id}`);
      }
      if (guestSunk.size === GUEST_FLEET.length) {
        winner = 'host';
        break;
      }
      await sleep(DELAY_MS);
    }

    if (winner !== '') {
      break;
    }

    guest.send(envelope('game.action', { gameId, epoch: 0, seq, cmd: { kind: 'end' } }));
    await guest.waitFor('game.actionResult');
    seq += 1;
    console.log('  el guest termina su turno\n');
    await sleep(DELAY_MS);
  }

  console.log(`\nResultado: gana el ${winner || 'nadie'} (flota enemiga hundida).`);

  host.close();
  guest.close();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
