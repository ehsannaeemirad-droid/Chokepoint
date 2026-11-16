import { describe, expect, it } from 'vitest';
import {
  POLICIES,
  POLICY_BY_ID,
  addMonths,
  canQueuePolicy,
  coverageAverage,
  createInitialState,
  decodeState,
  encodeState,
  evaluateOutcome,
  forecast,
  grossReserves,
  objectives,
  policyCost,
  queuePolicy,
  resolveMonth,
  saveKey,
  totalRevenue,
  totalSpending,
} from './model';
import type { EconomicState } from './model';

function fresh(): EconomicState {
  return createInitialState('campaign', 'hormuz', 424242);
}

describe('economic initial state', () => {
  it('starts in the decision phase with an opening snapshot', () => {
    const state = fresh();
    expect(state.phase).toBe('decisions');
    expect(state.status).toBe('playing');
    expect(state.turn).toBe(1);
    expect(state.snapshots).toHaveLength(1);
    expect(state.reserves.usable).toBeGreaterThan(0);
    expect(state.prices.headline).toBeGreaterThan(0);
  });

  it('keeps gross reserves distinct from spendable reserves', () => {
    const state = fresh();
    expect(grossReserves(state)).toBeCloseTo(state.reserves.usable + state.reserves.frozen + state.reserves.gold, 6);
    expect(grossReserves(state)).toBeGreaterThan(state.reserves.usable);
  });

  it('gives every scenario its own starting conditions', () => {
    const hormuz = createInitialState('campaign', 'hormuz');
    const collapse = createInitialState('campaign', 'oil-collapse');
    const currency = createInitialState('campaign', 'currency-crisis');
    expect(collapse.world.globalOilPrice).toBeLessThan(hormuz.world.globalOilPrice);
    expect(currency.currency.fxGap).toBeGreaterThan(hormuz.currency.fxGap);
    expect(currency.prices.headline).toBeGreaterThan(hormuz.prices.headline);
    expect(hormuz.maxMonths).toBe(12);
  });

  it('applies sandbox overrides and leaves the clock open-ended', () => {
    const state = createInitialState('sandbox', 'hormuz', 7, { reserves: 4.2, oilPrice: 140, sanctions: 90, stability: 33 });
    expect(state.mode).toBe('sandbox');
    expect(state.maxMonths).toBe(0);
    expect(state.reserves.usable).toBeCloseTo(4.2, 6);
    expect(state.world.globalOilPrice).toBe(140);
    expect(state.sanctions.financial).toBeGreaterThanOrEqual(80);
    expect(state.society.legitimacy).toBe(33);
  });
});

describe('monthly accounting', () => {
  it('reconciles the budget identity after resolution', () => {
    const state = fresh();
    resolveMonth(state);
    expect(state.fiscal.deficit).toBeCloseTo(totalSpending(state.fiscal) - totalRevenue(state.fiscal), 1);
    expect(state.fiscal.primary).toBeCloseTo(state.fiscal.deficit - state.fiscal.interest, 1);
  });

  it('moves reserves within their accounting bounds', () => {
    const state = fresh();
    for (let index = 0; index < 12 && state.status === 'playing'; index += 1) {
      resolveMonth(state);
      expect(state.reserves.usable).toBeGreaterThanOrEqual(0);
      expect(state.reserves.usable).toBeLessThanOrEqual(100);
      expect(Number.isFinite(state.reserves.usable)).toBe(true);
    }
  });

  it('links oil revenue to saleable exports rather than production alone', () => {
    const withExports = fresh();
    resolveMonth(withExports);
    const blocked = fresh();
    blocked.energy.exports = 0;
    blocked.energy.production = 0.4;
    blocked.world.shippingDisruption = 95;
    blocked.sanctions.shipping = 100;
    resolveMonth(blocked);
    expect(withExports.fiscal.oilRevenue).toBeGreaterThan(blocked.fiscal.oilRevenue);
    expect(blocked.fiscal.oilRevenue).toBeGreaterThanOrEqual(0);
  });

  it('syncs the parallel rate from the gap and the official rate', () => {
    const state = fresh();
    resolveMonth(state);
    expect(state.currency.parallel).toBeCloseTo(state.currency.official * (1 + state.currency.fxGap / 100), 0);
    expect(state.currency.parallel).toBeGreaterThanOrEqual(state.currency.official);
  });

  it('reduces import coverage when financing collapses', () => {
    const state = fresh();
    state.reserves.usable = 0.4;
    const before = coverageAverage(state);
    resolveMonth(state);
    expect(coverageAverage(state)).toBeLessThan(before);
  });

  it('advances the calendar and clears the queue', () => {
    const state = fresh();
    queuePolicy(state, 'public-communication');
    resolveMonth(state);
    expect(state.turn).toBe(2);
    expect(state.date).toBe(addMonths(state.startDate, 1));
    expect(state.policies.queued).toHaveLength(0);
    expect(state.history).toHaveLength(1);
    expect(state.snapshots).toHaveLength(2);
  });
});

describe('policy engine', () => {
  it('limits the monthly agenda and its political capital', () => {
    const state = fresh();
    expect(queuePolicy(state, 'rate-hike').ok).toBe(true);
    expect(queuePolicy(state, 'public-communication').ok).toBe(true);
    const third = queuePolicy(state, 'capital-controls');
    expect(third.ok).toBe(false);
    expect(policyCost(state)).toBe(3);
  });

  it('enforces cooldowns after use', () => {
    const state = fresh();
    queuePolicy(state, 'managed-devaluation');
    resolveMonth(state);
    const again = canQueuePolicy(state, 'managed-devaluation');
    expect(again.ok).toBe(false);
    expect(state.policies.used['managed-devaluation']).toBe(1);
  });

  it('applies delayed effects in a later month', () => {
    const state = fresh();
    queuePolicy(state, 'cut-subsidies');
    const before = state.society.protests;
    resolveMonth(state);
    const afterDecision = state.society.protests;
    const pending = state.policies.pending.length;
    resolveMonth(state);
    expect(afterDecision).toBeGreaterThan(before);
    expect(pending).toBeGreaterThan(0);
    expect(state.society.protests).not.toBe(afterDecision);
  });

  it('runs monthly effects while a policy is active', () => {
    const state = fresh();
    queuePolicy(state, 'targeted-transfers');
    resolveMonth(state);
    expect(state.policies.active.some((active) => active.id === 'targeted-transfers')).toBe(true);
    const spend = state.fiscal.subsidySpend;
    resolveMonth(state);
    expect(state.fiscal.subsidySpend).toBeGreaterThan(spend);
  });

  it('narrows the currency gap relative to the same month without intervention', () => {
    const control = fresh();
    const intervened = fresh();
    queuePolicy(intervened, 'spend-reserves');
    resolveMonth(control);
    resolveMonth(intervened);
    expect(intervened.currency.fxGap).toBeLessThan(control.currency.fxGap);
    expect(intervened.policies.used['spend-reserves']).toBe(1);
    // Intervention buys time; it does not remove the structural pressure.
    expect(intervened.currency.fxGap).toBeGreaterThan(0);
  });

  it('exposes institution support for every policy', () => {
    for (const policy of POLICIES) {
      expect(Object.keys(policy.support).length).toBeGreaterThan(0);
      expect(policy.benefits.length).toBeGreaterThan(0);
      expect(policy.costs.length).toBeGreaterThan(0);
    }
    expect(POLICY_BY_ID['cut-subsidies'].institution).toBe('finance');
  });
});

describe('determinism and persistence', () => {
  it('produces identical histories from identical inputs', () => {
    const play = (state: EconomicState): string => {
      const script = ['rate-hike', 'priority-imports', 'targeted-transfers', 'oil-discount'] as const;
      for (const id of script) {
        if (canQueuePolicy(state, id).ok) queuePolicy(state, id);
        resolveMonth(state);
        state.policies.queued = [];
      }
      return JSON.stringify(state);
    };
    expect(play(fresh())).toBe(play(fresh()));
  });

  it('round-trips a save and rejects foreign payloads', () => {
    const state = fresh();
    resolveMonth(state);
    const encoded = encodeState(state);
    const decoded = decodeState(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.turn).toBe(state.turn);
    expect(decoded?.fiscal.deficit).toBe(state.fiscal.deficit);
    expect(decodeState('{"version":2,"state":{}}')).toBeNull();
    expect(decodeState('not json')).toBeNull();
    expect(saveKey()).toBe('chokepoint:economic:v1');
  });
});

describe('long-run stability and endings', () => {
  it('stays numerically sane across a long sandbox run', () => {
    const state = createInitialState('sandbox', 'hormuz', 99);
    for (let index = 0; index < 36 && state.status === 'playing'; index += 1) {
      resolveMonth(state);
      for (const value of [state.prices.headline, state.currency.fxGap, state.fiscal.debt, state.society.legitimacy, state.reserves.usable]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(state.prices.headline).toBeGreaterThanOrEqual(-10);
      expect(state.prices.headline).toBeLessThanOrEqual(250);
    }
    const axes = objectives(state);
    for (const value of Object.values(axes)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('ends the campaign on the final month with an attributable verdict', () => {
    const state = fresh();
    for (let index = 0; index < state.maxMonths; index += 1) {
      if (state.status !== 'playing') break;
      resolveMonth(state);
    }
    const outcome = state.outcome ?? evaluateOutcome(state, true);
    expect(outcome).not.toBeNull();
    expect(['won', 'lost', 'drawn']).toContain(outcome?.status);
    expect(outcome?.notes.length).toBeGreaterThan(0);
    expect(state.phase).toBe('ended');
  });

  it('produces a reserve forecast with an uncertainty band', () => {
    const state = fresh();
    const result = forecast(state);
    expect(result.high).toBeGreaterThanOrEqual(result.low);
    expect(result.inflationRange[1]).toBeGreaterThan(result.inflationRange[0]);
    expect(result.risk.en.length).toBeGreaterThan(0);
    expect(result.risk.fa.length).toBeGreaterThan(0);
  });

  it('never repeats a fired event', () => {
    const state = createInitialState('sandbox', 'sanctions-squeeze', 11);
    for (let index = 0; index < 24; index += 1) resolveMonth(state);
    const unique = new Set(state.firedEvents);
    expect(unique.size).toBe(state.firedEvents.length);
  });
});
