/**
 * Chunked hex renderer.
 *
 * Each 16x16 chunk is baked once into an offscreen canvas, uploaded as a single
 * texture and drawn as one quad. Chunks outside the camera viewport + margin are
 * destroyed, so terrain memory and draw calls stay bounded no matter how far the
 * camera pans.
 *
 * The hex grid is the simulation's coordinate system, not the visual language:
 * terrain is filled with muted geography, given baked detail (ridges, dunes,
 * urban blocks), a hairline grid and borders only where ownership or land/water
 * actually changes. A strategic layer changes the treatment, never the tiles.
 */
import Phaser from 'phaser';
import { COLORS, FACTION_COLORS } from '../core/config';
import { hash01 } from '../core/rng';
import type { TerrainKind } from '../core/types';
import { CHUNK, HEX_R, HEX_W, ROW_STEP, chunkKey, hexCorners, hexNeighbors, hexToWorld } from './hex';
import { DEFAULT_LAYER, layerDef, type LayerDef, type MapLayerId } from './layers';
import type { HexTile, TheaterMap } from './TheaterMap';
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

/** Neutral tone terrain is washed toward on the analytical layers. */
const SLATE: Rgb = [88, 96, 102];

const OWNER_RGB: Record<string, Rgb> = Object.fromEntries(
  Object.entries(FACTION_COLORS).map(([id, hex]) => [id, hexToRgb(hex)]),
);

export class ChunkRenderer {
  private chunks = new Map<string, ChunkView>();
  private queue: Array<{ cx: number; cy: number }> = [];
  private queued = new Set<string>();
  private lastViewSignature = '';
  private firstPass = true;
  private layer: LayerDef = layerDef(DEFAULT_LAYER);
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
  get activeLayer(): MapLayerId {
    return this.layer.id;
  }

  /**
   * Switch the strategic layer. Baked chunks encode the treatment, so they are
   * dropped and rebuilt on the next frame rather than recoloured in place.
   */
  setLayer(id: MapLayerId): void {
    if (this.layer.id === id) return;
    this.layer = layerDef(id);
    for (const [key, chunk] of this.chunks) this.destroyChunk(key, chunk);
    this.queue.length = 0;
    this.queued.clear();
    this.lastViewSignature = '';
    this.firstPass = true;
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
    void needed;
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
    const treatment = this.layer;

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
        const shift = (hash01(col, row, 7) - 0.5) * 10;
        let fill = clampRgb(base[0] + shift, base[1] + shift, base[2] + shift);
        if (treatment.desaturate > 0) fill = mix(fill, SLATE, treatment.desaturate);

        const corners = hexCorners(lx, ly, HEX_R + 0.5);
        ctx.beginPath();
        ctx.moveTo(corners[0]!.x, corners[0]!.y);
        for (let i = 1; i < 6; i++) ctx.lineTo(corners[i]!.x, corners[i]!.y);
        ctx.closePath();
        ctx.fillStyle = rgbCss(fill);
        ctx.fill();

        // Terrain detail is clipped to the hex so neighbours stay clean.
        if (treatment.detail > 0) {
          ctx.save();
          ctx.clip();
          drawDetail(ctx, tile, lx, ly, treatment.detail);
          ctx.restore();
        }

        // Political tint: countries read as coloured blocks without hiding terrain.
        const land = !TERRAIN[tile.terrain].water;
        if (land && tile.owner !== 'neutral' && treatment.ownerTint > 0) {
          const ownerRgb = OWNER_RGB[tile.owner];
          if (ownerRgb) {
            ctx.globalAlpha = treatment.ownerTint;
            ctx.fillStyle = rgbCss(ownerRgb);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }

        if (treatment.gridAlpha > 0) {
          ctx.lineWidth = 0.75;
          ctx.strokeStyle = `rgba(12,16,20,${treatment.gridAlpha})`;
          ctx.stroke();
        }

        // Borders only where the geography changes, never on every hex.
        if (land) {
          const neighbours = hexNeighbors(col, row).map((n) => this.map.hexAt(n.col, n.row));
          const touchesWater = neighbours.some((n) => n && TERRAIN[n.terrain].water);
          const touchesOther = neighbours.some(
            (n) => n && !TERRAIN[n.terrain].water && n.owner !== tile.owner,
          );
          if (touchesWater) {
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = 'rgba(226,236,240,0.30)';
            ctx.stroke();
          } else if (touchesOther) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(18,22,26,0.34)';
            ctx.stroke();
          }
        } else {
          const neighbours = hexNeighbors(col, row).map((n) => this.map.hexAt(n.col, n.row));
          if (neighbours.some((n) => n && !TERRAIN[n.terrain].water)) {
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = 'rgba(226,236,240,0.22)';
            ctx.stroke();
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

/** Baked terrain texture: one shape language per terrain kind. */
function drawDetail(
  ctx: CanvasRenderingContext2D,
  tile: HexTile,
  lx: number,
  ly: number,
  strength: number,
): void {
  const { col, row, terrain } = tile;
  const r = HEX_R;
  ctx.lineCap = 'round';

  switch (terrain) {
    case 'mountain': {
      ctx.strokeStyle = `rgba(38,34,29,${0.20 * strength})`;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const y = ly - r * 0.35 + i * r * 0.3 + (hash01(col, row, 20 + i) - 0.5) * r * 0.18;
        const lean = (hash01(col, row, 30 + i) - 0.5) * r * 0.4;
        ctx.beginPath();
        ctx.moveTo(lx - r * 0.6, y);
        ctx.quadraticCurveTo(lx, y - r * 0.22, lx + r * 0.6, y + lean);
        ctx.stroke();
      }
      break;
    }
    case 'desert': {
      ctx.strokeStyle = `rgba(122,98,66,${0.16 * strength})`;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 2; i++) {
        const y = ly - r * 0.2 + i * r * 0.42 + (hash01(col, row, 40 + i) - 0.5) * r * 0.2;
        ctx.beginPath();
        ctx.moveTo(lx - r * 0.65, y);
        ctx.quadraticCurveTo(lx, y - r * 0.28, lx + r * 0.65, y);
        ctx.stroke();
      }
      break;
    }
    case 'plains': {
      ctx.strokeStyle = `rgba(64,74,46,${0.16 * strength})`;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const x = lx - r * 0.4 + i * r * 0.4 + (hash01(col, row, 50 + i) - 0.5) * r * 0.2;
        const y = ly + (hash01(col, row, 60 + i) - 0.5) * r * 0.7;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.12);
        ctx.lineTo(x, y + r * 0.12);
        ctx.stroke();
      }
      break;
    }
    case 'urban': {
      ctx.fillStyle = `rgba(58,56,50,${0.18 * strength})`;
      for (let i = 0; i < 4; i++) {
        const x = lx - r * 0.45 + (i % 2) * r * 0.45 + (hash01(col, row, 70 + i) - 0.5) * r * 0.14;
        const y = ly - r * 0.35 + Math.floor(i / 2) * r * 0.4 + (hash01(col, row, 80 + i) - 0.5) * r * 0.14;
        ctx.fillRect(x, y, r * 0.26, r * 0.26);
      }
      break;
    }
    case 'hardened': {
      ctx.strokeStyle = `rgba(20,18,16,${0.28 * strength})`;
      ctx.lineWidth = 1.2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(lx - r * 0.5, ly + i * r * 0.3);
        ctx.lineTo(lx + r * 0.5, ly + i * r * 0.3);
        ctx.moveTo(lx + i * r * 0.3, ly - r * 0.5);
        ctx.lineTo(lx + i * r * 0.3, ly + r * 0.5);
        ctx.stroke();
      }
      break;
    }
    case 'deep':
    case 'coast': {
      ctx.strokeStyle = `rgba(214,232,240,${0.07 * strength})`;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 2; i++) {
        const y = ly - r * 0.25 + i * r * 0.5 + (hash01(col, row, 90 + i) - 0.5) * r * 0.2;
        ctx.beginPath();
        ctx.moveTo(lx - r * 0.7, y);
        ctx.quadraticCurveTo(lx - r * 0.2, y - r * 0.1, lx + r * 0.2, y);
        ctx.quadraticCurveTo(lx + r * 0.45, y + r * 0.1, lx + r * 0.7, y);
        ctx.stroke();
      }
      break;
    }
  }
}

function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function clampRgb(r: number, g: number, b: number): Rgb {
  return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
}

function mix(from: Rgb, toward: Rgb, amount: number): Rgb {
  const t = Math.max(0, Math.min(1, amount));
  return clampRgb(
    from[0] + (toward[0] - from[0]) * t,
    from[1] + (toward[1] - from[1]) * t,
    from[2] + (toward[2] - from[2]) * t,
  );
}

function rgbCss(rgb: Rgb): string {
  return `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`;
}
