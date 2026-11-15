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
import { clamp, unitType } from '../core/world';
import logisticsData from '../data/logistics.json';

/**
 * Strategic inventories are divided by this to reach game-scale "strike
 * packages": one air strike order is one package of roughly 30 precision
 * munitions. 4,400 JASSM therefore read as 147 packages, not 4,400 sorties.
 */
export const MUNITIONS_PER_PACKAGE = 30;

/** Game-scale sortie ceiling for coalition air before endurance bites. */
export const COALITION_AIR_SORTIES_PER_TURN = 8;

/**
 * Arrow empties around the end of March (war start 28 Feb), which is turn ~5 on
 * this campaign's clock. The pool is drawn down evenly to that turn.
 */
export const ARROW_DEPLETION_TURN = 5;

/** THAAD was ~50% expended across a 30-turn campaign. */
export const THAAD_DRAIN_PER_TURN = 1;

/** Industry switches to surge after this share of the starting stock is spent. */
export const MOBILIZATION_DEPLETION = 0.6;

/** Surge production needs this many turns to arrive after the decision. */
export const MOBILIZATION_WARMUP_TURNS = 2;

/** Sorties per turn that count as high tempo for a coalition air arm. */
export const HIGH_TEMPO_SORTIES = 4;
/** Consecutive high-tempo turns before crew fatigue starts to bite. */
export const FATIGUE_AFTER_TURNS = 4;
/** Carrier deployment endurance: nine months on a 30-turn, nine-month campaign. */
export const CARRIER_ENDURANCE_TURNS = 20;
/** Homeland-defence diversion when Israeli soil is under missile attack. */
export const HOMELAND_DIVERSION = 0.7;
/** Missiles Iran can assemble from stockpiled components before the rate falls. */
export const IRAN_STOCKPILE_ASSEMBLY = 350;
/** Baseline tanker-supported coalition air sorties per turn. */
export const TANKER_SORTIE_BASE = 6;
/** Turn at which four months of reservist call-ups start to tell. */
export const ISRAEL_MOBILIZATION_FATIGUE_TURN = 12;
/** Political will a carrier rotation costs; without it the deployment extends. */
export const CARRIER_ROTATION_WILL = 6;
/** Turn after which PMF harassment of US logistics becomes routine. */
export const PMF_ACTIVATION_TURN = 6;
/** Detection loss while an Iranian radar network is under cyber attack. */
export const CYBER_RADAR_FACTOR = 0.7;
/** Turns a cyber effect holds. */
export const CYBER_EFFECT_TURNS = 2;
/**
 * IRIAF's share of its paper strike strength. Kept at the sourced 0.2 after
 * calibration: raising it to 0.5 changed no campaign outcome across eight
 * seeds, so there was no measured reason to weaken a documented figure.
 */
export const IRIAF_EFFECTIVENESS = 0.2;

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

/**
 * Menu preset: every endurance system on, for a campaign that keeps the war's
 * magazine and crew limits. Exposed here so the menu does not duplicate a flag
 * list that could drift from the scenario schema.
 */
export const ENDURANCE_PRESET: Required<EnduranceSystems> = {
  munitionsDepletion: true,
  interceptorDepletion: true,
  radarDamageMultiplier: true,
  sortieFatigue: true,
  carrierEndurance: true,
  iranProduction: true,
  proxySupply: true,
  cyberLimits: true,
  israelMobilization: true,
};

export function enduranceSystems(snap: GameSnapshot): Required<EnduranceSystems> {
  const systems = snap.systems ?? {};
  return {
    munitionsDepletion: systems.munitionsDepletion ?? false,
    interceptorDepletion: systems.interceptorDepletion ?? false,
    radarDamageMultiplier: systems.radarDamageMultiplier ?? false,
    sortieFatigue: systems.sortieFatigue ?? false,
    carrierEndurance: systems.carrierEndurance ?? false,
    iranProduction: systems.iranProduction ?? false,
    proxySupply: systems.proxySupply ?? false,
    cyberLimits: systems.cyberLimits ?? false,
    israelMobilization: systems.israelMobilization ?? false,
  };
}

export function enduranceEnabled(snap: GameSnapshot): boolean {
  const systems = enduranceSystems(snap);
  return Object.values(systems).some(Boolean);
}

/**
 * Build the endurance state. Called at game start when a scenario enables any
 * flag, and by tests that toggle the systems on after starting.
 */
export function initEndurance(snap: GameSnapshot): void {
  const systems = enduranceSystems(snap);
  if (!Object.values(systems).some(Boolean)) {
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
    tempo: {
      usa: { highTurns: 0, quietTurns: 0, factor: 1, pilotLosses: 0 },
      israel: { highTurns: 0, quietTurns: 0, factor: 1, pilotLosses: 0 },
    },
    homelandHitsThisTurn: 0,
    carriers: { deployedTurns: 0, factor: 1, extended: false },
    iran: { stockpile: IRAN_STOCKPILE_ASSEMBLY, producedFromStockpile: 0, factor: 1 },
    proxies: {
      houthi: { refilled: 0, dryTurn: null },
      hezbollah: { refilled: 0, dryTurn: null },
      hamas: { refilled: 0, dryTurn: null },
      pmf: { refilled: 0, dryTurn: null },
    },
    cyber: { radarUntilTurn: 0, effects: 0, effectiveness: 1 },
    israel: { fatigueTurn: null, factor: 1, pressure: 0, pressureStreak: 0 },
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

/**
 * Sortie multiplier: munitions state, crew fatigue, permanent pilot losses and
 * carrier crew endurance, whichever of those systems are enabled.
 */
export function sortieCapacityFactor(snap: GameSnapshot): number {
  const state = snap.endurance;
  if (!state) return 1;
  let factor = state.systems.munitionsDepletion ? state.sortieFactor : 1;
  if (state.systems.sortieFatigue) {
    const tempo = state.tempo?.israel;
    factor *= tempo?.factor ?? 1;
    // Pilot losses are permanent, so they sit outside the rest-and-recover
    // tempo factor and can never be trained back inside a campaign.
    factor *= 1 - (tempo?.pilotPenalty ?? 0);
  }
  if (state.systems.carrierEndurance) {
    factor *= state.carriers?.factor ?? 1;
  }
  if (state.systems.sortieFatigue && (state.homelandHitsLastTurn ?? 0) > 0) {
    // About 70% of Israeli sorties go to homeland defence while missiles are
    // inbound; the coalition total reflects that diversion.
    factor *= HOMELAND_DIVERSION;
  }
  return clamp(factor, 0.4, 1);
}

/**
 * Tanker-supported coalition air sorties per turn. The tanker fleet, not the
 * airframe count, is the binding constraint; carriers add a little capacity and
 * lose it as crews tire.
 */
export function tankerSortieCap(snap: GameSnapshot): number {
  const state = snap.endurance;
  if (!state?.systems.carrierEndurance) return Number.POSITIVE_INFINITY;
  const available = Number(snap.resources.tankerSorties ?? 0) + 2;
  return Math.max(1, Math.floor(Math.min(TANKER_SORTIE_BASE, available) * (state.carriers?.factor ?? 1)));
}

/** Max coalition air strike orders per turn; Infinity when the systems are off. */
export function airSortieCap(snap: GameSnapshot): number {
  const state = snap.endurance;
  if (!state) return Number.POSITIVE_INFINITY;
  let cap = Number.POSITIVE_INFINITY;
  if (state.systems.munitionsDepletion) {
    cap = Math.max(1, Math.round(COALITION_AIR_SORTIES_PER_TURN * state.sortieFactor));
  }
  if (state.systems.sortieFatigue || state.systems.carrierEndurance) {
    const enduranceCap = Math.max(1, Math.round(COALITION_AIR_SORTIES_PER_TURN * sortieCapacityFactor(snap)));
    cap = Math.min(cap, enduranceCap);
  }
  const tankers = tankerSortieCap(snap);
  if (Number.isFinite(tankers)) cap = Math.min(cap, tankers);
  return cap;
}

/** Sortie weight of a coalition strike: a distant base costs two tanker slots. */
export function strikeSortieWeight(distance: number): number {
  return distance > 8 ? 2 : 1;
}

/** Israeli sorties diverted to homeland defence while missiles are inbound. */
export function homelandDiversion(snap: GameSnapshot, faction: FactionId): number {
  const state = snap.endurance;
  if (!state?.systems.sortieFatigue) return 1;
  if (faction !== 'israel') return 1;
  return (state.homelandHitsLastTurn ?? 0) > 0 ? HOMELAND_DIVERSION : 1;
}

/** Record a missile impact on the homeland, for next turn's diversion. */
export function noteHomelandHit(snap: GameSnapshot, host: string | undefined): void {
  const state = snap.endurance;
  if (!state?.systems.sortieFatigue) return;
  if (host !== 'israel') return;
  state.homelandHitsThisTurn = (state.homelandHitsThisTurn ?? 0) + 1;
}

/**
 * A shot-down aircrew cannot be replaced inside a campaign: the pilot pipeline
 * is five years. Every loss permanently reduces the faction's sortie factor.
 */
export function recordPilotLoss(snap: GameSnapshot, faction: FactionId): void {
  const state = snap.endurance;
  if (!state?.systems.sortieFatigue) return;
  if (faction !== 'usa' && faction !== 'israel') return;
  const tempo = state.tempo?.[faction];
  if (!tempo) return;
  tempo.pilotLosses += 1;
  tempo.pilotPenalty = clamp((tempo.pilotPenalty ?? 0) + 0.03, 0, 0.3);
}

/**
 * IRIAF is a nominal air force: with the system on, Iranian air strikes are a
 * fraction as effective as their paper strength, because the fight is SAMs and
 * missiles, not air combat.
 */
export function strikeEffectiveness(snap: GameSnapshot, faction: FactionId, category: string): number {
  const state = snap.endurance;
  if (!state?.systems.sortieFatigue) return 1;
  if (faction === 'iran' && category === 'air') return IRIAF_EFFECTIVENESS;
  return 1;
}

/**
 * Iranian production bottleneck: a surge assembled from stockpiled components
 * for the opening turns, then a lower steady state on a damaged industrial base.
 * The naval blockade halves solid-fuel (missile) output, not drone assembly.
 */
export function iranProductionFactor(snap: GameSnapshot, line: string): number {
  const state = snap.endurance;
  if (!state?.systems.iranProduction) return 1;
  const stockpileLeft = state.iran?.stockpile ?? 0;
  const surge = stockpileLeft > 0 ? 1.5 : 0.6;
  const blockade = line === 'missile' ? 0.5 : 1;
  const factor = surge * blockade;
  state.iran!.factor = factor;
  return factor;
}

/** Draw down the finite stockpile of components as production is assembled. */
export function consumeIranStockpile(snap: GameSnapshot, output: number): void {
  const state = snap.endurance;
  if (!state?.systems.iranProduction || !state.iran) return;
  const used = Math.min(state.iran.stockpile, output);
  state.iran.stockpile -= used;
  state.iran.producedFromStockpile += used;
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
/**
 * Proxy resupply, from Brief B module 6. Hezbollah's Syrian route has been
 * closed since December 2024, so its magazines only fall; the Houthis make
 * about 90% of their own munitions and can trickle replacements in; the PMF is
 * rated "low" and Hamas is fixed at its pre-war inventory. Only factions that
 * actually field units are replenished.
 */
export function refillProxyMagazines(snap: GameSnapshot, events: ResolveEvent[]): void {
  const state = snap.endurance;
  if (!state?.systems.proxySupply) return;
  const cadence: Record<string, Record<string, number>> = {
    houthi: { drone: 2, missile: 3 },
  };
  for (const [faction, lines] of Object.entries(cadence)) {
    for (const unit of snap.units) {
      if (unit.faction !== faction) continue;
      const def = unitType(unit.typeId);
      const every = lines[def.category];
      if (!every || snap.turn % every !== 0) continue;
      const cap = def.magazine;
      if (unit.magazine >= cap) continue;
      unit.magazine += 1;
      const book = (state.proxies ??= {})[faction] ??= { refilled: 0, dryTurn: null };
      book.refilled += 1;
    }
  }
  for (const faction of ['hezbollah', 'hamas', 'pmf']) {
    const units = snap.units.filter((u) => u.faction === faction);
    if (units.length === 0) continue;
    const book = (state.proxies ??= {})[faction] ??= { refilled: 0, dryTurn: null };
    if (units.every((u) => u.magazine <= 0) && book.dryTurn === null) {
      book.dryTurn = snap.turn;
      events.push({
        text: `${faction === 'hezbollah' ? 'Hezbollah' : faction === 'hamas' ? 'Hamas' : 'The PMF'} has fired its last rounds: no resupply route is open.`,
        tone: 'warn',
        faction: faction as FactionId,
      });
    }
  }
}

/** Cyber may only blind a radar temporarily; it cannot destroy anything. */
export function cyberRadarFactor(snap: GameSnapshot, defender: FactionId): number {
  const state = snap.endurance;
  if (!state?.systems.cyberLimits) return 1;
  if (defender !== 'iran' && defender !== 'houthi') return 1;
  return snap.turn < (state.cyber?.radarUntilTurn ?? 0) ? CYBER_RADAR_FACTOR : 1;
}

/**
 * Cyber effectiveness decays as leadership and infrastructure losses mount.
 * Each operation costs a sixth of the remaining edge, floored at 30%: later
 * operations are less likely to land and never hold for more than a turn.
 */
export function cyberEffectiveness(snap: GameSnapshot): number {
  return snap.endurance?.cyber?.effectiveness ?? 1;
}

export function decayCyberEffectiveness(snap: GameSnapshot): void {
  const state = snap.endurance;
  if (state) decayCyber(state);
}

function decayCyber(state: NonNullable<GameSnapshot['endurance']>): void {
  if (!state.cyber) return;
  state.cyber.effectiveness = clamp((state.cyber.effectiveness ?? 1) - 0.15, 0.3, 1);
}

/** Record a successful temporary radar-blinding operation. */
export function applyCyberRadar(snap: GameSnapshot): void {
  const state = snap.endurance;
  if (!state?.systems.cyberLimits) return;
  state.cyber = state.cyber ?? { radarUntilTurn: 0, effects: 0, effectiveness: 1 };
  state.cyber.radarUntilTurn = snap.turn + CYBER_EFFECT_TURNS;
  state.cyber.effects += 1;
  decayCyber(state);
}

/**
 * Reservist fatigue: four months of call-ups (450,000 reservists, a 9% output
 * gap) erode the edge of Israeli ground formations, 2% a turn to a 75% floor.
 * Aircrew fatigue is a separate system; this is the land war.
 */
/** Israeli home-front pressure, 0-100, from sustained mobilization. */
export function israelMobilizationPressure(snap: GameSnapshot): number {
  return snap.endurance?.israel?.pressure ?? 0;
}

export function groundEffectiveness(snap: GameSnapshot, faction: FactionId, category: string): number {
  const state = snap.endurance;
  if (!state?.systems.israelMobilization) return 1;
  if (faction !== 'israel' || category !== 'ground') return 1;
  return state.israel?.factor ?? 1;
}

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

  if (state.systems.sortieFatigue) {
    const strikes = snap.orders.filter((order) => order.kind === 'strike');
    for (const faction of ['usa', 'israel'] as const) {
      const tempo = state.tempo?.[faction];
      if (!tempo) continue;
      const sorties = strikes.filter((order) => {
        const unit = snap.units.find((u) => u.uid === order.unitUid);
        return unit?.faction === faction;
      }).length;
      if (sorties >= HIGH_TEMPO_SORTIES) {
        tempo.highTurns += 1;
        tempo.quietTurns = 0;
        if (tempo.highTurns > FATIGUE_AFTER_TURNS) {
          tempo.factor = clamp(tempo.factor - 0.12, 0.6, 1);
          events.push({
            text:
              faction === 'israel'
                ? 'Israeli crews are past sustainable tempo: sortie generation is falling.'
                : 'US aircrews are past sustainable tempo: sortie generation is falling.',
            tone: 'warn',
            faction,
          });
        }
      } else {
        tempo.quietTurns += 1;
        if (tempo.quietTurns >= 2) {
          tempo.highTurns = 0;
          tempo.factor = clamp(tempo.factor + 0.06, 0.5, 1);
        }
      }
    }
    // Hits recorded during this turn are carried forward: the diversion they
    // cause is felt when the next turn's sortie plan is drawn up.
    state.homelandHitsLastTurn = state.homelandHitsThisTurn ?? 0;
    state.homelandHitsThisTurn = 0;
  }

  if (state.systems.carrierEndurance) {
    const carriers = state.carriers ?? { deployedTurns: 0, factor: 1, extended: false };
    carriers.deployedTurns += 1;
    if (carriers.deployedTurns > CARRIER_ENDURANCE_TURNS) {
      // Rotate the crew home if the political cost can be paid; otherwise
      // extend the deployment and accept declining sortie generation.
      if (!carriers.extended && snap.resources.politicalWill >= CARRIER_ROTATION_WILL) {
        snap.resources.politicalWill = clamp(snap.resources.politicalWill - CARRIER_ROTATION_WILL, 0, 100);
        carriers.deployedTurns = 0;
        carriers.factor = 1;
        events.push({
          text: `A relief carrier is available: the deployment is rotated home at a cost of ${CARRIER_ROTATION_WILL} political will.`,
          tone: 'good',
          faction: 'usa',
        });
      } else {
        if (!carriers.extended) {
          carriers.extended = true;
          events.push({
            text: 'Carrier crews are past deployment endurance; no relief carrier is available, so the deployment is extended at rising cost.',
            tone: 'warn',
            faction: 'usa',
          });
        }
        carriers.factor = clamp(carriers.factor - 0.04, 0.6, 1);
      }
    }
    state.carriers = carriers;
  }

  if (state.systems.iranProduction && state.iran) {
    // The surge is drawn from the component stockpile; once it is gone the rate
    // settles at the damaged industrial base's steady state.
    state.iran.factor = state.iran.stockpile > 0 ? 1.5 : 0.6;
  }

  if (state.systems.proxySupply) {
    refillProxyMagazines(snap, events);
    // PMF harassment is a periodic drain on US logistics rather than a front:
    // 65 attacks in the opening months, then a low-intensity tempo.
    const pmf = (state.proxies ??= {}).pmf ??= { refilled: 0, dryTurn: null };
    const active = snap.turn >= PMF_ACTIVATION_TURN || (snap.domestic?.casualtiesTotal ?? 0) >= 50;
    if (active && pmf.dryTurn === null && snap.turn % 3 === 0) {
      snap.resources.politicalWill = clamp(snap.resources.politicalWill - 1, 0, 100);
      events.push({
        text: 'PMF rocket and drone harassment drains US base logistics and costs a point of political will.',
        tone: 'warn',
        faction: 'usa',
      });
    }
  }

  if (state.systems.israelMobilization) {
    const israel = (state.israel ??= { fatigueTurn: null, factor: 1, pressure: 0, pressureStreak: 0 });
    if (snap.turn >= ISRAEL_MOBILIZATION_FATIGUE_TURN) {
      if (israel.fatigueTurn === null) {
        israel.fatigueTurn = snap.turn;
        events.push({
          text: 'Four months of reservist call-ups: Israeli ground formations are showing fatigue and the output gap is biting.',
          tone: 'warn',
          faction: 'israel',
        });
      }
      israel.factor = clamp(israel.factor - 0.02, 0.75, 1);
      // Reservist call-ups and the war's cost feed the same kind of home-front
      // pressure the US domestic gauge models; it is what ends the campaign,
      // not the ground-combat penalty on its own.
      israel.pressure = clamp(israel.pressure + 2, 0, 100);
      israel.pressureStreak = israel.pressure >= 85 ? israel.pressureStreak + 1 : 0;
    }
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
