import { describe, expect, it } from 'vitest';
import { hostileTo, strikeRange, validateStrike } from '../combat/combat';
import { setEnduranceSystems } from '../combat/endurance';
import { defenderOfNode, unitType } from '../core/world';
import { hexDistance } from '../map/hex';
import { Game } from '../core/Game';

/**
 * Calibration evidence for the endurance layer (task 3).
 *
 * The briefs supply inventories, production rates and documented expenditure,
 * but no hit probabilities; `base_pk`/`interception_pk` stay null for that
 * reason. What can be calibrated is behaviour: the same simple player policy is
 * run with the endurance flags off and on, and the resulting distribution is
 * asserted to stay sane rather than to match a fabricated win rate. The
 * measured distribution is recorded in BALANCE.md.
 */
type Faction = 'usa' | 'israel' | 'iran';

const ALL_ON = {
  munitionsDepletion: true,
  interceptorDepletion: true,
  radarDamageMultiplier: true,
  sortieFatigue: true,
  carrierEndurance: true,
  iranProduction: true,
  proxySupply: true,
  cyberLimits: true,
  israelMobilization: true,
};

function issueStrike(game: Game, faction: Faction): boolean {
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
      if (game.queueOrder(order).ok) return true;
    }
  }
  return false;
}

function issueIranSalvo(game: Game): boolean {
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
      if (game.queueOrder(order).ok) return true;
    }
  }
  return false;
}

function play(faction: Faction, seed: number, systems: boolean) {
  const game = new Game();
  game.start('campaign', faction, seed);
  if (systems) setEnduranceSystems(game.snap, ALL_ON);
  let issued = 0;
  let guard = 0;
  while (game.snap.status === 'playing' && guard < 32) {
    if (faction === 'iran' ? issueIranSalvo(game) : issueStrike(game, faction)) issued += 1;
    game.endTurn();
    guard++;
  }
  return {
    faction,
    seed,
    systems,
    status: game.snap.status,
    turn: game.snap.turn,
    issued,
    oil: game.snap.meters.oilPrice,
    hormuz: game.snap.meters.hormuz,
    munitions: Object.values(game.snap.endurance?.munitions ?? {}).reduce((sum, p) => sum + p.stock, 0),
    spent: Object.values(game.snap.endurance?.munitions ?? {}).reduce((sum, p) => sum + p.spent, 0),
  };
}

describe('endurance calibration', () => {
  it('keeps every faction able to act with all systems on', () => {
    const rows = [];
    for (const systems of [false, true]) {
      for (const faction of ['usa', 'israel', 'iran'] as const) {
        for (const seed of [11, 22, 33]) rows.push(play(faction, seed, systems));
      }
    }
    console.log('Calibration rows:', JSON.stringify(rows));

    for (const row of rows) {
      expect(['won', 'lost', 'playing', 'drawn']).toContain(row.status);
      expect(row.turn).toBeGreaterThan(0);
      expect(row.turn).toBeLessThanOrEqual(31);
      // No faction is silently frozen: each run issues at least one strike.
      expect(row.issued).toBeGreaterThan(0);
      expect(Number.isFinite(row.oil)).toBe(true);
      expect(Number.isFinite(row.hormuz)).toBe(true);
    }

    // With the systems on, the coalition really is spending down its magazines;
    // a run that spent nothing would mean the layer never engaged.
    const coalitionOn = rows.filter((r) => r.systems && r.faction !== 'iran');
    expect(coalitionOn.some((r) => r.spent > 0)).toBe(true);
    for (const row of coalitionOn) expect(row.munitions).toBeGreaterThanOrEqual(0);
  }, 600_000);

  it('is deterministic with the systems on', () => {
    const a = play('usa', 77, true);
    const b = play('usa', 77, true);
    expect({ status: b.status, turn: b.turn, issued: b.issued }).toEqual({
      status: a.status,
      turn: a.turn,
      issued: a.issued,
    });
  }, 120_000);
});
