/**
 * Political friction: host-nation threat perception, chokepoint economics,
 * third-party triggers and victory conditions.
 *
 * This is the heart of the design: the player's military options are constrained
 * by the survival calculus of allies who can take their bases away.
 */
import { BALANCE } from '../core/config';
import { addCasualties } from './domestic';
import { roeEscalationMultiplier } from './roe';
import type { FactionId, GameSnapshot, MapNodeDef, ResolveEvent, SuperpowerState } from '../core/types';
import {
  clamp,
  defenderOfNode,
  isIsraelPopulation,
  isMajorGulfBase,
  nodeState,
  unitType,
} from '../core/world';
import type { TheaterMap } from '../map/TheaterMap';
import { detectMinefields, maritimeThreat } from '../core/maritime';

const HOST_ORDER: FactionId[] = ['qatar', 'uae', 'kuwait', 'bahrain', 'saudi', 'turkey'];


export function calcHormuz(snap: GameSnapshot, map: TheaterMap): number {
  const hormuz = map.nodeHexOf('hormuz');
  if (!hormuz) return 0;

  // Minefields are per-hex state now; the global minesLaid counter is only a
  // historical tally. Escort coverage is applied inside maritimeThreat.
  let score = maritimeThreat(snap, map);

  // Coalition naval presence suppresses disruption: one CSG-equivalent per group.
  const coalitionNaval = snap.units.filter((u) => {
    if (u.faction !== 'usa' && u.faction !== 'israel') return false;
    const def = unitType(u.typeId);
    if (def.category !== 'naval') return false;
    const tile = map.hexAt(u.col, u.row);
    return !!tile && tile.lon >= 47 && tile.lon <= 58 && tile.lat >= 23 && tile.lat <= 30;
  }).length;
  score -= coalitionNaval * 10;
  if (snap.hosts.bahrain?.status !== 'closed') score -= 10;

  return clamp(score, 0, 100);
}

/** Apply a missile/drone impact to a node and cascade the political effects.
 *
 * `attacker` (improvement 6) scales the escalation a strike on Iranian soil
 * generates by the attacker's ROE posture: a constrained coalition leaves a
 * softer signature (×0.5), an aggressive one a heavier one (×1.5). Attacks
 * with no known attacker or a non-coalition attacker are unaffected.
 */
export function recordImpact(snap: GameSnapshot, map: TheaterMap, nodeId: string, severity = 1, attacker?: FactionId): void {
  const node = map.nodeById.get(nodeId);
  if (!node) return;
  snap.nodeImpacts[nodeId] = (snap.nodeImpacts[nodeId] ?? 0) + 1;

  const host = snap.hosts[node.host];
  if (host) {
    host.threat = clamp(host.threat + BALANCE.hostThreatPerImpact * severity, 0, 100);
    host.reason = `Iranian retaliation landed on ${node.name}`;
  }
  if (isIsraelPopulation(nodeId)) {
    snap.meters.populationImpacts += 1;
    snap.resources.politicalWill = clamp(snap.resources.politicalWill - 2, 0, 100);
  }
  if (nodeId === 'tehran') snap.meters.leadershipStrikes += 1;
  if (node.kind === 'oil') {
    snap.meters.oilPrice = clamp(snap.meters.oilPrice + 6, 40, 220);
  }
  // Hitting Iran itself — its nuclear sites, cities and oil — is what turns a
  // regional war into a great-power crisis.
  if (node.host === 'iran') {
    addEscalation(snap, escalationForNode(node) * severity * roeEscalationMultiplier(snap, attacker ?? ''));
  }
  const defender = defenderOfNode(node);
  if (defender === 'usa') {
    snap.resources.politicalWill = clamp(snap.resources.politicalWill - 2, 0, 100);
    // Impacts on a major US base are domestic casualty events (Phase 2).
    if (isMajorGulfBase(nodeId)) addCasualties(snap, 1);
  }
  if (node.host === 'iran') addIranWarCost(snap, 4 * severity);
}

export function addIranWarCost(snap: GameSnapshot, amount: number): void {
  snap.meters.iranWarCost = clamp(snap.meters.iranWarCost + amount, 0, 140);
}

/** How much a strike on this facility inflames the nuclear-escalation clock. */
export function escalationForNode(node: MapNodeDef): number {
  if (node.id === 'tehran') return BALANCE.escalationLeadership;
  if (node.kind === 'nuclear') return BALANCE.escalationNuclearSite;
  if (node.kind === 'oil') return BALANCE.escalationOil;
  if (node.kind === 'urban') return BALANCE.escalationCity;
  return BALANCE.escalationDefault;
}

export function addEscalation(snap: GameSnapshot, amount: number): void {
  snap.meters.nuclearEscalation = clamp(snap.meters.nuclearEscalation + amount, 0, 100);
}

/** 0 = business as usual, 3 = Russia and China impose a no-fly zone. */
export function superpowerTier(stance: number): number {
  if (stance >= BALANCE.superpowerNoFlyTier) return 3;
  if (stance >= BALANCE.superpowerShieldTier) return 2;
  if (stance >= BALANCE.superpowerArmsTier) return 1;
  return 0;
}

export function maxSuperpowerTier(snap: GameSnapshot): number {
  return Math.max(superpowerTier(snap.superpowers?.russia?.stance ?? 0), superpowerTier(snap.superpowers?.china?.stance ?? 0));
}

/** Coalition aircraft may not enter Iranian airspace once the no-fly zone holds. */
export function noFlyZoneActive(snap: GameSnapshot): boolean {
  return maxSuperpowerTier(snap) >= 3;
}

/** Consumer-price pressure generated by the oil shock and the shipping war. */
export function calcInflation(snap: GameSnapshot): number {
  const oilShock = (snap.meters.oilPrice - 60) * 0.45;
  const shipping = snap.meters.hormuzTurnsAbove50 * 1.2;
  return clamp(Math.round(oilShock + shipping), 0, 45);
}

/** Political will burned each turn by prices at home. */
export function inflationWillDrain(snap: GameSnapshot): number {
  return Math.floor(snap.meters.inflation / 12);
}

/** Iran's income multiplier: expensive oil pays for the war, cheap oil starves it. */
export function iranIncomeMultiplier(snap: GameSnapshot): number {
  const oil = 0.6 + snap.meters.oilPrice / 200;
  const sanctionRelief = maxSuperpowerTier(snap) >= 1 ? 0.3 : 0;
  return oil + sanctionRelief;
}

interface TierChangeText {
  rise: string[];
  fall: string[];
}

const TIER_TEXT: TierChangeText = {
  rise: [
    'Moscow and Beijing refused to join new sanctions: Iran can still sell crude and pay for its war (income +30%).',
    'Russia rushed air-defence reloads and Chinese advisers to Iran: Iranian air defence is now harder to penetrate.',
    'Russia and China declared a no-fly zone over Iran. Coalition aircraft may no longer strike Iranian territory, and American political will bleeds every turn.',
  ],
  fall: [
    'Great-power pressure eased: Moscow and Beijing stepped back from the conflict.',
    'Russian and Chinese support for Iran has thinned; the air-defence pipeline slowed.',
    'The no-fly zone over Iran has lapsed: coalition aircraft may strike Iranian territory again.',
  ],
};

/**
 * Great-power posture, once per turn. Their tolerance follows the escalation
 * clock: nuclear sites and Iranian cities push it up, restraint lets it fall.
 */
export function updateSuperpowers(snap: GameSnapshot, events: ResolveEvent[]): void {
  if (!snap.superpowers) return;
  const escalation = snap.meters.nuclearEscalation;
  for (const sp of [snap.superpowers.russia, snap.superpowers.china] as SuperpowerState[]) {
    const pull = (escalation - sp.stance) * 0.4;
    const drift = clamp(pull, -3, 3) + (sp.id === 'china' && snap.meters.oilPrice > 110 ? 0.4 : 0);
    sp.stance = clamp(sp.stance + drift, 0, 100);
    if (snap.meters.nuclearStrikes > 0) sp.stance = 100;
    const tier = superpowerTier(sp.stance);
    if (tier > sp.tier) {
      events.push({ text: TIER_TEXT.rise[tier - 1] ?? TIER_TEXT.rise[2]!, tone: tier >= 3 ? 'bad' : 'warn' });
      sp.tier = tier;
    } else if (tier < sp.tier) {
      events.push({ text: TIER_TEXT.fall[tier] ?? TIER_TEXT.fall[0]!, tone: 'info' });
      sp.tier = tier;
    }
  }
  // A nuclear release ends great-power restraint instantly.
  if (snap.meters.nuclearStrikes > 0) {
    for (const sp of [snap.superpowers.russia, snap.superpowers.china] as SuperpowerState[]) {
      sp.tier = Math.max(sp.tier, 3);
    }
  }
}

/** Recompute Hormuz and the two "sustained pressure" clocks. */
export function updateChokepoints(snap: GameSnapshot, map: TheaterMap): void {
  detectMinefields(snap, map);
  snap.meters.hormuz = calcHormuz(snap, map);
  snap.escortCoverage = Math.max(0, (snap.escortCoverage ?? 0) - 1);
  if (snap.meters.hormuz > 50) snap.meters.hormuzTurnsAbove50 += 1;
  if (snap.meters.hormuz > 70) snap.meters.hormuzTurnsAbove70 += 1;
  snap.meters.oilPrice = clamp(
    // Global oil price index (Phase 1): Hormuz disruption, the sustained-
    // disruption premium and Suez closure all feed one visible index.
    60 + snap.meters.hormuz * 0.9 + snap.meters.hormuzTurnsAbove50 * 2 + (snap.suezClosed ? 25 : 0),
    40,
    220,
  );
  snap.meters.inflation = calcInflation(snap);
}

export function hostThresholds(host: FactionId): { restrict: number; close: number } {
  if (host === 'kuwait') return { restrict: BALANCE.kuwaitRestrict, close: BALANCE.kuwaitClose };
  if (host === 'turkey') return { restrict: 40, close: 70 };
  return { restrict: BALANCE.hostRestrictDefault, close: BALANCE.hostCloseDefault };
}

/** Applies a host-nation posture change and explains it in the turn log. */
export function setHostStatus(
  snap: GameSnapshot,
  hostId: FactionId,
  status: 'open' | 'restricted' | 'closed',
  turns: number,
  events: ResolveEvent[],
): boolean {
  const host = snap.hosts[hostId];
  if (!host) return false;
  if (status === 'closed') {
    if (host.status === 'closed') return false;
    host.status = 'closed';
    host.closedUntilTurn = snap.turn + turns;
    events.push({
      text: `${host.name} closed its bases for ${turns} turns — threat perception ${Math.round(host.threat)} (${host.reason}).`,
      tone: 'bad',
      faction: hostId,
    });
    return true;
  }
  if (host.status === 'closed' && snap.turn < host.closedUntilTurn) return false;
  if (host.status === status) {
    if (status === 'restricted') {
      events.push({
        text: `${host.name} keeps offensive missions restricted — threat perception ${Math.round(host.threat)}.`,
        tone: 'warn',
        faction: hostId,
      });
      return false;
    }
    return false;
  }
  host.status = status;
  if (status === 'restricted') {
    events.push({
      text: `${host.name} restricted offensive missions from its soil — threat perception ${Math.round(host.threat)}.`,
      tone: 'warn',
      faction: hostId,
    });
  } else {
    events.push({
      text: `${host.name} restored full base access.`,
      tone: 'good',
      faction: hostId,
    });
  }
  return true;
}

/** Decay, escalate and re-evaluate every host nation's base access. */
export function updateHosts(
  snap: GameSnapshot,
  _map: TheaterMap,
  events: ResolveEvent[],
): void {
  for (const id of HOST_ORDER) {
    const host = snap.hosts[id];
    if (!host) continue;

    if (host.status === 'closed' && snap.turn >= host.closedUntilTurn) {
      host.status = 'open';
      host.threat = Math.min(host.threat, 55);
      host.reason = `${host.name} reopened its facilities after the closure expired`;
      events.push({ text: host.reason, tone: 'info', faction: id });
    }

    if (host.status !== 'closed') {
      const hormuzPressure = snap.meters.hormuz > 50 ? Math.floor((snap.meters.hormuz - 50) / 10) : 0;
      // Imported inflation makes host governments politically nervous too.
      const pricePressure = Math.floor((snap.meters.inflation ?? 0) / 15);
      host.threat = clamp(host.threat + hormuzPressure + pricePressure - BALANCE.hostThreatDecay, 0, 100);
    }
  }
  void events;

  snap.incirlikOpen =
    snap.resources.politicalWill > 60 && (snap.hosts.turkey?.threat ?? 100) < 40;
}

/**
 * Extra range penalty when airspace or tankers are withdrawn.
 * Saudi closure costs a hex of depth; UAE withdrawal of AWACS/tankers another.
 */
export function strikeRangeModifier(snap: GameSnapshot): number {
  let mod = 0;
  if (snap.hosts.saudi?.status !== 'open') mod -= 1;
  if (snap.hosts.uae?.status !== 'open') mod -= 1;
  return mod;
}

export function purchaseCostOfInterceptors(snap: GameSnapshot, faction: FactionId, amount: number): boolean {
  const key = faction === 'israel' ? 'interceptorsIsrael' : 'interceptorsUSA';
  if (snap.resources[key] < amount) return false;
  snap.resources[key] -= amount;
  return true;
}

/** Third-party triggers, evaluated once per turn in a fixed order. */
export function thirdPartyPhase(snap: GameSnapshot, map: TheaterMap, rng: () => number, events: ResolveEvent[]): void {
  // --- Pakistan: only if Saudi survival is genuinely threatened -------------
  const abqaiq = nodeState(snap, 'abqaiq').integrity;
  const rasTanura = nodeState(snap, 'ras_tanura').integrity;
  const riyadhHits = snap.nodeImpacts.riyadh ?? 0;
  const saudiDesperate = abqaiq < 50 || rasTanura < 50 || riyadhHits >= 2;
  if (!snap.pakistanTriggered && saudiDesperate) {
    const roll = rng();
    if (roll < 0.4) {
      snap.pakistanTriggered = true;
      snap.hosts.saudi.threat = clamp(snap.hosts.saudi.threat - 15, 0, 100);
      events.push({
        text: `Pakistan intervened defensively (roll ${roll.toFixed(2)} < 0.40): two fighter squadrons and an air-defence brigade deploy to Saudi Arabia. It will not attack Iran.`,
        tone: 'warn',
        faction: 'pakistan',
      });
    } else {
      events.push({
        text: `Saudi Arabia requested Pakistani support; Islamabad declined (roll ${roll.toFixed(2)} >= 0.40).`,
        tone: 'info',
        faction: 'pakistan',
      });
    }
  }

  // --- Egypt: closes Suez under sustained Hormuz pressure -------------------
  if (!snap.suezClosed && snap.meters.hormuzTurnsAbove70 >= 5) {
    snap.suezClosed = true;
    events.push({
      text: 'Egypt closed the Suez Canal, fearing regional spillover. US reinforcement transit now takes 2 extra turns.',
      tone: 'bad',
      faction: 'egypt',
    });
  }

  // --- India: diplomatic pressure after three turns of >70% disruption ------
  if (!snap.indiaPressureApplied && snap.meters.hormuzTurnsAbove70 >= 3) {
    snap.indiaPressureApplied = true;
    snap.meters.iranWarCostThreshold = Math.max(60, snap.meters.iranWarCostThreshold - 5);
    events.push({
      text: "India applied diplomatic pressure on Tehran: Iran's ceasefire threshold fell by 5. New Delhi wants the war to end, not for Iran to lose.",
      tone: 'info',
      faction: 'india',
    });
  }

  // --- Qatar: mediation offer when the Gulf is on fire ---------------------
  if (snap.turn - snap.qatarMediationTurn >= 6 && (snap.hosts.qatar?.threat ?? 0) > 60) {
    snap.qatarMediationTurn = snap.turn;
    snap.hosts.qatar.threat = clamp(snap.hosts.qatar.threat - 6, 0, 100);
    addIranWarCost(snap, 3);
    events.push({
      text: 'Qatar offered to mediate a ceasefire; both sides quietly stepped back from the brink (Qatari threat -6, Iranian war cost +3).',
      tone: 'info',
      faction: 'qatar',
    });
  }

  // --- India's naval presence is reflected in the Hormuz calculation --------
  void map;
}

export function hostStatusLabel(host: { status: string }): string {
  return host.status === 'open' ? 'Open' : host.status === 'restricted' ? 'Restricted' : 'Closed';
}

/** Bases the player relies on, for the strategic panel. */
export function majorBaseState(snap: GameSnapshot, map: TheaterMap): Array<{ id: string; name: string; integrity: number; operational: boolean; host: string }> {
  return ['al_udeid', 'al_dhafra', 'ali_al_salem', 'nsa_bahrain'].map((id) => {
    const node = map.nodeById.get(id)!;
    const state = snap.nodes[id]!;
    return {
      id,
      name: node.name,
      integrity: state.integrity,
      operational: state.integrity > 25 && snap.hosts[node.host]?.status !== 'closed',
      host: node.host,
    };
  });
}

export function nodeImpactCount(snap: GameSnapshot, nodeId: string): number {
  return snap.nodeImpacts[nodeId] ?? 0;
}

export function isMajorBase(id: string): boolean {
  return isMajorGulfBase(id);
}
