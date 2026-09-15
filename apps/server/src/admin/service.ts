import { desc, eq, inArray } from 'drizzle-orm';

import { gameEvents, gamePlayers, games, users } from '../db/schema.js';
import type { Database } from '../infra/db.js';

export interface AdminMatchPlayer {
  role: string;
  name: string;
  result: string | null;
}

export interface AdminMatch {
  id: string;
  status: string;
  mode: string;
  createdAt: string;
  finishedAt: string | null;
  finalEpoch: number;
  winnerName: string | null;
  players: AdminMatchPlayer[];
}

export interface AdminGameEvent {
  seq: number;
  turn: number;
  type: string;
  actor: string | null;
  payload: unknown;
  createdAt: string;
}

export interface AdminService {
  isAdmin(userId: string): Promise<boolean>;
  listMatches(limit: number): Promise<AdminMatch[]>;
  listEvents(gameId: string): Promise<AdminGameEvent[]>;
}

export function createAdminService(db: Database, adminEmail: string): AdminService {
  const normalizedAdmin = adminEmail.toLowerCase();

  return {
    async isAdmin(userId) {
      const found = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const user = found[0];
      return user !== undefined && user.email.toLowerCase() === normalizedAdmin;
    },

    async listMatches(limit) {
      const rows = await db
        .select({
          id: games.id,
          status: games.status,
          mode: games.mode,
          createdAt: games.createdAt,
          finishedAt: games.finishedAt,
          finalEpoch: games.finalEpoch,
          winnerName: users.displayName,
        })
        .from(games)
        .leftJoin(users, eq(users.id, games.winnerUserId))
        .orderBy(desc(games.createdAt))
        .limit(limit);

      const ids = rows.map((row) => row.id);
      const playerRows =
        ids.length === 0
          ? []
          : await db
              .select({
                gameId: gamePlayers.gameId,
                role: gamePlayers.role,
                name: users.displayName,
                result: gamePlayers.result,
              })
              .from(gamePlayers)
              .innerJoin(users, eq(users.id, gamePlayers.userId))
              .where(inArray(gamePlayers.gameId, ids));

      const byGame = new Map<string, AdminMatchPlayer[]>();
      for (const player of playerRows) {
        const list = byGame.get(player.gameId) ?? [];
        list.push({ role: player.role, name: player.name, result: player.result });
        byGame.set(player.gameId, list);
      }

      return rows.map((row) => ({
        id: row.id,
        status: row.status,
        mode: row.mode,
        createdAt: row.createdAt.toISOString(),
        finishedAt: row.finishedAt === null ? null : row.finishedAt.toISOString(),
        finalEpoch: row.finalEpoch,
        winnerName: row.winnerName ?? null,
        players: byGame.get(row.id) ?? [],
      }));
    },

    async listEvents(gameId) {
      const rows = await db
        .select({
          seq: gameEvents.seq,
          turn: gameEvents.turn,
          type: gameEvents.type,
          payload: gameEvents.payload,
          createdAt: gameEvents.createdAt,
          actor: users.displayName,
        })
        .from(gameEvents)
        .leftJoin(users, eq(users.id, gameEvents.actorUserId))
        .where(eq(gameEvents.gameId, gameId))
        .orderBy(gameEvents.seq);

      return rows.map((row) => ({
        seq: row.seq,
        turn: row.turn,
        type: row.type,
        actor: row.actor ?? null,
        payload: row.payload,
        createdAt: row.createdAt.toISOString(),
      }));
    },
  };
}
