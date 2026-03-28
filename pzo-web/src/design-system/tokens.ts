/**
 * ============================================================================
 * POINT ZERO ONE — DESIGN SYSTEM TOKENS
 * FILE: pzo-web/src/design-system/tokens.ts
 * ============================================================================
 *
 * The single source of truth for every visual decision in PZO.
 * Every color, spacing value, radius, shadow, font, and animation timing
 * in the entire frontend resolves back to this file.
 *
 * ARCHITECTURE:
 *   Global Tokens  → raw values with no semantic meaning
 *        ↓
 *   Alias Tokens   → semantic names mapped to globals
 *        ↓
 *   Component Tokens → scoped overrides per component family
 *
 * RULE: Components NEVER import global tokens directly.
 *       Components import from `semantic`, `engine`, or `component` namespaces.
 *       This is what makes theming, density modes, and engine-specific
 *       palettes possible without touching component code.
 *
 * Density6 LLC · Point Zero One · Confidential · IP Protected
 * ============================================================================
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — GLOBAL COLOR SCALES
// ═══════════════════════════════════════════════════════════════════════════════
// Raw hue scales. 11 steps each. No semantic meaning at this level.
// Generated with perceptual uniformity in mind (OKLCH-inspired spacing).
// PZO is a dark-first UI — the scale is optimized for dark backgrounds.

export const colors = {
  // ── Neutrals (warm-shifted for game atmosphere, not cold corporate gray) ──
  gray: {
    50:  '#F5F3F0',
    100: '#E8E4DF',
    200: '#D1CBC2',
    300: '#B5ADA2',
    400: '#978D80',
    500: '#7A7062',
    600: '#5E554A',
    700: '#443D34',
    800: '#2C2720',
    900: '#1A1610',
    950: '#0D0B08',
  },

  // ── Cyan (primary accent — sovereignty, clarity, system authority) ──
  cyan: {
    50:  '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    300: '#67E8F9',
    400: '#22D3EE',
    500: '#06B6D4',
    600: '#0891B2',
    700: '#0E7490',
    800: '#155E75',
    900: '#164E63',
    950: '#083344',
  },

  // ── Violet (secondary accent — intelligence, ML systems, mystery) ──
  violet: {
    50:  '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
    950: '#2E1065',
  },

  // ── Emerald (success, profit, stability, shield) ──
  emerald: {
    50:  '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
    950: '#022C22',
  },

  // ── Amber (warning, tension, pressure, caution) ──
  amber: {
    50:  '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
    950: '#451A03',
  },

  // ── Red (danger, loss, critical, cascade failure) ──
  red: {
    50:  '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
  },

  // ── Rose (combat, aggression, predator mode) ──
  rose: {
    50:  '#FFF1F2',
    100: '#FFE4E6',
    200: '#FECDD3',
    300: '#FDA4AF',
    400: '#FB7185',
    500: '#F43F5E',
    600: '#E11D48',
    700: '#BE123C',
    800: '#9F1239',
    900: '#881337',
    950: '#4C0519',
  },

  // ── Gold (sovereignty, mastery, endgame, rare) ──
  gold: {
    50:  '#FFFEF5',
    100: '#FEFCE8',
    200: '#FEF9C3',
    300: '#FEF08A',
    400: '#FDE047',
    500: '#EAB308',
    600: '#CA8A04',
    700: '#A16207',
    800: '#854D0E',
    900: '#713F12',
    950: '#422006',
  },

  // ── Absolute ──
  white: '#FFFFFF',
  black: '#000000',
} as const;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — ENGINE COLOR MAPPING
// ═══════════════════════════════════════════════════════════════════════════════
// Each of the 7 deterministic engines owns a hue identity.
// Used for engine-specific UI chrome, gauges, borders, and glow effects.

export const engineColors = {
  time:        { primary: colors.cyan[500],    dim: colors.cyan[900],    glow: colors.cyan[400]    },
  pressure:    { primary: colors.amber[500],   dim: colors.amber[900],   glow: colors.amber[400]   },
  tension:     { primary: colors.red[500],     dim: colors.red[900],     glow: colors.red[400]     },
  shield:      { primary: colors.emerald[500], dim: colors.emerald[900], glow: colors.emerald[400] },
  battle:      { primary: colors.rose[500],    dim: colors.rose[900],    glow: colors.rose[400]    },
  cascade:     { primary: colors.violet[500],  dim: colors.violet[900],  glow: colors.violet[400]  },
  sovereignty: { primary: colors.gold[500],    dim: colors.gold[900],    glow: colors.gold[400]    },
} as const;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — SEMANTIC ALIAS TOKENS
// ═══════════════════════════════════════════════════════════════════════════════
// Components import from HERE, never from Section 1.
// Dark mode is the default and only mode for PZO (this is a game, not a SaaS).

export const semantic = {
  // ── Surfaces ──
  bg: {
    primary:    colors.gray[950],           // page / app background
    secondary:  colors.gray[900],           // panels, sidebars
    tertiary:   colors.gray[800],           // inset areas, wells
    card:       '#151A2E',                  // card surfaces (blue-shifted dark)
    cardHover:  '#1E2440',                  // card hover state
    overlay:    'rgba(0, 0, 0, 0.65)',      // modal/drawer backdrop
    glass:      'rgba(14, 18, 32, 0.85)',   // glassmorphism panels
    input:      colors.gray[900],           // form input backgrounds
    danger:     `${colors.red[950]}80`,     // destructive action background
  },

  // ── Text ──
  text: {
    primary:    colors.gray[50],            // headings, primary content
    secondary:  colors.gray[400],           // labels, descriptions
    tertiary:   colors.gray[600],           // placeholders, disabled, hints
    inverse:    colors.gray[950],           // text on light/accent surfaces
    accent:     colors.cyan[400],           // links, interactive text
    danger:     colors.red[400],            // error messages
    success:    colors.emerald[400],        // success messages
    warning:    colors.amber[400],          // warning messages
  },

  // ── Borders ──
  border: {
    default:    colors.gray[800],           // card borders, dividers
    strong:     colors.gray[700],           // emphasized borders
    subtle:     colors.gray[900],           // very faint separation
    focus:      colors.cyan[500],           // focus ring
    danger:     colors.red[600],            // error state borders
    success:    colors.emerald[600],        // success state borders
  },

  // ── Status (maps to game states + UI feedback) ──
  status: {
    success:    colors.emerald[500],
    warning:    colors.amber[500],
    danger:     colors.red[500],
    info:       colors.cyan[500],
    critical:   colors.red[600],
    neutral:    colors.gray[500],
  },

  // ── Interactive ──
  interactive: {
    accent:         colors.cyan[500],
    accentHover:    colors.cyan[400],
    accentPressed:  colors.cyan[600],
    accentDisabled: colors.cyan[900],
    accentText:     colors.gray[950],       // text on accent backgrounds
    secondary:      colors.violet[500],
    secondaryHover: colors.violet[400],
  },

  // ── Game-Specific Semantic ──
  game: {
    profit:     colors.emerald[400],        // P&L positive
    loss:       colors.red[400],            // P&L negative
    breakeven:  colors.gray[500],           // P&L neutral
    xp:         colors.violet[400],         // experience points
    bond:       colors.rose[400],           // companion bond level
    rare:       colors.gold[400],           // rare items/companions
    epic:       colors.violet[400],         // epic rarity
    legendary:  colors.gold[500],           // legendary rarity
    common:     colors.gray[400],           // common rarity
  },
} as const;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — SPACING (8px Grid)
// ═══════════════════════════════════════════════════════════════════════════════
// Every margin, padding, gap, and dimension snaps to this scale.

export const space = {
  0:    '0px',
  px:   '1px',
  0.5:  '2px',
  1:    '4px',
  1.5:  '6px',
  2:    '8px',        // base unit
  3:    '12px',
  4:    '16px',       // default card padding
  5:    '20px',
  6:    '24px',       // section gap
  7:    '28px',
  8:    '32px',       // large gap
  10:   '40px',
  12:   '48px',       // page section spacing
  14:   '56px',
  16:   '64px',       // hero spacing
  20:   '80px',
  24:   '96px',
  32:   '128px',
} as const;

// Numeric values (for calculations, Tailwind config, etc.)
export const spaceRaw = {
  0: 0, px: 1, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16,
  5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 14: 56,
  16: 64, 20: 80, 24: 96, 32: 128,
} as const;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — RADIUS
// ═══════════════════════════════════════════════════════════════════════════════

export const radius = {
  none:   '0px',
  xs:     '2px',      // badges, inline elements
  sm:     '4px',      // inputs, small interactive
  md:     '8px',      // buttons, cards (DEFAULT)
  lg:     '12px',     // modals, panels
  xl:     '16px',     // large cards, floating elements
  '2xl':  '24px',     // pills, chips
  full:   '9999px',   // circles, avatars
} as const;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — SHADOWS & ELEVATION
// ═══════════════════════════════════════════════════════════════════════════════
// Dark UI: shadows are heavier + accent-colored glow on elevated interactive elements.

export const shadow = {
  none:   'none',
  xs:     '0 1px 2px rgba(0, 0, 0, 0.3)',
  sm:     '0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)',
  md:     '0 4px 8px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)',
  lg:     '0 10px 20px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3)',
  xl:     '0 20px 40px rgba(0, 0, 0, 0.5), 0 10px 15px rgba(0, 0, 0, 0.3)',
  '2xl':  '0 32px 64px rgba(0, 0, 0, 0.6)',
  inner:  'inset 0 2px 4px rgba(0, 0, 0, 0.4)',
  // Glow shadows for interactive/accent elements
  glow: {
    cyan:    `0 0 20px ${colors.cyan[500]}40, 0 0 60px ${colors.cyan[500]}15`,
    violet:  `0 0 20px ${colors.violet[500]}40, 0 0 60px ${colors.violet[500]}15`,
    emerald: `0 0 20px ${colors.emerald[500]}40, 0 0 60px ${colors.emerald[500]}15`,
    amber:   `0 0 20px ${colors.amber[500]}40, 0 0 60px ${colors.amber[500]}15`,
    red:     `0 0 20px ${colors.red[500]}40, 0 0 60px ${colors.red[500]}15`,
    gold:    `0 0 20px ${colors.gold[500]}40, 0 0 60px ${colors.gold[500]}15`,
    rose:    `0 0 20px ${colors.rose[500]}40, 0 0 60px ${colors.rose[500]}15`,
  },
} as const;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — TYPOGRAPHY
// ═══════════════════════════════════════════════════════════════════════════════
// PZO font stack: condensed display for game chrome + monospace for data.
// Premium choices only — never Arial, Inter, Roboto, system defaults.

export const typography = {
  // ── Font Families ──
  fontFamily: {
    display:  "'Clash Display', 'Satoshi', sans-serif",      // titles, HUD, engine names
    body:     "'Cabinet Grotesk', 'General Sans', sans-serif", // body text, descriptions
    mono:     "'JetBrains Mono', 'Fira Code', monospace",     // data, scores, P&L, timers
    game:     "'Bebas Neue', 'Oswald', sans-serif",           // game chrome, condensed labels
  },

  // ── Font Sizes (compact scale for game UI density) ──
  fontSize: {
    '2xs':  { size: '10px', lineHeight: '14px' },
    xs:     { size: '11px', lineHeight: '16px' },
    sm:     { size: '12px', lineHeight: '16px' },
    base:   { size: '13px', lineHeight: '18px' },   // default body
    md:     { size: '14px', lineHeight: '20px' },
    lg:     { size: '16px', lineHeight: '22px' },
    xl:     { size: '18px', lineHeight: '24px' },
    '2xl':  { size: '22px', lineHeight: '28px' },
    '3xl':  { size: '28px', lineHeight: '34px' },
    '4xl':  { size: '36px', lineHeight: '42px' },
    '5xl':  { size: '48px', lineHeight: '52px' },    // hero numbers
    '6xl':  { size: '64px', lineHeight: '68px' },    // sovereignty score
  },

  // ── Font Weights ──
  fontWeight: {
    light:     300,
    normal:    400,
    medium:    500,
    semibold:  600,
    bold:      700,
    extrabold: 800,
  },

  // ── Letter Spacing ──
  letterSpacing: {
    tighter:  '-0.02em',
    tight:    '-0.01em',
    normal:   '0em',
    wide:     '0.02em',
    wider:    '0.05em',
    widest:   '0.12em',    // uppercase labels, engine names
    tracking: '0.2em',     // extreme tracking for display text
  },
} as const;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — MOTION & ANIMATION
// ═══════════════════════════════════════════════════════════════════════════════
// Game UI is snappier than SaaS. Micro-interactions are faster.
// Reserve longer durations for cinematic/narrative moments only.

export const motion = {
  // ── Durations ──
  duration: {
    instant:    '0ms',
    fast:       '80ms',       // button press, toggle
    normal:     '150ms',      // hover states, focus
    moderate:   '250ms',      // panel transitions, card flip
    slow:       '400ms',      // page transitions, modal
    slower:     '600ms',      // dramatic reveals
    cinematic:  '1000ms',     // narrative/cutscene moments only
  },

  // ── Easing Curves ──
  ease: {
    default:    'cubic-bezier(0.4, 0, 0.2, 1)',     // standard ease
    in:         'cubic-bezier(0.4, 0, 1, 1)',        // accelerate out
    out:        'cubic-bezier(0, 0, 0.2, 1)',        // decelerate in
    inOut:      'cubic-bezier(0.4, 0, 0.2, 1)',      // smooth both
    bounce:     'cubic-bezier(0.34, 1.56, 0.64, 1)', // overshoot + settle
    spring:     'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // elastic snap
    sharp:      'cubic-bezier(0.4, 0, 0.6, 1)',      // crisp game UI feel
    anticipate: 'cubic-bezier(0.36, 0, 0.66, -0.56)', // pull back then release
  },

  // ── Prebuilt Transitions ──
  transition: {
    fast:     'all 80ms cubic-bezier(0.4, 0, 0.2, 1)',
    default:  'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow:     'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
    color:    'color 150ms ease, background-color 150ms ease, border-color 150ms ease',
    shadow:   'box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    transform: 'transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
} as const;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — LAYOUT & BREAKPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

export const layout = {
  // ── Breakpoints ──
  breakpoint: {
    sm:   '640px',
    md:   '768px',
    lg:   '1024px',
    xl:   '1280px',
    '2xl': '1536px',
  },

  // ── Max Content Widths ──
  maxWidth: {
    prose:      '680px',     // reading content
    content:    '1200px',    // app content
    dashboard:  '1400px',    // dashboards, wide layouts
    full:       '100%',      // full bleed
  },

  // ── Z-Index Scale ──
  zIndex: {
    base:       0,
    raised:     10,          // sticky elements, FABs
    dropdown:   20,          // menus, selects, popovers
    overlay:    30,          // backdrops
    modal:      40,          // dialogs, drawers
    toast:      50,          // notifications
    tooltip:    60,          // tooltips (always top)
    gameHUD:    70,          // game HUD elements (above everything)
  },

  // ── Game-Specific Dimensions ──
  sidebar: {
    expanded:   '260px',
    collapsed:  '64px',
  },
  topBar:       '52px',
  hudBar:       '48px',
  bottomNav:    '56px',
} as const;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — DENSITY MODES
// ═══════════════════════════════════════════════════════════════════════════════
// PZO defaults to COMPACT (game UI is data-dense by nature).
// Dense mode available for power users / battle view.

export type DensityMode = 'comfortable' | 'compact' | 'dense';

export const density: Record<DensityMode, {
  spacingScale: number;
  fontScale: number;
  rowHeight: string;
  cardPadding: string;
  iconSize: string;
}> = {
  comfortable: {
    spacingScale: 1.0,
    fontScale: 1.0,
    rowHeight: '48px',
    cardPadding: '20px',
    iconSize: '20px',
  },
  compact: {
    spacingScale: 0.75,
    fontScale: 0.95,
    rowHeight: '36px',
    cardPadding: '14px',
    iconSize: '18px',
  },
  dense: {
    spacingScale: 0.6,
    fontScale: 0.9,
    rowHeight: '28px',
    cardPadding: '10px',
    iconSize: '16px',
  },
} as const;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — COMPONENT TOKENS
// ═══════════════════════════════════════════════════════════════════════════════
// Scoped overrides for specific component families.
// Components import these, not globals or even aliases.

export const components = {
  button: {
    primary: {
      bg:          semantic.interactive.accent,
      bgHover:     semantic.interactive.accentHover,
      bgPressed:   semantic.interactive.accentPressed,
      bgDisabled:  semantic.interactive.accentDisabled,
      text:        semantic.interactive.accentText,
      radius:      radius.md,
      heightSm:    '32px',
      heightMd:    '40px',
      heightLg:    '48px',
    },
    secondary: {
      bg:          'transparent',
      bgHover:     `${colors.gray[800]}`,
      border:      semantic.border.default,
      borderHover: semantic.border.strong,
      text:        semantic.text.secondary,
      textHover:   semantic.text.primary,
    },
    destructive: {
      bg:          colors.red[600],
      bgHover:     colors.red[500],
      text:        colors.white,
    },
    ghost: {
      bg:          'transparent',
      bgHover:     `${colors.gray[800]}80`,
      text:        semantic.text.secondary,
      textHover:   semantic.text.primary,
    },
  },

  card: {
    bg:            semantic.bg.card,
    bgHover:       semantic.bg.cardHover,
    border:        semantic.border.default,
    radius:        radius.lg,
    padding:       space[4],
    shadow:        shadow.sm,
    shadowHover:   shadow.md,
  },

  input: {
    bg:            semantic.bg.input,
    bgFocus:       semantic.bg.secondary,
    border:        semantic.border.default,
    borderFocus:   semantic.border.focus,
    borderError:   semantic.border.danger,
    text:          semantic.text.primary,
    placeholder:   semantic.text.tertiary,
    radius:        radius.md,
    height:        '40px',
    heightSm:      '32px',
    heightLg:      '48px',
  },

  modal: {
    bg:            semantic.bg.secondary,
    border:        semantic.border.default,
    overlay:       semantic.bg.overlay,
    radius:        radius.xl,
    shadow:        shadow['2xl'],
    widthSm:       '400px',
    widthMd:       '560px',
    widthLg:       '720px',
    widthXl:       '900px',
  },

  toast: {
    bg:            semantic.bg.glass,
    border:        semantic.border.default,
    radius:        radius.lg,
    shadow:        shadow.lg,
  },

  // ── Game-Specific Component Tokens ──
  gauge: {
    trackBg:       colors.gray[900],
    trackRadius:   radius.full,
    barRadius:     radius.full,
    height:        '6px',
    heightLg:      '10px',
    heightXl:      '16px',
  },

  companionCard: {
    bg:            semantic.bg.card,
    border:        semantic.border.default,
    portraitSize:  '64px',
    portraitRadius: radius.lg,
    bondBarHeight: '4px',
  },

  hud: {
    bg:            semantic.bg.glass,
    border:        `${colors.cyan[800]}40`,
    text:          semantic.text.primary,
    labelColor:    semantic.text.tertiary,
    dataFont:      typography.fontFamily.mono,
    height:        layout.hudBar,
  },

  battleConsole: {
    bg:            '#0A0C18',
    border:        `${colors.red[900]}60`,
    accentGlow:    shadow.glow.red,
    fontFamily:    typography.fontFamily.mono,
  },

  sovereignty: {
    scoreBg:       `linear-gradient(135deg, ${colors.gray[900]}, ${colors.gray[950]})`,
    scoreBorder:   `${colors.gold[800]}40`,
    scoreGlow:     shadow.glow.gold,
    scoreFont:     typography.fontFamily.display,
    labelFont:     typography.fontFamily.game,
  },
} as const;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — RARITY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Unified rarity colors for companions, items, cards, achievements.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const rarity: Record<Rarity, {
  color: string;
  glow: string;
  bg: string;
  border: string;
  label: string;
}> = {
  common: {
    color:  colors.gray[400],
    glow:   'none',
    bg:     `${colors.gray[800]}60`,
    border: colors.gray[700],
    label:  'Common',
  },
  uncommon: {
    color:  colors.emerald[400],
    glow:   `0 0 12px ${colors.emerald[500]}30`,
    bg:     `${colors.emerald[950]}60`,
    border: colors.emerald[800],
    label:  'Uncommon',
  },
  rare: {
    color:  colors.cyan[400],
    glow:   `0 0 16px ${colors.cyan[500]}40`,
    bg:     `${colors.cyan[950]}60`,
    border: colors.cyan[800],
    label:  'Rare',
  },
  epic: {
    color:  colors.violet[400],
    glow:   `0 0 20px ${colors.violet[500]}50`,
    bg:     `${colors.violet[950]}60`,
    border: colors.violet[700],
    label:  'Epic',
  },
  legendary: {
    color:  colors.gold[400],
    glow:   `0 0 24px ${colors.gold[500]}60`,
    bg:     `${colors.gold[950]}60`,
    border: colors.gold[700],
    label:  'Legendary',
  },
  mythic: {
    color:  colors.rose[400],
    glow:   `0 0 30px ${colors.rose[500]}60, 0 0 60px ${colors.gold[500]}20`,
    bg:     `linear-gradient(135deg, ${colors.rose[950]}80, ${colors.gold[950]}80)`,
    border: colors.rose[600],
    label:  'Mythic',
  },
} as const;


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — CSS VARIABLE INJECTOR
// ═══════════════════════════════════════════════════════════════════════════════
// Generates CSS custom properties from the token system.
// Call once at app init via ThemeProvider or inject into <style> tag.

export function generateCSSVariables(): string {
  return `
:root {
  /* ── Surfaces ── */
  --bg-primary: ${semantic.bg.primary};
  --bg-secondary: ${semantic.bg.secondary};
  --bg-tertiary: ${semantic.bg.tertiary};
  --bg-card: ${semantic.bg.card};
  --bg-card-hover: ${semantic.bg.cardHover};
  --bg-overlay: ${semantic.bg.overlay};
  --bg-glass: ${semantic.bg.glass};
  --bg-input: ${semantic.bg.input};

  /* ── Text ── */
  --text-primary: ${semantic.text.primary};
  --text-secondary: ${semantic.text.secondary};
  --text-tertiary: ${semantic.text.tertiary};
  --text-accent: ${semantic.text.accent};
  --text-danger: ${semantic.text.danger};
  --text-success: ${semantic.text.success};

  /* ── Borders ── */
  --border-default: ${semantic.border.default};
  --border-strong: ${semantic.border.strong};
  --border-focus: ${semantic.border.focus};

  /* ── Status ── */
  --status-success: ${semantic.status.success};
  --status-warning: ${semantic.status.warning};
  --status-danger: ${semantic.status.danger};
  --status-info: ${semantic.status.info};

  /* ── Interactive ── */
  --accent: ${semantic.interactive.accent};
  --accent-hover: ${semantic.interactive.accentHover};
  --accent-pressed: ${semantic.interactive.accentPressed};

  /* ── Typography ── */
  --font-display: ${typography.fontFamily.display};
  --font-body: ${typography.fontFamily.body};
  --font-mono: ${typography.fontFamily.mono};
  --font-game: ${typography.fontFamily.game};

  /* ── Engine Colors ── */
  --engine-time: ${engineColors.time.primary};
  --engine-pressure: ${engineColors.pressure.primary};
  --engine-tension: ${engineColors.tension.primary};
  --engine-shield: ${engineColors.shield.primary};
  --engine-battle: ${engineColors.battle.primary};
  --engine-cascade: ${engineColors.cascade.primary};
  --engine-sovereignty: ${engineColors.sovereignty.primary};

  /* ── Spacing ── */
  --space-1: ${space[1]};
  --space-2: ${space[2]};
  --space-3: ${space[3]};
  --space-4: ${space[4]};
  --space-6: ${space[6]};
  --space-8: ${space[8]};
  --space-12: ${space[12]};
  --space-16: ${space[16]};

  /* ── Radius ── */
  --radius-sm: ${radius.sm};
  --radius-md: ${radius.md};
  --radius-lg: ${radius.lg};
  --radius-xl: ${radius.xl};
  --radius-full: ${radius.full};

  /* ── Motion ── */
  --duration-fast: ${motion.duration.fast};
  --duration-normal: ${motion.duration.normal};
  --duration-slow: ${motion.duration.slow};
  --ease-default: ${motion.ease.default};
  --ease-bounce: ${motion.ease.bounce};
  --ease-spring: ${motion.ease.spring};
}
`.trim();
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14 — TAILWIND CONFIG EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
// Import this into tailwind.config.js:
//   import { tailwindExtend } from './src/design-system/tokens';
//   theme: { extend: tailwindExtend }

export const tailwindExtend = {
  colors: {
    gray: colors.gray,
    cyan: colors.cyan,
    violet: colors.violet,
    emerald: colors.emerald,
    amber: colors.amber,
    red: colors.red,
    rose: colors.rose,
    gold: colors.gold,
    // Semantic shortcuts
    bg: {
      primary: semantic.bg.primary,
      secondary: semantic.bg.secondary,
      tertiary: semantic.bg.tertiary,
      card: semantic.bg.card,
    },
    text: {
      primary: semantic.text.primary,
      secondary: semantic.text.secondary,
      tertiary: semantic.text.tertiary,
    },
    accent: {
      DEFAULT: semantic.interactive.accent,
      hover: semantic.interactive.accentHover,
      pressed: semantic.interactive.accentPressed,
    },
    engine: {
      time: engineColors.time.primary,
      pressure: engineColors.pressure.primary,
      tension: engineColors.tension.primary,
      shield: engineColors.shield.primary,
      battle: engineColors.battle.primary,
      cascade: engineColors.cascade.primary,
      sovereignty: engineColors.sovereignty.primary,
    },
  },
  fontFamily: {
    display: [typography.fontFamily.display],
    body: [typography.fontFamily.body],
    mono: [typography.fontFamily.mono],
    game: [typography.fontFamily.game],
  },
  borderRadius: radius,
  boxShadow: {
    ...shadow,
    'glow-cyan': shadow.glow.cyan,
    'glow-violet': shadow.glow.violet,
    'glow-emerald': shadow.glow.emerald,
    'glow-amber': shadow.glow.amber,
    'glow-red': shadow.glow.red,
    'glow-gold': shadow.glow.gold,
    'glow-rose': shadow.glow.rose,
  },
  spacing: spaceRaw,
  zIndex: layout.zIndex,
} as const;
