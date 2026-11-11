import { beforeEach, describe, expect, it } from 'vitest';
import { hostileTo, resolveStrike, strikeRange, validateStrike } from '../combat/combat';
import { hexDistance } from '../map/hex';
import { maxSuperpowerTier } from '../politics/politics';
import { Game } from './Game';
import { defenderOfNode, nodeState, unitType } from './world';

type Faction = 'usa' | 'israel' | 'iran';

/** Queue one sensible strike mission from the player's best placed aircraft. */
function issueStrike(game: Game, faction: Faction): void {
  const targets = game.map.nodes.filter((node) => {
    const defender = defenderOfNode(node);
    return !!defender && hostileTo(faction, defender);
  });
  const aircraft = game.snap.units.filter(
    (u) => u.faction === faction && unitType(u.typeId).category === 'air' && u.magazine > 0 && u.cooldown === 0,
  );
  for (const unit of aircraft) {
    for (const target of targets) {
      const hex = game.map.nodeHexOf(target.id);
      if (!hex) continue;
      if (hexDistance({ col: unit.col, row: unit.row }, hex) > strikeRange(game.snap, unit)) continue;
      const result = game.queueOrder({
        kind: 'strike',
        unitUid: unit.uid,
        col: hex.col,
        row: hex.row,
        nodeId: target.id,
      });
      if (result.ok) return;
    }
  }
}

function playCampaign(faction: Faction, seed: number): Game {
  const game = new Game();
  game.start('campaign', faction, seed);
  let guard = 0;
  while (game.snap.status === 'playing' && guard < 32) {
    issueStrike(game, faction);
    game.endTurn();
    guard++;
  }
  return game;
}

describe('full campaigns', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
      configurable: true,
      writable: true,
    });
  });

  it.each<Faction>(['usa', 'israel', 'iran'])('resolves 30 turns as %s without breaking state', (faction) => {
    const game = playCampaign(faction, 987654);
    const snap = game.snap;

    expect(snap.turn).toBeGreaterThanOrEqual(5);
    expect(['playing', 'won', 'lost']).toContain(snap.status);
    expect(snap.units.length).toBeGreaterThan(0);

    for (const unit of snap.units) {
      expect(Number.isFinite(unit.strength)).toBe(true);
      expect(unit.strength).toBeGreaterThan(0);
      expect(unit.col).toBeGreaterThanOrEqual(0);
      expect(unit.row).toBeGreaterThanOrEqual(0);
    }
    for (const state of Object.values(snap.nodes)) {
      expect(state.integrity).toBeGreaterThanOrEqual(0);
      expect(state.integrity).toBeLessThanOrEqual(state.maxIntegrity);
    }
    for (const value of Object.values(snap.meters)) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(snap.log.length).toBeGreaterThan(10);
    expect(snap.orderLog.length).toBeGreaterThan(0);

    expect(snap.meters.nuclearEscalation >= 0).toBe(true);
    expect(snap.meters.inflation >= 0).toBe(true);
    expect(maxSuperpowerTier(snap)).toBeLessThanOrEqual(3);
  });

  it('reaches a terminal outcome eventually with sustained pressure', () => {
    const game = playCampaign('usa', 424242);
    const settled = game.snap.status !== 'playing' || game.snap.turn > 30;
    expect(settled).toBe(true);
  });

  it('round-trips a saved campaign', () => {
    const game = playCampaign('usa', 5150);
    expect(game.save('slot1')).toBe(true);

    const restored = new Game();
    expect(restored.load('slot1')).toBe(true);
    expect(restored.snap.turn).toBe(game.snap.turn);
    expect(restored.snap.units.length).toBe(game.snap.units.length);
    expect(JSON.stringify(restored.snap)).toBe(JSON.stringify(game.snap));
  });
});

describe('great-power red lines', () => {
  it('blocks coalition strikes on Iran once the no-fly zone holds', () => {
    const game = new Game();
    game.start('campaign', 'usa', 8080);
    game.snap.meters.nuclearEscalation = 85;
    game.snap.superpowers.russia.stance = 85;
    game.snap.superpowers.russia.tier = 0;
    game.snap.superpowers.china.stance = 85;
    game.snap.superpowers.china.tier = 0;

    const b2 = game.snap.units.find((u) => u.typeId === 'b2')!;
    const natanz = game.map.nodeHexOf('natanz')!;
    const result = validateStrike(game.snap, game.map, b2, natanz.col, natanz.row, 'natanz');
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('no-fly zone') });
  });

  it('blocks air strikes on Iranian cities on low political will', () => {
    const game = new Game();
    game.start('campaign', 'usa', 8080);
    game.snap.resources.politicalWill = 10;
    game.snap.superpowers.russia.stance = 5;
    game.snap.superpowers.china.stance = 5;
    game.snap.superpowers.russia.tier = 0;
    game.snap.superpowers.china.tier = 0;
    game.snap.meters.nuclearEscalation = 5;

    const b2 = game.snap.units.find((u) => u.typeId === 'b2')!;
    const tehran = game.map.nodeHexOf('tehran')!;
    const result = validateStrike(game.snap, game.map, b2, tehran.col, tehran.row, 'tehran');
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('Congress') });
  });

  it('updates great-power posture from coalition strikes on Iranian soil', () => {
    const game = new Game();
    game.start('campaign', 'usa', 8080);
    const snap = game.snap;

    // An American strike on a buried nuclear site raises escalation and drags
    // Russia and China toward hostility.
    expect(maxSuperpowerTier(snap)).toBe(0);
    const b2 = game.snap.units.find((u) => u.typeId === 'b2')!;
    const natanz = game.map.nodeHexOf('natanz')!;
    resolveStrike(snap, game.map, b2, natanz.col, natanz.row, 'natanz', () => 0.9);
    game.endTurn();
    expect(snap.meters.nuclearEscalation > 0).toBe(true);
  });

  it('keeps great-power posture at zero when Iran never strikes Iran', () => {
    const game = new Game();
    game.start('campaign', 'iran', 98765);
    let guard = 0;
    while (game.snap.turn < 8 && game.snap.status === 'playing') {
      game.endTurn();
      guard++;
    }
    expect(maxSuperpowerTier(game.snap)).toBe(0);
  });
});

describe('buried targets', () => {
  it('protects buried halls from conventional bombs but not from a penetrator', () => {
    const game = new Game();
    game.start('campaign', 'usa', 8080);
    const fordow = game.map.nodeHexOf('fordow')!;
    const before = nodeState(game.snap, 'fordow').integrity;
    expect(before).toBe(100);

    // Six conventional sorties crater the surface but cannot reach a hall 60 m
    // underground. The roll always fails interception, so every bomb lands.
    for (let i = 0; i < 6; i++) {
      const f15 = game.snap.units.find((u) => u.typeId === 'f15e' && u.faction === 'usa')!;
      f15.magazine = 5;
      f15.cooldown = 0;
      resolveStrike(game.snap, game.map, f15, fordow.col, fordow.row, 'fordow', () => 0.99);
    }
    const afterConventional = nodeState(game.snap, 'fordow').integrity;
    expect(afterConventional).toBeLessThan(before);
    expect(afterConventional).toBeGreaterThanOrEqual(55);

    // The B-2's MOP reaches the hall.
    const b2 = game.snap.units.find((u) => u.typeId === 'b2')!;
    resolveStrike(game.snap, game.map, b2, fordow.col, fordow.row, 'fordow', () => 0.99);
    expect(nodeState(game.snap, 'fordow').integrity).toBeLessThan(55);
  });
});
