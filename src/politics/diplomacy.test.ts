import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { validateStrike } from '../combat/combat';
import { chinaTier, iranIncomeMultiplier, russiaTier, thirdPartyPhase, updateHosts } from './politics';

function usaGame(seed = 91): Game {
  const game = new Game();
  game.start('campaign', 'usa', seed);
  game.snap.warStarted = true;
  game.snap.phase = 'war';
  return game;
}

describe('great powers are not interchangeable', () => {
  it('Chinese cover buys oil revenue, Russian cover does not', () => {
    const game = usaGame();
    game.snap.superpowers.russia.stance = 0;
    game.snap.superpowers.china.stance = 0;
    game.snap.meters.oilPrice = 60;
    const base = iranIncomeMultiplier(game.snap);

    game.snap.superpowers.russia.stance = 40;
    expect(chinaTier(game.snap)).toBe(0);
    expect(russiaTier(game.snap)).toBe(1);
    expect(iranIncomeMultiplier(game.snap)).toBeCloseTo(base, 5);

    game.snap.superpowers.russia.stance = 0;
    game.snap.superpowers.china.stance = 40;
    expect(iranIncomeMultiplier(game.snap)).toBeCloseTo(base + 0.3, 5);
  });

  it('a Russian no-fly zone blocks aircraft but not sea-launched missiles', () => {
    const game = usaGame();
    game.snap.superpowers.russia.stance = 100;
    const nodeHex = game.map.nodeHexOf('bandar_abbas_underground')!;
    const air = game.snap.units.find((u) => u.typeId === 'f15e')!;
    air.col = nodeHex.col;
    air.row = nodeHex.row - 1;
    air.cooldown = 0;
    air.magazine = 4;
    const airCheck = validateStrike(game.snap, game.map, air, nodeHex.col, nodeHex.row, 'bandar_abbas_underground');
    expect(airCheck.ok).toBe(false);
    if (!airCheck.ok) expect(airCheck.reason).toMatch(/no-fly zone/i);

    const csg = game.snap.units.find((u) => u.typeId === 'csg')!;
    csg.col = nodeHex.col;
    csg.row = nodeHex.row - 1;
    csg.cooldown = 0;
    csg.magazine = 4;
    const seaCheck = validateStrike(game.snap, game.map, csg, nodeHex.col, nodeHex.row, 'bandar_abbas_underground');
    expect(seaCheck.ok).toBe(true);
  });
});

describe('third-party intervention stays honest', () => {
  it('does not invent Pakistani squadrons', () => {
    const game = usaGame();
    game.snap.nodes.abqaiq.integrity = 10;
    game.snap.nodes.prince_sultan.integrity = 50;
    const before = game.snap.units.length;
    const baseBefore = game.snap.nodes.prince_sultan.integrity;
    const events: Parameters<typeof thirdPartyPhase>[3] = [];
    thirdPartyPhase(game.snap, game.map, () => 0.1, events);
    expect(game.snap.units.length).toBe(before);
    expect(game.snap.nodes.prince_sultan.integrity).toBeGreaterThan(baseBefore);
    expect(events.some((e) => /No Pakistani combat aircraft deploy/.test(e.text))).toBe(true);
  });
});

describe('host-state consistency', () => {
  it('reopens Jordan after a closure expires', () => {
    const game = usaGame();
    const jordan = game.snap.hosts.jordan!;
    expect(jordan).toBeDefined();
    jordan.status = 'closed';
    jordan.closedUntilTurn = game.snap.turn;
    const events: Parameters<typeof updateHosts>[2] = [];
    updateHosts(game.snap, game.map, events);
    expect(jordan.status).toBe('open');
    expect(events.some((e) => /reopened/i.test(e.text))).toBe(true);
  });
});
