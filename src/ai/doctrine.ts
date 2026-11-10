/**
 * AI doctrines (SPEC §28 / Phase 3).
 *
 * A doctrine is a scenario-selectable profile that shapes target priority,
 * ammunition conservation, salvo size, mining appetite and how many strikes a
 * faction is willing to fly per turn. The USA and Israel therefore do not share
 * a target list, and Iran does not pick targets by weight alone.
 */
import type { FactionId, GameSnapshot, MapNodeDef, NodeKind } from '../core/types';

export type DoctrineId =
  | 'maximumPressure'
  | 'attrition'
  | 'saturation'
  | 'ammoConservation'
  | 'infrastructure'
  | 'maritimePressure'
  | 'escalationRestraint'
  | 'negotiationFirst';

export type TargetTag =
  | 'nuclear'
  | 'missileIndustry'
  | 'airbase'
  | 'naval'
  | 'port'
  | 'oil'
  | 'urban'
  | 'chokepoint'
  | 'other';

export interface DoctrineProfile {
  id: DoctrineId;
  label: string;
  description: string;
  /** Fraction of the wing's magazines (or Iran's rounds) held back. */
  ammoReserve: number;
  /** Multiplier on Iranian salvo size. */
  salvoScale: number;
  /** Multiplier on the base chance to lay mines / press the sea lanes. */
  mineBias: number;
  /** Maximum offensive packages per turn. */
  maxPackages: number;
  /** Hard cap on resolved strikes per turn (including maritime work). */
  strikeCap: number;
  targetBias: Partial<Record<TargetTag, number>>;
}

export const DOCTRINES: Record<DoctrineId, DoctrineProfile> = {
  maximumPressure: {
    id: 'maximumPressure',
    label: 'Maximum pressure',
    description: 'Prioritise the nuclear programme and the missile industry; accept a high tempo and thin reserves.',
    ammoReserve: 0,
    salvoScale: 1.2,
    mineBias: 1,
    maxPackages: 2,
    strikeCap: 3,
    targetBias: { nuclear: 1.6, missileIndustry: 1.3, oil: 1.2, urban: 1.1 },
  },
  attrition: {
    id: 'attrition',
    label: 'Attrition',
    description: 'Grind down airfields, production and naval assets while keeping a reserve for the next turn.',
    ammoReserve: 0.15,
    salvoScale: 1,
    mineBias: 0.8,
    maxPackages: 1,
    strikeCap: 2,
    targetBias: { airbase: 1.4, missileIndustry: 1.2, naval: 1.1 },
  },
  saturation: {
    id: 'saturation',
    label: 'Saturation',
    description: 'Large salvos against a few targets to overwhelm defences, accepting the ammunition bill.',
    ammoReserve: 0,
    salvoScale: 1.6,
    mineBias: 1,
    maxPackages: 1,
    strikeCap: 2,
    targetBias: { airbase: 1.2, urban: 1.3, naval: 1.1 },
  },
  ammoConservation: {
    id: 'ammoConservation',
    label: 'Ammunition conservation',
    description: 'Small, precise strikes; hold a large reserve and never empty the magazines.',
    ammoReserve: 0.4,
    salvoScale: 0.7,
    mineBias: 0.6,
    maxPackages: 1,
    strikeCap: 1,
    targetBias: { nuclear: 1.2, missileIndustry: 1.2 },
  },
  infrastructure: {
    id: 'infrastructure',
    label: 'Infrastructure disruption',
    description: 'Oil, ports and naval facilities over battlefield attrition.',
    ammoReserve: 0.1,
    salvoScale: 1,
    mineBias: 1.2,
    maxPackages: 1,
    strikeCap: 2,
    targetBias: { oil: 1.8, naval: 1.6, port: 1.7, chokepoint: 1.5, urban: 0.7 },
  },
  maritimePressure: {
    id: 'maritimePressure',
    label: 'Maritime pressure',
    description: 'Closed sea lanes, mined chokepoints and anti-ship salvos as the main lever.',
    ammoReserve: 0.1,
    salvoScale: 1.1,
    mineBias: 2.2,
    maxPackages: 1,
    strikeCap: 2,
    targetBias: { naval: 2, port: 1.8, chokepoint: 1.6, oil: 1.3, airbase: 0.8 },
  },
  escalationRestraint: {
    id: 'escalationRestraint',
    label: 'Escalation restraint',
    description: 'Avoid cities and oil, keep salvos small and stop after one strike.',
    ammoReserve: 0.25,
    salvoScale: 0.8,
    mineBias: 0.5,
    maxPackages: 1,
    strikeCap: 1,
    targetBias: { urban: 0.4, oil: 0.7, nuclear: 1.1 },
  },
  negotiationFirst: {
    id: 'negotiationFirst',
    label: 'Negotiation first',
    description: 'Minimise escalation and preserve leverage for a settlement.',
    ammoReserve: 0.3,
    salvoScale: 0.7,
    mineBias: 0.3,
    maxPackages: 1,
    strikeCap: 1,
    targetBias: { urban: 0.3, oil: 0.5, airbase: 0.7, naval: 0.7 },
  },
};

const DEFAULT_DOCTRINE: Record<string, DoctrineId> = {
  usa: 'maximumPressure',
  israel: 'attrition',
  iran: 'maritimePressure',
  houthi: 'infrastructure',
  saudi: 'escalationRestraint',
};

/**
 * Scenario-specific doctrine selection. Scenarios can override any faction;
 * command campaigns get the defaults above.
 */
export const SCENARIO_DOCTRINES: Record<string, Partial<Record<string, DoctrineId>>> = {
  tutorial: { usa: 'ammoConservation', israel: 'attrition', iran: 'escalationRestraint' },
};

export function doctrineIdFor(faction: FactionId, scenarioId: string): DoctrineId {
  return SCENARIO_DOCTRINES[scenarioId]?.[faction] ?? DEFAULT_DOCTRINE[faction] ?? 'attrition';
}

export function doctrineFor(faction: FactionId, scenarioId: string): DoctrineProfile {
  return DOCTRINES[doctrineIdFor(faction, scenarioId)];
}

export function targetTag(kind: NodeKind): TargetTag {
  switch (kind) {
    case 'nuclear':
      return 'nuclear';
    case 'missile-industry':
      return 'missileIndustry';
    case 'airbase':
      return 'airbase';
    case 'naval':
      return 'naval';
    case 'port':
      return 'port';
    case 'oil':
      return 'oil';
    case 'urban':
      return 'urban';
    case 'chokepoint':
      return 'chokepoint';
    default:
      return 'other';
  }
}

/** Faction objectives, before doctrine modifiers (SPEC §28). */
const FACTION_BIAS: Record<'usa' | 'israel', Partial<Record<TargetTag, number>>> = {
  usa: {
    nuclear: 10,
    missileIndustry: 6,
    naval: 6,
    port: 4,
    airbase: 4,
    oil: 3,
    urban: 1,
    chokepoint: 2,
    other: 1,
  },
  israel: {
    missileIndustry: 9,
    nuclear: 5,
    airbase: 6,
    naval: 3,
    port: 2,
    oil: 1,
    urban: 2,
    chokepoint: 3,
    other: 1,
  },
};

/**
 * Score a candidate node for a coalition faction. Higher is better. Strategic
 * and hardened sites are worth more, cities are not treated as free targets,
 * and doctrine biases are applied last.
 */
export function coalitionTargetScore(
  faction: 'usa' | 'israel',
  node: MapNodeDef,
  doctrine: DoctrineProfile,
): number {
  const base = FACTION_BIAS[faction][targetTag(node.kind)] ?? 1;
  const strategic = node.strategic ? 1.3 : 1;
  const hardened = node.hardened ? 1.15 : 1;
  const bias = doctrine.targetBias[targetTag(node.kind)] ?? 1;
  return Math.round(base * strategic * hardened * bias * 10) / 10;
}

/** Iranian target score against coalition nodes; doctrine makes the sea matter. */
export function iranTargetScore(node: MapNodeDef, doctrine: DoctrineProfile): number {
  const base: Partial<Record<TargetTag, number>> = {
    airbase: 10,
    naval: 5,
    oil: 5,
    port: 3,
    urban: 4,
    chokepoint: 3,
    other: 1,
  };
  const strategic = node.strategic ? 1.2 : 1;
  return Math.round((base[targetTag(node.kind)] ?? 1) * strategic * (doctrine.targetBias[targetTag(node.kind)] ?? 1) * 10) / 10;
}

/** How many of a stock type the AI may spend this turn after its reserve. */
export function spendableStock(stock: number, doctrine: DoctrineProfile): number {
  if (stock <= 0) return 0;
  const reserve = Math.ceil(stock * doctrine.ammoReserve);
  return Math.max(0, stock - reserve);
}

/** True when the wing is below the doctrine's reserve floor. */
export function belowReserve(magazine: number, doctrine: DoctrineProfile): boolean {
  return magazine <= Math.ceil(doctrine.ammoReserve * 4);
}

/** Whether the AI should consider a maritime action at all. */
export function wantsMaritime(snap: GameSnapshot, doctrine: DoctrineProfile): boolean {
  if (doctrine.mineBias < 0.8) return false;
  return snap.meters.hormuz < 70 || Object.keys(snap.minefields ?? {}).length > 0;
}

/**
 * Domestic political restraint (SPEC §28: AI responds to political conditions).
 * Below a floor of political will, only a maximum-pressure doctrine keeps
 * flying; the others stand down rather than spend the war coalition.
 */
export function coalitionShouldStandDown(snap: GameSnapshot, doctrine: DoctrineProfile): boolean {
  if (doctrine.id === 'maximumPressure') return false;
  return snap.resources.politicalWill < 20 || (snap.domestic?.congress ?? 60) < 25;
}

/** Iran holds fire when its own institutions are close to breaking. */
export function iranShouldHoldFire(snap: GameSnapshot): boolean {
  return (snap.iranDomestic?.stability ?? 100) < 30;
}
