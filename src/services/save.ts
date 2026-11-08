/** localStorage persistence: autosave, three manual slots, replay export. */
import type { GameSnapshot } from '../core/types';

const PREFIX = 'chokepoint';
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'] as const;
export type SlotId = (typeof SLOTS)[number];

export interface SaveFile {
  version: 1;
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
      version: 1,
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

export function loadGame(slot: SlotId): SaveFile | null {
  try {
    const raw = localStorage.getItem(keyFor(slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveFile;
    if (parsed.version !== 1 || !parsed.snapshot) return null;
    return parsed;
  } catch {
    return null;
  }
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
      version: 1,
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
