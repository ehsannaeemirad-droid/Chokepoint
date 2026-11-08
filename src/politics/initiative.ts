/**
 * Phase 3: the Israeli AI initiative track.
 *
 * Israel is an AI ally with a mind of its own. Its willingness to press
 * operations (`level`, 0-100) drifts toward a target computed from
 *   - Iranian launch capability (surviving launcher formations plus the
 *     national munition stockpile), and
 *   - US legitimacy (`meters.legitimacy`): a legitimate coalition gives
 *     Jerusalem a freer hand.
 *
 * The US player (only the US player) sets a stance toward it:
 *   - `approved`    — Washington publicly backs expanded Israeli operations
 *                     (+level, and the AI flies up to two strike packages a
 *                     turn once the level crosses `aggressiveThreshold`);
 *   - `constrained` — Washington pulls Jerusalem back (-level, and the AI
 *                     flies no offensive strikes while the stance holds);
 *   - `accepted`    — the default: the track drifts on its own.
 *
 * Stance orders have a cooldown. Everything here is deterministic arithmetic;
 * no RNG is consumed, so replays stay byte-identical.
 */
import type { GameSnapshot, InitiativeConfig, IsraelInitiative, IsraelStance, ResolveEvent } from '../core/types';
import { clamp } from '../core/world';

export const DEFAULT_INITIATIVE_CFG: InitiativeConfig = {
  aggressiveThreshold: 75,
  driftPerTurn: 4,
  launchWeight: 0.65,
  legitimacyWeight: 0.35,
  launchersWeight: 7,
  stockDivisor: 10,
  approveGain: 8,
  constrainDrop: 12,
  orderCooldown: 4,
};

export const INITIATIVE_START_LEVEL = 60;

export function initiativeCfg(snap: GameSnapshot): InitiativeConfig {
  return snap.initiativeCfg ?? DEFAULT_INITIATIVE_CFG;
}

export function defaultIsraelInitiative(_cfg: InitiativeConfig = DEFAULT_INITIATIVE_CFG): IsraelInitiative {
  return { level: INITIATIVE_START_LEVEL, stance: 'accepted', lastOrderTurn: 0 };
}

/** Iranian launch capability, 0-100: launchers plus the munition stockpile. */
export function iranLaunchPressure(snap: GameSnapshot): number {
  const launcherTypes = ['fateh110', 'khorramshahr', 'fattah', 'asm_launcher'];
  const launchers = snap.units.filter((u) => u.faction === 'iran' && launcherTypes.includes(u.typeId)).length;
  const stock = snap.iran.drones + snap.iran.fateh + snap.iran.khorramshahr + snap.iran.fattah;
  const cfg = initiativeCfg(snap);
  return clamp(Math.round(launchers * cfg.launchersWeight + stock / cfg.stockDivisor), 0, 100);
}

/**
 * Target initiative for this turn: launch capability plus coalition
 * legitimacy, weighted by scenario data. High Iranian pressure and a
 * legitimate coalition both push Jerusalem toward a freer hand.
 */
export function initiativeTarget(snap: GameSnapshot): number {
  const cfg = initiativeCfg(snap);
  const pressure = iranLaunchPressure(snap);
  const legitimacy = snap.meters.legitimacy ?? 60;
  return clamp(Math.round(pressure * cfg.launchWeight + legitimacy * cfg.legitimacyWeight), 0, 100);
}

/**
 * Initiative phase, once per resolved turn after the domestic phase. Drifts
 * the level toward its target and announces tier changes (never silently).
 */
export function updateIsraelInitiative(snap: GameSnapshot, events: ResolveEvent[]): void {
  const track = snap.israelInitiative;
  if (!track) return;
  const cfg = initiativeCfg(snap);
  const target = initiativeTarget(snap);
  const delta = clamp(target - track.level, -cfg.driftPerTurn, cfg.driftPerTurn);
  const wasAggressive = track.level >= cfg.aggressiveThreshold;
  track.level = clamp(track.level + delta, 0, 100);
  const isAggressive = track.level >= cfg.aggressiveThreshold;

  if (snap.faction === 'iran' || snap.faction === 'usa') {
    if (!wasAggressive && isAggressive) {
      events.push({
        text: `Israel presses for a freer hand: initiative ${Math.round(track.level)} — with Washington's assent it would fly expanded strike packages.`,
        tone: 'warn',
        faction: 'israel',
      });
    } else if (wasAggressive && !isAggressive && track.stance !== 'approved') {
      events.push({
        text: `Israeli operations contract to the standard one package per turn (initiative ${Math.round(track.level)}).`,
        tone: 'info',
        faction: 'israel',
      });
    }
  }
}

/**
 * Validation for `{ kind: 'israel-initiative' }`. US-only, cooldown-gated.
 */
export function validateInitiativeOrder(snap: GameSnapshot, stance: IsraelStance): string | null {
  const track = snap.israelInitiative;
  if (!track) return 'No initiative track in this scenario';
  if (snap.faction !== 'usa') return 'Only Washington can set the stance toward Israeli operations';
  if (stance !== 'accepted' && track.stance === stance) return 'That stance is already in force';
  const cfg = initiativeCfg(snap);
  // The cooldown only applies once a directive has actually been sent.
  if (track.lastOrderTurn > 0 && snap.turn - track.lastOrderTurn < cfg.orderCooldown) {
    return `Jerusalem is still reacting to the last directive (${cfg.orderCooldown - (snap.turn - track.lastOrderTurn)} turns)`;
  }
  return null;
}

/** Apply a stance change and announce it. Called from `applyOrder`. */
export function applyInitiativeOrder(snap: GameSnapshot, stance: IsraelStance, events: ResolveEvent[]): void {
  const track = snap.israelInitiative;
  if (!track) return;
  const cfg = initiativeCfg(snap);
  track.stance = stance;
  track.lastOrderTurn = snap.turn;
  if (stance === 'approved') track.level = clamp(track.level + cfg.approveGain, 0, 100);
  if (stance === 'constrained') track.level = clamp(track.level - cfg.constrainDrop, 0, 100);
  const text =
    stance === 'approved'
      ? `Washington approves expanded Israeli operations: initiative ${Math.round(track.level)} — Israel may fly two strike packages a turn above ${cfg.aggressiveThreshold}.`
      : stance === 'constrained'
        ? `Washington constrains Israeli operations: initiative ${Math.round(track.level)} — Israeli aircraft stand down from offensive missions.`
        : 'Washington returns to accepting Israeli initiative as it comes.';
  events.push({ text, tone: stance === 'constrained' ? 'warn' : 'info', faction: 'usa' });
}

/** Strike packages the Israeli AI flies this turn (0 = stand-down). */
export function israelPackages(snap: GameSnapshot): number {
  const track = snap.israelInitiative;
  if (!track) return 1;
  if (track.stance === 'constrained') return 0;
  const cfg = initiativeCfg(snap);
  return track.level >= cfg.aggressiveThreshold ? 2 : 1;
}
