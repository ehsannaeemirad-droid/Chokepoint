import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { resolveSabotage } from './combat';

function setup() {
  const g = new Game();
  g.start('campaign', 'usa', 6);
  g.snap.warStarted = true;
  g.snap.phase = 'war';
  const team = g.snap.units.find((u) => u.faction === 'usa' && u.typeId === 'sof')!;
  return { g, team };
}

describe('special operations outcomes', () => {
  it('success damages the site and keeps the team', () => {
    const { g, team } = setup();
    const before = g.snap.nodes.natanz.integrity;
    const result = resolveSabotage(g.snap, g.map, team, 'natanz', () => 0.1);
    expect(result.outcome).toBe('success');
    expect(result.unitLost).toBe(false);
    expect(g.snap.nodes.natanz.integrity).toBeLessThan(before);
    expect(g.snap.units.some((u) => u.uid === team.uid)).toBe(true);
    expect(result.events[0]!.text).toMatch(/team exfiltrated/i);
  });

  it('partial success applies a smaller loss and keeps the team', () => {
    const { g, team } = setup();
    const before = g.snap.nodes.natanz.integrity;
    const result = resolveSabotage(g.snap, g.map, team, 'natanz', () => 0.5);
    expect(result.outcome).toBe('partial');
    expect(result.integrityLoss).toBeGreaterThan(0);
    expect(before - g.snap.nodes.natanz.integrity).toBe(result.integrityLoss);
    expect(g.snap.units.some((u) => u.uid === team.uid)).toBe(true);
  });

  it('failure with survival leaves the team in place', () => {
    const { g, team } = setup();
    const result = resolveSabotage(g.snap, g.map, team, 'natanz', () => 0.8);
    expect(result.outcome).toBe('failure-survived');
    expect(result.unitLost).toBe(false);
    expect(g.snap.units.some((u) => u.uid === team.uid)).toBe(true);
    expect(result.events[0]!.text).toMatch(/remains in place/i);
  });

  it('failure with loss removes the team and says so', () => {
    const { g, team } = setup();
    const result = resolveSabotage(g.snap, g.map, team, 'natanz', () => 0.95);
    expect(result.outcome).toBe('failure-lost');
    expect(result.unitLost).toBe(true);
    expect(g.snap.units.some((u) => u.uid === team.uid)).toBe(false);
    expect(result.events[0]!.text).toMatch(/team was lost/i);
  });

  it('aborts without a roll, loss or damage when the target is already destroyed', () => {
    const { g, team } = setup();
    g.snap.nodes.natanz.integrity = 0;
    let rolls = 0;
    const result = resolveSabotage(g.snap, g.map, team, 'natanz', () => {
      rolls++;
      return 0.1;
    });
    expect(result.outcome).toBe('abort');
    expect(rolls).toBe(0);
    expect(result.unitLost).toBe(false);
    expect(result.integrityLoss).toBe(0);
    expect(g.snap.units.some((u) => u.uid === team.uid)).toBe(true);
  });

  it('applies exactly the integrity change the report states', () => {
    for (const [roll, expected] of [
      [0.1, 'success'],
      [0.5, 'partial'],
      [0.8, 'failure-survived'],
      [0.95, 'failure-lost'],
    ] as const) {
      const { g, team } = setup();
      const before = g.snap.nodes.natanz.integrity;
      const result = resolveSabotage(g.snap, g.map, team, 'natanz', () => roll);
      expect(result.outcome).toBe(expected);
      expect(before - g.snap.nodes.natanz.integrity).toBe(result.integrityLoss);
      expect(g.snap.units.some((u) => u.uid === team.uid)).toBe(!result.unitLost);
    }
  });
});
