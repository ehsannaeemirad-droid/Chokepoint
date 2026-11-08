/**
 * Strategic map scene: chunked terrain, camera (drag / pinch / wheel), hex
 * picking, order targeting and the resolution camera focus.
 */
import Phaser from 'phaser';
import { COLORS, ZOOM } from '../core/config';
import { game } from '../core/Game';
import type { Order } from '../core/types';
import { ChunkRenderer } from '../map/ChunkRenderer';
import { MapMarkers } from '../map/MapMarkers';
import { hexToWorld, worldToHex, type HexCoord } from '../map/hex';
import { mapPixelSize } from '../map/TheaterMap';
import { perf } from '../perf';
import { bus, showToast, type FocusDetail } from '../ui/bus';

interface DragState {
  active: boolean;
  moved: boolean;
  lastX: number;
  lastY: number;
}

interface PinchState {
  startDist: number;
  startZoom: number;
  worldX: number;
  worldY: number;
}

export class MapScene extends Phaser.Scene {
  private chunkRenderer!: ChunkRenderer;
  private markers!: MapMarkers;
  private cam!: Phaser.Cameras.Scene2D.Camera;
  private drag: DragState = { active: false, moved: false, lastX: 0, lastY: 0 };
  private pinch: PinchState | null = null;
  private pointersDown = new Set<number>();
  private lastTapAt = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  private lastPointerCount = 0;
  private longPress: { timer: number; x: number; y: number; hex: HexCoord } | null = null;
  private camTimer = 0;

  constructor() {
    super('map');
  }

  create(): void {
    const map = game.map;
    this.cam = this.cameras.main;
    this.cam.setBackgroundColor(COLORS.bg);
    const size = mapPixelSize(map);
    this.cam.setBounds(0, 0, size.width, size.height);

    const start = map.nodeHexOf('gulf_platforms') ?? { col: 40, row: 30 };
    const startWorld = hexToWorld(start.col, start.row);
    this.cam.setZoom(ZOOM.initial);
    this.cam.centerOn(startWorld.x, startWorld.y);

    this.chunkRenderer = new ChunkRenderer(this, map);
    this.markers = new MapMarkers(this, game, map);

    this.setupInput();
    bus.addEventListener('focus', ((event: Event) => {
      const detail = (event as CustomEvent<FocusDetail>).detail;
      this.focusHex(detail);
    }) as EventListener);
    bus.addEventListener('zoom', ((event: Event) => {
      const { factor } = (event as CustomEvent<{ factor: number }>).detail;
      const next = Phaser.Math.Clamp(this.cam.zoom * factor, ZOOM.min, ZOOM.max);
      this.zoomAt(this.cam.width / 2, this.cam.height / 2, next);
    }) as EventListener);
    bus.addEventListener('pan', ((event: Event) => {
      const { dx, dy } = (event as CustomEvent<{ dx: number; dy: number }>).detail;
      this.panBy(dx, dy);
    }) as EventListener);

    this.scale.on('resize', () => this.cam.setSize(this.scale.width, this.scale.height));
    this.chunkRenderer.update(this.cam);
    this.markers.update(this.cam);

    window.__choke = {
      game,
      scene: this,
      perf,
      stats: () => this.stats(),
      panBench: (ms = 2500) => this.panBench(ms),
    };
  }

  override update(time: number, delta: number): void {
    perf.sample(delta);
    this.chunkRenderer.update(this.cam);
    this.markers.update(this.cam);
    // Keep the camera inside the map after pinch/wheel zoom.
    this.cam.setScroll(this.cam.scrollX, this.cam.scrollY);
    // Broadcast a low-frequency camera snapshot for the DOM minimap.
    this.camTimer -= delta;
    if (this.camTimer <= 0) {
      this.camTimer = 160;
      const view = this.cam.worldView;
      bus.dispatchEvent(
        new CustomEvent('camera', { detail: { x: view.x, y: view.y, w: view.width, h: view.height } }),
      );
      void time;
    }
  }

  /** Screen-space pan used by the keyboard controls. */
  panBy(dx: number, dy: number): void {
    this.cam.setScroll(this.cam.scrollX + dx / this.cam.zoom, this.cam.scrollY + dy / this.cam.zoom);
  }

  stats(): Record<string, number> {
    return {
      fps: Math.round(perf.fpsValue),
      chunks: this.chunkRenderer.chunkCount,
      hexes: this.chunkRenderer.hexesDrawn,
      pendingChunks: this.chunkRenderer.pendingChunks,
      zoom: Number(this.cam.zoom.toFixed(2)),
      units: game.snap.units.length,
      nodes: game.map.nodes.length,
    };
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.pointersDown.add(pointer.id);
      this.lastPointerCount = this.pointersDown.size;
      if (this.pointersDown.size === 2) {
        this.beginPinch();
        return;
      }
      this.drag = { active: true, moved: false, lastX: pointer.x, lastY: pointer.y };
      this.beginLongPress(pointer);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.pointersDown.size >= 2 && this.pinch) {
        this.cancelLongPress();
        this.updatePinch();
        return;
      }
      if (!this.drag.active || !this.pointersDown.has(pointer.id)) return;
      if (this.longPress && Math.hypot(pointer.x - this.longPress.x, pointer.y - this.longPress.y) > 10) {
        this.cancelLongPress();
      }
      const dx = pointer.x - this.drag.lastX;
      const dy = pointer.y - this.drag.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 1) this.drag.moved = true;
      this.cam.scrollX -= dx / this.cam.zoom;
      this.cam.scrollY -= dy / this.cam.zoom;
      this.drag.lastX = pointer.x;
      this.drag.lastY = pointer.y;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.pointersDown.delete(pointer.id);
      this.cancelLongPress();
      if (this.pointersDown.size < 2) this.pinch = null;
      const wasTap = this.drag.active && !this.drag.moved && this.lastPointerCount === 1;
      this.drag.active = false;
      this.lastPointerCount = this.pointersDown.size;
      if (wasTap) this.handleTap(pointer);
    });

    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _g: unknown, _dx: number, dy: number) => {
      const next = Phaser.Math.Clamp(this.cam.zoom * (dy > 0 ? 0.9 : 1.1), ZOOM.min, ZOOM.max);
      this.zoomAt(pointer.x, pointer.y, next);
    });
  }

  /**
   * Phase 5: long-press (450 ms, less than 10 px of drift) opens the hex
   * information card without waiting for the tap gesture — the spec's
   * "long-press for hex info".
   */
  private beginLongPress(pointer: Phaser.Input.Pointer): void {
    const world = this.screenToWorld(pointer.x, pointer.y);
    const hex = worldToHex(world.x, world.y);
    if (!hex) return;
    this.cancelLongPress();
    this.longPress = { timer: window.setTimeout(() => {
      this.longPress = null;
      game.selectHex(hex.col, hex.row);
    }, 450), x: pointer.x, y: pointer.y, hex };
  }

  private cancelLongPress(): void {
    if (!this.longPress) return;
    window.clearTimeout(this.longPress.timer);
    this.longPress = null;
  }

  private beginPinch(): void {
    const active = [...this.pointersDown];
    const a = this.input.manager.pointers.find((p) => p.id === active[0]);
    const b = this.input.manager.pointers.find((p) => p.id === active[1]);
    if (!a || !b) return;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const world = this.screenToWorld(mid.x, mid.y);
    this.pinch = {
      startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      startZoom: this.cam.zoom,
      worldX: world.x,
      worldY: world.y,
    };
    this.drag.active = false;
  }

  private updatePinch(): void {
    if (!this.pinch) return;
    const active = [...this.pointersDown];
    const a = this.input.manager.pointers.find((p) => p.id === active[0]);
    const b = this.input.manager.pointers.find((p) => p.id === active[1]);
    if (!a || !b) return;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const zoom = Phaser.Math.Clamp(this.pinch.startZoom * (dist / this.pinch.startDist), ZOOM.min, ZOOM.max);
    this.cam.setZoom(zoom);
    this.anchorWorld(this.pinch.worldX, this.pinch.worldY, mid.x, mid.y);
  }

  private zoomAt(screenX: number, screenY: number, zoom: number): void {
    const world = this.screenToWorld(screenX, screenY);
    this.cam.setZoom(zoom);
    this.anchorWorld(world.x, world.y, screenX, screenY);
  }

  /** Place a world point under a screen point at the current zoom. */
  private anchorWorld(worldX: number, worldY: number, screenX: number, screenY: number): void {
    const zoom = this.cam.zoom;
    const width = this.cam.width;
    const height = this.cam.height;
    this.cam.setScroll(
      worldX - screenX / zoom - width / 2 + width / (2 * zoom),
      worldY - screenY / zoom - height / 2 + height / (2 * zoom),
    );
  }

  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const view = this.cam.worldView;
    return {
      x: view.x + (screenX / this.cam.width) * view.width,
      y: view.y + (screenY / this.cam.height) * view.height,
    };
  }

  private handleTap(pointer: Phaser.Input.Pointer): void {
    const now = performance.now();
    const isDoubleTap =
      now - this.lastTapAt < 300 &&
      Math.abs(pointer.x - this.lastTapX) < 30 &&
      Math.abs(pointer.y - this.lastTapY) < 30;
    this.lastTapAt = now;
    this.lastTapX = pointer.x;
    this.lastTapY = pointer.y;

    if (isDoubleTap) {
      this.zoomAt(pointer.x, pointer.y, Math.min(ZOOM.max, this.cam.zoom * 1.6));
      return;
    }

    const world = this.screenToWorld(pointer.x, pointer.y);
    const hex = worldToHex(world.x, world.y);
    if (!hex) return;
    this.handleHexTap(hex);
  }

  private handleHexTap(hex: HexCoord): void {
    const mode = game.selection.mode;
    const unit = game.selectedUnit;
    if (mode !== 'idle' && unit) {
      const nodeId = game.map.hexToNode.get(`${hex.col},${hex.row}`);
      const order: Order =
        mode === 'move'
          ? { kind: 'move', unitUid: unit.uid, col: hex.col, row: hex.row }
          : mode === 'special'
            ? { kind: 'special', unitUid: unit.uid, col: hex.col, row: hex.row }
            : { kind: 'strike', unitUid: unit.uid, col: hex.col, row: hex.row, nodeId };
      const result = game.queueOrder(order);
      if (!result.ok) showToast(result.reason ?? 'Invalid order', 'warn');
      else showToast(mode === 'move' ? 'Move queued' : 'Strike queued', 'good');
      game.setMode('idle');
      return;
    }
    game.selectHex(hex.col, hex.row);
  }

  focusHex(hex: FocusDetail): void {
    const world = hexToWorld(hex.col, hex.row);
    const zoom = Math.max(this.cam.zoom, ZOOM.focus * 0.8);
    this.cam.setZoom(zoom);
    this.tweens.add({
      targets: this.cam,
      scrollX: world.x - this.cam.width / (2 * zoom),
      scrollY: world.y - this.cam.height / (2 * zoom),
      duration: 420,
      ease: 'Sine.easeInOut',
    });
  }

  centerOn(hex: HexCoord): void {
    this.focusHex(hex);
  }

  /**
   * Deterministic pan benchmark: sweeps the camera across the theatre and
   * returns frame statistics. Used to verify the 60fps budget.
   */
  panBench(durationMs = 2500): Promise<{ fps: number; minFps: number; p95FrameMs: number; samples: number; stats: Record<string, number> }> {
    perf.reset();
    const start = performance.now();
    const startScroll = this.cam.scrollX;
    const startZoom = this.cam.zoom;
    return new Promise((resolve) => {
      const step = () => {
        const t = (performance.now() - start) / durationMs;
        if (t >= 1) {
          this.cam.setScroll(startScroll, this.cam.scrollY);
          this.cam.setZoom(startZoom);
          resolve({ ...perf.summary(), stats: this.stats() });
          return;
        }
        // Sweep east-west across the Gulf and zoom in and out.
        this.cam.scrollX = startScroll + Math.sin(t * Math.PI * 2) * 1400;
        this.cam.scrollY = this.cam.scrollY + Math.sin(t * Math.PI * 4) * 4;
        this.cam.setZoom(ZOOM.initial + Math.sin(t * Math.PI * 2) * 0.12);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}
