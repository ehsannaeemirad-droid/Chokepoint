/** Deterministic seeds and PRNG. No Math.random anywhere in game logic. */

/** mulberry32: tiny, fast, deterministic 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit string hash (FNV-1a), used for map decoration and seeds. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Per-turn, per-faction RNG. Same state + same seed = same rolls, which is what
 * makes replay and AI auditing possible.
 */
export function factionRng(seed: number, turn: number, faction: string): () => number {
  return mulberry32(hashString(`${seed}:${turn}:${faction}`));
}

/** Derive a stable [0,1) value from a coordinate pair (map decoration). */
export function hash01(a: number, b: number, salt = 0): number {
  return hashString(`${a}/${b}/${salt}`) / 4294967296;
}
