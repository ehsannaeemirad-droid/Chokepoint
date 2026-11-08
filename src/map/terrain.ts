/**
 * Terrain sampling. Pure functions: the same coordinates always produce the same
 * terrain, which is what lets chunks be thrown away and rebuilt cheaply.
 */
import { COLORS } from '../core/config';
import type { TerrainKind } from '../core/types';
import {
  CITIES,
  COUNTRIES,
  DESERTS,
  LAND_POLYGONS,
  MOUNTAINS,
  WATER_POLYGONS,
  type LonLat,
} from './geography';

export interface TerrainInfo {
  label: string;
  label_fa?: string;
  color: string;
  /** Movement cost in hexes per movement point (Infinity = impassable to ground). */
  moveCost: number;
  /** Defensive bonus applied to units standing here. */
  defence: number;
  water: boolean;
  blurb: string;
  blurb_fa?: string;
}

export const TERRAIN: Record<TerrainKind, TerrainInfo> = {
  deep: {
    label: 'Open Sea',
    label_fa: 'دریای آزاد',
    color: COLORS.water,
    moveCost: Number.POSITIVE_INFINITY,
    defence: 0,
    water: true,
    blurb: 'Naval and amphibious units only.',
    blurb_fa: 'فقط یگان‌های دریایی و آبی‌خاکی.',
  },
  coast: {
    label: 'Coastal Water',
    label_fa: 'آب ساحلی',
    color: COLORS.coast,
    moveCost: Number.POSITIVE_INFINITY,
    defence: 0,
    water: true,
    blurb: 'Littoral water: naval units, mines and anti-ship missiles.',
    blurb_fa: 'آب ساحلی: یگان دریایی، مین و موشک ضدکشتی.',
  },
  plains: {
    label: 'Arid Plains',
    label_fa: 'دشت خشک',
    color: COLORS.plains,
    moveCost: 1,
    defence: 0,
    water: false,
    blurb: 'Open ground: fast movement, no cover.',
    blurb_fa: 'زمین باز: حرکت سریع، بدون پناه.',
  },
  desert: {
    label: 'Desert',
    label_fa: 'بیابان',
    color: COLORS.desert,
    moveCost: 1,
    defence: 0,
    water: false,
    blurb: 'Fast movement, no cover, exposed to air attack.',
    blurb_fa: 'حرکت سریع، بدون پناه، در معرض حمله هوایی.',
  },
  mountain: {
    label: 'Mountains',
    label_fa: 'کوهستان',
    color: COLORS.mountain,
    moveCost: 2,
    defence: 0.4,
    water: false,
    blurb: 'Slow going: +40% defence. Iran’s Zagros depth.',
    blurb_fa: 'حرکت کند: +۴۰٪ دفاع. عمق زاگرس در ایران.',
  },
  urban: {
    label: 'Urban',
    label_fa: 'شهری',
    color: COLORS.urban,
    moveCost: 2,
    defence: 0.3,
    water: false,
    blurb: 'Dense population: +30% defence, high collateral risk.',
    blurb_fa: 'جمعیت متراکم: +۳۰٪ دفاع، خطر بالای تلفات جانبی.',
  },
  hardened: {
    label: 'Hardened Site',
    label_fa: 'تأسیسات سخت‌شده',
    color: COLORS.hardened,
    moveCost: 2,
    defence: 0.55,
    water: false,
    blurb: 'Underground facility: only sustained or bunker-buster strikes work.',
    blurb_fa: 'تأسیسات زیرزمینی: فقط حملات پیوسته یا بمب سنگرشکن اثر می‌کند.',
  },
};

/** Ray-casting point-in-polygon; winding order does not matter. */
export function pointInRing(lon: number, lat: number, ring: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    const intersects = a[1] > lat !== b[1] > lat && lon < ((b[0] - a[0]) * (lat - a[1])) / (b[1] - a[1]) + a[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function inAnyRing(lon: number, lat: number, rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>): boolean {
  for (const ring of rings) if (pointInRing(lon, lat, ring)) return true;
  return false;
}

/** Shortest distance (degrees) from a point to a polyline. */
export function distanceToPolyline(
  lon: number,
  lat: number,
  pts: ReadonlyArray<readonly [number, number]>,
): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((lon - a[0]) * dx + (lat - a[1]) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + t * dx;
    const py = a[1] + t * dy;
    const d = Math.hypot(lon - px, lat - py);
    if (d < best) best = d;
  }
  return best;
}

export function isWater(lon: number, lat: number): boolean {
  if (inAnyRing(lon, lat, WATER_POLYGONS)) return true;
  return !inAnyRing(lon, lat, LAND_POLYGONS);
}

/** Land hexes within this distance of the sea are drawn as coastal water. */
function isCoastalWater(lon: number, lat: number): boolean {
  for (const ring of LAND_POLYGONS) {
    if (distanceToPolyline(lon, lat, ring) < 0.55) return true;
  }
  for (const ring of WATER_POLYGONS) {
    if (distanceToPolyline(lon, lat, ring) < 0.25) return false;
  }
  return false;
}

function inMountain(lon: number, lat: number): boolean {
  for (const range of MOUNTAINS) {
    if (distanceToPolyline(lon, lat, range.points) <= range.width) return true;
  }
  return false;
}

function inDesert(lon: number, lat: number): boolean {
  for (const region of DESERTS) if (pointInRing(lon, lat, region.ring)) return true;
  return false;
}

function inCity(lon: number, lat: number): boolean {
  for (const city of CITIES) {
    if (Math.hypot(lon - city.lon, lat - city.lat) <= city.radius) return true;
  }
  return false;
}

export interface SampleOptions {
  /** Force terrain (used for hardened nuclear sites). */
  override?: TerrainKind;
}

/** Terrain for a geographic point. */
export function sampleTerrain(lon: number, lat: number, options: SampleOptions = {}): TerrainKind {
  if (options.override) return options.override;
  if (isWater(lon, lat)) return isCoastalWater(lon, lat) ? 'coast' : 'deep';
  if (inMountain(lon, lat)) return 'mountain';
  if (inCity(lon, lat)) return 'urban';
  if (inDesert(lon, lat)) return 'desert';
  return 'plains';
}

/** Sovereign owner of a land hex by nearest country anchor. */
export function nearestCountry(lon: number, lat: number): string {
  let best = 'neutral';
  let bestD = Number.POSITIVE_INFINITY;
  for (const country of COUNTRIES) {
    for (const anchor of country.anchors) {
      const d = (lon - anchor[0]) ** 2 + (lat - anchor[1]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = country.id;
      }
    }
  }
  return best;
}

/** Terrain for a hex centre, including sea/land ownership. */
export interface HexGeography {
  terrain: TerrainKind;
  owner: string;
  lon: number;
  lat: number;
}

export function sampleGeography(lon: number, lat: number, override?: TerrainKind): HexGeography {
  const terrain = sampleTerrain(lon, lat, override ? { override } : {});
  return {
    terrain,
    owner: TERRAIN[terrain].water ? 'neutral' : nearestCountry(lon, lat),
    lon,
    lat,
  };
}

export type { LonLat };
