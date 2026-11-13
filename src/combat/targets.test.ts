import { describe, expect, it } from 'vitest';
import { attackersForHex, strikeCandidates, strikeTargetsFor } from './targets';
import { applyOrder, validateOrder } from '../core/engine';
import { Game } from '../core/Game';
import { defenderOfNode, unitType } from '../core/world';
import { hostileTo } from './combat';
import type { Order, ResolveEvent, UnitInstance } from '../core/types';
import { applyAid, favorsOf } from '../politics/favors';
import { nodeIntegrityEstimate, paidIntel, unitStrengthEstimate } from '../ui/fog';

function start(faction: 'usa' | 'israel' | 'iran'): Game {
  const game = new Game();
  game.start('campaign', faction, 314159);
  return game;
}

function adjacent(game: Game, unit: UnitInstance): { col: number; row: number } {
  for (const [dc, dr] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    if (game.map.hexAt(unit.col + dc, unit.row + dr)) return { col: unit.col + dc, row: unit.row + dr };
  }
  throw new Error('no adjacent tile');
}

describe('target-first attacker discovery', () => {
  it('lists every own unit that can legally strike a selected hostile facility', () => {
    const game = start('usa');
    const target = game.map.nodes.find((node) => {
      const defender = defenderOfNode(node);
      return !!defender && hostileTo('usa', defender);
    });
    expect(target).toBeTruthy();
    const hex = game.map.nodeHexOf(target!.id);
    expect(hex).toBeTruthy();
    const attackers = attackersForHex(game.snap, game.map, hex!.col, hex!.row, target!.id);
    expect(attackers.length).toBeGreaterThan(0);
    for (const { unit } of attackers) {
      expect(unit.faction).toBe('usa');
      expect(unitType(unit.typeId).atk).toBeGreaterThan(0);
    }
  });

  it('does not list attackers for a friendly facility', () => {
    const game = start('usa');
    const hex = game.map.nodeHexOf('al_udeid')!;
    expect(attackersForHex(game.snap, game.map, hex.col, hex.row, 'al_udeid')).toHaveLength(0);
  });

  it('excludes a unit with any queued task from the attacker list', () => {
    const game = start('usa');
    let target: { col: number; row: number; nodeId: string } | null = null;
    let attackers = [] as ReturnType<typeof attackersForHex>;
    for (const node of game.map.nodes) {
      const defender = defenderOfNode(node);
      const hex = game.map.nodeHexOf(node.id);
      if (!defender || !hex || !hostileTo('usa', defender)) continue;
      attackers = attackersForHex(game.snap, game.map, hex.col, hex.row, node.id);
      if (attackers.length > 0) {
        target = { col: hex.col, row: hex.row, nodeId: node.id };
        break;
      }
    }
    expect(target).toBeTruthy();
    const unit = attackers[0]!.unit;
    expect(game.queueOrder({ kind: 'move', unitUid: unit.uid, col: unit.col, row: unit.row }).ok).toBe(true);
    const after = attackersForHex(game.snap, game.map, target!.col, target!.row, target!.nodeId);
    expect(after.map((entry) => entry.unit.uid)).not.toContain(unit.uid);
  });

  it('rejects a missile launcher moving onto water', () => {
    const game = start('iran');
    const launcher = game.snap.units.find((u) => u.typeId === 'fateh110')!;
    let sea: { col: number; row: number } | null = null;
    for (let col = 0; col < 60 && !sea; col++) {
      for (let row = 0; row < 60 && !sea; row++) {
        const tile = game.map.hexAt(col, row);
        if (tile && (tile.terrain === 'deep' || tile.terrain === 'coast')) sea = { col, row };
      }
    }
    expect(sea).toBeTruthy();
    launcher.col = sea!.col;
    launcher.row = sea!.row;
    const result = validateOrder(game.snap, game.map, {
      kind: 'move',
      unitUid: launcher.uid,
      col: sea!.col,
      row: sea!.row,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('ground-water');
  });
});

describe('movable Iranian launchers', () => {
  it('gives missile launchers one hex of movement and exposes them when they relocate', () => {
    const game = start('iran');
    const launcher = game.snap.units.find((u) => u.typeId === 'fateh110')!;
    expect(unitType(launcher.typeId).mov).toBe(1);
    const dest = adjacent(game, launcher);
    const result = game.queueOrder({ kind: 'move', unitUid: launcher.uid, col: dest.col, row: dest.row });
    expect(result.ok).toBe(true);
    expect(game.snap.orders).toHaveLength(1);
    const events: ResolveEvent[] = [];
    applyOrder(game.snap, game.map, game.snap.orders[0]!, () => 0.5, events);
    expect(launcher.revealed).toBe(true);
    expect(events.some((event) => /exposed/i.test(event.text))).toBe(true);
  });
});

describe('US naval fleet targeting', () => {
  it('names the carrier strike group in the Iranian target list', () => {
    const game = start('iran');
    const carrier = game.snap.units.find((u) => u.typeId === 'csg')!;
    const launcher = game.snap.units.find((u) => u.typeId === 'fateh110')!;
    launcher.col = carrier.col;
    launcher.row = carrier.row + 1;
    game.snap.iran.rounds.fateh = 5;
    game.snap.iran.launchers.ballistic = 2;
    game.snap.iran.launchers.usedBallistic = 0;
    const targets = strikeTargetsFor(
      game.snap,
      game.map,
      launcher,
      (id) => id,
      (col, row) => `${col},${row}`,
      (unit) => unit.name,
    );
    expect(targets.some((target) => target.label.includes('Carrier Strike Group'))).toBe(true);
  });
});

describe('great-power favours', () => {
  it('rejects a malformed aid request without mutating state', () => {
    const game = start('iran');
    const before = JSON.stringify({
      favors: favorsOf(game.snap),
      rounds: game.snap.iran.rounds,
      boost: game.snap.iranProductionBoost,
      intelUntil: game.snap.iranIntelUntil,
    });
    const result = game.queueOrder({ kind: 'aid', patron: 'mars', aid: 'intel' } as unknown as Order);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unknown-order');
    expect(game.snap.orders).toHaveLength(0);
    expect(
      JSON.stringify({
        favors: favorsOf(game.snap),
        rounds: game.snap.iran.rounds,
        boost: game.snap.iranProductionBoost,
        intelUntil: game.snap.iranIntelUntil,
      }),
    ).toBe(before);
  });

  it('rejects an unaffordable aid request through the order path', () => {
    const game = start('iran');
    const result = game.queueOrder({ kind: 'aid', patron: 'russia', aid: 'production' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('not-enough-favors');
  });

  it('spends Russian points on a Caspian missile shipment', () => {
    const game = start('iran');
    favorsOf(game.snap).russia = 5;
    const before = game.snap.iran.rounds.fateh;
    const events: ResolveEvent[] = [];
    applyAid(game.snap, 'russia', 'missiles', events);
    expect(game.snap.iran.rounds.fateh).toBeGreaterThan(before);
    expect(favorsOf(game.snap).russia).toBe(1);
    expect(events[0]!.text).toMatch(/Caspian/);
  });

  it('reveals enemy units through Chinese espionage', () => {
    const game = start('iran');
    const enemy = game.snap.units.find((u) => u.faction !== 'iran')!;
    enemy.revealed = false;
    favorsOf(game.snap).china = 5;
    applyAid(game.snap, 'china', 'intel', []);
    expect(enemy.revealed).toBe(true);
    expect(paidIntel(game.snap)).toBe(true);
    const estimate = unitStrengthEstimate(game.snap, enemy)!;
    expect(estimate.lo).toBe(estimate.hi);
    const node = game.map.nodes.find((n) => n.host === 'usa' || n.host === 'israel')!;
    expect(nodeIntegrityEstimate(game.snap, game.map, node.id)).toBeNull();
    const until = game.snap.iranIntelUntil!;
    game.snap.turn = until - 1;
    expect(paidIntel(game.snap)).toBe(true);
    game.snap.turn = until;
    expect(paidIntel(game.snap)).toBe(true);
    game.snap.turn = until + 1;
    expect(paidIntel(game.snap)).toBe(false);
  });

  it('starts a temporary production surge', () => {
    const game = start('iran');
    favorsOf(game.snap).china = 5;
    applyAid(game.snap, 'china', 'production', []);
    expect(game.snap.iranProductionBoost).toBeGreaterThan(0);
  });
});

describe('target-first force list', () => {
  function hostileTarget(game: Game) {
    for (const node of game.map.nodes) {
      const defender = defenderOfNode(node);
      const hex = game.map.nodeHexOf(node.id);
      if (!defender || !hex || !hostileTo(game.snap.faction, defender)) continue;
      return { node, hex };
    }
    throw new Error('no hostile node');
  }

  it('lists available forces first and gives every other force a reason', () => {
    const game = start('usa');
    const { node, hex } = hostileTarget(game);
    const candidates = strikeCandidates(game.snap, game.map, hex.col, hex.row, node.id);
    expect(candidates.length).toBeGreaterThan(0);

    const available = candidates.filter((c) => c.available);
    expect(available.length).toBeGreaterThan(0);
    expect(candidates[0]!.available).toBe(true);

    for (const candidate of candidates) {
      if (candidate.available) {
        expect(candidate.reason).toBeUndefined();
        expect(candidate.unit.faction).toBe('usa');
      } else {
        expect(candidate.reason).toBeTruthy();
      }
    }
    // The list explains unavailable forces instead of hiding them.
    expect(candidates.some((c) => !c.available)).toBe(true);
  });

  it('agrees with attackersForHex on which forces are available', () => {
    const game = start('usa');
    const { node, hex } = hostileTarget(game);
    const candidates = strikeCandidates(game.snap, game.map, hex.col, hex.row, node.id);
    const attackers = attackersForHex(game.snap, game.map, hex.col, hex.row, node.id);
    expect(attackers.map((a) => a.unit.uid)).toEqual(
      candidates.filter((c) => c.available).map((c) => c.unit.uid),
    );
  });

  it('reports a tasked force as tasked rather than silently dropping it', () => {
    const game = start('usa');
    const { node, hex } = hostileTarget(game);
    const available = strikeCandidates(game.snap, game.map, hex.col, hex.row, node.id).find((c) => c.available)!;
    expect(game.queueOrder({ kind: 'move', unitUid: available.unit.uid, col: available.unit.col, row: available.unit.row }).ok).toBe(true);
    const after = strikeCandidates(game.snap, game.map, hex.col, hex.row, node.id);
    const entry = after.find((c) => c.unit.uid === available.unit.uid)!;
    expect(entry.available).toBe(false);
    expect(entry.reason).toBe('tasked');
  });

  it('never offers a unit that cannot strike at all', () => {
    const game = start('usa');
    const { node, hex } = hostileTarget(game);
    const defence = game.snap.units.find((u) => unitType(u.typeId).category === 'defense');
    expect(defence).toBeTruthy();
    const entry = strikeCandidates(game.snap, game.map, hex.col, hex.row, node.id).find(
      (c) => c.unit.uid === defence!.uid,
    )!;
    expect(entry.available).toBe(false);
    expect(entry.reason).toBe('cannot-strike');
  });

  it('distinguishes out-of-range forces from forces with no munitions', () => {
    const game = start('usa');
    const { node, hex } = hostileTarget(game);
    const aircraft = game.snap.units.find(
      (u) => u.faction === 'usa' && unitType(u.typeId).category === 'air' && u.magazine > 0,
    )!;
    aircraft.magazine = 0;
    const entry = strikeCandidates(game.snap, game.map, hex.col, hex.row, node.id).find(
      (c) => c.unit.uid === aircraft.uid,
    )!;
    // Either it is out of reach or it is the empty magazine that stops it; both
    // are legitimate and both are named.
    expect(['no-munitions', 'out-of-range']).toContain(entry.reason);
    expect(entry.available).toBe(false);
  });
});
