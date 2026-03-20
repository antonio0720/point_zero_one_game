/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT POST-RUN SUMMARY POLICY
 * FILE: pzo-web/src/engines/chat/postrun/PostRunSummaryPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend deterministic policy layer for post-run ritual authoring.
 *
 * This file does not replace backend post-run sovereignty. It stages a deeply
 * authored, inspectable, repo-faithful post-run plan in the pzo-web lane so the
 * chat shell can react immediately when a run closes.
 *
 * It is responsible for turning end-of-run evidence into a policy-grade plan
 * that can:
 * - mourn,
 * - mock,
 * - debrief,
 * - celebrate,
 * - interpret,
 * - foreshadow,
 * - assign blame,
 * - and name the turning point.
 *
 * Design doctrine
 * ---------------
 * 1. Frontend may stage, backend remains authoritative.
 * 2. Every post-run plan must be explainable.
 * 3. The policy must preserve existing channel law, dramatic law, and shared
 *    contract law.
 * 4. The output must be stable enough for transcript preview, replay affordance,
 *    rescue carryover, continuity carryover, and future callback anchoring.
 * 5. Post-run is not a scoreboard footer. It is ritual runtime.
 *
 * Canonical authorities
 * ---------------------
 * - /shared/contracts/chat/ChatPostRun.ts
 * - /shared/contracts/chat/ChatMoment.ts
 * - /pzo-web/src/engines/chat/ChatBotResponseDirector.ts
 * - /pzo-web/src/engines/chat/postrun/PostRunSceneBuilder.ts
 * - /backend/src/game/engine/chat/postrun
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatMessageId,
  ChatNpcId,
  ChatRoomId,
  ChatSceneId,
  ChatVisibleChannel,
  UnixMs,
} from '../../../../../shared/contracts/chat/ChatChannels';
import type { ChatMoment } from '../../../../../shared/contracts/chat/ChatMoment';
import {
  buildDefaultBlameVector,
  buildDefaultDirective,
  buildDefaultForeshadow,
  buildDefaultPostRunBeat,
  buildDefaultPostRunWitness,
  buildMinimalPostRunPlan,
  buildPostRunArchiveEntry,
  buildPostRunDigest,
  buildPostRunSummaryCard,
  choosePrimaryBlameVector,
  choosePrimaryDirective,
  choosePrimaryForeshadow,
  choosePrimaryTurningPoint,
  collectPostRunChannels,
  countPostRunBeatsByKind,
  deriveDominantVisibleChannel,
  derivePostRunArchivePolicy,
  derivePostRunClass,
  derivePostRunClosureBand,
  derivePostRunLedgerEntry,
  derivePostRunTone,
  derivePostRunVisibility,
  derivePostRunWindow,
  deriveSummaryClass,
  derivePrimaryWitnessStance,
  inferDirectiveKind,
  normalizePostRunPlan,
  projectPostRunThread,
  scoreBlameVector,
  scoreDirective,
  scoreForeshadow,
  scoreTurningPointCandidate,
  shouldAnchorPostRunMemory,
  shouldBroadcastPostRunPublicly,
  shouldEscalatePostRunToLegend,
  shouldPersistPostRunReplay,
  sortBlameVectors,
  sortPostRunBeats,
  sortPostRunDirectives,
  sortPostRunForeshadow,
  sortTurningPointCandidates,
  summarizePostRunPlan,
  summarizePrimaryBlame,
  summarizePrimaryDirective,
  summarizePrimaryForeshadow,
  summarizeTurningPoint,
  toPostRunScore01,
  type ChatPostRunArchiveEntry,
  type ChatPostRunBeat,
  type ChatPostRunBlameVector,
  type ChatPostRunClosureBand,
  type ChatPostRunDirective,
  type ChatPostRunDigest,
  type ChatPostRunEvidenceSnapshot,
  type ChatPostRunForeshadow,
  type ChatPostRunKind,
  type ChatPostRunLedgerEntry,
  type ChatPostRunPlan,
  type ChatPostRunSummaryCard,
  type ChatPostRunSummaryClass,
  type ChatPostRunTone,
  type ChatPostRunVisibilityMode,
  type ChatPostRunWitness,
  type ChatTurningPoint,
  type ChatTurningPointCandidate,
} from '../../../../../shared/contracts/chat/ChatPostRun';

// ============================================================================
// MARK: Local policy contracts
// ============================================================================

export interface PostRunSummaryPolicyOptions {
  readonly maxWitnesses?: number;
  readonly maxForeshadow?: number;
  readonly maxDirectives?: number;
  readonly maxBlameVectors?: number;
  readonly includeCrowdWitness?: boolean;
  readonly includeSystemVerdictBeat?: boolean;
  readonly includeSilenceBeat?: boolean;
  readonly helperWitnessDelayMs?: number;
  readonly rivalWitnessDelayMs?: number;
  readonly crowdWitnessDelayMs?: number;
  readonly summaryBeatDelayMs?: number;
  readonly foreshadowDelayMs?: number;
  readonly silenceBeatDurationMs?: number;
}

export interface PostRunSummaryPolicyContext {
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
  readonly beats?: readonly ChatPostRunBeat[];
  readonly createdAt?: UnixMs;
  readonly previousPlan?: ChatPostRunPlan | null;
  readonly relatedNpcIds?: readonly ChatNpcId[];
  readonly relatedMessageIds?: readonly ChatMessageId[];
  readonly relatedSceneIds?: readonly ChatSceneId[];
  readonly summaryCardOverrides?: Partial<
    Pick<ChatPostRunSummaryCard, 'title' | 'subtitle' | 'body' | 'tags'>
  >;
}

export interface PostRunSummaryPolicyEvaluation {
  readonly plan: ChatPostRunPlan;
  readonly digest: ChatPostRunDigest;
  readonly archiveEntry: ChatPostRunArchiveEntry;
  readonly ledgerEntry: ChatPostRunLedgerEntry;
  readonly dominantChannel?: ChatVisibleChannel;
  readonly primaryTurningPoint?: ChatTurningPoint | null;
  readonly primaryBlame?: ChatPostRunBlameVector | null;
  readonly primaryDirective?: ChatPostRunDirective | null;
  readonly primaryForeshadow?: ChatPostRunForeshadow | null;
  readonly dominantTone: ChatPostRunTone;
  readonly closureBand: ChatPostRunClosureBand;
  readonly summaryClass: ChatPostRunSummaryClass;
  readonly publicBroadcastRecommended: boolean;
  readonly replayPersistenceRecommended: boolean;
  readonly memoryAnchorRecommended: boolean;
  readonly reasoning: PostRunSummaryPolicyReasoning;
}

export interface PostRunSummaryPolicyReasoning {
  readonly toneReason: string;
  readonly visibilityReason: string;
  readonly classReason: string;
  readonly turningPointReason: string;
  readonly blameReason: string;
  readonly directiveReason: string;
  readonly foreshadowReason: string;
  readonly witnessReason: string;
  readonly beatReason: string;
}

export interface PostRunSummaryPolicySnapshot {
  readonly updatedAt: UnixMs;
  readonly evaluation: PostRunSummaryPolicyEvaluation;
  readonly summarizedPlan: Record<string, unknown>;
  readonly beatCounts: Readonly<Record<string, number>>;
  readonly deliveredChannels: readonly ChatVisibleChannel[];
}

const DEFAULT_OPTIONS: Required<PostRunSummaryPolicyOptions> = Object.freeze({
  maxWitnesses: 3,
  maxForeshadow: 2,
  maxDirectives: 2,
  maxBlameVectors: 2,
  includeCrowdWitness: true,
  includeSystemVerdictBeat: true,
  includeSilenceBeat: true,
  helperWitnessDelayMs: 1_350,
  rivalWitnessDelayMs: 900,
  crowdWitnessDelayMs: 1_850,
  summaryBeatDelayMs: 2_550,
  foreshadowDelayMs: 3_850,
  silenceBeatDurationMs: 1_150,
});

// ============================================================================
// MARK: Utility helpers
// ============================================================================

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

function uniqueBy<TItem, TKey>(
  values: readonly TItem[],
  keyFn: (value: TItem) => TKey,
): TItem[] {
  const seen = new Set<TKey>();
  const result: TItem[] = [];
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function compact<TValue>(values: readonly (TValue | null | undefined | false)[]): TValue[] {
  return values.filter(Boolean) as TValue[];
}

function isWinningOutcome(outcome: ChatPostRunEvidenceSnapshot['runOutcome']): boolean {
  return outcome === 'WIN' || outcome === 'SOVEREIGN';
}

function isCollapseOutcome(outcome: ChatPostRunEvidenceSnapshot['runOutcome']): boolean {
  return outcome === 'LOSS' || outcome === 'BANKRUPT';
}

function pickDominantHeat(
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint?: ChatTurningPoint | null,
): ChatPostRunEvidenceSnapshot['audienceHeat'][ChatVisibleChannel] | undefined {
  if (turningPoint?.compactMoment?.visibleChannel) {
    return evidence.audienceHeat[turningPoint.compactMoment.visibleChannel];
  }

  let dominant: ChatPostRunEvidenceSnapshot['audienceHeat'][ChatVisibleChannel] | undefined;
  for (const channel of Object.keys(evidence.audienceHeat) as ChatVisibleChannel[]) {
    const heat = evidence.audienceHeat[channel];
    if (!dominant || Number(heat.heatScore) > Number(dominant.heatScore)) {
      dominant = heat;
    }
  }
  return dominant;
}

function describeToneReason(
  tone: ChatPostRunTone,
  evidence: ChatPostRunEvidenceSnapshot,
): string {
  const { runOutcome, affect, reputation } = evidence;
  if (tone === 'REVERENT') return `Outcome ${runOutcome} elevated the ritual into mythic closure.`;
  if (tone === 'TRIUMPHANT') return `Relief ${Number(affect.relief)} and outcome ${runOutcome} justify ceremonial victory posture.`;
  if (tone === 'BITTER') return `Social embarrassment ${Number(affect.socialEmbarrassment)} plus public reputation ${Number(reputation.publicReputation)} push the scene toward bitterness.`;
  if (tone === 'HAUNTING') return `Frustration ${Number(affect.frustration)} and trust ${Number(affect.trust)} support a haunting epilogue.`;
  if (tone === 'SOMBER') return `The run ended under pressure-heavy affect, so somber ritual reads truer than hype.`;
  if (tone === 'TENDER') return `Relief ${Number(affect.relief)} and trust ${Number(affect.trust)} justify a gentle helper-facing close.`;
  if (tone === 'FOREBODING') return `Low confidence and weak public posture imply unresolved danger after the run.`;
  if (tone === 'CLINICAL') return `Embarrassment and low confidence make emotional distance cleaner than sentiment.`;
  return `Calm is the least distortive tone for the current affect and reputation balance.`;
}

function describeVisibilityReason(
  visibility: ChatPostRunVisibilityMode,
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint?: ChatTurningPoint | null,
): string {
  if (visibility === 'LEGEND_ARCHIVE') {
    return 'Replay / legend conditions are strong enough that the post-run deserves prestige persistence.';
  }
  if (visibility === 'MULTI_CHANNEL') {
    return 'The run should echo across more than one public social surface.';
  }
  if (visibility === 'CHANNEL') {
    return `A channelized witness surface is strong enough to hold the ritual without full-room spill.`;
  }
  if (visibility === 'ROOM') {
    return `The room should witness the result, but the wider network does not need it.`;
  }
  if (visibility === 'SHADOW_ONLY') {
    return 'The post-run is useful diagnostically but should remain latent / private for now.';
  }
  return `Outcome ${evidence.runOutcome} plus turning-point lift ${Number(turningPoint?.legendLift01 ?? 0)} do not justify public ritual.`;
}

function describeClassReason(
  className: ChatPostRunPlan['class'],
  tone: ChatPostRunTone,
  visibility: ChatPostRunVisibilityMode,
): string {
  return `Class ${className} follows tone ${tone} and visibility ${visibility}.`;
}

function describeTurningPointReason(
  candidates: readonly ChatTurningPointCandidate[],
  turningPoint?: ChatTurningPoint | null,
): string {
  const ranked = sortTurningPointCandidates(candidates);
  const top = ranked[0];
  if (!turningPoint || !top) {
    return 'No dominant turning point outscored the broader pressure field.';
  }
  return `Turning point “${turningPoint.label}” won because its weighted salience ${Number(scoreTurningPointCandidate(top))} outran other candidates.`;
}

function describeBlameReason(blame?: ChatPostRunBlameVector | null): string {
  if (!blame) return 'No blame vector clearly dominated; the run remains diffuse in causality.';
  return `Primary blame “${blame.label}” scored ${Number(scoreBlameVector(blame))} and best explains the collapse / close.`;
}

function describeDirectiveReason(directive?: ChatPostRunDirective | null): string {
  if (!directive) return 'No directive rose above baseline importance.';
  return `Primary directive “${directive.label}” carries urgency ${Number(directive.urgency01)} and confidence ${Number(directive.confidence01)}.`;
}

function describeForeshadowReason(foreshadow?: ChatPostRunForeshadow | null): string {
  if (!foreshadow) return 'No foreshadow line is necessary for this closure posture.';
  return `Foreshadow “${foreshadow.label}” scored ${Number(scoreForeshadow(foreshadow))} and keeps the next run alive.`;
}

function describeWitnessReason(witnesses: readonly ChatPostRunWitness[]): string {
  if (witnesses.length === 0) return 'The run closes with minimal overt witness pressure.';
  const primaryStance = derivePrimaryWitnessStance(witnesses);
  return `Witness mix uses ${witnesses.length} authored voices with dominant stance ${primaryStance ?? 'unknown'}.`;
}

function describeBeatReason(beats: readonly ChatPostRunBeat[]): string {
  const counts = countPostRunBeatsByKind(beats);
  return `Beat plan contains ${beats.length} ritual beats with summary=${counts.SUMMARY_CARD}, witness=${counts.WITNESS_LINE}, silence=${counts.SILENCE}, foreshadow=${counts.FORESHADOW_LINE}.`;
}

function buildSystemVerdictLine(
  evidence: ChatPostRunEvidenceSnapshot,
  tone: ChatPostRunTone,
  turningPoint?: ChatTurningPoint | null,
): string {
  if (evidence.runOutcome === 'SOVEREIGN') {
    return turningPoint
      ? `Sovereignty locked. The decisive turn was ${turningPoint.label.toLowerCase()}.`
      : 'Sovereignty locked. The room witnessed the ascent.';
  }
  if (evidence.runOutcome === 'WIN') {
    return turningPoint
      ? `Run closed positive. The board turned when ${turningPoint.label.toLowerCase()}.`
      : 'Run closed positive. The room has a clean ending to remember.';
  }
  if (evidence.runOutcome === 'BANKRUPT') {
    return tone === 'CLINICAL'
      ? 'Run terminated under structural insolvency. Recovery doctrine should override pride.'
      : 'The board took everything it was owed.';
  }
  return turningPoint
    ? `Run lost. The shape of the fall became clear at ${turningPoint.label.toLowerCase()}.`
    : 'Run lost. The collapse was cumulative, not singular.';
}

function buildHelperWitnessLine(
  evidence: ChatPostRunEvidenceSnapshot,
  directive?: ChatPostRunDirective | null,
): string {
  if (directive?.kind === 'TRUST_HELPER') {
    return 'I had an exit line for you. Next time, take it before the room tastes blood.';
  }
  if (directive?.kind === 'TAKE_A_BREATH') {
    return 'Do not reload out of embarrassment. Breathe, then return with structure.';
  }
  if (isWinningOutcome(evidence.runOutcome)) {
    return 'Keep the posture. The room will answer a win with sharper pressure next time.';
  }
  return 'This is still useful. Name the mistake cleanly and the next run starts stronger.';
}

function buildRivalWitnessLine(
  evidence: ChatPostRunEvidenceSnapshot,
  blame?: ChatPostRunBlameVector | null,
): string {
  if (isWinningOutcome(evidence.runOutcome)) {
    return 'Enjoy the applause. It only makes the rematch easier to aim.';
  }
  if (blame?.kind === 'PLAYER_HESITATION') {
    return 'You were not beaten fast. You were beaten late.';
  }
  if (blame?.kind === 'DEAL_ROOM_MISREAD') {
    return 'You thought silence meant weakness. It meant we already had you.';
  }
  return 'The room did not kill you all at once. It watched you help.';
}

function buildCrowdWitnessLine(
  evidence: ChatPostRunEvidenceSnapshot,
  dominantChannel?: ChatVisibleChannel,
): string {
  if (evidence.runOutcome === 'SOVEREIGN') {
    return `The ${dominantChannel ?? 'room'} saw it. That ending will travel.`;
  }
  if (evidence.runOutcome === 'WIN') {
    return `The ${dominantChannel ?? 'room'} is loud now, but noise becomes expectation fast.`;
  }
  return `The ${dominantChannel ?? 'room'} has already chosen what part of this fall it wants to repeat.`;
}

function buildWitnesses(
  context: PostRunSummaryPolicyContext,
  tone: ChatPostRunTone,
  directive: ChatPostRunDirective | null,
  blame: ChatPostRunBlameVector | null,
  dominantChannel: ChatVisibleChannel | undefined,
  options: Required<PostRunSummaryPolicyOptions>,
): readonly ChatPostRunWitness[] {
  if (context.witnesses && context.witnesses.length > 0) {
    return uniqueBy(context.witnesses, (witness) => witness.witnessId).slice(0, options.maxWitnesses);
  }

  const witnesses = compact<ChatPostRunWitness>([
    buildDefaultPostRunWitness({
      witnessId: (`${context.postRunId}:witness:helper` as unknown) as ChatPostRunWitness['witnessId'],
      actorRole: 'HELPER',
      stance: isWinningOutcome(context.evidence.runOutcome) ? 'ADMIRATION' : 'MERCY',
      displayName: 'Kade',
      line: buildHelperWitnessLine(context.evidence, directive),
      intensity01: tone === 'TENDER' ? 0.64 : 0.72,
      personal01: 0.78,
      timingMs: options.helperWitnessDelayMs,
      visibleChannel: dominantChannel ?? null,
      proofHash: context.evidence.proofHash,
      tags: ['postrun', 'helper', 'ritual'],
    }),
    buildDefaultPostRunWitness({
      witnessId: (`${context.postRunId}:witness:rival` as unknown) as ChatPostRunWitness['witnessId'],
      actorRole: 'RIVAL',
      stance: isWinningOutcome(context.evidence.runOutcome) ? 'THREAT' : 'CONTEMPT',
      displayName: 'The Liquidator',
      line: buildRivalWitnessLine(context.evidence, blame),
      intensity01: isWinningOutcome(context.evidence.runOutcome) ? 0.70 : 0.84,
      personal01: 0.62,
      timingMs: options.rivalWitnessDelayMs,
      visibleChannel: dominantChannel ?? null,
      proofHash: context.evidence.proofHash,
      tags: ['postrun', 'rival', 'ritual'],
    }),
    options.includeCrowdWitness
      ? buildDefaultPostRunWitness({
          witnessId: (`${context.postRunId}:witness:crowd` as unknown) as ChatPostRunWitness['witnessId'],
          actorRole: 'CROWD',
          stance: isWinningOutcome(context.evidence.runOutcome) ? 'AWE' : 'JUDGMENT',
          displayName: 'The Room',
          line: buildCrowdWitnessLine(context.evidence, dominantChannel),
          intensity01: 0.66,
          personal01: 0.20,
          timingMs: options.crowdWitnessDelayMs,
          visibleChannel: dominantChannel ?? null,
          proofHash: context.evidence.proofHash,
          tags: ['postrun', 'crowd', 'ritual'],
        })
      : null,
  ]);

  return witnesses.slice(0, options.maxWitnesses);
}

function buildBeatPlan(input: {
  readonly context: PostRunSummaryPolicyContext;
  readonly planSeed: ChatPostRunPlan;
  readonly tone: ChatPostRunTone;
  readonly dominantChannel?: ChatVisibleChannel;
  readonly primaryTurningPoint?: ChatTurningPoint | null;
  readonly primaryBlame?: ChatPostRunBlameVector | null;
  readonly primaryDirective?: ChatPostRunDirective | null;
  readonly primaryForeshadow?: ChatPostRunForeshadow | null;
  readonly witnesses: readonly ChatPostRunWitness[];
  readonly options: Required<PostRunSummaryPolicyOptions>;
}): readonly ChatPostRunBeat[] {
  if (input.context.beats && input.context.beats.length > 0) {
    return sortPostRunBeats(uniqueBy(input.context.beats, (beat) => beat.beatId));
  }

  const beats = compact<ChatPostRunBeat>([
    input.options.includeSystemVerdictBeat
      ? buildDefaultPostRunBeat({
          beatId: (`${input.context.postRunId}:beat:verdict` as unknown) as ChatPostRunBeat['beatId'],
          kind: 'SYSTEM_VERDICT',
          actorRole: 'SYSTEM',
          tone: input.tone,
          line: buildSystemVerdictLine(input.context.evidence, input.tone, input.primaryTurningPoint),
          visibleChannel: input.dominantChannel ?? null,
          visibility: input.planSeed.visibility,
          delayMs: 0,
          proofHash: input.context.evidence.proofHash,
          replayId: input.context.evidence.replayId,
          sourceMomentIds: input.primaryTurningPoint?.compactMoment ? [input.primaryTurningPoint.compactMoment.momentId] : [],
          sourceSceneIds: input.context.relatedSceneIds ?? [],
          tags: ['postrun', 'system', 'verdict'],
        })
      : null,
    input.primaryTurningPoint
      ? buildDefaultPostRunBeat({
          beatId: (`${input.context.postRunId}:beat:turning-point` as unknown) as ChatPostRunBeat['beatId'],
          kind: 'TURNING_POINT_CARD',
          actorRole: 'SYSTEM',
          tone: input.tone,
          summary: input.primaryTurningPoint.label,
          line: input.primaryTurningPoint.explanation,
          visibleChannel: input.dominantChannel ?? null,
          visibility: input.planSeed.visibility,
          delayMs: 450,
          turningPointId: input.primaryTurningPoint.turningPointId,
          proofHash: input.context.evidence.proofHash,
          replayId: input.context.evidence.replayId,
          sourceMomentIds: input.primaryTurningPoint.compactMoment ? [input.primaryTurningPoint.compactMoment.momentId] : [],
          sourceSceneIds: input.context.relatedSceneIds ?? [],
          tags: ['postrun', 'turning-point', 'ritual'],
        })
      : null,
    input.primaryBlame
      ? buildDefaultPostRunBeat({
          beatId: (`${input.context.postRunId}:beat:blame` as unknown) as ChatPostRunBeat['beatId'],
          kind: 'BLAME_CARD',
          actorRole: 'SYSTEM',
          tone: input.tone,
          summary: input.primaryBlame.label,
          line: input.primaryBlame.explanation,
          visibleChannel: input.dominantChannel ?? null,
          visibility: input.planSeed.visibility,
          delayMs: 820,
          blameId: input.primaryBlame.blameId,
          proofHash: input.context.evidence.proofHash,
          sourceMomentIds: input.primaryBlame.sourceMomentIds,
          sourceSceneIds: input.context.relatedSceneIds ?? [],
          tags: ['postrun', 'blame', 'ritual'],
        })
      : null,
    ...input.witnesses.map((witness, index) =>
      buildDefaultPostRunBeat({
        beatId: (`${input.context.postRunId}:beat:witness:${index}` as unknown) as ChatPostRunBeat['beatId'],
        kind:
          witness.actorRole === 'HELPER'
            ? 'HELPER_EPITAPH'
            : witness.actorRole === 'RIVAL'
              ? 'RIVAL_MOCKERY'
              : witness.actorRole === 'CROWD'
                ? 'CROWD_JUDGMENT'
                : 'WITNESS_LINE',
        actorRole: witness.actorRole,
        tone: input.tone,
        line: witness.line,
        visibleChannel: witness.visibleChannel ?? null,
        visibility: input.planSeed.visibility,
        delayMs: witness.timingMs,
        proofHash: witness.proofHash,
        tags: ['postrun', 'witness', ...((witness.tags ?? []) as string[])],
      }),
    ),
    input.options.includeSilenceBeat
      ? buildDefaultPostRunBeat({
          beatId: (`${input.context.postRunId}:beat:silence` as unknown) as ChatPostRunBeat['beatId'],
          kind: 'SILENCE',
          actorRole: 'SYSTEM',
          tone: input.tone,
          summary: 'Silence holds the room for one breath.',
          visibleChannel: input.dominantChannel ?? null,
          visibility: input.planSeed.visibility,
          delayMs: input.options.summaryBeatDelayMs - 300,
          durationMs: input.options.silenceBeatDurationMs,
          tags: ['postrun', 'silence', 'ritual'],
        })
      : null,
    buildDefaultPostRunBeat({
      beatId: (`${input.context.postRunId}:beat:summary` as unknown) as ChatPostRunBeat['beatId'],
      kind: 'SUMMARY_CARD',
      actorRole: 'SYSTEM',
      tone: input.tone,
      summary: input.planSeed.summaryCard.title,
      line: input.planSeed.summaryCard.body,
      visibleChannel: input.dominantChannel ?? null,
      visibility: input.planSeed.visibility,
      delayMs: input.options.summaryBeatDelayMs,
      turningPointId: input.primaryTurningPoint?.turningPointId,
      blameId: input.primaryBlame?.blameId,
      foreshadowId: input.primaryForeshadow?.foreshadowId,
      legendId: input.context.evidence.legendId,
      proofHash: input.context.evidence.proofHash,
      replayId: input.context.evidence.replayId,
      tags: ['postrun', 'summary', 'ritual'],
    }),
    input.primaryForeshadow
      ? buildDefaultPostRunBeat({
          beatId: (`${input.context.postRunId}:beat:foreshadow` as unknown) as ChatPostRunBeat['beatId'],
          kind: 'FORESHADOW_LINE',
          actorRole: 'NARRATOR',
          tone: input.tone,
          line: input.primaryForeshadow.line,
          summary: input.primaryForeshadow.label,
          visibleChannel: input.dominantChannel ?? null,
          visibility: input.planSeed.visibility,
          delayMs: input.options.foreshadowDelayMs,
          foreshadowId: input.primaryForeshadow.foreshadowId,
          legendId: input.context.evidence.legendId,
          proofHash: input.context.evidence.proofHash,
          replayId: input.context.evidence.replayId,
          tags: ['postrun', 'foreshadow', 'ritual'],
        })
      : null,
    input.context.evidence.legendId
      ? buildDefaultPostRunBeat({
          beatId: (`${input.context.postRunId}:beat:legend` as unknown) as ChatPostRunBeat['beatId'],
          kind: 'LEGEND_NOTICE',
          actorRole: 'SYSTEM',
          tone: input.tone,
          line: 'This ending has enough witness weight to return later.',
          summary: 'Legend lock pending',
          visibleChannel: input.dominantChannel ?? null,
          visibility: input.planSeed.visibility,
          delayMs: input.options.foreshadowDelayMs + 350,
          legendId: input.context.evidence.legendId,
          proofHash: input.context.evidence.proofHash,
          replayId: input.context.evidence.replayId,
          tags: ['postrun', 'legend', 'ritual'],
        })
      : null,
  ]);

  return sortPostRunBeats(beats);
}

function buildSummaryCardForPlan(input: {
  readonly context: PostRunSummaryPolicyContext;
  readonly plan: ChatPostRunPlan;
  readonly tone: ChatPostRunTone;
  readonly closureBand: ChatPostRunClosureBand;
  readonly archivePolicy: ChatPostRunPlan['summaryCard']['archivePolicy'];
  readonly turningPoint?: ChatTurningPoint | null;
  readonly blameVectors: readonly ChatPostRunBlameVector[];
  readonly directives: readonly ChatPostRunDirective[];
  readonly foreshadow: readonly ChatPostRunForeshadow[];
}): ChatPostRunSummaryCard {
  const title =
    input.context.summaryCardOverrides?.title ??
    (input.context.evidence.runOutcome === 'SOVEREIGN'
      ? 'The room remembers the ascent.'
      : input.context.evidence.runOutcome === 'WIN'
        ? 'The run closed with witnesses.'
        : input.context.evidence.runOutcome === 'BANKRUPT'
          ? 'The room names the collapse.'
          : 'The run ended, but the lesson did not.');

  const subtitle =
    input.context.summaryCardOverrides?.subtitle ??
    (summarizeTurningPoint(input.turningPoint) ?? 'No single turn outweighed the total pressure.');

  const body =
    input.context.summaryCardOverrides?.body ??
    compact<string>([
      summarizePrimaryBlame(input.blameVectors) ?? undefined,
      summarizePrimaryDirective(input.directives) ?? undefined,
      summarizePrimaryForeshadow(input.foreshadow) ?? undefined,
    ]).join(' ');

  return buildPostRunSummaryCard({
    summaryId: input.plan.summaryCard.summaryId,
    cardId: input.plan.summaryCard.cardId,
    title,
    subtitle,
    body,
    tone: input.tone,
    closureBand: input.closureBand,
    kind: input.plan.kind,
    archiveClass: input.context.evidence.finalSceneSummary?.archiveClass,
    archivePolicy: input.archivePolicy,
    turningPoint: input.turningPoint,
    blameVectors: input.blameVectors,
    directives: input.directives,
    foreshadow: input.foreshadow,
    legendId: input.context.evidence.legendId,
    replayId: input.context.evidence.replayId,
    proofHash: input.context.evidence.proofHash,
    tags: uniqueBy(
      compact<string>([
        ...(input.plan.tags ?? []),
        ...(input.context.summaryCardOverrides?.tags ?? []),
        'postrun',
        input.plan.kind.toLowerCase(),
        input.plan.tone.toLowerCase(),
      ]),
      (value) => value,
    ),
  });
}

function enrichPlan(
  context: PostRunSummaryPolicyContext,
  options: Required<PostRunSummaryPolicyOptions>,
): ChatPostRunPlan {
  const seed = buildMinimalPostRunPlan({
    postRunId: context.postRunId,
    bundleId: context.bundleId,
    roomId: context.roomId,
    kind: context.kind,
    evidence: context.evidence,
    turningPointCandidates: context.turningPointCandidates,
    moments: context.moments,
    blameVectors: context.blameVectors,
    directives: context.directives,
    foreshadow: context.foreshadow,
    witnesses: context.witnesses,
    beats: context.beats,
    createdAt: context.createdAt,
    payload: {
      relatedNpcIds: context.relatedNpcIds,
      relatedMessageIds: context.relatedMessageIds,
      relatedSceneIds: context.relatedSceneIds,
    },
  });

  const primaryTurningPoint = choosePrimaryTurningPoint(context.turningPointCandidates ?? [], context.moments);
  const dominantChannel =
    primaryTurningPoint?.compactMoment?.visibleChannel ?? deriveDominantVisibleChannel(seed.beats);
  const dominantHeat = pickDominantHeat(context.evidence, primaryTurningPoint);
  const tone = derivePostRunTone({
    outcome: context.evidence.runOutcome,
    affect: context.evidence.affect,
    reputation: context.evidence.reputation,
  });

  const visibility = derivePostRunVisibility({
    preferredChannel: dominantChannel,
    outcome: context.evidence.runOutcome,
    primaryTurningPoint,
    dominantHeat,
    replayId: context.evidence.replayId,
    legendId: context.evidence.legendId,
  });

  const className = derivePostRunClass(context.evidence.runOutcome, visibility, tone);
  const providedBlame = context.blameVectors && context.blameVectors.length > 0
    ? context.blameVectors.slice(0, options.maxBlameVectors)
    : [
        buildDefaultBlameVector({
          blameId: (`${context.postRunId}:blame:default` as unknown) as ChatPostRunBlameVector['blameId'],
          outcome: context.evidence.runOutcome,
          turningPoint: primaryTurningPoint,
          affect: context.evidence.affect,
          heat: dominantHeat,
          sourceMomentIds: primaryTurningPoint?.compactMoment ? [primaryTurningPoint.compactMoment.momentId] : [],
        }),
      ];
  const blameVectors = sortBlameVectors(uniqueBy(providedBlame, (entry) => entry.blameId)).slice(0, options.maxBlameVectors);
  const primaryBlame = choosePrimaryBlameVector(blameVectors);

  const providedDirectives = context.directives && context.directives.length > 0
    ? context.directives.slice(0, options.maxDirectives)
    : [
        buildDefaultDirective({
          directiveId: (`${context.postRunId}:directive:default` as unknown) as ChatPostRunDirective['directiveId'],
          outcome: context.evidence.runOutcome,
          affect: context.evidence.affect,
          heat: dominantHeat,
          sourceTurningPointId: primaryTurningPoint?.turningPointId,
          sourceBlameId: primaryBlame?.blameId,
          sourceMomentIds: primaryTurningPoint?.compactMoment ? [primaryTurningPoint.compactMoment.momentId] : [],
        }),
      ];
  const directives = sortPostRunDirectives(uniqueBy(providedDirectives, (entry) => entry.directiveId)).slice(0, options.maxDirectives);
  const primaryDirective = choosePrimaryDirective(directives);

  const providedForeshadow = context.foreshadow && context.foreshadow.length > 0
    ? context.foreshadow.slice(0, options.maxForeshadow)
    : compact<ChatPostRunForeshadow>([
        buildDefaultForeshadow({
          foreshadowId: (`${context.postRunId}:foreshadow:default` as unknown) as ChatPostRunForeshadow['foreshadowId'],
          outcome: context.evidence.runOutcome,
          turningPoint: primaryTurningPoint,
          dominantHeat,
          legendId: context.evidence.legendId,
          nextWorldEventId: context.evidence.worldEventIds[0],
        }),
      ]);
  const foreshadow = sortPostRunForeshadow(uniqueBy(providedForeshadow, (entry) => entry.foreshadowId)).slice(0, options.maxForeshadow);
  const primaryForeshadow = choosePrimaryForeshadow(foreshadow);

  const shouldAnchorMemory = shouldAnchorPostRunMemory({
    turningPoint: primaryTurningPoint,
    blameVectors,
    foreshadow,
    outcome: context.evidence.runOutcome,
  });

  const legendEscalationEligible = shouldEscalatePostRunToLegend({
    turningPoint: primaryTurningPoint,
    outcome: context.evidence.runOutcome,
    replayId: context.evidence.replayId,
    proofHash: context.evidence.proofHash,
  });

  const closureBand = derivePostRunClosureBand({
    outcome: context.evidence.runOutcome,
    affect: context.evidence.affect,
    turningPoint: primaryTurningPoint,
    foreshadowCount: foreshadow.length,
    directiveCount: directives.length,
  });

  const archivePolicy = derivePostRunArchivePolicy({
    closureBand,
    replayId: context.evidence.replayId,
    proofHash: context.evidence.proofHash,
    legendEligible: legendEscalationEligible,
    shouldAnchorMemory,
  });

  const witnesses = buildWitnesses(
    context,
    tone,
    primaryDirective,
    primaryBlame,
    dominantChannel,
    options,
  );

  const provisionalPlan = normalizePostRunPlan({
    ...seed,
    stage: 'COMPOSED',
    class: className,
    tone,
    visibility,
    turningPoint: primaryTurningPoint ?? undefined,
    blameVectors,
    directives,
    foreshadow,
    witnesses,
    legendEscalationEligible,
    replayRecommended: shouldPersistPostRunReplay({
      evidence: context.evidence,
      turningPoint: primaryTurningPoint ?? undefined,
      kind: context.kind,
    }),
    shouldAnchorMemory,
    shouldPersistShadowArchive: visibility === 'SHADOW_ONLY' || archivePolicy === 'MEMORY_ANCHOR',
    window: derivePostRunWindow({
      openedAt: context.createdAt ?? seed.createdAt,
      outcome: context.evidence.runOutcome,
      replayId: context.evidence.replayId,
      legendEligible: legendEscalationEligible,
    }),
    tags: uniqueBy(
      compact<string>([
        ...(seed.tags ?? []),
        'postrun',
        tone.toLowerCase(),
        inferDirectiveKind({
          outcome: context.evidence.runOutcome,
          affect: context.evidence.affect,
          heat: dominantHeat,
        }).toLowerCase(),
      ]),
      (value) => value,
    ),
  });

  const summaryCard = buildSummaryCardForPlan({
    context,
    plan: provisionalPlan,
    tone,
    closureBand,
    archivePolicy,
    turningPoint: primaryTurningPoint,
    blameVectors,
    directives,
    foreshadow,
  });

  const beats = buildBeatPlan({
    context,
    planSeed: provisionalPlan,
    tone,
    dominantChannel,
    primaryTurningPoint,
    primaryBlame,
    primaryDirective,
    primaryForeshadow,
    witnesses,
    options,
  });

  return normalizePostRunPlan({
    ...provisionalPlan,
    summaryCard,
    beats,
    threads: [projectPostRunThread({ beats, witnesses, visibility })],
  });
}

// ============================================================================
// MARK: Policy class
// ============================================================================

export class PostRunSummaryPolicy {
  private readonly options: Required<PostRunSummaryPolicyOptions>;
  private snapshot: PostRunSummaryPolicySnapshot | null = null;

  public constructor(options: PostRunSummaryPolicyOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  public evaluate(context: PostRunSummaryPolicyContext): PostRunSummaryPolicyEvaluation {
    const plan = enrichPlan(context, this.options);
    const primaryTurningPoint = plan.turningPoint ?? null;
    const primaryBlame = choosePrimaryBlameVector(plan.blameVectors);
    const primaryDirective = choosePrimaryDirective(plan.directives);
    const primaryForeshadow = choosePrimaryForeshadow(plan.foreshadow);
    const dominantChannel = deriveDominantVisibleChannel(plan.beats);
    const closureBand = plan.summaryCard.closureBand;
    const summaryClass = deriveSummaryClass({
      tone: plan.tone,
      closureBand,
      visibility: plan.visibility,
    });
    const digest = buildPostRunDigest(plan);
    const archiveEntry = buildPostRunArchiveEntry({
      archiveId: (`${plan.postRunId}:archive` as unknown) as ChatPostRunArchiveEntry['archiveId'],
      plan,
      archivedAt: ((plan.window.closesAt ?? plan.createdAt) as unknown) as UnixMs,
      memoryAnchorIds: plan.evidence.relatedAnchorIds,
    });
    const ledgerEntry = derivePostRunLedgerEntry({
      plan,
      archivedAt: archiveEntry.archivedAt,
      memoryAnchorIds: plan.evidence.relatedAnchorIds,
    });

    const evaluation: PostRunSummaryPolicyEvaluation = {
      plan,
      digest,
      archiveEntry,
      ledgerEntry,
      dominantChannel,
      primaryTurningPoint,
      primaryBlame,
      primaryDirective,
      primaryForeshadow,
      dominantTone: plan.tone,
      closureBand,
      summaryClass,
      publicBroadcastRecommended: shouldBroadcastPostRunPublicly({
        beats: plan.beats,
        visibility: plan.visibility,
      }),
      replayPersistenceRecommended: shouldPersistPostRunReplay({
        evidence: plan.evidence,
        turningPoint: plan.turningPoint,
        kind: plan.kind,
      }),
      memoryAnchorRecommended: plan.shouldAnchorMemory,
      reasoning: {
        toneReason: describeToneReason(plan.tone, plan.evidence),
        visibilityReason: describeVisibilityReason(plan.visibility, plan.evidence, primaryTurningPoint),
        classReason: describeClassReason(plan.class, plan.tone, plan.visibility),
        turningPointReason: describeTurningPointReason(context.turningPointCandidates ?? [], primaryTurningPoint),
        blameReason: describeBlameReason(primaryBlame),
        directiveReason: describeDirectiveReason(primaryDirective),
        foreshadowReason: describeForeshadowReason(primaryForeshadow),
        witnessReason: describeWitnessReason(plan.witnesses),
        beatReason: describeBeatReason(plan.beats),
      },
    };

    this.snapshot = {
      updatedAt: nowMs(),
      evaluation,
      summarizedPlan: summarizePostRunPlan(plan),
      beatCounts: countPostRunBeatsByKind(plan.beats),
      deliveredChannels: collectPostRunChannels(plan),
    };

    return evaluation;
  }

  public evaluateSnapshot(context: PostRunSummaryPolicyContext): PostRunSummaryPolicySnapshot {
    this.evaluate(context);
    return this.getSnapshot();
  }

  public getSnapshot(): PostRunSummaryPolicySnapshot {
    if (!this.snapshot) {
      throw new Error('PostRunSummaryPolicy has no snapshot yet. Call evaluate() first.');
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

export function createPostRunSummaryPolicy(
  options: PostRunSummaryPolicyOptions = {},
): PostRunSummaryPolicy {
  return new PostRunSummaryPolicy(options);
}

export function evaluatePostRunSummaryPolicy(
  context: PostRunSummaryPolicyContext,
  options: PostRunSummaryPolicyOptions = {},
): PostRunSummaryPolicyEvaluation {
  return new PostRunSummaryPolicy(options).evaluate(context);
}

export function evaluatePostRunSummarySnapshot(
  context: PostRunSummaryPolicyContext,
  options: PostRunSummaryPolicyOptions = {},
): PostRunSummaryPolicySnapshot {
  return new PostRunSummaryPolicy(options).evaluateSnapshot(context);
}
