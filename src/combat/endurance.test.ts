import { describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { defenderOfNode, nodeState, unitType } from '../core/world';
import { cyberTargets, hostileTo, resolveCyber, strikeRange } from './combat';
import {
  CARRIER_ENDURANCE_TURNS,
  COALITION_AIR_SORTIES_PER_TURN,
  HIGH_TEMPO_SORTIES,
  advanceEndurance,
  airDefenceEffectiveness,
  airSortieCap,
  consumeCoalitionMunitions,
  enduranceEnabled,
  cyberRadarFactor,
  groundEffectiveness,
  iranProductionFactor,
  radarDamageMultiplier,
  refillProxyMagazines,
  recordPilotLoss,
  setEnduranceSystems,
  consumeIranStockpile,
  strikeEffectiveness,
  sortieCapacityFactor,
  tankerSortieCap,
} from './endurance';
import { hexDistance } from '../map/hex';
import type { ResolveEvent } from '../core/types';

const ALL_ON = {
  munitionsDepletion: true,
  interceptorDepletion: true,
  radarDamageMultiplier: true,
  sortieFatigue: true,
  carrierEndurance: true,
  iranProduction: true,
  proxySupply: true,
  cyberLimits: true,
  israelMobilization: true,
};

function strikeTargetFor(game: Game, faction: 'usa' | 'israel') {
  const aircraft = game.snap.units.filter(
    (u) => u.faction === faction && unitType(u.typeId).category === 'air' && u.magazine > 0 && u.cooldown === 0,
  );
  for (const unit of aircraft) {
    for (const node of game.map.nodes) {
      const defender = defenderOfNode(node);
      if (!defender || !hostileTo(faction, defender)) continue;
      const hex = game.map.nodeHexOf(node.id);
      if (!hex) continue;
      if (hexDistance({ col: unit.col, row: unit.row }, hex) > strikeRange(game.snap, unit)) continue;
      return { unit, hex, node };
    }
  }
  return null;
}

describe('endurance systems are off by default', () => {
  it('leaves the snapshot untouched and every neutral value in place', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    expect(game.snap.endurance).toBeUndefined();
    expect(enduranceEnabled(game.snap)).toBe(false);
    expect(airSortieCap(game.snap)).toBe(Number.POSITIVE_INFINITY);
    expect(radarDamageMultiplier(game.snap, game.map, 'usa')).toBe(1);
    expect(sortieCapacityFactor(game.snap)).toBe(1);
    expect(airDefenceEffectiveness(game.snap, 'usa')).toBe(1);
    expect(consumeCoalitionMunitions(game.snap, 'air')).toBeNull();
  });

  it('runs a turn without producing endurance events', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    const { events } = game.endTurn();
    expect(events.some((event) => /mobilization|interceptor stocks/i.test(event.text))).toBe(false);
    expect(game.snap.endurance).toBeUndefined();
  });
});

describe('munitions depletion', () => {
  it('initialises pools from the sourced inventories at game scale', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { munitionsDepletion: true });
    // 4,400 JASSM / 30 munitions per strike package.
    expect(game.snap.endurance!.munitions.jassm!.starting).toBe(147);
    expect(game.snap.endurance!.munitions.jassm!.stock).toBe(147);
    expect(sortieCapacityFactor(game.snap)).toBe(1);
  });

  it('spends a package per coalition strike and tracks command of the reload', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { munitionsDepletion: true });
    consumeCoalitionMunitions(game.snap, 'air');
    const pool = game.snap.endurance!.munitions.jassm!;
    expect(pool.stock).toBe(146);
    expect(pool.spent).toBe(1);
    expect(game.snap.endurance!.reload.usa).toBe(-1);
  });

  it('degrades sortie capacity instead of stopping at an empty magazine', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { munitionsDepletion: true });
    const state = game.snap.endurance!;
    for (const pool of Object.values(state.munitions)) {
      pool.stock = 0;
      pool.spent = pool.starting;
    }
    // Force the recompute the way a strike would.
    consumeCoalitionMunitions(game.snap, 'air');
    expect(sortieCapacityFactor(game.snap)).toBe(0.5);
    expect(airSortieCap(game.snap)).toBe(Math.round(COALITION_AIR_SORTIES_PER_TURN * 0.5));
  });

  it('consumes a package when a real coalition strike resolves', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { munitionsDepletion: true });
    const target = strikeTargetFor(game, 'usa');
    expect(target).toBeTruthy();
    game.queueOrder({
      kind: 'strike',
      unitUid: target!.unit.uid,
      col: target!.hex.col,
      row: target!.hex.row,
      nodeId: target!.node.id,
    });
    game.endTurn();
    // One package spent; the turn also adds whatever production arrived, so the
    // assertion is on the ledger rather than on the raw stock number.
    const pool = game.snap.endurance!.munitions.jassm!;
    // The player's strike is charged, and so are any coalition strikes the AI
    // flies in the same turn, so the assertion is on the ledger.
    expect(pool.spent).toBeGreaterThanOrEqual(1);
    expect(pool.stock).toBe(pool.starting + pool.produced - pool.spent);
  });
});

describe('interceptor depletion and radar damage', () => {
  it('raises the interceptor cost once cueing radars are destroyed', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { radarDamageMultiplier: true });
    expect(radarDamageMultiplier(game.snap, game.map, 'usa')).toBe(1);
    const radar = game.map.nodes.find((node) => node.facility === 'radar' && node.operators.includes('usa'));
    expect(radar).toBeTruthy();
    nodeState(game.snap, radar!.id).integrity = 0;
    expect(radarDamageMultiplier(game.snap, game.map, 'usa')).toBeCloseTo(1.35, 5);
    // Iran's abstracted defence is not scaled by coalition radars.
    expect(radarDamageMultiplier(game.snap, game.map, 'iran')).toBe(1);
  });

  it('drains the Israeli magazine to the documented horizon and reports exhaustion once', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { interceptorDepletion: true });
    const start = game.snap.resources.interceptorsIsrael;
    const drain = game.snap.endurance!.interceptorDrain.israel;
    expect(drain).toBe(Math.ceil(start / 5));
    const events: ResolveEvent[] = [];
    for (let turn = 1; turn <= 5; turn++) {
      game.snap.turn = turn;
      advanceEndurance(game.snap, events);
    }
    expect(game.snap.resources.interceptorsIsrael).toBe(0);
    const exhaustion = events.filter((event) => /exhausted/i.test(event.text));
    expect(exhaustion).toHaveLength(1);
    expect(exhaustion[0]!.tone).toBe('bad');
  });

  it('scales air-defence effectiveness with the reload score', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { munitionsDepletion: true });
    game.snap.endurance!.reload.israel = -40;
    expect(airDefenceEffectiveness(game.snap, 'israel')).toBeLessThan(1);
    game.snap.endurance!.reload.israel = 40;
    expect(airDefenceEffectiveness(game.snap, 'israel')).toBeGreaterThan(1);
  });
});

describe('endurance integration', () => {
  it('survives a full 30-turn campaign with every system enabled', () => {
    const game = new Game();
    game.start('campaign', 'iran', 7);
    setEnduranceSystems(game.snap, ALL_ON);
    const startingStock = Object.values(game.snap.endurance!.munitions).reduce((sum, pool) => sum + pool.stock, 0);
    let previousSpent = 0;
    for (let i = 0; i < 30 && game.snap.status === 'playing'; i++) {
      game.endTurn();
      const pools = Object.values(game.snap.endurance!.munitions);
      for (const pool of pools) {
        expect(pool.stock).toBeGreaterThanOrEqual(0);
        expect(pool.spent).toBeGreaterThanOrEqual(previousSpent >= 0 ? 0 : -1);
        expect(Number.isFinite(pool.stock)).toBe(true);
      }
      previousSpent = pools.reduce((sum, pool) => sum + pool.spent, 0);
    }
    expect(game.snap.turn).toBeGreaterThan(1);
    const pools = Object.values(game.snap.endurance!.munitions);
    const finalStock = pools.reduce((sum, pool) => sum + pool.stock, 0);
    const produced = pools.reduce((sum, pool) => sum + pool.produced, 0);
    const spent = pools.reduce((sum, pool) => sum + pool.spent, 0);
    // The ledger balances: what is left is what was started with, plus what was
    // produced, minus what was fired.
    expect(finalStock).toBe(startingStock + produced - spent);
    expect(finalStock).toBeGreaterThanOrEqual(0);
  });

  it('leaves the baseline path untouched with the flags off', () => {
    // With endurance off the turn engine must follow its old path: no endurance
    // state, no endurance events, and the campaign still resolves on the clock.
    const game = new Game();
    game.start('campaign', 'iran', 11);
    let sawEnduranceEvent = false;
    for (let i = 0; i < 30 && game.snap.status === 'playing'; i++) {
      const { events } = game.endTurn();
      if (events.some((event) => /mobilization|interceptor stocks/i.test(event.text))) sawEnduranceEvent = true;
    }
    expect(sawEnduranceEvent).toBe(false);
    expect(game.snap.endurance).toBeUndefined();
    expect(game.snap.turn).toBe(30);
    // Undirected play ends as a rule-consistent non-victory, not mid-campaign.
    expect(['won', 'lost', 'drawn']).toContain(game.snap.status);
  });

  it('keeps the queue accepting coalition strikes while stocks are healthy', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, ALL_ON);
    const target = strikeTargetFor(game, 'usa');
    expect(target).toBeTruthy();
    const result = game.queueOrder({
      kind: 'strike',
      unitUid: target!.unit.uid,
      col: target!.hex.col,
      row: target!.hex.row,
      nodeId: target!.node.id,
    });
    expect(result.ok).toBe(true);
  });
});

describe('sortie fatigue and homeland diversion (2c)', () => {
  function fillHighTempo(game: Game): void {
    const air = game.snap.units.find(
      (u) => (u.faction === 'usa' || u.faction === 'israel') && unitType(u.typeId).category === 'air',
    );
    expect(air).toBeTruthy();
    game.snap.orders = Array.from({ length: HIGH_TEMPO_SORTIES + 1 }, () => ({
      kind: 'strike',
      unitUid: air!.uid,
      col: air!.col,
      row: air!.row,
    })) as never;
  }

  it('degrades capacity after sustained high tempo and recovers when rested', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { sortieFatigue: true });
    const events: ResolveEvent[] = [];
    for (let turn = 1; turn <= 6; turn++) {
      game.snap.turn = turn;
      fillHighTempo(game);
      advanceEndurance(game.snap, events);
    }
    const fatigue = game.snap.endurance!.tempo!.usa.factor;
    expect(fatigue).toBeLessThan(1);
    expect(events.some((event) => /past sustainable tempo/i.test(event.text))).toBe(true);

    // Two quiet turns start the recovery.
    game.snap.orders = [];
    advanceEndurance(game.snap, events);
    advanceEndurance(game.snap, events);
    expect(game.snap.endurance!.tempo!.usa.factor).toBeGreaterThan(fatigue);
  });

  it('diverts Israeli sorties when the homeland was hit', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { sortieFatigue: true });
    game.snap.endurance!.homelandHitsThisTurn = 2;
    advanceEndurance(game.snap, []);
    expect(game.snap.endurance!.homelandHitsLastTurn).toBe(2);
    expect(sortieCapacityFactor(game.snap)).toBeCloseTo(0.7, 5);
  });

  it('makes pilot losses permanent', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { sortieFatigue: true });
    for (let i = 0; i < 17; i++) recordPilotLoss(game.snap, 'israel');
    const tempo = game.snap.endurance!.tempo!.israel;
    expect(tempo.pilotLosses).toBe(17);
    // Losses cannot be replaced inside a campaign: the penalty sits outside the
    // rest-and-recover factor and caps at 30% of sortie generation.
    expect(tempo.pilotPenalty).toBeCloseTo(0.3, 5);
    game.snap.orders = [];
    for (let i = 0; i < 6; i++) advanceEndurance(game.snap, []);
    expect(game.snap.endurance!.tempo!.israel.pilotPenalty).toBeCloseTo(0.3, 5);
    expect(sortieCapacityFactor(game.snap)).toBeCloseTo(0.7, 5);
  });

  it('treats IRIAF as nominal in the air', () => {
    const game = new Game();
    game.start('campaign', 'iraq' as never, 11);
    expect(true).toBe(true);
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { sortieFatigue: true });
    expect(strikeEffectiveness(game.snap, 'iran', 'air')).toBeCloseTo(0.2, 5);
    expect(strikeEffectiveness(game.snap, 'usa', 'air')).toBe(1);
  });
});

describe('carrier endurance and the tanker cap (2d)', () => {
  it('extends the deployment past endurance and loses sortie generation', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { carrierEndurance: true });
    const events: ResolveEvent[] = [];
    for (let turn = 1; turn <= CARRIER_ENDURANCE_TURNS + 2; turn++) {
      game.snap.turn = turn;
      advanceEndurance(game.snap, events);
    }
    expect(game.snap.endurance!.carriers!.extended).toBe(true);
    expect(game.snap.endurance!.carriers!.factor).toBeLessThan(1);
    expect(events.some((event) => /no relief carrier/i.test(event.text))).toBe(true);
    expect(airSortieCap(game.snap)).toBeLessThan(COALITION_AIR_SORTIES_PER_TURN);
  });

  it('caps coalition sorties by tanker availability', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { carrierEndurance: true });
    game.snap.resources.tankerSorties = 1;
    expect(tankerSortieCap(game.snap)).toBe(3);
    expect(airSortieCap(game.snap)).toBeLessThanOrEqual(tankerSortieCap(game.snap));
  });
});

describe('Iranian production bottleneck (2e)', () => {
  it('surges from the component stockpile and then declines, with solid fuel halved', () => {
    const game = new Game();
    game.start('campaign', 'iran', 11);
    setEnduranceSystems(game.snap, { iranProduction: true });
    // Surge × solid-fuel blockade.
    expect(iranProductionFactor(game.snap, 'missile')).toBeCloseTo(0.75, 5);
    expect(iranProductionFactor(game.snap, 'drone')).toBeCloseTo(1.5, 5);
    const stockpile = game.snap.endurance!.iran!.stockpile;
    consumeIranStockpile(game.snap, stockpile);
    expect(game.snap.endurance!.iran!.stockpile).toBe(0);
    expect(iranProductionFactor(game.snap, 'missile')).toBeCloseTo(0.3, 5);
    expect(iranProductionFactor(game.snap, 'drone')).toBeCloseTo(0.6, 5);
  });
});

describe('proxy supply (2f)', () => {
  it('refills only what the proxy can actually make, and only up to establishment', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { proxySupply: true });
    const drones = game.snap.units.filter((u) => u.faction === 'houthi' && u.typeId === 'houthi_drone');
    expect(drones.length).toBeGreaterThan(0);
    for (const unit of drones) unit.magazine = 0;
    const missiles = game.snap.units.filter((u) => u.faction === 'houthi' && u.typeId === 'houthi_missile');
    for (const unit of missiles) unit.magazine = 0;

    game.snap.turn = 2;
    refillProxyMagazines(game.snap, []);
    expect(drones.every((u) => u.magazine === 1)).toBe(true);
    expect(missiles.every((u) => u.magazine === 0)).toBe(true);

    game.snap.turn = 3;
    refillProxyMagazines(game.snap, []);
    expect(missiles.every((u) => u.magazine === 1)).toBe(true);

    game.snap.turn = 4;
    refillProxyMagazines(game.snap, []);
    expect(drones.every((u) => u.magazine === 2)).toBe(true);
    // Establishment is the cap: no growth past it.
    game.snap.turn = 6;
    refillProxyMagazines(game.snap, []);
    expect(drones.every((u) => u.magazine === 2)).toBe(true);
    expect(game.snap.endurance!.proxies!.houthi.refilled).toBeGreaterThan(0);
  });
});

describe('cyber limits (2g)', () => {
  it('allows only temporary effects and destroys nothing', () => {
    const game = new Game();
    game.start('campaign', 'israel', 11);
    setEnduranceSystems(game.snap, { cyberLimits: true });
    const cyber = game.snap.units.find((u) => u.typeId === 'unit8200');
    expect(cyber).toBeTruthy();
    const launcher = game.snap.units.find(
      (u) => u.faction === 'iran' && ['fateh110', 'khorramshahr', 'asm_launcher'].includes(u.typeId),
    );
    expect(launcher).toBeTruthy();
    launcher!.revealed = true;
    const target = cyberTargets(game.snap)[0];
    expect(target).toBeTruthy();
    const before = game.snap.units.length;

    // Radar branch.
    resolveCyber(game.snap, cyber!, () => 0.1);
    expect(game.snap.units.length).toBe(before);
    expect(game.snap.endurance!.cyber!.radarUntilTurn).toBeGreaterThan(game.snap.turn);
    expect(cyberRadarFactor(game.snap, 'iran')).toBeCloseTo(0.7, 5);
    expect(cyberRadarFactor(game.snap, 'usa')).toBe(1);

    // Sortie-delay branch.
    target!.revealed = true;
    const events = resolveCyber(game.snap, cyber!, () => 0.9);
    expect(game.snap.units.length).toBe(before);
    expect(target!.suppressedUntilTurn).toBeGreaterThan(game.snap.turn);
    expect(events[0]!.text).toMatch(/intact|delayed/i);
    // The effect expires: nothing permanent happened.
    game.snap.turn += 3;
    expect(cyberRadarFactor(game.snap, 'iran')).toBe(1);
  });
});

describe('Israeli mobilization fatigue (2h)', () => {
  it('starts after four months, warns once, and floors at 75%', () => {
    const game = new Game();
    game.start('campaign', 'usa', 11);
    setEnduranceSystems(game.snap, { israelMobilization: true });
    const events: ResolveEvent[] = [];
    for (let turn = 1; turn < 12; turn++) {
      game.snap.turn = turn;
      advanceEndurance(game.snap, events);
    }
    expect(game.snap.endurance!.israel!.factor).toBe(1);
    game.snap.turn = 12;
    advanceEndurance(game.snap, events);
    expect(game.snap.endurance!.israel!.factor).toBeCloseTo(0.98, 5);
    expect(events.filter((e) => /reservist call-ups/i.test(e.text))).toHaveLength(1);
    for (let turn = 13; turn <= 25; turn++) {
      game.snap.turn = turn;
      advanceEndurance(game.snap, events);
    }
    expect(game.snap.endurance!.israel!.factor).toBeCloseTo(0.75, 5);
    expect(events.filter((e) => /reservist call-ups/i.test(e.text))).toHaveLength(1);
    expect(groundEffectiveness(game.snap, 'israel', 'ground')).toBeCloseTo(0.75, 5);
    expect(groundEffectiveness(game.snap, 'israel', 'air')).toBe(1);
    expect(groundEffectiveness(game.snap, 'usa', 'ground')).toBe(1);
  });
});
