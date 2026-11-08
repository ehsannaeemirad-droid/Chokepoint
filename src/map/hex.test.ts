import { describe, expect, it } from 'vitest';
import { COLS, ROWS } from './geography';
import { hexDistance, hexNeighbors, hexToWorld, hexesInRange, worldToHex } from './hex';

describe('hex grid', () => {
  it('round-trips world <-> offset coordinates', () => {
    for (let row = 0; row < ROWS; row += 5) {
      for (let col = 0; col < COLS; col += 5) {
        const world = hexToWorld(col, row);
        expect(worldToHex(world.x, world.y)).toEqual({ col, row });
      }
    }
  });

  it('computes axial distances', () => {
    expect(hexDistance({ col: 10, row: 10 }, { col: 10, row: 10 })).toBe(0);
    expect(hexDistance({ col: 10, row: 10 }, { col: 11, row: 10 })).toBe(1);
    expect(hexDistance({ col: 10, row: 10 }, { col: 10, row: 12 })).toBe(2);
    expect(hexDistance({ col: 56, row: 40 }, { col: 56, row: 40 })).toBe(0);
  });

  it('has six neighbours inside the map', () => {
    expect(hexNeighbors(40, 35)).toHaveLength(6);
  });

  it('builds ranges that respect distance', () => {
    const center = { col: 40, row: 35 };
    const hexes = hexesInRange(center, 3);
    expect(hexes).toHaveLength(37);
    for (const hex of hexes) {
      expect(hexDistance(center, hex)).toBeLessThanOrEqual(3);
    }
  });
});
