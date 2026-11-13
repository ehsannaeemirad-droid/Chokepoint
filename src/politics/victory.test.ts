import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_VICTORY, checkOutcome, israeliOffensiveCapacity, occupiedIranianNodes, updateVictoryClocks, victoryPaths } from './victory';
import { Game } from '../core/Game';
import type { GameSnapshot } from '../core/types';
import type { TheaterMap } from '../map/TheaterMap';

type Harness = { snap: GameSnapshot; map: TheaterMap; game: Game };

function setup(faction: 'usa' | 'israel' | 'iran', seed = 4242): Harness {
  const game = new Game();
  game.start('campaign', faction, seed);
  return { snap: game.snap, map: game.map, game };
}

beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
    configurable: true,
    writable: true,
  });
});

describe('israeliOffensiveCapacity (victory path 4)', () => {
  it('starts at 100 with the full Israeli air wing ready', () => {
    const { snap } = setup('usa');
    expect(snap.meters.israeliAirAtStart).toBe(2);
    expect(israeliOffensiveCapacity(snap)).toBe(100);
  });

  it('halves when a squadron is destroyed; magazines only modulate', () => {
    const { snap } = setup('usa');
    const f35i = snap.units.find((u) => u.typeId === 'f35i')!;
    snap.units = snap.units.filter((u) => u.uid !== f35i.uid);
    expect(israeliOffensiveCapacity(snap)).toBe(50);

    // Draining the survivor's magazine compounds the airframe loss against the
    // start-of-scenario baseline: 0.75 readiness over a baseline of 2 → 37.5.
    const f15i = snap.units.find((u) => u.typeId === 'f15i')!;
    f15i.magazine = 0;
    expect(israeliOffensiveCapacity(snap)).toBe(38);
  });

  it('reaches zero only when the whole Israeli air arm is gone', () => {
    const { snap } = setup('usa');
    snap.units = snap.units.filter((u) => !(u.faction === 'israel' && snap.meters.israeliAirAtStart > 0 && ['f15i', 'f35i'].includes(u.typeId)));
    expect(israeliOffensiveCapacity(snap)).toBe(0);
  });
});

describe('updateVictoryClocks', () => {
  let h: Harness;
  beforeEach(() => {
    h = setup('iran');
  });

  it('tracks the regime-intact streak and resets it when institutions break', () => {
    const { snap, map } = h;
    updateVictoryClocks(snap, map);
    updateVictoryClocks(snap, map);
    expect(snap.meters.regimeIntactStreak).toBe(2);

    // Capital damage alone no longer breaks the regime (SPEC §24).
    snap.nodes.tehran!.integrity = 0;
    updateVictoryClocks(snap, map);
    expect(snap.meters.regimeIntactStreak).toBe(3);

    snap.iranDomestic = {
      stability: 10,
      eliteCohesion: 20,
      irgcCohesion: 20,
      publicDissatisfaction: 80,
      economicPressure: 80,
      militaryCredibility: 20,
      leadershipContinuity: 40,
      negotiationPosition: 10,
    };
    updateVictoryClocks(snap, map);
    expect(snap.meters.regimeIntactStreak).toBe(0);
  });

  it('counts occupation streaks only with enough US ground formations on Iranian nodes', () => {
    const { snap, map } = h;
    const tehran = map.nodeHexOf('tehran')!;
    snap.units.push({
      uid: 'test-ground',
      typeId: 'merkava', // ground category; faction overridden to the US
      faction: 'usa',
      col: tehran.col,
      row: tehran.row,
      strength: 100,
      magazine: 3,
      cooldown: 0,
      revealed: true,
      name: 'Test Brigade',
    });
    // 1 held node < nodesRequired (4): no streak.
    updateVictoryClocks(snap, map);
    expect(occupiedIranianNodes(snap, map)).toBe(1);
    expect(snap.meters.occupationStreak).toBe(0);

    // Lower the bar in the scenario data: the streak then builds and is remembered.
    snap.victory!.occupation.nodesRequired = 1;
    updateVictoryClocks(snap, map);
    updateVictoryClocks(snap, map);
    expect(snap.meters.maxOccupationStreak).toBe(2);

    // Withdraw: the current streak resets, the maximum stays.
    snap.units.pop();
    updateVictoryClocks(snap, map);
    expect(snap.meters.occupationStreak).toBe(0);
    expect(snap.meters.maxOccupationStreak).toBe(2);
  });

  it('tracks the oil-shock streak from the oil price index', () => {
    const { snap, map } = h;
    snap.meters.oilPrice = 140;
    updateVictoryClocks(snap, map);
    updateVictoryClocks(snap, map);
    expect(snap.meters.oilShockStreak).toBe(2);

    snap.meters.oilPrice = 80;
    updateVictoryClocks(snap, map);
    expect(snap.meters.oilShockStreak).toBe(0);
  });

  it('does nothing for the tutorial (no victory block)', () => {
    const game = new Game();
    game.start('tutorial', 'usa', 7);
    expect(game.snap.victory).toBeNull();
    updateVictoryClocks(game.snap, game.map);
    expect(game.snap.meters.regimeIntactStreak).toBe(0);
    expect(victoryPaths(game.snap, game.map)).toEqual([]);
  });
});

describe('victoryPaths progress', () => {
  it('reports partial progress for the oil shock', () => {
    const { snap, map } = setup('iran');
    snap.meters.oilPrice = 150;
    snap.meters.oilShockStreak = 3;
    const oil = victoryPaths(snap, map).find((p) => p.id === 'oilShock')!;
    expect(oil.decidesAtEnd).toBe(false);
    expect(oil.satisfied).toBe(false);
    expect(oil.progress).toBe(60);
  });

  it('needs more than the absence of occupation', () => {
    const { snap, map } = setup('iran');
    // Full deterrent and stable institutions, but no costs imposed yet.
    expect(victoryPaths(snap, map).find((p) => p.id === 'noOccupation')!.satisfied).toBe(false);

    snap.meters.iranWarCost = snap.meters.iranWarCostThreshold;
    snap.meters.hormuzTurnsAbove50 = 6;
    expect(victoryPaths(snap, map).find((p) => p.id === 'noOccupation')!.satisfied).toBe(true);

    snap.meters.maxOccupationStreak = 3; // == turnsRequired
    expect(victoryPaths(snap, map).find((p) => p.id === 'noOccupation')!.satisfied).toBe(false);
  });
});

describe('checkOutcome with the four paths', () => {
  let h: Harness;
  beforeEach(() => {
    h = setup('iran', 20260101);
    h.snap.victory = structuredClone(DEFAULT_VICTORY);
    // These cases score a campaign that actually ran; a campaign in which the
    // war never starts is drawn instead (see the §27 test below).
    h.snap.warStarted = true;
  });

  it('ends the campaign immediately when the oil-shock streak completes', () => {
    const { snap, map } = h;
    snap.meters.oilShockStreak = 5;
    expect(checkOutcome(snap, map).status).toBe('won');

    snap.faction = 'usa';
    expect(checkOutcome(snap, map).status).toBe('lost');
  });

  it('degrades-Israel path triggers only at or after its deadline turn', () => {
    const { snap, map } = h;
    snap.units = snap.units.filter((u) => !['f15i', 'f35i'].includes(u.typeId));
    snap.turn = 24;
    expect(checkOutcome(snap, map).status).toBe('playing');
    snap.turn = 25;
    expect(checkOutcome(snap, map).status).toBe('won');
  });

  it('decides regime survival at the final turn', () => {
    const { snap, map } = h;
    snap.turn = 30; // == maxTurns
    snap.meters.regimeIntactStreak = 10;
    // All three nuclear sites above the 40% threshold.
    expect(checkOutcome(snap, map).status).toBe('won');

    snap.meters.regimeIntactStreak = 9;
    // Deny the no-occupation path so the regime streak is the deciding path.
    snap.meters.maxOccupationStreak = 3;
    expect(checkOutcome(snap, map).status).toBe('lost');
  });

  it('does not award Iran a victory for a campaign the war never started', () => {
    // SPEC §27: surviving a predetermined number of turns is not a win. A
    // passive Iranian player never fires, so `maybeStartWar` never runs and the
    // campaign resolves the pre-war snapshot at the bell.
    const { snap, map } = h;
    snap.turn = snap.maxTurns;
    snap.warStarted = false;
    snap.phase = 'prewar';
    snap.meters.regimeIntactStreak = 10; // every survival input is satisfied
    snap.meters.maxOccupationStreak = 0;
    const result = checkOutcome(snap, map);
    expect(result.status).not.toBe('won');
    expect(result.status).toBe('drawn');
    expect(result.outcome).toContain('without a war');

    // The same snapshot with the war actually under way keeps the result.
    snap.warStarted = true;
    expect(checkOutcome(snap, map).status).toBe('won');
  });

  it('requires a nuclear facility strictly above the threshold', () => {
    const { snap, map } = h;
    snap.turn = 30;
    snap.meters.regimeIntactStreak = 10;
    snap.meters.maxOccupationStreak = 3; // deny no-occupation
    snap.nodes.natanz!.integrity = 40; // exactly at the threshold: not above
    snap.nodes.fordow!.integrity = 40;
    snap.nodes.isfahan!.integrity = 40;
    expect(checkOutcome(snap, map).status).toBe('lost');
    snap.nodes.isfahan!.integrity = 41;
    expect(checkOutcome(snap, map).status).toBe('won');
  });

  it('wins at the bell only with a strategic result, not mere survival', () => {
    const { snap, map } = h;
    snap.turn = 30;
    snap.meters.regimeIntactStreak = 0; // regime path fails
    expect(checkOutcome(snap, map).status).toBe('lost');

    snap.meters.iranWarCost = snap.meters.iranWarCostThreshold;
    snap.meters.hormuzTurnsAbove50 = 6;
    const result = checkOutcome(snap, map);
    expect(result.status).toBe('won');
    expect(result.outcome).toContain('strategic result');
  });

  it('denies the no-occupation path once the US reached the occupation state', () => {
    const { snap, map } = h;
    snap.turn = 30;
    snap.meters.regimeIntactStreak = 0;
    snap.meters.maxOccupationStreak = 3;
    expect(checkOutcome(snap, map).status).toBe('lost');
  });

  it('does not hand the coalition a win for a stalemate', () => {
    const { snap, map } = h;
    snap.faction = 'usa';
    snap.turn = 30;
    snap.meters.regimeIntactStreak = 0;
    snap.meters.maxOccupationStreak = 3;
    const result = checkOutcome(snap, map);
    expect(result.status).toBe('lost');
    expect(result.outcome).toContain('without a coalition strategic result');
  });

  it('awards the coalition when several dimensions actually line up', () => {
    const { snap, map } = h;
    snap.faction = 'usa';
    snap.turn = 30;
    for (const id of ['isfahan', 'natanz', 'fordow']) snap.nodes[id]!.integrity = 0;
    snap.units = snap.units.filter((u) => !['asm_launcher', 'fateh110', 'khorramshahr'].includes(u.typeId));
    snap.meters.iranWarCost = snap.meters.iranWarCostThreshold * 0.9;
    expect(checkOutcome(snap, map).status).toBe('won');
  });

  it('the coalition loses when Iran holds the dimensions that matter', () => {
    const { snap, map } = h;
    snap.faction = 'usa';
    snap.turn = 30;
    snap.meters.regimeIntactStreak = 0;
    snap.meters.iranWarCost = snap.meters.iranWarCostThreshold * 0.9;
    snap.meters.hormuzTurnsAbove50 = 6;
    expect(checkOutcome(snap, map).status).toBe('lost');
  });

  it('keeps the political-will collapse as an immediate Iranian win', () => {
    const { snap, map } = h;
    snap.resources.politicalWill = 0;
    expect(checkOutcome(snap, map).status).toBe('won');
  });

  it('keeps existing US conditions intact: bases down is still a US loss', () => {
    const { snap, map } = h;
    snap.faction = 'usa';
    snap.turn = 12;
    for (const id of ['al_udeid', 'al_dhafra', 'ali_al_salem', 'nsa_bahrain']) snap.nodes[id]!.integrity = 0;
    snap.hosts.qatar!.status = 'closed';
    snap.hosts.uae!.status = 'closed';
    snap.hosts.kuwait!.status = 'closed';
    snap.hosts.bahrain!.status = 'closed';
    expect(checkOutcome(snap, map).status).toBe('lost');
  });
});

describe('save compatibility', () => {
  it('loads a pre-Phase-1 v1 save and fills the victory defaults', () => {
    const { game } = setup('usa', 5150);
    expect(game.save('slot1')).toBe(true);

    // Simulate an old save: strip the new fields from the stored snapshot.
    const raw = JSON.parse(localStorage.getItem('chokepoint:save:slot1')!);
    delete raw.snapshot.victory;
    delete raw.snapshot.meters.regimeIntactStreak;
    delete raw.snapshot.meters.oilShockStreak;
    localStorage.setItem('chokepoint:save:slot1', JSON.stringify(raw));

    const restored = new Game();
    expect(restored.load('slot1')).toBe(true);
    expect(restored.snap.victory).toEqual(DEFAULT_VICTORY);
    expect(restored.snap.meters.regimeIntactStreak).toBe(0);
    expect(restored.snap.meters.oilShockStreak).toBe(0);
  });
});
