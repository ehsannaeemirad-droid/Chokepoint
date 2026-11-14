/**
 * Strategic map layers.
 *
 * The map is always the same geography; a layer changes what the map
 * *emphasises*, never the underlying tiles or simulation state. Each layer is a
 * plain rendering treatment, which keeps it pure data: the chunk renderer bakes
 * terrain with these numbers and the marker overlay draws the one layer that
 * needs live game state (air-defence coverage).
 */
import type { StringKey } from '../i18n';

export const MAP_LAYER_IDS = [
  'political',
  'military',
  'intelligence',
  'airDefence',
  'logistics',
  'infrastructure',
] as const;

export type MapLayerId = (typeof MAP_LAYER_IDS)[number];

export interface LayerDef {
  id: MapLayerId;
  label: StringKey;
  hint: StringKey;
  /** Political ownership wash on land hexes, 0..1. */
  ownerTint: number;
  /** Hairline hex grid, 0..1. Kept low so the map reads as geography. */
  gridAlpha: number;
  /** Strength of baked terrain detail (ridges, dunes, blocks), 0..1. */
  detail: number;
  /** How far terrain is washed toward the neutral slate tone, 0..1. */
  desaturate: number;
  /** Keep every node label visible instead of only at closer zoom. */
  emphasiseNodes: boolean;
  /** Draw air-defence coverage rings from live defence units. */
  coverage: boolean;
}

export const MAP_LAYERS: readonly LayerDef[] = [
  {
    id: 'political',
    label: 'layer.political',
    hint: 'layer.political.hint',
    // Ownership is the whole point of this layer, so the wash carries weight:
    // friendly, hostile and neutral ground must be separable at a glance.
    ownerTint: 0.26,
    gridAlpha: 0.05,
    detail: 0.55,
    desaturate: 0,
    emphasiseNodes: false,
    coverage: false,
  },
  {
    id: 'military',
    label: 'layer.military',
    hint: 'layer.military.hint',
    ownerTint: 0.04,
    gridAlpha: 0.07,
    detail: 0.35,
    desaturate: 0.15,
    emphasiseNodes: false,
    coverage: false,
  },
  {
    id: 'intelligence',
    label: 'layer.intelligence',
    hint: 'layer.intelligence.hint',
    ownerTint: 0.02,
    gridAlpha: 0.04,
    detail: 0.2,
    desaturate: 0.5,
    emphasiseNodes: true,
    coverage: false,
  },
  {
    id: 'airDefence',
    label: 'layer.airDefence',
    hint: 'layer.airDefence.hint',
    ownerTint: 0.03,
    gridAlpha: 0.03,
    detail: 0.75,
    desaturate: 0.35,
    emphasiseNodes: false,
    coverage: true,
  },
  {
    id: 'logistics',
    label: 'layer.logistics',
    hint: 'layer.logistics.hint',
    ownerTint: 0.05,
    gridAlpha: 0.05,
    detail: 0.3,
    desaturate: 0.25,
    emphasiseNodes: true,
    coverage: false,
  },
  {
    id: 'infrastructure',
    label: 'layer.infrastructure',
    hint: 'layer.infrastructure.hint',
    ownerTint: 0.06,
    gridAlpha: 0.04,
    detail: 0.25,
    desaturate: 0.3,
    emphasiseNodes: true,
    coverage: false,
  },
];

export const DEFAULT_LAYER: MapLayerId = 'political';

const BY_ID = new Map<MapLayerId, LayerDef>(MAP_LAYERS.map((layer) => [layer.id, layer]));

export function layerDef(id: MapLayerId): LayerDef {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_LAYER)!;
}

export function isMapLayerId(value: string): value is MapLayerId {
  return BY_ID.has(value as MapLayerId);
}
