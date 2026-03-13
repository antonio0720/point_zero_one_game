/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ENGINE FRONTEND LOBBY CHANNEL POLICY
 * FILE: pzo-web/src/engines/chat/channels/LobbyChannelPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Own the pre-run lobby lane as a first-class chat policy rather than treating
 * it like a weaker GLOBAL tab. The lobby is where the room wakes up, where the
 * player is sized up before the first authoritative tick, where helpers can
 * establish trust without rescue spam, and where the game starts feeling alive
 * before the run transitions into Empire / Predator / Syndicate / Phantom.
 *
 * Repo-grounded doctrine this file preserves
 * -----------------------------------------
 * 1. Current donor logic already treats the lobby as pre-run-alive chat:
 *    - LobbyChatWidget says bots are already sizing up the player before a run.
 *    - The donor router distinguishes GLOBAL, SYNDICATE, DEAL_ROOM, DM,
 *      SPECTATOR and marks mode availability.
 * 2. Current canonical frontend mode catalog exposes four run modes:
 *      solo | asymmetric-pvp | co-op | ghost
 *    which project to Empire / Predator / Syndicate / Phantom respectively.
 * 3. The newer frontend chat contracts already define a visible LOBBY channel
 *    and the LOBBY_SCREEN mount preset defaults to LOBBY with [LOBBY, GLOBAL]
 *    as allowed visible channels.
 *
 * Operational laws
 * ----------------
 * - The lobby is PRE_RUN, not PUBLIC combat. Its policy is not identical to
 *   GLOBAL even when GLOBAL remains visible as a secondary lane.
 * - Lobby chat must be warm, alive, and strategic without feeling noisy.
 * - Helper presence is allowed, but rescue logic is suppressed in the lobby.
 * - Hater presence is allowed only as sizing / telegraph / psychological setup,
 *   not as full punishment execution. Real punitive authority belongs in-run.
 * - The lobby must respect selected run mode because co-op, predator, empire,
 *   and phantom all deserve different social temperature and different pre-run
 *   staging.
 * - Lobby transcript is run-scoped and replayable because the player should be
 *   able to revisit the pre-run tone that preceded a legendary or failed run.
 * - The policy must remain deployable while the canonical shared/frontend chat
 *   contracts are still converging, so this file carries compatibility types
 *   locally instead of assuming every later module already exists.
 *
 * Scale target
 * ------------
 * - 20M concurrent users at the system level.
 * - This module itself stays deterministic, allocation-aware, and side-effect
 *   light. It decides. It does not own sockets, stores, or rendering.
 *
 * Integration target
 * ------------------
 * - Consumed by ChatChannelPolicy.ts, ChatMountRegistry.ts, ChatNpcDirector.ts,
 *   ChatNotificationController.ts, ChatSelectors.ts, and thin render shells.
 *
 * No fluff rule
 * -------------
 * Every section below exists to encode real policy: admission rules, cadence,
 * presence, crowd heat, helper suppression, readiness, transition gating,
 * prompt synthesis, transcript budgets, and pre-run dramaturgy.
 * ============================================================================
 */

// ============================================================================
// MARK: Compatibility contract surface
// ============================================================================

export type FrontendRunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';
export type FrontendModeCode = 'empire' | 'predator' | 'syndicate' | 'phantom';

export type LobbyVisibleChannel = 'LOBBY' | 'GLOBAL';
export type LobbyMessageKind =
  | 'PLAYER'
  | 'SYSTEM'
  | 'MARKET_ALERT'
  | 'ACHIEVEMENT'
  | 'BOT_TAUNT'
  | 'BOT_ATTACK'
  | 'SHIELD_EVENT'
  | 'CASCADE_ALERT'
  | 'DEAL_RECAP'
  | 'NPC_AMBIENT'
  | 'HELPER_PROMPT'
  | 'HELPER_RESCUE'
  | 'HATER_TELEGRAPH'
  | 'HATER_PUNISH'
  | 'CROWD_REACTION'
  | 'RELATIONSHIP_CALLBACK'
  | 'QUOTE_CALLBACK'
  | 'NEGOTIATION_OFFER'
  | 'NEGOTIATION_COUNTER'
  | 'LEGEND_MOMENT'
  | 'POST_RUN_RITUAL'
  | 'WORLD_EVENT'
  | 'SYSTEM_SHADOW_MARKER';

export type LobbySenderRole =
  | 'SELF'
  | 'OTHER_PLAYER'
  | 'SYSTEM_NOTICE'
  | 'SYSTEM_PROOF'
  | 'HATER_BOT'
  | 'HELPER_GUIDE'
  | 'AMBIENT_WATCHER'
  | 'CROWD_VOICE'
  | 'DEAL_BROKER'
  | 'LIVEOPS_OPERATOR';

export type LobbyStageMood =
  | 'CALM'
  | 'TENSE'
  | 'HOSTILE'
  | 'PREDATORY'
  | 'CEREMONIAL';

export type LobbyScenePhase =
  | 'ARRIVAL'
  | 'WARMUP'
  | 'READINESS_CHECK'
  | 'COUNTDOWN'
  | 'LOCKED'
  | 'TRANSITIONING';

export type LobbySystemIntent =
  | 'WELCOME'
  | 'MODE_BRIEFING'
  | 'PLAYER_READY'
  | 'PLAYER_NOT_READY'
  | 'ROOM_STALE'
  | 'MATCH_FOUND'
  | 'COUNTDOWN'
  | 'TRANSITION'
  | 'ANTI_SPAM'
  | 'QUEUE_NOTICE'
  | 'PROOF_NOTICE';

export type LobbyNpcIntent =
  | 'AMBIENT_WELCOME'
  | 'MODE_HYPE'
  | 'MODE_CAUTION'
  | 'SIZE_UP'
  | 'FLEX_RESPONSE'
  | 'HELPER_ORIENTATION'
  | 'HELPER_STRATEGY'
  | 'CROWD_HEAT'
  | 'QUIET_HOLD'
  | 'QUEUE_STALE'
  | 'COUNTDOWN_PUSH'
  | 'LEGEND_CALLBACK';

export type LobbyComposerIntent =
  | 'CHAT'
  | 'FLEX'
  | 'QUESTION'
  | 'TEAM_FORMATION'
  | 'READY_SIGNAL'
  | 'TRASH_TALK'
  | 'QUEUE_FRUSTRATION'
  | 'QUIET';

export type LobbyReadinessState =
  | 'UNINITIALIZED'
  | 'WAITING'
  | 'FORMING'
  | 'READY'
  | 'COUNTDOWN'
  | 'LOCKED'
  | 'MATCHED';

export interface LobbyPresenceSnapshot {
  readonly selfPresent: boolean;
  readonly totalPresent: number;
  readonly humanPresent: number;
  readonly helperPresent: number;
  readonly ambientNpcPresent: number;
  readonly haterPresent: number;
  readonly spectatorsVisible: number;
  readonly teammatesReady: number;
  readonly opponentsReady: number;
  readonly humansTyping: number;
  readonly npcsTyping: number;
}

export interface LobbyReadinessSnapshot {
  readonly state: LobbyReadinessState;
  readonly requiredPlayersMin: number;
  readonly requiredPlayersMax: number;
  readonly currentPlayers: number;
  readonly humanPlayers: number;
  readonly readyPlayers: number;
  readonly readyPct: number;
  readonly canStart: boolean;
  readonly countdownActive: boolean;
  readonly countdownRemainingMs: number;
  readonly queueWaitMs: number;
  readonly staleRoom: boolean;
  readonly formationComplete: boolean;
  readonly modeCode: FrontendModeCode;
}

export interface LobbyTelemetrySnapshot {
  readonly openedAtMs: number;
  readonly lastInteractionAtMs: number;
  readonly lastLobbyMessageAtMs: number;
  readonly localMessagesSent: number;
  readonly localMessagesBlocked: number;
  readonly totalMessagesObserved: number;
  readonly lobbyMessagesObserved: number;
  readonly globalMessagesObserved: number;
  readonly unreadLobby: number;
  readonly unreadGlobal: number;
  readonly modeChanges: number;
  readonly tabSwitches: number;
  readonly readyToggles: number;
  readonly queueJoins: number;
  readonly queueLeaves: number;
}

export interface LobbyRuntimeContext {
  readonly runMode: FrontendRunMode;
  readonly modeCode: FrontendModeCode;
  readonly mountTarget: 'LOBBY_SCREEN' | string;
  readonly nowMs: number;
  readonly playerId: string;
  readonly playerName: string;
  readonly playerRank?: string;
  readonly playerCord?: number;
  readonly pressureTier?: string;
  readonly tickTier?: string;
  readonly selectedChannel: LobbyVisibleChannel;
  readonly presence: LobbyPresenceSnapshot;
  readonly readiness: LobbyReadinessSnapshot;
  readonly telemetry: LobbyTelemetrySnapshot;
  readonly roomId?: string;
  readonly syndicateId?: string;
  readonly inQueue: boolean;
  readonly queueRegion?: string;
  readonly queueBucket?: string;
  readonly mutedNpcIds?: readonly string[];
  readonly blockedHandles?: readonly string[];
  readonly historicalBestNetWorth?: number;
  readonly historicalSovereigntyRate?: number;
  readonly lastRunOutcome?: 'SOVEREIGNTY' | 'BANKRUPTCY' | 'TIMEOUT' | 'ABANDONED' | null;
  readonly lastRunWasLegendary?: boolean;
  readonly relationshipHeat?: number;
  readonly crowdHeat?: number;
  readonly allowGlobalFallback?: boolean;
}

export interface LobbyDraftContext {
  readonly channel: LobbyVisibleChannel;
  readonly rawDraft: string;
  readonly trimmedDraft: string;
  readonly words: number;
  readonly chars: number;
  readonly hasQuestionMark: boolean;
  readonly hasExcessiveCaps: boolean;
  readonly hasAggressivePunctuation: boolean;
  readonly mentionsReady: boolean;
  readonly mentionsQueue: boolean;
  readonly mentionsTeam: boolean;
  readonly mentionsDeal: boolean;
  readonly mentionsHelp: boolean;
  readonly mentionsBotOrHater: boolean;
  readonly mentionsMode: boolean;
  readonly probableIntent: LobbyComposerIntent;
}

export interface LobbyComposerDecision {
  readonly allowSend: boolean;
  readonly normalizedDraft: string;
  readonly targetChannel: LobbyVisibleChannel;
  readonly intent: LobbyComposerIntent;
  readonly blockReason:
    | 'EMPTY'
    | 'TOO_LONG'
    | 'RATE_LIMITED'
    | 'LOBBY_LOCKED'
    | 'QUEUE_LOCK'
    | 'NEGOTIATION_REDIRECT'
    | 'READY_SPAM'
    | 'UNSUPPORTED_CHANNEL'
    | null;
  readonly helperWarning?: string;
  readonly suggestedReplacement?: string;
  readonly requiresSoftProofNotice: boolean;
  readonly escalateToGlobal: boolean;
}

export interface LobbyInjectionDecision {
  readonly allow: boolean;
  readonly targetChannel: LobbyVisibleChannel;
  readonly reason:
    | 'ALLOWED'
    | 'LOBBY_SUPPRESSED'
    | 'RUN_ONLY'
    | 'TOO_NOISY'
    | 'COUNTDOWN_LOCK'
    | 'RESCUE_DISALLOWED'
    | 'NEGOTIATION_REDIRECT'
    | 'MODE_MISMATCH'
    | 'PRESENCE_LOW';
  readonly coalesceWithPrevious: boolean;
  readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly visibleToPlayer: boolean;
  readonly queueShadowMarker: boolean;
}

export interface LobbyPresenceDecision {
  readonly showPresenceStrip: boolean;
  readonly showTyping: boolean;
  readonly showReadReceipts: boolean;
  readonly helperVisible: boolean;
  readonly haterVisible: boolean;
  readonly ambientVisible: boolean;
  readonly crowdVisible: boolean;
  readonly maxVisiblePresenceSlots: number;
  readonly stageMood: LobbyStageMood;
}

export interface LobbyPromptDecision {
  readonly composerPlaceholder: string;
  readonly emptyStateTitle: string;
  readonly emptyStateBody: string;
  readonly helperPrompt?: string;
  readonly stageBanner?: string;
}

export interface LobbyTranscriptBudget {
  readonly maxVisibleMessages: number;
  readonly maxRetainedMessages: number;
  readonly maxRetainedNpcMessages: number;
  readonly maxRetainedSystemMessages: number;
  readonly maxRetainedCrowdReactions: number;
  readonly replayRetentionClass: 'RUN_SCOPED';
  readonly collapseAggressiveCrowdReactions: boolean;
  readonly collapseDuplicateSystemNotices: boolean;
  readonly keepLegendCallbacks: boolean;
}

export interface LobbyCrowdHeatSnapshot {
  readonly score: number;
  readonly band: 'QUIET' | 'LOW' | 'ACTIVE' | 'HOT' | 'SURGING';
  readonly momentum: 'FALLING' | 'STABLE' | 'RISING';
  readonly stageMood: LobbyStageMood;
  readonly allowCrowdBursts: boolean;
  readonly allowAmbientCallouts: boolean;
}

export interface LobbyCountdownCue {
  readonly allowCue: boolean;
  readonly messageBody: string | null;
  readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly recommendedDelayMs: number;
  readonly stageMood: LobbyStageMood;
}

export interface LobbySystemNotice {
  readonly intent: LobbySystemIntent;
  readonly body: string;
  readonly priority: number;
  readonly targetChannel: LobbyVisibleChannel;
  readonly dedupeKey: string;
}

export interface LobbyNpcPrompt {
  readonly intent: LobbyNpcIntent;
  readonly body: string;
  readonly targetChannel: LobbyVisibleChannel;
  readonly priority: number;
  readonly speakerRole: LobbySenderRole;
  readonly recommendedDelayMs: number;
  readonly suppressIfHumansActive: boolean;
}

export interface LobbyPolicySnapshot {
  readonly runMode: FrontendRunMode;
  readonly modeCode: FrontendModeCode;
  readonly defaultVisibleChannel: LobbyVisibleChannel;
  readonly allowedVisibleChannels: readonly LobbyVisibleChannel[];
  readonly stagePhase: LobbyScenePhase;
  readonly stageMood: LobbyStageMood;
  readonly crowdHeat: LobbyCrowdHeatSnapshot;
  readonly presence: LobbyPresenceDecision;
  readonly prompt: LobbyPromptDecision;
  readonly transcriptBudget: LobbyTranscriptBudget;
  readonly lobbyLocked: boolean;
  readonly allowNpcInjection: boolean;
  readonly allowHelperRescue: boolean;
  readonly allowHaterPunish: boolean;
  readonly allowCountdownCues: boolean;
  readonly softLaunchGlobalMirror: boolean;
}

// ============================================================================
// MARK: Static tables — mode catalog mirrors, lobby laws, and budgets
// ============================================================================

export const LOBBY_ALLOWED_VISIBLE_CHANNELS: readonly LobbyVisibleChannel[] = Object.freeze([
  'LOBBY',
  'GLOBAL',
]);

export const LOBBY_DEFAULT_VISIBLE_CHANNEL: LobbyVisibleChannel = 'LOBBY';

export const RUN_MODE_TO_MODE_CODE: Readonly<Record<FrontendRunMode, FrontendModeCode>> = Object.freeze({
  solo: 'empire',
  'asymmetric-pvp': 'predator',
  'co-op': 'syndicate',
  ghost: 'phantom',
});

export const RUN_MODE_TO_PLAYER_RANGE: Readonly<
  Record<FrontendRunMode, readonly [min: number, max: number]>
> = Object.freeze({
  solo: [1, 1],
  'asymmetric-pvp': [2, 2],
  'co-op': [2, 4],
  ghost: [1, 1],
});

export const RUN_MODE_TO_UI_LABEL: Readonly<Record<FrontendRunMode, string>> = Object.freeze({
  solo: 'Empire',
  'asymmetric-pvp': 'Predator',
  'co-op': 'Syndicate',
  ghost: 'Phantom',
});

export const RUN_MODE_TO_LOBBY_TONE: Readonly<Record<FrontendRunMode, LobbyStageMood>> = Object.freeze({
  solo: 'CALM',
  'asymmetric-pvp': 'PREDATORY',
  'co-op': 'CEREMONIAL',
  ghost: 'TENSE',
});

export const LOBBY_LAWS: readonly string[] = Object.freeze([
  'The first meaningful lobby reaction should be fast.',
  'The second lobby reaction should prove the room noticed something specific.',
  'The lobby should feel alive before the authoritative run begins.',
  'Helpers may orient. They may not rescue-spam before the run.',
  'Haters may size up. They may not fully punish before the run.',
  'Countdown cues escalate with increasing urgency and decreasing noise budget.',
  'Lobby transcript remains replay-worthy because pre-run tone matters.',
  'The lobby must respect mode identity rather than flatten into generic global chat.',
  'Co-op lobby emphasizes trust and readiness.',
  'Predator lobby emphasizes poise, posture, and intimidation.',
  'Empire lobby emphasizes self-mastery and quiet preparation.',
  'Phantom lobby emphasizes legend memory and spectral tension.',
]);

export const LOBBY_TRANSCRIPT_BUDGETS: Readonly<
  Record<FrontendRunMode, LobbyTranscriptBudget>
> = Object.freeze({
  solo: {
    maxVisibleMessages: 48,
    maxRetainedMessages: 220,
    maxRetainedNpcMessages: 90,
    maxRetainedSystemMessages: 45,
    maxRetainedCrowdReactions: 28,
    replayRetentionClass: 'RUN_SCOPED',
    collapseAggressiveCrowdReactions: true,
    collapseDuplicateSystemNotices: true,
    keepLegendCallbacks: true,
  },
  'asymmetric-pvp': {
    maxVisibleMessages: 54,
    maxRetainedMessages: 260,
    maxRetainedNpcMessages: 110,
    maxRetainedSystemMessages: 55,
    maxRetainedCrowdReactions: 24,
    replayRetentionClass: 'RUN_SCOPED',
    collapseAggressiveCrowdReactions: true,
    collapseDuplicateSystemNotices: true,
    keepLegendCallbacks: true,
  },
  'co-op': {
    maxVisibleMessages: 58,
    maxRetainedMessages: 320,
    maxRetainedNpcMessages: 120,
    maxRetainedSystemMessages: 70,
    maxRetainedCrowdReactions: 18,
    replayRetentionClass: 'RUN_SCOPED',
    collapseAggressiveCrowdReactions: false,
    collapseDuplicateSystemNotices: true,
    keepLegendCallbacks: true,
  },
  ghost: {
    maxVisibleMessages: 50,
    maxRetainedMessages: 240,
    maxRetainedNpcMessages: 100,
    maxRetainedSystemMessages: 60,
    maxRetainedCrowdReactions: 20,
    replayRetentionClass: 'RUN_SCOPED',
    collapseAggressiveCrowdReactions: true,
    collapseDuplicateSystemNotices: true,
    keepLegendCallbacks: true,
  },
});

export const LOBBY_READY_KEYWORDS: readonly string[] = Object.freeze([
  'ready',
  'rdy',
  'locked',
  'set',
  'good to go',
  'start it',
  'queue it',
  'launch it',
  'lets go',
  'let’s go',
]);

export const LOBBY_HELP_KEYWORDS: readonly string[] = Object.freeze([
  'help',
  'tips',
  'tip',
  'how',
  'what should',
  'strategy',
  'plan',
  'best way',
  'what do i do',
  'what do we do',
]);

export const LOBBY_QUEUE_KEYWORDS: readonly string[] = Object.freeze([
  'queue',
  'match',
  'waiting',
  'wait',
  'timer',
  'stuck',
  'found game',
  'find game',
  'start',
]);

export const LOBBY_TEAM_KEYWORDS: readonly string[] = Object.freeze([
  'team',
  'syndicate',
  'role',
  'roles',
  'cover',
  'carry',
  'shield',
  'trust',
  'treasury',
  'aid',
]);

export const LOBBY_DEAL_KEYWORDS: readonly string[] = Object.freeze([
  'deal',
  'trade',
  'offer',
  'counter',
  'price',
  'terms',
  'split',
  'cut',
  'stake',
  'proof',
]);

export const LOBBY_HATER_KEYWORDS: readonly string[] = Object.freeze([
  'hater',
  'liquidator',
  'bureaucrat',
  'manipulator',
  'crash prophet',
  'legacy heir',
  'bot',
  'attack',
  'heat',
]);

export const LOBBY_FLEX_KEYWORDS: readonly string[] = Object.freeze([
  'easy',
  'light work',
  'i always',
  'free win',
  'never lose',
  'too easy',
  'carried',
  'im built for this',
  'i’m built for this',
]);

export const LOBBY_MODE_KEYWORDS: Readonly<Record<FrontendRunMode, readonly string[]>> = Object.freeze({
  solo: ['solo', 'empire', 'empire mode', 'one player', '1vmarket'],
  'asymmetric-pvp': ['predator', 'pvp', 'duel', 'asymmetric', '1v1'],
  'co-op': ['co-op', 'coop', 'syndicate', 'team run', 'together'],
  ghost: ['ghost', 'phantom', 'legend', 'echo', 'replay ghost'],
});

export const LOBBY_MAX_DRAFT_LENGTH = 280;
export const LOBBY_MAX_WORDS = 48;
export const LOBBY_READY_SPAM_WINDOW_MS = 2_500;
export const LOBBY_RATE_LIMIT_WINDOW_MS = 1_250;
export const LOBBY_STALE_ROOM_THRESHOLD_MS = 70_000;
export const LOBBY_COUNTDOWN_HIGH_URGENCY_MS = 10_000;
export const LOBBY_COUNTDOWN_MEDIUM_URGENCY_MS = 20_000;
export const LOBBY_CROWD_HEAT_SURGE_SCORE = 82;
export const LOBBY_CROWD_HEAT_HOT_SCORE = 65;
export const LOBBY_CROWD_HEAT_ACTIVE_SCORE = 45;
export const LOBBY_CROWD_HEAT_LOW_SCORE = 20;

// ============================================================================
// MARK: Phrase banks — mode-native prompt synthesis and NPC staging
// ============================================================================

const SOLO_WELCOME_LINES = Object.freeze([
  'Empire room open. Quiet the noise. Build before the first breach ever lands.',
  'Solo room live. No syndicate shield is coming. Your preparation is the first wall.',
  'Empire lobby awake. Cashflow begins before the first card flips — in your posture.',
  'You are alone in the room, but not unwatched. The market is already listening.',
  'Empire queue open. This is where discipline starts looking like destiny.',
]);

const SOLO_HELPER_LINES = Object.freeze([
  'Start calm. Build income first. Force the run to respect your floor before you chase ceiling.',
  'If you want a clean opener: income buffer, shield floor, then controlled aggression.',
  'Empire doctrine: do not flex before your base can survive a correction.',
  'The quietest solo starts often become the strongest sovereign finishes.',
  'You do not need hype here. You need structure before velocity.',
]);

const SOLO_HATER_SIZEUP_LINES = Object.freeze([
  'The room is quiet. That usually means someone thinks they can do this clean.',
  'A lot of players sound calm before the first correction changes their voice.',
  'The market likes confident people. It likes humbled people more.',
  'No entourage. No bailout. Just you and whatever survives your first hundred ticks.',
  'I prefer solo rooms. The excuses are easier to isolate.',
]);

const PREDATOR_WELCOME_LINES = Object.freeze([
  'Predator room open. Somebody will posture. Somebody will flinch. The room is waiting to see which is which.',
  'Asymmetric PvP lobby live. Shared pressure. Split poise. No equal footing promised.',
  'Predator queue armed. Every line you type before the run becomes material.',
  'The duel begins before the first combat budget swings. It begins in how you enter the room.',
  'Predator lobby awake. You are already being measured for weakness and overreach.',
]);

const PREDATOR_HELPER_LINES = Object.freeze([
  'Do not leak your whole plan in the lobby. Predators profit from volunteered rhythm.',
  'Signal confidence, not desperation. Confidence invites challenge. Desperation invites blood.',
  'If you must talk, do it with controlled ambiguity. Give less away than you think you are giving.',
  'Predator doctrine: composure first, aggression second, proof last.',
  'A disciplined silence in this room can be more violent than a paragraph.',
]);

const PREDATOR_HATER_SIZEUP_LINES = Object.freeze([
  'One of you is already oversharing. That usually saves me time later.',
  'Predator rooms are my favorite. Half the damage is volunteered before the run even starts.',
  'Talk bigger. It helps me find the pressure seam faster.',
  'Every duel has a first overstatement. I am listening for yours.',
  'You do not need to tell the room who is weaker. The room usually tells on itself.',
]);

const COOP_WELCOME_LINES = Object.freeze([
  'Syndicate room open. Trust is already being priced.',
  'Co-op lobby live. Treasury is future. Friction is cost. Speak like both matter.',
  'Syndicate queue awake. Roles, trust, readiness — this is where the team run actually starts.',
  'Co-op room open. A strong team decides their tone before they decide their cards.',
  'Syndicate lobby online. Aid windows later begin with clarity now.',
]);

const COOP_HELPER_LINES = Object.freeze([
  'Establish roles early. Income builder, shield architect, debt surgeon, intel broker — ambiguity gets expensive fast.',
  'If you are queuing as a team, state readiness and role preference before the countdown tightens.',
  'Trust is not a vibe in syndicate. It is a live resource with downstream cost.',
  'The best co-op starts sound calm, specific, and committed.',
  'Syndicate doctrine: clarity now prevents rescue panic later.',
]);

const COOP_HATER_SIZEUP_LINES = Object.freeze([
  'Teams say “we” until the first deficit asks who actually meant it.',
  'Trust is beautiful right up until the treasury turns red.',
  'A co-op room is just an elegant place to watch blame learn how to travel.',
  'I love teams that promise perfect coordination in public.',
  'The first person who over-explains the plan is usually the first person who cracks when it bends.',
]);

const GHOST_WELCOME_LINES = Object.freeze([
  'Phantom room open. Somebody here is chasing a legend or becoming one.',
  'Ghost queue live. The room remembers more than it says.',
  'Phantom lobby awake. Echoes of prior runs are closer than they look.',
  'Legend pressure starts before the first ghost comparison resolves.',
  'Ghost room open. Some players arrive to beat history. Some arrive to be swallowed by it.',
]);

const GHOST_HELPER_LINES = Object.freeze([
  'Respect the legend without letting it author your first move.',
  'Ghost doctrine: compare, but do not imitate blindly. Divergence wins when imitation stalls.',
  'If the room feels heavier here, that is because it is. Phantom lobbies carry witnesses.',
  'A legend callback can sharpen you or haunt you. Choose early which.',
  'Do not let borrowed history make your next move smaller than it should be.',
]);

const GHOST_HATER_SIZEUP_LINES = Object.freeze([
  'Some of you came here to defeat an echo. Most players lose to the echo in their own head first.',
  'Legends are expensive to chase when you confuse memory with destiny.',
  'Ghost rooms produce the cleanest collapses — everybody swears they were close to greatness.',
  'History is useful. Panic around history is more useful.',
  'The room remembers. That does not mean the room forgives.',
]);

const LOBBY_COUNTDOWN_LINES = Object.freeze([
  'Countdown engaged. Clean your last signal. The room is about to harden.',
  'Lock incoming. Say only what you want remembered on the other side of the first tick.',
  'Readiness threshold crossed. The lobby is narrowing into consequence.',
  'Queue sealed. Whatever tone you set here will bleed forward.',
  'Transition window open. Final pre-run signals only.',
]);

const LOBBY_STALE_ROOM_LINES = Object.freeze([
  'The room has gone stale. Wake it up with readiness, role clarity, or silence with intent.',
  'No one is moving the room. Either commit the tone or let the system tighten it for you.',
  'Queue drag detected. The lobby is starting to flatten. Reset it with a real signal.',
  'Stale lobby. The room needs clarity more than chatter.',
  'Silence is useful. Drift is not. Re-anchor the room.',
]);

const LOBBY_LEGEND_CALLBACK_LINES = Object.freeze([
  'The room still remembers how your last run ended.',
  'Legend memory active. The room is not meeting you as a stranger.',
  'Your prior run left a residue here. Use it or get trapped inside it.',
  'Some players enter the lobby clean. You entered with witnesses.',
  'Your last result is in the room whether you speak it or not.',
]);

// ============================================================================
// MARK: Helpers
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function countWords(value: string): number {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return 0;
  return trimmed.split(' ').length;
}

function containsAny(haystack: string, needles: readonly string[]): boolean {
  const lower = haystack.toLowerCase();
  for (const needle of needles) {
    if (lower.includes(needle)) return true;
  }
  return false;
}

function chooseStable<T>(values: readonly T[], seed: number): T {
  if (values.length === 0) {
    throw new Error('chooseStable called with empty array.');
  }
  const index = Math.abs(seed) % values.length;
  return values[index]!;
}

function runModeToModeCode(mode: FrontendRunMode): FrontendModeCode {
  return RUN_MODE_TO_MODE_CODE[mode];
}

function inferScenePhase(readiness: LobbyReadinessSnapshot): LobbyScenePhase {
  if (readiness.state === 'LOCKED') return 'LOCKED';
  if (readiness.state === 'MATCHED') return 'TRANSITIONING';
  if (readiness.state === 'COUNTDOWN') return 'COUNTDOWN';
  if (readiness.state === 'READY') return 'READINESS_CHECK';
  if (readiness.state === 'FORMING') return 'WARMUP';
  return 'ARRIVAL';
}

function stableSeedFromContext(context: LobbyRuntimeContext): number {
  const source = `${context.playerId}:${context.runMode}:${context.readiness.currentPlayers}:${context.presence.totalPresent}:${context.telemetry.totalMessagesObserved}:${context.readiness.readyPlayers}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function getModePhraseBank(
  runMode: FrontendRunMode,
): {
  welcome: readonly string[];
  helper: readonly string[];
  hater: readonly string[];
} {
  switch (runMode) {
    case 'solo':
      return {
        welcome: SOLO_WELCOME_LINES,
        helper: SOLO_HELPER_LINES,
        hater: SOLO_HATER_SIZEUP_LINES,
      };
    case 'asymmetric-pvp':
      return {
        welcome: PREDATOR_WELCOME_LINES,
        helper: PREDATOR_HELPER_LINES,
        hater: PREDATOR_HATER_SIZEUP_LINES,
      };
    case 'co-op':
      return {
        welcome: COOP_WELCOME_LINES,
        helper: COOP_HELPER_LINES,
        hater: COOP_HATER_SIZEUP_LINES,
      };
    case 'ghost':
      return {
        welcome: GHOST_WELCOME_LINES,
        helper: GHOST_HELPER_LINES,
        hater: GHOST_HATER_SIZEUP_LINES,
      };
    default: {
      const exhaustive: never = runMode;
      return exhaustive;
    }
  }
}

function calculateReadyPct(readiness: LobbyReadinessSnapshot): number {
  const denominator = Math.max(readiness.currentPlayers, 1);
  return clamp((readiness.readyPlayers / denominator) * 100, 0, 100);
}

function calculateCrowdHeat(context: LobbyRuntimeContext): LobbyCrowdHeatSnapshot {
  const baseFromPresence = clamp(context.presence.totalPresent * 4, 0, 40);
  const baseFromTyping = clamp((context.presence.humansTyping * 7) + (context.presence.npcsTyping * 3), 0, 25);
  const baseFromReady = clamp(context.readiness.readyPct * 0.25, 0, 25);
  const baseFromTelemetry = clamp((context.telemetry.lobbyMessagesObserved * 0.35), 0, 20);
  const historicalBoost = context.lastRunWasLegendary ? 8 : 0;
  const modeBias = context.runMode === 'asymmetric-pvp'
    ? 10
    : context.runMode === 'co-op'
      ? 6
      : context.runMode === 'ghost'
        ? 8
        : 0;

  const score = clamp(
    Math.round(
      baseFromPresence +
      baseFromTyping +
      baseFromReady +
      baseFromTelemetry +
      historicalBoost +
      modeBias,
    ),
    0,
    100,
  );

  const band: LobbyCrowdHeatSnapshot['band'] = score >= LOBBY_CROWD_HEAT_SURGE_SCORE
    ? 'SURGING'
    : score >= LOBBY_CROWD_HEAT_HOT_SCORE
      ? 'HOT'
      : score >= LOBBY_CROWD_HEAT_ACTIVE_SCORE
        ? 'ACTIVE'
        : score >= LOBBY_CROWD_HEAT_LOW_SCORE
          ? 'LOW'
          : 'QUIET';

  const momentum: LobbyCrowdHeatSnapshot['momentum'] = context.presence.humansTyping > 1 || context.telemetry.lobbyMessagesObserved > 8
    ? 'RISING'
    : context.telemetry.lastLobbyMessageAtMs > 0 && (context.nowMs - context.telemetry.lastLobbyMessageAtMs) > 20_000
      ? 'FALLING'
      : 'STABLE';

  const stageMood: LobbyStageMood = band === 'SURGING'
    ? (context.runMode === 'asymmetric-pvp' ? 'PREDATORY' : 'HOSTILE')
    : band === 'HOT'
      ? (context.runMode === 'co-op' ? 'TENSE' : RUN_MODE_TO_LOBBY_TONE[context.runMode])
      : RUN_MODE_TO_LOBBY_TONE[context.runMode];

  return {
    score,
    band,
    momentum,
    stageMood,
    allowCrowdBursts: band === 'ACTIVE' || band === 'HOT' || band === 'SURGING',
    allowAmbientCallouts: band !== 'QUIET',
  };
}

function normalizeDraft(raw: string): string {
  let normalized = raw.replace(/[\u0000-\u001F\u007F]/g, ' ');
  normalized = normalized.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  normalized = normalizeWhitespace(normalized);
  if (normalized.length > LOBBY_MAX_DRAFT_LENGTH) {
    normalized = normalized.slice(0, LOBBY_MAX_DRAFT_LENGTH).trimEnd();
  }
  return normalized;
}

function buildDraftContext(
  channel: LobbyVisibleChannel,
  rawDraft: string,
): LobbyDraftContext {
  const normalized = normalizeDraft(rawDraft);
  const lower = normalized.toLowerCase();
  const words = countWords(normalized);
  const chars = normalized.length;
  const hasQuestionMark = normalized.includes('?');
  const hasExcessiveCaps = /[A-Z]/.test(normalized) && normalized === normalized.toUpperCase() && chars >= 8;
  const hasAggressivePunctuation = /[!?]{2,}/.test(normalized);
  const mentionsReady = containsAny(lower, LOBBY_READY_KEYWORDS);
  const mentionsQueue = containsAny(lower, LOBBY_QUEUE_KEYWORDS);
  const mentionsTeam = containsAny(lower, LOBBY_TEAM_KEYWORDS);
  const mentionsDeal = containsAny(lower, LOBBY_DEAL_KEYWORDS);
  const mentionsHelp = containsAny(lower, LOBBY_HELP_KEYWORDS);
  const mentionsBotOrHater = containsAny(lower, LOBBY_HATER_KEYWORDS);
  const mentionsMode = containsAny(lower, [
    ...LOBBY_MODE_KEYWORDS.solo,
    ...LOBBY_MODE_KEYWORDS['asymmetric-pvp'],
    ...LOBBY_MODE_KEYWORDS['co-op'],
    ...LOBBY_MODE_KEYWORDS.ghost,
  ]);

  let probableIntent: LobbyComposerIntent = 'CHAT';
  if (!normalized) {
    probableIntent = 'QUIET';
  } else if (mentionsReady) {
    probableIntent = 'READY_SIGNAL';
  } else if (mentionsHelp || hasQuestionMark) {
    probableIntent = 'QUESTION';
  } else if (mentionsTeam) {
    probableIntent = 'TEAM_FORMATION';
  } else if (mentionsQueue) {
    probableIntent = 'QUEUE_FRUSTRATION';
  } else if (containsAny(lower, LOBBY_FLEX_KEYWORDS)) {
    probableIntent = 'FLEX';
  } else if (hasExcessiveCaps || hasAggressivePunctuation) {
    probableIntent = 'TRASH_TALK';
  }

  return {
    channel,
    rawDraft,
    trimmedDraft: normalized,
    words,
    chars,
    hasQuestionMark,
    hasExcessiveCaps,
    hasAggressivePunctuation,
    mentionsReady,
    mentionsQueue,
    mentionsTeam,
    mentionsDeal,
    mentionsHelp,
    mentionsBotOrHater,
    mentionsMode,
    probableIntent,
  };
}

// ============================================================================
// MARK: Policy implementation
// ============================================================================

export class LobbyChannelPolicy {
  public readonly id = 'LOBBY';
  public readonly family = 'PRE_RUN' as const;
  public readonly isVisible = true;
  public readonly isReplayable = true;
  public readonly supportsComposer = true;
  public readonly supportsPresence = true;
  public readonly supportsTyping = true;
  public readonly supportsReadReceipts = true;
  public readonly supportsNpcInjection = true;
  public readonly supportsCrowdHeat = true;
  public readonly supportsRelationshipState = true;
  public readonly supportsNegotiationLogic = false;
  public readonly supportsRescueLogic = false;
  public readonly persistenceClass = 'RUN_SCOPED' as const;

  // --------------------------------------------------------------------------
  // Core snapshot synthesis
  // --------------------------------------------------------------------------

  public createSnapshot(context: LobbyRuntimeContext): LobbyPolicySnapshot {
    const crowdHeat = calculateCrowdHeat(context);
    const stagePhase = inferScenePhase(context.readiness);
    const stageMood = this.resolveStageMood(context, stagePhase, crowdHeat);
    const presence = this.resolvePresenceDecision(context, stagePhase, stageMood);
    const prompt = this.resolvePromptDecision(context, stagePhase, stageMood, crowdHeat);
    const transcriptBudget = this.getTranscriptBudget(context.runMode);

    return {
      runMode: context.runMode,
      modeCode: context.modeCode,
      defaultVisibleChannel: LOBBY_DEFAULT_VISIBLE_CHANNEL,
      allowedVisibleChannels: LOBBY_ALLOWED_VISIBLE_CHANNELS,
      stagePhase,
      stageMood,
      crowdHeat,
      presence,
      prompt,
      transcriptBudget,
      lobbyLocked: stagePhase === 'LOCKED' || stagePhase === 'TRANSITIONING',
      allowNpcInjection: this.allowNpcInjection(context, stagePhase),
      allowHelperRescue: false,
      allowHaterPunish: false,
      allowCountdownCues: context.readiness.countdownActive,
      softLaunchGlobalMirror: context.allowGlobalFallback ?? true,
    };
  }

  public getTranscriptBudget(runMode: FrontendRunMode): LobbyTranscriptBudget {
    return LOBBY_TRANSCRIPT_BUDGETS[runMode];
  }

  public getAllowedVisibleChannels(): readonly LobbyVisibleChannel[] {
    return LOBBY_ALLOWED_VISIBLE_CHANNELS;
  }

  public getDefaultVisibleChannel(): LobbyVisibleChannel {
    return LOBBY_DEFAULT_VISIBLE_CHANNEL;
  }

  public getModeCode(runMode: FrontendRunMode): FrontendModeCode {
    return runModeToModeCode(runMode);
  }

  public canActivateChannel(
    requested: string,
    context: LobbyRuntimeContext,
  ): requested is LobbyVisibleChannel {
    if (requested !== 'LOBBY' && requested !== 'GLOBAL') {
      return false;
    }

    if (requested === 'GLOBAL' && !(context.allowGlobalFallback ?? true)) {
      return false;
    }

    return true;
  }

  public resolveStageMood(
    context: LobbyRuntimeContext,
    stagePhase: LobbyScenePhase,
    crowdHeat: LobbyCrowdHeatSnapshot,
  ): LobbyStageMood {
    if (stagePhase === 'LOCKED' || stagePhase === 'TRANSITIONING') {
      return context.runMode === 'co-op'
        ? 'CEREMONIAL'
        : context.runMode === 'asymmetric-pvp'
          ? 'PREDATORY'
          : context.runMode === 'ghost'
            ? 'HOSTILE'
            : 'TENSE';
    }

    if (stagePhase === 'COUNTDOWN') {
      return context.runMode === 'asymmetric-pvp'
        ? 'PREDATORY'
        : context.runMode === 'co-op'
          ? 'CEREMONIAL'
          : crowdHeat.stageMood;
    }

    if (context.runMode === 'ghost' && context.lastRunWasLegendary) {
      return 'CEREMONIAL';
    }

    return crowdHeat.stageMood;
  }

  public allowNpcInjection(
    context: LobbyRuntimeContext,
    stagePhase: LobbyScenePhase,
  ): boolean {
    if (stagePhase === 'LOCKED' || stagePhase === 'TRANSITIONING') {
      return false;
    }

    if (context.presence.totalPresent <= 0) {
      return true;
    }

    if (context.presence.humansTyping >= 2 && !context.readiness.countdownActive) {
      return false;
    }

    return true;
  }

  public resolvePresenceDecision(
    context: LobbyRuntimeContext,
    stagePhase: LobbyScenePhase,
    stageMood: LobbyStageMood,
  ): LobbyPresenceDecision {
    const showTyping = stagePhase !== 'TRANSITIONING';
    const helperVisible = stagePhase !== 'LOCKED' && context.presence.helperPresent > 0;
    const haterVisible = stagePhase !== 'LOCKED' && context.runMode !== 'co-op';
    const ambientVisible = context.presence.ambientNpcPresent > 0 || context.presence.totalPresent <= 1;
    const crowdVisible = context.presence.totalPresent > 1 || context.telemetry.lobbyMessagesObserved > 2;

    let maxVisiblePresenceSlots = 8;
    if (context.runMode === 'co-op') maxVisiblePresenceSlots = 10;
    if (context.runMode === 'solo') maxVisiblePresenceSlots = 6;

    if (stagePhase === 'COUNTDOWN') {
      maxVisiblePresenceSlots = Math.min(maxVisiblePresenceSlots, 6);
    }

    return {
      showPresenceStrip: true,
      showTyping,
      showReadReceipts: true,
      helperVisible,
      haterVisible,
      ambientVisible,
      crowdVisible,
      maxVisiblePresenceSlots,
      stageMood,
    };
  }

  public resolvePromptDecision(
    context: LobbyRuntimeContext,
    stagePhase: LobbyScenePhase,
    stageMood: LobbyStageMood,
    crowdHeat: LobbyCrowdHeatSnapshot,
  ): LobbyPromptDecision {
    const modeLabel = RUN_MODE_TO_UI_LABEL[context.runMode];

    let composerPlaceholder = 'Warm up the room…';
    let emptyStateTitle = `${modeLabel} lobby live.`;
    let emptyStateBody = 'The room is awake before the run is.';
    let helperPrompt: string | undefined;
    let stageBanner: string | undefined;

    if (context.runMode === 'solo') {
      composerPlaceholder = 'Set your posture before the run…';
      emptyStateBody = 'Empire starts in preparation, not in panic.';
    } else if (context.runMode === 'asymmetric-pvp') {
      composerPlaceholder = 'Signal poise or make them blink…';
      emptyStateBody = 'The duel starts before the first tick lands.';
    } else if (context.runMode === 'co-op') {
      composerPlaceholder = 'Set roles, readiness, and trust…';
      emptyStateBody = 'Syndicate tone becomes treasury cost later.';
    } else if (context.runMode === 'ghost') {
      composerPlaceholder = 'Meet the legend without shrinking…';
      emptyStateBody = 'The room remembers more than it says.';
    }

    if (stagePhase === 'COUNTDOWN') {
      composerPlaceholder = 'Final pre-run signal…';
      stageBanner = 'Countdown active.';
    }

    if (stagePhase === 'LOCKED' || stagePhase === 'TRANSITIONING') {
      composerPlaceholder = 'Transitioning into run…';
      stageBanner = 'Lobby hardening into run.';
    }

    if (context.runMode === 'co-op' && context.readiness.readyPct < 100) {
      helperPrompt = 'Declare your role and ready state before the room drifts.';
    } else if (context.runMode === 'asymmetric-pvp' && crowdHeat.band !== 'QUIET') {
      helperPrompt = 'Do not leak your whole hand in the lobby.';
    } else if (context.runMode === 'ghost' && context.lastRunWasLegendary) {
      helperPrompt = 'The room remembers your last run. Enter clean.';
    } else if (context.runMode === 'solo' && stageMood === 'CALM') {
      helperPrompt = 'Quiet preparation beats loud intention in Empire.';
    }

    return {
      composerPlaceholder,
      emptyStateTitle,
      emptyStateBody,
      helperPrompt,
      stageBanner,
    };
  }

  // --------------------------------------------------------------------------
  // Composer and player-send policy
  // --------------------------------------------------------------------------

  public evaluateComposer(
    context: LobbyRuntimeContext,
    rawDraft: string,
    preferredChannel: LobbyVisibleChannel = 'LOBBY',
  ): LobbyComposerDecision {
    const draft = buildDraftContext(preferredChannel, rawDraft);
    const snapshot = this.createSnapshot(context);

    if (!draft.trimmedDraft) {
      return {
        allowSend: false,
        normalizedDraft: '',
        targetChannel: preferredChannel,
        intent: 'QUIET',
        blockReason: 'EMPTY',
        requiresSoftProofNotice: false,
        escalateToGlobal: false,
      };
    }

    if (draft.chars > LOBBY_MAX_DRAFT_LENGTH || draft.words > LOBBY_MAX_WORDS) {
      return {
        allowSend: false,
        normalizedDraft: draft.trimmedDraft.slice(0, LOBBY_MAX_DRAFT_LENGTH),
        targetChannel: preferredChannel,
        intent: draft.probableIntent,
        blockReason: 'TOO_LONG',
        helperWarning: 'Lobby lines should stay sharp before the run begins.',
        suggestedReplacement: draft.trimmedDraft.slice(0, 160),
        requiresSoftProofNotice: false,
        escalateToGlobal: false,
      };
    }

    if (snapshot.lobbyLocked) {
      return {
        allowSend: false,
        normalizedDraft: draft.trimmedDraft,
        targetChannel: preferredChannel,
        intent: draft.probableIntent,
        blockReason: 'LOBBY_LOCKED',
        helperWarning: 'The room is already transitioning into the run.',
        requiresSoftProofNotice: false,
        escalateToGlobal: false,
      };
    }

    if (
      context.telemetry.lastInteractionAtMs > 0 &&
      (context.nowMs - context.telemetry.lastInteractionAtMs) < LOBBY_RATE_LIMIT_WINDOW_MS &&
      draft.probableIntent !== 'READY_SIGNAL'
    ) {
      return {
        allowSend: false,
        normalizedDraft: draft.trimmedDraft,
        targetChannel: preferredChannel,
        intent: draft.probableIntent,
        blockReason: 'RATE_LIMITED',
        helperWarning: 'Let the room breathe for a second before layering another line.',
        requiresSoftProofNotice: false,
        escalateToGlobal: false,
      };
    }

    if (
      draft.probableIntent === 'READY_SIGNAL' &&
      context.telemetry.lastInteractionAtMs > 0 &&
      (context.nowMs - context.telemetry.lastInteractionAtMs) < LOBBY_READY_SPAM_WINDOW_MS
    ) {
      return {
        allowSend: false,
        normalizedDraft: draft.trimmedDraft,
        targetChannel: preferredChannel,
        intent: draft.probableIntent,
        blockReason: 'READY_SPAM',
        helperWarning: 'One readiness signal is enough until the state changes.',
        requiresSoftProofNotice: false,
        escalateToGlobal: false,
      };
    }

    if (draft.mentionsDeal) {
      return {
        allowSend: false,
        normalizedDraft: draft.trimmedDraft,
        targetChannel: 'GLOBAL',
        intent: draft.probableIntent,
        blockReason: 'NEGOTIATION_REDIRECT',
        helperWarning: 'Deal language belongs in the in-run negotiation lane, not the lobby warmup lane.',
        suggestedReplacement: 'Save exact terms for DEAL_ROOM after mount transition.',
        requiresSoftProofNotice: true,
        escalateToGlobal: false,
      };
    }

    if (context.inQueue && draft.probableIntent === 'QUEUE_FRUSTRATION' && context.readiness.countdownActive) {
      return {
        allowSend: false,
        normalizedDraft: draft.trimmedDraft,
        targetChannel: preferredChannel,
        intent: draft.probableIntent,
        blockReason: 'QUEUE_LOCK',
        helperWarning: 'Countdown active. Do not blow up the room over queue friction now.',
        requiresSoftProofNotice: false,
        escalateToGlobal: false,
      };
    }

    const normalizedDraft = this.applySoftNormalization(draft);
    const targetChannel = this.resolveTargetChannel(context, draft, preferredChannel);

    return {
      allowSend: true,
      normalizedDraft,
      targetChannel,
      intent: draft.probableIntent,
      blockReason: null,
      helperWarning: this.buildSendHelperWarning(context, draft),
      suggestedReplacement: undefined,
      requiresSoftProofNotice: false,
      escalateToGlobal: targetChannel === 'GLOBAL' && preferredChannel !== 'GLOBAL',
    };
  }

  public applySoftNormalization(draft: LobbyDraftContext): string {
    let normalized = draft.trimmedDraft;

    if (draft.hasExcessiveCaps && normalized.length > 10) {
      normalized = normalized.toLowerCase();
      normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    if (draft.hasAggressivePunctuation) {
      normalized = normalized.replace(/[!?]{2,}/g, '!');
    }

    return normalized;
  }

  public resolveTargetChannel(
    context: LobbyRuntimeContext,
    draft: LobbyDraftContext,
    preferredChannel: LobbyVisibleChannel,
  ): LobbyVisibleChannel {
    if (preferredChannel === 'GLOBAL') {
      return 'GLOBAL';
    }

    if (draft.probableIntent === 'QUEUE_FRUSTRATION' && (context.allowGlobalFallback ?? true)) {
      return 'GLOBAL';
    }

    if (draft.probableIntent === 'FLEX' && context.runMode === 'asymmetric-pvp' && (context.allowGlobalFallback ?? true)) {
      return 'GLOBAL';
    }

    if (draft.probableIntent === 'READY_SIGNAL') {
      return 'LOBBY';
    }

    return preferredChannel;
  }

  public buildSendHelperWarning(
    context: LobbyRuntimeContext,
    draft: LobbyDraftContext,
  ): string | undefined {
    if (draft.probableIntent === 'TRASH_TALK' && context.runMode === 'asymmetric-pvp') {
      return 'Poise usually cuts deeper than shouting in Predator.';
    }

    if (draft.probableIntent === 'TEAM_FORMATION' && context.runMode === 'co-op') {
      return 'Good. State role, readiness, and what you are covering.';
    }

    if (draft.probableIntent === 'QUESTION' && context.runMode === 'solo') {
      return 'Keep the question sharp. Empire rewards precision before action.';
    }

    if (draft.probableIntent === 'FLEX' && context.runMode === 'ghost') {
      return 'Careful. Phantom rooms remember boasts for longer than most rooms.';
    }

    return undefined;
  }

  // --------------------------------------------------------------------------
  // Injection policy
  // --------------------------------------------------------------------------

  public evaluateInjection(
    context: LobbyRuntimeContext,
    kind: LobbyMessageKind,
    preferredChannel: LobbyVisibleChannel = 'LOBBY',
  ): LobbyInjectionDecision {
    const phase = inferScenePhase(context.readiness);

    if (phase === 'LOCKED' || phase === 'TRANSITIONING') {
      return {
        allow: false,
        targetChannel: preferredChannel,
        reason: 'COUNTDOWN_LOCK',
        coalesceWithPrevious: true,
        urgency: 'LOW',
        visibleToPlayer: false,
        queueShadowMarker: true,
      };
    }

    if (kind === 'HELPER_RESCUE') {
      return {
        allow: false,
        targetChannel: preferredChannel,
        reason: 'RESCUE_DISALLOWED',
        coalesceWithPrevious: false,
        urgency: 'LOW',
        visibleToPlayer: false,
        queueShadowMarker: true,
      };
    }

    if (kind === 'NEGOTIATION_OFFER' || kind === 'NEGOTIATION_COUNTER' || kind === 'DEAL_RECAP') {
      return {
        allow: false,
        targetChannel: preferredChannel,
        reason: 'NEGOTIATION_REDIRECT',
        coalesceWithPrevious: false,
        urgency: 'MEDIUM',
        visibleToPlayer: false,
        queueShadowMarker: true,
      };
    }

    if (kind === 'HATER_PUNISH' || kind === 'BOT_ATTACK' || kind === 'SHIELD_EVENT' || kind === 'CASCADE_ALERT') {
      return {
        allow: false,
        targetChannel: preferredChannel,
        reason: 'RUN_ONLY',
        coalesceWithPrevious: false,
        urgency: 'HIGH',
        visibleToPlayer: false,
        queueShadowMarker: true,
      };
    }

    if (context.presence.totalPresent <= 0 && kind !== 'SYSTEM') {
      return {
        allow: false,
        targetChannel: preferredChannel,
        reason: 'PRESENCE_LOW',
        coalesceWithPrevious: false,
        urgency: 'LOW',
        visibleToPlayer: false,
        queueShadowMarker: true,
      };
    }

    if (
      context.presence.humansTyping >= 2 &&
      (kind === 'NPC_AMBIENT' || kind === 'CROWD_REACTION' || kind === 'HELPER_PROMPT') &&
      !context.readiness.countdownActive
    ) {
      return {
        allow: false,
        targetChannel: preferredChannel,
        reason: 'TOO_NOISY',
        coalesceWithPrevious: true,
        urgency: 'LOW',
        visibleToPlayer: false,
        queueShadowMarker: true,
      };
    }

    const targetChannel = kind === 'WORLD_EVENT' ? 'GLOBAL' : preferredChannel;
    const urgency: LobbyInjectionDecision['urgency'] =
      kind === 'SYSTEM' || kind === 'WORLD_EVENT'
        ? 'MEDIUM'
        : kind === 'HATER_TELEGRAPH'
          ? 'MEDIUM'
          : 'LOW';

    return {
      allow: true,
      targetChannel,
      reason: 'ALLOWED',
      coalesceWithPrevious: kind === 'CROWD_REACTION' || kind === 'NPC_AMBIENT',
      urgency,
      visibleToPlayer: true,
      queueShadowMarker: false,
    };
  }

  // --------------------------------------------------------------------------
  // Countdown and stale-room orchestration
  // --------------------------------------------------------------------------

  public buildCountdownCue(context: LobbyRuntimeContext): LobbyCountdownCue {
    if (!context.readiness.countdownActive) {
      return {
        allowCue: false,
        messageBody: null,
        urgency: 'LOW',
        recommendedDelayMs: 0,
        stageMood: RUN_MODE_TO_LOBBY_TONE[context.runMode],
      };
    }

    const remaining = context.readiness.countdownRemainingMs;
    const seed = stableSeedFromContext(context);
    const line = chooseStable(LOBBY_COUNTDOWN_LINES, seed);

    if (remaining <= LOBBY_COUNTDOWN_HIGH_URGENCY_MS) {
      return {
        allowCue: true,
        messageBody: `${line} ${Math.ceil(remaining / 1000)}…`,
        urgency: 'HIGH',
        recommendedDelayMs: 0,
        stageMood: context.runMode === 'asymmetric-pvp' ? 'PREDATORY' : 'HOSTILE',
      };
    }

    if (remaining <= LOBBY_COUNTDOWN_MEDIUM_URGENCY_MS) {
      return {
        allowCue: true,
        messageBody: `${line} ${Math.ceil(remaining / 1000)} seconds.`,
        urgency: 'MEDIUM',
        recommendedDelayMs: 400,
        stageMood: context.runMode === 'co-op' ? 'CEREMONIAL' : 'TENSE',
      };
    }

    return {
      allowCue: true,
      messageBody: `${line}`,
      urgency: 'LOW',
      recommendedDelayMs: 700,
      stageMood: RUN_MODE_TO_LOBBY_TONE[context.runMode],
    };
  }

  public shouldEmitStaleRoomNotice(context: LobbyRuntimeContext): boolean {
    if (context.readiness.countdownActive) return false;
    if (context.readiness.state === 'LOCKED' || context.readiness.state === 'MATCHED') return false;
    if (context.telemetry.lastLobbyMessageAtMs <= 0) return false;
    return (context.nowMs - context.telemetry.lastLobbyMessageAtMs) >= LOBBY_STALE_ROOM_THRESHOLD_MS;
  }

  public buildStaleRoomNotice(context: LobbyRuntimeContext): LobbySystemNotice | null {
    if (!this.shouldEmitStaleRoomNotice(context)) {
      return null;
    }

    const body = chooseStable(LOBBY_STALE_ROOM_LINES, stableSeedFromContext(context));

    return {
      intent: 'ROOM_STALE',
      body,
      priority: 55,
      targetChannel: 'LOBBY',
      dedupeKey: `stale:${context.roomId ?? 'default'}:${context.runMode}`,
    };
  }

  // --------------------------------------------------------------------------
  // System notice synthesis
  // --------------------------------------------------------------------------

  public buildSystemWelcome(context: LobbyRuntimeContext): LobbySystemNotice {
    const bank = getModePhraseBank(context.runMode).welcome;
    const body = chooseStable(bank, stableSeedFromContext(context));

    return {
      intent: 'WELCOME',
      body,
      priority: 90,
      targetChannel: 'LOBBY',
      dedupeKey: `welcome:${context.runMode}:${context.playerId}`,
    };
  }

  public buildModeBriefingNotice(context: LobbyRuntimeContext): LobbySystemNotice {
    const [minPlayers, maxPlayers] = RUN_MODE_TO_PLAYER_RANGE[context.runMode];
    const body = context.runMode === 'solo'
      ? 'Empire briefing: isolated sovereign, personal mastery, no syndicate cover, no shared treasury.'
      : context.runMode === 'asymmetric-pvp'
        ? 'Predator briefing: shared pressure, split poise, exposed rhythm, and asymmetric rivalry surfaces.'
        : context.runMode === 'co-op'
          ? 'Syndicate briefing: shared treasury, role assignment, trust score, and live rescue logic once the run begins.'
          : 'Phantom briefing: legend markers, divergence pressure, and ghost-weighted memory across the run.';

    return {
      intent: 'MODE_BRIEFING',
      body: `${body} Players: ${minPlayers}-${maxPlayers}.`,
      priority: 70,
      targetChannel: 'LOBBY',
      dedupeKey: `briefing:${context.runMode}:${context.roomId ?? 'default'}`,
    };
  }

  public buildReadinessNotice(context: LobbyRuntimeContext): LobbySystemNotice {
    const readyPct = calculateReadyPct(context.readiness);
    const body = context.readiness.canStart
      ? `Readiness confirmed. ${context.readiness.readyPlayers}/${context.readiness.currentPlayers} set. Stand by for countdown.`
      : `Readiness at ${Math.round(readyPct)}%. ${context.readiness.readyPlayers}/${context.readiness.currentPlayers} set.`;

    return {
      intent: context.readiness.canStart ? 'PLAYER_READY' : 'PLAYER_NOT_READY',
      body,
      priority: context.readiness.canStart ? 80 : 58,
      targetChannel: 'LOBBY',
      dedupeKey: `ready:${context.roomId ?? 'default'}:${context.readiness.readyPlayers}:${context.readiness.currentPlayers}`,
    };
  }

  public buildQueueNotice(context: LobbyRuntimeContext): LobbySystemNotice | null {
    if (!context.inQueue) return null;

    const body = context.readiness.countdownActive
      ? 'Queue lock confirmed. The room is compressing into start state.'
      : `Queue live${context.queueRegion ? ` · ${context.queueRegion}` : ''}${context.queueBucket ? ` · ${context.queueBucket}` : ''}. Hold posture.`;

    return {
      intent: 'QUEUE_NOTICE',
      body,
      priority: 50,
      targetChannel: 'LOBBY',
      dedupeKey: `queue:${context.roomId ?? 'default'}:${context.queueRegion ?? 'none'}:${context.queueBucket ?? 'none'}`,
    };
  }

  public buildLegendNotice(context: LobbyRuntimeContext): LobbySystemNotice | null {
    if (!context.lastRunWasLegendary) return null;

    return {
      intent: 'PROOF_NOTICE',
      body: chooseStable(LOBBY_LEGEND_CALLBACK_LINES, stableSeedFromContext(context)),
      priority: 64,
      targetChannel: 'LOBBY',
      dedupeKey: `legend:${context.playerId}:${context.runMode}`,
    };
  }

  public buildCountdownNotice(context: LobbyRuntimeContext): LobbySystemNotice | null {
    const cue = this.buildCountdownCue(context);
    if (!cue.allowCue || !cue.messageBody) return null;

    return {
      intent: 'COUNTDOWN',
      body: cue.messageBody,
      priority: cue.urgency === 'HIGH' ? 95 : cue.urgency === 'MEDIUM' ? 80 : 68,
      targetChannel: 'LOBBY',
      dedupeKey: `countdown:${context.roomId ?? 'default'}:${Math.ceil(context.readiness.countdownRemainingMs / 1000)}`,
    };
  }

  public buildTransitionNotice(context: LobbyRuntimeContext): LobbySystemNotice | null {
    const phase = inferScenePhase(context.readiness);
    if (phase !== 'TRANSITIONING' && phase !== 'LOCKED') return null;

    return {
      intent: 'TRANSITION',
      body: 'Lobby state sealed. Routing into authoritative run surfaces now.',
      priority: 99,
      targetChannel: 'LOBBY',
      dedupeKey: `transition:${context.roomId ?? 'default'}:${context.runMode}`,
    };
  }

  public buildAllSystemNotices(context: LobbyRuntimeContext): LobbySystemNotice[] {
    const notices: LobbySystemNotice[] = [];
    notices.push(this.buildSystemWelcome(context));
    notices.push(this.buildModeBriefingNotice(context));
    notices.push(this.buildReadinessNotice(context));

    const queueNotice = this.buildQueueNotice(context);
    if (queueNotice) notices.push(queueNotice);

    const legendNotice = this.buildLegendNotice(context);
    if (legendNotice) notices.push(legendNotice);

    const staleNotice = this.buildStaleRoomNotice(context);
    if (staleNotice) notices.push(staleNotice);

    const countdown = this.buildCountdownNotice(context);
    if (countdown) notices.push(countdown);

    const transition = this.buildTransitionNotice(context);
    if (transition) notices.push(transition);

    return notices.sort((a, b) => b.priority - a.priority);
  }

  // --------------------------------------------------------------------------
  // NPC staging and pre-run dramaturgy
  // --------------------------------------------------------------------------

  public buildAmbientNpcPrompt(context: LobbyRuntimeContext): LobbyNpcPrompt | null {
    if (!this.allowNpcInjection(context, inferScenePhase(context.readiness))) {
      return null;
    }

    const body = chooseStable(getModePhraseBank(context.runMode).welcome, stableSeedFromContext(context) + 17);
    return {
      intent: 'AMBIENT_WELCOME',
      body,
      targetChannel: 'LOBBY',
      priority: 52,
      speakerRole: 'AMBIENT_WATCHER',
      recommendedDelayMs: 600,
      suppressIfHumansActive: false,
    };
  }

  public buildHelperOrientationPrompt(context: LobbyRuntimeContext): LobbyNpcPrompt | null {
    if (!this.allowNpcInjection(context, inferScenePhase(context.readiness))) {
      return null;
    }

    if (context.presence.helperPresent <= 0 && context.runMode !== 'solo') {
      return null;
    }

    const body = chooseStable(getModePhraseBank(context.runMode).helper, stableSeedFromContext(context) + 31);
    return {
      intent: 'HELPER_ORIENTATION',
      body,
      targetChannel: 'LOBBY',
      priority: 57,
      speakerRole: 'HELPER_GUIDE',
      recommendedDelayMs: context.readiness.countdownActive ? 350 : 900,
      suppressIfHumansActive: context.presence.humansTyping >= 2,
    };
  }

  public buildHaterSizeUpPrompt(context: LobbyRuntimeContext): LobbyNpcPrompt | null {
    if (!this.allowNpcInjection(context, inferScenePhase(context.readiness))) {
      return null;
    }

    if (context.runMode === 'co-op') {
      // Co-op lobby can carry threat atmosphere, but hard sizing taunts are toned
      // down so trust formation is not drowned before the run.
      if (context.crowdHeat !== undefined && context.crowdHeat < 50) {
        return null;
      }
    }

    const body = chooseStable(getModePhraseBank(context.runMode).hater, stableSeedFromContext(context) + 49);
    return {
      intent: 'SIZE_UP',
      body,
      targetChannel: context.runMode === 'asymmetric-pvp' ? 'GLOBAL' : 'LOBBY',
      priority: context.runMode === 'asymmetric-pvp' ? 66 : 50,
      speakerRole: 'HATER_BOT',
      recommendedDelayMs: context.runMode === 'asymmetric-pvp' ? 350 : 1_100,
      suppressIfHumansActive: context.runMode !== 'asymmetric-pvp',
    };
  }

  public buildCrowdReactionPrompt(context: LobbyRuntimeContext): LobbyNpcPrompt | null {
    const crowd = calculateCrowdHeat(context);
    if (!crowd.allowCrowdBursts) return null;

    const body = context.runMode === 'co-op'
      ? 'Room reads disciplined. Keep it clean and declare roles.'
      : context.runMode === 'asymmetric-pvp'
        ? 'The room smells blood and overstatement.'
        : context.runMode === 'ghost'
          ? 'Witnesses waking. The room is remembering.'
          : 'The room is warming. Stay measured.';

    return {
      intent: 'CROWD_HEAT',
      body,
      targetChannel: crowd.band === 'SURGING' ? 'GLOBAL' : 'LOBBY',
      priority: crowd.band === 'SURGING' ? 62 : 45,
      speakerRole: 'CROWD_VOICE',
      recommendedDelayMs: crowd.band === 'SURGING' ? 250 : 900,
      suppressIfHumansActive: false,
    };
  }

  public buildQueueStaleNpcPrompt(context: LobbyRuntimeContext): LobbyNpcPrompt | null {
    if (!this.shouldEmitStaleRoomNotice(context)) return null;

    return {
      intent: 'QUEUE_STALE',
      body: 'The room is dragging. Somebody anchor it or accept drift.',
      targetChannel: 'LOBBY',
      priority: 46,
      speakerRole: 'AMBIENT_WATCHER',
      recommendedDelayMs: 1_200,
      suppressIfHumansActive: false,
    };
  }

  public buildCountdownNpcPrompt(context: LobbyRuntimeContext): LobbyNpcPrompt | null {
    if (!context.readiness.countdownActive) return null;

    return {
      intent: 'COUNTDOWN_PUSH',
      body: 'Final posture. Final signal. Then the room becomes consequence.',
      targetChannel: 'LOBBY',
      priority: 78,
      speakerRole: context.runMode === 'asymmetric-pvp' ? 'HATER_BOT' : 'HELPER_GUIDE',
      recommendedDelayMs: 300,
      suppressIfHumansActive: false,
    };
  }

  public buildLegendCallbackPrompt(context: LobbyRuntimeContext): LobbyNpcPrompt | null {
    if (!context.lastRunWasLegendary) return null;

    return {
      intent: 'LEGEND_CALLBACK',
      body: chooseStable(LOBBY_LEGEND_CALLBACK_LINES, stableSeedFromContext(context) + 73),
      targetChannel: 'LOBBY',
      priority: 60,
      speakerRole: 'AMBIENT_WATCHER',
      recommendedDelayMs: 800,
      suppressIfHumansActive: false,
    };
  }

  public buildAllNpcPrompts(context: LobbyRuntimeContext): LobbyNpcPrompt[] {
    const prompts: LobbyNpcPrompt[] = [];

    const ambient = this.buildAmbientNpcPrompt(context);
    if (ambient) prompts.push(ambient);

    const helper = this.buildHelperOrientationPrompt(context);
    if (helper) prompts.push(helper);

    const hater = this.buildHaterSizeUpPrompt(context);
    if (hater) prompts.push(hater);

    const crowd = this.buildCrowdReactionPrompt(context);
    if (crowd) prompts.push(crowd);

    const stale = this.buildQueueStaleNpcPrompt(context);
    if (stale) prompts.push(stale);

    const countdown = this.buildCountdownNpcPrompt(context);
    if (countdown) prompts.push(countdown);

    const legend = this.buildLegendCallbackPrompt(context);
    if (legend) prompts.push(legend);

    return prompts.sort((a, b) => b.priority - a.priority);
  }

  // --------------------------------------------------------------------------
  // Mode-native policy details
  // --------------------------------------------------------------------------

  public getModeDescription(runMode: FrontendRunMode): string {
    switch (runMode) {
      case 'solo':
        return 'The isolated sovereign. Pre-run loadout, isolation tax, and personal mastery begin with quiet preparation.';
      case 'asymmetric-pvp':
        return 'Shared deck, battle budget, extractions, counters, psyche pressure, and rivalry surfaces.';
      case 'co-op':
        return 'Shared treasury, role assignment, trust score, war alerts, aid windows, and authored betrayal.';
      case 'ghost':
        return 'Legend markers, divergence scoring, challenger stack, and decay-weighted ghost pressure.';
      default: {
        const exhaustive: never = runMode;
        return exhaustive;
      }
    }
  }

  public getModeLobbyLaws(runMode: FrontendRunMode): readonly string[] {
    switch (runMode) {
      case 'solo':
        return Object.freeze([
          'Solo lobby prioritizes orientation over volume.',
          'Empire warmup suppresses crowd pile-on unless heat legitimately rises.',
          'Helpers may suggest foundation sequencing before the run.',
          'Haters may size up the player without triggering actual punishment.',
          'Global mirroring remains soft because solo still benefits from witness energy.',
        ]);
      case 'asymmetric-pvp':
        return Object.freeze([
          'Predator lobby allows sharper posture signaling than other lobbies.',
          'Trash talk is allowed, but soft-normalized away from unreadable shouting.',
          'Hater size-up is more visible because intimidation is part of the pre-run field.',
          'Crowd heat can burst into GLOBAL faster than other modes.',
          'Do not resolve negotiation or proof-chain terms in the lobby warmup lane.',
        ]);
      case 'co-op':
        return Object.freeze([
          'Syndicate lobby prioritizes role clarity, readiness, and trust formation.',
          'Trust drift is a real pre-run cost, so stale-room notices matter more.',
          'Helpers are more welcome here than pure haters during warmup.',
          'Crowd theatrics stay below clarity and coordination.',
          'Role, treasury, and aid language are allowed. Exact deal terms are still deferred.',
        ]);
      case 'ghost':
        return Object.freeze([
          'Phantom lobby allows more legend callbacks and historical weight.',
          'The room may feel ceremonial even before countdown if prior run memory is strong.',
          'Flexing is riskier because ghost rooms remember boasts longer.',
          'Ambient witness language matters more than ordinary crowd chatter.',
          'The lobby exists to sharpen divergence, not to induce imitation panic.',
        ]);
      default: {
        const exhaustive: never = runMode;
        return exhaustive;
      }
    }
  }

  public getComposerHints(runMode: FrontendRunMode): readonly string[] {
    switch (runMode) {
      case 'solo':
        return Object.freeze([
          'Ask sharp, specific questions.',
          'Signal composure, not panic.',
          'Do not confuse hype with readiness.',
        ]);
      case 'asymmetric-pvp':
        return Object.freeze([
          'Poise lands harder than noise.',
          'Reveal less than you think you are revealing.',
          'Do not hand your rival your rhythm for free.',
        ]);
      case 'co-op':
        return Object.freeze([
          'State your role preference.',
          'Declare readiness clearly.',
          'Align on shield, treasury, or rescue coverage before the countdown.',
        ]);
      case 'ghost':
        return Object.freeze([
          'Respect the legend without shrinking into it.',
          'Use memory as context, not as a cage.',
          'Ask about divergence, not imitation.',
        ]);
      default: {
        const exhaustive: never = runMode;
        return exhaustive;
      }
    }
  }

  public getNpcCadenceWindow(runMode: FrontendRunMode): {
    readonly minDelayMs: number;
    readonly maxDelayMs: number;
  } {
    switch (runMode) {
      case 'solo':
        return { minDelayMs: 900, maxDelayMs: 2_800 };
      case 'asymmetric-pvp':
        return { minDelayMs: 350, maxDelayMs: 1_800 };
      case 'co-op':
        return { minDelayMs: 700, maxDelayMs: 2_200 };
      case 'ghost':
        return { minDelayMs: 650, maxDelayMs: 2_400 };
      default: {
        const exhaustive: never = runMode;
        return exhaustive;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Notification and unread policy
  // --------------------------------------------------------------------------

  public shouldIncrementUnread(
    activeChannel: LobbyVisibleChannel,
    arrivingChannel: LobbyVisibleChannel,
    kind: LobbyMessageKind,
  ): boolean {
    if (activeChannel === arrivingChannel) return false;
    if (kind === 'CROWD_REACTION' && arrivingChannel === 'GLOBAL') return false;
    return true;
  }

  public shouldRaiseToast(
    context: LobbyRuntimeContext,
    kind: LobbyMessageKind,
    arrivingChannel: LobbyVisibleChannel,
  ): boolean {
    if (kind === 'CROWD_REACTION') return false;
    if (kind === 'NPC_AMBIENT' && context.presence.humansTyping > 0) return false;
    if (kind === 'HELPER_RESCUE') return false;
    if (arrivingChannel === 'GLOBAL' && context.selectedChannel === 'LOBBY' && kind === 'WORLD_EVENT') return true;
    if (kind === 'SYSTEM' && context.readiness.countdownActive) return true;
    return kind === 'HATER_TELEGRAPH' || kind === 'LEGEND_MOMENT';
  }

  // --------------------------------------------------------------------------
  // Routing, mirror, and fallback rules
  // --------------------------------------------------------------------------

  public shouldMirrorLobbyNoticeToGlobal(
    context: LobbyRuntimeContext,
    notice: LobbySystemNotice,
  ): boolean {
    if (!(context.allowGlobalFallback ?? true)) return false;
    if (notice.intent === 'WELCOME') return false;
    if (notice.intent === 'COUNTDOWN') return context.runMode === 'asymmetric-pvp';
    if (notice.intent === 'QUEUE_NOTICE') return context.runMode === 'asymmetric-pvp';
    if (notice.intent === 'ROOM_STALE') return false;
    return notice.intent === 'TRANSITION';
  }

  public shouldMirrorNpcPromptToGlobal(
    context: LobbyRuntimeContext,
    prompt: LobbyNpcPrompt,
  ): boolean {
    if (!(context.allowGlobalFallback ?? true)) return false;
    if (prompt.intent === 'CROWD_HEAT') return true;
    if (prompt.intent === 'SIZE_UP') return context.runMode === 'asymmetric-pvp';
    return false;
  }

  // --------------------------------------------------------------------------
  // Public composite helpers — easiest integration points for higher modules
  // --------------------------------------------------------------------------

  public synthesizeLobbyOpenPackage(context: LobbyRuntimeContext): {
    readonly snapshot: LobbyPolicySnapshot;
    readonly systemNotices: readonly LobbySystemNotice[];
    readonly npcPrompts: readonly LobbyNpcPrompt[];
    readonly modeDescription: string;
    readonly modeLaws: readonly string[];
    readonly composerHints: readonly string[];
  } {
    return {
      snapshot: this.createSnapshot(context),
      systemNotices: this.buildAllSystemNotices(context),
      npcPrompts: this.buildAllNpcPrompts(context),
      modeDescription: this.getModeDescription(context.runMode),
      modeLaws: this.getModeLobbyLaws(context.runMode),
      composerHints: this.getComposerHints(context.runMode),
    };
  }

  public synthesizeLobbyRefreshPackage(context: LobbyRuntimeContext): {
    readonly snapshot: LobbyPolicySnapshot;
    readonly countdownNotice: LobbySystemNotice | null;
    readonly staleNotice: LobbySystemNotice | null;
    readonly transitionNotice: LobbySystemNotice | null;
    readonly countdownNpcPrompt: LobbyNpcPrompt | null;
    readonly staleNpcPrompt: LobbyNpcPrompt | null;
    readonly crowdPrompt: LobbyNpcPrompt | null;
  } {
    return {
      snapshot: this.createSnapshot(context),
      countdownNotice: this.buildCountdownNotice(context),
      staleNotice: this.buildStaleRoomNotice(context),
      transitionNotice: this.buildTransitionNotice(context),
      countdownNpcPrompt: this.buildCountdownNpcPrompt(context),
      staleNpcPrompt: this.buildQueueStaleNpcPrompt(context),
      crowdPrompt: this.buildCrowdReactionPrompt(context),
    };
  }

  // --------------------------------------------------------------------------
  // Introspection surface — useful for tests, dashboards, and policy explainers
  // --------------------------------------------------------------------------

  public explain(context: LobbyRuntimeContext): Record<string, unknown> {
    const snapshot = this.createSnapshot(context);
    return {
      id: this.id,
      family: this.family,
      runMode: context.runMode,
      modeCode: context.modeCode,
      stagePhase: snapshot.stagePhase,
      stageMood: snapshot.stageMood,
      allowedVisibleChannels: snapshot.allowedVisibleChannels,
      crowdHeat: snapshot.crowdHeat,
      presence: snapshot.presence,
      prompt: snapshot.prompt,
      transcriptBudget: snapshot.transcriptBudget,
      readiness: context.readiness,
      laws: LOBBY_LAWS,
      modeLaws: this.getModeLobbyLaws(context.runMode),
      modeDescription: this.getModeDescription(context.runMode),
      composerHints: this.getComposerHints(context.runMode),
      npcCadenceWindow: this.getNpcCadenceWindow(context.runMode),
    };
  }
}

// ============================================================================
// MARK: Exported singleton
// ============================================================================

export const lobbyChannelPolicy = new LobbyChannelPolicy();

// ============================================================================
// MARK: Pure utility exports for tests and adapter consumers
// ============================================================================

export function createLobbyReadinessSnapshot(input: Partial<LobbyReadinessSnapshot> = {}): LobbyReadinessSnapshot {
  const runMode = 'runMode' in input
    ? undefined
    : undefined;
  void runMode;

  const currentPlayers = input.currentPlayers ?? 1;
  const readyPlayers = clamp(input.readyPlayers ?? 0, 0, currentPlayers);
  const readyPct = input.readyPct ?? clamp((readyPlayers / Math.max(currentPlayers, 1)) * 100, 0, 100);

  return {
    state: input.state ?? 'WAITING',
    requiredPlayersMin: input.requiredPlayersMin ?? 1,
    requiredPlayersMax: input.requiredPlayersMax ?? 1,
    currentPlayers,
    humanPlayers: input.humanPlayers ?? currentPlayers,
    readyPlayers,
    readyPct,
    canStart: input.canStart ?? readyPlayers >= (input.requiredPlayersMin ?? 1),
    countdownActive: input.countdownActive ?? false,
    countdownRemainingMs: input.countdownRemainingMs ?? 0,
    queueWaitMs: input.queueWaitMs ?? 0,
    staleRoom: input.staleRoom ?? false,
    formationComplete: input.formationComplete ?? currentPlayers >= (input.requiredPlayersMin ?? 1),
    modeCode: input.modeCode ?? 'empire',
  };
}

export function createLobbyPresenceSnapshot(input: Partial<LobbyPresenceSnapshot> = {}): LobbyPresenceSnapshot {
  return {
    selfPresent: input.selfPresent ?? true,
    totalPresent: input.totalPresent ?? 1,
    humanPresent: input.humanPresent ?? 1,
    helperPresent: input.helperPresent ?? 1,
    ambientNpcPresent: input.ambientNpcPresent ?? 1,
    haterPresent: input.haterPresent ?? 1,
    spectatorsVisible: input.spectatorsVisible ?? 0,
    teammatesReady: input.teammatesReady ?? 0,
    opponentsReady: input.opponentsReady ?? 0,
    humansTyping: input.humansTyping ?? 0,
    npcsTyping: input.npcsTyping ?? 0,
  };
}

export function createLobbyTelemetrySnapshot(input: Partial<LobbyTelemetrySnapshot> = {}): LobbyTelemetrySnapshot {
  return {
    openedAtMs: input.openedAtMs ?? 0,
    lastInteractionAtMs: input.lastInteractionAtMs ?? 0,
    lastLobbyMessageAtMs: input.lastLobbyMessageAtMs ?? 0,
    localMessagesSent: input.localMessagesSent ?? 0,
    localMessagesBlocked: input.localMessagesBlocked ?? 0,
    totalMessagesObserved: input.totalMessagesObserved ?? 0,
    lobbyMessagesObserved: input.lobbyMessagesObserved ?? 0,
    globalMessagesObserved: input.globalMessagesObserved ?? 0,
    unreadLobby: input.unreadLobby ?? 0,
    unreadGlobal: input.unreadGlobal ?? 0,
    modeChanges: input.modeChanges ?? 0,
    tabSwitches: input.tabSwitches ?? 0,
    readyToggles: input.readyToggles ?? 0,
    queueJoins: input.queueJoins ?? 0,
    queueLeaves: input.queueLeaves ?? 0,
  };
}

export function createLobbyRuntimeContext(
  input: Partial<LobbyRuntimeContext> = {},
): LobbyRuntimeContext {
  const runMode: FrontendRunMode = input.runMode ?? 'solo';
  const modeCode = input.modeCode ?? RUN_MODE_TO_MODE_CODE[runMode];
  const [minPlayers, maxPlayers] = RUN_MODE_TO_PLAYER_RANGE[runMode];

  return {
    runMode,
    modeCode,
    mountTarget: input.mountTarget ?? 'LOBBY_SCREEN',
    nowMs: input.nowMs ?? Date.now(),
    playerId: input.playerId ?? 'player-local',
    playerName: input.playerName ?? 'You',
    playerRank: input.playerRank ?? 'You',
    playerCord: input.playerCord,
    pressureTier: input.pressureTier,
    tickTier: input.tickTier,
    selectedChannel: input.selectedChannel ?? 'LOBBY',
    presence: input.presence ?? createLobbyPresenceSnapshot({
      totalPresent: runMode === 'co-op' ? 3 : runMode === 'asymmetric-pvp' ? 2 : 1,
      humanPresent: runMode === 'co-op' ? 2 : 1,
      helperPresent: 1,
      ambientNpcPresent: 1,
      haterPresent: runMode === 'co-op' ? 0 : 1,
    }),
    readiness: input.readiness ?? createLobbyReadinessSnapshot({
      requiredPlayersMin: minPlayers,
      requiredPlayersMax: maxPlayers,
      currentPlayers: minPlayers,
      humanPlayers: minPlayers,
      readyPlayers: runMode === 'solo' || runMode === 'ghost' ? 1 : 0,
      readyPct: runMode === 'solo' || runMode === 'ghost' ? 100 : 0,
      canStart: runMode === 'solo' || runMode === 'ghost',
      modeCode,
    }),
    telemetry: input.telemetry ?? createLobbyTelemetrySnapshot(),
    roomId: input.roomId ?? 'lobby-room-default',
    syndicateId: input.syndicateId,
    inQueue: input.inQueue ?? false,
    queueRegion: input.queueRegion,
    queueBucket: input.queueBucket,
    mutedNpcIds: input.mutedNpcIds ?? [],
    blockedHandles: input.blockedHandles ?? [],
    historicalBestNetWorth: input.historicalBestNetWorth,
    historicalSovereigntyRate: input.historicalSovereigntyRate,
    lastRunOutcome: input.lastRunOutcome ?? null,
    lastRunWasLegendary: input.lastRunWasLegendary ?? false,
    relationshipHeat: input.relationshipHeat,
    crowdHeat: input.crowdHeat,
    allowGlobalFallback: input.allowGlobalFallback ?? true,
  };
}
