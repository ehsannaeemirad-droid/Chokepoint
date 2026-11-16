import { describe, expect, it } from 'vitest';
import {
  DECISION_BY_ID,
  DECISIONS,
  canQueue,
  canRunDefence,
  createInitialState,
  createReplay,
  objectives,
  replaySession,
  resolveDefence,
  decodeState,
  encodeState,
  objectiveCount,
  queueDecision,
  resolveTurn,
  saveKey,
} from './model';

function campaign(seed = 20260310) {
  return createInitialState('campaign', 'flashpoint', seed);
}

describe('national command crisis model', () => {
  it('supports both playable governments, three campaigns and chosen priorities', () => {
    const usa = createInitialState('campaign', 'flashpoint', 11, {
      player: 'usa',
      campaign: 'economic-pressure',
      priorities: ['economy', 'crisis'],
    });
    expect(usa.player).toBe('usa');
    expect(usa.campaign).toBe('economic-pressure');
    expect(usa.maxTurns).toBe(10);
    expect(usa.economy.reserves).toBeGreaterThan(80);
    expect(usa.actors.iran).toBeDefined();
    expect(usa.priorities).toEqual(['economy', 'crisis']);
    expect(objectives(usa).filter((row) => row.priority)).toHaveLength(2);

    const settlement = createInitialState('campaign', 'flashpoint', 12, {
      player: 'iran',
      campaign: 'settlement',
      priorities: ['diplomacy', 'governance'],
    });
    expect(settlement.maxTurns).toBe(10);
    expect(settlement.diplomacy.talks).toBeGreaterThan(40);
    expect(settlement.priorities).toEqual(['diplomacy', 'governance']);
  });

  it('constructs a sandbox from custom starting pressure', () => {
    const state = createInitialState('sandbox', 'flashpoint', 4, {
      player: 'usa',
      custom: { military: 71, diplomatic: 66, economic: 59, domestic: 52, accessibility: 44, confidence: 31, reserves: 88, inflation: 55, stability: 47 },
    });
    expect(state.mode).toBe('sandbox');
    expect(state.maxTurns).toBe(0);
    expect(state.escalation.military).toBe(71);
    expect(state.shipping.accessibility).toBe(44);
    expect(state.economy.reserves).toBe(88);
    expect(state.government.stability).toBe(47);

    const open = createInitialState('sandbox', 'flashpoint', 4, { campaign: 'settlement' });
    expect(open.diplomacy.talks).toBe(18);
    expect(open.government.stability).toBe(61);

    const replay = createReplay(state);
    expect(replay.customStart).toEqual(state.customStart);
    const restored = replaySession(replay);
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.state.escalation.military).toBe(71);
      expect(restored.state.government.stability).toBe(47);
    }
  });

  it('lets Iran act independently when the player governs the United States', () => {
    const state = createInitialState('campaign', 'flashpoint', 77, { player: 'usa' });
    resolveTurn(state);
    expect(state.actors.iran.lastAction.en.length).toBeGreaterThan(0);
    expect(state.report?.lines.some((line) => line.text.en.includes('Tehran') || line.text.en.includes('Iran'))).toBe(true);
  });

  it('falls back to exactly two valid priorities', () => {
    const state = createInitialState('campaign', 'flashpoint', 1, { priorities: ['economy', 'not-a-priority' as never] });
    expect(state.priorities).toEqual(['security', 'governance']);
  });

  it('runs the air-defence plot once per week with a deterministic result', () => {
    const state = campaign();
    expect(canRunDefence(state).ok).toBe(true);
    const result = resolveDefence(state, { command: 2, ports: 1, cities: 0 });
    expect(result.ok).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(state.defenceUsedTurn).toBe(1);
    expect(state.tacticalLog).toHaveLength(1);
    expect(canRunDefence(state).ok).toBe(false);
    expect(resolveDefence(state, { command: 3, ports: 0, cities: 0 }).ok).toBe(false);
    resolveTurn(state);
    expect(canRunDefence(state).ok).toBe(true);
  });

  it('fires a data-defined event only once and reports it', () => {
    const state = campaign(31);
    state.shipping.insurance = 82;
    state.turn = 3;
    resolveTurn(state);
    expect(state.firedEvents).toContain('insurance-shock');
    expect(state.report?.lines.some((line) => line.text.en.includes('reinsurer'))).toBe(true);
    state.shipping.insurance = 82;
    resolveTurn(state);
    expect(state.firedEvents.filter((id) => id === 'insurance-shock')).toHaveLength(1);
  });

  it('replays a deterministic session including tactical actions', () => {
    const state = campaign(404);
    resolveDefence(state, { command: 1, ports: 1, cities: 1 });
    queueDecision(state, 'air-defence');
    queueDecision(state, 'validate-intel');
    resolveTurn(state);
    queueDecision(state, 'backchannel');
    resolveTurn(state);

    const replay = createReplay(state);
    const restored = replaySession(replay);
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.state.turn).toBe(state.turn);
      expect(restored.state.history).toHaveLength(state.history.length);
      expect(restored.state.defenceLastScore).toBe(state.defenceLastScore);
      expect(JSON.stringify(restored.state)).toBe(JSON.stringify(state));
    }
  });

  it('starts a twelve-turn Hormuz campaign with six departments and a functioning state', () => {
    const state = campaign();
    expect(state.mode).toBe('campaign');
    expect(state.maxTurns).toBe(12);
    expect(state.turn).toBe(1);
    expect(state.status).toBe('playing');
    expect(state.decisions).toEqual([]);
    expect(state.government.stability).toBeGreaterThan(40);
    expect(state.shipping.accessibility).not.toBe(state.shipping.confidence);
    expect(state.intelligence.assessments).toHaveLength(3);
    expect(saveKey()).toContain('national');
  });

  it('queues at most two affordable decisions and applies their cost', () => {
    const state = campaign();
    expect(queueDecision(state, 'backchannel').ok).toBe(true);
    expect(queueDecision(state, 'qatar-talks').ok).toBe(true);
    expect(state.decisions).toHaveLength(2);
    expect(canQueue(state, 'national-address').ok).toBe(false);
    expect(queueDecision(state, 'national-address').reason?.en).toContain('two departmental');
    expect(resolveTurn(state).decisions).toHaveLength(2);
    expect(state.decisions).toEqual([]);
    expect(state.politicalCapital).toBeLessThan(4 + 3);
  });

  it('puts major decisions on cooldown instead of allowing a diplomatic rush', () => {
    const state = campaign();
    expect(queueDecision(state, 'qatar-talks').ok).toBe(true);
    resolveTurn(state);
    expect(canQueue(state, 'qatar-talks').ok).toBe(false);
    state.turn = 3;
    expect(canQueue(state, 'qatar-talks').ok).toBe(false);
    state.turn = 4;
    state.politicalCapital = 4;
    expect(canQueue(state, 'qatar-talks').ok).toBe(true);
  });

  it('runs a complete twelve-week campaign through the decision queue', () => {
    const state = campaign(99);
    while (state.status === 'playing' && state.turn <= state.maxTurns) {
      const options = DECISIONS.filter((decision) => canQueue(state, decision.id).ok);
      const priority = ['qatar-talks', 'backchannel', 'release-reserves', 'national-address'];
      const picked = priority
        .map((id) => options.find((decision) => decision.id === id))
        .filter((decision): decision is (typeof DECISIONS)[number] => Boolean(decision))
        .slice(0, state.actionPoints);
      for (const decision of picked) queueDecision(state, decision.id);
      resolveTurn(state);
    }
    expect(state.status).not.toBe('playing');
    expect(state.history.length).toBeGreaterThan(0);
    expect(state.outcome).not.toBeNull();
  });

  it('prevents a second decision when the combined political cost is unaffordable', () => {
    const state = campaign();
    state.politicalCapital = 3;
    expect(queueDecision(state, 'nuclear-measure').ok).toBe(true);
    expect(queueDecision(state, 'backchannel').ok).toBe(false);
  });

  it('makes the shipping market react to physical access and confidence separately', () => {
    const state = campaign();
    const beforeFlow = state.shipping.flow;
    const beforeConfidence = state.shipping.confidence;
    queueDecision(state, 'mining-exercise');
    resolveTurn(state);

    expect(state.shipping.accessibility).toBeLessThan(72);
    expect(state.shipping.confidence).toBeLessThan(beforeConfidence);
    expect(state.shipping.flow).toBeLessThan(beforeFlow);
    expect(state.shipping.insurance).toBeGreaterThan(63);
    expect(state.escalation.military).toBeGreaterThan(58);
  });

  it('delivers delayed economic consequences on the following turn', () => {
    const state = campaign();
    queueDecision(state, 'release-reserves');
    resolveTurn(state);
    expect(state.pending).toHaveLength(1);
    expect(state.pending[0]!.dueTurn).toBe(2);
    const pressure = state.economy.publicPressure;
    resolveTurn(state);
    expect(state.pending).toHaveLength(0);
    expect(state.economy.publicPressure).toBeGreaterThan(pressure - 1);
    expect(state.economy.inflation).toBeGreaterThan(38);
  });

  it('is deterministic for the same seed and decisions', () => {
    const a = campaign(777);
    const b = campaign(777);
    for (const state of [a, b]) {
      queueDecision(state, 'air-defence');
      queueDecision(state, 'validate-intel');
      resolveTurn(state);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('lets the player reach a negotiated settlement through talk progress', () => {
    const state = campaign();
    state.diplomacy.talks = 89;
    state.diplomacy.mediation = 40;
    state.escalation.stage = 3;
    state.turn = 5;
    resolveTurn(state);
    expect(state.status).toBe('won');
    expect(state.outcome?.verdict).toBe('negotiated');
  });

  it('ends in collapse when the government or economy fails', () => {
    const state = campaign();
    state.government.stability = 10;
    resolveTurn(state);
    expect(state.status).toBe('lost');
    expect(state.outcome?.verdict).toBe('defeat');
  });

  it('evaluates the campaign after the twelfth turn', () => {
    const state = campaign();
    state.turn = 12;
    state.date = '2026-05-26';
    state.government = { legitimacy: 70, stability: 70, elite: 68, confidence: 68, socialTension: 24 };
    state.economy = { reserves: 75, currency: 70, inflation: 32, fiscal: 70, oilRevenue: 68, tradeAccess: 72, publicPressure: 35 };
    state.security = { readiness: 65, defence: 72, strategic: 67 };
    state.diplomacy = { relations: { iran: 0, usa: 46, gcc: 55, qatar: 72, china: 64, eu: 52 }, influence: 64, talks: 72, mediation: 40, sanctionsRelief: 38 };
    state.escalation = { military: 45, diplomatic: 40, economic: 42, domestic: 38, stage: 3 };
    resolveTurn(state);
    expect(state.status).toBe('won');
    expect(state.outcome?.verdict === 'strategic' || state.outcome?.verdict === 'limited').toBe(true);
    expect(objectiveCount(state).met).toBeGreaterThanOrEqual(3);
  });

  it('closes every campaign configuration after its own clock', () => {
    for (const player of ['iran', 'usa'] as const) {
      for (const campaignId of ['hormuz', 'economic-pressure', 'settlement'] as const) {
        const state = createInitialState('campaign', 'flashpoint', 5, { player, campaign: campaignId, priorities: ['security', 'economy'] });
        while (state.status === 'playing') resolveTurn(state);
        expect(state.history.length).toBeGreaterThan(0);
        expect(state.history.length).toBeLessThanOrEqual(state.maxTurns);
        expect(state.outcome).not.toBeNull();
      }
    }
  });

  it('keeps sandbox open-ended after the campaign clock would have expired', () => {
    const state = createInitialState('sandbox', 'contained', 8);
    for (let i = 0; i < 14; i += 1) resolveTurn(state);
    expect(state.status).toBe('playing');
    expect(state.phase).toBe('decisions');
    expect(state.turn).toBe(15);
  });

  it('round-trips a versioned save', () => {
    const state = campaign();
    queueDecision(state, 'national-address');
    resolveTurn(state);
    const decoded = decodeState(encodeState(state));
    expect(decoded?.turn).toBe(state.turn);
    expect(decoded?.history).toHaveLength(1);
    expect(decoded?.report?.decisions).toEqual(['national-address']);
    expect(decoded?.government.stability).toBe(state.government.stability);
  });

  it('exposes readable effect descriptions for every decision', () => {
    for (const decision of Object.values(DECISION_BY_ID)) {
      expect(decision.title.en.length).toBeGreaterThan(0);
      expect(decision.description.fa.length).toBeGreaterThan(0);
      expect(decision.cost).toBeGreaterThan(0);
    }
  });
});
