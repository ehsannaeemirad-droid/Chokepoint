/**
 * Phase 4: fog of war — a presentation-layer estimation module.
 *
 * The engine state is NEVER touched: every function here is read-only, and
 * every number it produces derives deterministically from (seed, turn, label)
 * so the same campaign always shows the same estimates — within a turn the
 * bands are stable, and a replay reproduces them exactly. Byte-identical
 * snapshot replays are unaffected because nothing here writes to `snap`.
 *
 * What is hidden, per the spec: the enemy's exact ammunition, launcher and
 * shelter-facility values. What is shown instead: an estimate band whose
 * width depends on the viewer's reconnaissance coverage:
 *   - `humint` — a friendly special-operations team within 6 hexes: ±8%
 *   - `isr`    — a friendly MQ-9 within 12 hexes: ±18%
 *   - `none`   — no recon coverage: ±35%
 *
 * Your own side's numbers are always exact. Victory-path progress stays
 * exact for every viewer (it is the scoreboard, not intelligence).
 */
import type { FactionId, GameSnapshot } from '../core/types';
import { defenderOfNode } from '../core/world';
import { hexDistance } from '../map/hex';
import type { TheaterMap } from '../map/TheaterMap';

export type ReconQuality = 'humint' | 'isr' | 'none';

export interface Estimate {
  lo: number;
  hi: number;
  quality: ReconQuality;
}

const SPREAD: Record<ReconQuality, number> = { humint: 0.08, isr: 0.18, none: 0.35 };

const HUMINT_RANGE = 6;
const ISR_RANGE = 12;

/** Deterministic 0-1 hash of the campaign seed, the turn and a label. */
export function fogHash(seed: number, turn: number, label: string): number {
  let h = (seed ^ Math.imul(turn + 1, 2654435761)) >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 16777619) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** Best reconnaissance coverage a viewer has over a hex. */
export function reconAt(snap: GameSnapshot, viewer: FactionId, col: number, row: number): ReconQuality {
  let best: ReconQuality = 'none';
  for (const unit of snap.units) {
    if (unit.faction !== viewer) continue;
    const d = hexDistance({ col, row }, { col: unit.col, row: unit.row });
    if (unit.typeId === 'sof' && d <= HUMINT_RANGE) return 'humint';
    if (unit.typeId === 'mq9' && d <= ISR_RANGE && best === 'none') best = 'isr';
  }
  return best;
}

/**
 * Estimate band around `value`. The true value always lies inside [lo, hi]:
 * the centre is jittered by up to half the spread and the band is a full
 * spread wide. Zero stays an exact zero — destruction is observable.
 */
export function estimate(value: number, snap: GameSnapshot, label: string, quality: ReconQuality): Estimate {
  if (value <= 0) return { lo: 0, hi: 0, quality };
  const spread = SPREAD[quality];
  const jitter = (fogHash(snap.seed, snap.turn, label) - 0.5) * 2;
  const center = value * (1 + (jitter * spread) / 2);
  const width = value * spread;
  return {
    lo: Math.max(0, Math.round(center - width)),
    hi: Math.max(0, Math.round(center + width)),
    quality,
  };
}

/** True when the viewer is entitled to exact numbers about `defender`. */
export function exactAccess(snap: GameSnapshot, defender: FactionId | null): boolean {
  return defender === null || defender === snap.faction;
}

/**
 * Estimate for a facility's integrity, or `null` when the viewer owns the
 * facility and may read the exact value.
 */
export function nodeIntegrityEstimate(snap: GameSnapshot, map: TheaterMap, nodeId: string): Estimate | null {
  const node = map.nodeById.get(nodeId);
  if (!node) return null;
  if (exactAccess(snap, defenderOfNode(node))) return null;
  const hex = map.nodeHexOf(nodeId);
  const quality = hex ? reconAt(snap, snap.faction, hex.col, hex.row) : 'none';
  const value = snap.nodes[nodeId]?.integrity ?? 0;
  return estimate(value, snap, `node:${nodeId}`, quality);
}

/**
 * Estimate for a unit's strength, or `null` when the unit belongs to the
 * viewer.
 */
export function unitStrengthEstimate(snap: GameSnapshot, unit: { faction: FactionId; uid: string; strength: number }): Estimate | null {
  if (unit.faction === snap.faction) return null;
  return estimate(unit.strength, snap, `unit:${unit.uid}`, 'none');
}

/** Human-readable band, localised by the caller's template. */
export function bandLabel(est: Estimate): string {
  if (est.lo === est.hi) return `${est.lo}`;
  return `${est.lo}–${est.hi}`;
}
