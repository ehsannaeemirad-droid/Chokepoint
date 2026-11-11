/**
 * Valid-strike-target discovery, shared by the UI target list and the map
 * overlay so the sheet and the highlights can never disagree.
 *
 * Pure read-only function of the snapshot, the map and the unit.
 */
import type { GameSnapshot, UnitInstance } from '../core/types';
import { defenderOfNode } from '../core/world';
import { hostileTo, strikeRange, validateStrike } from './combat';
import { deliveryClassFor, launcherSortiesLeft } from '../core/inventory';
import { hexDistance } from '../map/hex';
import type { TheaterMap } from '../map/TheaterMap';

export interface StrikeTarget {
  col: number;
  row: number;
  nodeId?: string;
  label: string;
  dist: number;
  integrity?: number;
  buried?: number;
  hardened: boolean;
  units: boolean;
}

/**
 * Every hex the unit may legally strike this turn, nearest first: hostile
 * facilities in range (validated, including the range and political checks)
 * plus revealed hostile unit stacks, excluding hexes already covered by a
 * facility target.
 */
export function strikeTargetsFor(
  snap: GameSnapshot,
  map: TheaterMap,
  unit: UnitInstance,
  labelFor: (nodeId: string) => string,
  hexLabel: (col: number, row: number) => string,
  unitLabel?: (unit: UnitInstance) => string,
): StrikeTarget[] {
  const def = snap.units.length >= 0 ? unitTypeDef(snap, unit) : null;
  if (!def || def.atk <= 0 || def.rng <= 0) return [];
  if (unit.magazine <= 0 || unit.cooldown > 0) return [];
  const range = strikeRange(snap, unit);
  const targets: StrikeTarget[] = [];
  const nodeHexes = new Set<string>();

  for (const node of map.nodes) {
    const hex = map.nodeHexOf(node.id);
    if (!hex) continue;
    const state = snap.nodes[node.id];
    if (!state || state.integrity <= 0) continue;
    const defender = defenderOfNode(node);
    if (!defender || !hostileTo(unit.faction, defender)) continue;
    const dist = hexDistance({ col: unit.col, row: unit.row }, hex);
    if (dist > range) continue;
    if (!validateStrike(snap, map, unit, hex.col, hex.row, node.id).ok) continue;
    nodeHexes.add(`${hex.col},${hex.row}`);
    targets.push({
      col: hex.col,
      row: hex.row,
      nodeId: node.id,
      label: labelFor(node.id),
      dist,
      integrity: state.integrity,
      buried: node.buried,
      hardened: node.hardened === true,
      units: false,
    });
  }

  const seen = new Set<string>();
  for (const enemy of snap.units) {
    if (!hostileTo(unit.faction, enemy.faction) || !enemy.revealed) continue;
    const key = `${enemy.col},${enemy.row}`;
    if (nodeHexes.has(key) || seen.has(key)) continue;
    const dist = hexDistance({ col: unit.col, row: unit.row }, { col: enemy.col, row: enemy.row });
    if (dist > range) continue;
    seen.add(key);
    targets.push({
      col: enemy.col,
      row: enemy.row,
      label: unitLabel?.(enemy) ?? enemy.name ?? hexLabel(enemy.col, enemy.row),
      dist,
      hardened: false,
      units: true,
    });
  }

  return targets.sort((x, y) => x.dist - y.dist);
}

/**
 * Reverse lookup for the location sheet: every one of the player's units that
 * can legally strike this hex/facility this turn. This is what lets a player
 * pick a target first and then choose the tool, instead of hunting through the
 * force list for a unit in range.
 */
export function attackersForHex(
  snap: GameSnapshot,
  map: TheaterMap,
  col: number,
  row: number,
  nodeId?: string,
  labelFor: (nodeId: string) => string = (id) => id,
  hexLabel: (col: number, row: number) => string = (c, r) => `${c},${r}`,
  unitLabel?: (unit: UnitInstance) => string,
): Array<{ unit: UnitInstance; dist: number }> {
  const tasked = new Set(
    snap.orders.filter((o) => 'unitUid' in o).map((o) => (o as { unitUid: string }).unitUid),
  );
  return snap.units
    .filter((unit) => unit.faction === snap.faction && !tasked.has(unit.uid))
    .filter((unit) => {
      if (unit.magazine <= 0 || unit.cooldown > 0) return false;
      if (snap.faction === 'iran') {
        const cls = deliveryClassFor(unit.typeId);
        if (cls && (snap.iran.rounds[cls] <= 0 || launcherSortiesLeft(snap.iran, cls === 'drone' ? 'drone' : 'ballistic') <= 0)) {
          return false;
        }
      }
      return strikeTargetsFor(snap, map, unit, labelFor, hexLabel, unitLabel).some(
        (target) => target.col === col && target.row === row && (nodeId ? target.nodeId === nodeId : !target.nodeId),
      );
    })
    .map((unit) => ({
      unit,
      dist: hexDistance({ col: unit.col, row: unit.row }, { col, row }),
    }))
    .sort((a, b) => a.dist - b.dist);
}

interface UnitDefLike {
  atk: number;
  rng: number;
}

function unitTypeDef(_snap: GameSnapshot, unit: UnitInstance): UnitDefLike | null {
  return UNIT_DEFS.get(unit.typeId) ?? null;
}

import unitData from '../data/units.json';
import type { UnitTypeDef } from '../core/types';
const UNIT_DEFS = new Map<string, UnitTypeDef>(
  (Object.values(unitData).flat() as unknown as UnitTypeDef[]).map((u) => [u.id, u]),
);
