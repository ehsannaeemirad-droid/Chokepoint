import { describe, expect, it } from 'vitest';
import { resolveIncoming } from './combat';
import { Game } from '../core/Game';

describe('political impact accounting', () => {
  it('counts a raid once, not once per impacting munition', () => {
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
    game.start('campaign', 'usa', 9090);
    const snap = game.snap;
    snap.resources.interceptorsUSA = 0;
    snap.resources.interceptorsIsrael = 0;
    const hex = game.map.nodeHexOf('al_udeid')!;
    const before = snap.nodeImpacts.al_udeid ?? 0;
    const will = snap.resources.politicalWill;

    const events = resolveIncoming(
      snap,
      game.map,
      {
        attacker: 'iran',
        col: hex.col,
        row: hex.row,
        nodeId: 'al_udeid',
        salvos: [{ threat: 'drone', damage: 3, count: 12, label: 'Shahed drones' }],
      },
      () => 0.99,
    );

    const delta = (snap.nodeImpacts.al_udeid ?? 0) - before;
    expect(delta).toBeLessThanOrEqual(1);
    if (delta === 1) {
      // One raid is one political event: -2 will, not -2 per drone.
      expect(will - snap.resources.politicalWill).toBe(2);
    }
    expect(events.some((e) => e.text.includes('Shahed'))).toBe(true);
  });
});
