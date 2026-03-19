/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT RAGE-QUIT INTERCEPTOR
 * FILE: pzo-web/src/engines/chat/rescue/RageQuitInterceptor.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend detection and rescue orchestration for disengagement risk.
 *
 * This file is not a generic UX helper. It is a repo-aware rescue lane that:
 * - watches the same chat runtime surfaces the rest of the frontend engine uses,
 * - interprets pressure, silence, panel behavior, failure chains, and channel hopping,
 * - converts those into shared rescue contracts,
 * - preserves room/channel/scene continuity,
 * - leaves backend transcript truth and long-term enforcement authority intact.
 *
 * Design doctrine
 * ---------------
 * - Rescue is not pity. Rescue is retention-grade tactical timing.
 * - Silence is sometimes the right intervention. Spam never is.
 * - The first rescue offer should feel timely, not needy.
 * - The player must feel seen without feeling handled.
 * - Rescue logic must respect channel mood, crowd heat, and active boss windows.
 * - Public intervention is expensive; private intervention is cheaper; shadow
 *   intervention is often the best default.
 * ============================================================================
 */

import {
  DEFAULT_CHAT_RESCUE_GUARDRAIL,
  buildRescuePlan,
  deriveRescueTriggerCandidates,
  createRescueWindow,
  deriveRescueDigest,
  deriveRescueStateSnapshot,
  deriveRescueTilt01,
  type ChatRescueActor,
  type ChatRescueDigest,
  type ChatRescueGuardrail,
  type ChatRescueHelperPosture,
  type ChatRescueLedgerEntry,
  type ChatRescueOffer,
  type ChatRescueOutcome,
  type ChatRescuePlan,
  type ChatRescueReasonCode,
  type ChatRescueSignalVector,
  type ChatRescueStateSnapshot,
  type ChatRescueStyle,
  type ChatRescueTelemetrySnapshot,
  type ChatRescueTriggerKind,
  type ChatRescueUrgencyBand,
  type ChatRescueWindow,
} from '../../../../shared/contracts/chat/ChatRescue';
import {
  buildRecoveryPlan,
  type ChatRecoveryPlan,
} from '../../../../shared/contracts/chat/ChatRecovery';
import type {
  ChatAffectSnapshot,
  ChatEngineState,
  ChatFeatureSnapshot,
  ChatLearningProfile,
  ChatLiveOpsState,
  ChatReputationState,
  ChatRelationshipState,
  ChatRescueDecision,
  ChatScenePlan,
  ChatSilenceDecision,
  ChatVisibleChannel,
  JsonObject,
  Nullable,
  PressureTier,
  Score100,
  TickTier,
  UnixMs,
} from '../types';

// ============================================================================
// MARK: Local event and snapshot contracts
// ============================================================================

export type RageQuitSignalKind =
  | 'PANEL_OPEN'
  | 'PANEL_CLOSE'
  | 'COMPOSER_FOCUS'
  | 'COMPOSER_BLUR'
  | 'COMPOSER_ABORT'
  | 'SEND_ATTEMPT'
  | 'SEND_FAILURE'
  | 'SEND_SUCCESS'
  | 'CHANNEL_SWITCH'
  | 'COUNTER_WINDOW_OPEN'
  | 'COUNTER_WINDOW_CLOSE'
  | 'BOSS_WINDOW_OPEN'
  | 'BOSS_WINDOW_CLOSE'
  | 'READ_PRESSURE'
  | 'SENTIMENT_DROP'
  | 'LONG_SILENCE'
  | 'EXTERNAL_NOTE';

export interface RageQuitSignalEvent {
  readonly kind: RageQuitSignalKind;
  readonly at: UnixMs;
  readonly visibleChannel: ChatVisibleChannel;
  readonly payload?: JsonObject;
}

export interface RageQuitPlayerSnapshot {
  readonly userId: string;
  readonly displayName: string;
  readonly rank?: string;
}

export interface RageQuitRuntimeFrame {
  readonly now: UnixMs;
  readonly state: Readonly<ChatEngineState>;
  readonly feature: ChatFeatureSnapshot;
  readonly affect: ChatAffectSnapshot;
  readonly learning: ChatLearningProfile;
  readonly reputation: ChatReputationState;
  readonly visibleChannel: ChatVisibleChannel;
  readonly pressureTier: PressureTier;
  readonly tickTier?: TickTier;
  readonly liveOps?: ChatLiveOpsState | null;
  readonly roomId: string;
  readonly channelId: string;
  readonly sessionId?: string | null;
  readonly requestId?: string | null;
  readonly sceneId?: string | null;
  readonly momentId?: string | null;
  readonly bossFightId?: string | null;
  readonly helperActor?: ChatRescueActor | null;
  readonly player: RageQuitPlayerSnapshot;
}

export interface RageQuitInterceptCandidate {
  readonly plan: ChatRescuePlan;
  readonly recovery: ChatRecoveryPlan;
  readonly window: ChatRescueWindow;
  readonly stateSnapshot: ChatRescueStateSnapshot;
  readonly signalSummary: readonly ChatRescueSignalVector[];
  readonly confidenceScore: Score100;
  readonly shouldInterruptScene: boolean;
  readonly prefersSilence: boolean;
  readonly silenceDecision?: ChatSilenceDecision | null;
  readonly replacementScene?: ChatScenePlan | null;
}

export interface RageQuitInterceptResult {
  readonly candidate?: RageQuitInterceptCandidate | null;
  readonly decision?: ChatRescueDecision | null;
  readonly digest: ChatRescueDigest;
  readonly updatedStateSnapshot?: ChatRescueStateSnapshot | null;
  readonly activePlan?: ChatRescuePlan | null;
  readonly activeRecovery?: ChatRecoveryPlan | null;
  readonly reasons: readonly string[];
}

export interface RageQuitInterceptorSnapshot {
  readonly activePlan?: ChatRescuePlan | null;
  readonly activeRecovery?: ChatRecoveryPlan | null;
  readonly activeWindow?: ChatRescueWindow | null;
  readonly stateSnapshot?: ChatRescueStateSnapshot | null;
  readonly digest: ChatRescueDigest;
  readonly panelToggleBurstCount: number;
  readonly channelHopBurstCount: number;
  readonly composerAbortStreak: number;
  readonly consecutiveFailedActions: number;
  readonly silenceMs: number;
  readonly lastVisibleChannel: ChatVisibleChannel;
  readonly updatedAt: UnixMs;
}

export interface RageQuitInterceptorOptions {
  readonly guardrail?: ChatRescueGuardrail;
  readonly telemetryWindowMs?: number;
  readonly maxRecentSignals?: number;
  readonly minMsBetweenRescues?: number;
  readonly maxActiveRescueMs?: number;
  readonly preferShadowRescueWhenEmbarrassmentAbove?: Score100;
  readonly directRescueAtPressure?: readonly PressureTier[];
  readonly helperNames?: Partial<Record<ChatRescueHelperPosture | 'DEFAULT', string>>;
}

interface InternalBurstCounter {
  readonly label: string;
  count: number;
  lastAt: UnixMs;
}

interface InternalChannelHopEntry {
  readonly at: UnixMs;
  readonly from: ChatVisibleChannel;
  readonly to: ChatVisibleChannel;
}

interface InternalReadPressureSample {
  readonly at: UnixMs;
  readonly value01: number;
}

interface InternalNote {
  readonly at: UnixMs;
  readonly body: string;
}

// ============================================================================
// MARK: Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<RageQuitInterceptorOptions, 'helperNames'>> = {
  guardrail: DEFAULT_CHAT_RESCUE_GUARDRAIL,
  telemetryWindowMs: 45_000,
  maxRecentSignals: 128,
  minMsBetweenRescues: 9_000,
  maxActiveRescueMs: 40_000,
  preferShadowRescueWhenEmbarrassmentAbove: 74 as Score100,
  directRescueAtPressure: ['HIGH', 'CRITICAL'],
};

const DEFAULT_HELPER_NAMES: Record<ChatRescueHelperPosture | 'DEFAULT', string> = {
  NONE: 'SYSTEM',
  READY: 'Kade',
  ACTIVE: 'Kade',
  ESCALATED: 'Nyra',
  SHADOWING: 'Observer',
  DEFAULT: 'Kade',
};

const SCENE_INTERRUPT_TRIGGER_KINDS: readonly ChatRescueTriggerKind[] = [
  'POST_COLLAPSE_FREEZE',
  'DEAL_ROOM_PANIC',
  'BOSS_FIGHT_BREAKPOINT',
  'FAILED_ACTION_CHAIN',
];

const SILENCE_FIRST_TRIGGER_KINDS: readonly ChatRescueTriggerKind[] = [
  'LONG_SILENCE',
  'SHAME_SPIKE',
  'SENTIMENT_DROP',
  'HELPER_IGNORED_THEN_RETURNED',
];

const REASON_PRIORITY: readonly ChatRescueReasonCode[] = [
  'PLAYER_FROZE_AFTER_COLLAPSE',
  'PLAYER_ABORTING_INPUT',
  'PLAYER_FAILING_REPEATEDLY',
  'PLAYER_PANIC_IN_DEAL_ROOM',
  'PLAYER_PUBLICLY_EXPOSED',
  'PLAYER_COUNTER_WINDOW_OVERWHELMED',
  'PLAYER_SOCIAL_SHAME_SPIKE',
  'PLAYER_PANEL_FLAPPING',
  'PLAYER_CHANNEL_HOPPING',
  'PLAYER_LONG_SILENCE',
];

const LIVEOPS_ESCALATORS = new Set([
  'helper_blackout',
  'double_heat',
  'raid',
  'whisper_only',
]);

const RESCUE_NOTES_BY_TRIGGER: Readonly<Record<ChatRescueTriggerKind, readonly string[]>> = {
  LONG_SILENCE: ['Use quiet intervention first.', 'Treat silence as information, not absence.'],
  FAILED_ACTION_CHAIN: ['Reduce mechanical burden.', 'Offer one-card recovery before long explanation.'],
  SENTIMENT_DROP: ['Lower tone.', 'Avoid crowd-facing rescue unless demanded by urgency.'],
  PANEL_FLAPPING: ['Stabilize UI pressure.', 'Do not stack banners across mounts.'],
  CHANNEL_HOPPING: ['Presume embarrassment or escape behavior.', 'Prefer private reroute.'],
  DEAL_ROOM_PANIC: ['Protect negotiation dignity.', 'Do not inject noisy global copy.'],
  COMPOSER_ABORT_STREAK: ['Player wants out.', 'Offer direct exit or quick reset.'],
  POST_COLLAPSE_FREEZE: ['Collapse needs witness plus path.', 'Helper can lead here.'],
  TELEGRAPH_LOCK: ['Convert fear into readable action.', 'Show only one next move.'],
  SHAME_SPIKE: ['Public rescue can worsen outcome.', 'Shadow first, banner second.'],
  HELPER_IGNORED_THEN_RETURNED: ['Return calmly.', 'Do not shame the player for earlier refusal.'],
  BOSS_FIGHT_BREAKPOINT: ['Preserve counter readability.', 'Do not overtalk the combat lane.'],
};

const STYLE_NOTES: Readonly<Record<ChatRescueStyle, readonly string[]>> = {
  QUIET: ['Short copy.', 'Private surface.', 'Respect breath window.'],
  CALM: ['Helper tone.', 'Do not intensify crowd heat.'],
  TACTICAL: ['Next step first.', 'Compact verbs beat reassurance.'],
  DIRECTIVE: ['One actionable move.', 'Low ambiguity.'],
  BLUNT: ['Use when time and confidence collapse.', 'No insult; only forceful clarity.'],
  PROTECTIVE: ['Reduce social exposure.', 'Helper shields before advising.'],
};

const HELPER_POSTURE_PRIORITY: readonly ChatRescueHelperPosture[] = [
  'ACTIVE',
  'ESCALATED',
  'READY',
  'SHADOWING',
  'NONE',
];

const EXTERNAL_REASON_MAP: Readonly<Record<RageQuitSignalKind, string>> = {
  PANEL_OPEN: 'panel-opened',
  PANEL_CLOSE: 'panel-closed',
  COMPOSER_FOCUS: 'composer-focused',
  COMPOSER_BLUR: 'composer-blurred',
  COMPOSER_ABORT: 'composer-aborted',
  SEND_ATTEMPT: 'send-attempt',
  SEND_FAILURE: 'send-failure',
  SEND_SUCCESS: 'send-success',
  CHANNEL_SWITCH: 'channel-switched',
  COUNTER_WINDOW_OPEN: 'counter-window-open',
  COUNTER_WINDOW_CLOSE: 'counter-window-close',
  BOSS_WINDOW_OPEN: 'boss-window-open',
  BOSS_WINDOW_CLOSE: 'boss-window-close',
  READ_PRESSURE: 'read-pressure',
  SENTIMENT_DROP: 'sentiment-drop',
  LONG_SILENCE: 'long-silence',
  EXTERNAL_NOTE: 'external-note',
};

// ============================================================================
// MARK: Utilities
// ============================================================================

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function clamp100(value: number): Score100 {
  if (!Number.isFinite(value)) return 0 as Score100;
  if (value <= 0) return 0 as Score100;
  if (value >= 100) return 100 as Score100;
  return Math.round(value) as Score100;
}

function nowSeed(now: UnixMs): string {
  return String(Number(now));
}

function boolFlag(value: unknown): boolean {
  return value === true;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sortedPostures(
  preferred: ChatRescueHelperPosture | null | undefined,
): readonly ChatRescueHelperPosture[] {
  if (!preferred) return HELPER_POSTURE_PRIORITY;
  return [preferred, ...HELPER_POSTURE_PRIORITY.filter((item) => item !== preferred)];
}

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latest<T extends { readonly at: UnixMs }>(items: readonly T[]): T | null {
  return items.length ? items[items.length - 1] : null;
}

function trimWindow<T extends { readonly at: UnixMs }>(items: readonly T[], now: UnixMs, windowMs: number, max: number): readonly T[] {
  const min = Number(now) - windowMs;
  const filtered = items.filter((item) => Number(item.at) >= min);
  return filtered.length > max ? filtered.slice(filtered.length - max) : filtered;
}

function buildPlayerActor(snapshot: RageQuitPlayerSnapshot): ChatRescueActor {
  return {
    actorId: snapshot.userId as never,
    actorKind: 'PLAYER',
    role: 'PLAYER',
    displayName: snapshot.displayName,
    relationshipId: null,
    relationshipStance: null,
    objective: null,
  };
}

function deriveHelperPosture(
  helperActor: ChatRescueActor | null | undefined,
  affect: ChatAffectSnapshot,
  pressureTier: PressureTier,
): ChatRescueHelperPosture {
  if (!helperActor) return pressureTier === 'CRITICAL' ? 'SHADOWING' : 'NONE';
  const trust = Number(affect.trust ?? (50 as Score100));
  const desperation = Number(affect.desperation ?? (0 as Score100));
  if (pressureTier === 'CRITICAL' || desperation >= 80) return 'ESCALATED';
  if (trust >= 62) return 'ACTIVE';
  if (trust >= 44) return 'READY';
  return 'SHADOWING';
}

function deriveCrowdHostility01(state: Readonly<ChatEngineState>): number {
  const heat = safeNumber((state as any).audienceHeat?.global01, 0.45);
  const hostility = safeNumber((state as any).channelMoods?.GLOBAL?.hostility01, 0.45);
  return clamp01((heat * 0.6) + (hostility * 0.4));
}

function deriveDealRoomExposure01(state: Readonly<ChatEngineState>, visibleChannel: ChatVisibleChannel): number {
  if (visibleChannel === 'DEAL_ROOM') return 0.92;
  const activeSceneType = String((state as any).activeScene?.archetype ?? '');
  if (activeSceneType.includes('DEAL')) return 0.72;
  return clamp01(safeNumber((state as any).dealRoomExposure01, 0.18));
}

function deriveReadPressure01(readPressureSamples: readonly InternalReadPressureSample[]): number {
  const recent = readPressureSamples.slice(-8).map((sample) => sample.value01);
  return clamp01(average(recent));
}

function deriveSilenceMs(
  lastMeaningfulAt: UnixMs | null,
  now: UnixMs,
): number {
  if (!lastMeaningfulAt) return 0;
  return Math.max(0, Number(now) - Number(lastMeaningfulAt));
}

function toRescueDecision(plan: ChatRescuePlan, recovery: ChatRecoveryPlan): ChatRescueDecision {
  return {
    interventionId: (plan.relatedInterventionId ?? (`rescue:${String(plan.rescueId)}:decision` as never)) as never,
    helperId: (plan.helperActor?.actorId ?? null) as never,
    posture: plan.helperPosture as never,
    reason: `${plan.kind}:${plan.trigger.reasonCode}`,
    urgency: plan.urgency as never,
    preferredChannel: plan.visibleChannel as never,
    selectedRecoveryKind: recovery.kind as never,
    selectedActionLabel: plan.selectedOffer.actions[0]?.label ?? 'Recover',
    recommendedDelayMs: plan.selectedOffer.prompt.quietWindowMs ?? 0,
  } as ChatRescueDecision;
}

// ============================================================================
// MARK: RageQuitInterceptor
// ============================================================================

export class RageQuitInterceptor {
  private readonly options: Required<Omit<RageQuitInterceptorOptions, 'helperNames'>>;
  private readonly helperNames: Record<ChatRescueHelperPosture | 'DEFAULT', string>;
  private readonly recentSignals: RageQuitSignalEvent[] = [];
  private readonly notes: InternalNote[] = [];
  private readonly channelHops: InternalChannelHopEntry[] = [];
  private readonly readPressureSamples: InternalReadPressureSample[] = [];
  private readonly ledger: ChatRescueLedgerEntry[] = [];
  private readonly signalCache = new Map<string, ChatRescueSignalVector[]>();
  private readonly burstCounters = new Map<string, InternalBurstCounter>();

  private activePlan: ChatRescuePlan | null = null;
  private activeRecovery: ChatRecoveryPlan | null = null;
  private activeWindow: ChatRescueWindow | null = null;
  private stateSnapshot: ChatRescueStateSnapshot | null = null;
  private digest: ChatRescueDigest = {
    digestId: 'rescue-digest:empty' as never,
    updatedAt: 0 as UnixMs,
    activeRescueIds: [],
    criticalRescueIds: [],
    shadowRescueIds: [],
    acceptedRescueIds: [],
    strongestOutcome: undefined,
    strongestUrgency: undefined,
  };

  private lastVisibleChannel: ChatVisibleChannel = 'GLOBAL' as ChatVisibleChannel;
  private lastMeaningfulAt: UnixMs | null = null;
  private lastRescueIssuedAt: UnixMs | null = null;
  private lastFailureAt: UnixMs | null = null;
  private lastSuccessAt: UnixMs | null = null;
  private consecutiveFailedActions = 0;
  private composerAbortStreak = 0;
  private panelToggleBurstCount = 0;
  private channelHopBurstCount = 0;

  public constructor(options: RageQuitInterceptorOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      guardrail: options.guardrail ?? DEFAULT_OPTIONS.guardrail,
    };
    this.helperNames = {
      ...DEFAULT_HELPER_NAMES,
      ...(options.helperNames ?? {}),
    };
  }

  // --------------------------------------------------------------------------
  // MARK: Signal ingestion
  // --------------------------------------------------------------------------

  public notePanelOpened(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'PANEL_OPEN', at, visibleChannel, payload });
    this.bumpBurst('panel', at, 3_000);
  }

  public notePanelClosed(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'PANEL_CLOSE', at, visibleChannel, payload });
    this.bumpBurst('panel', at, 3_000);
  }

  public noteComposerFocus(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'COMPOSER_FOCUS', at, visibleChannel, payload });
    this.lastMeaningfulAt = at;
  }

  public noteComposerBlur(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'COMPOSER_BLUR', at, visibleChannel, payload });
  }

  public noteComposerAbort(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'COMPOSER_ABORT', at, visibleChannel, payload });
    this.composerAbortStreak += 1;
    this.lastMeaningfulAt = at;
  }

  public noteSendAttempt(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'SEND_ATTEMPT', at, visibleChannel, payload });
    this.lastMeaningfulAt = at;
  }

  public noteSendFailure(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'SEND_FAILURE', at, visibleChannel, payload });
    this.consecutiveFailedActions += 1;
    this.lastFailureAt = at;
    this.lastMeaningfulAt = at;
  }

  public noteSendSuccess(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'SEND_SUCCESS', at, visibleChannel, payload });
    this.consecutiveFailedActions = 0;
    this.composerAbortStreak = 0;
    this.lastSuccessAt = at;
    this.lastMeaningfulAt = at;
  }

  public noteChannelSwitch(at: UnixMs, from: ChatVisibleChannel, to: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'CHANNEL_SWITCH', at, visibleChannel: to, payload: { ...(payload ?? {}), from, to } });
    this.channelHops.push({ at, from, to });
    this.channelHops.splice(0, Math.max(0, this.channelHops.length - this.options.maxRecentSignals));
    this.lastVisibleChannel = to;
    this.bumpBurst('hop', at, 5_000);
  }

  public noteCounterWindowOpened(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'COUNTER_WINDOW_OPEN', at, visibleChannel, payload });
  }

  public noteCounterWindowClosed(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'COUNTER_WINDOW_CLOSE', at, visibleChannel, payload });
  }

  public noteBossWindowOpened(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'BOSS_WINDOW_OPEN', at, visibleChannel, payload });
  }

  public noteBossWindowClosed(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'BOSS_WINDOW_CLOSE', at, visibleChannel, payload });
  }

  public noteReadPressure(at: UnixMs, visibleChannel: ChatVisibleChannel, value01: number): void {
    this.pushSignal({ kind: 'READ_PRESSURE', at, visibleChannel, payload: { value01 } });
    this.readPressureSamples.push({ at, value01: clamp01(value01) });
    if (this.readPressureSamples.length > this.options.maxRecentSignals) {
      this.readPressureSamples.splice(0, this.readPressureSamples.length - this.options.maxRecentSignals);
    }
  }

  public noteSentimentDrop(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'SENTIMENT_DROP', at, visibleChannel, payload });
  }

  public noteLongSilence(at: UnixMs, visibleChannel: ChatVisibleChannel, payload?: JsonObject): void {
    this.pushSignal({ kind: 'LONG_SILENCE', at, visibleChannel, payload });
  }

  public noteExternal(at: UnixMs, visibleChannel: ChatVisibleChannel, body: string, payload?: JsonObject): void {
    this.pushSignal({ kind: 'EXTERNAL_NOTE', at, visibleChannel, payload: { ...(payload ?? {}), body } });
    this.notes.push({ at, body });
    if (this.notes.length > this.options.maxRecentSignals) {
      this.notes.splice(0, this.notes.length - this.options.maxRecentSignals);
    }
  }

  // --------------------------------------------------------------------------
  // MARK: Core evaluation
  // --------------------------------------------------------------------------

  public ingest(frame: RageQuitRuntimeFrame): RageQuitInterceptResult {
    this.prune(frame.now);
    this.lastVisibleChannel = frame.visibleChannel;

    if (this.activeWindow && Number(frame.now) >= Number(this.activeWindow.closesAt)) {
      this.expireActiveRescue(frame.now);
    }

    const telemetry = this.buildTelemetry(frame);
    const plan = this.buildCandidatePlan(frame, telemetry);

    if (!plan) {
      this.digest = this.rebuildDigest(frame.now);
      return {
        candidate: null,
        decision: null,
        digest: this.digest,
        updatedStateSnapshot: this.stateSnapshot,
        activePlan: this.activePlan,
        activeRecovery: this.activeRecovery,
        reasons: this.describeNoRescueReasons(frame, telemetry),
      };
    }

    const decision = toRescueDecision(plan.plan, plan.recovery);
    this.activate(plan, frame.now);
    this.digest = this.rebuildDigest(frame.now);

    return {
      candidate: plan,
      decision,
      digest: this.digest,
      updatedStateSnapshot: this.stateSnapshot,
      activePlan: this.activePlan,
      activeRecovery: this.activeRecovery,
      reasons: this.describeRescueReasons(plan),
    };
  }

  public acceptRescue(actionId: string | null | undefined, at: UnixMs): RageQuitInterceptResult {
    if (!this.activePlan) {
      const digest = this.rebuildDigest(at);
      return { candidate: null, decision: null, digest, reasons: ['no-active-plan'] };
    }

    this.activePlan = {
      ...this.activePlan,
      state: 'ACCEPTED' as ChatRescueOutcome,
      resolvedAt: at,
      notes: [
        ...(this.activePlan.notes ?? []),
        `accepted-action=${String(actionId ?? 'none')}`,
      ],
    };

    this.stateSnapshot = deriveRescueStateSnapshot(
      this.activePlan,
      this.lastKnownAffectFallback(),
      at,
      null,
    );

    this.digest = this.rebuildDigest(at);

    return {
      candidate: null,
      decision: toRescueDecision(this.activePlan, this.activeRecovery ?? this.buildFallbackRecoveryFromActive(at)),
      digest: this.digest,
      updatedStateSnapshot: this.stateSnapshot,
      activePlan: this.activePlan,
      activeRecovery: this.activeRecovery,
      reasons: ['accepted-active-rescue'],
    };
  }

  public dismissRescue(at: UnixMs, reason = 'dismissed'): RageQuitInterceptResult {
    if (!this.activePlan) {
      const digest = this.rebuildDigest(at);
      return { candidate: null, decision: null, digest, reasons: ['no-active-plan'] };
    }

    this.activePlan = {
      ...this.activePlan,
      state: 'DISMISSED' as ChatRescueOutcome,
      resolvedAt: at,
      notes: [...(this.activePlan.notes ?? []), `dismiss-reason=${reason}`],
    };
    this.activeWindow = null;
    this.stateSnapshot = deriveRescueStateSnapshot(this.activePlan, this.lastKnownAffectFallback(), at, null);
    this.digest = this.rebuildDigest(at);

    return {
      candidate: null,
      decision: null,
      digest: this.digest,
      updatedStateSnapshot: this.stateSnapshot,
      activePlan: this.activePlan,
      activeRecovery: this.activeRecovery,
      reasons: [`dismissed:${reason}`],
    };
  }

  public getSnapshot(now: UnixMs): RageQuitInterceptorSnapshot {
    this.prune(now);
    return {
      activePlan: this.activePlan,
      activeRecovery: this.activeRecovery,
      activeWindow: this.activeWindow,
      stateSnapshot: this.stateSnapshot,
      digest: this.rebuildDigest(now),
      panelToggleBurstCount: this.panelToggleBurstCount,
      channelHopBurstCount: this.channelHopBurstCount,
      composerAbortStreak: this.composerAbortStreak,
      consecutiveFailedActions: this.consecutiveFailedActions,
      silenceMs: deriveSilenceMs(this.lastMeaningfulAt, now),
      lastVisibleChannel: this.lastVisibleChannel,
      updatedAt: now,
    };
  }

  public clear(now: UnixMs): void {
    this.recentSignals.splice(0, this.recentSignals.length);
    this.notes.splice(0, this.notes.length);
    this.channelHops.splice(0, this.channelHops.length);
    this.readPressureSamples.splice(0, this.readPressureSamples.length);
    this.ledger.splice(0, this.ledger.length);
    this.signalCache.clear();
    this.burstCounters.clear();
    this.activePlan = null;
    this.activeRecovery = null;
    this.activeWindow = null;
    this.stateSnapshot = null;
    this.digest = this.rebuildDigest(now);
    this.lastMeaningfulAt = null;
    this.lastRescueIssuedAt = null;
    this.lastFailureAt = null;
    this.lastSuccessAt = null;
    this.consecutiveFailedActions = 0;
    this.composerAbortStreak = 0;
    this.panelToggleBurstCount = 0;
    this.channelHopBurstCount = 0;
  }

  // --------------------------------------------------------------------------
  // MARK: Planning internals
  // --------------------------------------------------------------------------

  private buildTelemetry(frame: RageQuitRuntimeFrame): ChatRescueTelemetrySnapshot {
    const silenceMs = deriveSilenceMs(this.lastMeaningfulAt, frame.now);
    const recentCollapse = this.detectRecentCollapse(frame);
    const telemetry: ChatRescueTelemetrySnapshot = {
      sampledAt: frame.now,
      activeVisibleChannel: frame.visibleChannel,
      mountKey: ((frame.state as any).mountTarget ?? null) as never,
      routeKey: ((frame.state as any).routeKey ?? null) as never,
      pressureTier: frame.pressureTier as never,
      composerLength: safeNumber((frame.state as any).composer?.draft?.length, 0),
      consecutiveFailedActions: this.consecutiveFailedActions,
      composerAbortStreak: this.composerAbortStreak,
      panelToggleBurstCount: this.panelToggleBurstCount,
      channelHopBurstCount: this.channelHopBurstCount,
      silenceMs: silenceMs as never,
      recentCollapse,
      dealRoomExposure01: deriveDealRoomExposure01(frame.state, frame.visibleChannel) as never,
      crowdHostility01: deriveCrowdHostility01(frame.state) as never,
      readPressure01: deriveReadPressure01(this.readPressureSamples) as never,
      bossFightState: ((frame.state as any).bossFight?.state ?? null) as never,
      bossFightKind: ((frame.state as any).bossFight?.kind ?? null) as never,
      counterWindowId: ((frame.state as any).bossFight?.counterWindowId ?? null) as never,
      shadowOnlyAvailable: this.shouldPreferShadow(frame, frame.affect),
      notes: [
        `panel-burst=${this.panelToggleBurstCount}`,
        `hop-burst=${this.channelHopBurstCount}`,
        `silence-ms=${silenceMs}`,
        `external=${this.describeRecentExternals()}`,
      ],
    };
    return telemetry;
  }

  private buildCandidatePlan(
    frame: RageQuitRuntimeFrame,
    telemetry: ChatRescueTelemetrySnapshot,
  ): RageQuitInterceptCandidate | null {
    if (!this.canIssueRescue(frame.now)) return null;

    const helperPosture = deriveHelperPosture(frame.helperActor ?? null, frame.affect, frame.pressureTier);
    const helperActor = frame.helperActor ?? this.buildHelperActor(helperPosture);

    const plan = buildRescuePlan({
      roomId: frame.roomId as never,
      channelId: frame.channelId as never,
      visibleChannel: frame.visibleChannel,
      sessionId: (frame.sessionId ?? null) as never,
      requestId: (frame.requestId ?? null) as never,
      sceneId: (frame.sceneId ?? null) as never,
      momentId: (frame.momentId ?? null) as never,
      bossFightId: (frame.bossFightId ?? null) as never,
      player: buildPlayerActor(frame.player),
      helperActor,
      feature: frame.feature,
      affect: frame.affect,
      reputation: frame.reputation,
      learning: frame.learning,
      telemetry,
      now: frame.now,
    });

    if (!plan) return null;

    const signals = this.deriveSignals(frame.feature, frame.affect, telemetry, frame.now);
    const recovery = buildRecoveryPlan({
      roomId: frame.roomId as never,
      visibleChannel: plan.visibleChannel,
      sessionId: (frame.sessionId ?? null) as never,
      requestId: (frame.requestId ?? null) as never,
      sceneId: (frame.sceneId ?? null) as never,
      momentId: (frame.momentId ?? null) as never,
      bossFightId: (frame.bossFightId ?? null) as never,
      rescuePlan: plan,
      rescueOutcome: plan.state,
      helperPosture: plan.helperPosture,
      affect: frame.affect,
      learning: frame.learning,
      inDealRoom: plan.visibleChannel === 'DEAL_ROOM',
      recentCollapse: telemetry.recentCollapse,
      counterWindowId: telemetry.counterWindowId ?? null,
      now: frame.now,
    });

    const window = createRescueWindow(plan.rescueId, plan.kind, plan.urgency, frame.now);
    const snapshot = deriveRescueStateSnapshot(plan, frame.affect, frame.now, window.windowId);
    const confidenceScore = this.scoreRescueConfidence(plan, frame, telemetry, signals);
    const prefersSilence = SILENCE_FIRST_TRIGGER_KINDS.includes(plan.trigger.kind);
    const shouldInterruptScene = SCENE_INTERRUPT_TRIGGER_KINDS.includes(plan.trigger.kind) || plan.urgency === 'CRITICAL';

    return {
      plan,
      recovery,
      window,
      stateSnapshot: snapshot,
      signalSummary: signals,
      confidenceScore,
      shouldInterruptScene,
      prefersSilence,
      silenceDecision: prefersSilence ? this.buildSilenceDecision(plan, frame.now) : null,
      replacementScene: shouldInterruptScene ? this.buildRescueScene(plan, recovery, frame.now) : null,
    };
  }

  private deriveSignals(
    feature: ChatFeatureSnapshot,
    affect: ChatAffectSnapshot,
    telemetry: ChatRescueTelemetrySnapshot,
    now: UnixMs,
  ): readonly ChatRescueSignalVector[] {
    const key = `${Number(now)}:${telemetry.activeVisibleChannel}:${telemetry.composerAbortStreak}:${telemetry.consecutiveFailedActions}:${telemetry.silenceMs}`;
    const cached = this.signalCache.get(key);
    if (cached) return cached;
    const vectors = deriveRescueTriggerCandidates(feature, affect, telemetry) as readonly ChatRescueSignalVector[];
    this.signalCache.set(key, vectors);
    return vectors;
  }

  private scoreRescueConfidence(
    plan: ChatRescuePlan,
    frame: RageQuitRuntimeFrame,
    telemetry: ChatRescueTelemetrySnapshot,
    signals: readonly ChatRescueSignalVector[],
  ): Score100 {
    const signalSeverity = average(signals.map((signal) => Number(signal.severity01))) * 100;
    const urgencyWeight =
      plan.urgency === 'CRITICAL' ? 28 :
      plan.urgency === 'HIGH' ? 20 :
      plan.urgency === 'MEDIUM' ? 12 : 6;
    const pressureWeight =
      frame.pressureTier === 'CRITICAL' ? 16 :
      frame.pressureTier === 'HIGH' ? 10 :
      frame.pressureTier === 'MEDIUM' ? 6 : 2;
    const silenceWeight = Math.min(18, Number(telemetry.silenceMs) / 1000);
    const failureWeight = Math.min(16, telemetry.consecutiveFailedActions * 4);
    const embarrassmentPenalty = Number(frame.affect.socialEmbarrassment) >= Number(this.options.preferShadowRescueWhenEmbarrassmentAbove)
      ? 6
      : 0;
    const liveOpsWeight = this.scoreLiveOps(frame.liveOps ?? null);
    return clamp100(signalSeverity * 0.34 + urgencyWeight + pressureWeight + silenceWeight + failureWeight + liveOpsWeight - embarrassmentPenalty);
  }

  private buildSilenceDecision(plan: ChatRescuePlan, now: UnixMs): ChatSilenceDecision {
    return {
      silenceId: (`rescue-silence:${String(plan.rescueId)}`) as never,
      reason: `rescue:${plan.trigger.kind}`,
      startedAt: now,
      until: ((Number(now) + Number(plan.selectedOffer.prompt.quietWindowMs ?? 2200)) as UnixMs),
      visibleChannel: plan.visibleChannel as never,
      suppressBots: true,
      suppressCrowd: plan.channelStrategy !== 'PUBLIC_FIRST',
      allowHelperWhisper: true,
      notes: [...(STYLE_NOTES[plan.style] ?? [])],
    } as ChatSilenceDecision;
  }

  private buildRescueScene(plan: ChatRescuePlan, recovery: ChatRecoveryPlan, now: UnixMs): ChatScenePlan {
    const helperName = plan.helperActor?.displayName ?? this.helperNames[plan.helperPosture] ?? this.helperNames.DEFAULT;
    return {
      sceneId: (`rescue-scene:${String(plan.rescueId)}`) as never,
      archetype: 'RESCUE_WINDOW' as never,
      visibleChannel: plan.visibleChannel as never,
      openedAt: now,
      priority: plan.urgency === 'CRITICAL' ? 100 : plan.urgency === 'HIGH' ? 82 : 64,
      beats: [
        {
          beatId: (`rescue-beat:${String(plan.rescueId)}:notice`) as never,
          kind: 'SYSTEM_NOTICE' as never,
          actorId: ('system:rescue' as never),
          delayMs: 0,
          body: plan.selectedOffer.prompt.title,
          tags: ['rescue', plan.kind.toLowerCase()],
        },
        {
          beatId: (`rescue-beat:${String(plan.rescueId)}:helper`) as never,
          kind: 'HELPER_INTERVENTION' as never,
          actorId: (plan.helperActor?.actorId ?? ('npc:helper:kade' as never)) as never,
          delayMs: plan.selectedOffer.prompt.quietWindowMs ?? 900,
          body: `${helperName}: ${plan.selectedOffer.prompt.bodyTemplate}`,
          tags: ['rescue', 'helper', recovery.kind.toLowerCase()],
        },
      ],
      notes: [
        ...(RESCUE_NOTES_BY_TRIGGER[plan.trigger.kind] ?? []),
        ...(STYLE_NOTES[plan.style] ?? []),
      ],
    } as ChatScenePlan;
  }

  private describeNoRescueReasons(frame: RageQuitRuntimeFrame, telemetry: ChatRescueTelemetrySnapshot): readonly string[] {
    const reasons: string[] = [];
    if (!this.canIssueRescue(frame.now)) reasons.push('cooldown-active-or-window-open');
    if (!telemetry.recentCollapse && telemetry.consecutiveFailedActions === 0 && telemetry.composerAbortStreak === 0 && telemetry.silenceMs < 5000) {
      reasons.push('signals-not-strong-enough');
    }
    if (this.activePlan && this.activePlan.state === 'PENDING') reasons.push('existing-rescue-still-pending');
    return reasons.length ? reasons : ['rescue-plan-not-built'];
  }

  private describeRescueReasons(candidate: RageQuitInterceptCandidate): readonly string[] {
    return [
      `trigger=${candidate.plan.trigger.kind}`,
      `reason=${candidate.plan.trigger.reasonCode}`,
      `urgency=${candidate.plan.urgency}`,
      `style=${candidate.plan.style}`,
      `confidence=${candidate.confidenceScore}`,
      `surface=${candidate.plan.selectedOffer.surface}`,
    ];
  }

  private scoreLiveOps(liveOps: ChatLiveOpsState | null): number {
    if (!liveOps) return 0;
    const active = Array.isArray((liveOps as any).activeEvents) ? (liveOps as any).activeEvents : [];
    return Math.min(12, active.reduce((sum: number, event: any) => {
      const key = String(event?.slug ?? event?.id ?? '').toLowerCase();
      return sum + (LIVEOPS_ESCALATORS.has(key) ? 4 : 1);
    }, 0));
  }

  private canIssueRescue(now: UnixMs): boolean {
    if (this.activeWindow && Number(now) < Number(this.activeWindow.closesAt)) return false;
    if (!this.lastRescueIssuedAt) return true;
    return Number(now) - Number(this.lastRescueIssuedAt) >= this.options.minMsBetweenRescues;
  }

  private shouldPreferShadow(frame: RageQuitRuntimeFrame, affect: ChatAffectSnapshot): boolean {
    const embarrassment = Number(affect.socialEmbarrassment);
    if (embarrassment >= Number(this.options.preferShadowRescueWhenEmbarrassmentAbove)) return true;
    if (frame.visibleChannel === 'GLOBAL' && embarrassment >= 58) return true;
    return false;
  }

  private detectRecentCollapse(frame: RageQuitRuntimeFrame): boolean {
    const lastOutcome = String((frame.state as any).run?.lastOutcome ?? '');
    if (lastOutcome === 'COLLAPSE' || lastOutcome === 'BANKRUPT') return true;
    if (frame.pressureTier === 'CRITICAL' && this.consecutiveFailedActions >= 2) return true;
    return false;
  }

  private expireActiveRescue(at: UnixMs): void {
    if (!this.activePlan) return;
    this.activePlan = {
      ...this.activePlan,
      state: 'EXPIRED' as ChatRescueOutcome,
      resolvedAt: at,
      notes: [...(this.activePlan.notes ?? []), 'expired-window'],
    };
    this.activeWindow = null;
    this.stateSnapshot = deriveRescueStateSnapshot(this.activePlan, this.lastKnownAffectFallback(), at, null);
  }

  private activate(candidate: RageQuitInterceptCandidate, now: UnixMs): void {
    this.activePlan = {
      ...candidate.plan,
      offeredAt: now,
      state: 'PENDING' as ChatRescueOutcome,
      notes: [
        ...(candidate.plan.notes ?? []),
        `confidence=${candidate.confidenceScore}`,
        `prefers-silence=${candidate.prefersSilence}`,
      ],
    };
    this.activeRecovery = candidate.recovery;
    this.activeWindow = candidate.window;
    this.stateSnapshot = candidate.stateSnapshot;
    this.lastRescueIssuedAt = now;
  }

  private buildFallbackRecoveryFromActive(now: UnixMs): ChatRecoveryPlan {
    return buildRecoveryPlan({
      roomId: (this.activePlan?.roomId ?? 'room:fallback') as never,
      visibleChannel: (this.activePlan?.visibleChannel ?? this.lastVisibleChannel) as ChatVisibleChannel,
      sessionId: (this.activePlan?.sessionId ?? null) as never,
      requestId: (this.activePlan?.requestId ?? null) as never,
      sceneId: (this.activePlan?.sceneId ?? null) as never,
      momentId: (this.activePlan?.momentId ?? null) as never,
      bossFightId: (this.activePlan?.bossFightId ?? null) as never,
      rescuePlan: this.activePlan,
      rescueOutcome: this.activePlan?.state ?? null,
      helperPosture: this.activePlan?.helperPosture ?? 'NONE',
      affect: this.lastKnownAffectFallback(),
      learning: this.lastKnownLearningFallback(),
      inDealRoom: this.activePlan?.visibleChannel === 'DEAL_ROOM',
      recentCollapse: false,
      counterWindowId: null,
      now,
    });
  }

  private buildHelperActor(posture: ChatRescueHelperPosture): ChatRescueActor | null {
    if (posture === 'NONE') return null;
    const displayName = this.helperNames[posture] ?? this.helperNames.DEFAULT;
    return {
      actorId: (`npc:helper:${displayName.toLowerCase()}` as never),
      actorKind: 'NPC',
      counterpartKind: 'ALLY' as never,
      role: 'HELPER',
      displayName,
      relationshipId: null,
      relationshipStance: 'SUPPORTIVE' as never,
      objective: 'STABILIZE' as never,
    };
  }

  private rebuildDigest(now: UnixMs): ChatRescueDigest {
    const active = this.activePlan ? [this.activePlan] : [];
    this.digest = deriveRescueDigest(active, now);
    return this.digest;
  }

  private lastKnownAffectFallback(): ChatAffectSnapshot {
    return {
      intimidation: 40 as Score100,
      confidence: 34 as Score100,
      frustration: 68 as Score100,
      curiosity: 40 as Score100,
      attachment: 38 as Score100,
      socialEmbarrassment: 62 as Score100,
      relief: 24 as Score100,
      dominance: 18 as Score100,
      desperation: 58 as Score100,
      trust: 46 as Score100,
      anger: 22 as Score100,
      updatedAt: (Date.now() as UnixMs),
    } as ChatAffectSnapshot;
  }

  private lastKnownLearningFallback(): ChatLearningProfile {
    return {
      helperReceptivity: 52 as Score100,
      rivalrySensitivity: 60 as Score100,
      embarrassmentSensitivity: 64 as Score100,
      prefersPrivateCorrection: true,
      updatedAt: (Date.now() as UnixMs),
    } as unknown as ChatLearningProfile;
  }

  private bumpBurst(label: string, at: UnixMs, resetWindowMs: number): void {
    const existing = this.burstCounters.get(label);
    if (!existing) {
      this.burstCounters.set(label, { label, count: 1, lastAt: at });
    } else if (Number(at) - Number(existing.lastAt) <= resetWindowMs) {
      existing.count += 1;
      existing.lastAt = at;
    } else {
      existing.count = 1;
      existing.lastAt = at;
    }

    const value = this.burstCounters.get(label)?.count ?? 0;
    if (label === 'panel') this.panelToggleBurstCount = value;
    if (label === 'hop') this.channelHopBurstCount = value;
  }

  private pushSignal(event: RageQuitSignalEvent): void {
    this.recentSignals.push(event);
    if (this.recentSignals.length > this.options.maxRecentSignals) {
      this.recentSignals.splice(0, this.recentSignals.length - this.options.maxRecentSignals);
    }
  }

  private prune(now: UnixMs): void {
    const signals = trimWindow(this.recentSignals, now, this.options.telemetryWindowMs, this.options.maxRecentSignals);
    this.recentSignals.splice(0, this.recentSignals.length, ...signals);

    const notes = trimWindow(this.notes, now, this.options.telemetryWindowMs * 2, this.options.maxRecentSignals);
    this.notes.splice(0, this.notes.length, ...notes);

    const hops = trimWindow(this.channelHops, now, this.options.telemetryWindowMs, this.options.maxRecentSignals);
    this.channelHops.splice(0, this.channelHops.length, ...hops);

    const reads = trimWindow(this.readPressureSamples, now, this.options.telemetryWindowMs, this.options.maxRecentSignals);
    this.readPressureSamples.splice(0, this.readPressureSamples.length, ...reads);

    if (this.activePlan && this.activePlan.createdAt && Number(now) - Number(this.activePlan.createdAt) > this.options.maxActiveRescueMs) {
      this.expireActiveRescue(now);
    }
  }

  private describeRecentExternals(): string {
    return this.notes.slice(-3).map((note) => note.body).join(' | ');
  }
}

// ============================================================================
// MARK: Free functions
// ============================================================================


export function createRageQuitInterceptor(options: RageQuitInterceptorOptions = {}): RageQuitInterceptor {
  return new RageQuitInterceptor(options);
}

export const RageQuitInterceptorModule = Object.freeze({
  displayName: 'RageQuitInterceptor',
  file: 'pzo-web/src/engines/chat/rescue/RageQuitInterceptor.ts',
  category: 'frontend-chat-rescue-runtime',
  authorities: {
    frontend: '/pzo-web/src/engines/chat/rescue',
    backend: '/backend/src/game/engine/chat/rescue',
    shared: '/shared/contracts/chat',
  },
  create: createRageQuitInterceptor,
});
