/**
 * Regression guard for order queuing (§1.1 of the update brief).
 *
 * The reported failure was a strike that toasted "queued" but reached the
 * Review Turn modal as "0 orders · 0 passed validation". That can only happen
 * if the queue the UI writes and the queue the review reads drift apart, so
 * this test walks the exact path: queue through `Game.queueOrder`, then read
 * `buildTurnReview`, which is what the modal renders.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { buildTurnReview } from './review';

/** The nearest Coalition node the launcher can actually reach (range 9 hexes). */
function nearestInRange(game: Game, unit: { col: number; row: number }, operator: 'usa' | 'iran') {
  const candidates = [...game.map.nodeById.values()]
    .filter((n) => n.operators.includes(operator))
    .map((node) => ({ node, hex: game.map.nodeHexOf(node.id)! }))
    .filter(({ hex }) => hex && Math.abs(hex.col - unit.col) + Math.abs(hex.row - unit.row) <= 8)
    .sort(
      (a, b) =>
        Math.abs(a.hex.col - unit.col) + Math.abs(a.hex.row - unit.row) -
        (Math.abs(b.hex.col - unit.col) + Math.abs(b.hex.row - unit.row)),
    );
  const found = candidates[0];
  if (!found) throw new Error(`no ${operator} node in range of ${unit.col},${unit.row}`);
  return found.node;
}

function gameAs(faction: 'usa' | 'iran', seed = 77): Game {
  const game = new Game();
  game.start('campaign', faction, seed);
  game.snap.warStarted = true;
  game.snap.phase = 'war';
  return game;
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

describe('order queue and review', () => {
  it('shows a queued strike in the review as one valid order', () => {
    const game = gameAs('iran');
    const launcher = game.snap.units.find((u) => u.typeId === 'fateh110')!;
    const base = nearestInRange(game, launcher, 'usa');
    const hex = game.map.nodeHexOf(base.id)!;
    const check = game.queueOrder({
      kind: 'strike',
      unitUid: launcher.uid,
      col: hex.col,
      row: hex.row,
      nodeId: base.id,
    });
    expect(check, JSON.stringify(check)).toEqual({ ok: true });

    const review = buildTurnReview(game.snap, game.map);
    expect(review.orders).toHaveLength(1);
    expect(review.orders[0]!.errors).toEqual([]);
    expect(review.validCount).toBe(1);
  });

  it('counts every queued order, not just the last one', () => {
    const game = gameAs('usa');
    const jets = game.snap.units.filter((u) => u.typeId === 'f35a').slice(0, 2);
    const targets = [...game.map.nodeById.values()].filter((n) => n.operators.includes('iran'));
    jets.forEach((jet, i) => {
      const node = targets[i]!;
      const hex = game.map.nodeHexOf(node.id)!;
      game.queueOrder({ kind: 'strike', unitUid: jet.uid, col: hex.col, row: hex.row, nodeId: node.id });
    });
    expect(game.snap.orders).toHaveLength(2);
    expect(buildTurnReview(game.snap, game.map).orders).toHaveLength(2);
  });

  it('starts the next turn with an empty queue', () => {
    const game = gameAs('iran');
    const launcher = game.snap.units.find((u) => u.typeId === 'fateh110')!;
    const base = nearestInRange(game, launcher, 'usa');
    const hex = game.map.nodeHexOf(base.id)!;
    game.queueOrder({
      kind: 'strike',
      unitUid: launcher.uid,
      col: hex.col,
      row: hex.row,
      nodeId: base.id,
    });
    game.endTurn();
    expect(game.snap.orders).toHaveLength(0);
    // The resolved order is still recorded for the replay and the log.
    expect(game.snap.orderLog.at(-1)?.orders).toHaveLength(1);
  });
});
