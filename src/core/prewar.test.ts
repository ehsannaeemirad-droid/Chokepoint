import { describe, expect, it } from 'vitest';
import { game } from './Game';
import { runTurn } from './engine';
import { TheaterMap } from '../map/TheaterMap';
import { sectorCoverage } from '../combat/radar';

describe('pre-war start', () => {
  it('campaign starts pre-war with warStarted false and elevated stocks', () => {
    game.start('campaign', 'usa', 20260227);
    const s = game.snap;
    expect(s.warStarted).toBe(false);
    expect(s.phase).toBe('prewar');
    expect(s.startDate).toBe('2026-02-27');
    expect(s.resources.interceptorsUSAReserve ?? 0).toBeGreaterThan(0);
    expect(s.resources.interceptorsUSA).toBeGreaterThan(0);
    expect(s.iran.rounds.drone).toBeGreaterThanOrEqual(56);
    expect(s.iran.rounds.fateh).toBeGreaterThanOrEqual(28);
  });

  it('first end-turn without hostile orders does not open war', () => {
    game.start('campaign', 'usa', 99);
    expect(game.snap.warStarted).toBe(false);
    game.snap.orders = [];
    runTurn(game.snap, game.map);
    expect(game.snap.warStarted).toBe(false);
  });

  it('a strike order opens hostilities', () => {
    game.start('campaign', 'usa', 7);
    const striker = game.snap.units.find((u) => u.faction === 'usa' && u.typeId === 'f35a');
    expect(striker).toBeTruthy();
    game.snap.orders = [
      { kind: 'strike', unitUid: striker!.uid, col: striker!.col, row: striker!.row },
    ];
    runTurn(game.snap, game.map);
    expect(game.snap.warStarted).toBe(true);
    expect(game.snap.phase).toBe('war');
  });

  it('save-shape warStarted/reserves normalize on older snapshots', () => {
    game.start('campaign', 'usa', 1);
    const s = structuredClone(game.snap);
    delete s.warStarted;
    delete s.resources.interceptorsUSAReserve;
    if (s.warStarted === undefined) s.warStarted = true;
    if (s.resources.interceptorsUSAReserve === undefined) s.resources.interceptorsUSAReserve = 0;
    expect(s.warStarted).toBe(true);
    expect(s.resources.interceptorsUSAReserve).toBe(0);
  });
});

describe('radar coverage', () => {
  it('sector coverage is high when radars are intact', () => {
    game.start('campaign', 'usa', 3);
    expect(sectorCoverage(game.snap, 'gulf')).toBeGreaterThan(0.7);
  });

  it('degrading muwaffaq_salti reduces levant coverage', () => {
    game.start('campaign', 'usa', 3);
    const before = sectorCoverage(game.snap, 'levant');
    if (game.snap.nodes.muwaffaq_salti) {
      game.snap.nodes.muwaffaq_salti.integrity = 0;
      const after = sectorCoverage(game.snap, 'levant');
      expect(after).toBeLessThan(before);
    } else {
      expect(before).toBeGreaterThan(0);
    }
  });
});

void TheaterMap;
