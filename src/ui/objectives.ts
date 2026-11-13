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
import { t } from '../i18n';
import { factionLabel } from './labels';

export type ObjectiveTone = 'good' | 'warn' | 'bad' | 'info';

export interface ObjectiveRow {
  id: string;
  /** i18n key for the short name. */
  labelKey: string;
  /** 0-100 progress toward the path (player-relative: higher is better for the viewer). */
  progress: number;
  tone: ObjectiveTone;
  /** One-line "what moves it" — English; UI localises via i18n when keyed. */
  movesIt: string;
  /** Raw stats for the explainer panel. */
  stats: Record<string, string | number | boolean>;
  /** True when this is an enemy path the player must prevent. */
  enemy: boolean;
  /** Streak / threshold summary for the bar caption. */
  caption: string;
}

export interface ObjectivesView {
  rows: ObjectiveRow[];
  /** Live scorecard-style grade estimate 0-100 for the player side. */
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

/** Player-relative progress for coalition (US/Israel) win paths. */
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
  const oilThreshold = snap.victory?.oilShock.indexThreshold ?? 130;
  const oilStreak = snap.meters.oilShockStreak;
  const oilTurns = snap.victory?.oilShock.consecutiveTurns ?? 5;
  // Higher is safer for coalition: inverse of oil-shock progress.
  const hormuzSafe = Math.round(100 - Math.min(100, (oilStreak / oilTurns) * 100));

  const rows: ObjectiveRow[] = [
    {
      id: 'nuclear_degraded',
      labelKey: 'obj.nuclear',
      progress: allDown ? 100 : nuclearProgress,
      tone: toneFor(allDown ? 100 : nuclearProgress),
      movesIt: t('obj.move.nuclear'),
      stats: {
        isfahan: sites[0]!.integrity,
        natanz: sites[1]!.integrity,
        fordow: sites[2]!.integrity,
        target: 'all ≤ 0 or sustained ≤ 40',
      },
      enemy: false,
      caption: allDown
        ? t('obj.cap.destroyed')
        : t('obj.cap.integrity', { n: Math.round(avgIntegrity) }),
    },
    {
      id: 'war_cost',
      labelKey: 'obj.warCost',
      progress: warProgress,
      tone: toneFor(warProgress),
      movesIt: t('obj.move.warCost'),
      stats: { warCost: Math.round(warCost), threshold: warThreshold },
      enemy: false,
      caption: `${Math.round(warCost)} / ${warThreshold}`,
    },
    {
      id: 'domestic',
      labelKey: 'obj.domestic',
      progress: domesticProgress,
      tone: toneFor(domesticProgress),
      movesIt: t('obj.move.domestic'),
      stats: {
        pressure: Math.round(pressure),
        congress: Math.round(d?.congress ?? 60),
        economy: Math.round(d?.economy ?? 10),
        collapseAt: cfg.collapsePressure,
      },
      enemy: false,
      caption: t('obj.cap.pressure', { n: Math.round(pressure), max: cfg.collapsePressure }),
    },
    {
      id: 'basing',
      labelKey: 'obj.basing',
      progress: basingProgress,
      tone: toneFor(basingProgress),
      movesIt: t('obj.move.basing'),
      stats: { bases, needed: 3 },
      enemy: false,
      caption: t('obj.cap.bases', { n: bases }),
    },
    {
      id: 'hormuz_open',
      labelKey: 'obj.hormuz',
      progress: hormuzSafe,
      tone: toneFor(hormuzSafe),
      movesIt: t('obj.move.hormuz'),
      stats: {
        oil: Math.round(oil),
        threshold: oilThreshold,
        streak: oilStreak,
        turns: oilTurns,
        hormuz: Math.round(snap.meters.hormuz),
      },
      enemy: false,
      caption:
        oilStreak > 0
          ? t('obj.cap.oilStreak', { n: oilStreak, turns: oilTurns })
          : t('obj.cap.oilPrice', { n: Math.round(oil) }),
    },
  ];

  return rows;
}

/** Player-relative progress for Iran's four victory paths. */
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
      t('obj.move.regime'),
      (p) =>
        t('obj.cap.regimeStreak', {
          streak: String(p.stats.streak),
          turns: String(p.stats.turns),
          best: String(p.stats.best),
        }),
    ),
    mapPath(
      'noOccupation',
      t('obj.move.noOccupation'),
      (p) =>
        p.satisfied
          ? t('obj.cap.noOccupation')
          : t('obj.cap.occupationStreak', {
              streak: String(p.stats.streak),
              turns: String(p.stats.turns),
            }),
    ),
    mapPath(
      'oilShock',
      t('obj.move.oilShock'),
      (p) =>
        t('obj.cap.oilPath', {
          price: String(p.stats.price),
          streak: String(p.stats.streak),
          turns: String(p.stats.turns),
        }),
    ),
    mapPath(
      'israeliDegradation',
      t('obj.move.israeli'),
      (p) =>
        t('obj.cap.capacity', {
          n: String(p.stats.capacity),
          threshold: String(p.stats.threshold),
          turn: String(p.stats.byTurn),
        }),
    ),
  ];
}

/** Most dangerous enemy path from the player's point of view. */
function enemyThreatRow(snap: GameSnapshot, map: TheaterMap, faction: PlayableFactionId): ObjectiveRow | null {
  if (faction === 'iran') {
    // Coalition threat: nuclear complex being degraded.
    const sites = nuclearSites(snap);
    const avg = sites.reduce((s, n) => s + n.integrity, 0) / Math.max(1, sites.length);
    const progress = Math.round(100 - avg); // high = bad for Iran
    return {
      id: 'enemy_nuclear',
      labelKey: 'obj.enemyNuclear',
      progress,
      tone: toneFor(progress, true),
      movesIt: t('obj.move.enemyNuclear'),
      stats: { avg: Math.round(avg) },
      enemy: true,
      caption: t('obj.cap.complex', { n: Math.round(avg) }),
    };
  }

  // Coalition player: watch Iran's strongest immediate path.
  const paths = victoryPaths(snap, map).filter((p) => !p.decidesAtEnd);
  if (paths.length === 0) return null;
  const worst = [...paths].sort((a, b) => b.progress - a.progress)[0]!;
  return {
    id: `enemy_${worst.id}`,
    labelKey: `path.${worst.id}`,
    progress: worst.progress,
    tone: toneFor(worst.progress, true),
    movesIt:
      worst.id === 'oilShock' ? t('obj.move.enemyOil') : t('obj.move.enemyIsrael'),
    stats: worst.stats,
    enemy: true,
    caption:
      worst.id === 'oilShock'
        ? t('obj.cap.streak', { n: String(worst.stats.streak), turns: String(worst.stats.turns) })
        : t('obj.cap.capacityShort', { n: String(worst.stats.capacity) }),
  };
}

/**
 * Live objectives view for the persistent strip.
 * Shows the player's top paths + the single most dangerous enemy path.
 */
export function buildObjectives(snap: GameSnapshot, map: TheaterMap): ObjectivesView {
  const faction = snap.faction;
  const own = faction === 'iran' ? iranRows(snap, map) : coalitionRows(snap, map);
  // Rank own paths: lowest progress first for attention, but keep nuclear/war-cost near top for coalition.
  const ranked = [...own].sort((a, b) => {
    // Critical first.
    const rank = (r: ObjectiveRow) => (r.tone === 'bad' ? 0 : r.tone === 'warn' ? 1 : 2);
    return rank(a) - rank(b) || b.progress - a.progress;
  });
  const top = ranked.slice(0, 3);
  const threat = enemyThreatRow(snap, map, faction);
  const rows = threat ? [...top, threat] : top;

  // Simple live grade: average of own top paths.
  const grade =
    own.length === 0 ? 50 : Math.round(own.reduce((s, r) => s + r.progress, 0) / own.length);
  const gradeLabel =
    grade >= 70
      ? t('grade.strong')
      : grade >= 45
        ? t('grade.contested')
        : grade >= 25
          ? t('grade.strained')
          : t('grade.critical');

  return { rows, grade, gradeLabel };
}

/**
 * Deterministic impact preview for an order about to be queued.
 * Uses only current snapshot meters — does not invent randomness.
 * Ranges are conservative static estimates documented in DESIGN.md.
 */
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
      lines.push(t('impact.strike.1'));
      lines.push(t('impact.strike.2'));
      if ((snap.domestic?.congress ?? 100) <= cfg.restrictCongress + 5) {
        risks.push(t('impact.strike.risk'));
      }
      break;
    }
    case 'reinforce': {
      lines.push(t('impact.reinforce.1'));
      if (snap.meters.hormuz >= (snap.logisticsCfg?.interdictHormuz ?? 60)) {
        risks.push(t('impact.reinforce.risk'));
      }
      break;
    }
    case 'diplomacy': {
      lines.push(
        t('impact.diplomacy', {
          host: order.host ? factionLabel(order.host) : t('impact.selectedHost'),
        }),
      );
      break;
    }
    case 'airlift': {
      lines.push(t('impact.airlift'));
      break;
    }
    case 'communicate': {
      const gain = cfg.communicate.gain;
      lines.push(t('impact.communicate.1', { gain, cost: cfg.communicate.cost }));
      lines.push(t('impact.communicate.2', { n: cfg.communicate.cooldown }));
      break;
    }
    case 'produce': {
      lines.push(t('impact.produce'));
      break;
    }
    case 'mine': {
      lines.push(t('impact.mine'));
      break;
    }
    case 'clear': {
      lines.push(t('impact.clear'));
      break;
    }
    case 'escort': {
      lines.push(t('impact.escort'));
      break;
    }
    case 'roe': {
      if (order.posture === 'constrained') {
        lines.push(t('impact.roe.constrained'));
      } else if (order.posture === 'aggressive') {
        lines.push(t('impact.roe.aggressive'));
      } else {
        lines.push(t('impact.roe.standard'));
      }
      break;
    }
    case 'israel-initiative': {
      lines.push(t('impact.initiative'));
      break;
    }
    case 'talks': {
      lines.push(t('impact.talks'));
      break;
    }
    default:
      lines.push(t('impact.default'));
  }

  return { lines, risks };
}

/** Meter deltas between two snapshots (for the after-action card). */
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
