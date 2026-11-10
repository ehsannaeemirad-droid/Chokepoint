import { beforeAll, describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { coalitionTargets } from './ai';
import type { AiContext } from './tree';
import {
  DOCTRINES,
  belowReserve,
  coalitionTargetScore,
  doctrineFor,
  doctrineIdFor,
  iranTargetScore,
  spendableStock,
  wantsMaritime,
} from './doctrine';

let game: Game;

beforeAll(() => {
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
  game = new Game();
  game.start('campaign', 'usa', 4711);
});

function ctx(faction: 'usa' | 'israel'): AiContext {
  return { snap: game.snap, map: game.map, faction, rng: () => 0.5, events: [] };
}

describe('AI doctrines', () => {
  it('assigns different doctrines to the USA and Israel', () => {
    expect(doctrineIdFor('usa', 'campaign')).toBe('maximumPressure');
    expect(doctrineIdFor('israel', 'campaign')).toBe('attrition');
    expect(doctrineIdFor('iran', 'campaign')).toBe('maritimePressure');
  });

  it('lets a scenario override the default doctrine', () => {
    expect(doctrineIdFor('usa', 'tutorial')).toBe('ammoConservation');
    expect(doctrineIdFor('iran', 'tutorial')).toBe('escalationRestraint');
  });

  it('produces genuinely different coalition target lists', () => {
    const usa = coalitionTargets(ctx('usa'), 'usa', doctrineFor('usa', 'campaign'));
    const israel = coalitionTargets(ctx('israel'), 'israel', doctrineFor('israel', 'campaign'));

    expect(usa.length).toBeGreaterThan(0);
    expect(israel.map((t) => t.id)).not.toEqual(usa.map((t) => t.id));
    // The USA opens on the nuclear programme; Israel opens on missile production.
    expect(['natanz', 'fordow', 'isfahan']).toContain(usa[0]!.id);
    expect(['khojir', 'parchin', 'shahroud']).toContain(israel[0]!.id);
  });

  it('raises maritime and infrastructure targets under the matching doctrine', () => {
    const naval = game.map.nodeById.get('bandar_abbas')!;
    const nuclear = game.map.nodeById.get('natanz')!;
    const pressure = DOCTRINES.maximumPressure;
    const maritime = DOCTRINES.infrastructure;

    expect(coalitionTargetScore('usa', naval, maritime)).toBeGreaterThan(
      coalitionTargetScore('usa', naval, pressure),
    );
    expect(coalitionTargetScore('usa', nuclear, pressure)).toBeGreaterThan(
      coalitionTargetScore('usa', nuclear, maritime),
    );
  });

  it('scores Iranian targets by doctrine and node role', () => {
    const base = game.map.nodeById.get('al_udeid')!;
    const city = game.map.nodeById.get('tel_aviv')!;
    expect(iranTargetScore(base, DOCTRINES.maximumPressure)).toBeGreaterThan(
      iranTargetScore(city, DOCTRINES.maximumPressure),
    );
    expect(iranTargetScore(city, DOCTRINES.escalationRestraint)).toBeLessThan(
      iranTargetScore(city, DOCTRINES.saturation),
    );
  });

  it('holds ammunition back according to the reserve', () => {
    expect(spendableStock(10, DOCTRINES.ammoConservation)).toBe(6);
    expect(spendableStock(10, DOCTRINES.maximumPressure)).toBe(10);
    expect(spendableStock(0, DOCTRINES.attrition)).toBe(0);
    expect(belowReserve(1, DOCTRINES.ammoConservation)).toBe(true);
    expect(belowReserve(3, DOCTRINES.ammoConservation)).toBe(false);
  });

  it('keeps restraint doctrines out of the maritime fight', () => {
    expect(wantsMaritime(game.snap, DOCTRINES.maritimePressure)).toBe(true);
    expect(wantsMaritime(game.snap, DOCTRINES.negotiationFirst)).toBe(false);
  });
});
