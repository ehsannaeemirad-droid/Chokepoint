import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { defaultIranDomestic, updateIranDomestic } from './iranDomestic';
import { recordImpact } from './politics';
import { regimeIntact } from './victory';

function usaGame(seed = 63): Game {
  const game = new Game();
  game.start('campaign', 'usa', seed);
  game.snap.warStarted = true;
  game.snap.phase = 'war';
  return game;
}

describe('Iranian domestic state', () => {
  it('has every dimension bounded after an update', () => {
    const game = usaGame();
    updateIranDomestic(game.snap, []);
    const d = game.snap.iranDomestic!;
    for (const value of Object.values(d)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('does not collapse the regime just because Tehran is flattened', () => {
    const game = usaGame();
    game.snap.nodes.tehran.integrity = 0;
    game.snap.meters.iranWarCost = 0;
    game.snap.meters.leadershipStrikes = 0;
    updateIranDomestic(game.snap, []);
    expect(game.snap.iranDomestic!.stability).toBeGreaterThan(25);
  });

  it('erodes stability under a long, costly war', () => {
    const game = usaGame();
    game.snap.meters.iranWarCost = game.snap.meters.iranWarCostThreshold;
    game.snap.meters.populationImpacts = 8;
    for (let i = 0; i < 12; i++) updateIranDomestic(game.snap, []);
    const d = game.snap.iranDomestic!;
    expect(d.economicPressure).toBeGreaterThan(40);
    expect(d.stability).toBeLessThan(defaultIranDomestic().stability);
    expect(d.publicDissatisfaction).toBeGreaterThan(30);
  });

  it('makes regime survival depend on institutions, not only the capital', () => {
    const game = usaGame();
    game.snap.nodes.tehran.integrity = 100;
    game.snap.iranDomestic = { ...defaultIranDomestic(), stability: 10 };
    expect(regimeIntact(game.snap)).toBe(false);
    game.snap.iranDomestic.stability = 70;
    expect(regimeIntact(game.snap)).toBe(true);
  });
});

describe('nuclear escalation is classified, not inferred', () => {
  it('does not count a conventional facility strike as a nuclear-facility strike', () => {
    const game = usaGame();
    const before = game.snap.meters.nuclearFacilityStrikes ?? 0;
    recordImpact(game.snap, game.map, 'bandar_abbas_underground', 1, 'usa');
    expect(game.snap.meters.nuclearFacilityStrikes ?? 0).toBe(before);
    expect(game.snap.meters.nuclearStrikes).toBe(0);

    recordImpact(game.snap, game.map, 'natanz', 1, 'usa');
    expect(game.snap.meters.nuclearFacilityStrikes ?? 0).toBe(before + 1);
    // Attacking a nuclear site is not an operational nuclear weapon.
    expect(game.snap.meters.nuclearStrikes).toBe(0);
  });
});
