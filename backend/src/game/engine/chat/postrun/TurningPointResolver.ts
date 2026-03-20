/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TURNING-POINT RESOLVER
 * FILE: backend/src/game/engine/chat/postrun/TurningPointResolver.ts
 * VERSION: 2026.03.20
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
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
 * - integrity-friendly serialization / hydration
 *
 * What this file does not own
 * ---------------------------
 * - transcript mutation
 * - replay artifact authoring
 * - legend admission
 * - witness text authoring
 * - socket fanout
 * ==========================================================================
 */

import type {
  ChatMessageId,
  ChatNpcId,
  ChatRoomId,
  ChatSceneId,
  ChatVisibleChannel,
  JsonObject,
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
// MARK: Resolver contracts
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

export interface TurningPointResolverOptions {
  readonly maxCandidates?: number;
  readonly includeFallbackCandidate?: boolean;
  readonly preferVisibleMoments?: boolean;
  readonly preferReplayLinkedMoments?: boolean;
  readonly preferLegendLinkedMoments?: boolean;
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

const DEFAULT_WEIGHTS: TurningPointResolverWeights = Object.freeze({
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
});

const DEFAULT_OPTIONS: Required<Omit<TurningPointResolverOptions, 'weights'>> = Object.freeze({
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
    case 'TRACE': return 0.12;
    case 'LOW': return 0.25;
    case 'MEDIUM': return 0.50;
    case 'HIGH': return 0.72;
    case 'CRITICAL': return 0.89;
    case 'MYTHIC': return 1;
    default: return 0.5;
  }
}

function momentKindToTurningPointKind(kind: ChatMomentKind): ChatTurningPointKind {
  switch (kind) {
    case 'BANKRUPTCY_THREAT':
    case 'INSOLVENCY':
      return 'BANKRUPTCY_LOCK';
    case 'SHIELD_BREAK':
    case 'BOT_AMBUSH':
    case 'COUNTERPLAY_FAIL':
      return 'COUNTER_WINDOW';
    case 'COMEBACK_SPARK':
    case 'ESCAPE':
    case 'RESCUE_SUCCESS':
      return 'COMEBACK_SEED';
    case 'RESCUE_REFUSAL':
    case 'RECOVERY_WINDOW':
      return 'RESCUE_MISS';
    case 'CROWD_TURN':
    case 'PUBLIC_SHAME_SPIKE':
      return 'CROWD_SWARM';
    case 'NEGOTIATION_BREAK':
    case 'DEAL_COLLAPSE':
      return 'DEAL_ROOM_FOLD';
    case 'WORLD_EVENT_SURGE':
    case 'LIVEOPS_DIRECTIVE':
      return 'WORLD_EVENT_IMPACT';
    case 'SOVEREIGNTY_LOCK':
    case 'LEGEND_TRIGGER':
      return 'SOVEREIGNTY_SURGE';
    case 'RIVAL_CALL_OUT':
    case 'RIVAL_STRIKE':
      return 'RIVAL_INTRUSION';
    default:
      return 'PRESSURE_INFLECTION';
  }
}

function fallbackTurningPointKind(
  evidence: ChatPostRunEvidenceSnapshot,
): ChatTurningPointKind {
  switch (evidence.runOutcome) {
    case 'BANKRUPT':
      return 'BANKRUPTCY_LOCK';
    case 'LOSS':
      return Number(evidence.affect.socialEmbarrassment) >= 60
        ? 'CROWD_SWARM'
        : 'PRESSURE_INFLECTION';
    case 'WIN':
      return 'COMEBACK_SEED';
    case 'SOVEREIGN':
      return 'SOVEREIGNTY_SURGE';
    default:
      return 'PRESSURE_INFLECTION';
  }
}

function isVisibleCandidate(candidate: ChatTurningPointCandidate): boolean {
  return candidate.visibility === 'CHANNEL' || candidate.visibility === 'MULTI_CHANNEL';
}

function computeHeatBias(
  candidate: ChatTurningPointCandidate,
  evidence: ChatPostRunEvidenceSnapshot,
): number {
  const channels = Object.entries(evidence.audienceHeat ?? {}) as [ChatVisibleChannel, { humiliationPressure?: number; hypePressure?: number; heatScore?: number }][];
  const payloadChannel = typeof candidate.payload?.visibleChannel === 'string' ? (candidate.payload.visibleChannel as ChatVisibleChannel) : undefined;
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
  const span = Math.max(1, Number(evidence.endedAt) - Number(candidate.detectedAt));
  return clamp01(1 - (span / (1000 * 60 * 20)));
}

function sameEntityBias(
  candidate: ChatTurningPointCandidate,
  context: TurningPointResolverContext,
): number {
  let boost = 0;
  if (candidate.sourceNpcId && context.preferredNpcIds?.includes(candidate.sourceNpcId)) boost += 0.5;
  if (candidate.sourceSceneId && context.preferredSceneIds?.includes(candidate.sourceSceneId)) boost += 0.35;
  if (candidate.sourceMessageId && context.preferredMessageIds?.includes(candidate.sourceMessageId)) boost += 0.25;
  return clamp01(boost);
}

function continuityBias(
  candidate: ChatTurningPointCandidate,
  previousTurningPoint?: ChatTurningPoint | null,
): number {
  if (!previousTurningPoint) return 0;
  if (candidate.kind === previousTurningPoint.kind) return 1;
  if (candidate.sourceNpcId && candidate.sourceNpcId === previousTurningPoint.sourceNpcId) return 0.72;
  if (candidate.sourceMessageId && candidate.sourceMessageId === previousTurningPoint.sourceMessageId) return 0.56;
  if (candidate.sourceSceneId && candidate.sourceSceneId === previousTurningPoint.sourceSceneId) return 0.48;
  return 0;
}

function materializeTurningPoint(candidate: ChatTurningPointCandidate, moments?: readonly ChatMoment[]): ChatTurningPoint {
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
    shock01: toPostRunScore01(Math.max(
      severityTo01(moment.severity),
      Math.abs(Number(moment.affectContext?.targetEmbarrassmentDelta ?? 0)) / 100,
      Math.abs(Number(moment.affectContext?.targetFrustrationDelta ?? 0)) / 100,
    )),
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
    outcome === 'SOVEREIGN'
      ? 'The ascent became irreversible.'
      : outcome === 'WIN'
        ? 'The recovery line finally held.'
        : outcome === 'BANKRUPT'
          ? 'The room locked into insolvency.'
          : 'The pressure surface stopped being recoverable.';

  const explanation =
    outcome === 'SOVEREIGN'
      ? 'No single visible callback outranked the final convergence, so the resolver names the irreversible ascent itself.'
      : outcome === 'WIN'
        ? 'The board finally bent in your favor hard enough that the run could no longer collapse.'
        : outcome === 'BANKRUPT'
          ? 'No earlier confirmed moment outweighed the final structural lock, so the resolver names the insolvency closure.'
          : 'No upstream moment fully dominated the room, so the resolver names the point where recovery became implausible.';

  return Object.freeze({
    turningPointId: (`turning:${context.roomId}:fallback:${outcome}` as unknown) as ChatTurningPointCandidate['turningPointId'],
    kind,
    label,
    explanation,
    severity:
      outcome === 'SOVEREIGN'
        ? 'MYTHIC'
        : outcome === 'WIN'
          ? 'HIGH'
          : outcome === 'BANKRUPT'
            ? 'CRITICAL'
            : 'HIGH',
    visibility: context.evidence.proofHash || context.evidence.replayId ? 'CHANNEL' : 'PRIVATE',
    shock01: toPostRunScore01(outcome === 'SOVEREIGN' ? 0.96 : outcome === 'WIN' ? 0.68 : 0.74),
    inevitability01: toPostRunScore01(outcome === 'BANKRUPT' ? 0.94 : 0.72),
    reversal01: toPostRunScore01(outcome === 'WIN' || outcome === 'SOVEREIGN' ? 0.72 : 0.38),
    memorySalience01: toPostRunScore01(context.evidence.legendId || context.evidence.replayId ? 0.86 : 0.58),
    blameWeight01: toPostRunScore01(outcome === 'LOSS' || outcome === 'BANKRUPT' ? 0.78 : 0.42),
    legendLift01: toPostRunScore01(context.evidence.legendId ? 0.92 : outcome === 'SOVEREIGN' ? 0.84 : 0.35),
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
  private readonly options: Required<Omit<TurningPointResolverOptions, 'weights'>>;
  private readonly weights: TurningPointResolverWeights;
  private readonly byRoom = new Map<ChatRoomId, TurningPointResolution>();

  public constructor(options: TurningPointResolverOptions = {}) {
    this.options = Object.freeze({
      ...DEFAULT_OPTIONS,
      ...options,
    });
    this.weights = Object.freeze({
      ...DEFAULT_WEIGHTS,
      ...(options.weights ?? {}),
    });
  }

  public getOptions(): Readonly<TurningPointResolverOptions> {
    return Object.freeze({ ...this.options, weights: this.weights });
  }

  public resolve(context: TurningPointResolverContext): TurningPointResolution {
    const derived = (context.moments ?? []).map((moment) => baseCandidateFromMoment(moment, context));
    const supplied = [...(context.turningPointCandidates ?? [])];
    const merged = uniqueBy(
      compact<ChatTurningPointCandidate>([
        ...supplied,
        ...derived,
        this.options.includeFallbackCandidate ? fallbackCandidate(context) : undefined,
      ]),
      (candidate) => `${candidate.sourceMomentId ?? 'none'}|${candidate.kind}|${candidate.label}`,
    ).slice(0, this.options.maxCandidates * 2);

    const ranked = merged
      .map((candidate) => this.rankCandidate(candidate, context))
      .sort((left, right) => right.finalScore01 - left.finalScore01 || left.candidate.label.localeCompare(right.candidate.label))
      .slice(0, this.options.maxCandidates);

    const plainCandidates = sortTurningPointCandidates(ranked.map((entry) => entry.candidate));
    const primaryCandidate = choosePrimaryTurningPoint(plainCandidates, context.moments);
    const primary = primaryCandidate ? materializeTurningPoint(primaryCandidate, context.moments) : null;

    const reasoning: TurningPointResolutionReasoning = Object.freeze({
      candidateCount: ranked.length,
      fallbackUsed: ranked.some((entry) => entry.candidate.tags?.includes('fallback_candidate')),
      visibleChannelBiasApplied: this.options.preferVisibleMoments,
      previousTurningPointBiasApplied: Boolean(context.previousTurningPoint),
      preferredEntityBiasApplied: Boolean(
        context.preferredNpcIds?.length ||
        context.preferredSceneIds?.length ||
        context.preferredMessageIds?.length,
      ),
      topReasons: Object.freeze(ranked[0]?.reasons ?? []),
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

  public listRoomCandidates(roomId: ChatRoomId): readonly TurningPointResolutionCandidate[] {
    return this.byRoom.get(roomId)?.ranked ?? Object.freeze([]);
  }

  public getLastResolution(roomId: ChatRoomId): TurningPointResolution | null {
    return this.byRoom.get(roomId) ?? null;
  }

  public clear(roomId?: ChatRoomId): void {
    if (roomId) {
      this.byRoom.delete(roomId);
      return;
    }
    this.byRoom.clear();
  }

  public getSnapshot(): TurningPointResolverSnapshot {
    return Object.freeze({
      updatedAt: nowMs(),
      byRoom: Object.freeze(Object.fromEntries(this.byRoom.entries())) as Readonly<Record<ChatRoomId, TurningPointResolution>>,
    });
  }

  public restore(snapshot: TurningPointResolverSnapshot): void {
    this.byRoom.clear();
    for (const [roomId, resolution] of Object.entries(snapshot.byRoom) as [ChatRoomId, TurningPointResolution][]) {
      this.byRoom.set(roomId, resolution);
    }
  }

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
    const visibility = isVisibleCandidate(candidate) ? 1 : 0;

    if (severity > 0.7) reasons.push('high_severity');
    if (heat > 0.55) reasons.push('channel_heat');
    if (continuity > 0.4) reasons.push('continuity_match');
    if (preferred > 0.25) reasons.push('preferred_entity');
    if (visibility > 0) reasons.push('visible_surface');
    if (candidate.sourceMessageId && context.evidence.relatedMessageIds.includes(candidate.sourceMessageId)) reasons.push('related_message');
    if (candidate.sourceWorldEventId && context.evidence.worldEventIds.includes(candidate.sourceWorldEventId)) reasons.push('world_event');

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
        preferred * 0.05,
    );

    return Object.freeze({
      candidate,
      finalScore01: weighted,
      reasons: Object.freeze(reasons),
    });
  }
}

export function createTurningPointResolver(options: TurningPointResolverOptions = {}): TurningPointResolver {
  return new TurningPointResolver(options);
}

export const ChatTurningPointResolverModule = Object.freeze({
  TurningPointResolver,
  createTurningPointResolver,
} as const);
