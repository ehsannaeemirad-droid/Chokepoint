/**
 * Improvement 6: rules-of-engagement posture presets.
 *
 * A posture is national policy for the coalition the player commands: it
 * gates targeting (constrained forbids city strikes), scales coalition strike
 * damage, scales the escalation signature of coalition strikes on Iran, and
 * drifts two slow dials (congressional support, host-nation threat).
 * Deterministic throughout.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { validateOrder } from '../core/engine';
import { DEFAULT_ROE_CFG, activeRoe, roeBlocksStrike, roeDamageMultiplier, roeEscalationMultiplier, roeEffectsText, updateRoe } from './roe';
import { resolveStrike, validateStrike } from '../combat/combat';

describe('ROE order plumbing', () => {
  it('queues a posture change, logs the full effects package, and applies it', () => {
    const game = new Game();
    game.start('campaign', 'usa', 9090);
    const check = validateOrder(game.snap, game.map, { kind: 'roe', posture: 'aggressive' });
    expect(check.ok).toBe(true);
    game.queueOrder({ kind: 'roe', posture: 'aggressive' });
    const events = game.endTurn().events;

    expect(game.snap.roe!.posture).toBe('aggressive');
    const line = events.find((e) => e.text.startsWith('Rules of engagement set to AGGRESSIVE'));
    expect(line?.text).toContain('+15%');
    expect(line?.text).toContain('×1.5');
    expect(line?.text).toContain('−1/turn');
    expect(line?.text).toContain('host-nation threat +1/turn');
  });

  it('rejects the ROE order for Iran and same-posture re-sets', () => {
    const iran = new Game();
    iran.start('campaign', 'iran', 9090);
    const iranCheck = validateOrder(iran.snap, iran.map, { kind: 'roe', posture: 'aggressive' });
    expect(iranCheck.ok).toBe(false);

    const usa = new Game();
    usa.start('campaign', 'usa', 9090);
    usa.snap.roe!.posture = 'aggressive';
    const same = validateOrder(usa.snap, usa.map, { kind: 'roe', posture: 'aggressive' });
    expect(same.ok).toBe(false);
    expect(same.reason).toContain('already');
  });
});

describe('constrained targeting', () => {
  it('forbids coalition strikes on Iranian cities and says why', () => {
    const game = new Game();
    game.start('campaign', 'usa', 9090);
    game.snap.roe!.posture = 'constrained';
    const b2 = game.snap.units.find((u) => u.typeId === 'b2')!;
    const tehran = game.map.nodeHexOf('tehran')!;
    const result = validateStrike(game.snap, game.map, b2, tehran.col, tehran.row, 'tehran');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Rules of engagement');
  });

  it('still allows nuclear-site and military targets under constrained', () => {
    const game = new Game();
    game.start('campaign', 'usa', 9090);
    game.snap.roe!.posture = 'constrained';
    const b2 = game.snap.units.find((u) => u.typeId === 'b2')!;
    const natanz = game.map.nodeHexOf('natanz')!;
    expect(validateStrike(game.snap, game.map, b2, natanz.col, natanz.row, 'natanz').ok).toBe(true);
  });

  it('never binds Iranian targeting', () => {
    const game = new Game();
    game.start('campaign', 'iran', 9090);
    game.snap.roe!.posture = 'constrained';
    expect(roeBlocksStrike(game.snap, 'iran', { host: 'iran', kind: 'urban' } as never)).toBe(null);
  });
});

describe('damage and escalation multipliers', () => {
  it('aggressive posture hits harder on the same seeded roll', () => {
    const base = new Game();
    base.start('campaign', 'usa', 1717);
    const hard = new Game();
    hard.start('campaign', 'usa', 1717);
    hard.snap.roe!.posture = 'aggressive';

    for (const game of [base, hard]) {
      const f35 = game.snap.units.find((u) => u.typeId === 'f35a')!;
      const natanz = game.map.nodeHexOf('natanz')!;
      resolveStrike(game.snap, game.map, f35, natanz.col, natanz.row, 'natanz', () => 0.99);
    }
    const a = base.snap.nodes.natanz!.integrity;
    const b = hard.snap.nodes.natanz!.integrity;
    expect(b).toBeLessThan(a); // more damage done under aggressive
  });

  it('scales the escalation signature of coalition strikes on Iran', () => {
    const game = new Game();
    game.start('campaign', 'usa', 1717);
    game.snap.roe!.posture = 'constrained';
    expect(roeEscalationMultiplier(game.snap, 'usa')).toBeCloseTo(0.5, 5);
    expect(roeEscalationMultiplier(game.snap, 'iran')).toBe(1);
    game.snap.roe = undefined; // snapshots without the block are untouched
    expect(roeEscalationMultiplier(game.snap, 'usa')).toBe(1);
    game.snap.roe = { posture: 'standard' };
    expect(roeDamageMultiplier(game.snap, 'israel')).toBe(1);
    expect(activeRoe(game.snap)).toEqual(DEFAULT_ROE_CFG.standard);
  });
});

describe('per-turn posture drift', () => {
  it('moves congress and host threat per the posture, once per turn', () => {
    const game = new Game();
    game.start('campaign', 'usa', 9090);
    game.snap.roe!.posture = 'aggressive';
    const congress = game.snap.domestic!.congress;
    const qatar = game.snap.hosts.qatar.threat;

    updateRoe(game.snap, []);
    expect(game.snap.domestic!.congress).toBe(congress - 1);
    expect(game.snap.hosts.qatar.threat).toBe(qatar + 1);

    game.snap.roe!.posture = 'constrained';
    const c2 = game.snap.domestic!.congress;
    updateRoe(game.snap, []);
    expect(game.snap.domestic!.congress).toBe(c2 + 1);
    // constrained has hostThreatPerTurn 0 — unchanged this call
  });

  it('the effects text describes every non-default dial', () => {
    const game = new Game();
    game.start('campaign', 'usa', 9090);
    game.snap.roe!.posture = 'constrained';
    const text = roeEffectsText(activeRoe(game.snap)) as string;
    expect(text).toContain('−10%');
    expect(text).toContain('×0.5');
    expect(text).toContain('forbidden');
    expect(text).toContain('+1/turn');
  });
});
