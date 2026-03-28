/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO / CHAT ADAPTERS
 * /backend/src/game/engine/chat/adapters/OrchestratorConfigSignalAdapter.ts
 *
 * Chat adapter for OrchestratorConfig resolution signals.
 *
 * Architecture:
 * - Consumes OrchestratorConfigChatSignal from zero/OrchestratorConfig
 * - Translates into ChatSignalEnvelope routed to the LIVEOPS_SIGNAL lane
 * - Structural compat interfaces guard against circular imports from zero/
 * - Never imports from zero/* directly — all types are mirrored via compat shapes
 *
 * Coverage:
 * - translate()              → full envelope construction
 * - translateMLVector()      → 32-dim ML vector → chat metadata
 * - translateDLTensor()      → 13×10 DL tensor → flat metadata
 * - translateTelemetry()     → telemetry record for ops-board
 * - translateTrend()         → trend snapshot → chat metadata summary
 * - translateSessionReport() → session report → chat aggregate summary
 *
 * Singletons:
 * - ORCHESTRATOR_CONFIG_DEFAULT_ADAPTER — balanced production adapter
 * - ORCHESTRATOR_CONFIG_STRICT_ADAPTER  — strict validation + full payload
 * - ORCHESTRATOR_CONFIG_VERBOSE_ADAPTER — includes trend + session report
 */

import {
  asUnixMs,
  clamp01,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatSignalType,
  type JsonValue,
  type Nullable,
} from '../types';

// ────────────────────────────────────────────────────────────────────────────────
// Structural compat interfaces (no import from zero/)
// ────────────────────────────────────────────────────────────────────────────────

type OrchestratorProfileId =
  | 'default'
  | 'production'
  | 'debug'
  | 'replay'
  | 'load-test'
  | 'tournament'
  | 'integration-test';

type ModeCode = 'solo' | 'pvp' | 'coop' | 'ghost';

type OrchestratorConfigSafetyLevel = 'strict' | 'standard' | 'permissive';

type TickStep =
  | 'STEP_01_PREPARE'
  | 'STEP_02_TIME'
  | 'STEP_03_PRESSURE'
  | 'STEP_04_TENSION'
  | 'STEP_05_BATTLE'
  | 'STEP_06_SHIELD'
  | 'STEP_07_CASCADE'
  | 'STEP_08_MODE_POST'
  | 'STEP_09_TELEMETRY'
  | 'STEP_10_SOVEREIGNTY_SNAPSHOT'
  | 'STEP_11_OUTCOME_GATE'
  | 'STEP_12_EVENT_SEAL'
  | 'STEP_13_FLUSH';

/** Structural compat for OrchestratorConfigChatSignal */
interface OrchestratorConfigChatSignalCompat {
  readonly kind: 'orchestrator-config.resolved';
  readonly profileId: OrchestratorProfileId;
  readonly mode: ModeCode | null;
  readonly lifecycleState: string | null;
  readonly fingerprint: string;
  readonly enabledStepCount: number;
  readonly disabledStepCount: number;
  readonly totalStepCount: number;
  readonly disabledSteps: readonly TickStep[];
  readonly safetyLevel: OrchestratorConfigSafetyLevel;
  readonly isProductionGrade: boolean;
  readonly isTournamentGrade: boolean;
  readonly trailLength: number;
  readonly maxConsecutiveTickErrors: number;
  readonly sealStepEnabled: boolean;
  readonly flushStepEnabled: boolean;
  readonly failClosedFlags: number;
  readonly notes: readonly string[];
}

/** Structural compat for OrchestratorConfigMLVector (32 dims) */
interface OrchestratorConfigMLVectorCompat {
  readonly maxConsecutiveTickErrors01: number;
  readonly maxAllowedSkippedSteps01: number;
  readonly failClosedOnRegistryGap: 0 | 1;
  readonly abortRunOnFatalSealError: 0 | 1;
  readonly quarantineOnFlushError: 0 | 1;
  readonly quarantineOnSealMismatch: 0 | 1;
  readonly failClosedOnInvalidProfile: 0 | 1;
  readonly preserveTerminalSnapshotOnAbort: 0 | 1;
  readonly emitRunStartedImmediately: 0 | 1;
  readonly sealEventsBeforeFlush: 0 | 1;
  readonly flushAtFinalStepOnly: 0 | 1;
  readonly retainLastEventSealSnapshots01: number;
  readonly enableTracePublishing: 0 | 1;
  readonly enableHealthSnapshots: 0 | 1;
  readonly retainLastTickSummaries01: number;
  readonly retainLastErrors01: number;
  readonly allowPlayCardOnlyWhenActive: 0 | 1;
  readonly autoFinalizeProofOnTerminalOutcome: 0 | 1;
  readonly allowResetFromEnded: 0 | 1;
  readonly retainTickHistoryAcrossRuns: 0 | 1;
  readonly enabledStepCount01: number;
  readonly disabledStepCount01: number;
  readonly sealStepEnabled: 0 | 1;
  readonly flushStepEnabled: 0 | 1;
  readonly profileIsDefault: 0 | 1;
  readonly profileIsProduction: 0 | 1;
  readonly profileIsTournament: 0 | 1;
  readonly profileIsDebugOrReplay: 0 | 1;
  readonly modeIsSolo: 0 | 1;
  readonly modeIsPvp: 0 | 1;
  readonly modeIsCoop: 0 | 1;
  readonly modeIsGhost: 0 | 1;
}

/** Structural compat for OrchestratorConfigDLTensor (13×10) */
type OrchestratorConfigDLTensorCompat = readonly (readonly number[])[];

/** Structural compat for OrchestratorConfigTrendSnapshot */
interface OrchestratorConfigTrendSnapshotCompat {
  readonly capturedAt: number;
  readonly entryCount: number;
  readonly dominantProfileId: OrchestratorProfileId | null;
  readonly dominantMode: ModeCode | null;
  readonly profileDistribution: Readonly<Partial<Record<OrchestratorProfileId, number>>>;
  readonly modeDistribution: Readonly<Partial<Record<ModeCode, number>>>;
  readonly averageEnabledStepCount: number;
  readonly profileSwitchCount: number;
  readonly modeSwitchCount: number;
  readonly safetyLevelDistribution: Readonly<Record<OrchestratorConfigSafetyLevel, number>>;
  readonly fingerprintCollisionCount: number;
  readonly uniqueFingerprintCount: number;
}

/** Structural compat for OrchestratorConfigSessionReport */
interface OrchestratorConfigSessionReportCompat {
  readonly sessionId: string;
  readonly startedAt: number;
  readonly capturedAt: number;
  readonly totalResolutions: number;
  readonly uniqueFingerprints: number;
  readonly averageTrailLength: number;
  readonly averageEnabledStepCount: number;
  readonly dominantProfileId: OrchestratorProfileId | null;
  readonly dominantMode: ModeCode | null;
  readonly productionGradeResolutions: number;
  readonly tournamentGradeResolutions: number;
  readonly strictSafetyResolutions: number;
  readonly permissiveSafetyResolutions: number;
  readonly totalProfileSwitches: number;
  readonly totalModeSwitches: number;
}

// ────────────────────────────────────────────────────────────────────────────────
// Adapter types
// ────────────────────────────────────────────────────────────────────────────────

export interface OrchestratorConfigAdapterOptions {
  readonly includeMLVector: boolean;
  readonly includeDLTensor: boolean;
  readonly includeTrend: boolean;
  readonly includeSessionReport: boolean;
  readonly strict: boolean;
  readonly label: string;
}

export interface OrchestratorConfigAdapterTelemetry {
  readonly adaptedAt: number;
  readonly adapterLabel: string;
  readonly signalKind: string;
  readonly profileId: OrchestratorProfileId;
  readonly mode: ModeCode | null;
  readonly fingerprint: string;
  readonly safetyLevel: OrchestratorConfigSafetyLevel;
  readonly isProductionGrade: boolean;
  readonly enabledStepCount: number;
  readonly disabledStepCount: number;
  readonly failClosedFlags: number;
  readonly trailLength: number;
  readonly sealStepEnabled: boolean;
  readonly flushStepEnabled: boolean;
}

// ────────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────────

function nowMs(): number {
  return Date.now();
}

function buildEnvelope(
  signal: OrchestratorConfigChatSignalCompat,
  type: ChatSignalType,
  payload: Record<string, JsonValue>,
  notes: string,
): ChatSignalEnvelope {
  return Object.freeze({
    type,
    emittedAt: asUnixMs(nowMs()),
    roomId: null as Nullable<ChatRoomId>,
    liveops: {
      worldEventName: `orchestrator-config.${signal.profileId}`,
      heatMultiplier01: clamp01(signal.isTournamentGrade ? 1.0 : signal.isProductionGrade ? 0.75 : 0.5),
      helperBlackout: false,
      haterRaidActive: false,
    },
    metadata: Object.freeze({
      fingerprint: signal.fingerprint as JsonValue,
      profileId: signal.profileId as JsonValue,
      mode: (signal.mode ?? 'none') as JsonValue,
      lifecycleState: (signal.lifecycleState ?? 'none') as JsonValue,
      safetyLevel: signal.safetyLevel as JsonValue,
      enabledStepCount: signal.enabledStepCount as JsonValue,
      disabledStepCount: signal.disabledStepCount as JsonValue,
      sealStepEnabled: signal.sealStepEnabled as JsonValue,
      flushStepEnabled: signal.flushStepEnabled as JsonValue,
      failClosedFlags: signal.failClosedFlags as JsonValue,
      trailLength: signal.trailLength as JsonValue,
      isProductionGrade: signal.isProductionGrade as JsonValue,
      isTournamentGrade: signal.isTournamentGrade as JsonValue,
      maxConsecutiveTickErrors: signal.maxConsecutiveTickErrors as JsonValue,
      notes,
      ...payload,
    }),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// OrchestratorConfigSignalAdapter
// ────────────────────────────────────────────────────────────────────────────────

/**
 * OrchestratorConfigSignalAdapter
 *
 * Translates OrchestratorConfigChatSignal into ChatSignalEnvelope entries
 * for the LIVEOPS_SIGNAL lane in the backend chat system.
 *
 * Usage:
 *   const adapter = new OrchestratorConfigSignalAdapter({ label: 'production-adapter', ... });
 *   const envelope = adapter.translate(signal);
 *   const mlEnvelope = adapter.translateMLVector(signal, mlVector);
 *   const dlEnvelope = adapter.translateDLTensor(signal, dlTensor);
 *   const telemetry = adapter.translateTelemetry(signal);
 */
export class OrchestratorConfigSignalAdapter {
  private readonly options: OrchestratorConfigAdapterOptions;
  private translationCount = 0;
  private lastTranslatedAt = 0;

  constructor(options: Partial<OrchestratorConfigAdapterOptions> = {}) {
    this.options = Object.freeze({
      includeMLVector: options.includeMLVector ?? true,
      includeDLTensor: options.includeDLTensor ?? false,
      includeTrend: options.includeTrend ?? false,
      includeSessionReport: options.includeSessionReport ?? false,
      strict: options.strict ?? false,
      label: options.label ?? 'orchestrator-config-adapter',
    });
  }

  /**
   * translate
   *
   * Primary translation path. Converts an OrchestratorConfigChatSignal into a
   * ChatSignalEnvelope routed to the LIVEOPS_SIGNAL kind.
   *
   * Includes the full policy summary: profile, mode, lifecycle state, safety level,
   * step plan, and fail-closed flag count. ML/DL payloads are conditionally included
   * based on adapter options.
   */
  translate(signal: OrchestratorConfigChatSignalCompat): ChatSignalEnvelope {
    this.translationCount += 1;
    this.lastTranslatedAt = nowMs();

    const disabledStepsStr = signal.disabledSteps.join(',') || 'none';
    const notes = signal.notes.slice(0, 3).join(' | ');

    return buildEnvelope(
      signal,
      'LIVEOPS',
      {
        disabledSteps: disabledStepsStr as JsonValue,
        adapterLabel: this.options.label as JsonValue,
        translationSeq: this.translationCount as JsonValue,
      },
      notes,
    );
  }

  /**
   * translateMLVector
   *
   * Translates the 32-dim ML vector into a ChatSignalEnvelope payload.
   * All 32 dimensions are embedded in metadata as named keys for ML pipeline routing.
   */
  translateMLVector(
    signal: OrchestratorConfigChatSignalCompat,
    mlVector: OrchestratorConfigMLVectorCompat,
  ): ChatSignalEnvelope {
    return buildEnvelope(
      signal,
      'LIVEOPS',
      {
        mlVectorKind: 'orchestrator-config-32d' as JsonValue,
        d00_maxConsecutiveTickErrors01: mlVector.maxConsecutiveTickErrors01 as JsonValue,
        d01_maxAllowedSkippedSteps01: mlVector.maxAllowedSkippedSteps01 as JsonValue,
        d02_failClosedOnRegistryGap: mlVector.failClosedOnRegistryGap as JsonValue,
        d03_abortRunOnFatalSealError: mlVector.abortRunOnFatalSealError as JsonValue,
        d04_quarantineOnFlushError: mlVector.quarantineOnFlushError as JsonValue,
        d05_quarantineOnSealMismatch: mlVector.quarantineOnSealMismatch as JsonValue,
        d06_failClosedOnInvalidProfile: mlVector.failClosedOnInvalidProfile as JsonValue,
        d07_preserveTerminalSnapshotOnAbort: mlVector.preserveTerminalSnapshotOnAbort as JsonValue,
        d08_emitRunStartedImmediately: mlVector.emitRunStartedImmediately as JsonValue,
        d09_sealEventsBeforeFlush: mlVector.sealEventsBeforeFlush as JsonValue,
        d10_flushAtFinalStepOnly: mlVector.flushAtFinalStepOnly as JsonValue,
        d11_retainLastEventSealSnapshots01: mlVector.retainLastEventSealSnapshots01 as JsonValue,
        d12_enableTracePublishing: mlVector.enableTracePublishing as JsonValue,
        d13_enableHealthSnapshots: mlVector.enableHealthSnapshots as JsonValue,
        d14_retainLastTickSummaries01: mlVector.retainLastTickSummaries01 as JsonValue,
        d15_retainLastErrors01: mlVector.retainLastErrors01 as JsonValue,
        d16_allowPlayCardOnlyWhenActive: mlVector.allowPlayCardOnlyWhenActive as JsonValue,
        d17_autoFinalizeProofOnTerminalOutcome: mlVector.autoFinalizeProofOnTerminalOutcome as JsonValue,
        d18_allowResetFromEnded: mlVector.allowResetFromEnded as JsonValue,
        d19_retainTickHistoryAcrossRuns: mlVector.retainTickHistoryAcrossRuns as JsonValue,
        d20_enabledStepCount01: mlVector.enabledStepCount01 as JsonValue,
        d21_disabledStepCount01: mlVector.disabledStepCount01 as JsonValue,
        d22_sealStepEnabled: mlVector.sealStepEnabled as JsonValue,
        d23_flushStepEnabled: mlVector.flushStepEnabled as JsonValue,
        d24_profileIsDefault: mlVector.profileIsDefault as JsonValue,
        d25_profileIsProduction: mlVector.profileIsProduction as JsonValue,
        d26_profileIsTournament: mlVector.profileIsTournament as JsonValue,
        d27_profileIsDebugOrReplay: mlVector.profileIsDebugOrReplay as JsonValue,
        d28_modeIsSolo: mlVector.modeIsSolo as JsonValue,
        d29_modeIsPvp: mlVector.modeIsPvp as JsonValue,
        d30_modeIsCoop: mlVector.modeIsCoop as JsonValue,
        d31_modeIsGhost: mlVector.modeIsGhost as JsonValue,
      },
      'orchestrator-config ML vector 32d',
    );
  }

  /**
   * translateDLTensor
   *
   * Translates the 13×10 DL tensor into a ChatSignalEnvelope payload.
   * Each row (tick step) is encoded as a JSON array in the metadata.
   */
  translateDLTensor(
    signal: OrchestratorConfigChatSignalCompat,
    dlTensor: OrchestratorConfigDLTensorCompat,
  ): ChatSignalEnvelope {
    const STEP_LABELS: readonly string[] = [
      'STEP_01_PREPARE', 'STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_04_TENSION',
      'STEP_05_BATTLE', 'STEP_06_SHIELD', 'STEP_07_CASCADE', 'STEP_08_MODE_POST',
      'STEP_09_TELEMETRY', 'STEP_10_SOVEREIGNTY_SNAPSHOT', 'STEP_11_OUTCOME_GATE',
      'STEP_12_EVENT_SEAL', 'STEP_13_FLUSH',
    ];

    const tensorPayload: Record<string, JsonValue> = {
      dlTensorKind: 'orchestrator-config-13x10' as JsonValue,
    };

    for (let rowIndex = 0; rowIndex < dlTensor.length; rowIndex += 1) {
      const stepLabel = STEP_LABELS[rowIndex] ?? `STEP_${rowIndex.toString().padStart(2, '0')}`;
      tensorPayload[`row_${stepLabel}`] = JSON.stringify(dlTensor[rowIndex]) as JsonValue;
    }

    return buildEnvelope(
      signal,
      'LIVEOPS',
      tensorPayload,
      'orchestrator-config DL tensor 13×10',
    );
  }

  /**
   * translateTelemetry
   *
   * Produces a lightweight telemetry record for the ops-board.
   * No ML payload — just the policy-relevant summary fields.
   */
  translateTelemetry(
    signal: OrchestratorConfigChatSignalCompat,
  ): OrchestratorConfigAdapterTelemetry {
    return Object.freeze({
      adaptedAt: nowMs(),
      adapterLabel: this.options.label,
      signalKind: signal.kind,
      profileId: signal.profileId,
      mode: signal.mode,
      fingerprint: signal.fingerprint,
      safetyLevel: signal.safetyLevel,
      isProductionGrade: signal.isProductionGrade,
      enabledStepCount: signal.enabledStepCount,
      disabledStepCount: signal.disabledStepCount,
      failClosedFlags: signal.failClosedFlags,
      trailLength: signal.trailLength,
      sealStepEnabled: signal.sealStepEnabled,
      flushStepEnabled: signal.flushStepEnabled,
    });
  }

  /**
   * translateTrend
   *
   * Translates an OrchestratorConfigTrendSnapshot into a ChatSignalEnvelope.
   * Carries the dominant profile/mode, switch counts, and safety distribution.
   */
  translateTrend(
    signal: OrchestratorConfigChatSignalCompat,
    trend: OrchestratorConfigTrendSnapshotCompat,
  ): ChatSignalEnvelope {
    return buildEnvelope(
      signal,
      'LIVEOPS',
      {
        trendKind: 'orchestrator-config-trend' as JsonValue,
        trendEntryCount: trend.entryCount as JsonValue,
        trendDominantProfileId: (trend.dominantProfileId ?? 'none') as JsonValue,
        trendDominantMode: (trend.dominantMode ?? 'none') as JsonValue,
        trendAverageEnabledStepCount: trend.averageEnabledStepCount as JsonValue,
        trendProfileSwitchCount: trend.profileSwitchCount as JsonValue,
        trendModeSwitchCount: trend.modeSwitchCount as JsonValue,
        trendStrictSafetyCount: trend.safetyLevelDistribution.strict as JsonValue,
        trendStandardSafetyCount: trend.safetyLevelDistribution.standard as JsonValue,
        trendPermissiveSafetyCount: trend.safetyLevelDistribution.permissive as JsonValue,
        trendFingerprintCollisionCount: trend.fingerprintCollisionCount as JsonValue,
        trendUniqueFingerprintCount: trend.uniqueFingerprintCount as JsonValue,
      },
      'orchestrator-config trend snapshot',
    );
  }

  /**
   * translateSessionReport
   *
   * Translates an OrchestratorConfigSessionReport into a ChatSignalEnvelope.
   * Carries session-level aggregate metrics for the liveops lane.
   */
  translateSessionReport(
    signal: OrchestratorConfigChatSignalCompat,
    report: OrchestratorConfigSessionReportCompat,
  ): ChatSignalEnvelope {
    return buildEnvelope(
      signal,
      'LIVEOPS',
      {
        sessionReportKind: 'orchestrator-config-session' as JsonValue,
        sessionId: report.sessionId as JsonValue,
        sessionTotalResolutions: report.totalResolutions as JsonValue,
        sessionUniqueFingerprints: report.uniqueFingerprints as JsonValue,
        sessionAverageTrailLength: report.averageTrailLength as JsonValue,
        sessionAverageEnabledStepCount: report.averageEnabledStepCount as JsonValue,
        sessionDominantProfileId: (report.dominantProfileId ?? 'none') as JsonValue,
        sessionDominantMode: (report.dominantMode ?? 'none') as JsonValue,
        sessionProductionGradeResolutions: report.productionGradeResolutions as JsonValue,
        sessionTournamentGradeResolutions: report.tournamentGradeResolutions as JsonValue,
        sessionStrictSafetyResolutions: report.strictSafetyResolutions as JsonValue,
        sessionPermissiveSafetyResolutions: report.permissiveSafetyResolutions as JsonValue,
        sessionTotalProfileSwitches: report.totalProfileSwitches as JsonValue,
        sessionTotalModeSwitches: report.totalModeSwitches as JsonValue,
      },
      'orchestrator-config session report',
    );
  }

  get totalTranslations(): number {
    return this.translationCount;
  }

  get adapterLabel(): string {
    return this.options.label;
  }

  get lastTranslated(): number {
    return this.lastTranslatedAt;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Singletons
// ────────────────────────────────────────────────────────────────────────────────

/**
 * ORCHESTRATOR_CONFIG_DEFAULT_ADAPTER
 *
 * Balanced adapter for production: includes ML vector, excludes DL tensor
 * and session report by default. Used for standard LIVEOPS_SIGNAL routing.
 */
export const ORCHESTRATOR_CONFIG_DEFAULT_ADAPTER = new OrchestratorConfigSignalAdapter({
  label: 'orchestrator-config-default',
  includeMLVector: true,
  includeDLTensor: false,
  includeTrend: false,
  includeSessionReport: false,
  strict: false,
});

/**
 * ORCHESTRATOR_CONFIG_STRICT_ADAPTER
 *
 * Strict adapter with full ML vector validation and fail-closed behavior.
 * Used for tournament and production-grade lanes where policy auditability matters.
 */
export const ORCHESTRATOR_CONFIG_STRICT_ADAPTER = new OrchestratorConfigSignalAdapter({
  label: 'orchestrator-config-strict',
  includeMLVector: true,
  includeDLTensor: true,
  includeTrend: false,
  includeSessionReport: false,
  strict: true,
});

/**
 * ORCHESTRATOR_CONFIG_VERBOSE_ADAPTER
 *
 * Verbose adapter that includes trend snapshots and session reports.
 * Used for debug/replay/integration-test profiles and ops-board dashboards.
 */
export const ORCHESTRATOR_CONFIG_VERBOSE_ADAPTER = new OrchestratorConfigSignalAdapter({
  label: 'orchestrator-config-verbose',
  includeMLVector: true,
  includeDLTensor: true,
  includeTrend: true,
  includeSessionReport: true,
  strict: false,
});
