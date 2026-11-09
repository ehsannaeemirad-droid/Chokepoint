/**
 * Pre-war gating, reserve interceptor trickle, and underground regeneration.
 * Pure helpers used by the turn pipeline; no RNG.
 */
import type { GameSnapshot, ResolveEvent } from './types';

/** Orders that open hostilities from a pre-war posture. */
const HOSTILE_ORDER_KINDS = new Set(['strike', 'special', 'cyber', 'nuclear', 'produce']);

export function maybeStartWar(snap: GameSnapshot, events: ResolveEvent[]): void {
  if (snap.warStarted) return;
  const opened = snap.orders.some((o) => HOSTILE_ORDER_KINDS.has(o.kind));
  if (!opened) return;
  snap.warStarted = true;
  snap.phase = 'war';
  events.push({
    text: 'Hostilities open. Pre-war restraints lift; opposing forces begin military resolution.',
    tone: 'warn',
  });
}

/** Move a fraction of reserve interceptors into the ready pool each turn. */
export function readyReserves(snap: GameSnapshot, events: ResolveEvent[]): void {
  const usaRes = snap.resources.interceptorsUSAReserve ?? 0;
  const ilRes = snap.resources.interceptorsIsraelReserve ?? 0;
  if (usaRes > 0) {
    const move = Math.max(1, Math.round(usaRes * 0.25));
    const take = Math.min(move, usaRes);
    snap.resources.interceptorsUSAReserve = usaRes - take;
    snap.resources.interceptorsUSA = Math.min(220, snap.resources.interceptorsUSA + take);
    events.push({
      text: `Reserve interceptors brought online: +${take} US ready (reserve ${snap.resources.interceptorsUSAReserve}).`,
      tone: 'info',
      faction: 'usa',
    });
  }
  if (ilRes > 0) {
    const move = Math.max(1, Math.round(ilRes * 0.25));
    const take = Math.min(move, ilRes);
    snap.resources.interceptorsIsraelReserve = ilRes - take;
    snap.resources.interceptorsIsrael = Math.min(180, snap.resources.interceptorsIsrael + take);
    events.push({
      text: `Israeli reserve interceptors brought online: +${take} ready (reserve ${snap.resources.interceptorsIsraelReserve}).`,
      tone: 'info',
      faction: 'israel',
    });
  }
}

/** Underground production nodes regenerate stocks slowly when intact. */
export function regenerateUnderground(snap: GameSnapshot, _map: unknown, events: ResolveEvent[]): void {
  const sites: Array<{ id: string; kind: 'drone' | 'missile' | 'both'; perTurn: number }> = [
    { id: 'khojir', kind: 'both', perTurn: 2 },
    { id: 'parchin', kind: 'missile', perTurn: 1 },
    { id: 'shahroud', kind: 'missile', perTurn: 1 },
    { id: 'bandar_abbas_underground', kind: 'drone', perTurn: 3 },
    { id: 'tabriz_complex', kind: 'both', perTurn: 1 },
  ];
  let drones = 0;
  let missiles = 0;
  for (const site of sites) {
    const node = snap.nodes[site.id];
    if (!node || node.integrity <= 20) continue;
    const factor = node.integrity / 100;
    const amt = Math.max(0, Math.round(site.perTurn * factor));
    if (amt <= 0) continue;
    if (site.kind === 'drone' || site.kind === 'both') drones += amt;
    if (site.kind === 'missile' || site.kind === 'both') missiles += amt;
  }
  if (drones > 0) {
    snap.iran.drones += drones;
    events.push({ text: `Underground production delivered +${drones} drones.`, tone: 'info', faction: 'iran' });
  }
  if (missiles > 0) {
    snap.iran.fateh += missiles;
    events.push({
      text: `Underground production delivered +${missiles} short-range missiles (Fateh class).`,
      tone: 'info',
      faction: 'iran',
    });
  }
}
