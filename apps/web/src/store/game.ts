import type { ActionResult, Command, Placement, PlayerView } from '@flota/protocol';
import { create } from 'zustand';

import { gameSocket } from '../api/socket';
import type { ConnectionStatus } from '../api/socket';
import { errorMessage } from '../lib/errors';

interface GameStore {
  status: ConnectionStatus;
  view: PlayerView | null;
  roomCode: string | null;
  players: number;
  lastResult: ActionResult | null;
  error: string | null;
  connect: (token: string) => void;
  disconnect: () => void;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  enqueue: () => void;
  cancelQueue: () => void;
  ready: (ships: Placement[]) => void;
  act: (cmd: Command) => void;
  rematch: () => void;
  clearError: () => void;
  reset: () => void;
}

export const useGame = create<GameStore>((set, get) => ({
  status: 'idle',
  view: null,
  roomCode: null,
  players: 0,
  lastResult: null,
  error: null,

  connect(token) {
    gameSocket.connect(token);
  },

  disconnect() {
    gameSocket.close();
    set({
      status: 'idle',
      view: null,
      roomCode: null,
      players: 0,
      lastResult: null,
      error: null,
    });
  },

  createRoom() {
    gameSocket.send('room.create');
  },

  joinRoom(code) {
    gameSocket.send('room.join', { code });
  },

  enqueue() {
    gameSocket.send('matchmaking.enqueue');
  },

  cancelQueue() {
    gameSocket.send('matchmaking.cancel');
  },

  ready(ships) {
    const { view } = get();
    if (view !== null) {
      gameSocket.send('game.ready', { gameId: view.gameId, ships });
    }
  },

  act(cmd) {
    const { view } = get();
    if (view === null) {
      return;
    }
    gameSocket.send('game.action', {
      gameId: view.gameId,
      epoch: view.epoch,
      seq: view.seq,
      cmd,
    });
  },

  rematch() {
    const { view } = get();
    if (view !== null) {
      gameSocket.send('game.rematch', { gameId: view.gameId, epoch: view.epoch });
    }
  },

  clearError() {
    set({ error: null });
  },

  reset() {
    set({ view: null, roomCode: null, players: 0, lastResult: null, error: null });
  },
}));

gameSocket.onStatus((status) => {
  useGame.setState({ status });
  if (status === 'connected') {
    const { view } = useGame.getState();
    if (view !== null) {
      gameSocket.send('game.resume', { gameId: view.gameId });
    }
  }
});

gameSocket.onMessage((message) => {
  switch (message.type) {
    case 'room.created':
      useGame.setState({ roomCode: message.code });
      break;
    case 'room.state':
      useGame.setState({ players: message.players.length });
      break;
    case 'game.state':
    case 'game.resumed':
      useGame.setState({ view: message.view, error: null });
      break;
    case 'game.actionResult':
      useGame.setState({ lastResult: message.result });
      break;
    case 'error':
      useGame.setState({ error: errorMessage(message.code, message.message) });
      break;
    default:
      break;
  }
});
