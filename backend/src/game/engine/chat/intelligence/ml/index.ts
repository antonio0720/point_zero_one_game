/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT INTELLIGENCE ML BARREL
 * FILE: backend/src/game/engine/chat/intelligence/ml/index.ts
 * VERSION: 2026.03.22-backend-chat-intelligence-ml-index.v6
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical public surface for the backend chat ML lane.
 *
 * This index is intentionally deeper than a passive barrel. It does six jobs:
 * 1. Re-exports the full public surfaces of AttachmentModel, PressureAffectModel,
 *    and EmotionModel so callers can import from one authoritative home.
 * 2. Exposes runtime-safe standalone helpers that exercise the imported model
 *    functions directly rather than leaving them as dead import surface.
 * 3. Builds one authoritative runtime that threads attachment and pressure into
 *    emotion without making downstream callers manually rehydrate dependencies.
 * 4. Provides coordinated batch evaluation, cross-model correlation, advisory,
 *    and audit surfaces for orchestration, replay, training, and case files.
 * 5. Publishes mode-biased presets for Empire, Predator, Syndicate, Phantom,
 *    Lobby, and Post-Run without flattening the underlying model contracts.
 * 6. Publishes a surface manifest and helper registry for tooling, linting,
 *    import discipline, and future codegen.
 *
 * Import discipline
 * -----------------
 * Every import in this file is used by either:
 * - a runtime helper,
 * - a batch/audit/correlation routine,
 * - a typed public registry, or
 * - a surface manifest entrypoint object.
 *
 * This file does not rely on unused local aliases.
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Full re-export surface
// ─────────────────────────────────────────────────────────────────────────────

export * from './AttachmentModel';
export * from './PressureAffectModel';
export * from './EmotionModel';

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Local imports used by runtime helpers and orchestration
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AttachmentAffinityCandidate,
  AttachmentAssessment,
  AttachmentBatchInput,
  AttachmentBatchResult,
  AttachmentCandidateAssessment,
  AttachmentDiagnosticReport,
  AttachmentModelApi,
  AttachmentModelInput,
  AttachmentModelOptions,
} from './AttachmentModel';

import {
  CHAT_ATTACHMENT_MODEL_DEFAULTS,
  CHAT_ATTACHMENT_MODEL_MODULE_NAME,
  CHAT_ATTACHMENT_MODEL_RUNTIME_LAWS,
  CHAT_ATTACHMENT_MODEL_VERSION,
  assessAttachment,
  assessAttachmentBatch,
  assessAttachmentCandidate,
  buildAttachmentDiagnosticReport,
  buildAttachmentOperatorPayload,
  compareAttachmentAssessments,
  createAttachmentModel,
  scoreAttachmentState,
  summarizeAttachmentAssessment,
  summarizeAttachmentCandidate,
  summarizeAttachmentOperatorView,
} from './AttachmentModel';

import type {
  PressureAffectBatchInput,
  PressureAffectBatchResult,
  PressureAffectComparison,
  PressureAffectDetailedResult,
  PressureAffectDiagnosticReport,
  PressureAffectModelApi,
  PressureAffectModelInput,
  PressureAffectModelOptions,
  PressureAffectModeId,
  PressureAffectOperatorPacket,
  PressureAffectResult,
  PressureAffectTrajectoryResult,
} from './PressureAffectModel';

import {
  CHAT_PRESSURE_AFFECT_MODE_PROFILES,
  CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS,
  CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME,
  CHAT_PRESSURE_AFFECT_MODEL_RUNTIME_LAWS,
  CHAT_PRESSURE_AFFECT_MODEL_VERSION,
  buildPressureAffectDiagnosticReport,
  buildPressureAffectOperatorPacket,
  buildPressureAffectPolicyTrace,
  buildPressureAffectReplayFrames,
  buildPressureAffectRiskEnvelope,
  buildPressureAffectSignalDigest,
  comparePressureAffectResults,
  createPressureAffectModel,
  evaluatePressureAffect,
  evaluatePressureAffectBatch,
  evaluatePressureAffectDetailed,
  evaluatePressureAffectTrajectory,
  listPressureAffectSurfaceManifest,
  resolvePressureAffectModeProfile,
  summarizePressureAffect,
} from './PressureAffectModel';

import type {
  EmotionBatchInput,
  EmotionBatchResult,
  EmotionModelApi,
  EmotionModelDiagnosticReport,
  EmotionModelInput,
  EmotionModelOptions,
  EmotionModelResult,
  EmotionOperatorPayload,
} from './EmotionModel';

import {
  CHAT_EMOTION_MODEL_DEFAULTS,
  CHAT_EMOTION_MODEL_MODULE_NAME,
  CHAT_EMOTION_MODEL_RUNTIME_LAWS,
  CHAT_EMOTION_MODEL_VERSION,
  buildEmotionDiagnosticReport,
  buildEmotionOperatorPayload,
  compareEmotionModelResults,
  createEmotionModel,
  evaluateEmotionBatch,
  evaluateEmotionModel,
  summarizeEmotionBatchResult,
  summarizeEmotionModel,
  summarizeEmotionOperatorView,
} from './EmotionModel';

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Module identity
// ─────────────────────────────────────────────────────────────────────────────

export const CHAT_INTELLIGENCE_ML_INDEX_MODULE_NAME =
  'PZO_BACKEND_CHAT_INTELLIGENCE_ML_INDEX' as const;

export const CHAT_INTELLIGENCE_ML_INDEX_VERSION =
  '2026.03.22-backend-chat-intelligence-ml-index.v6' as const;

export const CHAT_INTELLIGENCE_ML_RUNTIME_LAWS = Object.freeze([
  'The ML index must expose the full stable public surfaces of attachment, pressure-affect, and emotion.',
  'The index must provide one authoritative runtime that threads attachment and pressure into the emotion lane.',
  'Index helpers must compose models without flattening their contracts or rewriting their ownership.',
  'Standalone helpers must remain safe for replay, diagnostics, fixtures, and training pipelines.',
  'Batch evaluation must correlate all three model outputs before returning coordination advice.',
  'Mode bias may tune defaults, but may not mutate the public contracts of the underlying models.',
  'The surface manifest must stay explicit so tooling can audit what the barrel truly exposes.',
  'Every import in this file must be consumed by a runtime helper, registry, or public constant.',
] as const);

export type ChatMlModelId =
  | 'ATTACHMENT'
  | 'PRESSURE_AFFECT'
  | 'EMOTION'
  | 'INDEX';

export type ChatMlModeId =
  | 'EMPIRE'
  | 'PREDATOR'
  | 'SYNDICATE'
  | 'PHANTOM'
  | 'LOBBY'
  | 'POST_RUN'
  | 'UNKNOWN';

export type ChatMlPublicKind =
  | 'CONST'
  | 'TYPE'
  | 'CLASS'
  | 'FUNCTION'
  | 'RUNTIME'
  | 'MANIFEST'
  | 'REGISTRY';

export type ChatMlAvailability = 'VALUE' | 'TYPE' | 'BOTH';

export interface ChatIntelligenceMlSurfaceManifestEntry {
  readonly exportName: string;
  readonly model: ChatMlModelId;
  readonly kind: ChatMlPublicKind;
  readonly availability: ChatMlAvailability;
  readonly summary: string;
  readonly tags: readonly string[];
}

export interface ChatMlModeBiasNotes {
  readonly modeId: ChatMlModeId;
  readonly notes: readonly string[];
}

type RelaxConstDefaults<T> = {
  readonly [K in keyof T]?: T[K] extends number
    ? number
    : T[K] extends string
      ? string
      : T[K] extends boolean
        ? boolean
        : T[K] extends readonly unknown[]
          ? readonly unknown[]
          : T[K] extends Readonly<Record<string, unknown>>
            ? RelaxConstDefaults<T[K]>
            : T[K];
};

type AttachmentDefaultOverrides = RelaxConstDefaults<typeof CHAT_ATTACHMENT_MODEL_DEFAULTS>;
type PressureDefaultOverrides = RelaxConstDefaults<typeof CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS>;
type EmotionDefaultOverrides = RelaxConstDefaults<typeof CHAT_EMOTION_MODEL_DEFAULTS>;

export interface ChatMlModeBias {
  readonly modeId: ChatMlModeId;
  readonly attachmentDefaults?: AttachmentDefaultOverrides;
  readonly pressureDefaults?: PressureDefaultOverrides;
  readonly emotionDefaults?: EmotionDefaultOverrides;
  readonly notes: readonly string[];
}

export interface ChatMlCrossCorrelation {
  readonly isRescueGravityAlignedWithAttachment: boolean;
  readonly isHaterEscalationPressured: boolean;
  readonly isComebackWindowClosed: boolean;
  readonly isCelebrationSafe: boolean;
  readonly isIsolationRisk: boolean;
  readonly isPredatorySilence: boolean;
  readonly isCrowdSwarmImminent: boolean;
  readonly isSilenceAligned: boolean;
  readonly isAttachmentUnderPressure: boolean;
  readonly isRescueReadinessAligned: boolean;
  readonly attachmentStateScore01: number;
  readonly pressureDominance01: number;
  readonly emotionalStability01: number;
}

export interface ChatMlUnifiedAdvice {
  readonly primaryPolicy:
    | 'RECOVERY'
    | 'ESCALATION'
    | 'SILENCE'
    | 'CEREMONY'
    | 'STABILIZE'
    | 'WATCH';
  readonly recommendedNextActions: readonly string[];
  readonly cautionFlags: readonly string[];
  readonly rationale: readonly string[];
}

export interface ChatMlBatchInput {
  readonly attachmentInput: AttachmentModelInput;
  readonly pressureInput: PressureAffectModelInput;
  readonly emotionInput: EmotionModelInput;
  readonly modeId?: ChatMlModeId;
  readonly applyModeBias?: boolean;
}

export interface ChatMlBatchResult {
  readonly version: typeof CHAT_INTELLIGENCE_ML_INDEX_VERSION;
  readonly modeId: ChatMlModeId;
  readonly evaluatedAtMs: number;
  readonly attachment: AttachmentAssessment;
  readonly pressureAffect: PressureAffectResult;
  readonly emotion: EmotionModelResult;
  readonly correlation: ChatMlCrossCorrelation;
  readonly advice: ChatMlUnifiedAdvice;
  readonly summaryLines: readonly string[];
}

export interface ChatMlDiagnosticReport {
  readonly version: typeof CHAT_INTELLIGENCE_ML_INDEX_VERSION;
  readonly generatedAtMs: number;
  readonly attachment: {
    readonly state: AttachmentAssessment['state'];
    readonly attachment01: number;
    readonly trust01: number;
    readonly rivalryContamination01: number;
    readonly helperAffinity01: number;
    readonly summaryLines: readonly string[];
  };
  readonly pressureAffect: {
    readonly narrativeState: PressureAffectResult['narrativeState'];
    readonly pressureSeverity01: number;
    readonly crowdThreat01: number;
    readonly publicExposure01: number;
    readonly summaryLines: readonly string[];
  };
  readonly emotion: {
    readonly dominantAxis: string;
    readonly primaryPolicy: string;
    readonly confidenceBand: string;
    readonly summaryLines: readonly string[];
  };
  readonly crossCorrelation: ChatMlCrossCorrelation;
  readonly advice: ChatMlUnifiedAdvice;
  readonly topRecommendations: readonly string[];
}

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

  assessAttachment(input: AttachmentModelInput): AttachmentAssessment;
  summarizeAttachment(result: AttachmentAssessment): readonly string[];
  assessAttachmentCandidate(candidate: AttachmentAffinityCandidate): AttachmentCandidateAssessment;
  summarizeAttachmentCandidate(candidate: AttachmentAffinityCandidate): readonly string[];
  assessAttachmentBatch(input: AttachmentBatchInput): AttachmentBatchResult;
  buildAttachmentDiagnosticReport(result: AttachmentAssessment): AttachmentDiagnosticReport;
  buildAttachmentOperatorPayload(result: AttachmentAssessment): ReturnType<typeof buildAttachmentOperatorPayload>;
  summarizeAttachmentOperatorView(result: AttachmentAssessment): readonly string[];
  scoreAttachmentState(result: AttachmentAssessment): ReturnType<typeof scoreAttachmentState>;

  evaluatePressureAffect(input: PressureAffectModelInput): PressureAffectResult;
  summarizePressure(result: PressureAffectResult): readonly string[];
  evaluatePressureAffectDetailed(
    input: PressureAffectModelInput,
    modeHint?: PressureAffectModeId,
  ): PressureAffectDetailedResult;
  evaluatePressureAffectBatch(input: PressureAffectBatchInput): PressureAffectBatchResult;
  comparePressureAffectResults(
    previous: PressureAffectResult,
    next: PressureAffectResult,
  ): PressureAffectComparison;
  evaluatePressureAffectTrajectory(
    inputs: readonly PressureAffectModelInput[],
    modeHint?: PressureAffectModeId,
  ): PressureAffectTrajectoryResult;
  buildPressureAffectReplayFrames(
    trajectory: PressureAffectTrajectoryResult,
  ): ReturnType<typeof buildPressureAffectReplayFrames>;
  buildPressureAffectDiagnosticReport(
    result: PressureAffectResult,
    input: PressureAffectModelInput,
    modeHint?: PressureAffectModeId,
  ): PressureAffectDiagnosticReport;
  buildPressureAffectOperatorPacket(
    result: PressureAffectResult,
    input: PressureAffectModelInput,
    modeHint?: PressureAffectModeId,
  ): PressureAffectOperatorPacket;

  evaluateEmotion(input: EmotionModelInput): EmotionModelResult;
  summarizeEmotion(result: EmotionModelResult): readonly string[];
  buildEmotionOperatorPayload(result: EmotionModelResult): EmotionOperatorPayload;
  buildEmotionDiagnosticReport(result: EmotionModelResult): EmotionModelDiagnosticReport;
  evaluateEmotionBatch(input: EmotionBatchInput): EmotionBatchResult;
  compareEmotionResults(
    previous: EmotionModelResult,
    next: EmotionModelResult,
  ): readonly string[];
  summarizeEmotionOperatorView(result: EmotionModelResult): readonly string[];
  summarizeEmotionBatchResult(result: EmotionBatchResult): readonly string[];

  batchEvaluate(input: ChatMlBatchInput): ChatMlBatchResult;
  summarizeBatchResult(result: ChatMlBatchResult): readonly string[];
  buildDiagnosticReport(batchResult: ChatMlBatchResult): ChatMlDiagnosticReport;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Default merge helpers
// ─────────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMergeDefaults<T extends Record<string, unknown>>(
  base: T,
  ...layers: readonly (Record<string, unknown> | undefined)[]
): T {
  const output: Record<string, unknown> = { ...base };

  for (const layer of layers) {
    if (!layer) {
      continue;
    }
    for (const [key, value] of Object.entries(layer)) {
      const current = output[key];
      if (isRecord(current) && isRecord(value)) {
        output[key] = deepMergeDefaults(current, value);
        continue;
      }
      output[key] = value;
    }
  }

  return output as T;
}

function mergeAttachmentDefaults(
  ...layers: readonly (AttachmentDefaultOverrides | AttachmentModelOptions['defaults'] | undefined)[]
): AttachmentModelOptions['defaults'] {
  return deepMergeDefaults(
    CHAT_ATTACHMENT_MODEL_DEFAULTS as unknown as Record<string, unknown>,
    ...(layers as readonly (Record<string, unknown> | undefined)[]),
  ) as AttachmentModelOptions['defaults'];
}

function mergePressureDefaults(
  ...layers: readonly (PressureDefaultOverrides | PressureAffectModelOptions['defaults'] | undefined)[]
): PressureAffectModelOptions['defaults'] {
  return deepMergeDefaults(
    CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS as unknown as Record<string, unknown>,
    ...(layers as readonly (Record<string, unknown> | undefined)[]),
  ) as PressureAffectModelOptions['defaults'];
}

function mergeEmotionDefaults(
  ...layers: readonly (EmotionDefaultOverrides | EmotionModelOptions['defaults'] | undefined)[]
): EmotionModelOptions['defaults'] {
  return deepMergeDefaults(
    CHAT_EMOTION_MODEL_DEFAULTS as unknown as Record<string, unknown>,
    ...(layers as readonly (Record<string, unknown> | undefined)[]),
  ) as EmotionModelOptions['defaults'];
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Mode bias registry
// ─────────────────────────────────────────────────────────────────────────────

export const CHAT_ML_MODE_BIASES: Readonly<Record<ChatMlModeId, ChatMlModeBias>> =
  Object.freeze({
    EMPIRE: Object.freeze({
      modeId: 'EMPIRE' as const,
      attachmentDefaults: Object.freeze({
        trustRepairDampening: 0.72,
        rivalryPenaltyWeight: 0.14,
        helperAffinityThreshold: 0.58,
        publicExposureBonus: 0.08,
      }),
      pressureDefaults: Object.freeze({
        pressureIntimidationWeight: 0.22,
        roomHeatWeight: 0.12,
        confidenceRepairDampening: 0.64,
        channelExposureBias: Object.freeze({
          GLOBAL: 0.14,
          SYNDICATE: 0.08,
          DEAL_ROOM: 0.1,
          LOBBY: 0.03,
        }),
      }),
      emotionDefaults: Object.freeze({
        celebrationRestraintThreshold: 0.42,
        haterEscalationThreshold: 0.52,
        trustAttachmentBlend: 0.43,
      }),
      notes: Object.freeze([
        'Empire biases for isolation, visibility, and hostile capital attention.',
        'Trust repairs slower while crowd-reactive celebration restrains earlier.',
      ]),
    }),

    PREDATOR: Object.freeze({
      modeId: 'PREDATOR' as const,
      attachmentDefaults: Object.freeze({
        dealRoomTrustPenalty: 0.14,
        contemptPenaltyWeight: 0.18,
        rivalryOverrideThreshold: 0.68,
        predatoryQuietPenalty: 0.11,
      }),
      pressureDefaults: Object.freeze({
        predatoryStateThreshold: 0.58,
        crowdPileOnThreshold: 0.52,
        silenceSuitabilityThreshold: 0.64,
        channelExposureBias: Object.freeze({
          GLOBAL: 0.15,
          SYNDICATE: 0.07,
          DEAL_ROOM: 0.15,
          LOBBY: 0.03,
        }),
      }),
      emotionDefaults: Object.freeze({
        dealRoomPredationBias: 0.14,
        silencePreferenceThreshold: 0.55,
        haterEscalationThreshold: 0.54,
      }),
      notes: Object.freeze([
        'Predator biases for deal-room predation, tactical silence, and leverage extraction.',
        'Quiet is treated as potentially dangerous rather than calming.',
      ]),
    }),

    SYNDICATE: Object.freeze({
      modeId: 'SYNDICATE' as const,
      attachmentDefaults: Object.freeze({
        syndicateTrustBonus: 0.12,
        trustWeight: 0.28,
        rescueDebtWeight: 0.22,
        helperAffinityThreshold: 0.48,
        supportEchoWeight: 0.08,
      }),
      pressureDefaults: Object.freeze({
        desperationRescueWeight: 0.26,
        reliefHelperWeight: 0.22,
        confidenceRecoveryWeight: 0.18,
      }),
      emotionDefaults: Object.freeze({
        trustAttachmentBlend: 0.52,
        trustReliefBlend: 0.19,
        helperRestraintThreshold: 0.42,
        comebackThreshold: 0.51,
      }),
      notes: Object.freeze([
        'Syndicate biases for rescue debt, continuity trust, and team-safe intervention.',
        'Helper escalation is allowed earlier because cooperative continuity matters more.',
      ]),
    }),

    PHANTOM: Object.freeze({
      modeId: 'PHANTOM' as const,
      attachmentDefaults: Object.freeze({
        fascinationWeight: 0.22,
        familiarityWeight: 0.18,
        helperAffinityThreshold: 0.62,
      }),
      pressureDefaults: Object.freeze({
        confidenceStabilityWeight: 0.26,
        comebackConfidenceThreshold: 0.61,
        volatilityThreshold: 0.72,
      }),
      emotionDefaults: Object.freeze({
        curiosityWindowBlend: 0.34,
        confidenceRepairBlend: 0.36,
        celebrationRestraintThreshold: 0.52,
      }),
      notes: Object.freeze([
        'Phantom biases for precision, curiosity, and disciplined volatility tolerance.',
        'Curiosity and confidence repair are allowed more influence than blunt crowd heat.',
      ]),
    }),

    LOBBY: Object.freeze({
      modeId: 'LOBBY' as const,
      attachmentDefaults: Object.freeze({}),
      pressureDefaults: Object.freeze({}),
      emotionDefaults: Object.freeze({
        silencePreferenceThreshold: 0.6,
      }),
      notes: Object.freeze([
        'Lobby stays close to raw defaults and acts as a low-heat staging lane.',
      ]),
    }),

    POST_RUN: Object.freeze({
      modeId: 'POST_RUN' as const,
      attachmentDefaults: Object.freeze({
        familiarityWeight: 0.22,
        trustWeight: 0.28,
        continuityMemoryBonus: 0.1,
      }),
      pressureDefaults: Object.freeze({
        reliefStabilizerWeight: 0.34,
        confidenceRecoveryWeight: 0.26,
        calmThreshold: 0.27,
      }),
      emotionDefaults: Object.freeze({
        comebackThreshold: 0.48,
        celebrationRestraintThreshold: 0.58,
        sequenceRecoveryBlend: 0.39,
      }),
      notes: Object.freeze([
        'Post-run biases for continuity recall, relief, and disciplined comeback repair.',
      ]),
    }),

    UNKNOWN: Object.freeze({
      modeId: 'UNKNOWN' as const,
      attachmentDefaults: Object.freeze({}),
      pressureDefaults: Object.freeze({}),
      emotionDefaults: Object.freeze({}),
      notes: Object.freeze(['Unknown mode falls back to model-native defaults.']),
    }),
  });

export const CHAT_ML_MODE_BIAS_NOTES: readonly ChatMlModeBiasNotes[] = Object.freeze(
  Object.values(CHAT_ML_MODE_BIASES).map((entry) =>
    Object.freeze({
      modeId: entry.modeId,
      notes: entry.notes,
    }),
  ),
);

export function getChatMlModeBias(modeId: ChatMlModeId | undefined): ChatMlModeBias {
  return CHAT_ML_MODE_BIASES[modeId ?? 'UNKNOWN'] ?? CHAT_ML_MODE_BIASES.UNKNOWN;
}

export function listChatMlModeBiasNotes(): readonly ChatMlModeBiasNotes[] {
  return CHAT_ML_MODE_BIAS_NOTES;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Surface manifest
// ─────────────────────────────────────────────────────────────────────────────

function createSurfaceEntry(
  exportName: string,
  model: ChatMlModelId,
  kind: ChatMlPublicKind,
  availability: ChatMlAvailability,
  summary: string,
  tags: readonly string[],
): ChatIntelligenceMlSurfaceManifestEntry {
  return Object.freeze({
    exportName,
    model,
    kind,
    availability,
    summary,
    tags: Object.freeze([...tags]),
  });
}

const ATTACHMENT_SURFACE = Object.freeze([
  createSurfaceEntry('CHAT_ATTACHMENT_MODEL_MODULE_NAME', 'ATTACHMENT', 'CONST', 'VALUE', 'Attachment module identity.', ['attachment', 'identity']),
  createSurfaceEntry('CHAT_ATTACHMENT_MODEL_VERSION', 'ATTACHMENT', 'CONST', 'VALUE', 'Attachment module version.', ['attachment', 'version']),
  createSurfaceEntry('CHAT_ATTACHMENT_MODEL_RUNTIME_LAWS', 'ATTACHMENT', 'CONST', 'VALUE', 'Attachment runtime laws.', ['attachment', 'laws']),
  createSurfaceEntry('CHAT_ATTACHMENT_MODEL_DEFAULTS', 'ATTACHMENT', 'CONST', 'VALUE', 'Attachment default tuning.', ['attachment', 'defaults']),
  createSurfaceEntry('CHAT_ATTACHMENT_CHANNEL_ARCHETYPES', 'ATTACHMENT', 'CONST', 'VALUE', 'Attachment channel archetype registry.', ['attachment', 'channel']),
  createSurfaceEntry('CHAT_ATTACHMENT_STATE_ORDER', 'ATTACHMENT', 'CONST', 'VALUE', 'Attachment state ordering.', ['attachment', 'state']),
  createSurfaceEntry('CHAT_ATTACHMENT_RISK_LABELS', 'ATTACHMENT', 'CONST', 'VALUE', 'Attachment risk labels.', ['attachment', 'risk']),
  createSurfaceEntry('CHAT_ATTACHMENT_BATCH_VERSION', 'ATTACHMENT', 'CONST', 'VALUE', 'Attachment batch identity.', ['attachment', 'batch']),
  createSurfaceEntry('CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS', 'ATTACHMENT', 'CONST', 'VALUE', 'Attachment feature lookup keys.', ['attachment', 'feature']),
  createSurfaceEntry('CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS', 'ATTACHMENT', 'CONST', 'VALUE', 'Attachment profile lookup keys.', ['attachment', 'profile']),
  createSurfaceEntry('CHAT_ATTACHMENT_REASON_LIBRARY', 'ATTACHMENT', 'CONST', 'VALUE', 'Attachment narrative reason registry.', ['attachment', 'reason']),
  createSurfaceEntry('AttachmentModel', 'ATTACHMENT', 'CLASS', 'VALUE', 'Attachment model runtime class.', ['attachment', 'class']),
  createSurfaceEntry('AttachmentNarrativeState', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment narrative state contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentRiskLabel', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment risk label contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentChannelArchetype', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment channel archetype contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentTrend', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment trend contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentCandidateGrade', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment candidate grade contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentModelInput', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment input contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentSignalProfile', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment signal profile contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentLearningBias', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment learning bias contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentFeatureBias', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment feature bias contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentCandidateTraceItem', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment candidate trace contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentAffinityCandidate', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment candidate contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentAssessment', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment result contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentCandidateAssessment', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment candidate assessment contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentAggregateProfile', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment aggregate contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentDiagnosticTopCandidate', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment diagnostic top candidate contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentDiagnosticReport', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment diagnostic report contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentBatchInput', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment batch input contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentBatchResult', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment batch result contract.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentModelOptions', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment model options.', ['attachment', 'type']),
  createSurfaceEntry('AttachmentModelApi', 'ATTACHMENT', 'TYPE', 'TYPE', 'Attachment model API.', ['attachment', 'type']),
  createSurfaceEntry('createAttachmentModel', 'ATTACHMENT', 'FUNCTION', 'VALUE', 'Attachment model factory.', ['attachment', 'factory']),
  createSurfaceEntry('assessAttachment', 'ATTACHMENT', 'FUNCTION', 'VALUE', 'Standalone attachment evaluation.', ['attachment', 'evaluate']),
  createSurfaceEntry('summarizeAttachmentAssessment', 'ATTACHMENT', 'FUNCTION', 'VALUE', 'Standalone attachment summary.', ['attachment', 'summarize']),
  createSurfaceEntry('assessAttachmentCandidate', 'ATTACHMENT', 'FUNCTION', 'VALUE', 'Candidate-only attachment scoring.', ['attachment', 'candidate']),
  createSurfaceEntry('summarizeAttachmentCandidate', 'ATTACHMENT', 'FUNCTION', 'VALUE', 'Candidate summary helper.', ['attachment', 'candidate']),
  createSurfaceEntry('assessAttachmentBatch', 'ATTACHMENT', 'FUNCTION', 'VALUE', 'Batch attachment scoring.', ['attachment', 'batch']),
  createSurfaceEntry('buildAttachmentDiagnosticReport', 'ATTACHMENT', 'FUNCTION', 'VALUE', 'Attachment diagnostic report builder.', ['attachment', 'diagnostic']),
  createSurfaceEntry('compareAttachmentAssessments', 'ATTACHMENT', 'FUNCTION', 'VALUE', 'Attachment comparison helper.', ['attachment', 'compare']),
  createSurfaceEntry('buildAttachmentOperatorPayload', 'ATTACHMENT', 'FUNCTION', 'VALUE', 'Attachment operator payload builder.', ['attachment', 'operator']),
  createSurfaceEntry('scoreAttachmentState', 'ATTACHMENT', 'FUNCTION', 'VALUE', 'Attachment composite score helper.', ['attachment', 'score']),
  createSurfaceEntry('summarizeAttachmentOperatorView', 'ATTACHMENT', 'FUNCTION', 'VALUE', 'Attachment operator summary helper.', ['attachment', 'operator']),
]);

const PRESSURE_SURFACE = Object.freeze([
  createSurfaceEntry('CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME', 'PRESSURE_AFFECT', 'CONST', 'VALUE', 'Pressure-affect module identity.', ['pressure', 'identity']),
  createSurfaceEntry('CHAT_PRESSURE_AFFECT_MODEL_VERSION', 'PRESSURE_AFFECT', 'CONST', 'VALUE', 'Pressure-affect module version.', ['pressure', 'version']),
  createSurfaceEntry('CHAT_PRESSURE_AFFECT_MODEL_RUNTIME_LAWS', 'PRESSURE_AFFECT', 'CONST', 'VALUE', 'Pressure-affect runtime laws.', ['pressure', 'laws']),
  createSurfaceEntry('CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS', 'PRESSURE_AFFECT', 'CONST', 'VALUE', 'Pressure-affect default tuning.', ['pressure', 'defaults']),
  createSurfaceEntry('CHAT_PRESSURE_AFFECT_MODE_PROFILES', 'PRESSURE_AFFECT', 'CONST', 'VALUE', 'Pressure-affect mode profiles.', ['pressure', 'mode']),
  createSurfaceEntry('CHAT_PRESSURE_AFFECT_SURFACE_MANIFEST', 'PRESSURE_AFFECT', 'CONST', 'VALUE', 'Pressure-affect internal surface manifest.', ['pressure', 'manifest']),
  createSurfaceEntry('PressureAffectModel', 'PRESSURE_AFFECT', 'CLASS', 'VALUE', 'Pressure-affect runtime class.', ['pressure', 'class']),
  createSurfaceEntry('PressureNarrativeState', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure narrative state contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectModelInput', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure input contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAxisBreakdown', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure breakdown contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectPolicyFlags', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure policy flags contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectRecommendation', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure recommendation contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectResult', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure result contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectModelOptions', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure model options.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectModelApi', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure model API.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectModeId', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure mode contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureExposureClass', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure exposure classification.', ['pressure', 'type']),
  createSurfaceEntry('PressureStabilizerClass', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure stabilizer classification.', ['pressure', 'type']),
  createSurfaceEntry('PressureCrowdClass', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure crowd classification.', ['pressure', 'type']),
  createSurfaceEntry('PressureDominantAxis', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure dominant axis contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectScenario', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure scenario contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectModeProfile', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure mode profile contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAxisSnapshot', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure axis snapshot contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectSignalDigest', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure signal digest contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectRiskEnvelope', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure risk envelope contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectPolicyTrace', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure policy trace contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectDiagnosticReport', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure diagnostic report contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectOperatorPacket', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure operator packet contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectDetailedResult', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure detailed result contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectBatchInput', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure batch input contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectBatchAggregate', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure batch aggregate contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectBatchResult', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure batch result contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectComparison', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure comparison contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectTrajectoryPoint', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure trajectory point contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectTrajectoryResult', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure trajectory result contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectReplayFrame', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure replay frame contract.', ['pressure', 'type']),
  createSurfaceEntry('PressureAffectSurfaceManifestEntry', 'PRESSURE_AFFECT', 'TYPE', 'TYPE', 'Pressure surface manifest entry contract.', ['pressure', 'type']),
  createSurfaceEntry('createPressureAffectModel', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Pressure model factory.', ['pressure', 'factory']),
  createSurfaceEntry('evaluatePressureAffect', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Standalone pressure evaluation.', ['pressure', 'evaluate']),
  createSurfaceEntry('summarizePressureAffect', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Standalone pressure summary.', ['pressure', 'summarize']),
  createSurfaceEntry('resolvePressureAffectModeProfile', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Pressure mode profile resolver.', ['pressure', 'mode']),
  createSurfaceEntry('buildPressureAffectSignalDigest', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Pressure signal digest builder.', ['pressure', 'diagnostic']),
  createSurfaceEntry('buildPressureAffectRiskEnvelope', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Pressure risk envelope builder.', ['pressure', 'diagnostic']),
  createSurfaceEntry('buildPressureAffectPolicyTrace', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Pressure policy trace builder.', ['pressure', 'policy']),
  createSurfaceEntry('buildPressureAffectDiagnosticReport', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Pressure diagnostic report builder.', ['pressure', 'diagnostic']),
  createSurfaceEntry('buildPressureAffectOperatorPacket', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Pressure operator packet builder.', ['pressure', 'operator']),
  createSurfaceEntry('evaluatePressureAffectDetailed', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Detailed pressure evaluation.', ['pressure', 'evaluate']),
  createSurfaceEntry('evaluatePressureAffectBatch', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Batch pressure evaluation.', ['pressure', 'batch']),
  createSurfaceEntry('comparePressureAffectResults', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Pressure comparison helper.', ['pressure', 'compare']),
  createSurfaceEntry('evaluatePressureAffectTrajectory', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Pressure trajectory evaluation.', ['pressure', 'trajectory']),
  createSurfaceEntry('buildPressureAffectReplayFrames', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Pressure replay frame builder.', ['pressure', 'replay']),
  createSurfaceEntry('listPressureAffectSurfaceManifest', 'PRESSURE_AFFECT', 'FUNCTION', 'VALUE', 'Pressure surface manifest reader.', ['pressure', 'manifest']),
]);

const EMOTION_SURFACE = Object.freeze([
  createSurfaceEntry('CHAT_EMOTION_MODEL_MODULE_NAME', 'EMOTION', 'CONST', 'VALUE', 'Emotion module identity.', ['emotion', 'identity']),
  createSurfaceEntry('CHAT_EMOTION_MODEL_VERSION', 'EMOTION', 'CONST', 'VALUE', 'Emotion module version.', ['emotion', 'version']),
  createSurfaceEntry('CHAT_EMOTION_MODEL_RUNTIME_LAWS', 'EMOTION', 'CONST', 'VALUE', 'Emotion runtime laws.', ['emotion', 'laws']),
  createSurfaceEntry('CHAT_EMOTION_MODEL_DEFAULTS', 'EMOTION', 'CONST', 'VALUE', 'Emotion default tuning.', ['emotion', 'defaults']),
  createSurfaceEntry('EmotionModel', 'EMOTION', 'CLASS', 'VALUE', 'Emotion runtime class.', ['emotion', 'class']),
  createSurfaceEntry('EmotionModelInput', 'EMOTION', 'TYPE', 'TYPE', 'Emotion input contract.', ['emotion', 'type']),
  createSurfaceEntry('EmotionModelRecommendation', 'EMOTION', 'TYPE', 'TYPE', 'Emotion recommendation contract.', ['emotion', 'type']),
  createSurfaceEntry('EmotionAxisDiagnostic', 'EMOTION', 'TYPE', 'TYPE', 'Emotion axis diagnostic contract.', ['emotion', 'type']),
  createSurfaceEntry('EmotionTrajectoryAssessment', 'EMOTION', 'TYPE', 'TYPE', 'Emotion trajectory assessment contract.', ['emotion', 'type']),
  createSurfaceEntry('EmotionResponseEnvelope', 'EMOTION', 'TYPE', 'TYPE', 'Emotion response envelope contract.', ['emotion', 'type']),
  createSurfaceEntry('EmotionOperatorPayload', 'EMOTION', 'TYPE', 'TYPE', 'Emotion operator payload contract.', ['emotion', 'type']),
  createSurfaceEntry('EmotionModelDiagnosticReport', 'EMOTION', 'TYPE', 'TYPE', 'Emotion diagnostic report contract.', ['emotion', 'type']),
  createSurfaceEntry('EmotionModelResult', 'EMOTION', 'TYPE', 'TYPE', 'Emotion result contract.', ['emotion', 'type']),
  createSurfaceEntry('EmotionBatchInput', 'EMOTION', 'TYPE', 'TYPE', 'Emotion batch input contract.', ['emotion', 'type']),
  createSurfaceEntry('EmotionBatchAggregate', 'EMOTION', 'TYPE', 'TYPE', 'Emotion batch aggregate contract.', ['emotion', 'type']),
  createSurfaceEntry('EmotionBatchResult', 'EMOTION', 'TYPE', 'TYPE', 'Emotion batch result contract.', ['emotion', 'type']),
  createSurfaceEntry('EmotionModelOptions', 'EMOTION', 'TYPE', 'TYPE', 'Emotion model options.', ['emotion', 'type']),
  createSurfaceEntry('EmotionModelApi', 'EMOTION', 'TYPE', 'TYPE', 'Emotion model API.', ['emotion', 'type']),
  createSurfaceEntry('createEmotionModel', 'EMOTION', 'FUNCTION', 'VALUE', 'Emotion model factory.', ['emotion', 'factory']),
  createSurfaceEntry('evaluateEmotionModel', 'EMOTION', 'FUNCTION', 'VALUE', 'Standalone emotion evaluation.', ['emotion', 'evaluate']),
  createSurfaceEntry('summarizeEmotionModel', 'EMOTION', 'FUNCTION', 'VALUE', 'Standalone emotion summary.', ['emotion', 'summarize']),
  createSurfaceEntry('buildEmotionOperatorPayload', 'EMOTION', 'FUNCTION', 'VALUE', 'Emotion operator payload builder.', ['emotion', 'operator']),
  createSurfaceEntry('buildEmotionDiagnosticReport', 'EMOTION', 'FUNCTION', 'VALUE', 'Emotion diagnostic report builder.', ['emotion', 'diagnostic']),
  createSurfaceEntry('evaluateEmotionBatch', 'EMOTION', 'FUNCTION', 'VALUE', 'Batch emotion evaluation.', ['emotion', 'batch']),
  createSurfaceEntry('summarizeEmotionOperatorView', 'EMOTION', 'FUNCTION', 'VALUE', 'Emotion operator summary helper.', ['emotion', 'operator']),
  createSurfaceEntry('compareEmotionModelResults', 'EMOTION', 'FUNCTION', 'VALUE', 'Emotion comparison helper.', ['emotion', 'compare']),
  createSurfaceEntry('summarizeEmotionBatchResult', 'EMOTION', 'FUNCTION', 'VALUE', 'Emotion batch summary helper.', ['emotion', 'summarize']),
]);

const INDEX_SURFACE = Object.freeze([
  createSurfaceEntry('CHAT_INTELLIGENCE_ML_INDEX_MODULE_NAME', 'INDEX', 'CONST', 'VALUE', 'Index module identity.', ['index', 'identity']),
  createSurfaceEntry('CHAT_INTELLIGENCE_ML_INDEX_VERSION', 'INDEX', 'CONST', 'VALUE', 'Index version.', ['index', 'version']),
  createSurfaceEntry('CHAT_INTELLIGENCE_ML_RUNTIME_LAWS', 'INDEX', 'CONST', 'VALUE', 'Index runtime laws.', ['index', 'laws']),
  createSurfaceEntry('CHAT_ML_MODE_BIASES', 'INDEX', 'CONST', 'VALUE', 'Mode bias registry.', ['index', 'mode']),
  createSurfaceEntry('CHAT_ML_MODE_BIAS_NOTES', 'INDEX', 'CONST', 'VALUE', 'Mode bias note registry.', ['index', 'mode']),
  createSurfaceEntry('CHAT_INTELLIGENCE_ML_SURFACE_MANIFEST', 'INDEX', 'CONST', 'VALUE', 'Combined ML surface manifest.', ['index', 'manifest']),
  createSurfaceEntry('CHAT_INTELLIGENCE_ML_HELPER_REGISTRY', 'INDEX', 'CONST', 'VALUE', 'Callable helper registry.', ['index', 'registry']),
  createSurfaceEntry('ChatMlModelId', 'INDEX', 'TYPE', 'TYPE', 'Model identifier contract.', ['index', 'type']),
  createSurfaceEntry('ChatMlModeId', 'INDEX', 'TYPE', 'TYPE', 'ML mode contract.', ['index', 'type']),
  createSurfaceEntry('ChatMlPublicKind', 'INDEX', 'TYPE', 'TYPE', 'Surface kind contract.', ['index', 'type']),
  createSurfaceEntry('ChatMlAvailability', 'INDEX', 'TYPE', 'TYPE', 'Surface availability contract.', ['index', 'type']),
  createSurfaceEntry('ChatIntelligenceMlSurfaceManifestEntry', 'INDEX', 'TYPE', 'TYPE', 'Surface manifest entry contract.', ['index', 'type']),
  createSurfaceEntry('ChatMlModeBiasNotes', 'INDEX', 'TYPE', 'TYPE', 'Mode bias note contract.', ['index', 'type']),
  createSurfaceEntry('ChatMlModeBias', 'INDEX', 'TYPE', 'TYPE', 'Mode bias contract.', ['index', 'type']),
  createSurfaceEntry('ChatMlCrossCorrelation', 'INDEX', 'TYPE', 'TYPE', 'Cross-model correlation contract.', ['index', 'type']),
  createSurfaceEntry('ChatMlUnifiedAdvice', 'INDEX', 'TYPE', 'TYPE', 'Unified advice contract.', ['index', 'type']),
  createSurfaceEntry('ChatMlBatchInput', 'INDEX', 'TYPE', 'TYPE', 'Coordinated batch input contract.', ['index', 'type']),
  createSurfaceEntry('ChatMlBatchResult', 'INDEX', 'TYPE', 'TYPE', 'Coordinated batch result contract.', ['index', 'type']),
  createSurfaceEntry('ChatMlDiagnosticReport', 'INDEX', 'TYPE', 'TYPE', 'ML diagnostic report contract.', ['index', 'type']),
  createSurfaceEntry('ChatIntelligenceMlRuntimeOptions', 'INDEX', 'TYPE', 'TYPE', 'Runtime creation options.', ['index', 'type']),
  createSurfaceEntry('ChatIntelligenceMlRuntime', 'INDEX', 'TYPE', 'TYPE', 'Runtime API contract.', ['index', 'type']),
  createSurfaceEntry('getChatMlModeBias', 'INDEX', 'FUNCTION', 'VALUE', 'Mode bias resolver.', ['index', 'mode']),
  createSurfaceEntry('listChatMlModeBiasNotes', 'INDEX', 'FUNCTION', 'VALUE', 'Mode bias note reader.', ['index', 'mode']),
  createSurfaceEntry('evaluateMlAttachmentStandalone', 'INDEX', 'FUNCTION', 'VALUE', 'Standalone attachment helper.', ['index', 'attachment']),
  createSurfaceEntry('evaluateMlPressureStandalone', 'INDEX', 'FUNCTION', 'VALUE', 'Standalone pressure helper.', ['index', 'pressure']),
  createSurfaceEntry('evaluateMlEmotionStandalone', 'INDEX', 'FUNCTION', 'VALUE', 'Standalone emotion helper.', ['index', 'emotion']),
  createSurfaceEntry('evaluateMlAttachmentDetailed', 'INDEX', 'FUNCTION', 'VALUE', 'Attachment detailed helper.', ['index', 'attachment']),
  createSurfaceEntry('evaluateMlPressureDetailed', 'INDEX', 'FUNCTION', 'VALUE', 'Pressure detailed helper.', ['index', 'pressure']),
  createSurfaceEntry('evaluateMlEmotionDetailed', 'INDEX', 'FUNCTION', 'VALUE', 'Emotion detailed helper.', ['index', 'emotion']),
  createSurfaceEntry('buildMlCrossCorrelation', 'INDEX', 'FUNCTION', 'VALUE', 'Cross-model correlation builder.', ['index', 'correlation']),
  createSurfaceEntry('buildMlUnifiedAdvice', 'INDEX', 'FUNCTION', 'VALUE', 'Unified advice builder.', ['index', 'advice']),
  createSurfaceEntry('batchEvaluateMl', 'INDEX', 'FUNCTION', 'VALUE', 'Coordinated three-model evaluation.', ['index', 'batch']),
  createSurfaceEntry('summarizeMlBatchResult', 'INDEX', 'FUNCTION', 'VALUE', 'Coordinated batch summarizer.', ['index', 'batch']),
  createSurfaceEntry('buildMlDiagnosticReport', 'INDEX', 'FUNCTION', 'VALUE', 'Coordinated diagnostic report builder.', ['index', 'diagnostic']),
  createSurfaceEntry('createChatIntelligenceMlRuntime', 'INDEX', 'FUNCTION', 'VALUE', 'Authoritative ML runtime factory.', ['index', 'runtime']),
  createSurfaceEntry('createModeBiasedChatIntelligenceMlRuntime', 'INDEX', 'FUNCTION', 'VALUE', 'Mode-biased runtime factory.', ['index', 'runtime']),
  createSurfaceEntry('listChatIntelligenceMlSurfaceManifest', 'INDEX', 'FUNCTION', 'VALUE', 'Combined surface manifest reader.', ['index', 'manifest']),
  createSurfaceEntry('findChatIntelligenceMlSurfaceEntry', 'INDEX', 'FUNCTION', 'VALUE', 'Surface manifest lookup.', ['index', 'manifest']),
]);

export const CHAT_INTELLIGENCE_ML_SURFACE_MANIFEST: readonly ChatIntelligenceMlSurfaceManifestEntry[] =
  Object.freeze([
    ...ATTACHMENT_SURFACE,
    ...PRESSURE_SURFACE,
    ...EMOTION_SURFACE,
    ...INDEX_SURFACE,
  ]);

export function listChatIntelligenceMlSurfaceManifest(): readonly ChatIntelligenceMlSurfaceManifestEntry[] {
  return CHAT_INTELLIGENCE_ML_SURFACE_MANIFEST;
}

export function findChatIntelligenceMlSurfaceEntry(
  exportName: string,
): ChatIntelligenceMlSurfaceManifestEntry | undefined {
  return CHAT_INTELLIGENCE_ML_SURFACE_MANIFEST.find((entry) => entry.exportName === exportName);
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Standalone helpers
// ─────────────────────────────────────────────────────────────────────────────

export function evaluateMlAttachmentStandalone(
  input: AttachmentModelInput,
  options: AttachmentModelOptions = {},
): AttachmentAssessment {
  return assessAttachment(input, options);
}

export function evaluateMlPressureStandalone(
  input: PressureAffectModelInput,
  options: PressureAffectModelOptions = {},
): PressureAffectResult {
  return evaluatePressureAffect(input, options);
}

export function evaluateMlEmotionStandalone(
  input: EmotionModelInput,
  options: EmotionModelOptions = {},
): EmotionModelResult {
  return evaluateEmotionModel(input, options);
}

export interface ChatMlAttachmentDetailedResult {
  readonly result: AttachmentAssessment;
  readonly diagnostic: AttachmentDiagnosticReport;
  readonly operatorPayload: ReturnType<typeof buildAttachmentOperatorPayload>;
  readonly operatorSummary: readonly string[];
  readonly score01: ReturnType<typeof scoreAttachmentState>;
}

export function evaluateMlAttachmentDetailed(
  input: AttachmentModelInput,
  options: AttachmentModelOptions = {},
): ChatMlAttachmentDetailedResult {
  const result = assessAttachment(input, options);
  return Object.freeze({
    result,
    diagnostic: buildAttachmentDiagnosticReport(result),
    operatorPayload: buildAttachmentOperatorPayload(result),
    operatorSummary: summarizeAttachmentOperatorView(result),
    score01: scoreAttachmentState(result),
  });
}

export interface ChatMlEmotionDetailedResult {
  readonly result: EmotionModelResult;
  readonly operatorPayload: EmotionOperatorPayload;
  readonly diagnostic: EmotionModelDiagnosticReport;
  readonly operatorSummary: readonly string[];
}

export function evaluateMlPressureDetailed(
  input: PressureAffectModelInput,
  options: PressureAffectModelOptions = {},
  modeHint?: PressureAffectModeId,
): PressureAffectDetailedResult {
  return evaluatePressureAffectDetailed(input, options, modeHint);
}

export function evaluateMlEmotionDetailed(
  input: EmotionModelInput,
  options: EmotionModelOptions = {},
): ChatMlEmotionDetailedResult {
  const result = evaluateEmotionModel(input, options);
  return Object.freeze({
    result,
    operatorPayload: buildEmotionOperatorPayload(result),
    diagnostic: buildEmotionDiagnosticReport(result),
    operatorSummary: summarizeEmotionOperatorView(result),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Cross-model correlation and advice
// ─────────────────────────────────────────────────────────────────────────────

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function buildMlCrossCorrelation(
  attachment: AttachmentAssessment,
  pressure: PressureAffectResult,
  emotion: EmotionModelResult,
): ChatMlCrossCorrelation {
  const vector = emotion.snapshot.vector;
  const emotionalStability01 = average([
    Number(vector.confidence),
    Number(vector.relief),
    Number(vector.trust),
    1 - Number(vector.desperation),
  ]);

  return Object.freeze({
    isRescueGravityAlignedWithAttachment:
      Number(attachment.attachment01) >= 0.48 &&
      Number(attachment.rescueGravity01) >= 0.46,
    isHaterEscalationPressured:
      Number(vector.intimidation) >= 0.55 &&
      Number(attachment.rivalryContamination01) >= 0.48,
    isComebackWindowClosed:
      Number(pressure.pressureSeverity01) >= 0.62 &&
      Number(vector.confidence) <= 0.34,
    isCelebrationSafe:
      Number(attachment.trust01) >= 0.54 &&
      Number(vector.relief) >= 0.46 &&
      !emotion.recommendation.shouldHoldCelebration,
    isIsolationRisk:
      Number(vector.desperation) >= 0.58 &&
      Number(attachment.rescueGravity01) <= 0.28,
    isPredatorySilence:
      Number(vector.intimidation) >= 0.52 &&
      pressure.recommendation.policyFlags.shouldPreferSilence,
    isCrowdSwarmImminent:
      Number(pressure.crowdThreat01) >= 0.54 &&
      Number(pressure.publicExposure01) >= 0.48 &&
      Number(vector.socialEmbarrassment) >= 0.44,
    isSilenceAligned:
      pressure.recommendation.policyFlags.shouldPreferSilence &&
      emotion.recommendation.silenceDirective.preferSilence &&
      attachment.state !== 'TRUST_STABLE',
    isAttachmentUnderPressure:
      Number(attachment.attachment01) >= 0.42 &&
      Number(pressure.pressureSeverity01) >= 0.48,
    isRescueReadinessAligned:
      Number(attachment.rescueGravity01) >= 0.44 &&
      Number(vector.desperation) >= 0.44 &&
      pressure.recommendation.policyFlags.shouldEscalateRescue,
    attachmentStateScore01: Number(scoreAttachmentState(attachment)),
    pressureDominance01: average([
      Number(pressure.breakdown.intimidation01),
      Number(pressure.breakdown.frustration01),
      Number(pressure.breakdown.desperation01),
    ]),
    emotionalStability01,
  });
}

export function buildMlUnifiedAdvice(
  attachment: AttachmentAssessment,
  pressure: PressureAffectResult,
  emotion: EmotionModelResult,
  correlation: ChatMlCrossCorrelation,
): ChatMlUnifiedAdvice {
  const recommendedNextActions: string[] = [];
  const cautionFlags: string[] = [];
  const rationale: string[] = [];

  let primaryPolicy: ChatMlUnifiedAdvice['primaryPolicy'] = 'WATCH';

  if (correlation.isSilenceAligned || emotion.response.preferSilence) {
    primaryPolicy = 'SILENCE';
    recommendedNextActions.push('Preserve authored silence and avoid unnecessary helper chatter.');
    rationale.push('Pressure policy and emotion directive both prefer silence.');
  }

  if (correlation.isRescueReadinessAligned || emotion.recommendation.shouldEscalateHelper) {
    primaryPolicy = 'RECOVERY';
    recommendedNextActions.push('Escalate helper or rescue presence with continuity-aware timing.');
    rationale.push('Rescue gravity, desperation, and pressure escalation are aligned.');
  }

  if (correlation.isHaterEscalationPressured || emotion.recommendation.shouldEscalateHater) {
    primaryPolicy = 'ESCALATION';
    recommendedNextActions.push('Prepare a controlled hater lane or defensive counter-voice.');
    rationale.push('Intimidation and rivalry contamination are elevated.');
  }

  if (correlation.isCelebrationSafe && !pressure.recommendation.policyFlags.shouldRestrainCelebration) {
    primaryPolicy = 'CEREMONY';
    recommendedNextActions.push('Allow a contained celebration or visible win-state acknowledgment.');
    rationale.push('Trust and relief are sufficient and celebration restraint is not active.');
  }

  if (primaryPolicy === 'WATCH' && correlation.emotionalStability01 >= 0.54) {
    primaryPolicy = 'STABILIZE';
    recommendedNextActions.push('Hold posture and stabilize the room rather than injecting new energy.');
    rationale.push('Composite emotional stability is above the watch floor.');
  }

  if (correlation.isCrowdSwarmImminent) {
    cautionFlags.push('CROWD_SWARM_IMMINENT');
    recommendedNextActions.push('Rate-limit public amplification and protect against dogpile theater.');
  }

  if (correlation.isPredatorySilence) {
    cautionFlags.push('PREDATORY_SILENCE');
    recommendedNextActions.push('Do not misread silence as safety in the current lane.');
  }

  if (correlation.isComebackWindowClosed) {
    cautionFlags.push('COMEBACK_WINDOW_CLOSED');
    recommendedNextActions.push('Delay comeback speech and rebuild confidence before re-entry.');
  }

  if (correlation.isIsolationRisk) {
    cautionFlags.push('ISOLATION_RISK');
    recommendedNextActions.push('Favor warm rescue timing over public challenge.');
  }

  if (recommendedNextActions.length === 0) {
    recommendedNextActions.push('Keep observing and maintain runtime continuity without injecting drift.');
  }

  return Object.freeze({
    primaryPolicy,
    recommendedNextActions: Object.freeze(recommendedNextActions),
    cautionFlags: Object.freeze(cautionFlags),
    rationale: Object.freeze(rationale),
  });
}

function buildBatchSummaryLines(
  modeId: ChatMlModeId,
  attachment: AttachmentAssessment,
  pressure: PressureAffectResult,
  emotion: EmotionModelResult,
  advice: ChatMlUnifiedAdvice,
  correlation: ChatMlCrossCorrelation,
): readonly string[] {
  return Object.freeze([
    `mode=${modeId}`,
    `attachmentState=${attachment.state}`,
    `pressureState=${pressure.narrativeState}`,
    `emotionDominantAxis=${emotion.operatorPayload.dominantAxis}`,
    `policy=${advice.primaryPolicy}`,
    `attachmentScore=${toPct(correlation.attachmentStateScore01)}`,
    `pressureDominance=${toPct(correlation.pressureDominance01)}`,
    `emotionalStability=${toPct(correlation.emotionalStability01)}`,
    ...advice.cautionFlags.map((item) => `caution=${item}`),
    ...advice.recommendedNextActions.map((item) => `action=${item}`),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Coordinated batch evaluation
// ─────────────────────────────────────────────────────────────────────────────

export function batchEvaluateMl(
  input: ChatMlBatchInput,
  baseOptions: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlBatchResult {
  const modeId = input.modeId ?? 'UNKNOWN';
  const bias = input.applyModeBias === false ? undefined : getChatMlModeBias(modeId);

  const attachmentOptions: AttachmentModelOptions = Object.freeze({
    ...(baseOptions.attachment ?? {}),
    authority: baseOptions.authority ?? baseOptions.attachment?.authority,
    now: baseOptions.now ?? baseOptions.attachment?.now,
    defaults: mergeAttachmentDefaults(
      baseOptions.attachment?.defaults,
      bias?.attachmentDefaults,
    ),
  });

  const pressureOptions: PressureAffectModelOptions = Object.freeze({
    ...(baseOptions.pressureAffect ?? {}),
    authority: baseOptions.authority ?? baseOptions.pressureAffect?.authority,
    now: baseOptions.now ?? baseOptions.pressureAffect?.now,
    defaults: mergePressureDefaults(
      baseOptions.pressureAffect?.defaults,
      bias?.pressureDefaults,
    ),
  });

  const attachmentModel = createAttachmentModel(attachmentOptions);
  const pressureAffectModel = createPressureAffectModel(pressureOptions);

  const emotionOptions: EmotionModelOptions = Object.freeze({
    ...(baseOptions.emotion ?? {}),
    authority: baseOptions.authority,
    now: baseOptions.now,
    defaults: mergeEmotionDefaults(baseOptions.emotion?.defaults, bias?.emotionDefaults),
    attachmentModel,
    pressureAffectModel,
  });

  const emotionModel = createEmotionModel(emotionOptions);
  const attachment = attachmentModel.assess(input.attachmentInput);
  const pressureAffect = pressureAffectModel.evaluate(input.pressureInput);
  const emotion = emotionModel.evaluate(input.emotionInput);
  const correlation = buildMlCrossCorrelation(attachment, pressureAffect, emotion);
  const advice = buildMlUnifiedAdvice(attachment, pressureAffect, emotion, correlation);

  return Object.freeze({
    version: CHAT_INTELLIGENCE_ML_INDEX_VERSION,
    modeId,
    evaluatedAtMs: Date.now(),
    attachment,
    pressureAffect,
    emotion,
    correlation,
    advice,
    summaryLines: buildBatchSummaryLines(
      modeId,
      attachment,
      pressureAffect,
      emotion,
      advice,
      correlation,
    ),
  });
}

export function summarizeMlBatchResult(
  result: ChatMlBatchResult,
): readonly string[] {
  return result.summaryLines;
}

export function buildMlDiagnosticReport(
  batchResult: ChatMlBatchResult,
): ChatMlDiagnosticReport {
  const attachmentSummary = summarizeAttachmentAssessment(batchResult.attachment);
  const pressureSummary = summarizePressureAffect(batchResult.pressureAffect);
  const emotionSummary = summarizeEmotionModel(batchResult.emotion);

  return Object.freeze({
    version: CHAT_INTELLIGENCE_ML_INDEX_VERSION,
    generatedAtMs: Date.now(),
    attachment: Object.freeze({
      state: batchResult.attachment.state,
      attachment01: Number(batchResult.attachment.attachment01),
      trust01: Number(batchResult.attachment.trust01),
      rivalryContamination01: Number(batchResult.attachment.rivalryContamination01),
      helperAffinity01: Number(batchResult.attachment.helperAffinity01),
      summaryLines: attachmentSummary,
    }),
    pressureAffect: Object.freeze({
      narrativeState: batchResult.pressureAffect.narrativeState,
      pressureSeverity01: Number(batchResult.pressureAffect.pressureSeverity01),
      crowdThreat01: Number(batchResult.pressureAffect.crowdThreat01),
      publicExposure01: Number(batchResult.pressureAffect.publicExposure01),
      summaryLines: pressureSummary,
    }),
    emotion: Object.freeze({
      dominantAxis: batchResult.emotion.operatorPayload.dominantAxis,
      primaryPolicy: batchResult.emotion.response.primaryPolicy,
      confidenceBand: String(batchResult.emotion.snapshot.derived.confidenceBand),
      summaryLines: emotionSummary,
    }),
    crossCorrelation: batchResult.correlation,
    advice: batchResult.advice,
    topRecommendations: Object.freeze(batchResult.advice.recommendedNextActions),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Runtime factory
// ─────────────────────────────────────────────────────────────────────────────

export function createChatIntelligenceMlRuntime(
  options: ChatIntelligenceMlRuntimeOptions = {},
): ChatIntelligenceMlRuntime {
  const attachmentModel = createAttachmentModel({
    ...(options.attachment ?? {}),
    authority: options.authority ?? options.attachment?.authority,
    now: options.now ?? options.attachment?.now,
    defaults: mergeAttachmentDefaults(options.attachment?.defaults),
  });

  const pressureAffectModel = createPressureAffectModel({
    ...(options.pressureAffect ?? {}),
    authority: options.authority ?? options.pressureAffect?.authority,
    now: options.now ?? options.pressureAffect?.now,
    defaults: mergePressureDefaults(options.pressureAffect?.defaults),
  });

  const emotionModel = createEmotionModel({
    ...(options.emotion ?? {}),
    authority: options.authority,
    now: options.now,
    defaults: mergeEmotionDefaults(options.emotion?.defaults),
    attachmentModel,
    pressureAffectModel,
  });

  return Object.freeze({
    version: CHAT_INTELLIGENCE_ML_INDEX_VERSION,
    attachmentModel,
    pressureAffectModel,
    emotionModel,

    assessAttachment(input: AttachmentModelInput): AttachmentAssessment {
      return attachmentModel.assess(input);
    },

    summarizeAttachment(result: AttachmentAssessment): readonly string[] {
      return attachmentModel.summarize(result);
    },

    assessAttachmentCandidate(
      candidate: AttachmentAffinityCandidate,
    ): AttachmentCandidateAssessment {
      return attachmentModel.assessCandidate(candidate);
    },

    summarizeAttachmentCandidate(
      candidate: AttachmentAffinityCandidate,
    ): readonly string[] {
      return attachmentModel.summarizeCandidate(candidate);
    },

    assessAttachmentBatch(input: AttachmentBatchInput): AttachmentBatchResult {
      return attachmentModel.assessBatch(input);
    },

    buildAttachmentDiagnosticReport(
      result: AttachmentAssessment,
    ): AttachmentDiagnosticReport {
      return attachmentModel.buildDiagnosticReport(result);
    },

    buildAttachmentOperatorPayload(result: AttachmentAssessment) {
      return buildAttachmentOperatorPayload(result);
    },

    summarizeAttachmentOperatorView(result: AttachmentAssessment): readonly string[] {
      return summarizeAttachmentOperatorView(result);
    },

    scoreAttachmentState(result: AttachmentAssessment) {
      return scoreAttachmentState(result);
    },

    evaluatePressureAffect(input: PressureAffectModelInput): PressureAffectResult {
      return pressureAffectModel.evaluate(input);
    },

    summarizePressure(result: PressureAffectResult): readonly string[] {
      return pressureAffectModel.summarize(result);
    },

    evaluatePressureAffectDetailed(
      input: PressureAffectModelInput,
      modeHint?: PressureAffectModeId,
    ): PressureAffectDetailedResult {
      return evaluatePressureAffectDetailed(
        input,
        {
          authority: options.authority ?? options.pressureAffect?.authority,
          now: options.now ?? options.pressureAffect?.now,
          defaults: mergePressureDefaults(options.pressureAffect?.defaults),
        },
        modeHint,
      );
    },

    evaluatePressureAffectBatch(input: PressureAffectBatchInput): PressureAffectBatchResult {
      return evaluatePressureAffectBatch(input);
    },

    comparePressureAffectResults(
      previous: PressureAffectResult,
      next: PressureAffectResult,
    ): PressureAffectComparison {
      return comparePressureAffectResults(previous, next);
    },

    evaluatePressureAffectTrajectory(
      inputs: readonly PressureAffectModelInput[],
      modeHint?: PressureAffectModeId,
    ): PressureAffectTrajectoryResult {
      return evaluatePressureAffectTrajectory(
        inputs,
        {
          authority: options.authority ?? options.pressureAffect?.authority,
          now: options.now ?? options.pressureAffect?.now,
          defaults: mergePressureDefaults(options.pressureAffect?.defaults),
        },
        modeHint,
      );
    },

    buildPressureAffectReplayFrames(trajectory: PressureAffectTrajectoryResult) {
      return buildPressureAffectReplayFrames(trajectory);
    },

    buildPressureAffectDiagnosticReport(
      result: PressureAffectResult,
      input: PressureAffectModelInput,
      modeHint?: PressureAffectModeId,
    ): PressureAffectDiagnosticReport {
      return buildPressureAffectDiagnosticReport(result, input, modeHint);
    },

    buildPressureAffectOperatorPacket(
      result: PressureAffectResult,
      input: PressureAffectModelInput,
      modeHint?: PressureAffectModeId,
    ): PressureAffectOperatorPacket {
      return buildPressureAffectOperatorPacket(result, input, modeHint);
    },

    evaluateEmotion(input: EmotionModelInput): EmotionModelResult {
      return emotionModel.evaluate(input);
    },

    summarizeEmotion(result: EmotionModelResult): readonly string[] {
      return emotionModel.summarize(result);
    },

    buildEmotionOperatorPayload(result: EmotionModelResult): EmotionOperatorPayload {
      return emotionModel.buildOperatorPayload(result);
    },

    buildEmotionDiagnosticReport(
      result: EmotionModelResult,
    ): EmotionModelDiagnosticReport {
      return emotionModel.buildDiagnosticReport(result);
    },

    evaluateEmotionBatch(input: EmotionBatchInput): EmotionBatchResult {
      return emotionModel.evaluateBatch(input);
    },

    compareEmotionResults(
      previous: EmotionModelResult,
      next: EmotionModelResult,
    ): readonly string[] {
      return compareEmotionModelResults(previous, next);
    },

    summarizeEmotionOperatorView(result: EmotionModelResult): readonly string[] {
      return summarizeEmotionOperatorView(result);
    },

    summarizeEmotionBatchResult(result: EmotionBatchResult): readonly string[] {
      return summarizeEmotionBatchResult(result);
    },

    batchEvaluate(input: ChatMlBatchInput): ChatMlBatchResult {
      return batchEvaluateMl(input, options);
    },

    summarizeBatchResult(result: ChatMlBatchResult): readonly string[] {
      return summarizeMlBatchResult(result);
    },

    buildDiagnosticReport(batchResult: ChatMlBatchResult): ChatMlDiagnosticReport {
      return buildMlDiagnosticReport(batchResult);
    },
  });
}

export function createModeBiasedChatIntelligenceMlRuntime(
  modeId: ChatMlModeId,
  options: ChatIntelligenceMlRuntimeOptions = {},
): ChatIntelligenceMlRuntime {
  const bias = getChatMlModeBias(modeId);
  return createChatIntelligenceMlRuntime({
    ...options,
    attachment: Object.freeze({
      ...(options.attachment ?? {}),
      defaults: mergeAttachmentDefaults(options.attachment?.defaults, bias.attachmentDefaults),
    }),
    pressureAffect: Object.freeze({
      ...(options.pressureAffect ?? {}),
      defaults: mergePressureDefaults(options.pressureAffect?.defaults, bias.pressureDefaults),
    }),
    emotion: Object.freeze({
      ...(options.emotion ?? {}),
      defaults: mergeEmotionDefaults(options.emotion?.defaults, bias.emotionDefaults),
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Helper registry
// ─────────────────────────────────────────────────────────────────────────────

export const CHAT_INTELLIGENCE_ML_HELPER_REGISTRY = Object.freeze({
  attachment: Object.freeze({
    moduleName: CHAT_ATTACHMENT_MODEL_MODULE_NAME,
    version: CHAT_ATTACHMENT_MODEL_VERSION,
    runtimeLaws: CHAT_ATTACHMENT_MODEL_RUNTIME_LAWS,
    defaults: CHAT_ATTACHMENT_MODEL_DEFAULTS,
    evaluate: assessAttachment,
    evaluateDetailed: evaluateMlAttachmentDetailed,
    summarize: summarizeAttachmentAssessment,
    summarizeCandidate: summarizeAttachmentCandidate,
    assessCandidate: assessAttachmentCandidate,
    assessBatch: assessAttachmentBatch,
    buildDiagnosticReport: buildAttachmentDiagnosticReport,
    buildOperatorPayload: buildAttachmentOperatorPayload,
    compare: compareAttachmentAssessments,
    scoreState: scoreAttachmentState,
    summarizeOperatorView: summarizeAttachmentOperatorView,
  }),
  pressureAffect: Object.freeze({
    moduleName: CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME,
    version: CHAT_PRESSURE_AFFECT_MODEL_VERSION,
    runtimeLaws: CHAT_PRESSURE_AFFECT_MODEL_RUNTIME_LAWS,
    defaults: CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS,
    modeProfiles: CHAT_PRESSURE_AFFECT_MODE_PROFILES,
    evaluate: evaluatePressureAffect,
    evaluateDetailed: evaluatePressureAffectDetailed,
    evaluateBatch: evaluatePressureAffectBatch,
    summarize: summarizePressureAffect,
    resolveModeProfile: resolvePressureAffectModeProfile,
    buildSignalDigest: buildPressureAffectSignalDigest,
    buildRiskEnvelope: buildPressureAffectRiskEnvelope,
    buildPolicyTrace: buildPressureAffectPolicyTrace,
    buildDiagnosticReport: buildPressureAffectDiagnosticReport,
    buildOperatorPacket: buildPressureAffectOperatorPacket,
    compare: comparePressureAffectResults,
    evaluateTrajectory: evaluatePressureAffectTrajectory,
    buildReplayFrames: buildPressureAffectReplayFrames,
    listSurfaceManifest: listPressureAffectSurfaceManifest,
  }),
  emotion: Object.freeze({
    moduleName: CHAT_EMOTION_MODEL_MODULE_NAME,
    version: CHAT_EMOTION_MODEL_VERSION,
    runtimeLaws: CHAT_EMOTION_MODEL_RUNTIME_LAWS,
    defaults: CHAT_EMOTION_MODEL_DEFAULTS,
    evaluate: evaluateEmotionModel,
    evaluateDetailed: evaluateMlEmotionDetailed,
    evaluateBatch: evaluateEmotionBatch,
    summarize: summarizeEmotionModel,
    buildOperatorPayload: buildEmotionOperatorPayload,
    buildDiagnosticReport: buildEmotionDiagnosticReport,
    compare: compareEmotionModelResults,
    summarizeOperatorView: summarizeEmotionOperatorView,
    summarizeBatchResult: summarizeEmotionBatchResult,
  }),
  index: Object.freeze({
    moduleName: CHAT_INTELLIGENCE_ML_INDEX_MODULE_NAME,
    version: CHAT_INTELLIGENCE_ML_INDEX_VERSION,
    runtimeLaws: CHAT_INTELLIGENCE_ML_RUNTIME_LAWS,
    batchEvaluate: batchEvaluateMl,
    summarizeBatchResult: summarizeMlBatchResult,
    buildDiagnosticReport: buildMlDiagnosticReport,
    buildCrossCorrelation: buildMlCrossCorrelation,
    buildUnifiedAdvice: buildMlUnifiedAdvice,
    createRuntime: createChatIntelligenceMlRuntime,
    createModeRuntime: createModeBiasedChatIntelligenceMlRuntime,
    listSurfaceManifest: listChatIntelligenceMlSurfaceManifest,
    findSurfaceEntry: findChatIntelligenceMlSurfaceEntry,
    listModeBiasNotes: listChatMlModeBiasNotes,
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// MARK: Mode-scoped convenience helpers
// ─────────────────────────────────────────────────────────────────────────────

export function evaluateEmpireMl(
  input: ChatMlBatchInput,
  options: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlBatchResult {
  return batchEvaluateMl({ ...input, modeId: 'EMPIRE', applyModeBias: true }, options);
}

export function evaluatePredatorMl(
  input: ChatMlBatchInput,
  options: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlBatchResult {
  return batchEvaluateMl({ ...input, modeId: 'PREDATOR', applyModeBias: true }, options);
}

export function evaluateSyndicateMl(
  input: ChatMlBatchInput,
  options: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlBatchResult {
  return batchEvaluateMl({ ...input, modeId: 'SYNDICATE', applyModeBias: true }, options);
}

export function evaluatePhantomMl(
  input: ChatMlBatchInput,
  options: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlBatchResult {
  return batchEvaluateMl({ ...input, modeId: 'PHANTOM', applyModeBias: true }, options);
}

export function evaluateLobbyMl(
  input: ChatMlBatchInput,
  options: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlBatchResult {
  return batchEvaluateMl({ ...input, modeId: 'LOBBY', applyModeBias: true }, options);
}

export function evaluatePostRunMl(
  input: ChatMlBatchInput,
  options: ChatIntelligenceMlRuntimeOptions = {},
): ChatMlBatchResult {
  return batchEvaluateMl({ ...input, modeId: 'POST_RUN', applyModeBias: true }, options);
}
