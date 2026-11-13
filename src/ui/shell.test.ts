import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { activeTab, gaugeTone, shellAlerts, visibleTabs, type StrategicTab } from './shell';

function start(faction: 'usa' | 'israel' | 'iran'): Game {
  const game = new Game();
  game.start('campaign', faction, 314159);
  return game;
}

describe('top-bar gauges', () => {
  it('treats low values as danger for lower-is-worse gauges', () => {
    expect(gaugeTone(50, 30, 12)).toBe('ok');
    expect(gaugeTone(30, 30, 12)).toBe('warn');
    expect(gaugeTone(12, 30, 12)).toBe('alert');
    expect(gaugeTone(0, 30, 12)).toBe('alert');
  });
});

describe('top-bar alerts', () => {
  it('stays quiet at the start of a campaign', () => {
    const game = start('usa');
    expect(shellAlerts(game.snap)).toEqual([]);
  });

  it('surfaces spent political will and near-collapse pressure, most urgent first', () => {
    const game = start('usa');
    game.snap.resources.politicalWill = 20;
    if (game.snap.domestic) game.snap.domestic.pressure = 100;
    const alerts = shellAlerts(game.snap);
    expect(alerts[0]!.tone).toBe('alert');
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain('will');
    expect(ids).toContain('pressure');
  });

  it('warns about a host government at the brink and about Hormuz disruption', () => {
    const game = start('usa');
    const host = Object.values(game.snap.hosts)[0]!;
    host.threat = 95;
    game.snap.meters.hormuz = 75;
    const ids = shellAlerts(game.snap).map((a) => a.id);
    expect(ids).toContain('hosts');
    expect(ids).toContain('hormuz');
  });

  it('never reports interceptor stocks for Iran, which has none', () => {
    const game = start('iran');
    game.snap.resources.interceptorsUSA = 0;
    expect(shellAlerts(game.snap).map((a) => a.id)).not.toContain('interceptors');
  });

  it('flags the oil price only once it crosses the victory threshold', () => {
    const game = start('iran');
    const threshold = game.snap.victory!.oilShock.indexThreshold;
    game.snap.meters.oilPrice = threshold - 1;
    expect(shellAlerts(game.snap).map((a) => a.id)).not.toContain('oil');
    game.snap.meters.oilPrice = threshold;
    expect(shellAlerts(game.snap).map((a) => a.id)).toContain('oil');
  });
});

describe('strategic panel tabs', () => {
  it('offers only categories with content, in a stable order', () => {
    const html: Record<StrategicTab, string> = {
      situation: '<p>a</p>',
      military: '   ',
      airDefence: '<p>d</p>',
      economy: '<p>b</p>',
      diplomacy: '',
      politics: '<p>c</p>',
    };
    expect(visibleTabs(html)).toEqual(['situation', 'airDefence', 'economy', 'politics']);
  });

  it('keeps the chosen tab when it survives, otherwise falls back to the first', () => {
    expect(activeTab(['situation', 'military'], 'military')).toBe('military');
    expect(activeTab(['situation', 'military'], 'politics')).toBe('situation');
    expect(activeTab([], 'situation')).toBeNull();
  });
});
