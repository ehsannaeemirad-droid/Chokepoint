/**
 * Shared, serialisable type definitions for Chokepoint.
 * Everything here must survive JSON.stringify / JSON.parse unchanged.
 */

export type FactionId =
  | 'usa'
  | 'israel'
  | 'iran'
  | 'houthi'
  | 'saudi'
  | 'pakistan'
  | 'india'
  | 'qatar'
  | 'uae'
  | 'kuwait'
  | 'bahrain'
  | 'jordan'
  | 'egypt'
  | 'turkey';

export type PlayableFactionId = 'usa' | 'israel' | 'iran';

export type TerrainKind =
  | 'deep'
  | 'coast'
  | 'plains'
  | 'desert'
  | 'mountain'
  | 'urban'
  | 'hardened';

export type NodeKind =
  | 'airbase'
  | 'naval'
  | 'chokepoint'
  | 'oil'
  | 'urban'
  | 'nuclear'
  | 'missile-industry'
  | 'port';

/** Munition lines a facility can build. */
export type ProductionLine = 'missile' | 'drone';

/**
 * Facility taxonomy (Phase 1a). A node's `kind` is what the map shows; the
 * facility category is what the site actually does. Nuclear sites enrich,
 * convert or store — they never assemble munitions.
 */
export type FacilityCategory =
  | 'nuclear-enrichment'
  | 'nuclear-conversion'
  | 'nuclear-storage'
  | 'missile-production'
  | 'drone-production'
  | 'defence-industry'
  | 'weapons-storage'
  | 'command'
  | 'radar'
  | 'naval-facility'
  | 'port-logistics';

export interface MapNodeDef {
  id: string;
  name: string;
  name_fa?: string;
  kind: NodeKind;
  lon: number;
  lat: number;
  host: string;
  operators: FactionId[];
  personnel?: number;
  detail: string;
  effect: string;
  effect_fa?: string;
  hardened?: boolean;
  buried?: number;
  surfaceFloor?: number;
  strategic?: boolean;
  maxIntegrity?: number;
  terrain?: TerrainKind;
  /** Munition lines the site can build; absent means no production. */
  productionLines?: ProductionLine[];
  /** Taxonomy role of the facility. */
  facility?: FacilityCategory;
  /** Labelled abstraction: stocks regenerated underground each turn. */
  undergroundRegen?: { drones?: number; missiles?: number };
  /** Evidence note for sites added from open-source reporting (Phase 1c). */
  provenance?: string;
}

export type UnitCategory =
  | 'air'
  | 'ground'
  | 'naval'
  | 'defense'
  | 'missile'
  | 'drone'
  | 'production'
  | 'specops'
  | 'cyber';

export interface UnitTypeDef {
  id: string;
  faction: FactionId;
  name: string;
  name_fa?: string;
  category: UnitCategory;
  atk: number;
  def: number;
  mov: number;
  rng: number;
  magazine: number;
  intercept?: number;
  hypersonicIntercept?: number;
  threatClass?: ThreatClass;
  interceptCost?: number;
  coverage?: number;
  engages?: ThreatClass[];
  /** Layered air-defence role; absent means the unit does not engage. */
  adLayer?: 'long' | 'medium' | 'point';
  stealth?: number;
  bunkerBuster?: boolean;
  penetration?: number;
  politicalCost?: number;
  note: string;
}

export type ThreatClass = 'drone' | 'cruise' | 'ballistic' | 'hypersonic';

export interface UnitInstance {
  uid: string;
  typeId: string;
  faction: FactionId;
  col: number;
  row: number;
  strength: number;
  magazine: number;
  cooldown: number;
  revealed: boolean;
  /** Turn until which SEAD suppresses this unit; absent means never suppressed. */
  suppressedUntilTurn?: number;
  name: string;
}

export interface NodeState {
  id: string;
  integrity: number;
  maxIntegrity: number;
  closedUntilTurn: number;
  owner: string;
}

export interface HostState {
  id: FactionId;
  name: string;
  threat: number;
  status: 'open' | 'restricted' | 'closed';
  closedUntilTurn: number;
  reason: string;
}

export interface Reinforcement {
  id: string;
  label: string;
  arrivesTurn: number;
  kind: 'interceptors' | 'patriot' | 'thaad' | 'air' | 'csg';
  amount: number;
  delayTurns?: number;
}

export interface LogisticsConfig {
  interdictHormuz: number;
  maxDelay: number;
}

export type RoePosture = 'constrained' | 'standard' | 'aggressive';

export interface RoeEffects {
  damageMultiplier: number;
  escalationMultiplier: number;
  urbanBlocked: boolean;
  congressPerTurn: number;
  hostThreatPerTurn: number;
}

export type RoeConfig = Record<RoePosture, RoeEffects>;

export interface RoeState {
  posture: RoePosture;
}

export interface ScorecardAxisDef {
  side: 'iran' | 'coalition';
  weight: number;
}

export interface ScorecardConfig {
  axes: Record<string, ScorecardAxisDef>;
}

export interface ScorecardAxis {
  id: string;
  side: 'iran' | 'coalition';
  score: number;
  weight: number;
}

export interface Scorecard {
  axes: ScorecardAxis[];
  iranTotal: number;
  coalitionTotal: number;
  margin: number;
  verdict:
    | 'decisive-iran'
    | 'clear-iran'
    | 'narrow-iran'
    | 'stalemate'
    | 'narrow-coalition'
    | 'clear-coalition'
    | 'decisive-coalition';
}

/** Delivery class of an Iranian munition: the airframe family it belongs to. */
export type DeliveryClass = 'drone' | 'fateh' | 'khorramshahr' | 'fattah' | 'asm';

/**
 * The Iranian arsenal (Phase 1b). The four stock domains are deliberately
 * separate so no number is silently reused for two things:
 *
 * - `rounds` is a mated round (airframe + conventional warhead) a launcher fires;
 * - `airframes` and `warheads` are the two halves that production builds;
 * - `launchers` is the delivery platform budget per turn;
 * - `nuclearMaterial` is warhead-grade material and never feeds `rounds`.
 */
export interface IranStock {
  resources: number;
  /** Mated rounds by delivery class — what a launcher actually fires. */
  rounds: Record<DeliveryClass, number>;
  /** Airframes built and awaiting a warhead, by production line. */
  airframes: Record<ProductionLine, number>;
  /** Conventional warheads awaiting an airframe. Never nuclear. */
  warheads: { conventional: number };
  /** Launch platforms per turn, plus this turn's usage. */
  launchers: { drone: number; ballistic: number; usedDrone: number; usedBallistic: number };
  /** Warhead-grade material, in warhead equivalents; disjoint from `rounds`. */
  nuclearMaterial: number;
  mines: number;
  minesLaid: number;
  fac: number;
}

export type Order =
  | { kind: 'move'; unitUid: string; col: number; row: number }
  | { kind: 'strike'; unitUid: string; col: number; row: number; nodeId?: string }
  | { kind: 'produce'; unitTypeId: string; count: number }
  | { kind: 'diplomacy'; host: FactionId }
  | { kind: 'reinforce'; packageId: string }
  | { kind: 'airlift' }
  | { kind: 'special'; unitUid: string; col: number; row: number }
  | { kind: 'cyber'; unitUid: string; col: number; row: number }
  | { kind: 'mine'; unitUid: string; col: number; row: number; count: number }
  | { kind: 'clear'; unitUid: string; col: number; row: number }
  | { kind: 'escort'; unitUid: string }
  | { kind: 'nuclear'; nodeId: string }
  | { kind: 'hold'; unitUid: string }
  | { kind: 'communicate' }
  | { kind: 'israel-initiative'; stance: IsraelStance }
  | { kind: 'talks'; stance: TalksStance }
  | { kind: 'roe'; posture: RoePosture };

export type IsraelStance = 'approved' | 'constrained' | 'accepted';
export type TalksStance = 'pursue' | 'walk';

export interface IsraelInitiative {
  level: number;
  stance: IsraelStance;
  lastOrderTurn: number;
}

export interface CeasefireTalks {
  state: 'none' | 'offered' | 'talks' | 'collapsed';
  progress: number;
  startedTurn: number;
  lastEventTurn: number;
  lastEscalation: number;
}

export interface InitiativeConfig {
  aggressiveThreshold: number;
  driftPerTurn: number;
  launchWeight: number;
  legitimacyWeight: number;
  launchersWeight: number;
  stockDivisor: number;
  approveGain: number;
  constrainDrop: number;
  orderCooldown: number;
}

export interface EscalationRung {
  threshold: number;
  drift: number;
  hostThreat: number;
}

export interface RedLineDef {
  id: string;
  label: string;
  label_fa?: string;
  nuclearUse?: boolean;
  leadershipStrikes?: number;
  nuclearSitesDown?: boolean;
  hormuzTurnsAbove70?: number;
  escalationJump: number;
  superpowerJump: number;
  willDrop: number;
  iranMobilization: number;
}

export interface EscalationConfig {
  levels: EscalationRung[];
  redLines: RedLineDef[];
}

export interface EscalationState {
  level: number;
  fired: string[];
}

export interface TalksConfig {
  offerWarCostShare: number;
  offerHormuzTurns: number;
  offerWill: number;
  lapseTurns: number;
  reofferCooldown: number;
  startProgress: number;
  baseProgress: number;
  warCostBonus: number;
  warCostBonusShare: number;
  escalationPenalty: number;
  agreeProgress: number;
  favorableWarCostShare: number;
  favorableBases: number;
}

export type RestrictionLevel = 'none' | 'restricted' | 'suspended';

export interface DomesticConfig {
  congressStart: number;
  economyStart: number;
  restrictCongress: number;
  suspendCongress: number;
  liftBuffer: number;
  noticeTurns: number;
  collapsePressure: number;
  collapseTurns: number;
  casualtyCongressDrop: number;
  casualtyDropCap: number;
  escalationCongressStep: number;
  recoveryPerTurn: number;
  communicate: { cost: number; cooldown: number; gain: number };
  economyAirliftStep: number;
  economyResupplyStep: number;
  resupplyFloor: number;
  baselineResupply: number;
  baselineAirliftRegen: number;
}

export interface DomesticState {
  congress: number;
  economy: number;
  pressure: number;
  restriction: RestrictionLevel;
  pending: { level: RestrictionLevel; effectiveTurn: number } | null;
  cooldown: number;
  casualtiesTurn: number;
  casualtiesTotal: number;
  lastResupply: number;
  lastAirliftRegen: number;
}

export type EventTone = 'info' | 'good' | 'bad' | 'warn';

export interface SalvoSpecLike {
  threat: ThreatClass;
  damage: number;
  count: number;
  label: string;
}

export interface ResolveEvent {
  text: string;
  tone: EventTone;
  faction?: FactionId;
  focus?: { col: number; row: number };
}

export interface LogEntry {
  turn: number;
  text: string;
  tone: EventTone;
  faction?: FactionId;
}

export interface DecisionRecord {
  turn: number;
  faction: FactionId;
  summary: string;
  roll?: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface VictoryThresholds {
  regimeSurvival: { finalTurns: number; nuclearIntegrityThreshold: number };
  occupation: { nodesRequired: number; turnsRequired: number };
  oilShock: { indexThreshold: number; consecutiveTurns: number };
  israeliDegradation: { capacityThreshold: number; byTurn: number };
}

export interface Meters {
  hormuz: number;
  hormuzTurnsAbove50: number;
  hormuzTurnsAbove70: number;
  populationImpacts: number;
  leadershipStrikes: number;
  iranWarCost: number;
  iranWarCostThreshold: number;
  legitimacy: number;
  oilPrice: number;
  inflation: number;
  nuclearEscalation: number;
  nuclearStrikes: number;
  launchersAtStart: number;
  israeliAirAtStart: number;
  regimeIntactStreak: number;
  occupationStreak: number;
  maxOccupationStreak: number;
  oilShockStreak: number;
  domesticPressureStreak: number;
}

export interface SuperpowerState {
  id: 'russia' | 'china';
  stance: number;
  tier: number;
}

export interface Resources {
  interceptorsUSA: number;
  interceptorsIsrael: number;
  interceptorsUSAReserve?: number;
  interceptorsIsraelReserve?: number;
  politicalWill: number;
  tankerSorties: number;
  airlift: number;
}

export interface GameSnapshot {
  version: 1;
  scenarioId: string;
  faction: PlayableFactionId;
  seed: number;
  turn: number;
  maxTurns: number;
  status: GameStatus;
  outcome: string;
  warStarted?: boolean;
  startDate?: string;
  phase?: 'prewar' | 'war';
  victory: VictoryThresholds | null;
  domestic?: DomesticState;
  domesticCfg?: DomesticConfig;
  israelInitiative?: IsraelInitiative;
  initiativeCfg?: InitiativeConfig;
  ceasefire?: CeasefireTalks;
  talksCfg?: TalksConfig;
  escalationCfg?: EscalationConfig;
  escalation?: EscalationState;
  logisticsCfg?: LogisticsConfig;
  roeCfg?: RoeConfig;
  roe?: RoeState;
  scorecardCfg?: ScorecardConfig;
  scorecard?: Scorecard;
  orders: Order[];
  units: UnitInstance[];
  nodes: Record<string, NodeState>;
  hosts: Record<string, HostState>;
  resources: Resources;
  iran: IranStock;
  meters: Meters;
  superpowers: Record<'russia' | 'china', SuperpowerState>;
  reinforcements: Reinforcement[];
  pakistanTriggered: boolean;
  suezClosed: boolean;
  incirlikOpen: boolean;
  tutorialStep: number;
  log: LogEntry[];
  decisions: DecisionRecord[];
  oilFacilitiesDown: string[];
  nodeImpacts: Record<string, number>;
  /** Radar/airbase nodes degraded by SEAD, keyed by node id, valued by turn. */
  adSuppression?: Record<string, number>;
  /** Per-hex minefields; unknown until a coalition warship locates them. */
  minefields?: Record<string, { mines: number; detected: boolean; laidTurn: number }>;
  /** Escort sorties currently covering shipping; decays one per turn. */
  escortCoverage?: number;
  indiaPressureApplied: boolean;
  qatarMediationTurn: number;
  orderLog: Array<{ turn: number; orders: Order[] }>;
}

export interface HexAddress {
  col: number;
  row: number;
}
