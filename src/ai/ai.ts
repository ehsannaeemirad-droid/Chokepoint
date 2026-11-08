/**
 * AI factions. Posture decisions come from JSON behaviour trees; military actions
 * are handlers that emit ordinary game events, so everything the AI does is
 * visible in the turn log.
 */
import treeData from '../data/ai/trees.json';
import { factionRng } from '../core/rng';
import type { FactionId, GameSnapshot, ResolveEvent, SalvoSpecLike } from '../core/types';
import { clamp, defenderOfNode, nodeState, removeUnit, unitType } from '../core/world';
import { hexDistance } from '../map/hex';
import type { TheaterMap } from '../map/TheaterMap';
import { resolveIncoming, resolveStrike, strikeRange, validateStrike } from '../combat/combat';
import { addIranWarCost, nodeImpactCount, setHostStatus } from '../politics/politics';
import { runTree, type ActionNode, type AiContext, type ConditionNode, type TreeNode } from './tree';

const TREES = treeData as unknown as Record<string, TreeNode>;

type Check = (ctx: AiContext, node: ConditionNode) => boolean;
type Action = (ctx: AiContext, node: ActionNode) => boolean;

function pick<T>(items: T[], rng: () => number): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length)];
}

const checks: Record<string, Check> = {
  hostThreatAbove: (ctx, node) => (ctx.snap.hosts[node.host ?? '']?.threat ?? 0) > (node.value ?? 0),
  nodeIntegrityBelow: (ctx, node) => nodeState(ctx.snap, node.node ?? '').integrity < (node.value ?? 0),
  oilDamaged: (ctx, node) =>
    nodeState(ctx.snap, 'abqaiq').integrity < (node.value ?? 50) ||
    nodeState(ctx.snap, 'ras_tanura').integrity < (node.value ?? 50),
  turnAbove: (ctx, node) => ctx.snap.turn > (node.value ?? 0),
  incirlikAllowed: (ctx) => ctx.snap.incirlikOpen,
  hasStock: (ctx) =>
    ctx.snap.iran.drones + ctx.snap.iran.fateh + ctx.snap.iran.khorramshahr + ctx.snap.iran.fattah > 0,
};

const actions: Record<string, Action> = {
  closeHost: (ctx, node) => setHostStatus(ctx.snap, (node.host ?? 'qatar') as FactionId, 'closed', node.turns ?? 5, ctx.events),
  restrictHost: (ctx, node) => setHostStatus(ctx.snap, (node.host ?? 'qatar') as FactionId, 'restricted', 0, ctx.events),
  openHost: (ctx, node) => setHostStatus(ctx.snap, (node.host ?? 'qatar') as FactionId, 'open', 0, ctx.events),
  closeAirspace: (ctx) => {
    const changed = setHostStatus(ctx.snap, 'saudi', 'restricted', 0, ctx.events);
    if (ctx.snap.hosts.saudi.status === 'restricted') {
      ctx.events.push({
        text: 'Saudi Arabia closed its airspace to offensive missions: US and Israeli strikes must route around the kingdom (-1 range).',
        tone: 'warn',
        faction: 'saudi',
      });
    }
    return changed;
  },
  withdrawSupport: (ctx) => {
    const changed = setHostStatus(ctx.snap, 'uae', 'restricted', 0, ctx.events);
    if (changed) {
      ctx.events.push({
        text: 'The UAE withdrew AWACS and tanker support: coalition strike range falls by 1 hex.',
        tone: 'warn',
        faction: 'uae',
      });
    }
    return changed;
  },
  counterHouthi: (ctx) => {
    const targets = ctx.snap.units.filter((u) => u.faction === 'houthi');
    const target = pick(targets, ctx.rng);
    if (!target) return false;
    if (ctx.rng() < 0.6) {
      removeUnit(ctx.snap, target.uid);
      ctx.events.push({
        text: `Saudi counter-battery fire destroyed a Houthi ${unitType(target.typeId).name} after oil infrastructure was hit.`,
        tone: 'info',
        faction: 'saudi',
        focus: { col: target.col, row: target.row },
      });
    } else {
      ctx.events.push({
        text: 'Saudi counter-battery fire missed a Houthi launch site.',
        tone: 'info',
        faction: 'saudi',
      });
    }
    return true;
  },
  regroup: (ctx) => {
    ctx.events.push({
      text: "Houthi forces are regrouping after the damage to Sana'a; attack tempo halves.",
      tone: 'info',
      faction: 'houthi',
    });
    return true;
  },
  houthiAttack: (ctx) => houthiAttack(ctx),
  iranSalvo: (ctx) => iranSalvo(ctx),
  iranProduce: (ctx) => iranProduce(ctx),
  iranReposition: (ctx) => iranReposition(ctx),
};

function houthiAttack(ctx: AiContext): boolean {
  const units = ctx.snap.units.filter((u) => u.faction === 'houthi');
  if (units.length === 0) return false;
  const sanaa = nodeState(ctx.snap, 'sanaa').integrity;
  if (sanaa < 20) return false;
  const tempo = ctx.snap.meters.hormuz > 60 ? 2 : 1;
  let fired = 0;

  for (let i = 0; i < tempo; i++) {
    const unit = pick(units, ctx.rng);
    if (!unit) break;
    const def = unitType(unit.typeId);
    const candidates: Array<{ col: number; row: number; nodeId?: string; weight: number }> = [];
    for (const [id, weight] of [
      ['ras_tanura', 3],
      ['abqaiq', 2],
      ['tel_aviv', 2],
      ['jerusalem', 1],
      ['sanaa', 0],
    ] as const) {
      if (weight <= 0) continue;
      const hex = ctx.map.nodeHexOf(id);
      if (!hex) continue;
      if (hexDistance({ col: unit.col, row: unit.row }, hex) > def.rng) continue;
      candidates.push({ col: hex.col, row: hex.row, nodeId: id, weight });
    }
    const usNaval = ctx.snap.units.find((u) => u.faction === 'usa' && unitType(u.typeId).category === 'naval');
    if (usNaval && hexDistance({ col: unit.col, row: unit.row }, { col: usNaval.col, row: usNaval.row }) <= def.rng) {
      candidates.push({ col: usNaval.col, row: usNaval.row, weight: 2 });
    }
    const total = candidates.reduce((sum, c) => sum + c.weight, 0);
    if (total === 0) {
      ctx.snap.meters.oilPrice = clamp(ctx.snap.meters.oilPrice + 2, 40, 220);
      ctx.events.push({
        text: 'Houthi anti-ship attacks closed the Bab al-Mandeb shipping lane for a day; insurance costs rose.',
        tone: 'info',
        faction: 'houthi',
      });
      fired++;
      continue;
    }
    let roll = ctx.rng() * total;
    let choice = candidates[0]!;
    for (const c of candidates) {
      roll -= c.weight;
      if (roll <= 0) {
        choice = c;
        break;
      }
    }
    const isDrone = unit.typeId === 'houthi_drone';
    const salvo: SalvoSpecLike = isDrone
      ? { threat: 'drone', damage: 3, count: 2 + Math.floor(ctx.rng() * 3), label: 'Houthi drones' }
      : { threat: unit.typeId === 'houthi_asm' ? 'cruise' : 'ballistic', damage: 4, count: 1, label: 'Houthi missiles' };
    const label = choice.nodeId ? `the ${ctx.map.nodeById.get(choice.nodeId)?.name}` : 'a US naval group';
    ctx.events.push({
      text: `Houthi launch against ${label}.`,
      tone: 'warn',
      faction: 'houthi',
      focus: { col: choice.col, row: choice.row },
    });
    ctx.events.push(
      ...resolveIncoming(
        ctx.snap,
        ctx.map,
        { attacker: 'houthi', col: choice.col, row: choice.row, nodeId: choice.nodeId, salvos: [salvo] },
        ctx.rng,
      ),
    );
    fired++;
  }

  if (fired > 0) {
    ctx.snap.hosts.saudi.threat = clamp(ctx.snap.hosts.saudi.threat + 2, 0, 100);
    ctx.snap.meters.oilPrice = clamp(ctx.snap.meters.oilPrice + 3, 40, 220);
  }
  return fired > 0;
}

function iranTargets(ctx: AiContext, unit: { col: number; row: number; typeId: string }) {
  const range = unitType(unit.typeId).rng;
  const candidates: Array<{ col: number; row: number; nodeId?: string; weight: number; label: string }> = [];
  const push = (nodeId: string, weight: number) => {
    const hex = ctx.map.nodeHexOf(nodeId);
    if (!hex) return;
    if (hexDistance({ col: unit.col, row: unit.row }, hex) > range) return;
    const node = ctx.map.nodeById.get(nodeId);
    candidates.push({ col: hex.col, row: hex.row, nodeId, weight, label: node?.name ?? nodeId });
  };
  push('al_udeid', 3);
  push('al_dhafra', 3);
  push('ali_al_salem', 3);
  push('nsa_bahrain', 2);
  push('prince_sultan', 2);
  push('tel_aviv', 2);
  push('jerusalem', 2);
  push('abqaiq', 1);
  push('ras_tanura', 1);

  const csg = ctx.snap.units.find((u) => u.typeId === 'csg');
  if (csg && hexDistance({ col: unit.col, row: unit.row }, { col: csg.col, row: csg.row }) <= range) {
    candidates.push({ col: csg.col, row: csg.row, weight: 3, label: 'US carrier strike group' });
  }
  return candidates;
}

function iranSalvo(ctx: AiContext): boolean {
  const launchers = ctx.snap.units.filter(
    (u) => u.faction === 'iran' && ['fateh110', 'khorramshahr', 'fattah', 'asm_launcher'].includes(u.typeId),
  );
  if (launchers.length === 0) return false;

  let fired = 0;
  const attempts = 2;
  for (let a = 0; a < attempts; a++) {
    const unit = launchers[Math.floor(ctx.rng() * launchers.length)]!;
    const candidates = iranTargets(ctx, unit);
    if (candidates.length === 0) continue;
    const total = candidates.reduce((s, c) => s + c.weight, 0);
    let roll = ctx.rng() * total;
    let choice = candidates[0]!;
    for (const c of candidates) {
      roll -= c.weight;
      if (roll <= 0) {
        choice = c;
        break;
      }
    }

    const salvos: SalvoSpecLike[] = [];
    if (ctx.snap.iran.drones > 0) {
      const count = Math.min(ctx.snap.iran.drones, 3 + Math.floor(ctx.rng() * 4));
      ctx.snap.iran.drones -= count;
      salvos.push({ threat: 'drone', damage: 3, count, label: 'Shahed one-way attack drones' });
    }
    if (ctx.snap.iran.khorramshahr > 0 && ctx.rng() < 0.55) {
      const count = Math.min(ctx.snap.iran.khorramshahr, 1 + Math.floor(ctx.rng() * 2));
      ctx.snap.iran.khorramshahr -= count;
      salvos.push({ threat: 'ballistic', damage: 8, count, label: 'Khorramshahr ballistic missiles' });
    } else if (ctx.snap.iran.fateh > 0) {
      const count = Math.min(ctx.snap.iran.fateh, 2 + Math.floor(ctx.rng() * 2));
      ctx.snap.iran.fateh -= count;
      salvos.push({ threat: 'ballistic', damage: 5, count, label: 'Fateh-110 ballistic missiles' });
    }
    if (ctx.snap.iran.fattah > 0 && ctx.rng() < 0.18) {
      ctx.snap.iran.fattah -= 1;
      salvos.push({ threat: 'hypersonic', damage: 10, count: 1, label: 'Fattah hypersonic missile' });
    }
    if (ctx.snap.iran.mines > 0 && ctx.rng() < 0.2) {
      ctx.snap.iran.mines -= 1;
      ctx.snap.iran.minesLaid += 1;
      ctx.events.push({
        text: 'IRGC-N laid another minefield near Hormuz (+15% disruption).',
        tone: 'warn',
        faction: 'iran',
        focus: ctx.map.nodeHexOf('hormuz'),
      });
    }
    if (salvos.length === 0) continue;

    ctx.events.push({
      text: `Iran launched ${salvos.reduce((n, s) => n + s.count, 0)} munitions at ${choice.label}.`,
      tone: 'bad',
      faction: 'iran',
      focus: { col: choice.col, row: choice.row },
    });
    ctx.events.push(
      ...resolveIncoming(
        ctx.snap,
        ctx.map,
        {
          attacker: 'iran',
          col: choice.col,
          row: choice.row,
          nodeId: choice.nodeId,
          salvos,
          revealUnitUid: unit.uid,
        },
        ctx.rng,
      ),
    );
    fired++;
  }
  return fired > 0;
}

function iranProduce(ctx: AiContext): boolean {
  const stock = ctx.snap.iran;
  stock.resources += 10;
  let produced = 0;
  const facilities: Array<[string, number, number]> = [
    ['natanz', 2, 1],
    ['isfahan', 0, 1],
    ['fordow', 0, 1],
  ];
  for (const [id, drones, missiles] of facilities) {
    const integrity = nodeState(ctx.snap, id).integrity;
    if (integrity <= 0) continue;
    const scale = integrity < 50 ? 0.5 : 1;
    stock.drones += Math.round(drones * scale);
    stock.fateh += Math.round(missiles * scale * 0.6);
    stock.khorramshahr += Math.round(missiles * scale * 0.4);
    produced += 1;
  }
  while (stock.resources >= 20 && produced < 6) {
    stock.resources -= 5;
    stock.drones += 4;
    produced++;
  }
  if (produced > 0) {
    ctx.events.push({
      text: `Iran's underground lines produced ${stock.drones > 0 ? 'drones and missiles' : 'munitions'}; stock now ${stock.drones} drones, ${stock.fateh + stock.khorramshahr} ballistic missiles.`,
      tone: 'info',
      faction: 'iran',
    });
  }
  return produced > 0;
}

function iranReposition(ctx: AiContext): boolean {
  const hidden = ctx.snap.units.filter((u) => u.faction === 'iran');
  let moved = 0;
  for (const unit of hidden) {
    if (moved >= 3) break;
    if (ctx.rng() < 0.5) continue;
    unit.revealed = false;
    moved++;
  }
  if (moved > 0) {
    ctx.events.push({
      text: `Iran dispersed ${moved} launch crews to new hides; satellite tasking must find them again.`,
      tone: 'info',
      faction: 'iran',
    });
  }
  return moved > 0;
}

/** Scripted tutorial opponent: predictable salvos that teach interception. */
function tutorialIran(ctx: AiContext): void {
  const base = ctx.map.nodeHexOf('al_udeid');
  if (!base) return;
  const script: Record<number, SalvoSpecLike[]> = {
    2: [{ threat: 'drone', damage: 3, count: 4, label: 'Shahed drones' }],
    3: [{ threat: 'drone', damage: 3, count: 5, label: 'Shahed drones' }],
    4: [{ threat: 'ballistic', damage: 5, count: 3, label: 'Fateh-110 missiles' }],
    5: [
      { threat: 'drone', damage: 3, count: 6, label: 'Shahed drones' },
      { threat: 'ballistic', damage: 5, count: 2, label: 'Fateh-110 missiles' },
    ],
  };
  const salvos = script[ctx.snap.turn];
  if (!salvos) return;
  ctx.events.push({
    text: `Iran launched a scripted retaliation at Al Udeid (tutorial, turn ${ctx.snap.turn}).`,
    tone: 'bad',
    faction: 'iran',
    focus: base,
  });
  ctx.events.push(
    ...resolveIncoming(ctx.snap, ctx.map, { attacker: 'iran', col: base.col, row: base.row, nodeId: 'al_udeid', salvos }, ctx.rng),
  );
}

/** Coalition AI: one strike package per turn at Iran's programme. */
function coalitionAi(ctx: AiContext, faction: 'usa' | 'israel'): boolean {
  const aircraft = ctx.snap.units.filter(
    (u) =>
      u.faction === faction &&
      unitType(u.typeId).category === 'air' &&
      u.magazine > 0 &&
      u.cooldown === 0,
  );
  if (aircraft.length === 0) return false;

  const targetIds = ['natanz', 'fordow', 'isfahan', 'bandar_abbas']
    .map((id) => ({ id, integrity: nodeState(ctx.snap, id).integrity }))
    .filter((t) => t.integrity > 0)
    .sort((a, b) => b.integrity - a.integrity);

  for (const target of targetIds) {
    const hex = ctx.map.nodeHexOf(target.id);
    if (!hex) continue;
    for (const plane of aircraft) {
      const check = validateStrike(ctx.snap, ctx.map, plane, hex.col, hex.row, target.id);
      if (!check.ok) continue;
      if (hexDistance({ col: plane.col, row: plane.row }, hex) > strikeRange(ctx.snap, plane)) continue;
      ctx.events.push({
        text: `${faction === 'usa' ? 'US' : 'Israeli'} aircraft launched against ${ctx.map.nodeById.get(target.id)?.name}.`,
        tone: 'info',
        faction,
        focus: { col: hex.col, row: hex.row },
      });
      const result = resolveStrike(ctx.snap, ctx.map, plane, hex.col, hex.row, target.id, ctx.rng);
      ctx.events.push(...result.events);
      return true;
    }
  }
  return false;
}

function evaluate(_faction: FactionId, ctx: AiContext, treeName: string): void {
  const tree = TREES[treeName];
  if (!tree) return;
  runTree(tree, ctx, checks, actions);
}

/** Full AI military phase, in fixed order for determinism. */
export function runAiPhase(snap: GameSnapshot, map: TheaterMap, events: ResolveEvent[]): void {
  const player = snap.faction;
  const order: Array<'houthi' | 'iran' | 'usa' | 'israel'> = ['houthi', 'iran', 'usa', 'israel'];

  for (const faction of order) {
    if (faction === player) continue;
    const ctx: AiContext = {
      snap,
      map,
      faction,
      rng: factionRng(snap.seed, snap.turn, faction),
      events,
    };
    if (faction === 'houthi') evaluate(faction, ctx, 'houthi');
    else if (faction === 'iran') {
      if (snap.scenarioId === 'tutorial') tutorialIran(ctx);
      else evaluate(faction, ctx, 'iranMilitary');
    } else coalitionAi(ctx, faction);
  }

  // Saudi Arabia's own military posture (counter-battery against the Houthis).
  const saudiCtx: AiContext = {
    snap,
    map,
    faction: 'saudi',
    rng: factionRng(snap.seed, snap.turn, 'saudi'),
    events,
  };
  evaluate('saudi', saudiCtx, 'saudi');
}

/** Host-nation posture phase, run after threat perception updates. */
export function runHostPostures(snap: GameSnapshot, map: TheaterMap, events: ResolveEvent[]): void {
  for (const host of ['qatar', 'uae', 'kuwait', 'bahrain', 'turkey'] as const) {
    const ctx: AiContext = {
      snap,
      map,
      faction: host,
      rng: factionRng(snap.seed, snap.turn, host),
      events,
    };
    evaluate(host, ctx, host);
  }
}

export function aiTargetWeights(snap: GameSnapshot): Array<{ id: string; weight: number }> {
  return [
    { id: 'al_udeid', weight: 3 },
    { id: 'al_dhafra', weight: 3 },
    { id: 'ali_al_salem', weight: 3 },
    { id: 'nsa_bahrain', weight: 2 },
    { id: 'abqaiq', weight: 2 },
    { id: 'ras_tanura', weight: 2 },
    { id: 'tel_aviv', weight: 2 },
    { id: 'riyadh', weight: snap.hosts.saudi.status !== 'open' ? 1 : 0 },
  ];
}

void defenderOfNode;
void addIranWarCost;
void nodeImpactCount;
