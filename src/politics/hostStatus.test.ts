import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { setHostStatus, updateHosts } from './politics';
import type { ResolveEvent } from '../core/types';

describe('host posture logging', () => {
  it('does not repeat an unchanged restriction every turn', () => {
    const game = new Game();
    game.start('campaign', 'iran', 123);
    const events: ResolveEvent[] = [];
    game.snap.hosts.turkey.status = 'restricted';

    expect(setHostStatus(game.snap, 'turkey', 'restricted', 0, events)).toBe(false);
    expect(events).toHaveLength(0);
  });

  it('opens Incirlik at the reachable political-will level', () => {
    const game = new Game();
    game.start('campaign', 'iran', 123);
    game.snap.resources.politicalWill = 50;
    game.snap.hosts.turkey.threat = 0;

    updateHosts(game.snap, game.map, []);

    expect(game.snap.incirlikOpen).toBe(true);
  });

  it('still announces the first restriction and the reopening', () => {
    const game = new Game();
    game.start('campaign', 'iran', 123);
    const events: ResolveEvent[] = [];
    game.snap.hosts.turkey.status = 'open';

    expect(setHostStatus(game.snap, 'turkey', 'restricted', 0, events)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]!.text).toContain('restricted offensive missions');

    expect(setHostStatus(game.snap, 'turkey', 'open', 0, events)).toBe(true);
    expect(events).toHaveLength(2);
    expect(events[1]!.text).toContain('restored full base access');
  });
});
