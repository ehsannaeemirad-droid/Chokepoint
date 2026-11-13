import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYER, isMapLayerId, layerDef, MAP_LAYER_IDS, MAP_LAYERS } from './layers';

describe('strategic map layers', () => {
  it('defines exactly the six layers the interface offers', () => {
    expect(MAP_LAYERS.map((layer) => layer.id)).toEqual([...MAP_LAYER_IDS]);
    expect(MAP_LAYERS).toHaveLength(6);
  });

  it('defaults to a layer that exists', () => {
    expect(isMapLayerId(DEFAULT_LAYER)).toBe(true);
    expect(layerDef(DEFAULT_LAYER).id).toBe(DEFAULT_LAYER);
  });

  it('keeps every treatment value in range', () => {
    for (const layer of MAP_LAYERS) {
      for (const value of [layer.ownerTint, layer.gridAlpha, layer.detail, layer.desaturate]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('shows ownership strongest in the political view and least in intelligence', () => {
    expect(layerDef('political').ownerTint).toBeGreaterThan(layerDef('military').ownerTint);
    expect(layerDef('political').ownerTint).toBeGreaterThan(layerDef('intelligence').ownerTint);
  });

  it('only the air-defence layer draws coverage rings', () => {
    const withCoverage = MAP_LAYERS.filter((layer) => layer.coverage).map((layer) => layer.id);
    expect(withCoverage).toEqual(['airDefence']);
  });

  it('falls back to the default for an unknown id', () => {
    expect(layerDef('nope' as never).id).toBe(DEFAULT_LAYER);
    expect(isMapLayerId('nope')).toBe(false);
  });
});
