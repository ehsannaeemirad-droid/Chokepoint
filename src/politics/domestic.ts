/**
 * Phase 2: the US domestic-pressure system.
 *
 * One gauge — `pressure` (0-100) — driven by exactly two inputs:
 *   1. `congress` — congressional support for the campaign (0-100, 100 = best).
 *      Moved by casualty events, nuclear escalation, recovery and the public
 *      address order.
 *   2. `economy`  — economic pressure at home (0-100, 100 = worst). Derived
 *      from the inflation meter and sustained oil-price spikes.
 *
 * Rules of the system:
 * - Congress below a threshold triggers a restriction on US offensive
 *   operations, announced `noticeTurns` ahead and applied at the start of the
 *   turn it takes effect. Restrictions are NEVER silent: every announcement,
 *   every entry into force and every lift is a logged event with numbers.
 * - Economic pressure cuts the sustainment budget: interceptor resupply per
 *   airlift cycle and airlift regeneration shrink with `economy`. Every cut or
 *   restoration is logged.
 * - Casualty events (US formations destroyed, impacts on major US Gulf bases)
 *   accumulate during the turn and produce a casualty report plus a
 *   congressional response in the domestic phase.
 * - Public address order: spends political capital, has a cooldown, buys
 *   congressional support.
 * - The `usDomesticLoss` hook in victory.ts fires when pressure crosses the
 *   collapse threshold.
 *
 * Everything here is deterministic: no RNG is consumed anywhere in this
 * module, so replays stay byte-identical.
 */
import { reject, type Rejection } from '../core/rejection';
import type { DomesticConfig, DomesticState, GameSnapshot, MapNodeDef, ResolveEvent, RestrictionLevel } from '../core/types';
import { clamp } from '../core/world';

export type { DomesticConfig, DomesticState, RestrictionLevel } from '../core/types';

export const DEFAULT_DOMESTIC_CFG: DomesticConfig = {
  congressStart: 60,
  economyStart: 10,
  restrictCongress: 35,
  suspendCongress: 20,
  liftBuffer: 8,
  noticeTurns: 1,
  collapsePressure: 85,
  collapseTurns: 2,
  casualtyCongressDrop: 4,
  casualtyDropCap: 20,
  escalationCongressStep: 3,
  recoveryPerTurn: 2,
  communicate: { cost: 3, cooldown: 3, gain: 8 },
  economyAirliftStep: 25,
  economyResupplyStep: 15,
  resupplyFloor: 4,
  baselineResupply: 12,
  baselineAirliftRegen: 5,
};

/** Mutable domestic state carried on the snapshot. Plain JSON. See types.ts. */

export function domesticCfg(snap: GameSnapshot): DomesticConfig {
  return snap.domesticCfg ?? DEFAULT_DOMESTIC_CFG;
}

export function defaultDomesticState(cfg: DomesticConfig = DEFAULT_DOMESTIC_CFG): DomesticState {
  return {
    congress: cfg.congressStart,
    economy: cfg.economyStart,
    pressure: domesticPressure(cfg.congressStart, cfg.economyStart),
    restriction: 'none',
    pending: null,
    cooldown: 0,
    casualtiesTurn: 0,
    casualtiesTotal: 0,
    lastResupply: cfg.baselineResupply,
    lastAirliftRegen: cfg.baselineAirliftRegen,
  };
}

/** The single gauge: 60% congressional, 40% economic. */
export function domesticPressure(congress: number, economy: number): number {
  return clamp(Math.round((100 - congress) * 0.6 + economy * 0.4), 0, 100);
}

/** Airlift points regenerated per turn under the current economic pressure. */
export function economyAirliftRegen(snap: GameSnapshot): number {
  const cfg = domesticCfg(snap);
  const economy = snap.domestic?.economy ?? cfg.economyStart;
  return Math.max(0, cfg.baselineAirliftRegen - Math.floor(economy / cfg.economyAirliftStep));
}

/** Interceptors delivered per strategic-airlift cycle under economic pressure. */
export function economyResupplyAmount(snap: GameSnapshot): number {
  const cfg = domesticCfg(snap);
  const economy = snap.domestic?.economy ?? cfg.economyStart;
  return Math.max(cfg.resupplyFloor, cfg.baselineResupply - Math.floor(economy / cfg.economyResupplyStep) * 2);
}

/** Record US casualty events during the turn (combat calls this). */
export function addCasualties(snap: GameSnapshot, n: number): void {
  if (!snap.domestic || n <= 0) return;
  snap.domestic.casualtiesTurn += n;
  snap.domestic.casualtiesTotal += n;
}

/**
 * Strike gate for congressional restrictions. Returns the refusal reason when
 * the active restriction forbids the mission, `null` otherwise. Only US
 * formations are bound by Congress; Israeli operations are not.
 */
export function restrictionBlocksStrike(
  snap: GameSnapshot,
  unitFaction: string,
  node?: MapNodeDef,
): Rejection | null {
  if (unitFaction !== 'usa' || !snap.domestic) return null;
  const level = snap.domestic.restriction;
  if (level === 'suspended') {
    return reject('congress-suspended', 'Congress has suspended all US offensive strikes');
  }
  if (level === 'restricted' && node && node.host === 'iran') {
    return reject('congress-restricted', 'Congress has restricted US operations inside Iranian territory');
  }
  return null;
}

function restrictionLabel(level: RestrictionLevel): string {
  if (level === 'restricted') return 'US strikes inside Iranian territory forbidden';
  if (level === 'suspended') return 'all US offensive strikes suspended';
  return 'restrictions lifted';
}

/**
 * Domestic phase, once per resolved turn, after the chokepoint economics so
 * inflation is fresh. Updates the two drivers, publishes the casualty report,
 * announces (never silently applies) restriction changes, ticks the public
 * address cooldown and recomputes the single gauge.
 */
export function updateDomestic(snap: GameSnapshot, events: ResolveEvent[]): void {
  const d = snap.domestic;
  if (!d) return;
  const cfg = domesticCfg(snap);

  // --- driver 2: economic pressure follows inflation and oil spikes ---------
  const targetEconomy = clamp(
    Math.round(snap.meters.inflation * 2 + Math.max(0, snap.meters.oilPrice - 120) * 0.2),
    0,
    100,
  );
  if (targetEconomy !== d.economy) {
    const before = d.economy;
    d.economy = targetEconomy;
    if (Math.abs(targetEconomy - before) >= 10) {
      events.push({
        text: `Economic pressure at home ${Math.round(before)} → ${targetEconomy} (inflation ${snap.meters.inflation}%).`,
        tone: 'warn',
        faction: 'usa',
      });
    }
  }

  // Budget consequences — announced, never silent.
  const regen = economyAirliftRegen(snap);
  if (regen !== d.lastAirliftRegen) {
    events.push({
      text: `Airlift regeneration ${regen < d.lastAirliftRegen ? 'cut' : 'restored'} to +${regen}/turn (economic pressure ${d.economy}).`,
      tone: regen < d.lastAirliftRegen ? 'warn' : 'info',
      faction: 'usa',
    });
    d.lastAirliftRegen = regen;
  }
  const resupply = economyResupplyAmount(snap);
  if (resupply !== d.lastResupply) {
    events.push({
      text: `Interceptor resupply ${resupply < d.lastResupply ? 'cut' : 'restored'}: ${d.lastResupply} → ${resupply} per airlift cycle (economic pressure ${d.economy}).`,
      tone: resupply < d.lastResupply ? 'warn' : 'info',
      faction: 'usa',
    });
    d.lastResupply = resupply;
  }

  // --- driver 1: congressional support ---------------------------------------
  if (d.casualtiesTurn > 0) {
    const before = d.congress;
    const drop = Math.min(cfg.casualtyDropCap, d.casualtiesTurn * cfg.casualtyCongressDrop);
    d.congress = clamp(d.congress - drop, 0, 100);
    events.push({
      text: `Casualty report (turn ${snap.turn}): ${d.casualtiesTurn} US casualty event${d.casualtiesTurn === 1 ? '' : 's'} this turn, ${d.casualtiesTotal} to date. Congressional support ${Math.round(before)} → ${Math.round(d.congress)}.`,
      tone: 'bad',
      faction: 'usa',
    });
    if (d.casualtiesTurn >= 4) {
      events.push({
        text: 'Congress passes a resolution demanding a withdrawal timeline.',
        tone: 'warn',
        faction: 'usa',
      });
    } else if (d.casualtiesTurn >= 2) {
      events.push({
        text: 'Congressional leadership demands a briefing on escalation risk.',
        tone: 'info',
        faction: 'usa',
      });
    }
    d.casualtiesTurn = 0;
  } else if (d.congress < 100) {
    d.congress = clamp(d.congress + cfg.recoveryPerTurn, 0, 100);
  }

  const escalationStep = Math.min(cfg.escalationCongressStep, Math.floor(snap.meters.nuclearEscalation / 20));
  if (escalationStep > 0 && d.congress > 0) {
    const before = d.congress;
    d.congress = clamp(d.congress - escalationStep, 0, 100);
    if (d.congress !== before) {
      events.push({
        text: `Nuclear escalation erodes congressional support: ${Math.round(before)} → ${Math.round(d.congress)}.`,
        tone: 'warn',
        faction: 'usa',
      });
    }
  }

  // --- restrictions: announced ahead, applied at the start of a later turn ---
  const effRestrict = d.restriction === 'restricted' ? cfg.restrictCongress + cfg.liftBuffer : cfg.restrictCongress;
  const effSuspend = d.restriction === 'suspended' ? cfg.suspendCongress + cfg.liftBuffer : cfg.suspendCongress;
  const desired: RestrictionLevel =
    d.congress <= effSuspend ? 'suspended' : d.congress <= effRestrict ? 'restricted' : 'none';
  if (desired !== d.restriction && (!d.pending || d.pending.level !== desired)) {
    const effectiveTurn = snap.turn + cfg.noticeTurns;
    d.pending = { level: desired, effectiveTurn };
    events.push({
      text:
        desired === 'none'
          ? `Congressional restriction will be lifted at the start of turn ${effectiveTurn} (support ${Math.round(d.congress)}).`
          : `Congressional restriction announced: ${restrictionLabel(desired)}, effective from the start of turn ${effectiveTurn} (support ${Math.round(d.congress)}).`,
      tone: 'warn',
      faction: 'usa',
    });
  }

  if (d.cooldown > 0) d.cooldown -= 1;
  d.pressure = domesticPressure(d.congress, d.economy);

  // Collapse clock: the pressure gauge must hold at/above the threshold for
  // `collapseTurns` consecutive resolved turns before the consensus breaks.
  const streak = (snap.meters.domesticPressureStreak ?? 0);
  snap.meters.domesticPressureStreak = d.pressure >= cfg.collapsePressure ? streak + 1 : 0;
}

/**
 * Apply any announced restriction whose effective turn has arrived. Called at
 * the very start of `runTurn`, before player orders resolve, so a restriction
 * announced during turn T binds every mission planned for turn T+1.
 */
export function applyPendingDomestic(snap: GameSnapshot, events: ResolveEvent[]): void {
  const d = snap.domestic;
  if (!d || !d.pending || snap.turn < d.pending.effectiveTurn) return;
  const level = d.pending.level;
  d.pending = null;
  if (level === d.restriction) return;
  d.restriction = level;
  events.push({
    text:
      level === 'restricted'
        ? 'Congressional restriction in effect: US strikes inside Iranian territory are forbidden.'
        : level === 'suspended'
          ? 'Congressional restriction in effect: all US offensive strikes are suspended.'
          : 'Congressional restriction lifted: US offensive operations resume.',
    tone: level === 'none' ? 'good' : 'bad',
    faction: 'usa',
  });
}
