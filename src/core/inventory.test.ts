/**
 * Phase 1b: the Iranian arsenal is split into mated rounds, airframes, warheads,
 * launchers and nuclear material, and every number the UI shows is labelled as an
 * estimate. These tests pin the split and the mating path.
 */
import { describe, expect, it } from 'vitest';
import { Game } from './Game';
import {
  ARSENAL_UNCERTAINTY_PCT,
  arsenalRows,
  deliverMatedRounds,
  launcherSortiesLeft,
  mateRounds,
  spendIranRounds,
  totalRounds,
} from './inventory';

function started(faction: 'usa' | 'iran' = 'iran') {
  const game = new Game();
  game.start('campaign', faction, 4242);
  return game;
}

describe('arsenal split', () => {
  it('starts with mated rounds and empty half-built stores', () => {
    const { snap } = started();
    expect(snap.iran.rounds.drone).toBe(72);
    expect(snap.iran.rounds.fateh).toBe(36);
    expect(snap.iran.airframes).toEqual({ drone: 0, missile: 0 });
    expect(snap.iran.warheads).toEqual({ conventional: 0 });
    expect(snap.iran.nuclearMaterial).toBe(0);
  });

  it('keeps nuclear material out of the conventional total', () => {
    const { snap } = started();
    const before = totalRounds(snap.iran);
    snap.iran.nuclearMaterial = 3;
    expect(totalRounds(snap.iran)).toBe(before);
  });

  it('does not count airframes or warheads as launchable rounds', () => {
    const { snap } = started();
    const before = totalRounds(snap.iran);
    snap.iran.airframes.missile = 4;
    snap.iran.warheads.conventional = 4;
    expect(totalRounds(snap.iran)).toBe(before);
  });

  it('mates airframes and warheads into rounds', () => {
    const { snap } = started();
    const before = snap.iran.rounds.fateh;
    expect(deliverMatedRounds(snap, 'fateh', 3)).toBe(3);
    expect(snap.iran.rounds.fateh).toBe(before + 3);
    expect(snap.iran.airframes.missile).toBe(0);
    expect(snap.iran.warheads.conventional).toBe(0);
  });

  it('mates only what both stores can supply', () => {
    const { snap } = started();
    const before = snap.iran.rounds.drone;
    snap.iran.airframes.drone = 5;
    // No warheads at all, so nothing can be mated even though airframes exist.
    expect(mateRounds(snap, 'drone', 5)).toBe(0);
    expect(snap.iran.rounds.drone).toBe(before);
    expect(snap.iran.airframes.drone).toBe(5);
  });
});

describe('launcher budget', () => {
  it('spends one sortie per round fired and stops at the budget', () => {
    const { snap } = started();
    const roundsBefore = snap.iran.rounds.fateh;
    expect(spendIranRounds(snap, 'fateh', 2)).toBe(2);
    expect(snap.iran.rounds.fateh).toBe(roundsBefore - 2);
    expect(launcherSortiesLeft(snap.iran, 'ballistic')).toBe(7);

    expect(spendIranRounds(snap, 'fateh', 99)).toBe(7);
    expect(launcherSortiesLeft(snap.iran, 'ballistic')).toBe(0);
    expect(spendIranRounds(snap, 'fateh', 1)).toBe(0);
  });

  it('does not spend rounds when no launcher sorties remain', () => {
    const { snap } = started();
    snap.iran.launchers.usedBallistic = snap.iran.launchers.ballistic;
    const before = snap.iran.rounds.fateh;
    expect(spendIranRounds(snap, 'fateh', 3)).toBe(0);
    expect(snap.iran.rounds.fateh).toBe(before);
  });

  it('restores the budget at the start of the next turn', () => {
    const game = started();
    game.snap.iran.launchers.usedDrone = game.snap.iran.launchers.drone;
    game.endTurn();
    expect(game.snap.iran.launchers.usedDrone).toBe(0);
  });

  it('rejects a player strike when the launcher budget is spent', () => {
    const game = started('iran');
    game.snap.warStarted = true;
    game.snap.iran.launchers.usedBallistic = game.snap.iran.launchers.ballistic;
    const unit = game.snap.units.find((u) => u.faction === 'iran' && u.typeId === 'fateh110')!;
    const target = game.map.nodeHexOf('tehran')!;
    const check = game.queueOrder({
      kind: 'strike',
      unitUid: unit.uid,
      col: target.col,
      row: target.row,
      nodeId: 'tehran',
    });
    expect(check.ok).toBe(false);
  });
});

describe('labelled estimates', () => {
  it('labels every arsenal row as an assessed band', () => {
    const { snap } = started();
    const rows = arsenalRows(snap.iran);
    expect(rows.length).toBe(5);
    for (const row of rows) {
      expect(row.confidence).toBe('assessed');
      expect(row.uncertaintyPct).toBe(ARSENAL_UNCERTAINTY_PCT[row.class]);
      expect(row.high).toBeGreaterThanOrEqual(row.rounds);
      expect(row.low).toBeLessThanOrEqual(row.rounds);
    }
  });
});
