/**
 * Combat resolution: strike missions, interception and damage.
 *
 * Every roll comes from a seeded RNG supplied by the caller, so a campaign can be
 * replayed exactly from its decision log.
 */
import type { FactionId, GameSnapshot, ResolveEvent, ThreatClass, UnitInstance } from '../core/types';
import { clamp, defenderOfNode, removeUnit, unitsAt, unitType } from '../core/world';
import { hexDistance } from '../map/hex';
import type { TheaterMap } from '../map/TheaterMap';
import { BALANCE } from '../core/config';
import {
  addIranWarCost,
  maxSuperpowerTier,
  noFlyZoneActive,
  purchaseCostOfInterceptors,
  recordImpact,
  strikeRangeModifier,
} from '../politics/politics';

export type Rng = () => number;

const WEST = new Set<FactionId>(['usa', 'israel']);
const IRAN_BLOC = new Set<FactionId>(['iran', 'houthi']);

export function hostileTo(a: FactionId, b: FactionId): boolean {
  if (a === b) return false;
  if (WEST.has(a) && IRAN_BLOC.has(b)) return true;
  if (WEST.has(b) && IRAN_BLOC.has(a)) return true;
  if (a === 'saudi' && IRAN_BLOC.has(b)) return true;
  if (b === 'saudi' && IRAN_BLOC.has(a)) return true;
  if (a === 'houthi' && b === 'saudi') return true;
  return false;
}

export interface DefenseOption {
  unit?: UnitInstance;
  probability: number;
  cost: number;
  /** Human-readable system name for the log. */
  label: string;
}

function interceptorPool(snap: GameSnapshot, faction: FactionId): number {
  if (faction === 'usa') return snap.resources.interceptorsUSA;
  if (faction === 'israel') return snap.resources.interceptorsIsrael;
  return Number.POSITIVE_INFINITY;
}

/** Best available defensive system covering a hex against a threat class. */
export function bestDefence(
  snap: GameSnapshot,
  map: TheaterMap,
  col: number,
  row: number,
  defender: FactionId | null,
  threat: ThreatClass,
  hardenedTarget = false,
): DefenseOption | null {
  if (!defender) return null;

  // Iran has no interceptor economy: layered AD is abstracted as an intrinsic
  // roll, and great-power resupply makes it meaningfully better.
  if (defender === 'iran') {
    const tier = maxSuperpowerTier(snap);
    const shielded = tier >= 2 ? 0.08 : 0;
    return {
      probability: (hardenedTarget ? 0.45 : 0.3) + shielded,
      cost: 0,
      label: shielded > 0 ? 'Iranian air defence (Russian reloads)' : 'Iranian air defence',
    };
  }

  let best: DefenseOption | null = null;
  for (const unit of snap.units) {
    if (unit.faction !== defender) continue;
    const def = unitType(unit.typeId);
    if (def.intercept === undefined) continue;
    if (!def.engages?.includes(threat)) continue;
    if (hexDistance({ col: unit.col, row: unit.row }, { col, row }) > (def.coverage ?? 0)) continue;
    const cost = def.interceptCost ?? 0;
    if (interceptorPool(snap, defender) < cost) continue;
    if (def.id === 'iron_beam' && unit.magazine <= 0) continue;

    let p = def.intercept;
    if (threat === 'hypersonic') p = def.hypersonicIntercept ?? 0;
    if (!best || p > best.probability) {
      best = { unit, probability: p, cost, label: def.name };
    }
  }
  void map;
  return best;
}

function payInterception(snap: GameSnapshot, defender: FactionId, option: DefenseOption): void {
  if (option.cost > 0) purchaseCostOfInterceptors(snap, defender, option.cost);
  if (option.unit && unitType(option.unit.typeId).id === 'iron_beam') option.unit.magazine -= 1;
}

export function defenderAtHex(snap: GameSnapshot, col: number, row: number, attacker: FactionId): FactionId | null {
  const defenders = unitsAt(snap, col, row).filter((u) => hostileTo(attacker, u.faction));
  return defenders[0]?.faction ?? null;
}

export interface SalvoSpec {
  threat: ThreatClass;
  /** Per-munition damage value. */
  damage: number;
  count: number;
  label: string;
}

export interface IncomingAttack {
  attacker: FactionId;
  col: number;
  row: number;
  nodeId?: string;
  salvos: SalvoSpec[];
  /** Iranian launchers reveal themselves by firing. */
  revealUnitUid?: string;
}

/** Resolve an incoming missile/drone attack against a hex or node. */
export function resolveIncoming(
  snap: GameSnapshot,
  map: TheaterMap,
  attack: IncomingAttack,
  rng: Rng,
): ResolveEvent[] {
  const events: ResolveEvent[] = [];
  const node = attack.nodeId ? map.nodeById.get(attack.nodeId) : undefined;
  const defender = node ? defenderOfNode(node) : defenderAtHex(snap, attack.col, attack.row, attack.attacker);

  if (attack.revealUnitUid) {
    const launcher = snap.units.find((u) => u.uid === attack.revealUnitUid);
    if (launcher) launcher.revealed = true;
  }

  for (const salvo of attack.salvos) {
    const saturation = salvo.count >= 7 ? 0.1 : 0;
    let intercepted = 0;
    let impacts = 0;
    let lastSystem = '';
    for (let i = 0; i < salvo.count; i++) {
      const option = bestDefence(snap, map, attack.col, attack.row, defender, salvo.threat, node?.hardened ?? false);
      if (option && rng() < Math.max(0, option.probability - saturation)) {
        payInterception(snap, defender!, option);
        intercepted++;
        lastSystem = option.label;
      } else {
        impacts++;
        applyImpact(snap, map, attack, node?.id, salvo.damage, rng, events);
      }
    }
    if (intercepted > 0) {
      const system = lastSystem || 'Defences';
      events.push({
        text: `${system} intercepted ${intercepted}/${salvo.count} ${salvo.label}.`,
        tone: intercepted === salvo.count ? 'good' : 'info',
        faction: defender ?? undefined,
        focus: { col: attack.col, row: attack.row },
      });
    }
    if (impacts > 0) {
      const where = node ? node.name : `hex ${attack.col},${attack.row}`;
      events.push({
        text: `${impacts} ${salvo.label} impact${impacts === 1 ? '' : 's'} at ${where}${node ? ` — integrity ${Math.round(snap.nodes[node.id]!.integrity)}%` : ''}.`,
        tone: 'bad',
        focus: { col: attack.col, row: attack.row },
      });
    }
  }
  return events;
}

function applyImpact(
  snap: GameSnapshot,
  map: TheaterMap,
  attack: IncomingAttack,
  nodeId: string | undefined,
  damage: number,
  rng: Rng,
  events: ResolveEvent[],
): void {
  if (nodeId) {
    const node = map.nodeById.get(nodeId)!;
    const state = snap.nodes[nodeId]!;
    const factor = node.hardened ? 1.0 : 4.2;
    state.integrity = clamp(state.integrity - damage * factor, 0, state.maxIntegrity);
    recordImpact(snap, map, nodeId);
    if (node.host === 'iran') addIranWarCost(snap, 2);
    return;
  }

  const targets = unitsAt(snap, attack.col, attack.row).filter((u) => hostileTo(attack.attacker, u.faction));
  if (targets.length === 0) {
    events.push({
      text: `A ${attack.attacker === 'iran' ? 'Iranian' : 'coalition'} salvo landed on empty ground at ${attack.col},${attack.row}.`,
      tone: 'info',
      focus: { col: attack.col, row: attack.row },
    });
    return;
  }
  const target = targets[Math.floor(rng() * targets.length)]!;
  target.strength -= damage * 3.5;
  if (target.strength <= 0) {
    removeUnit(snap, target.uid);
    events.push({
      text: `${target.name} destroyed at ${attack.col},${attack.row}.`,
      tone: 'bad',
      focus: { col: attack.col, row: attack.row },
    });
  } else {
    events.push({
      text: `${target.name} hit (strength ${Math.max(0, Math.round(target.strength))}%).`,
      tone: 'warn',
      focus: { col: attack.col, row: attack.row },
    });
  }
}

/** Range available to a strike aircraft, after host-nation airspace penalties. */
export function strikeRange(snap: GameSnapshot, unit: UnitInstance): number {
  const def = unitType(unit.typeId);
  let range = def.rng;
  if (unit.faction === 'usa' || unit.faction === 'israel') range += strikeRangeModifier(snap);
  return Math.max(2, range);
}

export interface StrikeValidation {
  ok: boolean;
  reason?: string;
}

export function validateStrike(
  snap: GameSnapshot,
  map: TheaterMap,
  unit: UnitInstance,
  col: number,
  row: number,
  nodeId?: string,
): StrikeValidation {
  const def = unitType(unit.typeId);
  if (unit.magazine <= 0) return { ok: false, reason: 'No munitions remaining' };
  if (unit.cooldown > 0) return { ok: false, reason: `Rearming (${unit.cooldown} turns)` };
  if (def.category === 'defense' || def.category === 'production' || def.category === 'cyber') {
    return { ok: false, reason: 'This unit cannot conduct strikes' };
  }
  const dist = hexDistance({ col: unit.col, row: unit.row }, { col, row });
  const range = strikeRange(snap, unit);
  if (dist > range) return { ok: false, reason: `Out of range (${dist}/${range} hexes)` };

  // Base access: offensive missions cannot launch from a restricted host.
  const origin = map.hexAt(unit.col, unit.row);
  if ((unit.faction === 'usa' || unit.faction === 'israel') && origin) {
    const host = snap.hosts[origin.owner];
    if (host && host.status !== 'open') {
      return { ok: false, reason: `${host.name} ${host.status === 'closed' ? 'has closed its bases' : 'restricts offensive missions'}` };
    }
  }

  const node = nodeId ? map.nodeById.get(nodeId) : undefined;
  const enemies = unitsAt(snap, col, row).filter((u) => hostileTo(unit.faction, u.faction));
  const hostileNode = node ? defenderOfNode(node) !== null && node.host !== origin?.owner : false;
  if (!node && enemies.length === 0) return { ok: false, reason: 'No military target in that hex' };
  if (node && !hostileNode && enemies.length === 0) {
    return { ok: false, reason: 'That facility is not a hostile target' };
  }

  // Great-power red lines. Russia and China do not fight, but they can forbid.
  const coalition = unit.faction === 'usa' || unit.faction === 'israel';
  if (coalition && node?.host === 'iran') {
    if (noFlyZoneActive(snap)) {
      return { ok: false, reason: 'Russia and China have imposed a no-fly zone over Iran' };
    }
    if (node.kind === 'urban' && snap.resources.politicalWill < BALANCE.congressCityStrikeWill) {
      return {
        ok: false,
        reason: `Congress has not authorised strikes on Iranian cities (needs ${BALANCE.congressCityStrikeWill} will)`,
      };
    }
  }
  return { ok: true };
}

export interface StrikeResult {
  events: ResolveEvent[];
  attackerLost: boolean;
}

/** Resolve one player/AI strike mission. */
export function resolveStrike(
  snap: GameSnapshot,
  map: TheaterMap,
  unit: UnitInstance,
  col: number,
  row: number,
  nodeId: string | undefined,
  rng: Rng,
): StrikeResult {
  const def = unitType(unit.typeId);
  const events: ResolveEvent[] = [];
  if (unit.magazine <= 0) {
    return { events: [{ text: `${unit.name} has no munitions.`, tone: 'warn' }], attackerLost: false };
  }
  unit.magazine -= 1;
  unit.revealed = true;

  const node = nodeId ? map.nodeById.get(nodeId) : undefined;
  const enemies = unitsAt(snap, col, row).filter((u) => hostileTo(unit.faction, u.faction));
  const defender = node ? defenderOfNode(node) : enemies[0]?.faction ?? null;
  const threatClass: ThreatClass = def.threatClass ?? 'cruise';
  const rounds = def.bunkerBuster ? 2 : 1;
  let hits = 0;
  let intercepted = 0;
  let surfaceOnly = false;

  for (let r = 0; r < rounds; r++) {
    const option = bestDefence(snap, map, col, row, defender, threatClass, node?.hardened ?? false);
    const stealth = def.stealth ?? 0;
    const engagement = 1 - stealth;
    if (option && rng() < option.probability * engagement) {
      payInterception(snap, defender!, option);
      intercepted++;
      continue;
    }
    hits++;
    if (node) {
      const state = snap.nodes[node.id]!;
      // Buried halls can only be reached by a warhead that penetrates their
      // depth. Everything else destroys surface plant and leaves the hall intact,
      // which is why Fordow is not a one-sortie target.
      const depth = node.buried ?? 0;
      const penetrates = depth === 0 || (def.penetration ?? 0) >= depth;
      const armour = !penetrates
        ? depth >= 50
          ? 0.35
          : 0.7
        : node.hardened
          ? def.bunkerBuster
            ? 3.2
            : 0.9
          : 4.4;
      const floor = penetrates ? 0 : (node.surfaceFloor ?? 55);
      const next = state.integrity - (def.atk * armour) / rounds;
      state.integrity = clamp(Math.max(next, Math.min(state.integrity, floor)), 0, state.maxIntegrity);
      surfaceOnly = surfaceOnly || !penetrates;
      if (node.host === 'iran') addIranWarCost(snap, penetrates ? 6 : 2);
      recordImpact(snap, map, node.id, 0.5);
    } else if (enemies.length > 0) {
      const target = enemies[Math.floor(rng() * enemies.length)]!;
      target.strength -= def.atk * 4.5;
      if (target.strength <= 0) {
        removeUnit(snap, target.uid);
        events.push({ text: `${target.name} destroyed by ${unit.name}.`, tone: 'good', focus: { col, row } });
      }
    }
  }

  if (intercepted > 0) {
    const option = bestDefence(snap, map, col, row, defender, threatClass, node?.hardened ?? false);
    events.push({
      text: `Air defences intercepted ${intercepted} of ${rounds} munition${rounds === 1 ? '' : 's'} from ${unit.name}${option?.unit ? ` (${option.unit.name})` : ''}.`,
      tone: 'warn',
      focus: { col, row },
    });
  }
  if (hits > 0) {
    if (node) {
      const integrity = Math.round(snap.nodes[node.id]!.integrity);
      const target = surfaceOnly
        ? `${node.name} — surface plant wrecked, the halls ${node.buried ?? 0} m underground are untouched (${integrity}%)`
        : `${node.name} (integrity ${integrity}%)`;
      events.push({
        text: `${unit.name} struck ${target}.`,
        tone: surfaceOnly ? 'warn' : 'good',
        focus: { col, row },
      });
    } else {
      events.push({ text: `${unit.name} struck enemy forces at ${col},${row}.`, tone: 'good', focus: { col, row } });
    }
  }

  // Deep strikes into Iran carry real loss risk; losses are not replaced.
  let attackerLost = false;
  if (def.category === 'air' && (defender === 'iran' || defender === 'houthi')) {
    const depth = node?.hardened ? 0.08 : 0.04;
    const lossChance = Math.max(0.01, 0.05 + depth - (def.stealth ?? 0) * 0.08);
    if (rng() < lossChance) {
      attackerLost = true;
      removeUnit(snap, unit.uid);
      events.push({
        text: `${unit.name} was lost on the return leg — no replacement available this campaign.`,
        tone: 'bad',
        faction: unit.faction,
        focus: { col, row },
      });
    }
  }
  return { events, attackerLost };
}

/** Special operations sabotage. */
export function resolveSabotage(
  snap: GameSnapshot,
  map: TheaterMap,
  unit: UnitInstance,
  nodeId: string,
  rng: Rng,
): ResolveEvent[] {
  const node = map.nodeById.get(nodeId);
  if (!node) return [];
  const success = rng() < 0.4;
  if (success) {
    const state = snap.nodes[nodeId]!;
    state.integrity = clamp(state.integrity - 30, 0, state.maxIntegrity);
    if (node.host === 'iran') addIranWarCost(snap, 8);
    return [
      {
        text: `Special operations sabotaged ${node.name}: integrity now ${Math.round(state.integrity)}%.`,
        tone: 'good',
        faction: unit.faction,
        focus: map.nodeHexOf(nodeId),
      },
    ];
  }
  snap.meters.legitimacy = clamp(snap.meters.legitimacy - 5, 0, 100);
  return [
    {
      text: `Special operations against ${node.name} failed; the team was lost and legitimacy fell by 5.`,
      tone: 'bad',
      faction: unit.faction,
      focus: map.nodeHexOf(nodeId),
    },
  ];
}

/** Unit 8200 / cyber: locate and disable one Iranian launcher. */
export function resolveCyber(
  snap: GameSnapshot,
  unit: UnitInstance,
  rng: Rng,
): ResolveEvent[] {
  const launchers = snap.units.filter(
    (u) => u.faction === 'iran' && (u.typeId === 'fateh110' || u.typeId === 'khorramshahr' || u.typeId === 'asm_launcher'),
  );
  if (launchers.length === 0) {
    return [{ text: 'Unit 8200 found no Iranian launcher to disable.', tone: 'info', faction: unit.faction }];
  }
  const target = launchers[Math.floor(rng() * launchers.length)]!;
  if (rng() < 0.7) {
    removeUnit(snap, target.uid);
    unit.cooldown = 3;
    return [
      {
        text: `Unit 8200 geolocated and disabled an Iranian ${unitType(target.typeId).name}.`,
        tone: 'good',
        faction: 'israel',
        focus: { col: target.col, row: target.row },
      },
    ];
  }
  unit.cooldown = 3;
  return [{ text: 'Unit 8200 ran a cyber operation but the launcher moved before the strike.', tone: 'info', faction: 'israel' }];
}
