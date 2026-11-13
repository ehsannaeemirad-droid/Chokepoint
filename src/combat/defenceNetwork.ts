/**
 * Abstract air-defence network (Phase 4).
 *
 * A country's air defence is not one switch. It is early warning, sensors,
 * coordination, interceptor stocks and readiness, and each of those can fail
 * separately. This module names those attributes, derives them from state the
 * simulation already keeps, and exposes one composite effectiveness value.
 *
 * Nothing here is a real-world order of battle: the attributes are ratios over
 * the game's own facilities and units, and no sensor location, coverage gap or
 * vulnerability is derived from real data. Detection is deliberately separate
 * from interception — this module never says a raid will be stopped, only how
 * good the network is at seeing and coordinating one.
 *
 * Everything is a pure function of the snapshot, so it stays deterministic and
 * replay-safe, and it never mutates state.
 */
import type { FactionId, GameSnapshot, UnitInstance } from '../core/types';
import { clamp, unitType } from '../core/world';
import type { TheaterMap } from '../map/TheaterMap';
import type { ReconQuality } from '../core/intel';

/** Which attribute a network report is talking about. */
export type NetworkAttribute =
  | 'earlyWarning'
  | 'sensors'
  | 'coordination'
  | 'interceptors'
  | 'readiness';

export const NETWORK_ATTRIBUTES: readonly NetworkAttribute[] = [
  'earlyWarning',
  'sensors',
  'coordination',
  'interceptors',
  'readiness',
];

export interface DefenceNetwork {
  faction: FactionId;
  /** 0..1 per attribute; 1 is a fully working network. */
  earlyWarning: number;
  sensors: number;
  coordination: number;
  interceptors: number;
  readiness: number;
  /** Weighted composite, 0..1. */
  effectiveness: number;
  /** How many of this faction's sensors were suppressed this turn. */
  suppressedNow: number;
  /** Defence units able to engage right now. */
  readyUnits: number;
  /** Defence units in the theatre. */
  totalUnits: number;
  /** Interceptor rounds in hand, or `null` when the faction has no pool. */
  interceptorPool: number | null;
}

function aliveRadars(snap: GameSnapshot, map: TheaterMap, faction: FactionId) {
  // Only nodes the simulation actually tracks can be damaged or suppressed; a
  // node with no state entry is not evidence of a destroyed sensor.
  const owned = map.nodes.filter(
    (node) =>
      node.operators.includes(faction) &&
      snap.nodes[node.id] !== undefined &&
      (node.facility === 'radar' || node.kind === 'airbase' || node.kind === 'naval'),
  );
  const radars = owned.filter((node) => node.facility === 'radar');
  const bases = owned.filter((node) => node.kind === 'airbase' || node.kind === 'naval');
  const alive = (list: typeof owned) =>
    list.filter((node) => (snap.nodes[node.id]?.integrity ?? 0) > 0 && !suppressed(snap, node.id)).length;
  return {
    radarShare: radars.length ? alive(radars) / radars.length : 0,
    baseShare: bases.length ? alive(bases) / bases.length : 0,
    hasRadars: radars.length > 0,
    hasBases: bases.length > 0,
  };
}

function suppressed(snap: GameSnapshot, nodeId: string): boolean {
  return (snap.adSuppression?.[nodeId] ?? 0) > snap.turn;
}

function unitSuppressed(snap: GameSnapshot, unit: UnitInstance): boolean {
  return (unit.suppressedUntilTurn ?? 0) > snap.turn;
}

function poolOf(snap: GameSnapshot, faction: FactionId): number | null {
  if (faction === 'usa') return snap.resources.interceptorsUSA;
  if (faction === 'israel') return snap.resources.interceptorsIsrael;
  return null;
}

/** The network as it stands this turn. Pure; safe to call every frame. */
export function defenceNetwork(snap: GameSnapshot, map: TheaterMap, faction: FactionId): DefenceNetwork {
  const { radarShare, baseShare, hasRadars, hasBases } = aliveRadars(snap, map, faction);

  const units = snap.units.filter((unit) => unit.faction === faction && unitType(unit.typeId).adLayer);
  const ready = units.filter((unit) => {
    if (unitSuppressed(snap, unit)) return false;
    if (unit.cooldown > 0) return false;
    const def = unitType(unit.typeId);
    if (def.id === 'iron_beam' && unit.magazine <= 0) return false;
    return true;
  });

  const suppressedNow = units.filter((unit) => unitSuppressed(snap, unit)).length;
  const suppressedNodes = map.nodes.filter(
    (node) => node.operators.includes(faction) && node.facility === 'radar' && suppressed(snap, node.id),
  ).length;

  // Early warning is mostly the radar picture, with airbases filling in where a
  // faction fields no dedicated radar. A faction whose sensors the map does not
  // model individually (Iran's national system) reports its documented abstract
  // baseline rather than claiming it is blind.
  const unmodelled = !hasRadars && !hasBases;
  const warningBase = unmodelled ? 0.6 : hasRadars ? radarShare * 0.65 + baseShare * 0.35 : baseShare;
  const earlyWarning = clamp(warningBase, 0, 1);

  const unitShare = units.length ? ready.length / units.length : earlyWarning;
  const sensors = clamp(
    0.6 * (unmodelled ? 0.6 : hasRadars ? radarShare : baseShare) + 0.4 * unitShare,
    0,
    1,
  );

  // Coordination degrades when sensors or batteries are suppressed, not when
  // they are merely destroyed: that is what the engine's suppression represents.
  const coordination = clamp(1 - 0.22 * (suppressedNow + suppressedNodes), 0.15, 1);

  const pool = poolOf(snap, faction);
  const interceptors = pool === null ? 1 : clamp(pool / (pool + 30), 0, 1);

  const readiness = clamp(unitShare, 0, 1);

  // Interceptor stock matters least for a faction that has no pool (Iran's
  // abstract system), so the weights follow what each side actually fields.
  const effectiveness =
    pool === null
      ? 0.3 * earlyWarning + 0.25 * sensors + 0.3 * coordination + 0.15 * readiness
      : 0.25 * earlyWarning + 0.2 * sensors + 0.2 * coordination + 0.2 * interceptors + 0.15 * readiness;

  return {
    faction,
    earlyWarning,
    sensors,
    coordination,
    interceptors,
    readiness,
    effectiveness: clamp(effectiveness, 0, 1),
    suppressedNow: suppressedNow + suppressedNodes,
    readyUnits: ready.length,
    totalUnits: units.length,
    interceptorPool: pool,
  };
}

/**
 * The effectiveness a fully working abstract network is expected to reach. It
 * exists so the multiplier is calibrated, not invented: a network at its
 * reference defends exactly as it did before this model existed, which is why
 * the opening turn's numbers are unchanged.
 */
export const ABSTRACT_REFERENCE = 0.6;

/**
 * Multiplier applied to the abstract (non-unit) defensive system: 1 at the
 * reference, falling towards 0.6 as the network degrades.
 */
export function abstractDefenceFactor(network: DefenceNetwork): number {
  return clamp(0.6 + 0.4 * (network.effectiveness / ABSTRACT_REFERENCE), 0.6, 1);
}

/** Band label for how much the player should trust the picture. */
export type Confidence = 'confirmed' | 'assessed' | 'uncertain';

/**
 * How well the viewer can see someone else's defensive network. Own networks are
 * confirmed; a hostile one is only ever assessed, and degrades with the viewer's
 * reconnaissance at the target hex.
 */
export function networkConfidence(
  snap: GameSnapshot,
  faction: FactionId,
  recon: ReconQuality,
): Confidence {
  if (faction === snap.faction) return 'confirmed';
  if (recon === 'isr') return 'assessed';
  return 'uncertain';
}
