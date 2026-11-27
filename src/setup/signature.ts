// The signature the User draws once, kept as a small SVG file for Documents.

export type Point = { x: number; y: number };
export type Stroke = Point[];

const n = (v: number) => String(Math.round(v * 10) / 10);

/** SVG path data for the strokes. A stroke of one point is a dot. */
export function signaturePath(strokes: readonly Stroke[]): string {
  return strokes
    .filter((s) => s.length > 0)
    .map((s) => {
      const pts = s.length === 1 ? [s[0]!, { x: s[0]!.x + 0.1, y: s[0]!.y }] : s;
      return pts.map((p, i) => `${i ? 'L' : 'M'}${n(p.x)} ${n(p.y)}`).join('');
    })
    .join('');
}

/** The SVG file for the signature, or null when nothing is drawn. */
export function signatureSvg(strokes: readonly Stroke[], width: number, height: number): string | null {
  const d = signaturePath(strokes);
  if (!d) return null;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}">` +
    `<path d="${d}" fill="none" stroke="#000000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  );
}
