/**
 * Improvement 6: rules-of-engagement (ROE) posture presets.
 *
 * The coalition player picks a national posture — `constrained`, `standard`
 * or `aggressive` — as a turn order. The posture is policy, not a tactical
 * order: it colours every coalition strike from whatever faction sits at the
 * screen (US *and* Israeli formations, player and AI alike).
 *
 * - `constrained`: stricter targeting (strikes on Iranian cities forbidden),
 *   softer escalation signature, slightly blunter weapons, +1 congressional
 *   support a turn while it holds.
 * - `aggressive`: +15% strike damage and a heavier escalation signature
 *   (×1.5), −1 congressional support a turn, host-nation threat +1 a turn —
 *   partners notice when you loosen the rules.
 *
 * All numbers are scenario data (`campaign.roe` → `snap.roeCfg`). Nothing
 * here consumes the RNG, so replays stay byte-identical.
 */
import type { GameSnapshot, MapNodeDef, ResolveEvent, RoeConfig, RoePosture, RoeState } from '../core/types';
import { clamp } from '../core/world';

export const DEFAULT_ROE_CFG: RoeConfig = {
  constrained: { damageMultiplier: 0.9, escalationMultiplier: 0.5, urbanBlocked: true, congressPerTurn: 1, hostThreatPerTurn: 0 },
  standard: { damageMultiplier: 1, escalationMultiplier: 1, urbanBlocked: false, congressPerTurn: 0, hostThreatPerTurn: 0 },
  aggressive: { damageMultiplier: 1.15, escalationMultiplier: 1.5, urbanBlocked: false, congressPerTurn: -1, hostThreatPerTurn: 1 },
};

export const ROE_POSTURES: readonly RoePosture[] = ['constrained', 'standard', 'aggressive'];

export function roeCfg(snap: GameSnapshot): RoeConfig {
  return snap.roeCfg ?? DEFAULT_ROE_CFG;
}

export function defaultRoeState(): RoeState {
  return { posture: 'standard' };
}

/** The active posture's effects; `standard` for snapshots without the block. */
export function activeRoe(snap: GameSnapshot): RoeConfig[RoePosture] {
  return roeCfg(snap)[snap.roe?.posture ?? 'standard'];
}

export const COALITION_FACTIONS = new Set(['usa', 'israel']);

/** Multiplier applied to coalition strike damage under the active posture. */
export function roeDamageMultiplier(snap: GameSnapshot, attacker: string): number {
  if (!snap.roe || !COALITION_FACTIONS.has(attacker)) return 1;
  return activeRoe(snap).damageMultiplier;
}

/** Multiplier applied to the escalation a coalition strike on Iran generates. */
export function roeEscalationMultiplier(snap: GameSnapshot, attacker: string): number {
  if (!snap.roe || !COALITION_FACTIONS.has(attacker)) return 1;
  return activeRoe(snap).escalationMultiplier;
}

/**
 * Targeting gate for the `constrained` posture. Returns the refusal reason
 * when the posture forbids the mission, `null` otherwise. Applies to
 * coalition formations only; Iranian targeting is not the player's to set.
 */
export function roeBlocksStrike(snap: GameSnapshot, unitFaction: string, node?: MapNodeDef): string | null {
  if (!snap.roe || !COALITION_FACTIONS.has(unitFaction)) return null;
  if (!activeRoe(snap).urbanBlocked) return null;
  if (node && node.host === 'iran' && node.kind === 'urban') {
    return 'Rules of engagement forbid strikes on Iranian population centres';
  }
  return null;
}

/** Human-readable effects summary, for the posture-change log line. */
export function roeEffectsText(cfg: RoeConfig[RoePosture]): string {
  const parts: string[] = [];
  const dmg = Math.round((cfg.damageMultiplier - 1) * 100);
  if (dmg !== 0) parts.push(`strike damage ${dmg > 0 ? '+' : '−'}${Math.abs(dmg)}%`);
  parts.push(`escalation risk ×${cfg.escalationMultiplier}`);
  if (cfg.urbanBlocked) parts.push('strikes on Iranian cities forbidden');
  if (cfg.congressPerTurn !== 0) {
    parts.push(`congressional support ${cfg.congressPerTurn > 0 ? '+' : '−'}${Math.abs(cfg.congressPerTurn)}/turn`);
  }
  if (cfg.hostThreatPerTurn !== 0) parts.push(`host-nation threat +${cfg.hostThreatPerTurn}/turn`);
  return parts.join(', ');
}

/**
 * Per-turn ROE drift, once per resolved turn in the attrition phase. The
 * posture-change order logs the full effects package; this only moves the
 * two slow dials (congress, host threat). Deterministic.
 */
export function updateRoe(snap: GameSnapshot, events: ResolveEvent[]): void {
  if (!snap.roe) return;
  const effects = activeRoe(snap);
  if (effects.congressPerTurn !== 0 && snap.domestic) {
    snap.domestic.congress = clamp(snap.domestic.congress + effects.congressPerTurn, 0, 100);
  }
  if (effects.hostThreatPerTurn !== 0) {
    for (const host of Object.values(snap.hosts)) {
      if (host) host.threat = clamp(host.threat + effects.hostThreatPerTurn, 0, 100);
    }
  }
  void events;
}
