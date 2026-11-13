import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { unitType } from '../core/world';
import { clearMines, hexKey, isSeaHex, layMines, minefields } from '../core/maritime';
import { sheetActions } from './actions';

function gameAs(faction: 'usa' | 'iran', seed = 8): Game {
  const game = new Game();
  game.start('campaign', faction, seed);
  game.snap.warStarted = true;
  game.snap.phase = 'war';
  return game;
}

describe('unit action sheet', () => {
  it('offers mine warfare and maritime orders to the units that can take them', () => {
    const miner = sheetActions(unitType('mine_layer'));
    expect(miner).toContain('mode:mine');
    expect(miner).toContain('mode:clear');
    expect(miner).toContain('escort-order');

    const carrier = sheetActions(unitType('csg'));
    expect(carrier).toContain('mode:clear');
    expect(carrier).toContain('escort-order');
    expect(carrier).not.toContain('mode:mine');

    // A strike aircraft and a launcher get neither maritime order.
    for (const id of ['f35a', 'fateh110']) {
      const actions = sheetActions(unitType(id));
      expect(actions).not.toContain('mode:mine');
      expect(actions).not.toContain('mode:clear');
      expect(actions).not.toContain('escort-order');
    }
  });

  it('keeps the existing movement, strike and utility actions', () => {
    const air = sheetActions(unitType('f35a'));
    expect(air).toContain('mode:move');
    expect(air).toContain('mode:strike');
    expect(air).toContain('hold');
    expect(air).toContain('clear-selection');
  });

  it('queues the orders the sheet exposes: lay mines, clear mines, escort', () => {
    const iran = gameAs('iran');
    const miner = iran.snap.units.find((u) => u.typeId === 'mine_layer')!;
    const sea = iran.map.nodeHexOf('hormuz')!;
    expect(isSeaHex(iran.map, sea.col, sea.row)).toBe(true);
    miner.col = sea.col;
    miner.row = sea.row;
    iran.snap.iran.mines = 6;

    expect(iran.queueOrder({ kind: 'mine', unitUid: miner.uid, col: sea.col, row: sea.row, count: 2 }).ok).toBe(true);

    const usa = gameAs('usa');
    const ship = usa.snap.units.find((u) => unitType(u.typeId).category === 'naval')!;
    expect(usa.queueOrder({ kind: 'escort', unitUid: ship.uid }).ok).toBe(true);
    // One mission per unit per turn: release the ship before clearing.
    expect(usa.queueOrder({ kind: 'escort', unitUid: ship.uid }).ok).toBe(false);
    usa.snap.orders = [];

    // Clearance needs a located field in that hex.
    const fieldHex = usa.map.nodeHexOf('hormuz')!;
    layMines(usa.snap, usa.map, fieldHex.col, fieldHex.row, 2);
    // Located, as it would be once a coalition warship has found it.
    minefields(usa.snap)[hexKey(fieldHex.col, fieldHex.row)]!.detected = true;
    expect(usa.queueOrder({ kind: 'clear', unitUid: ship.uid, col: fieldHex.col, row: fieldHex.row }).ok).toBe(true);

    clearMines(usa.snap, fieldHex.col, fieldHex.row, 1);
    expect(minefields(usa.snap)[hexKey(fieldHex.col, fieldHex.row)]?.mines).toBe(1);
  });
});
