#!/usr/bin/env node
/**
 * The mascot as characters — a generated brand asset (2026-09-08, the download gateway).
 *
 * Reads the committed pixel masters (`assets/brand/mascot/`, `docs/BRAND.md`) and writes one
 * TypeScript module of character rows, so the gateway can type the character in without
 * shipping a raster. Nothing is redrawn: each cell is two vertically adjacent master pixels,
 * classified by the mascot's own four-colour palette. The chartreuse signal pixels become `*`;
 * they never become a colour on the page (the palette boundary in `docs/BRAND.md`).
 *
 * Decoding is done here rather than through a dependency: the masters are 8-bit RGBA,
 * non-interlaced PNGs, which is one inflate and one unfilter pass.
 *
 *   node scripts/build-mascot-ascii.mjs          # writes the module
 *   node scripts/build-mascot-ascii.mjs --check  # exits 1 when the module is stale
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

import { MASCOT_PALETTE } from './build-brand-assets.mjs';

/** The compact tier only: the gateway types it beside the decision, where 14 rows fit. */
const MASTERS = [{ key: 'compact', path: 'assets/brand/mascot/mascot-compact-32.png' }];
const OUT = 'src/views/download/lib/mascot-ascii.generated.ts';

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG is not supported');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error(`unsupported PNG (depth ${bitDepth}, colour type ${colorType})`);
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i += 1) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += Math.floor((a + b) / 2);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = v & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const s = x * bpp;
      const d = (y * width + x) * 4;
      out[d] = line[s];
      out[d + 1] = line[s + 1];
      out[d + 2] = line[s + 2];
      out[d + 3] = bpp === 4 ? line[s + 3] : 255;
    }
    prev = line;
  }
  return { width, height, data: out };
}

/** The mascot's palette roles, by nearest colour (`docs/BRAND.md`, "Palette Boundary"). */
function classify(r, g, b, a) {
  if (a < 96) return 'empty';
  const near = (hex) => {
    const rr = parseInt(hex.slice(1, 3), 16);
    const gg = parseInt(hex.slice(3, 5), 16);
    const bb = parseInt(hex.slice(5, 7), 16);
    return (r - rr) ** 2 + (g - gg) ** 2 + (b - bb) ** 2;
  };
  // The palette is the brand source's own constant — restating a value here would be a second
  // place the identity colours live (`tests/contract/mascot-palette-boundary`).
  const roles = [
    ['outline', MASCOT_PALETTE.outline],
    ['face', MASCOT_PALETTE.face],
    ['signal', MASCOT_PALETTE.signal],
    ['highlight', MASCOT_PALETTE.suitHighlight],
  ];
  let best = roles[0][0];
  let bestD = Infinity;
  for (const [role, hex] of roles) {
    const d = near(hex);
    if (d < bestD) {
      bestD = d;
      best = role;
    }
  }
  return best;
}

/** Two pixels tall, one wide: the character a cell earns. */
function cell(top, bottom) {
  if (top === 'signal' || bottom === 'signal') return '*';
  const solid = (v) => v === 'outline' || v === 'highlight';
  if (solid(top) && solid(bottom)) return '#';
  if (top === 'face' && bottom === 'face') return '.';
  if (solid(top) && bottom === 'face') return '"';
  if (top === 'face' && solid(bottom)) return ',';
  if (solid(top) && bottom === 'empty') return "'";
  if (top === 'empty' && solid(bottom)) return '.';
  if (top === 'face' || bottom === 'face') return '.';
  return ' ';
}

export function mascotRows(png) {
  const { width, height, data } = decodePng(png);
  const rows = [];
  for (let y = 0; y < height; y += 2) {
    let row = '';
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const j = ((y + 1) * width + x) * 4;
      const top = classify(data[i], data[i + 1], data[i + 2], data[i + 3]);
      const bottom = y + 1 < height ? classify(data[j], data[j + 1], data[j + 2], data[j + 3]) : 'empty';
      row += cell(top, bottom);
    }
    rows.push(row.replace(/\s+$/, ''));
  }
  // Trim empty rows at both ends and the common left margin, so the figure sits tight.
  while (rows.length && rows[0] === '') rows.shift();
  while (rows.length && rows[rows.length - 1] === '') rows.pop();
  const margin = Math.min(...rows.filter((r) => r.length > 0).map((r) => r.length - r.trimStart().length));
  return rows.map((r) => r.slice(margin));
}

function render() {
  const parts = MASTERS.map(({ key, path }) => {
    const rows = mascotRows(readFileSync(path));
    return `/** ${path} — ${rows.length} rows. */\nexport const MASCOT_ASCII_${key.toUpperCase()}: readonly string[] = ${JSON.stringify(rows, null, 2)};\n`;
  });
  return `// Generated by scripts/build-mascot-ascii.mjs from the committed mascot masters. Do not edit.\n// Source contract: docs/BRAND.md. Regenerate: node scripts/build-mascot-ascii.mjs\n\n${parts.join('\n')}`;
}

const output = render();
if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUT, 'utf8');
  } catch {
    /* missing counts as stale */
  }
  if (current !== output) {
    console.error(`[mascot-ascii] ${OUT} is stale; run node scripts/build-mascot-ascii.mjs`);
    process.exit(1);
  }
  console.log(`[mascot-ascii] ${OUT} current ✓`);
} else {
  writeFileSync(OUT, output);
  console.log(`[mascot-ascii] wrote ${OUT}`);
}
