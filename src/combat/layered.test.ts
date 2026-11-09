import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { resolveStrike } from './combat';
import { AD_LAYER_ORDER, attackerLossChance, defenceLayers, detectRaid, suppressAfterImpact } from './airdefence';
import type { AdLayer } from './airdefence';

function usaGame(seed = 12): Game {
  const g = new Game();
  g.start('campaign', 'usa', seed);
  g.snap.warStarted = true;
  g.snap.phase = 'war';
  return g;
}

function israelHex(game: Game) {
  const node = game.map.nodes.find((n) => n.host === 'israel' && (n.kind === 'airbase' || n.kind === 'urban'))!;
  return { node, hex: game.map.nodeHexOf(node.id)! };
}

function constant(value: number) {
  return () => value;
}

describe('layered air defence', () => {
  it('returns long, medium and point layers in engagement order', () => {
    const game = usaGame();
    game.start('campaign', 'israel', 12);
    game.snap.warStarted = true;
    const { hex } = israelHex(game);
    const layers = defenceLayers(game.snap, game.map, hex.col, hex.row, 'israel', 'ballistic');
    expect(layers.length).toBeGreaterThan(0);
    const order = layers.map((l) => l.layer);
    expect([...order].sort((a, b) => AD_LAYER_ORDER.indexOf(a) - AD_LAYER_ORDER.indexOf(b))).toEqual(order);
    expect(new Set(order).size).toBe(order.length);
    expect(layers.every((l) => l.probability > 0)).toBe(true);
  });

  it('drops a layer when its interceptor pool cannot pay', () => {
    const game = usaGame();
    game.start('campaign', 'israel', 12);
    const { hex } = israelHex(game);
    const funded = defenceLayers(game.snap, game.map, hex.col, hex.row, 'israel', 'ballistic');
    expect(funded.some((l) => l.cost > 0)).toBe(true);
    game.snap.resources.interceptorsIsrael = 0;
    const broke = defenceLayers(game.snap, game.map, hex.col, hex.row, 'israel', 'ballistic');
    expect(broke.some((l) => l.cost > 0)).toBe(false);
    expect(broke.length).toBeLessThan(funded.length);
  });

  it('detection gates engagement: an undetected raid is never intercepted', () => {
    const seen = usaGame();
    const f15 = seen.snap.units.find((u) => u.faction === 'usa' && u.typeId === 'f15e')!;
    const natanz = seen.map.nodeHexOf('natanz')!;
    const detection = detectRaid(seen.snap, seen.map, natanz.col, natanz.row, 'iran', 'cruise', 0, () => 0.99);
    expect(detection.detected).toBe(false);
    expect(detection.chance).toBeGreaterThan(0);
    const undetected = resolveStrike(seen.snap, seen.map, f15, natanz.col, natanz.row, 'natanz', constant(0.99));
    expect(undetected.events.some((e) => /intercepted/i.test(e.text))).toBe(false);
    expect(seen.snap.nodes.natanz.integrity).toBeLessThan(100);

    const engaged = usaGame();
    const f15b = engaged.snap.units.find((u) => u.faction === 'usa' && u.typeId === 'f15e')!;
    const hexb = engaged.map.nodeHexOf('natanz')!;
    const before = engaged.snap.nodes.natanz.integrity;
    const detected = resolveStrike(engaged.snap, engaged.map, f15b, hexb.col, hexb.row, 'natanz', constant(0));
    expect(detected.events.some((e) => /intercepted/i.test(e.text))).toBe(true);
    expect(engaged.snap.nodes.natanz.integrity).toBe(before);
  });

  it('SEAD suppresses an air-defence unit for the rest of the turn', () => {
    const game = new Game();
    game.start('campaign', 'israel', 12);
    const arrow = game.snap.units.find((u) => u.faction === 'israel' && u.typeId === 'arrow3')!;
    expect(arrow).toBeTruthy();
    const before = defenceLayers(game.snap, game.map, arrow.col, arrow.row, 'israel', 'ballistic');
    expect(before.some((l) => l.layer === 'long')).toBe(true);

    suppressAfterImpact(game.snap, game.map, arrow.col, arrow.row, 'israel', undefined);

    expect(arrow.suppressedUntilTurn).toBeGreaterThan(game.snap.turn);
    const after = defenceLayers(game.snap, game.map, arrow.col, arrow.row, 'israel', 'ballistic');
    expect(after.some((l) => l.layer === 'long')).toBe(false);
  });
  it('attacker loss risk derives from the surviving layers, stealth and escort', () => {
    const game = usaGame();
    const { hex } = israelHex(game);
    const layers: AdLayer[] = defenceLayers(game.snap, game.map, hex.col, hex.row, 'israel', 'ballistic');
    const base = attackerLossChance({ layers, stealth: 0, depth: 5, range: 10, escort: false, hardenedTarget: false });
    const empty = attackerLossChance({ layers: [], stealth: 0, depth: 5, range: 10, escort: false, hardenedTarget: false });
    const stealthy = attackerLossChance({ layers, stealth: 0.6, depth: 5, range: 10, escort: false, hardenedTarget: false });
    const escorted = attackerLossChance({ layers, stealth: 0, depth: 5, range: 10, escort: true, hardenedTarget: false });
    expect(base).toBeGreaterThan(empty);
    expect(stealthy).toBeLessThan(base);
    expect(escorted).toBeLessThan(base);
    expect(base).toBeLessThanOrEqual(0.35);
  });

  it('is deterministic for a fixed seed and resolves both sides through the same path', () => {
    const runA = usaGame(21);
    const runB = usaGame(21);
    const sequence = () => {
      const values = [0.1, 0.4, 0.7, 0.2, 0.9];
      let i = 0;
      return () => values[i++ % values.length]!;
    };
    const a = runA.snap.units.find((u) => u.faction === 'usa' && u.typeId === 'f15e')!;
    const b = runB.snap.units.find((u) => u.faction === 'usa' && u.typeId === 'f15e')!;
    const hexA = runA.map.nodeHexOf('natanz')!;
    const hexB = runB.map.nodeHexOf('natanz')!;
    const resultA = resolveStrike(runA.snap, runA.map, a, hexA.col, hexA.row, 'natanz', sequence());
    const resultB = resolveStrike(runB.snap, runB.map, b, hexB.col, hexB.row, 'natanz', sequence());
    expect(resultA.events.map((e) => e.text)).toEqual(resultB.events.map((e) => e.text));
    expect(runA.snap.nodes.natanz.integrity).toBe(runB.snap.nodes.natanz.integrity);

    // An Iranian strike against a coalition base goes through the same layered path.
    const iran = new Game();
    iran.start('campaign', 'iran', 21);
    iran.snap.warStarted = true;
    iran.snap.phase = 'war';
    const launcher = iran.snap.units.find((u) => u.faction === 'iran' && u.typeId === 'fateh110')!;
    const base = iran.map.nodeHexOf('al_udeid')!;
    const result = resolveStrike(iran.snap, iran.map, launcher, base.col, base.row, 'al_udeid', constant(0));
    expect(result.events.some((e) => /Air defences/i.test(e.text))).toBe(true);
  });
});
