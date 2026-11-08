/**
 * Pointy-top hex grid, odd-r offset storage.
 *
 * Offset coordinates keep the theatre rectangular (col x row), while axial maths
 * gives correct distances and clean pixel<->hex conversion.
 */
import { GRID } from '../core/config';

export const HEX_R: number = GRID.hexRadius;
export const HEX_W = Math.sqrt(3) * HEX_R;
export const ROW_STEP = 1.5 * HEX_R;
export const CHUNK = 16;

export interface HexCoord {
  col: number;
  row: number;
}
export interface Point {
  x: number;
  y: number;
}

export const hexId = (col: number, row: number): string => `${col},${row}`;

export function parseHexId(id: string): HexCoord {
  const [col, row] = id.split(',');
  return { col: Number(col), row: Number(row) };
}

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < GRID.cols && row >= 0 && row < GRID.rows;
}

/** Centre of a hex in world pixels. */
export function hexToWorld(col: number, row: number): Point {
  return {
    x: col * HEX_W + (row & 1 ? HEX_W / 2 : 0) + HEX_W / 2,
    y: row * ROW_STEP + HEX_R,
  };
}

/** Nearest hex to a world point, or null when outside the grid. */
export function worldToHex(x: number, y: number): HexCoord | null {
  // Inverse of hexToWorld: shift back to the axial origin, then cube-round.
  const rf = (y - HEX_R) / ROW_STEP;
  const qf = (x - HEX_W / 2) / HEX_W - rf / 2;
  const axial = axialRound(qf, rf);
  const odd = ((axial.r % 2) + 2) % 2;
  const col = axial.q + (axial.r - odd) / 2;
  const row = axial.r;
  if (!inBounds(col, row)) return null;
  return { col, row };
}

export function axialRound(q: number, r: number): { q: number; r: number } {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

export function offsetToAxial(col: number, row: number): { q: number; r: number } {
  const odd = ((row % 2) + 2) % 2;
  return { q: col - (row - odd) / 2, r: row };
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const A = offsetToAxial(a.col, a.row);
  const B = offsetToAxial(b.col, b.row);
  const dq = A.q - B.q;
  const dr = A.r - B.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function hexNeighbors(col: number, row: number): HexCoord[] {
  const odd = ((row % 2) + 2) % 2;
  const deltas = odd
    ? [
        [1, 0],
        [0, -1],
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, 1],
      ]
    : [
        [1, 0],
        [1, -1],
        [0, -1],
        [-1, 0],
        [0, 1],
        [1, 1],
      ];
  const out: HexCoord[] = [];
  for (const [dc, dr] of deltas) {
    const c = col + dc!;
    const r = row + dr!;
    if (inBounds(c, r)) out.push({ col: c, row: r });
  }
  return out;
}

/** All hexes within `range` of a centre (inclusive). */
export function hexesInRange(center: HexCoord, range: number): HexCoord[] {
  const out: HexCoord[] = [];
  for (let dr = -range; dr <= range; dr++) {
    const start = Math.max(-range, -dr - range);
    const end = Math.min(range, -dr + range);
    for (let dq = start; dq <= end; dq++) {
      const axialQ = offsetToAxial(center.col, center.row).q + dq;
      const row = center.row + dr;
      const odd = ((row % 2) + 2) % 2;
      const col = axialQ + (row - odd) / 2;
      if (inBounds(col, row)) out.push({ col, row });
    }
  }
  return out;
}

/** The six corner points of a pointy-top hex. */
export function hexCorners(cx: number, cy: number, radius = HEX_R): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i + 30);
    pts.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return pts;
}

export interface ChunkAddress {
  cx: number;
  cy: number;
}
export const chunkKey = (cx: number, cy: number): string => `${cx}:${cy}`;
export const chunkOfCol = (col: number): number => Math.floor(col / CHUNK);
export const chunkOfRow = (row: number): number => Math.floor(row / CHUNK);
