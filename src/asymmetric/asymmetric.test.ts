import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { BALANCE } from '../core/config';
import type { AsymmetricActionId } from '../core/types';
import { asymmetricOutcome, ASYMMETRIC_START } from './model';
import { buildTurnReview } from '../ui/review';

function asymmetric(seed = 7): Game {
  const game = new Game();
  game.start('asymmetric', 'iran', seed);
  return game;
}

describe('asymmetric campaign prototype', () => {
  it('starts with the six political meters and leaves the classic campaigns untouched', () => {
    const game = asymmetric();
    expect(game.snap.mode).toBe('asymmetric');
    expect(game.snap.asymmetric?.meters).toEqual(ASYMMETRIC_START);
    expect(game.snap.victory).toBeNull();

    const classic = new Game();
    classic.start('campaign', 'usa', 7);
    expect(classic.snap.mode).toBeUndefined();
    expect(classic.snap.asymmetric).toBeUndefined();
  });

  it('queues one guerrilla action per turn and spends its resource cost', () => {
    const game = asymmetric();
    const before = game.snap.iran.resources;
    expect(game.queueOrder({ kind: 'asymmetric', action: 'proxy' }).ok).toBe(true);
    expect(game.snap.iran.resources).toBe(before);

    const second = game.queueOrder({ kind: 'asymmetric', action: 'strike' });
    expect(second.ok).toBe(false);
    expect(second.code).toBe('asym-one-action');

    const review = buildTurnReview(game.snap, game.map);
    expect(review.orders[0]!.label).toBeTruthy();
    expect(review.spending.some((row) => row.value === '−2')).toBe(true);

    game.endTurn();
    expect(game.snap.status).toBe('playing');
    expect(game.snap.iran.resources).toBe(before - 2 + BALANCE.iranResourceIncome);
    expect(game.snap.asymmetric?.lastAction).toBe('proxy');
  });

  it('does not allow the prototype action in a classic Iran campaign', () => {
    const game = new Game();
    game.start('campaign', 'iran', 7);
    const result = game.queueOrder({ kind: 'asymmetric', action: 'proxy' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('asym-mode-only');
  });

  it('trades cost for attribution and lets denial bring exposure down', () => {
    const game = asymmetric();
    game.snap.asymmetric!.meters.attribution = 30;
    game.snap.asymmetric!.meters.escalation = 40;
    game.queueOrder({ kind: 'asymmetric', action: 'deny' });
    game.endTurn();

    const meters = game.snap.asymmetric!.meters;
    expect(meters.attribution).toBeLessThan(30);
    expect(meters.escalation).toBeLessThan(40);
  });

  it('wins politically at high enemy cost with a stable, legitimate regime', () => {
    const game = asymmetric();
    const meters = game.snap.asymmetric!.meters;
    meters.enemyCost = 68;
    meters.stability = 60;
    meters.support = 60;
    meters.legitimacy = 60;
    meters.attribution = 20;
    meters.escalation = 20;

    game.queueOrder({ kind: 'asymmetric', action: 'proxy' });
    game.endTurn();

    expect(game.snap.status).toBe('won');
    expect(game.snap.outcome).toContain('Political victory');
  });

  it('loses the regime when attribution and escalation cross the catastrophe line', () => {
    const game = asymmetric();
    const meters = game.snap.asymmetric!.meters;
    meters.attribution = 85;
    meters.escalation = 85;

    game.endTurn();

    expect(game.snap.status).toBe('lost');
    expect(game.snap.asymmetric?.catastrophic).toBe(true);
  });

  it('resolves a survival victory at the end of the clock', () => {
    const game = asymmetric();
    const meters = game.snap.asymmetric!.meters;
    meters.stability = 50;
    game.snap.turn = game.snap.maxTurns;

    game.endTurn();

    expect(game.snap.status).toBe('won');
    expect(game.snap.outcome).toContain('Survival victory');
    expect(asymmetricOutcome(game.snap).status).toBe('won');
  });

  it('can reach a political victory through play rather than only an edited state', () => {
    const game = asymmetric(42);
    while (game.snap.status === 'playing' && game.snap.turn <= game.snap.maxTurns) {
      const m = game.snap.asymmetric!.meters;
      let action: AsymmetricActionId = 'proxy';
      if (m.attribution >= 40) action = 'deny';
      else if (m.legitimacy < 48) action = 'propaganda';
      else if (m.stability < 50) action = 'consolidate';
      game.queueOrder({ kind: 'asymmetric', action });
      game.endTurn();
    }
    expect(game.snap.status).toBe('won');
    expect(game.snap.outcome).toContain('Political victory');
  });

  it('finishes a full 24-turn run without leaving the prototype in play', () => {
    const game = asymmetric(99);
    while (game.snap.status === 'playing' && game.snap.turn <= game.snap.maxTurns) {
      game.endTurn();
    }
    expect(game.snap.status).not.toBe('playing');
    expect(game.snap.turn).toBeLessThanOrEqual(game.snap.maxTurns);
  });
});
