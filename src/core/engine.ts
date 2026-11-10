import type { DeliveryClass } from './types';
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
import { maybeStartWar, readyReserves, regenerateUnderground } from './prewar';
import { resolveCyber, resolveSabotage, resolveStrike, validateStrike } from '../combat/combat';
import { canPlayerOrder } from './permissions';
import { updateIntelligence } from './intel';
import { updateIranDomestic } from '../politics/iranDomestic';
import { addEscortCoverage, clearMines, isSeaHex, layMines, minefields, hexKey, MINE_SORTIE_MAX } from './maritime';
import logisticsData from '../data/logistics.json';
import { hexDistance } from '../map/hex';
import { hasProductionCapacity, lineForMunition, productionCapacity, productionSites } from './production';
import {
  DELIVERY_CLASS_INFO,
  deliverMatedRounds,
  deliveryClassFor,
  launcherSortiesLeft,
  resetLauncherSorties,
  spendIranRounds,
} from './inventory';
import type { TheaterMap } from '../map/TheaterMap';
import {
  thirdPartyPhase,
  updateChokepoints,
  updateHosts,
  updateSuperpowers,
} from '../politics/politics';
import { updateEscalation } from '../politics/escalation';
import { COALITION_FACTIONS, ROE_POSTURES, activeRoe, roeEffectsText, updateRoe } from '../politics/roe';
import { buildScorecard } from '../politics/scorecard';
import { checkOutcome, updateVictoryClocks } from '../politics/victory';
import {
  applyPendingDomestic,
  domesticCfg,
  economyAirliftRegen,
  economyResupplyAmount,
  updateDomestic,
} from '../politics/domestic';
import {
  applyInitiativeOrder,
  updateIsraelInitiative,
  validateInitiativeOrder,
} from '../politics/initiative';
import {
  applyTalksOrder,
  updateTalks,
  validateTalksOrder,
} from '../politics/talks';
import { BALANCE } from './config';
import { factionRng } from './rng';
import type { GameSnapshot, LogisticsConfig, Order, Reinforcement, ResolveEvent, UnitInstance } from './types';
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
  mode: TransportMode;
}

export const REINFORCEMENTS: ReinforcementPackage[] = logisticsData.packages as unknown as ReinforcementPackage[];

export const ISRAEL_AIRLIFT = logisticsData.israelAirlift as unknown as {
  id: string;
  label: string;
  note: string;
  cost: number;
  turns: number;
  amount: number;
};

export const DEFAULT_LOGISTICS_CFG: LogisticsConfig = {
  interdictHormuz: 60,
  maxDelay: 3,
};

export function logisticsCfg(snap: GameSnapshot): LogisticsConfig {
  return snap.logisticsCfg ?? DEFAULT_LOGISTICS_CFG;
}

export function effectiveArrival(r: Reinforcement): number {
  return r.arrivesTurn + (r.delayTurns ?? 0);
}

/** Transport modes are distinct: they do not share delay or capacity rules. */
export type TransportMode = 'airlift' | 'sealift' | 'naval';

const AIRLIFT_NODES = ['al_udeid', 'al_dhafra', 'ali_al_salem', 'prince_sultan', 'nevatim', 'hatzerim'];
const SEALIFT_NODES = ['haifa', 'aden', 'basra'];

export function transportModeOf(r: { kind: string; mode?: TransportMode }): TransportMode {
  if (r.mode) return r.mode;
  if (r.kind === 'interceptors' || r.kind === 'air') return 'airlift';
  if (r.kind === 'csg') return 'naval';
  return 'sealift';
}

/**
 * Whether the receiving infrastructure can take a shipment of this mode.
 * Airlift needs a working airbase, sealift a working port, and naval
 * deployments a sea route that is not fully shut.
 */
export function transportAccess(
  snap: GameSnapshot,
  mode: TransportMode,
): { ok: boolean; reason: string } {
  if (mode === 'airlift') {
    const ok = AIRLIFT_NODES.some((id) => (snap.nodes[id]?.integrity ?? 0) > 25);
    return ok ? { ok: true, reason: '' } : { ok: false, reason: 'no operational airbase' };
  }
  if (mode === 'sealift') {
    const ok = SEALIFT_NODES.some((id) => (snap.nodes[id]?.integrity ?? 0) > 25);
    return ok ? { ok: true, reason: '' } : { ok: false, reason: 'no operational port' };
  }
  const ok = !snap.suezClosed || snap.meters.hormuz < 85;
  return ok ? { ok: true, reason: '' } : { ok: false, reason: 'sea lanes closed' };
}


/**
 * Projected-state reservations (Phase 2 item 1).
 *
 * Validation must not ignore the orders already queued, or two orders that each
 * fit can together overdraw the same stock. Reservations are derived from the
 * queue on every check and never stored, so removing an order releases its claim.
 */
/** Political will a cyber operation costs (Phase 2 items 2-3). */
export const CYBER_WILL_COST = 2;

export interface OrderReservations {
  units: Set<string>;
  politicalWill: number;
  iranResources: number;
  airlift: number;
  mines: number;
  tankers: number;
  rounds: Record<DeliveryClass, number>;
  sorties: Record<'drone' | 'ballistic', number>;
}

export function emptyReservations(): OrderReservations {
  return {
    units: new Set(),
    politicalWill: 0,
    iranResources: 0,
    airlift: 0,
    mines: 0,
    tankers: 0,
    rounds: { drone: 0, fateh: 0, khorramshahr: 0, fattah: 0, asm: 0 },
    sorties: { drone: 0, ballistic: 0 },
  };
}

/** Add one order's claim to the reservation set; the snapshot is not mutated. */
export function reserveOrder(snap: GameSnapshot, reserved: OrderReservations, order: Order): void {
  switch (order.kind) {
    case 'strike': {
      reserved.units.add(order.unitUid);
      if (snap.faction === 'iran') {
        const unit = findUnit(snap, order.unitUid);
        const cls = unit ? deliveryClassFor(unit.typeId) : null;
        if (cls) {
          reserved.rounds[cls] += 1;
          reserved.sorties[DELIVERY_CLASS_INFO[cls].launcherPool] += 1;
        }
      }
      return;
    }
    case 'special':
      reserved.units.add(order.unitUid);
      return;
    case 'cyber':
      reserved.units.add(order.unitUid);
      reserved.politicalWill += CYBER_WILL_COST;
      return;
    case 'mine':
      reserved.units.add(order.unitUid);
      reserved.mines += order.count;
      return;
    case 'clear':
    case 'escort':
      reserved.units.add(order.unitUid);
      return;
    case 'produce':
      reserved.iranResources += productionCost(order.unitTypeId) * order.count;
      return;
    case 'reinforce': {
      const pkg = REINFORCEMENTS.find((r) => r.id === order.packageId);
      if (pkg) {
        reserved.politicalWill += pkg.cost;
        if (transportModeOf(pkg) === 'airlift') reserved.tankers += 1;
      }
      return;
    }
    case 'airlift':
      reserved.politicalWill += ISRAEL_AIRLIFT.cost;
      reserved.airlift += 5;
      reserved.tankers += 1;
      return;
    case 'diplomacy':
      reserved.politicalWill += 2;
      return;
    case 'communicate':
      reserved.politicalWill += domesticCfg(snap).communicate.cost;
      return;
    default:
      return;
  }
}

/** Reservations implied by everything already queued. */
export function orderReservations(snap: GameSnapshot): OrderReservations {
  const reserved = emptyReservations();
  for (const order of snap.orders) reserveOrder(snap, reserved, order);
  return reserved;
}

export interface OrderCheck {
  ok: boolean;
  reason?: string;
}

export function validateOrder(
  snap: GameSnapshot,
  map: TheaterMap,
  order: Order,
  reserved: OrderReservations = emptyReservations(),
): OrderCheck {
  const permission = canPlayerOrder(snap, map, order);
  if (!permission.ok) return { ok: false, reason: permission.reason };

  switch (order.kind) {
    case 'hold':
      return { ok: true };
    case 'move': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return { ok: false, reason: 'Select one of your units' };
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
      if (!unit) return { ok: false, reason: 'Select one of your units' };
      if (reserved.units.has(unit.uid)) {
        return { ok: false, reason: 'That unit has already been tasked this turn' };
      }
      if (snap.faction === 'iran') {
        const cls = deliveryClassFor(unit.typeId);
        if (cls) {
          if (snap.iran.rounds[cls] - reserved.rounds[cls] <= 0) {
            return { ok: false, reason: 'No munitions of that type remain' };
          }
          const pool = DELIVERY_CLASS_INFO[cls].launcherPool;
          if (launcherSortiesLeft(snap.iran, pool) - reserved.sorties[pool] <= 0) {
            return { ok: false, reason: 'No launcher sorties remain this turn' };
          }
        } else if (iranStockFor(snap, unit) <= 0) {
          return { ok: false, reason: 'No munitions of that type remain' };
        }
      }
      return validateStrike(snap, map, unit, order.col, order.row, order.nodeId);
    }
    case 'mine': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return { ok: false, reason: 'Select a mine warfare group' };
      if (reserved.units.has(unit.uid)) return { ok: false, reason: 'That group has already been tasked this turn' };
      if (!isSeaHex(map, order.col, order.row)) return { ok: false, reason: 'Mines can only be laid in water' };
      const count = Math.max(1, Math.min(MINE_SORTIE_MAX, Math.floor(order.count)));
      const dist = hexDistance({ col: unit.col, row: unit.row }, { col: order.col, row: order.row });
      if (dist > unitType(unit.typeId).rng) return { ok: false, reason: 'Lay point out of range' };
      if (snap.iran.mines - reserved.mines < count) return { ok: false, reason: 'Not enough mines in the stockpile' };
      return { ok: true };
    }
    case 'clear': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return { ok: false, reason: 'Select a naval unit' };
      if (reserved.units.has(unit.uid)) return { ok: false, reason: 'That ship has already been tasked this turn' };
      if (!isSeaHex(map, order.col, order.row)) return { ok: false, reason: 'Clearance happens at sea' };
      const field = minefields(snap)[hexKey(order.col, order.row)];
      if (!field || field.mines <= 0) return { ok: false, reason: 'No minefield in that hex' };
      if (!field.detected) return { ok: false, reason: 'That minefield has not been located' };
      return { ok: true };
    }
    case 'escort': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return { ok: false, reason: 'Select a naval unit' };
      if (reserved.units.has(unit.uid)) return { ok: false, reason: 'That ship has already been tasked this turn' };
      if ((snap.escortCoverage ?? 0) >= 3) return { ok: false, reason: 'Escort coverage is already at its limit' };
      return { ok: true };
    }
    case 'produce': {
      if (snap.faction !== 'iran') return { ok: false, reason: 'Only Iran produces munitions' };
      const cost = productionCost(order.unitTypeId);
      if (cost <= 0) return { ok: false, reason: 'Unknown production line' };
      if (snap.iran.resources - reserved.iranResources < cost * order.count) {
        return { ok: false, reason: 'Not enough war resources for that order' };
      }
      const line = lineForMunition(order.unitTypeId);
      if (!hasProductionCapacity(map.nodes, snap, line)) {
        return { ok: false, reason: `No intact ${line} production line` };
      }
      return { ok: true };
    }
    case 'diplomacy': {
      if (snap.faction !== 'usa') return { ok: false, reason: 'Only Washington can run this signalling campaign' };
      if (snap.resources.politicalWill - reserved.politicalWill < 2) {
        return { ok: false, reason: 'Not enough political will' };
      }
      const host = snap.hosts[order.host];
      if (!host) return { ok: false, reason: 'Not a host nation' };
      if (host.status === 'closed') return { ok: false, reason: 'The base is already closed' };
      return { ok: true };
    }
    case 'reinforce': {
      if (snap.faction !== 'usa') return { ok: false, reason: 'Only the US can request CONUS reinforcements' };
      const pkg = REINFORCEMENTS.find((r) => r.id === order.packageId);
      if (!pkg) return { ok: false, reason: 'Unknown package' };
      if (snap.resources.politicalWill - reserved.politicalWill < pkg.cost) {
        return { ok: false, reason: `Needs ${pkg.cost} political will` };
      }
      if (snap.reinforcements.some((r) => r.id === pkg.id)) return { ok: false, reason: 'That package is already in transit' };
      if (transportModeOf(pkg) === 'airlift' && snap.resources.tankerSorties - reserved.tankers < 1) {
        return { ok: false, reason: 'No tanker sorties left this turn' };
      }
      return { ok: true };
    }
    case 'airlift': {
      if (snap.resources.tankerSorties - reserved.tankers < 1) {
        return { ok: false, reason: 'No tanker sorties left this turn' };
      }
      if (snap.resources.airlift - reserved.airlift < 5) {
        return { ok: false, reason: 'No airlift capacity left this turn' };
      }
      if (snap.resources.politicalWill - reserved.politicalWill < ISRAEL_AIRLIFT.cost) {
        return { ok: false, reason: 'Not enough political will' };
      }
      return { ok: true };
    }
    case 'communicate': {
      if (snap.faction !== 'usa') return { ok: false, reason: 'Only Washington can address the American public' };
      const cost = domesticCfg(snap).communicate.cost;
      if (snap.domestic && snap.domestic.cooldown > 0) {
        return { ok: false, reason: `Public address recharging (${snap.domestic.cooldown} turns)` };
      }
      if (snap.resources.politicalWill - reserved.politicalWill < cost) {
        return { ok: false, reason: `Needs ${cost} political will` };
      }
      return { ok: true };
    }
    case 'israel-initiative': {
      const block = validateInitiativeOrder(snap, order.stance);
      if (block) return { ok: false, reason: block };
      return { ok: true };
    }
    case 'talks': {
      const block = validateTalksOrder(snap, order.stance);
      if (block) return { ok: false, reason: block };
      return { ok: true };
    }
    case 'roe': {
      if (!COALITION_FACTIONS.has(snap.faction)) {
        return { ok: false, reason: 'Only the coalition sets rules of engagement' };
      }
      if (!ROE_POSTURES.includes(order.posture)) return { ok: false, reason: 'Unknown posture' };
      if (snap.roe?.posture === order.posture) return { ok: false, reason: 'That is already the standing posture' };
      return { ok: true };
    }
    case 'special': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return { ok: false, reason: 'Select a special operations team' };
      if (reserved.units.has(unit.uid)) {
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
      if (!unit) return { ok: false, reason: 'Select a cyber unit' };
      if (unit.cooldown > 0) return { ok: false, reason: `Cyber team rearming (${unit.cooldown} turns)` };
      if (reserved.units.has(unit.uid)) {
        return { ok: false, reason: 'That cyber team has already been tasked this turn' };
      }
      if (snap.resources.politicalWill - reserved.politicalWill < CYBER_WILL_COST) {
        return { ok: false, reason: `Needs ${CYBER_WILL_COST} political will` };
      }
      return { ok: true };
    }
    default:
      return { ok: false, reason: 'Unknown order' };
  }
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
  if (unit.typeId === 'mine_layer') return snap.iran.mines;
  const cls = deliveryClassFor(unit.typeId);
  return cls ? snap.iran.rounds[cls] : 0;
}

interface StockSpend {
  ok: boolean;
  reason?: string;
}

/**
 * Spend one round for a firing unit. The stock and the launcher budget are both
 * consumed here, so the player and the AI follow the same rule.
 */
function spendIranStock(snap: GameSnapshot, unit: UnitInstance): StockSpend {
  if (unit.typeId === 'mine_layer') {
    if (snap.iran.mines <= 0) return { ok: false, reason: 'No munitions of that type remain.' };
    snap.iran.mines -= 1;
    snap.iran.minesLaid += 1;
    return { ok: true };
  }
  const cls = deliveryClassFor(unit.typeId);
  if (!cls) return { ok: true };
  if (snap.iran.rounds[cls] <= 0) return { ok: false, reason: 'No munitions of that type remain.' };
  if (spendIranRounds(snap, cls, 1) === 0) {
    return { ok: false, reason: 'No launcher sorties remain this turn.' };
  }
  return { ok: true };
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
      if (snap.faction === 'iran') {
        const spent = spendIranStock(snap, unit);
        if (!spent.ok) {
          events.push({ text: spent.reason ?? 'No munitions of that type remain.', tone: 'warn' });
          return;
        }
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
    case 'mine': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return;
      const laid = layMines(snap, map, order.col, order.row, order.count);
      events.push({
        text:
          laid > 0
            ? `${unit.name} laid ${laid} mine${laid === 1 ? '' : 's'} at ${order.col},${order.row}.`
            : 'No mines were laid.',
        tone: laid > 0 ? 'warn' : 'info',
        faction: 'iran',
        focus: { col: order.col, row: order.row },
      });
      return;
    }
    case 'clear': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return;
      const swept = clearMines(snap, order.col, order.row);
      events.push({
        text:
          swept > 0
            ? `${unit.name} swept ${swept} mine${swept === 1 ? '' : 's'} at ${order.col},${order.row}.`
            : 'Clearance found no mines to sweep.',
        tone: swept > 0 ? 'good' : 'info',
        faction: unit.faction,
        focus: { col: order.col, row: order.row },
      });
      return;
    }
    case 'escort': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return;
      const coverage = addEscortCoverage(snap);
      events.push({
        text: `${unit.name} is escorting shipping (coverage ${coverage}/3) — Hormuz risk falls while it holds station.`,
        tone: 'good',
        faction: unit.faction,
      });
      return;
    }
    case 'produce': {
      const cost = productionCost(order.unitTypeId);
      const line = lineForMunition(order.unitTypeId);
      const sites = productionSites(map.nodes, snap, line);
      if (sites.length === 0) {
        events.push({
          text: `Iran has no intact ${line} production line left.`,
          tone: 'bad',
          faction: 'iran',
        });
        return;
      }
      snap.iran.resources -= cost * order.count;
      // Output tracks the average condition of the surviving facilities.
      const output = Math.max(1, Math.round(order.count * productionCapacity(map.nodes, snap, line)));
      // Production builds airframes and warheads separately, then mates them.
      const cls = deliveryClassFor(order.unitTypeId);
      if (cls) deliverMatedRounds(snap, cls, output);
      events.push({
        text: `Iran's production lines added ${output} ${unitType(order.unitTypeId).name} to the stockpile.`,
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
      const mode = transportModeOf(pkg);
      if (mode === 'airlift') snap.resources.tankerSorties = clamp(snap.resources.tankerSorties - 1, 0, 8);
      const transit = pkg.turns + (mode !== 'airlift' && snap.suezClosed ? 2 : 0);
      snap.reinforcements.push({
        id: pkg.id,
        label: pkg.label,
        arrivesTurn: snap.turn + transit,
        kind: pkg.kind,
        amount: pkg.amount,
        mode,
      });
      const straitRisk = snap.meters.hormuz > logisticsCfg(snap).interdictHormuz;
      events.push({
        text: `${pkg.label} requested from CONUS — arrives in ${transit} turns${snap.suezClosed ? ' (Suez is closed)' : ''}${straitRisk ? ' — Gulf shipping under threat, expect strait delays' : ''}.`,
        tone: 'info',
        faction: 'usa',
      });
      return;
    }
    case 'airlift': {
      snap.resources.airlift -= 5;
      snap.resources.tankerSorties = clamp(snap.resources.tankerSorties - 1, 0, 8);
      snap.resources.politicalWill = clamp(snap.resources.politicalWill - ISRAEL_AIRLIFT.cost, 0, 100);
      snap.reinforcements.push({
        id: ISRAEL_AIRLIFT.id,
        label: ISRAEL_AIRLIFT.label,
        arrivesTurn: snap.turn + ISRAEL_AIRLIFT.turns,
        kind: 'interceptors',
        amount: 15,
        mode: 'airlift',
      });
      events.push({
        text: 'US airlift allocated to Israel: 15 interceptors arrive in 2 turns.',
        tone: 'info',
        faction: 'usa',
      });
      return;
    }
    case 'communicate': {
      if (!snap.domestic) return;
      const cfg = domesticCfg(snap).communicate;
      snap.resources.politicalWill = clamp(snap.resources.politicalWill - cfg.cost, 0, 100);
      snap.domestic.cooldown = cfg.cooldown;
      const before = snap.domestic.congress;
      snap.domestic.congress = clamp(snap.domestic.congress + cfg.gain, 0, 100);
      events.push({
        text: `Public address: the administration makes its case to Congress and the country (support ${Math.round(before)} → ${Math.round(snap.domestic.congress)}).`,
        tone: 'good',
        faction: 'usa',
      });
      return;
    }
    case 'israel-initiative': {
      applyInitiativeOrder(snap, order.stance, events);
      return;
    }
    case 'talks': {
      applyTalksOrder(snap, order.stance, events);
      return;
    }
    case 'roe': {
      if (!snap.roe) snap.roe = { posture: 'standard' };
      if (snap.roe.posture === order.posture) return;
      snap.roe.posture = order.posture;
      const label = order.posture.toUpperCase();
      events.push({
        text: `Rules of engagement set to ${label}: ${roeEffectsText(activeRoe(snap))}.`,
        tone: order.posture === 'aggressive' ? 'warn' : 'info',
        faction: snap.faction,
      });
      return;
    }
    case 'special': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return;
      const nodeId = map.hexToNode.get(`${order.col},${order.row}`);
      if (!nodeId) return;
      const result = resolveSabotage(snap, map, unit, nodeId, rng);
      events.push(...result.events);
      return;
    }
    case 'cyber': {
      const unit = findUnit(snap, order.unitUid);
      if (!unit) return;
      snap.resources.politicalWill = clamp(snap.resources.politicalWill - CYBER_WILL_COST, 0, 100);
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
  if (snap.turn % BALANCE.airliftResupplyUSATurns === 0) {
    const amount = economyResupplyAmount(snap);
    snap.resources.interceptorsUSA = clamp(snap.resources.interceptorsUSA + amount, 0, 220);
    events.push({
      text: `Strategic airlift delivered ${amount} interceptors to the Gulf.`,
      tone: 'good',
      faction: 'usa',
    });
  }

  snap.resources.airlift = clamp(snap.resources.airlift + economyAirliftRegen(snap), 0, BALANCE.sharedAirliftCapacity);
  snap.resources.tankerSorties = clamp(snap.resources.tankerSorties + 1, 0, 8);

  const cfg = logisticsCfg(snap);
  for (const r of snap.reinforcements) {
    const mode = transportModeOf(r);
    const straitRisk = mode !== 'airlift' && snap.meters.hormuz > cfg.interdictHormuz;
    const access = transportAccess(snap, mode);
    if (!straitRisk && access.ok) continue;
    const before = r.delayTurns ?? 0;
    r.delayTurns = Math.min(cfg.maxDelay, before + 1);
    if (r.delayTurns > before) {
      events.push({
        text: straitRisk
          ? `Strait risk delays ${r.label}: ETA slips to turn ${effectiveArrival(r)}.`
          : `${r.label} waits for a usable ${mode === 'airlift' ? 'airbase' : 'port'}: ETA slips to turn ${effectiveArrival(r)}.`,
        tone: 'warn',
        faction: 'usa',
      });
    }
  }

  const due = snap.reinforcements.filter((r) => effectiveArrival(r) <= snap.turn);
  snap.reinforcements = snap.reinforcements.filter((r) => effectiveArrival(r) > snap.turn);
  for (const r of due) {
    const access = transportAccess(snap, transportModeOf(r));
    if (!access.ok) {
      r.delayTurns = Math.min(cfg.maxDelay, (r.delayTurns ?? 0) + 1);
      snap.reinforcements.push(r);
      events.push({
        text: `${r.label} is holding: ${access.reason}. ETA slips to turn ${effectiveArrival(r)}.`,
        tone: 'warn',
        faction: 'usa',
      });
      continue;
    }
    if (r.id === ISRAEL_AIRLIFT.id) {
      snap.resources.interceptorsIsrael = clamp(snap.resources.interceptorsIsrael + r.amount, 0, 180);
      events.push({ text: 'US airlift landed in Israel: +15 interceptors.', tone: 'good', faction: 'israel' });
    } else if (r.kind === 'interceptors') {
      snap.resources.interceptorsUSA = clamp(snap.resources.interceptorsUSA + r.amount, 0, 220);
      events.push({ text: `${r.label} arrived: interceptors replenished.`, tone: 'good', faction: 'usa' });
    } else {
      const unit = spawnReinforcement(snap, map, r.kind as 'patriot' | 'thaad' | 'air' | 'csg');
      events.push({
        text: `${r.label} arrived at the theatre.`,
        tone: 'good',
        faction: 'usa',
        focus: { col: unit.col, row: unit.row },
      });
    }
  }

  for (const unit of snap.units) {
    if (unit.cooldown > 0) unit.cooldown -= 1;
  }

  if (snap.faction === 'iran' || true) {
    snap.iran.resources = clamp(snap.iran.resources + BALANCE.iranResourceIncome, 0, 300);
  }

  for (const node of Object.values(snap.nodes)) {
    if (node.integrity > 0 && node.integrity < node.maxIntegrity) {
      node.integrity = clamp(node.integrity + BALANCE.baseRepairPerTurn, 0, node.maxIntegrity);
    }
  }

  updateHosts(snap, map, events);
  updateIranDomestic(snap, events);
  updateIntelligence(snap);
  updateChokepoints(snap, map);
  updateSuperpowers(snap, events);
  updateEscalation(snap, events);
  updateDomestic(snap, events);
  updateIsraelInitiative(snap, events);
  updateTalks(snap, events);
  updateRoe(snap, events);
  runHostPostures(snap, map, events);
  thirdPartyPhase(snap, map, rng, events);

  snap.resources.interceptorsUSA = clamp(snap.resources.interceptorsUSA, 0, 220);
  snap.resources.interceptorsIsrael = clamp(snap.resources.interceptorsIsrael, 0, 180);
}

export function runTurn(snap: GameSnapshot, map: TheaterMap): TurnResult {
  const events: ResolveEvent[] = [];
  applyPendingDomestic(snap, events);
  const orderRng = factionRng(snap.seed, snap.turn, 'orders');
  // Re-validate the queue against the live snapshot before resolving. An order
  // that no longer holds is dropped with a logged reason, never silently applied.
  const accepted: Order[] = [];
  const reserved = emptyReservations();
  for (const order of snap.orders) {
    const check = validateOrder(snap, map, order, reserved);
    if (check.ok) {
      accepted.push(order);
      reserveOrder(snap, reserved, order);
    } else {
      events.push({
        text: `Order dropped: ${check.reason ?? 'invalid'}.`,
        tone: 'warn',
        faction: snap.faction,
      });
    }
  }
  snap.orders = accepted;
  for (const order of snap.orders) applyOrder(snap, map, order, orderRng, events);

  maybeStartWar(snap, events);

  if (snap.warStarted !== false) {
    runAiPhase(snap, map, events);
  } else {
    events.push({
      text: 'Pre-war turn: opposing forces hold fire. Set posture, reinforce, or open hostilities.',
      tone: 'info',
    });
  }

  attritionPhase(snap, map, factionRng(snap.seed, snap.turn, 'attrition'), events);
  if (snap.warStarted !== false) {
    readyReserves(snap, events);
    regenerateUnderground(snap, map, events);
  }

  updateVictoryClocks(snap, map);
  const result = checkOutcome(snap, map);
  snap.status = result.status;
  snap.outcome = result.outcome;

  if (result.status !== 'playing' && snap.victory && !snap.scorecard) {
    snap.scorecard = buildScorecard(snap, map);
    events.push({
      text: `Settlement — Iran ${snap.scorecard.iranTotal}, coalition ${snap.scorecard.coalitionTotal} (${snap.scorecard.margin >= 0 ? '+' : ''}${snap.scorecard.margin} margin).`,
      tone: 'info',
    });
  }

  if (snap.scenarioId === 'tutorial' && snap.turn >= 5 && snap.status === 'playing') {
    const held = operationalGulfBases(snap, map) >= 3;
    snap.status = held ? 'won' : 'lost';
    snap.outcome = held
      ? 'Tutorial complete: the Gulf basing network held and you managed the interceptor economy.'
      : 'Tutorial failed: too many Gulf bases were knocked out.';
  }

  if (snap.status === 'playing') {
    snap.turn += 1;
    resetLauncherSorties(snap);
  }
  snap.orders = [];
  return { events, status: snap.status, outcome: snap.outcome };
}

export interface TurnResult {
  events: ResolveEvent[];
  status: GameSnapshot['status'];
  outcome: string;
}

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
