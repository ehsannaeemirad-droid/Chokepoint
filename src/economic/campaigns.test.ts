import { describe, expect, it } from 'vitest';
import { canQueuePolicy, createInitialState, queuePolicy, resolveMonth, type EconomicState, type PolicyId, type ScenarioId } from './model';

/**
 * A "sensible government" plan: sell crude, diversify, negotiate, raise revenue,
 * protect households and invest early. It is deliberately modest — a player who
 * only clicks the obvious options should be able to finish every campaign.
 */
const PLAN: Array<{ id: PolicyId; when: (s: EconomicState) => boolean }> = [
  { id: 'invest-refining', when: (s) => s.turn <= 4 && s.policies.politicalCapital >= 5 },
  { id: 'invest-agriculture', when: (s) => s.trade.food.coverage < 6 && s.turn <= 5 },
  { id: 'diversify-trade', when: (s) => s.trade.supplierRisk > 48 },
  { id: 'negotiate-exemptions', when: (s) => s.sanctions.financial > 52 || s.sanctions.shipping > 60 },
  { id: 'oil-discount', when: (s) => s.energy.exports < s.energy.capacity - s.energy.domesticUse - 0.15 },
  { id: 'tax-rise', when: (s) => s.fiscal.taxRevenue < 2.3 },
  { id: 'rate-hike', when: (s) => s.prices.headline > 40 && s.banking.credit > 30 },
  { id: 'targeted-transfers', when: (s) => s.households.foodAffordability < 46 || s.society.protests > 44 },
  { id: 'public-communication', when: (s) => s.society.legitimacy < 56 || s.society.protests > 48 },
  { id: 'cut-subsidies', when: (s) => s.fiscal.deficit > 2.6 && s.society.protests < 44 },
  { id: 'bank-liquidity', when: (s) => s.banking.liquidity < 34 },
  { id: 'priority-imports', when: (s) => s.trade.food.coverage < 3.2 },
  { id: 'spend-reserves', when: (s) => s.currency.fxGap > 75 && s.reserves.usable > 8 },
];

const SCENARIOS: ScenarioId[] = ['hormuz', 'oil-collapse', 'currency-crisis', 'sanctions-squeeze', 'food-energy-shock'];

function govern(state: EconomicState): void {
  for (const step of PLAN) {
    if (state.policies.queued.length >= 2) break;
    if (!step.when(state)) continue;
    if (canQueuePolicy(state, step.id).ok) queuePolicy(state, step.id);
  }
}

function play(scenario: ScenarioId, active: boolean): EconomicState {
  const state = createInitialState('campaign', scenario, 20260301);
  let guard = 0;
  while (state.status === 'playing' && guard < 20) {
    guard += 1;
    if (active) govern(state);
    resolveMonth(state);
  }
  return state;
}

describe('campaign survivability', () => {
  it.each(SCENARIOS)('%s can be played to its ending with sensible policies', (scenario) => {
    const state = play(scenario, true);
    expect(state.status).not.toBe('playing');
    expect(state.phase).toBe('ended');
    expect(state.outcome).not.toBeNull();
    // No early collapse: the government reaches the final month.
    expect(state.turn).toBe(state.maxMonths);
    expect(state.outcome?.verdict).not.toBe('humanitarian');
    expect(state.outcome?.verdict).not.toBe('financial-collapse');
    expect(state.outcome?.verdict).not.toBe('political-crisis');
    expect(state.status).not.toBe('lost');
  });

  it('rewards governing the recommended campaign and punishes inaction', () => {
    const governed = play('hormuz', true);
    const idle = play('hormuz', false);
    expect(governed.status).toBe('won');
    expect(governed.outcome?.axes.political).toBeGreaterThan(idle.outcome?.axes.political ?? 0);
    expect(idle.status).not.toBe('won');
  });

  it('keeps the stronger campaigns survivable and decision-dependent', () => {
    expect(play('currency-crisis', true).status).toBe('won');
    expect(play('sanctions-squeeze', true).status).toBe('won');
    expect(play('currency-crisis', false).status).not.toBe('won');
    expect(play('sanctions-squeeze', false).status).not.toBe('won');
  });

  it('ends the two hardest campaigns as survival with severe weaknesses', () => {
    for (const scenario of ['oil-collapse', 'food-energy-shock'] as ScenarioId[]) {
      const state = play(scenario, true);
      expect(state.status).toBe('drawn');
      expect(state.outcome?.verdict).toBe('stagnation');
    }
  });

  it('is deterministic for the same scenario and policy plan', () => {
    const first = play('oil-collapse', true);
    const second = play('oil-collapse', true);
    expect(JSON.stringify(first.outcome)).toBe(JSON.stringify(second.outcome));
    expect(first.snapshots.at(-1)).toEqual(second.snapshots.at(-1));
  });
});
