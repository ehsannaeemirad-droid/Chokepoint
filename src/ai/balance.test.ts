import { beforeEach, describe, expect, it } from 'vitest';
import { hostileTo, strikeRange, validateStrike } from '../combat/combat';
import { defenderOfNode, unitType } from '../core/world';
import { hexDistance } from '../map/hex';
import { Game } from '../core/Game';

type Faction = 'usa' | 'israel' | 'iran';

interface Row {
  faction: Faction;
  seed: number;
  status: string;
  turn: number;
  outcome: string;
  oil: number;
  hormuz: number;
  droneRounds: number;
  ballisticRounds: number;
  mines: number;
  minefields: number;
  interceptors: number;
  politicalWill: number;
  posture: string;
}

/** A simple player policy so the AI is exercised across full campaigns. */
function issueStrike(game: Game, faction: Faction): void {
  const targets = game.map.nodes.filter((node) => {
    const defender = defenderOfNode(node);
    return !!defender && hostileTo(faction, defender);
  });
  const aircraft = game.snap.units.filter(
    (u) => u.faction === faction && unitType(u.typeId).category === 'air' && u.magazine > 0 && u.cooldown === 0,
  );
  for (const unit of aircraft) {
    for (const target of targets) {
      const hex = game.map.nodeHexOf(target.id);
      if (!hex) continue;
      if (hexDistance({ col: unit.col, row: unit.row }, hex) > strikeRange(game.snap, unit)) continue;
      const order = { kind: 'strike' as const, unitUid: unit.uid, col: hex.col, row: hex.row, nodeId: target.id };
      if (!validateStrike(game.snap, game.map, unit, hex.col, hex.row, target.id).ok) continue;
      if (game.queueOrder(order).ok) return;
    }
  }
}

/**
 * Iranian player policy: open with the missile force the way an Iranian
 * commander would.
 *
 * Without an opening order the campaign never leaves the pre-war phase —
 * `maybeStartWar` needs a hostile order — so `runAiPhase` is skipped for all
 * 30 turns and every seed resolves an identical untouched snapshot. The
 * Iranian rows were byte-identical across seeds for that reason, not because
 * the AI ignored the seed: the AI never ran.
 */
function issueIranSalvo(game: Game): void {
  const targets = game.map.nodes.filter((node) => {
    const defender = defenderOfNode(node);
    return !!defender && hostileTo('iran', defender);
  });
  const launchers = game.snap.units.filter(
    (u) => u.faction === 'iran' && unitType(u.typeId).category === 'missile' && u.cooldown === 0,
  );
  for (const unit of launchers) {
    for (const target of targets) {
      const hex = game.map.nodeHexOf(target.id);
      if (!hex) continue;
      if (hexDistance({ col: unit.col, row: unit.row }, hex) > strikeRange(game.snap, unit)) continue;
      const order = { kind: 'strike' as const, unitUid: unit.uid, col: hex.col, row: hex.row, nodeId: target.id };
      if (!validateStrike(game.snap, game.map, unit, hex.col, hex.row, target.id).ok) continue;
      if (game.queueOrder(order).ok) return;
    }
  }
}

/**
 * A defensive player policy: constrain ROE, keep the airlift running, escort
 * shipping and clear located mines. This exercises the mechanics a real player
 * has that the pure strike policy ignores.
 */
function issueDefensiveOrders(game: Game, faction: Faction): void {
  if (faction === 'iran') return;
  if (game.snap.roe?.posture !== 'constrained') {
    game.queueOrder({ kind: 'roe', posture: 'constrained' });
  }
  if (game.snap.resources.tankerSorties > 0 && game.snap.resources.politicalWill >= 30 && game.snap.resources.interceptorsUSA < 100) {
    game.queueOrder({ kind: 'airlift' });
  }
  const ship = game.snap.units.find(
    (u) => u.faction === faction && unitType(u.typeId).category === 'naval' && u.cooldown === 0,
  );
  if (!ship) return;
  const detected = Object.entries(game.snap.minefields ?? {}).find(([, f]) => f.detected && f.mines > 0);
  if (detected) {
    const [col, row] = detected[0].split(',').map(Number);
    game.queueOrder({ kind: 'clear', unitUid: ship.uid, col, row });
  } else if ((game.snap.escortCoverage ?? 0) < 2) {
    game.queueOrder({ kind: 'escort', unitUid: ship.uid });
  }
}

function play(faction: Faction, seed: number, defensive = false): Row {
  const game = new Game();
  game.start('campaign', faction, seed);
  let guard = 0;
  while (game.snap.status === 'playing' && guard < 32) {
    if (faction === 'iran') issueIranSalvo(game);
    else issueStrike(game, faction);
    if (defensive) issueDefensiveOrders(game, faction);
    game.endTurn();
    guard++;
  }
  const snap = game.snap;
  // A press of the simple player policy is allowed to leave fields uncleared,
  // but every counter must stay a valid non-negative number.
  expect(snap.iran.rounds.drone).toBeGreaterThanOrEqual(0);
  expect(snap.iran.rounds.fateh).toBeGreaterThanOrEqual(0);
  expect(snap.iran.rounds.khorramshahr).toBeGreaterThanOrEqual(0);
  expect(snap.iran.rounds.fattah).toBeGreaterThanOrEqual(0);
  expect(snap.iran.mines).toBeGreaterThanOrEqual(0);
  for (const unit of snap.units) expect(unit.magazine).toBeGreaterThanOrEqual(0);
  for (const field of Object.values(snap.minefields ?? {})) expect(field.mines).toBeGreaterThanOrEqual(0);

  return {
    faction,
    seed,
    status: snap.status,
    turn: snap.turn,
    outcome: snap.outcome,
    oil: Math.round(snap.meters.oilPrice),
    hormuz: Math.round(snap.meters.hormuz),
    droneRounds: snap.iran.rounds.drone,
    ballisticRounds: snap.iran.rounds.fateh + snap.iran.rounds.khorramshahr,
    mines: snap.iran.mines,
    minefields: Object.values(snap.minefields ?? {}).filter((f) => f.mines > 0).length,
    interceptors: snap.resources.interceptorsUSA + snap.resources.interceptorsIsrael,
    politicalWill: Math.round(snap.resources.politicalWill),
    posture: snap.roe?.posture ?? 'standard',
  };
}

describe('multi-seed AI balance', () => {
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

  it('runs every faction across seeds and reports the distribution', () => {
    const rows: Row[] = [];
    for (const faction of ['usa', 'israel', 'iran'] as const) {
      for (const seed of [11, 22, 33]) rows.push(play(faction, seed));
    }

    // The report is the Phase 3 acceptance evidence; keep it visible in CI logs.
    console.log('AI balance rows:', JSON.stringify(rows, null, 1));

    for (const row of rows) {
      expect(['won', 'lost', 'playing', 'drawn']).toContain(row.status);
      expect(row.turn).toBeGreaterThan(0);
      expect(row.turn).toBeLessThanOrEqual(31);
      expect(row.outcome.length).toBeGreaterThan(10);
      expect(Number.isFinite(row.oil)).toBe(true);
      expect(row.hormuz).toBeGreaterThanOrEqual(0);
      expect(row.hormuz).toBeLessThanOrEqual(100);
    }

    // An Iranian campaign must actually differ by seed. This used to pass while
    // every row was identical, because the assertion compared a set with itself.
    const iranRows = rows.filter((r) => r.faction === 'iran');
    const signatures = new Set(
      iranRows.map((r) => `${r.status}:${r.turn}:${r.droneRounds}:${r.ballisticRounds}:${r.politicalWill}`),
    );
    expect(signatures.size).toBeGreaterThan(1);
  }, 120_000);

  it('runs a defensive player policy and reports the difference', () => {
    const rows: Row[] = [];
    for (const seed of [11, 22, 33]) rows.push(play('usa', seed, true));
    console.log('Defensive-policy rows:', JSON.stringify(rows, null, 1));

    for (const row of rows) {
      expect(['won', 'lost', 'playing', 'drawn']).toContain(row.status);
      expect(row.turn).toBeLessThanOrEqual(31);
      expect(row.posture).toBe('constrained');
      expect(row.interceptors).toBeGreaterThanOrEqual(0);
    }
  }, 120_000);

  it('is deterministic for a repeated seed', () => {
    const a = play('usa', 77);
    const b = play('usa', 77);
    expect({ status: b.status, turn: b.turn, outcome: b.outcome }).toEqual({
      status: a.status,
      turn: a.turn,
      outcome: a.outcome,
    });
  }, 120_000);
});
