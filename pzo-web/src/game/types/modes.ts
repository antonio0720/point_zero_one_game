// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/modes.ts
// Sprint 0: Canonical Mode Type Contracts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

// ── Canonical Mode Enum ───────────────────────────────────────────────────────
/** Four playable modes. Each activates a distinct rule engine and card adapter. */
export type GameMode = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

/** Legacy string map — bridges existing engine RunMode strings to canonical GameMode. */
export const LEGACY_MODE_MAP: Record<string, GameMode> = {
  'solo':            'EMPIRE',
  'asymmetric-pvp':  'PREDATOR',
  'co-op':           'SYNDICATE',
  'ghost':           'PHANTOM',
};

/** Reverse map for engine interop. */
export const CANONICAL_TO_LEGACY: Record<GameMode, string> = {
  'EMPIRE':    'solo',
  'PREDATOR':  'asymmetric-pvp',
  'SYNDICATE': 'co-op',
  'PHANTOM':   'ghost',
};

// ── Mode Capability Matrix ───────────────────────────────────────────────────
/** What systems are active per mode. Mirrors Game Mode Bible. */
export interface ModeCapabilityMatrix {
  mode: GameMode;
  label: string;
  // Solo / isolation mechanics
  isolationTax: boolean;
  bleedMode: boolean;
  pressureJournal: boolean;
  caseFile: boolean;
  // PvP mechanics
  sharedOpportunityDeck: boolean;
  battleBudget: boolean;
  extractionWindow: boolean;
  counterplayWindow: boolean;
  rivalryModel: boolean;
  // Co-op mechanics
  sharedTreasury: boolean;
  trustScore: boolean;
  roleAssignment: boolean;
  defectionSequence: boolean;
  trustAudit: boolean;
  // Ghost mechanics
  ghostReplay: boolean;
  gapIndicator: boolean;
  legendDecay: boolean;
  dynastyStack: boolean;
}

export const MODE_CAPABILITIES: Record<GameMode, ModeCapabilityMatrix> = {
  EMPIRE: {
    mode: 'EMPIRE', label: 'Go Alone — Isolated Sovereign',
    isolationTax: true, bleedMode: true, pressureJournal: true, caseFile: true,
    sharedOpportunityDeck: false, battleBudget: false, extractionWindow: false, counterplayWindow: false, rivalryModel: false,
    sharedTreasury: false, trustScore: false, roleAssignment: false, defectionSequence: false, trustAudit: false,
    ghostReplay: false, gapIndicator: false, legendDecay: false, dynastyStack: false,
  },
  PREDATOR: {
    mode: 'PREDATOR', label: 'Head-to-Head — Tempo Warfare',
    isolationTax: false, bleedMode: false, pressureJournal: false, caseFile: false,
    sharedOpportunityDeck: true, battleBudget: true, extractionWindow: true, counterplayWindow: true, rivalryModel: true,
    sharedTreasury: false, trustScore: false, roleAssignment: false, defectionSequence: false, trustAudit: false,
    ghostReplay: false, gapIndicator: false, legendDecay: false, dynastyStack: false,
  },
  SYNDICATE: {
    mode: 'SYNDICATE', label: 'Team Up — Cooperative Contracts',
    isolationTax: false, bleedMode: false, pressureJournal: false, caseFile: false,
    sharedOpportunityDeck: false, battleBudget: false, extractionWindow: false, counterplayWindow: false, rivalryModel: false,
    sharedTreasury: true, trustScore: true, roleAssignment: true, defectionSequence: true, trustAudit: true,
    ghostReplay: false, gapIndicator: false, legendDecay: false, dynastyStack: false,
  },
  PHANTOM: {
    mode: 'PHANTOM', label: 'Chase a Legend — Ghost Pressure',
    isolationTax: false, bleedMode: false, pressureJournal: false, caseFile: false,
    sharedOpportunityDeck: false, battleBudget: false, extractionWindow: false, counterplayWindow: false, rivalryModel: false,
    sharedTreasury: false, trustScore: false, roleAssignment: false, defectionSequence: false, trustAudit: false,
    ghostReplay: true, gapIndicator: true, legendDecay: true, dynastyStack: true,
  },
};
