// Design tokens. DESIGN-SYSTEM.md explains them; this file is the only place
// raw colours and sizes live. Copied from the Main screens prototype.

export type ThemeName = 'light' | 'dark';

export type Colours = {
  page: string;
  surface: string;
  fg: string;
  label: string;
  line: string;
  input: string;
  tint: string;
  primary: string;
  primaryFg: string;
  brand: string;
  sel: string;
  selFg: string;
  bad: string;
  ring: string;
  scrim: string;
  toast: string;
  toastFg: string;
};

export const themes: Record<ThemeName, Colours> = {
  light: {
    page: '#F6F7F7',
    surface: '#FFFFFF',
    fg: '#18181B',
    label: '#52525B',
    line: '#E4E4E7',
    input: '#71717A',
    tint: '#F4F4F5',
    primary: '#C2410C',
    primaryFg: '#FFFFFF',
    brand: '#C2410C',
    sel: '#FFEDD5',
    selFg: '#9A3412',
    bad: '#B91C1C',
    ring: '#C2410C',
    scrim: 'rgba(0,0,0,0.5)',
    toast: '#18181B',
    toastFg: '#F4F4F5',
  },
  dark: {
    page: '#0A0A0A',
    surface: '#141416',
    fg: '#F4F4F5',
    label: '#A1A1AA',
    line: '#27272A',
    input: '#71717A',
    tint: '#1C1C1F',
    primary: '#FB923C',
    primaryFg: '#0A0A0A',
    brand: '#FB923C',
    sel: '#431407',
    selFg: '#FED7AA',
    bad: '#F87171',
    ring: '#FB923C',
    scrim: 'rgba(0,0,0,0.6)',
    toast: '#F4F4F5',
    toastFg: '#0A0A0A',
  },
};

/** Space scale in dp. */
export const space = { s05: 2, s1: 4, s2: 8, s3: 12, s4: 16, s6: 24, s8: 32 } as const;

/** Corner radii in dp. `pill` is for chips and the tab pill. */
export const radius = { r: 8, rL: 16, pill: 999 } as const;

/** Type sizes in sp; body is `m`. Line height is 1.4 times the size. */
export const type = { s: 14, m: 16, l: 24, xl: 32 } as const;
export const lineHeight = (size: number) => Math.round(size * 1.4);

/** Sizes of fixed parts of the shell, in dp. */
export const size = {
  icon: 20,
  iconS: 18,
  mark: 22,
  touch: 44,
  topBar: 56,
  tab: 60,
  tabPillW: 52,
  tabPillH: 28,
  fab: 52,
  ring: 3,
  hairline: 1,
  /** The logo beside the Business name in setup and Settings. */
  logo: 64,
  /** The pad a signature is drawn on. */
  signatureH: 160,
  /** One segment of the setup step bar. */
  stepBar: 4,
} as const;

/** The New button's shadow (Android elevation). */
export const elevation = { fab: 6 } as const;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const at = (i: number) => channel(parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * at(0) + 0.7152 * at(2) + 0.0722 * at(4);
}

/** WCAG contrast ratio of two `#RRGGBB` colours. */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
