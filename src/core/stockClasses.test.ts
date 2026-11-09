/**
 * Phase 2 item 5: class-specific stock consumption (mdf.md §18-§19).
 *
 * Each weapon class draws only on its own mated rounds and its own launcher
 * pool, and production mates rounds of the class it built. No class silently
 * borrows another class's stock.
 */
import { describe, expect, it } from 'vitest';
import { Game } from './Game';
import {
  ARSENAL_UNCERTAINTY_PCT,
  DELIVERY_CLASSES,
  DELIVERY_CLASS_INFO,
  deliverMatedRounds,
  spendIranRounds,
} from './inventory';

function iran(seed = 5): Game {
  const game = new Game();
  game.start('campaign', 'iran', seed);
  return game;
}

describe('iranian stock classes', () => {
  it('declares the §18 taxonomy and flags Fattah as contested', () => {
    expect(DELIVERY_CLASSES).toEqual(['drone', 'fateh', 'khorramshahr', 'fattah', 'asm']);
    for (const cls of DELIVERY_CLASSES) expect(DELIVERY_CLASS_INFO[cls].taxonomy.length).toBeGreaterThan(0);
    expect(DELIVERY_CLASS_INFO.fattah.contested).toBe(true);
    expect(ARSENAL_UNCERTAINTY_PCT.fattah).toBeGreaterThan(ARSENAL_UNCERTAINTY_PCT.khorramshahr);
  });

  it('spends only the firing class and counts the shared ballistic pool', () => {
    const game = iran();
    game.snap.iran.rounds = { drone: 3, fateh: 3, khorramshahr: 3, fattah: 2, asm: 2 };
    game.snap.iran.launchers.ballistic = 5;
    game.snap.iran.launchers.usedBallistic = 0;
    const fired = spendIranRounds(game.snap, 'fateh', 2);
    expect(fired).toBe(2);
    expect(game.snap.iran.rounds.fateh).toBe(1);
    expect(game.snap.iran.rounds.khorramshahr).toBe(3);
    expect(game.snap.iran.rounds.fattah).toBe(2);
    expect(game.snap.iran.rounds.asm).toBe(2);
    expect(game.snap.iran.launchers.usedBallistic).toBe(2);
    expect(game.snap.iran.launchers.usedDrone).toBe(0);
  });

  it('keeps drone sorties separate from the ballistic pool', () => {
    const game = iran();
    game.snap.iran.rounds.drone = 2;
    game.snap.iran.rounds.fateh = 2;
    game.snap.iran.launchers.drone = 0;
    game.snap.iran.launchers.usedDrone = 0;
    expect(spendIranRounds(game.snap, 'drone', 1)).toBe(0);
    expect(game.snap.iran.rounds.drone).toBe(2);
    expect(spendIranRounds(game.snap, 'fateh', 1)).toBe(1);
  });

  it('anti-ship rounds are their own class on the ballistic launcher pool', () => {
    const game = iran();
    game.snap.iran.rounds.asm = 2;
    game.snap.iran.rounds.fateh = 5;
    expect(spendIranRounds(game.snap, 'asm', 1)).toBe(1);
    expect(game.snap.iran.rounds.asm).toBe(1);
    expect(game.snap.iran.rounds.fateh).toBe(5);
    expect(DELIVERY_CLASS_INFO.asm.launcherPool).toBe('ballistic');
  });

  it('production mates only the class it built', () => {
    const game = iran();
    const before = { ...game.snap.iran.rounds };
    game.snap.iran.airframes.missile = 4;
    game.snap.iran.warheads.conventional = 4;
    const mated = deliverMatedRounds(game.snap, 'khorramshahr', 2);
    expect(mated).toBe(2);
    expect(game.snap.iran.rounds.khorramshahr).toBe(before.khorramshahr + 2);
    expect(game.snap.iran.rounds.fateh).toBe(before.fateh);
    expect(game.snap.iran.rounds.drone).toBe(before.drone);
    expect(game.snap.iran.airframes.missile).toBe(4);
  });
});
