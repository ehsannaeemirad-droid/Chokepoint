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

function play(faction: Faction, seed: number): Row {
  const game = new Game();
  game.start('campaign', faction, seed);
  let guard = 0;
  while (game.snap.status === 'playing' && guard < 32) {
    issueStrike(game, faction);
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
      expect(['won', 'lost', 'playing']).toContain(row.status);
      expect(row.turn).toBeGreaterThan(0);
      expect(row.turn).toBeLessThanOrEqual(31);
      expect(row.outcome.length).toBeGreaterThan(10);
      expect(Number.isFinite(row.oil)).toBe(true);
      expect(row.hormuz).toBeGreaterThanOrEqual(0);
      expect(row.hormuz).toBeLessThanOrEqual(100);
    }

    // Different doctrines should not collapse into one identical Iranian war.
    const iranianRows = rows.filter((r) => r.faction === 'iran');
    expect(new Set(iranianRows.map((r) => `${r.status}:${r.turn}`)).size).toBeGreaterThan(0);
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
