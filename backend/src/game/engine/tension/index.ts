/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION BARREL
 * /backend/src/game/engine/tension/index.ts
 *
 * Canonical public surface for the Tension Engine subsystem (Engine 3 of 7).
 * All tension types, constants, classes, and runtime exports are available
 * through this barrel.
 *
 * Usage:
 *   import { Tension } from '../../engine';
 *   const engine = new Tension.TensionEngine();
 *   const snapshot = engine.getRuntimeSnapshot();
 *   const mlVec = engine.extractMLVector();
 *   const narrative = engine.generateNarrative();
 * ====================================================================== */

// ── Types, constants, and event map ──────────────────────────────────────
export * from './types';

// ── AnticipationQueue — threat scheduling and lifecycle ───────────────────
export * from './AnticipationQueue';

// ── ThreatVisibilityManager — information exposure control ───────────────
export * from './ThreatVisibilityManager';

// ── TensionDecayController — score accumulation and decay math ───────────
export * from './TensionDecayController';

// ── TensionUXBridge — event broadcasting to frontend/audio ───────────────
export * from './TensionUXBridge';

// ── TensionThreatProjector — queue → ThreatEnvelope projection ───────────
export * from './TensionThreatProjector';

// ── TensionThreatSourceAdapter — snapshot → threat discovery ─────────────
export * from './TensionThreatSourceAdapter';

// ── TensionMetricsCollector — higher-order operational metrics ────────────
export * from './TensionMetricsCollector';

// ── TensionPolicyResolver — centralized policy decisions ─────────────────
export * from './TensionPolicyResolver';

// ── TensionSnapshotAdapter — runtime → RunStateSnapshot bridge ───────────
export * from './TensionSnapshotAdapter';

// ── TensionEngine v2 — core orchestrator with ML/DL/UX/analytics ─────────
// Exports: TensionEngine class + all v2 types:
//   TensionMLVector, TensionDLTensor, TensionTrendSnapshot,
//   TensionRecoveryForecast, TensionQueueAnalytics, TensionVisibilityTransition,
//   TensionSessionAnalytics, TensionScoreDecomposition, TensionNarrative,
//   TensionResilienceScore, TensionExportBundle, TensionValidationResult,
//   TensionSelfTestResult, TENSION_ML_FEATURE_LABELS, TENSION_DL_COLUMN_LABELS
export * from './TensionEngine';
