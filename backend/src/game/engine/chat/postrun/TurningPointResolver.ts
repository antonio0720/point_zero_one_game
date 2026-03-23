/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TURNING-POINT RESOLVER
 * FILE: backend/src/game/engine/chat/postrun/TurningPointResolver.ts
 * VERSION: 2026.03.22
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Name the decisive turn of a run in backend authority.
 *
 * The post-run lane cannot feel authored if its "turning point" is just the
 * first loud event or the final event before shutdown. The backend must own a
 * deterministic, explainable resolver that can answer:
 *
 * - what exact moment most changed the fate of the run,
 * - why that moment outranked its competitors,
 * - whether the moment was visible, shadow, negotiated, rescued, social,
 *   world-scale, or structural,
 * - and how much that moment should influence blame, directive, legend,
 *   replay, and memory behavior downstream.
 *
 * What this file owns
 * -------------------
 * - turning-point candidate synthesis from moments + evidence
 * - deterministic candidate ranking with explainable boosts/penalties
 * - primary turning-point selection
 * - room-scoped snapshots for later post-run continuity
 * - weight profiles for different narrative modes
 * - resolution diagnostics and audit reporting
 * - diff computation between two resolutions
 * - aggregate stats across all resolved rooms
 * - integrity-friendly serialization / hydration
 *
 * What this file does not own
 * ---------------------------
 * - transcript mutation
 * - replay artifact authoring
 * - legend admission
 * - witness text authoring
 * - socket fanout
 * ============================================================================
 */

import type {
  ChatMessageId,
  ChatNpcId,
  ChatRoomId,
  ChatSceneId,
  ChatVisibleChannel,
  UnixMs,
} from '../../../../../../shared/contracts/chat/ChatChannels';
import {
  chatMomentToCompactRef,
  type ChatMoment,
  type ChatMomentKind,
  type ChatMomentSeverity,
} from '../../../../../../shared/contracts/chat/ChatMoment';
import {
  choosePrimaryTurningPoint,
  scoreTurningPointCandidate,
  sortTurningPointCandidates,
  toPostRunScore01,
  type ChatPostRunEvidenceSnapshot,
  type ChatTurningPoint,
  type ChatTurningPointCandidate,
  type ChatTurningPointKind,
} from '../../../../../../shared/contracts/chat/ChatPostRun';

// ============================================================================
// MARK: Resolver weight contracts
// ============================================================================

export interface TurningPointResolverWeights {
  readonly severityWeight: number;
  readonly inevitabilityWeight: number;
  readonly reversalWeight: number;
  readonly memoryWeight: number;
  readonly blameWeight: number;
  readonly legendWeight: number;
  readonly rescueDebtWeight: number;
  readonly channelHeatWeight: number;
  readonly continuityWeight: number;
  readonly recencyWeight: number;
  readonly visibilityWeight: number;
}

/** Named weight profiles for different orchestration contexts. */
export type TurningPointResolverWeightProfile =
  | 'DEFAULT'
  | 'NARRATIVE'
  | 'COMBAT'
  | 'EMOTIONAL'
  | 'SOCIAL'
  | 'ECONOMIC'
  | 'LEGEND';

export const TURNING_POINT_WEIGHT_PROFILES: Readonly<
  Record<TurningPointResolverWeightProfile, TurningPointResolverWeights>
> = Object.freeze({
  DEFAULT: Object.freeze({
    severityWeight: 0.16,
    inevitabilityWeight: 0.17,
    reversalWeight: 0.13,
    memoryWeight: 0.12,
    blameWeight: 0.10,
    legendWeight: 0.08,
    rescueDebtWeight: 0.08,
    channelHeatWeight: 0.06,
    continuityWeight: 0.06,
    recencyWeight: 0.02,
    visibilityWeight: 0.02,
  }),
  NARRATIVE: Object.freeze({
    severityWeight: 0.12,
    inevitabilityWeight: 0.14,
    reversalWeight: 0.18,
    memoryWeight: 0.16,
    blameWeight: 0.08,
    legendWeight: 0.12,
    rescueDebtWeight: 0.06,
    channelHeatWeight: 0.05,
    continuityWeight: 0.05,
    recencyWeight: 0.02,
    visibilityWeight: 0.02,
  }),
  COMBAT: Object.freeze({
    severityWeight: 0.22,
    inevitabilityWeight: 0.20,
    reversalWeight: 0.16,
    memoryWeight: 0.08,
    blameWeight: 0.10,
    legendWeight: 0.06,
    rescueDebtWeight: 0.06,
    channelHeatWeight: 0.04,
    continuityWeight: 0.04,
    recencyWeight: 0.02,
    visibilityWeight: 0.02,
  }),
  EMOTIONAL: Object.freeze({
    severityWeight: 0.12,
    inevitabilityWeight: 0.12,
    reversalWeight: 0.14,
    memoryWeight: 0.18,
    blameWeight: 0.14,
    legendWeight: 0.06,
    rescueDebtWeight: 0.10,
    channelHeatWeight: 0.06,
    continuityWeight: 0.04,
    recencyWeight: 0.02,
    visibilityWeight: 0.02,
  }),
  SOCIAL: Object.freeze({
    severityWeight: 0.10,
    inevitabilityWeight: 0.10,
    reversalWeight: 0.12,
    memoryWeight: 0.14,
    blameWeight: 0.12,
    legendWeight: 0.08,
    rescueDebtWeight: 0.06,
    channelHeatWeight: 0.16,
    continuityWeight: 0.06,
    recencyWeight: 0.04,
    visibilityWeight: 0.02,
  }),
  ECONOMIC: Object.freeze({
    severityWeight: 0.18,
    inevitabilityWeight: 0.20,
    reversalWeight: 0.12,
    memoryWeight: 0.10,
    blameWeight: 0.12,
    legendWeight: 0.05,
    rescueDebtWeight: 0.08,
    channelHeatWeight: 0.05,
    continuityWeight: 0.06,
    recencyWeight: 0.02,
    visibilityWeight: 0.02,
  }),
  LEGEND: Object.freeze({
    severityWeight: 0.10,
    inevitabilityWeight: 0.12,
    reversalWeight: 0.14,
    memoryWeight: 0.14,
    blameWeight: 0.06,
    legendWeight: 0.22,
    rescueDebtWeight: 0.06,
    channelHeatWeight: 0.06,
    continuityWeight: 0.06,
    recencyWeight: 0.02,
    visibilityWeight: 0.02,
  }),
});

// ============================================================================
// MARK: Resolver option contracts
// ============================================================================

export interface TurningPointResolverOptions {
  readonly maxCandidates?: number;
  readonly includeFallbackCandidate?: boolean;
  readonly preferVisibleMoments?: boolean;
  readonly preferReplayLinkedMoments?: boolean;
  readonly preferLegendLinkedMoments?: boolean;
  readonly weightProfile?: TurningPointResolverWeightProfile;
  readonly weights?: Partial<TurningPointResolverWeights>;
}

export interface TurningPointResolverContext {
  readonly roomId: ChatRoomId;
  readonly evidence: ChatPostRunEvidenceSnapshot;
  readonly moments?: readonly ChatMoment[];
  readonly turningPointCandidates?: readonly ChatTurningPointCandidate[];
  readonly previousTurningPoint?: ChatTurningPoint | null;
  readonly previousPlanId?: string;
  readonly preferredNpcIds?: readonly ChatNpcId[];
  readonly preferredSceneIds?: readonly ChatSceneId[];
  readonly preferredMessageIds?: readonly ChatMessageId[];
  readonly preferredVisibleChannels?: readonly ChatVisibleChannel[];
  readonly operatorNotes?: readonly string[];
}

// ============================================================================
// MARK: Resolution output contracts
// ============================================================================

export interface TurningPointResolutionCandidate {
  readonly candidate: ChatTurningPointCandidate;
  readonly finalScore01: number;
  readonly reasons: readonly string[];
}

export interface TurningPointResolutionReasoning {
  readonly candidateCount: number;
  readonly fallbackUsed: boolean;
  readonly visibleChannelBiasApplied: boolean;
  readonly previousTurningPointBiasApplied: boolean;
  readonly preferredEntityBiasApplied: boolean;
  readonly topReasons: readonly string[];
  readonly weightProfile: TurningPointResolverWeightProfile | 'CUSTOM';
}

export interface TurningPointResolution {
  readonly roomId: ChatRoomId;
  readonly resolvedAt: UnixMs;
  readonly primary: ChatTurningPoint | null;
  readonly ranked: readonly TurningPointResolutionCandidate[];
  readonly candidates: readonly ChatTurningPointCandidate[];
  readonly reasoning: TurningPointResolutionReasoning;
}

export interface TurningPointResolverSnapshot {
  readonly updatedAt: UnixMs;
  readonly byRoom: Readonly<Record<ChatRoomId, TurningPointResolution>>;
}

// ============================================================================
// MARK: Extended resolver contracts (diagnostics, audit, diff, stats)
// ============================================================================

export interface TurningPointResolutionDiagnostics {
  readonly roomId: ChatRoomId;
  readonly candidateCount: number;
  readonly fallbackUsed: boolean;
  readonly primaryKind: ChatTurningPointKind | null;
  readonly primaryScore01: number | null;
  readonly primaryLabel: string | null;
  readonly topCandidateCount: number;
  readonly legendLiftPresent: boolean;
  readonly replayLinked: boolean;
  readonly visibleChannelBiasApplied: boolean;
  readonly previousTurningPointBiasApplied: boolean;
  readonly weightProfile: TurningPointResolverWeightProfile | 'CUSTOM';
  readonly resolvedAt: UnixMs;
}

export interface TurningPointResolutionAuditReport {
  readonly roomId: ChatRoomId;
  readonly auditedAt: UnixMs;
  readonly resolutionIsPresent: boolean;
  readonly candidateCount: number;
  readonly primaryKind: ChatTurningPointKind | null;
  readonly primaryLabel: string | null;
  readonly primaryScore01: number | null;
  readonly fallbackUsed: boolean;
  readonly candidateKinds: readonly ChatTurningPointKind[];
  readonly topReasons: readonly string[];
  readonly legendLiftPresent: boolean;
  readonly replayLinked: boolean;
  readonly worldEventLinked: boolean;
  readonly visibilityMode: string | null;
  readonly resolvedAt: UnixMs | null;
}

export interface TurningPointResolutionDiff {
  readonly roomId: ChatRoomId;
  readonly computedAt: UnixMs;
  readonly primaryChanged: boolean;
  readonly primaryKindBefore: ChatTurningPointKind | null;
  readonly primaryKindAfter: ChatTurningPointKind | null;
  readonly primaryScoreDelta: number;
  readonly candidateCountDelta: number;
  readonly addedCandidateKinds: readonly ChatTurningPointKind[];
  readonly removedCandidateKinds: readonly ChatTurningPointKind[];
}

export interface TurningPointResolverStatsSummary {
  readonly roomCount: number;
  readonly totalCandidatesEvaluated: number;
  readonly fallbackUsedCount: number;
  readonly sovereigntySpikes: number;
  readonly bankruptcyLocks: number;
  readonly rescueMisses: number;
  readonly rescueAccepts: number;
  readonly crowdSwarms: number;
  readonly emotionalTilts: number;
  readonly averageCandidatesPerRoom: number;
  readonly averagePrimaryScore: number;
}

export interface TurningPointResolverSerializedState {
  readonly version: '2026-03-22.1';
  readonly byRoom: Readonly<Record<ChatRoomId, TurningPointResolution>>;
  readonly serializedAt: UnixMs;
  readonly roomCount: number;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_WEIGHTS: TurningPointResolverWeights = TURNING_POINT_WEIGHT_PROFILES.DEFAULT;

const DEFAULT_OPTIONS: Required<Omit<TurningPointResolverOptions, 'weights' | 'weightProfile'>> = Object.freeze({
  maxCandidates: 12,
  includeFallbackCandidate: true,
  preferVisibleMoments: true,
  preferReplayLinkedMoments: true,
  preferLegendLinkedMoments: true,
});

// ============================================================================
// MARK: Utility helpers
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

function compact<TValue>(values: readonly (TValue | null | undefined | false)[]): TValue[] {
  return values.filter(Boolean) as TValue[];
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

function severityTo01(severity: ChatMomentSeverity): number {
  switch (severity) {
    case 'TRACE':    return 0.12;
    case 'LOW':      return 0.25;
    case 'MEDIUM':   return 0.50;
    case 'HIGH':     return 0.72;
    case 'CRITICAL': return 0.89;
    case 'MYTHIC':   return 1.00;
    default:         return 0.50;
  }
}

/**
 * Map the repo's canonical `ChatMomentKind` values to turning-point kinds.
 * All kind comparisons use exact runtime values from the shared contract.
 */
function momentKindToTurningPointKind(kind: ChatMomentKind): ChatTurningPointKind {
  switch (kind) {
    case 'BANKRUPTCY_WARNING':
    case 'BANKRUPTCY_CONFIRMED':
    case 'INCOME_COLLAPSE':
      return 'BANKRUPTCY_LOCK';

    case 'SHIELD_BREAK':
    case 'SHIELD_CRACK':
    case 'ATTACK_LANDED':
    case 'ATTACK_TELEGRAPH':
      return 'COUNTERPLAY_MISS';

    case 'COMEBACK':
    case 'RESCUE_WINDOW':
    case 'HELPER_INTERVENTION':
      return 'RESCUE_ACCEPT';

    case 'RESCUE_MISSED':
      return 'RESCUE_MISS';

    case 'CROWD_SWARM':
    case 'PUBLIC_HUMILIATION':
      return 'CROWD_SWARM';

    case 'DEAL_ROOM_TENSION':
    case 'NEGOTIATION_INFLECTION':
    case 'BLUFF_EXPOSED':
      return 'DEAL_ROOM_FOLD';

    case 'WORLD_EVENT_PULSE':
    case 'LIVEOPS_INTRUSION':
      return 'WORLD_EVENT_IMPACT';

    case 'SOVEREIGNTY_SECURED':
    case 'SOVEREIGNTY_APPROACH':
    case 'LEGEND_BREAKOUT':
      return 'SOVEREIGNTY_SPIKE';

    case 'RIVALRY_ESCALATION':
    case 'ATTACK_DEFLECTED':
    case 'CASCADE_RISK':
      return 'EMOTIONAL_TILT';

    case 'COUNTERPLAY_WINDOW':
      return 'MIRACLE_SAVE';

    case 'CALLBACK_RECOGNITION':
      return 'LEGEND_REVERSAL';

    default:
      return 'CUSTOM';
  }
}

function fallbackTurningPointKind(
  evidence: ChatPostRunEvidenceSnapshot,
): ChatTurningPointKind {
  switch (evidence.runOutcome) {
    case 'BANKRUPTCY':
      return 'BANKRUPTCY_LOCK';
    case 'LOSS':
      return Number(evidence.affect.socialEmbarrassment) >= 60
        ? 'CROWD_SWARM'
        : 'EMOTIONAL_TILT';
    case 'VICTORY':
      return 'RESCUE_ACCEPT';
    case 'SOVEREIGNTY':
      return 'SOVEREIGNTY_SPIKE';
    default:
      return 'CUSTOM';
  }
}

function isVisibleCandidate(candidate: ChatTurningPointCandidate): boolean {
  return candidate.visibility === 'CHANNEL' || candidate.visibility === 'MULTI_CHANNEL';
}

function computeHeatBias(
  candidate: ChatTurningPointCandidate,
  evidence: ChatPostRunEvidenceSnapshot,
): number {
  const channels = Object.entries(evidence.audienceHeat ?? {}) as [
    ChatVisibleChannel,
    { humiliationPressure?: number; hypePressure?: number; heatScore?: number },
  ][];
  const payloadChannel =
    typeof candidate.payload?.visibleChannel === 'string'
      ? (candidate.payload.visibleChannel as ChatVisibleChannel)
      : undefined;
  const sourceChannel = channels.find(([channel]) => channel === payloadChannel)?.[1];
  const dominant = sourceChannel ?? channels[0]?.[1];
  if (!dominant) return 0;
  const humiliation = Number(dominant.humiliationPressure ?? 0) / 100;
  const hype = Number(dominant.hypePressure ?? 0) / 100;
  const heat = Number(dominant.heatScore ?? 0) / 100;
  return clamp01(Math.max(humiliation, hype, heat));
}

function computeRecencyBias(
  candidate: ChatTurningPointCandidate,
  evidence: ChatPostRunEvidenceSnapshot,
): number {
  const span = Math.max(
    1,
    (evidence.endedAt as unknown as number) - (candidate.detectedAt as unknown as number),
  );
  // Full weight within last 60 s; decays to 0 at 20 minutes
  return clamp01(1 - span / (1000 * 60 * 20));
}

function sameEntityBias(
  candidate: ChatTurningPointCandidate,
  context: TurningPointResolverContext,
): number {
  let boost = 0;
  if (candidate.sourceNpcId && context.preferredNpcIds?.includes(candidate.sourceNpcId))
    boost += 0.50;
  if (candidate.sourceSceneId && context.preferredSceneIds?.includes(candidate.sourceSceneId))
    boost += 0.35;
  if (candidate.sourceMessageId && context.preferredMessageIds?.includes(candidate.sourceMessageId))
    boost += 0.25;
  return clamp01(boost);
}

function continuityBias(
  candidate: ChatTurningPointCandidate,
  previousTurningPoint?: ChatTurningPoint | null,
): number {
  if (!previousTurningPoint) return 0;
  if (candidate.kind === previousTurningPoint.kind) return 1;
  if (candidate.sourceNpcId && candidate.sourceNpcId === previousTurningPoint.sourceNpcId)
    return 0.72;
  if (candidate.sourceMessageId && candidate.sourceMessageId === previousTurningPoint.sourceMessageId)
    return 0.56;
  if (candidate.sourceSceneId && candidate.sourceSceneId === previousTurningPoint.sourceSceneId)
    return 0.48;
  return 0;
}

function computeReplayLegendBias(
  candidate: ChatTurningPointCandidate,
  evidence: ChatPostRunEvidenceSnapshot,
  options: Required<Omit<TurningPointResolverOptions, 'weights' | 'weightProfile'>>,
): number {
  let boost = 0;
  if (options.preferLegendLinkedMoments && Number(candidate.legendLift01) >= 0.70)
    boost += 0.08;
  if (options.preferReplayLinkedMoments && evidence.replayId)
    boost += 0.04;
  if (evidence.legendId && Number(candidate.legendLift01) >= 0.60)
    boost += 0.06;
  return clamp01(boost);
}

export function materializeTurningPoint(
  candidate: ChatTurningPointCandidate,
  moments?: readonly ChatMoment[],
): ChatTurningPoint {
  const sourceMoment = candidate.sourceMomentId
    ? moments?.find((moment) => moment.momentId === candidate.sourceMomentId)
    : undefined;

  return Object.freeze({
    turningPointId: candidate.turningPointId,
    kind: candidate.kind,
    label: candidate.label,
    explanation: candidate.explanation,
    compactMoment: sourceMoment ? chatMomentToCompactRef(sourceMoment) : undefined,
    sourceSceneId: candidate.sourceSceneId,
    sourceMessageId: candidate.sourceMessageId,
    sourceWorldEventId: candidate.sourceWorldEventId,
    sourceNpcId: candidate.sourceNpcId,
    sourceRelationshipId: candidate.sourceRelationshipId,
    visibility: candidate.visibility,
    emphasis01: toPostRunScore01(scoreTurningPointCandidate(candidate) / 100),
    inevitability01: candidate.inevitability01,
    reversal01: candidate.reversal01,
    memorySalience01: candidate.memorySalience01,
    blameWeight01: candidate.blameWeight01,
    legendLift01: candidate.legendLift01,
    rescueDebt01: candidate.rescueDebt01,
    namedAt: nowMs(),
    tags: candidate.tags,
    payload: candidate.payload,
  });
}

// ============================================================================
// MARK: Candidate synthesis from moments
// ============================================================================

function baseCandidateFromMoment(
  moment: ChatMoment,
  context: TurningPointResolverContext,
): ChatTurningPointCandidate {
  const visibleChannel = moment.channelIntent.primaryVisibleChannel;
  const pressurePeak = Number(moment.pressureContext?.pressureScore ?? 0) / 100;
  const rescueDebt = Number(moment.relationshipContext?.rescueDebt ?? 0) / 100;

  const inevitability = Math.max(
    Number(moment.pressureContext?.collapseLikelihood ?? 0) / 100,
    Number(moment.pressureContext?.timePressureScore ?? 0) / 100,
    pressurePeak,
  );
  const reversal = Math.max(
    Number(moment.pressureContext?.comebackPotential ?? 0) / 100,
    Math.abs(Number(moment.affectContext?.targetConfidenceDelta ?? 0)) / 100,
    Number(moment.audienceContext?.hypePotential ?? 0) / 100,
  );
  const memorySalience = Math.max(
    Number(moment.memoryDirective.salience ?? 0) / 100,
    Math.min(1, Number(moment.learningContext?.retrievalHitCount ?? 0) / 5),
    Number(moment.learningContext?.modelConfidence ?? 0) / 100,
  );
  const blameWeight = Math.max(
    Number(moment.audienceContext?.humiliationRisk ?? 0) / 100,
    Number(moment.pressureContext?.collapseLikelihood ?? 0) / 100,
    Number(moment.relationshipContext?.rivalryIntensity ?? 0) / 100,
  );
  const legendLift = Math.max(
    Number(moment.legendDirective?.prestigeWeight ?? 0) / 100,
    Number(moment.legendDirective?.replayWorthiness ?? 0) / 100,
  );

  return Object.freeze({
    turningPointId: (`turning:${context.roomId}:${moment.momentId}` as unknown) as ChatTurningPointCandidate['turningPointId'],
    kind: momentKindToTurningPointKind(moment.kind),
    sourceMomentId: moment.momentId,
    sourceSceneId: moment.cause.sceneId,
    sourceMessageId: moment.cause.messageId,
    sourceWorldEventId: moment.cause.worldEventId,
    sourceNpcId: moment.npcIds?.[0],
    sourceRelationshipId: moment.relationshipContext?.relationshipId,
    label: moment.payload.shortLabel ?? moment.payload.title ?? moment.payload.summary,
    explanation: moment.payload.summary,
    momentKind: moment.kind,
    severity: moment.severity,
    visibility:
      moment.privacyClass === 'SHADOW_ONLY'
        ? 'SHADOW_ONLY'
        : visibleChannel
          ? 'CHANNEL'
          : 'PRIVATE',
    shock01: toPostRunScore01(
      Math.max(
        severityTo01(moment.severity),
        Math.abs(Number(moment.affectContext?.targetEmbarrassmentDelta ?? 0)) / 100,
        Math.abs(Number(moment.affectContext?.targetFrustrationDelta ?? 0)) / 100,
      ),
    ),
    inevitability01: toPostRunScore01(inevitability),
    reversal01: toPostRunScore01(reversal),
    memorySalience01: toPostRunScore01(memorySalience),
    blameWeight01: toPostRunScore01(blameWeight),
    legendLift01: toPostRunScore01(legendLift),
    rescueDebt01: toPostRunScore01(rescueDebt),
    detectedAt: moment.timeWindow.detectedAt,
    tags: compact<string>([
      'derived_from_moment',
      moment.kind.toLowerCase(),
      ...(moment.payload.tags ?? []),
      visibleChannel ? `channel:${visibleChannel.toLowerCase()}` : false,
    ]),
    payload: {
      visibleChannel,
      category: moment.category,
      sceneIntent: moment.witnessPlan.sceneIntent,
      privacyClass: moment.privacyClass,
    },
  });
}

function fallbackCandidate(context: TurningPointResolverContext): ChatTurningPointCandidate {
  const outcome = context.evidence.runOutcome;
  const kind = fallbackTurningPointKind(context.evidence);

  const label =
    outcome === 'SOVEREIGNTY'
      ? 'The ascent became irreversible.'
      : outcome === 'VICTORY'
        ? 'The recovery line finally held.'
        : outcome === 'BANKRUPTCY'
          ? 'The room locked into insolvency.'
          : 'The pressure surface stopped being recoverable.';

  const explanation =
    outcome === 'SOVEREIGNTY'
      ? 'No single visible callback outranked the final convergence, so the resolver names the irreversible ascent itself.'
      : outcome === 'VICTORY'
        ? 'The board finally bent in your favor hard enough that the run could no longer collapse.'
        : outcome === 'BANKRUPTCY'
          ? 'No earlier confirmed moment outweighed the final structural lock, so the resolver names the insolvency closure.'
          : 'No upstream moment fully dominated the room, so the resolver names the point where recovery became implausible.';

  return Object.freeze({
    turningPointId: (`turning:${context.roomId}:fallback:${outcome}` as unknown) as ChatTurningPointCandidate['turningPointId'],
    kind,
    label,
    explanation,
    severity:
      outcome === 'SOVEREIGNTY'
        ? 'MYTHIC'
        : outcome === 'VICTORY'
          ? 'HIGH'
          : outcome === 'BANKRUPTCY'
            ? 'CRITICAL'
            : 'HIGH',
    visibility:
      context.evidence.proofHash || context.evidence.replayId ? 'CHANNEL' : 'PRIVATE',
    shock01: toPostRunScore01(
      outcome === 'SOVEREIGNTY' ? 0.96 : outcome === 'VICTORY' ? 0.68 : 0.74,
    ),
    inevitability01: toPostRunScore01(outcome === 'BANKRUPTCY' ? 0.94 : 0.72),
    reversal01: toPostRunScore01(
      outcome === 'VICTORY' || outcome === 'SOVEREIGNTY' ? 0.72 : 0.38,
    ),
    memorySalience01: toPostRunScore01(
      context.evidence.legendId || context.evidence.replayId ? 0.86 : 0.58,
    ),
    blameWeight01: toPostRunScore01(
      outcome === 'LOSS' || outcome === 'BANKRUPTCY' ? 0.78 : 0.42,
    ),
    legendLift01: toPostRunScore01(
      context.evidence.legendId
        ? 0.92
        : outcome === 'SOVEREIGNTY'
          ? 0.84
          : 0.35,
    ),
    rescueDebt01: toPostRunScore01(Number(context.evidence.affect.desperation) / 100),
    detectedAt: context.evidence.endedAt,
    tags: compact<string>(['fallback_candidate', `outcome:${outcome.toLowerCase()}`]),
    payload: {
      visibleChannel: context.preferredVisibleChannels?.[0],
      outcome,
      fallback: true,
    },
  });
}

// ============================================================================
// MARK: Resolver implementation
// ============================================================================

export class TurningPointResolver {
  private readonly options: Required<Omit<TurningPointResolverOptions, 'weights' | 'weightProfile'>>;
  private readonly weights: TurningPointResolverWeights;
  private readonly weightProfile: TurningPointResolverWeightProfile | 'CUSTOM';
  private readonly byRoom = new Map<ChatRoomId, TurningPointResolution>();

  public constructor(options: TurningPointResolverOptions = {}) {
    this.options = Object.freeze({ ...DEFAULT_OPTIONS, ...options });

    const profileWeights =
      options.weightProfile !== undefined
        ? TURNING_POINT_WEIGHT_PROFILES[options.weightProfile]
        : DEFAULT_WEIGHTS;

    this.weights = Object.freeze({ ...profileWeights, ...(options.weights ?? {}) });
    this.weightProfile =
      options.weightProfile !== undefined
        ? options.weightProfile
        : options.weights !== undefined
          ? 'CUSTOM'
          : 'DEFAULT';
  }

  public getOptions(): Readonly<TurningPointResolverOptions> {
    return Object.freeze({ ...this.options, weights: this.weights });
  }

  public getWeightProfile(): TurningPointResolverWeightProfile | 'CUSTOM' {
    return this.weightProfile;
  }

  public resolve(context: TurningPointResolverContext): TurningPointResolution {
    const derived = (context.moments ?? []).map((moment) =>
      baseCandidateFromMoment(moment, context),
    );
    const supplied = [...(context.turningPointCandidates ?? [])];

    const merged = uniqueBy(
      compact<ChatTurningPointCandidate>([
        ...supplied,
        ...derived,
        this.options.includeFallbackCandidate ? fallbackCandidate(context) : undefined,
      ]),
      (c) => `${c.sourceMomentId ?? 'none'}|${c.kind}|${c.label}`,
    ).slice(0, this.options.maxCandidates * 2);

    const ranked = merged
      .map((candidate) => this.rankCandidate(candidate, context))
      .sort(
        (left, right) =>
          right.finalScore01 - left.finalScore01 ||
          left.candidate.label.localeCompare(right.candidate.label),
      )
      .slice(0, this.options.maxCandidates);

    const plainCandidates = sortTurningPointCandidates(ranked.map((entry) => entry.candidate));
    const primary = choosePrimaryTurningPoint(plainCandidates, context.moments);

    const reasoning: TurningPointResolutionReasoning = Object.freeze({
      candidateCount: ranked.length,
      fallbackUsed: ranked.some((entry) =>
        entry.candidate.tags?.includes('fallback_candidate'),
      ),
      visibleChannelBiasApplied: this.options.preferVisibleMoments,
      previousTurningPointBiasApplied: Boolean(context.previousTurningPoint),
      preferredEntityBiasApplied: Boolean(
        context.preferredNpcIds?.length ||
          context.preferredSceneIds?.length ||
          context.preferredMessageIds?.length,
      ),
      topReasons: Object.freeze(ranked[0]?.reasons ?? []),
      weightProfile: this.weightProfile,
    });

    const resolution: TurningPointResolution = Object.freeze({
      roomId: context.roomId,
      resolvedAt: nowMs(),
      primary,
      ranked: Object.freeze(ranked),
      candidates: Object.freeze(plainCandidates),
      reasoning,
    });

    this.byRoom.set(context.roomId, resolution);
    return resolution;
  }

  /** Resolve multiple room contexts in a single call. */
  public resolveMany(
    contexts: readonly TurningPointResolverContext[],
  ): readonly TurningPointResolution[] {
    return contexts.map((context) => this.resolve(context));
  }

  public listRoomCandidates(
    roomId: ChatRoomId,
  ): readonly TurningPointResolutionCandidate[] {
    return this.byRoom.get(roomId)?.ranked ?? Object.freeze([]);
  }

  public getLastResolution(roomId: ChatRoomId): TurningPointResolution | null {
    return this.byRoom.get(roomId) ?? null;
  }

  public hasRoom(roomId: ChatRoomId): boolean {
    return this.byRoom.has(roomId);
  }

  public listRooms(): readonly ChatRoomId[] {
    return Array.from(this.byRoom.keys());
  }

  /**
   * Return the room whose primary turning point has the highest emphasis score.
   * Returns null if no rooms have been resolved.
   */
  public getBestRoom(): ChatRoomId | null {
    let best: ChatRoomId | null = null;
    let bestScore = -1;

    for (const [roomId, resolution] of this.byRoom.entries()) {
      const score = Number(resolution.primary?.emphasis01 ?? 0);
      if (score > bestScore) {
        bestScore = score;
        best = roomId;
      }
    }
    return best;
  }

  public clear(roomId?: ChatRoomId): void {
    if (roomId) {
      this.byRoom.delete(roomId);
      return;
    }
    this.byRoom.clear();
  }

  public getDiagnostics(roomId: ChatRoomId): TurningPointResolutionDiagnostics | null {
    const resolution = this.byRoom.get(roomId);
    if (!resolution) return null;

    return Object.freeze({
      roomId,
      candidateCount: resolution.candidates.length,
      fallbackUsed: resolution.reasoning.fallbackUsed,
      primaryKind: resolution.primary?.kind ?? null,
      primaryScore01: resolution.primary ? Number(resolution.primary.emphasis01) : null,
      primaryLabel: resolution.primary?.label ?? null,
      topCandidateCount: resolution.ranked.length,
      legendLiftPresent:
        resolution.candidates.some((c) => Number(c.legendLift01) >= 0.70),
      replayLinked: Boolean(
        resolution.ranked[0]?.reasons.includes('related_message'),
      ),
      visibleChannelBiasApplied: resolution.reasoning.visibleChannelBiasApplied,
      previousTurningPointBiasApplied: resolution.reasoning.previousTurningPointBiasApplied,
      weightProfile: this.weightProfile,
      resolvedAt: resolution.resolvedAt,
    });
  }

  public buildAuditReport(roomId: ChatRoomId): TurningPointResolutionAuditReport {
    const resolution = this.byRoom.get(roomId);
    const auditedAt = nowMs();

    if (!resolution) {
      return Object.freeze({
        roomId,
        auditedAt,
        resolutionIsPresent: false,
        candidateCount: 0,
        primaryKind: null,
        primaryLabel: null,
        primaryScore01: null,
        fallbackUsed: false,
        candidateKinds: Object.freeze([]) as readonly ChatTurningPointKind[],
        topReasons: Object.freeze([]),
        legendLiftPresent: false,
        replayLinked: false,
        worldEventLinked: false,
        visibilityMode: null,
        resolvedAt: null,
      });
    }

    return Object.freeze({
      roomId,
      auditedAt,
      resolutionIsPresent: true,
      candidateCount: resolution.candidates.length,
      primaryKind: resolution.primary?.kind ?? null,
      primaryLabel: resolution.primary?.label ?? null,
      primaryScore01: resolution.primary ? Number(resolution.primary.emphasis01) : null,
      fallbackUsed: resolution.reasoning.fallbackUsed,
      candidateKinds: Object.freeze(resolution.candidates.map((c) => c.kind)),
      topReasons: resolution.reasoning.topReasons,
      legendLiftPresent: resolution.candidates.some((c) => Number(c.legendLift01) >= 0.70),
      replayLinked: resolution.ranked[0]?.reasons.includes('related_message') ?? false,
      worldEventLinked: resolution.candidates.some((c) => !!c.sourceWorldEventId),
      visibilityMode: resolution.primary?.visibility ?? null,
      resolvedAt: resolution.resolvedAt,
    });
  }

  public computeDiff(
    before: TurningPointResolution,
    after: TurningPointResolution,
  ): TurningPointResolutionDiff {
    const beforeKinds = new Set(before.candidates.map((c) => c.kind));
    const afterKinds = new Set(after.candidates.map((c) => c.kind));

    const addedCandidateKinds = after.candidates
      .filter((c) => !beforeKinds.has(c.kind))
      .map((c) => c.kind);
    const removedCandidateKinds = before.candidates
      .filter((c) => !afterKinds.has(c.kind))
      .map((c) => c.kind);

    const beforeScore = Number(before.primary?.emphasis01 ?? 0);
    const afterScore = Number(after.primary?.emphasis01 ?? 0);

    return Object.freeze({
      roomId: after.roomId,
      computedAt: nowMs(),
      primaryChanged:
        before.primary?.turningPointId !== after.primary?.turningPointId,
      primaryKindBefore: before.primary?.kind ?? null,
      primaryKindAfter: after.primary?.kind ?? null,
      primaryScoreDelta: afterScore - beforeScore,
      candidateCountDelta: after.candidates.length - before.candidates.length,
      addedCandidateKinds: Object.freeze(addedCandidateKinds),
      removedCandidateKinds: Object.freeze(removedCandidateKinds),
    });
  }

  public getStatsSummary(): TurningPointResolverStatsSummary {
    let totalCandidatesEvaluated = 0;
    let fallbackUsedCount = 0;
    let sovereigntySpikes = 0;
    let bankruptcyLocks = 0;
    let rescueMisses = 0;
    let rescueAccepts = 0;
    let crowdSwarms = 0;
    let emotionalTilts = 0;
    let primaryScoreSum = 0;
    let primaryScoreCount = 0;

    for (const resolution of this.byRoom.values()) {
      totalCandidatesEvaluated += resolution.candidates.length;
      if (resolution.reasoning.fallbackUsed) fallbackUsedCount++;
      if (resolution.primary) {
        primaryScoreSum += Number(resolution.primary.emphasis01);
        primaryScoreCount++;
        switch (resolution.primary.kind) {
          case 'SOVEREIGNTY_SPIKE': sovereigntySpikes++; break;
          case 'BANKRUPTCY_LOCK': bankruptcyLocks++; break;
          case 'RESCUE_MISS': rescueMisses++; break;
          case 'RESCUE_ACCEPT': rescueAccepts++; break;
          case 'CROWD_SWARM': crowdSwarms++; break;
          case 'EMOTIONAL_TILT': emotionalTilts++; break;
        }
      }
    }

    const roomCount = this.byRoom.size;
    return Object.freeze({
      roomCount,
      totalCandidatesEvaluated,
      fallbackUsedCount,
      sovereigntySpikes,
      bankruptcyLocks,
      rescueMisses,
      rescueAccepts,
      crowdSwarms,
      emotionalTilts,
      averageCandidatesPerRoom: roomCount > 0 ? totalCandidatesEvaluated / roomCount : 0,
      averagePrimaryScore: primaryScoreCount > 0 ? primaryScoreSum / primaryScoreCount : 0,
    });
  }

  /**
   * Merge resolution state from another resolver into this one.
   * This resolver's existing rooms win (non-destructive).
   */
  public merge(other: TurningPointResolver): void {
    for (const [roomId, resolution] of other.byRoom.entries()) {
      if (!this.byRoom.has(roomId)) {
        this.byRoom.set(roomId, resolution);
      }
    }
  }

  public getSnapshot(): TurningPointResolverSnapshot {
    return Object.freeze({
      updatedAt: nowMs(),
      byRoom: Object.freeze(
        Object.fromEntries(this.byRoom.entries()),
      ) as Readonly<Record<ChatRoomId, TurningPointResolution>>,
    });
  }

  public restore(snapshot: TurningPointResolverSnapshot): void {
    this.byRoom.clear();
    for (const [roomId, resolution] of Object.entries(snapshot.byRoom) as [
      ChatRoomId,
      TurningPointResolution,
    ][]) {
      this.byRoom.set(roomId, resolution);
    }
  }

  /** Serialize to a portable state for persistence. */
  public serialize(): TurningPointResolverSerializedState {
    return Object.freeze({
      version: '2026-03-22.1' as const,
      byRoom: Object.freeze(
        Object.fromEntries(this.byRoom.entries()),
      ) as Readonly<Record<ChatRoomId, TurningPointResolution>>,
      serializedAt: nowMs(),
      roomCount: this.byRoom.size,
    });
  }

  /** Hydrate from serialized state, replacing all existing room data. */
  public hydrate(state: TurningPointResolverSerializedState): void {
    if (state.version !== '2026-03-22.1') {
      throw new Error(
        `TurningPointResolver: unrecognized serialized state version "${state.version}"`,
      );
    }
    this.byRoom.clear();
    for (const [roomId, resolution] of Object.entries(state.byRoom) as [
      ChatRoomId,
      TurningPointResolution,
    ][]) {
      this.byRoom.set(roomId, resolution);
    }
  }

  // ============================================================================
  // MARK: Private ranking engine
  // ============================================================================

  private rankCandidate(
    candidate: ChatTurningPointCandidate,
    context: TurningPointResolverContext,
  ): TurningPointResolutionCandidate {
    const reasons: string[] = [];
    const base = scoreTurningPointCandidate(candidate) / 100;
    reasons.push(`base:${base.toFixed(3)}`);

    const severity = severityTo01(candidate.severity);
    const heat = computeHeatBias(candidate, context.evidence);
    const recency = computeRecencyBias(candidate, context.evidence);
    const continuity = continuityBias(candidate, context.previousTurningPoint);
    const preferred = sameEntityBias(candidate, context);
    const replayLegend = computeReplayLegendBias(candidate, context.evidence, this.options);
    const visibility = isVisibleCandidate(candidate) ? 1 : 0;

    if (severity > 0.70) reasons.push('high_severity');
    if (heat > 0.55) reasons.push('channel_heat');
    if (continuity > 0.40) reasons.push('continuity_match');
    if (preferred > 0.25) reasons.push('preferred_entity');
    if (visibility > 0) reasons.push('visible_surface');
    if (replayLegend > 0.05) reasons.push('replay_legend_boost');
    if (
      candidate.sourceMessageId &&
      context.evidence.relatedMessageIds.includes(candidate.sourceMessageId)
    ) {
      reasons.push('related_message');
    }
    if (
      candidate.sourceWorldEventId &&
      context.evidence.worldEventIds.includes(candidate.sourceWorldEventId)
    ) {
      reasons.push('world_event');
    }
    if (Number(candidate.legendLift01) >= 0.80) reasons.push('legend_lift_high');
    if (Number(candidate.rescueDebt01) >= 0.70) reasons.push('rescue_debt_high');

    const weighted = clamp01(
      base +
        severity * this.weights.severityWeight +
        Number(candidate.inevitability01) * this.weights.inevitabilityWeight +
        Number(candidate.reversal01) * this.weights.reversalWeight +
        Number(candidate.memorySalience01) * this.weights.memoryWeight +
        Number(candidate.blameWeight01) * this.weights.blameWeight +
        Number(candidate.legendLift01) * this.weights.legendWeight +
        Number(candidate.rescueDebt01) * this.weights.rescueDebtWeight +
        heat * this.weights.channelHeatWeight +
        continuity * this.weights.continuityWeight +
        recency * this.weights.recencyWeight +
        visibility * this.weights.visibilityWeight +
        preferred * 0.05 +
        replayLegend,
    );

    return Object.freeze({
      candidate,
      finalScore01: weighted,
      reasons: Object.freeze(reasons),
    });
  }
}

// ============================================================================
// MARK: Factory functions
// ============================================================================

export function createTurningPointResolver(
  options: TurningPointResolverOptions = {},
): TurningPointResolver {
  return new TurningPointResolver(options);
}

export function createTurningPointResolverFromProfile(
  profile: TurningPointResolverWeightProfile,
): TurningPointResolver {
  return new TurningPointResolver({ weightProfile: profile });
}

export function createNarrativeTurningPointResolver(): TurningPointResolver {
  return createTurningPointResolverFromProfile('NARRATIVE');
}

export function createCombatTurningPointResolver(): TurningPointResolver {
  return createTurningPointResolverFromProfile('COMBAT');
}

export function createEmotionalTurningPointResolver(): TurningPointResolver {
  return createTurningPointResolverFromProfile('EMOTIONAL');
}

export function createLegendTurningPointResolver(): TurningPointResolver {
  return createTurningPointResolverFromProfile('LEGEND');
}

// ============================================================================
// MARK: Module namespace
// ============================================================================

export const ChatTurningPointResolverModule = Object.freeze({
  // Core class
  TurningPointResolver,

  // Factory functions
  createTurningPointResolver,
  createTurningPointResolverFromProfile,
  createNarrativeTurningPointResolver,
  createCombatTurningPointResolver,
  createEmotionalTurningPointResolver,
  createLegendTurningPointResolver,

  // Weight profile constants
  TURNING_POINT_WEIGHT_PROFILES,
} as const);
