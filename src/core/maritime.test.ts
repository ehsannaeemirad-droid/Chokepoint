import { describe, expect, it } from 'vitest';
import { Game } from './Game';
import { applyOrder, validateOrder } from './engine';
import { calcHormuz } from '../politics/politics';
import {
  clearMines,
  detectMinefields,
  hexKey,
  isSeaHex,
  layMines,
  maritimeThreat,
  minefields,
} from './maritime';

function iranGame(seed = 8): Game {
  const game = new Game();
  game.start('campaign', 'iran', seed);
  game.snap.warStarted = true;
  game.snap.phase = 'war';
  return game;
}

function usaGame(seed = 8): Game {
  const game = new Game();
  game.start('campaign', 'usa', seed);
  game.snap.warStarted = true;
  game.snap.phase = 'war';
  return game;
}

function seaNearHormuz(game: Game) {
  const hex = game.map.nodeHexOf('hormuz')!;
  expect(isSeaHex(game.map, hex.col, hex.row)).toBe(true);
  return hex;
}

describe('mine warfare', () => {
  it('lays a per-hex field and consumes the mine stock', () => {
    const game = iranGame();
    const hex = seaNearHormuz(game);
    game.snap.iran.mines = 5;
    game.snap.iran.minesLaid = 0;
    const laid = layMines(game.snap, game.map, hex.col, hex.row, 3);
    expect(laid).toBe(3);
    expect(game.snap.iran.mines).toBe(2);
    expect(game.snap.iran.minesLaid).toBe(3);
    expect(minefields(game.snap)[hexKey(hex.col, hex.row)]?.mines).toBe(3);
  });

  it('rejects land, wrong units and an exhausted mine stock', () => {
    const game = iranGame();
    const miner = game.snap.units.find((u) => u.typeId === 'mine_layer')!;
    const sea = seaNearHormuz(game);
    miner.col = sea.col;
    miner.row = sea.row;
    expect(
      validateOrder(game.snap, game.map, { kind: 'mine', unitUid: miner.uid, col: sea.col, row: sea.row, count: 1 }).ok,
    ).toBe(true);

    const tehran = game.map.nodeHexOf('tehran')!;
    expect(
      validateOrder(game.snap, game.map, { kind: 'mine', unitUid: miner.uid, col: tehran.col, row: tehran.row, count: 1 }).ok,
    ).toBe(false);

    const fateh = game.snap.units.find((u) => u.typeId === 'fateh110')!;
    expect(
      validateOrder(game.snap, game.map, { kind: 'mine', unitUid: fateh.uid, col: sea.col, row: sea.row, count: 1 }).ok,
    ).toBe(false);

    game.snap.iran.mines = 0;
    expect(
      validateOrder(game.snap, game.map, { kind: 'mine', unitUid: miner.uid, col: sea.col, row: sea.row, count: 1 }).ok,
    ).toBe(false);
  });

  it('keeps a field unknown until a coalition warship locates it, then clears it', () => {
    const game = usaGame();
    const hex = seaNearHormuz(game);
    layMines(game.snap, game.map, hex.col, hex.row, 2);
    const key = hexKey(hex.col, hex.row);
    expect(minefields(game.snap)[key]!.detected).toBe(false);

    const csg = game.snap.units.find((u) => u.typeId === 'csg')!;
    csg.col = hex.col;
    csg.row = hex.row;
    const found = detectMinefields(game.snap, game.map);
    expect(found).toContain(key);
    expect(minefields(game.snap)[key]!.detected).toBe(true);

    expect(validateOrder(game.snap, game.map, { kind: 'clear', unitUid: csg.uid, col: hex.col, row: hex.row }).ok).toBe(true);
    const swept = clearMines(game.snap, hex.col, hex.row);
    expect(swept).toBe(2);
    expect(minefields(game.snap)[key]).toBeUndefined();
    expect(validateOrder(game.snap, game.map, { kind: 'clear', unitUid: csg.uid, col: hex.col, row: hex.row }).ok).toBe(false);
  });

  it('refuses clearance of an undetected field', () => {
    const game = usaGame();
    const hex = seaNearHormuz(game);
    layMines(game.snap, game.map, hex.col, hex.row, 2);
    const csg = game.snap.units.find((u) => u.typeId === 'csg')!;
    const check = validateOrder(game.snap, game.map, { kind: 'clear', unitUid: csg.uid, col: hex.col, row: hex.row });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toMatch(/not been located/i);
  });
});

describe('shipping risk and escort', () => {
  it('minefields near Hormuz raise the index and escorts lower it', () => {
    const game = usaGame();
    const hex = seaNearHormuz(game);
    const beforeThreat = maritimeThreat(game.snap, game.map);
    const beforeIndex = calcHormuz(game.snap, game.map);
    layMines(game.snap, game.map, hex.col, hex.row, 3);
    const minedThreat = maritimeThreat(game.snap, game.map);
    const minedIndex = calcHormuz(game.snap, game.map);
    expect(minedThreat).toBeGreaterThan(beforeThreat);
    expect(minedIndex).toBeGreaterThanOrEqual(beforeIndex);

    const csg = game.snap.units.find((u) => u.typeId === 'csg')!;
    const events: Parameters<typeof applyOrder>[4] = [];
    applyOrder(game.snap, game.map, { kind: 'escort', unitUid: csg.uid }, () => 0.5, events);
    expect(game.snap.escortCoverage).toBe(1);
    expect(events.some((e) => /escorting shipping/i.test(e.text))).toBe(true);
    expect(maritimeThreat(game.snap, game.map)).toBeLessThan(minedThreat);
  });

  it('Houthi launches consume their own magazine and never go negative', () => {
    const game = new Game();
    game.start('campaign', 'usa', 17);
    game.snap.warStarted = true;
    game.snap.phase = 'war';
    const magazines = () => game.snap.units.filter((u) => u.faction === 'houthi').map((u) => u.magazine);
    const before = magazines();
    for (let turn = 0; turn < 6 && game.snap.status === 'playing'; turn++) game.endTurn();
    const after = magazines();
    expect(after.every((m) => m >= 0)).toBe(true);
    expect(after.reduce((s, m) => s + m, 0)).toBeLessThanOrEqual(before.reduce((s, m) => s + m, 0));
  });

  it('caps escort coverage and tasks each ship once', () => {
    const game = usaGame();
    const csg = game.snap.units.find((u) => u.typeId === 'csg')!;
    expect(game.queueOrder({ kind: 'escort', unitUid: csg.uid }).ok).toBe(true);
    expect(game.queueOrder({ kind: 'escort', unitUid: csg.uid }).ok).toBe(false);
    game.snap.escortCoverage = 3;
    game.removeOrder(0);
    expect(game.queueOrder({ kind: 'escort', unitUid: csg.uid }).ok).toBe(false);
  });
});
