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
  | { kind: 'hold'; unitUid: string };

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
