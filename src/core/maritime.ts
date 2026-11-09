/**
 * Maritime rules (Phase 2 item 6, mdf.md §20).
 *
 * Minefields are per-hex state, not a global counter: a mine-layer lays them,
 * coalition naval units locate them by proximity, and clearance removes them.
 * Escort coverage is a decaying per-turn number, so convoy protection changes
 * shipping risk for a turn without becoming a permanent switch.
 *
 * Everything here is called from the engine (orders) and from politics
 * (Hormuz), never from the UI, and the AI uses the same order path.
 */
import type { GameSnapshot } from './types';
import { clamp } from './world';
import { hexDistance } from '../map/hex';
import type { TheaterMap } from '../map/TheaterMap';

export interface Minefield {
  mines: number;
  detected: boolean;
  laidTurn: number;
}

/** Most mines one sortie can lay. */
export const MINE_SORTIE_MAX = 3;
/** Most mines one clearance sortie can sweep. */
export const MINE_CLEAR_MAX = 3;
/** How close a coalition warship must be to locate a field. */
export const MINE_DETECT_RANGE = 1;
/** How far escort coverage reaches. */
export const ESCORT_RANGE = 2;
/** Disruption index points per laid mine. */
export const MINE_DISRUPTION_PER_MINE = 1.5;
/** Pipeline and alternative-route mitigation of a Hormuz threat score. */
export const HORMUZ_RESILIENCE = 0.85;

export function hexKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function minefields(snap: GameSnapshot): Record<string, Minefield> {
  if (!snap.minefields) snap.minefields = {};
  return snap.minefields;
}

export function isSeaHex(map: TheaterMap, col: number, row: number): boolean {
  const tile = map.hexAt(col, row);
  return !!tile && (tile.terrain === 'deep' || tile.terrain === 'coast');
}

/** Lay mines from the Iranian stock. Returns how many were actually laid. */
export function layMines(snap: GameSnapshot, map: TheaterMap, col: number, row: number, want: number): number {
  if (!isSeaHex(map, col, row)) return 0;
  const count = Math.max(0, Math.min(Math.floor(want), MINE_SORTIE_MAX, snap.iran.mines));
  if (count <= 0) return 0;
  snap.iran.mines -= count;
  const fields = minefields(snap);
  const key = hexKey(col, row);
  const field = fields[key] ?? { mines: 0, detected: false, laidTurn: snap.turn };
  field.mines += count;
  field.laidTurn = snap.turn;
  fields[key] = field;
  snap.iran.minesLaid += count;
  return count;
}

/**
 * Locate minefields within detection range of a coalition warship. Fields the
 * Iranians laid stay unknown until someone sails close enough.
 */
export function detectMinefields(snap: GameSnapshot, map: TheaterMap): string[] {
  const fields = minefields(snap);
  const found: string[] = [];
  for (const [key, field] of Object.entries(fields)) {
    if (field.detected || field.mines <= 0) continue;
    const [col, row] = key.split(',').map(Number) as [number, number];
    const near = snap.units.some((u) => {
      if (u.faction !== 'usa' && u.faction !== 'israel') return false;
      if (u.typeId === 'mine_layer') return false;
      if (!isSeaHex(map, u.col, u.row)) return false;
      return hexDistance({ col, row }, { col: u.col, row: u.row }) <= MINE_DETECT_RANGE;
    });
    if (near) {
      field.detected = true;
      found.push(key);
    }
  }
  return found;
}

/** Sweep a located field. Returns mines removed. */
export function clearMines(snap: GameSnapshot, col: number, row: number, capacity = MINE_CLEAR_MAX): number {
  const fields = minefields(snap);
  const key = hexKey(col, row);
  const field = fields[key];
  if (!field || !field.detected || field.mines <= 0) return 0;
  const swept = Math.min(Math.floor(capacity), field.mines);
  field.mines -= swept;
  if (field.mines <= 0) delete fields[key];
  return swept;
}

/** Hexes currently covered by coalition escort. */
export function escortedHexes(snap: GameSnapshot): Set<string> {
  const covered = new Set<string>();
  for (const unit of snap.units) {
    if (unit.faction !== 'usa' && unit.faction !== 'israel') continue;
    if (!isSeaHexUnit(unit)) continue;
    for (let dc = -ESCORT_RANGE; dc <= ESCORT_RANGE; dc++) {
      for (let dr = -ESCORT_RANGE; dr <= ESCORT_RANGE; dr++) {
        if (Math.abs(dc) + Math.abs(dr) > ESCORT_RANGE) continue;
        covered.add(hexKey(unit.col + dc, unit.row + dr));
      }
    }
  }
  return covered;
}

function isSeaHexUnit(unit: { typeId: string }): boolean {
  const def = unit.typeId;
  return def === 'csg' || def === 'fac' || def === 'mine_layer';
}

/** Add escort coverage for this turn; it decays by one per turn. */
export function addEscortCoverage(snap: GameSnapshot): number {
  snap.escortCoverage = clamp((snap.escortCoverage ?? 0) + 1, 0, 3);
  return snap.escortCoverage;
}

export function decayEscortCoverage(snap: GameSnapshot): void {
  snap.escortCoverage = Math.max(0, (snap.escortCoverage ?? 0) - 1);
}

/**
 * Maritime contribution to the Hormuz index: launchers, minefields and FACs
 * raise it; escorts, coalition hulls and pipeline resilience lower it. This is a
 * partial-disruption model, never a binary closure.
 */
export function maritimeThreat(snap: GameSnapshot, map: TheaterMap): number {
  const hormuz = map.nodeHexOf('hormuz');
  if (!hormuz) return 0;
  let score = 0;
  for (const unit of snap.units) {
    const dist = hexDistance(hormuz, { col: unit.col, row: unit.row });
    if (unit.typeId === 'asm_launcher' && dist <= 8) score += 10;
    if (unit.typeId === 'fac' && dist <= 6) score += 5;
    if (unit.typeId === 'houthi_asm' && dist <= 12) score += 5;
  }
  let mineScore = 0;
  for (const [key, field] of Object.entries(minefields(snap))) {
    const [col, row] = key.split(',').map(Number) as [number, number];
    if (hexDistance(hormuz, { col, row }) > 4) continue;
    mineScore += field.mines * MINE_DISRUPTION_PER_MINE;
  }
  // Pipeline and alternative-route capacity absorb part of the mine threat;
  // unit-based threat keeps its old weight so peacetime baselines do not move.
  score += mineScore * HORMUZ_RESILIENCE;
  score -= (snap.escortCoverage ?? 0) * 6;
  return Math.max(0, score);
}
