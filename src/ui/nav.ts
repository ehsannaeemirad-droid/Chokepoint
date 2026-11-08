/**
 * Phase 5: navigation helpers — the node catalog with bilingual search, kind
 * filters, and the "next threat" / "my forces" cycling logic.
 *
 * Pure functions over the snapshot and the static map; no DOM, no RNG.
 */
import type { FactionId, GameSnapshot } from '../core/types';
import { hostileTo } from '../combat/combat';
import { hexDistance } from '../map/hex';
import type { TheaterMap } from '../map/TheaterMap';

/** Drawer filter groups. `all` disables the filter. */
export type NavKind = 'all' | 'airbase' | 'nuclear' | 'oil' | 'urban' | 'naval' | 'port' | 'chokepoint';

export const NAV_KINDS: NavKind[] = ['all', 'airbase', 'nuclear', 'oil', 'urban', 'naval', 'port', 'chokepoint'];

export interface NavEntry {
  id: string;
  name: string;
  nameFa: string;
  kind: string;
  /** lowercase haystack: both names + kind ids + host, for bilingual search. */
  haystack: string;
  col: number;
  row: number;
}

/** Every strategic node as a searchable catalog entry. */
export function nodeCatalog(snap: GameSnapshot, map: TheaterMap): NavEntry[] {
  const entries: NavEntry[] = [];
  for (const node of map.nodes) {
    const hex = map.nodeHexOf(node.id);
    if (!hex) continue;
    const nameFa = node.name_fa ?? node.name;
    entries.push({
      id: node.id,
      name: node.name,
      nameFa,
      kind: node.kind,
      haystack: `${node.name} ${nameFa} ${node.kind} ${node.host}`.toLowerCase(),
      col: hex.col,
      row: hex.row,
    });
  }
  void snap;
  return entries;
}

/** Filter the catalog by a bilingual query and a kind filter, keeping map order. */
export function filterNodes(entries: NavEntry[], query: string, kind: NavKind): NavEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (kind !== 'all' && entry.kind !== kind) return false;
    if (!q) return true;
    return entry.haystack.includes(q);
  });
}

/**
 * Revealed hostile units, nearest-first to the viewer's closest formation.
 * This is the "threat" ordering used by the next-threat button.
 */
export function threatOrder(snap: GameSnapshot): Array<{ uid: string; col: number; row: number; dist: number }> {
  const mine = snap.units.filter((u) => u.faction === snap.faction);
  const threats: Array<{ uid: string; col: number; row: number; dist: number }> = [];
  for (const unit of snap.units) {
    if (unit.faction === viewerFaction(snap)) continue;
    if (!hostileTo(viewerFaction(snap), unit.faction) || !unit.revealed) continue;
    let dist = Number.POSITIVE_INFINITY;
    for (const own of mine) {
      dist = Math.min(dist, hexDistance({ col: own.col, row: own.row }, { col: unit.col, row: unit.row }));
    }
    threats.push({ uid: unit.uid, col: unit.col, row: unit.row, dist: mine.length ? dist : 0 });
  }
  return threats.sort((a, b) => a.dist - b.dist || a.uid.localeCompare(b.uid));
}

function viewerFaction(snap: GameSnapshot): FactionId {
  return snap.faction;
}

/** Next threat uid, cycling through the ordered list past the visited ones. */
export function nextThreatUid(snap: GameSnapshot, visited: string[]): string | null {
  const threats = threatOrder(snap);
  if (threats.length === 0) return null;
  const fresh = threats.find((t) => !visited.includes(t.uid));
  return (fresh ?? threats[0]!).uid;
}

/** Own formations, ordered by uid for the "back to my forces" cycle. */
export function ownForcesOrder(snap: GameSnapshot): string[] {
  return snap.units
    .filter((u) => u.faction === snap.faction)
    .map((u) => u.uid)
    .sort((a, b) => a.localeCompare(b));
}

/** Next own-unit uid, cycling past the visited ones. */
export function nextOwnUid(snap: GameSnapshot, visited: string[]): string | null {
  const own = ownForcesOrder(snap);
  if (own.length === 0) return null;
  const fresh = own.find((uid) => !visited.includes(uid));
  return fresh ?? own[0]!;
}
