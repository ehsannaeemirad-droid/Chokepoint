/**
 * Pure helpers behind the top strategic bar. Kept out of `Ui` so the warning
 * rules can be tested without a DOM, and so the bar cannot invent state: every
 * alert here is derived from a value the simulation already publishes.
 */
import type { GameSnapshot } from '../core/types';
import { domesticCfg } from '../politics/domestic';
import type { StringKey } from '../i18n';

export type Tone = 'ok' | 'warn' | 'alert' | 'info';

export interface ShellAlert {
  id: string;
  tone: Tone;
  key: StringKey;
  params?: Record<string, number>;
}

/** Lower is worse: `warnAt`/`alertAt` are floors, not ceilings. */
export function gaugeTone(value: number, warnAt: number, alertAt: number): Tone {
  if (value <= alertAt) return 'alert';
  if (value <= warnAt) return 'warn';
  return 'ok';
}

const RANK: Record<Tone, number> = { alert: 0, warn: 1, info: 2, ok: 3 };

/** The few things a commander must not miss, most urgent first. */
export function shellAlerts(snap: GameSnapshot): ShellAlert[] {
  const out: ShellAlert[] = [];
  const add = (id: string, tone: Tone, key: StringKey, params?: Record<string, number>) =>
    out.push({ id, tone, key, params });

  if (snap.resources.politicalWill <= 25) add('will', 'alert', 'alert.will');

  const interceptors =
    snap.faction === 'israel' ? snap.resources.interceptorsIsrael : snap.resources.interceptorsUSA;
  if (snap.faction !== 'iran' && interceptors <= 15) add('interceptors', 'warn', 'alert.interceptors');

  if (snap.meters.hormuz >= 70) add('hormuz', 'warn', 'alert.hormuz');
  if (snap.meters.nuclearEscalation >= 70) add('escalation', 'alert', 'alert.escalation');

  if (snap.domestic) {
    const cfg = domesticCfg(snap);
    if (snap.domestic.pressure >= cfg.collapsePressure) add('pressure', 'alert', 'alert.pressure');
  }

  const hosts = Object.values(snap.hosts ?? {});
  const threatened = hosts.filter((host) => host.status !== 'closed' && host.threat >= 80).length;
  if (threatened > 0) add('hosts', 'warn', 'alert.hostThreat', { n: threatened });

  const oilThreshold = snap.victory?.oilShock.indexThreshold ?? 130;
  if (snap.meters.oilPrice >= oilThreshold) add('oil', 'info', 'alert.oil');

  return out.sort((a, b) => RANK[a.tone] - RANK[b.tone]);
}

/** Which strategic-panel categories have something to say for this faction. */
export type StrategicTab =
  | 'situation'
  | 'military'
  | 'airDefence'
  | 'economy'
  | 'diplomacy'
  | 'politics';

export const STRATEGIC_TABS: StrategicTab[] = [
  'situation',
  'military',
  'airDefence',
  'economy',
  'diplomacy',
  'politics',
];

export function visibleTabs(html: Record<StrategicTab, string>): StrategicTab[] {
  return STRATEGIC_TABS.filter((tab) => (html[tab] ?? '').trim().length > 0);
}

export function activeTab(visible: StrategicTab[], wanted: StrategicTab): StrategicTab | null {
  if (visible.length === 0) return null;
  return visible.includes(wanted) ? wanted : visible[0]!;
}
