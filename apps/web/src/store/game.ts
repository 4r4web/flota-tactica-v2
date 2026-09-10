import type { ActionResult, Command, Placement, PlayerView } from '@flota/protocol';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { gameSocket } from '../api/socket';
import type { ConnectionStatus } from '../api/socket';
import { errorMessage } from '../lib/errors';

interface GameStore {
  status: ConnectionStatus;
  view: PlayerView | null;
  gameId: string | null;
  roomCode: string | null;
  players: number;
  opponentOnline: boolean;
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
  leave: () => void;
  clearError: () => void;
  reset: () => void;
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      status: 'idle',
      view: null,
      gameId: null,
      roomCode: null,
      players: 0,
      opponentOnline: true,
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
          gameId: null,
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
        const { gameId } = get();
        if (gameId !== null) {
          gameSocket.send('game.ready', { gameId, ships });
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

      leave() {
        const { gameId } = get();
        if (gameId !== null) {
          gameSocket.send('game.leave', { gameId });
        }
        set({
          view: null,
          gameId: null,
          roomCode: null,
          players: 0,
          lastResult: null,
          error: null,
        });
      },

      clearError() {
        set({ error: null });
      },

      reset() {
        set({
          view: null,
          gameId: null,
          roomCode: null,
          players: 0,
          lastResult: null,
          error: null,
        });
      },
    }),
    {
      name: 'flota-game',
      partialize: (state) => ({ gameId: state.gameId }),
    },
  ),
);

gameSocket.onStatus((status) => {
  useGame.setState({ status });
  if (status === 'connected') {
    const { gameId } = useGame.getState();
    if (gameId !== null) {
      gameSocket.send('game.resume', { gameId });
    }
  }
});

gameSocket.onMessage((message) => {
  switch (message.type) {
    case 'room.created':
      useGame.setState({ roomCode: message.code, gameId: message.gameId });
      break;
    case 'room.state':
      useGame.setState({ players: message.players.length });
      break;
    case 'game.state':
    case 'game.resumed':
      useGame.setState({ view: message.view, gameId: message.view.gameId, error: null });
      break;
    case 'game.actionResult':
      useGame.setState({ lastResult: message.result });
      break;
    case 'game.presence':
      useGame.setState({ opponentOnline: message.opponentOnline });
      break;
    case 'game.abandoned':
      useGame.setState({
        view: null,
        gameId: null,
        roomCode: null,
        players: 0,
        error: 'El rival ha abandonado la partida.',
      });
      break;
    case 'error':
      useGame.setState({ error: errorMessage(message.code, message.message) });
      break;
    default:
      break;
  }
});
