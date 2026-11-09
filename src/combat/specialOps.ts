/**
 * Special operations (Phase 2 item 3).
 *
 * The outcome is enumerated and the reported state change is the applied one:
 * success and partial success damage the site, failure-survived keeps the team,
 * failure-lost removes it from the snapshot, and abort changes nothing.
 */
import type { GameSnapshot, ResolveEvent, UnitInstance } from '../core/types';
import { clamp, removeUnit } from '../core/world';
import { addIranWarCost } from '../politics/politics';
import type { TheaterMap } from '../map/TheaterMap';

export type Rng = () => number;

export type SpecialOutcome = 'success' | 'partial' | 'failure-survived' | 'failure-lost' | 'abort';

export const SPECIAL_OUTCOMES: readonly SpecialOutcome[] = [
  'success',
  'partial',
  'failure-survived',
  'failure-lost',
  'abort',
];

export interface SpecialOperationResult {
  outcome: SpecialOutcome;
  events: ResolveEvent[];
  unitLost: boolean;
  integrityLoss: number;
  legitimacyLoss: number;
}

export function resolveSabotage(
  snap: GameSnapshot,
  map: TheaterMap,
  unit: UnitInstance,
  nodeId: string,
  rng: Rng,
): SpecialOperationResult {
  const node = map.nodeById.get(nodeId);
  const state = snap.nodes[nodeId];
  const abort = (text: string): SpecialOperationResult => ({
    outcome: 'abort',
    events: [
      { text, tone: 'info', faction: unit.faction, focus: node ? map.nodeHexOf(nodeId) : undefined },
    ],
    unitLost: false,
    integrityLoss: 0,
    legitimacyLoss: 0,
  });
  if (!node || !state) return abort('Special operations aborted: no such facility.');
  if (state.integrity <= 0) {
    return abort(`Special operations aborted: ${node.name} is already destroyed.`);
  }

  const roll = rng();
  const focus = map.nodeHexOf(nodeId);
  const apply = (loss: number, legitimacy: number): number => {
    const before = state.integrity;
    state.integrity = clamp(state.integrity - loss, 0, state.maxIntegrity);
    if (loss > 0 && node.host === 'iran') addIranWarCost(snap, loss >= 30 ? 8 : 4);
    snap.meters.legitimacy = clamp(snap.meters.legitimacy - legitimacy, 0, 100);
    return before - state.integrity;
  };

  if (roll < 0.4) {
    const integrityLoss = apply(30, 0);
    return {
      outcome: 'success',
      events: [
        {
          text: `Special operations sabotaged ${node.name}: integrity now ${Math.round(state.integrity)}% (team exfiltrated).`,
          tone: 'good',
          faction: unit.faction,
          focus,
        },
      ],
      unitLost: false,
      integrityLoss,
      legitimacyLoss: 0,
    };
  }
  if (roll < 0.7) {
    const integrityLoss = apply(12, 2);
    return {
      outcome: 'partial',
      events: [
        {
          text: `Special operations partially succeeded at ${node.name}: integrity now ${Math.round(state.integrity)}%, but the team broke contact. Legitimacy fell by 2.`,
          tone: 'warn',
          faction: unit.faction,
          focus,
        },
      ],
      unitLost: false,
      integrityLoss,
      legitimacyLoss: 2,
    };
  }
  if (roll < 0.85) {
    apply(0, 5);
    return {
      outcome: 'failure-survived',
      events: [
        {
          text: `Special operations against ${node.name} failed; the team escaped and remains in place. Legitimacy fell by 5.`,
          tone: 'bad',
          faction: unit.faction,
          focus,
        },
      ],
      unitLost: false,
      integrityLoss: 0,
      legitimacyLoss: 5,
    };
  }
  apply(0, 5);
  removeUnit(snap, unit.uid);
  return {
    outcome: 'failure-lost',
    events: [
      {
        text: `Special operations against ${node.name} failed and the team was lost. Legitimacy fell by 5.`,
        tone: 'bad',
        faction: unit.faction,
        focus,
      },
    ],
    unitLost: true,
    integrityLoss: 0,
    legitimacyLoss: 5,
  };
}
