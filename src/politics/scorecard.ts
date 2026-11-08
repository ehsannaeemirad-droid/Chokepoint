/**
 * Improvement 7: multi-axis graded victory settlement.
 *
 * A campaign that ends on a knife-edge binary is a wasted simulation, so
 * every terminal outcome now also produces a scorecard: six measurable axes,
 * three owned by each side, each scored 0-100 against its own definition and
 * weighted by scenario data (`campaign.scorecard` → `snap.scorecardCfg`).
 * Each side's total is normalized to its own weight sum, so both read 0-100
 * and the margin picks a graded verdict — decisive / clear / narrow win, or
 * stalemate — instead of a coin-flip.
 *
 * Axes (id → measure):
 *   regime             (iran)      regime standing, docked per leadership strike
 *   nuclearComplex     (coalition) 100 − best surviving nuclear-facility integrity
 *   hormuz             (iran)      sustained strangle: clock × 8 + current × 0.5 + Suez
 *   israeliAttrition   (iran)      100 − measurable Israeli offensive capacity
 *   domesticConsensus  (coalition) US congressional support at the end
 *   gulfBasing         (coalition) operational major Gulf bases, /4 × 100
 *
 * Pure snapshot arithmetic — no RNG — computed once, at the terminal turn,
 * and stored on the snapshot (`snap.scorecard`) so the outcome modal and the
 * replay both read the same graded result.
 */
import type { GameSnapshot, Scorecard, ScorecardConfig } from '../core/types';
import { clamp, nodeState, operationalGulfBases } from '../core/world';
import { bestNuclearIntegrity, israeliOffensiveCapacity, regimeIntact } from './victory';
import type { TheaterMap } from '../map/TheaterMap';

export const DEFAULT_SCORECARD_CFG: ScorecardConfig = {
  axes: {
    regime: { side: 'iran', weight: 25 },
    nuclearComplex: { side: 'coalition', weight: 25 },
    hormuz: { side: 'iran', weight: 15 },
    israeliAttrition: { side: 'iran', weight: 15 },
    domesticConsensus: { side: 'coalition', weight: 10 },
    gulfBasing: { side: 'coalition', weight: 10 },
  },
};

export function scorecardCfg(snap: GameSnapshot): ScorecardConfig {
  return snap.scorecardCfg ?? DEFAULT_SCORECARD_CFG;
}

/** Per-axis raw score, 0-100. Data-driven weights; definitions live here. */
export function axisScore(snap: GameSnapshot, id: string, map: TheaterMap): number {
  switch (id) {
    case 'regime': {
      if (!regimeIntact(snap)) return clamp(Math.round(nodeState(snap, 'tehran').integrity / 2), 0, 100);
      return clamp(100 - snap.meters.leadershipStrikes * 10, 0, 100);
    }
    case 'nuclearComplex':
      return clamp(Math.round(100 - bestNuclearIntegrity(snap)), 0, 100);
    case 'hormuz':
      return clamp(
        Math.round(
          snap.meters.hormuzTurnsAbove50 * 8 + snap.meters.hormuz * 0.5 + (snap.suezClosed ? 15 : 0),
        ),
        0,
        100,
      );
    case 'israeliAttrition':
      return clamp(100 - israeliOffensiveCapacity(snap), 0, 100);
    case 'domesticConsensus':
      return clamp(Math.round(snap.domestic?.congress ?? 0), 0, 100);
    case 'gulfBasing':
      return clamp(Math.round((operationalGulfBases(snap, map) / 4) * 100), 0, 100);
    default:
      return 0;
  }
}

/** The graded verdict id for a margin between the two normalized totals. */
export function verdictFor(margin: number): Scorecard['verdict'] {
  if (margin >= 30) return 'decisive-iran';
  if (margin >= 10) return 'clear-iran';
  if (margin > 0) return 'narrow-iran';
  if (margin <= -30) return 'decisive-coalition';
  if (margin <= -10) return 'clear-coalition';
  if (margin < 0) return 'narrow-coalition';
  return 'stalemate';
}

/**
 * Build the graded settlement for a terminal campaign state. Called once by
 * the turn engine when `checkOutcome` ends the campaign; deterministic on
 * the snapshot.
 */
export function buildScorecard(snap: GameSnapshot, map: TheaterMap): Scorecard {
  const cfg = scorecardCfg(snap);
  const axes = Object.entries(cfg.axes).map(([id, def]) => ({
    id,
    side: def.side,
    weight: def.weight,
    score: axisScore(snap, id, map),
  }));

  const sideWeight: Record<'iran' | 'coalition', number> = { iran: 0, coalition: 0 };
  const sidePoints: Record<'iran' | 'coalition', number> = { iran: 0, coalition: 0 };
  for (const axis of axes) {
    sideWeight[axis.side] += axis.weight;
    sidePoints[axis.side] += axis.score * axis.weight;
  }
  // Normalize each side to its own weight sum; a side with zero weight reads 0.
  const iranTotal = sideWeight.iran > 0 ? Math.round(sidePoints.iran / sideWeight.iran) : 0;
  const coalitionTotal = sideWeight.coalition > 0 ? Math.round(sidePoints.coalition / sideWeight.coalition) : 0;
  const margin = iranTotal - coalitionTotal;

  return {
    axes,
    iranTotal,
    coalitionTotal,
    margin,
    verdict: verdictFor(margin),
  };
}
