/**
 * The turn pipeline:
 *   1. player orders resolve
 *   2. AI military phase (visible, deterministic)
 *   3. attrition, production, arrivals, politics
 *   4. victory/defeat check
 *
 * All randomness comes from a per-turn, per-faction seed so a campaign can be
 * replayed exactly from its decision log.
 */
import { runAiPhase, runHostPostures } from '../ai/ai';
import { resolveCyber, resolveSabotage, resolveStrike, validateStrike } from '../combat/combat';
import { hexDistance } from '../map/hex';
import type { TheaterMap } from '../map/TheaterMap';
import {
  addIranWarCost,
  checkOutcome,
  thirdPartyPhase,
  updateChokepoints,
  updateHosts,
} from '../politics/politics';
import { BALANCE } from './config';
import { factionRng } from './rng';
import type { GameSnapshot, Order, ResolveEvent, UnitInstance } from './types';
import {
  clamp,
  defenderOfNode,
  findUnit,
  nodeState,
  operationalGulfBases,
  unitsAt,
  unitType,
} from './world';

export interface ReinforcementPackage {
  id: string;
  label: string;
  note: string;
  cost: number;
  turns: number;
  kind: 'interceptors' | 'patriot' | 'thaad' | 'air' | 'csg';
  amount: number;
}

export const REINFORCEMENTS: ReinforcementPackage[] = [
  {
    id: 'interceptors',
    label: 'Airlift 20 interceptors',
    note: 'Replenishes the shared Patriot/THAAD magazine.',
    cost: 4,
    turns: 3,
    kind: 'interceptors',
    amount: 20,
  },
  {
    id: 'patriot',
    label: 'Patriot battery',
    note: 'A PAC-3 battery at Al Udeid.',
    cost: 6,
    turns: 4,
    kind: 'patriot',
    amount: 1,
  },
  {
    id: 'thaad',
    label: 'THAAD battery',
    note: 'Terminal ballistic defence at Al Dhafra.',
    cost: 8,
    turns: 6,
    kind: 'thaad',
    amount: 1,
  },
  {
    id: 'air',
    label: 'F-15E squadron',
    note: 'Twelve more strike aircraft and crews.',
    cost: 7,
    turns: 5,
    kind: 'air',
    amount: 1,
  },
  {
    id: 'csg',
    label: 'Second carrier strike group',
    note: 'A mobile airbase and another naval presence in the Gulf.',
    cost: 10,
    turns: 6,
    kind: 'csg',
    amount: 1,
  },
];

export const ISRAEL_AIRLIFT = {
  id: 'israel-airlift',
  label: 'US airlift to Israel (+15 interceptors)',
  note: 'Competes with US reinforcement airlift. Arrives in 2 turns.',
  cost: 2,
  turns: 2,
};

export interface OrderCheck {
  ok: boolean;
  reason?: string;
}

export function validateOrder(snap: GameSnapshot, map: TheaterMap, order: Order): OrderCheck {
  const isPlayer = (u: UnitInstance) => u.faction === snap.faction;

  switch (order.kind) {
    case 'hold':
      return { ok: true };
    case 'move': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit || !isPlayer(unit)) return { ok: false, reason: 'Select one of your units' };
      const def = unitType(unit.typeId);
      const dist = hexDistance({ col: unit.col, row: unit.row }, { col: order.col, row: order.row });
      if (dist > def.mov) return { ok: false, reason: `Too far: ${dist}/${def.mov} hexes` };
      const tile = map.hexAt(order.col, order.row);
      if (!tile) return { ok: false, reason: 'Off map' };
      if (def.category === 'naval' && !(tile.terrain === 'deep' || tile.terrain === 'coast')) {
        return { ok: false, reason: 'Naval units must stay at sea' };
      }
      if (def.category === 'ground' && (tile.terrain === 'deep' || tile.terrain === 'coast')) {
        return { ok: false, reason: 'Ground units cannot enter water' };
      }
      return { ok: true };
    }
    case 'strike': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit || !isPlayer(unit)) return { ok: false, reason: 'Select one of your units' };
      if (taskedThisTurn(snap, unit.uid)) {
        return { ok: false, reason: 'That unit has already been tasked this turn' };
      }
      if (snap.faction === 'iran') {
        const stock = iranStockFor(snap, unit);
        if (stock <= 0) return { ok: false, reason: 'No munitions of that type remain' };
      }
      return validateStrike(snap, map, unit, order.col, order.row, order.nodeId);
    }
    case 'produce': {
      if (snap.faction !== 'iran') return { ok: false, reason: 'Only Iran produces munitions' };
      const cost = productionCost(order.unitTypeId);
      if (cost <= 0) return { ok: false, reason: 'Unknown production line' };
      if (snap.iran.resources < cost * order.count) return { ok: false, reason: 'Not enough war resources' };
      return { ok: true };
    }
    case 'diplomacy': {
      if (snap.faction !== 'usa') return { ok: false, reason: 'Only Washington can run this signalling campaign' };
      if (snap.resources.politicalWill < 2) return { ok: false, reason: 'Not enough political will' };
      const host = snap.hosts[order.host];
      if (!host) return { ok: false, reason: 'Not a host nation' };
      if (host.status === 'closed') return { ok: false, reason: 'The base is already closed' };
      return { ok: true };
    }
    case 'reinforce': {
      if (snap.faction !== 'usa') return { ok: false, reason: 'Only the US can request CONUS reinforcements' };
      const pkg = REINFORCEMENTS.find((r) => r.id === order.packageId);
      if (!pkg) return { ok: false, reason: 'Unknown package' };
      if (snap.resources.politicalWill < pkg.cost) return { ok: false, reason: `Needs ${pkg.cost} political will` };
      if (snap.reinforcements.some((r) => r.id === pkg.id)) return { ok: false, reason: 'That package is already in transit' };
      return { ok: true };
    }
    case 'airlift': {
      if (snap.resources.airlift < 5) return { ok: false, reason: 'No airlift capacity left this turn' };
      if (snap.resources.politicalWill < ISRAEL_AIRLIFT.cost) return { ok: false, reason: 'Not enough political will' };
      return { ok: true };
    }
    case 'special': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit || !isPlayer(unit)) return { ok: false, reason: 'Select a special operations team' };
      if (taskedThisTurn(snap, unit.uid)) {
        return { ok: false, reason: 'That team has already been tasked this turn' };
      }
      if (unitType(unit.typeId).category !== 'specops') return { ok: false, reason: 'Not a special operations unit' };
      const nodeId = map.hexToNode.get(`${order.col},${order.row}`);
      if (!nodeId) return { ok: false, reason: 'No facility in that hex' };
      const dist = hexDistance({ col: unit.col, row: unit.row }, { col: order.col, row: order.row });
      if (dist > unitType(unit.typeId).rng) return { ok: false, reason: 'Target out of reach' };
      if (nodeState(snap, nodeId).integrity <= 0) return { ok: false, reason: 'That facility is already destroyed' };
      return { ok: true };
    }
    case 'cyber': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit || unit.faction !== 'israel') return { ok: false, reason: 'Only Unit 8200 can run this operation' };
      if (unit.cooldown > 0) return { ok: false, reason: `Cyber team rearming (${unit.cooldown} turns)` };
      return { ok: true };
    }
    default:
      return { ok: false, reason: 'Unknown order' };
  }
}

/** One mission per unit per turn: a magazine is a sustained stock, not a burst. */
function taskedThisTurn(snap: GameSnapshot, unitUid: string): boolean {
  return snap.orders.some(
    (o) => (o.kind === 'strike' || o.kind === 'special') && o.unitUid === unitUid,
  );
}

function productionCost(unitTypeId: string): number {
  switch (unitTypeId) {
    case 'shahed136':
      return BALANCE.iranDroneCost;
    case 'fateh110':
      return BALANCE.iranFatehCost;
    case 'khorramshahr':
      return BALANCE.iranKhorramshahrCost;
    case 'fattah':
      return BALANCE.iranFattahCost;
    default:
      return 0;
  }
}

function iranStockFor(snap: GameSnapshot, unit: UnitInstance): number {
  switch (unit.typeId) {
    case 'shahed136':
      return snap.iran.drones;
    case 'fateh110':
      return snap.iran.fateh;
    case 'khorramshahr':
      return snap.iran.khorramshahr;
    case 'fattah':
      return snap.iran.fattah;
    case 'asm_launcher':
      return snap.iran.asm;
    case 'mine_layer':
      return snap.iran.mines;
    default:
      return 0;
  }
}

function spendIranStock(snap: GameSnapshot, unit: UnitInstance): boolean {
  switch (unit.typeId) {
    case 'shahed136':
      if (snap.iran.drones <= 0) return false;
      snap.iran.drones -= 1;
      return true;
    case 'fateh110':
      if (snap.iran.fateh <= 0) return false;
      snap.iran.fateh -= 1;
      return true;
    case 'khorramshahr':
      if (snap.iran.khorramshahr <= 0) return false;
      snap.iran.khorramshahr -= 1;
      return true;
    case 'fattah':
      if (snap.iran.fattah <= 0) return false;
      snap.iran.fattah -= 1;
      return true;
    case 'asm_launcher':
      if (snap.iran.asm <= 0) return false;
      snap.iran.asm -= 1;
      return true;
    case 'mine_layer':
      if (snap.iran.mines <= 0) return false;
      snap.iran.mines -= 1;
      snap.iran.minesLaid += 1;
      return true;
    default:
      return true;
  }
}

export function applyOrder(
  snap: GameSnapshot,
  map: TheaterMap,
  order: Order,
  rng: () => number,
  events: ResolveEvent[],
): void {
  switch (order.kind) {
    case 'hold':
      return;
    case 'move': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return;
      unit.col = order.col;
      unit.row = order.row;
      events.push({
        text: `${unit.name} repositioned.`,
        tone: 'info',
        faction: unit.faction,
        focus: { col: order.col, row: order.row },
      });
      return;
    }
    case 'strike': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return;
      if (snap.faction === 'iran' && !spendIranStock(snap, unit)) {
        events.push({ text: 'No munitions of that type remain.', tone: 'warn' });
        return;
      }
      const def = unitType(unit.typeId);
      if (snap.faction === 'usa' && def.politicalCost) {
        snap.resources.politicalWill = clamp(snap.resources.politicalWill - def.politicalCost, 0, 100);
        events.push({
          text: `${unit.name} sortie cost ${def.politicalCost} political will at home.`,
          tone: 'warn',
          faction: 'usa',
        });
      }
      const result = resolveStrike(snap, map, unit, order.col, order.row, order.nodeId, rng);
      events.push(...result.events);
      if (def.id === 'b2') unit.cooldown = 4;
      return;
    }
    case 'produce': {
      const cost = productionCost(order.unitTypeId);
      snap.iran.resources -= cost * order.count;
      if (order.unitTypeId === 'shahed136') snap.iran.drones += order.count;
      if (order.unitTypeId === 'fateh110') snap.iran.fateh += order.count;
      if (order.unitTypeId === 'khorramshahr') snap.iran.khorramshahr += order.count;
      if (order.unitTypeId === 'fattah') snap.iran.fattah += order.count;
      events.push({
        text: `Iran's production lines added ${order.count} ${unitType(order.unitTypeId).name} to the stockpile.`,
        tone: 'good',
        faction: 'iran',
      });
      return;
    }
    case 'diplomacy': {
      const host = snap.hosts[order.host];
      if (!host) return;
      snap.resources.politicalWill = clamp(snap.resources.politicalWill - 2, 0, 100);
      host.threat = clamp(host.threat - BALANCE.signalThreatReduction, 0, 100);
      host.reason = 'US diplomatic signalling';
      events.push({
        text: `Washington signalled ${host.name}: threat perception fell to ${Math.round(host.threat)}.`,
        tone: 'good',
        faction: 'usa',
      });
      return;
    }
    case 'reinforce': {
      const pkg = REINFORCEMENTS.find((r) => r.id === order.packageId);
      if (!pkg) return;
      snap.resources.politicalWill = clamp(snap.resources.politicalWill - pkg.cost, 0, 100);
      const transit = pkg.turns + (snap.suezClosed ? 2 : 0);
      snap.reinforcements.push({
        id: pkg.id,
        label: pkg.label,
        arrivesTurn: snap.turn + transit,
        kind: pkg.kind,
        amount: pkg.amount,
      });
      events.push({
        text: `${pkg.label} requested from CONUS — arrives in ${transit} turns${snap.suezClosed ? ' (Suez is closed)' : ''}.`,
        tone: 'info',
        faction: 'usa',
      });
      return;
    }
    case 'airlift': {
      snap.resources.airlift -= 5;
      snap.resources.politicalWill = clamp(snap.resources.politicalWill - ISRAEL_AIRLIFT.cost, 0, 100);
      snap.reinforcements.push({
        id: ISRAEL_AIRLIFT.id,
        label: ISRAEL_AIRLIFT.label,
        arrivesTurn: snap.turn + ISRAEL_AIRLIFT.turns,
        kind: 'interceptors',
        amount: 15,
      });
      events.push({
        text: 'US airlift allocated to Israel: 15 interceptors arrive in 2 turns.',
        tone: 'info',
        faction: 'usa',
      });
      return;
    }
    case 'special': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return;
      const nodeId = map.hexToNode.get(`${order.col},${order.row}`);
      if (!nodeId) return;
      events.push(...resolveSabotage(snap, map, unit, nodeId, rng));
      return;
    }
    case 'cyber': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return;
      events.push(...resolveCyber(snap, unit, rng));
      return;
    }
  }
}

function spawnReinforcement(
  snap: GameSnapshot,
  map: TheaterMap,
  kind: 'patriot' | 'thaad' | 'air' | 'csg',
): UnitInstance {
  const typeId = kind === 'patriot' ? 'patriot' : kind === 'thaad' ? 'thaad' : kind === 'air' ? 'f15e' : 'csg';
  const anchor =
    kind === 'csg'
      ? { lon: 51.9, lat: 26.4 }
      : nodeState(snap, 'al_udeid').integrity > 25
        ? { lon: 51.31, lat: 25.11 }
        : { lon: 54.55, lat: 24.25 };
  let hex = map.estimateHex(anchor.lon, anchor.lat);
  for (let radius = 0; radius < 6; radius++) {
    let found = false;
    for (let dr = -radius; dr <= radius && !found; dr++) {
      for (let dc = -radius; dc <= radius && !found; dc++) {
        const tile = map.hexAt(hex.col + dc, hex.row + dr);
        if (!tile) continue;
        const water = tile.terrain === 'deep' || tile.terrain === 'coast';
        if (kind === 'csg' ? water : !water) {
          hex = { col: tile.col, row: tile.row };
          found = true;
        }
      }
    }
    if (found) break;
  }
  const unit: UnitInstance = {
    uid: `rein-${typeId}-${snap.turn}-${snap.units.length}`, 
    typeId,
    faction: 'usa',
    col: hex.col,
    row: hex.row,
    strength: 100,
    magazine: unitType(typeId).magazine,
    cooldown: 0,
    revealed: true,
    name: unitType(typeId).name,
  };
  snap.units.push(unit);
  return unit;
}

function attritionPhase(
  snap: GameSnapshot,
  map: TheaterMap,
  rng: () => number,
  events: ResolveEvent[],
): void {
  // Sealed American resupply cycle.
  if (snap.turn % BALANCE.airliftResupplyUSATurns === 0) {
    snap.resources.interceptorsUSA = clamp(
      snap.resources.interceptorsUSA + BALANCE.airliftResupplyUSAAmount,
      0,
      220,
    );
    events.push({
      text: `Strategic airlift delivered ${BALANCE.airliftResupplyUSAAmount} interceptors to the Gulf.`,
      tone: 'good',
      faction: 'usa',
    });
  }

  // Airlift capacity regenerates.
  snap.resources.airlift = clamp(snap.resources.airlift + 5, 0, BALANCE.sharedAirliftCapacity);

  // Arrivals.
  const arriving = snap.reinforcements.filter((r) => r.arrivesTurn <= snap.turn);
  snap.reinforcements = snap.reinforcements.filter((r) => r.arrivesTurn > snap.turn);
  for (const r of arriving) {
    if (r.id === ISRAEL_AIRLIFT.id) {
      snap.resources.interceptorsIsrael = clamp(snap.resources.interceptorsIsrael + r.amount, 0, 180);
      events.push({ text: 'US airlift landed in Israel: +15 interceptors.', tone: 'good', faction: 'israel' });
    } else if (r.kind === 'interceptors') {
      snap.resources.interceptorsUSA = clamp(snap.resources.interceptorsUSA + r.amount, 0, 220);
      events.push({ text: `${r.label} arrived: interceptors replenished.`, tone: 'good', faction: 'usa' });
    } else {
      const unit = spawnReinforcement(snap, map, r.kind);
      events.push({
        text: `${unit.name} arrived in theatre and is ready for tasking.`,
        tone: 'good',
        faction: 'usa',
        focus: { col: unit.col, row: unit.row },
      });
    }
  }

  // Squadrons rearm between turns; a magazine is a sustained sortie rate, not a
  // single-campaign stockpile.
  for (const unit of snap.units) {
    const def = unitType(unit.typeId);
    if (def.category === 'air') unit.magazine = Math.min(def.magazine, unit.magazine + BALANCE.airRearmPerTurn);
  }

  // Damage control: friendly airfields repair while they are still manned. A base
  // reduced to zero stays out of action, so knocking one out is decisive.
  for (const node of map.nodes) {
    const state = snap.nodes[node.id];
    if (!state || state.integrity <= 0 || state.integrity >= state.maxIntegrity) continue;
    const friendly = node.host === 'israel' || node.operators.includes('usa');
    if (!friendly) continue;
    if (snap.hosts[node.host]?.status === 'closed') continue;
    state.integrity = clamp(state.integrity + BALANCE.baseRepairPerTurn, 0, state.maxIntegrity);
  }

  // Iran's economy tightens as its exports are squeezed.
  if (snap.meters.hormuz < 30) addIranWarCost(snap, 2);
  if (snap.resources.politicalWill < 20) addIranWarCost(snap, -1);

  updateChokepoints(snap, map);
  updateHosts(snap, map, events);
  runHostPostures(snap, map, events);
  thirdPartyPhase(snap, map, rng, events);

  // Reset per-turn defensive magazines and cooldowns.
  for (const unit of snap.units) {
    if (unit.cooldown > 0) unit.cooldown -= 1;
    if (unit.typeId === 'iron_beam') unit.magazine = 2;
    if (snap.faction === 'iran' && ['fateh110', 'khorramshahr', 'fattah', 'asm_launcher', 'shahed136'].includes(unit.typeId)) {
      unit.magazine = 1;
    }
  }

  snap.resources.interceptorsUSA = clamp(snap.resources.interceptorsUSA, 0, 220);
  snap.resources.interceptorsIsrael = clamp(snap.resources.interceptorsIsrael, 0, 180);
  snap.resources.politicalWill = clamp(snap.resources.politicalWill, 0, 100);
  snap.meters.iranWarCost = clamp(snap.meters.iranWarCost, 0, 140);
}


export interface TurnResult {
  events: ResolveEvent[];
  status: GameSnapshot['status'];
  outcome: string;
}

export function runTurn(snap: GameSnapshot, map: TheaterMap): TurnResult {
  const events: ResolveEvent[] = [];
  const orderRng = factionRng(snap.seed, snap.turn, 'orders');
  for (const order of snap.orders) applyOrder(snap, map, order, orderRng, events);

  runAiPhase(snap, map, events);
  attritionPhase(snap, map, factionRng(snap.seed, snap.turn, 'attrition'), events);

  const result = checkOutcome(snap, map);
  snap.status = result.status;
  snap.outcome = result.outcome;

  if (snap.scenarioId === 'tutorial' && snap.turn >= 5 && snap.status === 'playing') {
    const held = operationalGulfBases(snap, map) >= 3;
    snap.status = held ? 'won' : 'lost';
    snap.outcome = held
      ? 'Tutorial complete: the Gulf basing network held and you managed the interceptor economy.'
      : 'Tutorial failed: too many Gulf bases were knocked out.';
  }

  if (snap.status === 'playing') snap.turn += 1;
  snap.orders = [];
  return { events, status: snap.status, outcome: snap.outcome };
}

/** Re-run a campaign from its seed and order log; used by replay/verification. */
export function replayOrders(
  snap: GameSnapshot,
  map: TheaterMap,
  orderLog: Array<{ turn: number; orders: Order[] }>,
): { turns: number; status: GameSnapshot['status']; outcome: string } {
  for (const entry of orderLog) {
    snap.orders = entry.orders;
    runTurn(snap, map);
    if (snap.status !== 'playing') break;
  }
  return { turns: snap.turn, status: snap.status, outcome: snap.outcome };
}

void unitsAt;
void defenderOfNode;
void hexDistance;
