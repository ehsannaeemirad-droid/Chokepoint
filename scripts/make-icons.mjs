/**
 * Dependency-free PWA icon generator: draws a hex chokepoint mark and writes
 * 192px / 512px PNGs into public/.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const BG = [14, 18, 22];
const AMBER = [255, 160, 0];
const BLUE = [30, 77, 140];
const LIGHT = [232, 238, 244];

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = pixel(x, y);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255,
  ];
}

function hexPoints(cx, cy, radius) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i + 30) * Math.PI) / 180;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return points;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function makeIcon(size) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.33;
  const points = hexPoints(cx, cy, radius);
  const ringWidth = size * 0.035;
  const barWidth = size * 0.055;

  return png(size, size, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;

    // Background with a faint vignette.
    const d = Math.hypot(px - cx, py - cy) / (size * 0.75);
    let color = mix(BG, [6, 8, 10], Math.min(1, d));

    let edge = Infinity;
    for (let i = 0; i < 6; i++) {
      const a = points[i];
      const b = points[(i + 1) % 6];
      edge = Math.min(edge, distanceToSegment(px, py, a[0], a[1], b[0], b[1]));
    }

    const insideHex = edge > 0 && distanceToSegment(px, py, cx, cy, cx, cy) === 0;
    // Point-in-polygon (ray cast) for the hex fill.
    let inside = false;
    for (let i = 0, j = 5; i < 6; j = i++) {
      const a = points[i];
      const b = points[j];
      if (a[1] > py !== b[1] > py && px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1]) + a[0]) {
        inside = !inside;
      }
    }
    void insideHex;

    if (inside) color = mix(color, BLUE, 0.85);
    if (Math.abs(px - cx) < barWidth && Math.abs(py - cy) < radius * 0.72) {
      color = mix(color, AMBER, 0.95);
    }
    if (Math.abs(px - cx) < barWidth * 0.48 && Math.abs(py - cy) < radius * 0.5) {
      color = mix(color, LIGHT, 0.55);
    }
    if (edge < ringWidth) color = mix(color, AMBER, 0.95);
    return color;
  });
}

const outDir = resolve(process.cwd(), 'public');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const file = resolve(outDir, `icon-${size}.png`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, makeIcon(size));
  console.log(`wrote ${file}`);
}
