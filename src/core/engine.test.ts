import { describe, expect, it } from 'vitest';
import { hexDistance } from '../map/hex';
import { runTurn } from './engine';
import { Game } from './Game';
import { unitType } from './world';
import { BALANCE } from './config';

describe('campaign engine', () => {
  it('sets up a campaign with real force posture', () => {
    const game = new Game();
    game.start('campaign', 'usa', 12345);
    expect(game.snap.turn).toBe(1);
    expect(game.snap.units.length).toBeGreaterThan(30);
    expect(game.map.nodes.length).toBeGreaterThan(30);
    expect(game.snap.nodes.natanz.integrity).toBe(100);
    // The pre-war posture holds part of each magazine in reserve; the total is
    // still the scenario baseline, so assert both the split and the sum.
    expect(game.snap.resources.interceptorsUSA).toBe(Math.round(BALANCE.interceptorsUSAStart * 0.7));
    expect(game.snap.resources.interceptorsIsrael).toBe(Math.round(BALANCE.interceptorsIsraelStart * 0.7));
    expect(
      game.snap.resources.interceptorsUSA + (game.snap.resources.interceptorsUSAReserve ?? 0),
    ).toBe(BALANCE.interceptorsUSAStart);
    expect(
      game.snap.resources.interceptorsIsrael + (game.snap.resources.interceptorsIsraelReserve ?? 0),
    ).toBe(BALANCE.interceptorsIsraelStart);
  });

  it('rejects an out-of-range strike and accepts a valid one', () => {
    const game = new Game();
    game.start('campaign', 'usa', 999);
    const f15 = game.snap.units.find((u) => u.typeId === 'f15e')!;
    const far = game.queueOrder({ kind: 'strike', unitUid: f15.uid, col: 0, row: 0 });
    expect(far.ok).toBe(false);

    const natanz = game.map.nodeHexOf('natanz')!;
    const valid = game.queueOrder({
      kind: 'strike',
      unitUid: f15.uid,
      col: natanz.col,
      row: natanz.row,
      nodeId: 'natanz',
    });
    expect(valid.ok).toBe(true);
  });

  it('resolves turns deterministically for the same seed and orders', () => {
    const run = () => {
      const game = new Game();
      game.start('campaign', 'israel', 4242);
      const f15i = game.snap.units.find((u) => u.typeId === 'f15i')!;
      const natanz = game.map.nodeHexOf('natanz')!;
      game.queueOrder({
        kind: 'strike',
        unitUid: f15i.uid,
        col: natanz.col,
        row: natanz.row,
        nodeId: 'natanz',
      });
      for (let i = 0; i < 3; i++) runTurn(game.snap, game.map);
      return game.snap;
    };
    const a = run();
    const b = run();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('recalculates Hormuz disruption from surviving launchers', () => {
    const game = new Game();
    game.start('campaign', 'iran', 20260101);
    runTurn(game.snap, game.map);
    expect(game.snap.meters.hormuz).toBeGreaterThan(0);
    expect(game.snap.meters.oilPrice).toBeGreaterThan(50);
  });

  it('lets coalition strike aircraft reach every hardened nuclear site', () => {
    const game = new Game();
    game.start('campaign', 'usa', 5);
    const udeid = game.map.estimateHex(51.31, 25.11);
    const hatzerim = game.map.estimateHex(34.66, 31.23);
    for (const id of ['natanz', 'fordow', 'isfahan']) {
      const target = game.map.nodeHexOf(id)!;
      const fromGulf = hexDistance(udeid, target);
      const fromIsrael = hexDistance(hatzerim, target);
      expect(fromGulf).toBeLessThanOrEqual(unitType('f15e').rng);
      expect(fromIsrael).toBeLessThanOrEqual(unitType('f15i').rng);
    }
  });

  it('advances the turn counter and logs AI decisions', () => {
    const game = new Game();
    game.start('campaign', 'usa', 31337);
    game.endTurn();
    expect(game.snap.turn).toBe(2);
    expect(game.snap.log.length).toBeGreaterThan(2);
  });
});

describe('order counts', () => {
  it('treats a missing sortie count as one instead of producing NaN', async () => {
    const { orderReservations, sortieCount } = await import('./engine');
    expect(sortieCount({})).toBe(1);
    expect(sortieCount({ count: undefined })).toBe(1);
    expect(sortieCount({ count: Number.NaN })).toBe(1);
    expect(sortieCount({ count: 0 })).toBe(1);
    // Rounded down, then capped at the mine-sortie maximum (3).
    expect(sortieCount({ count: 4.7 })).toBe(3);

    const game = new Game();
    game.start('campaign', 'iran', 4242);
    const miner = game.snap.units.find((u) => u.typeId === 'mine_layer')!;
    game.snap.orders = [
      {
        kind: 'mine',
        unitUid: miner.uid,
        col: miner.col,
        row: miner.row,
        count: undefined as unknown as number,
      },
    ];
    const reserved = orderReservations(game.snap);
    expect(Number.isFinite(reserved.mines)).toBe(true);
    expect(reserved.mines).toBe(1);
  });
});
