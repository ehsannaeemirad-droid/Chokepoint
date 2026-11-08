/**
 * Improvement 7: multi-axis graded victory settlement.
 *
 * Six data-weighted axes (three per side), each side's total normalized to
 * its own weight sum, margin → graded verdict. Built once at the terminal
 * turn; pure snapshot arithmetic.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { DEFAULT_SCORECARD_CFG, axisScore, buildScorecard, verdictFor } from './scorecard';

describe('axis scores', () => {
  it('score every axis in range against their own definition', () => {
    const game = new Game();
    game.start('campaign', 'usa', 3131);
    for (const id of Object.keys(DEFAULT_SCORECARD_CFG.axes)) {
      const score = axisScore(game.snap, id, game.map);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
    // Fresh campaign: regime intact, no leadership strikes → perfect regime score.
    expect(axisScore(game.snap, 'regime', game.map)).toBe(100);
    // Nuclear complex untouched → coalition scores nothing there.
    expect(axisScore(game.snap, 'nuclearComplex', game.map)).toBe(0);
    // All four Gulf bases operational → perfect basing score.
    expect(axisScore(game.snap, 'gulfBasing', game.map)).toBe(100);
  });

  it('react to the world state they measure', () => {
    const game = new Game();
    game.start('campaign', 'usa', 3131);
    // Nuclear complex destroyed → coalition maxes that axis.
    for (const id of ['isfahan', 'natanz', 'fordow']) game.snap.nodes[id]!.integrity = 0;
    expect(axisScore(game.snap, 'nuclearComplex', game.map)).toBe(100);
    // Tehran in ruins + decapitated → regime axis collapses.
    game.snap.nodes.tehran!.integrity = 0;
    game.snap.meters.leadershipStrikes = 4;
    expect(axisScore(game.snap, 'regime', game.map)).toBe(0);
    // Sustained strangle: 5 turns above 50 and 40 current disruption → 40 + 20 = 60.
    game.snap.meters.hormuzTurnsAbove50 = 5;
    game.snap.meters.hormuz = 40;
    expect(axisScore(game.snap, 'hormuz', game.map)).toBe(60);
  });

  it('falls back to zero for unknown axes', () => {
    const game = new Game();
    game.start('campaign', 'usa', 3131);
    expect(axisScore(game.snap, 'mystery', game.map)).toBe(0);
  });
});

describe('verdict tiers', () => {
  it('map margins to graded verdicts', () => {
    expect(verdictFor(35)).toBe('decisive-iran');
    expect(verdictFor(12)).toBe('clear-iran');
    expect(verdictFor(3)).toBe('narrow-iran');
    expect(verdictFor(0)).toBe('stalemate');
    expect(verdictFor(-3)).toBe('narrow-coalition');
    expect(verdictFor(-15)).toBe('clear-coalition');
    expect(verdictFor(-40)).toBe('decisive-coalition');
  });
});

describe('buildScorecard', () => {
  it('normalizes each side to its own weight sum', () => {
    const game = new Game();
    game.start('campaign', 'usa', 3131);
    const card = buildScorecard(game.snap, game.map);
    // Fresh campaign: perfect regime (iran), perfect basing + congress 60 (coalition).
    expect(card.iranTotal).toBeGreaterThan(0);
    expect(card.coalitionTotal).toBeGreaterThan(0);
    expect(card.axes).toHaveLength(6);
    expect(card.axes.reduce((sum, a) => sum + a.weight, 0)).toBe(100);
  });

  it('is deterministic and stored exactly once at the terminal turn', () => {
    const run = (): { snapJson: string; cardJson: string } => {
      const game = new Game();
      game.start('campaign', 'iran', 4242);
      // Push to the final turn without ending early.
      let guard = 0;
      while (game.snap.status === 'playing' && game.snap.turn < game.snap.maxTurns && guard < 40) {
        game.endTurn();
        guard++;
      }
      if (game.snap.status === 'playing') game.endTurn(); // final-turn resolution
      return { snapJson: JSON.stringify(game.snap), cardJson: JSON.stringify(game.snap.scorecard) };
    };
    const a = run();
    const b = run();
    expect(a.cardJson).toBe(b.cardJson);
    expect(a.snapJson).toBe(b.snapJson);
    expect(a.cardJson).not.toBe('undefined');
  });

  it('keeps the tutorial scripted ending free of a scorecard', () => {
    const game = new Game();
    game.start('tutorial', 'usa', 3131);
    let guard = 0;
    while (game.snap.status === 'playing' && guard < 8) {
      game.endTurn();
      guard++;
    }
    expect(game.snap.status).not.toBe('playing');
    expect(game.snap.scorecard).toBeUndefined();
  });
});
