import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import {
  defenceNetwork,
  abstractDefenceFactor,
  networkConfidence,
  NETWORK_ATTRIBUTES,
  ABSTRACT_REFERENCE,
} from './defenceNetwork';

function start(faction: 'usa' | 'israel' | 'iran'): Game {
  const game = new Game();
  game.start('campaign', faction, 314159);
  return game;
}

describe('defence network', () => {
  it('reports every attribute in range and a composite effectiveness', () => {
    const game = start('usa');
    const net = defenceNetwork(game.snap, game.map, 'usa');
    for (const key of NETWORK_ATTRIBUTES) {
      expect(net[key]).toBeGreaterThanOrEqual(0);
      expect(net[key]).toBeLessThanOrEqual(1);
    }
    expect(net.effectiveness).toBeGreaterThan(0);
    expect(net.effectiveness).toBeLessThanOrEqual(1);
    expect(net.interceptorPool).toBe(Math.round(game.snap.resources.interceptorsUSA));
  });

  it('loses early warning when a radar node is destroyed', () => {
    const game = start('usa');
    const before = defenceNetwork(game.snap, game.map, 'usa');
    const radar = game.map.nodes.find((n) => n.facility === 'radar' && n.operators.includes('usa'));
    expect(radar).toBeTruthy();
    game.snap.nodes[radar!.id]!.integrity = 0;
    const after = defenceNetwork(game.snap, game.map, 'usa');
    expect(after.earlyWarning).toBeLessThan(before.earlyWarning);
  });

  it('loses coordination while a sensor is suppressed', () => {
    const game = start('usa');
    const radar = game.map.nodes.find((n) => n.facility === 'radar' && n.operators.includes('usa'))!;
    game.snap.adSuppression = { [radar.id]: game.snap.turn + 1 };
    const net = defenceNetwork(game.snap, game.map, 'usa');
    expect(net.coordination).toBeLessThan(1);
    expect(net.effectiveness).toBeLessThan(defenceNetwork(start('usa').snap, game.map, 'usa').effectiveness);
  });

  it('reads an empty interceptor pool as zero availability', () => {
    const game = start('usa');
    game.snap.resources.interceptorsUSA = 0;
    const net = defenceNetwork(game.snap, game.map, 'usa');
    expect(net.interceptors).toBe(0);
    expect(net.effectiveness).toBeLessThan(0.9);
  });

  it('treats Iran as an abstract system without an interceptor pool', () => {
    const game = start('usa');
    const net = defenceNetwork(game.snap, game.map, 'iran');
    expect(net.interceptorPool).toBeNull();
    expect(net.effectiveness).toBeGreaterThan(0);
  });

  it('marks batteries suppressed this turn as not ready', () => {
    const game = start('usa');
    const battery = game.snap.units.find(
      (u) => u.faction === 'usa' && (u.typeId === 'patriot' || u.typeId === 'thaad'),
    );
    expect(battery).toBeTruthy();
    const before = defenceNetwork(game.snap, game.map, 'usa');
    battery!.suppressedUntilTurn = game.snap.turn + 1;
    const after = defenceNetwork(game.snap, game.map, 'usa');
    expect(after.readyUnits).toBe(before.readyUnits - 1);
    expect(after.readiness).toBeLessThanOrEqual(before.readiness);
  });
});

describe('abstract defence factor', () => {
  it('is exactly 1 for a fully working network and bottoms out at 0.6', () => {
    const full = defenceNetwork(start('iran').snap, start('iran').map, 'iran');
    expect(abstractDefenceFactor({ ...full, effectiveness: 1 })).toBeCloseTo(1, 6);
    expect(abstractDefenceFactor({ ...full, effectiveness: 0 })).toBeCloseTo(0.6, 6);
  });

  it('leaves the opening turn exactly as it was', () => {
    const game = start('iran');
    const net = defenceNetwork(game.snap, game.map, 'iran');
    // Anything at or above the reference defends at the old probability.
    expect(abstractDefenceFactor(net)).toBeCloseTo(1, 6);
    expect(net.effectiveness).toBeGreaterThanOrEqual(ABSTRACT_REFERENCE);
  });

  it('degrades below the reference but never below 0.6', () => {
    const net = defenceNetwork(start('iran').snap, start('iran').map, 'iran');
    const degraded = abstractDefenceFactor({ ...net, effectiveness: ABSTRACT_REFERENCE / 2 });
    expect(degraded).toBeLessThan(1);
    expect(degraded).toBeGreaterThanOrEqual(0.6);
  });

  it('degrades a unit-based network as its batteries are suppressed', () => {
    const game = start('usa');
    const before = defenceNetwork(game.snap, game.map, 'usa').effectiveness;
    for (const unit of game.snap.units) {
      if (unit.faction === 'usa') unit.suppressedUntilTurn = game.snap.turn + 1;
    }
    expect(defenceNetwork(game.snap, game.map, 'usa').effectiveness).toBeLessThan(before);
  });
});

describe('network confidence', () => {
  it('is confirmed for your own network and uncertain without reconnaissance', () => {
    const game = start('usa');
    expect(networkConfidence(game.snap, 'usa', 'none')).toBe('confirmed');
    expect(networkConfidence(game.snap, 'iran', 'none')).toBe('uncertain');
    expect(networkConfidence(game.snap, 'iran', 'isr')).toBe('assessed');
    expect(networkConfidence(game.snap, 'iran', 'humint')).toBe('uncertain');
  });
});
