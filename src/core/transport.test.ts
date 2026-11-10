import { describe, expect, it } from 'vitest';
import { Game } from './Game';
import { applyOrder, transportAccess, transportModeOf } from './engine';

const AIRBASES = ['al_udeid', 'al_dhafra', 'ali_al_salem', 'prince_sultan', 'nevatim', 'hatzerim'];

function usaGame(seed = 44): Game {
  const game = new Game();
  game.start('campaign', 'usa', seed);
  return game;
}

function request(game: Game, packageId: string): void {
  applyOrder(game.snap, game.map, { kind: 'reinforce', packageId }, () => 0.5, []);
}

describe('transport modes', () => {
  it('records how each package travels', () => {
    const game = usaGame();
    request(game, 'interceptors');
    request(game, 'patriot');
    request(game, 'csg');
    expect(game.snap.reinforcements.map((r) => r.mode)).toEqual(['airlift', 'sealift', 'naval']);
  });

  it('falls back to a sensible mode for older saves', () => {
    expect(transportModeOf({ kind: 'interceptors' })).toBe('airlift');
    expect(transportModeOf({ kind: 'thaad' })).toBe('sealift');
    expect(transportModeOf({ kind: 'csg' })).toBe('naval');
  });

  it('charges one tanker sortie for airlift but not for sealift', () => {
    const game = usaGame();
    game.snap.resources.tankerSorties = 4;
    request(game, 'interceptors');
    expect(game.snap.resources.tankerSorties).toBe(3);
    request(game, 'patriot');
    expect(game.snap.resources.tankerSorties).toBe(3);
  });

  it('delays sealift for Hormuz risk while airlift keeps flying', () => {
    const game = usaGame();
    game.snap.logisticsCfg = { interdictHormuz: -1, maxDelay: 3 };
    request(game, 'interceptors');
    request(game, 'patriot');
    game.endTurn();
    const air = game.snap.reinforcements.find((r) => r.id === 'interceptors')!;
    const sea = game.snap.reinforcements.find((r) => r.id === 'patriot')!;
    expect(air.delayTurns ?? 0).toBe(0);
    expect(sea.delayTurns ?? 0).toBeGreaterThan(0);
  });

  it('will not airlift without tanker sorties', () => {
    const game = usaGame();
    game.snap.resources.tankerSorties = 0;
    expect(game.queueOrder({ kind: 'reinforce', packageId: 'interceptors' }).ok).toBe(false);
    expect(game.queueOrder({ kind: 'airlift' }).ok).toBe(false);
    expect(game.queueOrder({ kind: 'reinforce', packageId: 'patriot' }).ok).toBe(true);
  });

  it('holds an airlift shipment when no airbase can receive it', () => {
    const game = usaGame();
    request(game, 'interceptors');
    for (const id of AIRBASES) {
      if (game.snap.nodes[id]) game.snap.nodes[id]!.integrity = 0;
    }
    expect(transportAccess(game.snap, 'airlift').ok).toBe(false);
    for (let turn = 0; turn < 5 && game.snap.status === 'playing'; turn++) {
      game.snap.resources.politicalWill = 80;
      game.endTurn();
    }
    const pkg = game.snap.reinforcements.find((r) => r.id === 'interceptors');
    expect(pkg).toBeDefined();
    expect(pkg!.delayTurns ?? 0).toBeGreaterThan(0);
  });
});
