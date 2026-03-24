/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/index.ts
 *
 * Barrel export for the cards sub-system.
 *
 * Doctrine:
 * - This file is the single public surface for the entire cards engine.
 * - All consumers (chat, run-state, drama, AI planner) import from here.
 * - No circular imports: this file only re-exports; it imports nothing new.
 * - Disambiguation: any symbol exported by more than one module is resolved
 *   explicitly here — the canonical source wins, the duplicate is suppressed.
 *
 * Canonical sources:
 *   ModeCardScoreBreakdown → types.ts  (engine-level score breakdown)
 *     DeckComposer defines its own internal version used only within that file.
 */

// ─── Core type definitions ──────────────────────────────────────────────────
export * from './types';

// ─── Effect compiler ─────────────────────────────────────────────────────────
export * from './CardEffectCompiler';

// ─── Effect executor ─────────────────────────────────────────────────────────
export * from './CardEffectExecutor';

// ─── Legality service ────────────────────────────────────────────────────────
export * from './CardLegalityService';

// ─── Card registry ───────────────────────────────────────────────────────────
export * from './CardRegistry';

// ─── Targeting resolver ──────────────────────────────────────────────────────
export * from './CardTargetingResolver';

// ─── Timing validator ────────────────────────────────────────────────────────
export * from './CardTimingValidator';

// ─── Overlay resolver ────────────────────────────────────────────────────────
export * from './CardOverlayResolver';

// ─── Deck composer ───────────────────────────────────────────────────────────
export * from './DeckComposer';

// ─── Disambiguation ──────────────────────────────────────────────────────────
// ModeCardScoreBreakdown is defined independently in both types.ts and
// DeckComposer.ts. The engine-level definition in types.ts is canonical.
export type { ModeCardScoreBreakdown } from './types';
