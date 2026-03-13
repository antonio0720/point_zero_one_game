/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE MECHANICS BRIDGE ADAPTER
 * FILE: pzo-web/src/engines/chat/adapters/MechanicsBridgeAdapter.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical adapter that translates the mechanics runtime lane and the thin
 * MechanicsBridge context contract into the unified frontend chat engine spine.
 *
 * Why this file exists
 * --------------------
 * The repo already has two real mechanics-facing surfaces:
 *   1. pzo-web/src/store/mechanicsRuntimeStore.ts
 *   2. pzo-web/src/context/MechanicsBridgeContext.tsx
 *
 * The runtime store tracks per-mechanic heat, activations, confidence, signal,
 * hot IDs, ordered IDs, total activations, and last-updated tick. The bridge
 * context exposes touchMechanic(), touchFamily(), isMechanicActive(), snap, and
 * debugLog() to mechanics stubs without leaking App.tsx or React internals.
 *
 * Chat should not create a second mechanics language. Chat should consume that
 * mechanics truth, preserve its families and signals, and translate those
 * runtime semantics into social timing, ambient theater, helper cues, manual
 * witness, negotiation pressure, and ML/DL-friendly socket events.
 *
 * Repo truths preserved here
 * --------------------------
 * - mechanicsRuntimeStore is a runtime observability store, not a UI toy.
 * - It already tracks heat/confidence/signal/activations and hotMechanicIds.
 * - MechanicsBridgeContext is intentionally thin and exports touchMechanic,
 *   touchFamily, snap, isMechanicActive, and debugLog.
 * - The bridge is allowed to be no-op safe and dev-friendly.
 * - Mechanics data should inform chat; chat should not mutate mechanics truth.
 *
 * What this adapter owns
 * ----------------------
 * - mechanics runtime store subscription and normalization
 * - family-level aggregate classification
 * - activation / heat / confidence / signal surge detection
 * - bridge snapshot interpretation (tick / cash / regime / intelligence /
 *   season)
 * - optional instrumentation wrapper for touchMechanic() / touchFamily()
 * - routing into ChatChannelPolicy
 * - escalation into ChatInvasionDirector
 * - NPC witness / helper timing into ChatNpcDirector
 * - optional transcript witness / notification mirror / socket mirror
 *
 * Design laws
 * -----------
 * - Preserve mechanic families and IDs.
 * - Do not genericize runtime heat into fake drama.
 * - Hot mechanics are hints, not automatic invasions.
 * - Family surges deserve social interpretation only when density or signal is
 *   meaningful.
 * - Bridge snapshots may influence chat posture even when no single mechanic is
 *   shouting.
 * - The adapter may wrap bridge calls for instrumentation, but it may never
 *   change bridge behavior or validity rules.
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 * ============================================================================
 */

import {
  ChatSocketClient,
  type ChatChannel,
  type ChatGameEventIntent,
  type ChatMessage,
} from '../ChatSocketClient';

import {
  ChatChannelPolicy,
  type ChatModeSnapshot,
} from '../ChatChannelPolicy';

import {
  ChatInvasionDirector,
  type ChatInvasionArchetype,
  type ChatInvasionPlan,
  type ChatInvasionSeverity,
} from '../ChatInvasionDirector';

import {
  ChatNpcDirector,
  type ChatNpcContext,
  type ChatNpcPlan,
} from '../ChatNpcDirector';

import {
  ChatNotificationController,
  type ChatNotificationSeverity,
} from '../ChatNotificationController';

import {
  ChatTranscriptBuffer,
} from '../ChatTranscriptBuffer';

// -----------------------------------------------------------------------------
// Repo-facing compatibility contracts
// -----------------------------------------------------------------------------

export type MechanicFamily =
  | 'replay'
  | 'economy'
  | 'risk'
  | 'market'
  | 'cards'
  | 'progression'
  | 'social'
  | 'telemetry'
  | 'pvp'
  | 'season'
  | 'ai'
  | 'anti_cheat'
  | 'narrative'
  | 'ops'
  | 'unknown';

export interface MechanicsIntelligenceSnapshot {
  alpha: number;
  risk: number;
  volatility: number;
  momentum: number;
  churnRisk: number;
  recommendationPower: number;
}

export interface MechanicsSeasonSnapshot {
  xp: number;
  passTier: number;
  dominionControl: number;
  winStreak: number;
}

export interface MechanicsBridgeRuntimeSnapshot {
  tick: number;
  cash: number;
  regime: string;
  intelligence: MechanicsIntelligenceSnapshot;
  season: MechanicsSeasonSnapshot;
}

export interface MechanicRuntimeEntry {
  mechanicId: string;
  taskId: string;
  title: string;
  family: string;
  kind: 'core' | 'ml';
  layer: string;
  priority: 1 | 2 | 3;
  batch: 1 | 2 | 3;
  status: string;
  deps: string[];
  execHook: string;
  telemetryEvents: string[];
  heat: number;
  activations: number;
  confidence: number;
  signal: number;
  lastTick: number | null;
  lastActivatedAt: number | null;
}

export interface MechanicsRuntimeStoreSlice {
  runId: string | null;
  isInitialized: boolean;
  totalActivations: number;
  lastUpdatedTick: number;
  hotMechanicIds: string[];
  orderedIds: string[];
  mechanicsById: Record<string, MechanicRuntimeEntry>;
}

export interface MechanicsRuntimeStoreLike {
  getState(): MechanicsRuntimeStoreSlice;
  subscribe(
    listener: (next: MechanicsRuntimeStoreSlice, previous: MechanicsRuntimeStoreSlice) => void,
  ): (() => void) | { unsubscribe?: () => void } | void;
}

export interface MechanicTriggerPayload {
  signal?: number;
  reason?: string;
}

export interface MechanicsBridgeAPI {
  touchMechanic: (id: string, payload?: MechanicTriggerPayload) => void;
  touchFamily: (family: MechanicFamily, payload?: MechanicTriggerPayload) => void;
  isMechanicActive: (id: string) => boolean;
  snap: MechanicsBridgeRuntimeSnapshot;
  debugLog: (mechanicId: string, msg: string) => void;
}

export type MechanicsDeltaEventName =
  | 'MECHANICS_RUNTIME_INITIALIZED'
  | 'MECHANIC_ACTIVATED'
  | 'MECHANIC_HEAT_SPIKE'
  | 'MECHANIC_CONFIDENCE_SPIKE'
  | 'MECHANIC_SIGNAL_SPIKE'
  | 'MECHANIC_FAMILY_SURGE'
  | 'MECHANIC_HOT_SET_CHANGED'
  | 'BRIDGE_TOUCH_MECHANIC'
  | 'BRIDGE_TOUCH_FAMILY'
  | 'BRIDGE_RUNTIME_SNAPSHOT'
  | 'INTELLIGENCE_ALERT'
  | 'SEASON_SURGE'
  | 'DOMINION_PUSH';

export type MechanicsFamilyNarrativeBand =
  | 'CALM'
  | 'WATCH'
  | 'ACTIVE'
  | 'SURGING'
  | 'THEATRICAL';

export type MechanicsRecommendationIntent =
  | 'LEAN_INTO_MOMENTUM'
  | 'COOL_RISK_CLUSTER'
  | 'WATCH_CHURN'
  | 'EXPLOIT_RECOMMENDATION_POWER'
  | 'TURN_FAMILY_SURGE_INTO_ACTION'
  | 'PROTECT_DOMINION_PUSH'
  | 'CLEAR_SIGNAL_NOISE';

export interface MechanicsRecommendation {
  id: string;
  intent: MechanicsRecommendationIntent;
  title: string;
  body: string;
  priority: number;
  channel: ChatChannel;
  severity: ChatNotificationSeverity;
  metadata?: Record<string, unknown>;
}

export interface MechanicsBridgeAdapterHistoryEntry {
  ts: number;
  eventName: MechanicsDeltaEventName;
  family?: MechanicFamily;
  channel: ChatChannel;
  narrativeBand: MechanicsFamilyNarrativeBand;
  dedupKey: string;
  metadata?: Record<string, unknown>;
}

export interface MechanicsBridgeAdapterSnapshot {
  bound: boolean;
  activeChannel: ChatChannel;
  hotMechanicIds: string[];
  topFamilies: Array<{
    family: MechanicFamily;
    activationCount: number;
    avgHeat: number;
    avgConfidence: number;
    avgSignal: number;
    narrativeBand: MechanicsFamilyNarrativeBand;
  }>;
  bridgeSnapshot: MechanicsBridgeRuntimeSnapshot | null;
  runtimeSnapshot: MechanicsRuntimeStoreSlice | null;
  lastRecommendationsAt: number | null;
  recommendations: MechanicsRecommendation[];
  history: MechanicsBridgeAdapterHistoryEntry[];
  counters: {
    deltaEventsProcessed: number;
    fallbackWitnessCount: number;
    activationsObserved: number;
    heatSpikes: number;
    signalSpikes: number;
    confidenceSpikes: number;
    familySurges: number;
    bridgeTouches: number;
  };
}

export interface MechanicsBridgeAdapterCallbacks {
  onNormalizedEvent?: (entry: MechanicsBridgeAdapterHistoryEntry) => void;
  onRecommendationsChanged?: (items: MechanicsRecommendation[]) => void;
  onSnapshotChanged?: (snapshot: MechanicsBridgeAdapterSnapshot) => void;
}

export interface MechanicsBridgeThresholds {
  heatSpike: number;
  confidenceSpike: number;
  signalSpike: number;
  familySurgeActivationCount: number;
  familySurgeAvgHeat: number;
  hotSetTheatricalCount: number;
  churnRiskHigh: number;
  recommendationPowerHigh: number;
  dominionPushHigh: number;
  winStreakPush: number;
}

export interface MechanicsBridgeAdapterConfig {
  eventDedupWindowMs: number;
  witnessDedupWindowMs: number;
  pollingFallbackMs: number;
  maxHistory: number;
  maxRecommendations: number;
  emitSocketGameEvents: boolean;
  emitTranscriptWitness: boolean;
  emitNotifications: boolean;
  allowFallbackWitness: boolean;
  emitBridgeTouchWitness: boolean;
  thresholds: MechanicsBridgeThresholds;
}

export interface MechanicsBridgeAdapterOptions {
  mechanicsRuntimeStore?: MechanicsRuntimeStoreLike;
  bridgeApi?: MechanicsBridgeAPI;
  channelPolicy: ChatChannelPolicy;
  invasionDirector: ChatInvasionDirector;
  npcDirector: ChatNpcDirector;
  socketClient?: ChatSocketClient;
  transcriptBuffer?: ChatTranscriptBuffer;
  notificationController?: ChatNotificationController;
  activeChannel?: ChatChannel;
  config?: Partial<MechanicsBridgeAdapterConfig>;
  callbacks?: MechanicsBridgeAdapterCallbacks;
}

const DEFAULT_THRESHOLDS: MechanicsBridgeThresholds = deepFreeze({
  heatSpike: 1.0,
  confidenceSpike: 0.15,
  signalSpike: 1.2,
  familySurgeActivationCount: 4,
  familySurgeAvgHeat: 0.85,
  hotSetTheatricalCount: 5,
  churnRiskHigh: 0.72,
  recommendationPowerHigh: 0.72,
  dominionPushHigh: 70,
  winStreakPush: 3,
});

const DEFAULT_CONFIG: MechanicsBridgeAdapterConfig = deepFreeze({
  eventDedupWindowMs: 7_500,
  witnessDedupWindowMs: 16_000,
  pollingFallbackMs: 2_500,
  maxHistory: 260,
  maxRecommendations: 8,
  emitSocketGameEvents: true,
  emitTranscriptWitness: true,
  emitNotifications: true,
  allowFallbackWitness: true,
  emitBridgeTouchWitness: false,
  thresholds: DEFAULT_THRESHOLDS,
});

export class MechanicsBridgeAdapter {
  private readonly mechanicsRuntimeStore?: MechanicsRuntimeStoreLike;
  private readonly bridgeApi?: MechanicsBridgeAPI;
  private readonly channelPolicy: ChatChannelPolicy;
  private readonly invasionDirector: ChatInvasionDirector;
  private readonly npcDirector: ChatNpcDirector;
  private readonly socketClient?: ChatSocketClient;
  private readonly transcriptBuffer?: ChatTranscriptBuffer;
  private readonly notificationController?: ChatNotificationController;
  private readonly callbacks?: MechanicsBridgeAdapterCallbacks;
  private readonly config: MechanicsBridgeAdapterConfig;

  private unsubscribe: (() => void) | null = null;
  private pollingHandle: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  private activeChannel: ChatChannel;
  private lastRuntimeSnapshot: MechanicsRuntimeStoreSlice | null = null;
  private lastBridgeSnapshot: MechanicsBridgeRuntimeSnapshot | null = null;
  private topFamilies: FamilyAggregate[] = [];
  private hotMechanicIds: string[] = [];
  private recommendations: MechanicsRecommendation[] = [];
  private lastRecommendationsAt: number | null = null;
  private history: MechanicsBridgeAdapterHistoryEntry[] = [];
  private dedupMap = new Map<string, number>();

  private counters = {
    deltaEventsProcessed: 0,
    fallbackWitnessCount: 0,
    activationsObserved: 0,
    heatSpikes: 0,
    signalSpikes: 0,
    confidenceSpikes: 0,
    familySurges: 0,
    bridgeTouches: 0,
  };

  public constructor(options: MechanicsBridgeAdapterOptions) {
    this.mechanicsRuntimeStore = options.mechanicsRuntimeStore;
    this.bridgeApi = options.bridgeApi;
    this.channelPolicy = options.channelPolicy;
    this.invasionDirector = options.invasionDirector;
    this.npcDirector = options.npcDirector;
    this.socketClient = options.socketClient;
    this.transcriptBuffer = options.transcriptBuffer;
    this.notificationController = options.notificationController;
    this.callbacks = options.callbacks;
    this.config = mergeConfig(DEFAULT_CONFIG, options.config);
    this.activeChannel = options.activeChannel ?? 'GLOBAL';

    this.bind();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.pollingHandle) {
      clearInterval(this.pollingHandle);
      this.pollingHandle = null;
    }
    this.dedupMap.clear();
    this.emitSnapshot();
  }

  public getSnapshot(): MechanicsBridgeAdapterSnapshot {
    return deepFreeze({
      bound: Boolean(this.unsubscribe || this.pollingHandle || this.bridgeApi),
      activeChannel: this.activeChannel,
      hotMechanicIds: [...this.hotMechanicIds],
      topFamilies: this.topFamilies.map((item) => ({ ...item })),
      bridgeSnapshot: this.lastBridgeSnapshot ? cloneBridgeSnapshot(this.lastBridgeSnapshot) : null,
      runtimeSnapshot: this.lastRuntimeSnapshot ? cloneRuntimeSlice(this.lastRuntimeSnapshot) : null,
      lastRecommendationsAt: this.lastRecommendationsAt,
      recommendations: this.recommendations.map((item) => ({ ...item, metadata: item.metadata ? { ...item.metadata } : undefined })),
      history: this.history.map((item) => ({ ...item, metadata: item.metadata ? { ...item.metadata } : undefined })),
      counters: { ...this.counters },
    });
  }

  public setActiveChannel(channel: ChatChannel): void {
    this.assertAlive('setActiveChannel');
    this.activeChannel = channel;
    this.emitSnapshot();
  }

  public syncFromRuntime(reason: string = 'manual_sync'): void {
    this.assertAlive('syncFromRuntime');
    if (!this.mechanicsRuntimeStore) return;
    const next = normalizeRuntimeSlice(this.mechanicsRuntimeStore.getState());
    this.handleRuntimeChange(next, this.lastRuntimeSnapshot, reason);
  }

  public noteBridgeSnapshot(snapshot: MechanicsBridgeRuntimeSnapshot, reason: string = 'bridge_snapshot'): void {
    this.assertAlive('noteBridgeSnapshot');
    const next = normalizeBridgeSnapshot(snapshot);
    const previous = this.lastBridgeSnapshot;
    this.lastBridgeSnapshot = next;
    this.applyModeSnapshot(next, this.lastRuntimeSnapshot, reason);
    this.forwardSocketGameEvent('BRIDGE_RUNTIME_SNAPSHOT', {
      reason,
      tick: next.tick,
      cash: next.cash,
      regime: next.regime,
      intelligence: next.intelligence,
      season: next.season,
    });

    const events = this.computeBridgeEvents(next, previous);
    const ts = now();
    for (const eventName of events) {
      this.processBridgeEvent(eventName, next, previous, ts);
    }

    this.recomputeRecommendations(reason, this.lastRuntimeSnapshot, next, ts);
    this.emitSnapshot();
  }

  public wrapBridgeApi(api: MechanicsBridgeAPI = this.bridgeApi ?? createNoopBridgeApi()): MechanicsBridgeAPI {
    this.assertAlive('wrapBridgeApi');
    const self = this;
    return {
      touchMechanic(id, payload) {
        self.noteBridgeTouchMechanic(id, payload);
        api.touchMechanic(id, payload);
      },
      touchFamily(family, payload) {
        self.noteBridgeTouchFamily(family, payload);
        api.touchFamily(family, payload);
      },
      isMechanicActive(id) {
        return api.isMechanicActive(id);
      },
      get snap() {
        return api.snap;
      },
      debugLog(mechanicId, msg) {
        self.noteBridgeDebug(mechanicId, msg);
        api.debugLog(mechanicId, msg);
      },
    };
  }

  public noteBridgeTouchMechanic(id: string, payload?: MechanicTriggerPayload): void {
    this.assertAlive('noteBridgeTouchMechanic');
    this.counters.bridgeTouches += 1;
    const ts = now();
    const channel = resolveWitnessChannel(this.channelPolicy, chooseBridgeTouchChannel(id, this.activeChannel));
    const dedupKey = `touch.mechanic:${normalizeMechanicId(id)}:${roundedBucket(payload?.signal ?? 0.12, 0.05)}:${payload?.reason ?? ''}`;
    if (this.isDeduped(dedupKey, ts, this.config.eventDedupWindowMs)) return;

    const entry: MechanicsBridgeAdapterHistoryEntry = {
      ts,
      eventName: 'BRIDGE_TOUCH_MECHANIC',
      family: inferFamilyFromMechanicId(id),
      channel,
      narrativeBand: 'ACTIVE',
      dedupKey,
      metadata: {
        mechanicId: normalizeMechanicId(id),
        signal: payload?.signal ?? 0.12,
        reason: payload?.reason,
      },
    };

    this.recordEvent(entry);
    this.forwardSocketGameEvent('BRIDGE_TOUCH_MECHANIC', entry.metadata);

    if (this.config.emitBridgeTouchWitness) {
      this.emitWitness({
        channel,
        title: 'Mechanic touched',
        body: `${normalizeMechanicId(id)} was touched through the bridge${payload?.reason ? ` — ${payload.reason}` : ''}.`,
        severity: 'INFO',
        metadata: { source: 'MechanicsBridgeAdapter.touch_mechanic', ...entry.metadata },
        kind: 'BRIDGE_TOUCH_MECHANIC',
      });
    }
  }

  public noteBridgeTouchFamily(family: MechanicFamily, payload?: MechanicTriggerPayload): void {
    this.assertAlive('noteBridgeTouchFamily');
    this.counters.bridgeTouches += 1;
    const ts = now();
    const channel = resolveWitnessChannel(this.channelPolicy, chooseFamilyChannel(family, this.channelPolicy, this.activeChannel));
    const dedupKey = `touch.family:${family}:${roundedBucket(payload?.signal ?? 0.10, 0.05)}:${payload?.reason ?? ''}`;
    if (this.isDeduped(dedupKey, ts, this.config.eventDedupWindowMs)) return;

    const entry: MechanicsBridgeAdapterHistoryEntry = {
      ts,
      eventName: 'BRIDGE_TOUCH_FAMILY',
      family,
      channel,
      narrativeBand: 'ACTIVE',
      dedupKey,
      metadata: {
        family,
        signal: payload?.signal ?? 0.10,
        reason: payload?.reason,
      },
    };

    this.recordEvent(entry);
    this.forwardSocketGameEvent('BRIDGE_TOUCH_FAMILY', entry.metadata);

    if (this.config.emitBridgeTouchWitness) {
      this.emitWitness({
        channel,
        title: 'Mechanic family touched',
        body: `${family} mechanics were signaled through the bridge${payload?.reason ? ` — ${payload.reason}` : ''}.`,
        severity: family === 'risk' || family === 'market' ? 'WARN' : 'INFO',
        metadata: { source: 'MechanicsBridgeAdapter.touch_family', ...entry.metadata },
        kind: 'BRIDGE_TOUCH_FAMILY',
      });
    }
  }

  public noteBridgeDebug(mechanicId: string, message: string): void {
    this.assertAlive('noteBridgeDebug');
    this.forwardSocketGameEvent('BRIDGE_DEBUG_LOG', {
      mechanicId: normalizeMechanicId(mechanicId),
      message,
    });
  }

  // ---------------------------------------------------------------------------
  // Binding
  // ---------------------------------------------------------------------------

  private bind(): void {
    if (this.mechanicsRuntimeStore) {
      const initial = normalizeRuntimeSlice(this.mechanicsRuntimeStore.getState());
      this.lastRuntimeSnapshot = initial;
      this.hotMechanicIds = [...initial.hotMechanicIds];
      this.topFamilies = aggregateFamilies(initial);
      this.applyModeSnapshot(this.lastBridgeSnapshot, initial, 'initial_bind');
      this.recomputeRecommendations('initial_bind', initial, this.lastBridgeSnapshot, now());

      const maybeUnsub = this.mechanicsRuntimeStore.subscribe((next, previous) => {
        this.handleRuntimeChange(normalizeRuntimeSlice(next), normalizeRuntimeSlice(previous), 'subscribe');
      });
      this.unsubscribe = normalizeUnsubscribe(maybeUnsub);

      if (!this.unsubscribe) {
        this.pollingHandle = setInterval(() => {
          const next = normalizeRuntimeSlice(this.mechanicsRuntimeStore!.getState());
          if (!this.lastRuntimeSnapshot || !equalRuntimeSlices(next, this.lastRuntimeSnapshot)) {
            this.handleRuntimeChange(next, this.lastRuntimeSnapshot, 'polling_fallback');
          }
        }, this.config.pollingFallbackMs);
      }
    }

    if (this.bridgeApi) {
      this.noteBridgeSnapshot(this.bridgeApi.snap, 'bridge_api_initial');
    } else {
      this.emitSnapshot();
    }
  }

  // ---------------------------------------------------------------------------
  // Runtime change handling
  // ---------------------------------------------------------------------------

  private handleRuntimeChange(
    next: MechanicsRuntimeStoreSlice,
    previous: MechanicsRuntimeStoreSlice | null,
    reason: string,
  ): void {
    if (this.destroyed) return;

    const ts = now();
    this.lastRuntimeSnapshot = next;
    this.hotMechanicIds = [...next.hotMechanicIds];
    this.topFamilies = aggregateFamilies(next);
    this.evictDedup(ts);
    this.applyModeSnapshot(this.lastBridgeSnapshot, next, reason);

    this.forwardSocketGameEvent('MECHANICS_RUNTIME_SNAPSHOT_UPDATED', {
      reason,
      runId: next.runId,
      isInitialized: next.isInitialized,
      totalActivations: next.totalActivations,
      lastUpdatedTick: next.lastUpdatedTick,
      hotMechanicIds: next.hotMechanicIds,
    });

    const deltaEvents = this.computeRuntimeEvents(next, previous);
    for (const event of deltaEvents) {
      this.processRuntimeEvent(event, next, previous, ts);
    }

    this.recomputeRecommendations(reason, next, this.lastBridgeSnapshot, ts);
    this.emitSnapshot();
  }

  private computeRuntimeEvents(
    next: MechanicsRuntimeStoreSlice,
    previous: MechanicsRuntimeStoreSlice | null,
  ): MechanicsDeltaEventName[] {
    const out: MechanicsDeltaEventName[] = [];

    if (!previous) {
      out.push('MECHANICS_RUNTIME_INITIALIZED');
      return out;
    }

    if (!previous.isInitialized && next.isInitialized) out.push('MECHANICS_RUNTIME_INITIALIZED');
    if (next.totalActivations > previous.totalActivations) out.push('MECHANIC_ACTIVATED');

    const hotChanged = stableStringify(next.hotMechanicIds) !== stableStringify(previous.hotMechanicIds);
    if (hotChanged) out.push('MECHANIC_HOT_SET_CHANGED');

    if (detectHeatSpike(next, previous, this.config.thresholds.heatSpike)) out.push('MECHANIC_HEAT_SPIKE');
    if (detectConfidenceSpike(next, previous, this.config.thresholds.confidenceSpike)) out.push('MECHANIC_CONFIDENCE_SPIKE');
    if (detectSignalSpike(next, previous, this.config.thresholds.signalSpike)) out.push('MECHANIC_SIGNAL_SPIKE');
    if (detectFamilySurge(next, this.config.thresholds)) out.push('MECHANIC_FAMILY_SURGE');

    return dedupe(out);
  }

  private computeBridgeEvents(
    next: MechanicsBridgeRuntimeSnapshot,
    previous: MechanicsBridgeRuntimeSnapshot | null,
  ): MechanicsDeltaEventName[] {
    const out: MechanicsDeltaEventName[] = ['BRIDGE_RUNTIME_SNAPSHOT'];
    if (!previous) return out;

    if (
      next.intelligence.churnRisk >= this.config.thresholds.churnRiskHigh
      && previous.intelligence.churnRisk < this.config.thresholds.churnRiskHigh
    ) out.push('INTELLIGENCE_ALERT');

    if (
      next.intelligence.recommendationPower >= this.config.thresholds.recommendationPowerHigh
      && previous.intelligence.recommendationPower < this.config.thresholds.recommendationPowerHigh
    ) out.push('INTELLIGENCE_ALERT');

    if (
      next.season.dominionControl >= this.config.thresholds.dominionPushHigh
      && previous.season.dominionControl < this.config.thresholds.dominionPushHigh
    ) out.push('DOMINION_PUSH');

    if (
      next.season.winStreak >= this.config.thresholds.winStreakPush
      && previous.season.winStreak < this.config.thresholds.winStreakPush
    ) out.push('SEASON_SURGE');

    return dedupe(out);
  }

  private processRuntimeEvent(
    eventName: MechanicsDeltaEventName,
    next: MechanicsRuntimeStoreSlice,
    previous: MechanicsRuntimeStoreSlice | null,
    ts: number,
  ): void {
    const family = dominantFamily(next);
    const channel = chooseRuntimeEventChannel(eventName, family, this.channelPolicy, this.activeChannel);
    const narrativeBand = dominantNarrativeBand(next, family, this.config.thresholds);
    const dedupKey = buildRuntimeDedupKey(eventName, next, previous, family, channel);
    const dedupWindow = eventName === 'MECHANIC_ACTIVATED' ? this.config.eventDedupWindowMs : this.config.witnessDedupWindowMs;
    if (this.isDeduped(dedupKey, ts, dedupWindow)) return;

    const metadata = {
      runId: next.runId,
      totalActivations: next.totalActivations,
      lastUpdatedTick: next.lastUpdatedTick,
      hotMechanicIds: next.hotMechanicIds,
      dominantFamily: family,
    } as Record<string, unknown>;

    this.recordEvent({
      ts,
      eventName,
      family,
      channel,
      narrativeBand,
      dedupKey,
      metadata,
    });

    this.counters.deltaEventsProcessed += 1;

    switch (eventName) {
      case 'MECHANICS_RUNTIME_INITIALIZED':
        this.npcDirector.handleGameEvent({
          eventType: 'GAME_START',
          payload: metadata,
          preferredChannel: 'LOBBY',
          ts,
          metadata: { source: 'MechanicsBridgeAdapter.runtime_initialized' },
        });
        if (this.config.allowFallbackWitness) {
          this.emitWitness({
            channel: 'LOBBY',
            title: 'Mechanics runtime initialized',
            body: `Mechanics runtime is bound with ${next.orderedIds.length} registered mechanics.`,
            severity: 'INFO',
            metadata: { source: 'MechanicsBridgeAdapter.runtime_initialized' },
            kind: eventName,
          });
        }
        break;

      case 'MECHANIC_ACTIVATED':
        this.counters.activationsObserved += 1;
        if (family === 'cards') {
          this.npcDirector.handleGameEvent({
            eventType: 'PLAYER_CARD_PLAY',
            payload: metadata,
            preferredChannel: channel,
            ts,
            metadata: { source: 'MechanicsBridgeAdapter.mechanic_activated' },
          });
        } else if (family === 'economy' || family === 'progression') {
          this.npcDirector.handleGameEvent({
            eventType: 'PLAYER_INCOME_UP',
            payload: metadata,
            preferredChannel: channel,
            ts,
            metadata: { source: 'MechanicsBridgeAdapter.mechanic_activated' },
          });
        } else if (family === 'risk' || family === 'market') {
          this.npcDirector.handleGameEvent({
            eventType: 'MARKET_ALERT',
            payload: metadata,
            preferredChannel: channel,
            ts,
            metadata: { source: 'MechanicsBridgeAdapter.mechanic_activated' },
          });
        }
        break;

      case 'MECHANIC_HEAT_SPIKE':
        this.counters.heatSpikes += 1;
        {
          const context = familyToNpcContext(family, narrativeBand, this.lastBridgeSnapshot);
          const plans = this.npcDirector.handleGameEvent({
            eventType: contextToEventName(context),
            payload: metadata,
            preferredChannel: channel,
            ts,
            metadata: { source: 'MechanicsBridgeAdapter.heat_spike', context },
          });
          const invasion = maybeStageInvasionFromFamily(this.invasionDirector, family, narrativeBand, metadata, channel);
          if (!invasion && plans.length === 0 && this.config.allowFallbackWitness) {
            this.emitWitness({
              channel,
              title: 'Mechanic heat spike',
              body: `${family ?? 'unknown'} mechanics pushed into a hotter runtime band.`,
              severity: narrativeBand === 'THEATRICAL' ? 'WARN' : 'INFO',
              metadata: { source: 'MechanicsBridgeAdapter.heat_spike', family, narrativeBand },
              kind: eventName,
            });
          }
        }
        break;

      case 'MECHANIC_SIGNAL_SPIKE':
        this.counters.signalSpikes += 1;
        this.npcDirector.handleGameEvent({
          eventType: family === 'risk' || family === 'market' ? 'TIME_PRESSURE' : 'MARKET_ALERT',
          payload: metadata,
          preferredChannel: channel,
          ts,
          metadata: { source: 'MechanicsBridgeAdapter.signal_spike' },
        });
        break;

      case 'MECHANIC_CONFIDENCE_SPIKE':
        this.counters.confidenceSpikes += 1;
        if (family === 'economy' || family === 'season' || family === 'progression') {
          this.npcDirector.handleGameEvent({
            eventType: 'PLAYER_COMEBACK',
            payload: metadata,
            preferredChannel: channel,
            ts,
            metadata: { source: 'MechanicsBridgeAdapter.confidence_spike' },
          });
        }
        break;

      case 'MECHANIC_FAMILY_SURGE':
        this.counters.familySurges += 1;
        {
          const invasion = maybeStageInvasionFromFamily(this.invasionDirector, family, 'THEATRICAL', metadata, channel);
          const plans = this.npcDirector.handleGameEvent({
            eventType: contextToEventName(familyToNpcContext(family, 'THEATRICAL', this.lastBridgeSnapshot)),
            payload: metadata,
            preferredChannel: channel,
            ts,
            metadata: { source: 'MechanicsBridgeAdapter.family_surge' },
          });
          if (!invasion && plans.length === 0 && this.config.allowFallbackWitness) {
            this.emitWitness({
              channel,
              title: 'Mechanic family surge',
              body: `${family ?? 'unknown'} mechanics are moving as a cluster instead of isolated pings.`,
              severity: 'WARN',
              metadata: { source: 'MechanicsBridgeAdapter.family_surge', family },
              kind: eventName,
            });
          }
        }
        break;

      case 'MECHANIC_HOT_SET_CHANGED':
        if (next.hotMechanicIds.length >= this.config.thresholds.hotSetTheatricalCount && this.config.allowFallbackWitness) {
          this.emitWitness({
            channel,
            title: 'Hot mechanic set expanded',
            body: `${next.hotMechanicIds.length} mechanics are now in the hot set. System pressure is compounding across families.`,
            severity: 'WARN',
            metadata: { source: 'MechanicsBridgeAdapter.hot_set_changed', hotMechanicIds: next.hotMechanicIds },
            kind: eventName,
          });
        }
        break;

      default:
        break;
    }
  }

  private processBridgeEvent(
    eventName: MechanicsDeltaEventName,
    next: MechanicsBridgeRuntimeSnapshot,
    previous: MechanicsBridgeRuntimeSnapshot | null,
    ts: number,
  ): void {
    const channel = chooseBridgeSnapshotChannel(next, this.channelPolicy, this.activeChannel);
    const narrativeBand = classifyBridgeNarrativeBand(next, this.config.thresholds);
    const dedupKey = buildBridgeDedupKey(eventName, next, previous, channel);
    if (this.isDeduped(dedupKey, ts, this.config.witnessDedupWindowMs)) return;

    const metadata = {
      tick: next.tick,
      cash: next.cash,
      regime: next.regime,
      intelligence: next.intelligence,
      season: next.season,
    } as Record<string, unknown>;

    this.recordEvent({
      ts,
      eventName,
      family: undefined,
      channel,
      narrativeBand,
      dedupKey,
      metadata,
    });

    this.counters.deltaEventsProcessed += 1;

    switch (eventName) {
      case 'INTELLIGENCE_ALERT':
        this.npcDirector.handleGameEvent({
          eventType: 'TIME_PRESSURE',
          payload: metadata,
          preferredChannel: channel,
          ts,
          metadata: { source: 'MechanicsBridgeAdapter.intelligence_alert' },
        });
        if (next.intelligence.churnRisk >= this.config.thresholds.churnRiskHigh) {
          this.invasionDirector.handleGameEvent({
            event: 'PRESSURE_TIER_CHANGED',
            payload: metadata,
            preferredChannels: [channel, 'GLOBAL', 'SYNDICATE'],
          });
        }
        break;

      case 'SEASON_SURGE':
        this.npcDirector.handleGameEvent({
          eventType: 'PLAYER_COMEBACK',
          payload: metadata,
          preferredChannel: channel,
          ts,
          metadata: { source: 'MechanicsBridgeAdapter.season_surge' },
        });
        break;

      case 'DOMINION_PUSH':
        this.npcDirector.handleGameEvent({
          eventType: 'NEAR_SOVEREIGNTY',
          payload: metadata,
          preferredChannel: channel,
          ts,
          metadata: { source: 'MechanicsBridgeAdapter.dominion_push' },
        });
        if (this.config.allowFallbackWitness) {
          this.emitWitness({
            channel,
            title: 'Dominion push',
            body: `Dominion control reached ${round(next.season.dominionControl, 1)}. The run is leaning into a sovereignty-adjacent lane.`,
            severity: 'WARN',
            metadata: { source: 'MechanicsBridgeAdapter.dominion_push', dominionControl: next.season.dominionControl },
            kind: eventName,
          });
        }
        break;

      case 'BRIDGE_RUNTIME_SNAPSHOT':
        if (this.config.allowFallbackWitness && shouldWitnessBridgeSnapshot(next, previous)) {
          this.emitWitness({
            channel,
            title: 'Bridge snapshot updated',
            body: `Tick ${next.tick} in ${next.regime}. Recommendation power ${round(next.intelligence.recommendationPower, 2)}, churn risk ${round(next.intelligence.churnRisk, 2)}.`,
            severity: narrativeBand === 'THEATRICAL' ? 'WARN' : 'INFO',
            metadata: { source: 'MechanicsBridgeAdapter.bridge_snapshot' },
            kind: eventName,
          });
        }
        break;

      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Recommendation engine
  // ---------------------------------------------------------------------------

  private recomputeRecommendations(
    reason: string,
    runtimeSlice: MechanicsRuntimeStoreSlice | null,
    bridgeSnapshot: MechanicsBridgeRuntimeSnapshot | null,
    ts: number,
  ): void {
    const recommendations: MechanicsRecommendation[] = [];

    const dominant = runtimeSlice ? dominantFamily(runtimeSlice) : undefined;
    const dominantBand = runtimeSlice ? dominantNarrativeBand(runtimeSlice, dominant, this.config.thresholds) : 'CALM';

    if (runtimeSlice && dominant && (dominant === 'risk' || dominant === 'market') && dominantBand !== 'CALM') {
      recommendations.push({
        id: `rec:risk:${dominantBand}`,
        intent: 'COOL_RISK_CLUSTER',
        title: 'Cool the risk cluster',
        body: `${dominant} mechanics are running hot. Convert signal into a controlled response, not panic theater.`,
        priority: 95,
        channel: chooseFamilyChannel(dominant, this.channelPolicy, this.activeChannel),
        severity: 'WARN',
      });
    }

    if (bridgeSnapshot && bridgeSnapshot.intelligence.churnRisk >= this.config.thresholds.churnRiskHigh) {
      recommendations.push({
        id: `rec:churn:${round(bridgeSnapshot.intelligence.churnRisk, 2)}`,
        intent: 'WATCH_CHURN',
        title: 'Watch churn-risk pressure',
        body: `Bridge churn risk is ${round(bridgeSnapshot.intelligence.churnRisk, 2)}. Rescue timing and reduced social punishment may matter now.`,
        priority: 92,
        channel: 'GLOBAL',
        severity: 'CRITICAL',
      });
    }

    if (bridgeSnapshot && bridgeSnapshot.intelligence.recommendationPower >= this.config.thresholds.recommendationPowerHigh) {
      recommendations.push({
        id: `rec:recommend:${round(bridgeSnapshot.intelligence.recommendationPower, 2)}`,
        intent: 'EXPLOIT_RECOMMENDATION_POWER',
        title: 'Exploit recommendation power',
        body: `Recommendation power is elevated. This is the window to turn analysis into decisive action.`,
        priority: 78,
        channel: 'GLOBAL',
        severity: 'INFO',
      });
    }

    if (runtimeSlice && runtimeSlice.hotMechanicIds.length >= this.config.thresholds.hotSetTheatricalCount) {
      recommendations.push({
        id: `rec:hotset:${runtimeSlice.hotMechanicIds.length}`,
        intent: 'TURN_FAMILY_SURGE_INTO_ACTION',
        title: 'Turn the hot set into action',
        body: `${runtimeSlice.hotMechanicIds.length} hot mechanics are firing together. Choose the line before chaos chooses it for you.`,
        priority: 88,
        channel: 'GLOBAL',
        severity: 'WARN',
      });
    }

    if (bridgeSnapshot && bridgeSnapshot.season.dominionControl >= this.config.thresholds.dominionPushHigh) {
      recommendations.push({
        id: `rec:dominion:${Math.round(bridgeSnapshot.season.dominionControl)}`,
        intent: 'PROTECT_DOMINION_PUSH',
        title: 'Protect dominion momentum',
        body: `Dominion control is at ${round(bridgeSnapshot.season.dominionControl, 1)}. Guard this push from distraction or theatrical self-sabotage.`,
        priority: 84,
        channel: 'GLOBAL',
        severity: 'WARN',
      });
    }

    if (bridgeSnapshot && bridgeSnapshot.season.winStreak >= this.config.thresholds.winStreakPush) {
      recommendations.push({
        id: `rec:streak:${bridgeSnapshot.season.winStreak}`,
        intent: 'LEAN_INTO_MOMENTUM',
        title: 'Lean into momentum',
        body: `Win streak is ${bridgeSnapshot.season.winStreak}. Momentum should be protected, not narrated to death.`,
        priority: 66,
        channel: 'GLOBAL',
        severity: 'INFO',
      });
    }

    if (runtimeSlice && dominantBand === 'CALM') {
      recommendations.push({
        id: 'rec:noise:calm',
        intent: 'CLEAR_SIGNAL_NOISE',
        title: 'Keep signal clean',
        body: 'Mechanics runtime is calm. Avoid inventing urgency where the system is not asking for it.',
        priority: 28,
        channel: 'GLOBAL',
        severity: 'INFO',
      });
    }

    recommendations.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
    const nextList = recommendations.slice(0, this.config.maxRecommendations);
    const changed = stableStringify(nextList) !== stableStringify(this.recommendations);
    this.recommendations = nextList;
    this.lastRecommendationsAt = ts;

    if (changed) {
      this.callbacks?.onRecommendationsChanged?.(this.recommendations.map((item) => ({ ...item })));
      if (reason !== 'initial_bind' && this.config.emitSocketGameEvents) {
        this.forwardSocketGameEvent('MECHANICS_RECOMMENDATIONS_UPDATED', {
          count: this.recommendations.length,
          topIntent: this.recommendations[0]?.intent,
          dominantFamily: dominant,
          dominantBand,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Mode, witness, socket, history, lifecycle helpers
  // ---------------------------------------------------------------------------

  private applyModeSnapshot(
    bridgeSnapshot: MechanicsBridgeRuntimeSnapshot | null,
    runtimeSlice: MechanicsRuntimeStoreSlice | null,
    reason: string,
  ): void {
    const dominant = runtimeSlice ? dominantFamily(runtimeSlice) : undefined;
    const partial: Partial<ChatModeSnapshot> = {
      metadata: {
        source: 'MechanicsBridgeAdapter',
        reason,
        mechanicsRunId: runtimeSlice?.runId,
        hotMechanicIds: runtimeSlice?.hotMechanicIds ?? [],
        totalMechanicActivations: runtimeSlice?.totalActivations ?? 0,
        lastMechanicTick: runtimeSlice?.lastUpdatedTick ?? 0,
        dominantMechanicsFamily: dominant,
        bridgeTick: bridgeSnapshot?.tick,
        bridgeCash: bridgeSnapshot?.cash,
        bridgeRegime: bridgeSnapshot?.regime,
        churnRisk: bridgeSnapshot?.intelligence.churnRisk,
        recommendationPower: bridgeSnapshot?.intelligence.recommendationPower,
        dominionControl: bridgeSnapshot?.season.dominionControl,
        winStreak: bridgeSnapshot?.season.winStreak,
      },
    };

    if (bridgeSnapshot) {
      partial.gamePhase = bridgeSnapshot.season.dominionControl >= this.config.thresholds.dominionPushHigh
        ? 'DOMINION_PUSH'
        : bridgeSnapshot.intelligence.churnRisk >= this.config.thresholds.churnRiskHigh
          ? 'RISK_PRESSURE'
          : 'MECHANICS_RUNTIME';
      partial.pressureTier = bridgeSnapshot.intelligence.churnRisk >= this.config.thresholds.churnRiskHigh
        ? 'HIGH'
        : bridgeSnapshot.intelligence.risk >= 0.55 || bridgeSnapshot.intelligence.volatility >= 0.55
          ? 'MEDIUM'
          : 'LOW';
    }

    this.channelPolicy.updateModeSnapshot(partial);
  }

  private emitWitness(input: {
    channel: ChatChannel;
    title: string;
    body: string;
    severity: ChatNotificationSeverity;
    metadata?: Record<string, unknown>;
    kind: string;
  }): ChatMessage | null {
    if (!this.transcriptBuffer || !this.config.emitTranscriptWitness) return null;
    const channel = resolveWitnessChannel(this.channelPolicy, input.channel);
    const message: ChatMessage = {
      id: hashRecordKey([
        'mechanics.witness',
        channel,
        input.title,
        input.body,
        stableStringify(input.metadata ?? {}),
      ]),
      channel,
      kind: 'SYSTEM',
      senderId: 'mechanics.adapter',
      senderName: 'Mechanics Witness',
      senderRank: 'SYSTEM',
      body: `${input.title} — ${input.body}`,
      ts: now(),
      metadata: {
        ...(input.metadata ?? {}),
        witnessKind: input.kind,
        adapter: 'MechanicsBridgeAdapter',
      },
      pressureTier: this.channelPolicy.getSnapshot().mode.pressureTier,
      tickTier: inferTickTier(this.lastBridgeSnapshot?.tick ?? this.lastRuntimeSnapshot?.lastUpdatedTick ?? 0),
      immutable: false,
    };

    this.transcriptBuffer.insertSystemMessage(message);
    this.counters.fallbackWitnessCount += 1;

    if (this.notificationController && this.config.emitNotifications) {
      this.notificationController.noteSystem({
        channel,
        title: input.title,
        body: input.body,
        severity: input.severity,
        metadata: {
          ...(input.metadata ?? {}),
          adapter: 'MechanicsBridgeAdapter',
        },
      });
    }

    return message;
  }

  private forwardSocketGameEvent(event: string, metadata?: Record<string, unknown>): void {
    if (!this.socketClient || !this.config.emitSocketGameEvents) return;
    const intent: ChatGameEventIntent = {
      event,
      channel: this.activeChannel,
      metadata,
    };
    this.socketClient.queueGameEvent(intent);
  }

  private recordEvent(entry: MechanicsBridgeAdapterHistoryEntry): void {
    this.history.push(deepFreeze({
      ...entry,
      metadata: entry.metadata ? { ...entry.metadata } : undefined,
    }));
    if (this.history.length > this.config.maxHistory) {
      this.history.splice(0, this.history.length - this.config.maxHistory);
    }
    this.callbacks?.onNormalizedEvent?.({
      ...entry,
      metadata: entry.metadata ? { ...entry.metadata } : undefined,
    });
  }

  private isDeduped(key: string, ts: number, windowMs: number): boolean {
    const previousTs = this.dedupMap.get(key);
    if (typeof previousTs === 'number' && ts - previousTs <= windowMs) return true;
    this.dedupMap.set(key, ts);
    return false;
  }

  private evictDedup(at: number): void {
    const ttl = Math.max(this.config.eventDedupWindowMs, this.config.witnessDedupWindowMs) * 12;
    for (const [key, ts] of this.dedupMap) {
      if (at - ts > ttl) this.dedupMap.delete(key);
    }
  }

  private emitSnapshot(): void {
    this.callbacks?.onSnapshotChanged?.(this.getSnapshot());
  }

  private assertAlive(method: string): void {
    if (this.destroyed) {
      throw new Error(`[MechanicsBridgeAdapter] Cannot call ${method}() after destroy().`);
    }
  }
}

export function createMechanicsBridgeAdapter(
  options: MechanicsBridgeAdapterOptions,
): MechanicsBridgeAdapter {
  return new MechanicsBridgeAdapter(options);
}

// -----------------------------------------------------------------------------
// Family helpers and bridge semantics
// -----------------------------------------------------------------------------

interface FamilyAggregate {
  family: MechanicFamily;
  activationCount: number;
  avgHeat: number;
  avgConfidence: number;
  avgSignal: number;
  narrativeBand: MechanicsFamilyNarrativeBand;
}

function aggregateFamilies(slice: MechanicsRuntimeStoreSlice): FamilyAggregate[] {
  const byFamily = new Map<MechanicFamily, { count: number; activations: number; heat: number; confidence: number; signal: number }>();
  for (const id of slice.orderedIds) {
    const entry = slice.mechanicsById[id];
    if (!entry) continue;
    const family = normalizeFamily(entry.family);
    const bucket = byFamily.get(family) ?? { count: 0, activations: 0, heat: 0, confidence: 0, signal: 0 };
    bucket.count += 1;
    bucket.activations += entry.activations;
    bucket.heat += entry.heat;
    bucket.confidence += entry.confidence;
    bucket.signal += entry.signal;
    byFamily.set(family, bucket);
  }

  const out: FamilyAggregate[] = [];
  for (const [family, bucket] of byFamily.entries()) {
    const avgHeat = bucket.count > 0 ? bucket.heat / bucket.count : 0;
    const avgConfidence = bucket.count > 0 ? bucket.confidence / bucket.count : 0;
    const avgSignal = bucket.count > 0 ? bucket.signal / bucket.count : 0;
    out.push({
      family,
      activationCount: bucket.activations,
      avgHeat,
      avgConfidence,
      avgSignal,
      narrativeBand: classifyFamilyNarrativeBand({ activationCount: bucket.activations, avgHeat, avgConfidence, avgSignal }),
    });
  }

  out.sort((a, b) => {
    const left = familySortScore(a);
    const right = familySortScore(b);
    return right - left || a.family.localeCompare(b.family);
  });
  return out;
}

function dominantFamily(slice: MechanicsRuntimeStoreSlice): MechanicFamily | undefined {
  return aggregateFamilies(slice)[0]?.family;
}

function dominantNarrativeBand(
  slice: MechanicsRuntimeStoreSlice,
  family: MechanicFamily | undefined,
  thresholds: MechanicsBridgeThresholds,
): MechanicsFamilyNarrativeBand {
  if (!family) return 'CALM';
  const aggregate = aggregateFamilies(slice).find((entry) => entry.family === family);
  if (!aggregate) return 'CALM';
  if (slice.hotMechanicIds.length >= thresholds.hotSetTheatricalCount) return 'THEATRICAL';
  return aggregate.narrativeBand;
}

function familySortScore(family: FamilyAggregate): number {
  return family.activationCount * 100 + family.avgHeat * 20 + Math.abs(family.avgSignal) * 15 + family.avgConfidence * 10;
}

function classifyFamilyNarrativeBand(input: {
  activationCount: number;
  avgHeat: number;
  avgConfidence: number;
  avgSignal: number;
}): MechanicsFamilyNarrativeBand {
  const score = input.activationCount * 0.15 + input.avgHeat * 0.60 + Math.abs(input.avgSignal) * 0.45 + input.avgConfidence * 0.25;
  if (score >= 4.5) return 'THEATRICAL';
  if (score >= 2.8) return 'SURGING';
  if (score >= 1.4) return 'ACTIVE';
  if (score >= 0.6) return 'WATCH';
  return 'CALM';
}

function familyToNpcContext(
  family: MechanicFamily | undefined,
  band: MechanicsFamilyNarrativeBand,
  bridgeSnapshot: MechanicsBridgeRuntimeSnapshot | null,
): ChatNpcContext {
  switch (family) {
    case 'cards':
      return 'PLAYER_CARD_PLAY';
    case 'economy':
    case 'progression':
      return band === 'SURGING' || band === 'THEATRICAL' ? 'PLAYER_INCOME_UP' : 'PLAYER_COMEBACK';
    case 'risk':
    case 'market':
      return 'TIME_PRESSURE';
    case 'social':
    case 'pvp':
      return bridgeSnapshot?.season.winStreak && bridgeSnapshot.season.winStreak >= 2 ? 'PLAYER_COMEBACK' : 'NEGOTIATION_WINDOW';
    case 'season':
      return bridgeSnapshot?.season.dominionControl && bridgeSnapshot.season.dominionControl >= 70 ? 'NEAR_SOVEREIGNTY' : 'PLAYER_COMEBACK';
    case 'narrative':
      return 'MARKET_ALERT';
    case 'ai':
    case 'telemetry':
    case 'anti_cheat':
      return 'TIME_PRESSURE';
    default:
      return band === 'CALM' ? 'MANUAL' : 'MARKET_ALERT';
  }
}

function contextToEventName(context: ChatNpcContext): string {
  switch (context) {
    case 'TIME_PRESSURE': return 'PRESSURE_TIER_CHANGED';
    case 'PLAYER_COMEBACK': return 'PLAYER_COMEBACK';
    case 'PLAYER_CARD_PLAY': return 'PLAYER_CARD_PLAY';
    case 'PLAYER_INCOME_UP': return 'PLAYER_INCOME_UP';
    case 'NEGOTIATION_WINDOW': return 'NEGOTIATION_WINDOW';
    case 'NEAR_SOVEREIGNTY': return 'NEAR_SOVEREIGNTY';
    case 'MARKET_ALERT': return 'MARKET_ALERT';
    default: return 'MANUAL';
  }
}

function maybeStageInvasionFromFamily(
  invasionDirector: ChatInvasionDirector,
  family: MechanicFamily | undefined,
  band: MechanicsFamilyNarrativeBand,
  payload: Record<string, unknown>,
  channel: ChatChannel,
): ChatInvasionPlan | null {
  const mapping = familyToInvasionArchetype(family, band);
  if (!mapping) return null;
  return invasionDirector.stageManualInvasion({
    archetype: mapping.archetype,
    title: mapping.title,
    body: mapping.body,
    severity: mapping.severity,
    preferredChannels: [channel, 'GLOBAL', 'SYNDICATE'],
    metadata: {
      ...payload,
      family,
      band,
      source: 'MechanicsBridgeAdapter.manual_invasion',
    },
  });
}

function familyToInvasionArchetype(
  family: MechanicFamily | undefined,
  band: MechanicsFamilyNarrativeBand,
): { archetype: ChatInvasionArchetype; title: string; body: string; severity: ChatInvasionSeverity } | null {
  if (band === 'CALM' || !family) return null;
  switch (family) {
    case 'risk':
    case 'market':
      return {
        archetype: 'PRESSURE_SURGE',
        title: 'Mechanics pressure surge',
        body: 'Risk/market mechanics are no longer isolated. The run is broadcasting structural stress.',
        severity: band === 'THEATRICAL' ? 'HIGH' : 'MEDIUM',
      };
    case 'cards':
      return {
        archetype: 'CASCADE_SWARM',
        title: 'Card-layer swarm',
        body: 'Card-facing mechanics are chaining visibly across the runtime lane.',
        severity: band === 'THEATRICAL' ? 'HIGH' : 'MEDIUM',
      };
    case 'social':
    case 'pvp':
      return {
        archetype: 'DEALROOM_AMBUSH',
        title: 'Social ambush forming',
        body: 'Social/pvp mechanics are turning the room itself into the pressure surface.',
        severity: band === 'THEATRICAL' ? 'HIGH' : 'MEDIUM',
      };
    case 'season':
    case 'progression':
      return {
        archetype: 'PRESSURE_SURGE',
        title: 'Momentum surge',
        body: 'Progression/season mechanics are amplifying perception around the run.',
        severity: 'MEDIUM',
      };
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Snapshot normalization
// -----------------------------------------------------------------------------

function normalizeRuntimeSlice(raw: MechanicsRuntimeStoreSlice): MechanicsRuntimeStoreSlice {
  const mechanicsById: Record<string, MechanicRuntimeEntry> = {};
  for (const [key, value] of Object.entries(raw.mechanicsById ?? {})) {
    mechanicsById[key] = {
      mechanicId: normalizeMechanicId(value.mechanicId ?? key),
      taskId: String(value.taskId ?? key),
      title: String(value.title ?? value.mechanicId ?? key),
      family: normalizeFamily(value.family),
      kind: value.kind === 'ml' ? 'ml' : 'core',
      layer: String(value.layer ?? 'tick_engine'),
      priority: normalizePriority(value.priority),
      batch: normalizeBatch(value.batch),
      status: String(value.status ?? 'runtime_only'),
      deps: Array.isArray(value.deps) ? value.deps.map((dep) => String(dep)) : [],
      execHook: String(value.execHook ?? ''),
      telemetryEvents: Array.isArray(value.telemetryEvents) ? value.telemetryEvents.map((item) => String(item)) : [],
      heat: finite(value.heat),
      activations: Math.max(0, Math.round(finite(value.activations))),
      confidence: clamp(finite(value.confidence), 0, 1),
      signal: finite(value.signal),
      lastTick: value.lastTick == null ? null : Math.round(finite(value.lastTick)),
      lastActivatedAt: value.lastActivatedAt == null ? null : finite(value.lastActivatedAt),
    };
  }
  return deepFreeze({
    runId: normalizeNullableString(raw.runId),
    isInitialized: Boolean(raw.isInitialized),
    totalActivations: Math.max(0, Math.round(finite(raw.totalActivations))),
    lastUpdatedTick: Math.max(0, Math.round(finite(raw.lastUpdatedTick))),
    hotMechanicIds: dedupe((raw.hotMechanicIds ?? []).map((id) => normalizeMechanicId(id))),
    orderedIds: dedupe((raw.orderedIds ?? []).map((id) => normalizeMechanicId(id))),
    mechanicsById,
  });
}

function normalizeBridgeSnapshot(raw: MechanicsBridgeRuntimeSnapshot): MechanicsBridgeRuntimeSnapshot {
  return deepFreeze({
    tick: Math.max(0, Math.round(finite(raw.tick))),
    cash: finite(raw.cash),
    regime: String(raw.regime ?? 'Stable'),
    intelligence: {
      alpha: clamp(finite(raw.intelligence?.alpha), 0, 1),
      risk: clamp(finite(raw.intelligence?.risk), 0, 1),
      volatility: clamp(finite(raw.intelligence?.volatility), 0, 1),
      momentum: clamp(finite(raw.intelligence?.momentum), 0, 1),
      churnRisk: clamp(finite(raw.intelligence?.churnRisk), 0, 1),
      recommendationPower: clamp(finite(raw.intelligence?.recommendationPower), 0, 1),
    },
    season: {
      xp: Math.max(0, finite(raw.season?.xp)),
      passTier: Math.max(1, Math.round(finite(raw.season?.passTier))),
      dominionControl: clamp(finite(raw.season?.dominionControl), 0, 100),
      winStreak: Math.max(0, Math.round(finite(raw.season?.winStreak))),
    },
  });
}

function equalRuntimeSlices(left: MechanicsRuntimeStoreSlice, right: MechanicsRuntimeStoreSlice): boolean {
  return stableStringify(left) === stableStringify(right);
}

function cloneRuntimeSlice(value: MechanicsRuntimeStoreSlice): MechanicsRuntimeStoreSlice {
  return {
    runId: value.runId,
    isInitialized: value.isInitialized,
    totalActivations: value.totalActivations,
    lastUpdatedTick: value.lastUpdatedTick,
    hotMechanicIds: [...value.hotMechanicIds],
    orderedIds: [...value.orderedIds],
    mechanicsById: Object.fromEntries(
      Object.entries(value.mechanicsById).map(([key, entry]) => [key, { ...entry, deps: [...entry.deps], telemetryEvents: [...entry.telemetryEvents] }]),
    ),
  };
}

function cloneBridgeSnapshot(value: MechanicsBridgeRuntimeSnapshot): MechanicsBridgeRuntimeSnapshot {
  return {
    tick: value.tick,
    cash: value.cash,
    regime: value.regime,
    intelligence: { ...value.intelligence },
    season: { ...value.season },
  };
}

function createNoopBridgeApi(): MechanicsBridgeAPI {
  return {
    touchMechanic: () => {},
    touchFamily: () => {},
    isMechanicActive: () => false,
    snap: normalizeBridgeSnapshot({
      tick: 0,
      cash: 0,
      regime: 'Stable',
      intelligence: {
        alpha: 0,
        risk: 0,
        volatility: 0,
        momentum: 0,
        churnRisk: 0,
        recommendationPower: 0,
      },
      season: {
        xp: 0,
        passTier: 1,
        dominionControl: 0,
        winStreak: 0,
      },
    }),
    debugLog: () => {},
  };
}

// -----------------------------------------------------------------------------
// Event classification helpers
// -----------------------------------------------------------------------------

function detectHeatSpike(
  next: MechanicsRuntimeStoreSlice,
  previous: MechanicsRuntimeStoreSlice,
  threshold: number,
): boolean {
  for (const id of next.orderedIds) {
    const curr = next.mechanicsById[id];
    const prev = previous.mechanicsById[id];
    if (!curr || !prev) continue;
    if (curr.heat - prev.heat >= threshold) return true;
  }
  return false;
}

function detectConfidenceSpike(
  next: MechanicsRuntimeStoreSlice,
  previous: MechanicsRuntimeStoreSlice,
  threshold: number,
): boolean {
  for (const id of next.orderedIds) {
    const curr = next.mechanicsById[id];
    const prev = previous.mechanicsById[id];
    if (!curr || !prev) continue;
    if (curr.confidence - prev.confidence >= threshold) return true;
  }
  return false;
}

function detectSignalSpike(
  next: MechanicsRuntimeStoreSlice,
  previous: MechanicsRuntimeStoreSlice,
  threshold: number,
): boolean {
  for (const id of next.orderedIds) {
    const curr = next.mechanicsById[id];
    const prev = previous.mechanicsById[id];
    if (!curr || !prev) continue;
    if (Math.abs(curr.signal) - Math.abs(prev.signal) >= threshold) return true;
  }
  return false;
}

function detectFamilySurge(
  next: MechanicsRuntimeStoreSlice,
  thresholds: MechanicsBridgeThresholds,
): boolean {
  return aggregateFamilies(next).some((entry) =>
    entry.activationCount >= thresholds.familySurgeActivationCount
    && entry.avgHeat >= thresholds.familySurgeAvgHeat,
  );
}

function shouldWitnessBridgeSnapshot(
  next: MechanicsBridgeRuntimeSnapshot,
  previous: MechanicsBridgeRuntimeSnapshot | null,
): boolean {
  if (!previous) return true;
  return next.tick !== previous.tick
    && (Math.abs(next.cash - previous.cash) >= 2_500
      || next.regime !== previous.regime
      || Math.abs(next.intelligence.churnRisk - previous.intelligence.churnRisk) >= 0.12
      || Math.abs(next.season.dominionControl - previous.season.dominionControl) >= 8);
}

function chooseRuntimeEventChannel(
  eventName: MechanicsDeltaEventName,
  family: MechanicFamily | undefined,
  policy: ChatChannelPolicy,
  fallback: ChatChannel,
): ChatChannel {
  switch (eventName) {
    case 'MECHANICS_RUNTIME_INITIALIZED':
      return policy.evaluateChannel({ channel: 'LOBBY', intent: 'notify' }).allowed ? 'LOBBY' : fallback;
    case 'MECHANIC_FAMILY_SURGE':
    case 'MECHANIC_SIGNAL_SPIKE':
      return chooseFamilyChannel(family, policy, fallback);
    case 'MECHANIC_ACTIVATED':
      return family === 'cards' ? 'GLOBAL' : chooseFamilyChannel(family, policy, fallback);
    default:
      return chooseFamilyChannel(family, policy, fallback);
  }
}

function chooseBridgeSnapshotChannel(
  snapshot: MechanicsBridgeRuntimeSnapshot,
  policy: ChatChannelPolicy,
  fallback: ChatChannel,
): ChatChannel {
  if (snapshot.season.dominionControl >= 70) return 'GLOBAL';
  if (snapshot.intelligence.churnRisk >= 0.72) return 'GLOBAL';
  return policy.evaluateChannel({ channel: fallback, intent: 'notify' }).allowed ? fallback : 'GLOBAL';
}

function chooseFamilyChannel(
  family: MechanicFamily | undefined,
  policy: ChatChannelPolicy,
  fallback: ChatChannel,
): ChatChannel {
  if (!family) return fallback;
  if ((family === 'social' || family === 'pvp') && policy.evaluateChannel({ channel: 'SYNDICATE', intent: 'notify' }).allowed) return 'SYNDICATE';
  if (family === 'economy' || family === 'risk' || family === 'market' || family === 'season' || family === 'progression') return 'GLOBAL';
  if (family === 'cards' || family === 'narrative') return fallback;
  return fallback;
}

function chooseBridgeTouchChannel(id: string, fallback: ChatChannel): ChatChannel {
  const family = inferFamilyFromMechanicId(id);
  if (family === 'social' || family === 'pvp') return 'SYNDICATE';
  if (family === 'risk' || family === 'market' || family === 'economy') return 'GLOBAL';
  return fallback;
}

function buildRuntimeDedupKey(
  eventName: MechanicsDeltaEventName,
  next: MechanicsRuntimeStoreSlice,
  previous: MechanicsRuntimeStoreSlice | null,
  family: MechanicFamily | undefined,
  channel: ChatChannel,
): string {
  return stableStringify({
    eventName,
    runId: next.runId,
    channel,
    family,
    totalActivations: next.totalActivations,
    hotMechanicIds: next.hotMechanicIds,
    previousHotIds: previous?.hotMechanicIds,
    lastUpdatedTick: next.lastUpdatedTick,
  });
}

function buildBridgeDedupKey(
  eventName: MechanicsDeltaEventName,
  next: MechanicsBridgeRuntimeSnapshot,
  previous: MechanicsBridgeRuntimeSnapshot | null,
  channel: ChatChannel,
): string {
  return stableStringify({
    eventName,
    channel,
    tick: next.tick,
    regime: next.regime,
    cash: roundedBucket(next.cash, 500),
    churnRisk: roundedBucket(next.intelligence.churnRisk, 0.05),
    recommendationPower: roundedBucket(next.intelligence.recommendationPower, 0.05),
    dominionControl: roundedBucket(next.season.dominionControl, 5),
    previousTick: previous?.tick,
  });
}

function classifyBridgeNarrativeBand(
  snapshot: MechanicsBridgeRuntimeSnapshot,
  thresholds: MechanicsBridgeThresholds,
): MechanicsFamilyNarrativeBand {
  const score =
    snapshot.intelligence.churnRisk * 2.0
    + snapshot.intelligence.recommendationPower * 1.4
    + snapshot.intelligence.risk * 1.0
    + snapshot.intelligence.volatility * 1.0
    + (snapshot.season.dominionControl >= thresholds.dominionPushHigh ? 1.2 : snapshot.season.dominionControl / 100)
    + Math.min(1.2, snapshot.season.winStreak * 0.25);
  if (score >= 5.2) return 'THEATRICAL';
  if (score >= 3.6) return 'SURGING';
  if (score >= 2.0) return 'ACTIVE';
  if (score >= 0.8) return 'WATCH';
  return 'CALM';
}

function inferFamilyFromMechanicId(id: string): MechanicFamily {
  const normalized = normalizeMechanicId(id);
  if (normalized.includes('CARD')) return 'cards';
  if (normalized.includes('RISK')) return 'risk';
  if (normalized.includes('MARKET')) return 'market';
  if (normalized.includes('SEASON')) return 'season';
  if (normalized.includes('AI')) return 'ai';
  if (normalized.includes('PVP')) return 'pvp';
  if (normalized.includes('SOCIAL')) return 'social';
  if (normalized.includes('NARR')) return 'narrative';
  if (normalized.includes('ECON')) return 'economy';
  if (normalized.includes('PROG')) return 'progression';
  if (normalized.includes('OPS')) return 'ops';
  return 'unknown';
}

// -----------------------------------------------------------------------------
// Shared low-level helpers
// -----------------------------------------------------------------------------

function normalizeMechanicId(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? 'UNKNOWN_MECHANIC').toUpperCase();
  const normalized = value.trim().toUpperCase();
  return normalized || 'UNKNOWN_MECHANIC';
}

function normalizeFamily(value: unknown): MechanicFamily {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : 'unknown';
  switch (normalized) {
    case 'replay':
    case 'economy':
    case 'risk':
    case 'market':
    case 'cards':
    case 'progression':
    case 'social':
    case 'telemetry':
    case 'pvp':
    case 'season':
    case 'ai':
    case 'anti_cheat':
    case 'narrative':
    case 'ops':
    case 'unknown':
      return normalized;
    default:
      return 'unknown';
  }
}

function normalizePriority(value: unknown): 1 | 2 | 3 {
  const n = Math.round(finite(value));
  return n === 1 || n === 2 ? n : 3;
}

function normalizeBatch(value: unknown): 1 | 2 | 3 {
  const n = Math.round(finite(value));
  return n === 1 || n === 2 ? n : 3;
}

function inferTickTier(tick: number): string {
  if (tick >= 150) return 'LATE';
  if (tick >= 80) return 'MID';
  if (tick > 0) return 'EARLY';
  return 'BOOT';
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return value == null ? null : String(value);
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function finite(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundedBucket(value: number, size: number): number {
  if (!Number.isFinite(value) || size <= 0) return 0;
  return Math.round(value / size) * size;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dedupe<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function now(): number {
  return Date.now();
}

function hashRecordKey(parts: readonly string[]): string {
  let hash = 2166136261;
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 1) {
      hash ^= part.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `mech.${(hash >>> 0).toString(36)}`;
}

function resolveWitnessChannel(policy: ChatChannelPolicy, preferred: ChatChannel): ChatChannel {
  const evaluation = policy.evaluateChannel({ channel: preferred, intent: 'notify' });
  return evaluation.allowed ? preferred : evaluation.fallbackChannel;
}

function normalizeUnsubscribe(
  candidate: (() => void) | { unsubscribe?: () => void } | void,
): (() => void) | null {
  if (typeof candidate === 'function') return candidate;
  if (candidate && typeof candidate === 'object' && typeof candidate.unsubscribe === 'function') {
    return () => candidate.unsubscribe?.();
  }
  return null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(',')}}`;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const child = (value as Record<string, unknown>)[key];
    if (child && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}

function mergeConfig(
  base: MechanicsBridgeAdapterConfig,
  override?: Partial<MechanicsBridgeAdapterConfig>,
): MechanicsBridgeAdapterConfig {
  if (!override) return deepFreeze({ ...base, thresholds: { ...base.thresholds } });
  return deepFreeze({
    ...base,
    ...override,
    thresholds: {
      ...base.thresholds,
      ...(override.thresholds ?? {}),
    },
  });
}
