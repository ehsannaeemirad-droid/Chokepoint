import { describe, expect, it } from 'vitest';
import { TheaterMap } from '../map/TheaterMap';
import { game } from '../core/Game';
import {
  buildObjectives,
  meterDeltas,
  previewOrderImpact,
} from './objectives';

describe('objectives legibility', () => {
  it('builds player-relative rows for USA with nuclear, war-cost, domestic, and an enemy path', () => {
    game.start('campaign', 'usa', 42);
    const view = buildObjectives(game.snap, game.map);
    expect(view.rows.length).toBeGreaterThanOrEqual(3);
    const ids = view.rows.map((r) => r.id);
    expect(ids).toContain('nuclear_degraded');
    expect(view.rows.some((r) => r.enemy)).toBe(true);
    expect(view.grade).toBeGreaterThanOrEqual(0);
    expect(view.grade).toBeLessThanOrEqual(100);
  });

  it('builds Iranian path rows including oil shock and regime survival', () => {
    game.start('campaign', 'iran', 42);
    const view = buildObjectives(game.snap, game.map);
    const ids = view.rows.map((r) => r.id);
    expect(ids.some((id) => id.includes('regime') || id.includes('oil') || id.includes('noOccupation'))).toBe(
      true,
    );
  });

  it('previewOrderImpact returns deterministic lines for strike and communicate', () => {
    game.start('campaign', 'usa', 7);
    const strike = previewOrderImpact(game.snap, { kind: 'strike' });
    expect(strike.lines.length).toBeGreaterThan(0);
    const comm = previewOrderImpact(game.snap, { kind: 'communicate' });
    expect(comm.lines.some((l) => l.includes('congressional'))).toBe(true);
  });

  it('meterDeltas reports only changed meters', () => {
    game.start('campaign', 'usa', 11);
    const before = structuredClone(game.snap);
    game.snap.meters.iranWarCost += 12;
    game.snap.resources.politicalWill -= 3;
    const deltas = meterDeltas(before, game.snap);
    expect(deltas.find((d) => d.key === 'warCost')?.delta).toBe(12);
    expect(deltas.find((d) => d.key === 'will')?.delta).toBe(-3);
    expect(deltas.every((d) => d.delta !== 0)).toBe(true);
  });

  it('objectives are pure functions of the snapshot (no mutation)', () => {
    game.start('campaign', 'usa', 99);
    const map = new TheaterMap();
    const snap = structuredClone(game.snap);
    const a = buildObjectives(snap, map);
    const b = buildObjectives(snap, map);
    expect(a).toEqual(b);
    expect(snap).toEqual(game.snap);
  });
});
