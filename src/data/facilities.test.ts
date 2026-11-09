/**
 * Phase 1a: facility taxonomy invariants.
 *
 * These tests pin the separation the brief demands: nuclear sites enrich,
 * convert or store, and never assemble munitions; missile industry sites carry
 * provenance; production is gated on intact facilities of the right category.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { MAP_NODES } from '../map/TheaterMap';
import { hasProductionCapacity, lineForMunition, productionSites } from '../core/production';

function node(id: string) {
  const found = MAP_NODES.find((n) => n.id === id);
  if (!found) throw new Error(`missing node ${id}`);
  return found;
}

const NUCLEAR_FACILITIES = new Set(['nuclear-enrichment', 'nuclear-conversion', 'nuclear-storage']);

describe('facility taxonomy', () => {
  it('keeps nuclear facilities out of munition production', () => {
    for (const entry of MAP_NODES) {
      if (!entry.facility || !NUCLEAR_FACILITIES.has(entry.facility)) continue;
      expect(entry.productionLines ?? []).toEqual([]);
    }
  });

  it('drops the old conflated production field', () => {
    for (const entry of MAP_NODES) {
      expect('production' in entry).toBe(false);
    }
  });

  it('classifies the enrichment and conversion sites by what they do', () => {
    expect(node('natanz').facility).toBe('nuclear-enrichment');
    expect(node('fordow').facility).toBe('nuclear-enrichment');
    expect(node('isfahan').facility).toBe('nuclear-conversion');
    expect(node('isfahan').productionLines).toBeUndefined();
    expect(node('natanz').productionLines).toBeUndefined();
    expect(node('fordow').productionLines).toBeUndefined();
  });

  it('carries the missile-industry sites with provenance', () => {
    for (const id of ['khojir', 'parchin', 'shahroud']) {
      const entry = node(id);
      expect(entry.kind).toBe('missile-industry');
      expect(entry.facility === 'missile-production' || entry.facility === 'weapons-storage').toBe(true);
      expect((entry.provenance ?? '').length).toBeGreaterThan(20);
    }
    expect(node('khojir').productionLines).toContain('missile');
    expect(node('khojir').productionLines).toContain('drone');
  });

  it('gives every production site a facility and at least one line', () => {
    for (const entry of MAP_NODES) {
      if (!entry.productionLines) continue;
      expect(entry.facility).toBeTruthy();
      expect(entry.productionLines.length).toBeGreaterThan(0);
    }
  });

  it('maps munitions to their production line', () => {
    expect(lineForMunition('shahed136')).toBe('drone');
    expect(lineForMunition('fateh110')).toBe('missile');
    expect(lineForMunition('khorramshahr')).toBe('missile');
  });
});

describe('production gating', () => {
  it('counts only intact facilities of the requested line', () => {
    const game = new Game();
    game.start('campaign', 'iran', 7);

    expect(hasProductionCapacity(MAP_NODES, game.snap, 'missile')).toBe(true);
    expect(hasProductionCapacity(MAP_NODES, game.snap, 'drone')).toBe(true);

    for (const entry of MAP_NODES) {
      if (!entry.productionLines?.includes('missile')) continue;
      game.snap.nodes[entry.id]!.integrity = 0;
    }
    expect(hasProductionCapacity(MAP_NODES, game.snap, 'missile')).toBe(false);
    expect(productionSites(MAP_NODES, game.snap, 'missile')).toEqual([]);
    // The drone line is untouched.
    expect(hasProductionCapacity(MAP_NODES, game.snap, 'drone')).toBe(true);
  });

  it('rejects an Iranian production order once the line is destroyed', () => {
    const game = new Game();
    game.start('campaign', 'iran', 11);
    for (const entry of MAP_NODES) {
      if (!entry.productionLines?.includes('missile')) continue;
      game.snap.nodes[entry.id]!.integrity = 0;
    }
    const check = game.queueOrder({
      kind: 'produce',
      unitTypeId: 'fateh110',
      count: 1,
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/production line/i);
  });
});
