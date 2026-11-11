/**
 * Phase 2 item 1: projected order validation.
 *
 * A queued order claims resources, political will, rounds, launcher sorties and
 * its unit. Validation runs against those claims, the queue is re-validated
 * before resolution, and an order that no longer holds is dropped with a logged
 * reason instead of being silently resolved.
 */
import { describe, expect, it } from 'vitest';
import { Game } from './Game';
import { emptyReservations, orderReservations } from './engine';
import { hexDistance, hexNeighbors } from '../map/hex';

function iranAtWar(seed = 11): Game {
  const game = new Game();
  game.start('campaign', 'iran', seed);
  game.snap.warStarted = true;
  game.snap.phase = 'war';
  return game;
}

function adjacentLand(game: Game, unit: { col: number; row: number }) {
  for (const hex of hexNeighbors(unit.col, unit.row)) {
    const tile = game.map.hexAt(hex.col, hex.row);
    if (tile && tile.terrain !== 'deep' && tile.terrain !== 'coast') return hex;
  }
  throw new Error('no adjacent land');
}

function targetFor(game: Game, unit: { col: number; row: number }) {
  for (const node of game.map.nodes) {
    const hex = game.map.nodeHexOf(node.id);
    if (!hex) continue;
    if (hexDistance({ col: unit.col, row: unit.row }, hex) <= 30) {
      return { col: hex.col, row: hex.row, nodeId: node.id };
    }
  }
  return { col: unit.col, row: unit.row, nodeId: undefined };
}

describe('resource reservations', () => {
  it('rejects a second production order that overdraws the same resources', () => {
    const game = new Game();
    game.start('campaign', 'iran', 3);
    game.snap.iran.resources = 15; // enough for one 10-cost Fateh order, not two
    const first = game.queueOrder({ kind: 'produce', unitTypeId: 'fateh110', count: 1 });
    expect(first.ok).toBe(true);
    const second = game.queueOrder({ kind: 'produce', unitTypeId: 'fateh110', count: 1 });
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/resources/i);
  });

  it('releases the claim when the order is removed', () => {
    const game = new Game();
    game.start('campaign', 'iran', 3);
    game.snap.iran.resources = 15;
    expect(game.queueOrder({ kind: 'produce', unitTypeId: 'fateh110', count: 1 }).ok).toBe(true);
    game.removeOrder(0);
    expect(game.queueOrder({ kind: 'produce', unitTypeId: 'fateh110', count: 1 }).ok).toBe(true);
  });

  it('rejects a second diplomacy order once political will is claimed', () => {
    const game = new Game();
    game.start('campaign', 'usa', 3);
    game.snap.resources.politicalWill = 2;
    expect(game.queueOrder({ kind: 'diplomacy', host: 'qatar' }).ok).toBe(true);
    const second = game.queueOrder({ kind: 'diplomacy', host: 'uae' });
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/political will/i);
  });

  it('does not mutate the snapshot while computing reservations', () => {
    const game = new Game();
    game.start('campaign', 'usa', 3);
    game.queueOrder({ kind: 'airlift' });
    const before = JSON.stringify({
      will: game.snap.resources.politicalWill,
      airlift: game.snap.resources.airlift,
    });
    const reserved = orderReservations(game.snap);
    expect(reserved.politicalWill).toBeGreaterThan(0);
    expect(JSON.stringify({ will: game.snap.resources.politicalWill, airlift: game.snap.resources.airlift })).toBe(before);
    expect(emptyReservations().politicalWill).toBe(0);
  });
});

describe('unit and launcher reservations', () => {
  it('refuses to task the same unit twice', () => {
    const game = iranAtWar();
    const unit = game.snap.units.find((u) => u.faction === 'iran' && u.typeId === 'shahed136')!;
    const target = targetFor(game, unit);
    expect(
      game.queueOrder({ kind: 'strike', unitUid: unit.uid, col: target.col, row: target.row, nodeId: target.nodeId }).ok,
    ).toBe(true);
    const second = game.queueOrder({
      kind: 'strike',
      unitUid: unit.uid,
      col: target.col,
      row: target.row,
      nodeId: target.nodeId,
    });
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/already been tasked/i);
  });

  it('reserves a moved unit against a second task', () => {
    const game = iranAtWar();
    const launcher = game.snap.units.find((u) => u.faction === 'iran' && u.typeId === 'fateh110')!;
    const dest = adjacentLand(game, launcher);
    expect(game.queueOrder({ kind: 'move', unitUid: launcher.uid, col: dest.col, row: dest.row }).ok).toBe(true);
    expect(orderReservations(game.snap).units.has(launcher.uid)).toBe(true);
    const second = game.queueOrder({ kind: 'move', unitUid: launcher.uid, col: launcher.col, row: launcher.row });
    expect(second.ok).toBe(false);
    expect(second.code).toBe('unit-tasked');
  });

  it('clears the move reservation when the order is cancelled', () => {
    const game = iranAtWar();
    const launcher = game.snap.units.find((u) => u.faction === 'iran' && u.typeId === 'fateh110')!;
    const dest = adjacentLand(game, launcher);
    expect(game.queueOrder({ kind: 'move', unitUid: launcher.uid, col: dest.col, row: dest.row }).ok).toBe(true);
    game.removeOrder(0);
    expect(game.snap.orders).toHaveLength(0);
    expect(orderReservations(game.snap).units.has(launcher.uid)).toBe(false);
    expect(game.queueOrder({ kind: 'move', unitUid: launcher.uid, col: dest.col, row: dest.row }).ok).toBe(true);
  });

  it('clears the move reservation after a completed turn', () => {
    const game = iranAtWar();
    const launcher = game.snap.units.find((u) => u.faction === 'iran' && u.typeId === 'fateh110')!;
    const dest = adjacentLand(game, launcher);
    expect(game.queueOrder({ kind: 'move', unitUid: launcher.uid, col: dest.col, row: dest.row }).ok).toBe(true);
    game.endTurn();
    expect(game.snap.orders).toHaveLength(0);
    expect(orderReservations(game.snap).units.has(launcher.uid)).toBe(false);
  });

  it('clears the move reservation when resolve-time validation drops it', () => {
    const game = iranAtWar();
    const launcher = game.snap.units.find((u) => u.faction === 'iran' && u.typeId === 'fateh110')!;
    const dest = adjacentLand(game, launcher);
    expect(game.queueOrder({ kind: 'move', unitUid: launcher.uid, col: dest.col, row: dest.row }).ok).toBe(true);
    launcher.col += 8;
    const { events } = game.endTurn();
    expect(events.some((e) => e.text.startsWith('Order dropped:') && /too far/i.test(e.text))).toBe(true);
    expect(game.snap.orders).toHaveLength(0);
    expect(orderReservations(game.snap).units.has(launcher.uid)).toBe(false);
  });

  it('does not retain a reservation after an invalid order', () => {
    const game = iranAtWar();
    const launcher = game.snap.units.find((u) => u.faction === 'iran' && u.typeId === 'fateh110')!;
    const result = game.queueOrder({
      kind: 'move',
      unitUid: launcher.uid,
      col: launcher.col + 8,
      row: launcher.row,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('too-far');
    expect(game.snap.orders).toHaveLength(0);
    expect(orderReservations(game.snap).units.has(launcher.uid)).toBe(false);
    const dest = adjacentLand(game, launcher);
    expect(game.queueOrder({ kind: 'move', unitUid: launcher.uid, col: dest.col, row: dest.row }).ok).toBe(true);
  });

  it('reserves launcher sorties across different ballistic classes', () => {
    const game = iranAtWar();
    const fateh = game.snap.units.find((u) => u.faction === 'iran' && u.typeId === 'fateh110')!;
    const kh = game.snap.units.find((u) => u.faction === 'iran' && u.typeId === 'khorramshahr')!;
    expect(fateh && kh).toBeTruthy();
    game.snap.iran.rounds.fateh = 5;
    game.snap.iran.rounds.khorramshahr = 5;
    game.snap.iran.launchers.ballistic = 1;
    game.snap.iran.launchers.usedBallistic = 0;

    game.snap.orders = [{ kind: 'strike', unitUid: fateh.uid, col: fateh.col, row: fateh.row }];
    const held = orderReservations(game.snap);
    expect(held.sorties.ballistic).toBe(1);
    expect(held.rounds.fateh).toBe(1);

    const second = game.queueOrder({ kind: 'strike', unitUid: kh.uid, col: kh.col, row: kh.row });
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/launcher sorties/i);
  });
});

describe('resolve-time revalidation', () => {
  it('drops an order whose resources disappeared and logs why', () => {
    const game = new Game();
    game.start('campaign', 'iran', 9);
    const before = game.snap.iran.rounds.fateh;
    expect(game.queueOrder({ kind: 'produce', unitTypeId: 'fateh110', count: 1 }).ok).toBe(true);
    game.snap.iran.resources = 0;
    const { events } = game.endTurn();
    expect(events.some((e) => e.text.startsWith('Order dropped:') && /resources/i.test(e.text))).toBe(true);
    expect(game.snap.iran.rounds.fateh).toBe(before + 0);
  });

  it('keeps a valid order and applies it', () => {
    const game = new Game();
    game.start('campaign', 'iran', 9);
    const before = game.snap.iran.rounds.fateh;
    expect(game.queueOrder({ kind: 'produce', unitTypeId: 'fateh110', count: 1 }).ok).toBe(true);
    const { events } = game.endTurn();
    expect(events.some((e) => e.text.startsWith('Order dropped:'))).toBe(false);
    expect(game.snap.iran.rounds.fateh).toBeGreaterThan(before);
  });
});
