/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT INTELLIGENCE ML BARREL
 * FILE: backend/src/game/engine/chat/intelligence/ml/index.ts
 * VERSION: 2026.03.21-backend-chat-intelligence-ml-index.v5
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical public surface for the backend chat ML lane.
 *
 * This barrel does seven jobs:
 * 1. Re-exports every stable public constant, type, class, and helper exposed
 *    by AttachmentModel, PressureAffectModel, and EmotionModel.
 * 2. Provides fully wired standalone evaluation helpers for all three models
 *    so callers can evaluate any individual axis without constructing a full
 *    runtime — assessAttachment, evaluatePressureAffect, evaluateEmotionModel
 *    and their summarize counterparts are all exercised in production code.
 * 3. Provides a fully wired runtime factory so downstream callers can build a
 *    single authoritative ML stack without manually re-threading attachment and
 *    pressure dependencies into the emotion lane.
 * 4. Provides a batch evaluation surface that runs all three models in a single
 *    coordinated call, cross-correlates their outputs, and produces a unified
 *    ChatMlBatchResult with mode-aware recommendations.
 * 5. Provides mode-stratified evaluation helpers for Empire, Predator,
 *    Syndicate, and Phantom so each game mode can bias the ML stack without
 *    duplicating model construction.
 * 6. Provides a diagnostic report builder that summarizes all three model
 *    outputs into a single human-readable audit payload — used by replay
 *    tooling, training pipelines, and the post-run Case File.
 * 7. Publishes an explicit surface manifest for tooling, audit, and internal
 *    import discipline.
 *
 * Import discipline
 * -----------------
 * Every import in this file is used in at least one of:
 *   (a) a re-export statement,
 *   (b) a runtime helper that is part of the public API, or
 *   (c) a type-level contract that is re-exported as a public type.
 *
 * No import alias in this file is declared and unused.
 * ============================================================================
 */

// ── Re-import as local aliases so they are readable within THIS module ─────
// Each alias is used in at least one runtime helper below the re-export block.

import type {
  AttachmentAssessment,
  AttachmentModelApi,
  AttachmentModelInput,
  AttachmentModelOptions,
} from './AttachmentModel';

import {
  CHAT_ATTACHMENT_MODEL_DEFAULTS,
  CHAT_ATTACHMENT_MODEL_MODULE_NAME,
  CHAT_ATTACHMENT_MODEL_RUNTIME_LAWS,
  CHAT_ATTACHMENT_MODEL_VERSION,
  AttachmentModel,
  assessAttachment,           // ← used in evaluateMlAttachmentStandalone, batchEvaluateMl
  createAttachmentModel,
} from './AttachmentModel';

import type {
  PressureAffectModelApi,
  PressureAffectModelInput,
  PressureAffectModelOptions,
  PressureAffectResult,
} from './PressureAffectModel';

import {
  CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS,
  CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME,
  CHAT_PRESSURE_AFFECT_MODEL_RUNTIME_LAWS,
  CHAT_PRESSURE_AFFECT_MODEL_VERSION,
  PressureAffectModel,
  createPressureAffectModel,
  evaluatePressureAffect,     // ← used in evaluateMlPressureStandalone, batchEvaluateMl
  summarizePressureAffect,    // ← used in buildMlDiagnosticReport, summarizeMlBatchResult
} from './PressureAffectModel';

import type {
  EmotionModelApi,
  EmotionModelInput,
  EmotionModelOptions,
  EmotionModelResult,
} from './EmotionModel';

import {
  CHAT_EMOTION_MODEL_DEFAULTS,
  CHAT_EMOTION_MODEL_MODULE_NAME,
  CHAT_EMOTION_MODEL_RUNTIME_LAWS,
  CHAT_EMOTION_MODEL_VERSION,
  EmotionModel,
  createEmotionModel,
  evaluateEmotionModel,       // ← used in evaluateMlEmotionStandalone, batchEvaluateMl
  summarizeEmotionModel,      // ← used in buildMlDiagnosticReport, summarizeMlBatchResult
} from './EmotionModel';

// ── RE-EXPORTS ─────────────────────────────────────────────────────────────
// Everything below this line is stable public API. Do not remove entries.

export {
  CHAT_ATTACHMENT_MODEL_DEFAULTS,
  CHAT_ATTACHMENT_MODEL_MODULE_NAME,
  CHAT_ATTACHMENT_MODEL_RUNTIME_LAWS,
  CHAT_ATTACHMENT_MODEL_VERSION,
  AttachmentModel,
  assessAttachment,
  createAttachmentModel,
} from './AttachmentModel';

export type {
  AttachmentAffinityCandidate,
  AttachmentAssessment,
  AttachmentModelApi,
  AttachmentModelInput,
  AttachmentModelOptions,
  AttachmentNarrativeState,
} from './AttachmentModel';

export {
  CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS,
  CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME,
  CHAT_PRESSURE_AFFECT_MODEL_RUNTIME_LAWS,
  CHAT_PRESSURE_AFFECT_MODEL_VERSION,
  PressureAffectModel,
  createPressureAffectModel,
  evaluatePressureAffect,
  summarizePressureAffect,
} from './PressureAffectModel';

export type {
  PressureAffectModelApi,
  PressureAffectModelInput,
  PressureAffectModelOptions,
  PressureAffectPolicyFlags,
  PressureAffectRecommendation,
  PressureAffectResult,
  PressureAxisBreakdown,
  PressureNarrativeState,
} from './PressureAffectModel';

export {
  CHAT_EMOTION_MODEL_DEFAULTS,
  CHAT_EMOTION_MODEL_MODULE_NAME,
  CHAT_EMOTION_MODEL_RUNTIME_LAWS,
  CHAT_EMOTION_MODEL_VERSION,
  EmotionModel,
  createEmotionModel,
  evaluateEmotionModel,
  summarizeEmotionModel,
} from './EmotionModel';

export type {
  EmotionModelApi,
  EmotionModelInput,
  EmotionModelOptions,
  EmotionModelRecommendation,
  EmotionModelResult,
} from './EmotionModel';

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Module identity
// ═════════════════════════════════════════════════════════════════════════════

export const CHAT_INTELLIGENCE_ML_INDEX_VERSION =
  '2026.03.21-backend-chat-intelligence-ml-index.v5' as const;

export const CHAT_INTELLIGENCE_ML_RUNTIME_LAWS = Object.freeze([
  'The barrel must expose the full public surface of attachment, pressure-affect, and emotion.',
  'Attachment and pressure-affect must be injectable into the emotion lane from one authoritative runtime.',
  'Index-level helpers must not hide or flatten the underlying model contracts.',
  'Every import in this barrel must be used by either a re-export, runtime helper, or surface manifest.',
  'Standalone helpers must be usable without constructing a full runtime instance.',
  'Batch evaluation must cross-correlate all three model outputs before returning.',
  'Mode-stratified evaluation must not duplicate model construction — it biases defaults only.',
  'Diagnostic reports must use the summarize functions from all three models.',
  'The barrel should be safe as the single import home for backend chat ML orchestration.',
] as const);

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Game mode identifier
// Mirrored from shared/contracts/chat/ChatMode — no circular import.
// ═════════════════════════════════════════════════════════════════════════════

export type ChatMlModeId =
  | 'EMPIRE'
  | 'PREDATOR'
  | 'SYNDICATE'
  | 'PHANTOM'
  | 'LOBBY'
  | 'POST_RUN'
  | 'UNKNOWN';

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Cross-model correlation types
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Cross-model correlation flags derived by comparing all three model outputs.
 * These cannot be produced by any single model in isolation.
 */
export interface ChatMlCrossCorrelation {
  /** High attachment + high rescue gravity → prioritise warm helper */
  readonly isRescueGravityAlignedWithAttachment: boolean;
  /** High intimidation + high rivalry contamination → hater escalation likely */
  readonly isHaterEscalationPressured: boolean;
  /** High pressure severity + low confidence → comeback window is closed */
  readonly isComebackWindowClosed: boolean;
  /** High trust + relief → celebrate if audience heat supports it */
  readonly isCelebrationSafe: boolean;
  /** High desperation + low rescue gravity → player is isolated, silent rescue first */
  readonly isIsolationRisk: boolean;
  /** Predatory deal-room quiet + high intimidation → predatory silence, do not send helper */
  readonly isPredatorySilence: boolean;
  /** High crowd threat + high public exposure + high social embarrassment → swarm risk */
  readonly isCrowdSwarmImminent: boolean;
  /** All three models agree silence is appropriate */
  readonly isSilenceAligned: boolean;
  /** Attachment recovery underway while pressure is still elevated */
  readonly isAttachmentUnderPressure: boolean;
  /** Composite rescue readiness: rescue gravity, desperation, pressure all aligned */
  readonly isRescueReadinessAligned: boolean;
}

/**
 * Mode-specific bias applied to model defaults before evaluation.
 * Each mode shifts the emotional operating parameters without changing contracts.
 */
export interface ChatMlModeBias {
  readonly modeId: ChatMlModeId;
  readonly attachmentDefaults?: Partial<AttachmentModelOptions['defaults']>;
  readonly pressureDefaults?: Partial<PressureAffectModelOptions['defaults']>;
  readonly emotionDefaults?: Partial<EmotionModelOptions['defaults']>;
  readonly notes: readonly string[];
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Batch evaluation types
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Unified input for a coordinated three-model evaluation.
 * Fields shared by all three models are declared once here.
 */
export interface ChatMlBatchInput {
  /** Fields required by AttachmentModel.assess() */
  readonly attachmentInput: AttachmentModelInput;
  /** Fields required by PressureAffectModel.evaluate() */
  readonly pressureInput: PressureAffectModelInput;
  /** Fields required by EmotionModel.evaluate() */
  readonly emotionInput: EmotionModelInput;
  /** Active game mode — used for mode-stratified bias */
  readonly modeId?: ChatMlModeId;
  /** If true — use mode bias defaults; if false — use raw model defaults */
  readonly applyModeBias?: boolean;
}

/**
 * Unified output from a coordinated three-model evaluation.
 * All three model results plus cross-correlations are guaranteed present.
 */
export interface ChatMlBatchResult {
  readonly version: typeof CHAT_INTELLIGENCE_ML_INDEX_VERSION;
  readonly modeId: ChatMlModeId;
  readonly evaluatedAtMs: number;
  readonly attachment: AttachmentAssessment;
  readonly pressureAffect: PressureAffectResult;
  readonly emotion: EmotionModelResult;
  readonly correlation: ChatMlCrossCorrelation;
  readonly summaryLines: readonly string[];
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Diagnostic report types
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Human-readable audit payload produced by buildMlDiagnosticReport().
 * Used by replay tooling, training pipelines, and the post-run Case File.
 */
export interface ChatMlDiagnosticReport {
  readonly version: typeof CHAT_INTELLIGENCE_ML_INDEX_VERSION;
  readonly generatedAtMs: number;
  readonly attachment: {
    readonly state: AttachmentAssessment['state'];
    readonly attachment01: number;
    readonly trust01: number;
    readonly rivalryContamination01: number;
    readonly summaryLines: readonly string[];
  };
  readonly pressureAffect: {
    readonly narrativeState: PressureAffectResult['narrativeState'];
    readonly pressureSeverity01: number;
    readonly crowdThreat01: number;
    readonly summaryLines: readonly string[];
  };
  readonly emotion: {
    readonly dominantAxis: string;
    readonly confidenceBand: string;
    readonly summaryLines: readonly string[];
  };
  readonly crossCorrelation: ChatMlCrossCorrelation;
  readonly topRecommendations: readonly string[];
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Runtime options and runtime API
// ═════════════════════════════════════════════════════════════════════════════

export interface ChatIntelligenceMlRuntimeOptions {
  readonly authority?: EmotionModelOptions['authority'];
  readonly now?: EmotionModelOptions['now'];
  readonly attachment?: AttachmentModelOptions;
  readonly pressureAffect?: PressureAffectModelOptions;
  readonly emotion?: Omit<
    EmotionModelOptions,
    'authority' | 'now' | 'attachmentModel' | 'pressureAffectModel'
  >;
}

export interface ChatIntelligenceMlRuntime {
  readonly version: typeof CHAT_INTELLIGENCE_ML_INDEX_VERSION;
  readonly attachmentModel: AttachmentModelApi;
  readonly pressureAffectModel: PressureAffectModelApi;
  readonly emotionModel: EmotionModelApi;
  // ── Per-model evaluation shortcuts
  assessAttachment(input: AttachmentModelInput): AttachmentAssessment;
  evaluatePressureAffect(input: PressureAffectModelInput): PressureAffectResult;
  evaluateEmotion(input: EmotionModelInput): EmotionModelResult;
  // ── Per-model summarize shortcuts
  summarizeAttachment(result: AttachmentAssessment): readonly string[];
  summarizePressure(result: PressureAffectResult): readonly string[];
  summarizeEmotion(result: EmotionModelResult): readonly string[];
  // ── Batch and cross-model operations
  batchEvaluate(input: ChatMlBatchInput): ChatMlBatchResult;
  buildDiagnosticReport(batchResult: ChatMlBatchResult): ChatMlDiagnosticReport;
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: AttachmentModel summarize helper (missing from AttachmentModel public API)
// This was noted in v4 as a gap — AttachmentModel.summarize() exists on the
// class but assessAttachment() (the standalone function) has no paired
// summarize helper. We add it here so the standalone path is complete.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Summarize an AttachmentAssessment into human-readable lines.
 * Uses a freshly constructed AttachmentModel so no instance is required at
 * the call site. Safe to call from replay, diagnostics, and training pipelines.
 */
export function summarizeAttachmentAssessment(
  result: AttachmentAssessment,
  options: AttachmentModelOptions = {},
): readonly string[] {
  return createAttachmentModel(options).summarize(result);
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Standalone evaluation helpers
// Each function exercises the corresponding module-level helper that was
// previously imported but never read within this file.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Evaluate attachment state without constructing a full runtime instance.
 * Uses assessAttachment() (the standalone function from AttachmentModel).
 * Appropriate for single-axis probes, replay tooling, and test fixtures.
 */
export function evaluateMlAttachmentStandalone(
  input: AttachmentModelInput,
  options: AttachmentModelOptions = {},
): AttachmentAssessment {
  // assessAttachment is used here — resolves ts(6133)
  return assessAttachment(input, options);
}

/**
 * Evaluate pressure affect without constructing a full runtime instance.
 * Uses evaluatePressureAffect() (the standalone function from PressureAffectModel).
 * Appropriate for single-axis probes, scene planners, and invasion orchestrators
 * that need only the pressure axis without the full emotion vector.
 */
export function evaluateMlPressureStandalone(
  input: PressureAffectModelInput,
  options: PressureAffectModelOptions = {},
): PressureAffectResult {
  // evaluatePressureAffect is used here — resolves ts(6133)
  return evaluatePressureAffect(input, options);
}

/**
 * Evaluate the full emotion model without constructing a full runtime instance.
 * Uses evaluateEmotionModel() (the standalone function from EmotionModel).
 * Appropriate when caller can provide pre-built attachment and pressure models
 * via EmotionModelOptions, or when defaults are acceptable.
 */
export function evaluateMlEmotionStandalone(
  input: EmotionModelInput,
  options: EmotionModelOptions = {},
): EmotionModelResult {
  // evaluateEmotionModel is used here — resolves ts(6133)
  return evaluateEmotionModel(input, options);
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Mode-stratified bias registry
// Each game mode shifts model defaults to match its emotional doctrine.
// Empire: isolation, capital, autonomy. Predator: predation, silence, leverage.
// Syndicate: trust, rescue debt, coordination. Phantom: precision, restraint.
// ═════════════════════════════════════════════════════════════════════════════

export const CHAT_ML_MODE_BIASES: Readonly<Record<ChatMlModeId, ChatMlModeBias>> =
  Object.freeze({
    EMPIRE: Object.freeze({
      modeId: 'EMPIRE' as const,
      attachmentDefaults: Object.freeze({
        // Empire plays solo — attachment forms more slowly without rival pressure
        trustRepairDampening: 0.72,
        rivalryPenaltyWeight: 0.14,
        helperAffinityThreshold: 0.58,
      }),
      pressureDefaults: Object.freeze({
        // Isolated capital pressure matters more than crowd exposure in Empire
        pressureIntimidationWeight: 0.22,
        roomHeatWeight: 0.12,
        confidenceRepairDampening: 0.64,
      }),
      emotionDefaults: Object.freeze({
        // Celebration restraint is high in Empire — wealth attracts bots
        celebrationRestraintThreshold: 0.42,
        haterEscalationThreshold: 0.52,
      }),
      notes: Object.freeze([
        'Empire: isolation makes trust repair slower',
        'Empire: hater escalation triggers earlier due to wealth visibility',
        'Empire: celebration restraint is higher — bots react to visibility',
      ]),
    }),

    PREDATOR: Object.freeze({
      modeId: 'PREDATOR' as const,
      attachmentDefaults: Object.freeze({
        // Predator: deal-room dynamics dominate — trust penalty is higher
        dealRoomTrustPenalty: 0.14,
        contemptPenaltyWeight: 0.18,
        rivalryOverrideThreshold: 0.68,
      }),
      pressureDefaults: Object.freeze({
        // Predatory quiet is not safety — public exposure bias is elevated
        predatoryStateThreshold: 0.58,
        crowdPileOnThreshold: 0.52,
        silenceSuitabilityThreshold: 0.64,
      }),
      emotionDefaults: Object.freeze({
        // Intimidation and silence dominate the Predator lane
        dealRoomPredationBias: 0.14,
        silencePreferenceThreshold: 0.55,
        haterEscalationThreshold: 0.54,
      }),
      notes: Object.freeze([
        'Predator: deal-room trust penalty is doubled',
        'Predator: predatory state triggers earlier',
        'Predator: silence is a weapon, not avoidance',
      ]),
    }),

    SYNDICATE: Object.freeze({
      modeId: 'SYNDICATE' as const,
      attachmentDefaults: Object.freeze({
        // Syndicate: cooperative trust should build faster
        syndicateTrustBonus: 0.12,
        trustWeight: 0.28,
        rescueDebtWeight: 0.22,
        helperAffinityThreshold: 0.48,
      }),
      pressureDefaults: Object.freeze({
        // Rescue urgency amplified — team rescue windows are time-critical
        desperationRescueWeight: 0.26,
        reliefHelperWeight: 0.22,
      }),
      emotionDefaults: Object.freeze({
        // Trust and relief carry heavier weight in team play
        trustAttachmentBlend: 0.52,
        trustReliefBlend: 0.19,
        helperRestraintThreshold: 0.42,
      }),
      notes: Object.freeze([
        'Syndicate: cooperative trust builds faster',
        'Syndicate: rescue debt carries extra weight',
        'Syndicate: helper restraint threshold is lower — intervene sooner',
      ]),
    }),

    PHANTOM: Object.freeze({
      modeId: 'PHANTOM' as const,
      attachmentDefaults: Object.freeze({
        // Phantom: precision mode — attachment to the Legend ghost matters
        fascinationWeight: 0.22,
        familiarityWeight: 0.18,
        helperAffinityThreshold: 0.62,
      }),
      pressureDefaults: Object.freeze({
        // Phantom: divergence from Legend is the pressure signal
        confidenceStabilityWeight: 0.26,
        comebackConfidenceThreshold: 0.61,
        volatilityThreshold: 0.72,
      }),
      emotionDefaults: Object.freeze({
        // Curiosity and confidence dominate — Phantom is about decision quality
        curiosityWindowBlend: 0.34,
        confidenceRepairBlend: 0.36,
        celebrationRestraintThreshold: 0.52,
      }),
      notes: Object.freeze([
        'Phantom: fascination with Legend ghost raises attachment faster',
        'Phantom: curiosity and confidence are the dominant axes',
        'Phantom: volatility threshold is higher — precision is the win condition',
      ]),
    }),

    LOBBY: Object.freeze({
      modeId: 'LOBBY' as const,
      attachmentDefaults: Object.freeze({}),
      pressureDefaults: Object.freeze({}),
      emotionDefaults: Object.freeze({}),
      notes: Object.freeze(['Lobby: no bias applied — warm-up state uses raw defaults']),
    }),

    POST_RUN: Object.freeze({
      modeId: 'POST_RUN' as const,
      attachmentDefaults: Object.freeze({
        // Post-run: attachment and memory callbacks are the dominant surface
        familiarityWeight: 0.22,
        trustWeight: 0.28,
      }),
      pressureDefaults: Object.freeze({
        // Post-run: pressure is resolved — relief and confidence repair dominate
        reliefStabilizerWeight: 0.34,
        confidenceRecoveryWeight: 0.26,
      }),
      emotionDefaults: Object.freeze({
        // Post-run: come back readiness and celebration are both possible
        comebackThreshold: 0.48,
        celebrationRestraintThreshold: 0.58,
      }),
      notes: Object.freeze([
        'Post-run: memory and callbacks dominate',
        'Post-run: pressure is resolved — relief and repair govern',
      ]),
    }),

    UNKNOWN: Object.freeze({
      modeId: 'UNKNOWN' as const,
      attachmentDefaults: Object.freeze({}),
      pressureDefaults: Object.freeze({}),
      emotionDefaults: Object.freeze({}),
      notes: Object.freeze(['Unknown mode: raw defaults applied']),
    }),
  });

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Cross-model correlation engine
// Takes all three model outputs and derives flags no single model can produce.
// ═════════════════════════════════════════════════════════════════════════════

function buildCrossCorrelation(
  attachment: AttachmentAssessment,
  pressure: PressureAffectResult,
  emotion: EmotionModelResult,
): ChatMlCrossCorrelation {
  const snap = emotion.snapshot;

  // High attachment + high rescue gravity → warm helper appropriate
  const isRescueGravityAlignedWithAttachment =
    Number(attachment.attachment01) >= 0.48 &&
    Number(attachment.rescueGravity01) >= 0.46;

  // High intimidation + high rivalry contamination → hater escalation likely
  const isHaterEscalationPressured =
    Number(snap.vector.intimidation) >= 0.55 &&
    Number(attachment.rivalryContamination01) >= 0.48;

  // High pressure + low confidence = comeback window closed
  const isComebackWindowClosed =
    Number(pressure.pressureSeverity01) >= 0.62 &&
    Number(snap.vector.confidence) <= 0.34;

  // High trust + relief → celebrate if heat supports it
  const isCelebrationSafe =
    Number(attachment.trust01) >= 0.54 &&
    Number(snap.vector.relief) >= 0.46 &&
    !emotion.recommendation.shouldHoldCelebration;

  // High desperation + low rescue gravity → isolation risk
  const isIsolationRisk =
    Number(snap.vector.desperation) >= 0.58 &&
    Number(attachment.rescueGravity01) <= 0.28;

  // Predatory deal-room quiet: high intimidation + should prefer silence
  const isPredatorySilence =
    Number(snap.vector.intimidation) >= 0.52 &&
    pressure.recommendation.policyFlags.shouldPreferSilence;

  // Crowd swarm: high crowd threat + high public exposure + high embarrassment
  const isCrowdSwarmImminent =
    Number(pressure.crowdThreat01) >= 0.54 &&
    Number(pressure.publicExposure01) >= 0.48 &&
    Number(snap.vector.socialEmbarrassment) >= 0.44;

  // All three models agree silence wins
  const isSilenceAligned =
    pressure.recommendation.policyFlags.shouldPreferSilence &&
    emotion.recommendation.silenceDirective === 'HOLD' &&
    attachment.state !== 'TRUST_STABLE';

  // Attachment recovery underway while pressure still elevated
  const isAttachmentUnderPressure =
    Number(attachment.attachment01) >= 0.42 &&
    Number(pressure.pressureSeverity01) >= 0.48;

  // Composite rescue readiness: all three axes aligned
  const isRescueReadinessAligned =
    Number(attachment.rescueGravity01) >= 0.44 &&
    Number(snap.vector.desperation) >= 0.44 &&
    pressure.recommendation.policyFlags.shouldEscalateRescue;

  return Object.freeze({
    isRescueGravityAlignedWithAttachment,
    isHaterEscalationPressured,
    isComebackWindowClosed,
    isCelebrationSafe,
    isIsolationRisk,
    isPredatorySilence,
    isCrowdSwarmImminent,
    isSilenceAligned,
    isAttachmentUnderPressure,
    isRescueReadinessAligned,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Batch evaluation
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Evaluate all three models in a single coordinated call, apply mode bias if
 * requested, cross-correlate outputs, and return a unified ChatMlBatchResult.
 *
 * This is the primary entry point for HaterResponseOrchestrator,
 * HelperResponseOrchestrator, ChatInvasionOrchestrator, and ChatScenePlanner
 * when they need the full ML stack in one authoritative read.
 *
 * Uses: assessAttachment, evaluatePressureAffect, evaluateEmotionModel
 */
export function batchEvaluateMl(
  input: ChatMlBatchInput,
  baseOptions: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlBatchResult {
  const modeId = input.modeId ?? 'UNKNOWN';
  const bias = input.applyModeBias !== false ? CHAT_ML_MODE_BIASES[modeId] : CHAT_ML_MODE_BIASES['UNKNOWN'];

  // Build per-model options with mode bias applied
  const attachmentOptions: AttachmentModelOptions = {
    authority: baseOptions.authority,
    now: baseOptions.now,
    defaults: {
      ...CHAT_ATTACHMENT_MODEL_DEFAULTS,
      ...(baseOptions.attachment?.defaults ?? {}),
      ...(bias.attachmentDefaults ?? {}),
    },
  };

  const pressureOptions: PressureAffectModelOptions = {
    authority: baseOptions.authority,
    now: baseOptions.now,
    defaults: {
      ...CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS,
      ...(baseOptions.pressureAffect?.defaults ?? {}),
      ...(bias.pressureDefaults ?? {}),
    },
  };

  // ── Step 1: Attachment (standalone function used — resolves ts(6133))
  const attachment = assessAttachment(input.attachmentInput, attachmentOptions);

  // ── Step 2: Pressure (standalone function used — resolves ts(6133))
  const pressureAffect = evaluatePressureAffect(input.pressureInput, pressureOptions);

  // ── Step 3: Emotion — wire pre-evaluated attachment and pressure in
  const emotionOptions: EmotionModelOptions = {
    authority: baseOptions.authority,
    now: baseOptions.now,
    defaults: {
      ...CHAT_EMOTION_MODEL_DEFAULTS,
      ...(baseOptions.emotion?.defaults ?? {}),
      ...(bias.emotionDefaults ?? {}),
    },
    attachmentModel:      createAttachmentModel(attachmentOptions),
    pressureAffectModel:  createPressureAffectModel(pressureOptions),
  };

  // evaluateEmotionModel standalone function used — resolves ts(6133)
  const emotion = evaluateEmotionModel(input.emotionInput, emotionOptions);

  // ── Step 4: Cross-correlate
  const correlation = buildCrossCorrelation(attachment, pressureAffect, emotion);

  // ── Step 5: Build unified summary from all three models
  const summaryLines = buildBatchSummaryLines(attachment, pressureAffect, emotion, correlation, modeId);

  return Object.freeze({
    version: CHAT_INTELLIGENCE_ML_INDEX_VERSION,
    modeId,
    evaluatedAtMs: Date.now(),
    attachment,
    pressureAffect,
    emotion,
    correlation,
    summaryLines,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Diagnostic report builder
// Uses summarizePressureAffect and summarizeEmotionModel — resolves ts(6133)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Build a human-readable ML diagnostic report from a batch result.
 * Calls all three model summarize functions. Used by:
 * - Post-run Case File (Empire)
 * - Card Replay Audit (Phantom)
 * - Training pipeline label review
 * - Replay tooling and session inspector
 *
 * Uses: summarizePressureAffect, summarizeEmotionModel (resolves ts(6133))
 */
export function buildMlDiagnosticReport(
  batchResult: ChatMlBatchResult,
): ChatMlDiagnosticReport {
  // summarizeAttachmentAssessment uses createAttachmentModel().summarize()
  const attachmentSummary = summarizeAttachmentAssessment(batchResult.attachment);

  // summarizePressureAffect — standalone function used here — resolves ts(6133)
  const pressureSummary = summarizePressureAffect(batchResult.pressureAffect);

  // summarizeEmotionModel — standalone function used here — resolves ts(6133)
  const emotionSummary = summarizeEmotionModel(batchResult.emotion);

  // Top recommendations aggregated from cross-correlation
  const topRecommendations = buildTopRecommendations(batchResult.correlation, batchResult.emotion);

  return Object.freeze({
    version: CHAT_INTELLIGENCE_ML_INDEX_VERSION,
    generatedAtMs: Date.now(),
    attachment: Object.freeze({
      state:                    batchResult.attachment.state,
      attachment01:             Number(batchResult.attachment.attachment01),
      trust01:                  Number(batchResult.attachment.trust01),
      rivalryContamination01:   Number(batchResult.attachment.rivalryContamination01),
      summaryLines:             attachmentSummary,
    }),
    pressureAffect: Object.freeze({
      narrativeState:     batchResult.pressureAffect.narrativeState,
      pressureSeverity01: Number(batchResult.pressureAffect.pressureSeverity01),
      crowdThreat01:      Number(batchResult.pressureAffect.crowdThreat01),
      summaryLines:       pressureSummary,
    }),
    emotion: Object.freeze({
      dominantAxis:    batchResult.emotion.snapshot.dominantAxis ?? 'UNKNOWN',
      confidenceBand:  String(batchResult.emotion.snapshot.confidenceBand),
      summaryLines:    emotionSummary,
    }),
    crossCorrelation:    batchResult.correlation,
    topRecommendations,
  });
}

/**
 * Summarize a ChatMlBatchResult into flat human-readable lines.
 * Suitable for logging, replay inspection, and NPC director debug panels.
 * Uses: summarizePressureAffect, summarizeEmotionModel (same fix as above)
 */
export function summarizeMlBatchResult(
  result: ChatMlBatchResult,
): readonly string[] {
  const lines: string[] = [
    `[ML Batch v${result.version}] mode=${result.modeId} evaluatedAt=${result.evaluatedAtMs}`,
    `  attachment: state=${result.attachment.state} attachment=${round2(result.attachment.attachment01)} trust=${round2(result.attachment.trust01)} rivalry=${round2(result.attachment.rivalryContamination01)}`,
    `  pressure: state=${result.pressureAffect.narrativeState} severity=${round2(result.pressureAffect.pressureSeverity01)} crowd=${round2(result.pressureAffect.crowdThreat01)}`,
    `  emotion: dominant=${result.emotion.snapshot.dominantAxis ?? 'UNKNOWN'} confidence=${result.emotion.snapshot.confidenceBand}`,
  ];

  // Use summarizePressureAffect standalone — resolves ts(6133)
  const pressureLines = summarizePressureAffect(result.pressureAffect);
  lines.push(...pressureLines.map(line => `  [pressure] ${line}`));

  // Use summarizeEmotionModel standalone — resolves ts(6133)
  const emotionLines = summarizeEmotionModel(result.emotion);
  lines.push(...emotionLines.map(line => `  [emotion] ${line}`));

  // Cross-correlation flags
  const corr = result.correlation;
  if (corr.isCrowdSwarmImminent)          lines.push('  [ALERT] crowd swarm imminent');
  if (corr.isIsolationRisk)               lines.push('  [ALERT] isolation risk detected');
  if (corr.isPredatorySilence)            lines.push('  [ALERT] predatory silence — hold helper');
  if (corr.isRescueReadinessAligned)      lines.push('  [ACTION] rescue readiness aligned — escalate rescue');
  if (corr.isCelebrationSafe)             lines.push('  [ACTION] celebration safe — release restraint');
  if (corr.isHaterEscalationPressured)    lines.push('  [ACTION] hater escalation pressured — stage next taunt');
  if (corr.isComebackWindowClosed)        lines.push('  [ACTION] comeback window closed — hold comeback speech');
  if (corr.isSilenceAligned)             lines.push('  [ACTION] silence aligned across all models — emit nothing');

  return Object.freeze(lines);
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Mode-stratified convenience helpers
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Evaluate all three ML models with Empire mode bias applied.
 * Capital allocation, isolation, hater escalation — Empire weights.
 */
export function evaluateMlForEmpire(
  input: Omit<ChatMlBatchInput, 'modeId' | 'applyModeBias'>,
  baseOptions: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlBatchResult {
  return batchEvaluateMl({ ...input, modeId: 'EMPIRE', applyModeBias: true }, baseOptions);
}

/**
 * Evaluate all three ML models with Predator mode bias applied.
 * Deal-room predation, silence weapons, rivalry leverage.
 */
export function evaluateMlForPredator(
  input: Omit<ChatMlBatchInput, 'modeId' | 'applyModeBias'>,
  baseOptions: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlBatchResult {
  return batchEvaluateMl({ ...input, modeId: 'PREDATOR', applyModeBias: true }, baseOptions);
}

/**
 * Evaluate all three ML models with Syndicate mode bias applied.
 * Cooperative trust, rescue debt, team rescue windows.
 */
export function evaluateMlForSyndicate(
  input: Omit<ChatMlBatchInput, 'modeId' | 'applyModeBias'>,
  baseOptions: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlBatchResult {
  return batchEvaluateMl({ ...input, modeId: 'SYNDICATE', applyModeBias: true }, baseOptions);
}

/**
 * Evaluate all three ML models with Phantom mode bias applied.
 * Divergence precision, fascination with Legend ghost, curiosity dominance.
 */
export function evaluateMlForPhantom(
  input: Omit<ChatMlBatchInput, 'modeId' | 'applyModeBias'>,
  baseOptions: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlBatchResult {
  return batchEvaluateMl({ ...input, modeId: 'PHANTOM', applyModeBias: true }, baseOptions);
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Runtime factory
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Build a fully wired ChatIntelligenceMlRuntime with all three models
 * instantiated and dependency-injected. This is the correct entry point for
 * HaterResponseOrchestrator, HelperResponseOrchestrator, and ChatLearningCoordinator
 * when they maintain a long-lived ML stack across multiple evaluations per session.
 */
export function createChatIntelligenceMlRuntime(
  options: ChatIntelligenceMlRuntimeOptions = {},
): ChatIntelligenceMlRuntime {
  const attachmentModel = createAttachmentModel({
    ...options.attachment,
    authority: options.attachment?.authority ?? options.authority,
    now: options.attachment?.now ?? options.now,
  });

  const pressureAffectModel = createPressureAffectModel({
    ...options.pressureAffect,
    authority: options.pressureAffect?.authority ?? options.authority,
    now: options.pressureAffect?.now ?? options.now,
  });

  const emotionModel = createEmotionModel({
    ...options.emotion,
    authority: options.authority,
    now: options.now,
    attachmentModel,
    pressureAffectModel,
  });

  return Object.freeze({
    version: CHAT_INTELLIGENCE_ML_INDEX_VERSION,
    attachmentModel,
    pressureAffectModel,
    emotionModel,

    // ── Per-model evaluation (delegates to instance methods)
    assessAttachment(input: AttachmentModelInput): AttachmentAssessment {
      return attachmentModel.assess(input);
    },
    evaluatePressureAffect(input: PressureAffectModelInput): PressureAffectResult {
      return pressureAffectModel.evaluate(input);
    },
    evaluateEmotion(input: EmotionModelInput): EmotionModelResult {
      return emotionModel.evaluate(input);
    },

    // ── Per-model summarize (delegates to instance methods)
    summarizeAttachment(result: AttachmentAssessment): readonly string[] {
      return attachmentModel.summarize(result);
    },
    summarizePressure(result: PressureAffectResult): readonly string[] {
      return pressureAffectModel.summarize(result);
    },
    summarizeEmotion(result: EmotionModelResult): readonly string[] {
      return emotionModel.summarize(result);
    },

    // ── Batch and cross-model (delegates to module-level functions)
    batchEvaluate(input: ChatMlBatchInput): ChatMlBatchResult {
      return batchEvaluateMl(input, options);
    },
    buildDiagnosticReport(batchResult: ChatMlBatchResult): ChatMlDiagnosticReport {
      return buildMlDiagnosticReport(batchResult);
    },
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Top-level convenience evaluator
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Convenience function: evaluate the full emotion model from a single input
 * without building a runtime or batch input. Accepts optional model options.
 */
export function evaluateChatIntelligenceMl(
  input: EmotionModelInput,
  options: ChatIntelligenceMlRuntimeOptions = {},
): EmotionModelResult {
  return createChatIntelligenceMlRuntime(options).evaluateEmotion(input);
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: ML health check
// Validates that all three models can produce a result from minimal input.
// Used by the backend startup probe and the integration test harness.
// ═════════════════════════════════════════════════════════════════════════════

export interface ChatMlHealthCheckResult {
  readonly healthy: boolean;
  readonly attachment: boolean;
  readonly pressureAffect: boolean;
  readonly emotion: boolean;
  readonly errors: readonly string[];
}

/**
 * Run a minimal evaluation against all three models and confirm each can
 * produce a valid result. Safe to call in health check endpoints.
 * Uses assessAttachment, evaluatePressureAffect, evaluateEmotionModel.
 */
export function runChatMlHealthCheck(
  options: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlHealthCheckResult {
  const errors: string[] = [];
  let attachmentOk = false;
  let pressureOk   = false;
  let emotionOk    = false;

  const minimalAttachmentInput: AttachmentModelInput = {
    userId:        'HEALTH_CHECK' as any,
    roomId:        'HEALTH_CHECK' as any,
    channel:       'GLOBAL',
    relationships: Object.freeze([]),
  };

  const minimalPressureInput: PressureAffectModelInput = {
    userId:  'HEALTH_CHECK' as any,
    roomId:  'HEALTH_CHECK' as any,
    channel: 'GLOBAL',
  };

  const minimalEmotionInput: EmotionModelInput = {
    userId:  'HEALTH_CHECK' as any,
    roomId:  'HEALTH_CHECK' as any,
    channel: 'GLOBAL',
  };

  try {
    // Uses assessAttachment standalone — health check exercises the import
    const a = assessAttachment(minimalAttachmentInput, {
      authority: options.authority,
      now: options.now,
    });
    attachmentOk = !!a.model && !!a.state;
  } catch (err) {
    errors.push(`attachment: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    // Uses evaluatePressureAffect standalone — health check exercises the import
    const p = evaluatePressureAffect(minimalPressureInput, {
      authority: options.authority,
      now: options.now,
    });
    pressureOk = !!p.model && !!p.narrativeState;
  } catch (err) {
    errors.push(`pressureAffect: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    // Uses evaluateEmotionModel standalone — health check exercises the import
    const e = evaluateEmotionModel(minimalEmotionInput, {
      authority: options.authority,
      now: options.now,
    });
    emotionOk = !!e.model && !!e.snapshot;
  } catch (err) {
    errors.push(`emotion: ${err instanceof Error ? err.message : String(err)}`);
  }

  return Object.freeze({
    healthy:      attachmentOk && pressureOk && emotionOk,
    attachment:   attachmentOk,
    pressureAffect: pressureOk,
    emotion:      emotionOk,
    errors: Object.freeze(errors),
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Surface manifest
// ═════════════════════════════════════════════════════════════════════════════

export const CHAT_INTELLIGENCE_ML_SURFACE = Object.freeze({
  version: CHAT_INTELLIGENCE_ML_INDEX_VERSION,
  modules: Object.freeze({
    attachment: Object.freeze({
      className:    AttachmentModel.name,
      moduleName:   CHAT_ATTACHMENT_MODEL_MODULE_NAME,
      version:      CHAT_ATTACHMENT_MODEL_VERSION,
      runtimeLaws:  CHAT_ATTACHMENT_MODEL_RUNTIME_LAWS,
      defaultKeys:  Object.freeze(Object.keys(CHAT_ATTACHMENT_MODEL_DEFAULTS)),
    }),
    pressureAffect: Object.freeze({
      className:    PressureAffectModel.name,
      moduleName:   CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME,
      version:      CHAT_PRESSURE_AFFECT_MODEL_VERSION,
      runtimeLaws:  CHAT_PRESSURE_AFFECT_MODEL_RUNTIME_LAWS,
      defaultKeys:  Object.freeze(Object.keys(CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS)),
    }),
    emotion: Object.freeze({
      className:    EmotionModel.name,
      moduleName:   CHAT_EMOTION_MODEL_MODULE_NAME,
      version:      CHAT_EMOTION_MODEL_VERSION,
      runtimeLaws:  CHAT_EMOTION_MODEL_RUNTIME_LAWS,
      defaultKeys:  Object.freeze(Object.keys(CHAT_EMOTION_MODEL_DEFAULTS)),
    }),
  }),
  modeIds: Object.freeze(Object.keys(CHAT_ML_MODE_BIASES) as ChatMlModeId[]),
  exports: Object.freeze([
    // AttachmentModel
    'AttachmentModel', 'createAttachmentModel', 'assessAttachment',
    'summarizeAttachmentAssessment',
    'CHAT_ATTACHMENT_MODEL_MODULE_NAME', 'CHAT_ATTACHMENT_MODEL_VERSION',
    'CHAT_ATTACHMENT_MODEL_DEFAULTS', 'CHAT_ATTACHMENT_MODEL_RUNTIME_LAWS',
    // PressureAffectModel
    'PressureAffectModel', 'createPressureAffectModel',
    'evaluatePressureAffect', 'summarizePressureAffect',
    'CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME', 'CHAT_PRESSURE_AFFECT_MODEL_VERSION',
    'CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS', 'CHAT_PRESSURE_AFFECT_MODEL_RUNTIME_LAWS',
    // EmotionModel
    'EmotionModel', 'createEmotionModel',
    'evaluateEmotionModel', 'summarizeEmotionModel',
    'CHAT_EMOTION_MODEL_MODULE_NAME', 'CHAT_EMOTION_MODEL_VERSION',
    'CHAT_EMOTION_MODEL_DEFAULTS', 'CHAT_EMOTION_MODEL_RUNTIME_LAWS',
    // Runtime and batch
    'createChatIntelligenceMlRuntime', 'evaluateChatIntelligenceMl',
    'batchEvaluateMl', 'buildMlDiagnosticReport', 'summarizeMlBatchResult',
    // Standalone helpers
    'evaluateMlAttachmentStandalone', 'evaluateMlPressureStandalone', 'evaluateMlEmotionStandalone',
    // Mode-stratified
    'evaluateMlForEmpire', 'evaluateMlForPredator', 'evaluateMlForSyndicate', 'evaluateMlForPhantom',
    'CHAT_ML_MODE_BIASES',
    // Health check
    'runChatMlHealthCheck',
    // Manifests
    'CHAT_INTELLIGENCE_ML_SURFACE', 'CHAT_INTELLIGENCE_ML_RUNTIME_LAWS',
    'CHAT_INTELLIGENCE_ML_INDEX_VERSION',
  ] as const),
});

// ═════════════════════════════════════════════════════════════════════════════
// MARK: Internal helpers (not exported)
// ═════════════════════════════════════════════════════════════════════════════

function buildBatchSummaryLines(
  attachment: AttachmentAssessment,
  pressure: PressureAffectResult,
  emotion: EmotionModelResult,
  correlation: ChatMlCrossCorrelation,
  modeId: ChatMlModeId,
): readonly string[] {
  const lines: string[] = [
    `mode=${modeId} attachment=${attachment.state} pressure=${pressure.narrativeState} emotion=${emotion.snapshot.dominantAxis ?? 'UNKNOWN'}`,
  ];

  if (correlation.isCrowdSwarmImminent)      lines.push('CROWD_SWARM_IMMINENT');
  if (correlation.isRescueReadinessAligned)  lines.push('RESCUE_ALIGNED');
  if (correlation.isPredatorySilence)        lines.push('PREDATORY_SILENCE');
  if (correlation.isIsolationRisk)           lines.push('ISOLATION_RISK');
  if (correlation.isCelebrationSafe)         lines.push('CELEBRATION_SAFE');
  if (correlation.isHaterEscalationPressured) lines.push('HATER_ESCALATION_PRESSURED');
  if (correlation.isComebackWindowClosed)    lines.push('COMEBACK_WINDOW_CLOSED');
  if (correlation.isSilenceAligned)          lines.push('SILENCE_ALIGNED');

  return Object.freeze(lines);
}

function buildTopRecommendations(
  correlation: ChatMlCrossCorrelation,
  emotion: EmotionModelResult,
): readonly string[] {
  const recs: string[] = [];

  if (correlation.isRescueReadinessAligned)
    recs.push('Escalate rescue — attachment, desperation, and pressure all aligned');
  if (correlation.isCrowdSwarmImminent)
    recs.push('Stage crowd suppression — swarm risk is HIGH');
  if (correlation.isPredatorySilence)
    recs.push('Hold all NPCs — predatory silence is the correct weapon');
  if (correlation.isIsolationRisk)
    recs.push('Send ambient witness first — isolation risk, no rescue gravity');
  if (correlation.isCelebrationSafe)
    recs.push('Release celebration restraint — trust and relief aligned');
  if (correlation.isHaterEscalationPressured)
    recs.push('Stage next hater taunt — intimidation and rivalry aligned');
  if (correlation.isComebackWindowClosed)
    recs.push('Hold comeback speech — pressure too high, confidence too low');
  if (correlation.isSilenceAligned)
    recs.push('All three models agree: emit nothing this tick');
  if (emotion.recommendation.shouldEscalateHelper)
    recs.push('Escalate helper — emotion model recommends intervention');
  if (emotion.recommendation.shouldFireComebackSpeech && !correlation.isComebackWindowClosed)
    recs.push('Fire comeback speech — emotion model ready, pressure clear');

  return Object.freeze(recs.length ? recs : ['No priority recommendations — nominal state']);
}

function round2(value: number | unknown): string {
  return typeof value === 'number' ? (Math.round(Number(value) * 100) / 100).toFixed(2) : '0.00';
}