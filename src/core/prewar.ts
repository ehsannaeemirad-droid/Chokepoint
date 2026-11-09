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
export function regenerateUnderground(snap: GameSnapshot, map: unknown, events: ResolveEvent[]): void {
  // Regeneration is a labelled abstraction driven by facility data, not by a
  // hardcoded id list: a site regenerates only the lines it declares.
  const nodes =
    (map as { nodes?: Array<{ id: string; undergroundRegen?: { drones?: number; missiles?: number } }> }
      | undefined)?.nodes ?? [];
  let drones = 0;
  let missiles = 0;
  for (const site of nodes) {
    const regen = site.undergroundRegen;
    if (!regen) continue;
    const node = snap.nodes[site.id];
    if (!node || node.integrity <= 20) continue;
    const factor = node.integrity / 100;
    if (regen.drones) drones += Math.max(0, Math.round(regen.drones * factor));
    if (regen.missiles) missiles += Math.max(0, Math.round(regen.missiles * factor));
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
