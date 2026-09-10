import { describe, expect, it } from 'vitest';

import {
  applyCommand,
  createGame,
  DomainError,
  lockFleet,
  phaseFor,
  requestRematch,
  turnRole,
  viewFor,
} from '../src/index.js';
import type { GameState, PlacementInput, Role, ShipId } from '../src/index.js';

const HOST: PlacementInput[] = [
  { id: 'scout', at: 0, vertical: false },
  { id: 'sub', at: 20, vertical: false },
  { id: 'support', at: 40, vertical: false },
];

const GUEST: PlacementInput[] = [
  { id: 'scout', at: 90, vertical: false },
  { id: 'sub', at: 70, vertical: false },
  { id: 'support', at: 50, vertical: false },
];

function started(host: PlacementInput[] = HOST, guest: PlacementInput[] = GUEST): GameState {
  let state = createGame('g1');
  state = lockFleet(state, 'host', host);
  state = lockFleet(state, 'guest', guest);
  return state;
}

function findShip(state: GameState, role: Role, id: ShipId) {
  const ship = state.players[role].fleet.find((candidate) => candidate.id === id);
  if (ship === undefined) {
    throw new Error(`missing ${role}/${id}`);
  }
  return ship;
}

function setHp(state: GameState, role: Role, id: ShipId, hp: number): GameState {
  findShip(state, role, id).hp = hp;
  return state;
}

function endTurn(state: GameState, role: Role): GameState {
  return applyCommand(state, role, { kind: 'end' }).state;
}

describe('setup', () => {
  it('starts only when both fleets are locked', () => {
    let state = createGame('g1');
    expect(state.status).toBe('placement');
    expect(phaseFor(state, 'host')).toBe('placement');

    state = lockFleet(state, 'host', HOST);
    expect(state.status).toBe('placement');
    expect(phaseFor(state, 'host')).toBe('waiting');
    expect(phaseFor(state, 'guest')).toBe('placement');

    state = lockFleet(state, 'guest', GUEST);
    expect(state.status).toBe('active');
    expect(state.turn).toBe(0);
    expect(state.ap).toBe(2);
    expect(turnRole(state)).toBe('host');
  });

  it('rejects invalid fleets and double locking', () => {
    let state = createGame('g1');
    expect(() =>
      lockFleet(state, 'host', [
        { id: 'scout', at: 0, vertical: false },
        { id: 'scout', at: 20, vertical: false },
        { id: 'support', at: 40, vertical: false },
      ]),
    ).toThrow(DomainError);

    state = lockFleet(state, 'host', HOST);
    expect(() => lockFleet(state, 'host', HOST)).toThrow(/already locked/);
  });
});

describe('turns and action points', () => {
  it('rejects acting out of turn', () => {
    const state = started();
    expect(() => applyCommand(state, 'guest', { kind: 'end' })).toThrow(/turn/);
  });

  it('advances the turn after two actions', () => {
    let state = started();
    ({ state } = applyCommand(state, 'host', {
      kind: 'move',
      ship: 'scout',
      dx: 0,
      dy: 1,
      distance: 1,
    }));
    expect(state.ap).toBe(1);
    expect(state.turn).toBe(0);

    ({ state } = applyCommand(state, 'host', {
      kind: 'move',
      ship: 'sub',
      dx: 0,
      dy: 1,
      distance: 1,
    }));
    expect(state.turn).toBe(1);
    expect(state.ap).toBe(2);
    expect(turnRole(state)).toBe('guest');
  });

  it('lets a ship act once per action type per turn', () => {
    let state = started();
    ({ state } = applyCommand(state, 'host', {
      kind: 'move',
      ship: 'scout',
      dx: 0,
      dy: 1,
      distance: 1,
    }));
    expect(() =>
      applyCommand(state, 'host', { kind: 'move', ship: 'scout', dx: 0, dy: 1, distance: 1 }),
    ).toThrow(/already used/);
  });

  it('lets the same ship move and then attack in one turn', () => {
    let state = started();
    ({ state } = applyCommand(state, 'host', {
      kind: 'move',
      ship: 'sub',
      dx: 0,
      dy: 1,
      distance: 1,
    }));
    ({ state } = applyCommand(state, 'host', {
      kind: 'attack',
      ship: 'sub',
      target: 70,
      axis: 'row',
    }));
    expect(findShip(state, 'guest', 'sub').hp).toBe(3);
  });

  it('increments the global sequence on every command', () => {
    let state = started();
    expect(state.seq).toBe(0);
    ({ state } = applyCommand(state, 'host', {
      kind: 'move',
      ship: 'scout',
      dx: 0,
      dy: 1,
      distance: 1,
    }));
    expect(state.seq).toBe(1);
    ({ state } = applyCommand(state, 'host', { kind: 'end' }));
    expect(state.seq).toBe(2);
  });
});

describe('movement', () => {
  it('validates direction, distance and board edges', () => {
    const state = started();
    expect(() =>
      applyCommand(state, 'host', { kind: 'move', ship: 'scout', dx: 1, dy: 1, distance: 1 }),
    ).toThrow(/orthogonal/);
    expect(() =>
      applyCommand(state, 'host', { kind: 'move', ship: 'scout', dx: 0, dy: 1, distance: 0 }),
    ).toThrow(/distance/);
    expect(() =>
      applyCommand(state, 'host', { kind: 'move', ship: 'scout', dx: 1, dy: 0, distance: 4 }),
    ).toThrow(/distance/);
    expect(() =>
      applyCommand(state, 'host', { kind: 'move', ship: 'scout', dx: -1, dy: 0, distance: 1 }),
    ).toThrow(/board/);
  });

  it('checks the whole swept path atomically', () => {
    const state = started();
    expect(() =>
      applyCommand(state, 'host', { kind: 'move', ship: 'scout', dx: 0, dy: 1, distance: 2 }),
    ).toThrow(/blocked/);
    expect(findShip(state, 'host', 'scout').at).toBe(0);
  });

  it('does not wrap horizontally', () => {
    const host: PlacementInput[] = [
      { id: 'scout', at: 8, vertical: false },
      { id: 'sub', at: 20, vertical: false },
      { id: 'support', at: 40, vertical: false },
    ];
    const state = started(host);
    expect(() =>
      applyCommand(state, 'host', { kind: 'move', ship: 'scout', dx: 1, dy: 0, distance: 1 }),
    ).toThrow(/board/);
  });

  it('lets ships move through wrecks', () => {
    let state = started();
    state = setHp(state, 'host', 'sub', 0);
    const { state: after } = applyCommand(state, 'host', {
      kind: 'move',
      ship: 'scout',
      dx: 0,
      dy: 1,
      distance: 2,
    });
    expect(findShip(after, 'host', 'scout').at).toBe(20);
  });

  it('does not let sunk ships act', () => {
    let state = started();
    state = setHp(state, 'host', 'sub', 0);
    expect(() =>
      applyCommand(state, 'host', { kind: 'move', ship: 'sub', dx: 0, dy: 1, distance: 1 }),
    ).toThrow(/sunk/);
  });
});

describe('combat', () => {
  it('deals damage once per ship no matter how many cells are hit', () => {
    const state = started();
    const { state: after, result } = applyCommand(state, 'host', {
      kind: 'attack',
      ship: 'sub',
      target: 70,
      axis: 'row',
    });
    expect(result).toMatchObject({ kind: 'attack', hits: [70, 71, 72], sunk: [] });
    expect(findShip(after, 'guest', 'sub').hp).toBe(3);
  });

  it('sinks ships and ignores wrecks as targets', () => {
    let state = started();
    state = setHp(state, 'guest', 'scout', 1);
    const first = applyCommand(state, 'host', {
      kind: 'attack',
      ship: 'sub',
      target: 90,
      axis: 'row',
    });
    expect(first.result).toMatchObject({ kind: 'attack', sunk: ['scout'] });

    const second = applyCommand(first.state, 'host', {
      kind: 'attack',
      ship: 'scout',
      target: 90,
      axis: 'row',
    });
    expect(second.result).toMatchObject({ kind: 'attack', hits: [], sunk: [] });
  });

  it('breaks camouflage when attacking', () => {
    let state = started();
    state = endTurn(state, 'host');
    state = applyCommand(state, 'guest', { kind: 'ability', ship: 'sub' }).state;
    expect(findShip(state, 'guest', 'sub').cloakUntil).toBe(5);
    state = applyCommand(state, 'guest', {
      kind: 'attack',
      ship: 'sub',
      target: 0,
      axis: 'row',
    }).state;
    expect(findShip(state, 'guest', 'sub').cloakUntil).toBe(-1);
  });
});

describe('sonar and camouflage', () => {
  it('reveals enemy cells and clears contacts at turn end', () => {
    const state = started();
    const { state: after, result } = applyCommand(state, 'host', {
      kind: 'ability',
      ship: 'scout',
      target: 71,
    });
    expect(result).toMatchObject({ kind: 'ability', ability: 'sonar', contacts: [70, 71, 72] });
    expect(after.players.host.contacts).toEqual([70, 71, 72]);
    expect(endTurn(after, 'host').players.host.contacts).toEqual([]);
  });

  it('hides cloaked ships from sonar until the cloak expires', () => {
    let state = started();
    state = endTurn(state, 'host');
    state = applyCommand(state, 'guest', { kind: 'ability', ship: 'sub' }).state;
    state = endTurn(state, 'guest');

    const hidden = applyCommand(state, 'host', { kind: 'ability', ship: 'scout', target: 71 });
    expect(hidden.result).toMatchObject({ kind: 'ability', contacts: [] });

    let s = endTurn(hidden.state, 'host');
    s = endTurn(s, 'guest');
    s = endTurn(s, 'host');
    s = endTurn(s, 'guest');

    const revealed = applyCommand(s, 'host', { kind: 'ability', ship: 'scout', target: 71 });
    expect(revealed.result).toMatchObject({ kind: 'ability', contacts: [70, 71, 72] });
  });
});

describe('abilities', () => {
  const withFrigate: PlacementInput[] = [
    { id: 'scout', at: 0, vertical: false },
    { id: 'frigate', at: 20, vertical: false },
    { id: 'support', at: 40, vertical: false },
  ];

  it('self-repair heals, caps at max and consumes a charge', () => {
    let state = started(withFrigate);
    state = setHp(state, 'host', 'frigate', 4);
    const { state: after } = applyCommand(state, 'host', { kind: 'ability', ship: 'frigate' });
    expect(findShip(after, 'host', 'frigate').hp).toBe(6);
    expect(findShip(after, 'host', 'frigate').ledger.charges).toBe(1);
  });

  it('enforces cooldown and finite charges', () => {
    let state = started(withFrigate);
    state = setHp(state, 'host', 'frigate', 1);
    state = applyCommand(state, 'host', { kind: 'ability', ship: 'frigate' }).state;

    expect(() => applyCommand(state, 'host', { kind: 'ability', ship: 'frigate' })).toThrow(
      /already used/,
    );

    let s = endTurn(state, 'host');
    s = endTurn(s, 'guest');
    expect(() => applyCommand(s, 'host', { kind: 'ability', ship: 'frigate' })).toThrow(/cooldown/);
  });

  it('ally repair heals an in-range damaged ally and never resurrects', () => {
    const adjacent: PlacementInput[] = [
      { id: 'scout', at: 0, vertical: false },
      { id: 'sub', at: 30, vertical: false },
      { id: 'support', at: 10, vertical: false },
    ];
    let state = started(adjacent);
    state = setHp(state, 'host', 'scout', 1);

    const { state: after, result } = applyCommand(state, 'host', {
      kind: 'ability',
      ship: 'support',
      ally: 'scout',
    });
    expect(result).toMatchObject({ kind: 'ability', ability: 'repair', healed: 2 });
    expect(findShip(after, 'host', 'scout').hp).toBe(3);

    const dead = setHp(state, 'host', 'scout', 0);
    expect(() =>
      applyCommand(dead, 'host', { kind: 'ability', ship: 'support', ally: 'scout' }),
    ).toThrow(/sunk/);
  });

  it('rejects ally repair when out of range or at full health', () => {
    let state = started();
    state = setHp(state, 'host', 'scout', 1);
    expect(() =>
      applyCommand(state, 'host', { kind: 'ability', ship: 'support', ally: 'scout' }),
    ).toThrow(/range/);

    const full = started([
      { id: 'scout', at: 0, vertical: false },
      { id: 'sub', at: 30, vertical: false },
      { id: 'support', at: 10, vertical: false },
    ]);
    expect(() =>
      applyCommand(full, 'host', { kind: 'ability', ship: 'support', ally: 'scout' }),
    ).toThrow(/full health/);
  });

  it('rejects abilities on ships without one', () => {
    const host: PlacementInput[] = [
      { id: 'scout', at: 0, vertical: false },
      { id: 'destroyer', at: 20, vertical: false },
      { id: 'support', at: 40, vertical: false },
    ];
    const state = started(host);
    expect(() => applyCommand(state, 'host', { kind: 'ability', ship: 'destroyer' })).toThrow(
      /no ability/,
    );
  });
});

describe('victory and rematch', () => {
  function finishedGame(): GameState {
    const host: PlacementInput[] = [
      { id: 'dread', at: 0, vertical: false },
      { id: 'scout', at: 20, vertical: false },
      { id: 'support', at: 40, vertical: false },
    ];
    let state = started(host);
    state = setHp(state, 'guest', 'scout', 1);
    state = setHp(state, 'guest', 'sub', 1);
    state = setHp(state, 'guest', 'support', 1);

    state = applyCommand(state, 'host', {
      kind: 'attack',
      ship: 'dread',
      target: 90,
      axis: 'row',
    }).state;
    state = applyCommand(state, 'host', {
      kind: 'attack',
      ship: 'scout',
      target: 70,
      axis: 'row',
    }).state;
    state = endTurn(state, 'guest');
    state = applyCommand(state, 'host', {
      kind: 'attack',
      ship: 'support',
      target: 50,
      axis: 'row',
    }).state;
    return state;
  }

  it('finishes when all enemy ships are sunk', () => {
    const state = finishedGame();
    expect(state.status).toBe('finished');
    expect(state.winner).toBe('host');
    expect(phaseFor(state, 'host')).toBe('finished');
    expect(viewFor(state, 'host').winner).toBe('me');
    expect(viewFor(state, 'guest').winner).toBe('peer');
  });

  it('requires both players to request a rematch', () => {
    let state = finishedGame();
    state = requestRematch(state, 'host');
    expect(state.status).toBe('finished');
    expect(state.players.host.rematch).toBe(true);

    state = requestRematch(state, 'guest');
    expect(state.status).toBe('placement');
    expect(state.epoch).toBe(1);
    expect(state.players.host.ready).toBe(false);
    expect(state.players.guest.ready).toBe(false);
    expect(state.turn).toBe(0);
  });

  it('rejects rematch before the match is finished', () => {
    expect(() => requestRematch(started(), 'host')).toThrow(/not finished/);
  });
});

describe('view filtering', () => {
  it('never exposes rival positions, hp or cloak state', () => {
    const state = started();
    const view = viewFor(state, 'host');

    expect(Object.keys(view.enemyShips[0]!)).toEqual(['id', 'sunk']);
    expect(view.myFleet[0]).toHaveProperty('at');

    const serialized = JSON.stringify(view.enemyShips);
    expect(serialized).not.toContain('at');
    expect(serialized).not.toContain('hp');
    expect(serialized).not.toContain('cloak');
  });
});
