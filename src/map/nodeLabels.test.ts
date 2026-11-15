/**
 * Persian parity for the playable map.
 *
 * Every node that can appear as a label must have a Persian name; compact labels
 * must have a Persian compact form too, otherwise the FA interface falls back to
 * English for exactly the sites that are hardest to distinguish.
 */
import { describe, expect, it } from 'vitest';
import { MAP_NODES } from './TheaterMap';

describe('map node localisation', () => {
  it('names every node in Persian', () => {
    const missing = MAP_NODES.filter((node) => !node.name_fa).map((node) => node.id);
    expect(missing).toEqual([]);
  });

  it('localises every compact label', () => {
    const missing = MAP_NODES.filter((node) => node.short_name && !node.short_name_fa).map((node) => node.id);
    expect(missing).toEqual([]);
  });

  it('keeps node ids unique after the site expansion', () => {
    const ids = MAP_NODES.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
