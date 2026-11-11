/**
 * Turn-order review (SPEC §32). Pure data so it can be tested without a DOM:
 * queued orders, what they will spend, validation errors, threat warnings and
 * the guaranteed / likely / uncertain consequences of resolving.
 */
import { orderReservations, validateOrder } from '../core/engine';
import type { GameSnapshot, Order, ResolveEvent } from '../core/types';
import type { TheaterMap } from '../map/TheaterMap';
import type { StringKey } from '../i18n';
import { getLang, localName, t } from '../i18n';
import { unitType } from '../core/world';
import { ISRAEL_AIRLIFT, REINFORCEMENTS } from '../core/engine';
import { factionLabel, unitLabel } from './labels';
import { previewOrderImpact } from './objectives';
import { rejectionText } from './reason';

export interface ReviewOrder {
  index: number;
  label: string;
  errors: string[];
  guaranteed: string[];
  likely: string[];
  uncertain: string[];
}

export interface ReviewSpend {
  label: string;
  value: string;
}

export interface TurnReview {
  orders: ReviewOrder[];
  spending: ReviewSpend[];
  warnings: string[];
  validCount: number;
}

function labelFor(snap: GameSnapshot, map: TheaterMap, order: Order): string {
  const unit = 'unitUid' in order ? snap.units.find((u) => u.uid === order.unitUid) : undefined;
  const name = unit ? unitLabel(unit) : '';
  const fa = getLang() === 'fa';
  switch (order.kind) {
    case 'move':
      return `${name} → ${order.col},${order.row}`;
    case 'strike': {
      const node = order.nodeId ? map.nodeById.get(order.nodeId) : undefined;
      return `${name} → ${node ? localName(node) : `${order.col},${order.row}`}`;
    }
    case 'mine':
      return fa ? `${name} → مین‌گذاری` : `${name} → lay mines`;
    case 'clear':
      return fa ? `${name} → پاکسازی مین` : `${name} → clear mines`;
    case 'escort':
      return fa ? `${name} → اسکورت` : `${name} → escort shipping`;
    case 'produce':
      return fa
        ? `تولید ۱× ${localName(unitType(order.unitTypeId))}`
        : `Produce 1× ${unitType(order.unitTypeId).name}`;
    case 'diplomacy':
      return fa ? `رایزنی با ${factionLabel(order.host)}` : `Signal ${factionLabel(order.host)}`;
    case 'reinforce':
      return REINFORCEMENTS.find((r) => r.id === order.packageId)?.label ?? (fa ? 'نیروی کمکی' : 'Reinforcement');
    case 'airlift':
      return ISRAEL_AIRLIFT.label;
    case 'communicate':
      return fa ? 'پیام عمومی' : 'Public address';
    case 'aid':
      return fa
        ? `کمک ${order.patron === 'russia' ? 'روسیه' : 'چین'} · ${order.aid}`
        : `${order.patron === 'russia' ? 'Russia' : 'China'} aid · ${order.aid}`;
    case 'israel-initiative':
      return fa ? `دستور اسرائیل: ${order.stance}` : `Israel directive: ${order.stance}`;
    case 'talks':
      return fa ? (order.stance === 'pursue' ? 'پیگیری مذاکرات' : 'ترک مذاکرات') : order.stance === 'pursue' ? 'Pursue talks' : 'Walk away';
    case 'roe':
      return t('review.roe', { posture: t(`roe.${order.posture}`) });
    case 'nuclear':
      return fa ? 'آزمایش هسته‌ای' : 'Nuclear release';
    case 'special':
      return fa ? `${name} → خرابکاری` : `${name} → sabotage`;
    case 'cyber':
      return fa ? `${name} → عملیات سایبری` : `${name} → cyber operation`;
    case 'hold':
    default:
      return name ? `${name} → ${fa ? 'حفظ موضع' : 'hold'}` : fa ? 'حفظ موضع' : 'Hold';
  }
}

function guaranteedFor(order: Order): string[] {
  switch (order.kind) {
    case 'strike':
      return [t('review.guaranteedSortie')];
    case 'move':
      return [t('review.guaranteedMove')];
    case 'mine':
      return [t('review.guaranteedMines')];
    case 'clear':
      return [t('review.guaranteedClear')];
    case 'escort':
      return [t('review.guaranteedEscort')];
    case 'hold':
      return [t('review.guaranteedHold')];
    default:
      return [];
  }
}

export function buildTurnReview(snap: GameSnapshot, map: TheaterMap): TurnReview {
  const reserved = orderReservations(snap);
  const orders: ReviewOrder[] = snap.orders.map((order, index) => {
    const errors: string[] = [];
    const check = validateOrder(snap, map, order);
    if (!check.ok) errors.push(rejectionText(check));
    const preview = previewOrderImpact(snap, order as { kind: string; host?: string; packageId?: string; posture?: string });
    return {
      index,
      label: labelFor(snap, map, order),
      errors,
      guaranteed: guaranteedFor(order),
      likely: preview.lines,
      uncertain: preview.risks,
    };
  });

  const spending: ReviewSpend[] = [];
  if (reserved.politicalWill > 0) spending.push({ label: t('review.will'), value: `−${reserved.politicalWill}` });
  if (reserved.tankers > 0) spending.push({ label: t('review.tankers'), value: `−${reserved.tankers}` });
  if (reserved.airlift > 0) spending.push({ label: t('review.airlift'), value: `−${reserved.airlift}` });
  if (reserved.mines > 0) spending.push({ label: t('review.mines'), value: `−${reserved.mines}` });
  const rounds = Object.entries(reserved.rounds).filter(([, n]) => n > 0);
  if (rounds.length > 0) {
    spending.push({
      label: t('review.rounds'),
      value: rounds.map(([cls, n]) => `${cls} −${n}`).join(', '),
    });
  }
  const sorties = Object.entries(reserved.sorties).filter(([, n]) => n > 0);
  if (sorties.length > 0) {
    spending.push({
      label: t('review.sorties'),
      value: sorties.map(([cls, n]) => `${cls} −${n}`).join(', '),
    });
  }

  const warnings: string[] = [];
  if (snap.resources.politicalWill < 20) warnings.push(t('review.warnWill'));
  if ((snap.iranDomestic?.stability ?? 100) < 30) warnings.push(t('review.warnStability'));
  if (snap.meters.hormuz >= 60) warnings.push(t('review.warnHormuz'));
  if (snap.resources.interceptorsUSA < 30 && snap.faction !== 'iran') warnings.push(t('review.warnInterceptors'));
  const detected = Object.values(snap.minefields ?? {}).filter((f) => f.detected && f.mines > 0).length;
  if (detected > 0) warnings.push(t('review.warnMines', { n: detected }));
  if (snap.turn >= snap.maxTurns) warnings.push(t('review.warnFinalTurn'));

  return {
    orders,
    spending,
    warnings,
    validCount: orders.filter((o) => o.errors.length === 0).length,
  };
}

export interface ReportGroup {
  key: StringKey;
  events: ResolveEvent[];
}

const CATEGORY: Array<[StringKey, RegExp]> = [
  ['report.airdefence', /\b(intercept|Patriot|THAAD|Arrow|David'?s Sling|air defen[cs]e|radar)\b/i],
  ['report.maritime', /\b(Hormuz|mine|mines|minefield|escort|shipping|naval|Bab al-Mandeb|tanker|convoy|strait)\b/i],
  ['report.logistics', /\b(airlift|produced|production|rearm|resupply|reinforcement|arrived|repair|logistics)\b/i],
  ['report.politics', /\b(Congress|political will|support|host|threat|talks|ceasefire|sanction|signal|diplomat|election|stability)\b/i],
  ['report.missiles', /\b(launch|launched|salvo|drone|ballistic|hypersonic|missile|Shahed|Fateh|Khorramshahr|Fattah)\b/i],
  ['report.consequences', /\b(escalation|nuclear|casualt|will|scorecard|victory|defeat|withdraw)\b/i],
];

export function reportKey(text: string): StringKey {
  for (const [key, pattern] of CATEGORY) if (pattern.test(text)) return key;
  return 'report.other';
}

/** Group events by category, preserving their original order inside a group. */
export function reportGroups(events: ResolveEvent[]): ReportGroup[] {
  const groups: ReportGroup[] = [];
  for (const event of events) {
    const key = reportKey(event.text);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.events.push(event);
    else groups.push({ key, events: [event] });
  }
  return groups;
}
