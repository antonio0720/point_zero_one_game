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

  /** Return a frozen snapshot of all resolved rooms. */
  public snapshot(): TurningPointResolverSnapshot {
    const byRoom: Record<ChatRoomId, TurningPointResolution> = {};
    for (const [roomId, resolution] of this.byRoom) {
      byRoom[roomId] = resolution;
    }
    return Object.freeze({
      updatedAt: nowMs(),
      byRoom: Object.freeze(byRoom),
    });
  }

  /** Import a previously resolved resolution directly into the internal map. */
  public importResolution(roomId: ChatRoomId, resolution: TurningPointResolution): void {
    this.byRoom.set(roomId, resolution);
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

// ============================================================================
// MARK: Resolution watch bus
// ============================================================================

export type TurningPointWatchEvent =
  | { kind: 'RESOLVED'; roomId: ChatRoomId; resolution: TurningPointResolution }
  | { kind: 'CLEARED'; roomId: ChatRoomId }
  | { kind: 'DIFF'; roomId: ChatRoomId; diff: TurningPointResolutionDiff };

export type TurningPointWatchCallback = (event: TurningPointWatchEvent) => void;

export class TurningPointWatchBus {
  private readonly subscribers = new Set<TurningPointWatchCallback>();

  subscribe(cb: TurningPointWatchCallback): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  emit(event: TurningPointWatchEvent): void {
    for (const cb of this.subscribers) {
      try { cb(event); } catch { /* isolate subscriber errors */ }
    }
  }

  emitResolved(roomId: ChatRoomId, resolution: TurningPointResolution): void {
    this.emit({ kind: 'RESOLVED', roomId, resolution });
  }

  emitCleared(roomId: ChatRoomId): void {
    this.emit({ kind: 'CLEARED', roomId });
  }

  emitDiff(roomId: ChatRoomId, diff: TurningPointResolutionDiff): void {
    this.emit({ kind: 'DIFF', roomId, diff });
  }

  size(): number {
    return this.subscribers.size;
  }
}

// ============================================================================
// MARK: Resolution diff builder
// ============================================================================

export function buildTurningPointResolutionDiff(
  roomId: ChatRoomId,
  before: TurningPointResolution | null,
  after: TurningPointResolution,
  now: UnixMs,
): TurningPointResolutionDiff {
  const beforeKind = before?.primary?.kind ?? null;
  const afterKind = after.primary?.kind ?? null;

  const beforeScore = before?.ranked[0]?.finalScore01 ?? 0;
  const afterScore = after.ranked[0]?.finalScore01 ?? 0;

  const beforeKinds = new Set((before?.candidates ?? []).map((c) => c.kind));
  const afterKinds = new Set(after.candidates.map((c) => c.kind));

  const added: ChatTurningPointKind[] = [];
  for (const k of afterKinds) if (!beforeKinds.has(k)) added.push(k);

  const removed: ChatTurningPointKind[] = [];
  for (const k of beforeKinds) if (!afterKinds.has(k)) removed.push(k);

  return Object.freeze({
    roomId,
    computedAt: now,
    primaryChanged: beforeKind !== afterKind,
    primaryKindBefore: beforeKind,
    primaryKindAfter: afterKind,
    primaryScoreDelta: afterScore - beforeScore,
    candidateCountDelta: after.candidates.length - (before?.candidates.length ?? 0),
    addedCandidateKinds: Object.freeze(added),
    removedCandidateKinds: Object.freeze(removed),
  });
}

// ============================================================================
// MARK: Resolution fingerprint
// ============================================================================

export interface TurningPointResolutionFingerprint {
  readonly roomId: ChatRoomId;
  readonly primaryKind: ChatTurningPointKind | null;
  readonly primaryScore01: number;
  readonly candidateCount: number;
  readonly weightProfile: TurningPointResolverWeightProfile | 'CUSTOM';
  readonly fallbackUsed: boolean;
  readonly legendLiftPresent: boolean;
  readonly replayLinked: boolean;
  readonly hash: string;
}

export function computeResolutionFingerprint(
  resolution: TurningPointResolution,
): TurningPointResolutionFingerprint {
  const primaryKind = resolution.primary?.kind ?? null;
  const primaryScore = resolution.ranked[0]?.finalScore01 ?? 0;
  const legendLiftPresent = resolution.candidates.some(
    (c) => (c.legendLift01 as unknown as number) >= 0.5,
  );
  const replayLinked = resolution.candidates.some(
    (c) => !!c.sourceSceneId,
  );
  const hash = [
    resolution.roomId,
    primaryKind ?? 'NULL',
    primaryScore.toFixed(4),
    resolution.candidates.length,
    resolution.reasoning.weightProfile,
  ].join('|');

  return Object.freeze({
    roomId: resolution.roomId,
    primaryKind,
    primaryScore01: primaryScore,
    candidateCount: resolution.candidates.length,
    weightProfile: resolution.reasoning.weightProfile,
    fallbackUsed: resolution.reasoning.fallbackUsed,
    legendLiftPresent,
    replayLinked,
    hash,
  });
}

// ============================================================================
// MARK: Aggregate stats builder
// ============================================================================

export function buildTurningPointResolverStatsSummary(
  snapshot: TurningPointResolverSnapshot,
): TurningPointResolverStatsSummary {
  const rooms = Object.values(snapshot.byRoom);
  let totalCandidates = 0;
  let fallbackUsed = 0;
  let sovereigntySpikes = 0;
  let bankruptcyLocks = 0;
  let rescueMisses = 0;
  let rescueAccepts = 0;
  let crowdSwarms = 0;
  let emotionalTilts = 0;
  let totalPrimaryScore = 0;
  let primaryCount = 0;

  for (const resolution of rooms) {
    totalCandidates += resolution.candidates.length;
    if (resolution.reasoning.fallbackUsed) fallbackUsed++;

    if (resolution.primary) {
      primaryCount++;
      totalPrimaryScore += resolution.ranked[0]?.finalScore01 ?? 0;
      const k = resolution.primary.kind;
      if (k === 'SOVEREIGNTY_SPIKE') sovereigntySpikes++;
      if (k === 'BANKRUPTCY_LOCK') bankruptcyLocks++;
      if (k === 'RESCUE_MISS') rescueMisses++;
      if (k === 'RESCUE_ACCEPT') rescueAccepts++;
      if (k === 'CROWD_SWARM') crowdSwarms++;
      if (k === 'EMOTIONAL_TILT') emotionalTilts++;
    }
  }

  const roomCount = rooms.length || 1;
  return Object.freeze({
    roomCount: rooms.length,
    totalCandidatesEvaluated: totalCandidates,
    fallbackUsedCount: fallbackUsed,
    sovereigntySpikes,
    bankruptcyLocks,
    rescueMisses,
    rescueAccepts,
    crowdSwarms,
    emotionalTilts,
    averageCandidatesPerRoom: totalCandidates / roomCount,
    averagePrimaryScore: primaryCount > 0 ? totalPrimaryScore / primaryCount : 0,
  });
}

// ============================================================================
// MARK: Serialization / hydration
// ============================================================================

export function serializeTurningPointResolverState(
  resolver: TurningPointResolver,
): TurningPointResolverSerializedState {
  const snapshot = resolver.snapshot();
  return Object.freeze({
    version: '2026-03-22.1',
    byRoom: snapshot.byRoom,
    serializedAt: nowMs(),
    roomCount: Object.keys(snapshot.byRoom).length,
  });
}

export function hydrateTurningPointResolver(
  serialized: TurningPointResolverSerializedState,
  options?: TurningPointResolverOptions,
): TurningPointResolver {
  const resolver = createTurningPointResolver(options);
  for (const [roomId, resolution] of Object.entries(serialized.byRoom)) {
    resolver.importResolution(roomId as ChatRoomId, resolution);
  }
  return resolver;
}

// ============================================================================
// MARK: Multi-room resolution runner
// ============================================================================

export interface MultiRoomResolutionResult {
  readonly resolvedRooms: readonly ChatRoomId[];
  readonly skippedRooms: readonly ChatRoomId[];
  readonly totalCandidatesEvaluated: number;
  readonly byRoom: Readonly<Record<ChatRoomId, TurningPointResolution>>;
  readonly computedAt: UnixMs;
}

export function runMultiRoomTurningPointResolution(
  resolver: TurningPointResolver,
  contexts: readonly TurningPointResolverContext[],
): MultiRoomResolutionResult {
  const now = nowMs();
  const resolvedRooms: ChatRoomId[] = [];
  const skippedRooms: ChatRoomId[] = [];
  const byRoom: Record<ChatRoomId, TurningPointResolution> = {};
  let totalCandidates = 0;

  for (const ctx of contexts) {
    try {
      const resolution = resolver.resolve(ctx);
      byRoom[ctx.roomId] = resolution;
      resolvedRooms.push(ctx.roomId);
      totalCandidates += resolution.candidates.length;
    } catch {
      skippedRooms.push(ctx.roomId);
    }
  }

  return Object.freeze({
    resolvedRooms: Object.freeze(resolvedRooms),
    skippedRooms: Object.freeze(skippedRooms),
    totalCandidatesEvaluated: totalCandidates,
    byRoom: Object.freeze(byRoom),
    computedAt: now,
  });
}

// ============================================================================
// MARK: Candidate ranking comparator helpers
// ============================================================================

/** Compare two resolution candidates by final score (descending). */
export function compareCandidatesByScore(
  a: TurningPointResolutionCandidate,
  b: TurningPointResolutionCandidate,
): number {
  return b.finalScore01 - a.finalScore01;
}

/** Compare two resolution candidates by kind alphabet (ascending). */
export function compareCandidatesByKind(
  a: TurningPointResolutionCandidate,
  b: TurningPointResolutionCandidate,
): number {
  return a.candidate.kind.localeCompare(b.candidate.kind);
}

/** Sort candidates: primary by descending score, secondary by kind. */
export function sortResolutionCandidates(
  candidates: readonly TurningPointResolutionCandidate[],
): TurningPointResolutionCandidate[] {
  return [...candidates].sort((a, b) => {
    const delta = compareCandidatesByScore(a, b);
    if (delta !== 0) return delta;
    return compareCandidatesByKind(a, b);
  });
}

// ============================================================================
// MARK: Kind categorisation helpers
// ============================================================================

const NEGATIVE_TURNING_POINT_KINDS = new Set<ChatTurningPointKind>([
  'SHIELD_BREAK',
  'BANKRUPTCY_LOCK',
  'COUNTERPLAY_MISS',
  'RESCUE_MISS',
  'DEAL_ROOM_FOLD',
  'EMOTIONAL_TILT',
]);

const POSITIVE_TURNING_POINT_KINDS = new Set<ChatTurningPointKind>([
  'RESCUE_ACCEPT',
  'MIRACLE_SAVE',
  'SOVEREIGNTY_SPIKE',
  'LEGEND_REVERSAL',
]);

const NEUTRAL_TURNING_POINT_KINDS = new Set<ChatTurningPointKind>([
  'CROWD_SWARM',
  'WORLD_EVENT_IMPACT',
  'CUSTOM',
]);

export function turningPointKindValence(kind: ChatTurningPointKind): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
  if (POSITIVE_TURNING_POINT_KINDS.has(kind)) return 'POSITIVE';
  if (NEGATIVE_TURNING_POINT_KINDS.has(kind)) return 'NEGATIVE';
  if (NEUTRAL_TURNING_POINT_KINDS.has(kind)) return 'NEUTRAL';
  return 'NEUTRAL';
}

export function filterCandidatesByValence(
  candidates: readonly TurningPointResolutionCandidate[],
  valence: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL',
): TurningPointResolutionCandidate[] {
  return candidates.filter(
    (c) => turningPointKindValence(c.candidate.kind) === valence,
  );
}

// ============================================================================
// MARK: Candidate explanation builder
// ============================================================================

export interface CandidateExplanationReport {
  readonly turningPointId: string;
  readonly kind: ChatTurningPointKind;
  readonly valence: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  readonly finalScore01: number;
  readonly top3Reasons: readonly string[];
  readonly visibility: string;
  readonly legendLift01: number;
  readonly rescueDebt01: number;
  readonly sourceNpcId: ChatNpcId | null;
}

export function buildCandidateExplanationReport(
  candidate: TurningPointResolutionCandidate,
): CandidateExplanationReport {
  return Object.freeze({
    turningPointId: String(candidate.candidate.turningPointId),
    kind: candidate.candidate.kind,
    valence: turningPointKindValence(candidate.candidate.kind),
    finalScore01: candidate.finalScore01,
    top3Reasons: Object.freeze(candidate.reasons.slice(0, 3)),
    visibility: candidate.candidate.visibility ?? 'UNKNOWN',
    legendLift01: candidate.candidate.legendLift01 as unknown as number,
    rescueDebt01: candidate.candidate.rescueDebt01 as unknown as number,
    sourceNpcId: candidate.candidate.sourceNpcId ?? null,
  });
}

// ============================================================================
// MARK: Resolution quality grader
// ============================================================================

export type TurningPointResolutionGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface TurningPointResolutionQualityReport {
  readonly roomId: ChatRoomId;
  readonly grade: TurningPointResolutionGrade;
  readonly score01: number;
  readonly reasons: readonly string[];
}

export function gradeResolutionQuality(
  resolution: TurningPointResolution,
): TurningPointResolutionQualityReport {
  const reasons: string[] = [];
  let score = 0;

  if (resolution.primary !== null) {
    score += 0.3;
    reasons.push('primary_present');
  } else {
    reasons.push('no_primary_resolved');
  }

  if (resolution.reasoning.fallbackUsed) {
    score -= 0.1;
    reasons.push('fallback_used');
  }

  const topScore = resolution.ranked[0]?.finalScore01 ?? 0;
  score += topScore * 0.4;

  if (resolution.candidates.length >= 3) {
    score += 0.15;
    reasons.push('multiple_candidates');
  }

  if (resolution.candidates.some((c) => (c.legendLift01 as unknown as number) >= 0.5)) {
    score += 0.1;
    reasons.push('legend_lift_present');
  }

  if (resolution.ranked[0]?.reasons.includes('related_message') || resolution.candidates.some((c) => !!c.sourceSceneId)) {
    score += 0.05;
    reasons.push('replay_linked');
  }

  score = Math.max(0, Math.min(1, score));

  let grade: TurningPointResolutionGrade;
  if (score >= 0.9) grade = 'S';
  else if (score >= 0.75) grade = 'A';
  else if (score >= 0.6) grade = 'B';
  else if (score >= 0.45) grade = 'C';
  else if (score >= 0.3) grade = 'D';
  else grade = 'F';

  return Object.freeze({
    roomId: resolution.roomId,
    grade,
    score01: score,
    reasons: Object.freeze(reasons),
  });
}

// ============================================================================
// MARK: Room coherence validator
// ============================================================================

export interface TurningPointCoherenceViolation {
  readonly roomId: ChatRoomId;
  readonly code: string;
  readonly message: string;
}

export function validateResolutionCoherence(
  resolution: TurningPointResolution,
): readonly TurningPointCoherenceViolation[] {
  const violations: TurningPointCoherenceViolation[] = [];
  const { roomId } = resolution;

  if (resolution.candidates.length === 0 && !resolution.reasoning.fallbackUsed) {
    violations.push({ roomId, code: 'NO_CANDIDATES_NO_FALLBACK', message: 'Zero candidates but fallback was not used.' });
  }

  if (resolution.primary === null && resolution.candidates.length > 0) {
    violations.push({ roomId, code: 'PRIMARY_MISSING_WITH_CANDIDATES', message: 'Candidates exist but no primary was selected.' });
  }

  if (resolution.ranked.length > 0 && resolution.primary !== null) {
    const topRanked = resolution.ranked[0]!;
    if (topRanked.candidate.kind !== resolution.primary.kind) {
      violations.push({ roomId, code: 'PRIMARY_KIND_MISMATCH', message: 'Primary kind does not match top-ranked candidate kind.' });
    }
  }

  return Object.freeze(violations);
}

// ============================================================================
// MARK: Resolution epoch tracker
// ============================================================================

export interface TurningPointResolutionEpoch {
  readonly epochId: string;
  readonly roomId: ChatRoomId;
  readonly resolvedAt: UnixMs;
  readonly primaryKind: ChatTurningPointKind | null;
  readonly candidateCount: number;
}

export class TurningPointResolutionEpochTracker {
  private readonly epochs = new Map<ChatRoomId, TurningPointResolutionEpoch[]>();

  record(resolution: TurningPointResolution): void {
    const roomId = resolution.roomId;
    if (!this.epochs.has(roomId)) this.epochs.set(roomId, []);
    this.epochs.get(roomId)!.push(Object.freeze({
      epochId: `epoch:${roomId}:${resolution.resolvedAt}`,
      roomId,
      resolvedAt: resolution.resolvedAt,
      primaryKind: resolution.primary?.kind ?? null,
      candidateCount: resolution.candidates.length,
    }));
  }

  getEpochs(roomId: ChatRoomId): readonly TurningPointResolutionEpoch[] {
    return this.epochs.get(roomId) ?? [];
  }

  latestEpoch(roomId: ChatRoomId): TurningPointResolutionEpoch | null {
    const list = this.epochs.get(roomId);
    return list && list.length > 0 ? list[list.length - 1]! : null;
  }

  epochCount(roomId: ChatRoomId): number {
    return this.epochs.get(roomId)?.length ?? 0;
  }

  allRooms(): readonly ChatRoomId[] {
    return Array.from(this.epochs.keys());
  }

  purgeRoom(roomId: ChatRoomId): void {
    this.epochs.delete(roomId);
  }
}

// ============================================================================
// MARK: Turning-point kind frequency counter
// ============================================================================

export class TurningPointKindFrequencyCounter {
  private readonly counts = new Map<ChatTurningPointKind, number>();

  record(kind: ChatTurningPointKind): void {
    this.counts.set(kind, (this.counts.get(kind) ?? 0) + 1);
  }

  count(kind: ChatTurningPointKind): number {
    return this.counts.get(kind) ?? 0;
  }

  mostFrequent(): ChatTurningPointKind | null {
    let max = 0;
    let best: ChatTurningPointKind | null = null;
    for (const [kind, count] of this.counts) {
      if (count > max) { max = count; best = kind; }
    }
    return best;
  }

  distribution(): Readonly<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const [kind, count] of this.counts) result[kind] = count;
    return Object.freeze(result);
  }

  total(): number {
    let sum = 0;
    for (const count of this.counts.values()) sum += count;
    return sum;
  }

  reset(): void {
    this.counts.clear();
  }
}

// ============================================================================
// MARK: Module-level factory helpers
// ============================================================================

export function createTurningPointWatchBus(): TurningPointWatchBus {
  return new TurningPointWatchBus();
}

export function createEpochTracker(): TurningPointResolutionEpochTracker {
  return new TurningPointResolutionEpochTracker();
}

export function createKindFrequencyCounter(): TurningPointKindFrequencyCounter {
  return new TurningPointKindFrequencyCounter();
}

// ============================================================================
// MARK: Resolution context validator
// ============================================================================

export interface TurningPointContextValidationResult {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

export function validateResolverContext(
  context: TurningPointResolverContext,
): TurningPointContextValidationResult {
  const violations: string[] = [];

  if (!context.roomId) violations.push('roomId is required');
  if (!context.evidence) violations.push('evidence is required');
  if (!context.evidence.roomId) violations.push('evidence.roomId is required');
  if (!context.evidence.endedAt) violations.push('evidence.endedAt is required');

  if (
    context.turningPointCandidates !== undefined &&
    context.turningPointCandidates.length > 100
  ) {
    violations.push('turningPointCandidates exceeds maximum of 100');
  }

  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze(violations),
  });
}

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_TURNING_POINT_MODULE_NAME = 'TurningPointResolver' as const;
export const CHAT_TURNING_POINT_MODULE_VERSION = '2026.03.22.2' as const;

export const CHAT_TURNING_POINT_MODULE_LAWS = Object.freeze([
  'Turning-point resolution is deterministic given the same inputs.',
  'No mutation of transcript or replay state happens here.',
  'Weight profiles are named and versioned — runtime overrides are explicit.',
  'Fallback candidates are only injected when no scored candidates exist.',
  'The primary turning point is always the top-ranked scored candidate.',
  'All exported resolution objects are frozen.',
]);

export const CHAT_TURNING_POINT_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_TURNING_POINT_MODULE_NAME,
  version: CHAT_TURNING_POINT_MODULE_VERSION,
  laws: CHAT_TURNING_POINT_MODULE_LAWS,
  supportedProfiles: Object.keys(TURNING_POINT_WEIGHT_PROFILES) as TurningPointResolverWeightProfile[],
});

// ============================================================================
// MARK: Resolution batch quality sweep
// ============================================================================

export interface BatchQualitySweeepResult {
  readonly total: number;
  readonly graded: Readonly<Record<TurningPointResolutionGrade, number>>;
  readonly averageScore01: number;
  readonly worstRoomId: ChatRoomId | null;
  readonly bestRoomId: ChatRoomId | null;
}

export function runBatchQualitySweep(
  snapshot: TurningPointResolverSnapshot,
): BatchQualitySweeepResult {
  const rooms = Object.entries(snapshot.byRoom) as [ChatRoomId, TurningPointResolution][];
  const graded: Record<TurningPointResolutionGrade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
  let totalScore = 0;
  let worstScore = Infinity;
  let bestScore = -1;
  let worstRoomId: ChatRoomId | null = null;
  let bestRoomId: ChatRoomId | null = null;

  for (const [roomId, resolution] of rooms) {
    const report = gradeResolutionQuality(resolution);
    graded[report.grade]++;
    totalScore += report.score01;
    if (report.score01 < worstScore) { worstScore = report.score01; worstRoomId = roomId; }
    if (report.score01 > bestScore) { bestScore = report.score01; bestRoomId = roomId; }
  }

  return Object.freeze({
    total: rooms.length,
    graded: Object.freeze(graded),
    averageScore01: rooms.length > 0 ? totalScore / rooms.length : 0,
    worstRoomId,
    bestRoomId,
  });
}

// ============================================================================
// MARK: Resolution-to-plain-object export
// ============================================================================

export interface TurningPointResolutionExport {
  readonly roomId: ChatRoomId;
  readonly resolvedAt: UnixMs;
  readonly primaryKind: ChatTurningPointKind | null;
  readonly primaryLabel: string | null;
  readonly primaryScore01: number | null;
  readonly candidateCount: number;
  readonly weightProfile: TurningPointResolverWeightProfile | 'CUSTOM';
  readonly fallbackUsed: boolean;
}

export function exportResolution(resolution: TurningPointResolution): TurningPointResolutionExport {
  return Object.freeze({
    roomId: resolution.roomId,
    resolvedAt: resolution.resolvedAt,
    primaryKind: resolution.primary?.kind ?? null,
    primaryLabel: resolution.primary?.label ?? null,
    primaryScore01: resolution.ranked[0]?.finalScore01 ?? null,
    candidateCount: resolution.candidates.length,
    weightProfile: resolution.reasoning.weightProfile,
    fallbackUsed: resolution.reasoning.fallbackUsed,
  });
}

export function exportAllResolutions(
  snapshot: TurningPointResolverSnapshot,
): readonly TurningPointResolutionExport[] {
  return Object.values(snapshot.byRoom).map(exportResolution);
}

// ============================================================================
// MARK: Resolver session binder
// ============================================================================

/** Binds a resolver instance to a single room for ergonomic per-room use. */
export class TurningPointResolverRoomBinder {
  private readonly resolver: TurningPointResolver;
  private readonly roomId: ChatRoomId;

  constructor(resolver: TurningPointResolver, roomId: ChatRoomId) {
    this.resolver = resolver;
    this.roomId = roomId;
  }

  resolve(context: Omit<TurningPointResolverContext, 'roomId'>): TurningPointResolution {
    return this.resolver.resolve({ ...context, roomId: this.roomId });
  }

  getLastResolution(): TurningPointResolution | null {
    return this.resolver.getLastResolution(this.roomId);
  }

  getDiagnostics(): TurningPointResolutionDiagnostics | null {
    return this.resolver.getDiagnostics(this.roomId);
  }

  buildAuditReport(): TurningPointResolutionAuditReport {
    return this.resolver.buildAuditReport(this.roomId);
  }

  clear(): void {
    this.resolver.clear(this.roomId);
  }

  listCandidates(): readonly TurningPointResolutionCandidate[] {
    return this.resolver.listRoomCandidates(this.roomId);
  }
}

export function bindResolverToRoom(
  resolver: TurningPointResolver,
  roomId: ChatRoomId,
): TurningPointResolverRoomBinder {
  return new TurningPointResolverRoomBinder(resolver, roomId);
}

// ============================================================================
// MARK: Kind-to-valence lookup table export
// ============================================================================

export const TURNING_POINT_KIND_VALENCE_TABLE: Readonly<
  Record<ChatTurningPointKind, 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'>
> = Object.freeze({
  SHIELD_BREAK: 'NEGATIVE',
  COUNTERPLAY_MISS: 'NEGATIVE',
  BANKRUPTCY_LOCK: 'NEGATIVE',
  RESCUE_MISS: 'NEGATIVE',
  DEAL_ROOM_FOLD: 'NEGATIVE',
  EMOTIONAL_TILT: 'NEGATIVE',
  MIRACLE_SAVE: 'POSITIVE',
  LEGEND_REVERSAL: 'POSITIVE',
  RESCUE_ACCEPT: 'POSITIVE',
  SOVEREIGNTY_SPIKE: 'POSITIVE',
  CROWD_SWARM: 'NEUTRAL',
  WORLD_EVENT_IMPACT: 'NEUTRAL',
  CUSTOM: 'NEUTRAL',
});

// ============================================================================
// MARK: Extended ChatTurningPointResolverModule
// ============================================================================

export const ChatTurningPointResolverModuleExtended = Object.freeze({
  ...ChatTurningPointResolverModule,

  // Diff and fingerprint
  buildTurningPointResolutionDiff,
  computeResolutionFingerprint,

  // Serialization
  serializeTurningPointResolverState,
  hydrateTurningPointResolver,

  // Multi-room
  runMultiRoomTurningPointResolution,

  // Quality
  gradeResolutionQuality,
  runBatchQualitySweep,

  // Coherence
  validateResolutionCoherence,
  validateResolverContext,

  // Stats
  buildTurningPointResolverStatsSummary,

  // Export
  exportResolution,
  exportAllResolutions,

  // Watch bus
  createTurningPointWatchBus,

  // Epoch / frequency
  createEpochTracker,
  createKindFrequencyCounter,

  // Binder
  bindResolverToRoom,

  // Valence
  turningPointKindValence,
  filterCandidatesByValence,
  TURNING_POINT_KIND_VALENCE_TABLE,

  // Comparators
  compareCandidatesByScore,
  compareCandidatesByKind,
  sortResolutionCandidates,

  // Explanation
  buildCandidateExplanationReport,

  // Candidate materialize
  materializeTurningPoint,
} as const);
