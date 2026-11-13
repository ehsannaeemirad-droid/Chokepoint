/**
 * Victory conditions, Phase 1: four independent, measurable Iranian paths.
 *
 * Every threshold lives in the scenario data (`snap.victory`, sourced from
 * `src/data/scenarios.json`), never in code. All state used here is plain
 * snapshot state and no function consumes the RNG, so the determinism
 * guarantee is untouched: two identical seeds still produce byte-identical
 * snapshots.
 *
 * Paths
 *  1. `regimeSurvival`      — regime intact through the final N turns and at
 *                             least one nuclear facility still above a set
 *                             integrity threshold when the campaign ends.
 *  2. `noOccupation`        — US ground forces never hold enough Iranian nodes
 *                             for enough consecutive turns.
 *  3. `oilShock`            — the global oil price index stays above a
 *                             threshold for a set number of consecutive turns.
 *  4. `israeliDegradation`  — Israel's measurable offensive air capacity falls
 *                             below a threshold by a set deadline turn.
 *
 * Paths 1 and 2 are decided only at the final turn. Paths 3 and 4 end the
 * campaign the moment they are satisfied, whichever faction the player runs.
 */
import type { GameSnapshot } from '../core/types';
import { clamp, nodeState, operationalGulfBases, unitType } from '../core/world';
import { armisticeOutcome } from './talks';
import type { TheaterMap } from '../map/TheaterMap';

export type VictoryPathId = 'regimeSurvival' | 'noOccupation' | 'oilShock' | 'israeliDegradation';

export interface VictoryThresholds {
  regimeSurvival: { finalTurns: number; nuclearIntegrityThreshold: number };
  occupation: { nodesRequired: number; turnsRequired: number };
  oilShock: { indexThreshold: number; consecutiveTurns: number };
  israeliDegradation: { capacityThreshold: number; byTurn: number };
}

/** Used when a loaded v1 save predates the victory block (never for the tutorial). */
export const DEFAULT_VICTORY: VictoryThresholds = {
  regimeSurvival: { finalTurns: 10, nuclearIntegrityThreshold: 40 },
  occupation: { nodesRequired: 4, turnsRequired: 3 },
  oilShock: { indexThreshold: 130, consecutiveTurns: 5 },
  israeliDegradation: { capacityThreshold: 30, byTurn: 25 },
};

const NUCLEAR_SITES = ['isfahan', 'natanz', 'fordow'];

/**
 * The regime stands: institutions hold. Capital damage alone is not a collapse
 * switch (SPEC §24), so stability is the gate, with the capital condition kept
 * as one material input rather than the deciding one.
 */
export function regimeIntact(snap: GameSnapshot): boolean {
  const stability = snap.iranDomestic?.stability ?? 100;
  return stability >= 25 && snap.meters.leadershipStrikes <= 3;
}

/** Best integrity still standing among Iran's three nuclear facilities. */
export function bestNuclearIntegrity(snap: GameSnapshot): number {
  return Math.max(...NUCLEAR_SITES.map((id) => nodeState(snap, id).integrity));
}

/**
 * Measurable Israeli offensive capacity, 0-100.
 *
 * Airframes carry 75% of the weight (losses are permanent in this engine),
 * magazine readiness 25%. The index is measured against the Israeli air order
 * of battle at scenario start, so losing a squadron halves the index while
 * magazines only modulate it — drained magazines recover in two turns, lost
 * aircraft never come back.
 */
export function israeliOffensiveCapacity(snap: GameSnapshot): number {
  const air = snap.units.filter((u) => u.faction === 'israel' && unitType(u.typeId).category === 'air');
  const baseline = Math.max(1, snap.meters.israeliAirAtStart || air.length);
  let readiness = 0;
  for (const unit of air) {
    const def = unitType(unit.typeId);
    const mag = def.magazine > 0 ? clamp(unit.magazine / def.magazine, 0, 1) : 1;
    readiness += (unit.strength / 100) * (0.75 + 0.25 * mag);
  }
  return clamp(Math.round((readiness / baseline) * 100), 0, 100);
}

export const IRAN_SCORE_THRESHOLD = 55;
export const COALITION_SCORE_THRESHOLD = 60;

export interface StrategicScore {
  score: number;
  parts: Record<string, number>;
}

/**
 * Iran's strategic result, 0-100, from several dimensions rather than the mere
 * absence of ground occupation (SPEC §27): retained deterrent, institutional
 * stability, economic resilience, costs imposed, regional leverage and
 * negotiating position.
 */
export function iranStrategicScore(snap: GameSnapshot, map: TheaterMap): StrategicScore {
  void map;
  const m = snap.meters;
  const d = snap.iranDomestic;
  const launchers = snap.units.filter(
    (u) => u.typeId === 'asm_launcher' || u.typeId === 'fateh110' || u.typeId === 'khorramshahr',
  ).length;
  const start = Math.max(1, m.launchersAtStart || launchers);
  const warShare = clamp(m.iranWarCost / Math.max(1, m.iranWarCostThreshold), 0, 1);

  const parts = {
    deterrent: clamp(Math.round((launchers / start) * 20), 0, 20),
    stability: clamp(Math.round(((d?.stability ?? 70) / 100) * 20), 0, 20),
    economy: clamp(Math.round((1 - (d?.economicPressure ?? 25) / 100) * 10), 0, 10),
    costs: clamp(
      Math.round(warShare * 15 + (m.hormuz > 50 ? 5 : 0) + (m.oilPrice >= 130 ? 5 : 0)),
      0,
      25,
    ),
    region: clamp(Math.round(Math.min(1, m.hormuzTurnsAbove50 / 6) * 15), 0, 15),
    negotiation: clamp(Math.round(((d?.negotiationPosition ?? 40) / 100) * 10), 0, 10),
  };
  const score = clamp(Object.values(parts).reduce((s, v) => s + v, 0), 0, 100);
  return { score, parts };
}

/**
 * The coalition's strategic result, 0-100. Destroying the nuclear complex is
 * worth a quarter, not the war: access, threat reduction, domestic support,
 * costs imposed and political will must also hold (SPEC §27).
 */
export function coalitionStrategicScore(snap: GameSnapshot, map: TheaterMap): StrategicScore {
  const m = snap.meters;
  const bases = operationalGulfBases(snap, map);
  const best = bestNuclearIntegrity(snap);
  const launchers = snap.units.filter(
    (u) => u.typeId === 'asm_launcher' || u.typeId === 'fateh110' || u.typeId === 'khorramshahr',
  ).length;
  const start = Math.max(1, m.launchersAtStart || launchers);
  const congress = snap.domestic?.congress ?? 60;

  const parts = {
    nuclear: best <= 0 ? 25 : best < 25 ? 15 : best < 40 ? 8 : 0,
    threat: launchers < start * 0.5 ? 20 : launchers < start * 0.75 ? 10 : 0,
    access: bases >= 3 ? 15 : bases >= 2 ? 8 : 0,
    domestic: congress >= 40 ? 15 : congress >= 30 ? 8 : 0,
    cost: m.iranWarCost >= m.iranWarCostThreshold * 0.8 ? 15 : 0,
    will: snap.resources.politicalWill >= 40 ? 10 : 0,
  };
  const score = clamp(Object.values(parts).reduce((s, v) => s + v, 0), 0, 100);
  return { score, parts };
}

/**
 * Iranian nodes currently held by US ground formations. "Holding" means a
 * ground-category unit of the US sits on the node's hex. The current US
 * roster has no ground-category formations, so this is 0 today; the rule
 * exists so the path reacts the moment ground forces enter the theatre.
 */
export function occupiedIranianNodes(snap: GameSnapshot, map: TheaterMap): number {
  const held = new Set<string>();
  for (const unit of snap.units) {
    if (unit.faction !== 'usa') continue;
    if (unitType(unit.typeId).category !== 'ground') continue;
    const nodeId = map.hexToNode.get(`${unit.col},${unit.row}`);
    if (!nodeId) continue;
    const node = map.nodeById.get(nodeId);
    if (node && node.host === 'iran') held.add(nodeId);
  }
  return held.size;
}

/**
 * Once per resolved turn, after attrition and chokepoint economics:
 * advance (or reset) the three per-turn streaks the paths depend on.
 * Pure state arithmetic — no RNG, so replays stay byte-identical.
 */
export function updateVictoryClocks(snap: GameSnapshot, map: TheaterMap): void {
  if (!snap.victory) return;
  const v = snap.victory;
  const m = snap.meters;

  m.regimeIntactStreak = regimeIntact(snap) ? m.regimeIntactStreak + 1 : 0;

  const occupied = occupiedIranianNodes(snap, map);
  m.occupationStreak = occupied >= v.occupation.nodesRequired ? m.occupationStreak + 1 : 0;
  m.maxOccupationStreak = Math.max(m.maxOccupationStreak, m.occupationStreak);

  m.oilShockStreak = m.oilPrice >= v.oilShock.indexThreshold ? m.oilShockStreak + 1 : 0;
}

export interface PathProgress {
  id: VictoryPathId;
  /**
   * True when the path would count as achieved if the campaign ended right
   * now. For the two immediate paths this is also the live trigger.
   */
  satisfied: boolean;
  /** True when the path can only be decided on the final turn. */
  decidesAtEnd: boolean;
  /** 0-100; for `noOccupation` it starts at 100 and falls as occupation bites. */
  progress: number;
  /** Raw values for the localised detail line. */
  stats: Record<string, string | number>;
}

/** Live progress for all four paths, for the strategic panel and the outcome check. */
export function victoryPaths(snap: GameSnapshot, map: TheaterMap): PathProgress[] {
  const v = snap.victory;
  if (!v) return [];
  const m = snap.meters;
  const paths: PathProgress[] = [];

  // 1. Regime survival — decided at the final turn.
  {
    const streak = m.regimeIntactStreak;
    const best = bestNuclearIntegrity(snap);
    const turns = v.regimeSurvival.finalTurns;
    const threshold = v.regimeSurvival.nuclearIntegrityThreshold;
    const streakPct = Math.min(100, (streak / turns) * 100);
    const nuclearPct = Math.min(100, (best / threshold) * 100);
    paths.push({
      id: 'regimeSurvival',
      satisfied:
        streak >= turns &&
        best > threshold &&
        (snap.iranDomestic?.stability ?? 100) >= 40 &&
        iranStrategicScore(snap, map).parts.deterrent! > 0,
      decidesAtEnd: true,
      progress: Math.round(Math.min(streakPct, nuclearPct)),
      stats: { streak, turns, best: Math.round(best), threshold },
    });
  }

  // 2. Strategic endurance — no occupation is necessary but not sufficient.
  //    Iran must also hold the dimensions that make survival a result.
  {
    const held = occupiedIranianNodes(snap, map);
    const streak = m.maxOccupationStreak;
    const nodes = v.occupation.nodesRequired;
    const turns = v.occupation.turnsRequired;
    const strategic = iranStrategicScore(snap, map);
    const noOcc = 100 - Math.min(100, (streak / turns) * 100);
    paths.push({
      id: 'noOccupation',
      satisfied: streak < turns && strategic.score >= IRAN_SCORE_THRESHOLD,
      decidesAtEnd: true,
      progress: Math.round(Math.min(noOcc, (strategic.score / IRAN_SCORE_THRESHOLD) * 100)),
      stats: { held, nodes, streak, turns, score: strategic.score, threshold: IRAN_SCORE_THRESHOLD },
    });
  }

  // 3. Oil shock — immediate once the streak completes.
  {
    const streak = m.oilShockStreak;
    const turns = v.oilShock.consecutiveTurns;
    paths.push({
      id: 'oilShock',
      satisfied: streak >= turns,
      decidesAtEnd: false,
      progress: Math.round(Math.min(100, (streak / turns) * 100)),
      stats: { price: Math.round(m.oilPrice), streak, turns, threshold: v.oilShock.indexThreshold },
    });
  }

  // 4. Israeli offense degraded — deadline check at `byTurn`.
  {
    const capacity = israeliOffensiveCapacity(snap);
    const threshold = v.israeliDegradation.capacityThreshold;
    const span = 100 - threshold;
    const progress = span > 0 ? Math.min(100, ((100 - capacity) / span) * 100) : capacity < threshold ? 100 : 0;
    paths.push({
      id: 'israeliDegradation',
      satisfied: snap.turn >= v.israeliDegradation.byTurn && capacity < threshold,
      decidesAtEnd: false,
      progress: Math.round(progress),
      stats: { capacity, threshold, byTurn: v.israeliDegradation.byTurn },
    });
  }

  return paths;
}

/** Outcome strings are engine narrative; they stay English like the battle log (Phase 6 templatizes them). */
const PATH_OUTCOME_TEXT: Record<VictoryPathId, string> = {
  regimeSurvival:
    'The campaign has ended. The regime is still standing and its nuclear complex was never pushed below the survival threshold — Iran outlasted the coalition.',
  noOccupation:
    'The campaign has ended. Iran avoided occupation and still held a credible deterrent, cohesive institutions and enough leverage to claim a strategic result.',
  oilShock:
    'The oil shock has arrived: with Hormuz strangled for turns on end the price index blew through the threshold and held. The coalition economies blinked first.',
  israeliDegradation:
    "Israel's offensive air arm has been worn down past the breaking point — too few squadrons remain combat-ready. Iran has degraded the coalition's sharpest sword.",
};

export interface Outcome {
  status: 'playing' | 'won' | 'lost' | 'drawn';
  outcome: string;
}

/**
 * Phase 2: the US domestic consensus can also lose the campaign. The single
 * domestic gauge (`snap.domestic.pressure`) is driven by congressional support
 * and economic pressure; when it holds at/above the collapse threshold for the
 * configured number of consecutive turns, Washington withdraws.
 */
export function usDomesticLoss(snap: GameSnapshot): boolean {
  const d = snap.domestic;
  if (!d) return false;
  const cfg = snap.domesticCfg;
  const collapseAt = cfg?.collapsePressure ?? 85;
  const turns = cfg?.collapseTurns ?? 2;
  return d.pressure >= collapseAt && (snap.meters.domesticPressureStreak ?? 0) >= turns;
}

/** Check every faction's victory/defeat conditions (player-relative result). */
export function checkOutcome(snap: GameSnapshot, map: TheaterMap): Outcome {
  const bases = operationalGulfBases(snap, map);
  const hardenedDown = NUCLEAR_SITES.map((id) => nodeState(snap, id).integrity).every((v) => v <= 0);
  const csgAlive = snap.units.some((u) => u.typeId === 'csg');
  const launchers = snap.units.filter(
    (u) => u.typeId === 'asm_launcher' || u.typeId === 'fateh110' || u.typeId === 'khorramshahr',
  ).length;

  // A nuclear release is never a campaign victory, whatever the map says.
  if (snap.meters.nuclearStrikes > 0 && (snap.faction === 'usa' || snap.faction === 'israel')) {
    return {
      status: 'lost',
      outcome:
        'The first nuclear release since 1945. Russia and China put their forces on alert, every Gulf host closed its bases and the campaign ends in a global crisis — not a victory.',
    };
  }

  const iranScore = iranStrategicScore(snap, map).score;
  const coalitionScore = coalitionStrategicScore(snap, map).score;

  // Immediate Iranian path wins (any player at the table).
  if (snap.victory) {
    const immediate = victoryPaths(snap, map).find(
      (p) => p.satisfied && !p.decidesAtEnd && (p.id === 'oilShock' || p.id === 'israeliDegradation'),
    );
    if (immediate) {
      const won = snap.faction === 'iran';
      return { status: won ? 'won' : 'lost', outcome: PATH_OUTCOME_TEXT[immediate.id] };
    }
  }

  // A signed armistice supersedes the map: tiered outcome, player-relative.
  // Favorable terms are a coalition win; costly terms are an Iranian win.
  const armistice = armisticeOutcome(snap, map);
  if (armistice) {
    const coalitionWon = armistice.tier === 'favorable';
    const won = snap.faction === 'iran' ? !coalitionWon : coalitionWon;
    return { status: won ? 'won' : 'lost', outcome: armistice.text };
  }

  if (snap.faction === 'usa') {
    const iranCeasefire =
      snap.meters.iranWarCost >= snap.meters.iranWarCostThreshold && bases >= 3 && !snap.pakistanTriggered;
    if (hardenedDown && coalitionScore >= COALITION_SCORE_THRESHOLD) {
      return {
        status: 'won',
        outcome:
          'Iran’s hardened nuclear complex is destroyed, its launch force is broken, the basing network holds and Congress is still behind the war. The programme is set back a decade.',
      };
    }
    if (iranCeasefire) {
      return {
        status: 'won',
        outcome: 'Iran accepted a ceasefire: its war cost passed the threshold while the Gulf basing network held.',
      };
    }
    // Mirror of the Iran-player win below: the same world state must end the
    // campaign for whoever is sitting at the screen.
    if (usDomesticLoss(snap)) {
      return {
        status: 'lost',
        outcome:
          'The domestic consensus collapsed: congressional support and economic pressure broke the war coalition. Washington orders a general withdrawal.',
      };
    }
    if (snap.resources.politicalWill <= 0) {
      return {
        status: 'lost',
        outcome: 'US political will reached zero. Washington orders a general withdrawal; the campaign is lost at home.',
      };
    }
    if (bases === 0) {
      return { status: 'lost', outcome: 'Every major Gulf base is out of action. Washington orders a general withdrawal.' };
    }
    if (!csgAlive && bases < 2) {
      return { status: 'lost', outcome: 'The carrier strike group is lost and fewer than two bases remain: political will collapses.' };
    }
  }

  if (snap.faction === 'israel') {
    if (
      snap.turn > 25 &&
      snap.meters.populationImpacts <= 2 &&
      launchers < snap.meters.launchersAtStart * 0.3
    ) {
      return {
        status: 'won',
        outcome: 'Israel held out for 25 turns, kept its cities intact and broke Iran’s launch force.',
      };
    }
    if (snap.resources.interceptorsIsrael <= 0 && snap.meters.populationImpacts >= 5) {
      return { status: 'lost', outcome: 'Interceptors are exhausted and five missiles have landed on Israeli cities. Domestic collapse.' };
    }
  }

  if (snap.faction === 'iran') {
    if (snap.resources.politicalWill <= 0) {
      return {
        status: 'won',
        outcome: 'US political will reached zero. The Americans are withdrawing — the regime survives.',
      };
    }
    if (usDomesticLoss(snap)) {
      return {
        status: 'won',
        outcome:
          'The American domestic consensus collapsed under casualties and prices. Congress forced a withdrawal — the regime outlasted the coalition.',
      };
    }
    if (
      hardenedDown &&
      snap.meters.hormuz < 20 &&
      (snap.iranDomestic?.stability ?? 100) < 25
    ) {
      return {
        status: 'lost',
        outcome:
          'The nuclear complex is destroyed, Hormuz is open and Iran’s institutions have broken. The regime cannot continue.',
      };
    }
  }

  // Final-turn resolution: multidimensional scores, not a single path.
  if (snap.victory && snap.turn >= snap.maxTurns) {
    if (snap.faction === 'iran') {
      // SPEC §27: surviving the clock is not a victory. If no shot was ever
      // fired there is no campaign to award, so the war that never started ends
      // without a strategic result rather than as an Iranian win.
      if (!snap.warStarted) {
        return {
          status: 'drawn',
          outcome:
            'The campaign has ended without a war: no hostile order was ever given, so neither side achieved a strategic result.',
        };
      }
      const achieved = victoryPaths(snap, map).some((p) => p.satisfied);
      const won = achieved || iranScore >= IRAN_SCORE_THRESHOLD;
      return {
        status: won ? 'won' : 'lost',
        outcome: won
          ? 'The campaign has ended. Iran preserved its government, a credible deterrent and enough regional and economic leverage to claim a strategic result.'
          : 'The campaign has ended without a strategic result for Iran: its deterrent, cohesion or leverage fell short, whatever the map looked like.',
      };
    }
    const won = coalitionScore >= COALITION_SCORE_THRESHOLD;
    return {
      status: won ? 'won' : 'lost',
      outcome: won
        ? 'The campaign has ended with a coalition strategic result: the nuclear programme is set back, Iran’s launch force is reduced, access holds and domestic support endured.'
        : 'The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way.',
    };
  }

  return { status: 'playing', outcome: '' };
}
