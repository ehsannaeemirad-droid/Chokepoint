import { describe, expect, it } from 'vitest';
import { Game } from './Game';
import {
  INTEL_DECAY_TURNS,
  informationState,
  reconQuality,
  updateIntelligence,
} from './intel';
import { bandLabel, unitStrengthEstimate } from '../ui/fog';

function usaGame(seed = 21): Game {
  const game = new Game();
  game.start('campaign', 'usa', seed);
  return game;
}

function iranianNear(game: Game, col: number, row: number) {
  const unit = game.snap.units.find((u) => u.faction === 'iran')!;
  unit.col = col;
  unit.row = row;
  return unit;
}

describe('reconnaissance coverage', () => {
  it('reads ISR and humint ranges from real platforms', () => {
    const game = usaGame();
    const target = { col: 40, row: 20 };
    const mq9 = game.snap.units.find((u) => u.typeId === 'mq9')!;
    mq9.col = target.col + 5;
    mq9.row = target.row;
    expect(reconQuality(game.snap, 'usa', target.col, target.row)).toBe('isr');
    mq9.col = target.col + 13;
    expect(reconQuality(game.snap, 'usa', target.col, target.row)).toBe('none');

    const sof = game.snap.units.find((u) => u.typeId === 'sof');
    if (sof) {
      sof.col = target.col + 2;
      sof.row = target.row;
      expect(reconQuality(game.snap, 'usa', target.col, target.row)).toBe('humint');
    }
  });

  it('reveals an enemy under coverage and stamps the sighting turn', () => {
    const game = usaGame();
    const enemy = iranianNear(game, 30, 18);
    enemy.revealed = false;
    enemy.lastSeen = undefined;
    const mq9 = game.snap.units.find((u) => u.typeId === 'mq9')!;
    mq9.col = 30;
    mq9.row = 18;

    updateIntelligence(game.snap);
    expect(enemy.revealed).toBe(true);
    expect(enemy.lastSeen).toBe(game.snap.turn);
    // ISR identifies; only humint or fresh eyes count as tracked.
    expect(informationState(game.snap, 'usa', enemy)).toBe('identified');
  });

  it('loses identity after several turns without coverage', () => {
    const game = usaGame();
    const enemy = iranianNear(game, 30, 18);
    enemy.revealed = true;
    enemy.lastSeen = game.snap.turn;
    for (const u of game.snap.units) {
      if (u.typeId === 'mq9' || u.typeId === 'sof') {
        u.col = 0;
        u.row = 0;
      }
    }
    game.snap.turn += INTEL_DECAY_TURNS + 1;
    updateIntelligence(game.snap);
    expect(enemy.revealed).toBe(false);
    expect(informationState(game.snap, 'usa', enemy)).toBe('unknown');
  });

  it('does not invent an estimate for a unit it never located', () => {
    const game = usaGame();
    const enemy = iranianNear(game, 45, 25);
    enemy.revealed = false;
    const mq9 = game.snap.units.find((u) => u.typeId === 'mq9')!;
    mq9.col = 0;
    mq9.row = 0;
    expect(unitStrengthEstimate(game.snap, enemy)).toBeNull();
  });

  it('narrows the strength band when reconnaissance is on station', () => {
    const game = usaGame();
    const enemy = iranianNear(game, 32, 20);
    enemy.revealed = true;
    enemy.lastSeen = game.snap.turn;
    enemy.strength = 80;
    const mq9 = game.snap.units.find((u) => u.typeId === 'mq9')!;
    mq9.col = 32;
    mq9.row = 20;
    const near = unitStrengthEstimate(game.snap, enemy)!;
    expect(near.quality).toBe('isr');
    const nearWidth = near.hi - near.lo;

    mq9.col = 0;
    mq9.row = 0;
    const far = unitStrengthEstimate(game.snap, enemy)!;
    expect(far.quality).toBe('none');
    expect(far.hi - far.lo).toBeGreaterThan(nearWidth);
    expect(far.lo).toBeLessThanOrEqual(80);
    expect(far.hi).toBeGreaterThanOrEqual(80);
    expect(bandLabel(far)).toContain('–');
  });
});
