/**
 * @file backend/src/game/engine/chat/experience/ChatScenePlanner.ts
 * @description
 * Backend scene planner for the Point Zero One chat runtime.
 *
 * This planner is intentionally pure. It does not mutate backend state, does not
 * mint messages, and does not talk to transport. Its only job is to translate a
 * moment + relationship + memory + world context into a durable scene plan that
 * can be archived, materialized, replayed, and mirrored into frontend runtime
 * experience lanes.
 *
 * Design goals:
 * - Stay anchored to shared/contracts/chat/scene as canonical cross-stack contract.
 * - Preserve repo authority separation: planner here, materialization elsewhere.
 * - Prefer deterministic planning with a few bounded heuristics instead of opaque randomness.
 * - Expose telemetry so later learning lanes can score planning quality.
 */

import type {
  SharedChatMomentType,
  SharedChatScene,
  SharedChatSceneArchetype,
  SharedChatSceneBeat,
  SharedChatSceneBeatType,
  SharedChatScenePlan,
  SharedChatScenePlannerDecision,
  SharedChatScenePlannerInput,
  SharedChatSceneStageMood,
} from '../../../../../../shared/contracts/chat/scene';

/* ========================================================================== *
 * MARK: Local telemetry and config contracts
 * ========================================================================== */

export type ChatScenePlannerReason =
  | 'MOMENT_ARCHETYPE_MATCH'
  | 'PRESSURE_ESCALATION'
  | 'RELATIONSHIP_PRESSURE'
  | 'HELPER_RESCUE_NEED'
  | 'CALLBACK_AVAILABLE'
  | 'CROWD_AMPLIFICATION'
  | 'FALSE_CALM_WINDOW'
  | 'SILENCE_IS_STRONGER'
  | 'PUBLIC_WITNESS_REQUIRED'
  | 'DEALROOM_PREDATORY_TONE'
  | 'POST_RUN_RECKONING'
  | 'WORLD_EVENT_INTRUSION'
  | 'LEGEND_ESCALATION'
  | 'UNRESOLVED_BUSINESS'
  | 'CARRYOVER_CONTINUITY';

export interface ChatScenePlannerTelemetry {
  readonly pressure01: number;
  readonly relationshipPressure01: number;
  readonly rescueNeed01: number;
  readonly callbackOpportunity01: number;
  readonly crowdHeat01: number;
  readonly silencePreference01: number;
  readonly expectedDurationMs: number;
  readonly expectedVisibleBeats: number;
  readonly expectedShadowBeats: number;
  readonly stageMood: SharedChatSceneStageMood;
  readonly archetype: SharedChatSceneArchetype;
  readonly reasons: readonly ChatScenePlannerReason[];
}

export interface ChatScenePlannerDecisionWithTelemetry {
  readonly plan: SharedChatScenePlan;
  readonly chosenSpeakerIds: readonly string[];
  readonly chosenCallbackAnchorIds: readonly string[];
  readonly chosenTags: readonly string[];
  readonly telemetry: ChatScenePlannerTelemetry;
}

export interface ChatScenePlannerConfig {
  readonly maxChosenSpeakerIds: number;
  readonly maxChosenCallbackAnchorIds: number;
  readonly maxChosenTags: number;
  readonly maxBeats: number;
  readonly allowFalseCalmScenes: boolean;
  readonly allowPlayerReplyWindow: boolean;
  readonly allowPostBeatEcho: boolean;
  readonly enableSilenceWindows: boolean;
  readonly silenceBeatFloorMs: number;
  readonly silenceBeatCeilingMs: number;
  readonly baseBeatDelayMs: number;
  readonly crowdBiasInGlobal01: number;
  readonly rescueBiasInCritical01: number;
  readonly callbackBiasWhenAnchorsPresent01: number;
}

export const DEFAULT_CHAT_SCENE_PLANNER_CONFIG: ChatScenePlannerConfig = {
  maxChosenSpeakerIds: 4,
  maxChosenCallbackAnchorIds: 3,
  maxChosenTags: 10,
  maxBeats: 8,
  allowFalseCalmScenes: true,
  allowPlayerReplyWindow: true,
  allowPostBeatEcho: true,
  enableSilenceWindows: true,
  silenceBeatFloorMs: 900,
  silenceBeatCeilingMs: 3_200,
  baseBeatDelayMs: 650,
  crowdBiasInGlobal01: 0.85,
  rescueBiasInCritical01: 0.9,
  callbackBiasWhenAnchorsPresent01: 0.72,
};

/* ========================================================================== *
 * MARK: Local helper contracts
 * ========================================================================== */

interface AnchorCandidate {
  readonly anchorId: string;
  readonly salience01: number;
  readonly callbackWeight01: number;
  readonly unresolved: boolean;
  readonly tags: readonly string[];
}

interface SpeakerScore {
  readonly speakerId: string;
  readonly score01: number;
  readonly role: 'SYSTEM' | 'HATER' | 'HELPER' | 'CROWD' | 'CALLBACK';
}

interface BeatBuildContext {
  readonly input: SharedChatScenePlannerInput;
  readonly archetype: SharedChatSceneArchetype;
  readonly stageMood: SharedChatSceneStageMood;
  readonly pressure01: number;
  readonly relationshipPressure01: number;
  readonly callbackOpportunity01: number;
  readonly rescueNeed01: number;
  readonly crowdHeat01: number;
  readonly silencePreference01: number;
  readonly chosenSpeakerIds: readonly string[];
  readonly chosenCallbackAnchorIds: readonly string[];
}

/* ========================================================================== *
 * MARK: Utility
 * ========================================================================== */

function clamp01(value: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function uniq(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen: Record<string, true> = Object.create(null);
  for (const value of values) {
    if (!value || seen[value]) continue;
    seen[value] = true;
    out.push(value);
  }
  return out;
}

function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, '_').toUpperCase();
}

function safeArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function pressureScore(input: SharedChatScenePlannerInput): number {
  const rawTier = typeof input.pressureTier === 'string' ? input.pressureTier.toUpperCase() : '';
  switch (rawTier) {
    case 'CALM':
      return 0.1;
    case 'WATCHFUL':
      return 0.28;
    case 'PRESSURED':
      return 0.54;
    case 'CRITICAL':
      return 0.8;
    case 'BREAKPOINT':
      return 0.96;
    default:
      if (input.momentType === 'SOVEREIGN_ACHIEVED') return 0.94;
      if (input.momentType === 'RUN_END') return 0.6;
      if (input.momentType === 'WORLD_EVENT') return 0.72;
      return 0.4;
  }
}

function relationshipPressure(input: SharedChatScenePlannerInput): number {
  const state = input.relationshipState;
  if (!state || typeof state !== 'object') return 0;
  const maybeArray = [
    (state as any).intensity01,
    (state as any).volatility01,
    (state as any).unfinishedBusiness01,
    (state as any).obsession01,
    (state as any).contempt01,
    (state as any).fear01,
  ]
    .filter((value) => typeof value === 'number')
    .map((value) => clamp01(value as number));
  return average(maybeArray);
}

function helperNeed(input: SharedChatScenePlannerInput, pressure01: number): number {
  const helperCount = safeArray(input.helperIds).length;
  const unresolvedCount = safeArray(input.unresolvedMomentIds).length;
  const momentWeight =
    input.momentType === 'HELPER_RESCUE'
      ? 1
      : input.momentType === 'SHIELD_BREACH'
        ? 0.88
        : input.momentType === 'RUN_END'
          ? 0.74
          : input.momentType === 'BOT_ATTACK'
            ? 0.66
            : input.momentType === 'CASCADE_TRIGGER'
              ? 0.62
              : 0.28;
  const helperPresencePenalty = helperCount > 0 ? 0.08 : 0.2;
  const unresolvedWeight = Math.min(0.22, unresolvedCount * 0.03);
  return clamp01(momentWeight + pressure01 * 0.35 + unresolvedWeight - helperPresencePenalty);
}

function anchorSalience(input: SharedChatScenePlannerInput): readonly AnchorCandidate[] {
  return safeArray(input.memoryAnchors)
    .map((anchor: any) => {
      const salience01 = clamp01(
        typeof anchor?.salience01 === 'number'
          ? anchor.salience01
          : typeof anchor?.score01 === 'number'
            ? anchor.score01
            : 0.35,
      );
      const callbackWeight01 = clamp01(
        typeof anchor?.callbackWeight01 === 'number'
          ? anchor.callbackWeight01
          : typeof anchor?.lastReferencedWeight01 === 'number'
            ? anchor.lastReferencedWeight01
            : salience01,
      );
      return {
        anchorId: String(anchor?.anchorId ?? anchor?.id ?? ''),
        salience01,
        callbackWeight01,
        unresolved: Boolean(anchor?.unresolved),
        tags: safeArray(anchor?.tags).map((value) => String(value)),
      } satisfies AnchorCandidate;
    })
    .filter((anchor) => anchor.anchorId.length > 0)
    .sort((a, b) => {
      const unresolvedDelta = Number(b.unresolved) - Number(a.unresolved);
      if (unresolvedDelta !== 0) return unresolvedDelta;
      const scoreA = a.salience01 * 0.7 + a.callbackWeight01 * 0.3;
      const scoreB = b.salience01 * 0.7 + b.callbackWeight01 * 0.3;
      return scoreB - scoreA;
    });
}

function inferCrowdHeat(input: SharedChatScenePlannerInput, pressure01: number): number {
  const isGlobal = String(input.primaryChannel).toUpperCase() === 'GLOBAL';
  const isSyndicate = String(input.primaryChannel).toUpperCase() === 'SYNDICATE';
  const momentWeight =
    input.momentType === 'SOVEREIGN_ACHIEVED'
      ? 1
      : input.momentType === 'LEGEND_MOMENT'
        ? 0.96
        : input.momentType === 'SHIELD_BREACH'
          ? 0.82
          : input.momentType === 'BOT_ATTACK'
            ? 0.76
            : input.momentType === 'CASCADE_TRIGGER'
              ? 0.74
              : input.momentType === 'RUN_START'
                ? 0.58
                : 0.42;
  const modeBias = isGlobal ? 0.2 : isSyndicate ? 0.06 : -0.08;
  const worldBias = safeArray(input.worldTags).some((tag) => /WORLD|SEASON|EVENT|RAID|PANIC/i.test(String(tag))) ? 0.1 : 0;
  return clamp01(momentWeight * 0.55 + pressure01 * 0.2 + modeBias + worldBias);
}

function inferCallbackOpportunity(
  input: SharedChatScenePlannerInput,
  anchors: readonly AnchorCandidate[],
): number {
  if (!anchors.length) return 0;
  const top = anchors.slice(0, 3);
  const unresolvedBonus = top.some((anchor) => anchor.unresolved) ? 0.15 : 0;
  const momentBias =
    input.momentType === 'RUN_END'
      ? 0.22
      : input.momentType === 'COMEBACK_WITNESS_SCENE'
        ? 0.18
        : input.momentType === 'SOVEREIGN_APPROACH'
          ? 0.16
          : input.momentType === 'DEAL_ROOM_STANDOFF'
            ? 0.18
            : 0.08;
  return clamp01(average(top.map((anchor) => anchor.callbackWeight01)) + unresolvedBonus + momentBias);
}

function inferSilencePreference(
  input: SharedChatScenePlannerInput,
  pressure01: number,
  callbackOpportunity01: number,
  rescueNeed01: number,
): number {
  const momentBias =
    input.momentType === 'SHIELD_BREACH'
      ? 0.72
      : input.momentType === 'RUN_END'
        ? 0.64
        : input.momentType === 'SOVEREIGN_ACHIEVED'
          ? 0.58
          : input.momentType === 'WORLD_EVENT'
            ? 0.24
            : 0.3;
  const helperPenalty = rescueNeed01 > 0.8 ? 0.18 : 0;
  return clamp01(momentBias + pressure01 * 0.18 + callbackOpportunity01 * 0.15 - helperPenalty);
}

function stageMoodForMoment(input: SharedChatScenePlannerInput): SharedChatSceneStageMood {
  switch (input.momentType) {
    case 'RUN_START':
      return 'TENSE_ANTICIPATION';
    case 'PRESSURE_SURGE':
    case 'BOT_ATTACK':
    case 'CASCADE_TRIGGER':
      return 'PREDATORY_SWARM';
    case 'SHIELD_BREACH':
      return 'PUBLIC_COLLAPSE';
    case 'HELPER_RESCUE':
      return 'CONTROLLED_RECOVERY';
    case 'DEAL_ROOM_STANDOFF':
      return 'CLINICAL_PRESSURE';
    case 'SOVEREIGN_APPROACH':
      return 'ASCENT_WITH_WITNESSES';
    case 'SOVEREIGN_ACHIEVED':
      return 'LEGEND_LOCK';
    case 'RUN_END':
      return 'RECKONING';
    case 'WORLD_EVENT':
      return 'WORLD_INTRUSION';
    default:
      return 'LOW_BURN_TENSION';
  }
}

function archetypeForMoment(
  input: SharedChatScenePlannerInput,
  pressure01: number,
  rescueNeed01: number,
  callbackOpportunity01: number,
): SharedChatSceneArchetype {
  switch (input.momentType) {
    case 'RUN_START':
      return pressure01 > 0.6 ? 'TRAP_SCENE' : 'FALSE_CALM_SCENE';
    case 'PRESSURE_SURGE':
      return 'TRAP_SCENE';
    case 'SHIELD_BREACH':
      return rescueNeed01 > 0.7 ? 'RESCUE_SCENE' : 'PUBLIC_HUMILIATION_SCENE';
    case 'CASCADE_TRIGGER':
      return 'TRAP_SCENE';
    case 'CASCADE_BREAK':
      return callbackOpportunity01 > 0.65 ? 'LONG_ARC_CALLBACK_SCENE' : 'COMEBACK_WITNESS_SCENE';
    case 'BOT_ATTACK':
      return 'BREACH_SCENE';
    case 'BOT_RETREAT':
      return 'COMEBACK_WITNESS_SCENE';
    case 'HELPER_RESCUE':
      return 'RESCUE_SCENE';
    case 'DEAL_ROOM_STANDOFF':
      return 'DEAL_ROOM_PRESSURE_SCENE';
    case 'SOVEREIGN_APPROACH':
      return callbackOpportunity01 > 0.68 ? 'LONG_ARC_CALLBACK_SCENE' : 'COMEBACK_WITNESS_SCENE';
    case 'SOVEREIGN_ACHIEVED':
      return 'COMEBACK_WITNESS_SCENE';
    case 'LEGEND_MOMENT':
      return 'LONG_ARC_CALLBACK_SCENE';
    case 'RUN_END':
      return 'END_OF_RUN_RECKONING_SCENE';
    case 'WORLD_EVENT':
      return 'SEASON_EVENT_INTRUSION_SCENE';
    default:
      return pressure01 > 0.7 ? 'TRAP_SCENE' : 'FALSE_CALM_SCENE';
  }
}

function selectTopAnchors(
  anchors: readonly AnchorCandidate[],
  limit: number,
): readonly AnchorCandidate[] {
  return anchors.slice(0, Math.max(0, limit));
}

function scoreHaterSpeaker(
  input: SharedChatScenePlannerInput,
  speakerId: string,
  pressure01: number,
  relationshipPressure01: number,
  crowdHeat01: number,
): SpeakerScore {
  const publicBias = String(input.primaryChannel).toUpperCase() === 'GLOBAL' ? 0.09 : 0.04;
  const score01 = clamp01(0.45 + pressure01 * 0.2 + relationshipPressure01 * 0.25 + crowdHeat01 * 0.1 + publicBias);
  return { speakerId, score01, role: 'HATER' };
}

function scoreHelperSpeaker(
  input: SharedChatScenePlannerInput,
  speakerId: string,
  rescueNeed01: number,
  silencePreference01: number,
): SpeakerScore {
  const privateBias = String(input.primaryChannel).toUpperCase() === 'DEAL_ROOM' ? 0.08 : 0.04;
  const score01 = clamp01(0.38 + rescueNeed01 * 0.34 + privateBias - silencePreference01 * 0.06);
  return { speakerId, score01, role: 'HELPER' };
}

function scoreCrowdSpeaker(
  input: SharedChatScenePlannerInput,
  crowdHeat01: number,
): SpeakerScore | null {
  const isPublic = ['GLOBAL', 'SYNDICATE'].indexOf(String(input.primaryChannel).toUpperCase()) >= 0;
  if (!isPublic) return null;
  return {
    speakerId: 'CROWD',
    score01: clamp01(0.34 + crowdHeat01 * 0.56),
    role: 'CROWD',
  };
}

function scoreCallbackSpeaker(
  anchor: AnchorCandidate,
): SpeakerScore {
  return {
    speakerId: `CALLBACK:${anchor.anchorId}`,
    score01: clamp01(0.3 + anchor.callbackWeight01 * 0.7),
    role: 'CALLBACK',
  };
}

function chooseSpeakerOrder(context: BeatBuildContext, config: ChatScenePlannerConfig): readonly SpeakerScore[] {
  const haterCandidates = safeArray(context.input.candidateBotIds)
    .map((speakerId) =>
      scoreHaterSpeaker(
        context.input,
        String(speakerId),
        context.pressure01,
        context.relationshipPressure01,
        context.crowdHeat01,
      ),
    );

  const helperCandidates = safeArray(context.input.helperIds).map((speakerId) =>
    scoreHelperSpeaker(context.input, String(speakerId), context.rescueNeed01, context.silencePreference01),
  );

  const anchors = context.chosenCallbackAnchorIds.map((anchorId) =>
    scoreCallbackSpeaker({
      anchorId,
      salience01: 1,
      callbackWeight01: 1,
      unresolved: false,
      tags: [],
    }),
  );

  const crowd = scoreCrowdSpeaker(context.input, context.crowdHeat01);
  const all = [
    ...haterCandidates,
    ...helperCandidates,
    ...(crowd ? [crowd] : []),
    ...anchors,
  ]
    .sort((a, b) => b.score01 - a.score01)
    .slice(0, config.maxChosenSpeakerIds);

  return all;
}

function shouldOpenWithSilence(
  archetype: SharedChatSceneArchetype,
  silencePreference01: number,
  rescueNeed01: number,
  config: ChatScenePlannerConfig,
): boolean {
  if (!config.enableSilenceWindows) return false;
  if (rescueNeed01 > 0.88) return false;
  if (archetype === 'PUBLIC_HUMILIATION_SCENE') return silencePreference01 > 0.62;
  if (archetype === 'END_OF_RUN_RECKONING_SCENE') return silencePreference01 > 0.55;
  if (archetype === 'FALSE_CALM_SCENE') return silencePreference01 > 0.35;
  return silencePreference01 > 0.78;
}

function roleForBeatType(
  beatType: SharedChatSceneBeatType,
  context: BeatBuildContext,
): string | undefined {
  switch (beatType) {
    case 'SYSTEM_NOTICE':
      return 'SYSTEM';
    case 'HATER_ENTRY':
      for (let i = 0; i < context.chosenSpeakerIds.length; i += 1) {
        const id = context.chosenSpeakerIds[i];
        if (id !== 'CROWD' && String(id).indexOf('CALLBACK:') !== 0) {
          return id;
        }
      }
      return undefined;
    case 'CROWD_SWARM':
      return context.chosenSpeakerIds.indexOf('CROWD') >= 0 ? 'CROWD' : undefined;
    case 'HELPER_INTERVENTION':
      return safeArray(context.input.helperIds)[0];
    case 'PLAYER_REPLY_WINDOW':
      return 'PLAYER';
    case 'SILENCE':
      return undefined;
    case 'REVEAL':
      return context.chosenCallbackAnchorIds.length ? `CALLBACK:${context.chosenCallbackAnchorIds[0]}` : 'SYSTEM';
    case 'POST_BEAT_ECHO':
      return context.chosenSpeakerIds[1] ?? context.chosenSpeakerIds[0];
    default:
      return undefined;
  }
}

function buildBeat(
  beatType: SharedChatSceneBeatType,
  order: number,
  context: BeatBuildContext,
  config: ChatScenePlannerConfig,
): SharedChatSceneBeat {
  const roleOrSpeaker = roleForBeatType(beatType, context);
  const beatId = `${context.input.momentId}:BEAT:${('0' + String(order + 1)).slice(-2)}:${beatType}`;
  const baseDelay =
    beatType === 'SILENCE'
      ? Math.round(config.silenceBeatFloorMs + (config.silenceBeatCeilingMs - config.silenceBeatFloorMs) * context.silencePreference01)
      : beatType === 'CROWD_SWARM'
        ? Math.round(config.baseBeatDelayMs * 0.5)
        : beatType === 'PLAYER_REPLY_WINDOW'
          ? Math.round(config.baseBeatDelayMs * 0.75)
          : Math.round(config.baseBeatDelayMs);

  const tags = uniq([
    normalizeTag(context.input.momentType),
    normalizeTag(context.archetype),
    normalizeTag(context.stageMood),
    ...(beatType === 'REVEAL' ? ['CALLBACK'] : []),
    ...(beatType === 'HELPER_INTERVENTION' ? ['RESCUE'] : []),
    ...(beatType === 'CROWD_SWARM' ? ['PUBLIC'] : []),
  ]);

  const beat: SharedChatSceneBeat = {
    beatId,
    beatType,
    order,
    channelId: context.input.primaryChannel,
    delayMs: baseDelay + order * 120,
    speakerId: roleOrSpeaker,
    tags,
    meta: {
      stageMood: context.stageMood,
      archetype: context.archetype,
      pressure01: context.pressure01,
      relationshipPressure01: context.relationshipPressure01,
      callbackOpportunity01: context.callbackOpportunity01,
      rescueNeed01: context.rescueNeed01,
      crowdHeat01: context.crowdHeat01,
      silencePreference01: context.silencePreference01,
    } as any,
  };

  return beat;
}

function branchPointsForMoment(input: SharedChatScenePlannerInput): readonly string[] {
  switch (input.momentType) {
    case 'DEAL_ROOM_STANDOFF':
      return ['PLAYER_ACCEPTS', 'PLAYER_STALLS', 'PLAYER_BLUFFS', 'PLAYER_WALKS'];
    case 'BOT_ATTACK':
      return ['PLAYER_COUNTERS', 'PLAYER_IGNORES', 'PLAYER_RETREATS'];
    case 'SHIELD_BREACH':
      return ['HELPER_INTERVENES', 'CROWD_SWARMS', 'PLAYER_COLLAPSES'];
    case 'SOVEREIGN_APPROACH':
      return ['PLAYER_SECURES', 'PLAYER_CHOKES', 'HATER_INTERRUPTS'];
    case 'RUN_END':
      return ['DEBRIEF', 'MOCKERY', 'FORESHADOW'];
    default:
      return ['CONTINUE'];
  }
}

function escalationPointsForBeats(beats: readonly SharedChatSceneBeat[]): readonly number[] {
  const indexes: number[] = [];
  for (const beat of beats) {
    if (beat.beatType === 'HATER_ENTRY' || beat.beatType === 'CROWD_SWARM' || beat.beatType === 'REVEAL') {
      indexes.push(beat.order);
    }
  }
  return indexes;
}

function silenceWindowsForBeats(beats: readonly SharedChatSceneBeat[]): readonly number[] {
  return beats.filter((beat) => beat.beatType === 'SILENCE').map((beat) => beat.order);
}

function semanticClusterIdsForMoment(input: SharedChatScenePlannerInput): readonly string[] {
  const out = uniq([
    `MOMENT:${normalizeTag(input.momentType)}`,
    `CHANNEL:${normalizeTag(String(input.primaryChannel))}`,
    ...(safeArray(input.worldTags).map((tag) => `WORLD:${normalizeTag(String(tag))}`)),
  ]);
  return out;
}

function buildSceneBeats(
  context: BeatBuildContext,
  config: ChatScenePlannerConfig,
): readonly SharedChatSceneBeat[] {
  const beats: SharedChatSceneBeatType[] = [];

  if (shouldOpenWithSilence(context.archetype, context.silencePreference01, context.rescueNeed01, config)) {
    beats.push('SILENCE');
  }

  beats.push('SYSTEM_NOTICE');

  const shouldInjectHater =
    context.relationshipPressure01 > 0.3 ||
    ['BREACH_SCENE', 'TRAP_SCENE', 'PUBLIC_HUMILIATION_SCENE', 'DEAL_ROOM_PRESSURE_SCENE'].indexOf(context.archetype) >= 0;
  if (shouldInjectHater) {
    beats.push('HATER_ENTRY');
  }

  const shouldInjectCrowd =
    context.crowdHeat01 > 0.52 &&
    ['GLOBAL', 'SYNDICATE'].indexOf(String(context.input.primaryChannel).toUpperCase()) >= 0;
  if (shouldInjectCrowd) {
    beats.push('CROWD_SWARM');
  }

  const shouldReveal =
    context.callbackOpportunity01 > 0.58 ||
    context.archetype === 'LONG_ARC_CALLBACK_SCENE' ||
    context.archetype === 'END_OF_RUN_RECKONING_SCENE';
  if (shouldReveal) {
    beats.push('REVEAL');
  }

  const shouldRescue =
    context.rescueNeed01 > 0.55 ||
    context.archetype === 'RESCUE_SCENE';
  if (shouldRescue) {
    beats.push('HELPER_INTERVENTION');
  }

  if (config.allowPlayerReplyWindow) {
    beats.push('PLAYER_REPLY_WINDOW');
  }

  if (config.allowPostBeatEcho && (context.crowdHeat01 > 0.45 || context.relationshipPressure01 > 0.55)) {
    beats.push('POST_BEAT_ECHO');
  }

  return beats
    .slice(0, config.maxBeats)
    .map((beatType, index) => buildBeat(beatType, index, context, config));
}

function expectedDurationMs(beats: readonly SharedChatSceneBeat[]): number {
  return beats.reduce((sum, beat) => sum + (typeof beat.delayMs === 'number' ? beat.delayMs : 0), 0);
}

function planningTags(
  input: SharedChatScenePlannerInput,
  archetype: SharedChatSceneArchetype,
  stageMood: SharedChatSceneStageMood,
  reasons: readonly ChatScenePlannerReason[],
  chosenAnchors: readonly string[],
): readonly string[] {
  return uniq([
    normalizeTag(input.momentType),
    normalizeTag(String(input.primaryChannel)),
    normalizeTag(archetype),
    normalizeTag(stageMood),
    ...reasons.map((reason) => normalizeTag(reason)),
    ...chosenAnchors.map((anchorId) => `ANCHOR:${normalizeTag(anchorId)}`),
    ...safeArray(input.worldTags).map((tag) => `WORLD:${normalizeTag(String(tag))}`),
  ]);
}

/* ========================================================================== *
 * MARK: Planner
 * ========================================================================== */

export class ChatScenePlanner {
  private readonly config: ChatScenePlannerConfig;

  public constructor(config?: Partial<ChatScenePlannerConfig>) {
    this.config = { ...DEFAULT_CHAT_SCENE_PLANNER_CONFIG, ...(config ?? {}) };
  }

  public plan(input: SharedChatScenePlannerInput): ChatScenePlannerDecisionWithTelemetry {
    const pressure01 = pressureScore(input);
    const relationshipPressure01 = relationshipPressure(input);
    const anchors = anchorSalience(input);
    const callbackOpportunity01 = inferCallbackOpportunity(input, anchors);
    const rescueNeed01 = helperNeed(input, pressure01);
    const crowdHeat01 = inferCrowdHeat(input, pressure01);
    const silencePreference01 = inferSilencePreference(input, pressure01, callbackOpportunity01, rescueNeed01);
    const stageMood = stageMoodForMoment(input);
    const archetype = archetypeForMoment(input, pressure01, rescueNeed01, callbackOpportunity01);

    const chosenAnchors = selectTopAnchors(anchors, this.config.maxChosenCallbackAnchorIds);
    const chosenCallbackAnchorIds = chosenAnchors.map((anchor) => anchor.anchorId);

    const provisionalContext: BeatBuildContext = {
      input,
      archetype,
      stageMood,
      pressure01,
      relationshipPressure01,
      callbackOpportunity01,
      rescueNeed01,
      crowdHeat01,
      silencePreference01,
      chosenSpeakerIds: [],
      chosenCallbackAnchorIds,
    };

    const chosenSpeakerScores = chooseSpeakerOrder(provisionalContext, this.config);
    const chosenSpeakerIds = chosenSpeakerScores.map((score) => score.speakerId);

    const context: BeatBuildContext = {
      ...provisionalContext,
      chosenSpeakerIds,
    };

    const reasons: ChatScenePlannerReason[] = ['MOMENT_ARCHETYPE_MATCH'];

    if (pressure01 >= 0.6) reasons.push('PRESSURE_ESCALATION');
    if (relationshipPressure01 >= 0.45) reasons.push('RELATIONSHIP_PRESSURE');
    if (rescueNeed01 >= 0.58) reasons.push('HELPER_RESCUE_NEED');
    if (callbackOpportunity01 >= 0.5) reasons.push('CALLBACK_AVAILABLE');
    if (crowdHeat01 >= 0.55) reasons.push('CROWD_AMPLIFICATION');
    if (silencePreference01 >= 0.6) reasons.push('SILENCE_IS_STRONGER');
    if (archetype === 'FALSE_CALM_SCENE') reasons.push('FALSE_CALM_WINDOW');
    if (['PUBLIC_HUMILIATION_SCENE', 'COMEBACK_WITNESS_SCENE', 'LONG_ARC_CALLBACK_SCENE'].indexOf(archetype) >= 0) {
      reasons.push('PUBLIC_WITNESS_REQUIRED');
    }
    if (archetype === 'DEAL_ROOM_PRESSURE_SCENE') reasons.push('DEALROOM_PREDATORY_TONE');
    if (archetype === 'END_OF_RUN_RECKONING_SCENE') reasons.push('POST_RUN_RECKONING');
    if (archetype === 'SEASON_EVENT_INTRUSION_SCENE') reasons.push('WORLD_EVENT_INTRUSION');
    if (input.momentType === 'LEGEND_MOMENT' || input.momentType === 'SOVEREIGN_ACHIEVED') {
      reasons.push('LEGEND_ESCALATION');
    }
    if (safeArray(input.unresolvedMomentIds).length > 0) reasons.push('UNRESOLVED_BUSINESS');
    if (safeArray(input.carriedPersonaIds).length > 0) reasons.push('CARRYOVER_CONTINUITY');

    const beats = buildSceneBeats(context, this.config);

    const sceneId = `SCENE:${input.momentId}`;
    const planId = `${sceneId}:PLAN`;
    const scene: SharedChatScene = {
      sceneId,
      playerId: input.playerId,
      roomId: input.roomId,
      momentId: input.momentId,
      momentType: input.momentType,
      primaryChannelId: input.primaryChannel,
      archetype,
      stageMood,
      branchPoints: branchPointsForMoment(input),
      beats,
      tags: planningTags(input, archetype, stageMood, reasons, chosenCallbackAnchorIds),
      meta: {
        pressure01,
        relationshipPressure01,
        rescueNeed01,
        callbackOpportunity01,
        crowdHeat01,
        silencePreference01,
        chosenSpeakerIds,
        chosenCallbackAnchorIds,
        carriedPersonaIds: safeArray(input.carriedPersonaIds),
        pendingRevealPayloadIds: safeArray(input.pendingRevealPayloadIds),
      } as any,
    };

    const plan: SharedChatScenePlan = {
      planId,
      scene,
      createdAt: input.now,
      updatedAt: input.now,
      escalationPoints: escalationPointsForBeats(beats),
      silenceWindows: silenceWindowsForBeats(beats),
      semanticClusterIds: semanticClusterIdsForMoment(input),
      meta: {
        planner: 'ChatScenePlanner',
        version: 1,
      } as any,
    };

    const telemetry: ChatScenePlannerTelemetry = {
      pressure01,
      relationshipPressure01,
      rescueNeed01,
      callbackOpportunity01,
      crowdHeat01,
      silencePreference01,
      expectedDurationMs: expectedDurationMs(beats),
      expectedVisibleBeats: beats.filter((beat) => beat.beatType !== 'SILENCE').length,
      expectedShadowBeats: beats.filter((beat) => beat.beatType === 'SILENCE' || beat.beatType === 'REVEAL').length,
      stageMood,
      archetype,
      reasons,
    };

    return {
      plan,
      chosenSpeakerIds,
      chosenCallbackAnchorIds,
      chosenTags: planningTags(input, archetype, stageMood, reasons, chosenCallbackAnchorIds).slice(
        0,
        this.config.maxChosenTags,
      ),
      telemetry,
    };
  }
}

/* ========================================================================== *
 * MARK: Convenience exports
 * ========================================================================== */

export function createChatScenePlanner(config?: Partial<ChatScenePlannerConfig>): ChatScenePlanner {
  return new ChatScenePlanner(config);
}

export function planChatScene(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): ChatScenePlannerDecisionWithTelemetry {
  return new ChatScenePlanner(config).plan(input);
}

export function projectSceneArchetype(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): SharedChatSceneArchetype {
  return planChatScene(input, config).telemetry.archetype;
}

export function projectSceneStageMood(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): SharedChatSceneStageMood {
  return planChatScene(input, config).telemetry.stageMood;
}

export function projectSceneTelemetry(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): ChatScenePlannerTelemetry {
  return planChatScene(input, config).telemetry;
}
