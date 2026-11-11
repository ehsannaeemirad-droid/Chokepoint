import { beforeEach, describe, expect, it } from 'vitest';
import { hostileTo, strikeRange, validateStrike } from '../combat/combat';
import { Game } from '../core/Game';
import { defenderOfNode, unitType } from '../core/world';
import { hexDistance } from '../map/hex';
import { faLog } from './log';

function store(): void {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
      removeItem: (k: string) => map.delete(k),
    },
    configurable: true,
    writable: true,
  });
}

function issueStrike(game: Game, faction: 'usa' | 'israel' | 'iran'): void {
  const targets = game.map.nodes.filter((node) => {
    const defender = defenderOfNode(node);
    return !!defender && hostileTo(faction, defender);
  });
  const aircraft = game.snap.units.filter(
    (u) => u.faction === faction && unitType(u.typeId).category === 'air' && u.magazine > 0 && u.cooldown === 0,
  );
  for (const unit of aircraft) {
    for (const target of targets) {
      const hex = game.map.nodeHexOf(target.id);
      if (!hex) continue;
      if (hexDistance({ col: unit.col, row: unit.row }, hex) > strikeRange(game.snap, unit)) continue;
      const check = validateStrike(game.snap, game.map, unit, hex.col, hex.row, target.id);
      if (!check.ok) continue;
      if (
        game.queueOrder({ kind: 'strike', unitUid: unit.uid, col: hex.col, row: hex.row, nodeId: target.id }).ok
      ) {
        return;
      }
    }
  }
}

/** Exercise the strategic orders that emit their own log lines. */
function issueStrategicOrders(game: Game, faction: 'usa' | 'israel' | 'iran'): void {
  if (faction === 'iran') {
    game.queueOrder({ kind: 'produce', unitTypeId: 'shahed136', count: 1 });
    const layer = game.snap.units.find((u) => u.typeId === 'mine_layer' && u.cooldown === 0);
    if (layer) {
      const sea = game.map.nodeHexOf('hormuz') ?? game.map.nodeHexOf('bandar_abbas');
      if (sea) game.queueOrder({ kind: 'mine', unitUid: layer.uid, col: sea.col, row: sea.row, count: 1 });
    }
    return;
  }
  if (game.snap.roe?.posture !== 'constrained') game.queueOrder({ kind: 'roe', posture: 'constrained' });
  if (game.snap.resources.tankerSorties > 0 && game.snap.resources.politicalWill >= 30) {
    game.queueOrder({ kind: 'airlift' });
  }
  if (faction === 'usa') {
    if ((game.snap.domestic?.cooldown ?? 1) === 0) game.queueOrder({ kind: 'communicate' });
    const host = Object.values(game.snap.hosts).find((h) => h.status !== 'closed');
    if (host) game.queueOrder({ kind: 'diplomacy', host: host.id as never });
    if (game.snap.ceasefire?.state === 'offered') game.queueOrder({ kind: 'talks', stance: 'pursue' });
    if (game.snap.resources.politicalWill >= 12 && game.snap.turn < 4) {
      game.queueOrder({ kind: 'reinforce', packageId: 'interceptors' });
    }
  }
}

function play(faction: 'usa' | 'israel' | 'iran', seed: number): string[] {
  const game = new Game();
  game.start('campaign', faction, seed);
  for (let turn = 0; turn < 30 && game.snap.status === 'playing'; turn++) {
    issueStrike(game, faction);
    issueStrategicOrders(game, faction);
    game.endTurn();
  }
  return game.snap.log.map((entry) => entry.text);
}

describe('Persian log coverage', () => {
  beforeEach(store);

  it('translates every line produced by full simulated campaigns', () => {
    const lines = new Set<string>();
    for (const faction of ['usa', 'israel', 'iran'] as const) {
      for (const seed of [11, 22, 33]) {
        for (const line of play(faction, seed)) lines.add(line);
      }
    }
    const unmatched = [...lines].filter((line) => faLog(line) === null).sort();
    console.log('UNMATCHED_COUNT', unmatched.length, 'TOTAL', lines.size);
    console.log('UNMATCHED_JSON', JSON.stringify(unmatched));
    expect(unmatched).toEqual([]);
  }, 180_000);
});
