/**
 * Goals & progress legibility (Workstream 3).
 *
 * Pure presentation helpers over existing victory/domestic/scorecard state.
 * No new simulation logic and no RNG — progress numbers are deterministic
 * functions of the snapshot so impact previews match resolution.
 */
import type { GameSnapshot, PlayableFactionId } from '../core/types';
import type { TheaterMap } from '../map/TheaterMap';
import { nodeState, operationalGulfBases } from '../core/world';
import {
  bestNuclearIntegrity,
  israeliOffensiveCapacity,
  regimeIntact,
  victoryPaths,
  type PathProgress,
  type VictoryPathId,
} from '../politics/victory';
import { domesticCfg } from '../politics/domestic';

export type ObjectiveTone = 'good' | 'warn' | 'bad' | 'info';

export interface ObjectiveRow {
  id: string;
  labelKey: string;
  progress: number;
  tone: ObjectiveTone;
  movesIt: string;
  stats: Record<string, string | number | boolean>;
  enemy: boolean;
  caption: string;
}

export interface ObjectivesView {
  rows: ObjectiveRow[];
  grade: number;
  gradeLabel: string;
}

function toneFor(progress: number, invert = false): ObjectiveTone {
  const p = invert ? 100 - progress : progress;
  if (p >= 70) return 'good';
  if (p >= 40) return 'warn';
  return 'bad';
}

function nuclearSites(snap: GameSnapshot): { id: string; integrity: number }[] {
  return ['isfahan', 'natanz', 'fordow'].map((id) => ({
    id,
    integrity: Math.round(nodeState(snap, id).integrity),
  }));
}

function coalitionRows(snap: GameSnapshot, map: TheaterMap): ObjectiveRow[] {
  const sites = nuclearSites(snap);
  const avgIntegrity = sites.reduce((s, n) => s + n.integrity, 0) / Math.max(1, sites.length);
  const nuclearProgress = Math.round(100 - avgIntegrity);
  const allDown = sites.every((s) => s.integrity <= 0);
  const warCost = snap.meters.iranWarCost;
  const warThreshold = snap.meters.iranWarCostThreshold || 100;
  const warProgress = Math.round(Math.min(100, (warCost / warThreshold) * 100));
  const d = snap.domestic;
  const cfg = domesticCfg(snap);
  const pressure = d?.pressure ?? 0;
  const domesticProgress = Math.round(100 - pressure);
  const bases = operationalGulfBases(snap, map);
  const basingProgress = Math.round(Math.min(100, (bases / 4) * 100));
  const oil = snap.meters.oilPrice;
  const oilStreak = snap.meters.oilShockStreak;
  const oilTurns = snap.victory?.oilShock.consecutiveTurns ?? 5;
  const hormuzSafe = Math.round(100 - Math.min(100, (oilStreak / oilTurns) * 100));

  return [
    {
      id: 'nuclear_degraded',
      labelKey: 'obj.nuclear',
      progress: allDown ? 100 : nuclearProgress,
      tone: toneFor(allDown ? 100 : nuclearProgress),
      movesIt: 'Strikes on Isfahan, Natanz, Fordow (B-2 for buried halls)',
      stats: {
        isfahan: sites[0]!.integrity,
        natanz: sites[1]!.integrity,
        fordow: sites[2]!.integrity,
        target: 'all ≤ 0 or sustained ≤ 40',
      },
      enemy: false,
      caption: allDown ? 'complex destroyed' : `avg ${Math.round(avgIntegrity)}% integrity`,
    },
    {
      id: 'war_cost',
      labelKey: 'obj.warCost',
      progress: warProgress,
      tone: toneFor(warProgress),
      movesIt: 'Successful strikes on Iranian forces, cities, and production',
      stats: { warCost: Math.round(warCost), threshold: warThreshold },
      enemy: false,
      caption: `${Math.round(warCost)} / ${warThreshold}`,
    },
    {
      id: 'domestic',
      labelKey: 'obj.domestic',
      progress: domesticProgress,
      tone: toneFor(domesticProgress),
      movesIt: 'Casualties, oil price, reinforcements, public address',
      stats: {
        pressure: Math.round(pressure),
        congress: Math.round(d?.congress ?? 60),
        economy: Math.round(d?.economy ?? 10),
        collapseAt: cfg.collapsePressure,
      },
      enemy: false,
      caption: `pressure ${Math.round(pressure)} (danger ≥${cfg.collapsePressure})`,
    },
    {
      id: 'basing',
      labelKey: 'obj.basing',
      progress: basingProgress,
      tone: toneFor(basingProgress),
      movesIt: 'Diplomacy and avoiding strikes that raise host threat',
      stats: { bases, needed: 3 },
      enemy: false,
      caption: `${bases} Gulf bases open`,
    },
    {
      id: 'hormuz_open',
      labelKey: 'obj.hormuz',
      progress: hormuzSafe,
      tone: toneFor(hormuzSafe),
      movesIt: 'Naval presence, ASM strikes, mine clearance; avoid sustained disruption',
      stats: {
        oil: Math.round(oil),
        threshold: snap.victory?.oilShock.indexThreshold ?? 130,
        streak: oilStreak,
        turns: oilTurns,
        hormuz: Math.round(snap.meters.hormuz),
      },
      enemy: false,
      caption: oilStreak > 0 ? `oil shock streak ${oilStreak}/${oilTurns}` : `oil $${Math.round(oil)}`,
    },
  ];
}

function iranRows(snap: GameSnapshot, map: TheaterMap): ObjectiveRow[] {
  const paths = victoryPaths(snap, map);
  const byId = new Map(paths.map((p) => [p.id, p]));

  const mapPath = (id: VictoryPathId, movesIt: string, caption: (p: PathProgress) => string): ObjectiveRow => {
    const p = byId.get(id);
    const progress = p?.progress ?? 0;
    return {
      id,
      labelKey: `path.${id}`,
      progress,
      tone: toneFor(progress),
      movesIt,
      stats: p?.stats ?? {},
      enemy: false,
      caption: p ? caption(p) : '—',
    };
  };

  return [
    mapPath(
      'regimeSurvival',
      'Keep Tehran intact and nuclear sites above the survival floor',
      (p) => `streak ${p.stats.streak}/${p.stats.turns}, best nuke ${p.stats.best}%`,
    ),
    mapPath(
      'noOccupation',
      'Deny US ground forces consecutive holds on Iranian nodes',
      (p) => (p.satisfied ? 'no occupation reached' : `occupation streak ${p.stats.streak}/${p.stats.turns}`),
    ),
    mapPath(
      'oilShock',
      'Sustained Hormuz disruption raises the oil index',
      (p) => `$${p.stats.price} · streak ${p.stats.streak}/${p.stats.turns}`,
    ),
    mapPath(
      'israeliDegradation',
      'Attrite Israeli airframes and magazines before the deadline',
      (p) => `capacity ${p.stats.capacity} (need <${p.stats.threshold} by T${p.stats.byTurn})`,
    ),
  ];
}

function enemyThreatRow(snap: GameSnapshot, map: TheaterMap, faction: PlayableFactionId): ObjectiveRow | null {
  if (faction === 'iran') {
    const sites = nuclearSites(snap);
    const avg = sites.reduce((s, n) => s + n.integrity, 0) / Math.max(1, sites.length);
    const progress = Math.round(100 - avg);
    return {
      id: 'enemy_nuclear',
      labelKey: 'obj.enemyNuclear',
      progress,
      tone: toneFor(progress, true),
      movesIt: 'Coalition strikes on Isfahan / Natanz / Fordow',
      stats: { avg: Math.round(avg) },
      enemy: true,
      caption: `complex avg ${Math.round(avg)}%`,
    };
  }

  const paths = victoryPaths(snap, map).filter((p) => !p.decidesAtEnd);
  if (paths.length === 0) return null;
  const worst = [...paths].sort((a, b) => b.progress - a.progress)[0]!;
  return {
    id: `enemy_${worst.id}`,
    labelKey: `path.${worst.id}`,
    progress: worst.progress,
    tone: toneFor(worst.progress, true),
    movesIt:
      worst.id === 'oilShock'
        ? 'Iranian ASM, mines, FAC near Hormuz'
        : 'Iranian strikes on Israeli air and magazines',
    stats: worst.stats,
    enemy: true,
    caption:
      worst.id === 'oilShock'
        ? `streak ${worst.stats.streak}/${worst.stats.turns}`
        : `capacity ${worst.stats.capacity}`,
  };
}

export function buildObjectives(snap: GameSnapshot, map: TheaterMap): ObjectivesView {
  const faction = snap.faction;
  const own = faction === 'iran' ? iranRows(snap, map) : coalitionRows(snap, map);
  const ranked = [...own].sort((a, b) => {
    const rank = (r: ObjectiveRow) => (r.tone === 'bad' ? 0 : r.tone === 'warn' ? 1 : 2);
    return rank(a) - rank(b) || b.progress - a.progress;
  });
  const top = ranked.slice(0, 3);
  const threat = enemyThreatRow(snap, map, faction);
  const rows = threat ? [...top, threat] : top;
  const grade =
    own.length === 0 ? 50 : Math.round(own.reduce((s, r) => s + r.progress, 0) / own.length);
  const gradeLabel =
    grade >= 70 ? 'strong' : grade >= 45 ? 'contested' : grade >= 25 ? 'strained' : 'critical';
  return { rows, grade, gradeLabel };
}

export interface ImpactPreview {
  lines: string[];
  risks: string[];
}

export function previewOrderImpact(
  snap: GameSnapshot,
  order: { kind: string; host?: string; packageId?: string; posture?: string },
): ImpactPreview {
  const lines: string[] = [];
  const risks: string[] = [];
  const cfg = domesticCfg(snap);

  switch (order.kind) {
    case 'strike': {
      lines.push('Expected: +war cost on Iranian targets, −magazine on the firing unit');
      lines.push('Host threat rises if the impact lands on host soil');
      if ((snap.domestic?.congress ?? 100) <= cfg.restrictCongress + 5) {
        risks.push('Congress near restriction threshold — further casualties may restrict strikes');
      }
      break;
    }
    case 'reinforce': {
      lines.push('Expected: package enters transit (2–4 turns); +economy pressure from cost');
      if (snap.meters.hormuz >= (snap.logisticsCfg?.interdictHormuz ?? 60)) {
        risks.push('Hormuz disruption high — package may accrue strait delay');
      }
      break;
    }
    case 'diplomacy': {
      lines.push(`Expected: −host threat for ${order.host ?? 'selected host'}, −political will`);
      break;
    }
    case 'airlift': {
      lines.push('Expected: +15 interceptors to Israel, −airlift budget');
      break;
    }
    case 'communicate': {
      const gain = cfg.communicate.gain;
      lines.push(`Expected: +${gain} congressional support, −${cfg.communicate.cost} political will`);
      lines.push(`Cooldown: ${cfg.communicate.cooldown} turns`);
      break;
    }
    case 'produce': {
      lines.push('Expected: −Iran resources, +stock of selected munition/drone type');
      break;
    }
    case 'roe': {
      if (order.posture === 'constrained') {
        lines.push('Expected: −escalation signature, +1 congress/turn, urban strikes blocked');
      } else if (order.posture === 'aggressive') {
        lines.push('Expected: +15% strike damage, ×1.5 escalation, −1 congress/turn, +host threat');
      } else {
        lines.push('Expected: standard damage and escalation multipliers');
      }
      break;
    }
    case 'israel-initiative': {
      lines.push('Expected: changes Israeli AI offensive probability next turns');
      break;
    }
    case 'talks': {
      lines.push('Expected: advances or collapses Qatar-mediated ceasefire progress');
      break;
    }
    default:
      lines.push('No meter preview for this order');
  }

  return { lines, risks };
}

export interface MeterDelta {
  key: string;
  label: string;
  before: number;
  after: number;
  delta: number;
}

export function meterDeltas(before: GameSnapshot, after: GameSnapshot): MeterDelta[] {
  const pairs: Array<{ key: string; label: string; b: number; a: number }> = [
    { key: 'warCost', label: 'Iran war cost', b: before.meters.iranWarCost, a: after.meters.iranWarCost },
    { key: 'oil', label: 'Oil price', b: before.meters.oilPrice, a: after.meters.oilPrice },
    { key: 'hormuz', label: 'Hormuz disruption', b: before.meters.hormuz, a: after.meters.hormuz },
    { key: 'will', label: 'Political will', b: before.resources.politicalWill, a: after.resources.politicalWill },
    {
      key: 'interceptors',
      label: 'US interceptors',
      b: before.resources.interceptorsUSA,
      a: after.resources.interceptorsUSA,
    },
    {
      key: 'pressure',
      label: 'Domestic pressure',
      b: before.domestic?.pressure ?? 0,
      a: after.domestic?.pressure ?? 0,
    },
    {
      key: 'congress',
      label: 'Congress support',
      b: before.domestic?.congress ?? 0,
      a: after.domestic?.congress ?? 0,
    },
    {
      key: 'escalation',
      label: 'Escalation',
      b: before.meters.nuclearEscalation,
      a: after.meters.nuclearEscalation,
    },
  ];
  return pairs
    .map((p) => ({
      key: p.key,
      label: p.label,
      before: Math.round(p.b),
      after: Math.round(p.a),
      delta: Math.round(p.a - p.b),
    }))
    .filter((d) => d.delta !== 0);
}

export function regimeStatus(snap: GameSnapshot): { intact: boolean; bestNuclear: number } {
  return { intact: regimeIntact(snap), bestNuclear: bestNuclearIntegrity(snap) };
}

export function israeliCapacity(snap: GameSnapshot): number {
  return israeliOffensiveCapacity(snap);
}
