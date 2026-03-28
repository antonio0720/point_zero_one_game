// backend/src/game/engine/chat/adapters/RunCommandGatewaySignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/RunCommandGatewaySignalAdapter.ts
 *
 * Translates RunCommandGateway signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * This prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Gateway signals enter the chat lane on every command:
 *   START, PLAY_CARD, RESOLVE_MODE_ACTION, TICK, RUN_UNTIL_DONE, ABANDON, RESET
 *
 * They carry:
 *   - mode identity (Empire / Predator / Syndicate / Phantom)
 *   - command kind (what action was taken)
 *   - health score (ML-derived [0,1])
 *   - severity (NOMINAL / ELEVATED / CRITICAL / TERMINAL)
 *   - pressure tier label (urgency surface)
 *   - ML vector checksum (audit anchor)
 *   - narration hint (companion/audience presence theater)
 *   - session command count, outcome terminal flag
 *
 * Chat doctrine:
 *   - NOMINAL  → low heat, clean action, companion acknowledgment fires
 *   - ELEVATED → elevated heat, companion caution fires, audience engaged
 *   - CRITICAL → max heat, companion rescue fires, haterRaidActive = true
 *   - TERMINAL → run over, archive signal fires, companion farewell
 *
 * Adapter modes:
 *   default  — standard signal with full command summary
 *   strict   — suppresses NOMINAL severity, only emits ELEVATED/CRITICAL/TERMINAL
 *   verbose  — includes ML vector summary and session stats in metadata
 *
 * Singletons:
 *   GATEWAY_DEFAULT_SIGNAL_ADAPTER
 *   GATEWAY_STRICT_SIGNAL_ADAPTER
 *   GATEWAY_VERBOSE_SIGNAL_ADAPTER
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
// STRUCTURAL COMPAT TYPES — mirrors zero/RunCommandGateway without imports
// ─────────────────────────────────────────────────────────────────────────────

/** Structural compat for GatewaySeverity. */
export type GatewaySeverityCompat =
  | 'NOMINAL'
  | 'ELEVATED'
  | 'CRITICAL'
  | 'TERMINAL';

/** Structural compat for GatewayCommandKind. */
export type GatewayCommandKindCompat =
  | 'START'
  | 'PLAY_CARD'
  | 'RESOLVE_MODE_ACTION'
  | 'TICK'
  | 'RUN_UNTIL_DONE'
  | 'ABANDON'
  | 'RESET';

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

/** Structural compat for RunOutcome. */
type RunOutcomeCompat =
  | 'FREEDOM'
  | 'TIMEOUT'
  | 'BANKRUPT'
  | 'ABANDONED'
  | null;

/**
 * Structural compat shape for GatewayChatSignal (from zero/).
 * Mirrors the interface without importing from zero/ directly.
 */
export interface GatewaySignalCompat {
  readonly generatedAtMs: number;
  readonly severity: GatewaySeverityCompat;
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCodeCompat;
  readonly commandKind: GatewayCommandKindCompat;
  readonly healthScore: number;
  readonly pressureTierLabel: string;
  readonly sessionCommandCount: number;
  readonly outcomeTerminal: boolean;
  readonly mlVectorChecksum: string;
  readonly mlVectorSummary: Readonly<Record<string, number>>;
  readonly narrativeHint: string;
  readonly actionRecommendation: string;
  readonly tags: readonly string[];
}

/**
 * Structural compat for GatewayAnnotationBundle.
 */
export interface GatewayAnnotationCompat {
  readonly runId: string;
  readonly mode: ModeCodeCompat;
  readonly commandKind: GatewayCommandKindCompat;
  readonly tick: number;
  readonly healthScore: number;
  readonly severity: GatewaySeverityCompat;
  readonly pressureAnnotation: string;
  readonly economyAnnotation: string;
  readonly shieldAnnotation: string;
  readonly battleAnnotation: string;
  readonly cardAnnotation: string;
  readonly sovereigntyAnnotation: string;
  readonly commandAnnotation: string;
  readonly sessionAnnotation: string;
  readonly compositeAnnotation: string;
  readonly generatedAtMs: number;
}

/**
 * Structural compat for GatewayNarrationHint.
 */
export interface GatewayNarrationCompat {
  readonly runId: string;
  readonly mode: ModeCodeCompat;
  readonly commandKind: GatewayCommandKindCompat;
  readonly tick: number;
  readonly modeNarration: string;
  readonly commandNarration: string;
  readonly pressureNarration: string;
  readonly outcomeNarration: string;
  readonly fullNarration: string;
  readonly audienceHeat: number;
  readonly urgencyLabel: string;
  readonly generatedAtMs: number;
}

/**
 * Structural compat for GatewayMLVector array form.
 */
export interface GatewayMLVectorCompat {
  readonly modeEncoded: number;
  readonly modeDifficultyMultiplier: number;
  readonly modeTensionFloor: number;
  readonly pressureTierEncoded: number;
  readonly pressureScoreNormalized: number;
  readonly tensionScoreNormalized: number;
  readonly shieldWeakestRatio: number;
  readonly shieldBreachCountNormalized: number;
  readonly economyNetWorthNormalized: number;
  readonly economyCashNormalized: number;
  readonly economyDebtNormalized: number;
  readonly economyIncomeNormalized: number;
  readonly battleActiveBotCountNormalized: number;
  readonly battleBotThreatNormalized: number;
  readonly cascadeActiveCountNormalized: number;
  readonly sovereigntyScoreNormalized: number;
  readonly integrityStatusRisk: number;
  readonly verifiedGradeScore: number;
  readonly handSizeNormalized: number;
  readonly discardRatioNormalized: number;
  readonly drawPileSizeNormalized: number;
  readonly deckEntropyNormalized: number;
  readonly tickNormalized: number;
  readonly phaseNormalized: number;
  readonly commandKindEncoded: number;
  readonly cardPowerScore: number;
  readonly cardTimingPriority: number;
  readonly sessionCommandCountNormalized: number;
  readonly outcomeTerminalFlag: number;
  readonly runProgressFraction: number;
  readonly archiveFinalizedFlag: number;
  readonly decisionsAcceptedRatio: number;
  readonly mlVectorArray: readonly number[];
}

/**
 * Structural compat for GatewayDLTensor.
 */
export interface GatewayDLTensorCompat {
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
  readonly commandKind: GatewayCommandKindCompat;
}

/**
 * Structural compat for GatewayTrendSnapshot.
 */
export interface GatewayTrendCompat {
  readonly windowSize: number;
  readonly sampleCount: number;
  readonly featureDrift: Readonly<Record<string, number>>;
  readonly dominantDriftFeature: string;
  readonly dominantDriftMagnitude: number;
  readonly trendDirection: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  readonly avgHealthScore: number;
  readonly capturedAtMs: number;
}

/**
 * Structural compat for GatewaySessionReport.
 */
export interface GatewaySessionCompat {
  readonly sessionId: string;
  readonly runId: string | null;
  readonly mode: ModeCodeCompat | null;
  readonly totalCommands: number;
  readonly commandBreakdown: Readonly<Record<string, number>>;
  readonly totalCardsPlayed: number;
  readonly totalTicksAdvanced: number;
  readonly totalModeActionsResolved: number;
  readonly totalAbandons: number;
  readonly avgHealthScore: number;
  readonly peakPressureTier: string;
  readonly archivesGenerated: number;
  readonly mlVectorChecksums: readonly string[];
  readonly startedAtMs: number;
  readonly lastCommandAtMs: number;
}

/**
 * Structural compat for GatewayHealthSnapshot.
 */
export interface GatewayHealthSnapshotCompat {
  readonly runId: string;
  readonly tick: number;
  readonly mode: ModeCodeCompat;
  readonly commandKind: GatewayCommandKindCompat;
  readonly healthScore: number;
  readonly severity: GatewaySeverityCompat;
  readonly economyHealth: number;
  readonly pressureHealth: number;
  readonly shieldHealth: number;
  readonly battleHealth: number;
  readonly cascadeHealth: number;
  readonly sovereigntyHealth: number;
  readonly cardHealth: number;
  readonly isRecoverable: boolean;
  readonly urgencyLabel: string;
  readonly capturedAtMs: number;
}

/**
 * Structural compat for GatewayRunSummary.
 */
export interface GatewayRunSummaryCompat {
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCodeCompat;
  readonly finalTick: number;
  readonly outcome: RunOutcomeCompat;
  readonly finalNetWorth: number;
  readonly totalCommandsIssued: number;
  readonly totalCardsPlayed: number;
  readonly totalTicksAdvanced: number;
  readonly finalHealthScore: number;
  readonly finalSeverity: GatewaySeverityCompat;
  readonly proofHash: string | null;
  readonly sovereigntyScore: number;
  readonly integrityStatus: IntegrityStatusCompat;
  readonly verifiedGrade: string | null;
  readonly mlVectorChecksum: string;
  readonly generatedAtMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER MODE
// ─────────────────────────────────────────────────────────────────────────────

export type RunCommandGatewayAdapterMode = 'default' | 'strict' | 'verbose';

// ─────────────────────────────────────────────────────────────────────────────
// MODE DISPLAY NAMES (chat-facing labels)
// ─────────────────────────────────────────────────────────────────────────────

const GATEWAY_MODE_DISPLAY: Readonly<Record<ModeCodeCompat, string>> =
  Object.freeze({
    solo: 'Empire — GO ALONE',
    pvp: 'Predator — HEAD TO HEAD',
    coop: 'Syndicate — TEAM UP',
    ghost: 'Phantom — CHASE A LEGEND',
  });

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND KIND DISPLAY NAMES
// ─────────────────────────────────────────────────────────────────────────────

const GATEWAY_COMMAND_DISPLAY: Readonly<Record<GatewayCommandKindCompat, string>> =
  Object.freeze({
    START:               'Run Started',
    PLAY_CARD:           'Card Played',
    RESOLVE_MODE_ACTION: 'Mode Action Resolved',
    TICK:                'Tick Advanced',
    RUN_UNTIL_DONE:      'Run Until Done',
    ABANDON:             'Run Abandoned',
    RESET:               'Gateway Reset',
  });

// ─────────────────────────────────────────────────────────────────────────────
// SEVERITY → HEAT MAP
// ─────────────────────────────────────────────────────────────────────────────

const GATEWAY_SEVERITY_HEAT: Readonly<Record<GatewaySeverityCompat, number>> =
  Object.freeze({
    NOMINAL:  0.1,
    ELEVATED: 0.5,
    CRITICAL: 0.85,
    TERMINAL: 1.0,
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
// COMMAND KIND → HELPER BLACKOUT FLAGS
// Some command kinds (ABANDON, RESET, TERMINAL) should suppress helper chat.
// ─────────────────────────────────────────────────────────────────────────────

const COMMAND_HELPER_BLACKOUT: Readonly<Record<GatewayCommandKindCompat, boolean>> =
  Object.freeze({
    START:               false,
    PLAY_CARD:           false,
    RESOLVE_MODE_ACTION: false,
    TICK:                false,
    RUN_UNTIL_DONE:      false,
    ABANDON:             true,
    RESET:               true,
  });

// ─────────────────────────────────────────────────────────────────────────────
// MODULE METADATA
// ─────────────────────────────────────────────────────────────────────────────

export const GATEWAY_SIGNAL_ADAPTER_VERSION = '1.0.0' as const;
export const GATEWAY_SIGNAL_ADAPTER_READY = true as const;
export const GATEWAY_SIGNAL_ADAPTER_SCHEMA = 'gateway-signal-adapter.v1.2026' as const;

/** Feature count used in verbose ML vector summaries. */
export const GATEWAY_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 32 as const;

/** Maximum heat score this adapter can emit (capped by clamp01). */
export const GATEWAY_SIGNAL_ADAPTER_MAX_HEAT = 1.0 as const;

/** World event name prefix for all gateway signals. */
export const GATEWAY_SIGNAL_WORLD_EVENT_PREFIX = 'gateway' as const;

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

/**
 * Compute audience heat from gateway signal.
 * TERMINAL always returns 1.0; otherwise blended from health, pressure, and severity.
 */
function computeGatewayHeat(signal: GatewaySignalCompat): Score01 {
  if (signal.severity === 'TERMINAL') {
    return 1.0 as Score01;
  }

  const severityHeat = GATEWAY_SEVERITY_HEAT[signal.severity] ?? 0.1;
  const healthHeat = clamp01(1 - signal.healthScore);

  // Derive tier heat from pressureTierLabel
  const tierMap: Record<string, number> = {
    Calm:     PRESSURE_TIER_HEAT.T0,
    Building: PRESSURE_TIER_HEAT.T1,
    Elevated: PRESSURE_TIER_HEAT.T2,
    Critical: PRESSURE_TIER_HEAT.T3,
    Apex:     PRESSURE_TIER_HEAT.T4,
  };
  const pressureHeat = tierMap[signal.pressureTierLabel] ?? 0;

  const blended =
    severityHeat * 0.35 +
    healthHeat   * 0.40 +
    pressureHeat * 0.25;

  return clamp01(blended) as Score01;
}

/**
 * Compute audience heat from a health snapshot directly.
 */
function computeHealthSnapshotHeat(snap: GatewayHealthSnapshotCompat): Score01 {
  const healthHeat = clamp01(1 - snap.healthScore);
  const severityHeat = GATEWAY_SEVERITY_HEAT[snap.severity] ?? 0.1;
  return clamp01(healthHeat * 0.6 + severityHeat * 0.4) as Score01;
}

/**
 * Build the world event name for a gateway signal.
 * Format: gateway:{mode}:{commandKind}:{severity}
 */
function buildGatewayWorldEventName(signal: GatewaySignalCompat): string {
  return `${GATEWAY_SIGNAL_WORLD_EVENT_PREFIX}:${signal.mode}:${signal.commandKind.toLowerCase()}:${signal.severity.toLowerCase()}`;
}

/**
 * Build the world event name for an annotation.
 */
function buildAnnotationWorldEventName(ann: GatewayAnnotationCompat): string {
  return `${GATEWAY_SIGNAL_WORLD_EVENT_PREFIX}:${ann.mode}:annotation:${ann.commandKind.toLowerCase()}`;
}

/**
 * Build the world event name for a narration hint.
 */
function buildNarrationWorldEventName(narr: GatewayNarrationCompat): string {
  return `${GATEWAY_SIGNAL_WORLD_EVENT_PREFIX}:${narr.mode}:narration:${narr.commandKind.toLowerCase()}`;
}

/**
 * Build the world event name for a trend snapshot.
 */
function buildTrendWorldEventName(trend: GatewayTrendCompat, mode: string): string {
  return `${GATEWAY_SIGNAL_WORLD_EVENT_PREFIX}:${mode}:trend:${trend.trendDirection.toLowerCase()}`;
}

/**
 * Build the world event name for a session report.
 */
function buildSessionWorldEventName(sess: GatewaySessionCompat): string {
  const modeStr = sess.mode ?? 'unknown';
  return `${GATEWAY_SIGNAL_WORLD_EVENT_PREFIX}:${modeStr}:session:summary`;
}

/**
 * Build the world event name for a run summary.
 */
function buildRunSummaryWorldEventName(summary: GatewayRunSummaryCompat): string {
  const outcome = summary.outcome ?? 'ONGOING';
  return `${GATEWAY_SIGNAL_WORLD_EVENT_PREFIX}:${summary.mode}:run_summary:${outcome.toLowerCase()}`;
}

/**
 * Build a metadata record from the gateway signal.
 */
function buildGatewayMeta(
  signal: GatewaySignalCompat,
  additionalMeta: Record<string, JsonValue> = {},
): Record<string, JsonValue> {
  return {
    severity: signal.severity,
    runId: signal.runId,
    userId: signal.userId,
    mode: signal.mode,
    modeDisplayName: GATEWAY_MODE_DISPLAY[signal.mode] ?? signal.mode,
    commandKind: signal.commandKind,
    commandDisplayName: GATEWAY_COMMAND_DISPLAY[signal.commandKind] ?? signal.commandKind,
    healthScore: signal.healthScore,
    pressureTierLabel: signal.pressureTierLabel,
    sessionCommandCount: signal.sessionCommandCount,
    outcomeTerminal: signal.outcomeTerminal,
    mlVectorChecksum: signal.mlVectorChecksum,
    narrativeHint: signal.narrativeHint,
    actionRecommendation: signal.actionRecommendation,
    tags: signal.tags as unknown as JsonValue,
    generatedAtMs: signal.generatedAtMs,
    ...additionalMeta,
  };
}

/**
 * Build a ChatInputEnvelope for a gateway signal.
 */
function buildGatewayEnvelope(
  signal: GatewaySignalCompat,
  additionalMeta: Record<string, JsonValue> = {},
  roomId: Nullable<ChatRoomId> = null,
): ChatInputEnvelope {
  const ts = nowMs();
  const heat = computeGatewayHeat(signal);
  const worldEventName = buildGatewayWorldEventName(signal);
  const isTerminal = signal.severity === 'TERMINAL';
  const isCritical = signal.severity === 'CRITICAL';
  const helperBlackout = COMMAND_HELPER_BLACKOUT[signal.commandKind] ?? false;
  const haterRaidActive = isCritical || isTerminal;

  const meta = buildGatewayMeta(signal, additionalMeta);

  const chatSignal: ChatSignalEnvelope = {
    type: 'LIVEOPS',
    emittedAt: ts,
    roomId,
    liveops: {
      worldEventName,
      heatMultiplier01: heat,
      helperBlackout,
      haterRaidActive,
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

export interface GatewayTranslationResult {
  readonly envelope: ChatInputEnvelope | null;
  readonly suppressed: boolean;
  readonly suppressionReason: string | null;
  readonly severity: GatewaySeverityCompat;
  readonly commandKind: GatewayCommandKindCompat;
  readonly heatScore: Score01;
  readonly worldEventName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RunCommandGatewaySignalAdapter
 *
 * Translates GatewayChatSignal into chat lane LIVEOPS_SIGNAL envelopes.
 * Structural compat types prevent circular imports from zero/.
 *
 * All methods are pure: no state is mutated; no side effects.
 *
 * Modes:
 *   default  — standard signal for all severity levels
 *   strict   — suppresses NOMINAL severity, emits ELEVATED/CRITICAL/TERMINAL only
 *   verbose  — includes ML vector summary and session stats in metadata
 */
export class RunCommandGatewaySignalAdapter {
  private readonly _mode: RunCommandGatewayAdapterMode;

  private readonly _roomId: Nullable<ChatRoomId>;

  public constructor(
    mode: RunCommandGatewayAdapterMode = 'default',
    roomId: Nullable<ChatRoomId> = null,
  ) {
    this._mode = mode;
    this._roomId = roomId;
  }

  public get adapterMode(): RunCommandGatewayAdapterMode {
    return this._mode;
  }

  /**
   * Translate a GatewaySignalCompat into a ChatInputEnvelope.
   * Returns null if the adapter mode suppresses the signal.
   */
  public translate(signal: GatewaySignalCompat): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }

    const additionalMeta: Record<string, JsonValue> =
      this._mode === 'verbose'
        ? {
            adapterMode: this._mode,
            mlVectorSummary: signal.mlVectorSummary as unknown as JsonValue,
            verboseIncluded: true,
          }
        : {};

    return buildGatewayEnvelope(signal, additionalMeta, this._roomId);
  }

  /**
   * Translate with full result metadata (suppression tracking, heat, world event).
   */
  public translateWithResult(signal: GatewaySignalCompat): GatewayTranslationResult {
    const isSuppressed = this._mode === 'strict' && signal.severity === 'NOMINAL';
    const heat = computeGatewayHeat(signal);
    const worldEventName = buildGatewayWorldEventName(signal);

    if (isSuppressed) {
      return {
        envelope: null,
        suppressed: true,
        suppressionReason: 'strict mode suppresses NOMINAL severity',
        severity: signal.severity,
        commandKind: signal.commandKind,
        heatScore: heat,
        worldEventName,
      };
    }

    const additionalMeta: Record<string, JsonValue> =
      this._mode === 'verbose'
        ? {
            adapterMode: this._mode,
            mlVectorSummary: signal.mlVectorSummary as unknown as JsonValue,
          }
        : {};

    const envelope = buildGatewayEnvelope(signal, additionalMeta, this._roomId);

    return {
      envelope,
      suppressed: false,
      suppressionReason: null,
      severity: signal.severity,
      commandKind: signal.commandKind,
      heatScore: heat,
      worldEventName,
    };
  }

  /**
   * Translate an annotation bundle into a supplementary chat envelope.
   * Carries command annotation composite string and per-domain UX summaries.
   */
  public translateAnnotation(
    annotation: GatewayAnnotationCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    const ts = nowMs();
    const worldEventName = buildAnnotationWorldEventName(annotation);
    const modeDisplay = GATEWAY_MODE_DISPLAY[annotation.mode] ?? annotation.mode;
    const commandDisplay = GATEWAY_COMMAND_DISPLAY[annotation.commandKind] ?? annotation.commandKind;
    const severityHeat = GATEWAY_SEVERITY_HEAT[annotation.severity] ?? 0.1;
    const heat = clamp01(severityHeat * 0.6 + (1 - annotation.healthScore) * 0.4) as Score01;

    const meta: Record<string, JsonValue> = {
      annotationType: 'gateway-annotation',
      runId: annotation.runId,
      mode: annotation.mode,
      modeDisplayName: modeDisplay,
      commandKind: annotation.commandKind,
      commandDisplayName: commandDisplay,
      tick: annotation.tick,
      healthScore: annotation.healthScore,
      severity: annotation.severity,
      pressureAnnotation: annotation.pressureAnnotation,
      economyAnnotation: annotation.economyAnnotation,
      shieldAnnotation: annotation.shieldAnnotation,
      battleAnnotation: annotation.battleAnnotation,
      cardAnnotation: annotation.cardAnnotation,
      sovereigntyAnnotation: annotation.sovereigntyAnnotation,
      commandAnnotation: annotation.commandAnnotation,
      sessionAnnotation: annotation.sessionAnnotation,
      compositeAnnotation: annotation.compositeAnnotation,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId: roomId ?? this._roomId,
      liveops: {
        worldEventName,
        heatMultiplier01: heat,
        helperBlackout: false,
        haterRaidActive: annotation.severity === 'CRITICAL' || annotation.severity === 'TERMINAL',
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
   * Translate a narration hint into a chat envelope.
   * Drives companion mode voice, audience heat, and presence theater.
   */
  public translateNarrationHint(
    narration: GatewayNarrationCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    const ts = nowMs();
    const worldEventName = buildNarrationWorldEventName(narration);
    const audienceHeat = clamp01(narration.audienceHeat) as Score01;
    const modeDisplay = GATEWAY_MODE_DISPLAY[narration.mode] ?? narration.mode;

    const meta: Record<string, JsonValue> = {
      narrationHintType: 'gateway-narration',
      runId: narration.runId,
      mode: narration.mode,
      modeDisplayName: modeDisplay,
      commandKind: narration.commandKind,
      tick: narration.tick,
      modeNarration: narration.modeNarration,
      commandNarration: narration.commandNarration,
      pressureNarration: narration.pressureNarration,
      outcomeNarration: narration.outcomeNarration,
      fullNarration: narration.fullNarration,
      audienceHeat: narration.audienceHeat,
      urgencyLabel: narration.urgencyLabel,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId: roomId ?? this._roomId,
      liveops: {
        worldEventName,
        heatMultiplier01: audienceHeat,
        helperBlackout: false,
        haterRaidActive: narration.audienceHeat >= 0.85,
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
   * Translate an ML vector into a chat envelope.
   * Used for operator/debug surfaces that need to inspect the feature vector.
   */
  public translateMLVector(
    vector: GatewayMLVectorCompat,
    runId: string,
    commandKind: GatewayCommandKindCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    const ts = nowMs();
    const worldEventName = `${GATEWAY_SIGNAL_WORLD_EVENT_PREFIX}:${commandKind.toLowerCase()}:ml_vector`;
    const heat = clamp01(1 - vector.sovereigntyScoreNormalized) as Score01;

    const meta: Record<string, JsonValue> = {
      vectorType: 'gateway-ml-vector',
      runId,
      commandKind,
      modeEncoded: vector.modeEncoded,
      modeDifficultyMultiplier: vector.modeDifficultyMultiplier,
      pressureTierEncoded: vector.pressureTierEncoded,
      pressureScoreNormalized: vector.pressureScoreNormalized,
      economyNetWorthNormalized: vector.economyNetWorthNormalized,
      shieldWeakestRatio: vector.shieldWeakestRatio,
      battleBotThreatNormalized: vector.battleBotThreatNormalized,
      sovereigntyScoreNormalized: vector.sovereigntyScoreNormalized,
      integrityStatusRisk: vector.integrityStatusRisk,
      cardPowerScore: vector.cardPowerScore,
      tickNormalized: vector.tickNormalized,
      outcomeTerminalFlag: vector.outcomeTerminalFlag,
      mlVectorArray: vector.mlVectorArray as unknown as JsonValue,
      featureCount: GATEWAY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId: roomId ?? this._roomId,
      liveops: {
        worldEventName,
        heatMultiplier01: heat,
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
   * Translate a DL tensor row into a chat envelope.
   * Carries per-domain feature vector for deep learning diagnostic surfaces.
   */
  public translateDLTensorRow(
    tensor: GatewayDLTensorCompat,
    rowIndex: number,
    runId: string,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope | null {
    const row = tensor.rows[rowIndex];
    if (row === undefined) return null;

    const ts = nowMs();
    const worldEventName =
      `${GATEWAY_SIGNAL_WORLD_EVENT_PREFIX}:${tensor.mode}:dl_tensor:${row.domain.toLowerCase()}`;
    const heat = clamp01(
      row.features.reduce((a, b) => a + b, 0) / row.features.length,
    ) as Score01;

    const meta: Record<string, JsonValue> = {
      tensorRowType: 'gateway-dl-tensor-row',
      runId,
      mode: tensor.mode,
      commandKind: tensor.commandKind,
      domain: row.domain,
      rowIndex: row.rowIndex,
      features: row.features as unknown as JsonValue,
      featureNames: row.featureNames as unknown as JsonValue,
      tensorShape: tensor.shape as unknown as JsonValue,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId: roomId ?? this._roomId,
      liveops: {
        worldEventName,
        heatMultiplier01: heat,
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
   * Translate a trend snapshot into a chat envelope.
   * Carries health drift direction and dominant drift feature.
   */
  public translateTrend(
    trend: GatewayTrendCompat,
    runId: string,
    mode: ModeCodeCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    const ts = nowMs();
    const worldEventName = buildTrendWorldEventName(trend, mode);
    const modeDisplay = GATEWAY_MODE_DISPLAY[mode] ?? mode;

    // Degrading trend = higher heat
    const trendHeat =
      trend.trendDirection === 'DEGRADING'
        ? 0.7
        : trend.trendDirection === 'STABLE'
        ? 0.3
        : 0.1;
    const heat = clamp01(
      trendHeat * 0.6 + (1 - trend.avgHealthScore) * 0.4,
    ) as Score01;

    const meta: Record<string, JsonValue> = {
      trendType: 'gateway-trend',
      runId,
      mode,
      modeDisplayName: modeDisplay,
      windowSize: trend.windowSize,
      sampleCount: trend.sampleCount,
      trendDirection: trend.trendDirection,
      avgHealthScore: trend.avgHealthScore,
      dominantDriftFeature: trend.dominantDriftFeature,
      dominantDriftMagnitude: trend.dominantDriftMagnitude,
      featureDrift: trend.featureDrift as unknown as JsonValue,
      capturedAtMs: trend.capturedAtMs,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId: roomId ?? this._roomId,
      liveops: {
        worldEventName,
        heatMultiplier01: heat,
        helperBlackout: false,
        haterRaidActive: trend.trendDirection === 'DEGRADING' && heat >= 0.7,
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
   * Translate a session report into a chat envelope.
   * Summarizes all commands in a session for analytics dashboards.
   */
  public translateSessionReport(
    session: GatewaySessionCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    const ts = nowMs();
    const worldEventName = buildSessionWorldEventName(session);
    const modeDisplay =
      session.mode !== null
        ? GATEWAY_MODE_DISPLAY[session.mode] ?? session.mode
        : 'Unknown';
    const heat = clamp01(1 - session.avgHealthScore) as Score01;

    const meta: Record<string, JsonValue> = {
      sessionType: 'gateway-session-report',
      sessionId: session.sessionId,
      runId: session.runId,
      mode: session.mode,
      modeDisplayName: modeDisplay,
      totalCommands: session.totalCommands,
      commandBreakdown: session.commandBreakdown as unknown as JsonValue,
      totalCardsPlayed: session.totalCardsPlayed,
      totalTicksAdvanced: session.totalTicksAdvanced,
      totalModeActionsResolved: session.totalModeActionsResolved,
      totalAbandons: session.totalAbandons,
      avgHealthScore: session.avgHealthScore,
      peakPressureTier: session.peakPressureTier,
      archivesGenerated: session.archivesGenerated,
      startedAtMs: session.startedAtMs,
      lastCommandAtMs: session.lastCommandAtMs,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId: roomId ?? this._roomId,
      liveops: {
        worldEventName,
        heatMultiplier01: heat,
        helperBlackout: false,
        haterRaidActive: session.avgHealthScore < 0.3,
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
   * Translate a health snapshot into a chat envelope.
   * Drives per-domain health display in companion and operator surfaces.
   */
  public translateHealthSnapshot(
    snap: GatewayHealthSnapshotCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    const ts = nowMs();
    const worldEventName =
      `${GATEWAY_SIGNAL_WORLD_EVENT_PREFIX}:${snap.mode}:health_snapshot:${snap.severity.toLowerCase()}`;
    const heat = computeHealthSnapshotHeat(snap);
    const modeDisplay = GATEWAY_MODE_DISPLAY[snap.mode] ?? snap.mode;
    const commandDisplay = GATEWAY_COMMAND_DISPLAY[snap.commandKind] ?? snap.commandKind;

    const meta: Record<string, JsonValue> = {
      snapshotType: 'gateway-health-snapshot',
      runId: snap.runId,
      tick: snap.tick,
      mode: snap.mode,
      modeDisplayName: modeDisplay,
      commandKind: snap.commandKind,
      commandDisplayName: commandDisplay,
      healthScore: snap.healthScore,
      severity: snap.severity,
      economyHealth: snap.economyHealth,
      pressureHealth: snap.pressureHealth,
      shieldHealth: snap.shieldHealth,
      battleHealth: snap.battleHealth,
      cascadeHealth: snap.cascadeHealth,
      sovereigntyHealth: snap.sovereigntyHealth,
      cardHealth: snap.cardHealth,
      isRecoverable: snap.isRecoverable,
      urgencyLabel: snap.urgencyLabel,
      capturedAtMs: snap.capturedAtMs,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId: roomId ?? this._roomId,
      liveops: {
        worldEventName,
        heatMultiplier01: heat,
        helperBlackout: !snap.isRecoverable,
        haterRaidActive: snap.severity === 'CRITICAL' || snap.severity === 'TERMINAL',
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
   * Translate a run summary into a terminal chat envelope.
   * Fires once per run on FREEDOM / BANKRUPT / TIMEOUT / ABANDONED outcome.
   */
  public translateRunSummary(
    summary: GatewayRunSummaryCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    const ts = nowMs();
    const worldEventName = buildRunSummaryWorldEventName(summary);
    const modeDisplay = GATEWAY_MODE_DISPLAY[summary.mode] ?? summary.mode;
    const outcomeStr = summary.outcome ?? 'ONGOING';
    const isWin = outcomeStr === 'FREEDOM';
    const heat = isWin ? 0.5 : clamp01(1 - summary.finalHealthScore) as Score01;

    const meta: Record<string, JsonValue> = {
      summaryType: 'gateway-run-summary',
      runId: summary.runId,
      userId: summary.userId,
      mode: summary.mode,
      modeDisplayName: modeDisplay,
      finalTick: summary.finalTick,
      outcome: outcomeStr,
      finalNetWorth: summary.finalNetWorth,
      totalCommandsIssued: summary.totalCommandsIssued,
      totalCardsPlayed: summary.totalCardsPlayed,
      totalTicksAdvanced: summary.totalTicksAdvanced,
      finalHealthScore: summary.finalHealthScore,
      finalSeverity: summary.finalSeverity,
      proofHash: summary.proofHash,
      sovereigntyScore: summary.sovereigntyScore,
      integrityStatus: summary.integrityStatus,
      verifiedGrade: summary.verifiedGrade,
      mlVectorChecksum: summary.mlVectorChecksum,
      generatedAtMs: summary.generatedAtMs,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId: roomId ?? this._roomId,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: false,
        haterRaidActive: outcomeStr === 'BANKRUPT' || outcomeStr === 'TIMEOUT',
      },
      metadata: meta,
    };

    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload: chatSignal,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON ADAPTERS
// ─────────────────────────────────────────────────────────────────────────────

/** Default adapter — emits all severity levels. */
export const GATEWAY_DEFAULT_SIGNAL_ADAPTER = new RunCommandGatewaySignalAdapter(
  'default',
  null,
);

/** Strict adapter — suppresses NOMINAL, only emits ELEVATED/CRITICAL/TERMINAL. */
export const GATEWAY_STRICT_SIGNAL_ADAPTER = new RunCommandGatewaySignalAdapter(
  'strict',
  null,
);

/** Verbose adapter — includes ML vector summary and session stats in metadata. */
export const GATEWAY_VERBOSE_SIGNAL_ADAPTER = new RunCommandGatewaySignalAdapter(
  'verbose',
  null,
);

// ─────────────────────────────────────────────────────────────────────────────
// MODULE MANIFEST
// ─────────────────────────────────────────────────────────────────────────────

export const GATEWAY_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  version: GATEWAY_SIGNAL_ADAPTER_VERSION,
  ready: GATEWAY_SIGNAL_ADAPTER_READY,
  schema: GATEWAY_SIGNAL_ADAPTER_SCHEMA,
  mlFeatureCount: GATEWAY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  maxHeat: GATEWAY_SIGNAL_ADAPTER_MAX_HEAT,
  worldEventPrefix: GATEWAY_SIGNAL_WORLD_EVENT_PREFIX,
  adapterModes: ['default', 'strict', 'verbose'] as const,
  singletons: [
    'GATEWAY_DEFAULT_SIGNAL_ADAPTER',
    'GATEWAY_STRICT_SIGNAL_ADAPTER',
    'GATEWAY_VERBOSE_SIGNAL_ADAPTER',
  ] as const,
  methods: [
    'translate',
    'translateWithResult',
    'translateAnnotation',
    'translateNarrationHint',
    'translateMLVector',
    'translateDLTensorRow',
    'translateTrend',
    'translateSessionReport',
    'translateHealthSnapshot',
    'translateRunSummary',
  ] as const,
});
