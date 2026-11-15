import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { applyAid, favorsOf } from './favors';
import type { ResolveEvent } from '../core/types';

describe('great-power aid', () => {
  it('delivers Russian missiles and spends the favour', () => {
    const game = new Game();
    game.start('campaign', 'iran', 7);
    favorsOf(game.snap).russia = 10;
    const before = game.snap.iran.rounds.fateh;
    const events: ResolveEvent[] = [];

    applyAid(game.snap, 'russia', 'missiles', events);

    expect(game.snap.iran.rounds.fateh).toBe(before + 3);
    expect(favorsOf(game.snap).russia).toBe(6);
    expect(events[0]!.text).toContain('Russian missile shipment');
  });

  it('starts a Chinese production boost', () => {
    const game = new Game();
    game.start('campaign', 'iran', 7);
    favorsOf(game.snap).china = 10;
    const events: ResolveEvent[] = [];

    applyAid(game.snap, 'china', 'production', events);

    expect(game.snap.iranProductionBoost).toBe(2);
    expect(favorsOf(game.snap).china).toBe(6);
    expect(events[0]!.text).toContain('Chinese production package');
  });

  it('reveals coalition units with a Russian intelligence package', () => {
    const game = new Game();
    game.start('campaign', 'iran', 7);
    favorsOf(game.snap).russia = 10;
    for (const unit of game.snap.units) if (unit.faction !== 'iran') unit.revealed = false;
    const events: ResolveEvent[] = [];

    applyAid(game.snap, 'russia', 'intel', events);

    expect(game.snap.units.filter((u) => u.faction !== 'iran').every((u) => u.revealed)).toBe(true);
    expect(game.snap.iranIntelUntil).toBeGreaterThan(game.snap.turn);
    expect(events[0]!.text).toContain('Russian intelligence package');
  });
});
