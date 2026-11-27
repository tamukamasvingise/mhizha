// Writes src/pdf/fontData.ts: the four Document fonts (SIL Open Font License,
// from the @fontsource packages, Latin subset, weights 400, 600 and 700) as
// base64, and how wide each character is, so the app can break lines and
// pages itself (expo-print runs with JavaScript off).
//
//   node scripts/pdf-fonts.mjs          writes the file
//   node scripts/pdf-fonts.mjs --check  exits 1 if the file is out of date
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const FONTS = {
  Inter: 'inter',
  'IBM Plex Sans': 'ibm-plex-sans',
  Manrope: 'manrope',
  'Source Serif 4': 'source-serif-4',
};
const WEIGHTS = [400, 600, 700];
/** Characters measured: printable ASCII and Latin-1 (32 to 255). */
const FIRST = 32;
const LAST = 255;

function pkgFile(slug, name) {
  const dir = dirname(require.resolve(`@fontsource/${slug}/package.json`));
  return join(dir, name);
}

/** The tables of a WOFF (version 1) file, decompressed. */
function woffTables(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOFF') throw new Error('not a WOFF file');
  const n = buf.readUInt16BE(12);
  const tables = {};
  for (let i = 0; i < n; i++) {
    const at = 44 + i * 20;
    const tag = buf.toString('latin1', at, at + 4);
    const offset = buf.readUInt32BE(at + 4);
    const compLength = buf.readUInt32BE(at + 8);
    const origLength = buf.readUInt32BE(at + 12);
    const raw = buf.subarray(offset, offset + compLength);
    tables[tag] = compLength < origLength ? inflateSync(raw) : raw;
  }
  return tables;
}

/** Character code to glyph, from a format 4 cmap subtable. */
function cmap4(cmap) {
  const count = cmap.readUInt16BE(2);
  let sub = null;
  for (let i = 0; i < count; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8);
    const encoding = cmap.readUInt16BE(6 + i * 8);
    const offset = cmap.readUInt32BE(8 + i * 8);
    if (cmap.readUInt16BE(offset) === 4 && (platform === 3 || platform === 0) && (encoding === 1 || platform === 0)) sub = offset;
  }
  if (sub === null) throw new Error('no format 4 cmap');
  const segX2 = cmap.readUInt16BE(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  return (code) => {
    for (let s = 0; s < segX2; s += 2) {
      const end = cmap.readUInt16BE(ends + s);
      if (code > end) continue;
      const start = cmap.readUInt16BE(starts + s);
      if (code < start) return 0;
      const delta = cmap.readInt16BE(deltas + s);
      const range = cmap.readUInt16BE(ranges + s);
      if (range === 0) return (code + delta) & 0xffff;
      const g = cmap.readUInt16BE(ranges + s + range + (code - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };
}

/** Advance widths in thousandths of an em for FIRST..LAST; 0 when the font lacks the character. */
function widths(buf) {
  const t = woffTables(buf);
  const unitsPerEm = t.head.readUInt16BE(18);
  const metrics = t.hhea.readUInt16BE(34);
  const glyphOf = cmap4(t.cmap);
  const out = [];
  for (let code = FIRST; code <= LAST; code++) {
    const g = glyphOf(code);
    if (g === 0) {
      out.push(0);
      continue;
    }
    const advance = t.hmtx.readUInt16BE(4 * Math.min(g, metrics - 1));
    out.push(Math.ceil((advance * 1000) / unitsPerEm));
  }
  return out;
}

function build() {
  const lines = [
    '// Made by scripts/pdf-fonts.mjs from the @fontsource packages. Do not edit.',
    '// Fonts: SIL Open Font License 1.1 (Inter, IBM Plex Sans, Manrope, Source Serif 4).',
    '',
    `export const WIDTH_FIRST = ${FIRST};`,
    '',
    '/** Per font: each weight as base64 WOFF2, and the widest advance of the three weights per character (thousandths of an em; 0 = missing). */',
    'export const FONT_DATA: Record<string, { files: Record<400 | 600 | 700, string>; widths: readonly number[] }> = {',
  ];
  for (const [name, slug] of Object.entries(FONTS)) {
    const files = {};
    let widest = null;
    for (const w of WEIGHTS) {
      files[w] = readFileSync(pkgFile(slug, `files/${slug}-latin-${w}-normal.woff2`)).toString('base64');
      const ws = widths(readFileSync(pkgFile(slug, `files/${slug}-latin-${w}-normal.woff`)));
      widest = widest ? widest.map((x, i) => Math.max(x, ws[i])) : ws;
    }
    lines.push(`  '${name}': {`);
    lines.push('    files: {');
    for (const w of WEIGHTS) lines.push(`      ${w}: '${files[w]}',`);
    lines.push('    },');
    lines.push(`    widths: [${widest.join(', ')}],`);
    lines.push('  },');
  }
  lines.push('};', '');
  return lines.join('\n');
}

const target = join(root, 'src/pdf/fontData.ts');
const text = build();
if (process.argv.includes('--check')) {
  let now = '';
  try {
    now = readFileSync(target, 'utf8');
  } catch {}
  if (now !== text) {
    console.error('src/pdf/fontData.ts is out of date: run node scripts/pdf-fonts.mjs');
    process.exit(1);
  }
} else writeFileSync(target, text);
