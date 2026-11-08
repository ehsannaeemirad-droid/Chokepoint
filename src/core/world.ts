/** Read-only helpers shared by combat, politics and AI. */
import unitData from '../data/units.json';
import type {
  FactionId,
  GameSnapshot,
  MapNodeDef,
  NodeState,
  UnitInstance,
  UnitTypeDef,
} from './types';
import type { TheaterMap } from '../map/TheaterMap';
import { hexDistance, type HexCoord } from '../map/hex';

const ALL_UNITS = Object.values(unitData).flat() as unknown as UnitTypeDef[];
const UNIT_MAP = new Map<string, UnitTypeDef>(ALL_UNITS.map((u) => [u.id, u]));

export function unitType(id: string): UnitTypeDef {
  const def = UNIT_MAP.get(id);
  if (!def) throw new Error(`Unknown unit type: ${id}`);
  return def;
}

export function allUnitTypes(): UnitTypeDef[] {
  return ALL_UNITS.slice();
}

export function unitsAt(snap: GameSnapshot, col: number, row: number): UnitInstance[] {
  return snap.units.filter((u) => u.col === col && u.row === row);
}

export function factionUnits(snap: GameSnapshot, faction: FactionId): UnitInstance[] {
  return snap.units.filter((u) => u.faction === faction);
}

export function findUnit(snap: GameSnapshot, uid: string): UnitInstance | undefined {
  return snap.units.find((u) => u.uid === uid);
}

export function removeUnit(snap: GameSnapshot, uid: string): void {
  snap.units = snap.units.filter((u) => u.uid !== uid);
}

export function nodeState(snap: GameSnapshot, id: string): NodeState {
  return snap.nodes[id]!;
}

export function nodeOf(map: TheaterMap, id: string): MapNodeDef {
  return map.nodeById.get(id)!;
}

export function distanceToNode(map: TheaterMap, nodeId: string, col: number, row: number): number {
  const hex = map.nodeHexOf(nodeId);
  if (!hex) return Number.POSITIVE_INFINITY;
  return hexDistance(hex, { col, row });
}

export function nodeHex(map: TheaterMap, nodeId: string): HexCoord | undefined {
  return map.nodeHexOf(nodeId);
}

/** Which faction actually defends a node (tenant beats sovereign for bases). */
export function defenderOfNode(node: MapNodeDef): FactionId | null {
  for (const op of node.operators) {
    if (op === 'usa' || op === 'israel' || op === 'iran') return op;
  }
  if (node.host === 'usa' || node.host === 'israel' || node.host === 'iran') return node.host as FactionId;
  return null;
}

export function isMajorGulfBase(id: string): boolean {
  return id === 'al_udeid' || id === 'al_dhafra' || id === 'ali_al_salem' || id === 'nsa_bahrain';
}

export function isIsraelPopulation(id: string): boolean {
  return id === 'jerusalem' || id === 'tel_aviv';
}

export function isHardenedFacility(node: MapNodeDef): boolean {
  return node.hardened === true;
}

export function baseOperational(snap: GameSnapshot, map: TheaterMap, id: string): boolean {
  const state = snap.nodes[id];
  if (!state || state.integrity <= 25) return false;
  const node = map.nodeById.get(id);
  if (!node) return false;
  const host = snap.hosts[node.host];
  if (!host) return true;
  return host.status !== 'closed';
}

export function operationalGulfBases(snap: GameSnapshot, map: TheaterMap): number {
  return ['al_udeid', 'al_dhafra', 'ali_al_salem', 'nsa_bahrain'].filter((id) =>
    baseOperational(snap, map, id),
  ).length;
}

/** Coastal/water check used for naval movement and anti-ship batteries. */
export function inGulf(map: TheaterMap, col: number, row: number): boolean {
  const tile = map.hexAt(col, row);
  if (!tile) return false;
  return tile.lon >= 47 && tile.lon <= 57.5 && tile.lat >= 23.5 && tile.lat <= 30.5;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function pct(value: number): string {
  return `${Math.round(value)}%`;
}
