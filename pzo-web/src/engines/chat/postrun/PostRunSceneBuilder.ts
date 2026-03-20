/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT POST-RUN SCENE BUILDER
 * FILE: pzo-web/src/engines/chat/postrun/PostRunSceneBuilder.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Converts post-run summary policy output into a runtime-ready scene draft for
 * the pzo-web chat engine.
 *
 * This is where the post-run ritual becomes playable frontend structure:
 * - transcript staging,
 * - message pacing,
 * - card sequencing,
 * - timing windows,
 * - witness thread projection,
 * - replay / proof affordances,
 * - continuity carryover hints,
 * - and rescue-after-collapse routing.
 *
 * Design doctrine
 * ---------------
 * 1. Post-run is a scene, not a footer.
 * 2. The builder must preserve authored silence and not collapse it away.
 * 3. Transcript drafts are optimistic and inspectable.
 * 4. UI cards, message beats, and continuity hooks all derive from one plan.
 * 5. The output should feed ChatEngine / reducer lanes without assuming backend
 *    has already replied.
 *
 * Canonical authorities
 * ---------------------
 * - /shared/contracts/chat/ChatPostRun.ts
 * - /pzo-web/src/engines/chat/postrun/PostRunSummaryPolicy.ts
 * - /pzo-web/src/engines/chat/ChatEventBridge.ts
 * - /pzo-web/src/engines/chat/ChatTranscriptBuffer.ts
 * - /pzo-web/src/engines/chat/continuity/CrossModeContinuity.ts
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatMessageId,
  ChatRoomId,
  ChatVisibleChannel,
  ChatWorldEventId,
  JsonObject,
  UnixMs,
} from '../../../../../shared/contracts/chat/ChatChannels';
import {
  buildPostRunDigest,
  collectPostRunChannels,
  countPostRunBeatsByKind,
  createEmptyPostRunRuntimeState,
  deriveDominantVisibleChannel,
  derivePrimaryWitnessStance,
  postRunPlanSupportsReplay,
  postRunPlanSupportsWorldEcho,
  sortPostRunBeats,
  summarizePostRunPlan,
  type ChatPostRunBeat,
  type ChatPostRunDigest,
  type ChatPostRunPlan,
  type ChatPostRunRuntimeState,
  type ChatPostRunSummaryCard,
  type ChatPostRunVisibilityMode,
  type ChatPostRunWitness,
} from '../../../../../shared/contracts/chat/ChatPostRun';
import {
  createPostRunSummaryPolicy,
  type PostRunSummaryPolicy,
  type PostRunSummaryPolicyContext,
  type PostRunSummaryPolicyEvaluation,
  type PostRunSummaryPolicyOptions,
} from './PostRunSummaryPolicy';

// ============================================================================
// MARK: Scene-builder contracts
// ============================================================================

export interface PostRunSceneBuilderOptions {
  readonly defaultChannel?: ChatVisibleChannel;
  readonly transcriptBaseDelayMs?: number;
  readonly silencePlaceholder?: string;
  readonly summaryPolicy?: PostRunSummaryPolicy;
  readonly summaryPolicyOptions?: PostRunSummaryPolicyOptions;
  readonly keepInvisibleBeatsInLedger?: boolean;
  readonly collapsePrivateToDefaultChannel?: boolean;
  readonly maxCards?: number;
}

export interface PostRunSceneBuilderContext {
  readonly policyContext: PostRunSummaryPolicyContext;
  readonly evaluation?: PostRunSummaryPolicyEvaluation;
  readonly mountSurface?: string;
  readonly roomId?: ChatRoomId;
  readonly suppressTranscriptDraft?: boolean;
  readonly conversationCursor?: string;
  readonly activeWorldEventIds?: readonly ChatWorldEventId[];
}

export interface PostRunTranscriptDraftMessage {
  readonly draftMessageId: ChatMessageId;
  readonly postRunId: ChatPostRunPlan['postRunId'];
  readonly beatId: ChatPostRunBeat['beatId'];
  readonly kind: ChatPostRunBeat['kind'];
  readonly actorRole: ChatPostRunBeat['actorRole'];
  readonly body: string;
  readonly summary?: string;
  readonly channel?: ChatVisibleChannel;
  readonly visibility: ChatPostRunVisibilityMode;
  readonly appearsAt: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly priority: number;
  readonly silence: boolean;
  readonly proofHash?: ChatPostRunBeat['proofHash'];
  readonly replayId?: ChatPostRunBeat['replayId'];
  readonly legendId?: ChatPostRunBeat['legendId'];
  readonly tags: readonly string[];
  readonly payload?: JsonObject;
}

export interface PostRunSceneCardDraft {
  readonly cardId: string;
  readonly beatId?: ChatPostRunBeat['beatId'];
  readonly cardType:
    | 'SUMMARY'
    | 'TURNING_POINT'
    | 'BLAME'
    | 'DIRECTIVE'
    | 'FORESHADOW'
    | 'LEGEND'
    | 'WITNESS'
    | 'DIGEST';
  readonly title: string;
  readonly subtitle?: string;
  readonly body: string;
  readonly channel?: ChatVisibleChannel;
  readonly weight: number;
  readonly tags: readonly string[];
}

export interface PostRunContinuityCarryover {
  readonly postRunId: ChatPostRunPlan['postRunId'];
  readonly carryoverOpen: boolean;
  readonly rescueCarryoverOpen: boolean;
  readonly dominantChannel?: ChatVisibleChannel;
  readonly dominantWitnessStance?: ReturnType<typeof derivePrimaryWitnessStance>;
  readonly replayShouldFollowPlayer: boolean;
  readonly worldEchoPending: boolean;
  readonly nextDirectiveLabel?: string;
  readonly nextForeshadowLabel?: string;
}

export interface PostRunSceneDraft {
  readonly plan: ChatPostRunPlan;
  readonly digest: ChatPostRunDigest;
  readonly runtimeState: ChatPostRunRuntimeState;
  readonly transcript: readonly PostRunTranscriptDraftMessage[];
  readonly cards: readonly PostRunSceneCardDraft[];
  readonly continuity: PostRunContinuityCarryover;
  readonly visibleChannels: readonly ChatVisibleChannel[];
  readonly dominantChannel?: ChatVisibleChannel;
  readonly openedAt: UnixMs;
  readonly closesAt?: UnixMs;
  readonly summary: Record<string, unknown>;
}

export interface PostRunSceneBuilderSnapshot {
  readonly updatedAt: UnixMs;
  readonly lastDraft: PostRunSceneDraft;
}

const DEFAULT_OPTIONS: Required<Omit<PostRunSceneBuilderOptions, 'summaryPolicy' | 'summaryPolicyOptions'>> = Object.freeze({
  defaultChannel: 'GLOBAL',
  transcriptBaseDelayMs: 250,
  silencePlaceholder: '…',
  keepInvisibleBeatsInLedger: true,
  collapsePrivateToDefaultChannel: false,
  maxCards: 8,
});

// ============================================================================
// MARK: Utility helpers
// ============================================================================

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

function compact<TValue>(values: readonly (TValue | null | undefined | false)[]): TValue[] {
  return values.filter(Boolean) as TValue[];
}

function pickMessageBody(
  beat: ChatPostRunBeat,
  silencePlaceholder: string,
): string {
  if (beat.kind === 'SILENCE') {
    return silencePlaceholder;
  }
  return beat.line ?? beat.summary ?? '';
}

function resolveMessageChannel(
  beat: ChatPostRunBeat,
  plan: ChatPostRunPlan,
  defaultChannel: ChatVisibleChannel,
  collapsePrivateToDefaultChannel: boolean,
): ChatVisibleChannel | undefined {
  if (beat.visibleChannel) return beat.visibleChannel;
  if (plan.visibility === 'PRIVATE' || plan.visibility === 'SHADOW_ONLY') {
    return collapsePrivateToDefaultChannel ? defaultChannel : undefined;
  }
  return deriveDominantVisibleChannel(plan.beats) ?? defaultChannel;
}

function buildTranscriptDraft(
  plan: ChatPostRunPlan,
  options: Required<Omit<PostRunSceneBuilderOptions, 'summaryPolicy' | 'summaryPolicyOptions'>>,
): readonly PostRunTranscriptDraftMessage[] {
  const ordered = sortPostRunBeats(plan.beats);
  const openedAt = plan.window.opensAt as unknown as number;

  return ordered.map((beat, index) => {
    const appearsAt = (openedAt + options.transcriptBaseDelayMs + beat.delayMs + index * 35) as UnixMs;
    const expiresAt =
      typeof beat.durationMs === 'number'
        ? ((openedAt + options.transcriptBaseDelayMs + beat.delayMs + beat.durationMs) as UnixMs)
        : undefined;

    return {
      draftMessageId: (`${plan.postRunId}:draft:${beat.beatId}` as unknown) as ChatMessageId,
      postRunId: plan.postRunId,
      beatId: beat.beatId,
      kind: beat.kind,
      actorRole: beat.actorRole,
      body: pickMessageBody(beat, options.silencePlaceholder),
      summary: beat.summary,
      channel: resolveMessageChannel(
        beat,
        plan,
        options.defaultChannel,
        options.collapsePrivateToDefaultChannel,
      ),
      visibility: beat.visibility,
      appearsAt,
      expiresAt,
      priority: beat.priority,
      silence: beat.kind === 'SILENCE',
      proofHash: beat.proofHash,
      replayId: beat.replayId,
      legendId: beat.legendId,
      tags: compact<string>(['postrun', beat.kind.toLowerCase(), ...(beat.tags ?? [])]),
      payload: beat.payload,
    };
  });
}

function buildCards(
  plan: ChatPostRunPlan,
  digest: ChatPostRunDigest,
  maxCards: number,
): readonly PostRunSceneCardDraft[] {
  const primaryBlame = plan.blameVectors[0];
  const primaryDirective = plan.directives[0];
  const primaryForeshadow = plan.foreshadow[0];
  const dominantChannel = deriveDominantVisibleChannel(plan.beats);

  const cards = compact<PostRunSceneCardDraft>([
    {
      cardId: `${plan.postRunId}:card:summary`,
      cardType: 'SUMMARY',
      title: plan.summaryCard.title,
      subtitle: plan.summaryCard.subtitle,
      body: plan.summaryCard.body,
      channel: dominantChannel,
      weight: 100,
      tags: compact<string>(['postrun', 'summary', ...(plan.summaryCard.tags ?? [])]),
    },
    plan.turningPoint
      ? {
          cardId: `${plan.postRunId}:card:turning-point`,
          cardType: 'TURNING_POINT',
          title: plan.turningPoint.label,
          subtitle: plan.turningPoint.kind,
          body: plan.turningPoint.explanation,
          channel: dominantChannel,
          weight: 92,
          tags: compact<string>(['postrun', 'turning-point', ...(plan.turningPoint.tags ?? [])]),
        }
      : null,
    primaryBlame
      ? {
          cardId: `${plan.postRunId}:card:blame`,
          cardType: 'BLAME',
          title: primaryBlame.label,
          subtitle: primaryBlame.kind,
          body: primaryBlame.explanation,
          channel: dominantChannel,
          weight: 84,
          tags: compact<string>(['postrun', 'blame', ...(primaryBlame.tags ?? [])]),
        }
      : null,
    primaryDirective
      ? {
          cardId: `${plan.postRunId}:card:directive`,
          cardType: 'DIRECTIVE',
          title: primaryDirective.label,
          subtitle: primaryDirective.kind,
          body: primaryDirective.explanation,
          channel: dominantChannel,
          weight: 82,
          tags: compact<string>(['postrun', 'directive', ...(primaryDirective.tags ?? [])]),
        }
      : null,
    primaryForeshadow
      ? {
          cardId: `${plan.postRunId}:card:foreshadow`,
          cardType: 'FORESHADOW',
          title: primaryForeshadow.label,
          subtitle: primaryForeshadow.kind,
          body: primaryForeshadow.line,
          channel: dominantChannel,
          weight: 78,
          tags: compact<string>(['postrun', 'foreshadow', ...(primaryForeshadow.tags ?? [])]),
        }
      : null,
    plan.summaryCard.legendId
      ? {
          cardId: `${plan.postRunId}:card:legend`,
          cardType: 'LEGEND',
          title: 'Legend lock pending',
          subtitle: plan.summaryCard.legendId,
          body: 'This ending has enough weight to return later with witnesses.',
          channel: dominantChannel,
          weight: 76,
          tags: ['postrun', 'legend'],
        }
      : null,
    plan.witnesses[0]
      ? {
          cardId: `${plan.postRunId}:card:witness`,
          cardType: 'WITNESS',
          title: plan.witnesses[0].displayName,
          subtitle: plan.witnesses[0].stance,
          body: plan.witnesses[0].line,
          channel: plan.witnesses[0].visibleChannel ?? dominantChannel,
          weight: 70,
          tags: compact<string>(['postrun', 'witness', ...(plan.witnesses[0].tags ?? [])]),
        }
      : null,
    {
      cardId: `${plan.postRunId}:card:digest`,
      cardType: 'DIGEST',
      title: 'Post-run digest',
      subtitle: digest.turningPointLabel ?? 'No dominant turn named',
      body: compact<string>([
        digest.primaryBlameLabel ? `Blame: ${digest.primaryBlameLabel}.` : undefined,
        digest.primaryDirectiveLabel ? `Directive: ${digest.primaryDirectiveLabel}.` : undefined,
        digest.primaryForeshadowLabel ? `Foreshadow: ${digest.primaryForeshadowLabel}.` : undefined,
      ]).join(' '),
      channel: dominantChannel,
      weight: 64,
      tags: ['postrun', 'digest'],
    },
  ]);

  return cards
    .sort((left, right) => right.weight - left.weight)
    .slice(0, maxCards);
}

function buildContinuityCarryover(plan: ChatPostRunPlan): PostRunContinuityCarryover {
  const dominantChannel = deriveDominantVisibleChannel(plan.beats);
  const dominantWitnessStance = derivePrimaryWitnessStance(plan.witnesses);
  return {
    postRunId: plan.postRunId,
    carryoverOpen: Boolean(plan.window.closesAt),
    rescueCarryoverOpen: plan.window.rescueCarryoverOpen,
    dominantChannel,
    dominantWitnessStance,
    replayShouldFollowPlayer: postRunPlanSupportsReplay({
      visibility: plan.visibility,
      summaryCard: plan.summaryCard,
      evidence: plan.evidence,
    }),
    worldEchoPending: postRunPlanSupportsWorldEcho({
      evidence: plan.evidence,
      foreshadow: plan.foreshadow,
    }),
    nextDirectiveLabel: plan.directives[0]?.label,
    nextForeshadowLabel: plan.foreshadow[0]?.label,
  };
}

function buildRuntimeState(
  plan: ChatPostRunPlan,
  transcript: readonly PostRunTranscriptDraftMessage[],
): ChatPostRunRuntimeState {
  const initial = createEmptyPostRunRuntimeState(plan.postRunId);
  const hiddenBeatIds = plan.visibility === 'SHADOW_ONLY'
    ? plan.beats.map((beat) => beat.beatId)
    : plan.beats.filter((beat) => !beat.visibleChannel && beat.visibility === 'PRIVATE').map((beat) => beat.beatId);

  return {
    ...initial,
    stage: 'QUEUED',
    deliveredChannels: collectPostRunChannels(plan),
    hiddenBeatIds,
    openedAt: plan.window.opensAt,
    completedAt: transcript.length === 0 ? plan.window.opensAt : undefined,
  };
}

// ============================================================================
// MARK: Scene builder class
// ============================================================================

export class PostRunSceneBuilder {
  private readonly options: Required<Omit<PostRunSceneBuilderOptions, 'summaryPolicy' | 'summaryPolicyOptions'>>;
  private readonly summaryPolicy: PostRunSummaryPolicy;
  private snapshot: PostRunSceneBuilderSnapshot | null = null;

  public constructor(options: PostRunSceneBuilderOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
    this.summaryPolicy =
      options.summaryPolicy ??
      createPostRunSummaryPolicy(options.summaryPolicyOptions ?? {});
  }

  public build(context: PostRunSceneBuilderContext): PostRunSceneDraft {
    const evaluation = context.evaluation ?? this.summaryPolicy.evaluate(context.policyContext);
    const plan = evaluation.plan;
    const digest = evaluation.digest ?? buildPostRunDigest(plan);
    const transcript = context.suppressTranscriptDraft ? [] : buildTranscriptDraft(plan, this.options);
    const runtimeState = buildRuntimeState(plan, transcript);
    const cards = buildCards(plan, digest, this.options.maxCards);
    const continuity = buildContinuityCarryover(plan);

    const draft: PostRunSceneDraft = {
      plan,
      digest,
      runtimeState,
      transcript,
      cards,
      continuity,
      visibleChannels: collectPostRunChannels(plan),
      dominantChannel: deriveDominantVisibleChannel(plan.beats),
      openedAt: plan.window.opensAt,
      closesAt: plan.window.closesAt,
      summary: summarizePostRunPlan(plan),
    };

    this.snapshot = {
      updatedAt: nowMs(),
      lastDraft: draft,
    };

    return draft;
  }

  public advanceRuntime(
    draft: PostRunSceneDraft,
    now: UnixMs = nowMs(),
  ): ChatPostRunRuntimeState {
    const deliveredBeatIds = draft.transcript
      .filter((message) => (message.appearsAt as unknown as number) <= (now as unknown as number))
      .map((message) => message.beatId);

    const completedAt =
      draft.transcript.length > 0 &&
      draft.transcript.every((message) => (message.appearsAt as unknown as number) <= (now as unknown as number))
        ? now
        : undefined;

    return {
      ...draft.runtimeState,
      stage: completedAt ? 'SETTLED' : 'ACTIVE',
      deliveredBeatIds,
      deliveredChannels: draft.visibleChannels,
      activeBeatId: draft.transcript.find(
        (message) => (message.appearsAt as unknown as number) > (now as unknown as number),
      )?.beatId,
      completedAt,
    };
  }

  public acknowledgeBeat(
    runtime: ChatPostRunRuntimeState,
    beatId: ChatPostRunBeat['beatId'],
  ): ChatPostRunRuntimeState {
    if (runtime.acknowledgedBeatIds.includes(beatId)) return runtime;
    return {
      ...runtime,
      acknowledgedBeatIds: [...runtime.acknowledgedBeatIds, beatId],
    };
  }

  public getSnapshot(): PostRunSceneBuilderSnapshot {
    if (!this.snapshot) {
      throw new Error('PostRunSceneBuilder has no snapshot yet. Call build() first.');
    }
    return this.snapshot;
  }

  public clearSnapshot(): void {
    this.snapshot = null;
  }
}

// ============================================================================
// MARK: Convenience exports
// ============================================================================

export function createPostRunSceneBuilder(
  options: PostRunSceneBuilderOptions = {},
): PostRunSceneBuilder {
  return new PostRunSceneBuilder(options);
}

export function buildPostRunSceneDraft(
  context: PostRunSceneBuilderContext,
  options: PostRunSceneBuilderOptions = {},
): PostRunSceneDraft {
  return new PostRunSceneBuilder(options).build(context);
}
