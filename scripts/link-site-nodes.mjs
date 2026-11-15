/**
 * Task 1b: every named site that is not already a playable node becomes one.
 *
 * Coordinates, roles and provenance come from `orderOfBattle.sites`; the node
 * carries the site's detection radius where the brief gives one, the radar it
 * depends on, and what its destruction does to the defence network. Mobile
 * carrier sites are skipped because they are already represented as units.
 *
 * Persian names are not invented here: the UI falls back to the English name
 * for these nodes, which is recorded in DATA_GAPS.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const oobPath = 'src/data/orderOfBattle.json';
const nodesPath = 'src/data/mapNodes.json';
const oob = JSON.parse(readFileSync(oobPath, 'utf8'));
const nodes = JSON.parse(readFileSync(nodesPath, 'utf8'));
const byId = new Set(nodes.map((n) => n.id));

const SAM_RADIUS = {
  s300_tehran: 200,
  bavar_fordow: 300,
  khordad15_isfahan: 120,
  talash_layered: 105,
  s200_isfahan: 250,
};
const RADAR_RADIUS = {
  meraj4_network: 400,
  kavosh_radar: 150,
  ghadir_radar: 1100,
  alim_radar: 275,
};
const LINKED_RADAR = {
  s300_tehran: 'meraj4_network',
  bavar_fordow: 'meraj4_network',
  khordad15_isfahan: 'kavosh_radar',
  talash_layered: 'kavosh_radar',
  s200_isfahan: 'meraj4_network',
};

const PROXY_SIDE = new Set(['hezbollah', 'pmf', 'hamas']);

function kindFor(site) {
  if (site.id in SAM_RADIUS) return 'sam';
  if (site.id in RADAR_RADIUS) return 'radar';
  if (/_ab$/.test(site.id)) return 'airbase';
  if (/_naval$/.test(site.id) || site.id === 'kharg') return 'naval';
  if (PROXY_SIDE.has(site.side)) return 'command';
  if (/air base/i.test(site.role)) return 'airbase';
  if (/naval/i.test(site.role)) return 'naval';
  if (/missile|launch|production|test/i.test(site.role) || /missile|semnan|khojir|parchin|shahroud/.test(site.id)) {
    return 'missile-base';
  }
  return 'command';
}

function effectFor(site, kind) {
  if (kind === 'sam') {
    return 'Destroying this battery opens a hole in its air-defence layer and forces linked batteries onto their own sensors.';
  }
  if (kind === 'radar') {
    return 'Destroying this radar removes its detection contribution and leaves dependent batteries firing without cueing.';
  }
  if (kind === 'missile-base') {
    return 'Destroying this base cuts launchers and reload capacity from the Iranian missile force.';
  }
  if (kind === 'airbase') {
    return 'Destroying this airbase removes sortie generation and its aircraft from the theatre.';
  }
  if (kind === 'naval') {
    return 'Destroying this naval base removes coastal missiles and fast-attack craft from the Strait.';
  }
  return 'Destroying this seat degrades proxy coordination and attack tempo.';
}

const added = [];
for (const site of oob.sites) {
  if (site.mobile) continue;
  if (site.node_id && byId.has(site.node_id)) continue;
  // A site whose own id is already a node (Kharg, Erbil, the proxy seats) is
  // the same place under a different schema: link it, never duplicate it.
  if (byId.has(site.id)) {
    site.node_id = site.id;
    continue;
  }
  const kind = kindFor(site);
  const node = {
    id: site.id,
    name: site.name,
    kind,
    lon: site.lon,
    lat: site.lat,
    host: site.host,
    operators: PROXY_SIDE.has(site.side) ? ['iran'] : [site.side],
    detail: site.role,
    effect: effectFor(site, kind),
    confidence: site.confidence,
    provenance: site.source,
    maxIntegrity: /underground|hardened/i.test(site.role + site.note) ? 140 : 100,
  };
  if (SAM_RADIUS[site.id]) {
    node.detection_radius_km = SAM_RADIUS[site.id];
    node.linked_system = LINKED_RADAR[site.id];
  }
  if (RADAR_RADIUS[site.id]) node.detection_radius_km = RADAR_RADIUS[site.id];
  if (node.detection_radius_km) node.degradation_effect = effectFor(site, kind);
  if (site.personnel) node.personnel = site.personnel;
  nodes.push(node);
  site.node_id = site.id;
  added.push(site.id);
}

// A radar cannot be linked before it exists as a node: fail loudly if the brief
// ever names a dependency we did not add.
for (const node of nodes) {
  if (node.linked_system && !nodes.some((n) => n.id === node.linked_system)) {
    throw new Error(`missing linked system ${node.linked_system} for ${node.id}`);
  }
}

writeFileSync(nodesPath, JSON.stringify(nodes, null, 2) + '\n');
writeFileSync(oobPath, JSON.stringify(oob, null, 2) + '\n');
console.log(`added ${added.length} nodes; total ${nodes.length}`);
console.log(added.join(', '));

