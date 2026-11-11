import { beforeEach, describe, expect, it } from 'vitest';
import { Game } from './Game';

function makeGame(): Game {
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
  const game = new Game();
  game.start('campaign', 'usa', 4242);
  return game;
}

describe('engine rejection codes', () => {
  let game: Game;
  beforeEach(() => {
    game = makeGame();
  });

  it('codes a move that exceeds the unit range', () => {
    const unit = game.snap.units.find((u) => u.faction === 'usa')!;
    const result = game.queueOrder({
      kind: 'move',
      unitUid: unit.uid,
      col: unit.col + 50,
      row: unit.row + 50,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('too-far');
      expect(result.params).toMatchObject({ max: expect.any(Number) });
    }
  });

  it('codes an order for an enemy unit', () => {
    const enemy = game.snap.units.find((u) => u.faction !== 'usa')!;
    const result = game.queueOrder({
      kind: 'move',
      unitUid: enemy.uid,
      col: enemy.col,
      row: enemy.row,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('not-your-unit');
  });

  it('maps an unknown unit to the select-unit code', () => {
    const unit = game.snap.units.find((u) => u.faction === 'usa')!;
    const result = game.queueOrder({
      kind: 'move',
      unitUid: 'missing-unit',
      col: unit.col,
      row: unit.row,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('select-unit');
  });

  it('codes orders issued after the campaign has ended', () => {
    game.snap.status = 'won';
    const unit = game.snap.units.find((u) => u.faction === 'usa')!;
    const result = game.queueOrder({
      kind: 'hold',
      unitUid: unit.uid,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('campaign-over');
  });
});
