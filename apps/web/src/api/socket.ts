import { PROTOCOL_VERSION } from '@flota/protocol';
import type { ClientMessage, ServerMessage } from '@flota/protocol';

import { uuid } from '../lib/uuid';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export type MessageHandler = (message: ServerMessage) => void;
export type StatusHandler = (status: ConnectionStatus) => void;

class GameSocket {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly statusHandlers = new Set<StatusHandler>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  connect(token: string): void {
    this.token = token;
    this.manuallyClosed = false;
    this.open('connecting');
  }

  send(type: ClientMessage['type'], payload: Record<string, unknown> = {}): void {
    if (this.socket === null || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const message = {
      v: PROTOCOL_VERSION,
      id: uuid(),
      ts: Date.now(),
      type,
      ...payload,
    };
    this.socket.send(JSON.stringify(message));
  }

  close(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSocket();
    this.emitStatus('disconnected');
  }

  private emitStatus(status: ConnectionStatus): void {
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }

  private open(status: ConnectionStatus): void {
    if (this.token === null) {
      return;
    }
    this.closeSocket();
    this.emitStatus(status);

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(
      `${protocol}://${window.location.host}/ws?token=${encodeURIComponent(this.token)}`,
    );
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      this.emitStatus('connected');
    });

    socket.addEventListener('message', (event) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      for (const handler of this.messageHandlers) {
        handler(parsed);
      }
    });

    socket.addEventListener('close', () => {
      if (this.socket !== socket) {
        return;
      }
      this.socket = null;
      if (this.manuallyClosed) {
        this.emitStatus('disconnected');
        return;
      }
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      socket.close();
    });
  }

  private scheduleReconnect(): void {
    this.emitStatus('reconnecting');
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 15_000);
    this.reconnectTimer = setTimeout(() => this.open('reconnecting'), delay);
  }

  private closeSocket(): void {
    if (this.socket !== null) {
      const socket = this.socket;
      this.socket = null;
      socket.close();
    }
  }
}

export const gameSocket = new GameSocket();
