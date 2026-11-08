/**
 * Phase 5: the minimap. A small canvas painted from the static terrain once
 * per game start, with node dots, visible unit pips and the camera viewport
 * rectangle redrawn on a low-frequency loop. Tap anywhere to jump the camera
 * there. Pure presentation: reads state, writes nothing back except the
 * camera focus bus event.
 */
import { FACTION_COLORS } from '../core/config';
import type { Game } from '../core/Game';
import { mapPixelSize, type TheaterMap } from '../map/TheaterMap';
import { TERRAIN } from '../map/terrain';
import { bus, focusHex, type FocusDetail } from './bus';

interface CameraDetail {
  x: number;
  y: number;
  w: number;
  h: number;
}

const REFRESH_MS = 160;

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement;
  private map: TheaterMap;
  private game: Game;
  private camera: CameraDetail | null = null;
  private lastDraw = 0;
  private raf = 0;

  constructor(root: HTMLElement, game: Game) {
    this.game = game;
    this.map = game.map;
    const size = mapPixelSize(this.map);
    this.canvas = document.createElement('canvas');
    // Match the theatre aspect (79 × 70 hexes) in a ~106 × 94 box.
    const width = 106;
    const height = Math.round((width * size.height) / size.width);
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.className = 'minimap-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Theatre minimap');
    this.ctx = this.canvas.getContext('2d')!;
    this.background = document.createElement('canvas');
    this.background.width = width;
    this.background.height = height;

    this.paintBackground();
    root.appendChild(this.canvas);

    this.canvas.addEventListener('pointerdown', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const fx = (event.clientX - rect.left) / rect.width;
      const fy = (event.clientY - rect.top) / rect.height;
      const col = Math.round(fx * (this.map.cols - 1));
      const row = Math.round(fy * (this.map.rows - 1));
      const tile = this.map.hexAt(col, row);
      if (!tile) return;
      focusHex({ col: tile.col, row: tile.row } satisfies FocusDetail);
    });

    bus.addEventListener('camera', ((event: Event) => {
      this.camera = (event as CustomEvent<CameraDetail>).detail;
    }) as EventListener);

    const loop = (time: number) => {
      if (time - this.lastDraw >= REFRESH_MS) {
        this.lastDraw = time;
        this.paint();
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Rebuild the static terrain layer (call after `game.start`). */
  repaintBackground(): void {
    this.paintBackground();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.canvas.remove();
  }

  private paintBackground(): void {
    const ctx = this.background.getContext('2d')!;
    const { width, height } = this.background;
    ctx.clearRect(0, 0, width, height);
    const cellW = width / this.map.cols;
    const cellH = height / this.map.rows;
    for (let row = 0; row < this.map.rows; row++) {
      for (let col = 0; col < this.map.cols; col++) {
        const tile = this.map.hexAt(col, row);
        if (!tile) continue;
        ctx.fillStyle = TERRAIN[tile.terrain].color;
        ctx.fillRect(col * cellW, row * cellH, cellW + 0.6, cellH + 0.6);
      }
    }
  }

  private paint(): void {
    const { width, height } = this.canvas;
    const size = mapPixelSize(this.map);
    const sx = width / size.width;
    const sy = height / size.height;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.drawImage(this.background, 0, 0);

    // Node dots.
    for (const node of this.map.nodes) {
      const hex = this.map.nodeHexOf(node.id);
      const tile = hex ? this.map.hexAt(hex.col, hex.row) : null;
      if (!tile) continue;
      const state = this.game.snap.nodes[node.id];
      this.ctx.fillStyle = state && state.integrity <= 0 ? '#666' : '#f5f5f5';
      this.ctx.fillRect(tile.x * sx - 1, tile.y * sy - 1, 2.4, 2.4);
    }

    // Visible unit pips (fog rules respected through visibleUnits()).
    for (const unit of this.game.visibleUnits()) {
      const tile = this.map.hexAt(unit.col, unit.row);
      if (!tile) continue;
      this.ctx.fillStyle = FACTION_COLORS[unit.faction] ?? '#999';
      this.ctx.beginPath();
      this.ctx.arc(tile.x * sx, tile.y * sy, 1.8, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Camera viewport rectangle.
    if (this.camera) {
      this.ctx.strokeStyle = 'rgba(245,245,245,0.9)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(
        this.camera.x * sx,
        this.camera.y * sy,
        this.camera.w * sx,
        this.camera.h * sy,
      );
    }
  }
}
