/**
 * Munitions and interceptor endurance (integration brief, tasks 2a and 2b).
 *
 * The war was decided by "command of the reload" as much as by tactics: cheap
 * interceptors and precision munitions were spent faster than either side could
 * replace them, and destroying the radars that cue a battery forced it to spend
 * more rounds per engagement. This module models exactly that, and nothing else.
 *
 * Everything here is gated by `snap.systems`, copied from the scenario's
 * `systems` block, which is empty by default. With the flags off, every export
 * returns the neutral value and `runTurn` takes the same path it did before the
 * system existed — the balance baseline and the existing tests are untouched.
 *
 * Parameters come from `src/data/logistics.json` → `endurance` (sourced in the
 * supplementary brief); the game-scale conversion is stated in GAME_SCALE and in
 * DATA_GAPS.md rather than hidden in arithmetic.
 */
import type { EnduranceState, EnduranceSystems, FactionId, GameSnapshot, ResolveEvent } from '../core/types';
import type { TheaterMap } from '../map/TheaterMap';
import { clamp } from '../core/world';
import logisticsData from '../data/logistics.json';

/**
 * Strategic inventories are divided by this to reach game-scale "strike
 * packages": one air strike order is one package of roughly 30 precision
 * munitions. 4,400 JASSM therefore read as 147 packages, not 4,400 sorties.
 */
const MUNITIONS_PER_PACKAGE = 30;

/** Game-scale sortie ceiling for coalition air before endurance bites. */
export const COALITION_AIR_SORTIES_PER_TURN = 8;

/**
 * Arrow empties around the end of March (war start 28 Feb), which is turn ~5 on
 * this campaign's clock. The pool is drawn down evenly to that turn.
 */
export const ARROW_DEPLETION_TURN = 5;

/** THAAD was ~50% expended across a 30-turn campaign. */
const THAAD_DRAIN_PER_TURN = 1;

/** Industry switches to surge after this share of the starting stock is spent. */
const MOBILIZATION_DEPLETION = 0.6;

/** Surge production needs this many turns to arrive after the decision. */
const MOBILIZATION_WARMUP_TURNS = 2;

interface MunitionSource {
  label: string;
  starting_inventory: [number, number] | null;
  production_per_year_prewar: number | null;
  production_per_year_surge: number | null;
}

const dataEndurance = (logisticsData as unknown as {
  endurance: {
    munitions_depletion: Record<string, MunitionSource>;
    interceptor_depletion: Record<string, unknown>;
  };
}).endurance;

function startingPackages(id: string): number {
  const row = dataEndurance.munitions_depletion[id];
  const inventory = row?.starting_inventory?.[1] ?? 0;
  return Math.round(inventory / MUNITIONS_PER_PACKAGE);
}

function yearlyProduction(id: string, surge: boolean): number {
  const row = dataEndurance.munitions_depletion[id];
  const perYear = (surge ? row?.production_per_year_surge : row?.production_per_year_prewar) ?? 0;
  // Year → turn → package.
  return perYear / 12 / MUNITIONS_PER_PACKAGE;
}

export function enduranceSystems(snap: GameSnapshot): Required<EnduranceSystems> {
  const systems = snap.systems ?? {};
  return {
    munitionsDepletion: systems.munitionsDepletion ?? false,
    interceptorDepletion: systems.interceptorDepletion ?? false,
    radarDamageMultiplier: systems.radarDamageMultiplier ?? false,
  };
}

export function enduranceEnabled(snap: GameSnapshot): boolean {
  const systems = enduranceSystems(snap);
  return systems.munitionsDepletion || systems.interceptorDepletion || systems.radarDamageMultiplier;
}

/**
 * Build the endurance state. Called at game start when a scenario enables any
 * flag, and by tests that toggle the systems on after starting.
 */
export function initEndurance(snap: GameSnapshot): void {
  const systems = enduranceSystems(snap);
  if (!systems.munitionsDepletion && !systems.interceptorDepletion && !systems.radarDamageMultiplier) {
    snap.endurance = undefined;
    return;
  }

  const munitions: EnduranceState['munitions'] = {};
  for (const id of ['jassm', 'tlam', 'prsm']) {
    const stock = startingPackages(id);
    if (stock <= 0) continue;
    munitions[id] = {
      label: dataEndurance.munitions_depletion[id]?.label ?? id,
      stock,
      starting: stock,
      spent: 0,
      produced: 0,
    };
  }

  snap.endurance = {
    systems,
    munitions,
    reload: { usa: 0, israel: 0 },
    mobilizationTurn: { usa: null, israel: null },
    interceptorDrain: {
      israel: systems.interceptorDepletion
        ? Math.ceil((snap.resources.interceptorsIsrael || 0) / ARROW_DEPLETION_TURN)
        : 0,
      usa: systems.interceptorDepletion ? THAAD_DRAIN_PER_TURN : 0,
    },
    sortieFactor: 1,
  };
  refreshSortieFactor(snap);
}

/** Test / scenario hook: turn systems on for an already-started snapshot. */
export function setEnduranceSystems(snap: GameSnapshot, systems: EnduranceSystems): void {
  snap.systems = { ...systems };
  initEndurance(snap);
}

function refreshSortieFactor(snap: GameSnapshot): void {
  const state = snap.endurance;
  if (!state) return;
  if (!state.systems.munitionsDepletion) {
    state.sortieFactor = 1;
    return;
  }
  const pools = Object.values(state.munitions);
  const stock = pools.reduce((sum, pool) => sum + pool.stock, 0);
  const starting = pools.reduce((sum, pool) => sum + pool.starting, 0);
  if (starting <= 0) {
    state.sortieFactor = 1;
    return;
  }
  const share = stock / starting;
  // A hard stop would make a depleted magazine into a broken game; degraded
  // operations at no worse than half tempo is the documented behaviour.
  state.sortieFactor = share >= 0.35 ? 1 : clamp(0.5 + (share / 0.35) * 0.5, 0.5, 1);
}

/** Sortie multiplier from munitions endurance. 1 when the system is off. */
export function sortieCapacityFactor(snap: GameSnapshot): number {
  return snap.endurance?.sortieFactor ?? 1;
}

/** Max coalition air strike orders per turn; Infinity when the system is off. */
export function airSortieCap(snap: GameSnapshot): number {
  if (!snap.endurance?.systems.munitionsDepletion) return Number.POSITIVE_INFINITY;
  return Math.max(1, Math.round(COALITION_AIR_SORTIES_PER_TURN * sortieCapacityFactor(snap)));
}

/**
 * Spend one strike package when a coalition air or naval strike is launched.
 * Returns the pool that was spent, or null when the system is off.
 */
export function consumeCoalitionMunitions(snap: GameSnapshot, category: string): string | null {
  const state = snap.endurance;
  if (!state?.systems.munitionsDepletion) return null;
  const poolId = category === 'air' ? 'jassm' : category === 'naval' ? 'tlam' : null;
  if (!poolId) return null;
  const pool = state.munitions[poolId];
  if (!pool) return null;
  // An empty pool does not cancel the sortie (the capacity penalty already
  // reduced tempo); it records that the round came out of the last package.
  pool.stock = Math.max(0, pool.stock - 1);
  pool.spent += 1;
  state.reload.usa -= 1;
  state.reload.israel -= 1;
  refreshSortieFactor(snap);
  return poolId;
}

/**
 * Multiple of interceptors a defender spends per engagement once its cueing
 * radars are gone. Each destroyed radar adds 35%, capped at 2.5x.
 */
export function radarDamageMultiplier(snap: GameSnapshot, map: TheaterMap, defender: FactionId): number {
  if (!snap.endurance?.systems.radarDamageMultiplier) return 1;
  const side = defender === 'usa' || defender === 'israel' ? 'coalition' : 'iran';
  let destroyed = 0;
  for (const node of map.nodes) {
    const isRadar = node.facility === 'radar';
    if (!isRadar) continue;
    const owner = node.operators?.[0] ?? node.host;
    const nodeSide = owner === 'usa' || owner === 'israel' ? 'coalition' : 'iran';
    if (nodeSide !== side) continue;
    const integrity = snap.nodes[node.id]?.integrity;
    if (integrity !== undefined && integrity <= 0) destroyed += 1;
  }
  return Math.min(2.5, 1 + destroyed * 0.35);
}

/**
 * Air-defence effectiveness from the reload score. A faction that has produced
 * less than it has fired is running down its magazine and cues less reliably;
 * a faction with a healthy production surplus gets a small bonus.
 */
export function airDefenceEffectiveness(snap: GameSnapshot, defender: FactionId): number {
  const state = snap.endurance;
  if (!state?.systems.munitionsDepletion && !state?.systems.interceptorDepletion) return 1;
  const score = defender === 'israel' ? state.reload.israel : state.reload.usa;
  return clamp(1 + score / 50, 0.85, 1.1);
}

/** Per-turn endurance bookkeeping: production, mobilization, magazine drain. */
export function advanceEndurance(snap: GameSnapshot, events: ResolveEvent[]): void {
  const state = snap.endurance;
  if (!state) return;

  if (state.systems.munitionsDepletion) {
    const pools = Object.values(state.munitions);
    const stock = pools.reduce((sum, pool) => sum + pool.stock, 0);
    const starting = pools.reduce((sum, pool) => sum + pool.starting, 0);
    const spentShare = starting > 0 ? 1 - stock / starting : 0;

    if (spentShare >= MOBILIZATION_DEPLETION && state.mobilizationTurn.usa === null) {
      state.mobilizationTurn.usa = snap.turn;
      events.push({
        text: 'Defence-industrial mobilization: precision-munition production switches to surge rates.',
        tone: 'warn',
        faction: 'usa',
      });
    }
    const mobilizing =
      state.mobilizationTurn.usa !== null && snap.turn > state.mobilizationTurn.usa + MOBILIZATION_WARMUP_TURNS;

    let produced = 0;
    for (const [id, pool] of Object.entries(state.munitions)) {
      // Production is under one package per turn at game scale, so the fraction
      // is carried on the pool instead of being rounded away every turn.
      pool.carry = (pool.carry ?? 0) + yearlyProduction(id, mobilizing);
      const added = Math.floor(pool.carry);
      if (added > 0) {
        pool.carry -= added;
        pool.stock += added;
        pool.produced += added;
        produced += added;
      }
    }
    state.reload.usa += produced;
    state.reload.israel += produced;
    refreshSortieFactor(snap);
  }

  if (state.systems.interceptorDepletion) {
    for (const faction of ['usa', 'israel'] as const) {
      const drain = state.interceptorDrain[faction];
      if (drain <= 0) continue;
      const key = faction === 'usa' ? 'interceptorsUSA' : 'interceptorsIsrael';
      const before = snap.resources[key];
      if (before <= 0) continue;
      const after = Math.max(0, before - drain);
      snap.resources[key] = after;
      state.reload[faction] -= drain;
      if (after === 0 && before > 0) {
        events.push({
          text:
            faction === 'israel'
              ? 'Israeli interceptor stocks are exhausted: the upper tier cannot engage until resupplied.'
              : 'US interceptor stocks in theatre are exhausted: terminal defence is degraded.',
          tone: 'bad',
          faction,
        });
      } else if (before > after && after <= Math.ceil(before / 4) && after > 0) {
        events.push({
          text: `${faction === 'israel' ? 'Israeli' : 'US'} interceptor stocks below the critical threshold (${after}).`,
          tone: 'warn',
          faction,
        });
      }
    }
  }
}
