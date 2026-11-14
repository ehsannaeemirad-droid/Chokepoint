/**
 * End-of-turn report (Phase 6).
 *
 * The resolution stream is chronological, which is right for the engine and
 * wrong for a player: a destroyed battery, a rearm tick and a supply note all
 * arrive interleaved. This module keeps every line but ranks it. Major
 * developments are grouped by category in a fixed reading order and led by a
 * single headline; the rest is available under a "minor updates" disclosure
 * rather than padding the report.
 *
 * Nothing is discarded: an event that is not a major development is still
 * listed, just not in the player's face.
 */
import type { ResolveEvent } from '../core/types';
import type { StringKey } from '../i18n';
import { reportKey, type ReportGroup } from './review';

export type Importance = 'major' | 'minor';

export interface TurnReport {
  /** The single development to read first, if there is one. */
  headline: ResolveEvent | null;
  /** Major developments, one group per category, in reading order. */
  groups: ReportGroup[];
  /** Everything else, in the order the engine produced it. */
  minor: ResolveEvent[];
  totals: { good: number; bad: number; info: number };
  total: number;
  majorCount: number;
}

/** Reading order for categories; `report.other` always comes last. */
const CATEGORY_ORDER: StringKey[] = [
  'report.missiles',
  'report.airdefence',
  'report.maritime',
  'report.logistics',
  'report.politics',
  'report.consequences',
  'report.other',
];

/** Information words that still change the player's picture when they fire. */
const SIGNIFICANT_INFO =
  /escalat|closed|clos(?:e|ing)\b|collapse|victory|defeat|signed|agreed|breakthrough|detected|revealed|intelligence|warning|ceasefire|talks/i;

/** A development worth interrupting for, versus a bookkeeping line. */
export function importanceOf(event: ResolveEvent): Importance {
  if (event.tone === 'bad' || event.tone === 'good') return 'major';
  if (SIGNIFICANT_INFO.test(event.text)) return 'major';
  return 'minor';
}

function rankOf(event: ResolveEvent): number {
  return event.tone === 'bad' ? 0 : event.tone === 'good' ? 1 : 2;
}

/**
 * Consequences outrank bookkeeping when choosing the headline. Tone alone used
 * to decide it, which meant a stockpile update that happened to resolve before
 * combat led the report over a missile that had just hit a base.
 */
const CONSEQUENCE =
  /struck|casualt|intercept|destroy|closed|collapse|escalat|victory|defeat|signed|agreed|breakthrough|ceasefire|retaliat|occup|strangl/i;

export function impactOf(event: ResolveEvent): number {
  const tone = event.tone === 'bad' ? 3 : event.tone === 'good' || event.tone === 'warn' ? 2 : 1;
  // Tone decides first — a bad development always leads — and a consequence
  // breaks the tie against bookkeeping of the same tone.
  return tone * 10 + (CONSEQUENCE.test(event.text) ? 3 : 0);
}

export function buildReport(events: ResolveEvent[]): TurnReport {
  const totals = { good: 0, bad: 0, info: 0 };
  for (const event of events) {
    if (event.tone === 'good') totals.good += 1;
    else if (event.tone === 'bad') totals.bad += 1;
    else totals.info += 1;
  }

  const majors: ResolveEvent[] = [];
  const minor: ResolveEvent[] = [];
  for (const event of events) {
    if (importanceOf(event) === 'major') majors.push(event);
    else minor.push(event);
  }

  // One group per category, ordered by the fixed reading order rather than by
  // whichever category happened to appear first this turn.
  const buckets = new Map<StringKey, ResolveEvent[]>();
  for (const event of majors) {
    const key = reportKey(event.text);
    const list = buckets.get(key) ?? [];
    list.push(event);
    buckets.set(key, list);
  }
  const groups: ReportGroup[] = [];
  for (const key of [...CATEGORY_ORDER, ...buckets.keys()]) {
    const list = buckets.get(key);
    if (!list || list.length === 0) continue;
    if (groups.some((group) => group.key === key)) continue;
    groups.push({ key, events: list });
  }

  const ranked = [...majors].sort((a, b) => impactOf(b) - impactOf(a) || rankOf(a) - rankOf(b));
  const headline = ranked[0] ?? null;

  return { headline, groups, minor, totals, total: events.length, majorCount: majors.length };
}
