import { describe, expect, it } from 'vitest';
import type { ResolveEvent } from '../core/types';
import { buildReport, importanceOf } from './report';

const ev = (text: string, tone: ResolveEvent['tone'] = 'info'): ResolveEvent => ({ text, tone });

describe('report importance', () => {
  it('treats good and bad outcomes as major and bookkeeping as minor', () => {
    expect(importanceOf(ev('F-35A destroyed the launcher.', 'bad'))).toBe('major');
    expect(importanceOf(ev('Air defence intercepted 6 of 6 drones.', 'good'))).toBe('major');
    expect(importanceOf(ev('Patriot rearmed 4 interceptors.'))).toBe('minor');
    expect(importanceOf(ev('Hormuz disruption rose to 61%.'))).toBe('minor');
  });

  it('keeps information lines that change the picture as major', () => {
    expect(importanceOf(ev('Escalation crossed a red line.'))).toBe('major');
    expect(importanceOf(ev('Qatar closed its bases to offensive sorties.'))).toBe('major');
    expect(importanceOf(ev('New intelligence confirmed the convoy route.'))).toBe('major');
  });
});

describe('turn report', () => {
  it('leads with the strike, not with the stockpile update that resolved first', () => {
    const events = [
      ev('Iran’s production lines added 1 Shahed-136 to the stockpile.', 'good'),
      ev('Khorramshahr / Emad struck Ali Al Salem / Camp Arifjan (integrity 78%).', 'good'),
    ];
    expect(buildReport(events).headline?.text).toContain('struck');
  });


  it('leads with the worst development and keeps every event', () => {
    const events = [
      ev('Patriot rearmed 4 interceptors.'),
      ev('Shahed salvo hit the airbase.', 'bad'),
      ev('Airlift delivered supplies.'),
      ev('F-35A destroyed a radar.', 'good'),
    ];
    const report = buildReport(events);
    expect(report.headline?.text).toBe('Shahed salvo hit the airbase.');
    expect(report.total).toBe(4);
    expect(report.majorCount).toBe(2);
    expect(report.minor).toHaveLength(2);
    expect(report.totals).toEqual({ good: 1, bad: 1, info: 2 });
  });

  it('groups majors by category in a fixed reading order', () => {
    const events = [
      ev('Congressional support fell after the casualty report.', 'bad'),
      ev('Air defence intercepted the salvo.', 'good'),
      ev('A missile struck the port.', 'bad'),
    ];
    const report = buildReport(events);
    expect(report.groups.map((g) => g.key)).toEqual(['report.missiles', 'report.airdefence', 'report.politics']);
  });

  it('merges the same category even when other events sit between them', () => {
    const events = [
      ev('A missile struck the port.', 'bad'),
      ev('Patriot rearmed.', 'info'),
      ev('Another missile hit the depot.', 'bad'),
    ];
    const report = buildReport(events);
    const missiles = report.groups.find((g) => g.key === 'report.missiles');
    expect(missiles?.events).toHaveLength(2);
  });

  it('never hides the minor lines', () => {
    const events = [ev('Quiet turn.'), ev('Rearming continued.')];
    const report = buildReport(events);
    expect(report.headline).toBeNull();
    expect(report.minor).toHaveLength(2);
    expect(report.groups).toHaveLength(0);
  });
});
