/** Shared numeric/visual constants. Single source of truth for palette + balance. */

export const COLORS = {
  bg: '#0E1216',
  chrome: '#171B20',
  chromeRaised: '#222831',
  line: '#333B45',
  text: '#F5F5F5',
  textDim: '#9AA7B4',

  water: '#2C5F8A',
  coast: '#3A749E',
  desert: '#D4B896',
  plains: '#A9A276',
  mountain: '#6B6B6B',
  urban: '#9E9E9E',
  hardened: '#4B4B55',

  alert: '#D32F2F',
  warn: '#FFA000',
  ok: '#388E3C',
  info: '#3C8DBC',
} as const;

export const FACTION_COLORS: Record<string, string> = {
  usa: '#1E4D8C',
  israel: '#0038B8',
  iran: '#239F40',
  houthi: '#8B5E3C',
  saudi: '#3F6B4F',
  pakistan: '#2F6B5E',
  india: '#B07A2A',
  qatar: '#7A2F3A',
  uae: '#2F6B7A',
  kuwait: '#5A4A2F',
  bahrain: '#4A2F6B',
  jordan: '#6B5A4A',
  egypt: '#8A7A3F',
  turkey: '#7A3F2F',
  neutral: '#5C6670',
};

export const FACTION_LABELS: Record<string, string> = {
  usa: 'United States',
  israel: 'Israel',
  iran: 'Iran',
  houthi: 'Houthi Movement',
  saudi: 'Saudi Arabia',
  pakistan: 'Pakistan',
  india: 'India',
  qatar: 'Qatar',
  uae: 'UAE',
  kuwait: 'Kuwait',
  bahrain: 'Bahrain',
  jordan: 'Jordan',
  egypt: 'Egypt',
  turkey: 'Turkey',
};

/** Theatre grid geometry (see map/geography.ts for the geographic bounds). */
export const GRID = {
  cols: 79,
  rows: 70,
  hexRadius: 30,
} as const;

export const BALANCE = {
  // Interceptor economy
  interceptorsUSAStart: 100,
  interceptorsIsraelStart: 60,
  airliftResupplyUSATurns: 2,
  airliftResupplyUSAAmount: 12,
  airliftResupplyIsraelTurns: 4,
  airliftResupplyIsraelAmount: 15,
  sharedAirliftCapacity: 10,

  // Sortie and damage-control regeneration
  airRearmPerTurn: 2,
  baseRepairPerTurn: 5,

  // Host nation politics (0-100 threat perception)
  hostRestrictDefault: 70,
  hostCloseDefault: 90,
  kuwaitRestrict: 60,
  kuwaitClose: 85,
  hostThreatPerImpact: 9,
  hostThreatDecay: 3,
  hostThreatPerHormuzDecade: 1,
  signalThreatReduction: 12,

  // Iran
  iranStartResources: 140,
  iranResourceIncome: 10,
  iranDroneCost: 5,
  iranFatehCost: 10,
  iranKhorramshahrCost: 25,
  iranFattahCost: 40,
  iranDroneBuild: 4,
  iranFatehBuild: 2,

  // Victory clocks
  israelSurviveTurns: 25,
  iranSurviveTurns: 30,
  iranWarCostThreshold: 100,

  // US political will
  politicalWillStart: 50,
  politicalWillPerReinforce: 6,
  politicalWillPerB2: 6,
  politicalWillPerLoss: 4,

  // Great-power tolerance and nuclear escalation
  superpowerStanceStart: 18,
  /** Escalation added by a strike, by target class. */
  escalationNuclearSite: 8,
  escalationLeadership: 10,
  escalationOil: 3,
  escalationCity: 6,
  escalationDefault: 1,
  /** Stance at which Russia/China start constraining the coalition. */
  superpowerArmsTier: 40,
  superpowerShieldTier: 60,
  superpowerNoFlyTier: 80,
  /** Political will required before Congress authorises strikes on Iranian cities. */
  congressCityStrikeWill: 20,
  nuclearWillCost: 25,
  /** Mutual deterrence: no coalition strike on Iran below this escalation. */
  nuclearReleaseEscalation: 20,
} as const;

export const ZOOM = { min: 0.42, max: 1.9, initial: 0.98, focus: 1.1 } as const;
