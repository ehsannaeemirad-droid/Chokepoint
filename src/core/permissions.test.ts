import { describe, expect, it } from 'vitest';
import { Game } from './Game';
import { resolveStrike } from '../combat/combat';
import { canPlayerOrder } from './permissions';
import { emptyReservations } from './engine';

describe('engine-level order authorisation', () => {
  it('rejects a US player tasking Israeli cyber (the audit bug)', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4);
    const cyber = game.snap.units.find((u) => u.faction === 'israel' && u.typeId === 'unit8200')!;
    expect(cyber).toBeTruthy();
    const check = canPlayerOrder(game.snap, game.map, {
      kind: 'cyber',
      unitUid: cyber.uid,
      col: cyber.col,
      row: cyber.row,
    });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.code).toBe('not-your-unit');
    const queued = game.queueOrder({ kind: 'cyber', unitUid: cyber.uid, col: cyber.col, row: cyber.row });
    expect(queued.ok).toBe(false);
  });

  it('rejects an Israeli player tasking a US aircraft', () => {
    const game = new Game();
    game.start('campaign', 'israel', 4);
    const f15 = game.snap.units.find((u) => u.faction === 'usa' && u.typeId === 'f15e')!;
    const check = canPlayerOrder(game.snap, game.map, {
      kind: 'strike',
      unitUid: f15.uid,
      col: f15.col,
      row: f15.row,
    });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.code).toBe('not-your-unit');
  });

  it('rejects production and strike orders from the wrong faction', () => {
    const usa = new Game();
    usa.start('campaign', 'usa', 4);
    expect(usa.queueOrder({ kind: 'produce', unitTypeId: 'fateh110', count: 1 }).ok).toBe(false);

    const iran = new Game();
    iran.start('campaign', 'iran', 4);
    const cyber = iran.snap.units.find((u) => u.typeId === 'unit8200')!;
    expect(cyber.faction).toBe('israel');
    expect(iran.queueOrder({ kind: 'cyber', unitUid: cyber.uid, col: cyber.col, row: cyber.row }).ok).toBe(false);
  });

  it('rejects cyber when no launcher has been geolocated', () => {
    const game = new Game();
    game.start('campaign', 'israel', 4);
    for (const unit of game.snap.units) unit.revealed = false;
    const cyber = game.snap.units.find((u) => u.typeId === 'unit8200')!;
    const check = canPlayerOrder(game.snap, game.map, {
      kind: 'cyber',
      unitUid: cyber.uid,
      col: cyber.col,
      row: cyber.row,
    });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.code).toBe('target-ineligible');
  });

  it('accepts a valid cyber order and charges political will through the queue', () => {
    const game = new Game();
    game.start('campaign', 'israel', 4);
    const launcher = game.snap.units.find((u) => u.faction === 'iran' && u.typeId === 'fateh110')!;
    launcher.revealed = true;
    const cyber = game.snap.units.find((u) => u.typeId === 'unit8200')!;
    game.snap.resources.politicalWill = 1;
    const poor = game.queueOrder({ kind: 'cyber', unitUid: cyber.uid, col: cyber.col, row: cyber.row });
    expect(poor.ok).toBe(false);

    game.snap.resources.politicalWill = 10;
    const ok = game.queueOrder({ kind: 'cyber', unitUid: cyber.uid, col: cyber.col, row: cyber.row });
    expect(ok.ok).toBe(true);
    expect(emptyReservations().politicalWill).toBe(0);
  });

  it('rejects a unit that is already tasked and an ineligible strike platform', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4);
    game.snap.warStarted = true;
    game.snap.phase = 'war';
    const f15 = game.snap.units.find((u) => u.faction === 'usa' && u.typeId === 'f15e')!;
    const natanz = game.map.nodeHexOf('natanz')!;
    const first = game.queueOrder({ kind: 'strike', unitUid: f15.uid, col: natanz.col, row: natanz.row, nodeId: 'natanz' });
    expect(first.ok).toBe(true);
    const again = game.queueOrder({ kind: 'strike', unitUid: f15.uid, col: natanz.col, row: natanz.row, nodeId: 'natanz' });
    expect(again.ok).toBe(false);
    expect(again.reason).toMatch(/already been tasked/i);

    const patriot = game.snap.units.find((u) => u.faction === 'usa' && u.typeId === 'patriot')!;
    const bad = game.queueOrder({ kind: 'strike', unitUid: patriot.uid, col: patriot.col, row: patriot.row });
    expect(bad.ok).toBe(false);
    expect(bad.reason).toMatch(/cannot conduct strikes/i);
  });

  it('keeps the engine, not the UI, as the enforcement point for resolveStrike callers', () => {
    const game = new Game();
    game.start('campaign', 'usa', 4);
    const f15 = game.snap.units.find((u) => u.faction === 'usa' && u.typeId === 'f15e')!;
    const natanz = game.map.nodeHexOf('natanz')!;
    const result = resolveStrike(game.snap, game.map, f15, natanz.col, natanz.row, 'natanz', () => 0.99);
    expect(result.events.length).toBeGreaterThan(0);
  });
});
