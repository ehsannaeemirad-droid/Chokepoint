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
import { productionSites } from '../core/production';
import { deliverMatedRounds, spendIranRounds, totalRounds } from '../core/inventory';
import type { TheaterMap } from '../map/TheaterMap';
import { resolveIncoming, resolveStrike, strikeRange, validateStrike } from '../combat/combat';
import { iranLaunchPressure, initiativeCfg, israelPackages } from '../politics/initiative';
import { addIranWarCost, nodeImpactCount, setHostStatus } from '../politics/politics';
import { runTree, type ActionNode, type AiContext, type ConditionNode, type TreeNode } from './tree';
import { applyOrder, validateOrder } from '../core/engine';
import { isSeaHex, minefields } from '../core/maritime';
import {
  belowReserve,
  coalitionTargetScore,
  doctrineFor,
  iranTargetScore,
  spendableStock,
  wantsMaritime,
  type DoctrineProfile,
} from './doctrine';

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
    totalRounds(ctx.snap.iran) > 0,
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
    // A Houthi launch costs the same kind of ammunition an Iranian launch does.
    if (unit.magazine <= 0) continue;
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
      unit.magazine -= 1;
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
    unit.magazine -= 1;
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

/**
 * Iranian target list, scored by faction objectives and doctrine rather than a
 * fixed weight table. Airbases and ports matter because they sustain the
 * coalition; cities are a deliberate escalation cost.
 */
function iranTargets(
  ctx: AiContext,
  unit: { col: number; row: number; typeId: string },
  doctrine: DoctrineProfile,
) {
  const range = unitType(unit.typeId).rng;
  const candidates: Array<{ col: number; row: number; nodeId?: string; weight: number; label: string }> = [];

  for (const node of ctx.map.nodeById.values()) {
    const defender = defenderOfNode(node);
    if (defender !== 'usa' && defender !== 'israel' && node.host !== 'saudi') continue;
    const hex = ctx.map.nodeHexOf(node.id);
    if (!hex) continue;
    if (hexDistance({ col: unit.col, row: unit.row }, hex) > range) continue;
    if (nodeState(ctx.snap, node.id).integrity <= 0) continue;
    const state = nodeState(ctx.snap, node.id);
    // A wrecked facility is worth less: expected damage falls with integrity,
    // so the AI spreads its salvos instead of overkilling one airbase.
    const health = 0.35 + 0.65 * (state.integrity / Math.max(1, state.maxIntegrity));
    const weight = Math.round(iranTargetScore(node, doctrine) * health * 10) / 10;
    if (weight <= 0) continue;
    candidates.push({ col: hex.col, row: hex.row, nodeId: node.id, weight, label: node.name });
  }

  const csg = ctx.snap.units.find((u) => u.typeId === 'csg');
  if (csg && hexDistance({ col: unit.col, row: unit.row }, { col: csg.col, row: csg.row }) <= range) {
    candidates.push({
      col: csg.col,
      row: csg.row,
      weight: 4 * (doctrine.targetBias.naval ?? 1),
      label: 'US carrier strike group',
    });
  }
  return candidates;
}

function iranSalvo(ctx: AiContext): boolean {
  const launchers = ctx.snap.units.filter(
    (u) => u.faction === 'iran' && ['fateh110', 'khorramshahr', 'fattah', 'asm_launcher'].includes(u.typeId),
  );
  if (launchers.length === 0) return false;

  const doctrine = doctrineFor('iran', ctx.snap.scenarioId);
  const firingDoctrine = doctrine;
  const usedTargets = new Set<string>();
  let fired = 0;
  // Only a saturation doctrine spends the second salvo slot; other Iranian
  // doctrines keep a launcher in reserve and keep the campaign from ending in
  // a single week of missile fire.
  const attempts = firingDoctrine.id === 'saturation' ? 2 : 1;
  for (let a = 0; a < attempts; a++) {
    const unit = launchers[Math.floor(ctx.rng() * launchers.length)]!;
    const candidates = iranTargets(ctx, unit, firingDoctrine).filter(
      (c) => !c.nodeId || !usedTargets.has(c.nodeId),
    );
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

    // Salvos draw on the same mated-round stock and launcher budget the player
    // uses; the logged count is what was actually fired, not what was wanted.
    const salvos: SalvoSpecLike[] = [];
    const stock = ctx.snap.iran.rounds;
    const scale = firingDoctrine.salvoScale;
    if (stock.drone > 0) {
      const want = Math.min(spendableStock(stock.drone, firingDoctrine), Math.round((3 + ctx.rng() * 4) * scale));
      const count = spendIranRounds(ctx.snap, 'drone', want);
      if (count > 0) salvos.push({ threat: 'drone', damage: 3, count, label: 'Shahed one-way attack drones' });
    }
    if (stock.khorramshahr > 0 && ctx.rng() < 0.55) {
      const want = Math.min(
        spendableStock(stock.khorramshahr, firingDoctrine),
        Math.max(1, Math.round((1 + ctx.rng() * 2) * scale)),
      );
      const count = spendIranRounds(ctx.snap, 'khorramshahr', want);
      if (count > 0) salvos.push({ threat: 'ballistic', damage: 8, count, label: 'Khorramshahr ballistic missiles' });
    } else if (stock.fateh > 0) {
      const want = Math.min(
        spendableStock(stock.fateh, firingDoctrine),
        Math.max(1, Math.round((2 + ctx.rng() * 2) * scale)),
      );
      const count = spendIranRounds(ctx.snap, 'fateh', want);
      if (count > 0) salvos.push({ threat: 'ballistic', damage: 5, count, label: 'Fateh-110 ballistic missiles' });
    }
    if (stock.fattah > 0 && ctx.rng() < 0.18) {
      const count = spendIranRounds(ctx.snap, 'fattah', Math.min(1, spendableStock(stock.fattah, firingDoctrine)));
      if (count > 0) salvos.push({ threat: 'hypersonic', damage: 10, count, label: 'Fattah hypersonic missile' });
    }
    if (salvos.length === 0) continue;
    if (choice.nodeId) usedTargets.add(choice.nodeId);

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

/**
 * Iranian maritime action: lay a field inside the chokepoint approach, or move
 * the mine group toward it first. Uses the same validate/apply pipeline as the
 * player, so no hidden mines appear.
 */
function iranMaritime(ctx: AiContext, doctrine: DoctrineProfile): boolean {
  if (!wantsMaritime(ctx.snap, doctrine)) return false;
  const miner = ctx.snap.units.find((u) => u.faction === 'iran' && u.typeId === 'mine_layer' && u.cooldown === 0);
  const hormuz = ctx.map.nodeHexOf('hormuz');
  if (!miner || !hormuz) return false;
  if (ctx.snap.iran.mines <= 0) return false;
  if (ctx.rng() >= clamp(0.55 * doctrine.mineBias, 0, 0.95)) return false;

  // The chokepoint marker itself may sit on a land hex, so search the water
  // around it: any sea hex inside the chokepoint approach counts.
  const seaHexes: Array<{ col: number; row: number }> = [];
  for (let col = hormuz.col - 2; col <= hormuz.col + 2; col++) {
    for (let row = hormuz.row - 2; row <= hormuz.row + 2; row++) {
      const d = hexDistance(hormuz, { col, row });
      if (d > 4) continue;
      if (!isSeaHex(ctx.map, col, row)) continue;
      seaHexes.push({ col, row });
    }
  }
  const rng = unitType(miner.typeId).rng;
  const layHex = seaHexes.find(
    (h) => hexDistance({ col: miner.col, row: miner.row }, h) <= rng && !(ctx.snap.minefields?.[`${h.col},${h.row}`]?.mines),
  );
  if (layHex) {
    const order = { kind: 'mine' as const, unitUid: miner.uid, col: layHex.col, row: layHex.row, count: 2 };
    if (validateOrder(ctx.snap, ctx.map, order, undefined, 'iran').ok) {
      applyOrder(ctx.snap, ctx.map, order, ctx.rng, ctx.events);
      ctx.events.push({
        text: 'Iranian mine warfare group laid a field in the Hormuz approach.',
        tone: 'warn',
        faction: 'iran',
        focus: layHex,
      });
      return true;
    }
  }

  // Not in range: close the distance to the nearest approach hex.
  const dest = seaHexes
    .map((h) => ({ h, d: hexDistance({ col: miner.col, row: miner.row }, h) }))
    .sort((a, b) => a.d - b.d)[0]?.h;
  if (!dest) return false;
  const step = { kind: 'move' as const, unitUid: miner.uid, col: miner.col, row: miner.row };
  const maxMove = Math.min(unitType(miner.typeId).mov, Math.max(1, hexDistance({ col: miner.col, row: miner.row }, dest)));
  for (let i = 0; i < maxMove; i++) {
    if (step.row > dest.row) step.row -= 1;
    else if (step.row < dest.row) step.row += 1;
    else if (step.col > dest.col) step.col -= 1;
    else if (step.col < dest.col) step.col += 1;
  }
  if (validateOrder(ctx.snap, ctx.map, step, undefined, 'iran').ok) {
    applyOrder(ctx.snap, ctx.map, step, ctx.rng, ctx.events);
    ctx.events.push({
      text: 'Iranian mine warfare group is moving toward the chokepoint.',
      tone: 'info',
      faction: 'iran',
      focus: { col: step.col, row: step.row },
    });
    return true;
  }
  return false;
}

function iranProduce(ctx: AiContext): boolean {
  const stock = ctx.snap.iran;
  stock.resources += 10;
  let produced = 0;
  // Facility data decides who produces: intact missile and drone lines only.
  for (const site of productionSites(ctx.map.nodes, ctx.snap, 'missile')) {
    const scale = site.integrity < 50 ? 0.5 : 1;
    deliverMatedRounds(ctx.snap, 'fateh', Math.round(scale * 0.6));
    deliverMatedRounds(ctx.snap, 'khorramshahr', Math.round(scale * 0.4));
    produced += 1;
  }
  for (const site of productionSites(ctx.map.nodes, ctx.snap, 'drone')) {
    const scale = site.integrity < 50 ? 0.5 : 1;
    deliverMatedRounds(ctx.snap, 'drone', Math.round(2 * scale));
    produced += 1;
  }
  const doctrine = doctrineFor('iran', ctx.snap.scenarioId);
  const buildCap = doctrine.id === 'ammoConservation' ? 2 : 6;
  while (stock.resources >= 20 && produced < buildCap) {
    stock.resources -= 5;
    deliverMatedRounds(ctx.snap, 'drone', 4);
    produced++;
  }
  if (produced > 0) {
    ctx.events.push({
      text: `Iran's underground lines produced ${stock.rounds.drone > 0 ? 'drones and missiles' : 'munitions'}; stock now ${stock.rounds.drone} drones, ${stock.rounds.fateh + stock.rounds.khorramshahr} ballistic missiles.`,
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

/**
 * Coalition AI: strike package(s) per turn at Iran's programme.
 *
 * Phase 3: the Israeli tempo is governed by the initiative track — while
 * Washington constrains Jerusalem, Israel flies no offensive sorties; above
 * the aggressive threshold (or when approved) it flies a second package.
 */
/** Coalition target list: every live Iranian node, ordered by doctrine score. */
export function coalitionTargets(
  ctx: AiContext,
  faction: 'usa' | 'israel',
  doctrine: DoctrineProfile,
): Array<{ id: string; score: number; col: number; row: number }> {
  const out: Array<{ id: string; score: number; col: number; row: number }> = [];
  for (const node of ctx.map.nodeById.values()) {
    if (node.host !== 'iran') continue;
    if (nodeState(ctx.snap, node.id).integrity <= 0) continue;
    const hex = ctx.map.nodeHexOf(node.id);
    if (!hex) continue;
    out.push({ id: node.id, score: coalitionTargetScore(faction, node, doctrine), col: hex.col, row: hex.row });
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** Coalition maritime work: clear located minefields, otherwise escort shipping. */
function coalitionMaritime(ctx: AiContext, doctrine: DoctrineProfile): number {
  if (!wantsMaritime(ctx.snap, doctrine)) return 0;
  const ships = ctx.snap.units.filter(
    (u) =>
      u.faction === ctx.faction &&
      unitType(u.typeId).category === 'naval' &&
      u.cooldown === 0 &&
      u.magazine > 0,
  );
  if (ships.length === 0) return 0;

  const fields = minefields(ctx.snap);
  for (const [key, field] of Object.entries(fields)) {
    if (!field.detected || field.mines <= 0) continue;
    const [col, row] = key.split(',').map(Number);
    if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
    for (const ship of ships) {
      const order = { kind: 'clear' as const, unitUid: ship.uid, col, row };
      if (!validateOrder(ctx.snap, ctx.map, order, undefined, ctx.faction).ok) continue;
      applyOrder(ctx.snap, ctx.map, order, ctx.rng, ctx.events);
      ctx.events.push({
        text: `${ctx.faction === 'usa' ? 'US' : 'Israeli'} mine clearance is under way at ${col},${row}.`,
        tone: 'info',
        faction: ctx.faction,
        focus: { col, row },
      });
      return 1;
    }
  }

  if ((ctx.snap.escortCoverage ?? 0) < 1) {
    const ship = ships.find((u) => u.magazine > 0) ?? ships[0]!;
    const order = { kind: 'escort' as const, unitUid: ship.uid };
    if (validateOrder(ctx.snap, ctx.map, order, undefined, ctx.faction).ok) {
      applyOrder(ctx.snap, ctx.map, order, ctx.rng, ctx.events);
      ctx.events.push({
        text: 'Coalition warships begin escorting shipping through the Gulf.',
        tone: 'info',
        faction: ctx.faction,
      });
      return 1;
    }
  }
  return 0;
}

function coalitionAi(ctx: AiContext, faction: 'usa' | 'israel'): boolean {
  const doctrine = doctrineFor(faction, ctx.snap.scenarioId);
  const aircraft = ctx.snap.units.filter(
    (u) =>
      u.faction === faction &&
      unitType(u.typeId).category === 'air' &&
      !belowReserve(u.magazine, doctrine) &&
      u.cooldown === 0,
  );
  if (aircraft.length === 0) return false;

  let packages = doctrine.maxPackages;
  if (faction === 'israel') {
    packages = Math.min(packages, israelPackages(ctx.snap));
    if (packages <= 0) {
      ctx.events.push({
        text: 'Israeli aircraft stand down from offensive missions under the US constraint.',
        tone: 'info',
        faction: 'israel',
      });
      return false;
    }
  }

  // Re-read the target list before each package: availability changes as soon
  // as a strike resolves, and a destroyed site must not be attacked again.
  const targets = coalitionTargets(ctx, faction, doctrine);
  let flown = 0;
  for (let attempt = 0; attempt < packages && flown < doctrine.strikeCap; attempt++) {
    let struck = false;
    for (const target of targets) {
      if (struck) break;
      if (nodeState(ctx.snap, target.id).integrity <= 0) continue;
      for (const plane of aircraft) {
        if (plane.magazine <= 0 || plane.cooldown > 0) continue;
        const check = validateStrike(ctx.snap, ctx.map, plane, target.col, target.row, target.id);
        if (!check.ok) continue;
        if (hexDistance({ col: plane.col, row: plane.row }, target) > strikeRange(ctx.snap, plane)) continue;
        ctx.events.push({
          text: `${faction === 'usa' ? 'US' : 'Israeli'} aircraft launched against ${ctx.map.nodeById.get(target.id)?.name} (doctrine: ${doctrine.label}).`,
          tone: 'info',
          faction,
          focus: { col: target.col, row: target.row },
        });
        const result = resolveStrike(ctx.snap, ctx.map, plane, target.col, target.row, target.id, ctx.rng);
        ctx.events.push(...result.events);
        struck = true;
        flown++;
        break;
      }
    }
  }

  if (flown < doctrine.strikeCap) flown += coalitionMaritime(ctx, doctrine);

  if (packages > 1 && flown > 0) {
    const cfg = initiativeCfg(ctx.snap);
    ctx.events.push({
      text: `Israel flies an expanded strike package under its initiative track (${Math.round(ctx.snap.israelInitiative?.level ?? 0)} ≥ ${cfg.aggressiveThreshold}).`,
      tone: 'warn',
      faction: 'israel',
    });
  }
  void iranLaunchPressure;
  return flown > 0;
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
      else {
        // Maritime pressure is part of the Iranian plan, not a random rider on
        // a missile salvo.
        iranMaritime(ctx, doctrineFor('iran', snap.scenarioId));
        evaluate(faction, ctx, 'iranMilitary');
      }
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
