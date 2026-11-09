/**
 * Phase 1d: scenario baselines.
 *
 * The pre-war start must be a real pre-war posture (no later-war depletion), the
 * scenarios must be structurally distinct rather than cosmetically different, the
 * arsenal must reconcile with its own totals, and starting a campaign must never
 * mutate the scenario definition or another campaign.
 */
import { describe, expect, it } from 'vitest';
import { Game, SCENARIOS } from '../core/Game';
import { DELIVERY_CLASSES, totalRounds } from '../core/inventory';

/** Documented start totals (Phase 1d baseline table). */
const DOCUMENTED_ROUNDS = {
  campaign: { drone: 72, fateh: 36, khorramshahr: 16, fattah: 6, asm: 12 },
  tutorial: { drone: 12, fateh: 8, khorramshahr: 0, fattah: 0, asm: 2 },
} as const;

describe('pre-war baseline', () => {
  it('starts the campaign pre-war on 27 February 2026 with an undepleted arsenal', () => {
    const game = new Game();
    game.start('campaign', 'usa', 20260227);
    expect(game.snap.warStarted).toBe(false);
    expect(game.snap.phase).toBe('prewar');
    expect(game.snap.startDate).toBe('2026-02-27');
    for (const cls of DELIVERY_CLASSES) {
      expect(game.snap.iran.rounds[cls]).toBe(SCENARIOS.campaign!.iran.rounds[cls]);
    }
    expect(game.snap.iran.nuclearMaterial).toBe(0);
    expect(game.snap.iran.launchers.drone).toBeGreaterThan(0);
    expect(game.snap.iran.launchers.ballistic).toBeGreaterThan(0);
  });

  it('does not start the campaign with damaged facilities', () => {
    const game = new Game();
    game.start('campaign', 'iran', 77);
    for (const state of Object.values(game.snap.nodes)) {
      expect(state.integrity).toBe(state.maxIntegrity);
    }
  });
});

describe('arsenal reconciliation', () => {
  it('matches the documented totals for every scenario', () => {
    for (const [id, expected] of Object.entries(DOCUMENTED_ROUNDS)) {
      const iran = SCENARIOS[id]!.iran;
      for (const cls of DELIVERY_CLASSES) {
        expect(iran.rounds[cls], `${id} ${cls}`).toBe(expected[cls]);
      }
      const sum = DELIVERY_CLASSES.reduce((n, cls) => n + expected[cls], 0);
      expect(totalRounds(iran)).toBe(sum);
    }
  });

  it('keeps airframes and warheads empty at start so rounds are fully mated', () => {
    for (const id of Object.keys(SCENARIOS)) {
      const iran = SCENARIOS[id]!.iran;
      expect(iran.airframes).toEqual({ drone: 0, missile: 0 });
      expect(iran.warheads).toEqual({ conventional: 0 });
    }
  });

  it('keeps the tutorial structurally smaller, not just relabelled', () => {
    const campaign = SCENARIOS.campaign!;
    const tutorial = SCENARIOS.tutorial!;
    expect(tutorial.turns).toBeLessThan(campaign.turns);
    expect(totalRounds(tutorial.iran)).toBeLessThan(totalRounds(campaign.iran));
    expect(tutorial.iran.launchers.drone).toBeLessThan(campaign.iran.launchers.drone);
    expect(tutorial.iran.launchers.ballistic).toBeLessThan(campaign.iran.launchers.ballistic);
    expect(tutorial.initialHormuz).toBeLessThan(campaign.initialHormuz);
  });
});

describe('scenario isolation', () => {
  it('does not mutate the scenario definition when a campaign spends stock', () => {
    const before = structuredClone(SCENARIOS.campaign!.iran);
    const game = new Game();
    game.start('campaign', 'iran', 5);
    game.snap.iran.rounds.drone = 0;
    game.snap.iran.launchers.usedDrone = 99;
    expect(SCENARIOS.campaign!.iran.rounds.drone).toBe(before.rounds.drone);
    expect(SCENARIOS.campaign!.iran.launchers.usedDrone).toBe(0);
  });

  it('gives two campaigns independent stock objects', () => {
    const first = new Game();
    first.start('campaign', 'iran', 5);
    const second = new Game();
    second.start('campaign', 'iran', 5);
    first.snap.iran.rounds.fateh = 1;
    first.snap.iran.launchers.usedBallistic = 3;
    expect(second.snap.iran.rounds.fateh).toBe(SCENARIOS.campaign!.iran.rounds.fateh);
    expect(second.snap.iran.launchers.usedBallistic).toBe(0);
    expect(first.snap.iran).not.toBe(second.snap.iran);
  });

  it('deep-copies every nested scenario object, not just the arsenal', () => {
    const game = new Game();
    game.start('campaign', 'usa', 5);
    game.snap.victory!.regimeSurvival.finalTurns = 1;
    expect(SCENARIOS.campaign!.victory!.regimeSurvival.finalTurns).toBe(10);
  });
});
