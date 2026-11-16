/**
 * Asymmetric Campaign prototype.
 *
 * This module is deliberately self-contained: it owns the six political meters,
 * the guerrilla action set, the stronger side's reaction and the mode's
 * win/loss test. The classic campaigns never read this state, and the engine
 * only calls into it when `snap.mode === 'asymmetric'`.
 */
import type {
  AsymmetricActionId,
  AsymmetricMeters,
  AsymmetricState,
  GameSnapshot,
  ResolveEvent,
} from '../core/types';
import type { OrderRejectCode } from '../core/rejection';
import type { StringKey } from '../i18n';
import { clamp } from '../core/world';

export type AsymmetricMeterId = keyof AsymmetricMeters;

export interface AsymmetricMeterDef {
  id: AsymmetricMeterId;
  labelKey: StringKey;
  tipKey: StringKey;
  /** True when a high value is bad for the player. */
  badHigh: boolean;
}

export const ASYMMETRIC_METER_DEFS: AsymmetricMeterDef[] = [
  { id: 'stability', labelKey: 'asym.meter.stability', tipKey: 'asym.tip.stability', badHigh: false },
  { id: 'support', labelKey: 'asym.meter.support', tipKey: 'asym.tip.support', badHigh: false },
  { id: 'legitimacy', labelKey: 'asym.meter.legitimacy', tipKey: 'asym.tip.legitimacy', badHigh: false },
  { id: 'enemyCost', labelKey: 'asym.meter.enemyCost', tipKey: 'asym.tip.enemyCost', badHigh: false },
  { id: 'attribution', labelKey: 'asym.meter.attribution', tipKey: 'asym.tip.attribution', badHigh: true },
  { id: 'escalation', labelKey: 'asym.meter.escalation', tipKey: 'asym.tip.escalation', badHigh: true },
];

export interface AsymmetricActionDef {
  id: AsymmetricActionId;
  name: string;
  labelKey: StringKey;
  descKey: StringKey;
  /** War resources spent from the existing Iranian stock. */
  cost: number;
  /** Mine stock spent, for the mine action. */
  mines?: number;
  /** Some operations are locked once the crisis is already at the brink. */
  maxEscalation?: number;
  effects: Partial<AsymmetricMeters>;
  /** Existing strategic meters the action also moves. */
  hormuz?: number;
  oilPrice?: number;
}

export const ASYMMETRIC_ACTIONS: AsymmetricActionDef[] = [
  {
    id: 'proxy',
    name: 'Proxy attack',
    labelKey: 'asym.action.proxy',
    descKey: 'asym.actionTip.proxy',
    cost: 2,
    effects: { enemyCost: 10, attribution: 3, escalation: 3, legitimacy: -1, support: -1 },
  },
  {
    id: 'strike',
    name: 'Direct missile and drone strike',
    labelKey: 'asym.action.strike',
    descKey: 'asym.actionTip.strike',
    cost: 5,
    effects: { enemyCost: 16, attribution: 13, escalation: 9, legitimacy: -4, support: -2, stability: -1 },
  },
  {
    id: 'mine',
    name: 'Mine a shipping lane',
    labelKey: 'asym.action.mine',
    descKey: 'asym.actionTip.mine',
    cost: 4,
    mines: 1,
    effects: { enemyCost: 12, attribution: 8, escalation: 6, legitimacy: -3 },
    hormuz: 10,
    oilPrice: 4,
  },
  {
    id: 'shipping',
    name: 'Harass commercial shipping',
    labelKey: 'asym.action.shipping',
    descKey: 'asym.actionTip.shipping',
    cost: 4,
    effects: { enemyCost: 14, attribution: 11, escalation: 8, legitimacy: -6, support: -1 },
    hormuz: 12,
    oilPrice: 6,
  },
  {
    id: 'propaganda',
    name: 'Information operation',
    labelKey: 'asym.action.propaganda',
    descKey: 'asym.actionTip.propaganda',
    cost: 2,
    effects: { support: 8, legitimacy: 6, enemyCost: 3, attribution: -2, escalation: 1 },
  },
  {
    id: 'deny',
    name: 'Deny responsibility',
    labelKey: 'asym.action.deny',
    descKey: 'asym.actionTip.deny',
    cost: 1,
    effects: { attribution: -16, escalation: -4, legitimacy: -1, support: -1, enemyCost: -1 },
  },
  {
    id: 'conventional',
    name: 'Limited conventional operation',
    labelKey: 'asym.action.conventional',
    descKey: 'asym.actionTip.conventional',
    cost: 12,
    maxEscalation: 80,
    effects: { enemyCost: 25, attribution: 22, escalation: 18, legitimacy: -8, support: -4, stability: -5 },
  },
  {
    id: 'consolidate',
    name: 'Consolidate and recover',
    labelKey: 'asym.action.consolidate',
    descKey: 'asym.actionTip.consolidate',
    cost: 3,
    effects: { stability: 9, support: 6, attribution: -3, escalation: -4, legitimacy: 1, enemyCost: -4 },
  },
];

export const ASYMMETRIC_START: AsymmetricMeters = {
  stability: 68,
  support: 56,
  legitimacy: 52,
  enemyCost: 20,
  attribution: 10,
  escalation: 15,
};

export const ASYMMETRIC_WIN = {
  enemyCost: 75,
  stability: 45,
  support: 45,
  legitimacy: 45,
  attribution: 50,
} as const;

export const ASYMMETRIC_SURVIVAL_STABILITY = 35;
export const ASYMMETRIC_CATASTROPHE = 85;

export function createAsymmetricState(): AsymmetricState {
  return { meters: { ...ASYMMETRIC_START }, exposedTurns: 0 };
}

export function asymmetricAction(id: AsymmetricActionId): AsymmetricActionDef | undefined {
  return ASYMMETRIC_ACTIONS.find((action) => action.id === id);
}

export interface AsymmetricBlock {
  code: OrderRejectCode;
  reason: string;
}

/** Mode-local action checks; the engine separately enforces one action/turn. */
export function validateAsymmetricAction(
  snap: GameSnapshot,
  action: AsymmetricActionId,
): AsymmetricBlock | null {
  if (!snap.asymmetric) {
    return { code: 'asym-mode-only', reason: 'That action belongs to the Asymmetric Campaign' };
  }
  const def = asymmetricAction(action);
  if (!def) return { code: 'unknown-order', reason: 'Unknown guerrilla action' };
  if (snap.iran.resources < def.cost) {
    return { code: 'not-enough-resources', reason: `Needs ${def.cost} war resources` };
  }
  if (def.mines && snap.iran.mines < def.mines) {
    return { code: 'not-enough-mines', reason: 'Not enough mines in the stockpile' };
  }
  if (def.maxEscalation !== undefined && snap.asymmetric.meters.escalation > def.maxEscalation) {
    return {
      code: 'asym-too-hot',
      reason: `Escalation is too high for a conventional operation (${Math.round(snap.asymmetric.meters.escalation)}/100)`,
    };
  }
  return null;
}

function shift(meters: AsymmetricMeters, key: AsymmetricMeterId, delta: number): void {
  meters[key] = clamp(meters[key] + delta, 0, 100);
}

function effectText(def: AsymmetricActionDef): string {
  const labels: Record<AsymmetricMeterId, string> = {
    stability: 'stability',
    support: 'support',
    legitimacy: 'legitimacy',
    enemyCost: 'enemy cost',
    attribution: 'attribution',
    escalation: 'escalation',
  };
  const parts = Object.entries(def.effects).map(([key, value]) => {
    const delta = Math.round(value as number);
    return `${delta > 0 ? '+' : ''}${delta} ${labels[key as AsymmetricMeterId]}`;
  });
  if (def.hormuz) parts.push(`+${def.hormuz} Hormuz disruption`);
  if (def.oilPrice) parts.push(`+${def.oilPrice} oil price`);
  return parts.join(', ');
}

/** Queue-time effects are applied during resolution, one action per turn. */
export function applyAsymmetricAction(
  snap: GameSnapshot,
  action: AsymmetricActionId,
  events: ResolveEvent[],
): void {
  const state = snap.asymmetric;
  const def = asymmetricAction(action);
  if (!state || !def) return;

  snap.iran.resources = Math.max(0, snap.iran.resources - def.cost);
  if (def.mines) snap.iran.mines = Math.max(0, snap.iran.mines - def.mines);
  for (const [key, value] of Object.entries(def.effects)) {
    shift(state.meters, key as AsymmetricMeterId, value as number);
  }
  if (def.hormuz) snap.meters.hormuz = clamp(snap.meters.hormuz + def.hormuz, 0, 100);
  if (def.oilPrice) snap.meters.oilPrice = clamp(snap.meters.oilPrice + def.oilPrice, 0, 300);

  state.lastAction = action;
  if (
    state.meters.attribution >= ASYMMETRIC_CATASTROPHE &&
    state.meters.escalation >= ASYMMETRIC_CATASTROPHE
  ) {
    state.catastrophic = true;
  }

  events.push({
    text: `Guerrilla action — ${def.name}: ${effectText(def)}.`,
    tone: 'info',
    faction: 'iran',
  });
}

/**
 * End-of-turn political weather: the enemy adapts, exposure cools, domestic
 * patience wears, and the stronger side answers according to the three things
 * it can see — cost imposed, attribution, and escalation.
 */
export function advanceAsymmetricTurn(snap: GameSnapshot, events: ResolveEvent[]): void {
  const state = snap.asymmetric;
  if (!state) return;
  const m = state.meters;

  if (m.attribution >= ASYMMETRIC_CATASTROPHE && m.escalation >= ASYMMETRIC_CATASTROPHE) {
    state.catastrophic = true;
    events.push({
      text: 'Attribution and escalation both passed the catastrophe line: the coalition has no political reason left to strike a narrow target.',
      tone: 'warn',
      faction: 'iran',
    });
    return;
  }

  // The enemy learns and the news cycle moves on; operations must keep pace.
  shift(m, 'enemyCost', -2);
  shift(m, 'attribution', -2);
  shift(m, 'escalation', -1);
  shift(m, 'legitimacy', -1);

  if (m.support >= 55) shift(m, 'stability', 1);
  else if (m.support < 30) shift(m, 'stability', -3);
  if (m.legitimacy < 30) shift(m, 'support', -2);
  if (snap.turn >= 12) shift(m, 'stability', -1);

  if (m.enemyCost >= 50) {
    shift(m, 'stability', -3);
    shift(m, 'support', -2);
    shift(m, 'legitimacy', -2);
    events.push({
      text: 'The cost is biting: sanctions tighten and the coalition paints Iran as the spoiler. Stability -3, support -2, legitimacy -2.',
      tone: 'warn',
      faction: 'iran',
    });
  }

  if (m.attribution >= 45) {
    shift(m, 'stability', -7);
    shift(m, 'support', -3);
    shift(m, 'escalation', 4);
    state.exposedTurns += 1;
    events.push({
      text: 'Attribution is high: limited strikes hit command and air-defence nodes. Stability -7, support -3, escalation +4.',
      tone: 'warn',
      faction: 'iran',
    });
  }

  if (m.escalation >= 60) {
    shift(m, 'stability', -4);
    shift(m, 'support', -2);
    events.push({
      text: 'Escalation is high: the coalition moves to heavier military pressure. Stability -4, support -2.',
      tone: 'warn',
      faction: 'iran',
    });
  }

  if (m.legitimacy < 25) {
    shift(m, 'support', -3);
    shift(m, 'stability', -2);
    events.push({
      text: 'International isolation: few governments will defend Tehran publicly. Support -3, stability -2.',
      tone: 'warn',
      faction: 'iran',
    });
  }

  if (m.attribution >= 75 && m.escalation >= 75) {
    shift(m, 'stability', -18);
    shift(m, 'support', -8);
    shift(m, 'legitimacy', -5);
    shift(m, 'escalation', 5);
    events.push({
      text: 'Severe retaliation: the coalition abandons limited strikes and hits the political leadership and the war economy directly. Stability -18, support -8, legitimacy -5.',
      tone: 'warn',
      faction: 'iran',
    });
  }
}

export interface AsymmetricOutcome {
  status: 'playing' | 'won' | 'lost';
  outcome: string;
}

/** Political victory is evaluated after the enemy reaction, never before it. */
export function asymmetricOutcome(snap: GameSnapshot): AsymmetricOutcome {
  const state = snap.asymmetric;
  if (!state) return { status: 'playing', outcome: '' };
  const m = state.meters;

  if (state.catastrophic || m.stability <= 0) {
    return {
      status: 'lost',
      outcome: state.catastrophic
        ? 'Catastrophic retaliation: attribution and escalation left the coalition no limited option. The regime falls under a general campaign.'
        : 'Regime stability reached zero. The government loses control of the streets and the security services, and the campaign ends.',
    };
  }

  if (
    m.enemyCost >= ASYMMETRIC_WIN.enemyCost &&
    m.stability >= ASYMMETRIC_WIN.stability &&
    m.support >= ASYMMETRIC_WIN.support &&
    m.legitimacy >= ASYMMETRIC_WIN.legitimacy &&
    m.attribution <= ASYMMETRIC_WIN.attribution
  ) {
    return {
      status: 'won',
      outcome:
        'Political victory: the cost imposed on the stronger side, a functioning regime and acceptable international standing force a settlement on Iranian terms. No conventional victory was needed.',
    };
  }

  if (snap.turn >= snap.maxTurns) {
    if (m.stability >= ASYMMETRIC_SURVIVAL_STABILITY) {
      return {
        status: 'won',
        outcome:
          'Survival victory: the regime outlasted the campaign with its institutions intact. The stronger side did not achieve a decisive political result.',
      };
    }
    return {
      status: 'lost',
      outcome:
        'The campaign ran out of time with the regime below the survival threshold. The government survives in name only and accepts the coalition’s terms.',
    };
  }

  return { status: 'playing', outcome: '' };
}
