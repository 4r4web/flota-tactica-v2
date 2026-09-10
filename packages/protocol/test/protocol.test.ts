import { describe, expect, it } from 'vitest';

import type { Command as DomainCommand } from '@flota/domain';

import {
  ClientMessage,
  Command,
  Envelope,
  LoginRequest,
  PlayerView,
  RegisterRequest,
  ServerMessage,
} from '../src/index.js';

const id = '00000000-0000-4000-8000-000000000000';
const envelope = { v: 1 as const, id, type: 'ping', ts: 0 };

describe('Envelope', () => {
  it('accepts a valid envelope', () => {
    expect(Envelope.safeParse(envelope).success).toBe(true);
  });

  it('rejects an unknown protocol version', () => {
    expect(Envelope.safeParse({ ...envelope, v: 2 }).success).toBe(false);
  });

  it('rejects a non-uuid message id', () => {
    expect(Envelope.safeParse({ ...envelope, id: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('auth payloads', () => {
  it('validates register requests', () => {
    expect(
      RegisterRequest.safeParse({
        email: 'aram@example.com',
        password: 'longenough1',
        displayName: 'Aram',
      }).success,
    ).toBe(true);

    expect(
      RegisterRequest.safeParse({ email: 'nope', password: 'short', displayName: '' }).success,
    ).toBe(false);
  });

  it('validates login requests', () => {
    expect(LoginRequest.safeParse({ email: 'aram@example.com', password: 'x' }).success).toBe(true);
  });
});

describe('Command', () => {
  it('parses every command variant', () => {
    expect(Command.safeParse({ kind: 'end' }).success).toBe(true);
    expect(
      Command.safeParse({ kind: 'move', ship: 'scout', dx: 0, dy: -1, distance: 2 }).success,
    ).toBe(true);
    expect(
      Command.safeParse({ kind: 'attack', ship: 'dread', target: 54, axis: 'row' }).success,
    ).toBe(true);
    expect(Command.safeParse({ kind: 'ability', ship: 'sub' }).success).toBe(true);
  });

  it('rejects out-of-range targets and unknown ships', () => {
    expect(
      Command.safeParse({ kind: 'attack', ship: 'dread', target: 100, axis: 'row' }).success,
    ).toBe(false);
    expect(
      Command.safeParse({ kind: 'attack', ship: 'carrier', target: 1, axis: 'row' }).success,
    ).toBe(false);
  });

  it('stays compatible with the domain engine command type', () => {
    const domainCommand: DomainCommand = { kind: 'end' };
    expect(Command.safeParse(domainCommand).success).toBe(true);
  });
});

describe('PlayerView', () => {
  const view = {
    gameId: id,
    epoch: 0,
    seq: 0,
    phase: 'turn',
    turn: 0,
    ap: 2,
    role: 'host',
    myFleet: [
      {
        id: 'scout',
        at: 0,
        vertical: false,
        hp: 3,
        maxHp: 3,
        cloaked: false,
        charges: 99,
        nextAbility: 0,
        usedThisTurn: { move: false, attack: false, ability: false },
      },
    ],
    enemyShips: [{ id: 'sub', sunk: false }],
    myShots: [],
    myIncoming: [],
    contacts: [],
    rematch: { host: false, guest: false },
    winner: null,
  };

  it('accepts a valid filtered view', () => {
    expect(PlayerView.safeParse(view).success).toBe(true);
  });

  it('rejects a view with an invalid cell', () => {
    expect(PlayerView.safeParse({ ...view, contacts: [100] }).success).toBe(false);
  });
});

describe('WebSocket messages', () => {
  it('parses client messages', () => {
    expect(
      ClientMessage.safeParse({ v: 1, id, ts: 0, type: 'auth', accessToken: 'token' }).success,
    ).toBe(true);
    expect(
      ClientMessage.safeParse({
        v: 1,
        id,
        ts: 0,
        type: 'game.action',
        gameId: id,
        epoch: 0,
        seq: 0,
        cmd: { kind: 'end' },
      }).success,
    ).toBe(true);
    expect(
      ClientMessage.safeParse({
        v: 1,
        id,
        ts: 0,
        type: 'game.ready',
        gameId: id,
        ships: [
          { id: 'scout', at: 0, vertical: false },
          { id: 'sub', at: 20, vertical: false },
          { id: 'support', at: 40, vertical: false },
        ],
      }).success,
    ).toBe(true);
  });

  it('rejects client messages with unknown types or bad ships', () => {
    expect(ClientMessage.safeParse({ v: 1, id, ts: 0, type: 'nope' }).success).toBe(false);
    expect(
      ClientMessage.safeParse({
        v: 1,
        id,
        ts: 0,
        type: 'game.ready',
        gameId: id,
        ships: [
          { id: 'scout', at: 0, vertical: false },
          { id: 'sub', at: 20, vertical: false },
        ],
      }).success,
    ).toBe(false);
  });

  it('parses server messages', () => {
    expect(
      ServerMessage.safeParse({
        v: 1,
        id,
        ts: 0,
        type: 'error',
        code: 'NOT_YOUR_TURN',
        message: 'x',
      }).success,
    ).toBe(true);
    expect(
      ServerMessage.safeParse({ v: 1, id, ts: 0, type: 'room.created', gameId: id, code: 'ABCD' })
        .success,
    ).toBe(true);
  });
});
