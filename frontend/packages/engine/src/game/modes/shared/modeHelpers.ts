// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SHARED MODE HELPERS
// modes/shared/modeHelpers.ts
// Sprint 4 — Cross-mode utility functions and metadata
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { C } from './designTokens';

export type GameMode = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

// ── Mode metadata registry ────────────────────────────────────────────────────

export interface ModeConfig {
  label:         string;
  shortLabel:    string;
  icon:          string;
  description:   string;
  tagline:       string;
  accent:        string;
  teamSize:      number;          // 1=solo, 2=duo, 2=vs
  requiresOpponent: boolean;
  winCondition:  string;
  loseCondition: string;
  uniqueMechanics: string[];
}

export const GAME_MODE_CONFIG: Record<GameMode, ModeConfig> = {
  EMPIRE: {
    label:           'Empire',
    shortLabel:      'SOLO',
    icon:            '👑',
    description:     'GO ALONE. Build passive income past expenses before 5 adversarial systems break you.',
    tagline:         'The Liquidator is watching.',
    accent:          C.gold,
    teamSize:        1,
    requiresOpponent: false,
    winCondition:    'Income > Expenses before tick 720',
    loseCondition:   'Cash depletes to $0 (BANKRUPT)',
    uniqueMechanics: ['5-Wave Bot Escalation', 'Bleed Mode', 'Isolation Tax', 'Pressure Journal', 'Comeback Surge'],
  },
  PREDATOR: {
    label:           'Predator',
    shortLabel:      'PVP',
    icon:            '⚔️',
    description:     'HEAD-TO-HEAD. One builds. One attacks. Counterplay windows. Battle budget. Psychological pressure.',
    tagline:         'Survive the extraction.',
    accent:          C.red,
    teamSize:        2,
    requiresOpponent: true,
    winCondition:    'Builder: survive 720 ticks | Hater: bankrupt the Builder',
    loseCondition:   'Builder: bankrupt | Hater: Builder escapes',
    uniqueMechanics: ['Extraction Arsenal', 'Battle Budget', 'Counterplay Windows', 'Psyche Meter', 'Rivalry System'],
  },
  SYNDICATE: {
    label:           'Syndicate',
    shortLabel:      'CO-OP',
    icon:            '🤝',
    description:     'TEAM UP. Shared economic reality. Trust-based transfers. Both must survive to win.',
    tagline:         'Trust or be betrayed.',
    accent:          C.teal,
    teamSize:        2,
    requiresOpponent: false,
    winCondition:    'BOTH players: income > expenses at tick 720',
    loseCondition:   'Either player bankrupts — both lose',
    uniqueMechanics: ['Trust Score System', 'AID Contracts', 'Rescue Windows', 'Defection Sequence', 'Shared Treasury'],
  },
  PHANTOM: {
    label:           'Phantom',
    shortLabel:      'GHOST',
    icon:            '👻',
    description:     'CHASE A LEGEND. Race the verified champion who ran this exact seed before you.',
    tagline:         'Same seed. Different fate.',
    accent:          C.purple,
    teamSize:        1,
    requiresOpponent: false,
    winCondition:    'Beat the legend\'s final net worth',
    loseCondition:   'Fall too far behind or bankrupt',
    uniqueMechanics: ['Ghost Replay Engine', 'Gap Indicator', 'Legend Decay', 'Dynasty Challenge Stack', 'Proof Badge'],
  },
};

// ── Mode utility functions ────────────────────────────────────────────────────

export function getModeLabel(mode: GameMode): string {
  return GAME_MODE_CONFIG[mode].label;
}

export function getModeAccent(mode: GameMode): string {
  return GAME_MODE_CONFIG[mode].accent;
}

export function getModeIcon(mode: GameMode): string {
  return GAME_MODE_CONFIG[mode].icon;
}

export function getModeDescription(mode: GameMode): string {
  return GAME_MODE_CONFIG[mode].description;
}

export function modeRequiresOpponent(mode: GameMode): boolean {
  return GAME_MODE_CONFIG[mode].requiresOpponent;
}

export function getModeTagline(mode: GameMode): string {
  return GAME_MODE_CONFIG[mode].tagline;
}

export function getModeTeamSize(mode: GameMode): number {
  return GAME_MODE_CONFIG[mode].teamSize;
}

export function getAllModes(): GameMode[] {
  return ['EMPIRE', 'PREDATOR', 'SYNDICATE', 'PHANTOM'];
}

export function getModeUniqueMechanics(mode: GameMode): string[] {
  return GAME_MODE_CONFIG[mode].uniqueMechanics;
}

// ── Mode formatting ───────────────────────────────────────────────────────────

export function formatModeChip(mode: GameMode): string {
  const cfg = GAME_MODE_CONFIG[mode];
  return `${cfg.icon} ${cfg.shortLabel}`;
}

export function formatModeWinCondition(mode: GameMode): string {
  return GAME_MODE_CONFIG[mode].winCondition;
}

// ── CORD contribution weights per mode ───────────────────────────────────────

export interface ModeCordWeights {
  decisionQuality:     number;
  pressureResilience:  number;
  consistency:         number;
  modeSpecific:        number;
}

export const MODE_CORD_WEIGHTS: Record<GameMode, ModeCordWeights> = {
  EMPIRE: {
    decisionQuality:    0.40,
    pressureResilience: 0.35,
    consistency:        0.25,
    modeSpecific:       0.00,   // isolation tax burden → included in pressureResilience
  },
  PREDATOR: {
    decisionQuality:    0.30,
    pressureResilience: 0.20,
    consistency:        0.20,
    modeSpecific:       0.30,   // extraction efficiency + rivalry tier
  },
  SYNDICATE: {
    decisionQuality:    0.25,
    pressureResilience: 0.20,
    consistency:        0.20,
    modeSpecific:       0.35,   // trust finality + cooperation + integrity
  },
  PHANTOM: {
    decisionQuality:    0.35,
    pressureResilience: 0.20,
    consistency:        0.20,
    modeSpecific:       0.25,   // gap delta + divergence score
  },
};

// ── Mode color helpers ────────────────────────────────────────────────────────

export function getModeAccentDim(mode: GameMode): string {
  const accents: Record<GameMode, string> = {
    EMPIRE:    'rgba(201,168,76,0.10)',
    PREDATOR:  'rgba(255,77,77,0.10)',
    SYNDICATE: 'rgba(0,201,167,0.10)',
    PHANTOM:   'rgba(155,125,255,0.10)',
  };
  return accents[mode];
}

export function getModeAccentBrd(mode: GameMode): string {
  const borders: Record<GameMode, string> = {
    EMPIRE:    'rgba(201,168,76,0.28)',
    PREDATOR:  'rgba(255,77,77,0.28)',
    SYNDICATE: 'rgba(0,201,167,0.28)',
    PHANTOM:   'rgba(155,125,255,0.28)',
  };
  return borders[mode];
}

// ── Mode-specific event log colors ───────────────────────────────────────────

export function getModeLogColor(mode: GameMode): string {
  return getModeAccent(mode);
}

// ── Phase label helpers (cross-mode) ─────────────────────────────────────────

export function getModePhaseLabel(mode: GameMode, tick: number, totalTicks: number): string {
  const progress = tick / totalTicks;
  if (mode === 'EMPIRE') {
    if (tick < 144)  return 'AWAKENING';
    if (tick < 288)  return 'RESISTANCE';
    if (tick < 432)  return 'SIEGE';
    if (tick < 576)  return 'RECKONING';
    return 'ANNIHILATION';
  }
  if (mode === 'PREDATOR') {
    if (tick < 240)  return 'EARLY';
    if (tick < 480)  return 'MID';
    return 'ENDGAME';
  }
  if (mode === 'PHANTOM') {
    if (progress < 0.15) return 'OPENING';
    if (progress < 0.6)  return 'CHASE';
    if (progress < 0.85) return 'CRITICAL';
    return 'FINALE';
  }
  return 'IN PROGRESS'; // SYNDICATE has no phases
}

export function getModePhaseAccent(mode: GameMode, phase: string): string {
  const table: Record<string, Record<string, string>> = {
    EMPIRE: {
      AWAKENING:    C.gold,
      RESISTANCE:   C.orange,
      SIEGE:        '#FF6200',
      RECKONING:    '#FF3800',
      ANNIHILATION: C.crimson,
    },
    PREDATOR: {
      EARLY:   C.red,
      MID:     '#FF2222',
      ENDGAME: C.crimson,
    },
    PHANTOM: {
      OPENING:  C.purple,
      CHASE:    '#B08AFF',
      CRITICAL: C.orange,
      FINALE:   C.gold,
    },
  };
  return table[mode]?.[phase] ?? getModeAccent(mode);
}