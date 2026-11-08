/**
 * Real-world geography for the Middle East theatre, expressed as coarse polygons.
 *
 * The theatre runs from Libya/Egypt in the west (26E) to Pakistan/India in the
 * east (78E), and from Yemen/Somalia (8N) to the Black Sea (44N). Shapes are
 * deliberately coarse: the renderer is a hex map, not an atlas.
 *
 * Painting order is WATER-FIRST: a hex is water when it is inside a water
 * polygon OR outside every land polygon. Land polygons therefore only need to
 * be approximately right; narrow seas are carved explicitly so the Strait of
 * Hormuz and the Red Sea are always navigable.
 */

export interface LonLat {
  lon: number;
  lat: number;
}

export const BOUNDS = { lonMin: 26, lonMax: 78, latMin: 8, latMax: 44 } as const;

/** Grid resolution: 79 columns across 52 degrees of longitude. */
export const COLS = 79;
const LON_STEP = (BOUNDS.lonMax - BOUNDS.lonMin) / COLS;
/** 0.866 keeps hexes visually regular at ~26N (equirectangular correction). */
const LAT_STEP = 0.866 * LON_STEP * Math.cos((26 * Math.PI) / 180);
export const ROWS = Math.round((BOUNDS.latMax - BOUNDS.latMin) / LAT_STEP);
export const CELL = { lonStep: LON_STEP, latStep: LAT_STEP } as const;

/** Geographic centre of a grid cell (odd rows are shifted half a hex east). */
export function cellCentre(col: number, row: number): LonLat {
  return {
    lon: BOUNDS.lonMin + (col + 0.5 + (row & 1 ? 0.5 : 0)) * LON_STEP,
    lat: BOUNDS.latMax - (row + 0.5) * LAT_STEP,
  };
}

type Ring = ReadonlyArray<readonly [number, number]>;

/** Africa north-east: Libya, Egypt, Sudan, Eritrea, Ethiopia, Djibouti, Somalia. */
const AFRICA: Ring = [
  [26.0, 31.0], [28.5, 30.8], [30.2, 31.2], [32.0, 31.3], [32.5, 31.15],
  [32.6, 29.9], [33.4, 27.6], [34.4, 25.7], [35.3, 23.9], [36.3, 22.1],
  [37.4, 20.3], [38.5, 18.5], [39.6, 16.7], [40.9, 15.1], [42.1, 13.6],
  [43.2, 12.6], [43.4, 11.6], [44.5, 11.4], [47.0, 11.2], [49.0, 11.4],
  [51.0, 11.8], [51.2, 10.2], [50.2, 8.0], [26.0, 8.0],
];

/** Eurasia including Arabia, the Levant, Anatolia, Iran, Afghanistan and South Asia. */
const EURASIA: Ring = [
  // Levant coast
  [32.4, 31.2], [34.2, 31.3], [35.0, 33.0], [35.6, 34.5], [36.0, 36.0], [36.3, 36.7],
  // Anatolia south coast, west to the Aegean
  [34.5, 36.2], [32.5, 36.2], [30.5, 36.7], [28.0, 36.7], [26.4, 37.6], [26.3, 38.6],
  [26.7, 40.0],
  // Marmara, Black Sea south shore, Caucasus
  [28.9, 41.0], [31.0, 41.6], [35.0, 42.0], [39.0, 41.3], [41.6, 41.5], [44.0, 42.4],
  [47.0, 43.6], [48.0, 44.0],
  // northern and eastern map edges
  [78.0, 44.0], [78.0, 30.0],
  // India west coast, Pakistan, Makran
  [77.0, 24.5], [75.0, 22.0], [73.0, 20.0], [72.5, 21.5], [72.3, 23.5], [70.0, 24.5],
  [68.2, 23.8], [67.5, 24.5], [66.0, 25.2], [64.0, 25.2], [62.0, 25.1], [60.0, 25.2],
  [57.5, 25.6], [56.4, 27.2],
  // Iranian Gulf coast (carved precisely by PERSIAN_GULF)
  [54.0, 27.3], [51.5, 28.5], [49.5, 30.0], [48.3, 30.1],
  // Arabian Gulf coast
  [47.9, 29.4], [48.6, 28.4], [50.0, 26.8], [51.0, 26.0], [52.5, 25.2], [54.5, 24.6],
  [55.6, 25.5], [56.2, 26.2],
  // Oman, Yemen, Red Sea east coast, Aqaba
  [56.5, 25.0], [58.5, 23.6], [59.8, 22.6], [59.0, 20.5], [57.5, 19.0], [55.0, 17.5],
  [53.0, 16.5], [52.0, 15.5], [49.5, 14.5], [47.5, 13.5], [45.0, 12.9], [43.5, 12.9],
  [43.4, 13.6], [42.7, 15.5], [42.0, 17.5], [41.0, 19.5], [39.5, 21.5], [38.5, 23.5],
  [37.5, 25.5], [36.2, 27.8], [35.2, 29.5], [34.6, 30.2], [33.0, 30.6],
];

const MEDITERRANEAN: Ring = [
  [26.0, 30.6], [28.0, 31.2], [30.0, 31.4], [32.4, 31.2], [33.2, 31.3], [34.3, 31.4],
  [35.0, 32.5], [35.3, 33.5], [35.6, 34.5], [36.0, 36.0], [36.3, 36.7], [35.0, 36.5],
  [33.0, 36.3], [31.0, 36.5], [29.0, 36.6], [27.5, 37.0], [26.3, 37.3], [26.0, 37.3],
];

const BLACK_SEA: Ring = [
  [27.8, 41.1], [28.0, 42.5], [29.5, 43.6], [33.0, 43.8], [37.0, 43.5], [40.5, 43.0],
  [41.6, 42.0], [41.6, 41.5], [39.0, 41.3], [36.0, 41.9], [33.0, 41.8], [30.5, 41.4],
  [28.9, 41.0],
];

const CASPIAN: Ring = [
  [47.0, 44.0], [46.6, 42.0], [47.5, 40.5], [48.6, 39.2], [49.5, 38.0], [50.2, 37.2],
  [51.5, 36.7], [52.8, 36.8], [53.9, 37.6], [54.1, 39.5], [53.6, 41.0], [52.5, 42.5],
  [51.0, 44.0],
];

/** Red Sea: a narrow band from Suez to Bab al-Mandeb, always navigable. */
const RED_SEA: Ring = [
  [32.3, 30.2], [32.6, 29.0], [33.4, 27.5], [34.3, 25.8], [35.3, 24.0], [36.3, 22.2],
  [37.4, 20.4], [38.4, 18.6], [39.6, 16.8], [40.9, 15.2], [42.2, 13.7], [43.2, 12.7],
  [43.6, 12.7], [43.5, 13.8], [42.8, 15.6], [42.0, 17.4], [41.0, 19.4], [39.9, 21.2],
  [38.8, 23.2], [37.6, 25.0], [36.4, 27.0], [35.3, 28.8], [34.7, 29.9], [34.3, 30.2],
];

/** Persian Gulf + Strait of Hormuz. Width tapers from ~1.6 deg to ~0.7 deg. */
const PERSIAN_GULF: Ring = [
  [48.3, 30.1], [49.8, 29.6], [51.0, 29.0], [52.5, 28.0], [54.0, 27.3], [55.3, 26.9],
  [56.3, 26.8], [56.6, 26.4], [56.5, 26.1], [55.6, 25.8], [54.4, 25.4], [53.0, 25.8],
  [51.6, 26.3], [50.4, 26.9], [49.4, 27.8], [48.6, 28.7], [48.0, 29.5], [47.9, 30.0],
];

/** Gulf of Oman, Arabian Sea and Gulf of Aden (Somalia to India). */
const ARABIAN_SEA: Ring = [
  [56.6, 26.4], [57.4, 25.4], [58.6, 24.6], [60.0, 24.4], [62.0, 24.6], [64.0, 24.4],
  [66.0, 24.2], [67.5, 23.9], [70.0, 23.0], [72.5, 21.5], [73.5, 19.0], [73.0, 16.0],
  [71.0, 12.0], [68.0, 8.0], [52.0, 8.0], [51.2, 10.2], [51.0, 11.8], [49.0, 11.4],
  [47.0, 11.2], [44.5, 11.4], [43.4, 11.6], [43.2, 12.7], [43.8, 12.9], [45.2, 12.9],
  [47.8, 13.4], [49.8, 14.4], [52.2, 15.5], [53.5, 16.5], [55.0, 17.4], [57.0, 18.5],
  [58.5, 19.5], [59.5, 21.0], [59.8, 22.7], [58.5, 23.7], [57.0, 25.0], [56.5, 26.2],
];

export const LAND_POLYGONS: ReadonlyArray<Ring> = [AFRICA, EURASIA];
export const WATER_POLYGONS: ReadonlyArray<Ring> = [
  MEDITERRANEAN,
  BLACK_SEA,
  CASPIAN,
  RED_SEA,
  PERSIAN_GULF,
  ARABIAN_SEA,
];

export interface MountainRange {
  name: string;
  width: number; // degrees, half-width
  points: ReadonlyArray<readonly [number, number]>;
}

/** Mountain belts: defensive depth in the game, and shape on the map. */
export const MOUNTAINS: ReadonlyArray<MountainRange> = [
  {
    name: 'Zagros',
    width: 1.35,
    points: [[44.6, 37.6], [46.4, 35.6], [48.0, 33.6], [50.0, 31.6], [52.0, 30.0], [54.0, 28.6], [56.0, 27.6]],
  },
  { name: 'Elburz', width: 0.95, points: [[48.0, 36.4], [50.5, 36.2], [53.0, 36.4], [55.5, 37.0]] },
  { name: 'Kopet Dag', width: 0.8, points: [[56.0, 38.0], [58.0, 37.2], [60.0, 36.6]] },
  { name: 'Taurus', width: 1.15, points: [[29.0, 36.8], [32.0, 37.3], [35.0, 37.6], [38.0, 38.0], [41.0, 38.3]] },
  { name: 'Eastern Anatolia', width: 1.0, points: [[39.0, 39.5], [42.0, 39.5], [44.0, 38.8]] },
  { name: 'Caucasus', width: 0.85, points: [[40.0, 42.6], [44.0, 42.8], [47.0, 42.0]] },
  { name: 'Hijaz & Asir', width: 1.15, points: [[37.5, 26.5], [39.5, 23.0], [41.0, 20.0], [42.5, 17.0], [43.6, 14.6]] },
  { name: 'Yemen Highlands', width: 0.9, points: [[43.6, 15.6], [44.6, 14.0], [45.2, 13.2]] },
  { name: 'Hindu Kush', width: 1.15, points: [[64.0, 35.0], [66.5, 35.5], [68.5, 36.0], [70.5, 36.5]] },
  { name: 'Sulaiman Range', width: 0.9, points: [[68.0, 32.5], [69.5, 30.5], [69.5, 28.5]] },
  { name: 'Makran Ranges', width: 0.75, points: [[57.0, 26.6], [60.0, 26.3], [63.0, 25.8]] },
  { name: 'Ethiopian Highlands', width: 1.35, points: [[36.5, 13.5], [38.5, 11.5], [39.5, 9.5], [39.0, 8.2]] },
  { name: 'Sinai', width: 0.55, points: [[33.6, 29.2], [34.1, 28.2]] },
  { name: 'Levant Range', width: 0.45, points: [[35.8, 34.4], [36.2, 33.4]] },
  { name: 'Kurdistan Fold', width: 0.8, points: [[42.5, 37.4], [44.5, 37.2]] },
];

export interface DesertRegion {
  name: string;
  ring: Ring;
}

export const DESERTS: ReadonlyArray<DesertRegion> = [
  {
    name: "Rub' al Khali",
    ring: [[46.0, 22.0], [48.0, 19.0], [52.0, 18.0], [55.0, 20.0], [56.0, 22.0], [54.0, 24.0], [50.0, 24.0], [47.5, 23.5]],
  },
  { name: 'An Nafud', ring: [[39.5, 29.0], [42.0, 28.0], [44.0, 26.0], [43.0, 24.5], [40.5, 25.5], [39.0, 27.0]] },
  { name: 'Syrian Desert', ring: [[36.5, 33.5], [40.0, 34.5], [42.0, 32.0], [40.0, 30.0], [37.0, 30.5]] },
  { name: 'Western Sahara', ring: [[26.0, 31.0], [28.5, 30.6], [29.5, 27.0], [29.0, 22.0], [26.0, 22.0]] },
  { name: 'Egyptian Desert', ring: [[29.5, 30.6], [31.5, 29.5], [32.0, 25.0], [31.0, 22.0], [29.0, 22.0]] },
  { name: 'Nubian Desert', ring: [[31.0, 22.0], [35.0, 22.0], [35.0, 18.0], [31.0, 18.0]] },
  { name: 'Sinai Desert', ring: [[32.6, 31.0], [34.6, 30.2], [34.6, 28.0], [32.6, 28.4]] },
  { name: 'Dasht-e Kavir', ring: [[52.0, 36.0], [55.5, 36.0], [56.0, 34.0], [53.0, 34.0]] },
  { name: 'Dasht-e Lut', ring: [[56.5, 33.5], [59.5, 33.0], [59.0, 30.5], [56.5, 31.0]] },
  { name: 'Sistan Basin', ring: [[61.0, 31.5], [63.5, 29.5], [63.0, 27.0], [61.0, 28.0]] },
  { name: 'Thar & Cholistan', ring: [[69.0, 29.5], [73.5, 28.5], [73.0, 25.0], [70.0, 25.6]] },
  { name: 'Karakum', ring: [[57.0, 41.0], [62.0, 41.5], [63.0, 38.5], [58.0, 38.0]] },
];

export interface CityDef {
  name: string;
  lon: number;
  lat: number;
  radius: number;
}

/** Urban terrain patches (baked into the map, not interaction nodes). */
export const CITIES: ReadonlyArray<CityDef> = [
  { name: 'Tehran', lon: 51.4, lat: 35.7, radius: 0.5 },
  { name: 'Isfahan', lon: 51.7, lat: 32.6, radius: 0.4 },
  { name: 'Mashhad', lon: 59.6, lat: 36.3, radius: 0.35 },
  { name: 'Tabriz', lon: 46.3, lat: 38.1, radius: 0.3 },
  { name: 'Shiraz', lon: 52.5, lat: 29.6, radius: 0.3 },
  { name: 'Ahvaz', lon: 48.7, lat: 31.3, radius: 0.3 },
  { name: 'Qom', lon: 50.9, lat: 34.6, radius: 0.25 },
  { name: 'Baghdad', lon: 44.4, lat: 33.3, radius: 0.5 },
  { name: 'Basra', lon: 47.8, lat: 30.5, radius: 0.35 },
  { name: 'Mosul', lon: 43.1, lat: 36.3, radius: 0.3 },
  { name: 'Erbil', lon: 44.0, lat: 36.2, radius: 0.25 },
  { name: 'Damascus', lon: 36.3, lat: 33.5, radius: 0.45 },
  { name: 'Aleppo', lon: 37.2, lat: 36.2, radius: 0.3 },
  { name: 'Beirut', lon: 35.5, lat: 33.9, radius: 0.28 },
  { name: 'Amman', lon: 35.9, lat: 31.95, radius: 0.35 },
  { name: 'Jerusalem', lon: 35.2, lat: 31.8, radius: 0.3 },
  { name: 'Tel Aviv', lon: 34.8, lat: 32.1, radius: 0.35 },
  { name: 'Haifa', lon: 35.0, lat: 32.8, radius: 0.3 },
  { name: 'Riyadh', lon: 46.7, lat: 24.7, radius: 0.5 },
  { name: 'Jeddah', lon: 39.2, lat: 21.5, radius: 0.4 },
  { name: 'Dammam', lon: 50.1, lat: 26.4, radius: 0.35 },
  { name: 'Mecca', lon: 39.8, lat: 21.4, radius: 0.3 },
  { name: 'Medina', lon: 39.6, lat: 24.5, radius: 0.3 },
  { name: 'Doha', lon: 51.5, lat: 25.3, radius: 0.3 },
  { name: 'Dubai', lon: 55.3, lat: 25.2, radius: 0.35 },
  { name: 'Abu Dhabi', lon: 54.4, lat: 24.5, radius: 0.35 },
  { name: 'Kuwait City', lon: 48.0, lat: 29.4, radius: 0.3 },
  { name: 'Manama', lon: 50.6, lat: 26.1, radius: 0.25 },
  { name: 'Muscat', lon: 58.4, lat: 23.6, radius: 0.3 },
  { name: 'Salalah', lon: 54.1, lat: 17.0, radius: 0.25 },
  { name: "Sana'a", lon: 44.2, lat: 15.4, radius: 0.35 },
  { name: 'Aden', lon: 45.0, lat: 12.8, radius: 0.3 },
  { name: 'Taiz', lon: 44.0, lat: 13.6, radius: 0.25 },
  { name: 'Cairo', lon: 31.2, lat: 30.0, radius: 0.6 },
  { name: 'Suez', lon: 32.5, lat: 30.0, radius: 0.3 },
  { name: 'Alexandria', lon: 29.9, lat: 31.2, radius: 0.35 },
  { name: 'Aswan', lon: 32.9, lat: 24.1, radius: 0.25 },
  { name: 'Khartoum', lon: 32.5, lat: 15.6, radius: 0.4 },
  { name: 'Port Sudan', lon: 37.2, lat: 19.6, radius: 0.25 },
  { name: 'Asmara', lon: 38.9, lat: 15.3, radius: 0.3 },
  { name: 'Addis Ababa', lon: 38.7, lat: 9.0, radius: 0.4 },
  { name: 'Djibouti', lon: 43.1, lat: 11.6, radius: 0.25 },
  { name: 'Karachi', lon: 67.0, lat: 24.9, radius: 0.5 },
  { name: 'Lahore', lon: 74.3, lat: 31.6, radius: 0.45 },
  { name: 'Islamabad', lon: 73.1, lat: 33.7, radius: 0.35 },
  { name: 'Quetta', lon: 67.0, lat: 30.2, radius: 0.3 },
  { name: 'Peshawar', lon: 71.5, lat: 34.0, radius: 0.3 },
  { name: 'Kabul', lon: 69.2, lat: 34.5, radius: 0.4 },
  { name: 'Kandahar', lon: 65.7, lat: 31.6, radius: 0.3 },
  { name: 'Herat', lon: 62.2, lat: 34.3, radius: 0.3 },
  { name: 'Delhi', lon: 77.2, lat: 28.6, radius: 0.55 },
  { name: 'Mumbai', lon: 72.9, lat: 19.1, radius: 0.5 },
  { name: 'Ahmedabad', lon: 72.6, lat: 23.0, radius: 0.35 },
  { name: 'Ankara', lon: 32.9, lat: 39.9, radius: 0.45 },
  { name: 'Istanbul', lon: 28.9, lat: 41.0, radius: 0.5 },
  { name: 'Izmir', lon: 27.1, lat: 38.4, radius: 0.35 },
  { name: 'Adana', lon: 35.3, lat: 37.0, radius: 0.3 },
  { name: 'Diyarbakir', lon: 40.2, lat: 37.9, radius: 0.3 },
  { name: 'Baku', lon: 49.9, lat: 40.4, radius: 0.3 },
  { name: 'Yerevan', lon: 44.5, lat: 40.2, radius: 0.25 },
  { name: 'Tbilisi', lon: 44.8, lat: 41.7, radius: 0.3 },
  { name: 'Ashgabat', lon: 58.4, lat: 37.9, radius: 0.3 },
  { name: 'Dushanbe', lon: 68.8, lat: 38.6, radius: 0.25 },
  { name: 'Tashkent', lon: 69.2, lat: 41.3, radius: 0.4 },
];

export interface CountryDef {
  id: string;
  name: string;
  /** Control points: land hexes are assigned to the nearest one. */
  anchors: ReadonlyArray<readonly [number, number]>;
}

/** Coarse political map: nearest-anchor assignment produces plausible borders. */
export const COUNTRIES: ReadonlyArray<CountryDef> = [
  { id: 'saudi', name: 'Saudi Arabia', anchors: [[44.0, 24.0], [49.0, 28.0], [43.0, 17.0]] },
  { id: 'iran', name: 'Iran', anchors: [[53.0, 32.0], [58.0, 35.0], [57.0, 28.0], [48.0, 34.0]] },
  { id: 'egypt', name: 'Egypt', anchors: [[30.0, 26.0], [32.0, 30.0]] },
  { id: 'turkey', name: 'Turkey', anchors: [[34.0, 39.0], [40.0, 39.5], [31.0, 38.0]] },
  { id: 'iraq', name: 'Iraq', anchors: [[43.5, 33.0]] },
  { id: 'syria', name: 'Syria', anchors: [[38.0, 35.0]] },
  { id: 'yemen', name: 'Yemen', anchors: [[45.5, 15.5]] },
  { id: 'oman', name: 'Oman', anchors: [[56.5, 21.0]] },
  { id: 'uae', name: 'UAE', anchors: [[54.0, 23.8]] },
  { id: 'qatar', name: 'Qatar', anchors: [[51.2, 25.3]] },
  { id: 'kuwait', name: 'Kuwait', anchors: [[47.6, 29.3]] },
  { id: 'bahrain', name: 'Bahrain', anchors: [[50.55, 26.05]] },
  { id: 'jordan', name: 'Jordan', anchors: [[36.0, 31.0]] },
  { id: 'israel', name: 'Israel', anchors: [[35.0, 31.5]] },
  { id: 'lebanon', name: 'Lebanon', anchors: [[35.8, 33.9]] },
  { id: 'pakistan', name: 'Pakistan', anchors: [[69.0, 29.0], [66.0, 25.5]] },
  { id: 'afghanistan', name: 'Afghanistan', anchors: [[66.0, 34.0], [70.0, 36.0]] },
  { id: 'india', name: 'India', anchors: [[73.0, 24.0]] },
  { id: 'turkmenistan', name: 'Turkmenistan', anchors: [[59.0, 39.0]] },
  { id: 'uzbekistan', name: 'Uzbekistan', anchors: [[63.0, 42.0]] },
  { id: 'tajikistan', name: 'Tajikistan', anchors: [[71.0, 38.5]] },
  { id: 'azerbaijan', name: 'Azerbaijan', anchors: [[47.5, 40.5]] },
  { id: 'armenia', name: 'Armenia', anchors: [[44.8, 40.2]] },
  { id: 'georgia', name: 'Georgia', anchors: [[43.0, 42.0]] },
  { id: 'russia', name: 'Russia', anchors: [[46.0, 43.5]] },
  { id: 'kazakhstan', name: 'Kazakhstan', anchors: [[58.0, 43.6]] },
  { id: 'libya', name: 'Libya', anchors: [[26.5, 27.0]] },
  { id: 'sudan', name: 'Sudan', anchors: [[30.0, 15.0]] },
  { id: 'eritrea', name: 'Eritrea', anchors: [[38.5, 15.0]] },
  { id: 'ethiopia', name: 'Ethiopia', anchors: [[39.0, 9.0]] },
  { id: 'djibouti', name: 'Djibouti', anchors: [[42.6, 11.7]] },
  { id: 'somalia', name: 'Somalia', anchors: [[46.0, 7.5]] },
];

export const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, c.name]),
);
