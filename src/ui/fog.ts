/**
 * Fog of war — a presentation-layer estimation module.
 *
 * The engine state is NEVER touched: every function here is read-only, and
 * every number it produces derives deterministically from (seed, turn, label)
 * so the same campaign always shows the same estimates. Coverage comes from
 * `src/core/intel.ts`, so reconnaissance genuinely narrows a band, and a unit
 * that has not been seen for several turns widens it again.
 */
import type { FactionId, GameSnapshot } from '../core/types';
import { defenderOfNode } from '../core/world';
import { RECON_SPREAD, reconQuality, staleTurns, type ReconQuality } from '../core/intel';
import type { TheaterMap } from '../map/TheaterMap';

export type { ReconQuality } from '../core/intel';

export interface Estimate {
  lo: number;
  hi: number;
  quality: ReconQuality;
}

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
export function reconAt(
  snap: GameSnapshot,
  viewer: FactionId,
  col: number,
  row: number,
): ReconQuality {
  return reconQuality(snap, viewer, col, row);
}

/**
 * Estimate band around `value`. The centre is jittered by up to half the
 * spread and the band is a full spread wide. `staleScale` widens the band for
 * information that has not been refreshed.
 */
export function estimate(
  value: number,
  snap: GameSnapshot,
  label: string,
  quality: ReconQuality,
  staleScale = 1,
): Estimate {
  if (value <= 0) return { lo: 0, hi: 0, quality };
  const spread = RECON_SPREAD[quality] * staleScale;
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

/** Purchased Chinese/Russian espionage temporarily removes estimate bands. */
export function paidIntel(snap: GameSnapshot): boolean {
  return snap.faction === 'iran' && (snap.iranIntelUntil ?? 0) >= snap.turn;
}

/**
 * Estimate for a facility's integrity, or `null` when the viewer owns the
 * facility and may read the exact value.
 */
export function nodeIntegrityEstimate(snap: GameSnapshot, map: TheaterMap, nodeId: string): Estimate | null {
  const node = map.nodeById.get(nodeId);
  if (!node) return null;
  if (exactAccess(snap, defenderOfNode(node))) return null;
  if (paidIntel(snap)) return null;
  const hex = map.nodeHexOf(nodeId);
  const quality = hex ? reconAt(snap, snap.faction, hex.col, hex.row) : 'none';
  const value = snap.nodes[nodeId]?.integrity ?? 0;
  return estimate(value, snap, `node:${nodeId}`, quality);
}

/**
 * Estimate for a unit's strength, or `null` when the unit belongs to the
 * viewer or has never been located. A unit without current coverage keeps a
 * wider band, scaled by how long it has been out of sight.
 */
export function unitStrengthEstimate(
  snap: GameSnapshot,
  unit: {
    faction: FactionId;
    uid: string;
    strength: number;
    col?: number;
    row?: number;
    lastSeen?: number;
    revealed?: boolean;
  },
): Estimate | null {
  if (unit.faction === snap.faction) return null;
  const quality =
    unit.col === undefined || unit.row === undefined
      ? 'none'
      : reconAt(snap, snap.faction, unit.col, unit.row);
  if (paidIntel(snap)) return { lo: Math.round(unit.strength), hi: Math.round(unit.strength), quality };
  if (unit.revealed === false && quality === 'none') return null;
  const staleScale = 1 + Math.min(3, staleTurns(snap, unit)) * 0.25;
  return estimate(unit.strength, snap, `unit:${unit.uid}`, quality, staleScale);
}

/** Human-readable band, localised by the caller's template. */
export function bandLabel(est: Estimate): string {
  if (est.lo === est.hi) return `${est.lo}`;
  return `${est.lo}–${est.hi}`;
}
