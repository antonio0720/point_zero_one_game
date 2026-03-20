/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT POST-RUN NARRATIVE ENGINE
 * FILE: backend/src/game/engine/chat/postrun/PostRunNarrativeEngine.ts
 * VERSION: 2026.03.20
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Compose the authoritative backend post-run ritual.
 *
 * Frontend staging already gives the pzo-web lane immediate ritual structure.
 * This file is the backend truth layer that can confirm, reshape, and persist
 * the authored reading of the run.
 *
 * This engine answers:
 * - what kind of post-run rite should this room receive,
 * - what turning point owns the interpretation,
 * - how blame / directive / foreshadow should be shaped,
 * - which witness lines should survive into the authoritative plan,
 * - which beats should be visible, shadow, replayable, or archivable,
 * - and what summary/archive/ledger bundle should downstream transport use.
 *
 * What this file owns
 * -------------------
 * - authoritative post-run plan composition
 * - post-run beat authoring
 * - witness staging for helper / rival / crowd / system / narrator
 * - archive / digest / ledger derivation
 * - room-scoped storage of the latest authoritative evaluation
 *
 * What this file does not own
 * ---------------------------
 * - socket fanout
 * - reducer delivery mutation
 * - world-event scheduling
 * - reward grant execution
 * ==========================================================================
 */

import type {
  ChatRoomId,
  ChatVisibleChannel,
  JsonObject,
  UnixMs,
} from '../../../../../../shared/contracts/chat/ChatChannels';
import type { ChatMoment } from '../../../../../../shared/contracts/chat/ChatMoment';
import {
  buildDefaultBlameVector,
  buildDefaultPostRunBeat,
  buildDefaultPostRunWitness,
  buildMinimalPostRunPlan,
  buildPostRunArchiveEntry,
  buildPostRunDigest,
  buildPostRunSummaryCard,
  choosePrimaryBlameVector,
  collectPostRunChannels,
  countPostRunBeatsByKind,
  createEmptyPostRunRuntimeState,
  createPostRunReceipt,
  deriveDominantVisibleChannel,
  derivePostRunArchivePolicy,
  derivePostRunClass,
  derivePostRunClosureBand,
  derivePostRunLedgerEntry,
  derivePostRunTone,
  derivePostRunVisibility,
  derivePrimaryWitnessStance,
  deriveSummaryClass,
  normalizePostRunPlan,
  postRunPlanSupportsReplay,
  postRunPlanSupportsWorldEcho,
  projectPostRunThread,
  scoreBlameVector,
  shouldAnchorPostRunMemory,
  shouldBroadcastPostRunPublicly,
  shouldEscalatePostRunToLegend,
  sortPostRunBeats,
  summarizePostRunPlan,
  summarizePrimaryBlame,
  summarizePrimaryDirective,
  summarizePrimaryForeshadow,
  summarizeTurningPoint,
  toPostRunScore01,
  type ChatPostRunArchiveEntry,
  type ChatPostRunBeat,
  type ChatPostRunBlameVector,
  type ChatPostRunDirective,
  type ChatPostRunDigest,
  type ChatPostRunEvidenceSnapshot,
  type ChatPostRunForeshadow,
  type ChatPostRunKind,
  type ChatPostRunLedgerEntry,
  type ChatPostRunPlan,
  type ChatPostRunRuntimeState,
  type ChatPostRunSummaryCard,
  type ChatPostRunSummaryClass,
  type ChatPostRunTone,
  type ChatPostRunVisibilityMode,
  type ChatPostRunWitness,
  type ChatTurningPoint,
  type ChatTurningPointCandidate,
} from '../../../../../../shared/contracts/chat/ChatPostRun';
import {
  createForeshadowPlanner,
  ForeshadowPlanner,
  type ForeshadowPlannerOptions,
  type ForeshadowPlanningResult,
} from './ForeshadowPlanner';
import {
  createTurningPointResolver,
  TurningPointResolver,
  type TurningPointResolution,
  type TurningPointResolverContext,
  type TurningPointResolverOptions,
} from './TurningPointResolver';

// ============================================================================
// MARK: Engine contracts
// ============================================================================

export interface PostRunNarrativeEngineOptions {
  readonly maxWitnesses?: number;
  readonly includeSilenceBeat?: boolean;
  readonly includeCrowdWitness?: boolean;
  readonly includeHelperWitness?: boolean;
  readonly includeRivalWitness?: boolean;
  readonly includeSummaryBeat?: boolean;
  readonly includeForeshadowBeat?: boolean;
  readonly includeDirectiveBeat?: boolean;
  readonly settleImmediately?: boolean;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly verdictDelayMs?: number;
  readonly witnessBaseDelayMs?: number;
  readonly summaryDelayMs?: number;
  readonly foreshadowDelayMs?: number;
  readonly directiveDelayMs?: number;
  readonly silenceDurationMs?: number;
  readonly turningPointResolver?: TurningPointResolver;
  readonly turningPointResolverOptions?: TurningPointResolverOptions;
  readonly foreshadowPlanner?: ForeshadowPlanner;
  readonly foreshadowPlannerOptions?: ForeshadowPlannerOptions;
}

export interface PostRunNarrativeContext {
  readonly postRunId: ChatPostRunPlan['postRunId'];
  readonly bundleId: ChatPostRunPlan['bundleId'];
  readonly roomId: ChatRoomId;
  readonly kind: ChatPostRunKind;
  readonly evidence: ChatPostRunEvidenceSnapshot;
  readonly moments?: readonly ChatMoment[];
  readonly turningPointCandidates?: readonly ChatTurningPointCandidate[];
  readonly blameVectors?: readonly ChatPostRunBlameVector[];
  readonly directives?: readonly ChatPostRunDirective[];
  readonly foreshadow?: readonly ChatPostRunForeshadow[];
  readonly witnesses?: readonly ChatPostRunWitness[];
  readonly previousPlan?: ChatPostRunPlan | null;
  readonly preferredVisibleChannel?: ChatVisibleChannel;
  readonly relatedNpcIds?: readonly string[];
  readonly payload?: JsonObject;
  readonly createdAt?: UnixMs;
}

export interface PostRunNarrativeReasoning {
  readonly turningPointReason: string;
  readonly blameReason: string;
  readonly witnessReason: string;
  readonly beatReason: string;
  readonly visibilityReason: string;
}

export interface PostRunNarrativeEvaluation {
  readonly roomId: ChatRoomId;
  readonly evaluatedAt: UnixMs;
  readonly plan: ChatPostRunPlan;
  readonly archiveEntry: ChatPostRunArchiveEntry;
  readonly digest: ChatPostRunDigest;
  readonly ledgerEntry: ChatPostRunLedgerEntry;
  readonly runtimeState: ChatPostRunRuntimeState;
  readonly dominantChannel?: ChatVisibleChannel;
  readonly dominantTone: ChatPostRunTone;
  readonly summaryClass: ChatPostRunSummaryClass;
  readonly primaryTurningPoint: ChatTurningPoint | null;
  readonly primaryBlame: ChatPostRunBlameVector | null;
  readonly publicBroadcastRecommended: boolean;
  readonly replayPersistenceRecommended: boolean;
  readonly worldEchoRecommended: boolean;
  readonly turningPointResolution: TurningPointResolution;
  readonly foreshadowPlan: ForeshadowPlanningResult;
  readonly reasoning: PostRunNarrativeReasoning;
}

export interface PostRunNarrativeEngineSnapshot {
  readonly updatedAt: UnixMs;
  readonly byRoom: Readonly<Record<ChatRoomId, PostRunNarrativeEvaluation>>;
}

const DEFAULT_OPTIONS: Required<Omit<PostRunNarrativeEngineOptions, 'turningPointResolver' | 'turningPointResolverOptions' | 'foreshadowPlanner' | 'foreshadowPlannerOptions'>> = Object.freeze({
  maxWitnesses: 4,
  includeSilenceBeat: true,
  includeCrowdWitness: true,
  includeHelperWitness: true,
  includeRivalWitness: true,
  includeSummaryBeat: true,
  includeForeshadowBeat: true,
  includeDirectiveBeat: true,
  settleImmediately: true,
  defaultVisibleChannel: 'GLOBAL',
  verdictDelayMs: 0,
  witnessBaseDelayMs: 900,
  summaryDelayMs: 2_250,
  foreshadowDelayMs: 3_250,
  directiveDelayMs: 2_850,
  silenceDurationMs: 1_150,
});

// ============================================================================
// MARK: Helpers
// ============================================================================

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
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

function isCollapse(outcome: ChatPostRunEvidenceSnapshot['runOutcome']): boolean {
  return outcome === 'LOSS' || outcome === 'BANKRUPT';
}

function isVictory(outcome: ChatPostRunEvidenceSnapshot['runOutcome']): boolean {
  return outcome === 'WIN' || outcome === 'SOVEREIGN';
}

function chooseNarrativeVisibility(
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null,
  preferredChannel?: ChatVisibleChannel,
): ChatPostRunVisibilityMode {
  return derivePostRunVisibility({
    preferredChannel: preferredChannel ?? turningPoint?.compactMoment?.visibleChannel,
    outcome: evidence.runOutcome,
    primaryTurningPoint: turningPoint ?? undefined,
    dominantHeat: (preferredChannel ?? turningPoint?.compactMoment?.visibleChannel)
      ? evidence.audienceHeat[(preferredChannel ?? turningPoint?.compactMoment?.visibleChannel)!]
      : undefined,
    replayId: evidence.replayId,
    legendId: evidence.legendId,
  });
}

function buildWitnesses(
  context: PostRunNarrativeContext,
  options: Required<Omit<PostRunNarrativeEngineOptions, 'turningPointResolver' | 'turningPointResolverOptions' | 'foreshadowPlanner' | 'foreshadowPlannerOptions'>>,
  turningPoint: ChatTurningPoint | null,
  foreshadowPlan: ForeshadowPlanningResult,
  visibility: ChatPostRunVisibilityMode,
  dominantChannel: ChatVisibleChannel,
): readonly ChatPostRunWitness[] {
  const seeded = [...(context.witnesses ?? []), ...foreshadowPlan.witnessSeeds];
  const witnesses: ChatPostRunWitness[] = [...seeded];

  if (options.includeHelperWitness && !seeded.some((witness) => witness.actorRole === 'HELPER')) {
    witnesses.push(buildDefaultPostRunWitness({
      witnessId: (`postrun:witness:${context.postRunId}:helper` as unknown) as ChatPostRunWitness['witnessId'],
      actorRole: 'HELPER',
      stance: isCollapse(context.evidence.runOutcome) ? 'MOURNFUL' : 'STEADY',
      displayName: 'Helper',
      line: isCollapse(context.evidence.runOutcome)
        ? 'Name the break correctly and the next room will not own you so easily.'
        : 'Protect the line that worked. Winning still leaves a trace the next room can target.',
      intensity01: isCollapse(context.evidence.runOutcome) ? 0.74 : 0.58,
      personal01: 0.62,
      timingMs: options.witnessBaseDelayMs + 250,
      visibleChannel: visibility === 'PRIVATE' || visibility === 'SHADOW_ONLY' ? null : dominantChannel,
      npcId: context.relatedNpcIds?.[0] as ChatPostRunWitness['npcId'],
      proofHash: context.evidence.proofHash,
      tags: Object.freeze(['postrun', 'helper']),
    }));
  }

  if (options.includeRivalWitness && !seeded.some((witness) => witness.actorRole === 'RIVAL')) {
    witnesses.push(buildDefaultPostRunWitness({
      witnessId: (`postrun:witness:${context.postRunId}:rival` as unknown) as ChatPostRunWitness['witnessId'],
      actorRole: 'RIVAL',
      stance: isCollapse(context.evidence.runOutcome) ? 'PREDATORY' : 'TAUNTING',
      displayName: 'Rival',
      line: isCollapse(context.evidence.runOutcome)
        ? 'This did not end in the final tick. It ended when you stopped governing the room.'
        : 'The room saw the win. That only makes your next mistake more valuable to watch.',
      intensity01: 0.84,
      personal01: 0.46,
      timingMs: options.witnessBaseDelayMs,
      visibleChannel: visibility === 'PRIVATE' || visibility === 'SHADOW_ONLY' ? null : dominantChannel,
      npcId: context.relatedNpcIds?.[1] as ChatPostRunWitness['npcId'],
      proofHash: context.evidence.proofHash,
      tags: Object.freeze(['postrun', 'rival']),
    }));
  }

  if (options.includeCrowdWitness && !seeded.some((witness) => witness.actorRole === 'CROWD')) {
    witnesses.push(buildDefaultPostRunWitness({
      witnessId: (`postrun:witness:${context.postRunId}:crowd` as unknown) as ChatPostRunWitness['witnessId'],
      actorRole: 'CROWD',
      stance: derivePrimaryWitnessStance(witnesses) ?? (isCollapse(context.evidence.runOutcome) ? 'JUDGMENTAL' : 'AWED'),
      displayName: 'Channel',
      line: isCollapse(context.evidence.runOutcome)
        ? 'The room saw the turning point and kept it.'
        : 'The room saw the turn and will carry it forward.',
      intensity01: 0.60,
      personal01: 0.18,
      timingMs: options.witnessBaseDelayMs + 700,
      visibleChannel: visibility === 'PRIVATE' || visibility === 'SHADOW_ONLY' ? null : dominantChannel,
      proofHash: context.evidence.proofHash,
      tags: Object.freeze(['postrun', 'crowd']),
    }));
  }

  return uniqueBy(witnesses, (witness) => `${witness.actorRole}|${witness.displayName}|${witness.line}`)
    .slice(0, options.maxWitnesses);
}

function buildBlameVectors(
  context: PostRunNarrativeContext,
  turningPoint: ChatTurningPoint | null,
): readonly ChatPostRunBlameVector[] {
  const supplied = [...(context.blameVectors ?? [])];
  if (supplied.length > 0) {
    return supplied
      .slice()
      .sort((left, right) => scoreBlameVector(right) - scoreBlameVector(left) || left.label.localeCompare(right.label));
  }

  return Object.freeze([
    buildDefaultBlameVector({
      blameId: (`postrun:blame:${context.postRunId}:primary` as unknown) as ChatPostRunBlameVector['blameId'],
      outcome: context.evidence.runOutcome,
      turningPoint: turningPoint ?? undefined,
      affect: context.evidence.affect,
      heat: (turningPoint?.compactMoment?.visibleChannel ?? context.preferredVisibleChannel)
        ? context.evidence.audienceHeat[(turningPoint?.compactMoment?.visibleChannel ?? context.preferredVisibleChannel)!]
        : undefined,
      sourceMomentIds: turningPoint?.compactMoment ? [turningPoint.compactMoment.momentId] : [],
    }),
  ]);
}

function buildSummaryCard(
  context: PostRunNarrativeContext,
  planInputs: {
    tone: ChatPostRunTone;
    visibility: ChatPostRunVisibilityMode;
    turningPoint: ChatTurningPoint | null;
    blameVectors: readonly ChatPostRunBlameVector[];
    directives: readonly ChatPostRunDirective[];
    foreshadow: readonly ChatPostRunForeshadow[];
    legendEscalationEligible: boolean;
    shouldAnchorMemory: boolean;
  },
): ChatPostRunSummaryCard {
  const closureBand = derivePostRunClosureBand({
    outcome: context.evidence.runOutcome,
    affect: context.evidence.affect,
    turningPoint: planInputs.turningPoint ?? undefined,
    foreshadowCount: planInputs.foreshadow.length,
    directiveCount: planInputs.directives.length,
  });
  const archivePolicy = derivePostRunArchivePolicy({
    closureBand,
    replayId: context.evidence.replayId,
    proofHash: context.evidence.proofHash,
    legendEligible: planInputs.legendEscalationEligible,
    shouldAnchorMemory: planInputs.shouldAnchorMemory,
  });

  return buildPostRunSummaryCard({
    summaryId: (`postrun:summary:${context.postRunId}` as unknown) as ChatPostRunSummaryCard['summaryId'],
    cardId: (`postrun:card:${context.postRunId}` as unknown) as ChatPostRunSummaryCard['cardId'],
    title:
      context.evidence.runOutcome === 'SOVEREIGN'
        ? 'The room closed under authored control.'
        : context.evidence.runOutcome === 'WIN'
          ? 'The room closed with witnesses and residue.'
          : 'The room ended, but the meaning stayed open.',
    subtitle: summarizeTurningPoint(planInputs.turningPoint ?? undefined) ?? 'No single visible pivot outranked the total pressure field.',
    body: [
      summarizePrimaryBlame(planInputs.blameVectors),
      summarizePrimaryDirective(planInputs.directives),
      summarizePrimaryForeshadow(planInputs.foreshadow),
    ].filter(Boolean).join(' '),
    tone: planInputs.tone,
    closureBand,
    kind: context.kind,
    archiveClass: context.evidence.finalSceneSummary?.archiveClass,
    archivePolicy,
    turningPoint: planInputs.turningPoint ?? undefined,
    blameVectors: planInputs.blameVectors,
    directives: planInputs.directives,
    foreshadow: planInputs.foreshadow,
    legendId: context.evidence.legendId,
    replayId: context.evidence.replayId,
    proofHash: context.evidence.proofHash,
  });
}

function buildBeats(
  context: PostRunNarrativeContext,
  options: Required<Omit<PostRunNarrativeEngineOptions, 'turningPointResolver' | 'turningPointResolverOptions' | 'foreshadowPlanner' | 'foreshadowPlannerOptions'>>,
  tone: ChatPostRunTone,
  visibility: ChatPostRunVisibilityMode,
  dominantChannel: ChatVisibleChannel,
  turningPoint: ChatTurningPoint | null,
  witnesses: readonly ChatPostRunWitness[],
  blameVectors: readonly ChatPostRunBlameVector[],
  directives: readonly ChatPostRunDirective[],
  foreshadow: readonly ChatPostRunForeshadow[],
  summaryCard: ChatPostRunSummaryCard,
): readonly ChatPostRunBeat[] {
  const primaryBlame = choosePrimaryBlameVector(blameVectors);
  const beats: ChatPostRunBeat[] = [
    buildDefaultPostRunBeat({
      beatId: (`postrun:beat:verdict:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
      kind: 'SYSTEM_VERDICT',
      actorRole: 'SYSTEM',
      tone,
      line: summaryCard.subtitle,
      summary: summaryCard.title,
      visibleChannel: visibility === 'CHANNEL' || visibility === 'MULTI_CHANNEL' ? dominantChannel : null,
      visibility,
      delayMs: options.verdictDelayMs,
      replayId: context.evidence.replayId,
      proofHash: context.evidence.proofHash,
      legendId: context.evidence.legendId,
      turningPointId: turningPoint?.turningPointId,
      sourceMomentIds: turningPoint?.compactMoment ? [turningPoint.compactMoment.momentId] : [],
      tags: Object.freeze(['postrun', 'verdict']),
    }),
  ];

  for (const witness of witnesses) {
    beats.push(buildDefaultPostRunBeat({
      beatId: (`postrun:beat:witness:${context.postRunId}:${witness.witnessId}` as unknown) as ChatPostRunBeat['beatId'],
      kind:
        witness.actorRole === 'HELPER'
          ? 'HELPER_EPITAPH'
          : witness.actorRole === 'RIVAL'
            ? 'RIVAL_MOCKERY'
            : 'WITNESS_LINE',
      actorRole: witness.actorRole,
      tone,
      line: witness.line,
      visibleChannel: visibility === 'CHANNEL' || visibility === 'MULTI_CHANNEL' ? (witness.visibleChannel ?? dominantChannel) : null,
      visibility,
      delayMs: witness.timingMs,
      proofHash: witness.proofHash,
      sourceMomentIds: turningPoint?.compactMoment ? [turningPoint.compactMoment.momentId] : [],
      tags: compact<string>(['postrun', 'witness', ...((witness.tags ?? []) as string[])]),
    }));
  }

  beats.push(buildDefaultPostRunBeat({
    beatId: (`postrun:beat:turning:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
    kind: 'TURNING_POINT_CARD',
    actorRole: 'NARRATOR',
    tone,
    line: summarizeTurningPoint(turningPoint ?? undefined),
    summary: turningPoint?.label,
    visibleChannel: visibility === 'CHANNEL' || visibility === 'MULTI_CHANNEL' ? dominantChannel : null,
    visibility,
    delayMs: options.summaryDelayMs - 400,
    turningPointId: turningPoint?.turningPointId,
    replayId: context.evidence.replayId,
    proofHash: context.evidence.proofHash,
    sourceMomentIds: turningPoint?.compactMoment ? [turningPoint.compactMoment.momentId] : [],
    tags: Object.freeze(['postrun', 'turning_point']),
  }));

  beats.push(buildDefaultPostRunBeat({
    beatId: (`postrun:beat:blame:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
    kind: 'BLAME_CARD',
    actorRole: 'SYSTEM',
    tone,
    line: summarizePrimaryBlame(blameVectors),
    summary: primaryBlame?.label,
    visibleChannel: visibility === 'CHANNEL' || visibility === 'MULTI_CHANNEL' ? dominantChannel : null,
    visibility,
    delayMs: options.summaryDelayMs - 150,
    blameId: primaryBlame?.blameId,
    sourceMomentIds: turningPoint?.compactMoment ? [turningPoint.compactMoment.momentId] : [],
    tags: Object.freeze(['postrun', 'blame']),
  }));

  if (options.includeDirectiveBeat) {
    const primaryDirective = directives[0];
    if (primaryDirective) {
      beats.push(buildDefaultPostRunBeat({
        beatId: (`postrun:beat:directive:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
        kind: 'DIRECTIVE_CARD',
        actorRole: 'NARRATOR',
        tone,
        line: primaryDirective.explanation,
        summary: primaryDirective.label,
        visibleChannel: visibility === 'CHANNEL' || visibility === 'MULTI_CHANNEL' ? dominantChannel : null,
        visibility,
        delayMs: options.directiveDelayMs,
        sourceMomentIds: primaryDirective.sourceMomentIds,
        tags: Object.freeze(['postrun', 'directive', primaryDirective.kind.toLowerCase()]),
      }));
    }
  }

  if (options.includeSummaryBeat) {
    beats.push(buildDefaultPostRunBeat({
      beatId: (`postrun:beat:summary:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
      kind: 'SUMMARY_CARD',
      actorRole: 'NARRATOR',
      tone,
      line: summaryCard.body,
      summary: summaryCard.subtitle,
      visibleChannel: visibility === 'CHANNEL' || visibility === 'MULTI_CHANNEL' ? dominantChannel : null,
      visibility,
      delayMs: options.summaryDelayMs,
      replayId: context.evidence.replayId,
      proofHash: context.evidence.proofHash,
      legendId: context.evidence.legendId,
      sourceMomentIds: turningPoint?.compactMoment ? [turningPoint.compactMoment.momentId] : [],
      tags: Object.freeze(['postrun', 'summary']),
    }));
  }

  if (options.includeForeshadowBeat) {
    const primaryForeshadow = foreshadow[0];
    if (primaryForeshadow) {
      beats.push(buildDefaultPostRunBeat({
        beatId: (`postrun:beat:foreshadow:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
        kind: 'FORESHADOW_LINE',
        actorRole: 'NARRATOR',
        tone,
        line: primaryForeshadow.line,
        summary: primaryForeshadow.label,
        visibleChannel: visibility === 'CHANNEL' || visibility === 'MULTI_CHANNEL' ? dominantChannel : null,
        visibility,
        delayMs: options.foreshadowDelayMs,
        foreshadowId: primaryForeshadow.foreshadowId,
        tags: Object.freeze(['postrun', 'foreshadow', primaryForeshadow.kind.toLowerCase()]),
      }));
    }
  }

  if (options.includeSilenceBeat) {
    beats.push(buildDefaultPostRunBeat({
      beatId: (`postrun:beat:silence:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
      kind: 'SILENCE',
      actorRole: 'SYSTEM',
      tone,
      visibleChannel: visibility === 'CHANNEL' || visibility === 'MULTI_CHANNEL' ? dominantChannel : null,
      visibility,
      delayMs: options.foreshadowDelayMs + 450,
      durationMs: options.silenceDurationMs,
      sourceMomentIds: turningPoint?.compactMoment ? [turningPoint.compactMoment.momentId] : [],
      tags: Object.freeze(['postrun', 'silence']),
    }));
  }

  return sortPostRunBeats(beats);
}

// ============================================================================
// MARK: Engine implementation
// ============================================================================

export class PostRunNarrativeEngine {
  private readonly options: Required<Omit<PostRunNarrativeEngineOptions, 'turningPointResolver' | 'turningPointResolverOptions' | 'foreshadowPlanner' | 'foreshadowPlannerOptions'>>;
  private readonly turningPointResolver: TurningPointResolver;
  private readonly foreshadowPlanner: ForeshadowPlanner;
  private readonly byRoom = new Map<ChatRoomId, PostRunNarrativeEvaluation>();

  public constructor(options: PostRunNarrativeEngineOptions = {}) {
    this.options = Object.freeze({
      ...DEFAULT_OPTIONS,
      ...options,
    });
    this.turningPointResolver =
      options.turningPointResolver ??
      createTurningPointResolver(options.turningPointResolverOptions ?? {});
    this.foreshadowPlanner =
      options.foreshadowPlanner ??
      createForeshadowPlanner(options.foreshadowPlannerOptions ?? {});
  }

  public evaluate(context: PostRunNarrativeContext): PostRunNarrativeEvaluation {
    const turningPointResolution = this.turningPointResolver.resolve({
      roomId: context.roomId,
      evidence: context.evidence,
      moments: context.moments,
      turningPointCandidates: context.turningPointCandidates,
      previousTurningPoint: context.previousPlan?.turningPoint,
      previousPlanId: context.previousPlan?.postRunId,
      preferredNpcIds: context.relatedNpcIds as TurningPointResolverContext['preferredNpcIds'],
      preferredVisibleChannels: context.preferredVisibleChannel ? [context.preferredVisibleChannel] : undefined,
      preferredMessageIds: context.evidence.relatedMessageIds,
    });

    const primaryTurningPoint = turningPointResolution.primary;
    const visibility = chooseNarrativeVisibility(context.evidence, primaryTurningPoint, context.preferredVisibleChannel);
    const dominantChannel = primaryTurningPoint?.compactMoment?.visibleChannel
      ?? deriveDominantVisibleChannel(context.previousPlan?.beats ?? [])
      ?? context.preferredVisibleChannel
      ?? this.options.defaultVisibleChannel;

    const tone = derivePostRunTone({
      outcome: context.evidence.runOutcome,
      affect: context.evidence.affect,
      reputation: context.evidence.reputation,
    });

    const foreshadowPlan = this.foreshadowPlanner.plan({
      roomId: context.roomId,
      evidence: context.evidence,
      turningPoint: primaryTurningPoint,
      blameVectors: context.blameVectors,
      moments: context.moments,
      existingForeshadow: context.foreshadow,
      existingDirectives: context.directives,
      preferredVisibleChannel: dominantChannel,
      relatedNpcIds: context.relatedNpcIds as ForeshadowPlanningContext['relatedNpcIds'],
    });

    const blameVectors = buildBlameVectors(context, primaryTurningPoint);
    const witnesses = buildWitnesses(context, this.options, primaryTurningPoint, foreshadowPlan, visibility, dominantChannel);

    const shouldAnchorMemory = shouldAnchorPostRunMemory({
      turningPoint: primaryTurningPoint ?? undefined,
      blameVectors,
      foreshadow: foreshadowPlan.foreshadow,
      outcome: context.evidence.runOutcome,
    });
    const legendEscalationEligible = shouldEscalatePostRunToLegend({
      turningPoint: primaryTurningPoint ?? undefined,
      outcome: context.evidence.runOutcome,
      replayId: context.evidence.replayId,
      proofHash: context.evidence.proofHash,
    });

    const summaryCard = buildSummaryCard(context, {
      tone,
      visibility,
      turningPoint: primaryTurningPoint,
      blameVectors,
      directives: foreshadowPlan.directives,
      foreshadow: foreshadowPlan.foreshadow,
      legendEscalationEligible,
      shouldAnchorMemory,
    });

    const beats = buildBeats(
      context,
      this.options,
      tone,
      visibility,
      dominantChannel,
      primaryTurningPoint,
      witnesses,
      blameVectors,
      foreshadowPlan.directives,
      foreshadowPlan.foreshadow,
      summaryCard,
    );

    const basePlan = buildMinimalPostRunPlan({
      postRunId: context.postRunId,
      bundleId: context.bundleId,
      roomId: context.roomId,
      kind: context.kind,
      evidence: context.evidence,
      turningPointCandidates: turningPointResolution.candidates,
      moments: context.moments,
      witnesses,
      blameVectors,
      directives: foreshadowPlan.directives,
      foreshadow: foreshadowPlan.foreshadow,
      beats,
      createdAt: context.createdAt,
      payload: context.payload,
    });

    const normalizedPlan = normalizePostRunPlan({
      ...basePlan,
      stage: this.options.settleImmediately ? 'SETTLED' : basePlan.stage,
      class: derivePostRunClass(context.evidence.runOutcome, visibility, tone),
      tone,
      visibility,
      turningPoint: primaryTurningPoint ?? undefined,
      summaryCard,
      witnesses,
      beats,
      blameVectors,
      directives: foreshadowPlan.directives,
      foreshadow: foreshadowPlan.foreshadow,
      threads: [projectPostRunThread({ beats, witnesses, visibility })],
      legendEscalationEligible,
      replayRecommended: postRunPlanSupportsReplay(basePlan),
      shouldAnchorMemory,
      shouldPersistShadowArchive: visibility === 'SHADOW_ONLY' || shouldAnchorMemory,
      authoredAt: nowMs(),
      settledAt: this.options.settleImmediately ? nowMs() : undefined,
    });

    const receipt = createPostRunReceipt({
      receiptId: (`postrun:receipt:${context.postRunId}` as unknown) as ChatPostRunPlan['receipt']['receiptId'],
      createdAt: nowMs(),
      visibility: normalizedPlan.visibility,
      deliveredChannels: collectPostRunChannels(normalizedPlan.beats),
      beatIds: normalizedPlan.beats.map((beat) => beat.beatId),
      messageIds: context.evidence.relatedMessageIds,
      replayId: normalizedPlan.evidence.replayId,
      proofHash: normalizedPlan.evidence.proofHash,
      legendId: normalizedPlan.evidence.legendId,
    });

    const plan: ChatPostRunPlan = normalizePostRunPlan({
      ...normalizedPlan,
      receipt,
    });

    const runtimeState: ChatPostRunRuntimeState = Object.freeze({
      ...createEmptyPostRunRuntimeState(plan.postRunId, plan.stage),
      deliveredBeatIds: plan.receipt?.beatIds ?? [],
      deliveredChannels: plan.receipt?.deliveredChannels ?? [],
      openedAt: plan.window.opensAt,
      completedAt: this.options.settleImmediately ? nowMs() : undefined,
    });

    const archiveEntry = buildPostRunArchiveEntry({
      archiveId: (`postrun:archive:${context.postRunId}` as unknown) as ChatPostRunArchiveEntry['archiveId'],
      plan,
      archivedAt: nowMs(),
    });
    const digest = buildPostRunDigest(plan);
    const ledgerEntry = derivePostRunLedgerEntry({
      ledgerId: (`postrun:ledger:${context.postRunId}` as unknown) as ChatPostRunLedgerEntry['ledgerId'],
      plan,
      archiveEntry,
      runtimeState,
      recordedAt: nowMs(),
    });

    const evaluation: PostRunNarrativeEvaluation = Object.freeze({
      roomId: context.roomId,
      evaluatedAt: nowMs(),
      plan,
      archiveEntry,
      digest,
      ledgerEntry,
      runtimeState,
      dominantChannel,
      dominantTone: tone,
      summaryClass: deriveSummaryClass({
        kind: plan.kind,
        tone,
        visibility,
        replayRecommended: plan.replayRecommended,
        legendEscalationEligible: plan.legendEscalationEligible,
      }),
      primaryTurningPoint,
      primaryBlame: choosePrimaryBlameVector(blameVectors),
      publicBroadcastRecommended: shouldBroadcastPostRunPublicly(plan),
      replayPersistenceRecommended: postRunPlanSupportsReplay(plan),
      worldEchoRecommended: postRunPlanSupportsWorldEcho(plan),
      turningPointResolution,
      foreshadowPlan,
      reasoning: Object.freeze({
        turningPointReason: turningPointResolution.reasoning.topReasons.join('|') || 'turning_point_unresolved',
        blameReason: summarizePrimaryBlame(blameVectors) ?? 'no_blame_vector',
        witnessReason: `witness_count:${witnesses.length}|stance:${derivePrimaryWitnessStance(witnesses) ?? 'NONE'}`,
        beatReason: `beat_count:${plan.beats.length}|beat_classes:${JSON.stringify(countPostRunBeatsByKind(plan.beats))}`,
        visibilityReason: `visibility:${visibility}|dominant_channel:${dominantChannel}`,
      }),
    });

    this.byRoom.set(context.roomId, evaluation);
    return evaluation;
  }

  public getLastEvaluation(roomId: ChatRoomId): PostRunNarrativeEvaluation | null {
    return this.byRoom.get(roomId) ?? null;
  }

  public clear(roomId?: ChatRoomId): void {
    if (roomId) {
      this.byRoom.delete(roomId);
      return;
    }
    this.byRoom.clear();
  }

  public getSnapshot(): PostRunNarrativeEngineSnapshot {
    return Object.freeze({
      updatedAt: nowMs(),
      byRoom: Object.freeze(Object.fromEntries(this.byRoom.entries())) as Readonly<Record<ChatRoomId, PostRunNarrativeEvaluation>>,
    });
  }

  public restore(snapshot: PostRunNarrativeEngineSnapshot): void {
    this.byRoom.clear();
    for (const [roomId, evaluation] of Object.entries(snapshot.byRoom) as [ChatRoomId, PostRunNarrativeEvaluation][]) {
      this.byRoom.set(roomId, evaluation);
    }
  }
}

export function createPostRunNarrativeEngine(options: PostRunNarrativeEngineOptions = {}): PostRunNarrativeEngine {
  return new PostRunNarrativeEngine(options);
}

export const ChatPostRunNarrativeEngineModule = Object.freeze({
  PostRunNarrativeEngine,
  createPostRunNarrativeEngine,
} as const);
