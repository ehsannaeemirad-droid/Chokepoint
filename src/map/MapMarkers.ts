/**
 * Dynamic map overlay: strategic nodes, unit markers, selection and ranges,
 * plus crisp DOM labels that ride above the WebGL canvas.
 */
import Phaser from 'phaser';
import { COLORS, FACTION_COLORS } from '../core/config';

const PULSE_STEPS = 8;
const REDUCED_MOTION =
  typeof window !== 'undefined' && 'matchMedia' in window
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : ({ matches: false } as MediaQueryList);
import type { Game } from '../core/Game';
import type { MapNodeDef, NodeKind, UnitInstance } from '../core/types';
import { strikeTargetsFor } from '../combat/targets';
import { bus } from '../ui/bus';
import { langRevision, localName } from '../i18n';
import { HEX_W, hexCorners, hexDistance, hexesInRange, hexToWorld } from './hex';
import { spreadLabels, type LabelBox } from './labelLayout';
import { DEFAULT_LAYER, layerDef, type LayerDef, type MapLayerId } from './layers';
import { defenceNetwork } from '../combat/defenceNetwork';
import type { TheaterMap } from './TheaterMap';

const NODE_COLORS: Record<NodeKind, string> = {
  airbase: '#E8E8E8',
  naval: '#7FC4E8',
  chokepoint: '#FFC857',
  oil: '#C9A227',
  urban: '#BDBDBD',
  nuclear: '#E05A5A',
  'missile-industry': '#E0A05A',
  port: '#8FD3C0',
};

export class MapMarkers {
  private g: Phaser.GameObjects.Graphics;
  private labelLayer: HTMLElement;
  private labels = new Map<string, HTMLElement>();
  private signature = '';
  /** Step index of the selection pulse, 0..PULSE_STEPS-1. */
  private phase = 0;
  private labelTimer = 0;
  /** Units that just received an order, with the frame time their flash ends. */
  private flashes = new Map<string, number>();
  private lastOrdered = new Set<string>();
  private staticLayer: Phaser.GameObjects.Graphics;
  private layer: LayerDef = layerDef(DEFAULT_LAYER);

  constructor(
    scene: Phaser.Scene,
    private game: Game,
    private map: TheaterMap,
  ) {
    this.staticLayer = scene.add.graphics().setDepth(2);
    this.g = scene.add.graphics().setDepth(5);
    this.labelLayer = document.getElementById('node-labels') ?? document.body;
  }

  /** Switch the strategic layer; the overlay is redrawn on the next frame. */
  setLayer(id: MapLayerId): void {
    if (this.layer.id === id) return;
    this.layer = layerDef(id);
    this.signature = '';
  }

  /** 0 when motion is reduced, else a 0→1 triangle wave over the pulse steps. */
  private pulseAmount(): number {
    if (REDUCED_MOTION.matches) return 0;
    const t = this.phase / PULSE_STEPS;
    return t <= 0.5 ? t * 2 : (1 - t) * 2;
  }

  private staticSignature(cam: Phaser.Cameras.Scene2D.Camera): string {
    return [
      this.layer.id,
      cam.worldView.x.toFixed(1),
      cam.worldView.y.toFixed(1),
      cam.worldView.width.toFixed(1),
      cam.zoom.toFixed(3),
      this.game.snap.turn,
      this.game.snap.orders.length,
      this.game.selection.hexId ?? '-',
      this.game.selection.unitUid ?? '-',
      this.game.selection.mode,
      this.game.snap.units.length,
      langRevision(),
    ].join('|');
  }

  update(cam: Phaser.Cameras.Scene2D.Camera): void {
    // The overlay is cached against a signature, which is what keeps panning
    // cheap. A pulsing selection is the one thing that has to change without
    // the state changing, so while something is selected the signature is
    // invalidated a few times a second instead of every frame.
    // A newly queued order flashes its unit, which is the feedback that the
    // tap landed where the player meant it to.
    const ordered = new Set(
      this.game.snap.orders.flatMap((o) => ('unitUid' in o && o.unitUid ? [o.unitUid] : [])),
    );
    const now = performance.now();
    for (const uid of ordered) {
      if (!this.lastOrdered.has(uid)) this.flashes.set(uid, now + (REDUCED_MOTION.matches ? 0 : 520));
    }
    this.lastOrdered = ordered;
    for (const [uid, until] of this.flashes) if (until <= now) this.flashes.delete(uid);
    if (this.flashes.size > 0 && !REDUCED_MOTION.matches) this.signature = '';

    const selection = this.game.selection;
    if (!REDUCED_MOTION.matches && (selection.hexId || selection.unitUid)) {
      const phase = Math.floor(performance.now() / 160) % PULSE_STEPS;
      if (phase !== this.phase) {
        this.phase = phase;
        this.signature = '';
      }
    }

    const sig = this.staticSignature(cam);
    if (sig === this.signature) return;
    this.signature = sig;

    this.g.clear();
    this.staticLayer.clear();
    const zoom = cam.zoom;
    const view = cam.worldView;

    // --- ranges for the selected unit ---------------------------------------
    const unit = this.game.selectedUnit;
    const center = this.game.selectedHex;
    if (unit && center) {
      const def = this.game.snap.units.length ? this.typeOf(unit) : null;
      if (def && this.game.selection.mode !== 'idle') {
        const mode = this.game.selection.mode;
        const range = mode === 'move' ? def.mov : def.rng;
        const color =
          mode === 'move' ? 0x4caf50 : mode === 'mine' ? 0xffc857 : mode === 'clear' ? 0x4fc3f7 : 0xe05a5a;
        for (const hex of hexesInRange(center, range)) {
          const tile = this.map.hexAt(hex.col, hex.row);
          if (!tile) continue;
          this.g.fillStyle(color, 0.14);
          this.g.fillPoints(hexCorners(tile.x, tile.y, 28).map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
          this.g.lineStyle(1 / zoom, color, 0.25);
          this.g.strokePoints(hexCorners(tile.x, tile.y, 28).map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
        }
      }
    }

    // --- valid-target highlights + restriction markers (Phase 5) -------------
    if (unit && center && this.game.selection.mode === 'strike') {
      const targets = strikeTargetsFor(
        this.game.snap,
        this.map,
        unit,
        (nodeId) => {
          const node = this.map.nodeById.get(nodeId);
          return node ? localName(node) : nodeId;
        },
        (col, row) => `${col},${row}`,
      );
      for (const target of targets) {
        const tile = this.map.hexAt(target.col, target.row);
        if (!tile) continue;
        this.g.fillStyle(0xd32f2f, 0.22);
        this.g.fillPoints(hexCorners(tile.x, tile.y, 28).map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
        this.g.lineStyle(1.5 / zoom, 0xff6b6b, 0.9);
        this.g.strokePoints(hexCorners(tile.x, tile.y, 28).map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
        // Restriction marker: hardened and buried sites need a bunker-buster.
        if (target.hardened || target.buried) {
          this.g.fillStyle(0xffa000, 0.95);
          this.g.fillTriangle(tile.x, tile.y - 30 / zoom - 8 / zoom, tile.x - 5 / zoom, tile.y - 30 / zoom - 16 / zoom, tile.x + 5 / zoom, tile.y - 30 / zoom - 16 / zoom);
        }
      }
    }

    // --- selection ring ------------------------------------------------------
    if (center) {
      const tile = this.map.hexAt(center.col, center.row);
      if (tile) {
        const pulse = this.pulseAmount();
        const pts = hexCorners(tile.x, tile.y, 27).map((p) => new Phaser.Math.Vector2(p.x, p.y));
        this.g.lineStyle(2.5 / zoom, 0xffffff, 0.95);
        this.g.strokePoints(pts, true);
        // A second ring breathing outward: the selected hex is visible at a
        // glance even when the label layer is busy.
        if (pulse > 0) {
          const outer = hexCorners(tile.x, tile.y, 27 + 6 * pulse).map((p) => new Phaser.Math.Vector2(p.x, p.y));
          this.g.lineStyle(2 / zoom, 0xffffff, 0.5 * (1 - pulse));
          this.g.strokePoints(outer, true);
        }
      }
    }

    // --- strategic nodes ----------------------------------------------------
    for (const node of this.map.nodes) {
      const hex = this.map.nodeHexOf(node.id);
      if (!hex) continue;
      const tile = this.map.hexAt(hex.col, hex.row);
      if (!tile) continue;
      if (!rectContains(view, tile.x, tile.y, 60)) continue;
      this.drawNode(node, tile.x, tile.y, zoom);
    }

    // --- units --------------------------------------------------------------
    const byHex = new Map<string, UnitInstance[]>();
    for (const u of this.game.visibleUnits()) {
      const key = `${u.col},${u.row}`;
      const list = byHex.get(key) ?? [];
      list.push(u);
      byHex.set(key, list);
    }
    for (const [key, units] of byHex) {
      const [col, row] = key.split(',').map(Number);
      const tile = this.map.hexAt(col!, row!);
      if (!tile || !rectContains(view, tile.x, tile.y, 60)) continue;
      units.forEach((u, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(1, units.length);
        const offset = units.length > 1 ? 11 / zoom : 0;
        this.drawUnit(u, tile.x + Math.cos(angle) * offset, tile.y + Math.sin(angle) * offset, zoom, index);
      });
    }

    // --- air-defence coverage (strategic layer) ------------------------------
    if (this.layer.coverage) {
      // Ring colour is the network's own health, not just the flag: a degraded
      // network looks degraded instead of showing confident coverage.
      const health = new Map<string, number>();
      const tone = (faction: string): number => {
        let value = health.get(faction);
        if (value === undefined) {
          value = defenceNetwork(this.game.snap, this.game.map, faction as never).effectiveness;
          health.set(faction, value);
        }
        return value >= 0.7 ? 0x4caf50 : value >= 0.4 ? 0xe0a800 : 0xd32f2f;
      };
      for (const unit of this.game.visibleUnits()) {
        if (unitCategory(this.game, unit) !== 'defense') continue;
        const reach = unitRng(this.game, unit);
        if (reach <= 0) continue;
        const world = hexToWorld(unit.col, unit.row);
        const radius = reach * HEX_W * 0.92;
        const color = tone(unit.faction);
        this.g.fillStyle(color, 0.07);
        this.g.fillCircle(world.x, world.y, radius);
        this.g.lineStyle(1.5 / zoom, color, 0.4);
        this.g.strokeCircle(world.x, world.y, radius);
      }
    }

    this.updateLabels(cam);
  }

  private typeOf(unit: UnitInstance) {
    // Local import avoided to keep this file free of engine dependencies.
    return {
      mov: this.game.snap.orders.length >= 0 ? unitMov(this.game, unit) : 1,
      rng: unitRng(this.game, unit),
    };
  }

  private drawNode(node: MapNodeDef, x: number, y: number, zoom: number): void {
    const r = 10 / zoom;
    const color = hexToNumber(FACTION_COLORS[node.operators[0] ?? node.host] ?? COLORS.textDim);
    const integrity = this.game.snap.nodes[node.id]?.integrity ?? 100;

    this.g.fillStyle(0x0b0e11, 0.55);
    this.g.fillCircle(x, y, r + 3 / zoom);

    switch (node.kind) {
      case 'airbase':
        this.g.fillStyle(color, 1);
        this.g.fillTriangle(x, y - r, x - r * 0.9, y + r * 0.7, x + r * 0.9, y + r * 0.7);
        break;
      case 'naval':
        this.g.fillStyle(color, 1);
        this.g.fillCircle(x, y, r * 0.85);
        this.g.lineStyle(2 / zoom, 0x0b0e11, 0.8);
        this.g.lineBetween(x - r * 0.8, y, x + r * 0.8, y);
        break;
      case 'chokepoint':
        this.g.fillStyle(hexToNumber(NODE_COLORS.chokepoint), 1);
        this.g.fillTriangle(x, y - r, x + r, y, x, y + r);
        this.g.fillTriangle(x, y - r, x - r, y, x, y + r);
        break;
      case 'oil':
        this.g.fillStyle(hexToNumber(NODE_COLORS.oil), 1);
        this.g.fillRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
        break;
      case 'missile-industry':
        this.g.fillStyle(hexToNumber(NODE_COLORS['missile-industry']), 1);
        this.g.fillTriangle(x, y - r, x + r * 0.9, y + r * 0.6, x - r * 0.9, y + r * 0.6);
        break;
      case 'nuclear':
        this.g.fillStyle(hexToNumber(NODE_COLORS.nuclear), 1);
        this.g.fillRect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
        this.g.lineStyle(2 / zoom, 0xffffff, 0.85);
        this.g.strokeRect(x - r * 0.45, y - r * 0.45, r * 0.9, r * 0.9);
        break;
      case 'port':
        this.g.fillStyle(hexToNumber(NODE_COLORS.port), 1);
        this.g.fillRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
        break;
      default:
        this.g.fillStyle(hexToNumber(NODE_COLORS.urban), 1);
        this.g.fillCircle(x, y, r * 0.85);
        break;
    }

    if (integrity < 100) {
      this.g.lineStyle(2 / zoom, hexToNumber(COLORS.alert), 0.95);
      this.g.strokeCircle(x, y, r + 4 / zoom);
    }
    if (node.strategic) {
      this.g.lineStyle(1.5 / zoom, 0xffffff, 0.5);
      this.g.strokeCircle(x, y, r + 2 / zoom);
    }
  }

  private drawUnit(unit: UnitInstance, x: number, y: number, zoom: number, index: number): void {
    const r = 5.5 / zoom;
    const color = hexToNumber(FACTION_COLORS[unit.faction] ?? COLORS.textDim);
    const selected = this.game.selection.unitUid === unit.uid;
    this.g.fillStyle(color, 1);
    const def = unitCategory(this.game, unit);
    if (def === 'air') {
      this.g.fillTriangle(x, y - r, x - r, y + r, x + r, y + r);
    } else if (def === 'naval') {
      this.g.fillCircle(x, y, r);
    } else if (def === 'missile' || def === 'drone') {
      this.g.fillTriangle(x, y - r, x + r, y, x, y + r);
      this.g.fillTriangle(x, y - r, x - r, y, x, y + r);
    } else {
      this.g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const flashUntil = this.flashes.get(unit.uid);
    if (flashUntil && flashUntil > performance.now()) {
      const strength = (flashUntil - performance.now()) / 520;
      this.g.lineStyle(3 / zoom, 0x6ee787, 0.2 + 0.8 * strength);
      this.g.strokeCircle(x, y, r + (5 + 10 * (1 - strength)) / zoom);
    }
    if (selected) {
      const pulse = this.pulseAmount();
      if (pulse > 0) {
        this.g.lineStyle(1.5 / zoom, 0xffffff, 0.45 * (1 - pulse));
        this.g.strokeCircle(x, y, r + 3 / zoom + 7 * pulse / zoom);
      }
      this.g.lineStyle(2 / zoom, 0xffffff, 1);
      this.g.strokeCircle(x, y, r + 3 / zoom);
    }
    void index;
  }

  private updateLabels(cam: Phaser.Cameras.Scene2D.Camera): void {
    const view = cam.worldView;
    const zoom = cam.zoom;
    const shown = new Set<string>();
    const pending: Array<{ el: HTMLElement; box: LabelBox }> = [];

    for (const node of this.map.nodes) {
      const hex = this.map.nodeHexOf(node.id);
      if (!hex) continue;
      const tile = this.map.hexAt(hex.col, hex.row);
      if (!tile) continue;
      const visible = rectContains(view, tile.x, tile.y, 40);
      // Analytical layers keep every facility named so the layer is readable
      // without zooming; the political view stays uncluttered.
      const showLabel = visible && (node.strategic || this.layer.emphasiseNodes || zoom > 0.85);
      if (!showLabel) continue;
      shown.add(node.id);
      let el = this.labels.get(node.id);
      if (!el) {
        el = document.createElement('button');
        el.className = 'node-label';
        (el as HTMLButtonElement).type = 'button';
        this.labelLayer.appendChild(el);
        this.labels.set(node.id, el);
      }
      const state = this.game.snap.nodes[node.id];
      const friendly = node.operators.includes(this.game.snap.faction);
      el.className = `node-label${friendly ? ' friendly' : ''}${node.strategic ? ' strategic' : ''}`;
      el.innerHTML = `<span class="dot" style="background:${FACTION_COLORS[node.operators[0] ?? node.host] ?? COLORS.textDim}"></span><span class="name">${localName(node)}</span>${state && state.integrity < 100 ? `<span class="int">${Math.round(state.integrity)}%</span>` : ''}`;
      el.title = localName(node);
      el.setAttribute('aria-label', localName(node));
      el.onclick = () => this.game.selectHex(hex.col, hex.row);
      // Touch has no hover, so a long press is how the full name is revealed
      // when the label itself has been ellipsised.
      el.onpointerdown = () => {
        window.clearTimeout(this.labelTimer);
        this.labelTimer = window.setTimeout(() => {
          bus.dispatchEvent(
            new CustomEvent('label-info', { detail: { text: localName(node), integrity: state?.integrity } }),
          );
        }, 450);
      };
      const cancel = () => window.clearTimeout(this.labelTimer);
      el.onpointerup = cancel;
      el.onpointerleave = cancel;
      el.onpointercancel = cancel;
      const sx = ((tile.x - view.x) / view.width) * cam.width;
      const sy = ((tile.y - view.y) / view.height) * cam.height;
      const width = el.offsetWidth || 96;
      // The right-hand tool strip is 56px of chrome: a label that slides under
      // it is unreadable, so clamp the whole box inside the playable area.
      const maxX = cam.width - width - 64;
      pending.push({
        el,
        box: {
          x: Math.max(6, Math.min(Math.round(sx + 12 / zoom), maxX)),
          y: Math.round(sy - 10 / zoom),
          w: width,
          h: el.offsetHeight || 20,
        },
      });
    }

    // Neighbouring facilities land within a few pixels of each other at the
    // initial zoom; resolve the collisions before the labels are positioned.
    const placed = spreadLabels(pending.map((entry) => entry.box));
    pending.forEach((entry, index) => {
      const point = placed[index]!;
      entry.el.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    });

    for (const [id, el] of this.labels) {
      if (!shown.has(id)) {
        el.remove();
        this.labels.delete(id);
      }
    }
  }

  destroy(): void {
    for (const el of this.labels.values()) el.remove();
    this.labels.clear();
    this.g.destroy();
    this.staticLayer.destroy();
  }
}

function rectContains(view: Phaser.Geom.Rectangle, x: number, y: number, pad: number): boolean {
  return x >= view.x - pad && x <= view.right + pad && y >= view.y - pad && y <= view.bottom + pad;
}

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

/** Small indirections so the overlay does not import the whole unit database. */
function unitMov(game: Game, unit: UnitInstance): number {
  return game.snap.units.length >= 0 ? unitTypeMov(unit.typeId) : 1;
}
function unitRng(game: Game, unit: UnitInstance): number {
  return game.snap.units.length >= 0 ? unitTypeRng(unit.typeId) : 1;
}
function unitCategory(game: Game, unit: UnitInstance): string {
  return game.snap.units.length >= 0 ? unitTypeCategory(unit.typeId) : 'ground';
}

import unitData from '../data/units.json';
import type { UnitTypeDef } from '../core/types';
const UNIT_DEFS = new Map<string, UnitTypeDef>(
  (Object.values(unitData).flat() as unknown as UnitTypeDef[]).map((u) => [u.id, u]),
);
function unitTypeMov(id: string): number {
  return UNIT_DEFS.get(id)?.mov ?? 1;
}
function unitTypeRng(id: string): number {
  return UNIT_DEFS.get(id)?.rng ?? 1;
}
function unitTypeCategory(id: string): string {
  return UNIT_DEFS.get(id)?.category ?? 'ground';
}
void hexDistance;
