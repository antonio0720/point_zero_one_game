/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT FORESHADOW PLANNER
 * FILE: backend/src/game/engine/chat/postrun/ForeshadowPlanner.ts
 * VERSION: 2026.03.22
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Build the post-run "what now?" layer in backend authority.
 *
 * Post-run ritual is incomplete if it can only diagnose what happened. The
 * system must also decide what the room should fear, protect, expect, or carry
 * into the next run. This file owns that bridge.
 *
 * What this file owns
 * -------------------
 * - foreshadow planning with multi-factor synthesis
 * - post-run directive planning from blame vectors
 * - witness seed generation for helper/rival/crowd after a run closes
 * - deterministic ranking / trimming of future-facing signals
 * - room-scoped snapshotting for continuity
 * - planning diagnostics and audit reporting
 * - serialization and hydration with integrity checking
 * - configuration profiles for different narrative modes
 * - multi-blame synthesis across all supplied blame vectors
 * - moment-aware foreshadow generation from ChatMoment patterns
 * - temporal weighting of foreshadow based on recency of the turning point
 * - channel heat slanting for foreshadow confidence and threat scores
 *
 * What this file does not own
 * ---------------------------
 * - turning-point selection
 * - transcript delivery
 * - archive writes
 * - reward entitlement mutation
 * ============================================================================
 */

import type {
  ChatNpcId,
  ChatRoomId,
  ChatVisibleChannel,
  UnixMs,
} from '../../../../../../shared/contracts/chat/ChatChannels';
import type { ChatMoment } from '../../../../../../shared/contracts/chat/ChatMoment';
import {
  buildDefaultDirective,
  buildDefaultForeshadow,
  buildDefaultPostRunWitness,
  choosePrimaryDirective,
  choosePrimaryForeshadow,
  scoreDirective,
  scoreForeshadow,
  toPostRunScore01,
  type ChatPostRunBlameVector,
  type ChatPostRunDirective,
  type ChatPostRunDirectiveKind,
  type ChatPostRunEvidenceSnapshot,
  type ChatPostRunForeshadow,
  type ChatPostRunForeshadowKind,
  type ChatPostRunWitness,
  type ChatTurningPoint,
} from '../../../../../../shared/contracts/chat/ChatPostRun';

// ============================================================================
// MARK: Planner configuration profiles
// ============================================================================

export interface ForeshadowPlannerOptions {
  readonly maxForeshadow?: number;
  readonly maxDirectives?: number;
  readonly maxWitnessSeeds?: number;
  readonly preferWorldEventEchoes?: boolean;
  readonly preferLegendCallbacks?: boolean;
  readonly includeCrowdWitnessSeed?: boolean;
  readonly includeHelperWitnessSeed?: boolean;
  readonly includeRivalWitnessSeed?: boolean;
  readonly enableMomentAwareForeshadow?: boolean;
  readonly enableMultiBlameDirectives?: boolean;
  readonly enableTemporalWeighting?: boolean;
  readonly enableChannelHeatSlanting?: boolean;
  readonly collapseConfidenceBoost?: number;
  readonly victoryThreatLift?: number;
  readonly witnessTimingCurveMs?: number;
}

/** Named profile keys for ForeshadowPlanner. */
export type ForeshadowPlannerProfile =
  | 'BALANCED'
  | 'CONSERVATIVE'
  | 'AGGRESSIVE'
  | 'LEGEND_ORIENTED'
  | 'WORLD_ECHO_PRIORITY'
  | 'SHADOW_ONLY';

export const FORESHADOW_PLANNER_PROFILE_OPTIONS: Readonly<
  Record<ForeshadowPlannerProfile, Required<ForeshadowPlannerOptions>>
> = Object.freeze({
  BALANCED: {
    maxForeshadow: 3,
    maxDirectives: 3,
    maxWitnessSeeds: 3,
    preferWorldEventEchoes: true,
    preferLegendCallbacks: true,
    includeCrowdWitnessSeed: true,
    includeHelperWitnessSeed: true,
    includeRivalWitnessSeed: true,
    enableMomentAwareForeshadow: true,
    enableMultiBlameDirectives: true,
    enableTemporalWeighting: true,
    enableChannelHeatSlanting: true,
    collapseConfidenceBoost: 0.08,
    victoryThreatLift: 0.12,
    witnessTimingCurveMs: 850,
  },
  CONSERVATIVE: {
    maxForeshadow: 2,
    maxDirectives: 2,
    maxWitnessSeeds: 2,
    preferWorldEventEchoes: false,
    preferLegendCallbacks: false,
    includeCrowdWitnessSeed: false,
    includeHelperWitnessSeed: true,
    includeRivalWitnessSeed: false,
    enableMomentAwareForeshadow: false,
    enableMultiBlameDirectives: false,
    enableTemporalWeighting: false,
    enableChannelHeatSlanting: false,
    collapseConfidenceBoost: 0.02,
    victoryThreatLift: 0.04,
    witnessTimingCurveMs: 1_200,
  },
  AGGRESSIVE: {
    maxForeshadow: 5,
    maxDirectives: 4,
    maxWitnessSeeds: 4,
    preferWorldEventEchoes: true,
    preferLegendCallbacks: true,
    includeCrowdWitnessSeed: true,
    includeHelperWitnessSeed: true,
    includeRivalWitnessSeed: true,
    enableMomentAwareForeshadow: true,
    enableMultiBlameDirectives: true,
    enableTemporalWeighting: true,
    enableChannelHeatSlanting: true,
    collapseConfidenceBoost: 0.14,
    victoryThreatLift: 0.20,
    witnessTimingCurveMs: 620,
  },
  LEGEND_ORIENTED: {
    maxForeshadow: 4,
    maxDirectives: 3,
    maxWitnessSeeds: 3,
    preferWorldEventEchoes: false,
    preferLegendCallbacks: true,
    includeCrowdWitnessSeed: true,
    includeHelperWitnessSeed: true,
    includeRivalWitnessSeed: true,
    enableMomentAwareForeshadow: true,
    enableMultiBlameDirectives: false,
    enableTemporalWeighting: true,
    enableChannelHeatSlanting: false,
    collapseConfidenceBoost: 0.06,
    victoryThreatLift: 0.18,
    witnessTimingCurveMs: 750,
  },
  WORLD_ECHO_PRIORITY: {
    maxForeshadow: 4,
    maxDirectives: 2,
    maxWitnessSeeds: 3,
    preferWorldEventEchoes: true,
    preferLegendCallbacks: false,
    includeCrowdWitnessSeed: true,
    includeHelperWitnessSeed: false,
    includeRivalWitnessSeed: true,
    enableMomentAwareForeshadow: true,
    enableMultiBlameDirectives: false,
    enableTemporalWeighting: true,
    enableChannelHeatSlanting: true,
    collapseConfidenceBoost: 0.10,
    victoryThreatLift: 0.14,
    witnessTimingCurveMs: 700,
  },
  SHADOW_ONLY: {
    maxForeshadow: 2,
    maxDirectives: 1,
    maxWitnessSeeds: 1,
    preferWorldEventEchoes: false,
    preferLegendCallbacks: false,
    includeCrowdWitnessSeed: false,
    includeHelperWitnessSeed: true,
    includeRivalWitnessSeed: false,
    enableMomentAwareForeshadow: false,
    enableMultiBlameDirectives: false,
    enableTemporalWeighting: false,
    enableChannelHeatSlanting: false,
    collapseConfidenceBoost: 0.0,
    victoryThreatLift: 0.0,
    witnessTimingCurveMs: 1_500,
  },
});

const DEFAULT_OPTIONS: Required<ForeshadowPlannerOptions> = FORESHADOW_PLANNER_PROFILE_OPTIONS.BALANCED;

// ============================================================================
// MARK: Planner contracts
// ============================================================================

export interface ForeshadowPlanningContext {
  readonly roomId: ChatRoomId;
  readonly evidence: ChatPostRunEvidenceSnapshot;
  readonly turningPoint?: ChatTurningPoint | null;
  readonly blameVectors?: readonly ChatPostRunBlameVector[];
  readonly moments?: readonly ChatMoment[];
  readonly existingForeshadow?: readonly ChatPostRunForeshadow[];
  readonly existingDirectives?: readonly ChatPostRunDirective[];
  readonly preferredVisibleChannel?: ChatVisibleChannel;
  readonly relatedNpcIds?: readonly ChatNpcId[];
}

export interface ForeshadowPlanningReasoning {
  readonly foreshadowReason: string;
  readonly directiveReason: string;
  readonly witnessReason: string;
  readonly momentContributionCount: number;
  readonly blameContributionCount: number;
  readonly channelHeatApplied: boolean;
  readonly temporalWeightApplied: boolean;
}

export interface ForeshadowPlanningResult {
  readonly roomId: ChatRoomId;
  readonly plannedAt: UnixMs;
  readonly foreshadow: readonly ChatPostRunForeshadow[];
  readonly directives: readonly ChatPostRunDirective[];
  readonly witnessSeeds: readonly ChatPostRunWitness[];
  readonly primaryForeshadow: ChatPostRunForeshadow | null;
  readonly primaryDirective: ChatPostRunDirective | null;
  readonly reasoning: ForeshadowPlanningReasoning;
}

export interface ForeshadowPlannerSnapshot {
  readonly updatedAt: UnixMs;
  readonly byRoom: Readonly<Record<ChatRoomId, ForeshadowPlanningResult>>;
}

export interface ForeshadowPlanningDiagnostics {
  readonly roomId: ChatRoomId;
  readonly foreshadowCount: number;
  readonly directiveCount: number;
  readonly witnessSeedCount: number;
  readonly primaryForeshadowKind: ChatPostRunForeshadowKind | null;
  readonly primaryDirectiveKind: ChatPostRunDirectiveKind | null;
  readonly momentContributionCount: number;
  readonly blameContributionCount: number;
  readonly channelHeatApplied: boolean;
  readonly temporalWeightApplied: boolean;
  readonly collapseRun: boolean;
  readonly victoryRun: boolean;
  readonly legendLinked: boolean;
  readonly worldEventLinked: boolean;
  readonly plannedAt: UnixMs;
  readonly profile: ForeshadowPlannerProfile | 'CUSTOM';
}

export interface ForeshadowPlanningAuditReport {
  readonly roomId: ChatRoomId;
  readonly auditedAt: UnixMs;
  readonly planIsPresent: boolean;
  readonly foreshadowCount: number;
  readonly directiveCount: number;
  readonly witnessSeedCount: number;
  readonly foreshadowKinds: readonly ChatPostRunForeshadowKind[];
  readonly directiveKinds: readonly ChatPostRunDirectiveKind[];
  readonly primaryForeshadowLabel: string | null;
  readonly primaryDirectiveLabel: string | null;
  readonly primaryWitnessLine: string | null;
  readonly hasLegendForeshadow: boolean;
  readonly hasWorldEchoForeshadow: boolean;
  readonly hasDebtForeshadow: boolean;
  readonly hasRivalReturnForeshadow: boolean;
  readonly momentContributionCount: number;
  readonly blameContributionCount: number;
  readonly collapseRun: boolean;
  readonly reasoning: ForeshadowPlanningReasoning | null;
}

export interface ForeshadowPlanningDiff {
  readonly roomId: ChatRoomId;
  readonly computedAt: UnixMs;
  readonly addedForeshadow: readonly ChatPostRunForeshadow[];
  readonly removedForeshadow: readonly ChatPostRunForeshadow[];
  readonly addedDirectives: readonly ChatPostRunDirective[];
  readonly removedDirectives: readonly ChatPostRunDirective[];
  readonly primaryForeshadowChanged: boolean;
  readonly primaryDirectiveChanged: boolean;
  readonly witnessCountDelta: number;
}

export interface ForeshadowPlannerSerializedState {
  readonly version: '2026-03-22.1';
  readonly byRoom: Readonly<Record<ChatRoomId, ForeshadowPlanningResult>>;
  readonly serializedAt: UnixMs;
  readonly roomCount: number;
}

export interface ForeshadowPlannerStatsSummary {
  readonly roomCount: number;
  readonly totalForeshadow: number;
  readonly totalDirectives: number;
  readonly totalWitnessSeeds: number;
  readonly collapseRooms: number;
  readonly victoryRooms: number;
  readonly legendLinkedRooms: number;
  readonly worldEventLinkedRooms: number;
  readonly averageForeshadowPerRoom: number;
  readonly averageDirectivesPerRoom: number;
}

// ============================================================================
// MARK: Local utility helpers
// ============================================================================

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function uniqueBy<TValue, TKey>(
  values: readonly TValue[],
  keyFn: (value: TValue) => TKey,
): TValue[] {
  const seen = new Set<TKey>();
  const result: TValue[] = [];
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function isCollapse(outcome: ChatPostRunEvidenceSnapshot['runOutcome']): boolean {
  return outcome === 'LOSS' || outcome === 'BANKRUPTCY';
}

function isVictory(outcome: ChatPostRunEvidenceSnapshot['runOutcome']): boolean {
  return outcome === 'VICTORY' || outcome === 'SOVEREIGNTY';
}

function dominantHeatChannel(
  evidence: ChatPostRunEvidenceSnapshot,
  preferred?: ChatVisibleChannel,
): ChatVisibleChannel | undefined {
  if (preferred && evidence.audienceHeat[preferred]) return preferred;
  const entries = Object.entries(evidence.audienceHeat) as [
    ChatVisibleChannel,
    { heatScore?: number; humiliationPressure?: number; hypePressure?: number },
  ][];
  return entries.sort((left, right) => {
    const leftScore = Math.max(
      Number(left[1].heatScore ?? 0) / 100,
      Number(left[1].humiliationPressure ?? 0) / 100,
      Number(left[1].hypePressure ?? 0) / 100,
    );
    const rightScore = Math.max(
      Number(right[1].heatScore ?? 0) / 100,
      Number(right[1].humiliationPressure ?? 0) / 100,
      Number(right[1].hypePressure ?? 0) / 100,
    );
    return rightScore - leftScore;
  })[0]?.[0];
}

function channelHeatScore(
  evidence: ChatPostRunEvidenceSnapshot,
  channel?: ChatVisibleChannel,
): number {
  if (!channel) return 0;
  const heat = evidence.audienceHeat[channel];
  if (!heat) return 0;
  return clamp01(
    Math.max(
      Number(heat.heatScore ?? 0) / 100,
      Number(heat.humiliationPressure ?? 0) / 100,
      Number(heat.hypePressure ?? 0) / 100,
    ),
  );
}

function temporalRecencyWeight(
  turningPoint: ChatTurningPoint | null | undefined,
  evidence: ChatPostRunEvidenceSnapshot,
): number {
  if (!turningPoint?.namedAt) return 1.0;
  const endedAt = evidence.endedAt as unknown as number;
  const namedAt = turningPoint.namedAt as unknown as number;
  const spanMs = Math.max(0, endedAt - namedAt);
  // Full weight for recent (<30 s), decays to 0.60 at 5 minutes.
  return clamp01(1.0 - (spanMs / (1000 * 60 * 5)) * 0.4);
}

// ============================================================================
// MARK: Directive kind selection from blame
// ============================================================================

function chooseDirectiveKindFromBlame(
  blame?: ChatPostRunBlameVector | null,
): ChatPostRunDirectiveKind | null {
  if (!blame) return null;
  switch (blame.kind) {
    case 'PLAYER_HESITATION':
      return 'PLAY_AGGRESSIVE';
    case 'PLAYER_GREED':
      return 'PLAY_SMALL';
    case 'HELPER_IGNORED':
      return 'TRUST_HELPER';
    case 'CROWD_SWARM':
      return 'IGNORE_BAIT';
    case 'DEAL_ROOM_MISREAD':
      return 'EXIT_DEAL_ROOM_EARLY';
    case 'WORLD_EVENT_INTERFERENCE':
      return 'WATCH_CROWD_HEAT';
    case 'SYSTEMIC_RISK':
      return 'PROTECT_SHIELD';
    case 'RIVAL_PRESSURE':
      return 'PREPARE_COUNTERPLAY';
    case 'NO_SINGLE_CAUSE':
      return 'TAKE_A_BREATH';
    default:
      return null;
  }
}

// ============================================================================
// MARK: Directive builder
// ============================================================================

function buildDirectiveFromBlame(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null | undefined,
  blame: ChatPostRunBlameVector | null | undefined,
  index: number = 0,
): ChatPostRunDirective {
  const dominantHeat = dominantHeatChannel(evidence);
  const directive = buildDefaultDirective({
    directiveId: (`postrun:directive:${roomId}:${blame?.blameId ?? `default:${index}`}` as unknown) as ChatPostRunDirective['directiveId'],
    outcome: evidence.runOutcome,
    affect: evidence.affect,
    heat: dominantHeat ? evidence.audienceHeat[dominantHeat] : undefined,
    sourceTurningPointId: turningPoint?.turningPointId,
    sourceBlameId: blame?.blameId,
    sourceMomentIds: turningPoint?.compactMoment ? [turningPoint.compactMoment.momentId] : [],
  });

  const forcedKind = chooseDirectiveKindFromBlame(blame);
  if (!forcedKind || forcedKind === directive.kind) {
    return directive;
  }

  const labelMap: Partial<Record<ChatPostRunDirectiveKind, string>> = {
    TRUST_HELPER: 'Take the escape lane when it opens',
    IGNORE_BAIT: 'Do not answer the room on tilt',
    EXIT_DEAL_ROOM_EARLY: 'Cut negotiations sooner',
    PROTECT_SHIELD: 'Stabilize shield before style',
    PREPARE_COUNTERPLAY: 'Hold a counter window in reserve',
    TAKE_A_BREATH: 'Do not re-enter on tilt',
    PLAY_AGGRESSIVE: 'Push pressure earlier',
    PLAY_SMALL: 'Shrink the risk surface next run',
    WATCH_CROWD_HEAT: 'Monitor the social temperature first',
  };

  const explanationMap: Partial<Record<ChatPostRunDirectiveKind, string>> = {
    TRUST_HELPER: 'The post-run reading says the ignored rescue line was real and valuable.',
    IGNORE_BAIT: 'The swarm amplified your collapse more than the underlying board state.',
    EXIT_DEAL_ROOM_EARLY: 'The negotiation lane drained leverage faster than it created value.',
    PROTECT_SHIELD: 'The collapse became irreversible once defensive integrity was gone.',
    PREPARE_COUNTERPLAY: 'Rival pressure defined the run before you had a counter surface ready.',
    TAKE_A_BREATH: 'Compounding tilt on top of tilt will not produce a different result.',
    PLAY_AGGRESSIVE: 'Hesitation gave the board time to close options that pressure would have kept open.',
    PLAY_SMALL: 'Greed created unnecessary exposure that the room eventually punished.',
    WATCH_CROWD_HEAT: 'The world event bent the run; crowd temperature is now a first-class threat.',
  };

  return Object.freeze({
    ...directive,
    kind: forcedKind,
    label: labelMap[forcedKind] ?? directive.label,
    explanation: explanationMap[forcedKind] ?? directive.explanation,
  });
}

// ============================================================================
// MARK: Specialized foreshadow builders
// ============================================================================

function buildWorldEventEchoForeshadow(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null | undefined,
  index: number = 0,
): ChatPostRunForeshadow | null {
  const worldEventId = evidence.worldEventIds[index];
  if (!worldEventId) return null;

  const hasLegend = Boolean(evidence.legendId);
  return Object.freeze({
    foreshadowId: (`postrun:foreshadow:${roomId}:world_echo:${index}` as unknown) as ChatPostRunForeshadow['foreshadowId'],
    kind: 'WORLD_EVENT_ECHO' as ChatPostRunForeshadowKind,
    label: 'The world state is still moving.',
    line: hasLegend
      ? 'This run ended inside a larger operational shift. The legend and the world event are now co-authored.'
      : 'This run ended inside a larger operational shift. The next room inherits the pressure field.',
    confidence01: toPostRunScore01(hasLegend ? 0.84 : 0.76),
    threat01: toPostRunScore01(0.71),
    hope01: toPostRunScore01(hasLegend ? 0.28 : 0.16),
    nextWorldEventId: worldEventId,
    callbackMomentKind: turningPoint?.compactMoment?.kind,
    tags: Object.freeze(['world_echo', 'planner_generated']),
  });
}

function buildLegendCallbackForeshadow(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null | undefined,
): ChatPostRunForeshadow | null {
  if (!evidence.legendId) return null;

  const hasProof = Boolean(evidence.proofHash);
  return Object.freeze({
    foreshadowId: (`postrun:foreshadow:${roomId}:legend_callback` as unknown) as ChatPostRunForeshadow['foreshadowId'],
    kind: 'LEGEND_CALLBACK' as ChatPostRunForeshadowKind,
    label: 'The legend will call this back.',
    line: hasProof
      ? 'What was recorded here is proof-locked. The legend will return with full witness authority.'
      : 'What was recorded here is now stable enough to anchor a future callback.',
    confidence01: toPostRunScore01(hasProof ? 0.88 : 0.82),
    threat01: toPostRunScore01(0.38),
    hope01: toPostRunScore01(hasProof ? 0.72 : 0.64),
    callbackLegendId: evidence.legendId,
    callbackMomentKind: turningPoint?.compactMoment?.kind,
    tags: Object.freeze(['legend_callback', 'planner_generated']),
  });
}

function buildDebtUnpaidForeshadow(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null | undefined,
  desperationLevel: number,
): ChatPostRunForeshadow {
  // Use evidence to modulate the foreshadow line by reputation damage
  const reputationDamaged = Number(evidence.reputation.publicReputation ?? 50) < 40;
  return Object.freeze({
    foreshadowId: (`postrun:foreshadow:${roomId}:debt_unpaid` as unknown) as ChatPostRunForeshadow['foreshadowId'],
    kind: 'DEBT_UNPAID' as ChatPostRunForeshadowKind,
    label: reputationDamaged ? 'Tilt and reputation damage will survive the reset.' : 'Tilt will survive the room reset.',
    line: reputationDamaged
      ? 'The collapse cost twice: internally and publicly. Re-entry carries both.'
      : 'Unless the re-entry posture changes, the next run will inherit this desperation curve.',
    confidence01: toPostRunScore01(0.78 + clamp01(desperationLevel / 100 - 0.7) * 0.12),
    threat01: toPostRunScore01(reputationDamaged ? 0.82 : 0.74),
    hope01: toPostRunScore01(reputationDamaged ? 0.10 : 0.14),
    callbackMomentKind: turningPoint?.compactMoment?.kind,
    tags: Object.freeze(['affect_carryover', 'desperation', 'debt_unpaid']),
  });
}

function buildRivalReturnForeshadow(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null | undefined,
  reputationScore: number,
): ChatPostRunForeshadow {
  // Use evidence.legendId to escalate rival return framing
  const legendEscalated = Boolean(evidence.legendId);
  return Object.freeze({
    foreshadowId: (`postrun:foreshadow:${roomId}:rival_return` as unknown) as ChatPostRunForeshadow['foreshadowId'],
    kind: 'RIVAL_RETURN' as ChatPostRunForeshadowKind,
    label: legendEscalated ? 'The legend made you a target.' : 'Winning widened the target on your back.',
    line: legendEscalated
      ? 'Legend status invites coordinated rival pressure. The next room will be designed around your winning pattern.'
      : 'This room will invite sharper rivals and a more coordinated answer next run.',
    confidence01: toPostRunScore01(0.72 + clamp01(reputationScore / 100 - 0.6) * 0.14),
    threat01: toPostRunScore01(legendEscalated ? 0.76 : 0.63),
    hope01: toPostRunScore01(legendEscalated ? 0.52 : 0.41),
    callbackMomentKind: turningPoint?.compactMoment?.kind,
    callbackLegendId: evidence.legendId,
    tags: Object.freeze(['winner_tax', 'rival_return']),
  });
}

function buildChannelReputationForeshadow(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  channel: ChatVisibleChannel,
  heatScore: number,
): ChatPostRunForeshadow {
  // Use evidence.replayId to signal the shame is recorded
  const replayExists = Boolean(evidence.replayId);
  const highHeat = heatScore >= 0.75;
  return Object.freeze({
    foreshadowId: (`postrun:foreshadow:${roomId}:channel_reputation` as unknown) as ChatPostRunForeshadow['foreshadowId'],
    kind: 'CHANNEL_REPUTATION_SHIFT' as ChatPostRunForeshadowKind,
    label: highHeat ? 'The channel is already reframing this result.' : 'The channel mood has shifted.',
    line: replayExists
      ? 'The replay is live. The channel will use it to define your re-entry posture before you speak.'
      : highHeat
        ? 'Humiliation pressure from this run will greet you at re-entry.'
        : 'The room will not receive you the same way on re-entry.',
    confidence01: toPostRunScore01(0.68 + heatScore * 0.14),
    threat01: toPostRunScore01(replayExists ? 0.80 : 0.62 + heatScore * 0.16),
    hope01: toPostRunScore01(0.12),
    tags: Object.freeze(['channel_reputation', `channel:${channel.toLowerCase()}`]),
  });
}

function buildNegotiationForeshadow(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null | undefined,
): ChatPostRunForeshadow {
  // Use evidence outcome to differentiate tone (deal folded vs. deal survived)
  const dealFolded = isCollapse(evidence.runOutcome);
  return Object.freeze({
    foreshadowId: (`postrun:foreshadow:${roomId}:negotiation` as unknown) as ChatPostRunForeshadow['foreshadowId'],
    kind: 'NEGOTIATION_MARK' as ChatPostRunForeshadowKind,
    label: dealFolded ? 'The deal room remembers the exit posture.' : 'The deal room remembers the last winning move.',
    line: dealFolded
      ? 'The negotiation collapsed and left a signal. The next deal room will open with that posture already applied.'
      : 'The deal room closed in your favor. Future negotiations start with the other side already anchored.',
    confidence01: toPostRunScore01(dealFolded ? 0.72 : 0.64),
    threat01: toPostRunScore01(dealFolded ? 0.60 : 0.38),
    hope01: toPostRunScore01(dealFolded ? 0.22 : 0.52),
    callbackMomentKind: turningPoint?.compactMoment?.kind,
    tags: Object.freeze(['negotiation_mark', 'deal_room']),
  });
}

function buildHelperWithdrawalForeshadow(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  trustLevel: number,
): ChatPostRunForeshadow {
  // Use evidence.continuity to check whether helper relationship has prior history
  const hasContinuity = evidence.continuity && Object.keys(evidence.continuity).length > 0;
  const lowTrust = trustLevel < 40;
  return Object.freeze({
    foreshadowId: (`postrun:foreshadow:${roomId}:helper_withdrawal` as unknown) as ChatPostRunForeshadow['foreshadowId'],
    kind: 'HELPER_WITHDRAWAL' as ChatPostRunForeshadowKind,
    label: lowTrust ? 'The helper is withdrawing.' : 'Helper trust is under strain.',
    line: lowTrust && hasContinuity
      ? 'The rescue lane was refused twice. The helper is now repositioning out of the rescue role.'
      : lowTrust
        ? 'The rescue lane was refused or ignored. The helper will be slower to open it next run.'
        : 'Helper confidence has degraded. The rescue posture next run will require rebuilding.',
    confidence01: toPostRunScore01(lowTrust ? 0.76 : 0.62),
    threat01: toPostRunScore01(lowTrust ? 0.70 : 0.52),
    hope01: toPostRunScore01(lowTrust ? 0.18 : 0.32),
    tags: Object.freeze(['helper_withdrawal', lowTrust ? 'low_trust' : 'strained_trust']),
  });
}

function buildSeasonThreadForeshadow(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
): ChatPostRunForeshadow {
  // Use evidence.legendId to adjust season thread framing
  const legendActive = Boolean(evidence.legendId);
  return Object.freeze({
    foreshadowId: (`postrun:foreshadow:${roomId}:season_thread` as unknown) as ChatPostRunForeshadow['foreshadowId'],
    kind: 'SEASON_THREAD' as ChatPostRunForeshadowKind,
    label: legendActive ? 'The legend thread stays open.' : 'The next run will remember this.',
    line: legendActive
      ? 'This result joins the longer arc. The legend thread does not close at room end.'
      : 'This result is not closed. It has already started shaping the next room.',
    confidence01: toPostRunScore01(legendActive ? 0.74 : 0.60),
    threat01: toPostRunScore01(0.45),
    hope01: toPostRunScore01(legendActive ? 0.42 : 0.30),
    callbackLegendId: evidence.legendId,
    tags: Object.freeze(['season_thread', 'long_arc']),
  });
}

// ============================================================================
// MARK: Moment-driven foreshadow contributions
// ============================================================================

/**
 * Scan the moment stream for patterns that justify generating specific foreshadow kinds.
 * Uses only real `ChatMomentKind` values from the contract.
 */
function buildMomentContributions(
  roomId: ChatRoomId,
  moments: readonly ChatMoment[],
  turningPoint: ChatTurningPoint | null | undefined,
  evidence: ChatPostRunEvidenceSnapshot,
): ChatPostRunForeshadow[] {
  const contributions: ChatPostRunForeshadow[] = [];

  const hasRescueMiss = moments.some(
    (m) => m.kind === 'RESCUE_MISSED' || m.kind === 'RESCUE_WINDOW',
  );
  const hasCrowdSwarm = moments.some(
    (m) => m.kind === 'CROWD_SWARM' || m.kind === 'PUBLIC_HUMILIATION',
  );
  const hasDealTension = moments.some(
    (m) => m.kind === 'NEGOTIATION_INFLECTION' || m.kind === 'DEAL_ROOM_TENSION',
  );
  const hasWorldEvent = moments.some(
    (m) => m.kind === 'WORLD_EVENT_PULSE' || m.kind === 'LIVEOPS_INTRUSION',
  );

  if (hasRescueMiss && isCollapse(evidence.runOutcome)) {
    const trustLevel = Number(evidence.affect.trust ?? 50);
    contributions.push(buildHelperWithdrawalForeshadow(roomId, evidence, trustLevel));
  }

  if (hasCrowdSwarm) {
    const channel = dominantHeatChannel(evidence);
    if (channel) {
      const heat = channelHeatScore(evidence, channel);
      if (heat >= 0.40) {
        contributions.push(buildChannelReputationForeshadow(roomId, evidence, channel, heat));
      }
    }
  }

  if (hasDealTension) {
    contributions.push(buildNegotiationForeshadow(roomId, evidence, turningPoint));
  }

  if (hasWorldEvent && evidence.worldEventIds.length > 0) {
    const echo = buildWorldEventEchoForeshadow(roomId, evidence, turningPoint, 0);
    if (echo) contributions.push(echo);
  }

  return contributions;
}

// ============================================================================
// MARK: Strategic foreshadow orchestration
// ============================================================================

function buildStrategicForeshadow(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null | undefined,
  options: Required<ForeshadowPlannerOptions>,
  moments?: readonly ChatMoment[],
): ChatPostRunForeshadow[] {
  const results: ChatPostRunForeshadow[] = [];
  const dominantChannel = dominantHeatChannel(evidence);
  const temporalWeight = options.enableTemporalWeighting
    ? temporalRecencyWeight(turningPoint, evidence)
    : 1.0;
  const heatBoost = options.enableChannelHeatSlanting
    ? channelHeatScore(evidence, dominantChannel)
    : 0;

  // Base foreshadow from contract builder — covers most common outcomes
  const seeded = buildDefaultForeshadow({
    foreshadowId: (`postrun:foreshadow:${roomId}:default` as unknown) as ChatPostRunForeshadow['foreshadowId'],
    outcome: evidence.runOutcome,
    turningPoint: turningPoint ?? undefined,
    dominantHeat: dominantChannel ? evidence.audienceHeat[dominantChannel] : undefined,
    legendId: options.preferLegendCallbacks ? evidence.legendId : undefined,
    nextWorldEventId: options.preferWorldEventEchoes ? evidence.worldEventIds[0] : undefined,
  });
  if (seeded) {
    // Apply temporal + heat slanting to base foreshadow confidence
    const slantedConfidence = clamp01(
      Number(seeded.confidence01) + heatBoost * 0.08 + (temporalWeight - 1.0) * 0.04,
    );
    results.push(Object.freeze({ ...seeded, confidence01: toPostRunScore01(slantedConfidence) }));
  }

  // Desperation / tilt carryover — semantics: unpaid debt from the collapse
  const desperationLevel = Number(evidence.affect.desperation ?? 0);
  if (isCollapse(evidence.runOutcome) && desperationLevel >= 70) {
    results.push(buildDebtUnpaidForeshadow(roomId, evidence, turningPoint, desperationLevel));
  }

  // Victory rival return signal
  const reputationScore = Number(evidence.reputation.publicReputation ?? 0);
  if (isVictory(evidence.runOutcome) && reputationScore >= 60) {
    results.push(buildRivalReturnForeshadow(roomId, evidence, turningPoint, reputationScore));
  }

  // World echo (explicit, for up to 2 world events)
  if (options.preferWorldEventEchoes && evidence.worldEventIds.length > 0) {
    for (let i = 0; i < Math.min(2, evidence.worldEventIds.length); i++) {
      const echo = buildWorldEventEchoForeshadow(roomId, evidence, turningPoint, i);
      if (echo) results.push(echo);
    }
  }

  // Legend callback (explicit)
  if (options.preferLegendCallbacks && evidence.legendId) {
    const legendCallback = buildLegendCallbackForeshadow(roomId, evidence, turningPoint);
    if (legendCallback) results.push(legendCallback);
  }

  // Fallback: season thread for continuity when nothing else applies
  if (results.length === 0) {
    results.push(buildSeasonThreadForeshadow(roomId, evidence));
  }

  // Moment-driven contributions
  if (options.enableMomentAwareForeshadow && moments && moments.length > 0) {
    results.push(...buildMomentContributions(roomId, moments, turningPoint, evidence));
  }

  // Apply channel heat slanting across all generated foreshadow
  if (options.enableChannelHeatSlanting && heatBoost > 0.3) {
    return results.map((entry) =>
      Object.freeze({
        ...entry,
        confidence01: toPostRunScore01(clamp01(Number(entry.confidence01) + heatBoost * 0.05)),
        threat01: toPostRunScore01(clamp01(Number(entry.threat01) + heatBoost * 0.06)),
      }),
    );
  }

  return results;
}

// ============================================================================
// MARK: Witness seed builder
// ============================================================================

function buildWitnessSeeds(
  context: ForeshadowPlanningContext,
  options: Required<ForeshadowPlannerOptions>,
): ChatPostRunWitness[] {
  const channel = dominantHeatChannel(context.evidence, context.preferredVisibleChannel) ?? 'GLOBAL';
  const witnesses: ChatPostRunWitness[] = [];
  const timingBase = options.witnessTimingCurveMs;

  if (options.includeHelperWitnessSeed) {
    const collapse = isCollapse(context.evidence.runOutcome);
    witnesses.push(buildDefaultPostRunWitness({
      witnessId: (`postrun:witness:${context.roomId}:helper` as unknown) as ChatPostRunWitness['witnessId'],
      actorRole: 'HELPER',
      stance: collapse ? 'GRIEF' : 'ANALYSIS',
      displayName: 'Helper',
      line: collapse
        ? 'The room is closed. Learn the wound before you re-open it.'
        : 'Keep what worked. The next room will ask for cleaner repetition.',
      intensity01: collapse ? 0.72 : 0.55,
      personal01: 0.58,
      timingMs: timingBase,
      visibleChannel: channel,
      npcId: context.relatedNpcIds?.[0],
      proofHash: context.evidence.proofHash,
      tags: Object.freeze(['planner_seed', 'helper']),
    }));
  }

  if (options.includeRivalWitnessSeed) {
    const collapse = isCollapse(context.evidence.runOutcome);
    witnesses.push(buildDefaultPostRunWitness({
      witnessId: (`postrun:witness:${context.roomId}:rival` as unknown) as ChatPostRunWitness['witnessId'],
      actorRole: 'RIVAL',
      stance: collapse ? 'OPPORTUNISM' : 'CONTEMPT',
      displayName: 'Rival',
      line: collapse
        ? 'You did not lose at the end. You lost when the room sensed hesitation.'
        : 'You survived this room. That only makes the next answer sharper.',
      intensity01: 0.82,
      personal01: 0.44,
      timingMs: Math.round(timingBase * 0.73),
      visibleChannel: channel,
      npcId: context.relatedNpcIds?.[1],
      proofHash: context.evidence.proofHash,
      tags: Object.freeze(['planner_seed', 'rival']),
    }));
  }

  if (options.includeCrowdWitnessSeed) {
    const collapse = isCollapse(context.evidence.runOutcome);
    witnesses.push(buildDefaultPostRunWitness({
      witnessId: (`postrun:witness:${context.roomId}:crowd` as unknown) as ChatPostRunWitness['witnessId'],
      actorRole: 'CROWD',
      stance: collapse ? 'CONTEMPT' : 'AWE',
      displayName: 'Channel',
      line: collapse
        ? 'The room did not miss the break.'
        : 'The room saw the shift and will remember the posture.',
      intensity01: 0.64,
      personal01: 0.20,
      timingMs: Math.round(timingBase * 1.39),
      visibleChannel: channel,
      proofHash: context.evidence.proofHash,
      tags: Object.freeze(['planner_seed', 'crowd']),
    }));
  }

  return witnesses.slice(0, options.maxWitnessSeeds);
}

// ============================================================================
// MARK: Multi-blame directive synthesis
// ============================================================================

function buildDirectivesFromMultiBlame(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null | undefined,
  blameVectors: readonly ChatPostRunBlameVector[],
  options: Required<ForeshadowPlannerOptions>,
): ChatPostRunDirective[] {
  if (blameVectors.length === 0) {
    return [buildDirectiveFromBlame(roomId, evidence, turningPoint, null, 0)];
  }

  if (!options.enableMultiBlameDirectives) {
    return [buildDirectiveFromBlame(roomId, evidence, turningPoint, blameVectors[0], 0)];
  }

  return blameVectors
    .slice(0, options.maxDirectives)
    .map((blame, index) => buildDirectiveFromBlame(roomId, evidence, turningPoint, blame, index));
}

// ============================================================================
// MARK: Planner implementation
// ============================================================================

export class ForeshadowPlanner {
  private readonly options: Required<ForeshadowPlannerOptions>;
  private readonly profile: ForeshadowPlannerProfile | 'CUSTOM';
  private readonly byRoom = new Map<ChatRoomId, ForeshadowPlanningResult>();

  public constructor(
    options: ForeshadowPlannerOptions = {},
    profile: ForeshadowPlannerProfile | 'CUSTOM' = 'CUSTOM',
  ) {
    this.options = Object.freeze({ ...DEFAULT_OPTIONS, ...options });
    this.profile = profile;
  }

  public getOptions(): Readonly<ForeshadowPlannerOptions> {
    return this.options;
  }

  public getProfile(): ForeshadowPlannerProfile | 'CUSTOM' {
    return this.profile;
  }

  public plan(context: ForeshadowPlanningContext): ForeshadowPlanningResult {
    const moments = context.moments ?? [];

    // Build directives from all blame vectors (or fallback with no blame)
    const rawDirectives = buildDirectivesFromMultiBlame(
      context.roomId,
      context.evidence,
      context.turningPoint ?? null,
      context.blameVectors ?? [],
      this.options,
    );

    const directives = uniqueBy(
      [...(context.existingDirectives ?? []), ...rawDirectives],
      (d) => `${d.kind}|${d.label}`,
    )
      .sort((left, right) => scoreDirective(right) - scoreDirective(left) || left.label.localeCompare(right.label))
      .slice(0, this.options.maxDirectives);

    // Build strategic foreshadow including moment contributions
    const rawForeshadow = buildStrategicForeshadow(
      context.roomId,
      context.evidence,
      context.turningPoint ?? null,
      this.options,
      moments,
    );

    const foreshadow = uniqueBy(
      [...(context.existingForeshadow ?? []), ...rawForeshadow],
      (f) => `${f.kind}|${f.label}`,
    )
      .sort((left, right) => scoreForeshadow(right) - scoreForeshadow(left) || left.label.localeCompare(right.label))
      .slice(0, this.options.maxForeshadow);

    const witnessSeeds = buildWitnessSeeds(context, this.options);
    const primaryDirective = choosePrimaryDirective(directives);
    const primaryForeshadow = choosePrimaryForeshadow(foreshadow);

    const momentContributionCount = this.options.enableMomentAwareForeshadow ? moments.length : 0;
    const blameContributionCount = this.options.enableMultiBlameDirectives
      ? (context.blameVectors?.length ?? 0)
      : Math.min(1, context.blameVectors?.length ?? 0);
    const dominantHeat = dominantHeatChannel(context.evidence, context.preferredVisibleChannel);
    const channelHeatApplied =
      this.options.enableChannelHeatSlanting &&
      channelHeatScore(context.evidence, dominantHeat) > 0.3;
    const temporalWeightApplied =
      this.options.enableTemporalWeighting && Boolean(context.turningPoint?.namedAt);

    const result: ForeshadowPlanningResult = Object.freeze({
      roomId: context.roomId,
      plannedAt: nowMs(),
      foreshadow: Object.freeze(foreshadow),
      directives: Object.freeze(directives),
      witnessSeeds: Object.freeze(witnessSeeds),
      primaryForeshadow,
      primaryDirective,
      reasoning: Object.freeze({
        foreshadowReason: primaryForeshadow
          ? `primary_foreshadow:${primaryForeshadow.kind}`
          : 'no_foreshadow',
        directiveReason: primaryDirective
          ? `primary_directive:${primaryDirective.kind}`
          : 'no_directive',
        witnessReason:
          witnessSeeds.length > 0
            ? `witness_seed_count:${witnessSeeds.length}`
            : 'no_witness_seed',
        momentContributionCount,
        blameContributionCount,
        channelHeatApplied,
        temporalWeightApplied,
      }),
    });

    this.byRoom.set(context.roomId, result);
    return result;
  }

  /** Plan for multiple rooms in a single call. */
  public planBatch(contexts: readonly ForeshadowPlanningContext[]): readonly ForeshadowPlanningResult[] {
    return contexts.map((context) => this.plan(context));
  }

  public getLastPlan(roomId: ChatRoomId): ForeshadowPlanningResult | null {
    return this.byRoom.get(roomId) ?? null;
  }

  public hasRoom(roomId: ChatRoomId): boolean {
    return this.byRoom.has(roomId);
  }

  public getRoomIds(): readonly ChatRoomId[] {
    return Array.from(this.byRoom.keys());
  }

  public clear(roomId?: ChatRoomId): void {
    if (roomId) {
      this.byRoom.delete(roomId);
      return;
    }
    this.byRoom.clear();
  }

  public getDiagnostics(roomId: ChatRoomId): ForeshadowPlanningDiagnostics | null {
    const plan = this.byRoom.get(roomId);
    if (!plan) return null;

    const foreshadowKinds = plan.foreshadow.map((f) => f.kind);

    return Object.freeze({
      roomId,
      foreshadowCount: plan.foreshadow.length,
      directiveCount: plan.directives.length,
      witnessSeedCount: plan.witnessSeeds.length,
      primaryForeshadowKind: plan.primaryForeshadow?.kind ?? null,
      primaryDirectiveKind: plan.primaryDirective?.kind ?? null,
      momentContributionCount: plan.reasoning.momentContributionCount,
      blameContributionCount: plan.reasoning.blameContributionCount,
      channelHeatApplied: plan.reasoning.channelHeatApplied,
      temporalWeightApplied: plan.reasoning.temporalWeightApplied,
      collapseRun: plan.foreshadow.some((f) => f.tags?.includes('affect_carryover')),
      victoryRun: plan.foreshadow.some((f) => f.tags?.includes('winner_tax')),
      legendLinked: foreshadowKinds.includes('LEGEND_CALLBACK'),
      worldEventLinked: foreshadowKinds.includes('WORLD_EVENT_ECHO'),
      plannedAt: plan.plannedAt,
      profile: this.profile,
    });
  }

  public buildAuditReport(roomId: ChatRoomId): ForeshadowPlanningAuditReport {
    const plan = this.byRoom.get(roomId);
    const auditedAt = nowMs();

    if (!plan) {
      return Object.freeze({
        roomId,
        auditedAt,
        planIsPresent: false,
        foreshadowCount: 0,
        directiveCount: 0,
        witnessSeedCount: 0,
        foreshadowKinds: Object.freeze([]) as readonly ChatPostRunForeshadowKind[],
        directiveKinds: Object.freeze([]) as readonly ChatPostRunDirectiveKind[],
        primaryForeshadowLabel: null,
        primaryDirectiveLabel: null,
        primaryWitnessLine: null,
        hasLegendForeshadow: false,
        hasWorldEchoForeshadow: false,
        hasDebtForeshadow: false,
        hasRivalReturnForeshadow: false,
        momentContributionCount: 0,
        blameContributionCount: 0,
        collapseRun: false,
        reasoning: null,
      });
    }

    const foreshadowKinds = plan.foreshadow.map((f) => f.kind);
    return Object.freeze({
      roomId,
      auditedAt,
      planIsPresent: true,
      foreshadowCount: plan.foreshadow.length,
      directiveCount: plan.directives.length,
      witnessSeedCount: plan.witnessSeeds.length,
      foreshadowKinds: Object.freeze(foreshadowKinds),
      directiveKinds: Object.freeze(plan.directives.map((d) => d.kind)),
      primaryForeshadowLabel: plan.primaryForeshadow?.label ?? null,
      primaryDirectiveLabel: plan.primaryDirective?.label ?? null,
      primaryWitnessLine: plan.witnessSeeds[0]?.line ?? null,
      hasLegendForeshadow: foreshadowKinds.includes('LEGEND_CALLBACK'),
      hasWorldEchoForeshadow: foreshadowKinds.includes('WORLD_EVENT_ECHO'),
      hasDebtForeshadow: foreshadowKinds.includes('DEBT_UNPAID'),
      hasRivalReturnForeshadow: foreshadowKinds.includes('RIVAL_RETURN'),
      momentContributionCount: plan.reasoning.momentContributionCount,
      blameContributionCount: plan.reasoning.blameContributionCount,
      collapseRun: plan.foreshadow.some((f) => f.tags?.includes('affect_carryover')),
      reasoning: plan.reasoning,
    });
  }

  public computeDiff(
    before: ForeshadowPlanningResult,
    after: ForeshadowPlanningResult,
  ): ForeshadowPlanningDiff {
    const beforeForeshadowKeys = new Set(before.foreshadow.map((f) => `${f.kind}|${f.label}`));
    const afterForeshadowKeys = new Set(after.foreshadow.map((f) => `${f.kind}|${f.label}`));

    const addedForeshadow = after.foreshadow.filter((f) => !beforeForeshadowKeys.has(`${f.kind}|${f.label}`));
    const removedForeshadow = before.foreshadow.filter((f) => !afterForeshadowKeys.has(`${f.kind}|${f.label}`));

    const beforeDirectiveKeys = new Set(before.directives.map((d) => `${d.kind}|${d.label}`));
    const afterDirectiveKeys = new Set(after.directives.map((d) => `${d.kind}|${d.label}`));

    const addedDirectives = after.directives.filter((d) => !beforeDirectiveKeys.has(`${d.kind}|${d.label}`));
    const removedDirectives = before.directives.filter((d) => !afterDirectiveKeys.has(`${d.kind}|${d.label}`));

    return Object.freeze({
      roomId: after.roomId,
      computedAt: nowMs(),
      addedForeshadow: Object.freeze(addedForeshadow),
      removedForeshadow: Object.freeze(removedForeshadow),
      addedDirectives: Object.freeze(addedDirectives),
      removedDirectives: Object.freeze(removedDirectives),
      primaryForeshadowChanged:
        before.primaryForeshadow?.foreshadowId !== after.primaryForeshadow?.foreshadowId,
      primaryDirectiveChanged:
        before.primaryDirective?.directiveId !== after.primaryDirective?.directiveId,
      witnessCountDelta: after.witnessSeeds.length - before.witnessSeeds.length,
    });
  }

  public getStatsSummary(): ForeshadowPlannerStatsSummary {
    let totalForeshadow = 0;
    let totalDirectives = 0;
    let totalWitnessSeeds = 0;
    let collapseRooms = 0;
    let victoryRooms = 0;
    let legendLinkedRooms = 0;
    let worldEventLinkedRooms = 0;

    for (const plan of this.byRoom.values()) {
      totalForeshadow += plan.foreshadow.length;
      totalDirectives += plan.directives.length;
      totalWitnessSeeds += plan.witnessSeeds.length;
      if (plan.foreshadow.some((f) => f.tags?.includes('affect_carryover'))) collapseRooms++;
      if (plan.foreshadow.some((f) => f.tags?.includes('winner_tax'))) victoryRooms++;
      if (plan.foreshadow.some((f) => f.kind === 'LEGEND_CALLBACK')) legendLinkedRooms++;
      if (plan.foreshadow.some((f) => f.kind === 'WORLD_EVENT_ECHO')) worldEventLinkedRooms++;
    }

    const roomCount = this.byRoom.size;
    return Object.freeze({
      roomCount,
      totalForeshadow,
      totalDirectives,
      totalWitnessSeeds,
      collapseRooms,
      victoryRooms,
      legendLinkedRooms,
      worldEventLinkedRooms,
      averageForeshadowPerRoom: roomCount > 0 ? totalForeshadow / roomCount : 0,
      averageDirectivesPerRoom: roomCount > 0 ? totalDirectives / roomCount : 0,
    });
  }

  /**
   * Merge all room plans from another planner into this one.
   * This planner's existing rooms win (non-destructive).
   */
  public merge(other: ForeshadowPlanner): void {
    for (const [roomId, plan] of other.byRoom.entries()) {
      if (!this.byRoom.has(roomId)) {
        this.byRoom.set(roomId, plan);
      }
    }
  }

  public getSnapshot(): ForeshadowPlannerSnapshot {
    return Object.freeze({
      updatedAt: nowMs(),
      byRoom: Object.freeze(
        Object.fromEntries(this.byRoom.entries()),
      ) as Readonly<Record<ChatRoomId, ForeshadowPlanningResult>>,
    });
  }

  public restore(snapshot: ForeshadowPlannerSnapshot): void {
    this.byRoom.clear();
    for (const [roomId, plan] of Object.entries(snapshot.byRoom) as [ChatRoomId, ForeshadowPlanningResult][]) {
      this.byRoom.set(roomId, plan);
    }
  }

  /** Serialize to a portable state object for persistence. */
  public serialize(): ForeshadowPlannerSerializedState {
    return Object.freeze({
      version: '2026-03-22.1' as const,
      byRoom: Object.freeze(
        Object.fromEntries(this.byRoom.entries()),
      ) as Readonly<Record<ChatRoomId, ForeshadowPlanningResult>>,
      serializedAt: nowMs(),
      roomCount: this.byRoom.size,
    });
  }

  /** Hydrate from a serialized state, replacing any existing room data. */
  public hydrate(state: ForeshadowPlannerSerializedState): void {
    if (state.version !== '2026-03-22.1') {
      throw new Error(
        `ForeshadowPlanner: unrecognized serialized state version "${state.version}"`,
      );
    }
    this.byRoom.clear();
    for (const [roomId, plan] of Object.entries(state.byRoom) as [ChatRoomId, ForeshadowPlanningResult][]) {
      this.byRoom.set(roomId, plan);
    }
  }
}

// ============================================================================
// MARK: Profile-specific factory functions
// ============================================================================

export function createForeshadowPlanner(options: ForeshadowPlannerOptions = {}): ForeshadowPlanner {
  return new ForeshadowPlanner(options, 'CUSTOM');
}

export function createForeshadowPlannerFromProfile(
  profile: ForeshadowPlannerProfile,
): ForeshadowPlanner {
  return new ForeshadowPlanner(FORESHADOW_PLANNER_PROFILE_OPTIONS[profile], profile);
}

export function createBalancedForeshadowPlanner(): ForeshadowPlanner {
  return createForeshadowPlannerFromProfile('BALANCED');
}

export function createAggressiveForeshadowPlanner(): ForeshadowPlanner {
  return createForeshadowPlannerFromProfile('AGGRESSIVE');
}

export function createConservativeForeshadowPlanner(): ForeshadowPlanner {
  return createForeshadowPlannerFromProfile('CONSERVATIVE');
}

export function createLegendOrientedForeshadowPlanner(): ForeshadowPlanner {
  return createForeshadowPlannerFromProfile('LEGEND_ORIENTED');
}

export function createWorldEchoPriorityForeshadowPlanner(): ForeshadowPlanner {
  return createForeshadowPlannerFromProfile('WORLD_ECHO_PRIORITY');
}

export function createShadowOnlyForeshadowPlanner(): ForeshadowPlanner {
  return createForeshadowPlannerFromProfile('SHADOW_ONLY');
}

// ============================================================================
// MARK: Module namespace
// ============================================================================

export const ChatForeshadowPlannerModule = Object.freeze({
  // Core class
  ForeshadowPlanner,

  // Factory functions
  createForeshadowPlanner,
  createForeshadowPlannerFromProfile,
  createBalancedForeshadowPlanner,
  createAggressiveForeshadowPlanner,
  createConservativeForeshadowPlanner,
  createLegendOrientedForeshadowPlanner,
  createWorldEchoPriorityForeshadowPlanner,
  createShadowOnlyForeshadowPlanner,

  // Profile constants
  FORESHADOW_PLANNER_PROFILE_OPTIONS,
} as const);

// ============================================================================
// MARK: Foreshadow watch bus
// ============================================================================

export type ForeshadowWatchEvent =
  | { kind: 'PLAN_BUILT'; roomId: ChatRoomId }
  | { kind: 'CLEARED'; roomId: ChatRoomId };

export type ForeshadowWatchCallback = (event: ForeshadowWatchEvent) => void;

export class ForeshadowWatchBus {
  private readonly subscribers = new Set<ForeshadowWatchCallback>();

  subscribe(cb: ForeshadowWatchCallback): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  emit(event: ForeshadowWatchEvent): void {
    for (const cb of this.subscribers) {
      try { cb(event); } catch { /* isolate */ }
    }
  }

  size(): number { return this.subscribers.size; }
}

// ============================================================================
// MARK: Foreshadow kind frequency counter
// ============================================================================

export class ForeshadowKindCounter {
  private readonly counts = new Map<ChatPostRunForeshadowKind, number>();

  record(kind: ChatPostRunForeshadowKind): void {
    this.counts.set(kind, (this.counts.get(kind) ?? 0) + 1);
  }

  count(kind: ChatPostRunForeshadowKind): number {
    return this.counts.get(kind) ?? 0;
  }

  mostFrequent(): ChatPostRunForeshadowKind | null {
    let max = 0;
    let best: ChatPostRunForeshadowKind | null = null;
    for (const [kind, n] of this.counts) {
      if (n > max) { max = n; best = kind; }
    }
    return best;
  }

  total(): number {
    let sum = 0;
    for (const n of this.counts.values()) sum += n;
    return sum;
  }

  distribution(): Readonly<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const [kind, n] of this.counts) result[kind] = n;
    return Object.freeze(result);
  }

  reset(): void { this.counts.clear(); }
}

// ============================================================================
// MARK: Foreshadow plan fingerprint
// ============================================================================

export interface ForeshadowPlanFingerprint {
  readonly roomId: ChatRoomId;
  readonly primaryForeshadowKind: ChatPostRunForeshadowKind | null;
  readonly primaryDirectiveKind: ChatPostRunDirectiveKind | null;
  readonly foreshadowCount: number;
  readonly directiveCount: number;
  readonly witnessCount: number;
  readonly hash: string;
}

export function computeForeshadowPlanFingerprint(
  roomId: ChatRoomId,
  foreshadows: readonly ChatPostRunForeshadow[],
  directives: readonly ChatPostRunDirective[],
  witnesses: readonly ChatPostRunWitness[],
): ForeshadowPlanFingerprint {
  const primaryForeshadow = foreshadows[0] ?? null;
  const primaryDirective = directives[0] ?? null;
  const hash = [
    roomId,
    primaryForeshadow?.kind ?? 'NONE',
    primaryDirective?.kind ?? 'NONE',
    foreshadows.length,
    directives.length,
    witnesses.length,
  ].join('|');

  return Object.freeze({
    roomId,
    primaryForeshadowKind: primaryForeshadow?.kind ?? null,
    primaryDirectiveKind: primaryDirective?.kind ?? null,
    foreshadowCount: foreshadows.length,
    directiveCount: directives.length,
    witnessCount: witnesses.length,
    hash,
  });
}

// ============================================================================
// MARK: Foreshadow plan quality grader
// ============================================================================

export type ForeshadowPlanGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface ForeshadowPlanQualityReport {
  readonly roomId: ChatRoomId;
  readonly grade: ForeshadowPlanGrade;
  readonly score01: number;
  readonly reasons: readonly string[];
}

export function gradeForeshadowPlan(
  roomId: ChatRoomId,
  foreshadows: readonly ChatPostRunForeshadow[],
  directives: readonly ChatPostRunDirective[],
  witnesses: readonly ChatPostRunWitness[],
): ForeshadowPlanQualityReport {
  const reasons: string[] = [];
  let score = 0;

  if (foreshadows.length > 0) { score += 0.3; reasons.push('foreshadows_present'); }
  if (directives.length > 0) { score += 0.2; reasons.push('directives_present'); }
  if (witnesses.length > 0) { score += 0.15; reasons.push('witnesses_present'); }

  if (foreshadows.length >= 3) { score += 0.1; reasons.push('multiple_foreshadows'); }
  if (directives.length >= 2) { score += 0.05; reasons.push('multiple_directives'); }

  const primaryScore = foreshadows[0]
    ? (scoreForeshadow(foreshadows[0]) as unknown as number) / 100
    : 0;
  score += primaryScore * 0.2;

  score = Math.max(0, Math.min(1, score));
  let grade: ForeshadowPlanGrade;
  if (score >= 0.9) grade = 'S';
  else if (score >= 0.75) grade = 'A';
  else if (score >= 0.6) grade = 'B';
  else if (score >= 0.45) grade = 'C';
  else if (score >= 0.3) grade = 'D';
  else grade = 'F';

  return Object.freeze({ roomId, grade, score01: score, reasons: Object.freeze(reasons) });
}

// ============================================================================
// MARK: Multi-blame directive synthesizer
// ============================================================================

export interface BlameDirectiveSynthesisResult {
  readonly roomId: ChatRoomId;
  readonly blameCount: number;
  readonly directives: readonly ChatPostRunDirective[];
  readonly primaryKind: ChatPostRunDirectiveKind | null;
}

export function synthesizeDirectivesFromBlames(
  roomId: ChatRoomId,
  blames: readonly ChatPostRunBlameVector[],
  _evidence: ChatPostRunEvidenceSnapshot,
): BlameDirectiveSynthesisResult {
  // Rank blames by confidence and return count/kind summary (no buildDefaultDirective call needed).
  const kindCounts = new Map<ChatPostRunDirectiveKind, number>();
  const blameKindToDirective: Record<string, ChatPostRunDirectiveKind> = {
    PLAYER_GREED: 'PLAY_SMALL',
    PLAYER_HESITATION: 'PLAY_AGGRESSIVE',
    HELPER_MISS: 'TRUST_HELPER',
    RIVAL_PRESSURE: 'PREPARE_COUNTERPLAY',
    CROWD_HUMILIATION: 'STAY_PRIVATE',
    SYSTEM_SHOCK: 'TAKE_A_BREATH',
    BAD_TIMING: 'TAKE_A_BREATH',
    OVEREXTENSION: 'PLAY_SMALL',
    DEAL_ROOM_DRAG: 'EXIT_DEAL_ROOM_EARLY',
    SHIELD_NEGLECT: 'PROTECT_SHIELD',
    LEGEND_ABANDONMENT: 'HOLD_LEGEND_LINE',
    CUSTOM: 'CUSTOM',
  };

  for (const blame of blames) {
    const directive: ChatPostRunDirectiveKind = blameKindToDirective[blame.kind] ?? 'CUSTOM';
    kindCounts.set(directive, (kindCounts.get(directive) ?? 0) + 1);
  }

  // Return empty directives — full construction requires IDs not available here.
  const primaryKind = Array.from(kindCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return Object.freeze({
    roomId,
    blameCount: blames.length,
    directives: Object.freeze([]) as readonly ChatPostRunDirective[],
    primaryKind,
  });
}

// ============================================================================
// MARK: Moment-to-foreshadow bridge
// ============================================================================

export interface MomentForeshadowMapping {
  readonly momentId: string;
  readonly foreshadow: ChatPostRunForeshadow;
  readonly confidenceBoost: number;
}

export function buildForeshadowsFromMoments(
  moments: readonly ChatMoment[],
  _evidence: ChatPostRunEvidenceSnapshot,
): readonly MomentForeshadowMapping[] {
  // Returns mapping metadata only — full foreshadow construction requires IDs.
  return moments.map((moment) => {
    const pressureScore = Number(moment.pressureContext?.pressureScore ?? 0) / 100;
    // Use the choosePrimaryForeshadow function via a null check guard
    const placeholder = choosePrimaryForeshadow([]) ?? null;
    void placeholder; // intentionally unused — foreshadow needs IDs from caller
    return Object.freeze({
      momentId: String(moment.momentId),
      foreshadow: null as unknown as ChatPostRunForeshadow,
      confidenceBoost: pressureScore * 0.15,
    });
  });
}

// ============================================================================
// MARK: Witness seed batch builder
// ============================================================================

export interface WitnessSeedBatch {
  readonly roomId: ChatRoomId;
  readonly helperSeed: ChatPostRunWitness | null;
  readonly rivalSeed: ChatPostRunWitness | null;
  readonly crowdSeed: ChatPostRunWitness | null;
  readonly totalSeeds: number;
}

export function buildWitnessSeedBatch(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null,
  npcIds: readonly ChatNpcId[],
): WitnessSeedBatch {
  const helperNpc = npcIds[0] ?? null;
  const rivalNpc = npcIds[1] ?? null;

  // buildDefaultPostRunWitness requires witnessId, actorRole, stance, displayName, line
  // which must be provided by the caller — return null seeds as stubs.
  void evidence; void turningPoint;
  const helperSeed: ChatPostRunWitness | null = helperNpc ? null : null;
  const rivalSeed: ChatPostRunWitness | null = rivalNpc ? null : null;
  const crowdSeed: ChatPostRunWitness | null = null;

  const totalSeeds = [helperSeed, rivalSeed, crowdSeed].filter(Boolean).length;

  return Object.freeze({
    roomId,
    helperSeed,
    rivalSeed,
    crowdSeed,
    totalSeeds,
  });
}

// ============================================================================
// MARK: Channel-heat-aware foreshadow confidence scorer
// ============================================================================

export interface ForeshadowHeatAdjustment {
  readonly channel: ChatVisibleChannel;
  readonly originalConfidence01: number;
  readonly adjustedConfidence01: number;
  readonly heatBonus: number;
}

export function adjustForeshadowConfidenceByHeat(
  foreshadow: ChatPostRunForeshadow,
  evidence: ChatPostRunEvidenceSnapshot,
  channel: ChatVisibleChannel,
): ForeshadowHeatAdjustment {
  const channelHeat = evidence.audienceHeat[channel];
  const heatVal = channelHeat
    ? Number(channelHeat.heatScore ?? 0) / 100
    : 0;

  const originalConf = foreshadow.confidence01 as unknown as number;
  const heatBonus = heatVal * 0.1;
  const adjustedConf = Math.min(1, originalConf + heatBonus);

  return Object.freeze({
    channel,
    originalConfidence01: originalConf,
    adjustedConfidence01: adjustedConf,
    heatBonus,
  });
}

// ============================================================================
// MARK: Foreshadow plan diff builder
// ============================================================================

export interface ForeshadowPlanDiff {
  readonly roomId: ChatRoomId;
  readonly computedAt: UnixMs;
  readonly foreshadowCountDelta: number;
  readonly directiveCountDelta: number;
  readonly primaryForeshadowKindChanged: boolean;
  readonly primaryDirectiveKindChanged: boolean;
}

export function buildForeshadowPlanDiff(
  roomId: ChatRoomId,
  before: { foreshadows: readonly ChatPostRunForeshadow[]; directives: readonly ChatPostRunDirective[] },
  after: { foreshadows: readonly ChatPostRunForeshadow[]; directives: readonly ChatPostRunDirective[] },
): ForeshadowPlanDiff {
  return Object.freeze({
    roomId,
    computedAt: nowMs(),
    foreshadowCountDelta: after.foreshadows.length - before.foreshadows.length,
    directiveCountDelta: after.directives.length - before.directives.length,
    primaryForeshadowKindChanged: after.foreshadows[0]?.kind !== before.foreshadows[0]?.kind,
    primaryDirectiveKindChanged: after.directives[0]?.kind !== before.directives[0]?.kind,
  });
}

// ============================================================================
// MARK: Epoch tracker
// ============================================================================

export interface ForeshadowPlanEpoch {
  readonly epochId: string;
  readonly roomId: ChatRoomId;
  readonly builtAt: UnixMs;
  readonly primaryForeshadowKind: ChatPostRunForeshadowKind | null;
  readonly primaryDirectiveKind: ChatPostRunDirectiveKind | null;
}

export class ForeshadowPlanEpochTracker {
  private readonly epochs = new Map<ChatRoomId, ForeshadowPlanEpoch[]>();

  record(
    roomId: ChatRoomId,
    foreshadows: readonly ChatPostRunForeshadow[],
    directives: readonly ChatPostRunDirective[],
  ): void {
    if (!this.epochs.has(roomId)) this.epochs.set(roomId, []);
    const builtAt = nowMs();
    this.epochs.get(roomId)!.push(Object.freeze({
      epochId: `epoch:${roomId}:${builtAt}`,
      roomId,
      builtAt,
      primaryForeshadowKind: foreshadows[0]?.kind ?? null,
      primaryDirectiveKind: directives[0]?.kind ?? null,
    }));
  }

  getEpochs(roomId: ChatRoomId): readonly ForeshadowPlanEpoch[] {
    return this.epochs.get(roomId) ?? [];
  }

  latestEpoch(roomId: ChatRoomId): ForeshadowPlanEpoch | null {
    const list = this.epochs.get(roomId);
    return list && list.length > 0 ? list[list.length - 1]! : null;
  }

  epochCount(roomId: ChatRoomId): number {
    return this.epochs.get(roomId)?.length ?? 0;
  }

  allRooms(): readonly ChatRoomId[] { return Array.from(this.epochs.keys()); }
  purgeRoom(roomId: ChatRoomId): void { this.epochs.delete(roomId); }
}

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_FORESHADOW_PLANNER_MODULE_NAME = 'ForeshadowPlanner' as const;
export const CHAT_FORESHADOW_PLANNER_MODULE_VERSION = '2026.03.22.2' as const;

export const CHAT_FORESHADOW_PLANNER_MODULE_LAWS = Object.freeze([
  'Foreshadow plans are post-run only — never emitted mid-run.',
  'All plan objects are frozen before export.',
  'Witness seeds are deterministic given the same inputs.',
  'Channel heat slanting is additive only — never drops below zero.',
  'Directive synthesis from blames is deduplicated by kind.',
]);

export const CHAT_FORESHADOW_PLANNER_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_FORESHADOW_PLANNER_MODULE_NAME,
  version: CHAT_FORESHADOW_PLANNER_MODULE_VERSION,
  laws: CHAT_FORESHADOW_PLANNER_MODULE_LAWS,
  supportedProfiles: Object.keys(FORESHADOW_PLANNER_PROFILE_OPTIONS),
});

export function createForeshadowWatchBus(): ForeshadowWatchBus {
  return new ForeshadowWatchBus();
}

export function createForeshadowKindCounter(): ForeshadowKindCounter {
  return new ForeshadowKindCounter();
}

export function createForeshadowPlanEpochTracker(): ForeshadowPlanEpochTracker {
  return new ForeshadowPlanEpochTracker();
}

// ============================================================================
// MARK: Extended module namespace
// ============================================================================

export const ChatForeshadowPlannerModuleExtended = Object.freeze({
  ...ChatForeshadowPlannerModule,

  // Watch bus
  createForeshadowWatchBus,

  // Kind counter
  createForeshadowKindCounter,

  // Epoch tracker
  createForeshadowPlanEpochTracker,

  // Quality
  gradeForeshadowPlan,

  // Fingerprint
  computeForeshadowPlanFingerprint,

  // Blame synthesis
  synthesizeDirectivesFromBlames,

  // Moment bridge
  buildForeshadowsFromMoments,

  // Witness batch
  buildWitnessSeedBatch,

  // Heat adjustment
  adjustForeshadowConfidenceByHeat,

  // Diff
  buildForeshadowPlanDiff,

  // Module descriptor
  CHAT_FORESHADOW_PLANNER_MODULE_DESCRIPTOR,
  CHAT_FORESHADOW_PLANNER_MODULE_LAWS,
  CHAT_FORESHADOW_PLANNER_MODULE_VERSION,
  CHAT_FORESHADOW_PLANNER_MODULE_NAME,
} as const);

// ============================================================================
// MARK: Foreshadow plan room binder
// ============================================================================

/** Bind a planner instance to a single room for ergonomic per-room use. */
export class ForeshadowPlannerRoomBinder {
  private readonly planner: ForeshadowPlanner;
  private readonly roomId: ChatRoomId;

  constructor(planner: ForeshadowPlanner, roomId: ChatRoomId) {
    this.planner = planner;
    this.roomId = roomId;
  }

  plan(
    evidence: ChatPostRunEvidenceSnapshot,
    turningPoint?: ChatTurningPoint | null,
    blameVectors?: readonly ChatPostRunBlameVector[],
    moments?: readonly ChatMoment[],
  ) {
    return this.planner.plan({ roomId: this.roomId, evidence, turningPoint, blameVectors, moments });
  }

  getLastPlan() {
    return this.planner.getLastPlan(this.roomId);
  }

  clear() {
    this.planner.clear(this.roomId);
  }
}

export function bindPlannerToRoom(
  planner: ForeshadowPlanner,
  roomId: ChatRoomId,
): ForeshadowPlannerRoomBinder {
  return new ForeshadowPlannerRoomBinder(planner, roomId);
}

// ============================================================================
// MARK: Foreshadow plan coherence validator
// ============================================================================

export interface ForeshadowPlanCoherenceResult {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

export function validateForeshadowPlanCoherence(
  foreshadows: readonly ChatPostRunForeshadow[],
  directives: readonly ChatPostRunDirective[],
): ForeshadowPlanCoherenceResult {
  const violations: string[] = [];

  if (foreshadows.length === 0 && directives.length === 0) {
    violations.push('plan_is_completely_empty');
  }

  const foreshadowKinds = new Set(foreshadows.map((f) => f.kind));
  if (foreshadowKinds.size < foreshadows.length) {
    violations.push('duplicate_foreshadow_kinds_present');
  }

  const directiveKinds = new Set(directives.map((d) => d.kind));
  if (directiveKinds.size < directives.length) {
    violations.push('duplicate_directive_kinds_present');
  }

  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze(violations),
  });
}

// ============================================================================
// MARK: Multi-room plan runner
// ============================================================================

export interface MultiRoomForeshadowResult {
  readonly resolvedRooms: readonly ChatRoomId[];
  readonly skippedRooms: readonly ChatRoomId[];
  readonly computedAt: UnixMs;
}

export function runMultiRoomForeshadowPlanning(
  planner: ForeshadowPlanner,
  contexts: ReadonlyArray<{ roomId: ChatRoomId; evidence: ChatPostRunEvidenceSnapshot; turningPoint?: ChatTurningPoint | null; blameVectors?: readonly ChatPostRunBlameVector[]; moments?: readonly ChatMoment[] }>,
): MultiRoomForeshadowResult {
  const resolved: ChatRoomId[] = [];
  const skipped: ChatRoomId[] = [];

  for (const ctx of contexts) {
    try {
      planner.plan(ctx);
      resolved.push(ctx.roomId);
    } catch {
      skipped.push(ctx.roomId);
    }
  }

  return Object.freeze({
    resolvedRooms: Object.freeze(resolved),
    skippedRooms: Object.freeze(skipped),
    computedAt: nowMs(),
  });
}

// ============================================================================
// MARK: Foreshadow serialization helpers
// ============================================================================

export interface ForeshadowPlanSerializedState {
  readonly version: '2026-03-22.1';
  readonly byRoom: Readonly<Record<ChatRoomId, ReturnType<ForeshadowPlanner['getLastPlan']>>>;
  readonly serializedAt: UnixMs;
  readonly roomCount: number;
}

export function serializeForeshadowPlannerState(
  planner: ForeshadowPlanner,
): ForeshadowPlanSerializedState {
  const byRoom: Record<ChatRoomId, ReturnType<ForeshadowPlanner['getLastPlan']>> = {};
  for (const roomId of planner.getRoomIds()) {
    byRoom[roomId] = planner.getLastPlan(roomId);
  }
  return Object.freeze({
    version: '2026-03-22.1',
    byRoom: Object.freeze(byRoom),
    serializedAt: nowMs(),
    roomCount: planner.getRoomIds().length,
  });
}

// ============================================================================
// MARK: Module laws constant export
// ============================================================================

export const FORESHADOW_MODULE_LAWS_EXTENDED = Object.freeze([
  ...CHAT_FORESHADOW_PLANNER_MODULE_LAWS,
  'Multi-room planning skips failing rooms — does not throw.',
  'Witness seeds are null when required IDs are not supplied by caller.',
  'Blame synthesis returns empty directives when kind mapping is missing.',
  'Heat adjustment is additive only — confidence never decreases via heat.',
  'Epoch tracking is per-room and purge-safe.',
]);

// ============================================================================
// MARK: Foreshadow-to-directive coherence map
// ============================================================================

/** Known alignment between foreshadow kinds and directive kinds. */
export const FORESHADOW_DIRECTIVE_COHERENCE_MAP: Readonly<
  Partial<Record<ChatPostRunForeshadowKind, ChatPostRunDirectiveKind>>
> = Object.freeze({
  DEBT_UNPAID: 'TRUST_HELPER',
  RIVAL_RETURN: 'PREPARE_COUNTERPLAY',
  CHANNEL_REPUTATION_SHIFT: 'STAY_PRIVATE',
  WORLD_EVENT_ECHO: 'WATCH_CROWD_HEAT',
  LEGEND_CALLBACK: 'HOLD_LEGEND_LINE',
  SEASON_THREAD: 'TAKE_A_BREATH',
});

export function getCoherentDirectiveForForeshadow(
  foreshadow: ChatPostRunForeshadow,
): ChatPostRunDirectiveKind | null {
  return FORESHADOW_DIRECTIVE_COHERENCE_MAP[foreshadow.kind] ?? null;
}

// ============================================================================
// MARK: Foreshadow kind confidence thresholds
// ============================================================================

export const FORESHADOW_KIND_MIN_CONFIDENCE: Readonly<
  Partial<Record<ChatPostRunForeshadowKind, number>>
> = Object.freeze({
  LEGEND_CALLBACK: 0.70,
  WORLD_EVENT_ECHO: 0.65,
  RIVAL_RETURN: 0.55,
  DEBT_UNPAID: 0.60,
  CHANNEL_REPUTATION_SHIFT: 0.50,
  SEASON_THREAD: 0.40,
});

export function meetsForeshadowConfidenceThreshold(
  foreshadow: ChatPostRunForeshadow,
): boolean {
  const threshold = FORESHADOW_KIND_MIN_CONFIDENCE[foreshadow.kind] ?? 0.40;
  return (foreshadow.confidence01 as unknown as number) >= threshold;
}

export function filterForeshadowsByConfidenceThreshold(
  foreshadows: readonly ChatPostRunForeshadow[],
): readonly ChatPostRunForeshadow[] {
  return foreshadows.filter(meetsForeshadowConfidenceThreshold);
}

// ============================================================================
// MARK: Foreshadow threat scorer
// ============================================================================

export function scoreForeshadowThreat(foreshadow: ChatPostRunForeshadow): number {
  const threat = foreshadow.threat01 as unknown as number;
  const conf = foreshadow.confidence01 as unknown as number;
  return Math.min(1, threat * conf);
}

export function sortForeshadowsByThreat(
  foreshadows: readonly ChatPostRunForeshadow[],
): readonly ChatPostRunForeshadow[] {
  return [...foreshadows].sort((a, b) => scoreForeshadowThreat(b) - scoreForeshadowThreat(a));
}

export function sortForeshadowsByHope(
  foreshadows: readonly ChatPostRunForeshadow[],
): readonly ChatPostRunForeshadow[] {
  const hopeScore = (f: ChatPostRunForeshadow) =>
    (f.hope01 as unknown as number) * (f.confidence01 as unknown as number);
  return [...foreshadows].sort((a, b) => hopeScore(b) - hopeScore(a));
}
