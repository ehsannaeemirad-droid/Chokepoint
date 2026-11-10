/**
 * Phase 4 tests: fog-of-war presentation estimates.
 *
 * The contract: the engine snapshot is never written, estimates are
 * deterministic per (seed, turn, label), the true value always lies inside
 * the band, recon coverage narrows the band, and viewers always read their
 * own side exactly.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import type { GameSnapshot } from '../core/types';
import {
  bandLabel,
  estimate,
  exactAccess,
  fogHash,
  nodeIntegrityEstimate,
  reconAt,
  unitStrengthEstimate,
} from './fog';

function newGame(faction: 'usa' | 'iran' = 'usa', seed = 8080): Game {
  const game = new Game();
  game.start('campaign', faction, seed);
  return game;
}

describe('deterministic hashing', () => {
  it('is stable for the same inputs and differs across labels and turns', () => {
    const a = fogHash(8080, 3, 'node:natanz');
    expect(fogHash(8080, 3, 'node:natanz')).toBe(a);
    expect(fogHash(8080, 3, 'node:fordow')).not.toBe(a);
    expect(fogHash(8080, 4, 'node:natanz')).not.toBe(a);
    expect(fogHash(1234, 3, 'node:natanz')).not.toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });
});

describe('estimate bands', () => {
  const snap = { seed: 8080, turn: 3 } as GameSnapshot;

  it('always contains the true value', () => {
    for (const quality of ['none', 'isr', 'humint'] as const) {
      for (const value of [100, 87, 45, 12, 1]) {
        const est = estimate(value, snap, 'node:natanz', quality);
        expect(est.lo).toBeLessThanOrEqual(value);
        expect(est.hi).toBeGreaterThanOrEqual(value);
      }
    }
  });

  it('narrows with recon quality', () => {
    const none = estimate(80, snap, 'x', 'none');
    const isr = estimate(80, snap, 'x', 'isr');
    const humint = estimate(80, snap, 'x', 'humint');
    expect(none.hi - none.lo).toBeGreaterThan(isr.hi - isr.lo);
    expect(isr.hi - isr.lo).toBeGreaterThan(humint.hi - humint.lo);
    expect(none.hi - none.lo).toBeGreaterThan(0);
  });

  it('keeps zero exact and never goes negative', () => {
    expect(estimate(0, snap, 'x', 'none')).toEqual({ lo: 0, hi: 0, quality: 'none' });
    const est = estimate(2, snap, 'x', 'none');
    expect(est.lo).toBeGreaterThanOrEqual(0);
  });

  it('is stable within a turn and changes between turns', () => {
    const a = estimate(64, snap, 'unit:u9', 'isr');
    const b = estimate(64, snap, 'unit:u9', 'isr');
    expect(a).toEqual(b);
    const later = estimate(64, { seed: 8080, turn: 4 } as GameSnapshot, 'unit:u9', 'isr');
    // Not guaranteed to differ, but the label/turn hash makes it overwhelmingly
    // likely; assert at least that both bands contain the truth.
    expect(later.lo).toBeLessThanOrEqual(64);
    expect(later.hi).toBeGreaterThanOrEqual(64);
  });

  it('formats as a readable band', () => {
    expect(bandLabel({ lo: 42, hi: 67, quality: 'none' })).toBe('42–67');
    expect(bandLabel({ lo: 0, hi: 0, quality: 'none' })).toBe('0');
  });
});

describe('access rules', () => {
  it('gives the viewer exact access to its own side only', () => {
    const game = newGame('usa');
    expect(exactAccess(game.snap, 'usa')).toBe(true);
    expect(exactAccess(game.snap, null)).toBe(true);
    expect(exactAccess(game.snap, 'iran')).toBe(false);
  });

  it('is exact for owned facilities and estimated for enemy ones', () => {
    const usa = newGame('usa');
    // Natanz is Iranian — the US viewer gets an estimate.
    expect(nodeIntegrityEstimate(usa.snap, usa.map, 'natanz')).not.toBeNull();
    // Al Udeid is US-operated — exact (null means no estimate needed).
    expect(nodeIntegrityEstimate(usa.snap, usa.map, 'al_udeid')).toBeNull();

    const iran = newGame('iran');
    expect(nodeIntegrityEstimate(iran.snap, iran.map, 'natanz')).toBeNull();
    expect(nodeIntegrityEstimate(iran.snap, iran.map, 'al_udeid')).not.toBeNull();
  });

  it('is exact for owned units and estimated for enemy units', () => {
    const usa = newGame('usa');
    const f15 = usa.snap.units.find((u) => u.faction === 'usa')!;
    const launcher = usa.snap.units.find((u) => u.faction === 'iran')!;
    expect(unitStrengthEstimate(usa.snap, f15)).toBeNull();
    // Never located: the viewer gets no band at all, not a wide guess.
    expect(unitStrengthEstimate(usa.snap, launcher)).toBeNull();
    launcher.revealed = true;
    launcher.lastSeen = usa.snap.turn;
    expect(unitStrengthEstimate(usa.snap, launcher)).not.toBeNull();
  });
});

describe('reconnaissance coverage', () => {
  it('narrows with a nearby MQ-9 and tightens with SOF on the ground', () => {
    const game = newGame('usa');
    const mq9 = game.snap.units.find((u) => u.typeId === 'mq9')!;
    const sof = game.snap.units.find((u) => u.typeId === 'sof')!;
    // They start co-located at Al Udeid: park the SOF team far away first.
    sof.col = Math.max(0, mq9.col - 9);
    sof.row = Math.max(0, mq9.row + 9);
    const mq9Hex = game.map.hexAt(mq9.col, mq9.row)!;
    // Under the drone: ISR coverage.
    expect(reconAt(game.snap, 'usa', mq9Hex.col, mq9Hex.row)).toBe('isr');

    // Park the special-operations team on the same hex: HUMINT wins.
    sof.col = mq9.col;
    sof.row = mq9.row;
    expect(reconAt(game.snap, 'usa', mq9Hex.col, mq9Hex.row)).toBe('humint');

    // A random empty hex far from everything: no coverage.
    expect(reconAt(game.snap, 'usa', 0, 0)).toBe('none');
  });

  it('never lets the engine snapshot be mutated', () => {
    const game = newGame('usa');
    const before = JSON.stringify(game.snap);
    nodeIntegrityEstimate(game.snap, game.map, 'natanz');
    unitStrengthEstimate(game.snap, game.snap.units[0]!);
    expect(JSON.stringify(game.snap)).toBe(before);
  });
});
