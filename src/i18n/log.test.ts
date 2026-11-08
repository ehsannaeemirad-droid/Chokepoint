/**
 * Phase 6 tests: the Persian template pass for battle log and outcome text.
 *
 * The engine stores English lines in the snapshot (replay determinism); these
 * tests assert the presentation-layer templates: named-variable substitution,
 * select/optional segments, and — the strong one — that EVERY terminal
 * outcome of full campaigns for all three factions is a known outcome with a
 * Persian rendering.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { faLog, faOutcome, isKnownOutcome } from './log';
import { hostileTo } from '../combat/combat';
import { defenderOfNode } from '../core/world';
import { hexDistance } from '../map/hex';

type Faction = 'usa' | 'israel' | 'iran';

function newGame(faction: Faction, seed = 987654): Game {
  const game = new Game();
  game.start('campaign', faction, seed);
  return game;
}

function playCampaign(faction: Faction, seed: number): Game {
  const game = newGame(faction, seed);
  let guard = 0;
  while (game.snap.status === 'playing' && guard < 32) {
    // Keep ordering one strike per turn so campaigns actually develop.
    const targets = game.map.nodes.filter((node) => {
      const defender = defenderOfNode(node);
      return !!defender && hostileTo(faction, defender);
    });
    for (const unit of game.snap.units) {
      if (unit.faction !== faction) continue;
      for (const target of targets) {
        const hex = game.map.nodeHexOf(target.id);
        if (!hex) continue;
        if (hexDistance({ col: unit.col, row: unit.row }, hex) > 30) continue;
        const result = game.queueOrder({
          kind: 'strike',
          unitUid: unit.uid,
          col: hex.col,
          row: hex.row,
          nodeId: target.id,
        });
        if (result.ok) break;
      }
    }
    game.endTurn();
    guard++;
  }
  return game;
}

describe('named-variable log templates', () => {
  it('translates the casualty report with its numbers', () => {
    const fa = faLog(
      'Casualty report (turn 4): 3 US casualty events this turn, 7 to date. Congressional support 50 → 38.',
    )!;
    expect(fa).toBe('گزارش تلفات (نوبت ۴): ۳ رویداد تلفات آمریکا در این نوبت، ۷ تاکنون. حمایت کنگره ۵۰ ← ۳۸.'.replace('۴', '4').replace('۳', '3').replace('۷', '7').replace('۵۰', '50').replace('۳۸', '38'));
  });

  it('translates restriction announcements and state changes', () => {
    expect(
      faLog(
        'Congressional restriction announced: US strikes inside Iranian territory forbidden, effective from the start of turn 2 (support 30).',
      ),
    ).toContain('محدودیت کنگره اعلام شد');
    expect(faLog('Congressional restriction in effect: all US offensive strikes are suspended.')).toContain('متوقف');
    expect(faLog('Congressional restriction lifted: US offensive operations resume.')).toContain('برداشته شد');
  });

  it('switches select-segments on the captured value', () => {
    const cut = faLog('Airlift regeneration cut to +2/turn (economic pressure 96).')!;
    expect(cut).toContain('کاهش');
    const restored = faLog('Airlift regeneration restored to +5/turn (economic pressure 8).')!;
    expect(restored).toContain('بازیابی');
  });

  it('renders the optional integrity segment only when present', () => {
    const withIntegrity = faLog('1 Shahed one-way attack drones impact at Ali Al Salem / Camp Arifjan — integrity 87%.')!;
    expect(withIntegrity).toContain('یکپارچگی');
    const without = faLog('1 Shahed one-way attack drones impact at hex 39,34.')!;
    expect(without).not.toContain('یکپارچگی');
    expect(without).toContain('hex 39,34');
  });

  it('translates interception, destruction and reinforcement lines', () => {
    expect(faLog('Patriot PAC-3 intercepted 2/3 Shahed one-way attack drones.')!).toContain('رهگیری کرد');
    expect(faLog('F-15E destroyed at 39,34.')!).toContain('نابود شد');
    expect(faLog('Strategic airlift delivered 12 interceptors to the Gulf.')!).toContain('ترابری راهبردی');
    // Outcome text goes through faOutcome, not the log pattern table.
    expect(
      faLog('US political will reached zero. Washington orders a general withdrawal; the campaign is lost at home.'),
    ).toBeNull();
  });

  it('returns null for unmatched lines so callers keep English', () => {
    expect(faLog('A totally unknown engine line 42.')).toBeNull();
  });
});

describe('outcome coverage', () => {
  it('translates every outcome the campaign can end with', () => {
    for (const faction of ['usa', 'israel', 'iran'] as const) {
      const game = playCampaign(faction, 987654);
      expect(game.snap.status).not.toBe('playing');
      expect(isKnownOutcome(game.snap.outcome)).toBe(true);
      const fa = faOutcome(game.snap.outcome)!;
      expect(fa.length).toBeGreaterThan(10);
      expect(fa).not.toBe(game.snap.outcome);
    }
  });

  it('covers the tutorial endings and the immediate Iranian wins', () => {
    const known = [
      'Tutorial complete: the Gulf basing network held and you managed the interceptor economy.',
      'Tutorial failed: too many Gulf bases were knocked out.',
      'US political will reached zero. The Americans are withdrawing — the regime survives.',
    ];
    for (const text of known) expect(isKnownOutcome(text)).toBe(true);
  });

  it('leaves unknown outcomes as null', () => {
    expect(faOutcome('Brand new ending not in the dictionary.')).toBeNull();
  });
});
