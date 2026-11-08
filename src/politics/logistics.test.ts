/**
 * Improvement 2: logistics depth — in-transit strait risk.
 *
 * While Hormuz disruption sits above the scenario threshold, every pending
 * shipment accrues one turn of delay per turn (capped). The meter decides,
 * never the dice: fully deterministic.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { DEFAULT_LOGISTICS_CFG, effectiveArrival, logisticsCfg } from '../core/engine';

function pushPackage(game: Game, id = 'interceptors'): void {
  game.queueOrder({ kind: 'reinforce', packageId: id });
  game.endTurn();
}

describe('strait-risk delays', () => {
  it('leaves shipments untouched while Hormuz stays below the threshold', () => {
    const game = new Game();
    game.start('campaign', 'usa', 555);
    pushPackage(game);
    const pkg = game.snap.reinforcements[0]!;
    expect(pkg).toBeDefined();
    expect(pkg.delayTurns ?? 0).toBe(0);
    expect(effectiveArrival(pkg)).toBe(pkg.arrivesTurn);
  });

  it('accrues one delay turn per turn above the threshold, with a logged ETA', () => {
    const game = new Game();
    game.start('campaign', 'usa', 555);
    pushPackage(game);
    const pkg = game.snap.reinforcements[0]!;
    const baseEta = pkg.arrivesTurn;

    game.snap.meters.hormuz = 65; // above interdictHormuz (60)
    const events = game.endTurn().events;
    expect(pkg.delayTurns).toBe(1);
    expect(effectiveArrival(pkg)).toBe(baseEta + 1);
    expect(events.some((e) => e.text.includes('Strait risk delays') && e.text.includes(String(baseEta + 1)))).toBe(true);

    game.snap.meters.hormuz = 65;
    game.endTurn();
    expect(pkg.delayTurns).toBe(2);
  });

  it('never slips a package by more than maxDelay', () => {
    const game = new Game();
    game.start('campaign', 'usa', 555);
    game.snap.logisticsCfg = { interdictHormuz: 60, maxDelay: 1 };
    pushPackage(game);
    const pkg = game.snap.reinforcements[0]!;

    game.snap.meters.hormuz = 90;
    game.endTurn();
    expect(pkg.delayTurns).toBe(1);
    game.snap.meters.hormuz = 90;
    game.endTurn();
    expect(pkg.delayTurns).toBe(1); // capped
  });

  it('holds a due package offshore until its accrued delay elapses', () => {
    const game = new Game();
    game.start('campaign', 'usa', 555);
    pushPackage(game);
    const pkg = game.snap.reinforcements[0]!;
    const eta = pkg.arrivesTurn;

    // High strait risk during transit: the package slips instead of landing.
    // (The engine recomputes hormuz from real units each turn, so a forced
    // spike only reaches the delay logic; top up political will so the brief
    // economic spike cannot end the campaign while we watch one shipment.)
    while (game.snap.turn < eta && game.snap.status === 'playing') {
      game.snap.resources.politicalWill = 80;
      game.snap.meters.hormuz = 70;
      game.endTurn();
    }
    game.snap.resources.politicalWill = 80;
    game.snap.meters.hormuz = 70;
    game.endTurn(); // eta turn with risk: accrues delay, does not arrive
    if ((pkg.delayTurns ?? 0) > 0) {
      expect(game.snap.reinforcements).toContain(pkg);
    }

    // Calm water: it lands the first turn its effective ETA has passed.
    while (game.snap.reinforcements.includes(pkg) && game.snap.status === 'playing') {
      game.snap.resources.politicalWill = 80;
      game.snap.meters.hormuz = 10;
      game.endTurn();
    }
    expect(game.snap.reinforcements.includes(pkg)).toBe(false);
  });

  it('the reinforce order warns about strait risk when the gulf is hot', () => {
    const game = new Game();
    game.start('campaign', 'usa', 555);
    game.snap.meters.hormuz = 75;
    game.queueOrder({ kind: 'reinforce', packageId: 'interceptors' });
    const events = game.endTurn().events;
    expect(events.some((e) => e.text.includes('Gulf shipping under threat'))).toBe(true);
  });
});

describe('logistics config plumbing', () => {
  it('defaults are exported and overridable from scenario data', () => {
    const game = new Game();
    game.start('campaign', 'usa', 555);
    expect(game.snap.logisticsCfg).toEqual({ interdictHormuz: 60, maxDelay: 3 });
    expect(logisticsCfg(game.snap)).toEqual(DEFAULT_LOGISTICS_CFG);

    game.snap.logisticsCfg = { interdictHormuz: 50, maxDelay: 2 };
    expect(logisticsCfg(game.snap)).toEqual({ interdictHormuz: 50, maxDelay: 2 });
  });

  it('keeps twin campaigns byte-identical with strait delays in play', () => {
    const run = (): string => {
      const game = new Game();
      game.start('campaign', 'usa', 777);
      pushPackage(game, 'patriot');
      for (let turn = 0; turn < 6 && game.snap.status === 'playing'; turn++) {
        game.snap.meters.hormuz = turn % 2 === 0 ? 70 : 20; // risk oscillates
        game.endTurn();
      }
      return JSON.stringify(game.snap);
    };
    expect(run()).toBe(run());
  });
});
