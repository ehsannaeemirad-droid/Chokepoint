/**
 * Iran's great-power favours. Points are earned from the superpower posture
 * clock and spent on one concrete shipment or intelligence service. The order
 * path is the same as every other action, so the AI, replay and review screens
 * see the transaction.
 */
import { deliverMatedRounds } from '../core/inventory';
import type { GameSnapshot, ResolveEvent } from '../core/types';
import { superpowerTier } from './politics';

export type Patron = 'russia' | 'china';
export type AidKind = 'missiles' | 'production' | 'intel';

export const AID_COSTS: Record<Patron, Record<AidKind, number>> = {
  russia: { missiles: 4, production: 5, intel: 4 },
  china: { missiles: 3, production: 4, intel: 3 },
};

export const AID_LABELS: Record<Patron, Record<AidKind, string>> = {
  russia: {
    missiles: 'Caspian missile shipment',
    production: 'Caspian machine tools',
    intel: 'Russian satellite tasking',
  },
  china: {
    missiles: 'Airbridge missile shipment',
    production: 'Airbridge production line',
    intel: 'Chinese signals intelligence',
  },
};

export function favorsOf(snap: GameSnapshot): Record<Patron, number> {
  snap.greatPowerFavors ??= { russia: 3, china: 3 };
  return snap.greatPowerFavors;
}

/** One point per turn, plus one from a patron already at shield tier. */
export function accrueFavors(snap: GameSnapshot): void {
  const favors = favorsOf(snap);
  favors.russia = Math.min(20, favors.russia + 1 + (superpowerTier(snap.superpowers.russia.stance) >= 2 ? 1 : 0));
  favors.china = Math.min(20, favors.china + 1 + (superpowerTier(snap.superpowers.china.stance) >= 2 ? 1 : 0));
}

export function aidCost(patron: Patron, aid: AidKind): number {
  return AID_COSTS[patron][aid];
}

export function applyAid(snap: GameSnapshot, patron: Patron, aid: AidKind, events: ResolveEvent[]): void {
  const favors = favorsOf(snap);
  favors[patron] = Math.max(0, favors[patron] - aidCost(patron, aid));
  const route = patron === 'russia' ? 'across the Caspian' : 'by Chinese airbridge';

  if (aid === 'missiles') {
    deliverMatedRounds(snap, 'fateh', 3);
    deliverMatedRounds(snap, 'khorramshahr', 1);
    events.push({
      text: `A ${patron === 'russia' ? 'Russian' : 'Chinese'} missile shipment arrived ${route}: +3 Fateh and +1 Khorramshahr rounds.`,
      tone: 'good',
      faction: 'iran',
    });
    return;
  }

  if (aid === 'production') {
    snap.iranProductionBoost = Math.min(3, (snap.iranProductionBoost ?? 0) + 2);
    events.push({
      text: `A ${patron === 'russia' ? 'Russian' : 'Chinese'} production package arrived ${route}: Iranian output is accelerated for ${snap.iranProductionBoost} turns.`,
      tone: 'good',
      faction: 'iran',
    });
    return;
  }

  let revealed = 0;
  for (const unit of snap.units) {
    if (unit.faction === 'iran' || unit.revealed) continue;
    unit.revealed = true;
    unit.lastSeen = snap.turn;
    revealed += 1;
  }
  events.push({
    text: `A ${patron === 'russia' ? 'Russian' : 'Chinese'} intelligence package ${route} located ${revealed} previously hidden enemy unit${revealed === 1 ? '' : 's'}.`,
    tone: 'good',
    faction: 'iran',
  });
}
