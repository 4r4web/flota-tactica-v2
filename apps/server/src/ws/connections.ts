import type { ServerMessage } from '@flota/protocol';
import type { WebSocket } from 'ws';

const OPEN = 1;

export interface ConnectionHub {
  add(userId: string, socket: WebSocket): void;
  remove(userId: string, socket: WebSocket): void;
  send(userId: string, message: ServerMessage): void;
  isOnline(userId: string): boolean;
}

export function createConnectionHub(): ConnectionHub {
  const sockets = new Map<string, Set<WebSocket>>();

  return {
    add(userId, socket) {
      const set = sockets.get(userId) ?? new Set<WebSocket>();
      set.add(socket);
      sockets.set(userId, set);
    },

    remove(userId, socket) {
      const set = sockets.get(userId);
      if (set === undefined) {
        return;
      }
      set.delete(socket);
      if (set.size === 0) {
        sockets.delete(userId);
      }
    },

    send(userId, message) {
      const set = sockets.get(userId);
      if (set === undefined) {
        return;
      }
      const data = JSON.stringify(message);
      for (const socket of set) {
        if (socket.readyState === OPEN) {
          socket.send(data);
        }
      }
    },

    isOnline(userId) {
      return (sockets.get(userId)?.size ?? 0) > 0;
    },
  };
}
