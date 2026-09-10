import type { GameState } from '@flota/domain';

import type { RedisClient } from '../infra/redis.js';

export interface GameMeta {
  id: string;
  mode: 'private' | 'matchmaking';
  code: string | null;
  hostUserId: string;
  guestUserId: string | null;
  createdAt: number;
  persisted: boolean;
}

export interface StoredGame {
  state: GameState;
  meta: GameMeta;
}

const GAME_TTL_SECONDS = 24 * 60 * 60;

export interface GameStore {
  create(stored: StoredGame): Promise<void>;
  get(gameId: string): Promise<StoredGame | null>;
  save(stored: StoredGame): Promise<void>;
  remove(gameId: string): Promise<void>;
  setCode(code: string, gameId: string): Promise<void>;
  findByCode(code: string): Promise<string | null>;
  setActive(userId: string, gameId: string): Promise<void>;
  getActive(userId: string): Promise<string | null>;
  clearActive(userId: string): Promise<void>;
}

const gameKey = (id: string): string => `game:${id}`;
const codeKey = (code: string): string => `room:${code}`;
const activeKey = (userId: string): string => `user:${userId}:active`;

export function createGameStore(redis: RedisClient): GameStore {
  return {
    async create(stored) {
      await redis.set(gameKey(stored.meta.id), JSON.stringify(stored), 'EX', GAME_TTL_SECONDS);
      if (stored.meta.code !== null) {
        await redis.set(codeKey(stored.meta.code), stored.meta.id, 'EX', GAME_TTL_SECONDS);
      }
    },

    async get(gameId) {
      const raw = await redis.get(gameKey(gameId));
      return raw === null ? null : (JSON.parse(raw) as StoredGame);
    },

    async save(stored) {
      await redis.set(gameKey(stored.meta.id), JSON.stringify(stored), 'EX', GAME_TTL_SECONDS);
    },

    async remove(gameId) {
      const raw = await redis.get(gameKey(gameId));
      if (raw !== null) {
        const stored = JSON.parse(raw) as StoredGame;
        if (stored.meta.code !== null) {
          await redis.del(codeKey(stored.meta.code));
        }
      }
      await redis.del(gameKey(gameId));
    },

    async setCode(code, gameId) {
      await redis.set(codeKey(code), gameId, 'EX', GAME_TTL_SECONDS);
    },

    async findByCode(code) {
      return redis.get(codeKey(code));
    },

    async setActive(userId, gameId) {
      await redis.set(activeKey(userId), gameId, 'EX', GAME_TTL_SECONDS);
    },

    async getActive(userId) {
      return redis.get(activeKey(userId));
    },

    async clearActive(userId) {
      await redis.del(activeKey(userId));
    },
  };
}
