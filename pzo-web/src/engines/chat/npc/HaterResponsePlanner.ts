// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/npc/HaterResponsePlanner.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT HATER RESPONSE PLANNER
 * FILE: pzo-web/src/engines/chat/npc/HaterResponsePlanner.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical planner for frontend-side hater chat reactions in the new chat
 * engine lane.
 *
 * This file does NOT own transcript truth and does NOT replace backend hater
 * authority. It is the fast client planner responsible for turning live run
 * state, learning hints, registry metadata, and channel policy into a concrete
 * chat-response plan that the frontend can stage immediately while the backend
 * authority lane catches up.
 *
 * What this planner owns
 * ----------------------
 * - context inference from run/battle/player state
 * - urgency ranking across multiple hater candidates
 * - channel-aware and mode-aware suppression
 * - anti-spam and anti-repeat gating
 * - attack-aware timing windows for taunts, squeezes, and finishers
 * - learned aggression scaling from cold-start → warm-start profiles
 * - plan packaging for ChatNpcDirector / ChatInvasionDirector / UI shells
 *
 * What this planner does NOT own
 * ------------------------------
 * - socket fanout
 * - transcript persistence
 * - moderation enforcement
 * - final replay ledger authority
 * - permanent learning profile writes
 *
 * Repo doctrine
 * -------------
 * - preserve the donor context vocabulary from HaterDialogueTrees.ts
 * - preserve the strategic direction of SovereignChatKernel.ts, where player
 *   engagement adapts bot aggression, helper frequency, and NPC cadence
 * - preserve battle ownership boundaries: hater chatter reacts to battle state,
 *   but it does not become the battle engine
 * - preserve channel identity: GLOBAL is theatrical, SYNDICATE is intimate,
 *   DEAL_ROOM is predatory, LOBBY is ceremonial
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
  getAllHaterRegistryEntries,
  getHaterRegistryEntry,
} from './HaterDialogueRegistry';

/**
 * The planner is intentionally tolerant of upstream registry evolution.
 * The concrete hater registry can grow richer without forcing the planner to
 * retype the whole object graph. This interface captures only the surface the
 * planner actually needs.
 */
export type HaterDialogueContext =
  | 'PLAYER_NEAR_BANKRUPTCY'
  | 'PLAYER_INCOME_UP'
  | 'PLAYER_SHIELD_BREAK'
  | 'PLAYER_CARD_PLAY'
  | 'PLAYER_IDLE'
  | 'PLAYER_COMEBACK'
  | 'PLAYER_RESPONSE_ANGRY'
  | 'PLAYER_RESPONSE_TROLL'
  | 'PLAYER_RESPONSE_FLEX'
  | 'PLAYER_FIRST_INCOME'
  | 'BOT_DEFEATED'
  | 'BOT_WINNING'
  | 'TIME_PRESSURE'
  | 'CASCADE_CHAIN'
  | 'GAME_START'
  | 'NEAR_SOVEREIGNTY'
  | 'PLAYER_LOST'
  | 'LOBBY_TAUNT';

export type FrontendRunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';

export type ChatChannelId =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'LOBBY'
  | 'NPC_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'RESCUE_SHADOW'
  | 'LIVEOPS_SHADOW';

export type HaterThreatBand = 'DORMANT' | 'WATCHING' | 'TARGETING' | 'ATTACKING' | 'RETREATING';
export type HaterDeliveryLane = 'PUBLIC' | 'SHADOW' | 'WHISPER';
export type HaterPlanReason =
  | 'context-match'
  | 'heat-escalation'
  | 'battle-pressure'
  | 'cooldown-suppressed'
  | 'channel-suppressed'
  | 'mode-suppressed'
  | 'repeat-suppressed'
  | 'fallback';

export interface HaterDialogueLine {
  readonly text: string;
  readonly weight: number;
  readonly minTick?: number;
  readonly maxUses?: number;
  readonly allowedChannels?: readonly ChatChannelId[];
  readonly allowedModes?: readonly FrontendRunMode[];
  readonly tags?: readonly string[];
}

export interface HaterVoiceprintShape {
  readonly delayProfileMs?: readonly [number, number] | readonly number[];
  readonly interruptionStyle?: string;
  readonly emotionalTemperature?: string;
  readonly signatureOpeners?: readonly string[];
  readonly signatureClosers?: readonly string[];
}

export interface HaterRegistryEntry {
  readonly haterId: string;
  readonly displayName?: string;
  readonly voiceprint?: HaterVoiceprintShape;
  readonly dialogueTree?: Partial<Record<HaterDialogueContext, readonly HaterDialogueLine[]>>;
  readonly channelPolicy?: {
    readonly primaryChannels?: readonly ChatChannelId[];
    readonly allowedChannels?: readonly ChatChannelId[];
    readonly mayWhisperPrivately?: boolean;
    readonly mayProjectIntoShadow?: boolean;
  };
  readonly modeAffinity?: {
    readonly solo?: number;
    readonly asymmetricPvp?: number;
    readonly coop?: number;
    readonly ghost?: number;
  };
  readonly aggressionBias?: number;
  readonly humiliationBias?: number;
  readonly tauntBias?: number;
  readonly comebackBias?: number;
  readonly collapseBias?: number;
  readonly silenceBias?: number;
  readonly botProfile?: {
    readonly watchingHeatThreshold?: number;
    readonly targetingHeatThreshold?: number;
    readonly attackingHeatThreshold?: number;
    readonly retreatTicks?: number;
  };
}

export interface HaterPlannerLearningProfile {
  readonly totalRuns?: number;
  readonly trollRate?: number;
  readonly flexRate?: number;
  readonly angerRate?: number;
  readonly helpSeekRate?: number;
  readonly silenceRate?: number;
  readonly preferredAggressionLevel?: number;
  readonly botAffinityScores?: Readonly<Record<string, number>>;
}

export interface HaterPlannerBattleSnapshot {
  readonly haterHeat: number;
  readonly activeBotIds: readonly string[];
  readonly defeatedBotIds: readonly string[];
  readonly attackingBotIds: readonly string[];
  readonly winningBotIds: readonly string[];
  readonly retreatingBotIds?: readonly string[];
  readonly dominantBotId?: string | null;
}

export interface HaterPlannerRunSnapshot {
  readonly tick: number;
  readonly runMode: FrontendRunMode;
  readonly channelId: ChatChannelId;
  readonly nearBankruptcy: boolean;
  readonly shieldBrokenThisWindow: boolean;
  readonly playerIdleTicks: number;
  readonly playerIncomeRoseThisWindow: boolean;
  readonly playerPlayedCardThisWindow: boolean;
  readonly playerTriggeredCascadeThisWindow: boolean;
  readonly playerFirstIncomeThisRun: boolean;
  readonly playerComebackThisWindow: boolean;
  readonly nearSovereignty: boolean;
  readonly playerLost: boolean;
  readonly timePressure: number;
  readonly monthlyIncome?: number;
  readonly netWorth?: number;
  readonly lastPlayerMessageAtMs?: number;
  readonly nowMs: number;
  readonly usedLineTexts?: ReadonlySet<string>;
}

export interface HaterPlannerResponseSnapshot {
  readonly classifiedContext?:
    | 'PLAYER_RESPONSE_ANGRY'
    | 'PLAYER_RESPONSE_TROLL'
    | 'PLAYER_RESPONSE_FLEX'
    | null;
  readonly sentimentIntensity?: number;
}

export interface HaterResponsePlannerInput {
  readonly run: HaterPlannerRunSnapshot;
  readonly battle: HaterPlannerBattleSnapshot;
  readonly learning?: HaterPlannerLearningProfile;
  readonly response?: HaterPlannerResponseSnapshot;
  readonly preferredBotIds?: readonly string[];
  readonly suppressedBotIds?: readonly string[];
  readonly sceneBudget?: number;
  readonly rng?: () => number;
}

export interface HaterContextCandidate {
  readonly context: HaterDialogueContext;
  readonly urgency: number;
  readonly reason: HaterPlanReason;
}

export interface HaterPlannerScoreBreakdown {
  readonly contextFit: number;
  readonly heatFit: number;
  readonly aggressionFit: number;
  readonly channelFit: number;
  readonly modeFit: number;
  readonly affinityFit: number;
  readonly recencyPenalty: number;
  readonly silenceBoost: number;
  readonly total: number;
}

export interface HaterResponsePlan {
  readonly haterId: string;
  readonly displayName: string;
  readonly context: HaterDialogueContext;
  readonly threatBand: HaterThreatBand;
  readonly deliveryLane: HaterDeliveryLane;
  readonly delayMs: number;
  readonly line: HaterDialogueLine | null;
  readonly score: HaterPlannerScoreBreakdown;
  readonly reasons: readonly HaterPlanReason[];
}

export interface HaterResponsePlannerConfig {
  readonly maxPlansPerPass: number;
  readonly minTickGapBetweenAmbientTaunts: number;
  readonly baseCooldownMs: number;
  readonly heatShadowThreshold: number;
  readonly dealRoomSuppressionScalar: number;
  readonly globalTheaterScalar: number;
  readonly idleProvocationScalar: number;
  readonly comebackPunishScalar: number;
  readonly bankruptcySwarmScalar: number;
  readonly preferredBotBias: number;
}

const DEFAULT_CONFIG: HaterResponsePlannerConfig = Object.freeze({
  maxPlansPerPass: 2,
  minTickGapBetweenAmbientTaunts: 8,
  baseCooldownMs: 3_000,
  heatShadowThreshold: 68,
  dealRoomSuppressionScalar: 0.72,
  globalTheaterScalar: 1.18,
  idleProvocationScalar: 1.12,
  comebackPunishScalar: 1.16,
  bankruptcySwarmScalar: 1.24,
  preferredBotBias: 0.18,
});

const PUBLIC_FIRST_CONTEXTS = new Set<HaterDialogueContext>([
  'GAME_START',
  'PLAYER_FIRST_INCOME',
  'PLAYER_COMEBACK',
  'BOT_WINNING',
  'NEAR_SOVEREIGNTY',
  'PLAYER_LOST',
  'LOBBY_TAUNT',
]);

const SHADOW_FRIENDLY_CONTEXTS = new Set<HaterDialogueContext>([
  'PLAYER_IDLE',
  'PLAYER_NEAR_BANKRUPTCY',
  'TIME_PRESSURE',
  'PLAYER_RESPONSE_ANGRY',
  'PLAYER_RESPONSE_TROLL',
  'PLAYER_RESPONSE_FLEX',
]);

const CONTEXT_BASE_URGENCY: Readonly<Record<HaterDialogueContext, number>> = Object.freeze({
  GAME_START: 0.46,
  LOBBY_TAUNT: 0.40,
  PLAYER_FIRST_INCOME: 0.52,
  PLAYER_INCOME_UP: 0.58,
  PLAYER_CARD_PLAY: 0.44,
  PLAYER_SHIELD_BREAK: 0.78,
  PLAYER_NEAR_BANKRUPTCY: 0.90,
  PLAYER_IDLE: 0.51,
  PLAYER_COMEBACK: 0.72,
  PLAYER_RESPONSE_ANGRY: 0.66,
  PLAYER_RESPONSE_TROLL: 0.64,
  PLAYER_RESPONSE_FLEX: 0.68,
  BOT_DEFEATED: 0.57,
  BOT_WINNING: 0.82,
  TIME_PRESSURE: 0.76,
  CASCADE_CHAIN: 0.62,
  NEAR_SOVEREIGNTY: 0.84,
  PLAYER_LOST: 0.95,
});

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeHeat(rawHeat: number): number {
  return clamp01(rawHeat / 100);
}

function toArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  return value ?? Object.freeze([]);
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function resolveModeAffinity(entry: HaterRegistryEntry, runMode: FrontendRunMode): number {
  const affinity = entry.modeAffinity;
  if (!affinity) return 0.5;
  switch (runMode) {
    case 'solo':
      return safeNumber(affinity.solo, 0.5);
    case 'asymmetric-pvp':
      return safeNumber(affinity.asymmetricPvp, safeNumber(affinity.solo, 0.5));
    case 'co-op':
      return safeNumber(affinity.coop, safeNumber(affinity.solo, 0.5));
    case 'ghost':
      return safeNumber(affinity.ghost, safeNumber(affinity.solo, 0.5));
    default:
      return safeNumber(affinity.solo, 0.5);
  }
}

function inferThreatBand(entry: HaterRegistryEntry, heat: number, battle: HaterPlannerBattleSnapshot): HaterThreatBand {
  const profile = entry.botProfile;
  const botId = entry.haterId;
  if (toArray(battle.retreatingBotIds).includes(botId)) return 'RETREATING';
  if (battle.attackingBotIds.includes(botId)) return 'ATTACKING';

  const attackingThreshold = safeNumber(profile?.attackingHeatThreshold, 61);
  const targetingThreshold = safeNumber(profile?.targetingHeatThreshold, 41);
  const watchingThreshold = safeNumber(profile?.watchingHeatThreshold, 20);

  if (heat >= attackingThreshold) return 'ATTACKING';
  if (heat >= targetingThreshold) return 'TARGETING';
  if (heat >= watchingThreshold) return 'WATCHING';
  return 'DORMANT';
}

function canSpeakInChannel(entry: HaterRegistryEntry, channelId: ChatChannelId): boolean {
  const allowed = entry.channelPolicy?.allowedChannels;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(channelId);
}

function buildContextCandidates(input: HaterResponsePlannerInput): readonly HaterContextCandidate[] {
  const { run, battle, response } = input;
  const candidates: HaterContextCandidate[] = [];

  if (run.tick <= 3) {
    candidates.push({ context: run.channelId === 'LOBBY' ? 'LOBBY_TAUNT' : 'GAME_START', urgency: 0.60, reason: 'context-match' });
  }
  if (run.playerFirstIncomeThisRun) {
    candidates.push({ context: 'PLAYER_FIRST_INCOME', urgency: 0.68, reason: 'context-match' });
  }
  if (run.playerIncomeRoseThisWindow) {
    candidates.push({ context: 'PLAYER_INCOME_UP', urgency: 0.73, reason: 'context-match' });
  }
  if (run.playerPlayedCardThisWindow) {
    candidates.push({ context: 'PLAYER_CARD_PLAY', urgency: 0.47, reason: 'context-match' });
  }
  if (run.playerTriggeredCascadeThisWindow) {
    candidates.push({ context: 'CASCADE_CHAIN', urgency: 0.64, reason: 'battle-pressure' });
  }
  if (run.shieldBrokenThisWindow) {
    candidates.push({ context: 'PLAYER_SHIELD_BREAK', urgency: 0.88, reason: 'battle-pressure' });
  }
  if (run.nearBankruptcy) {
    candidates.push({ context: 'PLAYER_NEAR_BANKRUPTCY', urgency: 0.96, reason: 'battle-pressure' });
  }
  if (run.playerIdleTicks >= 3) {
    candidates.push({ context: 'PLAYER_IDLE', urgency: 0.54 + clamp01(run.playerIdleTicks / 20) * 0.18, reason: 'context-match' });
  }
  if (run.playerComebackThisWindow) {
    candidates.push({ context: 'PLAYER_COMEBACK', urgency: 0.78, reason: 'context-match' });
  }
  if (run.timePressure >= 0.67) {
    candidates.push({ context: 'TIME_PRESSURE', urgency: 0.82, reason: 'battle-pressure' });
  }
  if (run.nearSovereignty) {
    candidates.push({ context: 'NEAR_SOVEREIGNTY', urgency: 0.92, reason: 'battle-pressure' });
  }
  if (run.playerLost) {
    candidates.push({ context: 'PLAYER_LOST', urgency: 1.0, reason: 'battle-pressure' });
  }
  if (battle.winningBotIds.length > 0 || battle.attackingBotIds.length > 0) {
    candidates.push({ context: 'BOT_WINNING', urgency: 0.80, reason: 'heat-escalation' });
  }
  if (battle.defeatedBotIds.length > 0) {
    candidates.push({ context: 'BOT_DEFEATED', urgency: 0.69, reason: 'battle-pressure' });
  }
  if (response?.classifiedContext) {
    candidates.push({
      context: response.classifiedContext,
      urgency: 0.60 + clamp01(response.sentimentIntensity ?? 0) * 0.24,
      reason: 'context-match',
    });
  }

  return Object.freeze(candidates);
}

function getLinesForContext(
  entry: HaterRegistryEntry,
  context: HaterDialogueContext,
): readonly HaterDialogueLine[] {
  return entry.dialogueTree?.[context] ?? Object.freeze([]);
}

function buildEligibleLines(
  entry: HaterRegistryEntry,
  context: HaterDialogueContext,
  input: HaterResponsePlannerInput,
): readonly HaterDialogueLine[] {
  const used = input.run.usedLineTexts ?? new Set<string>();
  return Object.freeze(
    getLinesForContext(entry, context).filter((line) => {
      if (line.minTick !== undefined && input.run.tick < line.minTick) return false;
      if (line.maxUses !== undefined && used.has(line.text)) return false;
      if (line.allowedChannels && !line.allowedChannels.includes(input.run.channelId)) return false;
      if (line.allowedModes && !line.allowedModes.includes(input.run.runMode)) return false;
      if (used.has(line.text)) return false;
      return true;
    }),
  );
}

function pickWeightedLine(lines: readonly HaterDialogueLine[], rng: () => number): HaterDialogueLine | null {
  if (lines.length === 0) return null;
  const total = lines.reduce((sum, line) => sum + Math.max(0, line.weight), 0);
  if (total <= 0) return lines[0] ?? null;

  let roll = rng() * total;
  for (const line of lines) {
    roll -= Math.max(0, line.weight);
    if (roll <= 0) return line;
  }
  return lines[lines.length - 1] ?? null;
}

function computeAggressionScalar(
  learning: HaterPlannerLearningProfile | undefined,
  context: HaterDialogueContext,
): number {
  const preferredAggression = clamp01(safeNumber(learning?.preferredAggressionLevel, 0.4));
  const trollRate = clamp01(safeNumber(learning?.trollRate, 0));
  const flexRate = clamp01(safeNumber(learning?.flexRate, 0));
  const angerRate = clamp01(safeNumber(learning?.angerRate, 0));
  const helpRate = clamp01(safeNumber(learning?.helpSeekRate, 0));

  let scalar = 0.88 + preferredAggression * 0.52;
  scalar += trollRate * 0.18;
  scalar += flexRate * 0.12;
  scalar -= angerRate * 0.14;
  scalar -= helpRate * 0.10;

  if (context === 'PLAYER_RESPONSE_TROLL' || context === 'PLAYER_RESPONSE_FLEX') {
    scalar += 0.10;
  }
  if (context === 'PLAYER_RESPONSE_ANGRY' || context === 'PLAYER_NEAR_BANKRUPTCY') {
    scalar -= 0.08;
  }

  return Math.max(0.55, Math.min(1.55, scalar));
}

function computeDeliveryLane(
  entry: HaterRegistryEntry,
  context: HaterDialogueContext,
  input: HaterResponsePlannerInput,
): HaterDeliveryLane {
  if (input.run.channelId === 'DEAL_ROOM') {
    return entry.channelPolicy?.mayWhisperPrivately ? 'WHISPER' : 'PUBLIC';
  }
  if (
    SHADOW_FRIENDLY_CONTEXTS.has(context)
    && input.battle.haterHeat >= DEFAULT_CONFIG.heatShadowThreshold
    && entry.channelPolicy?.mayProjectIntoShadow
  ) {
    return 'SHADOW';
  }
  return 'PUBLIC';
}

function computeDelayMs(
  entry: HaterRegistryEntry,
  context: HaterDialogueContext,
  threatBand: HaterThreatBand,
  lane: HaterDeliveryLane,
  rng: () => number,
): number {
  const profile = entry.voiceprint?.delayProfileMs;
  const floor = safeNumber(profile?.[0], lane === 'WHISPER' ? 500 : 900);
  const ceil = safeNumber(profile?.[1], lane === 'WHISPER' ? 1800 : 3200);
  const roll = floor + Math.floor(rng() * Math.max(1, ceil - floor + 1));

  let delay = roll;
  if (context === 'PLAYER_SHIELD_BREAK' || context === 'PLAYER_LOST') delay *= 0.55;
  if (context === 'TIME_PRESSURE' || context === 'NEAR_SOVEREIGNTY') delay *= 0.72;
  if (threatBand === 'ATTACKING') delay *= 0.65;
  if (threatBand === 'RETREATING') delay *= 1.20;
  if (lane === 'SHADOW') delay *= 0.84;

  return Math.max(120, Math.floor(delay));
}

function computeRecencyPenalty(entry: HaterRegistryEntry, input: HaterResponsePlannerInput): number {
  const now = input.run.nowMs;
  const last = input.run.lastPlayerMessageAtMs;
  if (typeof last !== 'number' || !Number.isFinite(last)) return 0;

  const elapsed = Math.max(0, now - last);
  const cooldown = DEFAULT_CONFIG.baseCooldownMs;
  if (elapsed >= cooldown) return 0;

  const penalty = 1 - elapsed / cooldown;
  const silenceBias = clamp01(safeNumber(entry.silenceBias, 0.5));
  return penalty * (0.24 + silenceBias * 0.18);
}

function computeAffinityFit(entry: HaterRegistryEntry, learning: HaterPlannerLearningProfile | undefined): number {
  const affinity = clamp01(safeNumber(learning?.botAffinityScores?.[entry.haterId], 0));
  return affinity * 0.18;
}

function computePreferredBotFit(entry: HaterRegistryEntry, preferredBotIds: readonly string[] | undefined): number {
  if (!preferredBotIds || preferredBotIds.length === 0) return 0;
  return preferredBotIds.includes(entry.haterId) ? DEFAULT_CONFIG.preferredBotBias : 0;
}

function computeContextFit(
  entry: HaterRegistryEntry,
  candidate: HaterContextCandidate,
  input: HaterResponsePlannerInput,
): number {
  let fit = CONTEXT_BASE_URGENCY[candidate.context] + candidate.urgency * 0.55;

  if (candidate.context === 'PLAYER_NEAR_BANKRUPTCY') {
    fit += clamp01(safeNumber(entry.collapseBias, 0.5)) * 0.22;
    fit *= DEFAULT_CONFIG.bankruptcySwarmScalar;
  }
  if (candidate.context === 'PLAYER_COMEBACK') {
    fit += clamp01(safeNumber(entry.comebackBias, 0.5)) * 0.16;
    fit *= DEFAULT_CONFIG.comebackPunishScalar;
  }
  if (candidate.context === 'LOBBY_TAUNT') {
    fit += clamp01(safeNumber(entry.tauntBias, 0.5)) * 0.14;
  }
  if (candidate.context === 'PLAYER_IDLE') {
    fit *= DEFAULT_CONFIG.idleProvocationScalar;
  }
  if (candidate.context === 'PLAYER_LOST') {
    fit += clamp01(safeNumber(entry.humiliationBias, 0.5)) * 0.22;
  }
  if (input.run.channelId === 'GLOBAL' && PUBLIC_FIRST_CONTEXTS.has(candidate.context)) {
    fit *= DEFAULT_CONFIG.globalTheaterScalar;
  }
  if (input.run.channelId === 'DEAL_ROOM') {
    fit *= DEFAULT_CONFIG.dealRoomSuppressionScalar;
  }

  return fit;
}

function computeScore(
  entry: HaterRegistryEntry,
  candidate: HaterContextCandidate,
  input: HaterResponsePlannerInput,
): HaterPlannerScoreBreakdown {
  const heatNorm = normalizeHeat(input.battle.haterHeat);
  const contextFit = computeContextFit(entry, candidate, input);
  const threatBand = inferThreatBand(entry, input.battle.haterHeat, input.battle);

  let heatFit = heatNorm * 0.26;
  if (threatBand === 'TARGETING') heatFit += 0.08;
  if (threatBand === 'ATTACKING') heatFit += 0.15;
  if (threatBand === 'RETREATING') heatFit -= 0.06;

  const aggressionFit = computeAggressionScalar(input.learning, candidate.context)
    * (0.18 + clamp01(safeNumber(entry.aggressionBias, 0.5)) * 0.14);

  const channelFit = canSpeakInChannel(entry, input.run.channelId)
    ? input.run.channelId === 'GLOBAL'
      ? 0.16
      : input.run.channelId === 'SYNDICATE'
        ? 0.11
        : input.run.channelId === 'DEAL_ROOM'
          ? 0.08
          : 0.12
    : -0.50;

  const modeFit = resolveModeAffinity(entry, input.run.runMode) * 0.16;
  const affinityFit = computeAffinityFit(entry, input.learning)
    + computePreferredBotFit(entry, input.preferredBotIds);

  const recencyPenalty = computeRecencyPenalty(entry, input);
  const silenceBoost = clamp01(safeNumber(input.learning?.silenceRate, 0)) * 0.05;

  const total = contextFit + heatFit + aggressionFit + channelFit + modeFit + affinityFit + silenceBoost - recencyPenalty;

  return Object.freeze({
    contextFit,
    heatFit,
    aggressionFit,
    channelFit,
    modeFit,
    affinityFit,
    recencyPenalty,
    silenceBoost,
    total,
  });
}

function dedupeContexts(candidates: readonly HaterContextCandidate[]): readonly HaterContextCandidate[] {
  const best = new Map<HaterDialogueContext, HaterContextCandidate>();
  for (const candidate of candidates) {
    const existing = best.get(candidate.context);
    if (!existing || candidate.urgency > existing.urgency) best.set(candidate.context, candidate);
  }
  return Object.freeze([...best.values()]);
}

function sortPlans(plans: readonly HaterResponsePlan[]): readonly HaterResponsePlan[] {
  return Object.freeze([...plans].sort((a, b) => b.score.total - a.score.total));
}

export class HaterResponsePlanner {
  private readonly config: HaterResponsePlannerConfig;

  constructor(config?: Partial<HaterResponsePlannerConfig>) {
    this.config = Object.freeze({ ...DEFAULT_CONFIG, ...(config ?? {}) });
  }

  public plan(input: HaterResponsePlannerInput): readonly HaterResponsePlan[] {
    const rng = input.rng ?? Math.random;
    const suppressed = new Set(input.suppressedBotIds ?? []);
    const rawCandidates = dedupeContexts(buildContextCandidates(input));
    const plans: HaterResponsePlan[] = [];

    for (const rawEntry of getAllHaterRegistryEntries() as readonly unknown[]) {
      const entry = rawEntry as HaterRegistryEntry;
      if (suppressed.has(entry.haterId)) continue;

      const threatBand = inferThreatBand(entry, input.battle.haterHeat, input.battle);
      for (const candidate of rawCandidates) {
        const reasons: HaterPlanReason[] = [candidate.reason];
        if (!canSpeakInChannel(entry, input.run.channelId)) {
          reasons.push('channel-suppressed');
          continue;
        }

        const eligible = buildEligibleLines(entry, candidate.context, input);
        if (eligible.length === 0) {
          reasons.push('repeat-suppressed');
          continue;
        }

        const score = computeScore(entry, candidate, input);
        if (score.total <= 0) {
          reasons.push('cooldown-suppressed');
          continue;
        }

        const line = pickWeightedLine(eligible, rng);
        if (!line) continue;

        const deliveryLane = computeDeliveryLane(entry, candidate.context, input);
        const delayMs = computeDelayMs(entry, candidate.context, threatBand, deliveryLane, rng);

        if (threatBand === 'ATTACKING') reasons.push('heat-escalation');
        if (candidate.reason !== 'battle-pressure' && (candidate.context === 'BOT_WINNING' || candidate.context === 'PLAYER_SHIELD_BREAK')) {
          reasons.push('battle-pressure');
        }

        plans.push(Object.freeze({
          haterId: entry.haterId,
          displayName: entry.displayName ?? entry.haterId,
          context: candidate.context,
          threatBand,
          deliveryLane,
          delayMs,
          line,
          score,
          reasons: Object.freeze(reasons),
        }));
      }
    }

    return sortPlans(plans).slice(0, this.config.maxPlansPerPass);
  }

  public planForSingleHater(
    haterId: string,
    input: HaterResponsePlannerInput,
  ): HaterResponsePlan | null {
    const entry = getHaterRegistryEntry(haterId as never) as unknown as HaterRegistryEntry;
    const subPlanner = new HaterResponsePlanner({ ...this.config, maxPlansPerPass: 16 });
    const plans = subPlanner.plan({
      ...input,
      preferredBotIds: Object.freeze([haterId]),
      suppressedBotIds: Object.freeze(
        (input.suppressedBotIds ?? []).filter((candidate) => candidate !== haterId),
      ),
    });

    return plans.find((plan) => plan.haterId === entry.haterId) ?? null;
  }

  public inferDominantContext(input: HaterResponsePlannerInput): HaterDialogueContext | null {
    const candidates = dedupeContexts(buildContextCandidates(input))
      .sort((a, b) => b.urgency - a.urgency);
    return candidates[0]?.context ?? null;
  }

  public explainSuppression(
    haterId: string,
    input: HaterResponsePlannerInput,
  ): readonly HaterPlanReason[] {
    const entry = getHaterRegistryEntry(haterId as never) as unknown as HaterRegistryEntry;
    const reasons: HaterPlanReason[] = [];

    if (!canSpeakInChannel(entry, input.run.channelId)) {
      reasons.push('channel-suppressed');
    }

    const candidates = dedupeContexts(buildContextCandidates(input));
    if (candidates.length === 0) {
      reasons.push('fallback');
      return Object.freeze(reasons);
    }

    const best = candidates[0];
    const eligible = buildEligibleLines(entry, best.context, input);
    if (eligible.length === 0) {
      reasons.push('repeat-suppressed');
    }

    const score = computeScore(entry, best, input);
    if (score.total <= 0) {
      reasons.push('cooldown-suppressed');
    }

    if (reasons.length === 0) reasons.push('context-match');
    return Object.freeze(reasons);
  }
}

export const haterResponsePlanner = Object.freeze(new HaterResponsePlanner());

export function planHaterResponses(
  input: HaterResponsePlannerInput,
): readonly HaterResponsePlan[] {
  return haterResponsePlanner.plan(input);
}

export function planSingleHaterResponse(
  haterId: string,
  input: HaterResponsePlannerInput,
): HaterResponsePlan | null {
  return haterResponsePlanner.planForSingleHater(haterId, input);
}

export function inferHaterDominantContext(
  input: HaterResponsePlannerInput,
): HaterDialogueContext | null {
  return haterResponsePlanner.inferDominantContext(input);
}
