/** localStorage persistence: autosave, three manual slots, replay export. */
import type { GameSnapshot } from '../core/types';
import { DEFAULT_VICTORY } from '../politics/victory';
import { DEFAULT_DOMESTIC_CFG, defaultDomesticState } from '../politics/domestic';
import { DEFAULT_ESCALATION_CFG, defaultEscalationState } from '../politics/escalation';
import { DEFAULT_LOGISTICS_CFG } from '../core/engine';
import { DEFAULT_ROE_CFG, defaultRoeState } from '../politics/roe';
import { DEFAULT_SCORECARD_CFG } from '../politics/scorecard';
import { DEFAULT_INITIATIVE_CFG, defaultIsraelInitiative } from '../politics/initiative';
import { DEFAULT_TALKS_CFG, defaultCeasefireTalks } from '../politics/talks';

const PREFIX = 'chokepoint';
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'] as const;
export type SlotId = (typeof SLOTS)[number];

export interface SaveFile {
  /** v4: pre-war gating (warStarted), reserve interceptors, phase/startDate. */
  version: 4;
  savedAt: number;
  slot: SlotId;
  label: string;
  turn: number;
  faction: string;
  scenarioId: string;
  snapshot: GameSnapshot;
}

const keyFor = (slot: SlotId) => `${PREFIX}:save:${slot}`;

export function saveGame(slot: SlotId, snapshot: GameSnapshot): boolean {
  try {
    const file: SaveFile = {
      version: 4,
      savedAt: Date.now(),
      slot,
      label: `${snapshot.faction.toUpperCase()} · turn ${snapshot.turn}`,
      turn: snapshot.turn,
      faction: snapshot.faction,
      scenarioId: snapshot.scenarioId,
      snapshot,
    };
    localStorage.setItem(keyFor(slot), JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

/** Save versions this build can load. v1 (pre-Phase-2) and v2 (v0.2) files are migrated. */
const SUPPORTED_SAVE_VERSIONS = [1, 2, 3, 4] as const;

export function loadGame(slot: SlotId): SaveFile | null {
  try {
    const raw = localStorage.getItem(keyFor(slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveFile;
    // Migration: a v1 save predates the Phase 2-6 snapshot blocks; the same
    // forward-compatible normalizer that served Phase 1 fills in the defaults.
    if (!(SUPPORTED_SAVE_VERSIONS as readonly number[]).includes(parsed.version) || !parsed.snapshot) return null;
    return { ...parsed, version: 4, snapshot: normalizeSnapshot(parsed.snapshot) };
  } catch {
    return null;
  }
}

/**
 * Forward-compatible defaults for v1 saves written before Phase 1: the victory
 * block and the new per-turn streaks simply start from zero. Values already
 * present on the snapshot are never overwritten. Phase 2 adds the same
 * treatment for the domestic block and its collapse streak.
 */
function normalizeSnapshot(snapshot: GameSnapshot): GameSnapshot {
  const meters = snapshot.meters as Partial<GameSnapshot['meters']> & GameSnapshot['meters'];
  if (meters.regimeIntactStreak === undefined) meters.regimeIntactStreak = 0;
  if (meters.occupationStreak === undefined) meters.occupationStreak = 0;
  if (meters.maxOccupationStreak === undefined) meters.maxOccupationStreak = 0;
  if (meters.oilShockStreak === undefined) meters.oilShockStreak = 0;
  if (meters.domesticPressureStreak === undefined) meters.domesticPressureStreak = 0;
  if (meters.israeliAirAtStart === undefined) meters.israeliAirAtStart = 2;
  if (snapshot.victory === undefined) {
    snapshot.victory = snapshot.scenarioId === 'tutorial' ? null : DEFAULT_VICTORY;
  }
  if (snapshot.domesticCfg === undefined) snapshot.domesticCfg = DEFAULT_DOMESTIC_CFG;
  if (snapshot.domestic === undefined) snapshot.domestic = defaultDomesticState(snapshot.domesticCfg);
  if (snapshot.initiativeCfg === undefined) snapshot.initiativeCfg = DEFAULT_INITIATIVE_CFG;
  if (snapshot.israelInitiative === undefined) snapshot.israelInitiative = defaultIsraelInitiative(snapshot.initiativeCfg);
  if (snapshot.talksCfg === undefined) snapshot.talksCfg = DEFAULT_TALKS_CFG;
  if (snapshot.ceasefire === undefined) snapshot.ceasefire = defaultCeasefireTalks();
  if (snapshot.escalationCfg === undefined) snapshot.escalationCfg = DEFAULT_ESCALATION_CFG;
  if (snapshot.escalation === undefined) snapshot.escalation = defaultEscalationState();
  if (snapshot.logisticsCfg === undefined) snapshot.logisticsCfg = DEFAULT_LOGISTICS_CFG;
  if (snapshot.roeCfg === undefined) snapshot.roeCfg = DEFAULT_ROE_CFG;
  if (snapshot.roe === undefined) snapshot.roe = defaultRoeState();
  if (snapshot.scorecardCfg === undefined) snapshot.scorecardCfg = DEFAULT_SCORECARD_CFG;
  // A snapshot that already ended keeps its stored settlement; one saved on
  // the terminal turn by an older build simply builds nothing here.
  // Packages in transit in pre-improvement saves simply keep their base ETA.
  for (const r of snapshot.reinforcements ?? []) {
    if (r.delayTurns === undefined) r.delayTurns = 0;
  }
  // v4: pre-war / reserve fields. Older saves are mid-campaign → war already started.
  if (snapshot.warStarted === undefined) snapshot.warStarted = true;
  if (snapshot.phase === undefined) snapshot.phase = snapshot.warStarted ? 'war' : 'prewar';
  if (snapshot.resources.interceptorsUSAReserve === undefined) snapshot.resources.interceptorsUSAReserve = 0;
  if (snapshot.resources.interceptorsIsraelReserve === undefined) snapshot.resources.interceptorsIsraelReserve = 0;
  return snapshot;
}

export function listSaves(): Array<{ slot: SlotId; label: string; savedAt: number } | null> {
  return SLOTS.map((slot) => {
    const file = loadGame(slot);
    return file ? { slot, label: file.label, savedAt: file.savedAt } : null;
  });
}

export function deleteSave(slot: SlotId): void {
  localStorage.removeItem(keyFor(slot));
}

/** A replay bundle is just the seed plus the decisions that were taken. */
export function exportReplay(snapshot: GameSnapshot): string {
  return JSON.stringify(
    {
      kind: 'chokepoint-replay',
      /** Replay format v3 (v0.3). The payload is unchanged: seed + order log
       * still reproduce the campaign byte-identically; the bump only marks
       * that newer snapshot fields exist alongside. */
      version: 4,
      scenarioId: snapshot.scenarioId,
      faction: snapshot.faction,
      seed: snapshot.seed,
      orderLog: snapshot.orderLog,
      finalTurn: snapshot.turn,
      status: snapshot.status,
    },
    null,
    2,
  );
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
