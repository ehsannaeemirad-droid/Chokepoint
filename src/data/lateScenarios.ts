/**
 * Later-war scenarios (SPEC Phase 5).
 *
 * These are derived from the campaign baseline, then explicitly override the
 * date, deployment, stocks, infrastructure, politics and economy. Deriving
 * keeps the shared rules/config in one place; every difference that matters is
 * listed here rather than hidden in a copied JSON blob.
 */
import campaignData from './scenarios.json';
import type { DeployEntry, ScenarioDef } from '../core/Game';
import type { IranStock, Meters, Resources } from '../core/types';
import { SCENARIO_VERSION } from '../core/versions';

const base = campaignData.campaign as unknown as ScenarioDef;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function scaleDeploy(deploy: Record<string, DeployEntry[]>, factor: number): Record<string, DeployEntry[]> {
  return Object.fromEntries(
    Object.entries(deploy).map(([faction, entries]) => [
      faction,
      entries.map((entry) => ({
        ...entry,
        count: Math.max(1, Math.round((entry.count ?? 1) * factor)),
      })),
    ]),
  );
}

function scenario(overrides: Partial<ScenarioDef> & Pick<ScenarioDef, 'id' | 'name' | 'brief'>): ScenarioDef {
  return {
    ...clone(base),
    version: SCENARIO_VERSION,
    ...overrides,
  };
}

const openingIran: IranStock = {
  ...clone(base.iran),
  resources: 140,
  rounds: { drone: 62, fateh: 30, khorramshahr: 12, fattah: 4, asm: 9 },
  launchers: { drone: 11, ballistic: 8, usedDrone: 0, usedBallistic: 0 },
  mines: 3,
  minesLaid: 1,
  fac: 4,
};

const attritionIran: IranStock = {
  ...clone(base.iran),
  resources: 58,
  rounds: { drone: 31, fateh: 13, khorramshahr: 4, fattah: 2, asm: 5 },
  airframes: { drone: 4, missile: 2 },
  warheads: { conventional: 3 },
  launchers: { drone: 7, ballistic: 5, usedDrone: 0, usedBallistic: 0 },
  mines: 6,
  minesLaid: 9,
  fac: 3,
};

const renewedIran: IranStock = {
  ...clone(base.iran),
  resources: 205,
  rounds: { drone: 88, fateh: 42, khorramshahr: 18, fattah: 10, asm: 15 },
  airframes: { drone: 10, missile: 4 },
  warheads: { conventional: 6 },
  launchers: { drone: 13, ballistic: 10, usedDrone: 0, usedBallistic: 0 },
  mines: 9,
  minesLaid: 17,
  fac: 4,
};

const openingMeters: Partial<Meters> = {
  oilPrice: 79,
  inflation: 1,
  legitimacy: 54,
  nuclearEscalation: 6,
};

const attritionMeters: Partial<Meters> = {
  oilPrice: 119,
  inflation: 7,
  legitimacy: 43,
  nuclearEscalation: 34,
  iranWarCost: 92,
  hormuzTurnsAbove50: 5,
  hormuzTurnsAbove70: 3,
};

const renewedMeters: Partial<Meters> = {
  oilPrice: 97,
  inflation: 4,
  legitimacy: 38,
  nuclearEscalation: 57,
  iranWarCost: 48,
  hormuzTurnsAbove50: 2,
};

const openingResources: Partial<Resources> = {
  politicalWill: 58,
  interceptorsUSA: 63,
  interceptorsIsrael: 39,
  tankerSorties: 5,
};

const attritionResources: Partial<Resources> = {
  politicalWill: 42,
  interceptorsUSA: 31,
  interceptorsIsrael: 19,
  interceptorsUSAReserve: 8,
  interceptorsIsraelReserve: 5,
  tankerSorties: 3,
  airlift: 18,
};

const renewedResources: Partial<Resources> = {
  politicalWill: 49,
  interceptorsUSA: 56,
  interceptorsIsrael: 34,
  tankerSorties: 4,
};

export const LATE_SCENARIOS: Record<string, ScenarioDef> = {
  opening: scenario({
    id: 'opening',
    name: 'Opening Campaign',
    brief:
      '28 February 2026 — the first day of the war. Strikes have already landed, air defences are alert and the Gulf is closing to shipping. Stocks are below the pre-war baseline and the diplomatic clock is already running.',
    turns: 30,
    startDate: '2026-02-28',
    phase: 'war',
    warStarted: true,
    initialHormuz: 41,
    hosts: { ...base.hosts, qatar: 31, uae: 24, kuwait: 37, bahrain: 27, saudi: 36, turkey: 51, jordan: 27, egypt: 31 },
    iran: openingIran,
    deploy: clone(base.deploy),
    meters: openingMeters,
    resources: openingResources,
  }),
  attrition: scenario({
    id: 'attrition',
    name: 'Attrition Campaign',
    brief:
      '24 March 2026 — a month of exchange has ground both sides down. Iran’s launchers and stocks are thinner, Gulf bases are damaged, host governments are losing patience and Hormuz is half-strangled. Every sortie now trades against exhaustion.',
    turns: 20,
    startDate: '2026-03-24',
    phase: 'war',
    warStarted: true,
    initialHormuz: 73,
    hosts: { ...base.hosts, qatar: 54, uae: 47, kuwait: 51, bahrain: 43, saudi: 49, turkey: 59, jordan: 35, egypt: 39 },
    iran: attritionIran,
    deploy: scaleDeploy(clone(base.deploy), 0.72),
    nodeIntegrity: {
      natanz: 58,
      fordow: 72,
      isfahan: 80,
      khojir: 44,
      parchin: 53,
      shahroud: 66,
      bandar_abbas: 51,
      bandar_abbas_underground: 78,
      al_udeid: 81,
      al_dhafra: 86,
      ali_al_salem: 74,
    },
    meters: attritionMeters,
    resources: attritionResources,
  }),
  renewed: scenario({
    id: 'renewed',
    name: 'Renewed Conflict',
    brief:
      '15 September 2026 — the agreement failed and the war has restarted. Iran rebuilt production and refilled its launchers during the pause; the coalition’s domestic patience and Gulf access did not recover. Old red lines are closer and the room for error is smaller.',
    turns: 24,
    startDate: '2026-09-15',
    phase: 'war',
    warStarted: true,
    initialHormuz: 56,
    hosts: { ...base.hosts, qatar: 44, uae: 39, kuwait: 43, bahrain: 36, saudi: 42, turkey: 68, jordan: 31, egypt: 34 },
    iran: renewedIran,
    deploy: clone(base.deploy),
    nodeIntegrity: {
      natanz: 83,
      fordow: 90,
      isfahan: 88,
      khojir: 76,
      parchin: 81,
      shahroud: 85,
      bandar_abbas: 69,
      al_udeid: 88,
      al_dhafra: 91,
      incirlik: 64,
    },
    meters: renewedMeters,
    resources: renewedResources,
  }),
};
