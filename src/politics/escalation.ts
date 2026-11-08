/**
 * Escalation ladder & red lines.
 *
 * The `nuclearEscalation` meter (0-100) has existed since the baseline, but
 * before this module nothing in the live pipeline translated it into a
 * readable ladder, and `updateSuperpowers` — the great-power response loop —
 * was never actually called by the turn engine. This module fixes both:
 *
 * - A **ladder** of data-defined rungs: the current level is the highest rung
 *   whose `threshold` the escalation meter has reached. Every rung adds a
 *   per-turn great-power stance drift and host-nation threat pressure, so a
 *   high ladder makes the whole region drift toward confrontation.
 * - **Red lines**: named, one-shot tripwires (a nuclear release, leadership
 *   decapitation, a destroyed nuclear complex, a strangled strait). Crossing
 *   one applies a discrete package of consequences exactly once and logs it
 *   loudly. `fired` ids make the trigger idempotent.
 *
 * Everything here is plain snapshot arithmetic — no RNG is consumed — so the
 * determinism guarantee (identical seeds → byte-identical snapshots) holds.
 * Thresholds live in scenario data (`campaign.escalation` →
 * `snap.escalationCfg`), never in code.
 */
import type {
  EscalationConfig,
  EscalationState,
  GameSnapshot,
  ResolveEvent,
  SuperpowerState,
} from '../core/types';
import { clamp, nodeState } from '../core/world';

const NUCLEAR_SITES = ['isfahan', 'natanz', 'fordow'];

/** Fallback for saves/scenarios written before the ladder existed. */
export const DEFAULT_ESCALATION_CFG: EscalationConfig = {
  levels: [
    { threshold: 15, drift: 0.5, hostThreat: 0 },
    { threshold: 30, drift: 1, hostThreat: 1 },
    { threshold: 50, drift: 1.5, hostThreat: 1 },
    { threshold: 70, drift: 2, hostThreat: 2 },
    { threshold: 85, drift: 3, hostThreat: 2 },
  ],
  redLines: [
    {
      id: 'nuclearUse',
      label: 'Nuclear weapons used',
      label_fa: 'استفاده از سلاح هسته‌ای',
      nuclearUse: true,
      escalationJump: 15,
      superpowerJump: 30,
      willDrop: 10,
      iranMobilization: 0,
    },
    {
      id: 'leadershipDecapitation',
      label: 'Leadership decapitation attempted',
      label_fa: 'تلاش برای از بین بردن رهبری',
      leadershipStrikes: 3,
      escalationJump: 10,
      superpowerJump: 12,
      willDrop: 0,
      iranMobilization: 25,
    },
    {
      id: 'nuclearComplexDestroyed',
      label: 'Iranian nuclear complex destroyed',
      label_fa: 'نابودی مجتمع هسته‌ای ایران',
      nuclearSitesDown: true,
      escalationJump: 8,
      superpowerJump: 10,
      willDrop: 0,
      iranMobilization: 40,
    },
    {
      id: 'hormuzStrangled',
      label: 'Hormuz strangled for four turns',
      label_fa: 'چهار نوبت اختلال شدید در هرمز',
      hormuzTurnsAbove70: 4,
      escalationJump: 8,
      superpowerJump: 8,
      willDrop: 5,
      iranMobilization: 0,
    },
  ],
};

export function escalationCfg(snap: GameSnapshot): EscalationConfig {
  return snap.escalationCfg ?? DEFAULT_ESCALATION_CFG;
}

export function defaultEscalationState(): EscalationState {
  return { level: 0, fired: [] };
}

/**
 * The rung reached by the current escalation meter: 0 = below the first
 * threshold, N = highest N whose threshold is met.
 */
export function escalationLevel(snap: GameSnapshot, cfg: EscalationConfig = escalationCfg(snap)): number {
  let level = 0;
  for (let i = 0; i < cfg.levels.length; i++) {
    if (snap.meters.nuclearEscalation >= cfg.levels[i]!.threshold) level = i + 1;
  }
  return level;
}

/** True when every Iranian nuclear facility has been pushed to zero integrity. */
export function nuclearComplexDown(snap: GameSnapshot): boolean {
  return NUCLEAR_SITES.map((id) => nodeState(snap, id).integrity).every((v) => v <= 0);
}

/** Does this red line's condition hold right now? Pure snapshot read. */
export function redLineTripped(snap: GameSnapshot, def: EscalationConfig['redLines'][number]): boolean {
  if (def.nuclearUse && snap.meters.nuclearStrikes > 0) return true;
  if (def.leadershipStrikes !== undefined && snap.meters.leadershipStrikes >= def.leadershipStrikes) return true;
  if (def.nuclearSitesDown && nuclearComplexDown(snap)) return true;
  if (def.hormuzTurnsAbove70 !== undefined && snap.meters.hormuzTurnsAbove70 >= def.hormuzTurnsAbove70) return true;
  return false;
}

interface RedLineEffectsText {
  parts: string[];
}

function redLineEffectsText(def: EscalationConfig['redLines'][number]): RedLineEffectsText {
  const parts: string[] = [];
  if (def.escalationJump > 0) parts.push(`escalation +${def.escalationJump}`);
  if (def.superpowerJump > 0) parts.push(`great-power hostility +${def.superpowerJump}`);
  if (def.willDrop > 0) parts.push(`US political will −${def.willDrop}`);
  if (def.iranMobilization > 0) parts.push(`Iran mobilises +${def.iranMobilization} resources`);
  return { parts };
}

/** Apply a red line's consequences exactly once and explain every number. */
function fireRedLine(snap: GameSnapshot, def: EscalationConfig['redLines'][number], events: ResolveEvent[]): void {
  const effects = redLineEffectsText(def);
  if (def.escalationJump > 0) {
    snap.meters.nuclearEscalation = clamp(snap.meters.nuclearEscalation + def.escalationJump, 0, 100);
  }
  if (def.superpowerJump > 0) {
    for (const sp of [snap.superpowers?.russia, snap.superpowers?.china] as Array<SuperpowerState | undefined>) {
      if (sp) sp.stance = clamp(sp.stance + def.superpowerJump, 0, 100);
    }
  }
  if (def.willDrop > 0) {
    snap.resources.politicalWill = clamp(snap.resources.politicalWill - def.willDrop, 0, 100);
  }
  if (def.iranMobilization > 0) {
    snap.iran.resources += def.iranMobilization;
  }
  events.push({
    text: `RED LINE CROSSED — ${def.label}: ${effects.parts.join(', ')}.`,
    tone: 'bad',
  });
}

/**
 * The escalation phase, once per resolved turn. Recomputes the ladder level,
 * applies its per-turn pressure, then checks unfired red lines. Deterministic:
 * same snapshot in, same snapshot out, no RNG.
 */
export function updateEscalation(snap: GameSnapshot, events: ResolveEvent[]): void {
  if (!snap.escalation) return;
  const cfg = escalationCfg(snap);
  const state = snap.escalation;

  // --- ladder level ---------------------------------------------------------
  const level = escalationLevel(snap, cfg);
  if (level !== state.level) {
    const rising = level > state.level;
    events.push({
      text: rising
        ? `Escalation ladder rung ${level} of ${cfg.levels.length} (escalation ${Math.round(snap.meters.nuclearEscalation)}).`
        : `Escalation ladder eased to rung ${level} (escalation ${Math.round(snap.meters.nuclearEscalation)}).`,
      tone: rising ? 'warn' : 'info',
    });
    state.level = level;
  }
  const rung = level > 0 ? cfg.levels[level - 1] : undefined;
  if (rung) {
    // Per-turn pressure: great powers and host nations drift with the ladder.
    for (const sp of [snap.superpowers?.russia, snap.superpowers?.china] as Array<SuperpowerState | undefined>) {
      if (sp) sp.stance = clamp(sp.stance + rung.drift, 0, 100);
    }
    for (const host of Object.values(snap.hosts)) {
      if (host && rung.hostThreat > 0) host.threat = clamp(host.threat + rung.hostThreat, 0, 100);
    }
  }

  // --- red lines: checked in data order, fired once each --------------------
  for (const def of cfg.redLines) {
    if (state.fired.includes(def.id)) continue;
    if (redLineTripped(snap, def)) {
      state.fired.push(def.id);
      fireRedLine(snap, def, events);
    }
  }
}
