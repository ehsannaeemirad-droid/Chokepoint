import { describe, expect, it } from 'vitest';
import { TheaterMap } from './TheaterMap';
import { isWater, sampleTerrain } from './terrain';

describe('geography', () => {
  it('knows the Strait of Hormuz is water', () => {
    expect(isWater(56.45, 26.6)).toBe(true);
  });

  it('knows Tehran is land and the Mediterranean is sea', () => {
    expect(isWater(51.39, 35.69)).toBe(false);
    expect(isWater(30, 34)).toBe(true);
    expect(isWater(38, 20)).toBe(true); // Red Sea
  });

  it('places the Zagros mountains', () => {
    expect(sampleTerrain(49.0, 32.6)).toBe('mountain');
  });

  it('samples urban terrain for major cities', () => {
    expect(sampleTerrain(46.7, 24.7)).toBe('urban'); // Riyadh
  });

  it('places strategic nodes on the grid and hardens nuclear sites', () => {
    const map = new TheaterMap();
    expect(map.nodes.length).toBeGreaterThan(30);
    const natanz = map.nodeHexOf('natanz')!;
    expect(map.hexAt(natanz.col, natanz.row)?.terrain).toBe('hardened');
    const hormuz = map.nodeHexOf('hormuz')!;
    const tile = map.hexAt(hormuz.col, hormuz.row)!;
    expect(tile.terrain === 'deep' || tile.terrain === 'coast').toBe(true);
  });

  it('assigns country ownership on land', () => {
    const map = new TheaterMap();
    const riyadh = map.nodeHexOf('riyadh')!;
    expect(map.hexAt(riyadh.col, riyadh.row)?.owner).toBe('saudi');
  });
});
