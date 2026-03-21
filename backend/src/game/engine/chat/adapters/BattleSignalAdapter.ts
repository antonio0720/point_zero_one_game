
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT BATTLE SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/BattleSignalAdapter.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates battle-lane truth into authoritative
 * backend chat battle signals.
 *
 * Backend-truth question
 * ----------------------
 *   "When the sovereign backend battle lane emits state transitions, attack
 *    injections, neutralizations, counterplay windows, or duel outcomes, what
 *    exact chat-native battle signal should the backend chat engine ingest?"
 *
 * This file is not a UI adapter and not a socket transport helper.
 * It exists because chat must never invent a second battle language.
 *
 * Repo truths preserved
 * ---------------------
 * - backend/src/game/engine/battle/BattleEngine.ts already owns authoritative
 *   hostile posture, injection, budget movement, and pending attack truth.
 * - backend/src/game/engine/battle/HaterBotController.ts already evolves bot
 *   posture from pressure, heat, rivalry, and mode.
 * - backend/src/game/engine/battle/types.ts already describes bot profiles and
 *   attack build inputs.
 * - pzo-web/src/engines/chat/adapters/BattleEngineAdapter.ts already proves the
 *   frontend donor lane expects battle witness, bot continuity, and invasion
 *   routing without replacing battle authority.
 *
 * Therefore this file owns:
 * - battle payload compatibility and migration protection,
 * - backend battle event normalization,
 * - chat battle snapshot shaping,
 * - hostility / rescue / shield / momentum derivation,
 * - route-channel recommendation,
 * - dedupe protection,
 * - explainable adapter diagnostics,
 * - and batch translation into ChatInputEnvelope values.
 *
 * It does not own:
 * - transcript mutation,
 * - moderation,
 * - rate policy,
 * - socket fanout,
 * - replay persistence,
 * - or final NPC speech selection.
 *
 * Design laws
 * -----------
 * - Preserve battle words. Do not genericize them.
 * - Bot attacks are not flavor; they are battle truth made social.
 * - Not every battle fact deserves visible witness.
 * - The adapter may describe invasion pressure, but ChatInvasionOrchestrator
 *   still decides whether an invasion becomes transcript truth.
 * - The adapter may describe helper urgency, but HelperResponseOrchestrator
 *   still decides whether rescue becomes speech.
 * - Dedupe must prefer silence over spam.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type AttackType,
  type BotId,
  type ChatBattleSnapshot,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatRoomStageMood,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';


export interface BattleSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface BattleSignalAdapterClock {
  now(): UnixMs;
}

export interface BattleSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly includeShadowMetadata?: boolean;
  readonly aggressiveWitnessAtMomentum?: number;
  readonly logger?: BattleSignalAdapterLogger;
  readonly clock?: BattleSignalAdapterClock;
}

export interface BattleSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type BattleSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'TACTICAL'
  | 'PREDATORY'
  | 'INVASION';

export type BattleSignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export type BattleSignalAdapterEventName =
  | 'battle.bot.state_changed'
  | 'battle.attack.injected'
  | 'battle.bot.neutralized'
  | 'battle.counterintel.available'
  | 'battle.budget.updated'
  | 'battle.budget.action_executed'
  | 'battle.snapshot.updated'
  | 'battle.duel.result'
  | 'threat.routed'
  | 'BOT_STATE_CHANGED'
  | 'BOT_ATTACK_FIRED'
  | 'BOT_NEUTRALIZED'
  | 'COUNTER_INTEL_AVAILABLE'
  | 'BATTLE_BUDGET_UPDATED'
  | 'BUDGET_ACTION_EXECUTED'
  | 'BATTLE_SNAPSHOT_UPDATED'
  | 'SYNDICATE_DUEL_RESULT'
  | string;

export type BattleBotStateCompat =
  | 'DORMANT'
  | 'WATCHING'
  | 'TARGETING'
  | 'ATTACKING'
  | 'RETREATING'
  | 'NEUTRALIZED';

export type BattleCategoryCompat =
  | 'EXTRACTION'
  | 'LOCK'
  | 'DRAIN'
  | 'HEAT'
  | 'BREACH'
  | 'DEBT'
  | string;

export interface BattleBotRuntimeCompat {
  readonly botId: string;
  readonly label?: string | null;
  readonly state: BattleBotStateCompat;
  readonly heat?: number | null;
  readonly lastAttackTick?: number | null;
  readonly attacksLanded?: number | null;
  readonly attacksBlocked?: number | null;
  readonly neutralized?: boolean | null;
}

export interface BattleAttackCompat {
  readonly attackId: string;
  readonly source: string;
  readonly targetEntity?: string | null;
  readonly targetLayer?: string | null;
  readonly category: BattleCategoryCompat;
  readonly magnitude?: number | null;
  readonly createdAtTick: number;
  readonly notes?: readonly string[] | null;
}

export interface BattleBotStateChangedPayloadCompat {
  readonly botId: string;
  readonly from: BattleBotStateCompat;
  readonly to: BattleBotStateCompat;
  readonly tick?: number | null;
}

export interface BattleAttackInjectedPayloadCompat {
  readonly attack?: BattleAttackCompat | null;
  readonly tick?: number | null;
}

export interface BattleThreatRoutedPayloadCompat {
  readonly threatId?: string | null;
  readonly source?: string | null;
  readonly category?: string | null;
  readonly targetLayer?: string | null;
  readonly targetEntity?: string | null;
  readonly etaTicks?: number | null;
  readonly severity?: number | null;
}

export interface BattleBudgetUpdatedPayloadCompat {
  readonly battleBudget?: number | null;
  readonly cap?: number | null;
  readonly notes?: readonly string[] | null;
  readonly tick?: number | null;
}

export interface BattleNeutralizedPayloadCompat {
  readonly botId: string;
  readonly tick?: number | null;
  readonly immunityTicks?: number | null;
}

export interface BattleCounterIntelPayloadCompat {
  readonly botId: string;
  readonly tier?: string | null;
  readonly notes?: readonly string[] | null;
  readonly tick?: number | null;
}

export interface BattleBudgetActionPayloadCompat {
  readonly actionId?: string | null;
  readonly actionType?: string | null;
  readonly cost?: number | null;
  readonly targetBotId?: string | null;
  readonly targetLayerId?: string | null;
  readonly tick?: number | null;
}

export interface BattleDuelResultPayloadCompat {
  readonly duelId?: string | null;
  readonly winnerId?: string | null;
  readonly loserId?: string | null;
  readonly reward?: Readonly<Record<string, JsonValue>> | null;
  readonly tick?: number | null;
}

export interface BattleSnapshotCompat {
  readonly runId?: string | null;
  readonly mode?: string | null;
  readonly tick?: number | null;
  readonly phase?: string | null;
  readonly outcome?: string | null;
  readonly emittedAt?: number | null;
  readonly haterHeat?: number | null;
  readonly pressureScore?: number | null;
  readonly pressureTier?: string | null;
  readonly pressureBand?: string | null;
  readonly rivalryHeatCarry?: number | null;
  readonly battleBudget?: number | null;
  readonly battleBudgetCap?: number | null;
  readonly extractionCooldownTicks?: number | null;
  readonly firstBloodClaimed?: boolean | null;
  readonly rescueWindowOpen?: boolean | null;
  readonly weakestLayerRatio?: number | null;
  readonly shieldIntegrity01?: number | null;
  readonly pendingAttacks?: readonly BattleAttackCompat[] | null;
  readonly bots?: readonly BattleBotRuntimeCompat[] | null;
  readonly neutralizedBotIds?: readonly string[] | null;
  readonly warnings?: readonly string[] | null;
}

export interface BattleSignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: BattleSignalAdapterNarrativeWeight;
  readonly severity: BattleSignalAdapterSeverity;
  readonly eventName: string;
  readonly tickNumber: number;
  readonly momentum100: Score100;
  readonly botId: Nullable<BotId>;
  readonly attackType: Nullable<AttackType>;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface BattleSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface BattleSignalAdapterHistoryEntry {
  readonly at: UnixMs;
  readonly eventName: string;
  readonly tickNumber: number;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: BattleSignalAdapterNarrativeWeight;
  readonly severity: BattleSignalAdapterSeverity;
  readonly botId: Nullable<BotId>;
  readonly attackType: Nullable<AttackType>;
  readonly momentum100: Score100;
  readonly dedupeKey: string;
}

export interface BattleSignalAdapterReport {
  readonly accepted: readonly BattleSignalAdapterArtifact[];
  readonly deduped: readonly BattleSignalAdapterArtifact[];
  readonly rejected: readonly BattleSignalAdapterRejection[];
}

export interface BattleSignalAdapterState {
  readonly history: readonly BattleSignalAdapterHistoryEntry[];
  readonly lastAcceptedAtByKey: Readonly<Record<string, UnixMs>>;
  readonly lastMomentum100: Score100;
  readonly lastTickNumber: number;
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
}


interface BattleBotDescriptor {
  readonly botId: BotId;
  readonly displayName: string;
  readonly archetype: string;
  readonly preferredChannel: ChatVisibleChannel;
  readonly mood: ChatRoomStageMood;
  readonly introduction: string;
  readonly targetingWitness: string;
  readonly attackWitness: string;
  readonly neutralizedWitness: string;
}

const BOT_DESCRIPTOR_REGISTRY: Readonly<Record<string, BattleBotDescriptor>> = Object.freeze({
  BOT_01: {
    botId: 'BOT_01',
    displayName: 'THE LIQUIDATOR',
    archetype: 'Predatory creditor / distressed-asset buyer / short interest position',
    preferredChannel: 'GLOBAL' as ChatVisibleChannel,
    mood: 'PREDATORY' as ChatRoomStageMood,
    introduction: 'THE LIQUIDATOR is active in the hostile battle lane.',
    targetingWitness: 'THE LIQUIDATOR has shifted into a targeting posture.',
    attackWitness: 'THE LIQUIDATOR has injected a live hostile attack.',
    neutralizedWitness: 'THE LIQUIDATOR has been neutralized and should not dominate chat pressure.',
  },
  BOT_02: {
    botId: 'BOT_02',
    displayName: 'THE BUREAUCRAT',
    archetype: 'Regulatory burden / licensing gatekeeping / compliance overhead',
    preferredChannel: 'GLOBAL' as ChatVisibleChannel,
    mood: 'HOSTILE' as ChatRoomStageMood,
    introduction: 'THE BUREAUCRAT is active in the hostile battle lane.',
    targetingWitness: 'THE BUREAUCRAT has shifted into a targeting posture.',
    attackWitness: 'THE BUREAUCRAT has injected a live hostile attack.',
    neutralizedWitness: 'THE BUREAUCRAT has been neutralized and should not dominate chat pressure.',
  },
  BOT_03: {
    botId: 'BOT_03',
    displayName: 'THE MANIPULATOR',
    archetype: 'Disinformation campaign / inversion and narrative sabotage',
    preferredChannel: 'GLOBAL' as ChatVisibleChannel,
    mood: 'HOSTILE' as ChatRoomStageMood,
    introduction: 'THE MANIPULATOR is active in the hostile battle lane.',
    targetingWitness: 'THE MANIPULATOR has shifted into a targeting posture.',
    attackWitness: 'THE MANIPULATOR has injected a live hostile attack.',
    neutralizedWitness: 'THE MANIPULATOR has been neutralized and should not dominate chat pressure.',
  },
  BOT_04: {
    botId: 'BOT_04',
    displayName: 'THE CRASH PROPHET',
    archetype: 'Panic amplifier / momentum short / collapse theater',
    preferredChannel: 'GLOBAL' as ChatVisibleChannel,
    mood: 'PREDATORY' as ChatRoomStageMood,
    introduction: 'THE CRASH PROPHET is active in the hostile battle lane.',
    targetingWitness: 'THE CRASH PROPHET has shifted into a targeting posture.',
    attackWitness: 'THE CRASH PROPHET has injected a live hostile attack.',
    neutralizedWitness: 'THE CRASH PROPHET has been neutralized and should not dominate chat pressure.',
  },
  BOT_05: {
    botId: 'BOT_05',
    displayName: 'THE LEGACY HEIR',
    archetype: 'Entrenchment agent / inherited moat / status gatekeeping',
    preferredChannel: 'SYNDICATE' as ChatVisibleChannel,
    mood: 'TENSE' as ChatRoomStageMood,
    introduction: 'THE LEGACY HEIR is active in the hostile battle lane.',
    targetingWitness: 'THE LEGACY HEIR has shifted into a targeting posture.',
    attackWitness: 'THE LEGACY HEIR has injected a live hostile attack.',
    neutralizedWitness: 'THE LEGACY HEIR has been neutralized and should not dominate chat pressure.',
  },
});

interface BattleAttackDescriptor {
  readonly attackType: AttackType;
  readonly title: string;
  readonly summary: string;
  readonly baseWeight: BattleSignalAdapterNarrativeWeight;
  readonly defaultChannel: ChatVisibleChannel;
  readonly mood: ChatRoomStageMood;
}

const ATTACK_DESCRIPTOR_REGISTRY: Readonly<Record<string, BattleAttackDescriptor>> = Object.freeze({
  EXTRACTION: {
    attackType: 'LIQUIDATION',
    title: 'Extraction pressure',
    summary: 'Hostile extraction logic is live against the player economy.',
    baseWeight: 'PREDATORY',
    defaultChannel: 'GLOBAL',
    mood: 'PREDATORY',
  },
  LOCK: {
    attackType: 'COMPLIANCE',
    title: 'Regulatory lock pressure',
    summary: 'A lock or hold posture is constraining player action.',
    baseWeight: 'TACTICAL',
    defaultChannel: 'GLOBAL',
    mood: 'HOSTILE',
  },
  DRAIN: {
    attackType: 'SABOTAGE',
    title: 'Drain pressure',
    summary: 'Resource-drain pressure is active against the player lane.',
    baseWeight: 'TACTICAL',
    defaultChannel: 'GLOBAL',
    mood: 'TENSE',
  },
  HEAT: {
    attackType: 'CROWD_SWARM',
    title: 'Heat surge',
    summary: 'Hostile heat has risen into socially visible territory.',
    baseWeight: 'INVASION',
    defaultChannel: 'GLOBAL',
    mood: 'HOSTILE',
  },
  BREACH: {
    attackType: 'SABOTAGE',
    title: 'Breach pressure',
    summary: 'A shield-facing breach pattern has become socially important.',
    baseWeight: 'INVASION',
    defaultChannel: 'GLOBAL',
    mood: 'HOSTILE',
  },
  DEBT: {
    attackType: 'TAUNT',
    title: 'Debt pressure',
    summary: 'Debt-linked battle hostility is now relevant to chat timing.',
    baseWeight: 'TACTICAL',
    defaultChannel: 'DEAL_ROOM',
    mood: 'PREDATORY',
  },
});

interface BattleEventDescriptor {
  readonly eventName: string;
  readonly severity: BattleSignalAdapterSeverity;
  readonly narrativeWeight: BattleSignalAdapterNarrativeWeight;
  readonly defaultChannel: ChatVisibleChannel;
  readonly allowVisibleWitness: boolean;
  readonly allowSilenceWhenLowMomentum: boolean;
}

const EVENT_DESCRIPTOR_REGISTRY: Readonly<Record<string, BattleEventDescriptor>> = Object.freeze({
  'battle.bot.state_changed': {
    eventName: 'battle.bot.state_changed',
    severity: 'INFO',
    narrativeWeight: 'TACTICAL',
    defaultChannel: 'GLOBAL',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: true,
  },
  'battle.attack.injected': {
    eventName: 'battle.attack.injected',
    severity: 'WARN',
    narrativeWeight: 'PREDATORY',
    defaultChannel: 'GLOBAL',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: false,
  },
  'battle.bot.neutralized': {
    eventName: 'battle.bot.neutralized',
    severity: 'INFO',
    narrativeWeight: 'TACTICAL',
    defaultChannel: 'GLOBAL',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: false,
  },
  'battle.counterintel.available': {
    eventName: 'battle.counterintel.available',
    severity: 'INFO',
    narrativeWeight: 'TACTICAL',
    defaultChannel: 'SYNDICATE',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: true,
  },
  'battle.budget.updated': {
    eventName: 'battle.budget.updated',
    severity: 'DEBUG',
    narrativeWeight: 'AMBIENT',
    defaultChannel: 'SYNDICATE',
    allowVisibleWitness: false,
    allowSilenceWhenLowMomentum: true,
  },
  'battle.budget.action_executed': {
    eventName: 'battle.budget.action_executed',
    severity: 'INFO',
    narrativeWeight: 'TACTICAL',
    defaultChannel: 'SYNDICATE',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: true,
  },
  'battle.snapshot.updated': {
    eventName: 'battle.snapshot.updated',
    severity: 'DEBUG',
    narrativeWeight: 'AMBIENT',
    defaultChannel: 'GLOBAL',
    allowVisibleWitness: false,
    allowSilenceWhenLowMomentum: true,
  },
  'battle.duel.result': {
    eventName: 'battle.duel.result',
    severity: 'WARN',
    narrativeWeight: 'INVASION',
    defaultChannel: 'SYNDICATE',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: false,
  },
  'threat.routed': {
    eventName: 'threat.routed',
    severity: 'WARN',
    narrativeWeight: 'TACTICAL',
    defaultChannel: 'GLOBAL',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: true,
  },
  BOT_STATE_CHANGED: {
    eventName: 'BOT_STATE_CHANGED',
    severity: 'INFO',
    narrativeWeight: 'TACTICAL',
    defaultChannel: 'GLOBAL',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: true,
  },
  BOT_ATTACK_FIRED: {
    eventName: 'BOT_ATTACK_FIRED',
    severity: 'WARN',
    narrativeWeight: 'PREDATORY',
    defaultChannel: 'GLOBAL',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: false,
  },
  BOT_NEUTRALIZED: {
    eventName: 'BOT_NEUTRALIZED',
    severity: 'INFO',
    narrativeWeight: 'TACTICAL',
    defaultChannel: 'GLOBAL',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: false,
  },
  COUNTER_INTEL_AVAILABLE: {
    eventName: 'COUNTER_INTEL_AVAILABLE',
    severity: 'INFO',
    narrativeWeight: 'TACTICAL',
    defaultChannel: 'SYNDICATE',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: true,
  },
  BATTLE_BUDGET_UPDATED: {
    eventName: 'BATTLE_BUDGET_UPDATED',
    severity: 'DEBUG',
    narrativeWeight: 'AMBIENT',
    defaultChannel: 'SYNDICATE',
    allowVisibleWitness: false,
    allowSilenceWhenLowMomentum: true,
  },
  BUDGET_ACTION_EXECUTED: {
    eventName: 'BUDGET_ACTION_EXECUTED',
    severity: 'INFO',
    narrativeWeight: 'TACTICAL',
    defaultChannel: 'SYNDICATE',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: true,
  },
  BATTLE_SNAPSHOT_UPDATED: {
    eventName: 'BATTLE_SNAPSHOT_UPDATED',
    severity: 'DEBUG',
    narrativeWeight: 'AMBIENT',
    defaultChannel: 'GLOBAL',
    allowVisibleWitness: false,
    allowSilenceWhenLowMomentum: true,
  },
  SYNDICATE_DUEL_RESULT: {
    eventName: 'SYNDICATE_DUEL_RESULT',
    severity: 'WARN',
    narrativeWeight: 'INVASION',
    defaultChannel: 'SYNDICATE',
    allowVisibleWitness: true,
    allowSilenceWhenLowMomentum: false,
  },
});

const DEFAULT_BATTLE_SIGNAL_ADAPTER_OPTIONS = Object.freeze({
  defaultVisibleChannel: 'GLOBAL' as ChatVisibleChannel,
  dedupeWindowMs: 8_500,
  maxHistory: 256,
  includeShadowMetadata: true,
  aggressiveWitnessAtMomentum: 72,
});

const TAUNT_ATTACK_NOTES = Object.freeze([
  'Hostile posture entered chat relevance.',
  'The battle lane should remain sovereign over numeric damage.',
  'Chat should witness pressure without rewriting combat truth.',
]);

const CHANNEL_PRIORITY: Readonly<Record<ChatVisibleChannel, number>> = Object.freeze({
  GLOBAL: 4,
  SYNDICATE: 3,
  DEAL_ROOM: 2,
  LOBBY: 1,
});


function defaultLogger(): BattleSignalAdapterLogger {
  return {
    debug: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function defaultClock(): BattleSignalAdapterClock {
  return {
    now: () => asUnixMs(Date.now()),
  };
}

function asRoomId(value: ChatRoomId | string): ChatRoomId {
  return value as ChatRoomId;
}

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toNullableFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toBoolean(value: unknown, fallback: boolean = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeBotId(value: unknown): Nullable<BotId> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return value.trim() as BotId;
}

function normalizeAttackType(
  category: unknown,
  notes?: readonly string[] | null,
): Nullable<AttackType> {
  if (typeof category === 'string') {
    const upper = category.trim().toUpperCase();
    const descriptor = ATTACK_DESCRIPTOR_REGISTRY[upper];
    if (descriptor) {
      return descriptor.attackType;
    }
    if (upper.includes('HEAT')) return 'CROWD_SWARM';
    if (upper.includes('LOCK')) return 'COMPLIANCE';
    if (upper.includes('BREACH')) return 'SABOTAGE';
    if (upper.includes('EXTRACT')) return 'LIQUIDATION';
    if (upper.includes('LEAK')) return 'SHADOW_LEAK';
  }
  for (const note of notes ?? []) {
    const upper = note.toUpperCase();
    if (upper.includes('HEAT')) return 'CROWD_SWARM';
    if (upper.includes('SABOTAGE')) return 'SABOTAGE';
    if (upper.includes('LIQUID')) return 'LIQUIDATION';
    if (upper.includes('COMPLIANCE')) return 'COMPLIANCE';
    if (upper.includes('TAUNT')) return 'TAUNT';
  }
  return null;
}

function normalizePressureTier(value: unknown): 'NONE' | 'BUILDING' | 'ELEVATED' | 'HIGH' | 'CRITICAL' {
  if (typeof value !== 'string') {
    return 'NONE';
  }
  const upper = value.trim().toUpperCase();
  switch (upper) {
    case 'T0':
    case 'NONE':
    case 'CALM':
      return 'NONE';
    case 'T1':
    case 'BUILDING':
    case 'LOW':
      return 'BUILDING';
    case 'T2':
    case 'ELEVATED':
    case 'MEDIUM':
      return 'ELEVATED';
    case 'T3':
    case 'HIGH':
      return 'HIGH';
    case 'T4':
    case 'CRITICAL':
      return 'CRITICAL';
    default:
      return 'NONE';
  }
}

function normalizeNarrativeWeight(
  eventName: string,
  attackType: Nullable<AttackType>,
  momentum100: Score100,
): BattleSignalAdapterNarrativeWeight {
  const descriptor = EVENT_DESCRIPTOR_REGISTRY[eventName];
  if (descriptor) {
    if (descriptor.narrativeWeight === 'TACTICAL' && attackType === 'CROWD_SWARM') {
      return momentum100 >= clamp100(72) ? 'INVASION' : 'TACTICAL';
    }
    return descriptor.narrativeWeight;
  }
  if (attackType === 'LIQUIDATION' || attackType === 'SHADOW_LEAK') {
    return 'PREDATORY';
  }
  if (attackType === 'CROWD_SWARM' && momentum100 >= clamp100(72)) {
    return 'INVASION';
  }
  return 'TACTICAL';
}

function normalizeSeverity(
  eventName: string,
  narrativeWeight: BattleSignalAdapterNarrativeWeight,
  momentum100: Score100,
): BattleSignalAdapterSeverity {
  const descriptor = EVENT_DESCRIPTOR_REGISTRY[eventName];
  if (descriptor) {
    if (descriptor.severity === 'WARN' && momentum100 >= clamp100(88)) {
      return 'CRITICAL';
    }
    return descriptor.severity;
  }
  if (narrativeWeight === 'INVASION' && momentum100 >= clamp100(88)) {
    return 'CRITICAL';
  }
  if (narrativeWeight === 'PREDATORY') {
    return 'WARN';
  }
  return 'INFO';
}

function chooseRouteChannel(
  explicit: Nullable<ChatVisibleChannel>,
  botId: Nullable<BotId>,
  attackType: Nullable<AttackType>,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  if (explicit) return explicit;
  const descriptor = botId ? BOT_DESCRIPTOR_REGISTRY[botId] : null;
  if (descriptor) {
    return descriptor.preferredChannel;
  }
  if (attackType === 'COMPLIANCE') return 'SYNDICATE';
  if (attackType === 'TAUNT') return 'DEAL_ROOM';
  if (attackType === 'SHADOW_LEAK') return 'SYNDICATE';
  return fallback;
}

function computeHostileMomentum100(args: {
  readonly pressureScore: number;
  readonly haterHeat: number;
  readonly rivalryHeatCarry: number;
  readonly pendingAttackCount: number;
  readonly activeAttackingBots: number;
  readonly activeTargetingBots: number;
  readonly neutralizedBots: number;
  readonly weakestLayerRatio: number;
  readonly rescueWindowOpen: boolean;
  readonly firstBloodClaimed: boolean;
}): Score100 {
  const pressureComponent = Math.max(0, Math.min(100, args.pressureScore * 100 * 0.34));
  const heatComponent = Math.max(0, Math.min(100, args.haterHeat * 0.22));
  const rivalryComponent = Math.max(0, Math.min(100, args.rivalryHeatCarry * 0.18));
  const pendingAttackComponent = Math.min(18, args.pendingAttackCount * 4.5);
  const attackingBotComponent = Math.min(16, args.activeAttackingBots * 5.25);
  const targetingBotComponent = Math.min(10, args.activeTargetingBots * 2.5);
  const shieldFragilityComponent = Math.max(0, Math.min(18, (1 - args.weakestLayerRatio) * 18));
  const rescueRelief = args.rescueWindowOpen ? 8 : 0;
  const neutralizedRelief = Math.min(10, args.neutralizedBots * 2.2);
  const firstBloodBias = args.firstBloodClaimed ? 5 : 0;
  return clamp100(
    pressureComponent +
      heatComponent +
      rivalryComponent +
      pendingAttackComponent +
      attackingBotComponent +
      targetingBotComponent +
      shieldFragilityComponent +
      firstBloodBias -
      rescueRelief -
      neutralizedRelief,
  );
}

function shouldSuppressVisibleWitness(args: {
  readonly eventName: string;
  readonly narrativeWeight: BattleSignalAdapterNarrativeWeight;
  readonly momentum100: Score100;
}): boolean {
  const descriptor = EVENT_DESCRIPTOR_REGISTRY[args.eventName];
  if (!descriptor) {
    return args.narrativeWeight === 'AMBIENT' && args.momentum100 < clamp100(36);
  }
  if (!descriptor.allowVisibleWitness) {
    return true;
  }
  return descriptor.allowSilenceWhenLowMomentum && args.momentum100 < clamp100(34);
}

function stableKey(record: Readonly<Record<string, JsonValue>>): string {
  const keys = Object.keys(record).sort();
  return keys
    .map((key) => `${key}:${JSON.stringify(record[key])}`)
    .join('|');
}

function upper(value: Nullable<string>): string {
  return value ? value.toUpperCase() : '';
}

function buildMetadata(
  base: Readonly<Record<string, JsonValue>>,
  additions?: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    ...base,
    ...(additions ?? {}),
  });
}

function sortByChannelPriority(left: ChatVisibleChannel, right: ChatVisibleChannel): number {
  return CHANNEL_PRIORITY[right] - CHANNEL_PRIORITY[left];
}


export class BattleSignalAdapter {
  private readonly logger: BattleSignalAdapterLogger;
  private readonly clock: BattleSignalAdapterClock;
  private readonly defaultRoomId: ChatRoomId;
  private readonly defaultVisibleChannel: ChatVisibleChannel;
  private readonly dedupeWindowMs: number;
  private readonly maxHistory: number;
  private readonly includeShadowMetadata: boolean;
  private readonly aggressiveWitnessAtMomentum: number;

  private readonly dedupeMap = new Map<string, UnixMs>();
  private readonly history: BattleSignalAdapterHistoryEntry[] = [];
  private acceptedCount = 0;
  private dedupedCount = 0;
  private rejectedCount = 0;
  private lastMomentum100: Score100 = clamp100(0);
  private lastTickNumber = 0;

  public constructor(options: BattleSignalAdapterOptions) {
    this.logger = options.logger ?? defaultLogger();
    this.clock = options.clock ?? defaultClock();
    this.defaultRoomId = asRoomId(options.defaultRoomId);
    this.defaultVisibleChannel =
      options.defaultVisibleChannel ??
      DEFAULT_BATTLE_SIGNAL_ADAPTER_OPTIONS.defaultVisibleChannel;
    this.dedupeWindowMs =
      options.dedupeWindowMs ??
      DEFAULT_BATTLE_SIGNAL_ADAPTER_OPTIONS.dedupeWindowMs;
    this.maxHistory =
      options.maxHistory ??
      DEFAULT_BATTLE_SIGNAL_ADAPTER_OPTIONS.maxHistory;
    this.includeShadowMetadata =
      options.includeShadowMetadata ??
      DEFAULT_BATTLE_SIGNAL_ADAPTER_OPTIONS.includeShadowMetadata;
    this.aggressiveWitnessAtMomentum =
      options.aggressiveWitnessAtMomentum ??
      DEFAULT_BATTLE_SIGNAL_ADAPTER_OPTIONS.aggressiveWitnessAtMomentum;
  }

  public reset(): void {
    this.dedupeMap.clear();
    this.history.length = 0;
    this.acceptedCount = 0;
    this.dedupedCount = 0;
    this.rejectedCount = 0;
    this.lastMomentum100 = clamp100(0);
    this.lastTickNumber = 0;
  }

  public getState(): BattleSignalAdapterState {
    const lastAcceptedAtByKey: Record<string, UnixMs> = {};
    for (const [key, at] of this.dedupeMap.entries()) {
      lastAcceptedAtByKey[key] = at;
    }
    return Object.freeze({
      history: this.history.slice(),
      lastAcceptedAtByKey,
      lastMomentum100: this.lastMomentum100,
      lastTickNumber: this.lastTickNumber,
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
    });
  }

  public adaptEvent(
    eventName: BattleSignalAdapterEventName,
    payload: unknown,
    context?: BattleSignalAdapterContext,
  ): BattleSignalAdapterReport {
    this.evictExpiredDedupe();
    const now = this.resolveEventTime(context?.emittedAt);
    const routeChannel = context?.routeChannel ?? this.defaultVisibleChannel;
    const roomId = this.resolveRoomId(context?.roomId);

    switch (eventName) {
      case 'battle.bot.state_changed':
      case 'BOT_STATE_CHANGED':
        return this.adaptBotStateChanged(
          eventName,
          payload as BattleBotStateChangedPayloadCompat,
          roomId,
          routeChannel,
          now,
          context,
        );
      case 'battle.attack.injected':
      case 'BOT_ATTACK_FIRED':
        return this.adaptAttackInjected(
          eventName,
          payload as BattleAttackInjectedPayloadCompat | BattleAttackCompat,
          roomId,
          routeChannel,
          now,
          context,
        );
      case 'battle.bot.neutralized':
      case 'BOT_NEUTRALIZED':
        return this.adaptNeutralized(
          eventName,
          payload as BattleNeutralizedPayloadCompat,
          roomId,
          routeChannel,
          now,
          context,
        );
      case 'battle.counterintel.available':
      case 'COUNTER_INTEL_AVAILABLE':
        return this.adaptCounterIntel(
          eventName,
          payload as BattleCounterIntelPayloadCompat,
          roomId,
          routeChannel,
          now,
          context,
        );
      case 'battle.budget.updated':
      case 'BATTLE_BUDGET_UPDATED':
        return this.adaptBudgetUpdated(
          eventName,
          payload as BattleBudgetUpdatedPayloadCompat,
          roomId,
          routeChannel,
          now,
          context,
        );
      case 'battle.budget.action_executed':
      case 'BUDGET_ACTION_EXECUTED':
        return this.adaptBudgetActionExecuted(
          eventName,
          payload as BattleBudgetActionPayloadCompat,
          roomId,
          routeChannel,
          now,
          context,
        );
      case 'battle.duel.result':
      case 'SYNDICATE_DUEL_RESULT':
        return this.adaptDuelResult(
          eventName,
          payload as BattleDuelResultPayloadCompat,
          roomId,
          routeChannel,
          now,
          context,
        );
      case 'battle.snapshot.updated':
      case 'BATTLE_SNAPSHOT_UPDATED':
        return this.adaptSnapshot(
          payload as BattleSnapshotCompat,
          {
            ...context,
            roomId,
            routeChannel,
            emittedAt: Number(now),
          },
        );
      case 'threat.routed':
        return this.adaptThreatRouted(
          eventName,
          payload as BattleThreatRoutedPayloadCompat,
          roomId,
          routeChannel,
          now,
          context,
        );
      default:
        this.rejectedCount += 1;
        return Object.freeze({
          accepted: [],
          deduped: [],
          rejected: [
            {
              eventName,
              reason: 'UNSUPPORTED_BATTLE_EVENT',
              details: buildMetadata(
                {
                  eventName,
                  roomId,
                  routeChannel,
                },
                context?.metadata,
              ),
            },
          ],
        });
    }
  }

  public adaptSnapshot(
    snapshot: BattleSnapshotCompat,
    context?: BattleSignalAdapterContext,
  ): BattleSignalAdapterReport {
    this.evictExpiredDedupe();

    const now = this.resolveEventTime(snapshot.emittedAt ?? context?.emittedAt);
    const roomId = this.resolveRoomId(context?.roomId);
    const explicitChannel = context?.routeChannel ?? null;

    const tickNumber = Math.max(0, Math.floor(snapshot.tick ?? 0));
    const pressureScore = toFiniteNumber(snapshot.pressureScore, 0);
    const pressureTier = normalizePressureTier(snapshot.pressureTier ?? snapshot.pressureBand);
    const haterHeat = toFiniteNumber(snapshot.haterHeat, 0);
    const rivalryHeatCarry = toFiniteNumber(snapshot.rivalryHeatCarry, 0);
    const bots = [...(snapshot.bots ?? [])];
    const pendingAttacks = [...(snapshot.pendingAttacks ?? [])];
    const neutralizedBotIds = new Set((snapshot.neutralizedBotIds ?? []).map((value) => String(value)));
    const activeAttackingBots = bots.filter((bot) => upper(bot.state) === 'ATTACKING').length;
    const activeTargetingBots = bots.filter((bot) => upper(bot.state) === 'TARGETING').length;
    const weakestLayerRatio = Math.max(0, Math.min(1, toFiniteNumber(snapshot.weakestLayerRatio, snapshot.shieldIntegrity01 ?? 1)));
    const rescueWindowOpen = toBoolean(snapshot.rescueWindowOpen, false);

    const momentum100 = computeHostileMomentum100({
      pressureScore,
      haterHeat,
      rivalryHeatCarry,
      pendingAttackCount: pendingAttacks.length,
      activeAttackingBots,
      activeTargetingBots,
      neutralizedBots: neutralizedBotIds.size,
      weakestLayerRatio,
      rescueWindowOpen,
      firstBloodClaimed: toBoolean(snapshot.firstBloodClaimed, false),
    });

    this.lastMomentum100 = momentum100;
    this.lastTickNumber = tickNumber;

    const primaryAttack = pendingAttacks[0] ?? null;
    const activeAttackType = normalizeAttackType(
      primaryAttack?.category ?? null,
      primaryAttack?.notes ?? null,
    );
    const activeBotId =
      normalizeBotId(primaryAttack?.source ?? null) ??
      normalizeBotId(
        bots.find((bot) => upper(bot.state) === 'ATTACKING')?.botId ?? null,
      );

    const battleSnapshot: ChatBattleSnapshot = Object.freeze({
      tickNumber,
      pressureTier,
      activeAttackType,
      activeBotId,
      hostileMomentum: momentum100,
      rescueWindowOpen,
      shieldIntegrity01: clamp01(weakestLayerRatio),
      lastAttackAt: pendingAttacks.length > 0 ? now : null,
    });

    const routeChannel = chooseRouteChannel(
      explicitChannel,
      activeBotId,
      activeAttackType,
      this.defaultVisibleChannel,
    );

    const descriptor = EVENT_DESCRIPTOR_REGISTRY['battle.snapshot.updated'];
    const narrativeWeight = normalizeNarrativeWeight(
      'battle.snapshot.updated',
      activeAttackType,
      momentum100,
    );
    const severity = normalizeSeverity(
      'battle.snapshot.updated',
      narrativeWeight,
      momentum100,
    );

    const details = buildMetadata(
      {
        source: context?.source ?? 'BattleSignalAdapter.snapshot',
        routeChannel,
        runId: snapshot.runId ?? null,
        mode: snapshot.mode ?? null,
        phase: snapshot.phase ?? null,
        outcome: snapshot.outcome ?? null,
        pressureScore,
        pressureTier,
        haterHeat,
        rivalryHeatCarry,
        battleBudget: snapshot.battleBudget ?? null,
        battleBudgetCap: snapshot.battleBudgetCap ?? null,
        extractionCooldownTicks: snapshot.extractionCooldownTicks ?? null,
        rescueWindowOpen,
        weakestLayerRatio,
        pendingAttackCount: pendingAttacks.length,
        activeAttackingBots,
        activeTargetingBots,
        neutralizedBotCount: neutralizedBotIds.size,
        firstBloodClaimed: toBoolean(snapshot.firstBloodClaimed, false),
        warnings: snapshot.warnings ? snapshot.warnings.join(' | ') : '',
        primaryAttackCategory: primaryAttack?.category ?? null,
        primaryAttackMagnitude: primaryAttack?.magnitude ?? null,
      },
      this.includeShadowMetadata
        ? {
            shadowEligible: shouldSuppressVisibleWitness({
              eventName: 'battle.snapshot.updated',
              narrativeWeight,
              momentum100,
            }),
            shadowMood: descriptor?.defaultChannel === 'SYNDICATE' ? 'INTELLIGENCE' : 'SURVEILLANCE',
          }
        : undefined,
    );

    const artifact = this.buildArtifact({
      eventName: 'battle.snapshot.updated',
      roomId,
      emittedAt: now,
      tickNumber,
      routeChannel,
      narrativeWeight,
      severity,
      momentum100,
      botId: activeBotId,
      attackType: activeAttackType,
      signal: Object.freeze({
        type: 'BATTLE',
        emittedAt: now,
        roomId,
        battle: battleSnapshot,
        metadata: details,
      }),
      details,
    });

    return this.acceptOrDedupe(artifact);
  }

  public adaptBatch(
    entries: readonly {
      readonly eventName: BattleSignalAdapterEventName;
      readonly payload: unknown;
      readonly context?: BattleSignalAdapterContext;
    }[],
  ): BattleSignalAdapterReport {
    const accepted: BattleSignalAdapterArtifact[] = [];
    const deduped: BattleSignalAdapterArtifact[] = [];
    const rejected: BattleSignalAdapterRejection[] = [];

    for (const entry of entries) {
      const report = this.adaptEvent(entry.eventName, entry.payload, entry.context);
      accepted.push(...report.accepted);
      deduped.push(...report.deduped);
      rejected.push(...report.rejected);
    }

    return Object.freeze({
      accepted,
      deduped,
      rejected,
    });
  }

  private adaptBotStateChanged(
    eventName: string,
    payload: BattleBotStateChangedPayloadCompat,
    roomId: ChatRoomId,
    routeChannel: ChatVisibleChannel,
    emittedAt: UnixMs,
    context?: BattleSignalAdapterContext,
  ): BattleSignalAdapterReport {
    const botId = normalizeBotId(payload.botId);
    if (!botId) {
      this.rejectedCount += 1;
      return {
        accepted: [],
        deduped: [],
        rejected: [
          {
            eventName,
            reason: 'BOT_ID_REQUIRED',
            details: buildMetadata({ eventName }, context?.metadata),
          },
        ],
      };
    }

    const toState = upper(payload.to);
    const fromState = upper(payload.from);
    const descriptor = BOT_DESCRIPTOR_REGISTRY[botId];
    const tickNumber = Math.max(0, Math.floor(payload.tick ?? this.lastTickNumber));
    const momentum100 = this.deriveMomentumForBotState(toState, descriptor);
    const attackType =
      toState === 'ATTACKING'
        ? 'TAUNT'
        : toState === 'TARGETING'
          ? 'TAUNT'
          : null;
    const effectiveChannel = chooseRouteChannel(
      routeChannel,
      botId,
      attackType,
      this.defaultVisibleChannel,
    );
    const narrativeWeight = normalizeNarrativeWeight(eventName, attackType, momentum100);
    const severity = normalizeSeverity(eventName, narrativeWeight, momentum100);
    const shieldIntegrity01 = this.estimateShieldIntegrityFromMomentum(momentum100);

    const battleSnapshot: ChatBattleSnapshot = Object.freeze({
      tickNumber,
      pressureTier: this.estimatePressureTierFromMomentum(momentum100),
      activeAttackType: attackType,
      activeBotId: botId,
      hostileMomentum: momentum100,
      rescueWindowOpen: false,
      shieldIntegrity01,
      lastAttackAt: toState === 'ATTACKING' ? emittedAt : null,
    });

    const details = buildMetadata(
      {
        eventName,
        source: context?.source ?? 'BattleSignalAdapter.bot_state_changed',
        botId,
        botDisplayName: descriptor?.displayName ?? botId,
        fromState,
        toState,
        routeChannel: effectiveChannel,
      },
      context?.metadata,
    );

    const artifact = this.buildArtifact({
      eventName,
      roomId,
      emittedAt,
      tickNumber,
      routeChannel: effectiveChannel,
      narrativeWeight,
      severity,
      momentum100,
      botId,
      attackType,
      signal: Object.freeze({
        type: 'BATTLE',
        emittedAt,
        roomId,
        battle: battleSnapshot,
        metadata: details,
      }),
      details,
    });

    return this.acceptOrDedupe(artifact);
  }

  private adaptAttackInjected(
    eventName: string,
    payload: BattleAttackInjectedPayloadCompat | BattleAttackCompat,
    roomId: ChatRoomId,
    routeChannel: ChatVisibleChannel,
    emittedAt: UnixMs,
    context?: BattleSignalAdapterContext,
  ): BattleSignalAdapterReport {
    const attack: BattleAttackCompat | null =
      'attack' in (payload as Record<string, unknown>)
        ? ((payload as BattleAttackInjectedPayloadCompat).attack ?? null)
        : (payload as BattleAttackCompat);

    if (!attack) {
      this.rejectedCount += 1;
      return {
        accepted: [],
        deduped: [],
        rejected: [
          {
            eventName,
            reason: 'ATTACK_PAYLOAD_REQUIRED',
            details: buildMetadata({ eventName }, context?.metadata),
          },
        ],
      };
    }

    const botId = normalizeBotId(attack.source);
    const attackType = normalizeAttackType(attack.category, attack.notes ?? null);
    const descriptor =
      upper(attack.category) in ATTACK_DESCRIPTOR_REGISTRY
        ? ATTACK_DESCRIPTOR_REGISTRY[upper(attack.category)]
        : null;
    const magnitude = Math.max(0, toFiniteNumber(attack.magnitude, 0));
    const momentum100 = clamp100(Math.max(this.lastMomentum100, magnitude * 1.65 + 42));
    const tickNumber = Math.max(
      0,
      Math.floor(attack.createdAtTick ?? (payload as BattleAttackInjectedPayloadCompat).tick ?? this.lastTickNumber),
    );
    const effectiveChannel = chooseRouteChannel(
      routeChannel,
      botId,
      attackType,
      descriptor?.defaultChannel ?? this.defaultVisibleChannel,
    );
    const narrativeWeight = normalizeNarrativeWeight(eventName, attackType, momentum100);
    const severity = normalizeSeverity(eventName, narrativeWeight, momentum100);

    const battleSnapshot: ChatBattleSnapshot = Object.freeze({
      tickNumber,
      pressureTier: this.estimatePressureTierFromMomentum(momentum100),
      activeAttackType: attackType,
      activeBotId: botId,
      hostileMomentum: momentum100,
      rescueWindowOpen: momentum100 >= clamp100(this.aggressiveWitnessAtMomentum),
      shieldIntegrity01: this.estimateShieldIntegrityFromAttackMagnitude(magnitude),
      lastAttackAt: emittedAt,
    });

    const details = buildMetadata(
      {
        eventName,
        source: context?.source ?? 'BattleSignalAdapter.attack_injected',
        attackId: attack.attackId,
        botId,
        botDisplayName: botId ? (BOT_DESCRIPTOR_REGISTRY[botId]?.displayName ?? botId) : null,
        category: attack.category,
        attackType,
        magnitude,
        targetEntity: attack.targetEntity ?? null,
        targetLayer: attack.targetLayer ?? null,
        noteSummary: (attack.notes ?? TAUNT_ATTACK_NOTES).join(' | '),
        routeChannel: effectiveChannel,
        descriptorTitle: descriptor?.title ?? null,
      },
      context?.metadata,
    );

    const artifact = this.buildArtifact({
      eventName,
      roomId,
      emittedAt,
      tickNumber,
      routeChannel: effectiveChannel,
      narrativeWeight,
      severity,
      momentum100,
      botId,
      attackType,
      signal: Object.freeze({
        type: 'BATTLE',
        emittedAt,
        roomId,
        battle: battleSnapshot,
        metadata: details,
      }),
      details,
    });

    return this.acceptOrDedupe(artifact);
  }

  private adaptNeutralized(
    eventName: string,
    payload: BattleNeutralizedPayloadCompat,
    roomId: ChatRoomId,
    routeChannel: ChatVisibleChannel,
    emittedAt: UnixMs,
    context?: BattleSignalAdapterContext,
  ): BattleSignalAdapterReport {
    const botId = normalizeBotId(payload.botId);
    if (!botId) {
      this.rejectedCount += 1;
      return {
        accepted: [],
        deduped: [],
        rejected: [
          {
            eventName,
            reason: 'BOT_ID_REQUIRED',
            details: buildMetadata({ eventName }, context?.metadata),
          },
        ],
      };
    }

    const descriptor = BOT_DESCRIPTOR_REGISTRY[botId];
    const tickNumber = Math.max(0, Math.floor(payload.tick ?? this.lastTickNumber));
    const momentum100 = clamp100(Math.max(0, this.lastMomentum100 - 18));
    const effectiveChannel = chooseRouteChannel(
      routeChannel,
      botId,
      'TAUNT',
      descriptor?.preferredChannel ?? this.defaultVisibleChannel,
    );
    const battleSnapshot: ChatBattleSnapshot = Object.freeze({
      tickNumber,
      pressureTier: this.estimatePressureTierFromMomentum(momentum100),
      activeAttackType: null,
      activeBotId: botId,
      hostileMomentum: momentum100,
      rescueWindowOpen: true,
      shieldIntegrity01: this.estimateShieldIntegrityFromMomentum(momentum100),
      lastAttackAt: null,
    });
    const details = buildMetadata(
      {
        eventName,
        source: context?.source ?? 'BattleSignalAdapter.neutralized',
        botId,
        botDisplayName: descriptor?.displayName ?? botId,
        immunityTicks: payload.immunityTicks ?? null,
        routeChannel: effectiveChannel,
      },
      context?.metadata,
    );

    const artifact = this.buildArtifact({
      eventName,
      roomId,
      emittedAt,
      tickNumber,
      routeChannel: effectiveChannel,
      narrativeWeight: 'TACTICAL',
      severity: 'INFO',
      momentum100,
      botId,
      attackType: null,
      signal: Object.freeze({
        type: 'BATTLE',
        emittedAt,
        roomId,
        battle: battleSnapshot,
        metadata: details,
      }),
      details,
    });

    return this.acceptOrDedupe(artifact);
  }

  private adaptCounterIntel(
    eventName: string,
    payload: BattleCounterIntelPayloadCompat,
    roomId: ChatRoomId,
    routeChannel: ChatVisibleChannel,
    emittedAt: UnixMs,
    context?: BattleSignalAdapterContext,
  ): BattleSignalAdapterReport {
    const botId = normalizeBotId(payload.botId);
    if (!botId) {
      this.rejectedCount += 1;
      return {
        accepted: [],
        deduped: [],
        rejected: [
          {
            eventName,
            reason: 'BOT_ID_REQUIRED',
            details: buildMetadata({ eventName }, context?.metadata),
          },
        ],
      };
    }

    const descriptor = BOT_DESCRIPTOR_REGISTRY[botId];
    const tickNumber = Math.max(0, Math.floor(payload.tick ?? this.lastTickNumber));
    const momentum100 = clamp100(Math.max(18, this.lastMomentum100 * 0.72));
    const effectiveChannel = 'SYNDICATE';
    const battleSnapshot: ChatBattleSnapshot = Object.freeze({
      tickNumber,
      pressureTier: this.estimatePressureTierFromMomentum(momentum100),
      activeAttackType: 'COMPLIANCE',
      activeBotId: botId,
      hostileMomentum: momentum100,
      rescueWindowOpen: true,
      shieldIntegrity01: this.estimateShieldIntegrityFromMomentum(momentum100),
      lastAttackAt: null,
    });
    const details = buildMetadata(
      {
        eventName,
        source: context?.source ?? 'BattleSignalAdapter.counterintel',
        botId,
        botDisplayName: descriptor?.displayName ?? botId,
        tier: payload.tier ?? null,
        noteSummary: (payload.notes ?? []).join(' | '),
        routeChannel: effectiveChannel,
      },
      context?.metadata,
    );

    const artifact = this.buildArtifact({
      eventName,
      roomId,
      emittedAt,
      tickNumber,
      routeChannel: effectiveChannel,
      narrativeWeight: 'TACTICAL',
      severity: 'INFO',
      momentum100,
      botId,
      attackType: 'COMPLIANCE',
      signal: Object.freeze({
        type: 'BATTLE',
        emittedAt,
        roomId,
        battle: battleSnapshot,
        metadata: details,
      }),
      details,
    });

    return this.acceptOrDedupe(artifact);
  }

  private adaptBudgetUpdated(
    eventName: string,
    payload: BattleBudgetUpdatedPayloadCompat,
    roomId: ChatRoomId,
    routeChannel: ChatVisibleChannel,
    emittedAt: UnixMs,
    context?: BattleSignalAdapterContext,
  ): BattleSignalAdapterReport {
    const tickNumber = Math.max(0, Math.floor(payload.tick ?? this.lastTickNumber));
    const battleBudget = Math.max(0, toFiniteNumber(payload.battleBudget, 0));
    const cap = Math.max(0, toFiniteNumber(payload.cap, Math.max(1, battleBudget)));
    const utilization = cap > 0 ? battleBudget / cap : 0;
    const momentum100 = clamp100(this.lastMomentum100 * 0.45 + utilization * 22);
    const effectiveChannel = 'SYNDICATE';
    const battleSnapshot: ChatBattleSnapshot = Object.freeze({
      tickNumber,
      pressureTier: this.estimatePressureTierFromMomentum(momentum100),
      activeAttackType: null,
      activeBotId: null,
      hostileMomentum: momentum100,
      rescueWindowOpen: false,
      shieldIntegrity01: this.estimateShieldIntegrityFromMomentum(momentum100),
      lastAttackAt: null,
    });
    const details = buildMetadata(
      {
        eventName,
        source: context?.source ?? 'BattleSignalAdapter.budget_updated',
        battleBudget,
        cap,
        utilization01: clamp01(utilization),
        noteSummary: (payload.notes ?? []).join(' | '),
        routeChannel: effectiveChannel,
      },
      context?.metadata,
    );

    const artifact = this.buildArtifact({
      eventName,
      roomId,
      emittedAt,
      tickNumber,
      routeChannel: effectiveChannel,
      narrativeWeight: 'AMBIENT',
      severity: 'DEBUG',
      momentum100,
      botId: null,
      attackType: null,
      signal: Object.freeze({
        type: 'BATTLE',
        emittedAt,
        roomId,
        battle: battleSnapshot,
        metadata: details,
      }),
      details,
    });

    return this.acceptOrDedupe(artifact);
  }

  private adaptBudgetActionExecuted(
    eventName: string,
    payload: BattleBudgetActionPayloadCompat,
    roomId: ChatRoomId,
    routeChannel: ChatVisibleChannel,
    emittedAt: UnixMs,
    context?: BattleSignalAdapterContext,
  ): BattleSignalAdapterReport {
    const tickNumber = Math.max(0, Math.floor(payload.tick ?? this.lastTickNumber));
    const botId = normalizeBotId(payload.targetBotId);
    const momentum100 = clamp100(Math.max(20, this.lastMomentum100 * 0.66));
    const effectiveChannel = 'SYNDICATE';
    const battleSnapshot: ChatBattleSnapshot = Object.freeze({
      tickNumber,
      pressureTier: this.estimatePressureTierFromMomentum(momentum100),
      activeAttackType: 'SABOTAGE',
      activeBotId: botId,
      hostileMomentum: momentum100,
      rescueWindowOpen: true,
      shieldIntegrity01: this.estimateShieldIntegrityFromMomentum(momentum100),
      lastAttackAt: null,
    });
    const details = buildMetadata(
      {
        eventName,
        source: context?.source ?? 'BattleSignalAdapter.budget_action_executed',
        actionId: payload.actionId ?? null,
        actionType: payload.actionType ?? null,
        cost: payload.cost ?? null,
        targetBotId: botId,
        targetLayerId: payload.targetLayerId ?? null,
        routeChannel: effectiveChannel,
      },
      context?.metadata,
    );
    const artifact = this.buildArtifact({
      eventName,
      roomId,
      emittedAt,
      tickNumber,
      routeChannel: effectiveChannel,
      narrativeWeight: 'TACTICAL',
      severity: 'INFO',
      momentum100,
      botId,
      attackType: 'SABOTAGE',
      signal: Object.freeze({
        type: 'BATTLE',
        emittedAt,
        roomId,
        battle: battleSnapshot,
        metadata: details,
      }),
      details,
    });
    return this.acceptOrDedupe(artifact);
  }

  private adaptThreatRouted(
    eventName: string,
    payload: BattleThreatRoutedPayloadCompat,
    roomId: ChatRoomId,
    routeChannel: ChatVisibleChannel,
    emittedAt: UnixMs,
    context?: BattleSignalAdapterContext,
  ): BattleSignalAdapterReport {
    const attackType = normalizeAttackType(payload.category ?? null, null);
    const botId = normalizeBotId(payload.source ?? null);
    const severity100 = clamp100(Math.max(0, toFiniteNumber(payload.severity, 0)));
    const momentum100 = clamp100(Math.max(this.lastMomentum100, severity100));
    const tickNumber = this.lastTickNumber;
    const effectiveChannel = chooseRouteChannel(routeChannel, botId, attackType, this.defaultVisibleChannel);
    const battleSnapshot: ChatBattleSnapshot = Object.freeze({
      tickNumber,
      pressureTier: this.estimatePressureTierFromMomentum(momentum100),
      activeAttackType: attackType,
      activeBotId: botId,
      hostileMomentum: momentum100,
      rescueWindowOpen: false,
      shieldIntegrity01: this.estimateShieldIntegrityFromMomentum(momentum100),
      lastAttackAt: emittedAt,
    });
    const details = buildMetadata(
      {
        eventName,
        source: context?.source ?? 'BattleSignalAdapter.threat_routed',
        threatId: payload.threatId ?? null,
        category: payload.category ?? null,
        targetLayer: payload.targetLayer ?? null,
        targetEntity: payload.targetEntity ?? null,
        etaTicks: payload.etaTicks ?? null,
        severity100,
        routeChannel: effectiveChannel,
      },
      context?.metadata,
    );
    const artifact = this.buildArtifact({
      eventName,
      roomId,
      emittedAt,
      tickNumber,
      routeChannel: effectiveChannel,
      narrativeWeight: normalizeNarrativeWeight(eventName, attackType, momentum100),
      severity: normalizeSeverity(eventName, 'TACTICAL', momentum100),
      momentum100,
      botId,
      attackType,
      signal: Object.freeze({
        type: 'BATTLE',
        emittedAt,
        roomId,
        battle: battleSnapshot,
        metadata: details,
      }),
      details,
    });
    return this.acceptOrDedupe(artifact);
  }

  private adaptDuelResult(
    eventName: string,
    payload: BattleDuelResultPayloadCompat,
    roomId: ChatRoomId,
    routeChannel: ChatVisibleChannel,
    emittedAt: UnixMs,
    context?: BattleSignalAdapterContext,
  ): BattleSignalAdapterReport {
    const tickNumber = Math.max(0, Math.floor(payload.tick ?? this.lastTickNumber));
    const momentum100 = clamp100(Math.max(62, this.lastMomentum100));
    const effectiveChannel = 'SYNDICATE';
    const battleSnapshot: ChatBattleSnapshot = Object.freeze({
      tickNumber,
      pressureTier: this.estimatePressureTierFromMomentum(momentum100),
      activeAttackType: 'CROWD_SWARM',
      activeBotId: null,
      hostileMomentum: momentum100,
      rescueWindowOpen: false,
      shieldIntegrity01: this.estimateShieldIntegrityFromMomentum(momentum100),
      lastAttackAt: emittedAt,
    });
    const details = buildMetadata(
      {
        eventName,
        source: context?.source ?? 'BattleSignalAdapter.duel_result',
        duelId: payload.duelId ?? null,
        winnerId: payload.winnerId ?? null,
        loserId: payload.loserId ?? null,
        routeChannel: effectiveChannel,
        rewardKeys: payload.reward ? Object.keys(payload.reward).join('|') : '',
      },
      context?.metadata,
    );
    const artifact = this.buildArtifact({
      eventName,
      roomId,
      emittedAt,
      tickNumber,
      routeChannel: effectiveChannel,
      narrativeWeight: 'INVASION',
      severity: 'WARN',
      momentum100,
      botId: null,
      attackType: 'CROWD_SWARM',
      signal: Object.freeze({
        type: 'BATTLE',
        emittedAt,
        roomId,
        battle: battleSnapshot,
        metadata: details,
      }),
      details,
    });
    return this.acceptOrDedupe(artifact);
  }

  private deriveMomentumForBotState(
    toState: string,
    descriptor: Nullable<BattleBotDescriptor>,
  ): Score100 {
    switch (toState) {
      case 'ATTACKING':
        return clamp100(descriptor?.preferredChannel === 'SYNDICATE' ? 76 : 82);
      case 'TARGETING':
        return clamp100(58);
      case 'WATCHING':
        return clamp100(32);
      case 'RETREATING':
        return clamp100(18);
      case 'NEUTRALIZED':
        return clamp100(8);
      default:
        return clamp100(12);
    }
  }

  private estimatePressureTierFromMomentum(
    momentum100: Score100,
  ): 'NONE' | 'BUILDING' | 'ELEVATED' | 'HIGH' | 'CRITICAL' {
    if (momentum100 >= clamp100(85)) return 'CRITICAL';
    if (momentum100 >= clamp100(65)) return 'HIGH';
    if (momentum100 >= clamp100(42)) return 'ELEVATED';
    if (momentum100 >= clamp100(20)) return 'BUILDING';
    return 'NONE';
  }

  private estimateShieldIntegrityFromAttackMagnitude(magnitude: number): Score01 {
    if (magnitude <= 0) return clamp01(1);
    return clamp01(Math.max(0.14, 1 - magnitude / 100));
  }

  private estimateShieldIntegrityFromMomentum(momentum100: Score100): Score01 {
    return clamp01(Math.max(0.08, 1 - Number(momentum100) / 120));
  }

  private buildArtifact(args: {
    readonly eventName: string;
    readonly roomId: ChatRoomId;
    readonly emittedAt: UnixMs;
    readonly tickNumber: number;
    readonly routeChannel: ChatVisibleChannel;
    readonly narrativeWeight: BattleSignalAdapterNarrativeWeight;
    readonly severity: BattleSignalAdapterSeverity;
    readonly momentum100: Score100;
    readonly botId: Nullable<BotId>;
    readonly attackType: Nullable<AttackType>;
    readonly signal: ChatSignalEnvelope;
    readonly details: Readonly<Record<string, JsonValue>>;
  }): BattleSignalAdapterArtifact {
    const dedupeKey = stableKey({
      eventName: args.eventName,
      roomId: args.roomId,
      routeChannel: args.routeChannel,
      tickNumber: args.tickNumber,
      botId: args.botId ?? '',
      attackType: args.attackType ?? '',
      momentum100: Number(args.momentum100),
    });

    const envelope: ChatInputEnvelope = Object.freeze({
      kind: 'BATTLE_SIGNAL',
      emittedAt: args.emittedAt,
      payload: args.signal,
    });

    return Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: args.routeChannel,
      narrativeWeight: args.narrativeWeight,
      severity: args.severity,
      eventName: args.eventName,
      tickNumber: args.tickNumber,
      momentum100: args.momentum100,
      botId: args.botId,
      attackType: args.attackType,
      details: args.details,
    });
  }

  private acceptOrDedupe(
    artifact: BattleSignalAdapterArtifact,
  ): BattleSignalAdapterReport {
    const lastAcceptedAt = this.dedupeMap.get(artifact.dedupeKey) ?? null;
    const eventNow = artifact.envelope.emittedAt;
    if (
      lastAcceptedAt !== null &&
      Number(eventNow) - Number(lastAcceptedAt) < this.dedupeWindowMs
    ) {
      this.dedupedCount += 1;
      this.logger.debug('BattleSignalAdapter deduped artifact.', {
        eventName: artifact.eventName,
        dedupeKey: artifact.dedupeKey,
      });
      return Object.freeze({
        accepted: [],
        deduped: [artifact],
        rejected: [],
      });
    }

    this.dedupeMap.set(artifact.dedupeKey, eventNow);
    this.acceptedCount += 1;
    this.lastMomentum100 = artifact.momentum100;
    this.lastTickNumber = artifact.tickNumber;
    this.recordHistory(artifact);

    return Object.freeze({
      accepted: [artifact],
      deduped: [],
      rejected: [],
    });
  }

  private recordHistory(artifact: BattleSignalAdapterArtifact): void {
    this.history.push(
      Object.freeze({
        at: artifact.envelope.emittedAt,
        eventName: artifact.eventName,
        tickNumber: artifact.tickNumber,
        routeChannel: artifact.routeChannel,
        narrativeWeight: artifact.narrativeWeight,
        severity: artifact.severity,
        botId: artifact.botId,
        attackType: artifact.attackType,
        momentum100: artifact.momentum100,
        dedupeKey: artifact.dedupeKey,
      }),
    );

    while (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  private resolveRoomId(value: Nullable<ChatRoomId | string | null | undefined>): ChatRoomId {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim() as ChatRoomId;
    }
    return this.defaultRoomId;
  }

  private resolveEventTime(value: unknown): UnixMs {
    const numeric = typeof value === 'number' && Number.isFinite(value)
      ? value
      : Number(this.clock.now());
    return asUnixMs(numeric);
  }

  private evictExpiredDedupe(): void {
    const now = this.clock.now();
    for (const [key, at] of this.dedupeMap.entries()) {
      if (Number(now) - Number(at) >= this.dedupeWindowMs * 3) {
        this.dedupeMap.delete(key);
      }
    }
  }
}
