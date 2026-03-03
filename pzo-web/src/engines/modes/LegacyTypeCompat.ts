// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — LEGACY TYPE COMPATIBILITY LAYER
// pzo-web/src/engines/modes/LegacyTypeCompat.ts
//
// Bridges the OLD engine type system (core/types.ts) to the NEW engine
// type system (engines/*/types.ts).
//
// PROBLEM STATEMENT:
//   EmpireEngine, PredatorEngine, SyndicateEngine, PhantomEngine were built
//   against core/types.ts with its own ShieldLayerId strings and CascadeChainIds.
//   The new card mode engines (EmpireCardMode, PredatorCardMode, etc.) and the
//   engineStore use the new type system. Both generations must coexist.
//
// WHAT THIS FILE PROVIDES:
//   1. LEGACY_TO_NEW_SHIELD_LAYER_ID    — 'L1_LIQUIDITY_BUFFER' → ShieldLayerId.LIQUIDITY_BUFFER
//   2. NEW_TO_LEGACY_SHIELD_LAYER_ID    — ShieldLayerId.LIQUIDITY_BUFFER → 'L1_LIQUIDITY_BUFFER'
//   3. LEGACY_TO_NEW_CASCADE_CHAIN_ID   — 'CHAIN_06_TOTAL_SYSTEMIC' → ChainId.CHAIN_FULL_CASCADE_BREACH
//   4. NEW_TO_LEGACY_CASCADE_CHAIN_ID   — reverse
//   5. RUN_MODE_TO_GAME_MODE            — 'solo' → GameMode.GO_ALONE
//   6. GAME_MODE_TO_RUN_MODE            — reverse
//   7. normalizeLegacyShieldLayerId()   — safe runtime conversion
//   8. getLegacyShieldLayer()           — access new ShieldSnapshot with old string keys
//   9. buildLegacyRunStateShields()     — build LiveRunState.shields from new ShieldSnapshot
//
// RULES:
//   ✦ Zero runtime logic beyond safe dictionary lookups and null coalescing.
//   ✦ All maps are const — never mutated at runtime.
//   ✦ Import this file anywhere old ↔ new type translation is needed.
//   ✦ Do NOT import from features/, store/, or EngineOrchestrator.
//
// Density6 LLC · Point Zero One · Type Compatibility · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { GameMode }        from '../cards/types';
import { ShieldLayerId }   from '../shield/types';
import { ChainId }         from '../cascade/types';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — SHIELD LAYER ID MAPS
//
// OLD (core/types.ts):   'L1_LIQUIDITY_BUFFER' | 'L2_CREDIT_LINE' |
//                        'L3_ASSET_FLOOR' | 'L4_NETWORK_CORE'
// NEW (shield/types.ts): ShieldLayerId enum — LIQUIDITY_BUFFER | CREDIT_LINE |
//                        ASSET_FLOOR | NETWORK_CORE
// ─────────────────────────────────────────────────────────────────────────────

/** Old layer ID string → new ShieldLayerId enum value. */
export const LEGACY_TO_NEW_SHIELD_LAYER_ID: Record<string, ShieldLayerId> = {
  L1_LIQUIDITY_BUFFER: ShieldLayerId.LIQUIDITY_BUFFER,
  L2_CREDIT_LINE:      ShieldLayerId.CREDIT_LINE,
  L3_ASSET_FLOOR:      ShieldLayerId.ASSET_FLOOR,
  L4_NETWORK_CORE:     ShieldLayerId.NETWORK_CORE,
} as const;

/** New ShieldLayerId enum → old string key used in LiveRunState.shields.layers. */
export const NEW_TO_LEGACY_SHIELD_LAYER_ID: Record<ShieldLayerId, string> = {
  [ShieldLayerId.LIQUIDITY_BUFFER]: 'L1_LIQUIDITY_BUFFER',
  [ShieldLayerId.CREDIT_LINE]:      'L2_CREDIT_LINE',
  [ShieldLayerId.ASSET_FLOOR]:      'L3_ASSET_FLOOR',
  [ShieldLayerId.NETWORK_CORE]:     'L4_NETWORK_CORE',
} as const;

/**
 * Convert a legacy shield layer ID string to the new ShieldLayerId enum.
 * Returns null if the input is not a recognized legacy key.
 *
 * @example
 *   normalizeLegacyShieldLayerId('L4_NETWORK_CORE') // → ShieldLayerId.NETWORK_CORE
 *   normalizeLegacyShieldLayerId('NETWORK_CORE')     // → null (already new format)
 */
export function normalizeLegacyShieldLayerId(legacyId: string): ShieldLayerId | null {
  return LEGACY_TO_NEW_SHIELD_LAYER_ID[legacyId] ?? null;
}

/**
 * Accepts EITHER a legacy string OR a new ShieldLayerId and always returns
 * the new ShieldLayerId. Use at boundary points where input format is uncertain.
 */
export function toNewShieldLayerId(id: string): ShieldLayerId | null {
  // If it's already a new enum value
  if (Object.values(ShieldLayerId).includes(id as ShieldLayerId)) {
    return id as ShieldLayerId;
  }
  // Try legacy map
  return LEGACY_TO_NEW_SHIELD_LAYER_ID[id] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — CASCADE CHAIN ID MAPS
//
// OLD (core/types.ts):  'CHAIN_06_TOTAL_SYSTEMIC', 'CHAIN_08_POSITIVE_MOMENTUM'
// NEW (cascade/types.ts): ChainId enum
//
// Full semantic mapping:
//   OLD CHAIN_01_LOAN_DEFAULT        → ChainId.CHAIN_LOAN_DEFAULT
//   OLD CHAIN_02_LIQUIDITY_BREACH    → ChainId.CHAIN_LIQUIDITY_BREACH
//   OLD CHAIN_03_NETWORK_COLLAPSE    → ChainId.CHAIN_NETWORK_COLLAPSE
//   OLD CHAIN_04_HATER_SABOTAGE      → ChainId.CHAIN_HATER_SABOTAGE
//   OLD CHAIN_05_NET_WORTH_CRASH     → ChainId.CHAIN_NET_WORTH_CRASH
//   OLD CHAIN_06_TOTAL_SYSTEMIC      → ChainId.CHAIN_FULL_CASCADE_BREACH
//   OLD CHAIN_07_PATTERN_EXPLOIT     → ChainId.CHAIN_PATTERN_EXPLOITATION
//   OLD CHAIN_08_POSITIVE_MOMENTUM   → ChainId.PCHAIN_SUSTAINED_CASHFLOW
// ─────────────────────────────────────────────────────────────────────────────

/** Old CascadeChainId string → new ChainId enum value. */
export const LEGACY_TO_NEW_CASCADE_CHAIN_ID: Record<string, ChainId> = {
  CHAIN_01_LOAN_DEFAULT:        ChainId.CHAIN_LOAN_DEFAULT,
  CHAIN_02_LIQUIDITY_BREACH:    ChainId.CHAIN_LIQUIDITY_BREACH,
  CHAIN_03_NETWORK_COLLAPSE:    ChainId.CHAIN_NETWORK_COLLAPSE,
  CHAIN_04_HATER_SABOTAGE:      ChainId.CHAIN_HATER_SABOTAGE,
  CHAIN_05_NET_WORTH_CRASH:     ChainId.CHAIN_NET_WORTH_CRASH,
  CHAIN_06_TOTAL_SYSTEMIC:      ChainId.CHAIN_FULL_CASCADE_BREACH,
  CHAIN_07_PATTERN_EXPLOIT:     ChainId.CHAIN_PATTERN_EXPLOITATION,
  CHAIN_08_POSITIVE_MOMENTUM:   ChainId.PCHAIN_SUSTAINED_CASHFLOW,
  // Aliases for safety
  CHAIN_FULL_CASCADE_BREACH:    ChainId.CHAIN_FULL_CASCADE_BREACH,
  PCHAIN_SUSTAINED_CASHFLOW:    ChainId.PCHAIN_SUSTAINED_CASHFLOW,
} as const;

/** New ChainId enum → old CascadeChainId string (for reverse compat). */
export const NEW_TO_LEGACY_CASCADE_CHAIN_ID: Partial<Record<ChainId, string>> = {
  [ChainId.CHAIN_LOAN_DEFAULT]:        'CHAIN_01_LOAN_DEFAULT',
  [ChainId.CHAIN_LIQUIDITY_BREACH]:    'CHAIN_02_LIQUIDITY_BREACH',
  [ChainId.CHAIN_NETWORK_COLLAPSE]:    'CHAIN_03_NETWORK_COLLAPSE',
  [ChainId.CHAIN_HATER_SABOTAGE]:      'CHAIN_04_HATER_SABOTAGE',
  [ChainId.CHAIN_NET_WORTH_CRASH]:     'CHAIN_05_NET_WORTH_CRASH',
  [ChainId.CHAIN_FULL_CASCADE_BREACH]: 'CHAIN_06_TOTAL_SYSTEMIC',
  [ChainId.CHAIN_PATTERN_EXPLOITATION]:'CHAIN_07_PATTERN_EXPLOIT',
  [ChainId.PCHAIN_SUSTAINED_CASHFLOW]: 'CHAIN_08_POSITIVE_MOMENTUM',
} as const;

/**
 * Convert a legacy CascadeChainId string to the new ChainId enum.
 * Accepts both old format ('CHAIN_06_TOTAL_SYSTEMIC') and new format
 * ('CHAIN_FULL_CASCADE_BREACH'). Returns null if unrecognized.
 */
export function toNewChainId(legacyOrNewId: string): ChainId | null {
  return LEGACY_TO_NEW_CASCADE_CHAIN_ID[legacyOrNewId] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — RUN MODE ↔ GAME MODE MAP
//
// OLD RunMode (core/types.ts): 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost'
// NEW GameMode (cards/types.ts): GO_ALONE | HEAD_TO_HEAD | TEAM_UP | CHASE_A_LEGEND
// ─────────────────────────────────────────────────────────────────────────────

/** Old RunMode string → new GameMode enum. Used when initializing CardEngine from ModeRouter. */
export const RUN_MODE_TO_GAME_MODE: Record<string, GameMode> = {
  'solo':           GameMode.GO_ALONE,
  'asymmetric-pvp': GameMode.HEAD_TO_HEAD,
  'co-op':          GameMode.TEAM_UP,
  'ghost':          GameMode.CHASE_A_LEGEND,
} as const;

/** New GameMode enum → old RunMode string. */
export const GAME_MODE_TO_RUN_MODE: Record<GameMode, string> = {
  [GameMode.GO_ALONE]:       'solo',
  [GameMode.HEAD_TO_HEAD]:   'asymmetric-pvp',
  [GameMode.TEAM_UP]:        'co-op',
  [GameMode.CHASE_A_LEGEND]: 'ghost',
} as const;

/**
 * Convert a RunMode string to GameMode enum, with fallback to GO_ALONE.
 * Never throws — safe to call at any initialization point.
 */
export function toGameMode(runMode: string): GameMode {
  return RUN_MODE_TO_GAME_MODE[runMode] ?? GameMode.GO_ALONE;
}

/**
 * Convert a GameMode enum to RunMode string.
 */
export function toRunMode(gameMode: GameMode): string {
  return GAME_MODE_TO_RUN_MODE[gameMode] ?? 'solo';
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — LIVE RUN STATE SHIELD HELPERS
//
// Old engines access shields via: live.shields.layers.L4_NETWORK_CORE.current
// New ShieldSnapshot uses:        snapshot.layers[ShieldLayerId.NETWORK_CORE].integrity
//
// These helpers let old engines read/write the new ShieldSnapshot structure
// using legacy string keys.
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal shape that old engines read from shield layers. */
export interface LegacyShieldLayer {
  current:      number;   // current integrity (0–max)
  max:          number;   // maximum integrity
  regenActive:  boolean;  // regen enabled flag
}

/**
 * Get a shield layer from a new ShieldSnapshot using a legacy layer ID string.
 * Returns a synthetic LegacyShieldLayer that old engines can read without modification.
 *
 * @example
 *   const layer = getLegacyShieldLayer(shieldSnapshot, 'L4_NETWORK_CORE');
 *   const score = layer.current / layer.max * 200;
 */
export function getLegacyShieldLayer(
  snapshot: import('../shield/types').ShieldSnapshot,
  legacyId: string,
): LegacyShieldLayer {
  const newId = toNewShieldLayerId(legacyId);
  if (!newId) {
    return { current: 100, max: 100, regenActive: true };
  }

  const layer = snapshot.layers[newId];
  if (!layer) {
    return { current: 100, max: 100, regenActive: true };
  }

  // Map new layer state shape to legacy shape
  return {
    current:     layer.currentIntegrity,
    max:         layer.maxIntegrity,
    regenActive: !layer.isBreached,
  };
}

/**
 * Build a legacy shields object from a new ShieldSnapshot.
 * Allows old engine code that does `live.shields.layers.L4_NETWORK_CORE.current`
 * to work without modification when given this synthetic object.
 *
 * @example
 *   const legacyShields = buildLegacyShields(shieldSnapshot);
 *   const score = legacyShields.layers.L4_NETWORK_CORE.current / 200;
 */
export function buildLegacyShields(
  snapshot: import('../shield/types').ShieldSnapshot,
): {
  layers: Record<string, LegacyShieldLayer>;
  overallIntegrityPct: number;
} {
  const layers: Record<string, LegacyShieldLayer> = {};

  for (const [legacyKey, newId] of Object.entries(LEGACY_TO_NEW_SHIELD_LAYER_ID)) {
    layers[legacyKey] = getLegacyShieldLayer(snapshot, legacyKey);
  }

  return {
    layers,
    overallIntegrityPct: snapshot.overallIntegrityPct,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — SEVERITY NORMALIZATION
//
// Old cascade severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CATASTROPHIC'
// New cascade severity: same values — no change needed.
// Provided as a guard for any future divergence.
// ─────────────────────────────────────────────────────────────────────────────

export type LegacyCascadeSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CATASTROPHIC';

/** No-op conversion — severity strings match between systems. Provided for explicitness. */
export function normalizeSeverity(s: string): LegacyCascadeSeverity {
  if (s === 'LOW' || s === 'MEDIUM' || s === 'HIGH' || s === 'CATASTROPHIC') {
    return s as LegacyCascadeSeverity;
  }
  return 'MEDIUM';  // safe default
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — EXPORT SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Re-export enums so callers only need one import
  GameMode,
  ShieldLayerId,
  ChainId,
};