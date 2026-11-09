/**
 * Iranian arsenal bookkeeping (Phase 1b).
 *
 * The request splits the old flat counters into four domains that must never be
 * conflated:
 *
 * 1. **rounds** — an airframe with a conventional warhead mated, ready to fire;
 * 2. **airframes / warheads** — the two halves production actually builds, kept
 *    apart until they are mated;
 * 3. **launchers** — the delivery platforms, a per-turn sortie budget shared by
 *    the player and the AI so neither can fire more than the force can launch;
 * 4. **nuclearMaterial** — warhead-grade material, tracked on its own and never
 *    counted as, or converted into, a conventional round.
 *
 * Every number exposed to the player is an estimate: `arsenalRows` attaches a
 * confidence label and a percentage band rather than pretending to certainty.
 */
import type { DeliveryClass, GameSnapshot, IranStock, ProductionLine } from './types';

export const DELIVERY_CLASSES: DeliveryClass[] = ['drone', 'fateh', 'khorramshahr', 'fattah', 'asm'];

export interface DeliveryClassInfo {
  label: string;
  labelFa: string;
  line: ProductionLine;
  launcherPool: 'drone' | 'ballistic';
  /** mdf.md §18 weapon class this stock belongs to. */
  taxonomy: string;
  /** True where the public capability claim is contested (mdf.md §18, Fattah). */
  contested?: boolean;
}

export const DELIVERY_CLASS_INFO: Record<DeliveryClass, DeliveryClassInfo> = {
  drone: { label: 'Shahed-136', labelFa: 'شاهد-۱۳۶', line: 'drone', launcherPool: 'drone', taxonomy: 'one-way attack drone' },
  fateh: { label: 'Fateh-110', labelFa: 'فاتح-۱۱۰', line: 'missile', launcherPool: 'ballistic', taxonomy: 'short-range ballistic missile' },
  khorramshahr: { label: 'Khorramshahr', labelFa: 'خرّمشهر', line: 'missile', launcherPool: 'ballistic', taxonomy: 'medium-range ballistic missile' },
  fattah: { label: 'Fattah', labelFa: 'فتاح', line: 'missile', launcherPool: 'ballistic', taxonomy: 'long-range ballistic missile', contested: true },
  asm: { label: 'Anti-ship rounds', labelFa: 'موشک ضدکشتی', line: 'missile', launcherPool: 'ballistic', taxonomy: 'anti-ship missile' },
};

/** Which delivery class a producible unit type belongs to; null for mines etc. */
export function deliveryClassFor(unitTypeId: string): DeliveryClass | null {
  switch (unitTypeId) {
    case 'shahed136':
      return 'drone';
    case 'fateh110':
      return 'fateh';
    case 'khorramshahr':
      return 'khorramshahr';
    case 'fattah':
      return 'fattah';
    case 'asm_launcher':
      return 'asm';
    default:
      return null;
  }
}

/** Launcher sorties left this turn for the pool a delivery class draws on. */
export function launcherSortiesLeft(iran: IranStock, pool: 'drone' | 'ballistic'): number {
  return pool === 'drone'
    ? Math.max(0, iran.launchers.drone - iran.launchers.usedDrone)
    : Math.max(0, iran.launchers.ballistic - iran.launchers.usedBallistic);
}

/** Reset the shared launcher budget at the start of a new turn. */
export function resetLauncherSorties(snap: GameSnapshot): void {
  snap.iran.launchers.usedDrone = 0;
  snap.iran.launchers.usedBallistic = 0;
}

/**
 * Spend mated rounds, bounded by both the stockpile and the remaining launcher
 * sorties. Returns the number actually fired, so callers can log the real salvo
 * instead of the requested one.
 */
export function spendIranRounds(snap: GameSnapshot, cls: DeliveryClass, count: number): number {
  const iran = snap.iran;
  const pool = DELIVERY_CLASS_INFO[cls].launcherPool;
  const fired = Math.max(0, Math.min(count, iran.rounds[cls], launcherSortiesLeft(iran, pool)));
  if (fired <= 0) return 0;
  iran.rounds[cls] -= fired;
  if (pool === 'drone') iran.launchers.usedDrone += fired;
  else iran.launchers.usedBallistic += fired;
  return fired;
}

/** Mate up to `want` rounds from the airframe and warhead stores. */
export function mateRounds(snap: GameSnapshot, cls: DeliveryClass, want: number): number {
  const iran = snap.iran;
  const line = DELIVERY_CLASS_INFO[cls].line;
  const mated = Math.max(0, Math.min(want, iran.airframes[line], iran.warheads.conventional));
  if (mated <= 0) return 0;
  iran.airframes[line] -= mated;
  iran.warheads.conventional -= mated;
  return mated;
}

/**
 * Deliver newly built stock the way production and underground regeneration do:
 * airframes and warheads are added separately, then mated into rounds. The
 * nuclear store is untouched.
 */
export function deliverMatedRounds(snap: GameSnapshot, cls: DeliveryClass, amount: number): number {
  if (amount <= 0) return 0;
  const iran = snap.iran;
  const line = DELIVERY_CLASS_INFO[cls].line;
  iran.airframes[line] += amount;
  iran.warheads.conventional += amount;
  const mated = mateRounds(snap, cls, amount);
  iran.rounds[cls] += mated;
  return mated;
}

export function totalRounds(iran: IranStock): number {
  return DELIVERY_CLASSES.reduce((sum, cls) => sum + iran.rounds[cls], 0);
}

export type EstimateConfidence = 'confirmed' | 'assessed' | 'estimated';

export interface ArsenalRow {
  class: DeliveryClass;
  label: string;
  labelFa: string;
  /** Central estimate of mated rounds. */
  rounds: number;
  confidence: EstimateConfidence;
  uncertaintyPct: number;
  low: number;
  high: number;
}

/** Uncertainty bands, in percent, for the open-source estimate of each class. */
export const ARSENAL_UNCERTAINTY_PCT: Record<DeliveryClass, number> = {
  drone: 20,
  fateh: 25,
  khorramshahr: 33,
  fattah: 40,
  asm: 30,
};

/** Labelled arsenal estimates; the UI must show the band, not a bare number. */
export function arsenalRows(iran: IranStock): ArsenalRow[] {
  return DELIVERY_CLASSES.map((cls) => {
    const info = DELIVERY_CLASS_INFO[cls];
    const rounds = iran.rounds[cls];
    const uncertaintyPct = ARSENAL_UNCERTAINTY_PCT[cls];
    const spread = Math.round((rounds * uncertaintyPct) / 100);
    return {
      class: cls,
      label: info.label,
      labelFa: info.labelFa,
      rounds,
      confidence: 'assessed',
      uncertaintyPct,
      low: Math.max(0, rounds - spread),
      high: rounds + spread,
    };
  });
}
