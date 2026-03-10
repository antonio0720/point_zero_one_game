// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — MODE-SPECIFIC EVENT TYPES
// modes/shared/modeEventTypes.ts
// Sprint 4 — EventBus event names + payload contracts for all 4 modes
//
// These events travel on globalEventBus (core/EventBus).
// ModeEventBridge translates mode-specific events to zero/EventBus as needed.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

// ── EMPIRE MODE EVENTS ────────────────────────────────────────────────────────

export const EMPIRE_EVENTS = {
  BLEED_ACTIVATED:     'EMPIRE_BLEED_ACTIVATED',
  BLEED_RESOLVED:      'EMPIRE_BLEED_RESOLVED',
  BLEED_ESCALATED:     'EMPIRE_BLEED_ESCALATED',
  COMEBACK_SURGE:      'EMPIRE_COMEBACK_SURGE',
  ISOLATION_TAX_HIT:   'EMPIRE_ISOLATION_TAX_HIT',
  PHASE_CHANGED:       'EMPIRE_PHASE_CHANGED',
  CASE_FILE_READY:     'EMPIRE_CASE_FILE_READY',
} as const;

export interface EmpireBleedActivatedPayload {
  tick:          number;
  severity:      'WATCH' | 'CRITICAL' | 'TERMINAL';
  cash:          number;
  cashflow:      number;
  activationNo:  number;  // how many times activated this run
}

export interface EmpireBleedResolvedPayload {
  tick:          number;
  bleedDuration: number;  // ticks spent in bleed
  peakSeverity:  string;
}

export interface EmpireBleedEscalatedPayload {
  tick:         number;
  from:         string;
  to:           'CRITICAL' | 'TERMINAL';
}

export interface EmpireComebackSurgePayload {
  tick:        number;
  cardId:      string;
  cardTitle:   string;
  incomeDelta: number;
  xpGained:   number;
}

export interface EmpireIsolationTaxHitPayload {
  tick:          number;
  taxAmount:     number;
  effectiveRate: number;
  totalPaid:     number;
  label:         string;
}

export interface EmpirePhaseChangedPayload {
  tick:  number;
  from:  string;
  to:    string;
  wave:  number;
  bots:  number;
}

export interface EmpireCaseFileReadyPayload {
  runId:    string;
  grade:    string;
  score:    number;
  summary:  Record<string, unknown>;
}

// ── PREDATOR MODE EVENTS ──────────────────────────────────────────────────────

export const PREDATOR_EVENTS = {
  EXTRACTION_FIRED:         'PREDATOR_EXTRACTION_FIRED',
  COUNTERPLAY_RESOLVED:     'PREDATOR_COUNTERPLAY_RESOLVED',
  COUNTERPLAY_EXPIRED:      'PREDATOR_COUNTERPLAY_EXPIRED',
  TILT_ACTIVATED:           'PREDATOR_TILT_ACTIVATED',
  TILT_RESOLVED:            'PREDATOR_TILT_RESOLVED',
  BB_READY:                 'PREDATOR_BB_READY',
  BB_DEPLETED:              'PREDATOR_BB_DEPLETED',
  RIVALRY_TIER_CHANGED:     'PREDATOR_RIVALRY_TIER_CHANGED',
  PHASE_CHANGED:            'PREDATOR_PHASE_CHANGED',
  DECK_CLAIMED:             'PREDATOR_DECK_CLAIMED',
  DECK_DENIED:              'PREDATOR_DECK_DENIED',
} as const;

export interface PredatorExtractionFiredPayload {
  tick:           number;
  extractionId:   string;
  type:           string;
  attackerId:     string;
  defenderId:     string;
  rawCashImpact:  number;
  bbCost:         number;
  windowTicks:    number;
}

export interface PredatorCounterplayResolvedPayload {
  tick:          number;
  windowId:      string;
  action:        string;
  outcome:       string;
  cashDelta:     number;
  psycheDelta:   number;
  bbDelta:       number;
  wasOptimal:    boolean;
}

export interface PredatorTiltActivatedPayload {
  tick:          number;
  psycheValue:   number;
  tiltCount:     number;
  drawPenalty:   number;
}

export interface PredatorTiltResolvedPayload {
  tick:        number;
  tiltTicks:   number;
}

export interface PredatorRivalryTierChangedPayload {
  opponentId:  string;
  from:        string;
  to:          string;
  amplifier:   number;
  totalWins:   number;
}

// ── SYNDICATE MODE EVENTS ─────────────────────────────────────────────────────

export const SYNDICATE_EVENTS = {
  TRUST_CRITICAL:           'SYNDICATE_TRUST_CRITICAL',
  TRUST_RESTORED:           'SYNDICATE_TRUST_RESTORED',
  RESCUE_OPENED:            'SYNDICATE_RESCUE_OPENED',
  RESCUE_FUNDED:            'SYNDICATE_RESCUE_FUNDED',
  RESCUE_FAILED:            'SYNDICATE_RESCUE_FAILED',
  DEFECTION_STEP:           'SYNDICATE_DEFECTION_STEP',
  DEFECTION_DETECTED:       'SYNDICATE_DEFECTION_DETECTED',
  DEFECTION_COMPLETED:      'SYNDICATE_DEFECTION_COMPLETED',
  AID_CONTRACT_SIGNED:      'SYNDICATE_AID_CONTRACT_SIGNED',
  AID_CONTRACT_BREACHED:    'SYNDICATE_AID_CONTRACT_BREACHED',
  AID_CONTRACT_FULFILLED:   'SYNDICATE_AID_CONTRACT_FULFILLED',
  TREASURY_CRITICAL:        'SYNDICATE_TREASURY_CRITICAL',
  SYNERGY_BONUS_CHANGED:    'SYNDICATE_SYNERGY_BONUS_CHANGED',
} as const;

export interface SyndicateTrustCriticalPayload {
  tick:         number;
  playerId:     string;
  trustValue:   number;
  leakageRate:  number;
}

export interface SyndicateRescueOpenedPayload {
  tick:            number;
  rescueId:        string;
  recipientId:     string;
  cashNeeded:      number;
  expiresAtTick:   number;
  guardianPresent: boolean;
}

export interface SyndicateRescueFundedPayload {
  tick:              number;
  rescueId:          string;
  recipientId:       string;
  totalContributed:  number;
  contributorCount:  number;
}

export interface SyndicateDefectionStepPayload {
  tick:             number;
  playerId:         string;
  step:             string;
  suspicionEmitted: number;
  sequenceProgress: number;  // 0–1
}

export interface SyndicateDefectionDetectedPayload {
  tick:         number;
  defectorId:   string;
  detectedById: string;
  step:         string;
}

export interface SyndicateAidContractSignedPayload {
  tick:             number;
  contractId:       string;
  senderId:         string;
  recipientId:      string;
  aidType:          string;
  effectiveAmount:  number;
  leakageApplied:   number;
}

// ── PHANTOM MODE EVENTS ───────────────────────────────────────────────────────

export const PHANTOM_EVENTS = {
  GHOST_LOADED:         'PHANTOM_GHOST_LOADED',
  GHOST_DELTA_UPDATE:   'PHANTOM_GHOST_DELTA_UPDATE',
  GAP_ZONE_CHANGED:     'PHANTOM_GAP_ZONE_CHANGED',
  NERVE_CARD_ELIGIBLE:  'PHANTOM_NERVE_CARD_ELIGIBLE',
  DYNASTY_PRESSURE:     'PHANTOM_DYNASTY_PRESSURE',
  LEGEND_BEATEN:        'PHANTOM_LEGEND_BEATEN',
  PROOF_BADGE_EARNED:   'PHANTOM_PROOF_BADGE_EARNED',
  AHEAD_OF_GHOST:       'PHANTOM_AHEAD_OF_GHOST',
  BEHIND_GHOST:         'PHANTOM_BEHIND_GHOST',
} as const;

export interface PhantomGhostLoadedPayload {
  tick:                 number;
  legendId:             string;
  legendDisplayName:    string;
  finalNetWorth:        number;
  finalCordScore:       number;
  decayFactor:          number;
  previouslyBeaten:     boolean;
}

export interface PhantomGhostDeltaUpdatePayload {
  tick:            number;
  netWorthGap:     number;
  netWorthGapPct:  number;
  cordGap:         number;
  isAhead:         boolean;
  pressureIntensity: number;
}

export interface PhantomGapZoneChangedPayload {
  tick:  number;
  from:  string;
  to:    string;
  gapPct: number;
}

export interface PhantomLegendBeatenPayload {
  tick:           number;
  legendId:       string;
  legendName:     string;
  finalGapPct:    number;
  proofHash:      string;
}

// ── Union types for type-safe event dispatch ──────────────────────────────────

export type ModeEventName =
  | (typeof EMPIRE_EVENTS)[keyof typeof EMPIRE_EVENTS]
  | (typeof PREDATOR_EVENTS)[keyof typeof PREDATOR_EVENTS]
  | (typeof SYNDICATE_EVENTS)[keyof typeof SYNDICATE_EVENTS]
  | (typeof PHANTOM_EVENTS)[keyof typeof PHANTOM_EVENTS];