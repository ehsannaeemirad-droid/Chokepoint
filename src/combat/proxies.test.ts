/**
 * Hezbollah, Hamas and the PMF now field abstract formations built from their
 * documented inventories. These tests pin deployment, hostility, the firing
 * phase and the supply rules that make their stocks finite.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { hostileTo } from './combat';
import { refillProxyMagazines, setEnduranceSystems } from './endurance';
import { runAiPhase } from '../ai/ai';
import type { ResolveEvent } from '../core/types';

const PROXY_TYPES = {
  hezbollah: ['hezbollah_rocket', 'hezbollah_atgm'],
  hamas: ['hamas_rocket'],
  pmf: ['pmf_rocket', 'pmf_drone'],
};

describe('proxy formations', () => {
  it('deploys the documented proxy formations in the campaign', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4);
    for (const [faction, types] of Object.entries(PROXY_TYPES)) {
      const units = game.snap.units.filter((u) => u.faction === faction);
      expect(units.length, faction).toBeGreaterThan(0);
      for (const unit of units) expect(types).toContain(unit.typeId);
    }
  });

  it('treats the proxies as hostile to the coalition and Saudi Arabia', () => {
    expect(hostileTo('hezbollah', 'israel')).toBe(true);
    expect(hostileTo('hamas', 'israel')).toBe(true);
    expect(hostileTo('pmf', 'usa')).toBe(true);
    expect(hostileTo('hezbollah', 'iran')).toBe(false);
  });

  it('fires proxy batteries during the AI phase and spends their magazines', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4);
    game.snap.warStarted = true;
    const before = new Map(game.snap.units.map((u) => [u.uid, u.magazine]));
    const events: ResolveEvent[] = [];
    runAiPhase(game.snap, game.map, events);
    const launches = events.filter((e) => /fires .+ at /.test(e.text));
    expect(launches.length).toBeGreaterThan(0);
    const spent = game.snap.units.filter(
      (u) => ['hezbollah', 'hamas', 'pmf'].includes(u.faction) && u.magazine < (before.get(u.uid) ?? 0),
    );
    expect(spent.length).toBeGreaterThan(0);
  });

  it('does not reload Hezbollah or Hamas, and resupplies the PMF slowly', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4);
    setEnduranceSystems(game.snap, { proxySupply: true });
    const hezbollah = game.snap.units.find((u) => u.faction === 'hezbollah')!;
    const hamas = game.snap.units.find((u) => u.faction === 'hamas')!;
    const pmf = game.snap.units.find((u) => u.faction === 'pmf')!;
    hezbollah.magazine = 0;
    hamas.magazine = 0;
    pmf.magazine = 0;
    game.snap.turn = 5;
    const events: ResolveEvent[] = [];
    refillProxyMagazines(game.snap, events);
    expect(pmf.magazine).toBe(1);
    expect(hezbollah.magazine).toBe(0);
    expect(hamas.magazine).toBe(0);
  });
});
