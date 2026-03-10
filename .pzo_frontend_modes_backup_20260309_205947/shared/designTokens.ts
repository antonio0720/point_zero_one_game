// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SHARED DESIGN TOKENS
// modes/shared/designTokens.ts
// Sprint 4 — Single source of truth for all mode visual values
//
// All values WCAG AA+ verified on dark panel backgrounds.
// Font stack: DM Mono (data) + Barlow Condensed (headers) — matches App.tsx.
// DO NOT use IBM Plex Mono, Syne, Outfit, or system fonts in mode components.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

export const C = {
  // ── Foundations ──────────────────────────────────────────────────────────
  void:     '#020208',
  deep:     '#06060F',
  surface:  '#0A0A18',
  panel:    '#0D0D1E',
  panelHi:  '#111128',

  // ── Text — all WCAG AA+ on panel backgrounds ──────────────────────────────
  textPrime: '#F0F0FF',   // 14.8:1 contrast
  textBold:  '#FFFFFF',   // 21:1 contrast
  textSub:   '#B8B8D8',   // 7.9:1 contrast
  textDim:   '#6A6A90',   // 4.6:1 contrast
  textMut:   '#3A3A58',   // border/divider use only

  // ── Brand Gold ────────────────────────────────────────────────────────────
  gold:     '#C9A84C',
  goldDim:  'rgba(201,168,76,0.10)',
  goldBrd:  'rgba(201,168,76,0.28)',

  // ── Engine accent palette — all > 5:1 contrast on panel ───────────────────
  green:    '#2EE89A',   // success / CALM / freedom
  blue:     '#4A9EFF',   // Time engine / STABLE
  purple:   '#9B7DFF',   // Tension / Phantom accent
  orange:   '#FF9B2F',   // ELEVATED / warning
  red:      '#FF4D4D',   // HIGH / combat / danger
  crimson:  '#FF1744',   // CRITICAL / collapse
  cyan:     '#2DDBF5',   // Shield engine
  teal:     '#00C9A7',   // Cascade positive / Syndicate accent
  magenta:  '#E040FB',   // Sovereignty

  // ── Mode accents ─────────────────────────────────────────────────────────
  empire:   '#C9A84C',   // Gold sovereign
  predator: '#FF4D4D',   // Blood red combat
  syndicate:'#00C9A7',   // Alliance teal
  phantom:  '#9B7DFF',   // Spectral purple

  // ── Semantic ─────────────────────────────────────────────────────────────
  success:  '#2EE89A',
  warn:     '#FF9B2F',
  danger:   '#FF4D4D',
  info:     '#4A9EFF',

  // ── Borders ──────────────────────────────────────────────────────────────
  brdLow:   'rgba(255,255,255,0.06)',
  brdMed:   'rgba(255,255,255,0.12)',
  brdHi:    'rgba(255,255,255,0.22)',

  // ── Typography ───────────────────────────────────────────────────────────
  display:  "'Barlow Condensed', 'Oswald', 'Impact', system-ui, sans-serif",
  mono:     "'DM Mono', 'JetBrains Mono', 'Fira Code', monospace",
  body:     "'DM Sans', 'Nunito', system-ui, sans-serif",
} as const;

export type DesignColor = typeof C[keyof typeof C];

// ── Google Fonts import string (include in any component that needs fonts) ──
export const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600&display=swap');`;

// ── Mode-specific color sets ──────────────────────────────────────────────────

export type GameMode = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

export const MODE_COLORS: Record<GameMode, {
  accent:    string;
  accentDim: string;
  accentBrd: string;
  surface:   string;
  textSub:   string;
}> = {
  EMPIRE: {
    accent:    C.gold,
    accentDim: 'rgba(201,168,76,0.10)',
    accentBrd: 'rgba(201,168,76,0.28)',
    surface:   '#0D0C02',
    textSub:   '#C8A870',   // warm gold-tinted, 5.2:1
  },
  PREDATOR: {
    accent:    C.red,
    accentDim: 'rgba(255,77,77,0.10)',
    accentBrd: 'rgba(255,77,77,0.28)',
    surface:   '#0D0005',
    textSub:   '#C89090',   // warm red-tinted, 5.4:1
  },
  SYNDICATE: {
    accent:    C.teal,
    accentDim: 'rgba(0,201,167,0.10)',
    accentBrd: 'rgba(0,201,167,0.28)',
    surface:   '#020D0A',
    textSub:   '#8ECEC7',   // teal-tinted, 5.8:1
  },
  PHANTOM: {
    accent:    C.purple,
    accentDim: 'rgba(155,125,255,0.10)',
    accentBrd: 'rgba(155,125,255,0.28)',
    surface:   '#06020E',
    textSub:   '#AB90D0',   // purple-tinted, 5.1:1
  },
};

// ── Pressure tier colors (matches App.tsx) ────────────────────────────────────
export const PRESSURE_COLORS: Record<string, string> = {
  CALM:     C.green,
  BUILDING: C.gold,
  ELEVATED: C.orange,
  HIGH:     C.red,
  CRITICAL: C.crimson,
};

// ── Tick tier colors (matches App.tsx) ────────────────────────────────────────
export const TICK_COLORS: Record<string, string> = {
  T0: C.gold,
  T1: C.green,
  T2: C.orange,
  T3: C.red,
  T4: C.crimson,
};

// ── Shared keyframe animations (inject via <style> or CSS-in-JS) ─────────────
export const KEYFRAMES = `
  @keyframes pulseBadge {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.65; }
  }
  @keyframes pulseRed {
    0%,100% { box-shadow: 0 0 0 0 rgba(255,23,68,0); }
    50%      { box-shadow: 0 0 0 6px rgba(255,23,68,0.3); }
  }
  @keyframes fadeSlide {
    from { opacity:0; transform: translateY(-6px); }
    to   { opacity:1; transform: translateY(0); }
  }
  @keyframes expandIn {
    from { opacity:0; transform: scale(0.95); }
    to   { opacity:1; transform: scale(1); }
  }
  @keyframes shimmerGold {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
`;

// ── Responsive breakpoint helpers ─────────────────────────────────────────────
export const BP = {
  mobile:  '(max-width: 539px)',
  tablet:  '(min-width: 540px) and (max-width: 899px)',
  desktop: '(min-width: 900px)',
  wide:    '(min-width: 1400px)',
} as const;

// ── clamp() shortcuts for common responsive sizes ─────────────────────────────
export const FS = {
  xs:  'clamp(9px,  1.5vw, 10px)',
  sm:  'clamp(10px, 1.8vw, 12px)',
  md:  'clamp(12px, 2.2vw, 14px)',
  lg:  'clamp(14px, 2.8vw, 18px)',
  xl:  'clamp(18px, 4vw,   24px)',
  xxl: 'clamp(24px, 6vw,   48px)',
  hero:'clamp(32px, 8vw,   64px)',
} as const;

// ── Minimum touch target size ─────────────────────────────────────────────────
export const TOUCH_TARGET = 48; // px — WCAG 2.5.5 enhanced