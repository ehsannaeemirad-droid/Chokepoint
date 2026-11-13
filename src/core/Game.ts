/**
 * GameState singleton: scenario setup, order queue, turn resolution, persistence.
 * The only mutable game state lives in `snap`, which is plain JSON.
 */
import scenarioData from '../data/scenarios.json';
import { LATE_SCENARIOS } from '../data/lateScenarios';
import { TheaterMap } from '../map/TheaterMap';
import { hexId, hexDistance, type HexCoord } from '../map/hex';
import { saveGame, loadGame, type SlotId } from '../services/save';
import { BALANCE, FACTION_LABELS } from './config';
import { DEFAULT_LOGISTICS_CFG, orderReservations, runTurn } from './engine';
import type {
  DomesticConfig,
  EscalationConfig,
  FactionId,
  GameSnapshot,
  HostState,
  IranStock,
  LogisticsConfig,
  NodeState,
  Order,
  PlayableFactionId,
  ResolveEvent,
  RoeConfig,
  ScorecardConfig,
  UnitInstance,
  VictoryThresholds,
} from './types';
import { allUnitTypes, defenderOfNode, unitType } from './world';
import { hostileTo } from '../combat/combat';
import { DEFAULT_DOMESTIC_CFG, defaultDomesticState } from '../politics/domestic';
import { DEFAULT_ESCALATION_CFG, defaultEscalationState } from '../politics/escalation';
import { DEFAULT_ROE_CFG, defaultRoeState } from '../politics/roe';
import { DEFAULT_SCORECARD_CFG } from '../politics/scorecard';
import { DEFAULT_INITIATIVE_CFG, defaultIsraelInitiative } from '../politics/initiative';
import { DEFAULT_TALKS_CFG, defaultCeasefireTalks } from '../politics/talks';
import type { InitiativeConfig, Meters, Resources, TalksConfig } from './types';
import { DATA_VERSION, RULES_VERSION, SCENARIO_VERSION } from './versions';

export interface DeployEntry {
  type: string;
  lon: number;
  lat: number;
  count?: number;
}

export interface ScenarioDef {
  id: string;
  version?: number;
  name: string;
  brief: string;
  turns: number;
  tutorial?: boolean;
  victory?: VictoryThresholds | null;
  domestic?: DomesticConfig;
  initiative?: InitiativeConfig;
  talks?: TalksConfig;
  escalation?: EscalationConfig;
  logistics?: LogisticsConfig;
  roe?: RoeConfig;
  scorecard?: ScorecardConfig;
  deploy: Record<string, DeployEntry[]>;
  hosts: Record<string, number>;
  iran: IranStock;
  initialHormuz: number;
  /** Optional per-node starting integrity for later-war scenarios. */
  nodeIntegrity?: Record<string, number>;
  /** Optional overrides applied on top of the standard starting resources. */
  resources?: Partial<Resources>;
  /** Optional overrides applied on top of the standard starting meters. */
  meters?: Partial<Meters>;
  startDate?: string;
  warStarted?: boolean;
  phase?: 'prewar' | 'war';
}

export const SCENARIOS = { ...scenarioData, ...LATE_SCENARIOS } as unknown as Record<string, ScenarioDef>;

export type InteractionMode = 'idle' | 'move' | 'strike' | 'special' | 'mine' | 'clear';

export interface Selection {
  hexId: string | null;
  unitUid: string | null;
  mode: InteractionMode;
}

const HOST_DEFAULTS: FactionId[] = ['qatar', 'uae', 'kuwait', 'bahrain', 'saudi', 'turkey', 'jordan', 'egypt'];

export class Game {
  snap!: GameSnapshot;
  readonly map = new TheaterMap();
  selection: Selection = { hexId: null, unitUid: null, mode: 'idle' };
  lastEvents: ResolveEvent[] = [];
  lastResolvedTurn = 0;
  /** Replay playback disables writes so it cannot replace the live autosave. */
  persist = true;

  private listeners = new Set<() => void>();
  private uidCounter = 0;

  constructor() {
    this.start('campaign', 'usa', 20260101);
  }

  start(scenarioId: string, faction: PlayableFactionId, seed = 20260101): void {
    const scenario = SCENARIOS[scenarioId] ?? SCENARIOS.campaign!;
    this.uidCounter = 0;
    this.snap = this.buildSnapshot(structuredClone(scenario), faction, seed);
    this.selection = { hexId: null, unitUid: null, mode: 'idle' };
    this.lastEvents = [];
    this.emit();
  }

  private buildSnapshot(scenario: ScenarioDef, faction: PlayableFactionId, seed: number): GameSnapshot {
    const nodes: Record<string, NodeState> = {};
    for (const node of this.map.nodes) {
      const maxIntegrity = node.maxIntegrity ?? 100;
      const integrity = scenario.nodeIntegrity?.[node.id] ?? maxIntegrity;
      nodes[node.id] = { id: node.id, integrity, maxIntegrity, closedUntilTurn: 0, owner: node.host };
    }

    const hosts: Record<string, HostState> = {};
    for (const id of HOST_DEFAULTS) {
      const threat = scenario.hosts[id] ?? 20;
      hosts[id] = {
        id,
        name: FACTION_LABELS[id] ?? id,
        threat,
        status: 'open',
        closedUntilTurn: 0,
        reason: 'pre-war posture',
      };
    }

    const units: UnitInstance[] = [];
    for (const [ownerId, entries] of Object.entries(scenario.deploy)) {
      for (const entry of entries) {
        const def = unitType(entry.type);
        for (let i = 0; i < (entry.count ?? 1); i++) {
          const hex = this.placeHex(entry.lon, entry.lat, def.category === 'naval');
          units.push({
            uid: `u${++this.uidCounter}`,
            typeId: entry.type,
            faction: ownerId as FactionId,
            col: hex.col,
            row: hex.row,
            strength: 100,
            magazine: def.id === 'iron_beam' ? 2 : def.id === 'b2' ? 1 : def.magazine,
            cooldown: 0,
            revealed: ownerId === 'iran' ? false : true,
            name: def.name,
          });
        }
      }
    }

    const launchers = units.filter(
      (u) => u.faction === 'iran' && ['asm_launcher', 'fateh110', 'khorramshahr', 'fattah'].includes(u.typeId),
    ).length;
    const israeliAirAtStart = units.filter(
      (u) => u.faction === 'israel' && unitType(u.typeId).category === 'air',
    ).length;

    return {
      version: 1,
      rulesVersion: RULES_VERSION,
      dataVersion: DATA_VERSION,
      scenarioVersion: scenario.version ?? SCENARIO_VERSION,
      scenarioId: scenario.id,
      faction,
      seed,
      turn: 1,
      maxTurns: scenario.turns,
      status: 'playing',
      outcome: '',
      warStarted: scenario.warStarted !== false && scenario.phase !== 'prewar',
      startDate: scenario.startDate,
      phase: scenario.phase ?? (scenario.warStarted === false ? 'prewar' : 'war'),
      victory: scenario.victory ?? null,
      domesticCfg: scenario.domestic ?? DEFAULT_DOMESTIC_CFG,
      domestic: defaultDomesticState(scenario.domestic ?? DEFAULT_DOMESTIC_CFG),
      initiativeCfg: scenario.initiative ?? DEFAULT_INITIATIVE_CFG,
      israelInitiative: defaultIsraelInitiative(scenario.initiative ?? DEFAULT_INITIATIVE_CFG),
      talksCfg: scenario.talks ?? DEFAULT_TALKS_CFG,
      ceasefire: defaultCeasefireTalks(),
      escalationCfg: scenario.escalation ?? DEFAULT_ESCALATION_CFG,
      escalation: defaultEscalationState(),
      logisticsCfg: scenario.logistics ?? DEFAULT_LOGISTICS_CFG,
      roeCfg: scenario.roe ?? DEFAULT_ROE_CFG,
      roe: defaultRoeState(),
      scorecardCfg: scenario.scorecard ?? DEFAULT_SCORECARD_CFG,
      orders: [],
      units,
      nodes,
      hosts,
      resources: {
        interceptorsUSA: Math.round(BALANCE.interceptorsUSAStart * 0.7),
        interceptorsIsrael: Math.round(BALANCE.interceptorsIsraelStart * 0.7),
        interceptorsUSAReserve: Math.round(BALANCE.interceptorsUSAStart * 0.3),
        interceptorsIsraelReserve: Math.round(BALANCE.interceptorsIsraelStart * 0.3),
        politicalWill: BALANCE.politicalWillStart,
        tankerSorties: 6,
        airlift: BALANCE.sharedAirliftCapacity,
        ...(scenario.resources ?? {}),
      },
      iran: structuredClone(scenario.iran),
      meters: {
        hormuz: scenario.initialHormuz,
        hormuzTurnsAbove50: 0,
        hormuzTurnsAbove70: 0,
        populationImpacts: 0,
        leadershipStrikes: 0,
        iranWarCost: 0,
        iranWarCostThreshold: BALANCE.iranWarCostThreshold,
        legitimacy: 60,
        oilPrice: 60,
        inflation: 0,
        nuclearEscalation: 0,
        nuclearStrikes: 0,
        launchersAtStart: launchers,
        israeliAirAtStart,
        regimeIntactStreak: 0,
        occupationStreak: 0,
        maxOccupationStreak: 0,
        oilShockStreak: 0,
        domesticPressureStreak: 0,
        ...(scenario.meters ?? {}),
      },
      reinforcements: [],
      superpowers: {
        russia: { id: 'russia', stance: BALANCE.superpowerStanceStart, tier: 0 },
        china: { id: 'china', stance: BALANCE.superpowerStanceStart, tier: 0 },
      },
      greatPowerFavors: { russia: 3, china: 3 },
      iranProductionBoost: 0,
      iranIntelUntil: 0,
      pakistanTriggered: false,
      suezClosed: false,
      incirlikOpen: false,
      tutorialStep: 0,
      log: [
        { turn: 1, text: scenario.brief, tone: 'info' },
        {
          turn: 1,
          text: `You command ${FACTION_LABELS[faction]}. ${scenario.tutorial ? 'Tutorial: follow the highlighted guidance for five turns.' : `${scenario.turns} turns. Every interceptor and every missile is scarce.`}`,
          tone: 'info',
        },
      ],
      decisions: [],
      oilFacilitiesDown: [],
      nodeImpacts: {},
      indiaPressureApplied: false,
      qatarMediationTurn: 0,
      orderLog: [],
      history: [],
    };
  }

  private placeHex(lon: number, lat: number, water: boolean): HexCoord {
    const estimate = this.map.estimateHex(lon, lat);
    let best: HexCoord = estimate;
    let bestD = Number.POSITIVE_INFINITY;
    for (let radius = 0; radius <= 6; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const tile = this.map.hexAt(estimate.col + dc, estimate.row + dr);
          if (!tile) continue;
          const isWater = tile.terrain === 'deep' || tile.terrain === 'coast';
          if (isWater !== water) continue;
          const d = (tile.lon - lon) ** 2 + (tile.lat - lat) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { col: tile.col, row: tile.row };
          }
        }
      }
      if (Number.isFinite(bestD) && radius >= 2) break;
    }
    return best;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(): void {
    for (const listener of this.listeners) listener();
  }

  selectHex(col: number, row: number): void {
    const id = hexId(col, row);
    const tile = this.map.hexAt(col, row);
    const node = tile?.nodeId ? this.map.nodeById.get(tile.nodeId) : undefined;
    const hostileNode = !!node && !!defenderOfNode(node) && hostileTo(this.snap.faction, defenderOfNode(node)!);
    const hostileUnit = this.unitsAt(col, row).some(
      (u) => u.faction !== this.snap.faction && hostileTo(this.snap.faction, u.faction) && u.revealed,
    );
    const units = this.unitsAt(col, row).filter((u) => u.faction === this.snap.faction);
    // A target-first click opens the location sheet, so the player can see every
    // tool that can hit it. A friendly-only click still selects the unit.
    this.selection = {
      hexId: id,
      unitUid: hostileNode || hostileUnit ? null : (units[0]?.uid ?? null),
      mode: 'idle',
    };
    this.emit();
  }

  selectUnit(uid: string | null): void {
    const unit = uid ? this.snap.units.find((u) => u.uid === uid) : undefined;
    this.selection = {
      hexId: unit ? hexId(unit.col, unit.row) : this.selection.hexId,
      unitUid: unit?.uid ?? null,
      mode: 'idle',
    };
    this.emit();
  }

  setMode(mode: InteractionMode): void {
    this.selection = { ...this.selection, mode };
    this.emit();
  }

  clearSelection(): void {
    this.selection = { hexId: null, unitUid: null, mode: 'idle' };
    this.emit();
  }

  unitsAt(col: number, row: number): UnitInstance[] {
    return this.snap.units.filter((u) => u.col === col && u.row === row);
  }

  visibleUnits(): UnitInstance[] {
    return this.snap.units.filter((u) => u.revealed || u.faction === this.snap.faction);
  }

  get selectedUnit(): UnitInstance | null {
    if (!this.selection.unitUid) return null;
    return this.snap.units.find((u) => u.uid === this.selection.unitUid) ?? null;
  }

  get selectedHex(): HexCoord | null {
    if (!this.selection.hexId) return null;
    const [col, row] = this.selection.hexId.split(',').map(Number);
    return { col: col!, row: row! };
  }

  queueOrder(order: Order): OrderCheck {
    if (this.snap.status !== 'playing') return reject('campaign-over', 'The campaign is over');
    const check = validateOrderSafe(this, order);
    if (!check.ok) return check;
    this.snap.orders.push(order);
    this.emit();
    return { ok: true };
  }

  removeOrder(index: number): void {
    this.snap.orders.splice(index, 1);
    this.emit();
  }

  clearOrders(): void {
    this.snap.orders = [];
    this.emit();
  }

  endTurn(): { events: ResolveEvent[]; resolvedTurn: number } {
    if (this.snap.status !== 'playing') return { events: [], resolvedTurn: this.snap.turn };
    const resolvedTurn = this.snap.turn;
    const resolvedOrders = clone(this.snap.orders);
    this.snap.orderLog.push({ turn: resolvedTurn, orders: resolvedOrders });
    const result = runTurn(this.snap, this.map);
    for (const event of result.events) {
      this.snap.log.push({ turn: resolvedTurn, text: event.text, tone: event.tone, faction: event.faction });
    }
    if (this.snap.log.length > 400) this.snap.log.splice(0, this.snap.log.length - 400);
    this.snap.history = this.snap.history ?? [];
    this.snap.history.push({
      turn: resolvedTurn,
      orders: resolvedOrders,
      events: clone(result.events),
      status: this.snap.status,
      outcome: this.snap.outcome,
      summary: {
        hormuz: Math.round(this.snap.meters.hormuz),
        oilPrice: Math.round(this.snap.meters.oilPrice),
        politicalWill: Math.round(this.snap.resources.politicalWill),
        iranWarCost: Math.round(this.snap.meters.iranWarCost),
        nuclearEscalation: Math.round(this.snap.meters.nuclearEscalation),
        stability: Math.round(this.snap.iranDomestic?.stability ?? 0),
      },
    });
    this.lastEvents = result.events;
    this.lastResolvedTurn = resolvedTurn;
    this.selection.mode = 'idle';
    if (this.persist) saveGame('auto', this.snap);
    this.emit();
    return { events: result.events, resolvedTurn };
  }

  save(slot: SlotId): boolean {
    return saveGame(slot, this.snap);
  }

  load(slot: SlotId): boolean {
    const file = loadGame(slot);
    if (!file) return false;
    this.snap = file.snapshot;
    this.selection = { hexId: null, unitUid: null, mode: 'idle' };
    this.emit();
    return true;
  }

  hasOrders(): boolean {
    return this.snap.orders.length > 0;
  }

  typeName(typeId: string): string {
    return unitType(typeId).name;
  }

  availableUnitTypes(faction: FactionId): string[] {
    return allUnitTypes()
      .filter((u) => u.faction === faction)
      .map((u) => u.id);
  }
}

import { validateOrder, type OrderCheck } from './engine';
import { reject } from './rejection';

function validateOrderSafe(game: Game, order: Order) {
  return validateOrder(game.snap, game.map, order, orderReservations(game.snap));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const game = new Game();

void hexDistance;
