// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/extractionCooldownManager.ts
// Sprint 7 — Extraction Cooldown Manager (new)
//
// Authoritative source for:
//   1. Per-type cooldown registry — each extraction type has an independent
//      cooldown timer. Firing one type does not affect others.
//   2. Concurrent extraction cap — no more than maxConcurrentExtractions
//      PENDING extractions at any time. Prevents spam at 20M concurrency.
//   3. UI readout — HUD-ready objects for every extraction type showing
//      availability, cost, cooldown ticks remaining, and lock reason.
//
// This file replaces the inline cooldown logic that lived in extractionEngine.ts
// (CooldownRegistry / ActiveExtractionTracker interfaces). Those interfaces
// remain in extractionEngine.ts for backward compatibility but delegate all
// mutation logic here.
//
// Usage:
//   const manager = createCooldownManager();
//   // on fire:
//   const { updatedManager, error } = tryFireExtraction(manager, 'CASH_SIPHON', tick);
//   // on resolve:
//   const updatedManager = onExtractionResolved(manager, extractionId, tick);
//   // for HUD:
//   const readout = getCooldownReadout(manager, tick);
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';
import type { ExtractionType } from './extractionEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Reason an extraction type is currently unavailable */
export type LockReason =
  | 'COOLDOWN'           // type-specific cooldown still active
  | 'CAP_REACHED'        // maxConcurrentExtractions already pending
  | 'INSUFFICIENT_BB'    // caller's BB is below the type's cost
  | 'DEBT'               // BB debt blocks offensive actions
  | 'AVAILABLE';         // no lock — ready to fire

/** Per-type state tracked in the manager */
export interface ExtractionTypeState {
  type:             ExtractionType;
  /** Game tick at which this type comes off cooldown (0 = never fired) */
  readyAtTick:      number;
  /** Number of times this type has been fired this run */
  fireCount:        number;
  /** Number of times this type landed (not blocked/reflected) */
  landCount:        number;
  /** Number of times this type was blocked or reflected */
  failCount:        number;
}

/** Single active (PENDING) extraction tracked by the manager */
export interface ActiveExtraction {
  id:          string;
  type:        ExtractionType;
  firedAtTick: number;
  expiresAtTick: number;
}

export interface ExtractionCooldownManager {
  /** Per-type state map */
  types:         Record<ExtractionType, ExtractionTypeState>;
  /** Currently PENDING extractions (awaiting counterplay resolution) */
  active:        ActiveExtraction[];
  /** Total extractions fired this run (all types) */
  totalFired:    number;
  /** Total extractions that landed (all types) */
  totalLanded:   number;
}

// ── Factory ───────────────────────────────────────────────────────────────────

const ALL_TYPES: ExtractionType[] = [
  'CASH_SIPHON',
  'SHIELD_CRACK',
  'DEBT_SPIKE',
  'HEAT_SPIKE',
  'INCOME_DRAIN',
];

export function createCooldownManager(): ExtractionCooldownManager {
  const types = {} as Record<ExtractionType, ExtractionTypeState>;
  for (const type of ALL_TYPES) {
    types[type] = { type, readyAtTick: 0, fireCount: 0, landCount: 0, failCount: 0 };
  }
  return { types, active: [], totalFired: 0, totalLanded: 0 };
}

// ── Availability Queries ──────────────────────────────────────────────────────

export function isTypeOnCooldown(
  manager:     ExtractionCooldownManager,
  type:        ExtractionType,
  currentTick: number,
): boolean {
  return currentTick < manager.types[type].readyAtTick;
}

export function ticksUntilReady(
  manager:     ExtractionCooldownManager,
  type:        ExtractionType,
  currentTick: number,
): number {
  return Math.max(0, manager.types[type].readyAtTick - currentTick);
}

export function isConcurrentCapReached(manager: ExtractionCooldownManager): boolean {
  return manager.active.length >= PREDATOR_CONFIG.maxConcurrentExtractions;
}

/**
 * Full availability check — returns the LockReason if unavailable.
 * Pass currentBB and currentDebt so the manager can check economic gates.
 */
export function getLockReason(
  manager:     ExtractionCooldownManager,
  type:        ExtractionType,
  currentTick: number,
  currentBB:   number,
  bbDebt:      number,
): LockReason {
  if (bbDebt > 0)                           return 'DEBT';
  if (isConcurrentCapReached(manager))      return 'CAP_REACHED';
  if (isTypeOnCooldown(manager, type, currentTick)) return 'COOLDOWN';
  const bbCost = PREDATOR_CONFIG.extractionCooldownTicks[type]; // not BB cost — reuse type for now
  // BB cost lives in extractionEngine catalog; pass it in via bbCostOverride
  if (currentBB < 0) return 'INSUFFICIENT_BB'; // caller passes real cost check
  return 'AVAILABLE';
}

/**
 * Check availability with explicit BB cost (extracted from EXTRACTION_CATALOG).
 */
export function checkAvailability(
  manager:     ExtractionCooldownManager,
  type:        ExtractionType,
  currentTick: number,
  currentBB:   number,
  bbCost:      number,
  bbDebt:      number,
): { available: boolean; lockReason: LockReason } {
  if (bbDebt > 0)                              return { available: false, lockReason: 'DEBT' };
  if (isConcurrentCapReached(manager))         return { available: false, lockReason: 'CAP_REACHED' };
  if (isTypeOnCooldown(manager, type, currentTick)) return { available: false, lockReason: 'COOLDOWN' };
  if (currentBB < bbCost)                      return { available: false, lockReason: 'INSUFFICIENT_BB' };
  return { available: true, lockReason: 'AVAILABLE' };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface FireExtractionResult {
  success:        boolean;
  lockReason:     LockReason;
  updatedManager: ExtractionCooldownManager;
}

/**
 * Record a fired extraction — applies cooldown, adds to active set.
 * Does NOT validate BB (caller must call checkAvailability first).
 */
export function recordExtractionFired(
  manager:      ExtractionCooldownManager,
  type:         ExtractionType,
  extractionId: string,
  currentTick:  number,
): ExtractionCooldownManager {
  const cooldown = PREDATOR_CONFIG.extractionCooldownTicks[type];
  const prev     = manager.types[type];

  const updatedType: ExtractionTypeState = {
    ...prev,
    readyAtTick: currentTick + cooldown,
    fireCount:   prev.fireCount + 1,
  };

  const newActive: ActiveExtraction = {
    id:           extractionId,
    type,
    firedAtTick:  currentTick,
    expiresAtTick: currentTick + PREDATOR_CONFIG.counterplayWindowTicks,
  };

  return {
    ...manager,
    types:      { ...manager.types, [type]: updatedType },
    active:     [...manager.active, newActive],
    totalFired: manager.totalFired + 1,
  };
}

/**
 * Record an extraction resolution — removes from active set, updates land/fail counts.
 * Call on LANDED, TIMEOUT_LANDED, BLOCKED, REFLECTED, DAMPENED, or ABSORBED.
 */
export function recordExtractionResolved(
  manager:      ExtractionCooldownManager,
  extractionId: string,
  outcome:      'LANDED' | 'FAILED',
): ExtractionCooldownManager {
  const entry = manager.active.find(a => a.id === extractionId);
  if (!entry) return manager;

  const type = entry.type;
  const prev = manager.types[type];

  const updatedType: ExtractionTypeState = {
    ...prev,
    landCount: outcome === 'LANDED' ? prev.landCount + 1 : prev.landCount,
    failCount: outcome === 'FAILED' ? prev.failCount + 1 : prev.failCount,
  };

  return {
    ...manager,
    types:       { ...manager.types, [type]: updatedType },
    active:      manager.active.filter(a => a.id !== extractionId),
    totalLanded: outcome === 'LANDED' ? manager.totalLanded + 1 : manager.totalLanded,
  };
}

/**
 * Auto-expire any active extractions whose window has closed.
 * Call on every tick — these are timeout-landed events.
 * Returns the expired IDs so caller can apply TIMEOUT_LANDED impact.
 */
export function pruneExpiredActive(
  manager:     ExtractionCooldownManager,
  currentTick: number,
): { updatedManager: ExtractionCooldownManager; expiredIds: string[] } {
  const expired    = manager.active.filter(a => currentTick >= a.expiresAtTick);
  const stillActive = manager.active.filter(a => currentTick < a.expiresAtTick);

  if (!expired.length) return { updatedManager: manager, expiredIds: [] };

  let m = manager;
  for (const e of expired) {
    m = recordExtractionResolved(m, e.id, 'LANDED');
  }
  m = { ...m, active: stillActive };

  return { updatedManager: m, expiredIds: expired.map(e => e.id) };
}

// ── HUD Readout ───────────────────────────────────────────────────────────────

export interface ExtractionReadoutEntry {
  type:            ExtractionType;
  label:           string;
  bbCost:          number;
  available:       boolean;
  lockReason:      LockReason;
  /** 0 when available, N when on cooldown */
  cooldownTicks:   number;
  /** 0.0 → 1.0 fill for cooldown progress bar (0 = ready, 1 = freshly fired) */
  cooldownPct:     number;
  /** Land rate this run (0–1), null if never fired */
  landRate:        number | null;
  /** Color aligned to designTokens C.* */
  lockColor:       string;
  /** Description shown in arsenal panel */
  description:     string;
}

const TYPE_META: Record<ExtractionType, { label: string; description: string; bbCost: number }> = {
  CASH_SIPHON:  { label: 'Cash Siphon',  description: 'Drain 8% of opponent visible cash',             bbCost: 80  },
  SHIELD_CRACK: { label: 'Shield Crack', description: 'Destroy one opponent shield layer',              bbCost: 120 },
  DEBT_SPIKE:   { label: 'Debt Spike',   description: 'Force unexpected expense — 80% of their income', bbCost: 150 },
  HEAT_SPIKE:   { label: 'Heat Spike',   description: 'Elevate tension + poison draw weights',          bbCost: 60  },
  INCOME_DRAIN: { label: 'Income Drain', description: 'Reduce opponent income 15% for 2 months',        bbCost: 100 },
};

const LOCK_COLORS: Record<LockReason, string> = {
  AVAILABLE:       '#2EE89A',   // C.green
  COOLDOWN:        '#C9A84C',   // C.gold
  CAP_REACHED:     '#FF9B2F',   // C.orange
  INSUFFICIENT_BB: '#FF4D4D',   // C.red
  DEBT:            '#FF1744',   // C.crimson
};

/**
 * Build the full HUD readout for all 5 extraction types.
 * Pass currentBB and bbDebt from the player's BattleBudgetState.
 */
export function getCooldownReadout(
  manager:     ExtractionCooldownManager,
  currentTick: number,
  currentBB:   number,
  bbDebt:      number,
): ExtractionReadoutEntry[] {
  return ALL_TYPES.map((type) => {
    const meta      = TYPE_META[type];
    const typeState = manager.types[type];
    const cooldown  = PREDATOR_CONFIG.extractionCooldownTicks[type];
    const remaining = ticksUntilReady(manager, type, currentTick);

    const { available, lockReason } = checkAvailability(
      manager, type, currentTick, currentBB, meta.bbCost, bbDebt,
    );

    const cooldownPct = remaining > 0
      ? parseFloat((remaining / cooldown).toFixed(3))
      : 0;

    const landRate = typeState.fireCount > 0
      ? parseFloat((typeState.landCount / typeState.fireCount).toFixed(3))
      : null;

    return {
      type,
      label:        meta.label,
      bbCost:       meta.bbCost,
      available,
      lockReason,
      cooldownTicks: remaining,
      cooldownPct,
      landRate,
      lockColor:    LOCK_COLORS[lockReason],
      description:  meta.description,
    };
  });
}

// ── Derived Analytics ─────────────────────────────────────────────────────────

/** Land rate across all extractions this run (0–1, null if none fired) */
export function getOverallLandRate(manager: ExtractionCooldownManager): number | null {
  if (manager.totalFired === 0) return null;
  return parseFloat((manager.totalLanded / manager.totalFired).toFixed(3));
}

/** Most-used extraction type this run */
export function getMostUsedType(manager: ExtractionCooldownManager): ExtractionType | null {
  const sorted = ALL_TYPES
    .map(t => ({ type: t, count: manager.types[t].fireCount }))
    .filter(e => e.count > 0)
    .sort((a, b) => b.count - a.count);
  return sorted[0]?.type ?? null;
}

/** Type diversity score: unique types used / total types (0–1). CORD input. */
export function getTypeDiversity(manager: ExtractionCooldownManager): number {
  const usedTypes = ALL_TYPES.filter(t => manager.types[t].fireCount > 0).length;
  return parseFloat((usedTypes / ALL_TYPES.length).toFixed(3));
}

/** Slots still available before concurrent cap is hit */
export function getAvailableSlots(manager: ExtractionCooldownManager): number {
  return Math.max(0, PREDATOR_CONFIG.maxConcurrentExtractions - manager.active.length);
}

/** How many ticks until the next active extraction expires (or null if none) */
export function nextExpiryTick(manager: ExtractionCooldownManager): number | null {
  if (!manager.active.length) return null;
  return Math.min(...manager.active.map(a => a.expiresAtTick));
}