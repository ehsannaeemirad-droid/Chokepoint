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
  | 'deep' // open sea
  | 'coast' // coastal water (naval / amphibious only)
  | 'plains' // arid steppe / scrub
  | 'desert' // sand sea
  | 'mountain'
  | 'urban'
  | 'hardened'; // underground facility terrain

export type NodeKind = 'airbase' | 'naval' | 'chokepoint' | 'oil' | 'urban' | 'nuclear' | 'port';

export interface MapNodeDef {
  id: string;
  name: string;
  /** Persian display name (falls back to `name`). */
  name_fa?: string;
  kind: NodeKind;
  lon: number;
  lat: number;
  /** Sovereign host of the hex (country id, not necessarily an actor). */
  host: string;
  /** Factions that operate from the node (tenant / operator). */
  operators: FactionId[];
  personnel?: number;
  /** One-line real-world grounding shown in the node panel. */
  detail: string;
  /** Mechanical effect, written for the player. */
  effect: string;
  /** Persian mechanical effect (falls back to `effect`). */
  effect_fa?: string;
  hardened?: boolean;
  /**
   * Metres of rock and concrete over the working halls. Only weapons whose
   * penetration reaches this depth can damage the facility itself; everything
   * else is limited to surface infrastructure.
   */
  buried?: number;
  /** Integrity floor that non-penetrating strikes cannot push past. */
  surfaceFloor?: number;
  /** Always labelled, even when zoomed out. */
  strategic?: boolean;
  maxIntegrity?: number;
  /** Terrain override painted under the node (nuclear sites are hardened). */
  terrain?: TerrainKind;
  /** Production capacity for Iranian facilities. */
  production?: 'drone' | 'missile' | 'both';
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
  /** Persian display name (falls back to `name`). */
  name_fa?: string;
  category: UnitCategory;
  atk: number;
  def: number;
  mov: number;
  rng: number;
  /** Sorties / munitions carried by one formation. */
  magazine: number;
  /** Interception probability vs. the threat classes it covers (0-1). */
  intercept?: number;
  /** Override for hypersonic threats (only Arrow-3 has a real chance). */
  hypersonicIntercept?: number;
  /** Threat class of a munition type (for interception matching). */
  threatClass?: ThreatClass;
  /** Interception cost in interceptors. */
  interceptCost?: number;
  /** Hex radius of the defensive umbrella. */
  coverage?: number;
  /** Which incoming classes this system can engage. */
  engages?: ThreatClass[];
  stealth?: number;
  bunkerBuster?: boolean;
  /** Warhead penetration against buried facilities, in metres. */
  penetration?: number;
  /** Political will cost per use (US domestic cost). */
  politicalCost?: number;
  /** Player-facing note with real-world grounding. */
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
  /** Iranian mobile launchers start hidden; firing reveals them for a turn. */
  revealed: boolean;
  name: string;
}

export interface NodeState {
  id: string;
  integrity: number;
  maxIntegrity: number;
  /** Turn on which a closed node reopens. */
  closedUntilTurn: number;
  owner: string;
}

export interface HostState {
  id: FactionId;
  name: string;
  threat: number;
  /** 'open' | 'restricted' (defensive/ISR only) | 'closed' */
  status: 'open' | 'restricted' | 'closed';
  closedUntilTurn: number;
  /** Why the host last changed posture - surfaced in the turn log. */
  reason: string;
}

export interface Reinforcement {
  id: string;
  label: string;
  arrivesTurn: number;
  kind: 'interceptors' | 'patriot' | 'thaad' | 'air' | 'csg';
  amount: number;
  /**
   * Improvement 2: turns of delay accrued in transit from strait risk
   * (Hormuz disruption above the scenario threshold). Effective ETA is
   * `arrivesTurn + delayTurns`. Normalized to 0 for older saves.
   */
  delayTurns?: number;
}

/** Improvement 2: in-transit logistics thresholds (scenario data). */
export interface LogisticsConfig {
  /** Accrue one delay turn per turn while Hormuz disruption is above this. */
  interdictHormuz: number;
  /** A single package can never slip by more than this many turns. */
  maxDelay: number;
}

/** Improvement 6: coalition rules-of-engagement postures. */
export type RoePosture = 'constrained' | 'standard' | 'aggressive';

/** What one posture does. All values are scenario data. */
export interface RoeEffects {
  /** Multiplier on coalition strike damage (node and unit hits). */
  damageMultiplier: number;
  /** Multiplier on the escalation generated by coalition strikes on Iran. */
  escalationMultiplier: number;
  /** When true, coalition strikes on Iranian urban nodes are forbidden. */
  urbanBlocked: boolean;
  /** Congressional support drift per turn while the posture holds. */
  congressPerTurn: number;
  /** Host-nation threat drift per turn while the posture holds. */
  hostThreatPerTurn: number;
}

export type RoeConfig = Record<RoePosture, RoeEffects>;

/** Mutable ROE state carried on the snapshot. */
export interface RoeState {
  posture: RoePosture;
}

/** Improvement 7: which side a scorecard axis belongs to and what it weighs. */
export interface ScorecardAxisDef {
  side: 'iran' | 'coalition';
  weight: number;
}

/** Scorecard axis weights (scenario data). Definitions live in scorecard.ts. */
export interface ScorecardConfig {
  axes: Record<string, ScorecardAxisDef>;
}

/** One graded axis of the terminal settlement. */
export interface ScorecardAxis {
  id: string;
  side: 'iran' | 'coalition';
  score: number;
  weight: number;
}

/**
 * Improvement 7: the multi-axis graded settlement, computed once at the
 * terminal turn and stored on the snapshot. Both totals are normalized to
 * their side's own weight sum (0-100); the margin picks the verdict.
 */
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

export interface IranStock {
  resources: number;
  drones: number;
  fateh: number;
  khorramshahr: number;
  fattah: number;
  asm: number;
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
  /** Strategic nuclear release. Rarely the right answer; always world-changing. */
  | { kind: 'nuclear'; nodeId: string }
  | { kind: 'hold'; unitUid: string }
  /** Phase 2: the administration makes its case at home (costs political capital). */
  | { kind: 'communicate' }
  /** Phase 3: set the US stance toward Israel's operational initiative. */
  | { kind: 'israel-initiative'; stance: IsraelStance }
  /** Phase 3: respond to Qatar's ceasefire mediation. */
  | { kind: 'talks'; stance: TalksStance }
  /** Improvement 6: set the coalition rules-of-engagement posture. */
  | { kind: 'roe'; posture: RoePosture };

export type IsraelStance = 'approved' | 'constrained' | 'accepted';
export type TalksStance = 'pursue' | 'walk';

/** Phase 3: the Israeli AI initiative track (0-100) and the US stance toward it. */
export interface IsraelInitiative {
  /** 0-100. Rises with Iranian launch capability and US legitimacy. */
  level: number;
  stance: IsraelStance;
  /** Turn of the last stance order (cooldown gate). */
  lastOrderTurn: number;
}

/** Phase 3: Qatar-mediated ceasefire talks. */
export interface CeasefireTalks {
  state: 'none' | 'offered' | 'talks' | 'collapsed';
  /** 0-100; at `agreeProgress` the campaign ends with a tiered armistice. */
  progress: number;
  startedTurn: number;
  /** Last turn an offer was made or the talks collapsed (re-offer cooldown). */
  lastEventTurn: number;
  /** Escalation meter value at the last talks update (strike penalty trigger). */
  lastEscalation: number;
}

/** Phase 3: scenario thresholds for the Israeli initiative track. */
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

/** One rung of the escalation ladder (thresholds on `nuclearEscalation`). */
export interface EscalationRung {
  /** Ladder rung N is reached when `nuclearEscalation >= threshold`. */
  threshold: number;
  /** Great-power stance drift per turn while this rung holds. */
  drift: number;
  /** Host-nation threat added per turn while this rung holds. */
  hostThreat: number;
}

/**
 * A named one-shot escalation red line. `label`/`label_fa` are display strings;
 * the condition fields are interpreted by `src/politics/escalation.ts`.
 */
export interface RedLineDef {
  id: string;
  label: string;
  label_fa?: string;
  /** Fires when any nuclear weapon has been used. */
  nuclearUse?: boolean;
  /** Fires when `leadershipStrikes >= n`. */
  leadershipStrikes?: number;
  /** Fires when every Iranian nuclear facility is at zero integrity. */
  nuclearSitesDown?: boolean;
  /** Fires when `hormuzTurnsAbove70 >= n`. */
  hormuzTurnsAbove70?: number;
  /** Consequences, applied exactly once when the line is crossed. */
  escalationJump: number;
  superpowerJump: number;
  willDrop: number;
  iranMobilization: number;
}

/** Escalation ladder & red-line thresholds (scenario data). */
export interface EscalationConfig {
  levels: EscalationRung[];
  redLines: RedLineDef[];
}

/** Mutable escalation state: current rung and the red lines already crossed. */
export interface EscalationState {
  level: number;
  fired: string[];
}

/** Phase 3: scenario thresholds for the Qatar talks. */
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

/** US congressional restriction levels on offensive operations (Phase 2). */
export type RestrictionLevel = 'none' | 'restricted' | 'suspended';

/**
 * Phase 2 domestic system thresholds. Scenario data (`campaign.domestic`),
 * carried on the snapshot (`snap.domesticCfg`) like the victory block.
 */
export interface DomesticConfig {
  congressStart: number;
  economyStart: number;
  restrictCongress: number;
  suspendCongress: number;
  liftBuffer: number;
  noticeTurns: number;
  collapsePressure: number;
  /** Consecutive turns at/above collapsePressure before the collapse fires. */
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

/** Mutable US domestic state (Phase 2). One gauge, two drivers. Plain JSON. */
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

/** Structural type for a salvo, kept separate to avoid import cycles. */
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
  /** Camera focus for the cinematic sequence. */
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
  /** Seeded roll result, for deterministic replay auditing. */
  roll?: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

/**
 * Per-scenario victory thresholds (Phase 1). Stored on the snapshot so the
 * outcome check, the UI and the replay all read the same numbers. `null`
 * disables the path system (the tutorial keeps its scripted ending).
 */
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
  /** Consumer-price inflation in the belligerent economies (0-45). */
  inflation: number;
  /** Nuclear escalation clock (0-100); superpower hostility follows it. */
  nuclearEscalation: number;
  /** Nuclear weapons actually used in this campaign (0 or more). */
  nuclearStrikes: number;
  /** Baselines used by victory checks. */
  launchersAtStart: number;
  /** Israeli air formations at scenario start — baseline for the offensive-capacity index. */
  israeliAirAtStart: number;
  /** Consecutive turns with the regime intact (victory path 1). */
  regimeIntactStreak: number;
  /** Current consecutive turns of US ground occupation of Iranian nodes (victory path 2). */
  occupationStreak: number;
  /** Longest occupation streak ever reached — once past the threshold, the path is lost for good. */
  maxOccupationStreak: number;
  /** Consecutive turns with the oil price index above the shock threshold (victory path 3). */
  oilShockStreak: number;
  /** Consecutive turns at or above the domestic collapse pressure (Phase 2). */
  domesticPressureStreak: number;
}

/**
 * Great-power posture. Russia and China do not fight the coalition, but their
 * tolerance sets hard limits on what Washington and Jerusalem are allowed to do:
 * arms and air-defence resupply to Iran, UN cover, and eventually a no-fly zone.
 */
export interface SuperpowerState {
  id: 'russia' | 'china';
  /** 0-100 hostility toward the coalition. */
  stance: number;
  /** Cached escalation tier (0-3), used to announce changes once. */
  tier: number;
}

export interface Resources {
  interceptorsUSA: number;
  interceptorsIsrael: number;
  politicalWill: number;
  tankerSorties: number;
  /** Shared US airlift capacity, allocated per turn. */
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
  /** Scenario victory thresholds; `null` for the tutorial and pre-Phase-1 saves. */
  victory: VictoryThresholds | null;
  /** US domestic system state (Phase 2). Normalized in for older saves. */
  domestic?: DomesticState;
  /** Domestic thresholds for this scenario (Phase 2). */
  domesticCfg?: DomesticConfig;
  /** Israeli AI initiative track (Phase 3). Normalized in for older saves. */
  israelInitiative?: IsraelInitiative;
  /** Israeli initiative thresholds for this scenario (Phase 3). */
  initiativeCfg?: InitiativeConfig;
  /** Qatar ceasefire talks state (Phase 3). Normalized in for older saves. */
  ceasefire?: CeasefireTalks;
  /** Qatar talks thresholds for this scenario (Phase 3). */
  talksCfg?: TalksConfig;
  /** Escalation ladder thresholds (improvement 1). Normalized in for older saves. */
  escalationCfg?: EscalationConfig;
  /** Mutable escalation state: rung + crossed red lines. Normalized in for older saves. */
  escalation?: EscalationState;
  /** In-transit logistics thresholds (improvement 2). Normalized in for older saves. */
  logisticsCfg?: LogisticsConfig;
  /** ROE posture effects per posture (improvement 6). Normalized in for older saves. */
  roeCfg?: RoeConfig;
  /** Mutable ROE state (improvement 6). Normalized in for older saves. */
  roe?: RoeState;
  /** Scorecard axis weights (improvement 7). Normalized in for older saves. */
  scorecardCfg?: ScorecardConfig;
  /** The graded terminal settlement, built once when the campaign ends (improvement 7). */
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
  /** Per-node impact counters, used by the Pakistan and Israel triggers. */
  nodeImpacts: Record<string, number>;
  indiaPressureApplied: boolean;
  qatarMediationTurn: number;
  /** Orders submitted each turn, for deterministic replay auditing. */
  orderLog: Array<{ turn: number; orders: Order[] }>;
}

export interface HexAddress {
  col: number;
  row: number;
}
