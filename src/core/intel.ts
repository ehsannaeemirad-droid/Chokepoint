/**
 * Intelligence state (Phase 2 item 8).
 *
 * Coverage is positional and real: a special-operations team gives humint
 * within 6 hexes, an MQ-9 gives ISR within 12. Detection sets `revealed` and
 * stamps `lastSeen`; without continued coverage an enemy unit loses its
 * identity after INTEL_DECAY_TURNS. Nothing here writes estimates — those are
 * derived in the UI from this state.
 */
import type { FactionId, GameSnapshot, UnitInstance } from './types';
import { hexDistance } from '../map/hex';

export type ReconQuality = 'humint' | 'isr' | 'none';

/** What the viewer actually knows, from least to most certain. */
export type InformationState = 'unknown' | 'estimated' | 'identified' | 'tracked';

export const RECON_SPREAD: Record<ReconQuality, number> = { humint: 0.08, isr: 0.18, none: 0.35 };
export const INTEL_DECAY_TURNS = 3;

export const HUMINT_RANGE = 6;
export const ISR_RANGE = 12;

export function reconQuality(
  snap: GameSnapshot,
  viewer: FactionId,
  col: number,
  row: number,
): ReconQuality {
  let best: ReconQuality = 'none';
  for (const unit of snap.units) {
    if (unit.faction !== viewer) continue;
    const d = hexDistance({ col, row }, { col: unit.col, row: unit.row });
    if (unit.typeId === 'sof' && d <= HUMINT_RANGE) return 'humint';
    if (unit.typeId === 'mq9' && d <= ISR_RANGE && best === 'none') best = 'isr';
  }
  return best;
}

/** Turns since the viewer last had eyes on this unit. */
export function staleTurns(snap: GameSnapshot, unit: Pick<UnitInstance, 'lastSeen'>): number {
  if (unit.lastSeen === undefined) return 0;
  return Math.max(0, snap.turn - unit.lastSeen);
}

export function informationState(
  snap: GameSnapshot,
  viewer: FactionId,
  unit: Pick<UnitInstance, 'faction' | 'col' | 'row' | 'revealed' | 'lastSeen'>,
): InformationState {
  if (unit.faction === viewer) return 'tracked';
  const quality = reconQuality(snap, viewer, unit.col, unit.row);
  if (quality === 'humint') return 'tracked';
  if (quality === 'isr') return 'identified';
  if (!unit.revealed) return 'unknown';
  return staleTurns(snap, unit) <= 1 ? 'identified' : 'estimated';
}

/**
 * Refresh detection from current coverage, then decay anything that has been
 * out of sight too long. Own units keep their visibility.
 */
export function updateIntelligence(snap: GameSnapshot): void {
  for (const unit of snap.units) {
    if (unit.faction === snap.faction) continue;
    const quality = reconQuality(snap, snap.faction, unit.col, unit.row);
    if (quality !== 'none') {
      unit.revealed = true;
      unit.lastSeen = snap.turn;
      continue;
    }
    if (unit.revealed && staleTurns(snap, unit) > INTEL_DECAY_TURNS) {
      unit.revealed = false;
    }
  }
}
