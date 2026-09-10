import { randomUUID } from 'node:crypto';

import { applyCommand, createGame, lockFleet, requestRematch } from '@flota/domain';
import type { ActionResult, Command, PlacementInput, Role } from '@flota/domain';

import type { AppDeps } from '../deps.js';
import { AppError } from '../errors.js';
import type { Metrics } from '../infra/metrics.js';
import { generateCode } from './codes.js';
import { createKeyedMutex } from './mutex.js';
import { createGameRecord, persistFinishedGame, recordEvent } from './persist.js';
import { createGameStore } from './store.js';
import type { StoredGame } from './store.js';

export interface PlayerRef {
  role: Role;
  userId: string | null;
}

export interface LoadedGame {
  stored: StoredGame;
  role: Role;
}

export interface GameService {
  createPrivateRoom(userId: string): Promise<LoadedGame>;
  joinRoom(userId: string, code: string): Promise<LoadedGame>;
  enqueueMatchmaking(userId: string): Promise<StoredGame | null>;
  cancelMatchmaking(userId: string): Promise<void>;
  ready(userId: string, gameId: string, ships: PlacementInput[]): Promise<LoadedGame>;
  action(
    userId: string,
    gameId: string,
    epoch: number,
    seq: number,
    cmd: Command,
  ): Promise<LoadedGame & { result: ActionResult }>;
  rematch(userId: string, gameId: string, epoch: number): Promise<LoadedGame>;
  resume(userId: string, gameId: string): Promise<LoadedGame | null>;
  leave(userId: string, gameId: string): Promise<{ opponentUserId: string | null }>;
  activeGame(userId: string): Promise<StoredGame | null>;
}

const MATCHMAKING_QUEUE = 'matchmaking:queue';

const PAIR_SCRIPT = `
local a = redis.call('SPOP', KEYS[1])
if not a then return {} end
local b = redis.call('SPOP', KEYS[1])
if not b then
  redis.call('SADD', KEYS[1], a)
  return {a}
end
return {a, b}
`;

export function playerRefs(stored: StoredGame): PlayerRef[] {
  return [
    { role: 'host', userId: stored.meta.hostUserId },
    { role: 'guest', userId: stored.meta.guestUserId },
  ];
}

export function roleOf(stored: StoredGame, userId: string): Role {
  if (stored.meta.hostUserId === userId) {
    return 'host';
  }
  if (stored.meta.guestUserId === userId) {
    return 'guest';
  }
  throw new AppError(403, 'INVALID_ACTION', 'you are not a player in this game');
}

export function createGameService(deps: AppDeps, metrics?: Metrics): GameService {
  const store = createGameStore(deps.redis);
  const withLock = createKeyedMutex();

  async function loadForUser(gameId: string, userId: string): Promise<LoadedGame> {
    const stored = await store.get(gameId);
    if (stored === null) {
      throw new AppError(404, 'ROOM_NOT_FOUND', 'game not found');
    }
    return { stored, role: roleOf(stored, userId) };
  }

  return {
    async createPrivateRoom(userId) {
      const gameId = randomUUID();
      const code = generateCode();
      const stored: StoredGame = {
        state: createGame(gameId),
        meta: {
          id: gameId,
          mode: 'private',
          code,
          hostUserId: userId,
          guestUserId: null,
          createdAt: Date.now(),
          persisted: false,
        },
      };
      await store.create(stored);
      await createGameRecord(deps.db, gameId, 'private');
      await store.setActive(userId, gameId);
      metrics?.gamesStarted.inc({ mode: 'private' });
      return { stored, role: 'host' };
    },

    async joinRoom(userId, code) {
      const gameId = await store.findByCode(code.toUpperCase());
      if (gameId === null) {
        throw new AppError(404, 'ROOM_NOT_FOUND', 'room not found');
      }
      return withLock(gameId, async () => {
        const stored = await store.get(gameId);
        if (stored === null) {
          throw new AppError(404, 'ROOM_NOT_FOUND', 'room not found');
        }
        if (stored.meta.hostUserId === userId) {
          return { stored, role: 'host' as const };
        }
        if (stored.meta.guestUserId !== null && stored.meta.guestUserId !== userId) {
          throw new AppError(409, 'ROOM_FULL', 'room is already full');
        }
        stored.meta.guestUserId = userId;
        await store.save(stored);
        await store.setActive(userId, gameId);
        return { stored, role: 'guest' as const };
      });
    },

    async enqueueMatchmaking(userId) {
      await deps.redis.sadd(MATCHMAKING_QUEUE, userId);
      const popped = (await deps.redis.eval(PAIR_SCRIPT, 1, MATCHMAKING_QUEUE)) as string[];
      if (popped.length !== 2) {
        return null;
      }
      const [hostUserId, guestUserId] = popped as [string, string];
      const gameId = randomUUID();
      const stored: StoredGame = {
        state: createGame(gameId),
        meta: {
          id: gameId,
          mode: 'matchmaking',
          code: null,
          hostUserId,
          guestUserId,
          createdAt: Date.now(),
          persisted: false,
        },
      };
      await store.create(stored);
      await createGameRecord(deps.db, gameId, 'matchmaking');
      await store.setActive(hostUserId, gameId);
      await store.setActive(guestUserId, gameId);
      metrics?.gamesStarted.inc({ mode: 'matchmaking' });
      return stored;
    },

    async cancelMatchmaking(userId) {
      await deps.redis.srem(MATCHMAKING_QUEUE, userId);
    },

    async ready(userId, gameId, ships) {
      return withLock(gameId, async () => {
        const { stored, role } = await loadForUser(gameId, userId);
        stored.state = lockFleet(stored.state, role, ships);
        await store.save(stored);
        return { stored, role };
      });
    },

    async action(userId, gameId, epoch, seq, cmd) {
      return withLock(gameId, async () => {
        const { stored, role } = await loadForUser(gameId, userId);
        if (epoch !== stored.state.epoch) {
          throw new AppError(409, 'STALE_EPOCH', 'stale epoch');
        }
        if (seq !== stored.state.seq) {
          throw new AppError(409, 'SEQ_MISMATCH', 'sequence mismatch');
        }

        const { state, result } = applyCommand(stored.state, role, cmd);
        stored.state = state;
        await store.save(stored);
        await recordEvent(deps.db, stored, userId, cmd.kind, { cmd, result });

        if (state.status === 'finished' && !stored.meta.persisted) {
          await persistFinishedGame(deps.db, stored);
          stored.meta.persisted = true;
          await store.save(stored);
        }

        return { stored, role, result };
      });
    },

    async rematch(userId, gameId, epoch) {
      return withLock(gameId, async () => {
        const { stored, role } = await loadForUser(gameId, userId);
        if (epoch !== stored.state.epoch) {
          throw new AppError(409, 'STALE_EPOCH', 'stale epoch');
        }
        const previousEpoch = stored.state.epoch;
        stored.state = requestRematch(stored.state, role);
        if (stored.state.epoch !== previousEpoch) {
          stored.meta.persisted = false;
        }
        await store.save(stored);
        return { stored, role };
      });
    },

    async resume(userId, gameId) {
      const stored = await store.get(gameId);
      if (stored === null) {
        return null;
      }
      return { stored, role: roleOf(stored, userId) };
    },

    async leave(userId, gameId) {
      return withLock(gameId, async () => {
        const stored = await store.get(gameId);
        if (stored === null) {
          await store.clearActive(userId);
          return { opponentUserId: null };
        }

        let role: Role;
        try {
          role = roleOf(stored, userId);
        } catch {
          await store.clearActive(userId);
          return { opponentUserId: null };
        }

        const opponentUserId = role === 'host' ? stored.meta.guestUserId : stored.meta.hostUserId;

        await store.remove(gameId);
        await store.clearActive(stored.meta.hostUserId);
        if (stored.meta.guestUserId !== null) {
          await store.clearActive(stored.meta.guestUserId);
        }
        return { opponentUserId };
      });
    },

    async activeGame(userId) {
      const gameId = await store.getActive(userId);
      if (gameId === null) {
        return null;
      }
      return store.get(gameId);
    },
  };
}
