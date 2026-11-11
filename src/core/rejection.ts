/**
 * Stable order-rejection codes.
 *
 * The simulation still returns a human-readable English `reason` (tests and
 * logs rely on it), but every refusal also carries a stable `code` and any
 * values needed to render it. The UI translates `reason.<code>`, so copy can
 * change without breaking callers and Persian never falls back to English.
 */

export const ORDER_REJECTION_CODES = [
  'campaign-over',
  'not-your-unit',
  'select-unit',
  'wrong-faction',
  'wrong-unit-category',
  'target-ineligible',
  'too-far',
  'off-map',
  'naval-at-sea',
  'ground-water',
  'unit-tasked',
  'no-munitions',
  'no-launchers',
  'select-mine-group',
  'mines-in-water',
  'lay-out-of-range',
  'not-enough-mines',
  'select-naval',
  'clearance-at-sea',
  'no-minefield',
  'minefield-unlocated',
  'escort-limit',
  'iran-production-only',
  'unknown-production',
  'not-enough-resources',
  'no-production-line',
  'usa-diplomacy-only',
  'not-enough-will',
  'not-a-host',
  'base-closed',
  'usa-reinforce-only',
  'unknown-package',
  'needs-will',
  'package-in-transit',
  'no-tankers',
  'no-airlift',
  'usa-communicate-only',
  'address-cooldown',
  'coalition-roe-only',
  'unknown-posture',
  'same-posture',
  'select-specops',
  'not-specops',
  'no-facility',
  'target-out-of-reach',
  'facility-destroyed',
  'select-cyber',
  'cyber-rearming',
  'cyber-tasked',
  'unknown-order',
  'no-munitions-remaining',
  'rearming',
  'cannot-strike',
  'out-of-range',
  'host-closed',
  'host-restricted',
  'no-target',
  'not-hostile',
  'congress-suspended',
  'congress-restricted',
  'roe-urban',
  'no-fly-zone',
  'city-strike-will',
  'initiative-no-track',
  'initiative-usa-only',
  'initiative-same',
  'initiative-cooldown',
  'talks-no-track',
  'talks-iran-only',
  'talks-no-offer',
  'talks-nothing',
  'iran-aid-only',
  'aid-already-queued',
  'not-enough-favors',
] as const;

export type OrderRejectCode = (typeof ORDER_REJECTION_CODES)[number];

export type RejectParams = Record<string, string | number>;

export interface Rejection {
  ok: false;
  code: OrderRejectCode;
  reason: string;
  params?: RejectParams;
}

export function reject(code: OrderRejectCode, reason: string, params?: RejectParams): Rejection {
  return params ? { ok: false, code, reason, params } : { ok: false, code, reason };
}
