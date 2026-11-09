/**
 * Radar / sensor coverage modifiers.
 *
 * Destruction is modeled as a continuous coverage quality penalty by sector,
 * not a binary wipe. Data-driven node ids map to sectors; no RNG.
 */
import type { GameSnapshot } from '../core/types';
import { nodeState } from '../core/world';

export type RadarSector = 'levant' | 'gulf' | 'israel' | 'naval';

/** Radar sites that feed BMD quality. Integrity 100 = full, 0 = offline. */
const RADAR_SITES: Array<{ nodeId: string; sector: RadarSector; weight: number }> = [
  { nodeId: 'muwaffaq_salti', sector: 'levant', weight: 0.35 },
  { nodeId: 'al_udeid', sector: 'gulf', weight: 0.25 },
  { nodeId: 'al_dhafra', sector: 'gulf', weight: 0.15 },
];

export function sectorCoverage(snap: GameSnapshot, sector: RadarSector): number {
  const sites = RADAR_SITES.filter((s) => s.sector === sector);
  if (sites.length === 0) return 1;
  let quality = 1;
  for (const site of sites) {
    const node = snap.nodes[site.nodeId];
    const integrity = node ? node.integrity / Math.max(1, node.maxIntegrity) : 1;
    quality -= site.weight * (1 - integrity);
  }
  return Math.max(0.2, Math.min(1, quality));
}

export function interceptQualityModifier(snap: GameSnapshot, sector: RadarSector): number {
  return sectorCoverage(snap, sector);
}

export function sectorForNode(nodeId: string | undefined): RadarSector {
  if (!nodeId) return 'gulf';
  if (
    nodeId.includes('tel_aviv') ||
    nodeId.includes('haifa') ||
    nodeId.includes('dimona') ||
    nodeId.includes('hatzerim')
  ) {
    return 'israel';
  }
  if (nodeId.includes('muwaffaq') || nodeId.includes('jordan')) return 'levant';
  if (nodeId === 'csg' || nodeId.includes('hormuz')) return 'naval';
  return 'gulf';
}

export function degradedRadars(snap: GameSnapshot): Array<{ nodeId: string; integrity: number; sector: RadarSector }> {
  const out: Array<{ nodeId: string; integrity: number; sector: RadarSector }> = [];
  for (const site of RADAR_SITES) {
    const n = snap.nodes[site.nodeId];
    if (!n) continue;
    if (n.integrity < 80) {
      out.push({ nodeId: site.nodeId, integrity: Math.round(n.integrity), sector: site.sector });
    }
  }
  return out;
}

void nodeState;
