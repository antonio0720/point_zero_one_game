
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE INVASION DIRECTOR
 * FILE: pzo-web/src/engines/chat/ChatInvasionDirector.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend invasion and social-pressure orchestration authority for
 * the unified chat engine.
 *
 * This file turns the repo's existing hater / pressure / shield / cascade /
 * helper ingredients into directed chat invasions instead of single-line,
 * disconnected reactions. The goal is not generic alerting. The goal is making
 * chat feel like the emotional operating system of the run.
 *
 * What this controller owns
 * -------------------------
 * - invasion trigger ingestion from game events and sabotage signals
 * - channel-aware invasion routing through ChatChannelPolicy
 * - multi-beat chat scenes (system notice → hater intrusion → crowd echo →
 *   helper interception)
 * - pressure-aware severity scoring
 * - per-archetype cooldowns
 * - presence theater and typing theater during invasion beats
 * - transcript insertion of invasion moments
 * - notification mirroring for major invasion beats
 * - local telemetry mirroring to the socket game-event lane
 *
 * Preserved repo truths
 * ---------------------
 * - Current useChatEngine already maps real engine events like
 *   BOT_ATTACK_FIRED, SHIELD_LAYER_BREACHED, CASCADE_CHAIN_TRIGGERED, and
 *   PRESSURE_TIER_CHANGED into chat.
 * - Existing socket lane already handles hater sabotage injections.
 * - Donor logic already treats helpers, haters, and system notices as distinct
 *   actors.
 * - Your stated direction is explicit: chat should become dramaturgy, pressure,
 *   memory, witness, and personal legend.
 *
 * Design laws
 * -----------
 * - Not every event deserves an invasion.
 * - Every major collapse deserves a witness.
 * - Some invasions should swarm; some should isolate.
 * - DEAL_ROOM invasions must feel predatory, not noisy.
 * - SYNDICATE invasions should feel tactical, not theatrical.
 * - GLOBAL invasions should feel witnessed.
 * - Helper intervention timing matters as much as the hater strike itself.
 * - The client may stage invasion theater, but transcript truth remains server
 *   authoritative long term.
 *
 * Migration note
 * --------------
 * This file is intentionally self-contained against the canonical frontend chat
 * lane already created in this session:
 *   - ChatSocketClient.ts
 *   - ChatPresenceController.ts
 *   - ChatTypingController.ts
 *   - ChatNotificationController.ts
 *   - ChatTranscriptBuffer.ts
 *   - ChatPrivacyPolicy.ts
 *   - ChatChannelPolicy.ts
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 * ============================================================================
 */

import {
  ChatSocketClient,
  type ChatChannel,
  type ChatInvasionEvent,
  type ChatMessage,
  type ChatSabotageEvent,
} from './ChatSocketClient';

import {
  ChatPresenceController,
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
} from './ChatPrivacyPolicy';

import {
  ChatChannelPolicy,
} from './ChatChannelPolicy';

export type ChatInvasionArchetype =
  | 'HATER_STRIKE'
  | 'PRESSURE_SURGE'
  | 'SHIELD_BREAK'
  | 'CASCADE_SWARM'
  | 'BANKRUPTCY_SHADOW'
  | 'SOVEREIGNTY_DENIAL'
  | 'DEALROOM_AMBUSH'
  | 'SYNDICATE_BREACH'
  | 'MARKET_PANIC';

export type ChatInvasionDirectorStage =
  | 'PLANNED'
  | 'ARMED'
  | 'SYSTEM_BEAT'
  | 'HATER_BEAT'
  | 'CROWD_BEAT'
  | 'HELPER_BEAT'
  | 'RESOLVED'
  | 'CANCELLED'
  | 'EXPIRED';

export type ChatInvasionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ChatInvasionTrigger =
  | 'game_event'
  | 'sabotage'
  | 'message_pattern'
  | 'manual'
  | 'pressure_tick';

export type ChatInvasionResolution =
  | 'completed'
  | 'suppressed'
  | 'manual_cancel'
  | 'policy_block'
  | 'expired';

export interface ChatInvasionRuntimeState {
  modeId?: string;
  screenId?: string;
  runId?: string;
  roomId?: string;
  dealId?: string;
  syndicateId?: string;
  pressureTier?: string;
  tickTier?: string;
  haterHeat?: number;
  isNegotiationWindow?: boolean;
  isPostRun?: boolean;
  isPreRun?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatInvasionBeat {
  id: string;
  channel: ChatChannel;
  actorId: string;
  actorName: string;
  actorRole: 'SYSTEM' | 'HATER' | 'HELPER' | 'NPC';
  kind: ChatMessage['kind'];
  body: string;
  emoji?: string;
  delayMs: number;
  immutable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatInvasionPlan {
  id: string;
  archetype: ChatInvasionArchetype;
  trigger: ChatInvasionTrigger;
  channel: ChatChannel;
  severity: ChatInvasionSeverity;
  title: string;
  body: string;
  sourceId: string;
  sourceName: string;
  sourceRole: 'SYSTEM' | 'HATER' | 'HELPER' | 'NPC';
  createdAt: number;
  scheduledAt: number;
  expiresAt: number;
  stage: ChatInvasionDirectorStage;
  beats: ChatInvasionBeat[];
  metadata?: Record<string, unknown>;
}

export interface ChatInvasionHistoryEntry {
  id: string;
  archetype: ChatInvasionArchetype;
  trigger: ChatInvasionTrigger;
  channel: ChatChannel;
  severity: ChatInvasionSeverity;
  createdAt: number;
  resolvedAt: number;
  resolution: ChatInvasionResolution;
}

export interface ChatInvasionDirectorSnapshot {
  runtime: ChatInvasionRuntimeState;
  activeInvaders: Array<Pick<ChatInvasionPlan, 'id' | 'archetype' | 'channel' | 'severity' | 'stage' | 'createdAt' | 'scheduledAt' | 'expiresAt'>>;
  queuedCount: number;
  activeCount: number;
  cooldowns: Record<string, number>;
  lastTriggeredAt: number | null;
  lastResolvedAt: number | null;
  history: ChatInvasionHistoryEntry[];
}

export interface ChatInvasionDirectorCallbacks {
  onPlanCreated?: (plan: ChatInvasionPlan) => void;
  onPlanStarted?: (plan: ChatInvasionPlan) => void;
  onBeatEmitted?: (plan: ChatInvasionPlan, beat: ChatInvasionBeat, message: ChatMessage) => void;
  onPlanResolved?: (
    plan: ChatInvasionPlan,
    resolution: ChatInvasionResolution,
  ) => void;
  onSnapshotChanged?: (snapshot: ChatInvasionDirectorSnapshot) => void;
  onError?: (error: Error, context?: Record<string, unknown>) => void;
}

export interface ChatInvasionDirectorConfig {
  maxActiveInvasions?: number;
  invasionLifetimeMs?: number;
  sceneStepBaseDelayMs?: number;
  sceneStepJitterMs?: number;
  archetypeCooldownMs?: number;
  channelCooldownMs?: number;
  helperInterventionDelayMs?: number;
  allowCrowdBeat?: boolean;
  allowHelperBeat?: boolean;
  allowPresenceTheater?: boolean;
  allowTypingTheater?: boolean;
  allowSocketMirror?: boolean;
  allowNotificationMirror?: boolean;
  allowTranscriptMirror?: boolean;
  historyLimit?: number;
  dedupWindowMs?: number;
  log?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatInvasionDirectorOptions {
  socketClient: ChatSocketClient;
  presenceController: ChatPresenceController;
  typingController: ChatTypingController;
  notificationController: ChatNotificationController;
  transcriptBuffer: ChatTranscriptBuffer;
  privacyPolicy: ChatPrivacyPolicy;
  channelPolicy: ChatChannelPolicy;
  initialRuntime?: Partial<ChatInvasionRuntimeState>;
  callbacks?: ChatInvasionDirectorCallbacks;
  config?: ChatInvasionDirectorConfig;
}

interface ActivePlanEntry {
  plan: ChatInvasionPlan;
  timers: number[];
}

interface PersonaVoice {
  id: string;
  name: string;
  role: 'HATER' | 'HELPER' | 'NPC' | 'SYSTEM';
  emoji: string;
  attackOpeners: string[];
  retreatOpeners: string[];
  helperIntercepts?: string[];
  crowdEchoes?: string[];
}

const DEFAULT_RUNTIME: Required<
  Omit<ChatInvasionRuntimeState, 'metadata'>
> = {
  modeId: 'unknown',
  screenId: 'unknown',
  runId: '',
  roomId: '',
  dealId: '',
  syndicateId: '',
  pressureTier: 'BUILDING',
  tickTier: 'STABLE',
  haterHeat: 0,
  isNegotiationWindow: false,
  isPostRun: false,
  isPreRun: true,
};

const DEFAULT_CONFIG: Required<
  Omit<ChatInvasionDirectorConfig, 'log' | 'warn' | 'error'>
> = {
  maxActiveInvasions: 2,
  invasionLifetimeMs: 30_000,
  sceneStepBaseDelayMs: 850,
  sceneStepJitterMs: 550,
  archetypeCooldownMs: 12_000,
  channelCooldownMs: 6_000,
  helperInterventionDelayMs: 1_900,
  allowCrowdBeat: true,
  allowHelperBeat: true,
  allowPresenceTheater: true,
  allowTypingTheater: true,
  allowSocketMirror: true,
  allowNotificationMirror: true,
  allowTranscriptMirror: true,
  historyLimit: 120,
  dedupWindowMs: 2_500,
};

const PERSONAS: Record<string, PersonaVoice> = {
  THE_LIQUIDATOR: {
    id: 'THE_LIQUIDATOR',
    name: 'THE LIQUIDATOR',
    role: 'HATER',
    emoji: '🔱',
    attackOpeners: [
      'Your assets are priced for distress. I am only accelerating discovery.',
      'Liquidity is mercy for those who prepared. You did not.',
      'When shields crack, valuation follows. I am here for both.',
    ],
    retreatOpeners: [
      'Temporary reprieve. Distress always comes back around.',
      'You bought time. You did not buy safety.',
    ],
    crowdEchoes: [
      'global just saw that hit land 😬',
      'that was not a small strike. everyone felt it.',
    ],
  },
  THE_BUREAUCRAT: {
    id: 'THE_BUREAUCRAT',
    name: 'THE BUREAUCRAT',
    role: 'HATER',
    emoji: '📋',
    attackOpeners: [
      'Forms precede freedom. Your paperwork disagrees with your ambition.',
      'Every stream must be verified. Compliance always arrives late enough to hurt.',
      'Systems reward the documented. Today, you are under-documented.',
    ],
    retreatOpeners: [
      'Your file is in order. For now.',
      'Documentation improved. Scrutiny paused, not removed.',
    ],
    crowdEchoes: [
      'bureaucrat pressure is the quiet killer',
      'compliance invasions always look smaller than they are',
    ],
  },
  THE_MANIPULATOR: {
    id: 'THE_MANIPULATOR',
    name: 'THE MANIPULATOR',
    role: 'HATER',
    emoji: '🕸️',
    attackOpeners: [
      'Predictable players publish their own weakness. You keep publishing.',
      'I watched your pattern until it became cheaper to break than to respect.',
      'The easiest cage is the one a player mistakes for routine.',
    ],
    retreatOpeners: [
      'You changed the pattern. Interesting.',
      'Model drift detected. I need more data.',
    ],
    crowdEchoes: [
      'manipulator invasions are always personal',
      'he waits until the pattern feels safe. that is the whole trick.',
    ],
  },
  THE_CRASH_PROPHET: {
    id: 'THE_CRASH_PROPHET',
    name: 'THE CRASH PROPHET',
    role: 'HATER',
    emoji: '🌪️',
    attackOpeners: [
      'The market does not hate you. It simply remembers gravity.',
      'Every euphoric build eventually meets weather. The weather is here.',
      'Macro always arrives when confidence gets lazy.',
    ],
    retreatOpeners: [
      'You survived this weather band. Forecast remains hostile.',
      'Volatility moved on. It can move back.',
    ],
    crowdEchoes: [
      'macro just turned the room cold',
      'crash prophet invasions always hit harder than the warning suggests',
    ],
  },
  THE_LEGACY_HEIR: {
    id: 'THE_LEGACY_HEIR',
    name: 'THE LEGACY HEIR',
    role: 'HATER',
    emoji: '👑',
    attackOpeners: [
      'You rose too quickly for a system built to reward inheritance first.',
      'Access remembers bloodlines even when scoreboards pretend not to.',
      'You are being tested for audacity, not merely for competence.',
    ],
    retreatOpeners: [
      'You forced the gate wider than tradition preferred.',
      'Interesting. The threshold moved because you refused to stop.',
    ],
    crowdEchoes: [
      'legacy heir invasions always feel personal and structural at the same time',
      'that one was not just a hit. it was a reminder.',
    ],
  },
  THE_MENTOR: {
    id: 'THE_MENTOR',
    name: 'THE MENTOR',
    role: 'HELPER',
    emoji: '🧭',
    attackOpeners: [],
    retreatOpeners: [],
    helperIntercepts: [
      'Breathe. Read the room, then read the numbers.',
      'Do not answer panic with panic. Answer it with sequence.',
      'If you are still here, the run is still editable.',
      'Let them swarm. You only need one clean decision, not their approval.',
    ],
  },
};

const CROWD_NAMES = [
  'CashflowKing_ATL',
  'SovereignSyd',
  'RatRaceEscaper',
  'PassivePhil',
  'LiquidityLord',
  'DebtFreeDevin',
  'ArbitrageAndy',
  'EquityElla',
  'MomentumMarcus',
  'LedgerLionel',
  'TreasurySam',
  'SovereignSophia',
];

function now(): number {
  return Date.now();
}

function randomInt(minValue: number, maxValue: number): number {
  const min = Math.ceil(minValue);
  const max = Math.floor(maxValue);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(maxValue, Math.max(minValue, value));
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function createError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  if (cause !== undefined) {
    try {
      (error as Error & { cause?: unknown }).cause = cause;
    } catch {
      // ignore cause wiring failures
    }
  }
  return error;
}

function severityRank(severity: ChatInvasionSeverity): number {
  switch (severity) {
    case 'CRITICAL': return 4;
    case 'HIGH': return 3;
    case 'MEDIUM': return 2;
    default: return 1;
  }
}

function pressureRank(tier?: string): number {
  switch ((tier ?? '').toUpperCase()) {
    case 'CRITICAL': return 5;
    case 'HIGH': return 4;
    case 'ELEVATED': return 3;
    case 'BUILDING': return 2;
    case 'CALM': return 1;
    default: return 0;
  }
}

function channelSeverityFloor(channel: ChatChannel): ChatInvasionSeverity {
  switch (channel) {
    case 'DEAL_ROOM': return 'MEDIUM';
    case 'SYNDICATE': return 'LOW';
    case 'GLOBAL': return 'LOW';
    case 'LOBBY': return 'HIGH';
    default: return 'LOW';
  }
}

function comparePlans(a: ChatInvasionPlan, b: ChatInvasionPlan): number {
  const severityDelta = severityRank(b.severity) - severityRank(a.severity);
  if (severityDelta !== 0) return severityDelta;
  return a.createdAt - b.createdAt;
}

export class ChatInvasionDirector {
  private readonly socketClient: ChatSocketClient;
  private readonly presenceController: ChatPresenceController;
  private readonly typingController: ChatTypingController;
  private readonly notificationController: ChatNotificationController;
  private readonly transcriptBuffer: ChatTranscriptBuffer;
  private readonly privacyPolicy: ChatPrivacyPolicy;
  private readonly channelPolicy: ChatChannelPolicy;
  private readonly callbacks: ChatInvasionDirectorCallbacks;
  private readonly config: ChatInvasionDirectorConfig & typeof DEFAULT_CONFIG;
  private readonly log?: (message: string, context?: Record<string, unknown>) => void;
  private readonly warn?: (message: string, context?: Record<string, unknown>) => void;
  private readonly error?: (message: string, context?: Record<string, unknown>) => void;

  private runtime: ChatInvasionRuntimeState;
  private readonly active = new Map<string, ActivePlanEntry>();
  private readonly history: ChatInvasionHistoryEntry[] = [];
  private readonly recentDedup = new Map<string, number>();
  private readonly channelCooldowns = new Map<ChatChannel, number>();
  private readonly archetypeCooldowns = new Map<ChatInvasionArchetype, number>();

  private lastTriggeredAt: number | null = null;
  private lastResolvedAt: number | null = null;
  private destroyed = false;
  private sequence = 0;

  public constructor(options: ChatInvasionDirectorOptions) {
    this.socketClient = options.socketClient;
    this.presenceController = options.presenceController;
    this.typingController = options.typingController;
    this.notificationController = options.notificationController;
    this.transcriptBuffer = options.transcriptBuffer;
    this.privacyPolicy = options.privacyPolicy;
    this.channelPolicy = options.channelPolicy;
    this.callbacks = options.callbacks ?? {};
    this.config = {
      ...DEFAULT_CONFIG,
      ...(options.config ?? {}),
    };
    this.log = options.config?.log;
    this.warn = options.config?.warn;
    this.error = options.config?.error;
    this.runtime = {
      ...DEFAULT_RUNTIME,
      ...(options.initialRuntime ?? {}),
      metadata: options.initialRuntime?.metadata ? { ...options.initialRuntime.metadata } : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Public lifecycle / snapshot
  // ---------------------------------------------------------------------------

  public destroy(): void {
    this.destroyed = true;
    for (const entry of this.active.values()) {
      for (const timer of entry.timers) clearTimeout(timer);
    }
    this.active.clear();
    this.recentDedup.clear();
    this.channelCooldowns.clear();
    this.archetypeCooldowns.clear();
  }

  public getSnapshot(): ChatInvasionDirectorSnapshot {
    this.assertNotDestroyed('getSnapshot');
    return {
      runtime: cloneRuntime(this.runtime),
      activeInvaders: [...this.active.values()]
        .map((entry) => ({
          id: entry.plan.id,
          archetype: entry.plan.archetype,
          channel: entry.plan.channel,
          severity: entry.plan.severity,
          stage: entry.plan.stage,
          createdAt: entry.plan.createdAt,
          scheduledAt: entry.plan.scheduledAt,
          expiresAt: entry.plan.expiresAt,
        }))
        .sort((a, b) => comparePlans(
          this.active.get(a.id)!.plan,
          this.active.get(b.id)!.plan,
        )),
      queuedCount: [...this.active.values()].filter((entry) => entry.plan.stage === 'PLANNED' || entry.plan.stage === 'ARMED').length,
      activeCount: this.active.size,
      cooldowns: this.getCooldownSnapshot(),
      lastTriggeredAt: this.lastTriggeredAt,
      lastResolvedAt: this.lastResolvedAt,
      history: this.history.slice(),
    };
  }

  public updateRuntime(next: Partial<ChatInvasionRuntimeState>): void {
    this.assertNotDestroyed('updateRuntime');
    this.runtime = {
      ...this.runtime,
      ...next,
      metadata: next.metadata
        ? { ...(this.runtime.metadata ?? {}), ...next.metadata }
        : this.runtime.metadata ? { ...this.runtime.metadata } : undefined,
    };
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Public trigger surface
  // ---------------------------------------------------------------------------

  public handleGameEvent(input: {
    event: string;
    payload?: Record<string, unknown>;
    preferredChannels?: ChatChannel[];
  }): ChatInvasionPlan | null {
    this.assertNotDestroyed('handleGameEvent');

    const event = normalizeText(input.event).toUpperCase();
    const archetype = this.classifyEventArchetype(event, input.payload);
    if (!archetype) return null;

    const severity = this.scoreEventSeverity(archetype, event, input.payload);
    if (severityRank(severity) < severityRank(channelSeverityFloor(input.preferredChannels?.[0] ?? 'GLOBAL'))) {
      // keep weak lobby noise out; other channels are already handled in policy
      // this is intentionally conservative and only suppresses very low-value chatter
    }

    return this.stageFromContext({
      trigger: 'game_event',
      archetype,
      eventName: event,
      payload: input.payload,
      severity,
      preferredChannels: input.preferredChannels,
    });
  }

  public handleSabotage(event: ChatSabotageEvent): ChatInvasionPlan | null {
    this.assertNotDestroyed('handleSabotage');

    const payload: Record<string, unknown> = {
      botId: event.botId,
      botName: event.botName,
      attackType: event.attackType,
      targetLayer: event.targetLayer,
      dialogue: event.dialogue,
      metadata: event.metadata,
    };

    const channelPrefs: ChatChannel[] = this.runtime.isNegotiationWindow
      ? ['DEAL_ROOM', 'GLOBAL', 'SYNDICATE']
      : ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'];

    return this.stageFromContext({
      trigger: 'sabotage',
      archetype: this.runtime.isNegotiationWindow ? 'DEALROOM_AMBUSH' : 'HATER_STRIKE',
      eventName: 'HATER_SABOTAGE',
      payload,
      severity: this.scoreSabotageSeverity(event),
      preferredChannels: channelPrefs,
    });
  }

  public stageManualInvasion(input: {
    archetype: ChatInvasionArchetype;
    title: string;
    body: string;
    sourceId?: string;
    sourceName?: string;
    sourceRole?: 'SYSTEM' | 'HATER' | 'HELPER' | 'NPC';
    severity?: ChatInvasionSeverity;
    preferredChannels?: ChatChannel[];
    metadata?: Record<string, unknown>;
  }): ChatInvasionPlan | null {
    this.assertNotDestroyed('stageManualInvasion');

    return this.stageFromContext({
      trigger: 'manual',
      archetype: input.archetype,
      eventName: 'MANUAL_INVASION',
      payload: {
        title: input.title,
        body: input.body,
        sourceId: input.sourceId,
        sourceName: input.sourceName,
        sourceRole: input.sourceRole,
        metadata: input.metadata,
      },
      severity: input.severity ?? 'MEDIUM',
      preferredChannels: input.preferredChannels,
    });
  }

  public resolveInvasion(
    invasionId: string,
    resolution: ChatInvasionResolution = 'completed',
  ): void {
    const entry = this.active.get(invasionId);
    if (!entry) return;

    for (const timer of entry.timers) clearTimeout(timer);
    this.active.delete(invasionId);
    this.lastResolvedAt = now();
    this.pushHistory(entry.plan, resolution);
    this.cleanupPresenceTheater(entry.plan);
    this.callbacks.onPlanResolved?.(entry.plan, resolution);
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Private plan staging
  // ---------------------------------------------------------------------------

  private stageFromContext(input: {
    trigger: ChatInvasionTrigger;
    archetype: ChatInvasionArchetype;
    eventName: string;
    payload?: Record<string, unknown>;
    severity: ChatInvasionSeverity;
    preferredChannels?: ChatChannel[];
  }): ChatInvasionPlan | null {
    this.sweepDedup();
    this.sweepExpiredPlans();

    if (this.active.size >= this.config.maxActiveInvasions) {
      const weakest = [...this.active.values()]
        .sort((a, b) => comparePlans(a.plan, b.plan))
        .at(-1);
      if (weakest && severityRank(weakest.plan.severity) <= severityRank(input.severity)) {
        this.resolveInvasion(weakest.plan.id, 'suppressed');
      } else {
        return null;
      }
    }

    if (this.isDeduped(input)) return null;
    if (this.isArchetypeCoolingDown(input.archetype)) return null;

    const route = this.channelPolicy.evaluateInvasionRoute({
      preferredChannels: input.preferredChannels,
      severity: input.severity,
      metadata: { eventName: input.eventName },
    });

    if (!route.allowed) {
      return null;
    }

    if (this.isChannelCoolingDown(route.resolvedChannel) && severityRank(input.severity) < severityRank('CRITICAL')) {
      return null;
    }

    const source = this.resolveSourcePersona(input.archetype, input.payload);
    const title = this.composeTitle(input.archetype, source, input.payload);
    const body = this.composeSummary(input.archetype, source, input.payload);
    const createdAt = now();
    const plan: ChatInvasionPlan = {
      id: this.nextId('inv'),
      archetype: input.archetype,
      trigger: input.trigger,
      channel: route.resolvedChannel,
      severity: input.severity,
      title,
      body,
      sourceId: source.id,
      sourceName: source.name,
      sourceRole: source.role,
      createdAt,
      scheduledAt: createdAt + this.computeStartDelay(input.severity),
      expiresAt: createdAt + this.config.invasionLifetimeMs,
      stage: 'PLANNED',
      beats: this.buildBeats({
        archetype: input.archetype,
        channel: route.resolvedChannel,
        severity: input.severity,
        source,
        payload: input.payload,
      }),
      metadata: {
        routeReason: route.reason,
        deliveryIntent: route.deliveryIntent,
        audienceMood: route.audienceMood,
        bannerTone: route.bannerTone,
        eventName: input.eventName,
        payload: input.payload,
      },
    };

    const timers: number[] = [];
    const startTimer = setTimeout(() => this.startPlan(plan.id), Math.max(0, plan.scheduledAt - now())) as unknown as number;
    timers.push(startTimer);

    this.active.set(plan.id, { plan, timers });
    this.markDedup(input);
    this.channelCooldowns.set(plan.channel, createdAt + this.config.channelCooldownMs);
    this.archetypeCooldowns.set(plan.archetype, createdAt + this.config.archetypeCooldownMs);
    this.lastTriggeredAt = createdAt;

    this.callbacks.onPlanCreated?.(plan);
    this.emitSnapshot();
    return plan;
  }

  private startPlan(invasionId: string): void {
    const entry = this.active.get(invasionId);
    if (!entry) return;
    const plan = entry.plan;
    if (plan.stage !== 'PLANNED') return;
    if (plan.expiresAt <= now()) {
      this.resolveInvasion(plan.id, 'expired');
      return;
    }

    plan.stage = 'ARMED';
    this.callbacks.onPlanStarted?.(plan);

    if (this.config.allowNotificationMirror) {
      this.noteInvasionNotification(plan);
    }

    this.stagePresence(plan);
    this.stageBeatSequence(plan, entry);
    this.mirrorSocketEvent('chat:invasion_started', plan);
    this.emitSnapshot();
  }

  private stageBeatSequence(plan: ChatInvasionPlan, entry: ActivePlanEntry): void {
    let cursor = 0;
    for (const beat of plan.beats) {
      cursor += beat.delayMs;
      const timer = setTimeout(() => {
        this.emitBeat(plan.id, beat);
      }, cursor) as unknown as number;
      entry.timers.push(timer);
    }

    const resolveTimer = setTimeout(() => {
      this.resolveInvasion(plan.id, 'completed');
    }, cursor + 800) as unknown as number;
    entry.timers.push(resolveTimer);
  }

  private emitBeat(invasionId: string, beat: ChatInvasionBeat): void {
    const entry = this.active.get(invasionId);
    if (!entry) return;
    const plan = entry.plan;
    if (plan.expiresAt <= now()) {
      this.resolveInvasion(invasionId, 'expired');
      return;
    }

    switch (beat.actorRole) {
      case 'SYSTEM': plan.stage = 'SYSTEM_BEAT'; break;
      case 'HATER': plan.stage = 'HATER_BEAT'; break;
      case 'NPC': plan.stage = 'CROWD_BEAT'; break;
      case 'HELPER': plan.stage = 'HELPER_BEAT'; break;
    }

    const message = this.materializeBeatMessage(plan, beat);

    if (this.config.allowTranscriptMirror) {
      this.transcriptBuffer.insertSystemMessage(message);
    }

    if (this.config.allowTypingTheater && beat.actorRole !== 'SYSTEM') {
      this.stageTypingBeat(beat);
    }

    if (beat.actorRole === 'HELPER' && this.config.allowNotificationMirror && severityRank(plan.severity) >= severityRank('HIGH')) {
      this.notificationController.noteSystem({
        channel: beat.channel,
        title: `${beat.actorName} intervened`,
        body: beat.body,
        severity: plan.severity === 'CRITICAL' ? 'CRITICAL' : 'TACTICAL',
        metadata: {
          invasionId: plan.id,
          archetype: plan.archetype,
        },
      });
    }

    this.callbacks.onBeatEmitted?.(plan, beat, message);
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Private beat / message construction
  // ---------------------------------------------------------------------------

  private buildBeats(input: {
    archetype: ChatInvasionArchetype;
    channel: ChatChannel;
    severity: ChatInvasionSeverity;
    source: PersonaVoice;
    payload?: Record<string, unknown>;
  }): ChatInvasionBeat[] {
    const beats: ChatInvasionBeat[] = [];
    const systemBeat = this.buildSystemBeat(input);
    beats.push(systemBeat);

    const haterBeat = this.buildHaterBeat(input);
    if (haterBeat) beats.push(haterBeat);

    if (this.config.allowCrowdBeat) {
      const crowdBeat = this.buildCrowdBeat(input);
      if (crowdBeat) beats.push(crowdBeat);
    }

    if (this.config.allowHelperBeat && severityRank(input.severity) >= severityRank('MEDIUM')) {
      const helperBeat = this.buildHelperBeat(input);
      if (helperBeat) beats.push(helperBeat);
    }

    return beats;
  }

  private buildSystemBeat(input: {
    archetype: ChatInvasionArchetype;
    channel: ChatChannel;
    severity: ChatInvasionSeverity;
    source: PersonaVoice;
    payload?: Record<string, unknown>;
  }): ChatInvasionBeat {
    return {
      id: this.nextId('beat'),
      channel: input.channel,
      actorId: 'SYSTEM',
      actorName: 'SYSTEM',
      actorRole: 'SYSTEM',
      kind: this.kindForArchetype(input.archetype),
      emoji: systemEmojiForArchetype(input.archetype),
      body: this.systemLineForArchetype(input.archetype, input.severity, input.payload),
      delayMs: 0,
      metadata: {
        stage: 'system',
        archetype: input.archetype,
      },
    };
  }

  private buildHaterBeat(input: {
    archetype: ChatInvasionArchetype;
    channel: ChatChannel;
    severity: ChatInvasionSeverity;
    source: PersonaVoice;
    payload?: Record<string, unknown>;
  }): ChatInvasionBeat | null {
    if (input.source.role !== 'HATER') return null;

    const line = pick(input.source.attackOpeners) ?? input.payload?.dialogue;
    return {
      id: this.nextId('beat'),
      channel: input.channel,
      actorId: input.source.id,
      actorName: input.source.name,
      actorRole: 'HATER',
      kind: 'BOT_ATTACK',
      emoji: input.source.emoji,
      body: String(line ?? 'The room just got hostile.'),
      delayMs: this.stepDelay('hater'),
      metadata: {
        stage: 'hater',
        archetype: input.archetype,
        sourceId: input.source.id,
      },
    };
  }

  private buildCrowdBeat(input: {
    archetype: ChatInvasionArchetype;
    channel: ChatChannel;
    severity: ChatInvasionSeverity;
    source: PersonaVoice;
    payload?: Record<string, unknown>;
  }): ChatInvasionBeat | null {
    if (input.channel === 'DEAL_ROOM') return null;

    const crowdName = pick(CROWD_NAMES) ?? 'Spectator_01';
    const body = input.source.crowdEchoes && input.source.crowdEchoes.length > 0
      ? pick(input.source.crowdEchoes)!
      : this.defaultCrowdEcho(input.archetype, input.severity);

    return {
      id: this.nextId('beat'),
      channel: input.channel,
      actorId: `npc_${crowdName}`,
      actorName: crowdName,
      actorRole: 'NPC',
      kind: 'PLAYER',
      body,
      delayMs: this.stepDelay('crowd'),
      metadata: {
        stage: 'crowd',
        archetype: input.archetype,
      },
    };
  }

  private buildHelperBeat(input: {
    archetype: ChatInvasionArchetype;
    channel: ChatChannel;
    severity: ChatInvasionSeverity;
    source: PersonaVoice;
    payload?: Record<string, unknown>;
  }): ChatInvasionBeat | null {
    const mentor = PERSONAS.THE_MENTOR;
    const line = pick(mentor.helperIntercepts ?? []) ?? 'Slow down. Choose sequence over panic.';
    return {
      id: this.nextId('beat'),
      channel: input.channel === 'DEAL_ROOM' ? 'SYNDICATE' : input.channel,
      actorId: mentor.id,
      actorName: mentor.name,
      actorRole: 'HELPER',
      kind: 'SYSTEM',
      emoji: mentor.emoji,
      body: line,
      delayMs: this.config.helperInterventionDelayMs,
      metadata: {
        stage: 'helper',
        archetype: input.archetype,
      },
    };
  }

  private materializeBeatMessage(plan: ChatInvasionPlan, beat: ChatInvasionBeat): ChatMessage {
    const body = this.maskBeatBodyIfNeeded(beat.channel, beat.body);
    return {
      id: this.nextId('msg'),
      channel: beat.channel,
      kind: beat.kind,
      senderId: beat.actorId,
      senderName: beat.actorName,
      body,
      emoji: beat.emoji,
      ts: now(),
      immutable: beat.immutable,
      metadata: {
        invasionId: plan.id,
        invasionArchetype: plan.archetype,
        invasionSeverity: plan.severity,
        sourceRole: beat.actorRole,
        ...(beat.metadata ?? {}),
      },
    };
  }

  private maskBeatBodyIfNeeded(channel: ChatChannel, body: string): string {
    const decision = this.privacyPolicy.inspectOutboundDraft({
      channel,
      body,
      actorClass: 'SYSTEM',
    });
    if (decision.action === 'BLOCK' || decision.action === 'REDACT') {
      return decision.renderBody ?? body;
    }
    return decision.renderBody ?? body;
  }

  // ---------------------------------------------------------------------------
  // Private support
  // ---------------------------------------------------------------------------

  private classifyEventArchetype(
    event: string,
    payload?: Record<string, unknown>,
  ): ChatInvasionArchetype | null {
    if (event.includes('BOT_ATTACK') || event.includes('HATER')) return 'HATER_STRIKE';
    if (event.includes('SHIELD_LAYER_BREACHED') || event.includes('SHIELD_BREACH')) return 'SHIELD_BREAK';
    if (event.includes('CASCADE_CHAIN_TRIGGERED') || event.includes('CASCADE')) return 'CASCADE_SWARM';
    if (event.includes('BANKRUPTCY_WARNING') || event.includes('BANKRUPTCY_TRIGGERED')) return 'BANKRUPTCY_SHADOW';
    if (event.includes('PRESSURE_TIER_CHANGED') || event.includes('PRESSURE')) return 'PRESSURE_SURGE';
    if (event.includes('SOVEREIGNTY') && event.includes('DENIED')) return 'SOVEREIGNTY_DENIAL';
    if (event.includes('MARKET') || String(payload?.regime ?? '').length > 0) return 'MARKET_PANIC';
    if (this.runtime.isNegotiationWindow || this.runtime.dealId) return 'DEALROOM_AMBUSH';
    return null;
  }

  private scoreEventSeverity(
    archetype: ChatInvasionArchetype,
    event: string,
    payload?: Record<string, unknown>,
  ): ChatInvasionSeverity {
    let score = 0;
    score += pressureRank(this.runtime.pressureTier) * 8;
    score += clamp(this.runtime.haterHeat ?? 0, 0, 100) * 0.28;
    if (event.includes('BANKRUPTCY_TRIGGERED')) score += 40;
    if (event.includes('BANKRUPTCY_WARNING')) score += 28;
    if (event.includes('SHIELD_LAYER_BREACHED')) score += 22;
    if (event.includes('CASCADE')) score += 20;
    if (event.includes('BOT_ATTACK')) score += 16;
    if (String(payload?.targetLayer ?? '').length > 0) score += 8;
    if (this.runtime.isNegotiationWindow && archetype === 'DEALROOM_AMBUSH') score += 12;

    switch (archetype) {
      case 'BANKRUPTCY_SHADOW': score += 16; break;
      case 'SHIELD_BREAK': score += 14; break;
      case 'CASCADE_SWARM': score += 12; break;
      case 'HATER_STRIKE': score += 10; break;
      case 'DEALROOM_AMBUSH': score += 10; break;
      default: break;
    }

    if (score >= 72) return 'CRITICAL';
    if (score >= 48) return 'HIGH';
    if (score >= 24) return 'MEDIUM';
    return 'LOW';
  }

  private scoreSabotageSeverity(event: ChatSabotageEvent): ChatInvasionSeverity {
    let score = pressureRank(this.runtime.pressureTier) * 7;
    score += clamp(this.runtime.haterHeat ?? 0, 0, 100) * 0.25;
    if (String(event.targetLayer ?? '').length > 0) score += 10;
    if (String(event.attackType ?? '').toUpperCase().includes('OPPORTUNITY')) score += 12;
    if (this.runtime.isNegotiationWindow) score += 10;

    if (score >= 66) return 'CRITICAL';
    if (score >= 44) return 'HIGH';
    if (score >= 22) return 'MEDIUM';
    return 'LOW';
  }

  private resolveSourcePersona(
    archetype: ChatInvasionArchetype,
    payload?: Record<string, unknown>,
  ): PersonaVoice {
    const byName = normalizeText(String(payload?.botName ?? '')).toUpperCase();
    if (byName.includes('LIQUIDATOR')) return PERSONAS.THE_LIQUIDATOR;
    if (byName.includes('BUREAUCRAT')) return PERSONAS.THE_BUREAUCRAT;
    if (byName.includes('MANIPULATOR')) return PERSONAS.THE_MANIPULATOR;
    if (byName.includes('CRASH')) return PERSONAS.THE_CRASH_PROPHET;
    if (byName.includes('LEGACY')) return PERSONAS.THE_LEGACY_HEIR;

    switch (archetype) {
      case 'DEALROOM_AMBUSH': return PERSONAS.THE_MANIPULATOR;
      case 'PRESSURE_SURGE': return PERSONAS.THE_CRASH_PROPHET;
      case 'BANKRUPTCY_SHADOW': return PERSONAS.THE_LIQUIDATOR;
      case 'SYNDICATE_BREACH': return PERSONAS.THE_BUREAUCRAT;
      case 'SOVEREIGNTY_DENIAL': return PERSONAS.THE_LEGACY_HEIR;
      default: return PERSONAS.THE_LIQUIDATOR;
    }
  }

  private composeTitle(
    archetype: ChatInvasionArchetype,
    source: PersonaVoice,
    payload?: Record<string, unknown>,
  ): string {
    switch (archetype) {
      case 'HATER_STRIKE': return `${source.name} entered the channel`;
      case 'PRESSURE_SURGE': return 'Pressure surge invasion';
      case 'SHIELD_BREAK': return 'Shield break witnessed';
      case 'CASCADE_SWARM': return 'Cascade swarm expanding';
      case 'BANKRUPTCY_SHADOW': return 'Bankruptcy shadow encroaching';
      case 'DEALROOM_AMBUSH': return 'Deal Room ambush';
      case 'SYNDICATE_BREACH': return 'Syndicate breach warning';
      case 'SOVEREIGNTY_DENIAL': return 'Threshold denial attempt';
      case 'MARKET_PANIC': return `Market panic${payload?.regime ? ` · ${payload.regime}` : ''}`;
      default: return 'Chat invasion';
    }
  }

  private composeSummary(
    archetype: ChatInvasionArchetype,
    source: PersonaVoice,
    payload?: Record<string, unknown>,
  ): string {
    switch (archetype) {
      case 'HATER_STRIKE':
        return `${source.name} launched an invasive strike into the run.`;
      case 'PRESSURE_SURGE':
        return `Pressure escalated to ${this.runtime.pressureTier ?? 'HIGH'}. Chat witnesses are mobilizing.`;
      case 'SHIELD_BREAK':
        return `A shield layer buckled. The room noticed before recovery did.`;
      case 'CASCADE_SWARM':
        return `Cascade energy is spilling across the transcript.`;
      case 'BANKRUPTCY_SHADOW':
        return `The run entered a visible collapse window.`;
      case 'DEALROOM_AMBUSH':
        return `Negotiation space just turned predatory.`;
      case 'SYNDICATE_BREACH':
        return `Coordination space is under social pressure.`;
      case 'SOVEREIGNTY_DENIAL':
        return `The system is contesting a threshold transition.`;
      case 'MARKET_PANIC':
        return `Macro atmosphere shifted fast enough to become social theater.`;
      default:
        return `An invasion formed around ${String(payload?.eventName ?? 'run pressure')}.`;
    }
  }

  private systemLineForArchetype(
    archetype: ChatInvasionArchetype,
    severity: ChatInvasionSeverity,
    payload?: Record<string, unknown>,
  ): string {
    switch (archetype) {
      case 'HATER_STRIKE':
        return `HATER STRIKE — Severity ${severity}. Attack window opened${payload?.targetLayer ? ` on ${payload.targetLayer}` : ''}.`;
      case 'PRESSURE_SURGE':
        return `PRESSURE SURGE — ${this.runtime.pressureTier ?? 'HIGH'} pressure is now a social event, not just a numeric state.`;
      case 'SHIELD_BREAK':
        return `SHIELD BREAK — Integrity slipped low enough for the room to smell weakness.`;
      case 'CASCADE_SWARM':
        return `CASCADE SWARM — Linked failures are now visible inside chat theater.`;
      case 'BANKRUPTCY_SHADOW':
        return `BANKRUPTCY SHADOW — Collapse is no longer private.`;
      case 'DEALROOM_AMBUSH':
        return `DEAL ROOM AMBUSH — Negotiation pressure just weaponized silence.`;
      case 'SYNDICATE_BREACH':
        return `SYNDICATE BREACH — Internal coordination is under hostile observation.`;
      case 'SOVEREIGNTY_DENIAL':
        return `THRESHOLD DENIAL — The run is being contested at the edge of escape.`;
      case 'MARKET_PANIC':
        return `MARKET PANIC — Regime volatility is spilling into witness space.`;
      default:
        return `INVASION — The chat atmosphere shifted.`;
    }
  }

  private defaultCrowdEcho(
    archetype: ChatInvasionArchetype,
    severity: ChatInvasionSeverity,
  ): string {
    switch (archetype) {
      case 'SHIELD_BREAK': return 'that shield crack changed the whole room.';
      case 'CASCADE_SWARM': return 'you can feel the cascade through the feed now.';
      case 'BANKRUPTCY_SHADOW': return severity === 'CRITICAL'
        ? 'this is the kind of moment people remember after the run ends.'
        : 'careful. collapse windows punish fast and publicly.';
      case 'DEALROOM_AMBUSH': return 'deal room got icy fast.';
      default: return 'everyone saw that one.';
    }
  }

  private kindForArchetype(archetype: ChatInvasionArchetype): ChatMessage['kind'] {
    switch (archetype) {
      case 'PRESSURE_SURGE': return 'MARKET_ALERT';
      case 'SHIELD_BREAK': return 'SHIELD_EVENT';
      case 'CASCADE_SWARM': return 'CASCADE_ALERT';
      case 'DEALROOM_AMBUSH': return 'DEAL_ROOM';
      default: return 'SYSTEM';
    }
  }

  private computeStartDelay(severity: ChatInvasionSeverity): number {
    switch (severity) {
      case 'CRITICAL': return randomInt(80, 250);
      case 'HIGH': return randomInt(160, 420);
      case 'MEDIUM': return randomInt(250, 650);
      default: return randomInt(500, 1100);
    }
  }

  private stepDelay(stage: 'hater' | 'crowd' | 'helper'): number {
    const jitter = randomInt(0, this.config.sceneStepJitterMs);
    switch (stage) {
      case 'hater': return this.config.sceneStepBaseDelayMs + jitter;
      case 'crowd': return this.config.sceneStepBaseDelayMs + 260 + jitter;
      case 'helper': return this.config.helperInterventionDelayMs + jitter;
      default: return this.config.sceneStepBaseDelayMs + jitter;
    }
  }

  private stagePresence(plan: ChatInvasionPlan): void {
    if (!this.config.allowPresenceTheater) return;

    try {
      this.presenceController.stageNpcPresence({
        channel: plan.channel,
        participantId: plan.sourceId,
        displayName: plan.sourceName,
        role: plan.sourceRole === 'HATER'
          ? 'HATER'
          : plan.sourceRole === 'HELPER'
            ? 'HELPER'
            : 'NPC',
        aura: auraForSeverity(plan.severity),
        state: plan.sourceRole === 'HATER' ? 'ACTIVE' : 'IDLE',
        isLurking: plan.sourceRole === 'HATER',
        metadata: {
          invasionId: plan.id,
          archetype: plan.archetype,
        },
      });
    } catch (error) {
      this.emitError(createError('Failed to stage invasion presence.', error), {
        invasionId: plan.id,
      });
    }
  }

  private stageTypingBeat(beat: ChatInvasionBeat): void {
    try {
      const actorRole: ChatTypingTheaterActorRole = beat.actorRole === 'SYSTEM'
        ? 'NPC'
        : beat.actorRole;
      this.typingController.stageNpcTyping({
        actorId: beat.actorId,
        actorName: beat.actorName,
        actorRole,
        channel: beat.channel,
        durationMs: clamp(beat.body.length * 18, 900, 3_600),
        delayBeforeStartMs: Math.max(0, Math.floor(beat.delayMs * 0.4)),
        mood: beat.channel === 'DEAL_ROOM' ? 'PREDATORY' : beat.channel === 'SYNDICATE' ? 'INTIMATE' : 'SWARMING',
        textHint: beat.body.slice(0, 90),
        metadata: beat.metadata,
      });
    } catch (error) {
      this.emitError(createError('Failed to stage invasion typing theater.', error), {
        actorId: beat.actorId,
        channel: beat.channel,
      });
    }
  }

  private noteInvasionNotification(plan: ChatInvasionPlan): void {
    const event: ChatInvasionEvent = {
      id: plan.id,
      channel: plan.channel,
      title: plan.title,
      body: plan.body,
      ts: plan.createdAt,
      sourceId: plan.sourceId,
      severity: plan.severity,
      metadata: plan.metadata,
    };
    this.notificationController.noteInvasion(event);
  }

  private mirrorSocketEvent(event: string, plan: ChatInvasionPlan): void {
    if (!this.config.allowSocketMirror) return;
    this.socketClient.queueGameEvent({
      event,
      channel: plan.channel,
      roomId: this.runtime.roomId,
      metadata: {
        invasionId: plan.id,
        archetype: plan.archetype,
        severity: plan.severity,
        stage: plan.stage,
      },
    });
  }

  private cleanupPresenceTheater(plan: ChatInvasionPlan): void {
    try {
      this.presenceController.clearNpcPresence({
        channel: plan.channel,
        participantId: plan.sourceId,
      });
    } catch {
      // best effort cleanup
    }
  }

  private isDeduped(input: {
    archetype: ChatInvasionArchetype;
    eventName: string;
    severity: ChatInvasionSeverity;
    payload?: Record<string, unknown>;
  }): boolean {
    const key = this.buildDedupKey(input);
    const hit = this.recentDedup.get(key);
    if (!hit) return false;
    return hit > now();
  }

  private markDedup(input: {
    archetype: ChatInvasionArchetype;
    eventName: string;
    severity: ChatInvasionSeverity;
    payload?: Record<string, unknown>;
  }): void {
    const key = this.buildDedupKey(input);
    this.recentDedup.set(key, now() + this.config.dedupWindowMs);
  }

  private buildDedupKey(input: {
    archetype: ChatInvasionArchetype;
    eventName: string;
    severity: ChatInvasionSeverity;
    payload?: Record<string, unknown>;
  }): string {
    return [
      input.archetype,
      input.eventName,
      input.severity,
      String(input.payload?.botId ?? ''),
      String(input.payload?.targetLayer ?? ''),
      String(this.runtime.pressureTier ?? ''),
      String(this.runtime.tickTier ?? ''),
    ].join('|');
  }

  private isArchetypeCoolingDown(archetype: ChatInvasionArchetype): boolean {
    const until = this.archetypeCooldowns.get(archetype);
    return Boolean(until && until > now());
  }

  private isChannelCoolingDown(channel: ChatChannel): boolean {
    const until = this.channelCooldowns.get(channel);
    return Boolean(until && until > now());
  }

  private sweepDedup(): void {
    const timestamp = now();
    for (const [key, expiresAt] of this.recentDedup.entries()) {
      if (expiresAt <= timestamp) this.recentDedup.delete(key);
    }
  }

  private sweepExpiredPlans(): void {
    const timestamp = now();
    for (const [id, entry] of this.active.entries()) {
      if (entry.plan.expiresAt <= timestamp) {
        this.resolveInvasion(id, 'expired');
      }
    }
  }

  private pushHistory(plan: ChatInvasionPlan, resolution: ChatInvasionResolution): void {
    this.history.unshift({
      id: plan.id,
      archetype: plan.archetype,
      trigger: plan.trigger,
      channel: plan.channel,
      severity: plan.severity,
      createdAt: plan.createdAt,
      resolvedAt: now(),
      resolution,
    });
    if (this.history.length > this.config.historyLimit) {
      this.history.length = this.config.historyLimit;
    }
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${now()}_${this.sequence}`;
  }

  private getCooldownSnapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    const timestamp = now();
    for (const [channel, expiresAt] of this.channelCooldowns.entries()) {
      out[`channel:${channel}`] = Math.max(0, expiresAt - timestamp);
    }
    for (const [archetype, expiresAt] of this.archetypeCooldowns.entries()) {
      out[`archetype:${archetype}`] = Math.max(0, expiresAt - timestamp);
    }
    return out;
  }

  private emitSnapshot(): void {
    this.callbacks.onSnapshotChanged?.(this.getSnapshot());
  }

  private emitError(error: Error, context?: Record<string, unknown>): void {
    this.error?.(error.message, context);
    this.callbacks.onError?.(error, context);
  }

  private assertNotDestroyed(operation: string): void {
    if (this.destroyed) {
      throw createError(`ChatInvasionDirector.${operation} called after destroy().`);
    }
  }
}

function pick<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[randomInt(0, items.length - 1)];
}

function cloneRuntime(runtime: ChatInvasionRuntimeState): ChatInvasionRuntimeState {
  return {
    ...runtime,
    metadata: runtime.metadata ? { ...runtime.metadata } : undefined,
  };
}

function auraForSeverity(severity: ChatInvasionSeverity): string {
  switch (severity) {
    case 'CRITICAL': return 'blood-red';
    case 'HIGH': return 'amber';
    case 'MEDIUM': return 'violet';
    default: return 'blue';
  }
}

function systemEmojiForArchetype(archetype: ChatInvasionArchetype): string {
  switch (archetype) {
    case 'PRESSURE_SURGE': return '🔺';
    case 'SHIELD_BREAK': return '💔';
    case 'CASCADE_SWARM': return '⛓️';
    case 'BANKRUPTCY_SHADOW': return '☠️';
    case 'DEALROOM_AMBUSH': return '💼';
    case 'SYNDICATE_BREACH': return '🤝';
    case 'MARKET_PANIC': return '🚨';
    default: return '⚠️';
  }
}

export function createChatInvasionDirector(
  options: ChatInvasionDirectorOptions,
): ChatInvasionDirector {
  return new ChatInvasionDirector(options);
}
