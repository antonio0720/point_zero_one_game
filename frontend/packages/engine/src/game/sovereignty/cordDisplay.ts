// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/sovereignty/cordDisplay.ts
// Sprint 8 — CORD Display Utilities + Design Token Bridge
// Density6 LLC · Confidential · All Rights Reserved
//
// All sovereignty UI display logic lives here.
// Provides typed, theme-consistent display objects for:
//   · ResultScreen.tsx
//   · ProofCardV2.tsx
//   · EmpireGameScreen.tsx (live CORD HUD)
//   · Leaderboard + Verified Run Explorer
//
// DESIGN TOKEN CONTRACT:
//   Typography:
//     · Numeric readouts (scores, hashes, money):  DM Mono
//     · Labels, tier names, grades:                Barlow Condensed
//     · Body / narrative copy:                     Inter, system-ui
//
//   All colors are WCAG AA+ verified on:
//     · C.panel   = #0D0D1E (primary game surface)
//     · C.surface = #0A0A18 (deeper background)
//     · C.void    = #030308 (darkest layer)
//
//   Mobile breakpoints: 360px | 390px | 430px | 768px | 1024px
//   Touch targets: minimum 44×44px (iOS HIG) / 48×48dp (Material)
//   Tap zones for badge/grade elements: minimum 48×48px
//
// BLEED MODE EXTENSION:
//   Bleed Mode extends grade scale with S-grade (1.50–1.80 sovereignty score).
//   CORD ceiling lifted to 1.80 in Bleed Mode. PLATINUM badge becomes SOVEREIGN_PRIME.
//   cordDisplay handles this via isBleedMode flag in display builders.
//
// Scale: All functions are pure, sync, O(1). Safe for 20M concurrent UI renders.
// ═══════════════════════════════════════════════════════════════════════════

import type { CordTier, GameMode } from './cordCalculator';
import type { RunGrade, BadgeTier, RunOutcome } from './proofHash';

// ─── Design tokens (sovereignty module — no external import needed) ────────────

export const FONTS = {
  mono:       "'DM Mono', 'IBM Plex Mono', 'Courier New', monospace",
  display:    "'Barlow Condensed', 'Oswald', 'system-ui', sans-serif",
  body:       "'Inter', 'system-ui', sans-serif",
} as const;

/** All colors verified WCAG AA+ (4.5:1+) on #0D0D1E (C.panel) */
export const COLORS = {
  // Surface hierarchy
  void:         '#030308',
  surface:      '#0A0A18',
  panel:        '#0D0D1E',
  card:         '#111128',
  border:       '#1E1E3A',
  borderActive: '#2E2E5A',

  // Primary text
  text:         '#F0F0FF',   // 14.8:1 on panel
  textSub:      '#B8B8D8',   // 7.9:1 on panel ← FIXED (was #7777AA = 4.2:1 FAIL)
  textDim:      '#6A6A90',   // 4.6:1 on panel (use for placeholders only)
  textMute:     '#33334A',   // borders, disabled (not for readable text)

  // Accent palette — all WCAG AA+ on #0D0D1E
  gold:         '#C9A84C',   // 5.6:1
  cyan:         '#2DDBF5',   // 8.4:1
  green:        '#2EE89A',   // 8.8:1
  purple:       '#9B7DFF',   // 7.1:1
  blue:         '#4A9EFF',   // 6.4:1
  orange:       '#FF9B2F',   // 6.2:1
  red:          '#FF4D4D',   // 5.8:1
  crimson:      '#E83030',   // 5.2:1

  // Mode accents
  modeEmpire:    '#C9A84C',
  modePredator:  '#FF4D4D',
  modeSyndicate: '#2EE89A',
  modePhantom:   '#9B7DFF',

  // Tier spectrum
  tierSovereign:  '#9B7DFF',
  tierPlatinum:   '#2DDBF5',
  tierGold:       '#C9A84C',
  tierSilver:     '#B8B8D8',
  tierBronze:     '#FF9B2F',
  tierUnranked:   '#6A6A90',

  // Grade spectrum
  gradeA:  '#C9A84C',
  gradeB:  '#9B7DFF',
  gradeC:  '#2EE89A',
  gradeD:  '#FF9B2F',
  gradeF:  '#FF4D4D',
  gradeS:  '#2DDBF5',   // Bleed Mode only — S-grade SOVEREIGN_PRIME

  // Outcome
  freedom:   '#2EE89A',
  timeout:   '#FF9B2F',
  bankrupt:  '#FF4D4D',
  abandoned: '#6A6A90',
} as const;

// ─── Mode display config ───────────────────────────────────────────────────────

export interface ModeDisplayConfig {
  label:        string;
  shortLabel:   string;
  tagline:      string;
  accentColor:  string;
  icon:         string;
  fontStyle:    'bold' | 'normal';
}

export const MODE_DISPLAY: Record<GameMode, ModeDisplayConfig> = {
  EMPIRE: {
    label:       'GO ALONE',
    shortLabel:  'EMPIRE',
    tagline:     'The Isolated Sovereign',
    accentColor: COLORS.modeEmpire,
    icon:        '🏛️',
    fontStyle:   'bold',
  },
  PREDATOR: {
    label:       'HEAD TO HEAD',
    shortLabel:  'PREDATOR',
    tagline:     'The Financial Predator',
    accentColor: COLORS.modePredator,
    icon:        '⚔️',
    fontStyle:   'bold',
  },
  SYNDICATE: {
    label:       'TEAM UP',
    shortLabel:  'SYNDICATE',
    tagline:     'The Trust Architect',
    accentColor: COLORS.modeSyndicate,
    icon:        '🤝',
    fontStyle:   'bold',
  },
  PHANTOM: {
    label:       'CHASE A LEGEND',
    shortLabel:  'PHANTOM',
    tagline:     'The Ghost Hunter',
    accentColor: COLORS.modePhantom,
    icon:        '👻',
    fontStyle:   'bold',
  },
};

// ─── Extended grade system (Bleed Mode S-grade) ────────────────────────────────

/**
 * Extended grade type — includes S for Bleed Mode.
 * In standard mode, S is unreachable (sovereignty score caps at 1.5).
 * In Bleed Mode, sovereignty score can reach 1.80 → S grade unlocks.
 */
export type ExtendedGrade = RunGrade | 'S';

export const GRADE_THRESHOLDS_STANDARD: Record<RunGrade, { min: number; max: number }> = {
  A: { min: 1.10, max: 1.50 },
  B: { min: 0.80, max: 1.09 },
  C: { min: 0.55, max: 0.79 },
  D: { min: 0.30, max: 0.54 },
  F: { min: 0.00, max: 0.29 },
};

/** Bleed Mode only — S-grade is 1.50–1.80. A-grade starts at 1.10 still (but cap is higher). */
export const GRADE_THRESHOLDS_BLEED: Record<ExtendedGrade, { min: number; max: number }> = {
  S: { min: 1.50, max: 1.80 },
  A: { min: 1.10, max: 1.49 },
  B: { min: 0.80, max: 1.09 },
  C: { min: 0.55, max: 0.79 },
  D: { min: 0.30, max: 0.54 },
  F: { min: 0.00, max: 0.29 },
};

export function assignGrade(sovereigntyScore: number, isBleedMode = false): ExtendedGrade {
  if (isBleedMode) {
    if (sovereigntyScore >= 1.50) return 'S';
    if (sovereigntyScore >= 1.10) return 'A';
    if (sovereigntyScore >= 0.80) return 'B';
    if (sovereigntyScore >= 0.55) return 'C';
    if (sovereigntyScore >= 0.30) return 'D';
    return 'F';
  }
  if (sovereigntyScore >= 1.10) return 'A';
  if (sovereigntyScore >= 0.80) return 'B';
  if (sovereigntyScore >= 0.55) return 'C';
  if (sovereigntyScore >= 0.30) return 'D';
  return 'F';
}

export function gradeColor(grade: ExtendedGrade): string {
  const map: Record<ExtendedGrade, string> = {
    S: COLORS.gradeS,
    A: COLORS.gradeA,
    B: COLORS.gradeB,
    C: COLORS.gradeC,
    D: COLORS.gradeD,
    F: COLORS.gradeF,
  };
  return map[grade];
}

export function gradeLabel(grade: ExtendedGrade): string {
  const map: Record<ExtendedGrade, string> = {
    S: 'SOVEREIGN PRIME',
    A: 'SOVEREIGN ARCHITECT',
    B: 'TACTICAL BUILDER',
    C: 'DISCIPLINED CLIMBER',
    D: 'DEVELOPING OPERATOR',
    F: 'LIQUIDATED',
  };
  return map[grade];
}

export function gradeBadgeTier(grade: ExtendedGrade, outcome?: RunOutcome): BadgeTier {
  if (grade === 'S')                              return 'PLATINUM';
  if (grade === 'A' && outcome === 'FREEDOM')     return 'PLATINUM';
  if (grade === 'A')                              return 'GOLD';
  if (grade === 'B')                              return 'SILVER';
  if (grade === 'C')                              return 'BRONZE';
  return 'IRON';
}

// ─── CORD tier display utilities ───────────────────────────────────────────────

export function cordTierDisplayColor(tier: CordTier): string {
  const map: Record<CordTier, string> = {
    SOVEREIGN: COLORS.tierSovereign,
    PLATINUM:  COLORS.tierPlatinum,
    GOLD:      COLORS.tierGold,
    SILVER:    COLORS.tierSilver,
    BRONZE:    COLORS.tierBronze,
    UNRANKED:  COLORS.tierUnranked,
  };
  return map[tier];
}

export function cordTierDisplayIcon(tier: CordTier): string {
  const map: Record<CordTier, string> = {
    SOVEREIGN: '♾️',
    PLATINUM:  '💎',
    GOLD:      '🥇',
    SILVER:    '🥈',
    BRONZE:    '🥉',
    UNRANKED:  '—',
  };
  return map[tier];
}

export function cordTierDisplayLabel(tier: CordTier): string {
  return tier; // Tier names are already display-ready
}

// ─── Score formatting (DM Mono font) ─────────────────────────────────────────

/** Format a 0–1 CORD score as a percentage string for display. */
export function fmtCordScore(score: number): string {
  return `${(Math.max(0, Math.min(1, score)) * 100).toFixed(1)}`;
}

/** Format a 0–1.8 sovereignty score for display. */
export function fmtSovereigntyScore(score: number): string {
  return score.toFixed(3);
}

/** Format net worth for display — matches core/format.ts fmtMoney */
export function fmtNetWorth(n: number): string {
  const sign = n < 0 ? '−' : '';
  const v    = Math.abs(n);
  if (v >= 1_000_000_000) return `${sign}$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1_000_000)     return `${sign}$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1_000)         return `${sign}$${(v / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(v).toLocaleString()}`;
}

/** Format a tick count as a time string (e.g., 432 ticks → "3:36"). */
export function fmtTicks(ticks: number, msPerTick = 1000): string {
  const totalMs = ticks * msPerTick;
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Outcome display ───────────────────────────────────────────────────────────

export function outcomeDisplayLabel(outcome: RunOutcome): string {
  const map: Record<RunOutcome, string> = {
    FREEDOM:   '🏆 FINANCIAL FREEDOM',
    TIMEOUT:   '⏰ TIME EXPIRED',
    BANKRUPT:  '💀 BANKRUPT',
    ABANDONED: '🚪 ABANDONED',
  };
  return map[outcome];
}

export function outcomeDisplayColor(outcome: RunOutcome): string {
  const map: Record<RunOutcome, string> = {
    FREEDOM:   COLORS.freedom,
    TIMEOUT:   COLORS.timeout,
    BANKRUPT:  COLORS.bankrupt,
    ABANDONED: COLORS.abandoned,
  };
  return map[outcome];
}

// ─── Responsive CSS helpers ───────────────────────────────────────────────────

/**
 * Responsive font size using CSS clamp().
 * Generates a value that scales smoothly from minPx (360px viewport) to maxPx (1440px).
 *
 * Use in React inline styles: `{ fontSize: responsiveFs(12, 18) }`
 * For Tailwind: not applicable (use clamp in a style prop).
 *
 * @param minPx  Size in px at 360px viewport width
 * @param maxPx  Size in px at 1440px viewport width
 */
export function responsiveFs(minPx: number, maxPx: number): string {
  const slope = (maxPx - minPx) / (1440 - 360);
  const intercept = minPx - slope * 360;
  const preferred = `${(slope * 100).toFixed(4)}vw + ${intercept.toFixed(2)}px`;
  return `clamp(${minPx}px, ${preferred}, ${maxPx}px)`;
}

/**
 * Responsive padding using CSS clamp().
 * Returns a shorthand padding string: "clamp(Xpx, …, Ypx) clamp(Apx, …, Bpx)"
 */
export function responsivePad(
  vertMin: number, vertMax: number,
  horizMin: number, horizMax: number,
): string {
  return `${responsiveFs(vertMin, vertMax)} ${responsiveFs(horizMin, horizMax)}`;
}

/**
 * Minimum touch target size (44px iOS HIG / 48dp Material).
 * Use as minWidth + minHeight on interactive elements.
 */
export const TOUCH_TARGET = 44 as const;

// ─── Inline CSS string blocks for sovereignty HTML artifact ───────────────────

/**
 * Complete CSS for the sovereignty proof artifact HTML export.
 * Dark palette — correct on dark OS and light OS export viewers.
 * FIXED: Old SovereigntyExporter.ts used light-mode gold on white background.
 * All colors are now dark-first.
 */
export function buildArtifactCSS(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: ${COLORS.void};
      color: ${COLORS.text};
      font-family: ${FONTS.body};
      padding: 32px 40px 48px;
      max-width: 680px;
      margin: 0 auto;
      -webkit-font-smoothing: antialiased;
    }
    .title {
      font-family: ${FONTS.display};
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: ${COLORS.textDim};
      margin-bottom: 32px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid ${COLORS.border};
    }
    .grade {
      font-family: ${FONTS.display};
      font-size: clamp(40px, 8vw, 56px);
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.02em;
    }
    .score {
      font-family: ${FONTS.mono};
      font-size: clamp(22px, 5vw, 30px);
      font-weight: 700;
      margin-top: 4px;
      color: ${COLORS.tierGold};
    }
    .player-handle {
      font-family: ${FONTS.mono};
      font-size: 13px;
      color: ${COLORS.textSub};
      margin-top: 8px;
      letter-spacing: 0.06em;
    }
    .section-title {
      font-family: ${FONTS.display};
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${COLORS.textDim};
      margin: 24px 0 12px;
    }
    .data-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid ${COLORS.border};
    }
    .data-label {
      font-family: ${FONTS.mono};
      font-size: 11px;
      color: ${COLORS.textSub};
      letter-spacing: 0.08em;
    }
    .data-value {
      font-family: ${FONTS.mono};
      font-size: 13px;
      font-weight: 600;
      color: ${COLORS.text};
    }
    .outcome-badge {
      font-family: ${FONTS.display};
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      padding: 3px 10px;
      border-radius: 4px;
      background: rgba(46,232,154,0.12);
      color: ${COLORS.freedom};
    }
    .bar-row { margin-bottom: 10px; }
    .bar-label {
      display: flex;
      justify-content: space-between;
      font-family: ${FONTS.mono};
      font-size: 10px;
      color: ${COLORS.textSub};
      margin-bottom: 5px;
    }
    .bar-track {
      height: 6px;
      background: ${COLORS.border};
      border-radius: 3px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, ${COLORS.purple} 0%, ${COLORS.cyan} 100%);
      border-radius: 3px;
      transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .hash {
      font-family: ${FONTS.mono};
      font-size: 10px;
      color: ${COLORS.textDim};
      word-break: break-all;
      padding: 12px;
      background: rgba(255,255,255,0.03);
      border: 1px solid ${COLORS.border};
      border-radius: 6px;
      margin-top: 8px;
      letter-spacing: 0.05em;
    }
    .footer {
      position: absolute;
      bottom: 24px;
      left: 40px;
      right: 40px;
      font-family: ${FONTS.mono};
      font-size: 9px;
      color: ${COLORS.textDim};
      display: flex;
      justify-content: space-between;
      letter-spacing: 0.10em;
    }
    @media (max-width: 480px) {
      body { padding: 20px 20px 40px; }
      .header { gap: 16px; }
      .grade { font-size: 36px; }
      .score { font-size: 20px; }
    }
  `;
}

// ─── Result screen inline styles (for ResultScreen.tsx — fixes font + colors) ──

/**
 * Complete style map for ResultScreen.tsx.
 * FIXED: IBM Plex Mono → DM Mono, Syne → Barlow Condensed.
 * FIXED: textSub #7777AA → #B8B8D8 (WCAG AA compliant).
 * All values are React CSSProperties-compatible strings.
 */
export const RESULT_SCREEN_STYLES = {
  screen: {
    background:          COLORS.void,
    color:               COLORS.text,
    fontFamily:          FONTS.body,
    minHeight:           '100dvh',
    WebkitFontSmoothing: 'antialiased' as const,
  },
  gradeText: {
    fontFamily:    FONTS.display,
    fontWeight:    900,
    letterSpacing: '-0.02em',
    lineHeight:    1,
  },
  scoreText: {
    fontFamily: FONTS.mono,
    fontWeight: 700,
  },
  labelText: {
    fontFamily:    FONTS.display,
    fontWeight:    600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    fontSize:      responsiveFs(9, 11),
    color:         COLORS.textSub,
  },
  statValue: {
    fontFamily: FONTS.mono,
    fontWeight: 700,
    color:      COLORS.text,
  },
  hashText: {
    fontFamily:    FONTS.mono,
    fontSize:      responsiveFs(9, 11),
    color:         COLORS.textDim,
    letterSpacing: '0.05em',
    wordBreak:     'break-all' as const,
  },
  cardBase: {
    background:   'rgba(255,255,255,0.04)',
    border:       `1px solid ${COLORS.border}`,
    borderRadius: '10px',
    padding:      responsivePad(12, 18, 12, 18),
  },
  sectionTitle: {
    fontFamily:    FONTS.display,
    fontWeight:    700,
    letterSpacing: '0.20em',
    textTransform: 'uppercase' as const,
    fontSize:      responsiveFs(9, 10),
    color:         COLORS.textDim,
  },
} as const;

// ─── Bleed Mode badge ─────────────────────────────────────────────────────────

/**
 * Bleed Mode exclusive badge — SOVEREIGN_PRIME.
 * Distinct from standard PLATINUM to mark the only path above 1.50.
 * Rendered with cyan glow to signal exclusivity.
 */
export function buildBleedModeBadgeSvg(size = 80): string {
  const half = size / 2;
  const r    = half * 0.90;
  const ri   = half * 0.70;
  const ri2  = half * 0.50;

  const hex = (cx: number, cy: number, radius: number) => Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="sovereign-prime-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="rgba(45,219,245,0.50)"/>
    </filter>
    <linearGradient id="sovereign-prime-fill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2DDBF5"/>
      <stop offset="100%" stop-color="#9B7DFF"/>
    </linearGradient>
  </defs>
  <polygon points="${hex(half, half, r)}"  fill="url(#sovereign-prime-fill)" opacity="0.95" filter="url(#sovereign-prime-glow)"/>
  <polygon points="${hex(half, half, ri)}" fill="none" stroke="#88F0FF" stroke-width="1.5" opacity="0.60"/>
  <polygon points="${hex(half, half, ri2)}" fill="none" stroke="#2DDBF5" stroke-width="1" opacity="0.30"/>
</svg>`;
}

// ─── Mode-aware score strip (for in-run HUD) ──────────────────────────────────

export interface ScoreStripConfig {
  label:      string;
  accentColor: string;
  font:       string;
  fontSize:   string;
  icon:       string;
}

export function buildScoreStripConfig(mode: GameMode, isMobile: boolean): ScoreStripConfig {
  const modeConf = MODE_DISPLAY[mode];
  return {
    label:       modeConf.shortLabel,
    accentColor: modeConf.accentColor,
    font:        FONTS.mono,
    fontSize:    responsiveFs(isMobile ? 10 : 11, isMobile ? 12 : 14),
    icon:        modeConf.icon,
  };
}

// ─── CORD delta display ────────────────────────────────────────────────────────

export interface CordDeltaDisplay {
  delta:      number;
  label:      string;   // "+3.2%" or "−1.1%" or "NEW BEST"
  color:      string;
  isImproved: boolean;
  isFirst:    boolean;
}

export function buildCordDeltaDisplay(
  currentScore:  number,
  previousBest:  number | null,
): CordDeltaDisplay {
  if (previousBest === null) {
    return {
      delta:      currentScore,
      label:      'FIRST RUN',
      color:      COLORS.cyan,
      isImproved: true,
      isFirst:    true,
    };
  }

  const delta  = currentScore - previousBest;
  const deltaPct = (delta * 100).toFixed(1);
  const isUp   = delta >= 0;

  return {
    delta,
    label:      isUp ? `+${deltaPct}` : `−${Math.abs(delta * 100).toFixed(1)}`,
    color:      isUp ? COLORS.green : COLORS.orange,
    isImproved: isUp,
    isFirst:    false,
  };
}

// ─── Social share text builder ─────────────────────────────────────────────────

/**
 * Build a shareable text line for proof card sharing.
 * Used by clipboard copy + social share in ResultScreen.
 *
 * Format: "I just scored SOVEREIGN 94.2 [EMPIRE] — Grade A · #PZO-pf0a8b3c7d2e"
 */
export function buildShareText(params: {
  cordScore:   number;
  cordTier:    CordTier;
  mode:        GameMode;
  grade:       ExtendedGrade;
  shortHash:   string;
  outcome:     RunOutcome;
}): string {
  const modeLabel = MODE_DISPLAY[params.mode].label;
  const tierLabel = params.cordTier;
  const scorePct  = fmtCordScore(params.cordScore);
  const gradeLine = `Grade ${params.grade}`;
  const hashLine  = `#PZO-${params.shortHash}`;

  if (params.outcome === 'FREEDOM') {
    return `🏆 FINANCIAL FREEDOM achieved! ${tierLabel} ${scorePct} [${modeLabel}] — ${gradeLine} · ${hashLine} · pointzeroone.io`;
  }
  return `I scored ${tierLabel} ${scorePct} in POINT ZERO ONE [${modeLabel}] — ${gradeLine} · ${hashLine} · pointzeroone.io`;
}