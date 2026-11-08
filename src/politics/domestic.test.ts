/**
 * Phase 2 tests: the US domestic-pressure system.
 *
 * Covers the single gauge and its two drivers, casualty reports with
 * congressional responses, announced (never silent) restrictions with
 * hysteresis, economic-pressure budget cuts, the public-address order, the
 * domestic-collapse outcome and save normalization for older snapshots.
 *
 * End-of-turn tests silence the opposition first (no Iranian stock, no Houthi
 * units) so the AI phase cannot inject nondeterministic casualty events into
 * the assertions. All balance values come from scenario data.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { validateStrike } from '../combat/combat';
import { Game } from '../core/Game';
import { recordImpact } from './politics';
import {
  addCasualties,
  domesticPressure,
  economyAirliftRegen,
  economyResupplyAmount,
  restrictionBlocksStrike,
} from './domestic';
import { checkOutcome, usDomesticLoss } from './victory';

function newGame(faction: 'usa' | 'iran' = 'usa', seed = 8080): Game {
  const game = new Game();
  game.start('campaign', faction, seed);
  return game;
}

/** Remove every AI source of US casualties so end-of-turn tests are exact. */
function silenceOpposition(game: Game): void {
  const snap = game.snap;
  // Iranian production lines rebuild stock within the same AI phase, so the
  // only reliable silence is to remove every offensive launcher unit.
  const OFFENSIVE = ['shahed136', 'fateh110', 'khorramshahr', 'fattah', 'asm_launcher', 'mine_layer'];
  snap.units = snap.units.filter((u) => u.faction !== 'houthi' && !OFFENSIVE.includes(u.typeId));
  snap.iran.drones = 0;
  snap.iran.fateh = 0;
  snap.iran.khorramshahr = 0;
  snap.iran.fattah = 0;
  snap.iran.asm = 0;
  snap.iran.mines = 0;
}

/** A quiet turn: opposition silenced, then the turn resolves. */
function quietTurn(game: Game): void {
  if (game.snap.status !== 'playing') return;
  silenceOpposition(game);
  game.endTurn();
}

function runQuietTurns(game: Game, n: number): void {
  for (let i = 0; i < n; i++) quietTurn(game);
}

describe('the single domestic gauge', () => {
  beforeEach(localStorageStub);

  it('starts from scenario data with both drivers', () => {
    const game = newGame();
    const d = game.snap.domestic!;
    expect(d.congress).toBe(60);
    expect(d.economy).toBe(10);
    expect(d.pressure).toBe(domesticPressure(60, 10));
    expect(d.restriction).toBe('none');
    expect(d.pending).toBeNull();
    expect(d.casualtiesTotal).toBe(0);
  });

  it('computes pressure as 60% congressional + 40% economic', () => {
    expect(domesticPressure(100, 0)).toBe(0);
    expect(domesticPressure(0, 100)).toBe(100);
    expect(domesticPressure(60, 10)).toBe(28);
    expect(domesticPressure(50, 50)).toBe(50);
  });

  it('raises economic pressure from sustained disruption', () => {
    const game = newGame();
    // Hormuz disruption above 50 for 14 straight turns drives inflation to 29
    // and economic pressure to 58 through the scenario's economy formulas.
    game.snap.meters.hormuzTurnsAbove50 = 14;
    quietTurn(game);
    expect(game.snap.domestic!.economy).toBe(58);
  });
});

describe('casualty reporting and congressional response', () => {
  beforeEach(localStorageStub);

  it('publishes a casualty report and drops congressional support', () => {
    const game = newGame();
    silenceOpposition(game);
    addCasualties(game.snap, 3);
    const before = game.snap.domestic!.congress;
    const { events } = game.endTurn();
    const report = events.find((e) => e.text.includes('Casualty report'));
    expect(report).toBeDefined();
    expect(report!.text).toContain('3 US casualty events');
    expect(before - game.snap.domestic!.congress).toBe(12); // 3 events × 4, cap not hit
    expect(game.snap.domestic!.casualtiesTurn).toBe(0);
    expect(game.snap.domestic!.casualtiesTotal).toBe(3);
  });

  it('generates a congressional response event for heavy casualties', () => {
    const game = newGame();
    silenceOpposition(game);
    addCasualties(game.snap, 4);
    const { events } = game.endTurn();
    expect(events.some((e) => e.text.includes('withdrawal timeline'))).toBe(true);
  });

  it('lets congressional support recover on quiet turns', () => {
    const game = newGame();
    game.snap.domestic!.congress = 40;
    runQuietTurns(game, 1);
    expect(game.snap.domestic!.congress).toBe(42);
  });

  it('counts impacts on major US bases as casualty events', () => {
    const game = newGame();
    expect(game.snap.domestic!.casualtiesTurn).toBe(0);
    recordImpact(game.snap, game.map, 'al_udeid');
    expect(game.snap.domestic!.casualtiesTurn).toBe(1);
    expect(game.snap.domestic!.casualtiesTotal).toBe(1);
  });
});

describe('announced congressional restrictions', () => {
  beforeEach(localStorageStub);

  it('announces a restriction one turn before it binds', () => {
    const game = newGame();
    game.snap.domestic!.congress = 30; // below restrictCongress (35)
    const { events } = game.endTurn();
    expect(game.snap.domestic!.restriction).toBe('none');
    expect(game.snap.domestic!.pending?.level).toBe('restricted');
    const announcement = events.find((e) => e.text.includes('restriction announced'));
    expect(announcement).toBeDefined();
    expect(announcement!.text).toContain('turn 2');
  });

  it('binds deep-strike blocks from the start of the effective turn', () => {
    const game = newGame();
    const b2 = game.snap.units.find((u) => u.typeId === 'b2')!;
    const natanz = game.map.nodeHexOf('natanz')!;
    expect(validateStrike(game.snap, game.map, b2, natanz.col, natanz.row, 'natanz').ok).toBe(true);

    game.snap.domestic!.congress = 30;
    quietTurn(game); // announcement only
    expect(game.snap.domestic!.restriction).toBe('none');
    quietTurn(game); // restriction takes effect at the start of this turn
    expect(game.snap.domestic!.restriction).toBe('restricted');

    const check = validateStrike(game.snap, game.map, b2, natanz.col, natanz.row, 'natanz');
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('inside Iranian territory');
  });

  it('suspends ALL US strikes when congress collapses further', () => {
    const game = newGame();
    game.snap.domestic!.congress = 15; // below suspendCongress (20)
    quietTurn(game);
    quietTurn(game);
    const d = game.snap.domestic!;
    expect(d.restriction).toBe('suspended');
    const f35 = game.snap.units.find((u) => u.typeId === 'f35a')!;
    const target = game.map.nodeHexOf('bandar_abbas')!;
    const check = validateStrike(game.snap, game.map, f35, target.col, target.row, 'bandar_abbas');
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('suspended');
  });

  it('never restricts Israeli operations', () => {
    const game = newGame();
    game.snap.domestic!.congress = 15;
    game.endTurn();
    game.endTurn();
    expect(game.snap.domestic!.restriction).toBe('suspended');
    expect(restrictionBlocksStrike(game.snap, 'israel')).toBeNull();
    expect(restrictionBlocksStrike(game.snap, 'usa')).toContain('suspended');
  });

  it('lifts a restriction only above threshold + hysteresis buffer', () => {
    const game = newGame();
    game.snap.domestic!.congress = 30;
    quietTurn(game);
    quietTurn(game);
    expect(game.snap.domestic!.restriction).toBe('restricted');

    game.snap.domestic!.congress = 40; // above 35 but below 35+8=43
    quietTurn(game);
    expect(game.snap.domestic!.restriction).toBe('restricted');
    expect(game.snap.domestic!.pending).toBeNull();

    game.snap.domestic!.congress = 44;
    quietTurn(game);
    expect(game.snap.domestic!.pending?.level).toBe('none');
    quietTurn(game);
    expect(game.snap.domestic!.restriction).toBe('none');
  });

  it('logs every restriction state change (no silent rules)', () => {
    const game = newGame();
    game.snap.domestic!.congress = 30;
    const turn1 = game.endTurn().events;
    expect(turn1.some((e) => e.text.includes('restriction announced'))).toBe(true);
    const turn2 = game.endTurn().events;
    expect(turn2.some((e) => e.text.includes('in effect'))).toBe(true);
  });
});

describe('economic pressure cuts the sustainment budget', () => {
  beforeEach(localStorageStub);

  it('scales airlift regeneration and interceptor resupply', () => {
    const game = newGame();
    expect(economyAirliftRegen(game.snap)).toBe(5);
    expect(economyResupplyAmount(game.snap)).toBe(12);

    game.snap.domestic!.economy = 100;
    expect(economyAirliftRegen(game.snap)).toBe(1); // 5 - floor(100/25)
    expect(economyResupplyAmount(game.snap)).toBe(4); // 12 - floor(100/15)*2 → floor
  });

  it('announces every budget change (no silent cuts)', () => {
    const game = newGame();
    // 40 sustained turns above 50% disruption cap inflation at 45% and put
    // economic pressure at 96, the deepest sustainment cuts in the data.
    game.snap.meters.hormuzTurnsAbove50 = 40;
    const { events } = game.endTurn();
    expect(events.some((e) => e.text.includes('Airlift regeneration cut'))).toBe(true);
    expect(events.some((e) => e.text.includes('Interceptor resupply cut'))).toBe(true);
    expect(game.snap.domestic!.economy).toBe(96);
  });
});

describe('the public-address order', () => {
  beforeEach(localStorageStub);

  it('buys congressional support with political capital', () => {
    const game = newGame();
    silenceOpposition(game);
    const willBefore = game.snap.resources.politicalWill;
    const congressBefore = game.snap.domestic!.congress;
    expect(game.queueOrder({ kind: 'communicate' }).ok).toBe(true);
    game.endTurn();
    expect(game.snap.resources.politicalWill).toBe(willBefore - 3);
    // +8 from the address, +2 quiet-turn recovery.
    expect(game.snap.domestic!.congress).toBe(congressBefore + 10);
  });

  it('enforces the three-turn cooldown', () => {
    const game = newGame();
    expect(game.queueOrder({ kind: 'communicate' }).ok).toBe(true);
    game.endTurn();
    expect(game.snap.domestic!.cooldown).toBe(2);
    expect(game.queueOrder({ kind: 'communicate' }).ok).toBe(false);
    runQuietTurns(game, 1);
    expect(game.queueOrder({ kind: 'communicate' }).ok).toBe(false);
    runQuietTurns(game, 1);
    expect(game.snap.domestic!.cooldown).toBe(0);
    expect(game.queueOrder({ kind: 'communicate' }).ok).toBe(true);
  });

  it('is rejected for non-US factions', () => {
    const game = newGame('iran');
    expect(game.queueOrder({ kind: 'communicate' }).ok).toBe(false);
  });
});

describe('domestic collapse outcome', () => {
  beforeEach(localStorageStub);

  it('requires sustained pressure at/above the collapse threshold', () => {
    const game = newGame();
    // Sustained disruption keeps economic pressure at 96; with congress at 0
    // the single gauge sits around 96 — far above the collapse threshold of 85.
    game.snap.meters.hormuzTurnsAbove50 = 40;
    game.snap.domestic!.congress = 0;
    expect(usDomesticLoss(game.snap)).toBe(false); // streak still 0
    quietTurn(game);
    expect(game.snap.meters.domesticPressureStreak).toBe(1);
    expect(usDomesticLoss(game.snap)).toBe(false);
    quietTurn(game);
    expect(usDomesticLoss(game.snap)).toBe(true);
  });

  it('ends the US campaign in defeat and hands Iran the win', () => {
    const usaGame = newGame('usa');
    usaGame.snap.meters.hormuzTurnsAbove50 = 40;
    usaGame.snap.domestic!.congress = 0;
    runQuietTurns(usaGame, 2);
    expect(usaGame.snap.status).toBe('lost');
    expect(usaGame.snap.outcome).toContain('domestic consensus');

    const iranGame = newGame('iran');
    iranGame.snap.meters.hormuzTurnsAbove50 = 40;
    iranGame.snap.domestic!.congress = 0;
    runQuietTurns(iranGame, 2);
    expect(iranGame.snap.status).toBe('won');
    expect(iranGame.snap.outcome).toContain('Congress forced a withdrawal');
  });

  it('does not fire while the US is winning the ceasefire race', () => {
    const game = newGame();
    game.snap.domestic!.congress = 0;
    game.snap.domestic!.economy = 100; // pressure 100, but the streak is 0
    game.snap.meters.iranWarCost = game.snap.meters.iranWarCostThreshold;
    const outcome = checkOutcome(game.snap, game.map);
    expect(outcome.status).toBe('won');
  });
});

describe('save compatibility', () => {
  beforeEach(localStorageStub);

  it('normalizes a pre-Phase-2 snapshot on load', () => {
    const game = newGame();
    expect(game.save('slot1')).toBe(true);
    // Simulate an old save: strip the Phase 2 fields and the new meter.
    const raw = JSON.parse(localStorage.getItem('chokepoint:save:slot1')!) as {
      snapshot: Record<string, unknown>;
    };
    const snap = raw.snapshot as { domestic?: unknown; domesticCfg?: unknown; meters: Record<string, unknown> };
    delete snap.domestic;
    delete snap.domesticCfg;
    delete snap.meters.domesticPressureStreak;
    localStorage.setItem('chokepoint:save:slot1', JSON.stringify(raw));

    const restored = new Game();
    expect(restored.load('slot1')).toBe(true);
    expect(restored.snap.domestic!.congress).toBe(60);
    expect(restored.snap.domestic!.restriction).toBe('none');
    expect(restored.snap.meters.domesticPressureStreak).toBe(0);
    expect(restored.snap.domesticCfg!.restrictCongress).toBe(35);
  });
});

/** Minimal localStorage used by save/load in tests. */
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
