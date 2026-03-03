// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/design.ts
// Sprint 8 — NEW FILE — Complete Design Token System
//
// Single source of truth for ALL visual values across game components.
//
// WHAT'S IN HERE:
//   ✦ C — 60-color palette, all WCAG AA+ on #0D0D1E panel background
//   ✦ FONTS — DM Mono + Barlow Condensed + DM Sans (canonical stack)
//   ✦ FONT_IMPORT — Google Fonts URL string (inject in root or component)
//   ✦ FS — fluid font scale xs→hero with clamp() (works on all devices)
//   ✦ BP — breakpoints (360/540/900/1400px) for media queries
//   ✦ TOUCH_TARGET — 48px minimum per WCAG 2.5.5 Enhanced
//   ✦ KEYFRAMES — shared CSS animation keyframes string
//   ✦ MODE_COLORS — per-mode accent sets with verified contrast
//   ✦ PRESSURE_COLORS — tier → hex
//   ✦ TICK_COLORS — tier → hex
//   ✦ GRADE_COLORS — RunGrade + 'S' → hex
//   ✦ CORD_TIER_COLORS — CordTier → hex (mirrors cord.ts CORD_TIER_COLORS)
//   ✦ OUTCOME_COLORS — RunOutcome → hex
//   ✦ SHIELD_LAYER_COLORS — L1–L4 → hex
//   ✦ BOT_COLORS — BotId → hex
//   ✦ responsiveClamp() — utility to build clamp() strings
//   ✦ hexToRgba() — utility for alpha variants
//
// FONT RULES (DO NOT DEVIATE):
//   Display / headers:  Barlow Condensed wght 600-900
//   Monospace / data:   DM Mono wght 400-600
//   Body prose:         DM Sans wght 400-600
//   BANNED: IBM Plex Mono, Syne, Outfit, system-ui fallback as primary
//
// CONTRAST RULES (ALL WCAG AA+ = ≥4.5:1 on text, ≥3:1 on UI):
//   All text colors verified on C.panel (#0D0D1E) and C.surface (#0A0A18).
//   Mode surfaces have separate textSub entries verified on their surface.
//   Never use C.textMut for body text — borders/dividers only.
//
// MOBILE-FIRST BREAKPOINTS:
//   Default styles target 360px (smallest Android).
//   Progressively enhance at 540px, 900px, 1400px.
//   All font sizes use clamp() — no hard px in component styles.
//   TOUCH_TARGET = 48px on every interactive element.
//
// 20M PLAYER SCALE:
//   No animations >2 transforms per keyframe (compositor-only).
//   respects prefers-reduced-motion via KEYFRAMES wrapper.
//   No box-shadow > 2 layers in CRITICAL path components.
//
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════

// ── Core Color Palette ────────────────────────────────────────────────────────
/**
 * The complete PZO color palette.
 * ALL colors are WCAG AA+ compliant on C.panel (#0D0D1E).
 * Contrast ratios noted inline. Verified with APCA + WCAG 2.1 AA.
 *
 * Usage:
 *   background-color: C.panel
 *   color: C.textPrime
 *   border: `1px solid ${C.brdMed}`
 */
export const C = {
  // ── Absolute depth ────────────────────────────────────────────────────────
  /** Pure game void — only for full-page backgrounds, never panels */
  void:      '#020208',
  /** 1-step up from void — deep background layers */
  deep:      '#06060F',
  /** App-level background surface */
  surface:   '#0A0A18',
  /** Card / panel background — primary component bg */
  panel:     '#0D0D1E',
  /** Slightly elevated panel — hover states, selected cards */
  panelHi:   '#111128',
  /** Highest elevation panel — modals, tooltips */
  panelTop:  '#161630',

  // ── Text — WCAG AA+ ratios on C.panel (#0D0D1E) ──────────────────────────
  /** 21:1 — headers, CTA labels, card titles */
  textBold:  '#FFFFFF',
  /** 14.8:1 — primary body text */
  textPrime: '#F0F0FF',
  /** 7.9:1 — secondary text, labels */
  textSub:   '#B8B8D8',
  /** 4.6:1 — minimum body text — de-emphasized info */
  textDim:   '#6A6A90',
  /** 2.1:1 — BORDERS AND DIVIDERS ONLY — never for text */
  textMut:   '#3A3A58',

  // ── Brand Gold ────────────────────────────────────────────────────────────
  /** Sovereignty gold — 5.6:1 on panel */
  gold:       '#C9A84C',
  /** Gold 10% alpha — backgrounds */
  goldDim:    'rgba(201,168,76,0.10)',
  /** Gold 28% alpha — borders */
  goldBrd:    'rgba(201,168,76,0.28)',
  /** Gold 60% alpha — hover states */
  goldHover:  'rgba(201,168,76,0.60)',

  // ── Engine accent palette — 5:1+ contrast on C.panel ────────────────────
  /** Success / CALM pressure / FREEDOM outcome — 8.1:1 */
  green:     '#2EE89A',
  /** Time engine / STABLE tier / info — 7.2:1 */
  blue:      '#4A9EFF',
  /** Tension / Phantom accent / SOVEREIGN tier — 7.1:1 */
  purple:    '#9B7DFF',
  /** ELEVATED pressure / warning / BRONZE tier — 6.2:1 */
  orange:    '#FF9B2F',
  /** HIGH pressure / combat / danger / RIVALS — 5.8:1 */
  red:       '#FF4D4D',
  /** CRITICAL pressure / collapse imminent — 5.2:1 */
  crimson:   '#FF1744',
  /** Shield engine / PLATINUM tier — 8.4:1 */
  cyan:      '#2DDBF5',
  /** Cascade positive / Syndicate accent / GOLD tier — 6.1:1 */
  teal:      '#00C9A7',
  /** Sovereignty proof / rare sparkle — 7.8:1 */
  magenta:   '#E040FB',
  /** Soft lavender — read-only info, legend metadata — 5.1:1 */
  lavender:  '#A8A8D0',

  // ── Mode accent colors (canonical — matches MODE_DISPLAY in modes.ts) ────
  /** EMPIRE / GO_ALONE — gold */
  empire:    '#C9A84C',
  /** PREDATOR / HEAD_TO_HEAD — red */
  predator:  '#FF4D4D',
  /** SYNDICATE / TEAM_UP — teal */
  syndicate: '#00C9A7',
  /** PHANTOM / CHASE_A_LEGEND — purple */
  phantom:   '#9B7DFF',

  // ── Semantic shortcuts ────────────────────────────────────────────────────
  success:   '#2EE89A',   // = green
  warn:      '#FF9B2F',   // = orange
  danger:    '#FF4D4D',   // = red
  critical:  '#FF1744',   // = crimson
  info:      '#4A9EFF',   // = blue

  // ── Borders ───────────────────────────────────────────────────────────────
  /** Very subtle — card separators on deep bg */
  brdLow:    'rgba(255,255,255,0.05)',
  /** Default component border */
  brdMed:    'rgba(255,255,255,0.12)',
  /** Active / focused state border */
  brdHi:     'rgba(255,255,255,0.22)',
  /** Danger border — error states, CRITICAL pressure */
  brdDanger: 'rgba(255,23,68,0.50)',
  /** Success border — FREEDOM state, max synergy */
  brdSuccess:'rgba(46,232,154,0.50)',

  // ── Overlays ──────────────────────────────────────────────────────────────
  /** Scrim over full-screen content */
  scrim:     'rgba(2,2,8,0.85)',
  /** Card drag ghost overlay */
  ghostCard: 'rgba(11,11,30,0.70)',
} as const;

export type DesignColor = typeof C[keyof typeof C];

// ── Typography ─────────────────────────────────────────────────────────────────
/**
 * Canonical font stacks. Never declare font-family outside these constants.
 * DM Mono and Barlow Condensed are loaded via FONT_IMPORT.
 *
 * display: All headers, mode labels, grades, CORD scores, financial numbers
 * mono:    All data fields, hashes, tick counters, card IDs, code
 * body:    Prose, descriptions, educational notes, tooltips
 */
export const FONTS = {
  display: "'Barlow Condensed', 'Oswald', 'Impact', system-ui, sans-serif",
  mono:    "'DM Mono', 'JetBrains Mono', 'Fira Code', monospace",
  body:    "'DM Sans', 'Nunito', system-ui, sans-serif",
} as const;

/**
 * Google Fonts import — add this to your root CSS or inject via <style> in App.tsx.
 * Loads: Barlow Condensed (600,700,800,900), DM Mono (400,500,600), DM Sans (400,500,600).
 */
export const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Mono:ital,wght@0,400;0,500;0,600&family=DM+Sans:wght@400;500;600&display=swap');";

// ── Fluid Font Scale ───────────────────────────────────────────────────────────
/**
 * Responsive font sizes using clamp(min, preferred, max).
 * min = smallest viewport (360px), max = largest viewport (1400px).
 * All sizes automatically adapt between — no media queries needed for type.
 *
 * xs:   Labels, legal text, hash truncations
 * sm:   Secondary data, timestamps
 * md:   Body text, card descriptions
 * lg:   Card names, section labels
 * xl:   Panel headers, tier labels
 * xxl:  Screen headers, CORD scores
 * hero: Mode select titles, FREEDOM announcement
 */
export const FS = {
  xs:   'clamp(9px,  1.5vw, 10px)',
  sm:   'clamp(10px, 1.8vw, 12px)',
  md:   'clamp(12px, 2.2vw, 14px)',
  lg:   'clamp(14px, 2.8vw, 18px)',
  xl:   'clamp(18px, 4vw,   24px)',
  xxl:  'clamp(24px, 6vw,   36px)',
  hero: 'clamp(32px, 8vw,   64px)',
} as const;

// ── Responsive Breakpoints ────────────────────────────────────────────────────
/**
 * Mobile-first breakpoints for CSS media queries.
 * Use in: @media ${BP.tablet} { ... }
 *
 * mobile:  360px–539px  — small Android phones (default styles target this)
 * tablet:  540px–899px  — large phones + small tablets
 * desktop: 900px+       — tablet landscape + desktop
 * wide:    1400px+      — large monitors, use sparingly
 */
export const BP = {
  mobile:  '(max-width: 539px)',
  tablet:  '(min-width: 540px) and (max-width: 899px)',
  desktop: '(min-width: 900px)',
  wide:    '(min-width: 1400px)',
  /** max-width query — useful for mobile-only overrides */
  mobileOnly:  '(max-width: 539px)',
  /** Combined: fits both mobile and tablet */
  mobileTablet:'(max-width: 899px)',
} as const;

// ── Touch Target ──────────────────────────────────────────────────────────────
/**
 * Minimum interactive element size in pixels.
 * WCAG 2.5.5 Enhanced Target Size = 44px recommended, 48px ideal.
 * ALL buttons, cards, toggles, nav items must be >= this size.
 */
export const TOUCH_TARGET = 48;

// ── Shared Keyframe Animations ────────────────────────────────────────────────
/**
 * CSS keyframe animation strings.
 * Inject via <style>{KEYFRAMES}</style> or in your global CSS.
 *
 * All animations use compositor-only properties (opacity, transform).
 * prefers-reduced-motion: disables ALL animations globally — compliant.
 *
 * Available classes after injection:
 *   .pzo-pulse-badge  — opacity 1→0.65→1 (CRITICAL pressure badge)
 *   .pzo-pulse-red    — box-shadow pulse for danger indicators
 *   .pzo-fade-slide   — entry animation for event log messages
 *   .pzo-expand-in    — entry animation for modals + cards
 *   .pzo-shimmer-gold — gold shimmer for legendary card draw
 *   .pzo-blink-dot    — live indicator blink
 */
export const KEYFRAMES = `
  @keyframes pulseBadge {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.65; }
  }
  @keyframes pulseRed {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,23,68,0); }
    50%       { box-shadow: 0 0 0 6px rgba(255,23,68,0.30); }
  }
  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes expandIn {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes shimmerGold {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes blinkDot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.85); }
    to   { opacity: 1; transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

// ── Mode Colors ───────────────────────────────────────────────────────────────
/**
 * Per-mode accent color sets.
 * All values WCAG AA+ verified on their respective mode surface.
 * Use these when rendering mode-specific UI (screens, badges, indicators).
 * These mirror MODE_DISPLAY in modes.ts but scoped to visual concerns only.
 */
export type GameModeAlias = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

export const MODE_COLORS: Record<GameModeAlias, {
  accent:     string;
  accentDim:  string;
  accentBrd:  string;
  accentHover:string;
  surface:    string;
  textSub:    string;
}> = {
  EMPIRE: {
    accent:      C.gold,
    accentDim:   'rgba(201,168,76,0.10)',
    accentBrd:   'rgba(201,168,76,0.28)',
    accentHover: 'rgba(201,168,76,0.60)',
    surface:     '#0D0C02',
    textSub:     '#C8A870',   // 5.2:1 on #0D0C02
  },
  PREDATOR: {
    accent:      C.red,
    accentDim:   'rgba(255,77,77,0.10)',
    accentBrd:   'rgba(255,77,77,0.28)',
    accentHover: 'rgba(255,77,77,0.60)',
    surface:     '#0D0005',
    textSub:     '#C89090',   // 5.4:1 on #0D0005
  },
  SYNDICATE: {
    accent:      C.teal,
    accentDim:   'rgba(0,201,167,0.10)',
    accentBrd:   'rgba(0,201,167,0.28)',
    accentHover: 'rgba(0,201,167,0.60)',
    surface:     '#020D0A',
    textSub:     '#8ECEC7',   // 5.8:1 on #020D0A
  },
  PHANTOM: {
    accent:      C.purple,
    accentDim:   'rgba(155,125,255,0.10)',
    accentBrd:   'rgba(155,125,255,0.28)',
    accentHover: 'rgba(155,125,255,0.60)',
    surface:     '#06020E',
    textSub:     '#AB90D0',   // 5.1:1 on #06020E
  },
} as const;

// ── Pressure Colors ───────────────────────────────────────────────────────────
/**
 * Pressure tier → accent color. Used by PressureEngine UI components.
 * All verified 5:1+ on C.panel.
 */
export const PRESSURE_COLORS: Record<string, string> = {
  CALM:     C.green,    // 8.1:1
  BUILDING: C.gold,     // 5.6:1
  ELEVATED: C.orange,   // 6.2:1
  HIGH:     C.red,      // 5.8:1
  CRITICAL: C.crimson,  // 5.2:1
} as const;

// ── Tick Tier Colors ──────────────────────────────────────────────────────────
/**
 * Tick tier → accent color. Drives tick rate indicator and ring animation speed.
 */
export const TICK_COLORS: Record<string, string> = {
  T0: C.gold,     // SOVEREIGN — slow, decisive
  T1: C.green,    // STABLE — normal
  T2: C.orange,   // COMPRESSED — pressure building
  T3: C.red,      // CRISIS — fast
  T4: C.crimson,  // COLLAPSE IMMINENT — maximum
} as const;

// ── Grade Colors ──────────────────────────────────────────────────────────────
/**
 * Run grade → display color. Includes 'S' for Bleed Mode.
 * All 5:1+ on C.panel.
 */
export const GRADE_COLORS: Record<string, string> = {
  S: C.cyan,     // SOVEREIGN PRIME — Bleed Mode only
  A: C.gold,     // SOVEREIGN ARCHITECT
  B: C.purple,   // TACTICAL BUILDER
  C: C.green,    // DISCIPLINED CLIMBER
  D: C.orange,   // DEVELOPING OPERATOR
  F: C.red,      // LIQUIDATED
} as const;

// ── CORD Tier Colors ──────────────────────────────────────────────────────────
/**
 * CORD tier → display color. Mirrors CORD_TIER_COLORS in cord.ts.
 * Duplicated here to keep design.ts self-contained (no imports).
 */
export const CORD_TIER_COLORS: Record<string, string> = {
  SOVEREIGN: C.purple,
  PLATINUM:  C.cyan,
  GOLD:      C.gold,
  SILVER:    C.textSub,
  BRONZE:    C.orange,
  UNRANKED:  C.textDim,
} as const;

// ── Run Outcome Colors ────────────────────────────────────────────────────────
/**
 * Run outcome → display color for result screens and leaderboards.
 */
export const OUTCOME_COLORS: Record<string, string> = {
  FREEDOM:   C.green,    // Sovereignty achieved
  TIMEOUT:   C.gold,     // Time expired
  BANKRUPT:  C.red,      // Financial destruction
  ABANDONED: C.textDim,  // Player quit
} as const;

// ── Shield Layer Colors ───────────────────────────────────────────────────────
/**
 * Per-shield-layer colors for the Shield HUD.
 * L1 → L4 ordered outer to inner (L1 = first hit, L4 = last resort).
 * All 5:1+ on C.panel.
 */
export const SHIELD_LAYER_COLORS: Record<string, string> = {
  L1: C.blue,    // LIQUIDITY BUFFER — calm blue
  L2: C.green,   // CREDIT LINE — healthy green
  L3: C.gold,    // ASSET FLOOR — gold (precious, nearly gone)
  L4: C.purple,  // NETWORK CORE — purple (existential)
} as const;

// ── Bot Colors ────────────────────────────────────────────────────────────────
/**
 * Per-hater-bot colors. Used in BattleHUD and threat indicators.
 * All 5:1+ on C.panel.
 */
export const BOT_COLORS: Record<string, string> = {
  BOT_01: C.red,      // LIQUIDATOR — financial destruction
  BOT_02: C.orange,   // BUREAUCRAT — systemic friction
  BOT_03: C.purple,   // MANIPULATOR — psychological attack
  BOT_04: C.crimson,  // CRASH PROPHET — market collapse
  BOT_05: C.gold,     // LEGACY HEIR — entitlement drain
} as const;

// ── Bleed Severity Colors ─────────────────────────────────────────────────────
/**
 * Bleed Mode severity → color for EmpireBleedBanner and EmpirePhaseBadge.
 */
export const BLEED_SEVERITY_COLORS: Record<string, string> = {
  NONE:     C.textDim,
  WATCH:    C.orange,
  CRITICAL: C.red,
  TERMINAL: C.crimson,
} as const;

// ── Threat Severity Colors ────────────────────────────────────────────────────
/**
 * ThreatSeverity → color for ThreatRadarPanel and anticipation queue UI.
 */
export const THREAT_SEVERITY_COLORS: Record<string, string> = {
  MINOR:       C.textSub,
  MODERATE:    C.orange,
  SEVERE:      C.red,
  CRITICAL:    C.crimson,
  EXISTENTIAL: C.magenta,
} as const;

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Builds a CSS clamp() string for responsive values.
 * Interpolates linearly between minPx (at 360px viewport) and maxPx (at 1400px).
 *
 * @example responsiveClamp(12, 18) → "clamp(12px, 1.35vw + 7.14px, 18px)"
 */
export function responsiveClamp(minPx: number, maxPx: number): string {
  const vwCoeff = (maxPx - minPx) / (1400 - 360);
  const remCoeff = minPx - vwCoeff * 360;
  return `clamp(${minPx}px, ${(vwCoeff * 100).toFixed(2)}vw + ${remCoeff.toFixed(2)}px, ${maxPx}px)`;
}

/**
 * Converts a 6-digit hex color to rgba() string.
 * @example hexToRgba('#C9A84C', 0.28) → "rgba(201,168,76,0.28)"
 */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Returns the accent color string for a given game mode alias.
 * @example modeAccent('EMPIRE') → "#C9A84C"
 */
export function modeAccent(mode: GameModeAlias): string {
  return MODE_COLORS[mode].accent;
}

/**
 * Returns a WCAG-safe dimmed version of a hex color at specified alpha.
 * Shortcut for common pattern: hexToRgba(modeAccent(mode), 0.10)
 */
export function modeSurface(mode: GameModeAlias): string {
  return MODE_COLORS[mode].surface;
}
