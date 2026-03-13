// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/npc/HelperResponsePlanner.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT HELPER RESPONSE PLANNER
 * FILE: pzo-web/src/engines/chat/npc/HelperResponsePlanner.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical planner for frontend-side helper interventions in the new chat
 * engine lane.
 *
 * Helpers are not generic encouragement bots. They are distinct strategic
 * support personas with different roles inside the run:
 *
 * - MENTOR stabilizes and sharpens execution,
 * - INSIDER reveals systems and pattern edges,
 * - SURVIVOR rescues the player from collapse spirals,
 * - RIVAL drives competitive momentum without going hostile,
 * - ARCHIVIST contextualizes, interprets, and remembers.
 *
 * This planner translates moment-to-moment run pressure, learning signals,
 * helper metadata, and channel identity into high-quality helper intervention
 * plans that the frontend can stage instantly.
 *
 * Design laws
 * -----------
 * - cold-start players receive more timely helper coverage
 * - rescue moments must feel precise, not spammy
 * - helpers must not drown out player agency
 * - helper selection must remain channel-aware and mode-aware
 * - the plan must be rich enough for ChatNpcDirector and UI layers to render
 *   different helper behaviors without rebuilding the planner each screen
 *
 * Long-term authority
 * -------------------
 * /shared/contracts/chat
 * /pzo-web/src/engines/chat
 * /pzo-web/src/components/chat
 * /backend/src/game/engine/chat
 * /pzo-server/src/chat
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  getAllHelperRegistryEntries,
  getHelperRegistryEntry,
  getMentorFallbackLine,
  helperCanSpeakInChannel,
  pickHelperDialogueLine,
  type HelperCharacterId,
  type HelperDialogueSelectionInput,
  type HelperRegistryEntry,
  type HaterDialogueContext,
  type HaterDialogueLine,
  type FrontendRunMode,
} from './HelperDialogueRegistry';

export type ChatChannelId =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'LOBBY'
  | 'NPC_SHADOW'
  | 'RESCUE_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'LIVEOPS_SHADOW';

export type HelperDeliveryLane = 'PUBLIC' | 'PRIVATE' | 'SHADOW' | 'BANNER';
export type HelperPlanReason =
  | 'trigger-match'
  | 'cold-start-boost'
  | 'rescue-window'
  | 'coach-window'
  | 'morale-window'
  | 'intel-window'
  | 'postrun-window'
  | 'cooldown-suppressed'
  | 'channel-suppressed'
  | 'repeat-suppressed'
  | 'fallback';

export interface HelperPlannerLearningProfile {
  readonly totalRuns?: number;
  readonly angerRate?: number;
  readonly helpSeekRate?: number;
  readonly trollRate?: number;
  readonly flexRate?: number;
  readonly silenceRate?: number;
  readonly preferredAggressionLevel?: number;
  readonly botAffinityScores?: Readonly<Record<string, number>>;
}

export interface HelperPlannerRunSnapshot {
  readonly tick: number;
  readonly runMode: FrontendRunMode;
  readonly channelId: ChatChannelId;
  readonly playerIdleTicks: number;
  readonly playerTiltScore: number;
  readonly playerConfidenceScore: number;
  readonly nearBankruptcy: boolean;
  readonly shieldBrokenThisWindow: boolean;
  readonly timePressure: number;
  readonly nearSovereignty: boolean;
  readonly playerLost: boolean;
  readonly playerComebackThisWindow: boolean;
  readonly playerIncomeRoseThisWindow: boolean;
  readonly playerPlayedCardThisWindow: boolean;
  readonly playerTriggeredCascadeThisWindow: boolean;
  readonly playerFirstIncomeThisRun: boolean;
  readonly rescueBannerOpen?: boolean;
  readonly postRunPhase?: 'none' | 'debrief' | 'memorial' | 'victory';
  readonly usedLineTexts?: ReadonlySet<string>;
}

export interface HelperPlannerResponseSnapshot {
  readonly classifiedContext?:
    | 'PLAYER_RESPONSE_ANGRY'
    | 'PLAYER_RESPONSE_TROLL'
    | 'PLAYER_RESPONSE_FLEX'
    | null;
  readonly sentimentIntensity?: number;
}

export interface HelperResponsePlannerInput {
  readonly run: HelperPlannerRunSnapshot;
  readonly learning?: HelperPlannerLearningProfile;
  readonly response?: HelperPlannerResponseSnapshot;
  readonly preferredHelperIds?: readonly HelperCharacterId[];
  readonly suppressedHelperIds?: readonly HelperCharacterId[];
  readonly rng?: () => number;
}

export interface HelperContextCandidate {
  readonly context: HaterDialogueContext;
  readonly urgency: number;
  readonly reasons: readonly HelperPlanReason[];
}

export interface HelperPlannerScoreBreakdown {
  readonly triggerFit: number;
  readonly coldStartFit: number;
  readonly rescueFit: number;
  readonly coachingFit: number;
  readonly moraleFit: number;
  readonly intelFit: number;
  readonly channelFit: number;
  readonly modeFit: number;
  readonly confidenceFit: number;
  readonly cooldownPenalty: number;
  readonly total: number;
}

export interface HelperResponsePlan {
  readonly helperId: HelperCharacterId;
  readonly displayName: string;
  readonly context: HaterDialogueContext;
  readonly deliveryLane: HelperDeliveryLane;
  readonly delayMs: number;
  readonly line: HaterDialogueLine | null;
  readonly score: HelperPlannerScoreBreakdown;
  readonly reasons: readonly HelperPlanReason[];
}

export interface HelperResponsePlannerConfig {
  readonly maxPlansPerPass: number;
  readonly baseCooldownMs: number;
  readonly coldStartRunBoundary: number;
  readonly rescueBannerThreshold: number;
  readonly tiltRescueThreshold: number;
  readonly confidenceRivalThreshold: number;
  readonly dealRoomSuppressionScalar: number;
  readonly globalPublicScalar: number;
  readonly whisperSupportScalar: number;
}

const DEFAULT_CONFIG: HelperResponsePlannerConfig = Object.freeze({
  maxPlansPerPass: 2,
  baseCooldownMs: 3_500,
  coldStartRunBoundary: 5,
  rescueBannerThreshold: 0.72,
  tiltRescueThreshold: 0.66,
  confidenceRivalThreshold: 0.74,
  dealRoomSuppressionScalar: 0.78,
  globalPublicScalar: 1.08,
  whisperSupportScalar: 1.12,
});

const HELPER_CONTEXT_PRIORITY: Readonly<Record<HaterDialogueContext, number>> = Object.freeze({
  GAME_START: 0.56,
  LOBBY_TAUNT: 0.40,
  PLAYER_FIRST_INCOME: 0.52,
  PLAYER_INCOME_UP: 0.58,
  PLAYER_CARD_PLAY: 0.49,
  PLAYER_SHIELD_BREAK: 0.78,
  PLAYER_NEAR_BANKRUPTCY: 0.97,
  PLAYER_IDLE: 0.61,
  PLAYER_COMEBACK: 0.73,
  PLAYER_RESPONSE_ANGRY: 0.76,
  PLAYER_RESPONSE_TROLL: 0.42,
  PLAYER_RESPONSE_FLEX: 0.54,
  BOT_DEFEATED: 0.48,
  BOT_WINNING: 0.66,
  TIME_PRESSURE: 0.74,
  CASCADE_CHAIN: 0.63,
  NEAR_SOVEREIGNTY: 0.79,
  PLAYER_LOST: 0.98,
});

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function resolveModeAffinity(entry: HelperRegistryEntry, runMode: FrontendRunMode): number {
  switch (runMode) {
    case 'solo':
      return safeNumber(entry.modeAffinity.solo, 0.5);
    case 'asymmetric-pvp':
      return safeNumber(entry.modeAffinity.asymmetricPvp, safeNumber(entry.modeAffinity.solo, 0.5));
    case 'co-op':
      return safeNumber(entry.modeAffinity.coop, safeNumber(entry.modeAffinity.solo, 0.5));
    case 'ghost':
      return safeNumber(entry.modeAffinity.ghost, safeNumber(entry.modeAffinity.solo, 0.5));
    default:
      return safeNumber(entry.modeAffinity.solo, 0.5);
  }
}

function computeColdStartScalar(
  entry: HelperRegistryEntry,
  learning: HelperPlannerLearningProfile | undefined,
): number {
  const totalRuns = safeNumber(learning?.totalRuns, 0);
  const boost = Math.max(1, safeNumber(entry.personality.coldStartBoost, 1));

  if (totalRuns <= 0) return boost;
  if (totalRuns < 3) return Math.max(1, boost * 0.88);
  if (totalRuns < 5) return Math.max(1, boost * 0.72);
  if (totalRuns < 10) return Math.max(1, boost * 0.42);
  return 1;
}

function buildContextCandidates(input: HelperResponsePlannerInput): readonly HelperContextCandidate[] {
  const { run, response } = input;
  const candidates: HelperContextCandidate[] = [];

  if (run.tick <= 3) {
    candidates.push({ context: run.channelId === 'LOBBY' ? 'LOBBY_TAUNT' : 'GAME_START', urgency: 0.64, reasons: Object.freeze(['trigger-match']) });
  }
  if (run.playerFirstIncomeThisRun) {
    candidates.push({ context: 'PLAYER_FIRST_INCOME', urgency: 0.64, reasons: Object.freeze(['trigger-match']) });
  }
  if (run.playerIncomeRoseThisWindow) {
    candidates.push({ context: 'PLAYER_INCOME_UP', urgency: 0.61, reasons: Object.freeze(['trigger-match']) });
  }
  if (run.playerPlayedCardThisWindow) {
    candidates.push({ context: 'PLAYER_CARD_PLAY', urgency: 0.52, reasons: Object.freeze(['intel-window']) });
  }
  if (run.playerTriggeredCascadeThisWindow) {
    candidates.push({ context: 'CASCADE_CHAIN', urgency: 0.69, reasons: Object.freeze(['intel-window']) });
  }
  if (run.shieldBrokenThisWindow) {
    candidates.push({ context: 'PLAYER_SHIELD_BREAK', urgency: 0.86, reasons: Object.freeze(['rescue-window']) });
  }
  if (run.nearBankruptcy) {
    candidates.push({ context: 'PLAYER_NEAR_BANKRUPTCY', urgency: 0.98, reasons: Object.freeze(['rescue-window']) });
  }
  if (run.playerIdleTicks >= 3) {
    candidates.push({ context: 'PLAYER_IDLE', urgency: 0.62 + clamp01(run.playerIdleTicks / 18) * 0.16, reasons: Object.freeze(['coach-window']) });
  }
  if (run.playerComebackThisWindow) {
    candidates.push({ context: 'PLAYER_COMEBACK', urgency: 0.76, reasons: Object.freeze(['morale-window']) });
  }
  if (run.timePressure >= 0.67) {
    candidates.push({ context: 'TIME_PRESSURE', urgency: 0.81, reasons: Object.freeze(['coach-window']) });
  }
  if (run.nearSovereignty) {
    candidates.push({ context: 'NEAR_SOVEREIGNTY', urgency: 0.84, reasons: Object.freeze(['coach-window']) });
  }
  if (run.playerLost) {
    candidates.push({ context: 'PLAYER_LOST', urgency: 1.0, reasons: Object.freeze(['postrun-window']) });
  }
  if (response?.classifiedContext) {
    const reason: HelperPlanReason = response.classifiedContext === 'PLAYER_RESPONSE_ANGRY'
      ? 'rescue-window'
      : response.classifiedContext === 'PLAYER_RESPONSE_FLEX'
        ? 'coach-window'
        : 'trigger-match';
    candidates.push({
      context: response.classifiedContext,
      urgency: 0.56 + clamp01(response.sentimentIntensity ?? 0) * 0.22,
      reasons: Object.freeze([reason]),
    });
  }

  return Object.freeze(candidates);
}

function dedupeCandidates(candidates: readonly HelperContextCandidate[]): readonly HelperContextCandidate[] {
  const best = new Map<HaterDialogueContext, HelperContextCandidate>();
  for (const candidate of candidates) {
    const existing = best.get(candidate.context);
    if (!existing || candidate.urgency > existing.urgency) best.set(candidate.context, candidate);
  }
  return Object.freeze([...best.values()]);
}

function computeCooldownPenalty(entry: HelperRegistryEntry, input: HelperResponsePlannerInput): number {
  const silenceRate = clamp01(safeNumber(input.learning?.silenceRate, 0));
  return (1 - silenceRate) * (0.08 + entry.personality.frequency * 0.12);
}

function computeDeliveryLane(
  entry: HelperRegistryEntry,
  context: HaterDialogueContext,
  input: HelperResponsePlannerInput,
): HelperDeliveryLane {
  if (input.run.rescueBannerOpen && (context === 'PLAYER_NEAR_BANKRUPTCY' || context === 'PLAYER_LOST')) {
    return 'BANNER';
  }
  if (input.run.channelId === 'DEAL_ROOM') {
    return entry.channelPolicy.mayWhisperPrivately ? 'PRIVATE' : 'PUBLIC';
  }
  if (input.run.channelId === 'NPC_SHADOW' || input.run.channelId === 'RESCUE_SHADOW') {
    return 'SHADOW';
  }
  if (context === 'PLAYER_NEAR_BANKRUPTCY' || context === 'PLAYER_RESPONSE_ANGRY') {
    return entry.channelPolicy.mayWhisperPrivately ? 'PRIVATE' : 'PUBLIC';
  }
  return 'PUBLIC';
}

function computeDelayMs(
  entry: HelperRegistryEntry,
  context: HaterDialogueContext,
  lane: HelperDeliveryLane,
  rng: () => number,
): number {
  const profile = entry.voiceprint.delayProfileMs;
  const floor = safeNumber(profile?.[0], lane === 'PRIVATE' ? 350 : 700);
  const ceil = safeNumber(profile?.[1], lane === 'PRIVATE' ? 1_600 : 2_700);
  let delay = floor + Math.floor(rng() * Math.max(1, ceil - floor + 1));

  if (context === 'PLAYER_NEAR_BANKRUPTCY' || context === 'PLAYER_LOST') delay *= 0.50;
  if (context === 'PLAYER_SHIELD_BREAK' || context === 'TIME_PRESSURE') delay *= 0.66;
  if (context === 'NEAR_SOVEREIGNTY') delay *= 0.74;
  if (lane === 'BANNER') delay *= 0.42;
  if (lane === 'SHADOW') delay *= 0.84;

  return Math.max(90, Math.floor(delay));
}

function buildSelectionInput(
  helperId: HelperCharacterId,
  context: HaterDialogueContext,
  input: HelperResponsePlannerInput,
  rng: () => number,
): HelperDialogueSelectionInput {
  return {
    helperId,
    requestedContext: context,
    currentTick: input.run.tick,
    currentRunCount: safeNumber(input.learning?.totalRuns, 0),
    channelId: input.run.channelId,
    runMode: input.run.runMode,
    usedLineTexts: input.run.usedLineTexts,
    playerSilenceTicks: input.run.playerIdleTicks,
    playerTiltScore: input.run.playerTiltScore,
    playerConfidenceScore: input.run.playerConfidenceScore,
    rng,
  };
}

function computeScore(
  entry: HelperRegistryEntry,
  candidate: HelperContextCandidate,
  input: HelperResponsePlannerInput,
): HelperPlannerScoreBreakdown {
  const triggerFit = HELPER_CONTEXT_PRIORITY[candidate.context] + candidate.urgency * 0.48;
  const coldStartFit = (computeColdStartScalar(entry, input.learning) - 1) * 0.32;

  let rescueFit = 0;
  if (candidate.context === 'PLAYER_NEAR_BANKRUPTCY' || candidate.context === 'PLAYER_LOST' || candidate.context === 'PLAYER_SHIELD_BREAK') {
    rescueFit += entry.intervention.rescueBias * 0.34;
  }
  if (input.run.playerTiltScore >= DEFAULT_CONFIG.tiltRescueThreshold) {
    rescueFit += entry.intervention.rescueBias * 0.16;
  }
  if (input.run.rescueBannerOpen) {
    rescueFit += entry.intervention.rescueBias * 0.14;
  }

  let coachingFit = 0;
  if (candidate.context === 'PLAYER_IDLE' || candidate.context === 'TIME_PRESSURE' || candidate.context === 'NEAR_SOVEREIGNTY') {
    coachingFit += entry.intervention.coachingBias * 0.28;
  }
  if (input.run.playerConfidenceScore >= 0.55) {
    coachingFit += entry.intervention.coachingBias * 0.08;
  }

  let moraleFit = 0;
  if (candidate.context === 'PLAYER_COMEBACK' || candidate.context === 'PLAYER_FIRST_INCOME' || candidate.context === 'PLAYER_INCOME_UP') {
    moraleFit += entry.intervention.moraleBias * 0.24;
  }
  if (candidate.context === 'PLAYER_RESPONSE_FLEX' && entry.helperId === 'RIVAL') {
    moraleFit += entry.intervention.rivalryBias * 0.22;
  }

  let intelFit = 0;
  if (candidate.context === 'PLAYER_CARD_PLAY' || candidate.context === 'CASCADE_CHAIN') {
    intelFit += entry.intervention.intelBias * 0.26;
  }
  if (entry.helperId === 'ARCHIVIST') {
    intelFit += entry.intervention.loreBias * 0.10;
  }

  let channelFit = helperCanSpeakInChannel(entry.helperId, input.run.channelId)
    ? input.run.channelId === 'GLOBAL'
      ? 0.12
      : input.run.channelId === 'SYNDICATE'
        ? 0.10
        : input.run.channelId === 'DEAL_ROOM'
          ? 0.06
          : 0.11
    : -0.40;
  if (input.run.channelId === 'DEAL_ROOM') channelFit *= DEFAULT_CONFIG.dealRoomSuppressionScalar;
  if (input.run.channelId === 'GLOBAL') channelFit *= DEFAULT_CONFIG.globalPublicScalar;

  const modeFit = resolveModeAffinity(entry, input.run.runMode) * 0.14;
  const confidenceFit =
    input.run.playerConfidenceScore >= DEFAULT_CONFIG.confidenceRivalThreshold && entry.helperId === 'RIVAL'
      ? 0.18
      : clamp01(input.run.playerConfidenceScore) * entry.intervention.coachingBias * 0.06;

  const cooldownPenalty = computeCooldownPenalty(entry, input);
  const total = triggerFit + coldStartFit + rescueFit + coachingFit + moraleFit + intelFit + channelFit + modeFit + confidenceFit - cooldownPenalty;

  return Object.freeze({
    triggerFit,
    coldStartFit,
    rescueFit,
    coachingFit,
    moraleFit,
    intelFit,
    channelFit,
    modeFit,
    confidenceFit,
    cooldownPenalty,
    total,
  });
}

function sortPlans(plans: readonly HelperResponsePlan[]): readonly HelperResponsePlan[] {
  return Object.freeze([...plans].sort((a, b) => b.score.total - a.score.total));
}

export class HelperResponsePlanner {
  private readonly config: HelperResponsePlannerConfig;

  constructor(config?: Partial<HelperResponsePlannerConfig>) {
    this.config = Object.freeze({ ...DEFAULT_CONFIG, ...(config ?? {}) });
  }

  public plan(input: HelperResponsePlannerInput): readonly HelperResponsePlan[] {
    const rng = input.rng ?? Math.random;
    const candidates = dedupeCandidates(buildContextCandidates(input));
    const suppressed = new Set<HelperCharacterId>(input.suppressedHelperIds ?? []);
    const plans: HelperResponsePlan[] = [];

    for (const entry of getAllHelperRegistryEntries()) {
      if (suppressed.has(entry.helperId)) continue;

      for (const candidate of candidates) {
        if (!helperCanSpeakInChannel(entry.helperId, input.run.channelId)) continue;
        const score = computeScore(entry, candidate, input);
        if (score.total <= 0) continue;

        const selection = pickHelperDialogueLine(
          buildSelectionInput(entry.helperId, candidate.context, input, rng),
        );

        const line = selection.line ?? Object.freeze({
          text: getMentorFallbackLine(candidate.context),
          weight: 1,
          tags: Object.freeze(['planner-fallback', 'mentor-fallback']),
        });

        const deliveryLane = computeDeliveryLane(entry, candidate.context, input);
        const delayMs = computeDelayMs(entry, candidate.context, deliveryLane, rng);

        const reasons = new Set<HelperPlanReason>(candidate.reasons);
        if (computeColdStartScalar(entry, input.learning) > 1) reasons.add('cold-start-boost');
        if (candidate.context === 'PLAYER_NEAR_BANKRUPTCY' || candidate.context === 'PLAYER_LOST') reasons.add('rescue-window');
        if (candidate.context === 'PLAYER_IDLE' || candidate.context === 'TIME_PRESSURE' || candidate.context === 'NEAR_SOVEREIGNTY') reasons.add('coach-window');
        if (candidate.context === 'PLAYER_COMEBACK' || candidate.context === 'PLAYER_INCOME_UP') reasons.add('morale-window');
        if (candidate.context === 'PLAYER_CARD_PLAY' || candidate.context === 'CASCADE_CHAIN') reasons.add('intel-window');
        if (candidate.context === 'PLAYER_LOST') reasons.add('postrun-window');
        if (selection.line === null) reasons.add('fallback');

        plans.push(Object.freeze({
          helperId: entry.helperId,
          displayName: entry.displayName,
          context: candidate.context,
          deliveryLane,
          delayMs,
          line,
          score,
          reasons: Object.freeze([...reasons]),
        }));
      }
    }

    return sortPlans(plans).slice(0, this.config.maxPlansPerPass);
  }

  public planForSingleHelper(
    helperId: HelperCharacterId,
    input: HelperResponsePlannerInput,
  ): HelperResponsePlan | null {
    const entry = getHelperRegistryEntry(helperId);
    const planner = new HelperResponsePlanner({ ...this.config, maxPlansPerPass: 12 });
    const plans = planner.plan({
      ...input,
      preferredHelperIds: Object.freeze([helperId]),
      suppressedHelperIds: Object.freeze(
        (input.suppressedHelperIds ?? []).filter((candidate) => candidate !== helperId),
      ),
    });

    return plans.find((plan) => plan.helperId === entry.helperId) ?? null;
  }

  public inferDominantContext(input: HelperResponsePlannerInput): HaterDialogueContext | null {
    const candidates = dedupeCandidates(buildContextCandidates(input))
      .sort((a, b) => b.urgency - a.urgency);
    return candidates[0]?.context ?? null;
  }

  public listBestHelpersForContext(
    context: HaterDialogueContext,
    input: Omit<HelperResponsePlannerInput, 'response'>,
  ): readonly HelperCharacterId[] {
    const plans = this.plan({
      ...input,
      response: undefined,
      run: {
        ...input.run,
      },
    }).filter((plan) => plan.context === context);

    return Object.freeze(plans.map((plan) => plan.helperId));
  }

  public explainSuppression(
    helperId: HelperCharacterId,
    input: HelperResponsePlannerInput,
  ): readonly HelperPlanReason[] {
    const entry = getHelperRegistryEntry(helperId);
    const reasons: HelperPlanReason[] = [];

    if (!helperCanSpeakInChannel(entry.helperId, input.run.channelId)) {
      reasons.push('channel-suppressed');
    }

    const context = this.inferDominantContext(input);
    if (!context) {
      reasons.push('fallback');
      return Object.freeze(reasons);
    }

    const selection = pickHelperDialogueLine(
      buildSelectionInput(entry.helperId, context, input, input.rng ?? Math.random),
    );
    if (!selection.line) reasons.push('repeat-suppressed');

    const score = computeScore(entry, { context, urgency: 1, reasons: Object.freeze(['trigger-match']) }, input);
    if (score.total <= 0) reasons.push('cooldown-suppressed');

    if (computeColdStartScalar(entry, input.learning) > 1) reasons.push('cold-start-boost');
    if (reasons.length === 0) reasons.push('trigger-match');
    return Object.freeze(reasons);
  }
}

export const helperResponsePlanner = Object.freeze(new HelperResponsePlanner());

export function planHelperResponses(
  input: HelperResponsePlannerInput,
): readonly HelperResponsePlan[] {
  return helperResponsePlanner.plan(input);
}

export function planSingleHelperResponse(
  helperId: HelperCharacterId,
  input: HelperResponsePlannerInput,
): HelperResponsePlan | null {
  return helperResponsePlanner.planForSingleHelper(helperId, input);
}

export function inferHelperDominantContext(
  input: HelperResponsePlannerInput,
): HaterDialogueContext | null {
  return helperResponsePlanner.inferDominantContext(input);
}
