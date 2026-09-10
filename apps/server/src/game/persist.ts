import type { Role } from '@flota/domain';

import { gameEvents, gamePlayers, games } from '../db/schema.js';
import type { Database } from '../infra/db.js';
import type { StoredGame } from './store.js';

export async function createGameRecord(
  db: Database,
  gameId: string,
  mode: 'private' | 'matchmaking',
): Promise<void> {
  await db.insert(games).values({ id: gameId, status: 'active', mode }).onConflictDoNothing();
}

export async function recordEvent(
  db: Database,
  stored: StoredGame,
  actorUserId: string,
  type: string,
  payload: unknown,
): Promise<void> {
  await db.insert(gameEvents).values({
    gameId: stored.meta.id,
    epoch: stored.state.epoch,
    seq: stored.state.seq,
    turn: stored.state.turn,
    actorUserId,
    type,
    payload,
  });
}

export async function persistFinishedGame(db: Database, stored: StoredGame): Promise<void> {
  const { state, meta } = stored;
  const winnerUserId =
    state.winner === 'host' ? meta.hostUserId : state.winner === 'guest' ? meta.guestUserId : null;

  await db
    .insert(games)
    .values({
      id: meta.id,
      status: 'finished',
      mode: meta.mode,
      winnerUserId,
      finishedAt: new Date(),
      finalEpoch: state.epoch,
    })
    .onConflictDoUpdate({
      target: games.id,
      set: {
        status: 'finished',
        winnerUserId,
        finishedAt: new Date(),
        finalEpoch: state.epoch,
      },
    });

  const refs: Array<{ role: Role; userId: string | null }> = [
    { role: 'host', userId: meta.hostUserId },
    { role: 'guest', userId: meta.guestUserId },
  ];

  for (const { role, userId } of refs) {
    if (userId === null) {
      continue;
    }
    await db
      .insert(gamePlayers)
      .values({
        gameId: meta.id,
        userId,
        role,
        result: state.winner === role ? 'win' : 'loss',
        fleetSnapshot: state.players[role].fleet.map((ship) => ({ id: ship.id, hp: ship.hp })),
      })
      .onConflictDoNothing();
  }
}
