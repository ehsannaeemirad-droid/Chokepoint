import { beforeEach, describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { buildTurnReview, reportGroups, reportKey } from './review';

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

describe('turn review', () => {
  let game: Game;
  beforeEach(() => {
    game = makeGame();
  });

  it('lists queued orders, their costs and validation state', () => {
    expect(game.queueOrder({ kind: 'roe', posture: 'constrained' }).ok).toBe(true);
    expect(game.queueOrder({ kind: 'airlift' }).ok).toBe(true);

    const review = buildTurnReview(game.snap, game.map);
    expect(review.orders).toHaveLength(2);
    expect(review.validCount).toBe(2);
    expect(review.orders.every((o) => o.errors.length === 0)).toBe(true);
    expect(review.spending.some((s) => s.label.includes('Political will') || s.label.includes('اراده'))).toBe(true);
    expect(review.spending.some((s) => s.label.includes('Tanker') || s.label.includes('سوخت'))).toBe(true);
  });

  it('reports an empty queue without inventing orders', () => {
    const review = buildTurnReview(game.snap, game.map);
    expect(review.orders).toHaveLength(0);
    expect(review.spending).toHaveLength(0);
    expect(review.validCount).toBe(0);
  });

  it('surfaces standing threat warnings', () => {
    game.snap.resources.politicalWill = 12;
    game.snap.meters.hormuz = 72;
    game.snap.resources.interceptorsUSA = 5;

    const review = buildTurnReview(game.snap, game.map);
    expect(review.warnings.length).toBeGreaterThanOrEqual(3);
    expect(review.warnings.join(' ')).toMatch(/Political will|اراده/);
    expect(review.warnings.join(' ')).toMatch(/Hormuz|هرمز/);
    expect(review.warnings.join(' ')).toMatch(/interceptors|رهگیر/);
  });
});

describe('turn report grouping', () => {
  it('classifies events into the report sections', () => {
    expect(reportKey('Patriot intercepted 6/6 Shahed drones.')).toBe('report.airdefence');
    expect(reportKey('Iranian mine warfare group laid a field in the Hormuz approach.')).toBe('report.maritime');
    expect(reportKey('Strategic airlift delivered 12 interceptors to the Gulf.')).toBe('report.logistics');
    expect(reportKey('Congressional support fell after the casualty report.')).toBe('report.politics');
    expect(reportKey('Iran launched 8 munitions at Al Udeid.')).toBe('report.missiles');
    expect(reportKey('Nuclear escalation rose to 40.')).toBe('report.consequences');
    expect(reportKey('A quiet turn passes.')).toBe('report.other');
  });

  it('merges consecutive events and preserves their order', () => {
    const events = [
      { text: 'Patriot intercepted 2 drones.', tone: 'good' as const },
      { text: 'THAAD intercepted 1 missile.', tone: 'good' as const },
      { text: 'Iranian minefield detected near Hormuz.', tone: 'warn' as const },
      { text: 'Congressional support fell.', tone: 'warn' as const },
    ];
    const groups = reportGroups(events);
    expect(groups.map((g) => g.key)).toEqual([
      'report.airdefence',
      'report.maritime',
      'report.politics',
    ]);
    expect(groups[0]!.events).toHaveLength(2);
  });
});
