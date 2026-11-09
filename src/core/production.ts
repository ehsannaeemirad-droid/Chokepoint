/**
 * Production capacity lookup (Phase 1a).
 *
 * Production is driven by facility data: a site contributes only for the
 * munition lines it actually declares, and only while it is intact. This keeps
 * enrichment plants out of the production loop and stops the AI or the engine
 * from hardcoding site ids.
 */
import type { GameSnapshot, MapNodeDef, ProductionLine } from './types';

export interface ProductionSite {
  id: string;
  integrity: number;
  lines: ProductionLine[];
}

/** Intact sites able to build the given munition line. */
export function productionSites(
  nodes: readonly MapNodeDef[],
  snap: GameSnapshot,
  line: ProductionLine,
): ProductionSite[] {
  const sites: ProductionSite[] = [];
  for (const node of nodes) {
    const lines = node.productionLines;
    if (!lines || !lines.includes(line)) continue;
    const state = snap.nodes[node.id];
    if (!state || state.integrity <= 0) continue;
    sites.push({ id: node.id, integrity: state.integrity, lines });
  }
  return sites;
}

/** True when at least one intact facility can build the line. */
export function hasProductionCapacity(
  nodes: readonly MapNodeDef[],
  snap: GameSnapshot,
  line: ProductionLine,
): boolean {
  return productionSites(nodes, snap, line).length > 0;
}

/**
 * Mean integrity of the producing sites, 0..1. Callers use it to scale output;
 * it returns 0 when nothing can produce.
 */
export function productionCapacity(
  nodes: readonly MapNodeDef[],
  snap: GameSnapshot,
  line: ProductionLine,
): number {
  const sites = productionSites(nodes, snap, line);
  if (sites.length === 0) return 0;
  const total = sites.reduce((sum, site) => sum + site.integrity, 0);
  return total / (sites.length * 100);
}

/** Which production line a producible munition belongs to. */
export function lineForMunition(unitTypeId: string): ProductionLine {
  return unitTypeId === 'shahed136' ? 'drone' : 'missile';
}
