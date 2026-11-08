/**
 * The theatre map: lazily sampled hex tiles + strategic node placement.
 *
 * Tiles are pure functions of their coordinates, so chunks can be discarded and
 * rebuilt without any loss of state.
 */
import { GRID } from '../core/config';
import type { MapNodeDef, TerrainKind } from '../core/types';
import nodeData from '../data/mapNodes.json';
import { COUNTRY_NAMES } from './geography';
import { BOUNDS, CELL, COLS, ROWS, cellCentre } from './geography';
import { hexId, hexToWorld, inBounds, type HexCoord } from './hex';
import { isWater, nearestCountry, sampleTerrain } from './terrain';

export const MAP_NODES = nodeData as unknown as MapNodeDef[];

export interface HexTile extends HexCoord {
  id: string;
  lon: number;
  lat: number;
  terrain: TerrainKind;
  /** Country id, or 'neutral' for water. */
  owner: string;
  nodeId?: string;
  x: number;
  y: number;
}

const WATER_NODE_KINDS = new Set(['chokepoint', 'naval', 'oil']);

export class TheaterMap {
  readonly cols = COLS;
  readonly rows = ROWS;
  readonly nodes: MapNodeDef[] = MAP_NODES;
  readonly nodeById = new Map<string, MapNodeDef>();
  readonly nodeHex = new Map<string, HexCoord>();
  /** nodeId keyed by hex id, for quick lookup when a hex is tapped. */
  readonly hexToNode = new Map<string, string>();

  private tiles = new Map<string, HexTile>();

  constructor() {
    for (const node of this.nodes) {
      this.nodeById.set(node.id, node);
      const hex = this.findHexForNode(node);
      this.nodeHex.set(node.id, hex);
      this.hexToNode.set(hexId(hex.col, hex.row), node.id);
    }
  }

  /** Place a node at the nearest usable hex, snapping inland for land facilities. */
  private findHexForNode(node: MapNodeDef): HexCoord {
    const estimate = this.estimateHex(node.lon, node.lat);
    const allowWater = WATER_NODE_KINDS.has(node.kind) && node.kind !== 'naval';
    let best: HexCoord | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (let radius = 0; radius <= 5 && !best; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          const col = estimate.col + dc;
          const row = estimate.row + dr;
          if (!inBounds(col, row)) continue;
          const centre = cellCentre(col, row);
          const water = isWater(centre.lon, centre.lat);
          if (water && !allowWater) continue;
          if (node.kind === 'chokepoint' && !water && radius < 2) continue;
          const d = (centre.lon - node.lon) ** 2 + (centre.lat - node.lat) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { col, row };
          }
        }
      }
    }
    return best ?? estimate;
  }

  estimateHex(lon: number, lat: number): HexCoord {
    const rowF = (BOUNDS.latMax - lat) / CELL.latStep - 0.5;
    const row = clamp(Math.round(rowF), 0, this.rows - 1);
    const colF = (lon - BOUNDS.lonMin) / CELL.lonStep - 0.5 - (row & 1 ? 0.5 : 0);
    const col = clamp(Math.round(colF), 0, this.cols - 1);
    return { col, row };
  }

  hexAt(col: number, row: number): HexTile | null {
    if (!inBounds(col, row)) return null;
    const id = hexId(col, row);
    const cached = this.tiles.get(id);
    if (cached) return cached;

    const { lon, lat } = cellCentre(col, row);
    let terrain = sampleTerrain(lon, lat);
    let owner = isWater(lon, lat) ? 'neutral' : nearestCountry(lon, lat);
    const nodeId = this.hexToNode.get(id);
    const node = nodeId ? this.nodeById.get(nodeId) : undefined;
    if (node?.terrain) terrain = node.terrain;
    if (node && node.kind !== 'chokepoint' && node.kind !== 'oil' && node.host !== 'neutral') {
      owner = node.host;
    }

    const pos = hexToWorld(col, row);
    const tile: HexTile = { col, row, id, lon, lat, terrain, owner, nodeId, x: pos.x, y: pos.y };
    this.tiles.set(id, tile);
    return tile;
  }

  nodeForHex(col: number, row: number): MapNodeDef | undefined {
    const id = this.hexToNode.get(hexId(col, row));
    return id ? this.nodeById.get(id) : undefined;
  }

  nodeHexOf(id: string): HexCoord | undefined {
    return this.nodeHex.get(id);
  }

  ownerName(owner: string): string {
    return COUNTRY_NAMES[owner] ?? (owner === 'neutral' ? 'International waters' : owner);
  }

  /** Cached tile count (diagnostics / perf overlay). */
  get cachedTiles(): number {
    return this.tiles.size;
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Horizontal/vertical extent of the whole map in world pixels. */
export function mapPixelSize(map: TheaterMap): { width: number; height: number } {
  const last = hexToWorld(map.cols - 1, map.rows - 1);
  return { width: last.x + GRID.hexRadius, height: last.y + GRID.hexRadius };
}
