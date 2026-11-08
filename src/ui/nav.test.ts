/**
 * Phase 5 tests: navigation — the bilingual node catalog, kind filters, the
 * threat ordering and the own-forces cycle. Pure functions, no DOM.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import {
  filterNodes,
  NAV_KINDS,
  nextOwnUid,
  nextThreatUid,
  nodeCatalog,
  threatOrder,
} from './nav';

function newGame(faction: 'usa' | 'iran' = 'usa', seed = 8080): Game {
  const game = new Game();
  game.start('campaign', faction, seed);
  return game;
}

describe('the node catalog', () => {
  it('lists every strategic node with searchable bilingual text', () => {
    const game = newGame();
    const catalog = nodeCatalog(game.snap, game.map);
    expect(catalog.length).toBe(game.map.nodes.length);
    const natanz = catalog.find((e) => e.id === 'natanz')!;
    expect(natanz.kind).toBe('nuclear');
    expect(natanz.nameFa).toBeTruthy();
    // The haystack contains both languages and the kind, lowercased.
    expect(natanz.haystack).toContain('natanz');
    expect(natanz.haystack).toContain(natanz.nameFa.toLowerCase());
    expect(natanz.haystack).toContain('nuclear');
  });

  it('matches queries in English and in Persian', () => {
    const game = newGame();
    const catalog = nodeCatalog(game.snap, game.map);
    const en = filterNodes(catalog, 'udeid', 'all');
    expect(en.some((e) => e.id === 'al_udeid')).toBe(true);
    // Persian query matches through the name_fa haystack.
    const natanz = catalog.find((e) => e.id === 'natanz')!;
    const faQuery = natanz.nameFa.split(' ')[0]!.toLowerCase();
    const fa = filterNodes(catalog, faQuery, 'all');
    expect(fa.some((e) => e.id === 'natanz')).toBe(true);
    // Nonsense matches nothing.
    expect(filterNodes(catalog, 'zzzz', 'all')).toHaveLength(0);
  });

  it('filters by kind without dropping map order', () => {
    const game = newGame();
    const catalog = nodeCatalog(game.snap, game.map);
    expect(NAV_KINDS.length).toBeGreaterThanOrEqual(8);
    const nuclear = filterNodes(catalog, '', 'nuclear');
    expect(nuclear.length).toBeGreaterThan(0);
    for (const entry of nuclear) expect(entry.kind).toBe('nuclear');
    const everything = filterNodes(catalog, '', 'all');
    expect(everything.length).toBe(catalog.length);
  });
});

describe('threat ordering and cycling', () => {
  it('orders revealed enemies by distance to my closest formation', () => {
    const game = newGame('usa');
    const order = threatOrder(game.snap);
    expect(order.length).toBeGreaterThan(0);
    for (let i = 1; i < order.length; i++) {
      expect(order[i]!.dist).toBeGreaterThanOrEqual(order[i - 1]!.dist);
    }
  });

  it('cycles through threats before repeating', () => {
    const game = newGame('usa');
    const total = threatOrder(game.snap).length;
    expect(total).toBeGreaterThan(1);
    const visited: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < total; i++) {
      const uid = nextThreatUid(game.snap, visited)!;
      expect(seen.has(uid)).toBe(false);
      seen.add(uid);
      visited.push(uid);
    }
    // After a full cycle the list wraps back to the first threat.
    expect(nextThreatUid(game.snap, visited)).toBe(visited[0]);
  });

  it('skips unrevealed enemy units', () => {
    const game = newGame('usa');
    game.snap.units.filter((u) => u.faction !== 'usa').forEach((u) => (u.revealed = false));
    expect(threatOrder(game.snap)).toHaveLength(0);
    expect(nextThreatUid(game.snap, [])).toBeNull();
  });
});

describe('own-forces cycling', () => {
  it('walks every own formation before wrapping', () => {
    const game = newGame('usa');
    const total = game.snap.units.filter((u) => u.faction === 'usa').length;
    const visited: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < total; i++) {
      const uid = nextOwnUid(game.snap, visited)!;
      expect(seen.has(uid)).toBe(false);
      seen.add(uid);
      visited.push(uid);
    }
    expect(seen.size).toBe(total);
  });
});
