// How much room text takes on a Document page. expo-print renders with
// JavaScript off, so the page cannot measure itself: the app breaks lines and
// pages here, from each font's own character widths, and errs on the wide side
// so the page never holds more than was planned.
import type { FontName } from '../setup/store';
import { FONT_DATA, WIDTH_FIRST } from './fontData';

export type TextStyle = {
  font: FontName;
  /** Points. */
  size: number;
  upper?: boolean;
  /** Extra space after each character, in ems. */
  spacing?: number;
};

/** Widths are rounded up and taken a little wider still, so a plan is never too tight. */
const SAFETY = 1.04;
/** A character the font lacks is drawn by a fallback font; count it as a full em. */
const MISSING = 1000;

function charWidth(font: FontName, ch: string): number {
  const code = ch.codePointAt(0)!;
  const w = FONT_DATA[font]!.widths[code - WIDTH_FIRST];
  return w ? w : MISSING;
}

/** The width of the text on one line, in points. */
export function textWidth(text: string, style: TextStyle): number {
  const t = style.upper ? text.toUpperCase() : text;
  let ems = 0;
  for (const ch of t) ems += charWidth(style.font, ch) / 1000 + (style.spacing ?? 0);
  return ems * style.size * SAFETY;
}

/**
 * How many lines the text takes in a box `width` points wide, breaking at
 * spaces, and inside a word only when the word alone is too wide (the page
 * uses `overflow-wrap: anywhere`). Empty text takes no lines.
 */
export function lineCount(text: string, width: number, style: TextStyle): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const space = textWidth(' ', style);
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const w = textWidth(word, style);
    if (used > 0 && used + space + w <= width) {
      used += space + w;
      continue;
    }
    if (used > 0) lines++;
    used = 0;
    if (w <= width) {
      used = w;
      continue;
    }
    // A word wider than the box breaks between characters.
    for (const ch of word) {
      const cw = textWidth(ch, style);
      if (used + cw > width && used > 0) {
        lines++;
        used = 0;
      }
      used += cw;
    }
  }
  return lines;
}
