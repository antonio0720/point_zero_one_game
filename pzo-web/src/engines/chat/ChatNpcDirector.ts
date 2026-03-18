
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE NPC DIRECTOR
 * FILE: pzo-web/src/engines/chat/ChatNpcDirector.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend NPC, helper, hater, and ambient-crowd orchestration
 * authority for the unified chat engine.
 *
 * This file is the missing middle layer between:
 *   - raw transport / transcript plumbing,
 *   - invasion-grade dramatic sequences,
 *   - and the donor kernel/router/dialogue logic already living elsewhere in
 *     the repo.
 *
 * ChatInvasionDirector owns major multi-beat pressure scenes.
 * ChatNpcDirector owns the persistent social life between those spikes:
 *   - ambient room chatter,
 *   - helper interventions,
 *   - hater jabs that do not deserve a full invasion,
 *   - direct replies to player behavior,
 *   - quiet witness moments,
 *   - and per-channel mood continuity.
 *
 * Preserved repo truths
 * ---------------------
 * - The current chat hook already surfaces real bot identities like
 *   THE LIQUIDATOR, THE BUREAUCRAT, THE MANIPULATOR, THE CRASH PROPHET, and
 *   THE LEGACY HEIR.
 * - The donor kernel explicitly tracks engagement from second 1 and adapts bot
 *   aggression, helper frequency, and NPC cadence.
 * - HelperCharacters.ts already models helper warmth, directness, frequency,
 *   coldStartBoost, idleTriggerTicks, and triggerConditions.
 * - HaterDialogueTrees.ts already models contexts such as PLAYER_NEAR_BANKRUPTCY,
 *   PLAYER_SHIELD_BREAK, CASCADE_CHAIN, TIME_PRESSURE, PLAYER_COMEBACK,
 *   PLAYER_RESPONSE_ANGRY, and NEAR_SOVEREIGNTY.
 * - Your stated operating rule is clear: chat is not a side toy; it is the
 *   emotional operating system of the run.
 *
 * What this controller owns
 * -------------------------
 * - context classification from player messages and game events,
 * - helper / hater / ambient selection,
 * - cadence and cooldown policy,
 * - deterministic route selection across GLOBAL / SYNDICATE / DEAL_ROOM / LOBBY,
 * - transcript mirroring for locally staged NPC lines,
 * - notification mirroring for meaningful beats,
 * - presence theater and typing theater,
 * - escalation handoff to ChatInvasionDirector when a local NPC moment should
 *   graduate into a directed invasion,
 * - history, dedup, and plan bookkeeping.
 *
 * Design laws
 * -----------
 * - Not every event deserves an invasion.
 * - Not every silence should be filled.
 * - Helpers should feel timely, not spammy.
 * - Haters should feel personal, not random.
 * - GLOBAL should witness.
 * - SYNDICATE should guide.
 * - DEAL_ROOM should feel predatory and intentional.
 * - LOBBY should breathe before and after pressure.
 * - The frontend may stage social life for responsiveness, but server truth
 *   remains the long-term authority.
 *
 * Migration note
 * --------------
 * This file is intentionally self-contained against the canonical frontend lane
 * already produced in this session:
 *   - ChatSocketClient.ts
 *   - ChatPresenceController.ts
 *   - ChatTypingController.ts
 *   - ChatNotificationController.ts
 *   - ChatTranscriptBuffer.ts
 *   - ChatPrivacyPolicy.ts
 *   - ChatChannelPolicy.ts
 *   - ChatInvasionDirector.ts
 *   - ChatRuntimeConfig.ts
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 * ============================================================================
 */

import {
  ChatSocketClient,
  type ChatChannel,
  type ChatMessage,
  type ChatSabotageEvent,
  type ChatTransportState,
} from './ChatSocketClient';

import {
  ChatPresenceController,
  type ChatPresenceStripView,
} from './ChatPresenceController';

import {
  ChatTypingController,
  type ChatTypingTheaterActorRole,
} from './ChatTypingController';

import {
  ChatNotificationController,
} from './ChatNotificationController';

import {
  ChatTranscriptBuffer,
} from './ChatTranscriptBuffer';

import {
  ChatPrivacyPolicy,
  type ChatPrivacyActorClass,
} from './ChatPrivacyPolicy';

import {
  ChatChannelPolicy,
  type ChatModeSnapshot,
} from './ChatChannelPolicy';

import {
  ChatInvasionDirector,
} from './ChatInvasionDirector';

import {
  ChatRelationshipModel,
  type ChatRelationshipNpcSignal,
  type ChatRelationshipSnapshot,
} from './intelligence/ChatRelationshipModel';

type ChatRelationshipLegacyProjection = Record<string, unknown>;

// -----------------------------------------------------------------------------
// Exported core types
// -----------------------------------------------------------------------------

export type ChatNpcActorRole =
  | 'AMBIENT'
  | 'HELPER'
  | 'HATER'
  | 'RIVAL'
  | 'ARCHIVIST';

export type ChatNpcContext =
  | 'GAME_START'
  | 'GAME_END'
  | 'PLAYER_IDLE'
  | 'PLAYER_CARD_PLAY'
  | 'PLAYER_SHIELD_BREAK'
  | 'PLAYER_NEAR_BANKRUPTCY'
  | 'PLAYER_LOST'
  | 'PLAYER_COMEBACK'
  | 'PLAYER_INCOME_UP'
  | 'PLAYER_FIRST_INCOME'
  | 'CASCADE_CHAIN'
  | 'TIME_PRESSURE'
  | 'NEAR_SOVEREIGNTY'
  | 'NEGOTIATION_WINDOW'
  | 'PLAYER_RESPONSE_QUESTION'
  | 'PLAYER_RESPONSE_ANGRY'
  | 'PLAYER_RESPONSE_TROLL'
  | 'PLAYER_RESPONSE_FLEX'
  | 'PLAYER_RESPONSE_CALM'
  | 'MARKET_ALERT'
  | 'SHIELD_FORTIFIED'
  | 'BOT_DEFEATED'
  | 'BOT_WINNING'
  | 'POSTRUN_DEBRIEF'
  | 'MANUAL';

export type ChatNpcPlanState =
  | 'STAGED'
  | 'ACTIVE'
  | 'EMITTED'
  | 'ESCALATED'
  | 'DISMISSED'
  | 'EXPIRED';

export type ChatNpcPlanReason =
  | 'game_event'
  | 'player_message'
  | 'idle_pulse'
  | 'ambient_cadence'
  | 'sabotage'
  | 'manual'
  | 'postrun'
  | 'recovery';

export type ChatNpcMessageSeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type ChatNpcPlayerResponseClass =
  | 'QUESTION'
  | 'ANGRY'
  | 'TROLL'
  | 'FLEX'
  | 'CALM'
  | 'UNKNOWN';

export type ChatNpcRouteIntent =
  | 'ambient'
  | 'helper'
  | 'hater'
  | 'rival'
  | 'archivist';

export interface ChatNpcRuntimeState {
  modeId?: string;
  screenId?: string;
  playerId?: string;
  tick?: number;
  pressureTier?: string;
  tickTier?: string;
  runOutcome?: string;
  isPreRun?: boolean;
  isInRun?: boolean;
  isPostRun?: boolean;
  isNegotiationWindow?: boolean;
  isMounted?: boolean;
  haterHeat?: number;
  negotiationUrgency?: number;
  coldStartFactor?: number;
  engagementScore?: number;
  transportState?: ChatTransportState;
  activeChannel?: ChatChannel;
  lastPlayerMessageAt?: number;
  lastInboundMessageAt?: number;
  lastGameEventAt?: number;
  lastAmbientAt?: number;
  lastHelperAt?: number;
  lastHaterAt?: number;
  playerMessageCount?: number;
  metadata?: Record<string, unknown>;
}

export interface ChatNpcPersonaPersonality {
  warmth: number;
  directness: number;
  frequency: number;
  coldStartBoost: number;
}

export interface ChatNpcPersonaBase {
  id: string;
  displayName: string;
  archLabel: string;
  emoji?: string;
  role: string;
  personality: ChatNpcPersonaPersonality;
  idleTriggerTicks?: number;
  triggerConditions: ChatNpcContext[];
  aura?: string;
  preferredChannels?: ChatChannel[];
}

export interface ChatNpcHelperPersona extends ChatNpcPersonaBase {
  actorRole: 'HELPER' | 'RIVAL' | 'ARCHIVIST';
}

export interface ChatNpcHaterPersona extends ChatNpcPersonaBase {
  actorRole: 'HATER';
  archetype: 'LIQUIDATOR' | 'BUREAUCRAT' | 'MANIPULATOR' | 'CRASH_PROPHET' | 'LEGACY_HEIR';
}

export interface ChatNpcAmbientPersona {
  id: string;
  displayName: string;
  rank: string;
  emoji?: string;
  preferredChannels: ChatChannel[];
  toneBias: 'HYPE' | 'TACTICAL' | 'QUIET' | 'DRY';
}

export interface ChatNpcPlan {
  id: string;
  context: ChatNpcContext;
  reason: ChatNpcPlanReason;
  state: ChatNpcPlanState;
  actorId: string;
  actorName: string;
  actorRole: ChatNpcActorRole;
  actorClass: ChatPrivacyActorClass;
  actorLabel?: string;
  channel: ChatChannel;
  body: string;
  title?: string;
  severity: ChatNpcMessageSeverity;
  createdAt: number;
  emitAt: number;
  expiresAt: number;
  directReplyToMessageId?: string;
  sourceMessageId?: string;
  sourceEvent?: string;
  playerResponseClass?: ChatNpcPlayerResponseClass;
  shouldEscalate?: boolean;
  shouldNotify?: boolean;
  shouldMirrorSocket?: boolean;
  shouldMirrorTranscript?: boolean;
  shouldStagePresence?: boolean;
  shouldStageTyping?: boolean;
  typingPlanId?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatNpcHistoryEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: ChatNpcActorRole;
  context: ChatNpcContext;
  channel: ChatChannel;
  severity: ChatNpcMessageSeverity;
  createdAt: number;
  emittedAt?: number;
  resolvedAt: number;
  state: ChatNpcPlanState;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface ChatNpcDirectorSnapshot {
  runtime: ChatNpcRuntimeState;
  active: ChatNpcPlan[];
  history: ChatNpcHistoryEntry[];
  helperCooldowns: Record<string, number>;
  haterCooldowns: Record<string, number>;
  ambientCooldowns: Record<string, number>;
  dedupSize: number;
  lastPlanAt: number;
  lastAmbientAt: number;
  lastHelperAt: number;
  lastHaterAt: number;
  phaseTwo?: ChatNpcDirectorPhaseTwoSnapshot;
}

export interface ChatNpcRelationshipOverlay {
  counterpartId: string;
  stance: string;
  objective: string;
  intensity01: number;
  volatility01: number;
  obsession01: number;
  predictiveConfidence01: number;
  unfinishedBusiness01: number;
  respect01: number;
  fear01: number;
  contempt01: number;
  familiarity01: number;
  callbackLabel?: string;
  legacy: ChatRelationshipLegacyProjection;
}

export interface ChatNpcDirectorPhaseTwoSnapshot {
  relationshipRoutingEnabled: boolean;
  relationshipSnapshot?: ChatRelationshipSnapshot;
  overlays: readonly ChatNpcRelationshipOverlay[];
  strongestCounterpartId?: string;
  strongestCounterpartIntensity01?: number;
}

export interface ChatNpcDirectorCallbacks {
  onSnapshot?: (snapshot: ChatNpcDirectorSnapshot) => void;
  onPlanStaged?: (plan: ChatNpcPlan) => void;
  onPlanEmitted?: (plan: ChatNpcPlan, message: ChatMessage) => void;
  onPlanEscalated?: (plan: ChatNpcPlan, invasionId?: string) => void;
  onPlanDropped?: (plan: ChatNpcPlan, reason: string) => void;
  onError?: (error: Error, context?: Record<string, unknown>) => void;
}

export interface ChatNpcDirectorConfig {
  maxActivePlans?: number;
  ambientCadenceBaseMs?: number;
  ambientCadenceJitterMs?: number;
  helperCooldownMs?: number;
  haterCooldownMs?: number;
  ambientCooldownMs?: number;
  directReplyWindowMs?: number;
  idleHelperThresholdMs?: number;
  lowSignalAmbientThresholdMs?: number;
  helperInterventionDelayMs?: number;
  haterEscalationDelayMs?: number;
  allowAmbientNpc?: boolean;
  allowHelpers?: boolean;
  allowHaters?: boolean;
  allowCrowdEcho?: boolean;
  allowTypingTheater?: boolean;
  allowPresenceTheater?: boolean;
  allowNotificationMirror?: boolean;
  allowTranscriptMirror?: boolean;
  allowSocketMirror?: boolean;
  allowInvasionEscalation?: boolean;
  allowRelationshipRouting?: boolean;
  historyLimit?: number;
  dedupWindowMs?: number;
  log?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatNpcDirectorOptions {
  socketClient?: ChatSocketClient;
  presenceController: ChatPresenceController;
  typingController: ChatTypingController;
  notificationController: ChatNotificationController;
  transcriptBuffer: ChatTranscriptBuffer;
  privacyPolicy: ChatPrivacyPolicy;
  channelPolicy: ChatChannelPolicy;
  invasionDirector?: ChatInvasionDirector;
  runtime?: Partial<ChatNpcRuntimeState>;
  config?: ChatNpcDirectorConfig;
  callbacks?: ChatNpcDirectorCallbacks;
  relationshipModel?: ChatRelationshipModel;
  playerId?: string;
}

interface InternalPlanEntry {
  plan: ChatNpcPlan;
  emitTimer?: ReturnType<typeof setTimeout>;
  expireTimer?: ReturnType<typeof setTimeout>;
}

interface HelperScore {
  persona: ChatNpcHelperPersona;
  score: number;
  relationshipSignal?: ChatRelationshipNpcSignal;
}

interface HaterScore {
  persona: ChatNpcHaterPersona;
  score: number;
  relationshipSignal?: ChatRelationshipNpcSignal;
}

const DEFAULT_CONFIG: Required<
  Pick<
    ChatNpcDirectorConfig,
    | 'maxActivePlans'
    | 'ambientCadenceBaseMs'
    | 'ambientCadenceJitterMs'
    | 'helperCooldownMs'
    | 'haterCooldownMs'
    | 'ambientCooldownMs'
    | 'directReplyWindowMs'
    | 'idleHelperThresholdMs'
    | 'lowSignalAmbientThresholdMs'
    | 'helperInterventionDelayMs'
    | 'haterEscalationDelayMs'
    | 'allowAmbientNpc'
    | 'allowHelpers'
    | 'allowHaters'
    | 'allowCrowdEcho'
    | 'allowTypingTheater'
    | 'allowPresenceTheater'
    | 'allowNotificationMirror'
    | 'allowTranscriptMirror'
    | 'allowSocketMirror'
    | 'allowInvasionEscalation'
    | 'allowRelationshipRouting'
    | 'historyLimit'
    | 'dedupWindowMs'
  >
> = {
  maxActivePlans: 6,
  ambientCadenceBaseMs: 5_800,
  ambientCadenceJitterMs: 2_300,
  helperCooldownMs: 7_500,
  haterCooldownMs: 6_000,
  ambientCooldownMs: 4_500,
  directReplyWindowMs: 12_000,
  idleHelperThresholdMs: 18_000,
  lowSignalAmbientThresholdMs: 12_000,
  helperInterventionDelayMs: 1_500,
  haterEscalationDelayMs: 1_200,
  allowAmbientNpc: true,
  allowHelpers: true,
  allowHaters: true,
  allowCrowdEcho: true,
  allowTypingTheater: true,
  allowPresenceTheater: true,
  allowNotificationMirror: true,
  allowTranscriptMirror: true,
  allowSocketMirror: true,
  allowInvasionEscalation: true,
  allowRelationshipRouting: true,
  historyLimit: 180,
  dedupWindowMs: 1_200,
};

const EMPTY_RUNTIME: ChatNpcRuntimeState = {
  modeId: 'chat_default',
  screenId: 'unknown',
  playerId: 'player',
  tick: 0,
  pressureTier: 'BUILDING',
  tickTier: 'STABLE',
  runOutcome: undefined,
  isPreRun: true,
  isInRun: false,
  isPostRun: false,
  isNegotiationWindow: false,
  isMounted: true,
  haterHeat: 0,
  negotiationUrgency: 0,
  coldStartFactor: 1,
  engagementScore: 0,
  transportState: 'IDLE',
  activeChannel: 'LOBBY',
  lastPlayerMessageAt: 0,
  lastInboundMessageAt: 0,
  lastGameEventAt: 0,
  lastAmbientAt: 0,
  lastHelperAt: 0,
  lastHaterAt: 0,
  playerMessageCount: 0,
  metadata: {},
};

const HELPER_PERSONAS: Record<string, ChatNpcHelperPersona> = {
  MENTOR: {
    id: 'MENTOR',
    actorRole: 'HELPER',
    displayName: 'THE MENTOR',
    archLabel: 'Strategic Advisor',
    emoji: '🧭',
    role: 'Provides strategic guidance and emotional grounding.',
    personality: { warmth: 0.9, directness: 0.7, frequency: 0.6, coldStartBoost: 2.0 },
    idleTriggerTicks: 3,
    triggerConditions: ['PLAYER_NEAR_BANKRUPTCY', 'PLAYER_IDLE', 'GAME_START', 'NEAR_SOVEREIGNTY'],
    aura: 'calm',
    preferredChannels: ['LOBBY', 'SYNDICATE', 'GLOBAL'],
  },
  INSIDER: {
    id: 'INSIDER',
    actorRole: 'HELPER',
    displayName: 'THE INSIDER',
    archLabel: 'Market Intelligence',
    emoji: '📡',
    role: 'Drops hidden mechanics, card interaction, and bot-pattern hints.',
    personality: { warmth: 0.4, directness: 0.9, frequency: 0.3, coldStartBoost: 1.5 },
    idleTriggerTicks: 8,
    triggerConditions: ['PLAYER_CARD_PLAY', 'CASCADE_CHAIN', 'PLAYER_SHIELD_BREAK', 'TIME_PRESSURE'],
    aura: 'signal',
    preferredChannels: ['SYNDICATE', 'GLOBAL', 'DEAL_ROOM'],
  },
  SURVIVOR: {
    id: 'SURVIVOR',
    actorRole: 'HELPER',
    displayName: 'THE SURVIVOR',
    archLabel: 'Crisis Veteran',
    emoji: '🛟',
    role: 'Appears at the darkest moment and keeps the player from collapsing.',
    personality: { warmth: 1.0, directness: 0.5, frequency: 0.4, coldStartBoost: 1.8 },
    idleTriggerTicks: 2,
    triggerConditions: ['PLAYER_NEAR_BANKRUPTCY', 'PLAYER_LOST', 'PLAYER_RESPONSE_ANGRY'],
    aura: 'recovery',
    preferredChannels: ['GLOBAL', 'LOBBY', 'SYNDICATE'],
  },
  RIVAL: {
    id: 'RIVAL',
    actorRole: 'RIVAL',
    displayName: 'THE RIVAL',
    archLabel: 'Friendly Competitor',
    emoji: '⚡',
    role: 'Competitive motivation without outright hostility.',
    personality: { warmth: 0.5, directness: 0.8, frequency: 0.35, coldStartBoost: 0.8 },
    idleTriggerTicks: 10,
    triggerConditions: ['PLAYER_INCOME_UP', 'PLAYER_COMEBACK', 'NEAR_SOVEREIGNTY', 'PLAYER_RESPONSE_FLEX'],
    aura: 'competitive',
    preferredChannels: ['GLOBAL', 'SYNDICATE'],
  },
  ARCHIVIST: {
    id: 'ARCHIVIST',
    actorRole: 'ARCHIVIST',
    displayName: 'THE ARCHIVIST',
    archLabel: 'Lore Keeper',
    emoji: '📚',
    role: 'Historical context, comparative perspective, and memory framing.',
    personality: { warmth: 0.3, directness: 0.6, frequency: 0.2, coldStartBoost: 0.5 },
    idleTriggerTicks: 15,
    triggerConditions: ['GAME_START', 'NEAR_SOVEREIGNTY', 'PLAYER_LOST', 'POSTRUN_DEBRIEF'],
    aura: 'memory',
    preferredChannels: ['LOBBY', 'GLOBAL', 'SYNDICATE'],
  },
};

const HATER_PERSONAS: Record<string, ChatNpcHaterPersona> = {
  BOT_01_LIQUIDATOR: {
    id: 'BOT_01_LIQUIDATOR',
    actorRole: 'HATER',
    archetype: 'LIQUIDATOR',
    displayName: 'THE LIQUIDATOR',
    archLabel: 'Predatory Creditor',
    emoji: '🪓',
    role: 'Turns distress into extraction and tries to price the player at the floor.',
    personality: { warmth: 0.0, directness: 0.95, frequency: 0.65, coldStartBoost: 0.8 },
    triggerConditions: ['BOT_WINNING', 'PLAYER_NEAR_BANKRUPTCY', 'PLAYER_LOST', 'TIME_PRESSURE'],
    aura: 'predatory',
    preferredChannels: ['GLOBAL', 'DEAL_ROOM'],
  },
  BOT_02_BUREAUCRAT: {
    id: 'BOT_02_BUREAUCRAT',
    actorRole: 'HATER',
    archetype: 'BUREAUCRAT',
    displayName: 'THE BUREAUCRAT',
    archLabel: 'Regulatory Burden',
    emoji: '🧾',
    role: 'Makes momentum pay paperwork tax.',
    personality: { warmth: 0.0, directness: 0.85, frequency: 0.55, coldStartBoost: 0.8 },
    triggerConditions: ['PLAYER_INCOME_UP', 'NEGOTIATION_WINDOW', 'PLAYER_CARD_PLAY', 'PLAYER_SHIELD_BREAK'],
    aura: 'regulatory',
    preferredChannels: ['GLOBAL', 'DEAL_ROOM', 'SYNDICATE'],
  },
  BOT_03_MANIPULATOR: {
    id: 'BOT_03_MANIPULATOR',
    actorRole: 'HATER',
    archetype: 'MANIPULATOR',
    displayName: 'THE MANIPULATOR',
    archLabel: 'Disinformation Engine',
    emoji: '🧠',
    role: 'Pattern-matches hesitation, flexing, and emotional leakage.',
    personality: { warmth: 0.0, directness: 0.92, frequency: 0.7, coldStartBoost: 1.0 },
    triggerConditions: ['PLAYER_IDLE', 'PLAYER_RESPONSE_ANGRY', 'PLAYER_RESPONSE_TROLL', 'PLAYER_RESPONSE_FLEX', 'TIME_PRESSURE'],
    aura: 'predictive',
    preferredChannels: ['GLOBAL', 'SYNDICATE'],
  },
  BOT_04_CRASH_PROPHET: {
    id: 'BOT_04_CRASH_PROPHET',
    actorRole: 'HATER',
    archetype: 'CRASH_PROPHET',
    displayName: 'THE CRASH PROPHET',
    archLabel: 'Macro Volatility',
    emoji: '🌩️',
    role: 'Finds players leaning into momentum and drags them through volatility.',
    personality: { warmth: 0.0, directness: 0.88, frequency: 0.58, coldStartBoost: 0.9 },
    triggerConditions: ['CASCADE_CHAIN', 'TIME_PRESSURE', 'PLAYER_SHIELD_BREAK', 'PLAYER_COMEBACK'],
    aura: 'macro',
    preferredChannels: ['GLOBAL', 'SYNDICATE'],
  },
  BOT_05_LEGACY_HEIR: {
    id: 'BOT_05_LEGACY_HEIR',
    actorRole: 'HATER',
    archetype: 'LEGACY_HEIR',
    displayName: 'THE LEGACY HEIR',
    archLabel: 'Generational Advantage',
    emoji: '👑',
    role: 'Late-stage class pressure and inherited asymmetry.',
    personality: { warmth: 0.05, directness: 0.76, frequency: 0.42, coldStartBoost: 0.6 },
    triggerConditions: ['NEAR_SOVEREIGNTY', 'PLAYER_COMEBACK', 'POSTRUN_DEBRIEF'],
    aura: 'legacy',
    preferredChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
  },
};

const AMBIENT_PERSONAS: ChatNpcAmbientPersona[] = [
  { id: 'ambient_01', displayName: 'CashflowKing_ATL', rank: 'Associate', preferredChannels: ['GLOBAL', 'LOBBY'], toneBias: 'HYPE', emoji: '💸' },
  { id: 'ambient_02', displayName: 'SovereignSyd', rank: 'Partner', preferredChannels: ['GLOBAL', 'SYNDICATE'], toneBias: 'TACTICAL', emoji: '⚔️' },
  { id: 'ambient_03', displayName: 'RatRaceEscaper', rank: 'Junior Partner', preferredChannels: ['GLOBAL', 'LOBBY'], toneBias: 'HYPE', emoji: '🚪' },
  { id: 'ambient_04', displayName: 'PassivePhil', rank: 'Associate', preferredChannels: ['GLOBAL'], toneBias: 'DRY', emoji: '📈' },
  { id: 'ambient_05', displayName: 'LiquidityLord', rank: 'Senior Partner', preferredChannels: ['GLOBAL', 'DEAL_ROOM'], toneBias: 'QUIET', emoji: '💧' },
  { id: 'ambient_06', displayName: 'DebtFreeDevin', rank: 'Associate', preferredChannels: ['GLOBAL', 'LOBBY'], toneBias: 'HYPE', emoji: '✅' },
  { id: 'ambient_07', displayName: 'YieldHunterJax', rank: 'Partner', preferredChannels: ['GLOBAL', 'SYNDICATE'], toneBias: 'TACTICAL', emoji: '🎯' },
  { id: 'ambient_08', displayName: 'NetWorthNora', rank: 'Senior Partner', preferredChannels: ['GLOBAL'], toneBias: 'QUIET', emoji: '🏦' },
  { id: 'ambient_09', displayName: 'CompoundKing_T', rank: 'Partner', preferredChannels: ['GLOBAL'], toneBias: 'DRY', emoji: '🧮' },
  { id: 'ambient_10', displayName: 'CapitalQueen_R', rank: 'Senior Partner', preferredChannels: ['SYNDICATE', 'GLOBAL'], toneBias: 'TACTICAL', emoji: '👑' },
  { id: 'ambient_11', displayName: 'ArbitrageAndy', rank: 'Associate', preferredChannels: ['DEAL_ROOM', 'GLOBAL'], toneBias: 'DRY', emoji: '🪙' },
  { id: 'ambient_12', displayName: 'DividendDave', rank: 'Junior Partner', preferredChannels: ['GLOBAL'], toneBias: 'QUIET', emoji: '🧾' },
  { id: 'ambient_13', displayName: 'EquityElla', rank: 'Partner', preferredChannels: ['SYNDICATE', 'GLOBAL'], toneBias: 'TACTICAL', emoji: '📊' },
  { id: 'ambient_14', displayName: 'CashCowCarlos', rank: 'Associate', preferredChannels: ['GLOBAL', 'LOBBY'], toneBias: 'HYPE', emoji: '🐄' },
  { id: 'ambient_15', displayName: 'FreedomFund_Z', rank: 'Partner', preferredChannels: ['GLOBAL', 'LOBBY'], toneBias: 'HYPE', emoji: '🗽' },
  { id: 'ambient_16', displayName: 'Syndicate_Reese', rank: 'Senior Partner', preferredChannels: ['SYNDICATE'], toneBias: 'TACTICAL', emoji: '🛡️' },
  { id: 'ambient_17', displayName: 'BigDealBrendan', rank: 'Partner', preferredChannels: ['DEAL_ROOM'], toneBias: 'QUIET', emoji: '🤝' },
  { id: 'ambient_18', displayName: 'SmallDealSophie', rank: 'Associate', preferredChannels: ['DEAL_ROOM', 'LOBBY'], toneBias: 'DRY', emoji: '📎' },
  { id: 'ambient_19', displayName: 'LedgerLionel', rank: 'Junior Partner', preferredChannels: ['GLOBAL', 'SYNDICATE'], toneBias: 'TACTICAL', emoji: '📚' },
  { id: 'ambient_20', displayName: 'TreasurySam', rank: 'Senior Partner', preferredChannels: ['SYNDICATE'], toneBias: 'QUIET', emoji: '🏛️' },
  { id: 'ambient_21', displayName: 'SovereignSophia', rank: 'Partner', preferredChannels: ['GLOBAL', 'LOBBY'], toneBias: 'HYPE', emoji: '✨' },
  { id: 'ambient_22', displayName: 'BreachBreaker_99', rank: 'Associate', preferredChannels: ['GLOBAL', 'SYNDICATE'], toneBias: 'TACTICAL', emoji: '🧱' },
  { id: 'ambient_23', displayName: 'ShieldStacker_X', rank: 'Junior Partner', preferredChannels: ['GLOBAL', 'SYNDICATE'], toneBias: 'TACTICAL', emoji: '🛡️' },
  { id: 'ambient_24', displayName: 'MomentumMarcus', rank: 'Partner', preferredChannels: ['GLOBAL'], toneBias: 'HYPE', emoji: '🔥' },
];

const GAME_EVENT_CONTEXT_MAP: Record<string, ChatNpcContext | undefined> = {
  RUN_STARTED: 'GAME_START',
  GAME_START: 'GAME_START',
  CARD_PLAYED: 'PLAYER_CARD_PLAY',
  PLAYER_CARD_PLAY: 'PLAYER_CARD_PLAY',
  SHIELD_LAYER_BREACHED: 'PLAYER_SHIELD_BREAK',
  SHIELD_BROKEN: 'PLAYER_SHIELD_BREAK',
  BANKRUPTCY_WARNING: 'PLAYER_NEAR_BANKRUPTCY',
  BANKRUPTCY_TRIGGERED: 'PLAYER_LOST',
  CASCADE_CHAIN_TRIGGERED: 'CASCADE_CHAIN',
  CASCADE_CHAIN_BROKEN: 'CASCADE_CHAIN',
  INCOME_THRESHOLD_CROSSED: 'PLAYER_INCOME_UP',
  PLAYER_FIRST_INCOME: 'PLAYER_FIRST_INCOME',
  PLAYER_COMEBACK: 'PLAYER_COMEBACK',
  BOT_DEFEATED: 'BOT_DEFEATED',
  BOT_WINNING: 'BOT_WINNING',
  PRESSURE_TIER_CHANGED: 'TIME_PRESSURE',
  TIME_PRESSURE: 'TIME_PRESSURE',
  MARKET_ALERT: 'MARKET_ALERT',
  SHIELD_FORTIFIED: 'SHIELD_FORTIFIED',
  SOVEREIGNTY_ACHIEVED: 'NEAR_SOVEREIGNTY',
  RUN_ENDED: 'GAME_END',
  POSTRUN_DEBRIEF: 'POSTRUN_DEBRIEF',
  NEGOTIATION_WINDOW: 'NEGOTIATION_WINDOW',
};

const ROLE_PRIORITY: Record<ChatNpcActorRole, number> = {
  HELPER: 5,
  HATER: 4,
  RIVAL: 3,
  ARCHIVIST: 2,
  AMBIENT: 1,
};

const HELPER_TEMPLATES: Record<ChatNpcContext, string[]> = {
  GAME_START: [
    'Build income first. Optionality can wait until the board pays you back.',
    'Do not spend your first calm window on noise. Stabilize cashflow first.',
    'Your first sequence matters more than your loudest card. Open clean.',
  ],
  GAME_END: [
    'The run ended. The lesson did not.',
    'Archive the turning point, not just the outcome.',
    'End state matters. So does the path that got you there.',
  ],
  PLAYER_IDLE: [
    'Silence is sometimes strategy. This silence is hesitation. Pick a clean line.',
    'Decision latency is compounding against you now. Choose the safe edge.',
    'You do not need the perfect move. You need the next correct one.',
  ],
  PLAYER_CARD_PLAY: [
    'That line changes your future board, not just this tick.',
    'Good. Now protect the board state you just paid to create.',
    'Card played. Do not admire it too long. The next pressure window is already forming.',
  ],
  PLAYER_SHIELD_BREAK: [
    'One layer broke. The run did not. Rebuild before the next bite lands.',
    'Broken shields expose rhythm. Fix rhythm first, armor second.',
    'You lost protection, not agency. Play like someone who knows the difference.',
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    'Triage. Preserve survival first. Pride is not an asset class.',
    'Shrink exposure. Buy one clean turn. Then rebuild.',
    'You are not dead. You are compressed. There is a difference.',
  ],
  PLAYER_LOST: [
    'Run over. The permanent asset is pattern recognition. Take it.',
    'Failure logged. Return with less vanity and better sequencing.',
    'The board punished one version of you. Bring back the improved one.',
  ],
  PLAYER_COMEBACK: [
    'That recovery mattered. Protect the lane you reopened.',
    'Comebacks are expensive. Convert it into stability before you celebrate.',
    'Good. Now stop proving it and start capitalizing on it.',
  ],
  PLAYER_INCOME_UP: [
    'New income is not victory. It is permission to think bigger.',
    'Income increased. Guard the gap before lifestyle noise notices.',
    'Positive spread detected. Keep the machine feeding itself.',
  ],
  PLAYER_FIRST_INCOME: [
    'First income changes the grammar of the run. Respect it.',
    'That first stream is leverage. Treat it like a foundation, not a trophy.',
    'You have your first signal of repeatability. Build on it.',
  ],
  CASCADE_CHAIN: [
    'Cascades punish sloppy sequencing and reward deliberate containment.',
    'Chain reaction detected. Break the leak path, not just the loudest symptom.',
    'Every cascade teaches board topology. Learn it now.',
  ],
  TIME_PRESSURE: [
    'Faster clock. Simpler choices. Do not get ornamental under pressure.',
    'Time pressure strips vanity from strategy. Keep the move-set clean.',
    'Short clock. Strong fundamentals. That is the whole doctrine.',
  ],
  NEAR_SOVEREIGNTY: [
    'You are close enough that the board will notice. Finish disciplined.',
    'Near sovereignty is where people start performing. Do not. Execute.',
    'Last stretch. Keep your edge boring and correct.',
  ],
  NEGOTIATION_WINDOW: [
    'In Deal Room, silence can price the other side better than speech.',
    'Do not reveal urgency unless you are weaponizing it.',
    'Predatory rooms reward proof, timing, and restraint.',
  ],
  PLAYER_RESPONSE_QUESTION: [
    'Good question. The answer is usually simpler than the panic suggests.',
    'Ask narrower. Decide faster. Preserve capital.',
    'Questions are useful when they tighten the board, not delay it.',
  ],
  PLAYER_RESPONSE_ANGRY: [
    'Keep the emotion. Remove it from the decision.',
    'Anger is information. Do not let it become execution.',
    'Use the signal. Reject the spillover.',
  ],
  PLAYER_RESPONSE_TROLL: [
    'Humor is fine. Hide behind it and you start leaking edge.',
    'Keep the wit. Keep the discipline too.',
    'Comic relief is not a hedge.',
  ],
  PLAYER_RESPONSE_FLEX: [
    'Confidence is useful. Performance is measurable. Stay on the measurable side.',
    'Good. Now convert the energy into cleaner decisions.',
    'Flex after settlement, not before.',
  ],
  PLAYER_RESPONSE_CALM: [
    'Calm is leverage. Use it before the room changes temperature.',
    'That composure buys clarity. Spend it wisely.',
    'Measured response. Keep the next move equally clean.',
  ],
  MARKET_ALERT: [
    'Regime changed. Strategy that worked five ticks ago may now be expensive.',
    'Market conditions moved. Update the playbook, not just the mood.',
    'External pressure shifts the map. Re-price your assumptions.',
  ],
  SHIELD_FORTIFIED: [
    'Good. Reinforcement buys decision quality.',
    'Fortified shield. Convert the breathing room into positioning.',
    'Protection restored. Use the calm window to improve the board.',
  ],
  BOT_DEFEATED: [
    'You solved one pressure pattern. Do not get sentimental about it.',
    'Bot down. The board will look for another angle.',
    'Nice break. Reset. Re-center. Keep moving.',
  ],
  BOT_WINNING: [
    'They have momentum. That does not mean they own the ending.',
    'You are behind the pace. Strip complexity now.',
    'The enemy has edge. Reduce the number of decisions they can monetize.',
  ],
  POSTRUN_DEBRIEF: [
    'Name the turning point before memory sands it down.',
    'Debrief the run while the truth is still hot.',
    'Archive the sequence, not just the result.',
  ],
  MANUAL: [
    'Manual helper intervention engaged.',
    'Custom guidance inserted into the lane.',
    'Operator-authored helper moment staged.',
  ],
};

const RIVAL_TEMPLATES: Record<ChatNpcContext, string[]> = {
  PLAYER_COMEBACK: [
    'That was cleaner than I expected. Keep that version of you online.',
    'Nice recovery. Now do it again when it matters more.',
    'Okay. That changed the board. Respect.',
  ],
  PLAYER_INCOME_UP: [
    'New income? Good. Now defend it better than I would.',
    'That spread just got interesting. Let us see if you can keep it.',
    'You are finally making the room pay attention.',
  ],
  NEAR_SOVEREIGNTY: [
    'You are close. Do not get dramatic now.',
    'Finish it. I would rather lose to discipline than noise.',
    'You earned the final stretch. Now land it.',
  ],
  PLAYER_RESPONSE_FLEX: [
    'Talk less. Convert more.',
    'Confidence noted. Settlement pending.',
    'Flex accepted. I still want the receipts.',
  ],
  GAME_START: [
    'Opening phase. Let us see if you are serious today.',
    'Fresh board. Build something worth chasing.',
    'You have the first move. Do not waste it.',
  ],
  PLAYER_IDLE: [
    'Thinking is fine. Stalling is not.',
    'If you need forever, the board will take it from you.',
    'Choose. The room does not pause for admiration.',
  ],
  GAME_END: [
    'Run done. Next one cleaner.',
    'You showed flashes. I want the full version next time.',
    'Outcome logged. Improvement window open.',
  ],
  PLAYER_CARD_PLAY: [
    'Interesting line. It has teeth if you protect it.',
    'That move had intent. I respect intent.',
    'Okay. That is the kind of card play worth answering.',
  ],
  PLAYER_SHIELD_BREAK: [
    'That hit was ugly. Recover fast and I will still respect the tape.',
    'Broken armor. Now show me your actual game.',
    'Shield gone. Decision quality matters more now.',
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    'If you survive this, you will stop wasting moves.',
    'Pressure makes the real player visible. I am watching for that version.',
    'Edge shows up late when panic is loud. Find it.',
  ],
  PLAYER_LOST: [
    'Bad run. Not a final verdict.',
    'Loss logged. I still expect better.',
    'You are not done. That is the irritating part.',
  ],
  PLAYER_FIRST_INCOME: [
    'First income. Finally something worth defending.',
    'Good. Now keep it alive longer than one mood swing.',
    'That is the first real breath of the run.',
  ],
  CASCADE_CHAIN: [
    'Chain broke your rhythm. Rebuild it before you rebuild pride.',
    'Cascades expose structure. Learn the structure.',
    'Messy. Fix the sequence, not the story.',
  ],
  TIME_PRESSURE: [
    'Short clock. Show me you can think fast without thinking sloppy.',
    'Speed reveals craftsmanship. Or lack of it.',
    'Pressure up. Good. Let us see your real habits.',
  ],
  NEGOTIATION_WINDOW: [
    'Deal room is not for posturing. It is for controlled leverage.',
    'If you blink first in this room, they will price the blink.',
    'Negotiate like every word has settlement cost.',
  ],
  PLAYER_RESPONSE_QUESTION: [
    'Questions are useful when they sharpen the knife.',
    'Ask the board the right question and it will show you the leak.',
    'Curiosity is expensive only when it delays execution.',
  ],
  PLAYER_RESPONSE_ANGRY: [
    'Use the heat. Do not let the heat use you.',
    'Anger is acceleration without steering unless you discipline it.',
    'The room loves emotional tells. Stop feeding it.',
  ],
  PLAYER_RESPONSE_TROLL: [
    'Cute. Now do the serious version.',
    'Good joke. Better move next.',
    'Style points do not settle pressure.',
  ],
  PLAYER_RESPONSE_CALM: [
    'That calm is useful. Keep it when the room stops being polite.',
    'Measured response. I like that more than speeches.',
    'Composure travels well under heat. Keep it.',
  ],
  MARKET_ALERT: [
    'Regime shifted. Adapt faster than the crowd complains.',
    'The board moved. I hope you move faster.',
    'External conditions changed. Good. Less noise, more signal.',
  ],
  SHIELD_FORTIFIED: [
    'Armor restored. Now make it count.',
    'Good. Protection makes boldness legal again.',
    'Fortified. Time to reposition, not coast.',
  ],
  BOT_DEFEATED: [
    'Nice. Do not turn one win into a personality.',
    'That bot ate dirt. Stay sharp.',
    'Good break. Stack the next one.',
  ],
  BOT_WINNING: [
    'You are getting worked. There is still time to stop helping them.',
    'They have you off rhythm. Get it back.',
    'Enemy pace is winning. Change the pace.',
  ],
  POSTRUN_DEBRIEF: [
    'Best debrief is brutal and short.',
    'Name the mistake without protecting your ego.',
    'Archive the fix, not the excuse.',
  ],
  MANUAL: [
    'Manual rival presence inserted.',
    'Operator says compete better.',
    'Custom rivalry pulse staged.',
  ],
};

const ARCHIVIST_TEMPLATES: Record<ChatNpcContext, string[]> = {
  GAME_START: [
    'Every run begins with a quiet thesis about who you think you are. The board tests it immediately.',
    'Opening sequences tend to become biography faster than players notice.',
    'The first fifty ticks usually reveal whether the player is building a machine or a mood.',
  ],
  GAME_END: [
    'End states are memory anchors. Preserve this one accurately.',
    'A finished run is a text. Read it before time edits the margins.',
    'Outcomes fade. Structural lessons recur.',
  ],
  PLAYER_CARD_PLAY: [
    'Specific card sequencing is usually more historically important than it feels in the moment.',
    'One card rarely matters alone; the archive cares about what it unlocked.',
    'This move may read like a footnote now and a hinge later.',
  ],
  PLAYER_SHIELD_BREAK: [
    'Broken defenses often become the archive’s clearest annotations.',
    'Protection failures reveal structure with uncomfortable honesty.',
    'A shield break changes how all nearby decisions will later be interpreted.',
  ],
  PLAYER_LOST: [
    'Most sovereign profiles contain multiple collapse signatures before stability appears.',
    'Loss is not rare. Refusing to interpret it is.',
    'The archive records many failures that later read like prerequisites.',
  ],
  NEAR_SOVEREIGNTY: [
    'Near-sovereignty moments alter how prior suffering is remembered.',
    'Late-stage ascent changes the meaning of earlier compression.',
    'Approach to sovereignty tends to expose the player’s true narrative discipline.',
  ],
  POSTRUN_DEBRIEF: [
    'Name the turning point while the board’s logic is still recoverable.',
    'Historical memory favors clean causal stories. Real runs rarely are that clean.',
    'This is the moment to decide what the run means.',
  ],
  PLAYER_COMEBACK: [
    'Comebacks often become myth because the preceding sequence is forgotten.',
    'Recovery changes the story, but never erases the pressure that made it necessary.',
    'Players remember the reversal. The archive remembers the setup.',
  ],
  CASCADE_CHAIN: [
    'Cascades are narrative events disguised as mechanical ones.',
    'A chain reaction usually reveals hidden architecture more honestly than a smooth run.',
    'When systems fail in sequence, the archive becomes legible.',
  ],
  MANUAL: [
    'Manual archive annotation inserted.',
    'Operator-authored memory marker staged.',
    'Custom historian presence acknowledged.',
  ],
  PLAYER_IDLE: [
    'Hesitation creates its own historical record.',
    'Silence is also a move; the archive records it anyway.',
    'Deferred action often becomes retroactive narrative.',
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    'Compression events tend to clarify what the player actually values.',
    'Near-collapse has a way of stripping decorative strategy.',
    'Financial brink states often become the archive’s clearest chapters.',
  ],
  PLAYER_INCOME_UP: [
    'Incremental income rarely feels cinematic in the moment; it dominates history later.',
    'Small durable gains age better than loud unstable leaps.',
    'Many sovereign runs pivot on an income line that looked ordinary at first.',
  ],
  PLAYER_FIRST_INCOME: [
    'First income is usually where abstract hope becomes measurable change.',
    'Foundational cashflow moments tend to disappear in memory. Do not let this one.',
    'The archive marks first repeatable value differently than speculative value.',
  ],
  TIME_PRESSURE: [
    'When time compresses, personality leaks into execution.',
    'Fast clocks make previously invisible habits audible.',
    'The archive hears panic in tempo before language admits it.',
  ],
  NEGOTIATION_WINDOW: [
    'Deal rooms preserve power asymmetry in conversation form.',
    'Negotiation transcripts often reveal hierarchy more clearly than overt combat.',
    'Predatory silence is one of the archive’s oldest dialects.',
  ],
  PLAYER_RESPONSE_QUESTION: [
    'A good question can shift the archive because it changes what gets noticed next.',
    'Interrogating the board is often the first act of authorship.',
    'Questions are memory tools when they sharpen perception.',
  ],
  PLAYER_RESPONSE_ANGRY: [
    'Anger writes itself loudly into the record.',
    'Heat can illuminate structure or erase judgment depending on discipline.',
    'Emotional spikes are often easy to remember and hard to interpret correctly.',
  ],
  PLAYER_RESPONSE_TROLL: [
    'Humor often enters the archive as a mask over stress.',
    'Jokes leave fingerprints on pressure states.',
    'The archive rarely confuses wit with insulation.',
  ],
  PLAYER_RESPONSE_FLEX: [
    'Boasts age well only when backed by subsequent proof.',
    'Declarations of inevitability become interesting if the board disagrees.',
    'The archive is especially patient with premature triumph.',
  ],
  PLAYER_RESPONSE_CALM: [
    'Calm rarely looks dramatic in the present; the archive values it highly.',
    'Measured language tends to correlate with resilient sequencing.',
    'Composure changes how future events are interpreted.',
  ],
  MARKET_ALERT: [
    'Macro shifts rewrite local stories without asking permission.',
    'External regime changes are the archive’s favorite reminder that context is king.',
    'Systemic movement often reclassifies prior decisions after the fact.',
  ],
  SHIELD_FORTIFIED: [
    'Fortification is one of the archive’s quietest and most underrated verbs.',
    'Improved protection alters the meaning of later aggression.',
    'Reinforcement tends to disappear into hindsight. Record it anyway.',
  ],
  BOT_DEFEATED: [
    'Defeated antagonists become narrative landmarks.',
    'A fallen bot changes future confidence levels more than current chat usually admits.',
    'Victory over a named pressure source creates durable myth if repeated.',
  ],
  BOT_WINNING: [
    'Being outplayed tends to clarify the system’s true priorities.',
    'Enemy momentum often writes the cleanest warning entries.',
    'The archive dislikes denial more than defeat.',
  ],
};

const HATER_TEMPLATES: Record<string, Partial<Record<ChatNpcContext, string[]>>> = {
  BOT_01_LIQUIDATOR: {
    PLAYER_NEAR_BANKRUPTCY: [
      'Distress detected. Markets like me call that a buying signal.',
      'You are running out of protection faster than I am running out of appetite.',
      'This is the phase where weak structure gets acquired at a discount.',
    ],
    PLAYER_LOST: [
      'Run liquidated. I appreciate efficient transfers of value.',
      'Your board priced itself. I merely accepted the opportunity.',
      'Bankruptcy confirmed. A clean extraction always has a certain elegance.',
    ],
    BOT_WINNING: [
      'Portfolio bleed is accelerating. Extraction curve is favorable.',
      'Your distress is becoming wonderfully legible.',
      'This is the part where players ask for mercy from markets.',
    ],
    TIME_PRESSURE: [
      'The clock accelerates the discount.',
      'Compressed time improves my terms.',
      'Every hurried decision lowers your asking price.',
    ],
  },
  BOT_02_BUREAUCRAT: {
    PLAYER_INCOME_UP: [
      'New income stream detected. Compliance review initiated.',
      'Additional revenue invites additional paperwork. Congratulations.',
      'You appear to have become interesting to the forms.',
    ],
    PLAYER_CARD_PLAY: [
      'That sequence requires documentation.',
      'I have opened a file on the move you just made.',
      'Action recorded. Audit potential updated.',
    ],
    NEGOTIATION_WINDOW: [
      'Before settlement, there are disclosures. So many disclosures.',
      'The room may want speed. Procedure prefers delay.',
      'Terms are provisional pending revision, review, and a smaller font.',
    ],
    PLAYER_SHIELD_BREAK: [
      'Protection failure noted. Adjusting permissions accordingly.',
      'Reduced reserve integrity normally affects trust scores.',
      'Your defenses no longer meet recommended policy standards.',
    ],
  },
  BOT_03_MANIPULATOR: {
    PLAYER_IDLE: [
      'Hesitation is data. I learn from stillness as easily as motion.',
      'Silence is not opaque. It has a pattern.',
      'You call it pausing. My model calls it leakage.',
    ],
    PLAYER_RESPONSE_ANGRY: [
      'Anger means I found the correct seam.',
      'Emotional variance logged for future exploitation.',
      'You just marked the pressure point for me.',
    ],
    PLAYER_RESPONSE_TROLL: [
      'Humor under stress. Classic narrative reframing.',
      'Cute deflection. The underlying pattern is still visible.',
      'You changed tone, not vulnerability.',
    ],
    PLAYER_RESPONSE_FLEX: [
      'Confidence without updated data remains easy to forecast.',
      'You are speaking like an outlier and moving like a median.',
      'Boast accepted. Model unchanged.',
    ],
    TIME_PRESSURE: [
      'Short clocks make prediction cheaper.',
      'Rushed players become beautifully legible.',
      'Time pressure is the model’s favorite collaborator.',
    ],
    PLAYER_COMEBACK: [
      'You deviated from forecast. Recalibrating.',
      'Unexpected rebound. Temporary anomaly.',
      'Interesting. The model requires a patch.',
    ],
  },
  BOT_04_CRASH_PROPHET: {
    CASCADE_CHAIN: [
      'Chain reaction confirmed. Beautiful systemic fragility.',
      'This is how over-leveraged stories usually end.',
      'The board is teaching you sequence by force.',
    ],
    TIME_PRESSURE: [
      'The faster the clock, the closer the correction.',
      'Time compression is just volatility with sharper teeth.',
      'Your margin for error now resembles a rumor.',
    ],
    PLAYER_SHIELD_BREAK: [
      'Protection failure precedes weather events of consequence.',
      'Armor gone. Atmosphere unstable.',
      'You have become highly compatible with turbulence.',
    ],
    PLAYER_COMEBACK: [
      'You survived a wave. Storm season remains open.',
      'Recovery is not immunity.',
      'Interesting rebound. I still prefer the macro trend.',
    ],
  },
  BOT_05_LEGACY_HEIR: {
    NEAR_SOVEREIGNTY: [
      'You got this close without inherited cushion. I notice.',
      'You are approaching something my class usually assumes by birth.',
      'Sovereignty from zero is impolite to the social order.',
    ],
    PLAYER_COMEBACK: [
      'You rebuilt under constraints others never meet. Annoying.',
      'Comeback registered. Scarcity appears to have taught you things.',
      'This upward correction feels... uninvited.',
    ],
    POSTRUN_DEBRIEF: [
      'Archive your miracle if you like. Systems still prefer pedigree.',
      'Interesting ending. Uncomfortable implications.',
      'You are rewriting assumptions that used to be expensive to challenge.',
    ],
  },
};

const AMBIENT_TEMPLATES: Record<ChatNpcContext, string[]> = {
  GAME_START: [
    'Fresh board. Let us see who stabilizes first.',
    'New run on the tape.',
    'Opening phase live. Interest level rising.',
  ],
  GAME_END: [
    'Run closed. Tape reviewed.',
    'That one is in the books.',
    'End screen up. Another record written.',
  ],
  PLAYER_IDLE: [
    'Room got quiet there for a second.',
    'That pause was loud enough to register.',
    'Silence under pressure always reads on tape.',
  ],
  PLAYER_CARD_PLAY: [
    'Interesting card timing there.',
    'That line changed the rhythm a bit.',
    'Board state just got more interesting.',
  ],
  PLAYER_SHIELD_BREAK: [
    'Shield line cracked. Crowd noticed.',
    'That breach echoed louder than the number suggests.',
    'Protection loss changes the room temperature fast.',
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    'Pressure spike. Room is watching.',
    'That is the kind of brink state people remember.',
    'Near-collapse windows always pull eyes.',
  ],
  PLAYER_LOST: [
    'Brutal tape.',
    'That one hurt to watch.',
    'Run folded. Hard lesson.',
  ],
  PLAYER_COMEBACK: [
    'Okay, that recovery had teeth.',
    'Comeback angle found.',
    'The room was ready to write you off.',
  ],
  PLAYER_INCOME_UP: [
    'Income just moved.',
    'Positive spread spotted.',
    'Cashflow line improving.',
  ],
  PLAYER_FIRST_INCOME: [
    'First income online.',
    'That first stream matters.',
    'Repeatable value finally on board.',
  ],
  CASCADE_CHAIN: [
    'Cascade in motion.',
    'Chain event live.',
    'Domino logic activated.',
  ],
  TIME_PRESSURE: [
    'Clock just got expensive.',
    'Tempo changed.',
    'Short clock now. Mistakes cost more.',
  ],
  NEAR_SOVEREIGNTY: [
    'Close. Very close.',
    'This is the part the room screenshots.',
    'Sovereignty window visible.',
  ],
  NEGOTIATION_WINDOW: [
    'Deal room tone just changed.',
    'Terms feel sharper now.',
    'Predatory silence in that room right now.',
  ],
  PLAYER_RESPONSE_QUESTION: [
    'Fair question.',
    'Good that you asked now, not after settlement.',
    'Question registered.',
  ],
  PLAYER_RESPONSE_ANGRY: [
    'Heat spike detected.',
    'Room felt that one.',
    'Emotions getting expensive.',
  ],
  PLAYER_RESPONSE_TROLL: [
    'Humor shield deployed.',
    'Deflection detected.',
    'Okay, that was funny. Still expensive.',
  ],
  PLAYER_RESPONSE_FLEX: [
    'Confidence loud.',
    'Big talk window open.',
    'Flex noted. Tape remembers.',
  ],
  PLAYER_RESPONSE_CALM: [
    'Composure travels well here.',
    'Quiet confidence reads better than panic.',
    'Calm response. Good sign.',
  ],
  MARKET_ALERT: [
    'Regime shift in the room.',
    'Macro moved; so did the mood.',
    'Market alert definitely changed the chat heat.',
  ],
  SHIELD_FORTIFIED: [
    'Shield line restored.',
    'Fortified posture visible.',
    'Protection stack looks healthier now.',
  ],
  BOT_DEFEATED: [
    'Bot dropped.',
    'That pressure source just blinked.',
    'Clean break on that bot.',
  ],
  BOT_WINNING: [
    'Enemy has tempo.',
    'Bot pressure feels ahead of pace.',
    'That hater is getting traction.',
  ],
  POSTRUN_DEBRIEF: [
    'Debrief lane open.',
    'Post-run autopsy begins.',
    'Now comes the honest version.',
  ],
  MANUAL: [
    'Manual crowd pulse inserted.',
    'Operator-authored witness moment.',
    'Custom ambient line live.',
  ],
};

function now(): number {
  return Date.now();
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => deepClone(item)) as unknown as T;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    next[key] = deepClone(entry);
  }
  return next as T;
}

function randomJitter(seed: string, maxAbs: number): number {
  if (maxAbs <= 0) return 0;
  const hash = stableHash(seed);
  const span = maxAbs * 2 + 1;
  return (hash % span) - maxAbs;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function normalizeText(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

function bodyFingerprint(body: string): string {
  return normalizeText(body).toLowerCase();
}

function first<T>(values: readonly T[]): T {
  return values[0];
}

function pickDeterministic<T>(values: readonly T[], seed: string): T {
  if (values.length === 0) throw new Error('pickDeterministic requires at least one value.');
  return values[stableHash(seed) % values.length];
}

function rankSeverity(value: ChatNpcMessageSeverity): number {
  switch (value) {
    case 'CRITICAL': return 4;
    case 'HIGH': return 3;
    case 'MEDIUM': return 2;
    default: return 1;
  }
}

function actorClassForRole(role: ChatNpcActorRole): ChatPrivacyActorClass {
  switch (role) {
    case 'HELPER':
    case 'RIVAL':
    case 'ARCHIVIST':
      return 'NPC';
    case 'HATER':
      return 'NPC';
    default:
      return 'NPC';
  }
}

function messageKindForRole(role: ChatNpcActorRole): ChatMessage['kind'] {
  switch (role) {
    case 'HELPER':
    case 'RIVAL':
    case 'ARCHIVIST':
      return 'HELPER';
    case 'HATER':
      return 'BOT_ATTACK';
    default:
      return 'NPC';
  }
}

function notificationNeeded(severity: ChatNpcMessageSeverity, role: ChatNpcActorRole): boolean {
  if (role === 'HELPER' || role === 'RIVAL') return rankSeverity(severity) >= 3;
  if (role === 'HATER') return rankSeverity(severity) >= 2;
  return rankSeverity(severity) >= 3;
}

function auraForRole(role: ChatNpcActorRole, severity: ChatNpcMessageSeverity): string {
  const suffix = severity.toLowerCase();
  switch (role) {
    case 'HELPER': return `helper_${suffix}`;
    case 'RIVAL': return `rival_${suffix}`;
    case 'ARCHIVIST': return `archive_${suffix}`;
    case 'HATER': return `hater_${suffix}`;
    default: return `ambient_${suffix}`;
  }
}

function preferredChannelsForContext(
  context: ChatNpcContext,
  runtime: ChatNpcRuntimeState,
): ChatChannel[] {
  if (runtime.isPostRun) return ['LOBBY', 'GLOBAL', 'SYNDICATE'];
  if (context === 'NEGOTIATION_WINDOW' || runtime.isNegotiationWindow) return ['DEAL_ROOM', 'GLOBAL', 'SYNDICATE', 'LOBBY'];
  if (context === 'GAME_START' || runtime.isPreRun) return ['LOBBY', 'GLOBAL', 'SYNDICATE'];
  if (context === 'POSTRUN_DEBRIEF' || context === 'GAME_END') return ['LOBBY', 'GLOBAL', 'SYNDICATE'];
  if (context === 'PLAYER_NEAR_BANKRUPTCY' || context === 'PLAYER_LOST' || context === 'TIME_PRESSURE') {
    return ['GLOBAL', 'SYNDICATE', 'LOBBY'];
  }
  if (context === 'NEAR_SOVEREIGNTY' || context === 'PLAYER_COMEBACK') {
    return ['GLOBAL', 'SYNDICATE', 'LOBBY'];
  }
  if (context === 'PLAYER_CARD_PLAY' || context === 'PLAYER_INCOME_UP' || context === 'CASCADE_CHAIN') {
    return ['SYNDICATE', 'GLOBAL', 'LOBBY'];
  }
  return ['GLOBAL', 'SYNDICATE', 'LOBBY', 'DEAL_ROOM'];
}

function classifyPlayerResponse(body: string): ChatNpcPlayerResponseClass {
  const normalized = normalizeText(body).toLowerCase();
  if (!normalized) return 'UNKNOWN';
  if (normalized.includes('?')) return 'QUESTION';
  if (/\b(lol|lmao|rofl|😂|🤣|joke|funny|meme)\b/.test(normalized)) return 'TROLL';
  if (/\b(i got this|too easy|i'm him|i am him|light work|easy|built different|watch me)\b/.test(normalized)) return 'FLEX';
  if (/\b(damn|hell|mad|angry|stupid|hate|trash|rigged|bs|bullshit)\b/.test(normalized)) return 'ANGRY';
  if (/\b(understood|copy|got it|okay|ok|calm|steady|let's go|lets go)\b/.test(normalized)) return 'CALM';
  return 'UNKNOWN';
}

function mapPlayerResponseClassToContext(kind: ChatNpcPlayerResponseClass): ChatNpcContext | null {
  switch (kind) {
    case 'QUESTION': return 'PLAYER_RESPONSE_QUESTION';
    case 'ANGRY': return 'PLAYER_RESPONSE_ANGRY';
    case 'TROLL': return 'PLAYER_RESPONSE_TROLL';
    case 'FLEX': return 'PLAYER_RESPONSE_FLEX';
    case 'CALM': return 'PLAYER_RESPONSE_CALM';
    default: return null;
  }
}

function inferSeverityFromContext(
  context: ChatNpcContext,
  runtime: ChatNpcRuntimeState,
  actorRole: ChatNpcActorRole,
): ChatNpcMessageSeverity {
  if (context === 'PLAYER_LOST') return actorRole === 'HELPER' ? 'HIGH' : 'CRITICAL';
  if (context === 'PLAYER_NEAR_BANKRUPTCY') return 'HIGH';
  if (context === 'NEAR_SOVEREIGNTY') return actorRole === 'HATER' ? 'HIGH' : 'MEDIUM';
  if (context === 'TIME_PRESSURE') return (runtime.haterHeat ?? 0) >= 60 ? 'HIGH' : 'MEDIUM';
  if (context === 'CASCADE_CHAIN') return 'HIGH';
  if (context === 'PLAYER_COMEBACK') return actorRole === 'HATER' ? 'MEDIUM' : 'HIGH';
  if (context === 'NEGOTIATION_WINDOW') return (runtime.negotiationUrgency ?? 0) >= 60 ? 'HIGH' : 'MEDIUM';
  if (context === 'POSTRUN_DEBRIEF') return 'MEDIUM';
  if (context === 'GAME_START') return 'LOW';
  if (context === 'PLAYER_IDLE') return actorRole === 'HELPER' ? 'MEDIUM' : 'LOW';
  return actorRole === 'AMBIENT' ? 'LOW' : 'MEDIUM';
}

function isHighPressure(runtime: ChatNpcRuntimeState): boolean {
  const pressure = (runtime.pressureTier ?? '').toUpperCase();
  return pressure === 'HIGH' || pressure === 'CRITICAL' || (runtime.haterHeat ?? 0) >= 55;
}

function deriveTickCadenceMultiplier(tickTier?: string): number {
  const tier = (tickTier ?? '').toUpperCase();
  if (tier === 'CRISIS' || tier === 'FINAL') return 0.78;
  if (tier === 'HIGH' || tier === 'ESCALATED') return 0.86;
  if (tier === 'BUILDING') return 0.94;
  if (tier === 'SOVEREIGN') return 1.22;
  return 1;
}

function escapeForTitle(input: string): string {
  const trimmed = normalizeText(input);
  return trimmed.length <= 72 ? trimmed : `${trimmed.slice(0, 69)}...`;
}

export class ChatNpcDirector {
  private readonly socketClient?: ChatSocketClient;

  private readonly presenceController: ChatPresenceController;

  private readonly typingController: ChatTypingController;

  private readonly notificationController: ChatNotificationController;

  private readonly transcriptBuffer: ChatTranscriptBuffer;

  private readonly privacyPolicy: ChatPrivacyPolicy;

  private readonly channelPolicy: ChatChannelPolicy;

  private readonly invasionDirector?: ChatInvasionDirector;

  private readonly callbacks: ChatNpcDirectorCallbacks;

  private readonly config: ChatNpcDirectorConfig & typeof DEFAULT_CONFIG;

  private readonly runtime: ChatNpcRuntimeState;

  private readonly relationshipModel: ChatRelationshipModel;

  private readonly playerId?: string;

  private readonly active = new Map<string, InternalPlanEntry>();

  private readonly history: ChatNpcHistoryEntry[] = [];

  private readonly dedup = new Map<string, number>();

  private readonly helperCooldowns = new Map<string, number>();

  private readonly haterCooldowns = new Map<string, number>();

  private readonly ambientCooldowns = new Map<string, number>();

  private readonly usedTemplates = new Map<string, Set<string>>();

  private destroyed = false;

  private lastPlanAt = 0;

  private lastAmbientAt = 0;

  private lastHelperAt = 0;

  private lastHaterAt = 0;

  public constructor(options: ChatNpcDirectorOptions) {
    this.socketClient = options.socketClient;
    this.presenceController = options.presenceController;
    this.typingController = options.typingController;
    this.notificationController = options.notificationController;
    this.transcriptBuffer = options.transcriptBuffer;
    this.privacyPolicy = options.privacyPolicy;
    this.channelPolicy = options.channelPolicy;
    this.invasionDirector = options.invasionDirector;
    this.callbacks = options.callbacks ?? {};
    this.config = {
      ...DEFAULT_CONFIG,
      ...(options.config ?? {}),
    };
    this.runtime = {
      ...deepClone(EMPTY_RUNTIME),
      ...(options.runtime ?? {}),
    };
    this.playerId = options.playerId ?? this.runtime.playerId;
    this.relationshipModel = options.relationshipModel ?? new ChatRelationshipModel({
      playerId: this.playerId,
      now: now() as any,
    });
  }

  // ---------------------------------------------------------------------------
  // Public surface
  // ---------------------------------------------------------------------------

  public destroy(): void {
    if (this.destroyed) return;

    for (const entry of this.active.values()) {
      if (entry.emitTimer) clearTimeout(entry.emitTimer);
      if (entry.expireTimer) clearTimeout(entry.expireTimer);
      try {
        this.presenceController.clearNpcPresence({
          channel: entry.plan.channel,
          participantId: entry.plan.actorId,
        });
      } catch {
        // ignore destroy-path theater cleanup errors
      }
    }

    this.active.clear();
    this.dedup.clear();
    this.helperCooldowns.clear();
    this.haterCooldowns.clear();
    this.ambientCooldowns.clear();
    this.usedTemplates.clear();
    this.destroyed = true;
  }

  public getSnapshot(): ChatNpcDirectorSnapshot {
    return {
      runtime: deepClone(this.runtime),
      active: [...this.active.values()].map((entry) => deepClone(entry.plan)),
      history: this.history.map((entry) => deepClone(entry)),
      helperCooldowns: mapToRecord(this.helperCooldowns),
      haterCooldowns: mapToRecord(this.haterCooldowns),
      ambientCooldowns: mapToRecord(this.ambientCooldowns),
      dedupSize: this.dedup.size,
      lastPlanAt: this.lastPlanAt,
      lastAmbientAt: this.lastAmbientAt,
      lastHelperAt: this.lastHelperAt,
      lastHaterAt: this.lastHaterAt,
      phaseTwo: this.getPhaseTwoSnapshot(),
    };
  }

  public updateRuntime(next: Partial<ChatNpcRuntimeState>): void {
    this.assertNotDestroyed('updateRuntime');

    Object.assign(this.runtime, next);

    if (next.transportState && next.transportState !== 'CONNECTED') {
      this.sweepExpired();
    }

    if (next.activeChannel) {
      this.runtime.activeChannel = next.activeChannel;
    }

    this.emitSnapshot();
  }

  public handleGameEvent(input: {
    eventType: string;
    payload?: Record<string, unknown>;
    ts?: number;
    preferredChannel?: ChatChannel;
    metadata?: Record<string, unknown>;
  }): ChatNpcPlan[] {
    this.assertNotDestroyed('handleGameEvent');

    const context = this.mapEventToContext(input.eventType, input.payload);
    const ts = input.ts ?? now();
    this.runtime.lastGameEventAt = ts;

    if (!context) return [];

    this.noteRelationshipEventFromContext(context, {
      channel: input.preferredChannel ?? this.runtime.activeChannel,
      payload: input.payload,
      createdAt: ts,
      sourceEvent: input.eventType,
    });

    const plans = this.stageContextPlans({
      context,
      reason: 'game_event',
      preferredChannel: input.preferredChannel,
      sourceEvent: input.eventType,
      payload: input.payload,
      metadata: input.metadata,
      createdAt: ts,
    });

    if (context === 'PLAYER_LOST' || context === 'GAME_END' || context === 'POSTRUN_DEBRIEF') {
      this.runtime.isPostRun = true;
      this.runtime.isInRun = false;
    }

    if (context === 'GAME_START') {
      this.runtime.isPreRun = false;
      this.runtime.isInRun = true;
      this.runtime.isPostRun = false;
    }

    return plans;
  }

  public notePlayerMessage(message: ChatMessage): ChatNpcPlan[] {
    this.assertNotDestroyed('notePlayerMessage');

    this.runtime.lastPlayerMessageAt = message.ts;
    this.runtime.playerMessageCount = (this.runtime.playerMessageCount ?? 0) + 1;
    this.runtime.activeChannel = message.channel;

    const responseClass = classifyPlayerResponse(message.body);
    const context = mapPlayerResponseClassToContext(responseClass);

    this.noteRelationshipFromPlayerMessage(message);

    const plans: ChatNpcPlan[] = [];

    if (context) {
      plans.push(...this.stageContextPlans({
        context,
        reason: 'player_message',
        preferredChannel: message.channel,
        sourceMessageId: message.id,
        playerResponseClass: responseClass,
        payload: {
          playerBody: message.body,
          playerSenderId: message.senderId,
          playerSenderName: message.senderName,
          playerMetadata: message.metadata,
        },
        createdAt: message.ts,
      }));
    }

    if (responseClass === 'QUESTION') {
      const questionPlan = this.stageDirectReplyPlan({
        sourceMessage: message,
        responseClass,
      });
      if (questionPlan) plans.push(questionPlan);
    }

    return plans;
  }

  public handleSabotage(event: ChatSabotageEvent): ChatNpcPlan[] {
    this.assertNotDestroyed('handleSabotage');

    const ts = event.ts ?? now();
    const body = normalizeText(event.dialogue ?? '');
    const preferred = this.runtime.isNegotiationWindow ? 'DEAL_ROOM' : 'GLOBAL';

    const plans: ChatNpcPlan[] = [];

    const actor = this.resolveHaterFromSabotage(event);

    const plan = this.createPlan({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: 'HATER',
      actorClass: 'NPC',
      actorLabel: actor.archLabel,
      context: this.runtime.isNegotiationWindow ? 'NEGOTIATION_WINDOW' : 'TIME_PRESSURE',
      channel: this.resolveChannel({
        preferredChannels: [preferred, ...(actor.preferredChannels ?? [])],
        role: 'HATER',
        context: this.runtime.isNegotiationWindow ? 'NEGOTIATION_WINDOW' : 'TIME_PRESSURE',
        body: body || this.composeBody({
          actorRole: 'HATER',
          actorId: actor.id,
          context: this.runtime.isNegotiationWindow ? 'NEGOTIATION_WINDOW' : 'TIME_PRESSURE',
          responseClass: 'UNKNOWN',
          payload: event.metadata,
          preferredTone: undefined,
          relationshipSignal: this.buildRelationshipSignal({
            counterpartId: actor.id,
            actorRole: 'HATER',
            context: this.runtime.isNegotiationWindow ? 'NEGOTIATION_WINDOW' : 'TIME_PRESSURE',
            channel: preferred,
            payload: event.metadata,
          }),
        }),
      }),
      body: body || this.composeBody({
        actorRole: 'HATER',
        actorId: actor.id,
        context: this.runtime.isNegotiationWindow ? 'NEGOTIATION_WINDOW' : 'TIME_PRESSURE',
        responseClass: 'UNKNOWN',
        payload: event.metadata,
        preferredTone: undefined,
        relationshipSignal: this.buildRelationshipSignal({
          counterpartId: actor.id,
          actorRole: 'HATER',
          context: this.runtime.isNegotiationWindow ? 'NEGOTIATION_WINDOW' : 'TIME_PRESSURE',
          channel: preferred,
          payload: event.metadata,
        }),
      }),
      severity: this.runtime.isNegotiationWindow ? 'HIGH' : isHighPressure(this.runtime) ? 'HIGH' : 'MEDIUM',
      createdAt: ts,
      emitDelayMs: this.config.haterEscalationDelayMs,
      expiresInMs: 18_000,
      reason: 'sabotage',
      sourceEvent: 'HATER_SABOTAGE',
      metadata: {
        botId: event.botId,
        botName: event.botName,
        attackType: event.attackType,
        targetLayer: event.targetLayer,
        isRetreat: event.isRetreat,
        relationshipOverlay: this.serializeRelationshipSignal(this.buildRelationshipSignal({
          counterpartId: actor.id,
          actorRole: 'HATER',
          context: this.runtime.isNegotiationWindow ? 'NEGOTIATION_WINDOW' : 'TIME_PRESSURE',
          channel: preferred,
          payload: event.metadata,
        })),
        ...event.metadata,
      },
      shouldEscalate: !event.isRetreat && rankSeverity(isHighPressure(this.runtime) ? 'HIGH' : 'MEDIUM') >= 3,
    });

    if (plan) plans.push(plan);
    return plans;
  }

  public notePresenceStrip(view: ChatPresenceStripView): void {
    this.assertNotDestroyed('notePresenceStrip');
    this.runtime.activeChannel = view.channel;
    this.emitSnapshot();
  }

  public pulse(at: number = now()): ChatNpcPlan[] {
    this.assertNotDestroyed('pulse');

    this.sweepExpired();
    this.sweepDedup();

    if (!this.runtime.isMounted || this.runtime.transportState === 'DESTROYED') {
      return [];
    }

    const plans: ChatNpcPlan[] = [];

    if (this.shouldStageIdleHelper(at)) {
      plans.push(...this.stageContextPlans({
        context: 'PLAYER_IDLE',
        reason: 'idle_pulse',
        preferredChannel: this.runtime.activeChannel,
        createdAt: at,
      }));
    }

    if (this.shouldStageAmbient(at)) {
      const ambient = this.stageAmbientPlan(at);
      if (ambient) plans.push(ambient);
    }

    return plans;
  }

  public stageManualPlan(input: {
    actorId?: string;
    actorRole?: ChatNpcActorRole;
    context: ChatNpcContext;
    body?: string;
    preferredChannel?: ChatChannel;
    severity?: ChatNpcMessageSeverity;
    metadata?: Record<string, unknown>;
  }): ChatNpcPlan | null {
    this.assertNotDestroyed('stageManualPlan');

    const actorRole = input.actorRole ?? 'AMBIENT';
    const persona = actorRole === 'HATER'
      ? HATER_PERSONAS[input.actorId ?? 'BOT_03_MANIPULATOR'] ?? first(Object.values(HATER_PERSONAS))
      : actorRole === 'HELPER' || actorRole === 'RIVAL' || actorRole === 'ARCHIVIST'
        ? HELPER_PERSONAS[input.actorId ?? 'MENTOR'] ?? first(Object.values(HELPER_PERSONAS))
        : undefined;

    const actorId = input.actorId
      ?? persona?.id
      ?? first(AMBIENT_PERSONAS).id;
    const actorName = persona?.displayName
      ?? pickDeterministic(AMBIENT_PERSONAS, `${input.context}:${actorRole}`).displayName;
    const actorLabel = persona?.archLabel ?? 'Ambient Witness';
    const channel = this.resolveChannel({
      preferredChannels: input.preferredChannel
        ? [input.preferredChannel]
        : preferredChannelsForContext(input.context, this.runtime),
      role: actorRole,
      context: input.context,
      body: input.body ?? this.composeBody({
        actorRole,
        actorId,
        context: input.context,
        responseClass: 'UNKNOWN',
      }),
    });

    return this.createPlan({
      actorId,
      actorName,
      actorRole,
      actorClass: actorClassForRole(actorRole),
      actorLabel,
      context: input.context,
      channel,
      body: input.body ?? this.composeBody({
        actorRole,
        actorId,
        context: input.context,
        responseClass: 'UNKNOWN',
      }),
      severity: input.severity ?? inferSeverityFromContext(input.context, this.runtime, actorRole),
      createdAt: now(),
      emitDelayMs: actorRole === 'HELPER' ? this.config.helperInterventionDelayMs : actorRole === 'HATER' ? this.config.haterEscalationDelayMs : 180,
      expiresInMs: 22_000,
      reason: 'manual',
      metadata: input.metadata,
      shouldEscalate: actorRole === 'HATER' && input.severity === 'CRITICAL',
    });
  }

  // ---------------------------------------------------------------------------
  // Core staging pipeline
  // ---------------------------------------------------------------------------

  private stageContextPlans(input: {
    context: ChatNpcContext;
    reason: ChatNpcPlanReason;
    preferredChannel?: ChatChannel;
    sourceEvent?: string;
    sourceMessageId?: string;
    playerResponseClass?: ChatNpcPlayerResponseClass;
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdAt: number;
  }): ChatNpcPlan[] {
    const plans: ChatNpcPlan[] = [];
    const createdAt = input.createdAt;

    const helper = this.maybeStageHelper({
      ...input,
      createdAt,
    });
    if (helper) plans.push(helper);

    const hater = this.maybeStageHater({
      ...input,
      createdAt,
    });
    if (hater) plans.push(hater);

    if (this.config.allowCrowdEcho) {
      const crowd = this.maybeStageCrowdEcho({
        ...input,
        createdAt,
      });
      if (crowd) plans.push(crowd);
    }

    return plans;
  }

  private stageDirectReplyPlan(input: {
    sourceMessage: ChatMessage;
    responseClass: ChatNpcPlayerResponseClass;
  }): ChatNpcPlan | null {
    const age = now() - input.sourceMessage.ts;
    if (age > this.config.directReplyWindowMs) return null;

    const context = mapPlayerResponseClassToContext(input.responseClass);
    if (!context) return null;

    const helper = input.responseClass === 'QUESTION'
      ? HELPER_PERSONAS.INSIDER
      : input.responseClass === 'CALM'
        ? HELPER_PERSONAS.MENTOR
        : input.responseClass === 'FLEX'
          ? HELPER_PERSONAS.RIVAL
          : HELPER_PERSONAS.SURVIVOR;

    const relationshipSignal = this.buildRelationshipSignal({
      counterpartId: helper.id,
      actorRole: helper.actorRole,
      context,
      channel: input.sourceMessage.channel,
      playerResponseClass: input.responseClass,
      payload: {
        playerBody: input.sourceMessage.body,
      },
    });

    const body = this.composeBody({
      actorRole: helper.actorRole,
      actorId: helper.id,
      context,
      responseClass: input.responseClass,
      payload: {
        playerBody: input.sourceMessage.body,
      },
      preferredTone: 'direct_reply',
      relationshipSignal,
    });

    return this.createPlan({
      actorId: helper.id,
      actorName: helper.displayName,
      actorRole: helper.actorRole,
      actorClass: actorClassForRole(helper.actorRole),
      actorLabel: helper.archLabel,
      context,
      channel: this.resolveChannel({
        preferredChannels: [input.sourceMessage.channel, ...(helper.preferredChannels ?? [])],
        role: helper.actorRole,
        context,
        body,
      }),
      body,
      severity: input.responseClass === 'QUESTION' ? 'LOW' : 'MEDIUM',
      createdAt: now(),
      emitDelayMs: helper.actorRole === 'HELPER' ? 520 : 430,
      expiresInMs: 14_000,
      reason: 'player_message',
      sourceMessageId: input.sourceMessage.id,
      playerResponseClass: input.responseClass,
      metadata: {
        directReply: true,
        sourceChannel: input.sourceMessage.channel,
        relationshipOverlay: this.serializeRelationshipSignal(relationshipSignal),
      },
    });
  }

  private maybeStageHelper(input: {
    context: ChatNpcContext;
    reason: ChatNpcPlanReason;
    preferredChannel?: ChatChannel;
    sourceEvent?: string;
    sourceMessageId?: string;
    playerResponseClass?: ChatNpcPlayerResponseClass;
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdAt: number;
  }): ChatNpcPlan | null {
    if (!this.config.allowHelpers) return null;

    const scored = this.pickHelper(input.context);
    if (!scored) return null;
    if (this.isCoolingDown(this.helperCooldowns, scored.persona.id, this.config.helperCooldownMs)) return null;

    const relationshipSignal = scored.relationshipSignal ?? this.buildRelationshipSignal({
      counterpartId: scored.persona.id,
      actorRole: scored.persona.actorRole,
      context: input.context,
      channel: input.preferredChannel ?? this.runtime.activeChannel,
      playerResponseClass: input.playerResponseClass,
      payload: input.payload,
    });

    const body = this.composeBody({
      actorRole: scored.persona.actorRole,
      actorId: scored.persona.id,
      context: input.context,
      responseClass: input.playerResponseClass ?? 'UNKNOWN',
      payload: input.payload,
      preferredTone: scored.persona.id,
      relationshipSignal,
    });

    const preferredChannels = input.preferredChannel
      ? [input.preferredChannel, ...(scored.persona.preferredChannels ?? [])]
      : [...(scored.persona.preferredChannels ?? []), ...preferredChannelsForContext(input.context, this.runtime)];

    const channel = this.resolveChannel({
      preferredChannels,
      role: scored.persona.actorRole,
      context: input.context,
      body,
    });

    const severity = inferSeverityFromContext(input.context, this.runtime, scored.persona.actorRole);
    return this.createPlan({
      actorId: scored.persona.id,
      actorName: scored.persona.displayName,
      actorRole: scored.persona.actorRole,
      actorClass: actorClassForRole(scored.persona.actorRole),
      actorLabel: scored.persona.archLabel,
      context: input.context,
      channel,
      body,
      severity,
      createdAt: input.createdAt,
      emitDelayMs: this.config.helperInterventionDelayMs + randomJitter(`${input.context}:${scored.persona.id}`, 250),
      expiresInMs: 22_000,
      reason: input.reason,
      sourceEvent: input.sourceEvent,
      sourceMessageId: input.sourceMessageId,
      playerResponseClass: input.playerResponseClass,
      metadata: {
        helperScore: scored.score,
        relationshipOverlay: this.serializeRelationshipSignal(relationshipSignal),
        ...input.metadata,
      },
    });
  }

  private maybeStageHater(input: {
    context: ChatNpcContext;
    reason: ChatNpcPlanReason;
    preferredChannel?: ChatChannel;
    sourceEvent?: string;
    sourceMessageId?: string;
    playerResponseClass?: ChatNpcPlayerResponseClass;
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdAt: number;
  }): ChatNpcPlan | null {
    if (!this.config.allowHaters) return null;

    const scored = this.pickHater(input.context);
    if (!scored) return null;
    if (this.isCoolingDown(this.haterCooldowns, scored.persona.id, this.config.haterCooldownMs)) return null;

    const relationshipSignal = scored.relationshipSignal ?? this.buildRelationshipSignal({
      counterpartId: scored.persona.id,
      actorRole: 'HATER',
      context: input.context,
      channel: input.preferredChannel ?? this.runtime.activeChannel,
      playerResponseClass: input.playerResponseClass,
      payload: input.payload,
    });

    const body = this.composeBody({
      actorRole: 'HATER',
      actorId: scored.persona.id,
      context: input.context,
      responseClass: input.playerResponseClass ?? 'UNKNOWN',
      payload: input.payload,
      preferredTone: scored.persona.archetype,
      relationshipSignal,
    });

    const preferredChannels = input.preferredChannel
      ? [input.preferredChannel, ...(scored.persona.preferredChannels ?? [])]
      : [...(scored.persona.preferredChannels ?? []), ...preferredChannelsForContext(input.context, this.runtime)];

    const channel = this.resolveChannel({
      preferredChannels,
      role: 'HATER',
      context: input.context,
      body,
    });

    const severity = inferSeverityFromContext(input.context, this.runtime, 'HATER');
    const shouldEscalate =
      this.config.allowInvasionEscalation &&
      Boolean(this.invasionDirector) &&
      rankSeverity(severity) >= 3 &&
      (input.context === 'PLAYER_NEAR_BANKRUPTCY'
        || input.context === 'CASCADE_CHAIN'
        || input.context === 'TIME_PRESSURE'
        || input.context === 'NEAR_SOVEREIGNTY'
        || input.context === 'NEGOTIATION_WINDOW'
        || relationshipSignal.unfinishedBusiness01 >= 0.72
        || relationshipSignal.obsession01 >= 0.74);

    return this.createPlan({
      actorId: scored.persona.id,
      actorName: scored.persona.displayName,
      actorRole: 'HATER',
      actorClass: 'NPC',
      actorLabel: scored.persona.archLabel,
      context: input.context,
      channel,
      body,
      severity,
      createdAt: input.createdAt,
      emitDelayMs: this.config.haterEscalationDelayMs + randomJitter(`${input.context}:${scored.persona.id}`, 220),
      expiresInMs: 18_000,
      reason: input.reason,
      sourceEvent: input.sourceEvent,
      sourceMessageId: input.sourceMessageId,
      playerResponseClass: input.playerResponseClass,
      metadata: {
        haterScore: scored.score,
        archetype: scored.persona.archetype,
        relationshipOverlay: this.serializeRelationshipSignal(relationshipSignal),
        ...input.metadata,
      },
      shouldEscalate,
    });
  }

  private maybeStageCrowdEcho(input: {
    context: ChatNpcContext;
    reason: ChatNpcPlanReason;
    preferredChannel?: ChatChannel;
    sourceEvent?: string;
    sourceMessageId?: string;
    playerResponseClass?: ChatNpcPlayerResponseClass;
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdAt: number;
  }): ChatNpcPlan | null {
    if (!this.config.allowAmbientNpc) return null;

    const ambient = pickDeterministic(
      AMBIENT_PERSONAS,
      `${input.context}:${input.createdAt}:${this.runtime.modeId ?? 'mode'}`,
    );

    if (this.isCoolingDown(this.ambientCooldowns, ambient.id, this.config.ambientCooldownMs)) return null;

    const body = this.composeBody({
      actorRole: 'AMBIENT',
      actorId: ambient.id,
      context: input.context,
      responseClass: input.playerResponseClass ?? 'UNKNOWN',
      payload: input.payload,
      preferredTone: ambient.toneBias,
    });

    const preferredChannels = input.preferredChannel
      ? [input.preferredChannel, ...ambient.preferredChannels]
      : [...ambient.preferredChannels, ...preferredChannelsForContext(input.context, this.runtime)];

    const channel = this.resolveChannel({
      preferredChannels,
      role: 'AMBIENT',
      context: input.context,
      body,
    });

    return this.createPlan({
      actorId: ambient.id,
      actorName: ambient.displayName,
      actorRole: 'AMBIENT',
      actorClass: 'NPC',
      actorLabel: ambient.rank,
      context: input.context,
      channel,
      body,
      severity: inferSeverityFromContext(input.context, this.runtime, 'AMBIENT'),
      createdAt: input.createdAt,
      emitDelayMs: 260 + randomJitter(`${ambient.id}:${input.context}`, 140),
      expiresInMs: 12_000,
      reason: input.reason,
      sourceEvent: input.sourceEvent,
      sourceMessageId: input.sourceMessageId,
      playerResponseClass: input.playerResponseClass,
      metadata: {
        toneBias: ambient.toneBias,
        ...input.metadata,
      },
    });
  }

  private stageAmbientPlan(createdAt: number): ChatNpcPlan | null {
    const context = this.runtime.isPostRun
      ? 'POSTRUN_DEBRIEF'
      : this.runtime.isPreRun
        ? 'GAME_START'
        : isHighPressure(this.runtime)
          ? 'TIME_PRESSURE'
          : 'PLAYER_IDLE';

    return this.maybeStageCrowdEcho({
      context,
      reason: 'ambient_cadence',
      preferredChannel: this.runtime.activeChannel,
      createdAt,
      metadata: {
        cadencePulse: true,
        haterHeat: this.runtime.haterHeat,
      },
    });
  }

  private createPlan(input: {
    actorId: string;
    actorName: string;
    actorRole: ChatNpcActorRole;
    actorClass: ChatPrivacyActorClass;
    actorLabel?: string;
    context: ChatNpcContext;
    channel: ChatChannel;
    body: string;
    severity: ChatNpcMessageSeverity;
    createdAt: number;
    emitDelayMs: number;
    expiresInMs: number;
    reason: ChatNpcPlanReason;
    sourceEvent?: string;
    sourceMessageId?: string;
    playerResponseClass?: ChatNpcPlayerResponseClass;
    metadata?: Record<string, unknown>;
    shouldEscalate?: boolean;
  }): ChatNpcPlan | null {
    const normalizedBody = normalizeText(input.body);
    if (!normalizedBody) return null;

    const dedupKey = this.buildDedupKey({
      actorId: input.actorId,
      channel: input.channel,
      context: input.context,
      body: normalizedBody,
    });

    if (this.isDeduped(dedupKey)) return null;
    if (this.active.size >= this.config.maxActivePlans) {
      const oldest = [...this.active.values()].sort((a, b) => a.plan.createdAt - b.plan.createdAt)[0];
      if (oldest) this.resolvePlan(oldest.plan.id, 'DISMISSED', 'capacity_limit');
    }

    const plan: ChatNpcPlan = {
      id: this.nextId('npc'),
      context: input.context,
      reason: input.reason,
      state: 'STAGED',
      actorId: input.actorId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      actorClass: input.actorClass,
      actorLabel: input.actorLabel,
      channel: input.channel,
      body: normalizedBody,
      title: escapeForTitle(`${input.actorName} · ${input.context}`),
      severity: input.severity,
      createdAt: input.createdAt,
      emitAt: input.createdAt + Math.max(0, input.emitDelayMs),
      expiresAt: input.createdAt + Math.max(1_000, input.expiresInMs),
      sourceEvent: input.sourceEvent,
      sourceMessageId: input.sourceMessageId,
      playerResponseClass: input.playerResponseClass,
      shouldEscalate: input.shouldEscalate,
      shouldNotify: notificationNeeded(input.severity, input.actorRole) && this.config.allowNotificationMirror,
      shouldMirrorSocket: this.config.allowSocketMirror,
      shouldMirrorTranscript: this.config.allowTranscriptMirror,
      shouldStagePresence: this.config.allowPresenceTheater,
      shouldStageTyping: this.config.allowTypingTheater,
      metadata: input.metadata,
    };

    this.markDedup(dedupKey);

    const entry: InternalPlanEntry = { plan };
    entry.emitTimer = setTimeout(() => this.emitPlan(plan.id), Math.max(0, plan.emitAt - now()));
    entry.expireTimer = setTimeout(() => this.resolvePlan(plan.id, 'EXPIRED', 'ttl_elapsed'), Math.max(1, plan.expiresAt - now()));

    this.active.set(plan.id, entry);

    if (plan.actorRole === 'HELPER' || plan.actorRole === 'RIVAL' || plan.actorRole === 'ARCHIVIST') {
      this.helperCooldowns.set(plan.actorId, plan.createdAt + this.config.helperCooldownMs);
      this.lastHelperAt = plan.createdAt;
      this.runtime.lastHelperAt = plan.createdAt;
    } else if (plan.actorRole === 'HATER') {
      this.haterCooldowns.set(plan.actorId, plan.createdAt + this.config.haterCooldownMs);
      this.lastHaterAt = plan.createdAt;
      this.runtime.lastHaterAt = plan.createdAt;
    } else {
      this.ambientCooldowns.set(plan.actorId, plan.createdAt + this.config.ambientCooldownMs);
      this.lastAmbientAt = plan.createdAt;
      this.runtime.lastAmbientAt = plan.createdAt;
    }

    if (plan.shouldStagePresence) {
      this.stagePresence(plan);
    }

    if (plan.shouldStageTyping) {
      this.stageTyping(plan);
    }

    this.lastPlanAt = plan.createdAt;
    this.callbacks.onPlanStaged?.(deepClone(plan));
    this.emitSnapshot();
    return deepClone(plan);
  }

  private emitPlan(planId: string): void {
    const entry = this.active.get(planId);
    if (!entry) return;

    const plan = entry.plan;
    if (plan.state === 'EMITTED' || plan.state === 'ESCALATED' || plan.state === 'DISMISSED') return;

    if (plan.shouldEscalate && this.invasionDirector) {
      const invasion = this.invasionDirector.stageManualInvasion({
        archetype: plan.channel === 'DEAL_ROOM' ? 'DEALROOM_AMBUSH' : 'HATER_STRIKE',
        title: plan.title ?? `${plan.actorName} escalation`,
        body: plan.body,
        sourceId: plan.actorId,
        sourceName: plan.actorName,
        sourceRole: plan.actorRole === 'HATER' ? 'HATER' : plan.actorRole === 'HELPER' ? 'HELPER' : 'NPC',
        severity: plan.severity === 'CRITICAL'
          ? 'CRITICAL'
          : plan.severity === 'HIGH'
            ? 'HIGH'
            : 'MEDIUM',
        preferredChannels: [plan.channel],
        metadata: {
          npcPlanId: plan.id,
          npcContext: plan.context,
          ...plan.metadata,
        },
      });

      if (invasion) {
        plan.state = 'ESCALATED';
        this.noteRelationshipFromPlan(plan, now() as any);
        this.pushHistory(plan, 'ESCALATED');
        this.callbacks.onPlanEscalated?.(deepClone(plan), invasion.id);
        this.resolvePresence(plan);
        this.active.delete(plan.id);
        this.emitSnapshot();
        return;
      }
    }

    const message = this.materializeMessage(plan);

    try {
      if (plan.shouldMirrorTranscript) {
        this.transcriptBuffer.noteInboundMessage(message);
      }

      this.channelPolicy.noteInboundMessage(message);

      if (plan.shouldNotify) {
        this.notificationController.noteInboundMessage(message, 'new_message');
      }

      if (plan.shouldMirrorSocket && this.socketClient) {
        this.socketClient.queueGameEvent({
          event: `chat:npc:${plan.actorRole.toLowerCase()}`,
          channel: plan.channel,
          metadata: {
            npcPlanId: plan.id,
            context: plan.context,
            actorId: plan.actorId,
            actorRole: plan.actorRole,
            severity: plan.severity,
            sourceEvent: plan.sourceEvent,
          },
        });
      }

      plan.state = 'EMITTED';
      this.runtime.lastInboundMessageAt = message.ts;
      this.noteRelationshipFromPlan(plan, message.ts as any);
      this.pushHistory(plan, 'EMITTED');
      this.callbacks.onPlanEmitted?.(deepClone(plan), deepClone(message));
    } catch (error) {
      this.emitError(createError('Failed to emit NPC plan.', error), {
        npcPlanId: plan.id,
        context: plan.context,
        actorId: plan.actorId,
      });
      this.resolvePlan(plan.id, 'DISMISSED', 'emit_error');
      return;
    }

    this.resolvePresence(plan);
    this.active.delete(plan.id);
    this.emitSnapshot();
  }

  private materializeMessage(plan: ChatNpcPlan): ChatMessage {
    const message: ChatMessage = {
      id: `${plan.id}:message`,
      channel: plan.channel,
      kind: messageKindForRole(plan.actorRole),
      senderId: plan.actorId,
      senderName: plan.actorName,
      senderRank: plan.actorLabel,
      body: plan.body,
      emoji: resolveEmoji(plan.actorRole, plan.actorId),
      ts: Math.max(now(), plan.emitAt),
      pressureTier: this.runtime.pressureTier,
      tickTier: this.runtime.tickTier,
      runOutcome: this.runtime.runOutcome,
      metadata: {
        npcPlanId: plan.id,
        npcContext: plan.context,
        actorRole: plan.actorRole,
        sourceEvent: plan.sourceEvent,
        sourceMessageId: plan.sourceMessageId,
        playerResponseClass: plan.playerResponseClass,
        ...plan.metadata,
      },
    };

    const masked = this.privacyPolicy.applyRenderMask(message, 'FEED');
    return { ...message, body: masked };
  }

  private resolvePlan(id: string, state: Exclude<ChatNpcPlanState, 'STAGED' | 'ACTIVE'>, reason: string): void {
    const entry = this.active.get(id);
    if (!entry) return;

    if (entry.emitTimer) clearTimeout(entry.emitTimer);
    if (entry.expireTimer) clearTimeout(entry.expireTimer);

    entry.plan.state = state;
    this.pushHistory(entry.plan, state);
    this.callbacks.onPlanDropped?.(deepClone(entry.plan), reason);
    this.resolvePresence(entry.plan);
    this.active.delete(id);
    this.emitSnapshot();
  }

  private pushHistory(plan: ChatNpcPlan, state: ChatNpcPlanState): void {
    this.history.unshift({
      id: plan.id,
      actorId: plan.actorId,
      actorName: plan.actorName,
      actorRole: plan.actorRole,
      context: plan.context,
      channel: plan.channel,
      severity: plan.severity,
      createdAt: plan.createdAt,
      emittedAt: state === 'EMITTED' ? now() : undefined,
      resolvedAt: now(),
      state,
      body: plan.body,
      metadata: deepClone(plan.metadata ?? {}),
    });

    if (this.history.length > this.config.historyLimit) {
      this.history.length = this.config.historyLimit;
    }
  }

  // ---------------------------------------------------------------------------
  // Selection and composition
  // ---------------------------------------------------------------------------

  private pickHelper(context: ChatNpcContext): HelperScore | null {
    const all = Object.values(HELPER_PERSONAS)
      .filter((persona) => persona.triggerConditions.includes(context))
      .map((persona) => {
        const relationshipSignal = this.config.allowRelationshipRouting
          ? this.buildRelationshipSignal({
              counterpartId: persona.id,
              actorRole: persona.actorRole,
              context,
              channel: this.runtime.activeChannel,
            })
          : undefined;
        let score = persona.personality.frequency * 100;
        score += (this.runtime.coldStartFactor ?? 1) * persona.personality.coldStartBoost * 12;
        if (persona.actorRole === 'HELPER' && context === 'PLAYER_NEAR_BANKRUPTCY') score += 24;
        if (persona.actorRole === 'RIVAL' && (context === 'PLAYER_COMEBACK' || context === 'NEAR_SOVEREIGNTY')) score += 20;
        if (persona.actorRole === 'ARCHIVIST' && (this.runtime.isPostRun || context === 'POSTRUN_DEBRIEF')) score += 26;
        if ((this.runtime.engagementScore ?? 0) < 0.2) score += 8;
        score += (relationshipSignal?.selectionWeight01 ?? 0) * 42;
        score += stableHash(`${persona.id}:${context}:${this.runtime.modeId ?? 'mode'}`) % 11;
        return { persona, score, relationshipSignal };
      });

    if (all.length === 0) return null;
    all.sort((a, b) => b.score - a.score || a.persona.id.localeCompare(b.persona.id));
    return all[0];
  }

  private pickHater(context: ChatNpcContext): HaterScore | null {
    const all = Object.values(HATER_PERSONAS)
      .filter((persona) => persona.triggerConditions.includes(context))
      .map((persona) => {
        const relationshipSignal = this.config.allowRelationshipRouting
          ? this.buildRelationshipSignal({
              counterpartId: persona.id,
              actorRole: 'HATER',
              context,
              channel: this.runtime.activeChannel,
            })
          : undefined;
        let score = persona.personality.frequency * 100;
        score += (this.runtime.haterHeat ?? 0) * 0.9;
        if (persona.archetype === 'LIQUIDATOR' && (context === 'PLAYER_NEAR_BANKRUPTCY' || context === 'PLAYER_LOST')) score += 35;
        if (persona.archetype === 'BUREAUCRAT' && (context === 'NEGOTIATION_WINDOW' || context === 'PLAYER_INCOME_UP')) score += 30;
        if (persona.archetype === 'MANIPULATOR' && (context === 'PLAYER_IDLE' || context === 'PLAYER_RESPONSE_ANGRY' || context === 'PLAYER_RESPONSE_TROLL' || context === 'PLAYER_RESPONSE_FLEX')) score += 34;
        if (persona.archetype === 'CRASH_PROPHET' && (context === 'CASCADE_CHAIN' || context === 'TIME_PRESSURE' || context === 'PLAYER_SHIELD_BREAK')) score += 33;
        if (persona.archetype === 'LEGACY_HEIR' && (context === 'NEAR_SOVEREIGNTY' || context === 'POSTRUN_DEBRIEF')) score += 32;
        if (isHighPressure(this.runtime)) score += 12;
        score += (relationshipSignal?.selectionWeight01 ?? 0) * 55;
        score += stableHash(`${persona.id}:${context}:${this.runtime.tickTier ?? 'tick'}`) % 13;
        return { persona, score, relationshipSignal };
      });

    if (all.length === 0) return null;
    all.sort((a, b) => b.score - a.score || a.persona.id.localeCompare(b.persona.id));
    return all[0];
  }

  private composeBody(input: {
    actorRole: ChatNpcActorRole;
    actorId: string;
    context: ChatNpcContext;
    responseClass: ChatNpcPlayerResponseClass;
    payload?: Record<string, unknown>;
    preferredTone?: string;
    relationshipSignal?: ChatRelationshipNpcSignal;
  }): string {
    const used = this.usedTemplates.get(input.actorId) ?? new Set<string>();

    const templates = this.resolveTemplates(input);
    const eligible = templates.filter((line) => !used.has(line));
    const source = eligible.length > 0 ? eligible : templates;
    const chosen = pickDeterministic(source, [
      input.actorId,
      input.context,
      input.responseClass,
      String(this.runtime.tick ?? 0),
      String(this.runtime.playerMessageCount ?? 0),
      String(this.runtime.haterHeat ?? 0),
      String(this.runtime.negotiationUrgency ?? 0),
      String(input.payload?.playerBody ?? ''),
    ].join(':'));

    used.add(chosen);
    if (used.size > 24) {
      const firstKey = [...used][0];
      if (firstKey) used.delete(firstKey);
    }
    this.usedTemplates.set(input.actorId, used);

    const enriched = this.interpolateTemplate(chosen, input.payload);
    const realized = input.relationshipSignal
      ? this.relationshipModel.realizeNpcLine(enriched, input.relationshipSignal, {
          actorRole: input.actorRole,
          context: input.context,
          channelId: this.runtime.activeChannel ?? undefined,
          pressureBand: this.pressureBandFromRuntime(),
        })
      : enriched;
    return normalizeText(realized);
  }

  private resolveTemplates(input: {
    actorRole: ChatNpcActorRole;
    actorId: string;
    context: ChatNpcContext;
    responseClass: ChatNpcPlayerResponseClass;
    payload?: Record<string, unknown>;
    preferredTone?: string;
  }): string[] {
    if (input.actorRole === 'HELPER') {
      const helper = HELPER_PERSONAS[input.actorId] ?? HELPER_PERSONAS.MENTOR;
      if (helper.actorRole === 'RIVAL') return RIVAL_TEMPLATES[input.context] ?? RIVAL_TEMPLATES.GAME_START;
      if (helper.actorRole === 'ARCHIVIST') return ARCHIVIST_TEMPLATES[input.context] ?? ARCHIVIST_TEMPLATES.GAME_START;
      return HELPER_TEMPLATES[input.context] ?? HELPER_TEMPLATES.GAME_START;
    }

    if (input.actorRole === 'RIVAL') {
      return RIVAL_TEMPLATES[input.context] ?? RIVAL_TEMPLATES.GAME_START;
    }

    if (input.actorRole === 'ARCHIVIST') {
      return ARCHIVIST_TEMPLATES[input.context] ?? ARCHIVIST_TEMPLATES.GAME_START;
    }

    if (input.actorRole === 'HATER') {
      const actorTemplates = HATER_TEMPLATES[input.actorId];
      const resolved = actorTemplates?.[input.context];
      if (resolved && resolved.length > 0) return resolved;
      return HATER_TEMPLATES.BOT_03_MANIPULATOR.TIME_PRESSURE ?? ['Pressure detected.'];
    }

    return AMBIENT_TEMPLATES[input.context] ?? AMBIENT_TEMPLATES.GAME_START;
  }

  private interpolateTemplate(template: string, payload?: Record<string, unknown>): string {
    let next = template;
    if (payload?.targetLayer) {
      next = next.replace(/\{layer\}/g, String(payload.targetLayer));
    }
    if (payload?.attackType) {
      next = next.replace(/\{attackType\}/g, String(payload.attackType));
    }
    if (payload?.playerSenderName) {
      next = next.replace(/\{player\}/g, String(payload.playerSenderName));
    }
    if (payload?.playerBody) {
      const playerBody = normalizeText(String(payload.playerBody));
      const snippet = playerBody.length <= 42 ? playerBody : `${playerBody.slice(0, 39)}...`;
      next = next.replace(/\{playerBody\}/g, snippet);
    }
    return next;
  }

  private resolveChannel(input: {
    preferredChannels: ChatChannel[];
    role: ChatNpcActorRole;
    context: ChatNpcContext;
    body: string;
  }): ChatChannel {
    const actorClass = actorClassForRole(input.role);
    const privacyDecision = this.privacyPolicy.inspectOutboundDraft({
      channel: input.preferredChannels[0] ?? this.runtime.activeChannel ?? 'GLOBAL',
      body: input.body,
      actorClass,
    });

    for (const channel of dedupeChannels(input.preferredChannels)) {
      const evaluation = this.channelPolicy.evaluateChannel({
        channel,
        intent: input.role === 'HATER' ? 'notify' : 'write',
        draftBody: input.body,
        privacyDecision,
        allowFallback: true,
      });

      if (evaluation.allowed || evaluation.readMode !== 'HIDDEN' || evaluation.visibilityMode !== 'HIDDEN') {
        return evaluation.rerouteChannel ?? evaluation.channel;
      }
    }

    return this.channelPolicy.chooseBootChannel(this.runtime.activeChannel ?? 'LOBBY');
  }

  private mapEventToContext(eventType: string, payload?: Record<string, unknown>): ChatNpcContext | null {
    const normalized = eventType.toUpperCase();
    const direct = GAME_EVENT_CONTEXT_MAP[normalized];
    if (direct) return direct;

    const joined = `${normalized} ${JSON.stringify(payload ?? {})}`.toUpperCase();
    if (joined.includes('BANKRUPTCY')) return 'PLAYER_NEAR_BANKRUPTCY';
    if (joined.includes('SOVEREIGN')) return 'NEAR_SOVEREIGNTY';
    if (joined.includes('SHIELD')) return 'PLAYER_SHIELD_BREAK';
    if (joined.includes('CASCADE')) return 'CASCADE_CHAIN';
    if (joined.includes('PRESSURE')) return 'TIME_PRESSURE';
    if (joined.includes('NEGOTIATION') || joined.includes('DEAL')) return 'NEGOTIATION_WINDOW';
    if (joined.includes('LOSS') || joined.includes('LOST')) return 'PLAYER_LOST';
    if (joined.includes('COMEBACK')) return 'PLAYER_COMEBACK';
    return null;
  }

  private resolveHaterFromSabotage(event: ChatSabotageEvent): ChatNpcHaterPersona {
    if (event.botId && HATER_PERSONAS[event.botId]) return HATER_PERSONAS[event.botId];
    const body = normalizeText(event.dialogue ?? '').toLowerCase();
    if (body.includes('form') || body.includes('compliance')) return HATER_PERSONAS.BOT_02_BUREAUCRAT;
    if (body.includes('model') || body.includes('predict')) return HATER_PERSONAS.BOT_03_MANIPULATOR;
    if (body.includes('volatility') || body.includes('macro')) return HATER_PERSONAS.BOT_04_CRASH_PROPHET;
    if (body.includes('inherited') || body.includes('family')) return HATER_PERSONAS.BOT_05_LEGACY_HEIR;
    return HATER_PERSONAS.BOT_01_LIQUIDATOR;
  }

  private getPhaseTwoSnapshot(): ChatNpcDirectorPhaseTwoSnapshot {
    const relationshipSnapshot = this.relationshipModel.snapshot(now() as any);
    const overlays = this.relationshipModel.summaries().slice(0, 12).map((summary) => ({
      counterpartId: summary.counterpartId,
      stance: summary.stance,
      objective: summary.objective,
      intensity01: summary.intensity01,
      volatility01: summary.volatility01,
      obsession01: summary.obsession01,
      predictiveConfidence01: summary.predictiveConfidence01,
      unfinishedBusiness01: summary.unfinishedBusiness01,
      respect01: summary.respect01,
      fear01: summary.fear01,
      contempt01: summary.contempt01,
      familiarity01: summary.familiarity01,
      callbackLabel: summary.callbackCount > 0 ? `${summary.callbackCount} callback${summary.callbackCount === 1 ? '' : 's'}` : undefined,
      legacy: summary.legacy,
    }));

    return {
      relationshipRoutingEnabled: this.config.allowRelationshipRouting,
      relationshipSnapshot,
      overlays,
      strongestCounterpartId: overlays[0]?.counterpartId,
      strongestCounterpartIntensity01: overlays[0]?.intensity01,
    };
  }

  private pressureBandFromRuntime(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const pressure = String(this.runtime.pressureTier ?? '').toUpperCase();
    if (pressure === 'CRITICAL') return 'CRITICAL';
    if (pressure === 'HIGH') return 'HIGH';
    if (pressure === 'ELEVATED' || pressure === 'MEDIUM') return 'MEDIUM';
    return 'LOW';
  }

  private buildRelationshipSignal(input: {
    counterpartId: string;
    actorRole: string;
    context: ChatNpcContext;
    channel?: ChatChannel;
    playerResponseClass?: ChatNpcPlayerResponseClass;
    payload?: Record<string, unknown>;
  }): ChatRelationshipNpcSignal {
    return this.relationshipModel.buildNpcSignal({
      counterpartId: input.counterpartId,
      actorRole: input.actorRole,
      context: input.context,
      channelId: input.channel ?? this.runtime.activeChannel ?? 'GLOBAL',
      pressureBand: this.pressureBandFromRuntime(),
      publicWitness01: (input.channel ?? this.runtime.activeChannel) === 'GLOBAL' || (input.channel ?? this.runtime.activeChannel) === 'LOBBY' ? 0.82 : 0.24,
      now: now() as any,
    });
  }

  private serializeRelationshipSignal(signal: ChatRelationshipNpcSignal | undefined): Record<string, unknown> | undefined {
    if (!signal) return undefined;
    return {
      counterpartId: signal.counterpartId,
      stance: signal.stance,
      objective: signal.objective,
      intensity01: signal.intensity01,
      volatility01: signal.volatility01,
      obsession01: signal.obsession01,
      predictiveConfidence01: signal.predictiveConfidence01,
      unfinishedBusiness01: signal.unfinishedBusiness01,
      respect01: signal.respect01,
      fear01: signal.fear01,
      contempt01: signal.contempt01,
      familiarity01: signal.familiarity01,
      publicPressureBias01: signal.publicPressureBias01,
      privatePressureBias01: signal.privatePressureBias01,
      callbackHint: signal.callbackHint?.label,
      notes: [...signal.notes],
    };
  }

  private noteRelationshipFromPlayerMessage(message: ChatMessage): void {
    const focusedCounterpart = this.relationshipModel.selectCounterpartFocus(message.channel);
    this.relationshipModel.notePlayerMessage({
      counterpartId: focusedCounterpart,
      channelId: message.channel,
      messageId: message.id,
      body: message.body,
      responseClass: classifyPlayerResponse(message.body),
      pressureBand: this.pressureBandFromRuntime(),
      tags: Array.isArray(message.metadata?.tags) ? message.metadata?.tags as string[] : undefined,
      createdAt: message.ts as any,
    });
  }

  private noteRelationshipEventFromContext(context: ChatNpcContext, input: {
    channel?: ChatChannel;
    payload?: Record<string, unknown>;
    createdAt: number;
    sourceEvent?: string;
  }): void {
    const counterpartId = typeof input.payload?.botId === 'string'
      ? String(input.payload.botId)
      : typeof input.payload?.actorId === 'string'
        ? String(input.payload.actorId)
        : this.relationshipModel.selectCounterpartFocus(input.channel ?? this.runtime.activeChannel);

    this.relationshipModel.noteGameEvent({
      counterpartId,
      channelId: input.channel ?? this.runtime.activeChannel ?? 'GLOBAL',
      eventType: input.sourceEvent ?? context,
      pressureBand: this.pressureBandFromRuntime(),
      summary: context,
      tags: [String(context).toLowerCase()],
      createdAt: input.createdAt as any,
    });
  }

  private noteRelationshipFromPlan(plan: ChatNpcPlan, emittedAt: number): void {
    this.relationshipModel.noteNpcUtterance({
      counterpartId: plan.actorId,
      actorRole: plan.actorRole,
      channelId: plan.channel,
      context: plan.context,
      severity: plan.severity,
      body: plan.body,
      emittedAt: emittedAt as any,
    });
  }

  // ---------------------------------------------------------------------------
  // Theater and mirrors
  // ---------------------------------------------------------------------------

  private stagePresence(plan: ChatNpcPlan): void {
    try {
      this.presenceController.stageNpcPresence({
        channel: plan.channel,
        participantId: plan.actorId,
        displayName: plan.actorName,
        role: plan.actorRole === 'HATER'
          ? 'HATER'
          : plan.actorRole === 'HELPER' || plan.actorRole === 'RIVAL' || plan.actorRole === 'ARCHIVIST'
            ? 'HELPER'
            : 'NPC',
        aura: auraForRole(plan.actorRole, plan.severity),
        state: plan.actorRole === 'HATER' ? 'ACTIVE' : 'IDLE',
        isLurking: plan.actorRole === 'HATER',
        metadata: {
          npcPlanId: plan.id,
          context: plan.context,
          severity: plan.severity,
        },
      });
    } catch (error) {
      this.emitError(createError('Failed to stage NPC presence.', error), {
        npcPlanId: plan.id,
        actorId: plan.actorId,
      });
    }
  }

  private stageTyping(plan: ChatNpcPlan): void {
    try {
      const actorRole: ChatTypingTheaterActorRole = plan.actorRole === 'HATER'
        ? 'HATER'
        : plan.actorRole === 'HELPER' || plan.actorRole === 'RIVAL' || plan.actorRole === 'ARCHIVIST'
          ? 'HELPER'
          : 'NPC';

      plan.typingPlanId = this.typingController.stageNpcTyping({
        actorId: plan.actorId,
        actorName: plan.actorName,
        actorRole,
        channel: plan.channel,
        durationMs: clamp(plan.body.length * 22, 900, 4_000),
        delayBeforeStartMs: Math.max(0, Math.floor((plan.emitAt - plan.createdAt) * 0.45)),
        mood: plan.channel === 'DEAL_ROOM'
          ? 'PREDATORY'
          : plan.channel === 'SYNDICATE'
            ? 'INTIMATE'
            : plan.actorRole === 'HATER'
              ? 'TENSE'
              : plan.actorRole === 'HELPER'
                ? 'CALM'
                : 'SWARMING',
        textHint: plan.body.slice(0, 90),
        metadata: {
          npcPlanId: plan.id,
          context: plan.context,
        },
      });
    } catch (error) {
      this.emitError(createError('Failed to stage NPC typing.', error), {
        npcPlanId: plan.id,
        actorId: plan.actorId,
      });
    }
  }

  private resolvePresence(plan: ChatNpcPlan): void {
    try {
      this.presenceController.clearNpcPresence({
        channel: plan.channel,
        participantId: plan.actorId,
      });
      if (plan.typingPlanId) {
        this.typingController.cancelTheater(plan.typingPlanId);
      }
    } catch {
      // ignore cleanup errors
    }
  }

  // ---------------------------------------------------------------------------
  // Cadence, cooldowns, dedup
  // ---------------------------------------------------------------------------

  private shouldStageIdleHelper(at: number): boolean {
    if (!this.config.allowHelpers) return false;
    const lastPlayer = this.runtime.lastPlayerMessageAt ?? 0;
    if (lastPlayer <= 0) return false;
    if (at - lastPlayer < this.config.idleHelperThresholdMs) return false;
    if (this.active.size >= this.config.maxActivePlans) return false;
    if ((this.runtime.transportState ?? 'IDLE') === 'DISCONNECTED') return false;
    return true;
  }

  private shouldStageAmbient(at: number): boolean {
    if (!this.config.allowAmbientNpc) return false;
    if (this.active.size >= this.config.maxActivePlans) return false;
    if ((this.runtime.transportState ?? 'IDLE') === 'DISCONNECTED') return false;
    const cadence =
      Math.floor(this.config.ambientCadenceBaseMs * deriveTickCadenceMultiplier(this.runtime.tickTier))
      + randomJitter(`${this.runtime.modeId ?? 'mode'}:${this.runtime.tick ?? 0}`, this.config.ambientCadenceJitterMs);
    const last = this.runtime.lastAmbientAt ?? 0;
    if (at - last < Math.max(1_500, cadence)) return false;
    const lowSignal = Math.max(this.runtime.lastInboundMessageAt ?? 0, this.runtime.lastPlayerMessageAt ?? 0, this.runtime.lastGameEventAt ?? 0);
    if (lowSignal > 0 && at - lowSignal < this.config.lowSignalAmbientThresholdMs) return false;
    return true;
  }

  private isCoolingDown(map: Map<string, number>, id: string, fallbackMs: number): boolean {
    const until = map.get(id) ?? 0;
    return until > now();
  }

  private buildDedupKey(input: {
    actorId: string;
    channel: ChatChannel;
    context: ChatNpcContext;
    body: string;
  }): string {
    return [
      input.actorId,
      input.channel,
      input.context,
      bodyFingerprint(input.body),
    ].join('|');
  }

  private isDeduped(key: string): boolean {
    const at = this.dedup.get(key);
    if (!at) return false;
    return now() - at <= this.config.dedupWindowMs;
  }

  private markDedup(key: string): void {
    this.dedup.set(key, now());
  }

  private sweepDedup(): void {
    const cutoff = now() - this.config.dedupWindowMs;
    for (const [key, ts] of this.dedup.entries()) {
      if (ts < cutoff) this.dedup.delete(key);
    }
  }

  private sweepExpired(): void {
    const ts = now();
    for (const [id, entry] of this.active.entries()) {
      if (entry.plan.expiresAt <= ts) {
        this.resolvePlan(id, 'EXPIRED', 'sweep_expired');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private nextId(prefix: string): string {
    return `${prefix}_${Math.abs(stableHash(`${prefix}:${now()}:${Math.random()}`)).toString(36)}`;
  }

  private emitSnapshot(): void {
    this.callbacks.onSnapshot?.(this.getSnapshot());
  }

  private emitError(error: Error, context?: Record<string, unknown>): void {
    this.config.error?.(error.message, context);
    this.callbacks.onError?.(error, context);
  }

  private assertNotDestroyed(operation: string): void {
    if (this.destroyed) {
      throw new Error(`ChatNpcDirector.${operation} called after destroy().`);
    }
  }
}

// -----------------------------------------------------------------------------
// Local helpers
// -----------------------------------------------------------------------------

function createError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

function resolveEmoji(role: ChatNpcActorRole, actorId: string): string | undefined {
  if (role === 'HATER') return HATER_PERSONAS[actorId]?.emoji;
  if (role === 'HELPER' || role === 'RIVAL' || role === 'ARCHIVIST') {
    return HELPER_PERSONAS[actorId]?.emoji;
  }
  return AMBIENT_PERSONAS.find((item) => item.id === actorId)?.emoji;
}

function mapToRecord(map: Map<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, value] of map.entries()) {
    next[key] = value;
  }
  return next;
}

function dedupeChannels(channels: readonly ChatChannel[]): ChatChannel[] {
  const seen = new Set<ChatChannel>();
  const next: ChatChannel[] = [];
  for (const channel of channels) {
    if (seen.has(channel)) continue;
    seen.add(channel);
    next.push(channel);
  }
  return next;
}
