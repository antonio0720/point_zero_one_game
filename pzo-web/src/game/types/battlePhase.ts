// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/types/battlePhase.ts
// Sprint 8 — Canonical BattlePhase type (shared source of truth)
//
// PROBLEM: runState.ts and BattleHUD.tsx both define BattlePhase locally.
// runState includes 'COMPLETE'; BattleHUD does not → TS2322 error.
// FIX: Both import from here. BattleHUD updated to import this type.
// ═══════════════════════════════════════════════════════════════════════════

export type BattlePhase =
  | 'IDLE'
  | 'PREP'
  | 'ACTIVE'
  | 'COUNTERPLAY'
  | 'RESOLUTION'
  | 'COMPLETE';

export const BATTLE_PHASE_LABELS: Record<BattlePhase, string> = {
  IDLE:         'Standby',
  PREP:         'Preparing',
  ACTIVE:       'Combat Active',
  COUNTERPLAY:  'Counterplay Window',
  RESOLUTION:   'Resolving',
  COMPLETE:     'Complete',
};
