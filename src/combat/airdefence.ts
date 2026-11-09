/**
 * Layered air defence and raid detection (Phase 2 item 4).
 *
 * The model is data-driven: a unit's `adLayer`, `intercept`, `coverage`,
 * `interceptCost` and `engages` decide its role. Long-range engages first, then
 * medium, then point defence; each failed layer still spends its interceptor
 * attempt, so a one-layer site resolves as weaker rather than relabelled.
 *
 * Detection is per raid and pre-engagement: an undetected raid is never engaged.
 * Radar nodes, airbases and the AD units' own sensors provide coverage; terrain,
 * signature class and stealth change the odds. Suppression (SEAD) is stored on
 * the snapshot for the current turn, so a later strike in the same turn sees the
 * hole the earlier one opened.
 */
import type { FactionId, GameSnapshot, ThreatClass, UnitInstance } from '../core/types';
import { clamp, unitType } from '../core/world';
import { hexDistance } from '../map/hex';
import type { TheaterMap } from '../map/TheaterMap';
import { maxSuperpowerTier, purchaseCostOfInterceptors } from '../politics/politics';

export type AdLayerName = 'long' | 'medium' | 'point';

export const AD_LAYER_ORDER: readonly AdLayerName[] = ['long', 'medium', 'point'];

export interface AdLayer {
  layer: AdLayerName;
  label: string;
  probability: number;
  cost: number;
  unit?: UnitInstance;
}

export interface DetectionResult {
  detected: boolean;
  chance: number;
  sources: string[];
}

export interface Engagement {
  intercepted: boolean;
  system?: string;
  layer?: AdLayerName;
}

/** How visible each threat class is to a sensor at nominal range. */
const SIGNATURE_VISIBILITY: Record<ThreatClass, number> = {
  drone: 0.9,
  cruise: 0.8,
  ballistic: 0.95,
  hypersonic: 0.7,
};

const RADAR_RANGE = 12;
const AIRBASE_RANGE = 8;
const SENSOR_SLACK = 4;

function poolFor(snap: GameSnapshot, faction: FactionId): number {
  if (faction === 'usa') return snap.resources.interceptorsUSA;
  if (faction === 'israel') return snap.resources.interceptorsIsrael;
  return Number.POSITIVE_INFINITY;
}

function nodeSuppressed(snap: GameSnapshot, nodeId: string): boolean {
  return (snap.adSuppression?.[nodeId] ?? 0) > snap.turn;
}

function unitSuppressed(snap: GameSnapshot, unit: UnitInstance): boolean {
  return (unit.suppressedUntilTurn ?? 0) > snap.turn;
}

/** Detect one raid against a hex. Rolls once; the result gates all engagement. */
export function detectRaid(
  snap: GameSnapshot,
  map: TheaterMap,
  col: number,
  row: number,
  defender: FactionId,
  threat: ThreatClass,
  stealth: number,
  rng: () => number,
): DetectionResult {
  const sources: string[] = [];
  let chance = 0.18;

  if (defender === 'iran' || defender === 'houthi') {
    // Iran's national system is abstract: fewer named sensors, more depth.
    chance = 0.55 + (maxSuperpowerTier(snap) >= 2 ? 0.2 : 0);
    if (maxSuperpowerTier(snap) >= 2) sources.push('Russian-supplied radar');
  }

  for (const unit of snap.units) {
    if (unit.faction !== defender) continue;
    const def = unitType(unit.typeId);
    if (!def.adLayer || unitSuppressed(snap, unit)) continue;
    const reach = (def.coverage ?? 0) + SENSOR_SLACK;
    if (hexDistance({ col: unit.col, row: unit.row }, { col, row }) > reach) continue;
    chance += 0.12;
    sources.push(def.name);
  }

  for (const node of map.nodes) {
    const state = snap.nodes[node.id];
    if (!state || state.integrity <= 0) continue;
    if (nodeSuppressed(snap, node.id)) continue;
    const hex = map.nodeHexOf(node.id);
    if (!hex) continue;
    const radar = node.facility === 'radar';
    const airbase = node.kind === 'airbase' || node.kind === 'naval';
    if (!radar && !airbase) continue;
    // Sensors only serve the faction that owns them.
    if (!node.operators.includes(defender)) continue;
    const reach = radar ? RADAR_RANGE : AIRBASE_RANGE;
    if (hexDistance({ col, row }, hex) > reach) continue;
    chance += radar ? 0.3 : 0.14;
    sources.push(node.name);
  }

  const terrain = map.hexAt(col, row)?.terrain;
  if (terrain === 'mountain') chance -= 0.15;
  chance = clamp(chance * SIGNATURE_VISIBILITY[threat] - stealth * 0.9, 0.03, 0.98);
  return { detected: rng() < chance, chance, sources };
}

/** The layers able to engage at this hex right now, strongest per layer. */
export function defenceLayers(
  snap: GameSnapshot,
  map: TheaterMap,
  col: number,
  row: number,
  defender: FactionId,
  threat: ThreatClass,
): AdLayer[] {
  const nodeId = map.hexToNode.get(`${col},${row}`);
  if (nodeId && nodeSuppressed(snap, nodeId)) return [];

  if (defender === 'iran' || defender === 'houthi') {
    const shield = maxSuperpowerTier(snap) >= 2 ? 0.06 : 0;
    return [
      { layer: 'long', label: 'Iranian long-range SAM', probability: 0.18 + shield, cost: 0 },
      { layer: 'medium', label: 'Iranian medium-range SAM', probability: 0.22 + shield, cost: 0 },
      { layer: 'point', label: 'Iranian point defence', probability: 0.12, cost: 0 },
    ];
  }

  const byLayer = new Map<AdLayerName, AdLayer>();
  for (const unit of snap.units) {
    if (unit.faction !== defender) continue;
    const def = unitType(unit.typeId);
    if (!def.adLayer) continue;
    if (!def.engages?.includes(threat)) continue;
    if (unitSuppressed(snap, unit)) continue;
    if (hexDistance({ col: unit.col, row: unit.row }, { col, row }) > (def.coverage ?? 0)) continue;
    if (def.id === 'iron_beam' && unit.magazine <= 0) continue;
    const cost = def.interceptCost ?? 0;
    if (poolFor(snap, defender) < cost) continue;
    const probability = threat === 'hypersonic' ? (def.hypersonicIntercept ?? 0) : (def.intercept ?? 0);
    if (probability <= 0) continue;
    const current = byLayer.get(def.adLayer);
    if (!current || probability > current.probability) {
      byLayer.set(def.adLayer, {
        layer: def.adLayer,
        label: def.name,
        probability,
        cost,
        unit,
      });
    }
  }
  return AD_LAYER_ORDER.map((layer) => byLayer.get(layer)).filter((l): l is AdLayer => Boolean(l));
}

/**
 * One munition against the layered stack. Each layer is tried in order; a hit
 * spends exactly one interceptor and stops. A miss spends the attempt.
 */
export function engageOnce(
  snap: GameSnapshot,
  defender: FactionId,
  layers: AdLayer[],
  stealth: number,
  hardenedTarget: boolean,
  saturation: number,
  rng: () => number,
): Engagement {
  for (const layer of layers) {
    let probability = layer.probability * (1 - stealth * 0.5) - saturation;
    if (hardenedTarget && layer.layer === 'point') probability += 0.05;
    probability = clamp(probability, 0, 0.95);
    if (rng() >= probability) continue;
    if (layer.cost > 0) purchaseCostOfInterceptors(snap, defender, layer.cost);
    if (layer.unit && unitType(layer.unit.typeId).id === 'iron_beam') layer.unit.magazine -= 1;
    return { intercepted: true, system: layer.label, layer: layer.layer };
  }
  return { intercepted: false };
}

/** Loss risk for an attacking aircraft, derived from the state it actually met. */
export function attackerLossChance(input: {
  layers: AdLayer[];
  stealth: number;
  depth: number;
  range: number;
  escort: boolean;
  hardenedTarget: boolean;
}): number {
  let risk = 0.02;
  for (const layer of input.layers) {
    risk += layer.layer === 'long' ? 0.03 : layer.layer === 'medium' ? 0.02 : 0.01;
  }
  const depth = input.range > 0 ? clamp(input.depth / input.range, 0, 1) : 0;
  risk += depth * 0.03;
  if (input.hardenedTarget) risk += 0.01;
  risk -= input.stealth * 0.12;
  if (input.escort) risk -= 0.02;
  return clamp(risk, 0.005, 0.35);
}

/** Mark the air-defence picture around a struck hex degraded for this turn. */
export function suppressAfterImpact(
  snap: GameSnapshot,
  map: TheaterMap,
  col: number,
  row: number,
  defender: FactionId | null,
  nodeId?: string,
): void {
  if (nodeId) {
    const node = map.nodeById.get(nodeId);
    if (node && (node.facility === 'radar' || node.kind === 'airbase' || node.kind === 'naval')) {
      snap.adSuppression = { ...(snap.adSuppression ?? {}), [nodeId]: snap.turn + 1 };
    }
  }
  if (!defender) return;
  for (const unit of snap.units) {
    if (unit.faction !== defender) continue;
    if (!unitType(unit.typeId).adLayer) continue;
    if (hexDistance({ col: unit.col, row: unit.row }, { col, row }) <= 1) {
      unit.suppressedUntilTurn = snap.turn + 1;
    }
  }
}
