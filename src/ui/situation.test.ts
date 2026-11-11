import { afterEach, describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { setLang } from '../i18n';
import { buildSituation } from './situation';

const ORIGINAL_DOCUMENT = Object.getOwnPropertyDescriptor(globalThis, 'document');

function makeGame(faction: 'usa' | 'israel' | 'iran'): Game {
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
  game.start('campaign', faction, 4242);
  return game;
}

function stubDocument(): void {
  Object.defineProperty(globalThis, 'document', {
    value: { documentElement: {}, body: { classList: { toggle() {} } } },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  setLang('en');
  if (ORIGINAL_DOCUMENT) Object.defineProperty(globalThis, 'document', ORIGINAL_DOCUMENT);
  else delete (globalThis as { document?: unknown }).document;
});

describe('strategic situation summary', () => {
  it('summarises a coalition opening with turn, focus, meters and enemy pressure', () => {
    const game = makeGame('usa');
    const summary = buildSituation(game.snap, game.map);
    expect(summary.headline).toContain('1/30');
    expect(summary.headline).toContain('pre-war');
    expect(summary.focus.length).toBeGreaterThan(0);
    expect(summary.metrics).toHaveLength(4);
    expect(summary.metrics.join(' ')).toContain('Hormuz');
    expect(summary.metrics.join(' ')).toContain('Congress');
    expect(summary.threat.length).toBeGreaterThan(0);
    expect(['info', 'warn', 'bad']).toContain(summary.tone);
  });

  it('shows Iranian domestic and arsenal meters to the Iranian player', () => {
    const game = makeGame('iran');
    const summary = buildSituation(game.snap, game.map);
    const metrics = summary.metrics.join(' ');
    expect(metrics).toContain('Stability');
    expect(metrics).toContain('Resources');
    expect(metrics).toContain('Rounds');
    expect(summary.focus.length).toBeGreaterThan(0);
  });

  it('tracks the live state rather than a static briefing', () => {
    const game = makeGame('usa');
    const before = buildSituation(game.snap, game.map);
    game.snap.meters.hormuz = 92;
    game.snap.resources.politicalWill = 11;
    const after = buildSituation(game.snap, game.map);
    expect(after.metrics).not.toEqual(before.metrics);
    expect(after.metrics.join(' ')).toContain('92');
    expect(after.metrics.join(' ')).toContain('11');
  });

  it('renders entirely in Persian after a language switch', () => {
    stubDocument();
    const game = makeGame('usa');
    setLang('fa');
    const summary = buildSituation(game.snap, game.map);
    const persian = /[\u0600-\u06FF]/;
    expect(persian.test(summary.headline)).toBe(true);
    expect(persian.test(summary.focus)).toBe(true);
    expect(persian.test(summary.threat)).toBe(true);
    for (const metric of summary.metrics) expect(persian.test(metric), metric).toBe(true);
  });
});
