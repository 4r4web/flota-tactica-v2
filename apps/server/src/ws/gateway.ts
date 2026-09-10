import { randomUUID } from 'node:crypto';

import { isDomainError, turnRole, viewFor } from '@flota/domain';
import type { DomainErrorCode } from '@flota/domain';
import { ClientMessage, PROTOCOL_VERSION } from '@flota/protocol';
import type { ErrorCode, ServerMessage } from '@flota/protocol';
import type { FastifyPluginAsync } from 'fastify';
import type { RawData, WebSocket } from 'ws';

import { authenticateToken } from '../auth/authenticate.js';
import type { AppDeps } from '../deps.js';
import { AppError, isAppError } from '../errors.js';
import { playerRefs } from '../game/service.js';
import type { GameService } from '../game/service.js';
import type { StoredGame } from '../game/store.js';
import type { Metrics } from '../infra/metrics.js';
import type { ConnectionHub } from './connections.js';

const HEARTBEAT_MS = 30_000;
const OPEN = 1;

function serverMessage(type: string, payload: Record<string, unknown>): ServerMessage {
  return {
    v: PROTOCOL_VERSION,
    id: randomUUID(),
    ts: Date.now(),
    type,
    ...payload,
  } as ServerMessage;
}

function mapDomainCode(code: DomainErrorCode): ErrorCode {
  switch (code) {
    case 'NOT_YOUR_TURN':
      return 'NOT_YOUR_TURN';
    case 'GAME_FINISHED':
      return 'GAME_FINISHED';
    default:
      return 'INVALID_ACTION';
  }
}

function toError(error: unknown): { code: ErrorCode; message: string } {
  if (isAppError(error)) {
    return { code: error.code as ErrorCode, message: error.message };
  }
  if (isDomainError(error)) {
    return { code: mapDomainCode(error.code), message: error.message };
  }
  return { code: 'INTERNAL', message: 'internal error' };
}

function roomPlayers(stored: StoredGame) {
  return playerRefs(stored)
    .filter((ref): ref is { role: 'host' | 'guest'; userId: string } => ref.userId !== null)
    .map((ref) => ({
      userId: ref.userId,
      role: ref.role,
      ready: stored.state.players[ref.role].ready,
    }));
}

function broadcastState(hub: ConnectionHub, stored: StoredGame): void {
  for (const ref of playerRefs(stored)) {
    if (ref.userId === null) {
      continue;
    }
    hub.send(
      ref.userId,
      serverMessage('game.state', {
        gameId: stored.state.id,
        epoch: stored.state.epoch,
        view: viewFor(stored.state, ref.role),
      }),
    );
  }
}

function broadcastPresence(hub: ConnectionHub, stored: StoredGame): void {
  const refs = playerRefs(stored);
  for (const ref of refs) {
    if (ref.userId === null) {
      continue;
    }
    const opponent = refs.find((candidate) => candidate.role !== ref.role);
    const opponentOnline = opponent?.userId != null && hub.isOnline(opponent.userId);
    hub.send(
      ref.userId,
      serverMessage('game.presence', {
        gameId: stored.state.id,
        opponentOnline,
      }),
    );
  }
}

interface HandlerContext {
  deps: AppDeps;
  hub: ConnectionHub;
  service: GameService;
  metrics?: Metrics;
}

async function handleMessage(ctx: HandlerContext, userId: string, raw: RawData): Promise<void> {
  let json: unknown;
  try {
    json = JSON.parse(raw.toString());
  } catch {
    throw new AppError(400, 'INVALID_ACTION', 'message is not valid JSON');
  }

  const parsed = ClientMessage.safeParse(json);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_ACTION', 'message does not match the protocol');
  }
  const message = parsed.data;
  const { hub, service } = ctx;

  switch (message.type) {
    case 'auth':
    case 'pong':
      return;

    case 'room.create': {
      const { stored } = await service.createPrivateRoom(userId);
      hub.send(
        userId,
        serverMessage('room.created', { gameId: stored.state.id, code: stored.meta.code }),
      );
      hub.send(
        userId,
        serverMessage('room.state', {
          gameId: stored.state.id,
          status: stored.state.status,
          players: roomPlayers(stored),
        }),
      );
      broadcastState(hub, stored);
      return;
    }

    case 'room.join': {
      const { stored } = await service.joinRoom(userId, message.code);
      const roomState = serverMessage('room.state', {
        gameId: stored.state.id,
        status: stored.state.status,
        players: roomPlayers(stored),
      });
      for (const ref of playerRefs(stored)) {
        if (ref.userId !== null) {
          hub.send(ref.userId, roomState);
        }
      }
      broadcastState(hub, stored);
      return;
    }

    case 'matchmaking.enqueue': {
      const stored = await service.enqueueMatchmaking(userId);
      if (stored === null) {
        return;
      }
      for (const ref of playerRefs(stored)) {
        if (ref.userId !== null) {
          hub.send(ref.userId, serverMessage('matchmaking.matched', { gameId: stored.state.id }));
        }
      }
      broadcastState(hub, stored);
      return;
    }

    case 'matchmaking.cancel': {
      await service.cancelMatchmaking(userId);
      return;
    }

    case 'game.ready': {
      const { stored } = await service.ready(userId, message.gameId, message.ships);
      broadcastState(hub, stored);
      return;
    }

    case 'game.action': {
      const { stored, result } = await service.action(
        userId,
        message.gameId,
        message.epoch,
        message.seq,
        message.cmd,
      );
      hub.send(userId, serverMessage('game.actionResult', { seq: stored.state.seq, result }));
      broadcastState(hub, stored);

      const turnChanged = serverMessage('game.turnChanged', {
        turn: stored.state.turn,
        ap: stored.state.ap,
        activeRole: turnRole(stored.state),
      });
      for (const ref of playerRefs(stored)) {
        if (ref.userId !== null) {
          hub.send(ref.userId, turnChanged);
        }
      }

      if (stored.state.status === 'finished' && stored.state.winner !== null) {
        const winnerRole = stored.state.winner;
        const winnerId = winnerRole === 'host' ? stored.meta.hostUserId : stored.meta.guestUserId;
        if (winnerId !== null) {
          const finished = serverMessage('game.finished', { winnerRole, winnerId });
          for (const ref of playerRefs(stored)) {
            if (ref.userId !== null) {
              hub.send(ref.userId, finished);
            }
          }
        }
      }
      return;
    }

    case 'game.rematch': {
      const { stored } = await service.rematch(userId, message.gameId, message.epoch);
      const rematchState = serverMessage('game.rematchState', {
        host: stored.state.players.host.rematch,
        guest: stored.state.players.guest.rematch,
      });
      for (const ref of playerRefs(stored)) {
        if (ref.userId !== null) {
          hub.send(ref.userId, rematchState);
        }
      }
      broadcastState(hub, stored);
      return;
    }

    case 'game.resume': {
      const resumed = await service.resume(userId, message.gameId);
      if (resumed === null) {
        return;
      }
      hub.send(
        userId,
        serverMessage('game.resumed', {
          gameId: resumed.stored.state.id,
          epoch: resumed.stored.state.epoch,
          view: viewFor(resumed.stored.state, resumed.role),
        }),
      );
      broadcastPresence(hub, resumed.stored);
      return;
    }

    case 'game.leave': {
      const { opponentUserId } = await service.leave(userId, message.gameId);
      if (opponentUserId !== null) {
        hub.send(opponentUserId, serverMessage('game.abandoned', { gameId: message.gameId }));
      }
      return;
    }
  }
}

function attachSocket(ctx: HandlerContext, socket: WebSocket, userId: string): void {
  const { hub } = ctx;
  hub.add(userId, socket);
  ctx.metrics?.wsConnections.inc();

  const heartbeat = setInterval(() => {
    hub.send(userId, serverMessage('ping', {}));
  }, HEARTBEAT_MS);

  socket.on('message', (raw) => {
    void handleMessage(ctx, userId, raw).catch((error: unknown) => {
      const { code, message } = toError(error);
      hub.send(userId, serverMessage('error', { code, message }));
    });
  });

  socket.on('close', () => {
    clearInterval(heartbeat);
    hub.remove(userId, socket);
    if (!hub.isOnline(userId)) {
      void ctx.service
        .activeGame(userId)
        .then((stored) => {
          if (stored !== null) {
            broadcastPresence(hub, stored);
          }
        })
        .catch(() => undefined);
    }
  });
}

export function wsRoutes(
  deps: AppDeps,
  hub: ConnectionHub,
  service: GameService,
  metrics?: Metrics,
): FastifyPluginAsync {
  const ctx: HandlerContext = { deps, hub, service, metrics };

  return async (app) => {
    app.get('/ws', { websocket: true }, (socket, request) => {
      const query = request.query as { token?: string };
      const token = query.token;

      if (token === undefined) {
        socket.close(4401, 'missing token');
        return;
      }

      void (async () => {
        let userId: string;
        try {
          userId = await authenticateToken(token, deps.tokens);
        } catch {
          socket.close(4401, 'invalid token');
          return;
        }
        if (socket.readyState === OPEN) {
          attachSocket(ctx, socket, userId);
          void service
            .activeGame(userId)
            .then((stored) => {
              if (stored !== null) {
                broadcastPresence(hub, stored);
              }
            })
            .catch(() => undefined);
        }
      })();
    });
  };
}
