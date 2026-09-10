import { describe, expect, it } from 'vitest';

import { Command, Envelope, LoginRequest, RegisterRequest } from '../src/index.js';

const envelope = {
  v: 1 as const,
  id: '00000000-0000-4000-8000-000000000000',
  type: 'ping',
  ts: 0,
};

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
});
