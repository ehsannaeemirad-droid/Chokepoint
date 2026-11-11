import { describe, expect, it } from 'vitest';
import { attackersForHex, strikeTargetsFor } from './targets';
import { applyOrder } from '../core/engine';
import { Game } from '../core/Game';
import { defenderOfNode, unitType } from '../core/world';
import { hostileTo } from './combat';
import type { ResolveEvent, UnitInstance } from '../core/types';
import { applyAid, favorsOf } from '../politics/favors';

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
  });

  it('starts a temporary production surge', () => {
    const game = start('iran');
    favorsOf(game.snap).china = 5;
    applyAid(game.snap, 'china', 'production', []);
    expect(game.snap.iranProductionBoost).toBeGreaterThan(0);
  });
});
