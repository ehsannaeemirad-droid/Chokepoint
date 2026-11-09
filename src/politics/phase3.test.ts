/**
 * Phase 3 tests: data-driven logistics, the Israeli initiative track and the
 * Qatar ceasefire talks.
 *
 * End-of-turn tests silence the opposition (see domestic.test.ts) so the AI
 * phase cannot inject nondeterministic events into the assertions.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { ISRAEL_AIRLIFT, REINFORCEMENTS } from '../core/engine';
import {
  DEFAULT_INITIATIVE_CFG,
  iranLaunchPressure,
  israelPackages,
  validateInitiativeOrder,
} from './initiative';
import {
  DEFAULT_TALKS_CFG,
  armisticeOutcome,
  qatarOfferDue,
  talksCfg,
  validateTalksOrder,
} from './talks';

function newGame(faction: 'usa' | 'iran' = 'usa', seed = 8080): Game {
  const game = new Game();
  game.start('campaign', faction, seed);
  return game;
}

function silenceOpposition(game: Game): void {
  const snap = game.snap;
  const OFFENSIVE = ['shahed136', 'fateh110', 'khorramshahr', 'fattah', 'asm_launcher', 'mine_layer'];
  snap.units = snap.units.filter((u) => u.faction !== 'houthi' && !OFFENSIVE.includes(u.typeId));
  for (const cls of ['drone', 'fateh', 'khorramshahr', 'fattah', 'asm'] as const) snap.iran.rounds[cls] = 0;
  snap.iran.mines = 0;
}

function quietTurn(game: Game): void {
  if (game.snap.status !== 'playing') return;
  silenceOpposition(game);
  game.endTurn();
}

function localStorageStub(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
    configurable: true,
    writable: true,
  });
}

describe('data-driven logistics', () => {
  it('keeps every transit time in scenario data (2-4 for routine supplies)', () => {
    const interceptors = REINFORCEMENTS.find((r) => r.id === 'interceptors')!;
    const patriot = REINFORCEMENTS.find((r) => r.id === 'patriot')!;
    expect(interceptors.turns).toBe(3);
    expect(patriot.turns).toBe(4);
    expect(ISRAEL_AIRLIFT.turns).toBe(2);
    // Heavy formations keep their longer transits pending a balance pass.
    const csg = REINFORCEMENTS.find((r) => r.id === 'csg')!;
    expect(csg.turns).toBe(6);
    // Every package takes at least two turns to arrive, whatever it is.
    for (const pkg of REINFORCEMENTS) {
      expect(pkg.turns).toBeGreaterThanOrEqual(2);
      expect(pkg.turns).toBeLessThanOrEqual(6);
    }
  });
});

describe('the Israeli initiative track', () => {
  beforeEach(localStorageStub);

  it('starts mid-track with the accepted stance', () => {
    const game = newGame();
    expect(game.snap.israelInitiative!.level).toBe(60);
    expect(game.snap.israelInitiative!.stance).toBe('accepted');
    expect(israelPackages(game.snap)).toBe(1);
  });

  it('computes launch pressure from launchers and stock', () => {
    const game = newGame();
    const full = iranLaunchPressure(game.snap);
    expect(full).toBeGreaterThan(0);
    expect(full).toBeLessThanOrEqual(100);
    // Removing launchers and stock must lower the pressure.
    silenceOpposition(game);
    expect(iranLaunchPressure(game.snap)).toBe(0);
  });

  it('drifts toward the target and announces tier crossings', () => {
    const game = newGame();
    silenceOpposition(game);
    const track = game.snap.israelInitiative!;
    track.level = 74; // one below the aggressive threshold
    game.snap.meters.legitimacy = 100;
    // Launch pressure 0 with max legitimacy: target = 35 — drift is downward.
    quietTurn(game);
    expect(track.level).toBe(70); // drifted -4
    expect(game.snap.israelInitiative!.level).toBe(70);
  });

  it('approval raises the level and unlocks two packages above the threshold', () => {
    const game = newGame();
    const track = game.snap.israelInitiative!;
    track.level = 74;
    expect(game.queueOrder({ kind: 'israel-initiative', stance: 'approved' }).ok).toBe(true);
    game.endTurn(); // real opposition: launch pressure keeps the target high
    expect(track.stance).toBe('approved');
    expect(track.level).toBe(78); // 74 + 8 approval, drifted one step toward target
    expect(israelPackages(game.snap)).toBe(2);
  });

  it('constraining stands Israel down from offensive strikes', () => {
    const game = newGame();
    expect(game.queueOrder({ kind: 'israel-initiative', stance: 'constrained' }).ok).toBe(true);
    quietTurn(game);
    expect(israelPackages(game.snap)).toBe(0);
    expect(validateInitiativeOrder(game.snap, 'approved')).toContain('reacting');
  });

  it('is US-only and cooldown-gated', () => {
    const iranGame = newGame('iran');
    expect(validateInitiativeOrder(iranGame.snap, 'approved')).toContain('Washington');

    const game = newGame();
    expect(game.queueOrder({ kind: 'israel-initiative', stance: 'approved' }).ok).toBe(true);
    quietTurn(game); // the directive applies at the end of the turn
    expect(game.snap.israelInitiative!.lastOrderTurn).toBe(1);
    expect(validateInitiativeOrder(game.snap, 'accepted')).toContain('reacting');
    expect(game.queueOrder({ kind: 'israel-initiative', stance: 'accepted' }).ok).toBe(false);
  });
});

describe('the Qatari ceasefire talks', () => {
  beforeEach(localStorageStub);

  it('offers mediation when the war burns (war cost, Hormuz or will)', () => {
    const game = newGame();
    expect(qatarOfferDue(game.snap)).toBe(false);
    game.snap.meters.iranWarCost = Math.ceil(game.snap.meters.iranWarCostThreshold * 0.6);
    expect(qatarOfferDue(game.snap)).toBe(true);
  });

  it('moves from offer to talks and progresses each turn', () => {
    const game = newGame();
    silenceOpposition(game);
    game.snap.meters.iranWarCost = 85; // past the offer and bonus shares, short of the ceasefire win
    quietTurn(game);
    expect(game.snap.ceasefire!.state).toBe('offered');

    expect(game.queueOrder({ kind: 'talks', stance: 'pursue' }).ok).toBe(true);
    quietTurn(game);
    expect(game.snap.ceasefire!.state).toBe('talks');
    const cfg = talksCfg(game.snap);
    // Start 20 + base 6 + war-cost bonus 4 (war cost is at/above 0.8 share).
    expect(game.snap.ceasefire!.progress).toBe(cfg.startProgress + cfg.baseProgress + cfg.warCostBonus);
  });

  it('strikes on Iranian soil set the talks back', () => {
    const game = newGame();
    silenceOpposition(game);
    game.snap.ceasefire!.state = 'talks';
    game.snap.ceasefire!.progress = 50;
    game.snap.ceasefire!.lastEscalation = 0;
    game.snap.meters.nuclearEscalation = 20; // rising → penalty applies
    quietTurn(game);
    const cfg = talksCfg(game.snap);
    expect(game.snap.ceasefire!.progress).toBe(50 + cfg.baseProgress - cfg.escalationPenalty);
  });

  it('ends the campaign with a tiered armistice at full progress', () => {
    // Favorable: war cost high AND the basing network intact → coalition win.
    // lastEscalation pinned high so coalition strikes this turn don't set the
    // final progress back below the agreement threshold.
    const usa = newGame('usa');
    silenceOpposition(usa);
    usa.snap.ceasefire!.state = 'talks';
    usa.snap.ceasefire!.progress = DEFAULT_TALKS_CFG.agreeProgress;
    usa.snap.ceasefire!.lastEscalation = 999;
    usa.snap.meters.iranWarCost = usa.snap.meters.iranWarCostThreshold;
    const favorable = armisticeOutcome(usa.snap, usa.map)!;
    expect(favorable.tier).toBe('favorable');
    quietTurn(usa);
    expect(usa.snap.status).toBe('won');
    expect(usa.snap.outcome).toContain('favorable armistice');

    // Costly: no war-cost leverage → coalition loss, Iranian win.
    const iranGame = newGame('iran');
    silenceOpposition(iranGame);
    iranGame.snap.ceasefire!.state = 'talks';
    iranGame.snap.ceasefire!.progress = DEFAULT_TALKS_CFG.agreeProgress;
    iranGame.snap.ceasefire!.lastEscalation = 999;
    iranGame.snap.meters.iranWarCost = 0;
    quietTurn(iranGame);
    expect(iranGame.snap.status).toBe('won');
    expect(iranGame.snap.outcome).toContain('costly armistice');
  });

  it('lapses an unanswered offer and walks away on demand', () => {
    const game = newGame();
    silenceOpposition(game);
    game.snap.meters.iranWarCost = Math.ceil(game.snap.meters.iranWarCostThreshold * 0.6);
    quietTurn(game);
    expect(game.snap.ceasefire!.state).toBe('offered');
    quietTurn(game);
    quietTurn(game);
    quietTurn(game); // lapseTurns = 3 without an answer
    expect(game.snap.ceasefire!.state).toBe('collapsed');
  });

  it('rejects talks orders from the wrong side or state', () => {
    const game = newGame();
    expect(validateTalksOrder(game.snap, 'pursue')).toContain('no standing offer');
    game.snap.ceasefire!.state = 'offered';
    const iranGame = newGame('iran');
    expect(validateTalksOrder(iranGame.snap, 'pursue')).toContain('Tehran');
  });
});

describe('phase 3 save compatibility', () => {
  beforeEach(localStorageStub);

  it('normalizes a pre-Phase-3 snapshot on load', () => {
    const game = newGame();
    expect(game.save('slot1')).toBe(true);
    const raw = JSON.parse(localStorage.getItem('chokepoint:save:slot1')!) as {
      snapshot: Record<string, unknown>;
    };
    const snap = raw.snapshot as {
      israelInitiative?: unknown;
      initiativeCfg?: unknown;
      ceasefire?: unknown;
      talksCfg?: unknown;
    };
    delete snap.israelInitiative;
    delete snap.initiativeCfg;
    delete snap.ceasefire;
    delete snap.talksCfg;
    localStorage.setItem('chokepoint:save:slot1', JSON.stringify(raw));

    const restored = new Game();
    expect(restored.load('slot1')).toBe(true);
    expect(restored.snap.israelInitiative!.level).toBe(60);
    expect(restored.snap.israelInitiative!.stance).toBe('accepted');
    expect(restored.snap.ceasefire!.state).toBe('none');
    expect(restored.snap.initiativeCfg!.aggressiveThreshold).toBe(DEFAULT_INITIATIVE_CFG.aggressiveThreshold);
  });
});
