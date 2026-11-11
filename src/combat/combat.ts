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
import { attackerLossChance, defenceLayers, detectRaid, engageOnce, suppressAfterImpact } from './airdefence';
import { addCasualties, restrictionBlocksStrike } from '../politics/domestic';
import { reject, type OrderRejectCode, type RejectParams } from '../core/rejection';
import { roeBlocksStrike, roeDamageMultiplier } from '../politics/roe';
import {
  addIranWarCost,
  russiaTier,
  noFlyZoneActive,
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
    const tier = russiaTier(snap);
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
    const detected = defender
      ? detectRaid(snap, map, attack.col, attack.row, defender, salvo.threat, 0, rng).detected
      : false;
    for (let i = 0; i < salvo.count; i++) {
      const layers =
        detected && defender ? defenceLayers(snap, map, attack.col, attack.row, defender, salvo.threat) : [];
      const engagement =
        detected && defender
          ? engageOnce(snap, defender, layers, 0, node?.hardened ?? false, saturation, rng)
          : { intercepted: false as const };
      if (engagement.intercepted) {
        intercepted++;
        lastSystem = engagement.system ?? lastSystem;
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
    // Political consequences are per raid, not per impacting munition. A
    // single eight-drone salvo is one attack on the base, not eight separate
    // domestic casualty events.
    if (impacts > 0 && node?.id) {
      recordImpact(snap, map, node.id, 1, attack.attacker);
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
    // A US formation destroyed by an incoming salvo is a domestic casualty event.
    if (target.faction === 'usa') addCasualties(snap, 2);
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
  code?: OrderRejectCode;
  reason?: string;
  params?: RejectParams;
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
  if (unit.magazine <= 0) return reject('no-munitions-remaining', 'No munitions remaining');
  if (unit.cooldown > 0) {
    return reject('rearming', `Rearming (${unit.cooldown} turns)`, { turns: unit.cooldown });
  }
  if (def.category === 'defense' || def.category === 'production' || def.category === 'cyber') {
    return reject('cannot-strike', 'This unit cannot conduct strikes');
  }
  const dist = hexDistance({ col: unit.col, row: unit.row }, { col, row });
  const range = strikeRange(snap, unit);
  if (dist > range) {
    return reject('out-of-range', `Out of range (${dist}/${range} hexes)`, { dist, range });
  }

  // Base access: offensive missions cannot launch from a restricted host.
  const origin = map.hexAt(unit.col, unit.row);
  if ((unit.faction === 'usa' || unit.faction === 'israel') && origin) {
    const host = snap.hosts[origin.owner];
    if (host && host.status !== 'open') {
      return host.status === 'closed'
        ? reject('host-closed', `${host.name} has closed its bases`, { host: host.name })
        : reject('host-restricted', `${host.name} restricts offensive missions`, { host: host.name });
    }
  }

  const node = nodeId ? map.nodeById.get(nodeId) : undefined;
  const enemies = unitsAt(snap, col, row).filter((u) => hostileTo(unit.faction, u.faction));
  const hostileNode = node ? defenderOfNode(node) !== null && node.host !== origin?.owner : false;
  if (!node && enemies.length === 0) return reject('no-target', 'No military target in that hex');
  if (node && !hostileNode && enemies.length === 0) {
    return reject('not-hostile', 'That facility is not a hostile target');
  }

  // Phase 2: congressional restrictions on US offensive operations.
  const congressionalBlock = restrictionBlocksStrike(snap, unit.faction, node);
  if (congressionalBlock) return congressionalBlock;

  // Improvement 6: the coalition rules-of-engagement posture can forbid
  // population-centre strikes under the constrained preset.
  const roeBlock = roeBlocksStrike(snap, unit.faction, node);
  if (roeBlock) return roeBlock;

  // Great-power red lines. Russia and China do not fight, but they can forbid.
  const coalition = unit.faction === 'usa' || unit.faction === 'israel';
  if (coalition && node?.host === 'iran') {
    // The no-fly zone restricts aircraft, not sea-launched missiles.
    if (noFlyZoneActive(snap) && def.category !== 'naval') {
      return reject('no-fly-zone', 'Russia has imposed a no-fly zone over Iran');
    }
    if (node.kind === 'urban' && snap.resources.politicalWill < BALANCE.congressCityStrikeWill) {
      return reject(
        'city-strike-will',
        `Congress has not authorised strikes on Iranian cities (needs ${BALANCE.congressCityStrikeWill} will)`,
        { cost: BALANCE.congressCityStrikeWill },
      );
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
  // Improvement 6: the ROE posture colours coalition firepower. Iranian
  // strikes are untouched (multiplier 1 for non-coalition attackers).
  const damage = def.atk * roeDamageMultiplier(snap, unit.faction);
  const stealth = def.stealth ?? 0;
  const dist = hexDistance({ col: unit.col, row: unit.row }, { col, row });
  const escort = snap.units.some(
    (u) =>
      u.uid !== unit.uid &&
      u.faction === unit.faction &&
      unitType(u.typeId).category === 'air' &&
      hexDistance({ col: u.col, row: u.row }, { col, row }) <= 6,
  );
  const detection = defender
    ? detectRaid(snap, map, col, row, defender, threatClass, stealth, rng)
    : { detected: false, chance: 0, sources: [] };
  let hits = 0;
  let intercepted = 0;
  let surfaceOnly = false;
  const systems = new Set<string>();

  for (let r = 0; r < rounds; r++) {
    if (defender && detection.detected) {
      const layers = defenceLayers(snap, map, col, row, defender, threatClass);
      const engagement = engageOnce(snap, defender, layers, stealth, node?.hardened ?? false, 0, rng);
      if (engagement.intercepted) {
        intercepted++;
        if (engagement.system) systems.add(engagement.system);
        continue;
      }
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
      const next = state.integrity - (damage * armour) / rounds;
      state.integrity = clamp(Math.max(next, Math.min(state.integrity, floor)), 0, state.maxIntegrity);
      surfaceOnly = surfaceOnly || !penetrates;
      if (node.host === 'iran') addIranWarCost(snap, penetrates ? 6 : 2);
      recordImpact(snap, map, node.id, 0.5, unit.faction);
    } else if (enemies.length > 0) {
      const target = enemies[Math.floor(rng() * enemies.length)]!;
      target.strength -= damage * 4.5;
      if (target.strength <= 0) {
        removeUnit(snap, target.uid);
        events.push({ text: `${target.name} destroyed by ${unit.name}.`, tone: 'good', focus: { col, row } });
      }
    }
  }

  // SEAD: a hit on a radar, airbase or naval node, or on an AD unit, degrades
  // that part of the picture for the rest of this turn.
  if (hits > 0) suppressAfterImpact(snap, map, col, row, defender, node?.id);

  if (intercepted > 0) {
    const systemsText = [...systems].join(', ');
    events.push({
      text: `Air defences (${systemsText}) intercepted ${intercepted} of ${rounds} munition${rounds === 1 ? '' : 's'} from ${unit.name}.`,
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

  // Loss risk comes from the defensive state the aircraft actually met, not a
  // flat chance. An undetected raid meets nothing.
  let attackerLost = false;
  if (def.category === 'air' && (defender === 'iran' || defender === 'houthi')) {
    const liveLayers =
      detection.detected && defender ? defenceLayers(snap, map, col, row, defender, threatClass) : [];
    const risk = attackerLossChance({
      layers: liveLayers,
      stealth,
      depth: dist,
      range: strikeRange(snap, unit),
      escort,
      hardenedTarget: node?.hardened ?? false,
    });
    if (rng() < risk) {
      attackerLost = true;
      removeUnit(snap, unit.uid);
      // Losing a US aircrew over Iran is the heaviest domestic casualty event.
      if (unit.faction === 'usa') addCasualties(snap, 2);
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

/** Special operations live in their own module (Phase 2 item 3). */
export {
  SPECIAL_OUTCOMES,
  resolveSabotage,
  type SpecialOperationResult,
  type SpecialOutcome,
} from './specialOps';

/** Iranian launchers Unit 8200 can geolocate — only revealed ones are valid targets. */
export const CYBER_TARGET_IDS = ['fateh110', 'khorramshahr', 'asm_launcher'];

export function cyberTargets(snap: GameSnapshot): UnitInstance[] {
  return snap.units.filter(
    (u) => u.faction === 'iran' && CYBER_TARGET_IDS.includes(u.typeId) && u.revealed,
  );
}

/** Unit 8200 / cyber: locate and disable one revealed Iranian launcher. */
export function resolveCyber(snap: GameSnapshot, unit: UnitInstance, rng: Rng): ResolveEvent[] {
  const launchers = cyberTargets(snap);
  if (launchers.length === 0) {
    return [
      {
        text: 'Unit 8200 found no geolocated Iranian launcher to disable.',
        tone: 'info',
        faction: unit.faction,
      },
    ];
  }
  const target = launchers[Math.floor(rng() * launchers.length)]!;
  if (rng() < 0.7) {
    removeUnit(snap, target.uid);
    unit.cooldown = 3;
    return [
      {
        text: `Unit 8200 geolocated and disabled an Iranian ${unitType(target.typeId).name}.`,
        tone: 'good',
        faction: unit.faction,
        focus: { col: target.col, row: target.row },
      },
    ];
  }
  unit.cooldown = 3;
  return [
    {
      text: 'Unit 8200 ran a cyber operation but the launcher moved before the strike.',
      tone: 'info',
      faction: unit.faction,
    },
  ];
}
