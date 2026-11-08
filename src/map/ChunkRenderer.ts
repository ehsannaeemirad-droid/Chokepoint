/**
 * Chunked hex renderer.
 *
 * Each 16x16 chunk is baked once into an offscreen canvas, uploaded as a single
 * texture and drawn as one quad. Chunks outside the camera viewport + margin are
 * destroyed, so terrain memory and draw calls stay bounded no matter how far the
 * camera pans.
 */
import Phaser from 'phaser';
import { COLORS, FACTION_COLORS } from '../core/config';
import { hash01 } from '../core/rng';
import type { TerrainKind } from '../core/types';
import { CHUNK, HEX_R, HEX_W, ROW_STEP, chunkKey, hexCorners, hexToWorld } from './hex';
import type { TheaterMap } from './TheaterMap';
import { TERRAIN } from './terrain';

interface ChunkView {
  image: Phaser.GameObjects.Image;
  cx: number;
  cy: number;
  hexes: number;
}

type Rgb = [number, number, number];

const BASE_RGB: Record<TerrainKind, Rgb> = {
  deep: hexToRgb(COLORS.water),
  coast: hexToRgb(COLORS.coast),
  plains: hexToRgb(COLORS.plains),
  desert: hexToRgb(COLORS.desert),
  mountain: hexToRgb(COLORS.mountain),
  urban: hexToRgb(COLORS.urban),
  hardened: hexToRgb(COLORS.hardened),
};

const OWNER_RGB: Record<string, Rgb> = Object.fromEntries(
  Object.entries(FACTION_COLORS).map(([id, hex]) => [id, hexToRgb(hex)]),
);

const OWNER_TINT_ALPHA = 0.14;

export class ChunkRenderer {
  private chunks = new Map<string, ChunkView>();
  private queue: Array<{ cx: number; cy: number }> = [];
  private queued = new Set<string>();
  private lastViewSignature = '';
  private firstPass = true;
  hexesDrawn = 0;

  constructor(
    private scene: Phaser.Scene,
    private map: TheaterMap,
  ) {}

  get chunkCount(): number {
    return this.chunks.size;
  }
  get pendingChunks(): number {
    return this.queue.length;
  }

  /** Call every frame; cheap when the camera has not moved. */
  update(cam: Phaser.Cameras.Scene2D.Camera): void {
    const view = cam.worldView;
    const signature = `${Math.round(view.x)},${Math.round(view.y)},${Math.round(view.width)},${Math.round(view.height)},${cam.zoom.toFixed(3)}`;
    if (signature === this.lastViewSignature && this.queue.length === 0) return;
    this.lastViewSignature = signature;

    const colMin = Math.max(0, Math.floor(view.x / HEX_W) - 2);
    const colMax = Math.min(this.map.cols - 1, Math.ceil(view.right / HEX_W) + 2);
    const rowMin = Math.max(0, Math.floor(view.y / ROW_STEP) - 2);
    const rowMax = Math.min(this.map.rows - 1, Math.ceil(view.bottom / ROW_STEP) + 2);

    const chunkCols = Math.floor((this.map.cols - 1) / CHUNK) + 1;
    const chunkRows = Math.floor((this.map.rows - 1) / CHUNK) + 1;

    const needed = new Set<string>();
    const keep = new Set<string>();
    for (let cy = Math.floor(rowMin / CHUNK); cy <= Math.floor(rowMax / CHUNK); cy++) {
      for (let cx = Math.floor(colMin / CHUNK); cx <= Math.floor(colMax / CHUNK); cx++) {
        if (cx < 0 || cy < 0 || cx >= chunkCols || cy >= chunkRows) continue;
        const key = chunkKey(cx, cy);
        needed.add(key);
        keep.add(key);
        if (!this.chunks.has(key) && !this.queued.has(key)) {
          this.queue.push({ cx, cy });
          this.queued.add(key);
        }
      }
    }
    // Wider retention ring: avoid rebuild churn when panning back and forth.
    for (let cy = Math.floor(rowMin / CHUNK) - 1; cy <= Math.floor(rowMax / CHUNK) + 1; cy++) {
      for (let cx = Math.floor(colMin / CHUNK) - 1; cx <= Math.floor(colMax / CHUNK) + 1; cx++) {
        if (cx >= 0 && cy >= 0 && cx < chunkCols && cy < chunkRows) keep.add(chunkKey(cx, cy));
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (!keep.has(key)) this.destroyChunk(key, chunk);
    }

    // Build a few chunks per frame so a long pan never stalls the frame.
    const budget = this.firstPass ? this.queue.length : 2;
    for (let i = 0; i < budget; i++) {
      const next = this.queue.shift();
      if (!next) break;
      const key = chunkKey(next.cx, next.cy);
      this.queued.delete(key);
      if (!this.chunks.has(key)) this.buildChunk(next.cx, next.cy);
    }
    if (this.queue.length === 0) this.firstPass = false;
  }

  private buildChunk(cx: number, cy: number): void {
    const col0 = cx * CHUNK;
    const row0 = cy * CHUNK;
    const cols = Math.min(CHUNK, this.map.cols - col0);
    const rows = Math.min(CHUNK, this.map.rows - row0);
    if (cols <= 0 || rows <= 0) return;

    const width = Math.ceil((cols + 1) * HEX_W + 4);
    const height = Math.ceil(rows * ROW_STEP + 2 * HEX_R + 4);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const anchor = hexToWorld(col0, row0);
    const originX = anchor.x - HEX_W / 2 - 2;
    const originY = anchor.y - HEX_R - 2;

    let drawn = 0;
    for (let row = row0; row < row0 + rows; row++) {
      for (let col = col0; col < col0 + cols; col++) {
        const tile = this.map.hexAt(col, row);
        if (!tile) continue;
        const lx = tile.x - originX;
        const ly = tile.y - originY;
        const base = BASE_RGB[tile.terrain];

        // Deterministic per-hex value shift keeps neighbouring hexes readable
        // without drawing a full grid of strokes.
        const shift = (hash01(col, row, 7) - 0.5) * 12;
        ctx.beginPath();
        const corners = hexCorners(lx, ly, HEX_R + 0.5);
        ctx.moveTo(corners[0]!.x, corners[0]!.y);
        for (let i = 1; i < 6; i++) ctx.lineTo(corners[i]!.x, corners[i]!.y);
        ctx.closePath();
        ctx.fillStyle = rgbCss(clampRgb(base[0] + shift, base[1] + shift, base[2] + shift));
        ctx.fill();

        // Political tint: countries read as coloured blocks without hiding terrain.
        if (!TERRAIN[tile.terrain].water && tile.owner !== 'neutral') {
          const ownerRgb = OWNER_RGB[tile.owner];
          if (ownerRgb) {
            ctx.globalAlpha = OWNER_TINT_ALPHA;
            ctx.fillStyle = rgbCss(ownerRgb);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
        drawn++;
      }
    }

    // The texture key must match the chunk-map key, otherwise the cache check
    // (`chunks.has(chunkKey)`) never hits and the same chunk rebuilds forever.
    const key = chunkKey(cx, cy);
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.textures.addCanvas(key, canvas);
    const image = this.scene.add
      .image(originX, originY, key)
      .setOrigin(0, 0)
      .setDepth(0);
    this.chunks.set(key, { image, cx, cy, hexes: drawn });
    this.hexesDrawn += drawn;
  }

  private destroyChunk(key: string, chunk: ChunkView): void {
    chunk.image.destroy();
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.hexesDrawn -= chunk.hexes;
    this.chunks.delete(key);
  }

  destroy(): void {
    for (const [key, chunk] of this.chunks) this.destroyChunk(key, chunk);
    this.queue.length = 0;
    this.queued.clear();
  }
}

function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function clampRgb(r: number, g: number, b: number): Rgb {
  return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
}

function rgbCss(rgb: Rgb): string {
  return `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`;
}
