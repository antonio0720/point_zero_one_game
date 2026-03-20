/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT FORESHADOW PLANNER
 * FILE: backend/src/game/engine/chat/postrun/ForeshadowPlanner.ts
 * VERSION: 2026.03.20
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Build the post-run “what now?” layer in backend authority.
 *
 * Post-run ritual is incomplete if it can only diagnose what happened. The
 * system must also decide what the room should fear, protect, expect, or carry
 * into the next run. This file owns that bridge.
 *
 * What this file owns
 * -------------------
 * - foreshadow planning
 * - post-run directive planning
 * - witness seed generation for helper/rival/crowd after a run closes
 * - deterministic ranking / trimming of future-facing signals
 * - room-scoped snapshotting for continuity
 *
 * What this file does not own
 * ---------------------------
 * - turning-point selection
 * - transcript delivery
 * - archive writes
 * - reward entitlement mutation
 * ==========================================================================
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
  type ChatPostRunWitness,
  type ChatTurningPoint,
} from '../../../../../../shared/contracts/chat/ChatPostRun';

// ============================================================================
// MARK: Planner contracts
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
}

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

const DEFAULT_OPTIONS: Required<ForeshadowPlannerOptions> = Object.freeze({
  maxForeshadow: 3,
  maxDirectives: 3,
  maxWitnessSeeds: 3,
  preferWorldEventEchoes: true,
  preferLegendCallbacks: true,
  includeCrowdWitnessSeed: true,
  includeHelperWitnessSeed: true,
  includeRivalWitnessSeed: true,
});

// ============================================================================
// MARK: Helpers
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
  return outcome === 'LOSS' || outcome === 'BANKRUPT';
}

function dominantHeatChannel(
  evidence: ChatPostRunEvidenceSnapshot,
  preferred?: ChatVisibleChannel,
): ChatVisibleChannel | undefined {
  if (preferred && evidence.audienceHeat[preferred]) return preferred;
  const entries = Object.entries(evidence.audienceHeat) as [ChatVisibleChannel, { heatScore?: number; humiliationPressure?: number; hypePressure?: number }][];
  return entries
    .sort((left, right) => {
      const leftScore = Math.max(Number(left[1].heatScore ?? 0) / 100, Number(left[1].humiliationPressure ?? 0) / 100, Number(left[1].hypePressure ?? 0) / 100);
      const rightScore = Math.max(Number(right[1].heatScore ?? 0) / 100, Number(right[1].humiliationPressure ?? 0) / 100, Number(right[1].hypePressure ?? 0) / 100);
      return rightScore - leftScore;
    })[0]?.[0];
}

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
    default:
      return null;
  }
}

function buildDirectiveFromBlame(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null | undefined,
  blame: ChatPostRunBlameVector | null | undefined,
): ChatPostRunDirective {
  const dominantHeat = dominantHeatChannel(evidence);
  const directive = buildDefaultDirective({
    directiveId: (`postrun:directive:${roomId}:${blame?.blameId ?? 'default'}` as unknown) as ChatPostRunDirective['directiveId'],
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

  return Object.freeze({
    ...directive,
    kind: forcedKind,
    label:
      forcedKind === 'TRUST_HELPER'
        ? 'Take the escape lane when it opens'
        : forcedKind === 'IGNORE_BAIT'
          ? 'Do not answer the room on tilt'
          : forcedKind === 'EXIT_DEAL_ROOM_EARLY'
            ? 'Cut negotiations sooner'
            : forcedKind === 'PROTECT_SHIELD'
              ? 'Stabilize shield before style'
              : directive.label,
    explanation:
      forcedKind === 'TRUST_HELPER'
        ? 'The post-run reading says the ignored rescue line was real and valuable.'
        : forcedKind === 'IGNORE_BAIT'
          ? 'The swarm amplified your collapse more than the underlying board state.'
          : forcedKind === 'EXIT_DEAL_ROOM_EARLY'
            ? 'The negotiation lane drained leverage faster than it created value.'
            : forcedKind === 'PROTECT_SHIELD'
              ? 'The collapse became irreversible once defensive integrity was gone.'
              : directive.explanation,
  });
}

function buildStrategicForeshadow(
  roomId: ChatRoomId,
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null | undefined,
  preferredWorldEventEchoes: boolean,
  preferredLegendCallbacks: boolean,
): ChatPostRunForeshadow[] {
  const dominantChannel = dominantHeatChannel(evidence);
  const seeded = buildDefaultForeshadow({
    foreshadowId: (`postrun:foreshadow:${roomId}:default` as unknown) as ChatPostRunForeshadow['foreshadowId'],
    outcome: evidence.runOutcome,
    turningPoint: turningPoint ?? undefined,
    dominantHeat: dominantChannel ? evidence.audienceHeat[dominantChannel] : undefined,
    legendId: preferredLegendCallbacks ? evidence.legendId : undefined,
    nextWorldEventId: preferredWorldEventEchoes ? evidence.worldEventIds[0] : undefined,
  });

  const results: ChatPostRunForeshadow[] = seeded ? [seeded] : [];

  if (isCollapse(evidence.runOutcome) && Number(evidence.affect.desperation) >= 70) {
    results.push(Object.freeze({
      foreshadowId: (`postrun:foreshadow:${roomId}:tilt` as unknown) as ChatPostRunForeshadow['foreshadowId'],
      kind: 'EMOTIONAL_CARRYOVER',
      label: 'Tilt will survive the room reset.',
      line: 'Unless the re-entry posture changes, the next run will inherit this desperation curve.',
      confidence01: toPostRunScore01(0.78),
      threat01: toPostRunScore01(0.74),
      hope01: toPostRunScore01(0.14),
      callbackMomentKind: turningPoint?.compactMoment?.kind,
      tags: Object.freeze(['affect_carryover', 'desperation']),
    }));
  }

  if ((evidence.runOutcome === 'WIN' || evidence.runOutcome === 'SOVEREIGN') && Number(evidence.reputation.publicReputation) >= 60) {
    results.push(Object.freeze({
      foreshadowId: (`postrun:foreshadow:${roomId}:exposure` as unknown) as ChatPostRunForeshadow['foreshadowId'],
      kind: 'RIVAL_RETURN',
      label: 'Winning widened the target on your back.',
      line: 'This room will invite sharper rivals and a more coordinated answer next run.',
      confidence01: toPostRunScore01(0.75),
      threat01: toPostRunScore01(0.63),
      hope01: toPostRunScore01(0.41),
      callbackMomentKind: turningPoint?.compactMoment?.kind,
      callbackLegendId: evidence.legendId,
      tags: Object.freeze(['winner_tax', 'rival_return']),
    }));
  }

  return results;
}

function buildWitnessSeeds(
  context: ForeshadowPlanningContext,
  options: Required<ForeshadowPlannerOptions>,
): ChatPostRunWitness[] {
  const channel = dominantHeatChannel(context.evidence, context.preferredVisibleChannel) ?? 'GLOBAL';
  const witnesses: ChatPostRunWitness[] = [];

  if (options.includeHelperWitnessSeed) {
    witnesses.push(buildDefaultPostRunWitness({
      witnessId: (`postrun:witness:${context.roomId}:helper` as unknown) as ChatPostRunWitness['witnessId'],
      actorRole: 'HELPER',
      stance: isCollapse(context.evidence.runOutcome) ? 'MOURNFUL' : 'STEADY',
      displayName: 'Helper',
      line: isCollapse(context.evidence.runOutcome)
        ? 'The room is closed. Learn the wound before you re-open it.'
        : 'Keep what worked. The next room will ask for cleaner repetition.',
      intensity01: isCollapse(context.evidence.runOutcome) ? 0.72 : 0.55,
      personal01: 0.58,
      timingMs: 850,
      visibleChannel: channel,
      npcId: context.relatedNpcIds?.[0],
      proofHash: context.evidence.proofHash,
      tags: Object.freeze(['planner_seed', 'helper']),
    }));
  }

  if (options.includeRivalWitnessSeed) {
    witnesses.push(buildDefaultPostRunWitness({
      witnessId: (`postrun:witness:${context.roomId}:rival` as unknown) as ChatPostRunWitness['witnessId'],
      actorRole: 'RIVAL',
      stance: isCollapse(context.evidence.runOutcome) ? 'PREDATORY' : 'TAUNTING',
      displayName: 'Rival',
      line: isCollapse(context.evidence.runOutcome)
        ? 'You did not lose at the end. You lost when the room sensed hesitation.'
        : 'You survived this room. That only makes the next answer sharper.',
      intensity01: 0.82,
      personal01: 0.44,
      timingMs: 620,
      visibleChannel: channel,
      npcId: context.relatedNpcIds?.[1],
      proofHash: context.evidence.proofHash,
      tags: Object.freeze(['planner_seed', 'rival']),
    }));
  }

  if (options.includeCrowdWitnessSeed) {
    witnesses.push(buildDefaultPostRunWitness({
      witnessId: (`postrun:witness:${context.roomId}:crowd` as unknown) as ChatPostRunWitness['witnessId'],
      actorRole: 'CROWD',
      stance: isCollapse(context.evidence.runOutcome) ? 'JUDGMENTAL' : 'AWED',
      displayName: 'Channel',
      line: isCollapse(context.evidence.runOutcome)
        ? 'The room did not miss the break.'
        : 'The room saw the shift and will remember the posture.',
      intensity01: 0.64,
      personal01: 0.20,
      timingMs: 1_180,
      visibleChannel: channel,
      proofHash: context.evidence.proofHash,
      tags: Object.freeze(['planner_seed', 'crowd']),
    }));
  }

  return witnesses.slice(0, options.maxWitnessSeeds);
}

// ============================================================================
// MARK: Planner implementation
// ============================================================================

export class ForeshadowPlanner {
  private readonly options: Required<ForeshadowPlannerOptions>;
  private readonly byRoom = new Map<ChatRoomId, ForeshadowPlanningResult>();

  public constructor(options: ForeshadowPlannerOptions = {}) {
    this.options = Object.freeze({
      ...DEFAULT_OPTIONS,
      ...options,
    });
  }

  public getOptions(): Readonly<ForeshadowPlannerOptions> {
    return this.options;
  }

  public plan(context: ForeshadowPlanningContext): ForeshadowPlanningResult {
    const primaryBlame = context.blameVectors?.[0] ?? null;

    const directives = uniqueBy(
      [
        ...(context.existingDirectives ?? []),
        buildDirectiveFromBlame(context.roomId, context.evidence, context.turningPoint, primaryBlame),
      ],
      (directive) => `${directive.kind}|${directive.label}`,
    )
      .sort((left, right) => scoreDirective(right) - scoreDirective(left) || left.label.localeCompare(right.label))
      .slice(0, this.options.maxDirectives);

    const foreshadow = uniqueBy(
      [
        ...(context.existingForeshadow ?? []),
        ...buildStrategicForeshadow(
          context.roomId,
          context.evidence,
          context.turningPoint,
          this.options.preferWorldEventEchoes,
          this.options.preferLegendCallbacks,
        ),
      ],
      (item) => `${item.kind}|${item.label}`,
    )
      .sort((left, right) => scoreForeshadow(right) - scoreForeshadow(left) || left.label.localeCompare(right.label))
      .slice(0, this.options.maxForeshadow);

    const witnessSeeds = buildWitnessSeeds(context, this.options);
    const primaryDirective = choosePrimaryDirective(directives);
    const primaryForeshadow = choosePrimaryForeshadow(foreshadow);

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
        witnessReason: witnessSeeds.length > 0
          ? `witness_seed_count:${witnessSeeds.length}`
          : 'no_witness_seed',
      }),
    });

    this.byRoom.set(context.roomId, result);
    return result;
  }

  public getLastPlan(roomId: ChatRoomId): ForeshadowPlanningResult | null {
    return this.byRoom.get(roomId) ?? null;
  }

  public clear(roomId?: ChatRoomId): void {
    if (roomId) {
      this.byRoom.delete(roomId);
      return;
    }
    this.byRoom.clear();
  }

  public getSnapshot(): ForeshadowPlannerSnapshot {
    return Object.freeze({
      updatedAt: nowMs(),
      byRoom: Object.freeze(Object.fromEntries(this.byRoom.entries())) as Readonly<Record<ChatRoomId, ForeshadowPlanningResult>>,
    });
  }

  public restore(snapshot: ForeshadowPlannerSnapshot): void {
    this.byRoom.clear();
    for (const [roomId, plan] of Object.entries(snapshot.byRoom) as [ChatRoomId, ForeshadowPlanningResult][]) {
      this.byRoom.set(roomId, plan);
    }
  }
}

export function createForeshadowPlanner(options: ForeshadowPlannerOptions = {}): ForeshadowPlanner {
  return new ForeshadowPlanner(options);
}

export const ChatForeshadowPlannerModule = Object.freeze({
  ForeshadowPlanner,
  createForeshadowPlanner,
} as const);
