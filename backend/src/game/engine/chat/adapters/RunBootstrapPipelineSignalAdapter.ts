// backend/src/game/engine/chat/adapters/RunBootstrapPipelineSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/RunBootstrapPipelineSignalAdapter.ts
 *
 * Translates RunBootstrapPipeline signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * This prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Bootstrap signals enter the chat lane at the very start of a run.
 * They carry:
 *   - mode identity (Empire / Predator / Syndicate / Phantom)
 *   - opening health score (ML-derived [0,1])
 *   - severity (NOMINAL / DEGRADED / CRITICAL)
 *   - opening checksum (deterministic audit anchor)
 *   - narration hint (companion/audience presence theater)
 *   - pressure tier, integrity status, sovereignty score
 *
 * Chat doctrine:
 *   - NOMINAL  → low heat, clean start, companion greeting fires
 *   - DEGRADED → elevated heat, companion caution fires, audience engaged
 *   - CRITICAL → max heat, companion rescue fires, haterRaidActive = true
 *
 * Adapter modes:
 *   default  — standard signal with full opening summary
 *   strict   — suppresses NOMINAL severity, only emits DEGRADED/CRITICAL
 *   verbose  — includes ML vector array and DL tensor data in metadata
 *
 * Usage:
 *   import { BOOTSTRAP_DEFAULT_ADAPTER } from './RunBootstrapPipelineSignalAdapter';
 *   const envelope = BOOTSTRAP_DEFAULT_ADAPTER.translate(signal);
 *
 * Singletons:
 *   BOOTSTRAP_DEFAULT_ADAPTER
 *   BOOTSTRAP_STRICT_ADAPTER
 *   BOOTSTRAP_VERBOSE_ADAPTER
 */

import {
  clamp01,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type JsonValue,
  type Nullable,
  type Score01,
  type UnixMs,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURAL COMPAT TYPES — mirrors zero/RunBootstrapPipeline without imports
// ─────────────────────────────────────────────────────────────────────────────

/** Structural compat for BootstrapSeverity. */
type BootstrapSeverityCompat = 'NOMINAL' | 'DEGRADED' | 'CRITICAL';

/** Structural compat for ModeCode. */
type ModeCodeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

/** Structural compat for PressureTier. */
type PressureTierCompat = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

/** Structural compat for IntegrityStatus. */
type IntegrityStatusCompat =
  | 'PENDING'
  | 'VERIFIED'
  | 'QUARANTINED'
  | 'UNVERIFIED';

/** Structural compat for RunPhase. */
type RunPhaseCompat = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

/** Structural compat for PressureBand. */
type PressureBandCompat = string; // open string — actual values vary

/**
 * Structural compat shape for BootstrapChatSignal (from zero/).
 * Mirrors the interface without importing from zero/ directly.
 */
export interface BootstrapSignalCompat {
  readonly generatedAtMs: number;
  readonly severity: BootstrapSeverityCompat;
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCodeCompat;
  readonly phase: RunPhaseCompat;
  readonly seed: string;
  readonly tick: number;
  readonly openingChecksum: string;
  readonly handSize: number;
  readonly drawPileSize: number;
  readonly pressureTier: PressureTierCompat;
  readonly pressureBand: PressureBandCompat;
  readonly integrityStatus: IntegrityStatusCompat;
  readonly sovereigntyScore: number;
  readonly modeOptionsApplied: boolean;
  readonly cardRegistryValid: boolean;
  readonly bootstrapDurationMs: number;
  readonly notes: readonly string[];
  readonly narrationHint: string;
  readonly mlHealthScore: number;
}

/**
 * Structural compat for BootstrapAnnotationBundle.
 */
export interface BootstrapAnnotationCompat {
  readonly capturedAtMs: number;
  readonly severity: BootstrapSeverityCompat;
  readonly companionHeadline: string;
  readonly companionSubtext: string;
  readonly operatorSummary: string;
  readonly audienceHeatLabel: string;
  readonly narrationHint: string;
  readonly mode: ModeCodeCompat;
  readonly modeDisplayName: string;
  readonly openingHandSummary: string;
  readonly economySummary: string;
  readonly pressureSummary: string;
  readonly shieldSummary: string;
  readonly sovereigntySummary: string;
  readonly criticalFlags: readonly string[];
  readonly warningFlags: readonly string[];
  readonly infoFlags: readonly string[];
}

/**
 * Structural compat for BootstrapNarrationHint.
 */
export interface BootstrapNarrationCompat {
  readonly runId: string;
  readonly mode: ModeCodeCompat;
  readonly headline: string;
  readonly subtext: string;
  readonly urgency: 'low' | 'medium' | 'high';
  readonly audienceHeat: number;
  readonly rescueEligible: boolean;
  readonly presenceSignal: string;
  readonly relationshipTag: string;
}

/**
 * Structural compat for BootstrapMLVector array form.
 */
export interface BootstrapMLVectorCompat {
  readonly modeEncoded: number;
  readonly modeDifficultyMultiplier: number;
  readonly modeTensionFloor: number;
  readonly seedEntropyNormalized: number;
  readonly runIdEntropyNormalized: number;
  readonly handSizeNormalized: number;
  readonly drawPileSizeNormalized: number;
  readonly discardSizeNormalized: number;
  readonly exhaustSizeNormalized: number;
  readonly openingHandPowerNormalized: number;
  readonly openingHandTimingDiversity: number;
  readonly economyNetWorthNormalized: number;
  readonly economyCashNormalized: number;
  readonly economyDebtNormalized: number;
  readonly economyIncomeNormalized: number;
  readonly pressureTierEncoded: number;
  readonly pressureScoreNormalized: number;
  readonly tensionScoreNormalized: number;
  readonly shieldAvgIntegrity: number;
  readonly shieldWeakestLayerEncoded: number;
  readonly shieldL1Integrity: number;
  readonly shieldL4Integrity: number;
  readonly battleActiveBotCount: number;
  readonly battleNeutralizedBotCount: number;
  readonly botThreatScore: number;
  readonly cascadeActiveCount: number;
  readonly sovereigntyScoreNormalized: number;
  readonly integrityStatusRisk: number;
  readonly modeOptionsApplied: number;
  readonly cardRegistryValid: number;
  readonly checksumEntropyNormalized: number;
  readonly tickEncoded: number;
  readonly mlVectorArray: readonly number[];
}

/**
 * Structural compat for BootstrapDLTensor.
 */
export interface BootstrapDLTensorCompat {
  readonly rows: readonly {
    readonly domain: string;
    readonly rowIndex: number;
    readonly features: readonly number[];
    readonly featureNames: readonly string[];
  }[];
  readonly shape: readonly [6, 6];
  readonly domainOrder: readonly string[];
  readonly capturedAtMs: number;
  readonly runId: string;
  readonly mode: ModeCodeCompat;
}

/**
 * Structural compat for BootstrapTrendSnapshot.
 */
export interface BootstrapTrendCompat {
  readonly capturedAt: number;
  readonly sampleCount: number;
  readonly windowMs: number;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly avgHandSize: number;
  readonly avgDrawPileSize: number;
  readonly avgEconomyNetWorth: number;
  readonly avgPressureTierEncoded: number;
  readonly avgBotThreatScore: number;
  readonly avgSovereigntyScore: number;
  readonly nominalFraction: number;
  readonly degradedFraction: number;
  readonly criticalFraction: number;
  readonly trend: string;
}

/**
 * Structural compat for BootstrapSessionReport.
 */
export interface BootstrapSessionCompat {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly capturedAtMs: number;
  readonly totalBootstraps: number;
  readonly successfulBootstraps: number;
  readonly failedBootstraps: number;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly avgDurationMs: number;
  readonly maxDurationMs: number;
  readonly nominalCount: number;
  readonly degradedCount: number;
  readonly criticalCount: number;
  readonly modesBootstrapped: readonly string[];
  readonly runIdsSeen: readonly string[];
  readonly lastBootstrapAtMs: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER MODE
// ─────────────────────────────────────────────────────────────────────────────

export type RunBootstrapAdapterMode = 'default' | 'strict' | 'verbose';

// ─────────────────────────────────────────────────────────────────────────────
// MODE DISPLAY NAMES (chat-facing labels)
// ─────────────────────────────────────────────────────────────────────────────

const BOOTSTRAP_MODE_DISPLAY: Readonly<Record<ModeCodeCompat, string>> =
  Object.freeze({
    solo: 'Empire — GO ALONE',
    pvp: 'Predator — HEAD TO HEAD',
    coop: 'Syndicate — TEAM UP',
    ghost: 'Phantom — CHASE A LEGEND',
  });

// ─────────────────────────────────────────────────────────────────────────────
// PRESSURE TIER HEAT MAP
// ─────────────────────────────────────────────────────────────────────────────

const PRESSURE_TIER_HEAT: Readonly<Record<PressureTierCompat, number>> =
  Object.freeze({
    T0: 0.0,
    T1: 0.25,
    T2: 0.5,
    T3: 0.75,
    T4: 1.0,
  });

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRITY STATUS HEAT
// ─────────────────────────────────────────────────────────────────────────────

const INTEGRITY_HEAT: Readonly<Record<IntegrityStatusCompat, number>> =
  Object.freeze({
    PENDING: 0.1,
    VERIFIED: 0.0,
    UNVERIFIED: 0.3,
    QUARANTINED: 1.0,
  });

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

/**
 * Compute audience heat from signal severity, mlHealthScore, pressure tier,
 * and integrity status. Returns Score01 [0, 1].
 */
function computeBootstrapHeat(signal: BootstrapSignalCompat): Score01 {
  if (signal.severity === 'CRITICAL') {
    return 1.0 as Score01;
  }

  // Health-derived heat (inverse: lower health = higher heat)
  const healthHeat = 1 - clamp01(signal.mlHealthScore);

  // Pressure-tier heat
  const pressureHeat =
    PRESSURE_TIER_HEAT[signal.pressureTier as PressureTierCompat] ?? 0;

  // Integrity heat
  const integrityHeat =
    INTEGRITY_HEAT[signal.integrityStatus as IntegrityStatusCompat] ?? 0;

  // Blended heat
  const blended =
    healthHeat * 0.5 + pressureHeat * 0.3 + integrityHeat * 0.2;

  return clamp01(
    signal.severity === 'DEGRADED' ? Math.max(blended, 0.4) : blended,
  ) as Score01;
}

/**
 * Build the world event name from signal fields.
 * Format: bootstrap:{mode}:{severity}
 */
function buildBootstrapWorldEventName(signal: BootstrapSignalCompat): string {
  const modeDisplay = BOOTSTRAP_MODE_DISPLAY[signal.mode] ?? signal.mode;
  return `bootstrap:${signal.mode}:${signal.severity}:${modeDisplay}`;
}

/**
 * Build a metadata record from the bootstrap signal.
 */
function buildBootstrapMeta(
  signal: BootstrapSignalCompat,
  additionalMeta: Record<string, JsonValue> = {},
): Record<string, JsonValue> {
  return {
    severity: signal.severity,
    runId: signal.runId,
    userId: signal.userId,
    mode: signal.mode,
    modeDisplayName: BOOTSTRAP_MODE_DISPLAY[signal.mode] ?? signal.mode,
    phase: signal.phase,
    seed: signal.seed,
    tick: signal.tick,
    openingChecksum: signal.openingChecksum,
    handSize: signal.handSize,
    drawPileSize: signal.drawPileSize,
    pressureTier: signal.pressureTier,
    pressureBand: signal.pressureBand,
    integrityStatus: signal.integrityStatus,
    sovereigntyScore: signal.sovereigntyScore,
    modeOptionsApplied: signal.modeOptionsApplied,
    cardRegistryValid: signal.cardRegistryValid,
    bootstrapDurationMs: signal.bootstrapDurationMs,
    narrationHint: signal.narrationHint,
    mlHealthScore: signal.mlHealthScore,
    notes: signal.notes as unknown as JsonValue,
    ...additionalMeta,
  };
}

/**
 * Build a ChatInputEnvelope for a bootstrap signal.
 */
function buildBootstrapEnvelope(
  signal: BootstrapSignalCompat,
  additionalMeta: Record<string, JsonValue> = {},
  roomId: Nullable<ChatRoomId> = null,
): ChatInputEnvelope {
  const ts = nowMs();
  const heat = computeBootstrapHeat(signal);
  const worldEventName = buildBootstrapWorldEventName(signal);
  const isQuarantined = signal.integrityStatus === 'QUARANTINED';
  const hasCardIssue = !signal.cardRegistryValid;
  const isCritical = signal.severity === 'CRITICAL';

  const meta = buildBootstrapMeta(signal, additionalMeta);

  const chatSignal: ChatSignalEnvelope = {
    type: 'LIVEOPS',
    emittedAt: ts,
    roomId,
    liveops: {
      worldEventName,
      heatMultiplier01: heat,
      helperBlackout: isQuarantined,
      haterRaidActive: isCritical || hasCardIssue,
    },
    metadata: meta,
  };

  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt: ts,
    payload: chatSignal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATION RESULT
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapTranslationResult {
  readonly envelope: ChatInputEnvelope | null;
  readonly suppressed: boolean;
  readonly suppressionReason: string | null;
  readonly severity: BootstrapSeverityCompat;
  readonly heatScore: Score01;
  readonly worldEventName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RunBootstrapPipelineSignalAdapter
 *
 * Translates BootstrapChatSignal into chat lane LIVEOPS_SIGNAL envelopes.
 * Structural compat types prevent circular imports from zero/.
 *
 * All methods are pure: no state is mutated; no side effects.
 */
export class RunBootstrapPipelineSignalAdapter {
  private readonly _mode: RunBootstrapAdapterMode;
  private readonly _roomId: Nullable<ChatRoomId>;

  public constructor(
    mode: RunBootstrapAdapterMode = 'default',
    roomId: Nullable<ChatRoomId> = null,
  ) {
    this._mode = mode;
    this._roomId = roomId;
  }

  public get adapterMode(): RunBootstrapAdapterMode {
    return this._mode;
  }

  /**
   * Translate a BootstrapSignalCompat into a ChatInputEnvelope.
   * Returns null if the adapter mode suppresses the signal.
   */
  public translate(
    signal: BootstrapSignalCompat,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }

    const additionalMeta: Record<string, JsonValue> =
      this._mode === 'verbose'
        ? {
            adapterMode: this._mode,
            verboseIncluded: true,
          }
        : {};

    return buildBootstrapEnvelope(signal, additionalMeta, this._roomId);
  }

  /**
   * Translate with full result metadata (suppression tracking, heat, world event).
   */
  public translateWithResult(
    signal: BootstrapSignalCompat,
  ): BootstrapTranslationResult {
    const isSuppressed =
      this._mode === 'strict' && signal.severity === 'NOMINAL';

    const heat = computeBootstrapHeat(signal);
    const worldEventName = buildBootstrapWorldEventName(signal);

    if (isSuppressed) {
      return {
        envelope: null,
        suppressed: true,
        suppressionReason: 'strict mode suppresses NOMINAL severity',
        severity: signal.severity,
        heatScore: heat,
        worldEventName,
      };
    }

    const additionalMeta: Record<string, JsonValue> =
      this._mode === 'verbose' ? { adapterMode: this._mode } : {};

    const envelope = buildBootstrapEnvelope(
      signal,
      additionalMeta,
      this._roomId,
    );

    return {
      envelope,
      suppressed: false,
      suppressionReason: null,
      severity: signal.severity,
      heatScore: heat,
      worldEventName,
    };
  }

  /**
   * Translate an annotation bundle into a supplementary chat envelope.
   * Carries companion headline and UX summary flags.
   */
  public translateAnnotation(
    annotation: BootstrapAnnotationCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    const ts = nowMs();
    const isCritical = annotation.criticalFlags.length > 0;
    const hasWarnings = annotation.warningFlags.length > 0;

    const meta: Record<string, JsonValue> = {
      severity: annotation.severity,
      mode: annotation.mode,
      modeDisplayName: annotation.modeDisplayName,
      companionHeadline: annotation.companionHeadline,
      companionSubtext: annotation.companionSubtext,
      operatorSummary: annotation.operatorSummary,
      audienceHeatLabel: annotation.audienceHeatLabel,
      narrationHint: annotation.narrationHint,
      openingHandSummary: annotation.openingHandSummary,
      economySummary: annotation.economySummary,
      pressureSummary: annotation.pressureSummary,
      shieldSummary: annotation.shieldSummary,
      sovereigntySummary: annotation.sovereigntySummary,
      criticalFlags: annotation.criticalFlags as unknown as JsonValue,
      warningFlags: annotation.warningFlags as unknown as JsonValue,
      infoFlags: annotation.infoFlags as unknown as JsonValue,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId,
      liveops: {
        worldEventName: `bootstrap:annotation:${annotation.mode}:${annotation.severity}`,
        heatMultiplier01: isCritical
          ? (1.0 as Score01)
          : hasWarnings
            ? (0.6 as Score01)
            : (0.1 as Score01),
        helperBlackout: false,
        haterRaidActive: isCritical,
      },
      metadata: meta,
    };

    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload: chatSignal,
    };
  }

  /**
   * Translate a narration hint into a presence theater chat envelope.
   */
  public translateNarrationHint(
    hint: BootstrapNarrationCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    const ts = nowMs();

    const meta: Record<string, JsonValue> = {
      runId: hint.runId,
      mode: hint.mode,
      modeDisplayName: BOOTSTRAP_MODE_DISPLAY[hint.mode] ?? hint.mode,
      headline: hint.headline,
      subtext: hint.subtext,
      urgency: hint.urgency,
      audienceHeat: hint.audienceHeat,
      rescueEligible: hint.rescueEligible,
      presenceSignal: hint.presenceSignal,
      relationshipTag: hint.relationshipTag,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId,
      liveops: {
        worldEventName: `bootstrap:narration:${hint.mode}:${hint.urgency}`,
        heatMultiplier01: clamp01(hint.audienceHeat) as Score01,
        helperBlackout: false,
        haterRaidActive: hint.rescueEligible && hint.urgency === 'high',
      },
      metadata: meta,
    };

    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload: chatSignal,
    };
  }

  /**
   * Translate an ML vector into a diagnostic chat envelope.
   * Verbose mode only — strict/default suppresses ML details.
   */
  public translateMLVector(
    vec: BootstrapMLVectorCompat,
    runId: string,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope | null {
    if (this._mode !== 'verbose') return null;

    const ts = nowMs();
    const healthScore = vec.sovereigntyScoreNormalized * 0.3 +
      vec.shieldAvgIntegrity * 0.3 +
      vec.economyNetWorthNormalized * 0.2 +
      (1 - vec.botThreatScore) * 0.2;

    const meta: Record<string, JsonValue> = {
      runId,
      modeEncoded: vec.modeEncoded,
      modeDifficultyMultiplier: vec.modeDifficultyMultiplier,
      economyNetWorthNormalized: vec.economyNetWorthNormalized,
      pressureTierEncoded: vec.pressureTierEncoded,
      shieldAvgIntegrity: vec.shieldAvgIntegrity,
      botThreatScore: vec.botThreatScore,
      sovereigntyScoreNormalized: vec.sovereigntyScoreNormalized,
      integrityStatusRisk: vec.integrityStatusRisk,
      mlHealthScore: clamp01(healthScore),
      vectorDimension: vec.mlVectorArray.length,
      mlVectorArray: vec.mlVectorArray as unknown as JsonValue,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId,
      liveops: {
        worldEventName: `bootstrap:ml-vector:${runId.slice(0, 8)}`,
        heatMultiplier01: clamp01(1 - healthScore) as Score01,
        helperBlackout: false,
        haterRaidActive: vec.integrityStatusRisk > 0.7,
      },
      metadata: meta,
    };

    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload: chatSignal,
    };
  }

  /**
   * Translate a DL tensor row into a domain-specific chat envelope.
   * Returns one envelope per domain row — consumers pick the rows they care about.
   */
  public translateDLTensorRow(
    tensor: BootstrapDLTensorCompat,
    rowIndex: number,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope | null {
    if (this._mode !== 'verbose') return null;

    const row = tensor.rows[rowIndex];
    if (row == null) return null;

    const ts = nowMs();
    const domainScore =
      row.features.reduce((a, f) => a + f, 0) /
      Math.max(1, row.features.length);

    const meta: Record<string, JsonValue> = {
      runId: tensor.runId,
      mode: tensor.mode,
      domain: row.domain,
      rowIndex: row.rowIndex,
      features: row.features as unknown as JsonValue,
      featureNames: row.featureNames as unknown as JsonValue,
      domainScore: clamp01(domainScore),
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId,
      liveops: {
        worldEventName: `bootstrap:dl-tensor:${row.domain.toLowerCase()}:${tensor.runId.slice(0, 8)}`,
        heatMultiplier01: clamp01(1 - domainScore) as Score01,
        helperBlackout: false,
        haterRaidActive: false,
      },
      metadata: meta,
    };

    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload: chatSignal,
    };
  }

  /**
   * Translate a trend snapshot into a session-level chat envelope.
   */
  public translateTrend(
    trend: BootstrapTrendCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    const ts = nowMs();
    const trendHeat =
      trend.trend === 'DEGRADING'
        ? 0.8
        : trend.trend === 'STABLE'
          ? 0.2
          : 0.05;

    const meta: Record<string, JsonValue> = {
      capturedAt: trend.capturedAt,
      sampleCount: trend.sampleCount,
      windowMs: trend.windowMs,
      avgHealthScore: trend.avgHealthScore,
      minHealthScore: trend.minHealthScore,
      maxHealthScore: trend.maxHealthScore,
      avgHandSize: trend.avgHandSize,
      avgDrawPileSize: trend.avgDrawPileSize,
      avgEconomyNetWorth: trend.avgEconomyNetWorth,
      avgPressureTierEncoded: trend.avgPressureTierEncoded,
      avgBotThreatScore: trend.avgBotThreatScore,
      avgSovereigntyScore: trend.avgSovereigntyScore,
      nominalFraction: trend.nominalFraction,
      degradedFraction: trend.degradedFraction,
      criticalFraction: trend.criticalFraction,
      trend: trend.trend,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId,
      liveops: {
        worldEventName: `bootstrap:trend:${trend.trend.toLowerCase()}`,
        heatMultiplier01: clamp01(trendHeat) as Score01,
        helperBlackout: false,
        haterRaidActive: trend.trend === 'DEGRADING',
      },
      metadata: meta,
    };

    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload: chatSignal,
    };
  }

  /**
   * Translate a session report into a session-summary chat envelope.
   */
  public translateSessionReport(
    report: BootstrapSessionCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    const ts = nowMs();
    const failureRate =
      report.totalBootstraps > 0
        ? report.failedBootstraps / report.totalBootstraps
        : 0;

    const meta: Record<string, JsonValue> = {
      sessionId: report.sessionId,
      startedAtMs: report.startedAtMs,
      capturedAtMs: report.capturedAtMs,
      totalBootstraps: report.totalBootstraps,
      successfulBootstraps: report.successfulBootstraps,
      failedBootstraps: report.failedBootstraps,
      avgHealthScore: report.avgHealthScore,
      minHealthScore: report.minHealthScore,
      maxHealthScore: report.maxHealthScore,
      avgDurationMs: report.avgDurationMs,
      maxDurationMs: report.maxDurationMs,
      nominalCount: report.nominalCount,
      degradedCount: report.degradedCount,
      criticalCount: report.criticalCount,
      modesBootstrapped: report.modesBootstrapped as unknown as JsonValue,
      failureRate,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId,
      liveops: {
        worldEventName: `bootstrap:session:${report.sessionId.slice(0, 8)}`,
        heatMultiplier01: clamp01(failureRate + (1 - report.avgHealthScore) * 0.5) as Score01,
        helperBlackout: false,
        haterRaidActive: report.criticalCount > 0,
      },
      metadata: meta,
    };

    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload: chatSignal,
    };
  }

  /**
   * Build a readiness check envelope — used by the adapter suite to test
   * that the adapter is operational before the first run.
   */
  public buildReadinessProbe(
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    const ts = nowMs();
    const meta: Record<string, JsonValue> = {
      adapterMode: this._mode,
      adapterVersion: '3.0.0',
      ready: true,
      probeTs: ts,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId,
      liveops: {
        worldEventName: 'bootstrap:adapter:readiness-probe',
        heatMultiplier01: 0.0 as Score01,
        helperBlackout: false,
        haterRaidActive: false,
      },
      metadata: meta,
    };

    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload: chatSignal,
    };
  }

  /**
   * Describe the adapter's current configuration.
   */
  public describe(): Readonly<{
    mode: RunBootstrapAdapterMode;
    roomId: Nullable<ChatRoomId>;
    suppressesNominal: boolean;
    includesMLVectorDetails: boolean;
    includesDLTensorDetails: boolean;
  }> {
    return Object.freeze({
      mode: this._mode,
      roomId: this._roomId,
      suppressesNominal: this._mode === 'strict',
      includesMLVectorDetails: this._mode === 'verbose',
      includesDLTensorDetails: this._mode === 'verbose',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default adapter — emits all severities, minimal metadata.
 * Use for standard chat lane ingestion.
 */
export const BOOTSTRAP_DEFAULT_ADAPTER = new RunBootstrapPipelineSignalAdapter(
  'default',
  null,
);

/**
 * Strict adapter — suppresses NOMINAL severity.
 * Use when chat lane only wants actionable signals.
 */
export const BOOTSTRAP_STRICT_ADAPTER = new RunBootstrapPipelineSignalAdapter(
  'strict',
  null,
);

/**
 * Verbose adapter — includes ML vector array and DL tensor metadata.
 * Use for debugging, inspection bundles, and operator dashboards.
 */
export const BOOTSTRAP_VERBOSE_ADAPTER = new RunBootstrapPipelineSignalAdapter(
  'verbose',
  null,
);
