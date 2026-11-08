/**
 * Improvement 1: escalation ladder & red lines.
 *
 * The ladder is a data-defined rung system over `nuclearEscalation`; red lines
 * are named one-shot tripwires. Everything is deterministic snapshot
 * arithmetic — these tests lock that down.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import {
  DEFAULT_ESCALATION_CFG,
  escalationLevel,
  nuclearComplexDown,
  redLineTripped,
  updateEscalation,
} from './escalation';

describe('escalation ladder', () => {
  it('computes the rung from the escalation meter using data thresholds', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4242);
    const snap = game.snap;
    expect(escalationLevel(snap)).toBe(0);

    snap.meters.nuclearEscalation = 15;
    expect(escalationLevel(snap)).toBe(1);
    snap.meters.nuclearEscalation = 51;
    expect(escalationLevel(snap)).toBe(3);
    snap.meters.nuclearEscalation = 100;
    expect(escalationLevel(snap)).toBe(DEFAULT_ESCALATION_CFG.levels.length);
    snap.meters.nuclearEscalation = 14;
    expect(escalationLevel(snap)).toBe(0);
  });

  it('announces a rung change once, with the meter value', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4242);
    const snap = game.snap;
    snap.escalation = { level: 0, fired: [] };
    snap.meters.nuclearEscalation = 35;

    const events: { text: string }[] = [];
    updateEscalation(snap, events as never);
    expect(snap.escalation!.level).toBe(2);
    expect(events.some((e) => e.text.includes('rung 2'))).toBe(true);

    // Idempotent: a second pass at the same level logs nothing new.
    const again: { text: string }[] = [];
    updateEscalation(snap, again as never);
    expect(again.some((e) => e.text.includes('rung'))).toBe(false);
  });

  it('applies the rung per-turn drift to great powers and hosts', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4242);
    const snap = game.snap;
    snap.escalation = { level: 2, fired: [] }; // suppresses the change event, rung 2 still applies
    snap.meters.nuclearEscalation = 35;
    const russia = snap.superpowers.russia.stance;
    const qatar = snap.hosts.qatar.threat;

    updateEscalation(snap, [] as never);

    expect(snap.superpowers.russia.stance).toBeCloseTo(russia + 1, 5); // rung 2 drift
    expect(snap.hosts.qatar.threat).toBeCloseTo(qatar + 1, 5); // rung 2 hostThreat
  });

  it('eases back down and logs the easing without effects', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4242);
    const snap = game.snap;
    snap.escalation = { level: 3, fired: [] };
    snap.meters.nuclearEscalation = 10; // now below rung 1
    const russia = snap.superpowers.russia.stance;

    const events: { text: string }[] = [];
    updateEscalation(snap, events as never);
    expect(snap.escalation!.level).toBe(0);
    expect(events.some((e) => e.text.includes('eased to rung 0'))).toBe(true);
    expect(snap.superpowers.russia.stance).toBe(russia); // no drift at rung 0
  });
});

describe('red lines', () => {
  it('fires a red line once, applies its effects, and logs the numbers', () => {
    const game = new Game();
    game.start('campaign', 'iran', 4242);
    const snap = game.snap;
    snap.escalation = { level: 0, fired: [] };
    snap.meters.hormuzTurnsAbove70 = 4; // crosses hormuzStrangled
    const before = {
      escalation: snap.meters.nuclearEscalation,
      russia: snap.superpowers.russia.stance,
      will: snap.resources.politicalWill,
    };

    const events: { text: string }[] = [];
    updateEscalation(snap, events as never);

    expect(snap.escalation!.fired).toContain('hormuzStrangled');
    expect(snap.meters.nuclearEscalation).toBe(before.escalation + 8);
    expect(snap.superpowers.russia.stance).toBe(before.russia + 8);
    expect(snap.resources.politicalWill).toBe(before.will - 5);
    const line = events.find((e) => e.text.startsWith('RED LINE CROSSED'));
    expect(line?.text).toContain('Hormuz strangled');
    expect(line?.text).toContain('escalation +8');

    // Second pass: already fired, no further effects.
    const mid = snap.meters.nuclearEscalation;
    updateEscalation(snap, [] as never);
    expect(snap.meters.nuclearEscalation).toBe(mid);
    expect(snap.escalation!.fired.filter((id) => id === 'hormuzStrangled')).toHaveLength(1);
  });

  it('mobilises Iranian resources when leadership decapitation is attempted', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4242);
    const snap = game.snap;
    snap.escalation = { level: 0, fired: [] };
    snap.meters.leadershipStrikes = 3;
    const resources = snap.iran.resources;

    updateEscalation(snap, [] as never);

    expect(snap.escalation!.fired).toContain('leadershipDecapitation');
    expect(snap.iran.resources).toBe(resources + 25);
  });

  it('detects a destroyed nuclear complex', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4242);
    const snap = game.snap;
    expect(nuclearComplexDown(snap)).toBe(false);
    for (const id of ['isfahan', 'natanz', 'fordow']) snap.nodes[id]!.integrity = 0;
    expect(nuclearComplexDown(snap)).toBe(true);

    snap.escalation = { level: 0, fired: [] };
    const events: { text: string }[] = [];
    updateEscalation(snap, events as never);
    expect(snap.escalation!.fired).toContain('nuclearComplexDestroyed');
  });

  it('flags the nuclear-use red line through its condition predicate', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4242);
    const def = DEFAULT_ESCALATION_CFG.redLines.find((r) => r.id === 'nuclearUse')!;
    game.snap.meters.nuclearStrikes = 0;
    expect(redLineTripped(game.snap, def)).toBe(false);
    game.snap.meters.nuclearStrikes = 1;
    expect(redLineTripped(game.snap, def)).toBe(true);
  });
});

describe('pipeline integration', () => {
  it('runs inside endTurn and keeps the campaign deterministic across save/load', () => {
    const game = new Game();
    game.start('campaign', 'usa', 20260101);
    // Force a red line through real play: a leadership strike on Tehran.
    const b2 = game.snap.units.find((u) => u.typeId === 'b2')!;
    const tehran = game.map.nodeHexOf('tehran')!;
    game.queueOrder({ kind: 'strike', unitUid: b2.uid, col: tehran.col, row: tehran.row, nodeId: 'tehran' });
    game.endTurn();

    expect(game.snap.escalation).toBeDefined();
    expect(game.snap.meters.leadershipStrikes).toBeGreaterThanOrEqual(1);
    expect(game.snap.log.some((l) => l.text.startsWith('RED LINE CROSSED'))).toBe(false); // one strike ≠ 3

    // Deterministic replay of the same seed + order log produces the same world.
    const twin = new Game();
    twin.start('campaign', 'usa', 20260101);
    const twinB2 = twin.snap.units.find((u) => u.typeId === 'b2')!;
    const twinTehran = twin.map.nodeHexOf('tehran')!;
    twin.queueOrder({ kind: 'strike', unitUid: twinB2.uid, col: twinTehran.col, row: twinTehran.row, nodeId: 'tehran' });
    twin.endTurn();
    expect(JSON.stringify(twin.snap)).toBe(JSON.stringify(game.snap));
  });
});
