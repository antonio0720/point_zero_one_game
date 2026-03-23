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
