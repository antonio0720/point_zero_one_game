/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE RUN STORE ADAPTER
 * FILE: pzo-web/src/engines/chat/adapters/RunStoreAdapter.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical adapter that translates the real frontend run-store lane into the
 * unified frontend chat engine spine.
 *
 * Why this file exists
 * --------------------
 * The repo already has a real run-side state authority under
 * pzo-web/src/store/runStore.ts. That store is not presentation fluff. It is
 * the financial mirror consumed by engine code and written by server/runtime
 * paths. Chat should not invent a second economic truth surface. Chat should
 * consume the run mirror, preserve its semantics, and translate that truth into
 * social pressure, helper timing, hater escalation, tactical witness, and
 * continuity metadata.
 *
 * Repo truths preserved here
 * --------------------------
 * - runStore is already a named export consumed by non-React engine code.
 * - Its source-of-truth fields are explicitly documented: netWorth,
 *   cashBalance, monthlyIncome, monthlyExpenses, cashflow, haterHeat,
 *   activeThreatCardCount, runId, userId, seed, lastUpdated, isInitialized.
 * - The store is a mirror of real runtime writes; no chat logic should be
 *   buried back into that store.
 * - Hater heat and active threat count are already battle/card bridge outputs.
 * - The chat engine owns emotional/social direction. The run store owns the
 *   numeric mirror.
 *
 * What this adapter owns
 * ----------------------
 * - run-store subscription and snapshot normalization
 * - delta classification for income / cashflow / bankruptcy / drawdown /
 *   recovery / hater-heat / threat pressure
 * - routing into ChatChannelPolicy
 * - escalation into ChatInvasionDirector
 * - social handling into ChatNpcDirector
 * - optional transcript witness / notification mirror / socket mirror
 * - financial pressure recommendations for the unified chat dock
 *
 * Design laws
 * -----------
 * - Preserve run-store words. Do not genericize them.
 * - Numbers do not speak to players directly; chat does.
 * - Not every numerical change deserves text.
 * - Bankruptcy warnings should feel witnessed, not spammed.
 * - Recovery should be legible without becoming fake optimism.
 * - The client can stage witness, but cannot overwrite long-term truth.
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 * ============================================================================
 */

import {
  ChatSocketClient,
  type ChatChannel,
  type ChatGameEventIntent,
  type ChatMessage,
  type ChatTransportState,
} from '../ChatSocketClient';

import {
  ChatChannelPolicy,
  type ChatModeSnapshot,
} from '../ChatChannelPolicy';

import {
  ChatInvasionDirector,
  type ChatInvasionPlan,
} from '../ChatInvasionDirector';

import {
  ChatNpcDirector,
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
// Repo-facing compatibility surface
// -----------------------------------------------------------------------------

export interface RunStoreMirrorSnapshot {
  isInitialized: boolean;
  netWorth: number;
  cashBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  cashflow: number;
  haterHeat: number;
  activeThreatCardCount: number;
  runId: string | null;
  userId: string | null;
  seed: string | null;
  lastUpdated: number | null;
}

export interface RunStoreLike {
  getState(): RunStoreMirrorSnapshot;
  subscribe(
    listener: (next: RunStoreMirrorSnapshot, previous: RunStoreMirrorSnapshot) => void,
  ): (() => void) | { unsubscribe?: () => void } | void;
}

export type RunHealthBand =
  | 'STABLE'
  | 'WATCH'
  | 'STRAINED'
  | 'CRITICAL'
  | 'COLLAPSE';

export type RunDeltaEventName =
  | 'RUNSTORE_INITIALIZED'
  | 'RUNSTORE_RESET'
  | 'RUNSTORE_SNAPSHOT_UPDATED'
  | 'NET_WORTH_MILESTONE_UP'
  | 'NET_WORTH_MILESTONE_DOWN'
  | 'DRAWDOWN_WARNING'
  | 'CASHFLOW_NEGATIVE'
  | 'CASHFLOW_RECOVERED'
  | 'FIRST_INCOME_RECORDED'
  | 'INCOME_UP'
  | 'INCOME_DOWN'
  | 'BANKRUPTCY_WARNING'
  | 'BANKRUPTCY_TRIGGERED'
  | 'RUN_COMEBACK'
  | 'HATER_HEAT_SPIKE'
  | 'THREAT_COUNT_SURGE'
  | 'PRESSURE_TIER_CHANGED'
  | 'RUN_STABILIZED';

export type RunRecommendationIntent =
  | 'CUT_BURN'
  | 'SHORE_UP_CASH'
  | 'REDUCE_HEAT'
  | 'CLEAR_THREATS'
  | 'PROTECT_MOMENTUM'
  | 'STABILIZE_CASHFLOW'
  | 'HOLD_DISCIPLINE'
  | 'PUSH_COMEBACK';

export interface RunRecommendation {
  id: string;
  intent: RunRecommendationIntent;
  title: string;
  body: string;
  priority: number;
  channel: ChatChannel;
  severity: ChatNotificationSeverity;
  metadata?: Record<string, unknown>;
}

export interface RunStoreAdapterHistoryEntry {
  ts: number;
  eventName: RunDeltaEventName;
  channel: ChatChannel;
  healthBand: RunHealthBand;
  dedupKey: string;
  metadata?: Record<string, unknown>;
}

export interface RunStoreAdapterSnapshot {
  bound: boolean;
  activeChannel: ChatChannel;
  healthBand: RunHealthBand;
  pressureTier: string;
  lastSnapshot: RunStoreMirrorSnapshot | null;
  lastRecommendationsAt: number | null;
  recommendations: RunRecommendation[];
  history: RunStoreAdapterHistoryEntry[];
  counters: {
    deltaEventsProcessed: number;
    fallbackWitnessCount: number;
    bankruptcyWarnings: number;
    bankruptcies: number;
    comebacks: number;
    haterHeatSpikes: number;
    threatSurges: number;
  };
}

export interface RunStoreAdapterCallbacks {
  onNormalizedEvent?: (entry: RunStoreAdapterHistoryEntry) => void;
  onRecommendationsChanged?: (items: RunRecommendation[]) => void;
  onSnapshotChanged?: (snapshot: RunStoreAdapterSnapshot) => void;
}

export interface RunStoreThresholds {
  bankruptcyWarningNetWorth: number;
  bankruptcyTriggerNetWorth: number;
  cashCriticalThreshold: number;
  negativeCashflowWarning: number;
  haterHeatSpikeThreshold: number;
  threatSurgeThreshold: number;
  comebackAbsoluteGain: number;
  comebackPercentGain: number;
  drawdownWarnPercent: number;
  stabilizationCashflowFloor: number;
  milestoneStep: number;
}

export interface RunStoreAdapterConfig {
  eventDedupWindowMs: number;
  witnessDedupWindowMs: number;
  pollingFallbackMs: number;
  maxHistory: number;
  maxRecommendations: number;
  emitSocketGameEvents: boolean;
  emitTranscriptWitness: boolean;
  emitNotifications: boolean;
  allowFallbackWitness: boolean;
  witnessOnMilestones: boolean;
  witnessOnIncomeDeltas: boolean;
  thresholds: RunStoreThresholds;
}

export interface RunStoreAdapterOptions {
  runStore: RunStoreLike;
  channelPolicy: ChatChannelPolicy;
  invasionDirector: ChatInvasionDirector;
  npcDirector: ChatNpcDirector;
  socketClient?: ChatSocketClient;
  transcriptBuffer?: ChatTranscriptBuffer;
  notificationController?: ChatNotificationController;
  activeChannel?: ChatChannel;
  config?: Partial<RunStoreAdapterConfig>;
  callbacks?: RunStoreAdapterCallbacks;
}

const DEFAULT_THRESHOLDS: RunStoreThresholds = deepFreeze({
  bankruptcyWarningNetWorth: 25_000,
  bankruptcyTriggerNetWorth: 0,
  cashCriticalThreshold: 1_000,
  negativeCashflowWarning: -500,
  haterHeatSpikeThreshold: 60,
  threatSurgeThreshold: 3,
  comebackAbsoluteGain: 15_000,
  comebackPercentGain: 0.30,
  drawdownWarnPercent: 0.18,
  stabilizationCashflowFloor: 250,
  milestoneStep: 50_000,
});

const DEFAULT_CONFIG: RunStoreAdapterConfig = deepFreeze({
  eventDedupWindowMs: 9_500,
  witnessDedupWindowMs: 20_000,
  pollingFallbackMs: 2_500,
  maxHistory: 240,
  maxRecommendations: 8,
  emitSocketGameEvents: true,
  emitTranscriptWitness: true,
  emitNotifications: true,
  allowFallbackWitness: true,
  witnessOnMilestones: true,
  witnessOnIncomeDeltas: true,
  thresholds: DEFAULT_THRESHOLDS,
});

export class RunStoreAdapter {
  private readonly runStore: RunStoreLike;
  private readonly channelPolicy: ChatChannelPolicy;
  private readonly invasionDirector: ChatInvasionDirector;
  private readonly npcDirector: ChatNpcDirector;
  private readonly socketClient?: ChatSocketClient;
  private readonly transcriptBuffer?: ChatTranscriptBuffer;
  private readonly notificationController?: ChatNotificationController;
  private readonly callbacks?: RunStoreAdapterCallbacks;
  private readonly config: RunStoreAdapterConfig;

  private unsubscribe: (() => void) | null = null;
  private pollingHandle: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  private activeChannel: ChatChannel;
  private lastSnapshot: RunStoreMirrorSnapshot | null = null;
  private healthBand: RunHealthBand = 'STABLE';
  private pressureTier = 'LOW';
  private lastRecommendationsAt: number | null = null;
  private recommendations: RunRecommendation[] = [];
  private history: RunStoreAdapterHistoryEntry[] = [];
  private dedupMap = new Map<string, number>();
  private lastBankruptcyWarningAt: number | null = null;
  private lastBankruptcyTriggeredAt: number | null = null;
  private recoveryAnchorNetWorth: number | null = null;
  private peakNetWorth: number | null = null;

  private counters = {
    deltaEventsProcessed: 0,
    fallbackWitnessCount: 0,
    bankruptcyWarnings: 0,
    bankruptcies: 0,
    comebacks: 0,
    haterHeatSpikes: 0,
    threatSurges: 0,
  };

  public constructor(options: RunStoreAdapterOptions) {
    this.runStore = options.runStore;
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

  public getSnapshot(): RunStoreAdapterSnapshot {
    return deepFreeze({
      bound: Boolean(this.unsubscribe || this.pollingHandle),
      activeChannel: this.activeChannel,
      healthBand: this.healthBand,
      pressureTier: this.pressureTier,
      lastSnapshot: this.lastSnapshot ? { ...this.lastSnapshot } : null,
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

  public syncFromStore(reason: string = 'manual_sync'): void {
    this.assertAlive('syncFromStore');
    const next = normalizeSnapshot(this.runStore.getState());
    this.handleSnapshotChange(next, this.lastSnapshot, reason);
  }

  public stageManualWitness(input: {
    eventName: RunDeltaEventName;
    title: string;
    body: string;
    channel?: ChatChannel;
    severity?: ChatNotificationSeverity;
    metadata?: Record<string, unknown>;
  }): void {
    this.assertAlive('stageManualWitness');
    const eventTs = now();
    this.recordEvent({
      ts: eventTs,
      eventName: input.eventName,
      channel: resolveWitnessChannel(this.channelPolicy, input.channel ?? this.activeChannel),
      healthBand: this.healthBand,
      dedupKey: `manual:${input.eventName}:${stableStringify(input.metadata ?? {})}`,
      metadata: input.metadata,
    });

    this.emitWitness({
      channel: input.channel ?? this.activeChannel,
      title: input.title,
      body: input.body,
      severity: input.severity ?? 'INFO',
      metadata: {
        ...(input.metadata ?? {}),
        source: 'RunStoreAdapter.manual',
      },
      kind: input.eventName,
    });
  }

  // ---------------------------------------------------------------------------
  // Binding
  // ---------------------------------------------------------------------------

  private bind(): void {
    const initial = normalizeSnapshot(this.runStore.getState());
    this.lastSnapshot = initial;
    this.peakNetWorth = initial.netWorth;
    this.recoveryAnchorNetWorth = initial.netWorth;
    this.applyModeSnapshot(initial, 'initial_bind');
    this.recomputeRecommendations('initial_bind', initial, null, now());

    const maybeUnsub = this.runStore.subscribe((next, previous) => {
      this.handleSnapshotChange(normalizeSnapshot(next), normalizeSnapshot(previous), 'subscribe');
    });

    this.unsubscribe = normalizeUnsubscribe(maybeUnsub);

    if (!this.unsubscribe) {
      this.pollingHandle = setInterval(() => {
        const next = normalizeSnapshot(this.runStore.getState());
        if (!this.lastSnapshot || !equalSnapshots(next, this.lastSnapshot)) {
          this.handleSnapshotChange(next, this.lastSnapshot, 'polling_fallback');
        }
      }, this.config.pollingFallbackMs);
    }

    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Snapshot handling
  // ---------------------------------------------------------------------------

  private handleSnapshotChange(
    next: RunStoreMirrorSnapshot,
    previous: RunStoreMirrorSnapshot | null,
    reason: string,
  ): void {
    if (this.destroyed) return;

    const ts = now();
    this.lastSnapshot = next;
    this.activeChannel = chooseActiveChannel(this.channelPolicy, this.activeChannel);
    this.evictDedup(ts);

    this.healthBand = classifyHealthBand(next, this.config.thresholds);
    this.pressureTier = classifyPressureTier(next, previous, this.config.thresholds);
    this.applyModeSnapshot(next, reason);

    this.forwardSocketGameEvent('RUNSTORE_SNAPSHOT_UPDATED', {
      reason,
      runId: next.runId,
      userId: next.userId,
      netWorth: next.netWorth,
      cashBalance: next.cashBalance,
      monthlyIncome: next.monthlyIncome,
      monthlyExpenses: next.monthlyExpenses,
      cashflow: next.cashflow,
      haterHeat: next.haterHeat,
      activeThreatCardCount: next.activeThreatCardCount,
      healthBand: this.healthBand,
      pressureTier: this.pressureTier,
    });

    const deltaEvents = this.computeDeltaEvents(next, previous, ts);
    for (const event of deltaEvents) {
      this.processDeltaEvent(event, next, previous, ts);
    }

    this.recomputeRecommendations(reason, next, previous, ts);
    this.emitSnapshot();
  }

  private computeDeltaEvents(
    next: RunStoreMirrorSnapshot,
    previous: RunStoreMirrorSnapshot | null,
    ts: number,
  ): RunDeltaEventName[] {
    const out: RunDeltaEventName[] = [];

    if (!previous) {
      out.push('RUNSTORE_INITIALIZED');
      return out;
    }

    if (!previous.isInitialized && next.isInitialized) out.push('RUNSTORE_INITIALIZED');
    if (previous.isInitialized && !next.isInitialized) out.push('RUNSTORE_RESET');

    const previousMilestone = milestoneBucket(previous.netWorth, this.config.thresholds.milestoneStep);
    const nextMilestone = milestoneBucket(next.netWorth, this.config.thresholds.milestoneStep);
    if (this.config.witnessOnMilestones && nextMilestone > previousMilestone) out.push('NET_WORTH_MILESTONE_UP');
    if (this.config.witnessOnMilestones && nextMilestone < previousMilestone) out.push('NET_WORTH_MILESTONE_DOWN');

    const drawdown = computeDrawdown(previous.netWorth, next.netWorth, this.peakNetWorth ?? previous.netWorth);
    if (drawdown >= this.config.thresholds.drawdownWarnPercent) out.push('DRAWDOWN_WARNING');

    if (previous.monthlyIncome <= 0 && next.monthlyIncome > 0) out.push('FIRST_INCOME_RECORDED');
    if (next.monthlyIncome > previous.monthlyIncome) out.push('INCOME_UP');
    if (next.monthlyIncome < previous.monthlyIncome) out.push('INCOME_DOWN');

    if (previous.cashflow >= 0 && next.cashflow < this.config.thresholds.negativeCashflowWarning) out.push('CASHFLOW_NEGATIVE');
    if (previous.cashflow < 0 && next.cashflow >= this.config.thresholds.stabilizationCashflowFloor) out.push('CASHFLOW_RECOVERED');

    const wasWarning = isBankruptcyWarning(previous, this.config.thresholds);
    const isWarning = isBankruptcyWarning(next, this.config.thresholds);
    if (!wasWarning && isWarning) out.push('BANKRUPTCY_WARNING');

    const wasTriggered = isBankruptcyTriggered(previous, this.config.thresholds);
    const isTriggered = isBankruptcyTriggered(next, this.config.thresholds);
    if (!wasTriggered && isTriggered) out.push('BANKRUPTCY_TRIGGERED');

    if (detectComeback(previous, next, this.recoveryAnchorNetWorth ?? previous.netWorth, this.config.thresholds)) {
      out.push('RUN_COMEBACK');
    }

    if (previous.haterHeat < this.config.thresholds.haterHeatSpikeThreshold && next.haterHeat >= this.config.thresholds.haterHeatSpikeThreshold) {
      out.push('HATER_HEAT_SPIKE');
    }

    if (previous.activeThreatCardCount < this.config.thresholds.threatSurgeThreshold && next.activeThreatCardCount >= this.config.thresholds.threatSurgeThreshold) {
      out.push('THREAT_COUNT_SURGE');
    }

    const previousPressure = classifyPressureTier(previous, null, this.config.thresholds);
    const nextPressure = classifyPressureTier(next, previous, this.config.thresholds);
    if (previousPressure !== nextPressure) out.push('PRESSURE_TIER_CHANGED');

    if (
      previous.cashflow < 0
      && next.cashflow >= this.config.thresholds.stabilizationCashflowFloor
      && next.netWorth >= previous.netWorth
      && next.activeThreatCardCount <= previous.activeThreatCardCount
    ) {
      out.push('RUN_STABILIZED');
    }

    if (out.length === 0) {
      // Keep this adapter intentionally quiet for small numerical movement.
    }

    return dedupe(out);
  }

  private processDeltaEvent(
    eventName: RunDeltaEventName,
    next: RunStoreMirrorSnapshot,
    previous: RunStoreMirrorSnapshot | null,
    ts: number,
  ): void {
    const channel = preferredChannelForRunEvent(eventName, next, this.channelPolicy, this.activeChannel);
    const dedupKey = buildDedupKey(eventName, next, previous, channel);
    const dedupWindow = eventName === 'RUNSTORE_SNAPSHOT_UPDATED'
      ? this.config.eventDedupWindowMs
      : this.config.witnessDedupWindowMs;
    if (this.isDeduped(dedupKey, ts, dedupWindow)) return;

    const entry: RunStoreAdapterHistoryEntry = {
      ts,
      eventName,
      channel,
      healthBand: this.healthBand,
      dedupKey,
      metadata: {
        runId: next.runId,
        netWorth: next.netWorth,
        cashBalance: next.cashBalance,
        monthlyIncome: next.monthlyIncome,
        monthlyExpenses: next.monthlyExpenses,
        cashflow: next.cashflow,
        haterHeat: next.haterHeat,
        activeThreatCardCount: next.activeThreatCardCount,
        pressureTier: this.pressureTier,
      },
    };

    this.recordEvent(entry);
    this.counters.deltaEventsProcessed += 1;

    switch (eventName) {
      case 'RUNSTORE_INITIALIZED':
        this.npcDirector.handleGameEvent({
          eventType: 'GAME_START',
          payload: buildPayload(next, previous, eventName),
          preferredChannel: 'LOBBY',
          ts,
          metadata: { source: 'RunStoreAdapter.init' },
        });
        if (this.config.allowFallbackWitness) {
          this.emitWitness({
            channel: 'LOBBY',
            title: 'Run mirror bound',
            body: `Run ${next.runId ?? 'unknown'} is now mirrored into the unified chat engine.`,
            severity: 'INFO',
            metadata: { source: 'RunStoreAdapter.init', runId: next.runId },
            kind: eventName,
          });
        }
        break;

      case 'RUNSTORE_RESET':
        this.emitWitness({
          channel: 'LOBBY',
          title: 'Run mirror reset',
          body: 'The run-state mirror returned to baseline. Chat staging has shifted back to foyer behavior.',
          severity: 'INFO',
          metadata: { source: 'RunStoreAdapter.reset' },
          kind: eventName,
        });
        break;

      case 'BANKRUPTCY_WARNING':
        this.counters.bankruptcyWarnings += 1;
        this.lastBankruptcyWarningAt = ts;
        this.recoveryAnchorNetWorth = Math.min(this.recoveryAnchorNetWorth ?? next.netWorth, next.netWorth);
        {
          const invasion = this.invasionDirector.handleGameEvent({
            event: 'BANKRUPTCY_WARNING',
            payload: buildPayload(next, previous, eventName),
            preferredChannels: [channel, 'GLOBAL', 'SYNDICATE'],
          });
          const plans = this.npcDirector.handleGameEvent({
            eventType: 'BANKRUPTCY_WARNING',
            payload: buildPayload(next, previous, eventName),
            preferredChannel: channel,
            ts,
            metadata: { source: 'RunStoreAdapter.bankruptcy_warning' },
          });
          if (!invasion && plans.length === 0 && this.config.allowFallbackWitness) {
            this.emitWitness({
              channel,
              title: 'Bankruptcy warning',
              body: `Net worth and liquidity slid into the warning band. Collapse is visible now.`,
              severity: 'WARN',
              metadata: { source: 'RunStoreAdapter.bankruptcy_warning', netWorth: next.netWorth, cashBalance: next.cashBalance },
              kind: eventName,
            });
          }
        }
        break;

      case 'BANKRUPTCY_TRIGGERED':
        this.counters.bankruptcies += 1;
        this.lastBankruptcyTriggeredAt = ts;
        this.recoveryAnchorNetWorth = next.netWorth;
        {
          const invasion = this.invasionDirector.handleGameEvent({
            event: 'BANKRUPTCY_TRIGGERED',
            payload: buildPayload(next, previous, eventName),
            preferredChannels: [channel, 'GLOBAL', 'SYNDICATE'],
          });
          const plans = this.npcDirector.handleGameEvent({
            eventType: 'BANKRUPTCY_TRIGGERED',
            payload: buildPayload(next, previous, eventName),
            preferredChannel: channel,
            ts,
            metadata: { source: 'RunStoreAdapter.bankruptcy_triggered' },
          });
          if (!invasion && plans.length === 0 && this.config.allowFallbackWitness) {
            this.emitWitness({
              channel,
              title: 'Collapse witnessed',
              body: 'Run-state collapse crossed the hard threshold. This is no longer private pressure.',
              severity: 'CRITICAL',
              metadata: { source: 'RunStoreAdapter.bankruptcy_triggered', netWorth: next.netWorth, cashflow: next.cashflow },
              kind: eventName,
            });
          }
        }
        break;

      case 'PRESSURE_TIER_CHANGED':
        {
          const invasion = this.invasionDirector.handleGameEvent({
            event: 'PRESSURE_TIER_CHANGED',
            payload: buildPayload(next, previous, eventName),
            preferredChannels: [channel, 'GLOBAL', 'SYNDICATE'],
          });
          const plans = this.npcDirector.handleGameEvent({
            eventType: 'PRESSURE_TIER_CHANGED',
            payload: buildPayload(next, previous, eventName),
            preferredChannel: channel,
            ts,
            metadata: { source: 'RunStoreAdapter.pressure' },
          });
          if (!invasion && plans.length === 0 && this.config.allowFallbackWitness && this.pressureTier !== 'LOW') {
            this.emitWitness({
              channel,
              title: 'Pressure tier changed',
              body: `Run pressure is now ${this.pressureTier}. The room can feel the shift.`,
              severity: this.pressureTier === 'CRITICAL' ? 'CRITICAL' : this.pressureTier === 'HIGH' ? 'WARN' : 'INFO',
              metadata: { source: 'RunStoreAdapter.pressure', pressureTier: this.pressureTier },
              kind: eventName,
            });
          }
        }
        break;

      case 'RUN_COMEBACK':
        this.counters.comebacks += 1;
        this.npcDirector.handleGameEvent({
          eventType: 'PLAYER_COMEBACK',
          payload: buildPayload(next, previous, eventName),
          preferredChannel: channel,
          ts,
          metadata: { source: 'RunStoreAdapter.comeback' },
        });
        if (this.config.allowFallbackWitness) {
          this.emitWitness({
            channel,
            title: 'Comeback detected',
            body: `Recovery crossed the comeback gate. The run is fighting back with visible force.`,
            severity: 'WARN',
            metadata: { source: 'RunStoreAdapter.comeback', netWorth: next.netWorth, anchor: this.recoveryAnchorNetWorth },
            kind: eventName,
          });
        }
        this.recoveryAnchorNetWorth = next.netWorth;
        break;

      case 'FIRST_INCOME_RECORDED':
        this.npcDirector.handleGameEvent({
          eventType: 'PLAYER_FIRST_INCOME',
          payload: buildPayload(next, previous, eventName),
          preferredChannel: 'GLOBAL',
          ts,
          metadata: { source: 'RunStoreAdapter.first_income' },
        });
        if (this.config.witnessOnIncomeDeltas) {
          this.emitWitness({
            channel: 'GLOBAL',
            title: 'Income lane opened',
            body: `Recurring income is now on the board at ${formatMoney(next.monthlyIncome)} per month.`,
            severity: 'INFO',
            metadata: { source: 'RunStoreAdapter.first_income', monthlyIncome: next.monthlyIncome },
            kind: eventName,
          });
        }
        break;

      case 'INCOME_UP':
        this.npcDirector.handleGameEvent({
          eventType: 'PLAYER_INCOME_UP',
          payload: buildPayload(next, previous, eventName),
          preferredChannel: channel,
          ts,
          metadata: { source: 'RunStoreAdapter.income_up' },
        });
        if (this.config.witnessOnIncomeDeltas) {
          this.emitWitness({
            channel,
            title: 'Income improved',
            body: `Monthly income moved from ${formatMoney(previous?.monthlyIncome ?? 0)} to ${formatMoney(next.monthlyIncome)}.`,
            severity: 'INFO',
            metadata: { source: 'RunStoreAdapter.income_up' },
            kind: eventName,
          });
        }
        break;

      case 'INCOME_DOWN':
        if (this.config.witnessOnIncomeDeltas) {
          this.emitWitness({
            channel,
            title: 'Income slipped',
            body: `Monthly income dropped to ${formatMoney(next.monthlyIncome)}. Revenue drift is now visible.`,
            severity: 'WARN',
            metadata: { source: 'RunStoreAdapter.income_down' },
            kind: eventName,
          });
        }
        break;

      case 'CASHFLOW_NEGATIVE':
        this.npcDirector.handleGameEvent({
          eventType: 'TIME_PRESSURE',
          payload: buildPayload(next, previous, eventName),
          preferredChannel: channel,
          ts,
          metadata: { source: 'RunStoreAdapter.cashflow_negative' },
        });
        break;

      case 'CASHFLOW_RECOVERED':
      case 'RUN_STABILIZED':
        if (this.config.allowFallbackWitness) {
          this.emitWitness({
            channel,
            title: eventName === 'RUN_STABILIZED' ? 'Run stabilized' : 'Cashflow recovered',
            body: eventName === 'RUN_STABILIZED'
              ? 'Cashflow, heat, and threat posture moved back into a stable lane.'
              : 'Monthly cashflow crossed back into sustainable territory.',
            severity: 'INFO',
            metadata: { source: 'RunStoreAdapter.stabilized' },
            kind: eventName,
          });
        }
        break;

      case 'HATER_HEAT_SPIKE':
        this.counters.haterHeatSpikes += 1;
        {
          const invasion = this.invasionDirector.handleGameEvent({
            event: 'BOT_TARGET_LOCKED',
            payload: buildPayload(next, previous, eventName),
            preferredChannels: [channel, 'GLOBAL', 'SYNDICATE'],
          });
          const plans = this.npcDirector.handleGameEvent({
            eventType: 'BOT_WINNING',
            payload: buildPayload(next, previous, eventName),
            preferredChannel: channel,
            ts,
            metadata: { source: 'RunStoreAdapter.hater_heat_spike' },
          });
          if (!invasion && plans.length === 0 && this.config.allowFallbackWitness) {
            this.emitWitness({
              channel,
              title: 'Hater heat spike',
              body: `Hater heat crossed ${this.config.thresholds.haterHeatSpikeThreshold}. The run now smells vulnerable to the room.`,
              severity: 'WARN',
              metadata: { source: 'RunStoreAdapter.hater_heat_spike', haterHeat: next.haterHeat },
              kind: eventName,
            });
          }
        }
        break;

      case 'THREAT_COUNT_SURGE':
        this.counters.threatSurges += 1;
        {
          const invasion = this.invasionDirector.handleGameEvent({
            event: 'MULTI_BOT_TARGETING_WINDOW',
            payload: buildPayload(next, previous, eventName),
            preferredChannels: [channel, 'GLOBAL', 'SYNDICATE'],
          });
          const plans = this.npcDirector.handleGameEvent({
            eventType: 'BOT_WINNING',
            payload: buildPayload(next, previous, eventName),
            preferredChannel: channel,
            ts,
            metadata: { source: 'RunStoreAdapter.threat_surge' },
          });
          if (!invasion && plans.length === 0 && this.config.allowFallbackWitness) {
            this.emitWitness({
              channel,
              title: 'Threat count surged',
              body: `${next.activeThreatCardCount} active threat cards are now stacked against the run.`,
              severity: 'WARN',
              metadata: { source: 'RunStoreAdapter.threat_surge', activeThreatCardCount: next.activeThreatCardCount },
              kind: eventName,
            });
          }
        }
        break;

      case 'DRAWDOWN_WARNING':
      case 'NET_WORTH_MILESTONE_DOWN':
        if (this.config.allowFallbackWitness) {
          this.emitWitness({
            channel,
            title: eventName === 'DRAWDOWN_WARNING' ? 'Drawdown warning' : 'Net worth tier lost',
            body: eventName === 'DRAWDOWN_WARNING'
              ? 'Net worth drawdown crossed the warning gate. Momentum protection now matters.'
              : `Net worth slipped below ${formatMoney(milestoneFloor(next.netWorth, this.config.thresholds.milestoneStep))}.`,
            severity: 'WARN',
            metadata: { source: 'RunStoreAdapter.drawdown' },
            kind: eventName,
          });
        }
        break;

      case 'NET_WORTH_MILESTONE_UP':
        if (this.config.allowFallbackWitness) {
          this.emitWitness({
            channel: 'GLOBAL',
            title: 'Net worth milestone reached',
            body: `Net worth crossed ${formatMoney(milestoneFloor(next.netWorth, this.config.thresholds.milestoneStep))}.`,
            severity: 'INFO',
            metadata: { source: 'RunStoreAdapter.milestone_up' },
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
    next: RunStoreMirrorSnapshot,
    previous: RunStoreMirrorSnapshot | null,
    ts: number,
  ): void {
    const recommendations: RunRecommendation[] = [];

    if (next.cashflow < this.config.thresholds.negativeCashflowWarning) {
      recommendations.push({
        id: `rec:cashflow:${Math.round(next.cashflow)}`,
        intent: 'STABILIZE_CASHFLOW',
        title: 'Stabilize cashflow',
        body: `Monthly cashflow is ${formatMoney(next.cashflow)}. Cut burn before chat pressure becomes collapse theater.`,
        priority: 100,
        channel: 'GLOBAL',
        severity: 'CRITICAL',
      });
    }

    if (next.cashBalance <= this.config.thresholds.cashCriticalThreshold) {
      recommendations.push({
        id: `rec:cash:${Math.round(next.cashBalance)}`,
        intent: 'SHORE_UP_CASH',
        title: 'Shore up liquid cash',
        body: `Cash balance is down to ${formatMoney(next.cashBalance)}. Preserve maneuver room now.`,
        priority: 95,
        channel: 'GLOBAL',
        severity: 'CRITICAL',
      });
    }

    if (next.haterHeat >= this.config.thresholds.haterHeatSpikeThreshold) {
      recommendations.push({
        id: `rec:heat:${Math.round(next.haterHeat)}`,
        intent: 'REDUCE_HEAT',
        title: 'Reduce hater heat',
        body: `Hater heat is ${round(next.haterHeat, 1)}. Counter-pressure or decoy plays should move to the front of the queue.`,
        priority: 92,
        channel: this.channelPolicy.evaluateChannel({ channel: 'SYNDICATE', intent: 'notify' }).allowed ? 'SYNDICATE' : 'GLOBAL',
        severity: 'WARN',
      });
    }

    if (next.activeThreatCardCount >= this.config.thresholds.threatSurgeThreshold) {
      recommendations.push({
        id: `rec:threats:${next.activeThreatCardCount}`,
        intent: 'CLEAR_THREATS',
        title: 'Clear active threats',
        body: `${next.activeThreatCardCount} threat cards are active. Do not let the room normalize this stack.`,
        priority: 90,
        channel: 'GLOBAL',
        severity: 'WARN',
      });
    }

    if (this.healthBand === 'COLLAPSE' || this.healthBand === 'CRITICAL') {
      recommendations.push({
        id: `rec:collapse:${this.healthBand}`,
        intent: 'CUT_BURN',
        title: 'Cut burn immediately',
        body: 'Financial posture is in the collapse band. Preservation outranks vanity moves.',
        priority: 98,
        channel: 'GLOBAL',
        severity: 'CRITICAL',
      });
    }

    if (this.healthBand === 'STABLE' && next.cashflow > 0 && next.haterHeat < this.config.thresholds.haterHeatSpikeThreshold) {
      recommendations.push({
        id: `rec:hold:${Math.round(next.netWorth / 1000)}`,
        intent: 'HOLD_DISCIPLINE',
        title: 'Hold discipline',
        body: 'The run is stable. Do not turn a good position into spectacle for no reason.',
        priority: 40,
        channel: 'GLOBAL',
        severity: 'INFO',
      });
    }

    if (
      previous
      && next.netWorth > previous.netWorth
      && (this.recoveryAnchorNetWorth ?? next.netWorth) < next.netWorth
    ) {
      recommendations.push({
        id: `rec:push:${Math.round(next.netWorth)}`,
        intent: 'PUSH_COMEBACK',
        title: 'Push the comeback window',
        body: 'Recovery is already visible. Press the clean line before the room can punish hesitation.',
        priority: 72,
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
        this.forwardSocketGameEvent('RUN_RECOMMENDATIONS_UPDATED', {
          count: this.recommendations.length,
          topIntent: this.recommendations[0]?.intent,
          healthBand: this.healthBand,
          pressureTier: this.pressureTier,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private routing helpers
  // ---------------------------------------------------------------------------

  private applyModeSnapshot(next: RunStoreMirrorSnapshot, reason: string): void {
    const currentChannel = this.channelPolicy.getSnapshot().activeChannel;
    const partial: Partial<ChatModeSnapshot> = {
      haterHeat: next.haterHeat,
      pressureTier: this.pressureTier,
      gamePhase: inferGamePhase(next),
      allowGlobal: true,
      metadata: {
        source: 'RunStoreAdapter',
        reason,
        runId: next.runId,
        userId: next.userId,
        seed: next.seed,
        netWorth: next.netWorth,
        cashBalance: next.cashBalance,
        monthlyIncome: next.monthlyIncome,
        monthlyExpenses: next.monthlyExpenses,
        cashflow: next.cashflow,
        activeThreatCardCount: next.activeThreatCardCount,
        haterHeat: next.haterHeat,
        healthBand: this.healthBand,
      },
    };

    if (currentChannel === 'LOBBY' && next.isInitialized) {
      partial.isInRun = true;
      partial.isPreRun = false;
      partial.isPostRun = false;
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
        'run.witness',
        channel,
        input.title,
        input.body,
        stableStringify(input.metadata ?? {}),
      ]),
      channel,
      kind: 'SYSTEM',
      senderId: 'runstore.adapter',
      senderName: 'Run Witness',
      senderRank: 'SYSTEM',
      body: `${input.title} — ${input.body}`,
      ts: now(),
      metadata: {
        ...(input.metadata ?? {}),
        witnessKind: input.kind,
        adapter: 'RunStoreAdapter',
      },
      pressureTier: this.pressureTier,
      tickTier: inferTickTierFromLastUpdated(this.lastSnapshot?.lastUpdated),
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
          adapter: 'RunStoreAdapter',
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

  private recordEvent(entry: RunStoreAdapterHistoryEntry): void {
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
    const ttl = Math.max(this.config.eventDedupWindowMs, this.config.witnessDedupWindowMs) * 10;
    for (const [key, ts] of this.dedupMap) {
      if (at - ts > ttl) this.dedupMap.delete(key);
    }
  }

  private emitSnapshot(): void {
    this.callbacks?.onSnapshotChanged?.(this.getSnapshot());
  }

  private assertAlive(method: string): void {
    if (this.destroyed) {
      throw new Error(`[RunStoreAdapter] Cannot call ${method}() after destroy().`);
    }
  }
}

export function createRunStoreAdapter(options: RunStoreAdapterOptions): RunStoreAdapter {
  return new RunStoreAdapter(options);
}

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

function normalizeSnapshot(raw: RunStoreMirrorSnapshot): RunStoreMirrorSnapshot {
  return deepFreeze({
    isInitialized: Boolean(raw.isInitialized),
    netWorth: finite(raw.netWorth),
    cashBalance: finite(raw.cashBalance),
    monthlyIncome: finite(raw.monthlyIncome),
    monthlyExpenses: finite(raw.monthlyExpenses),
    cashflow: finite(raw.cashflow ?? raw.monthlyIncome - raw.monthlyExpenses),
    haterHeat: clamp(finite(raw.haterHeat), 0, 100),
    activeThreatCardCount: Math.max(0, Math.round(finite(raw.activeThreatCardCount))),
    runId: normalizeNullableString(raw.runId),
    userId: normalizeNullableString(raw.userId),
    seed: normalizeNullableString(raw.seed),
    lastUpdated: raw.lastUpdated == null ? null : finite(raw.lastUpdated),
  });
}

function equalSnapshots(left: RunStoreMirrorSnapshot, right: RunStoreMirrorSnapshot): boolean {
  return stableStringify(left) === stableStringify(right);
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

function chooseActiveChannel(policy: ChatChannelPolicy, fallback: ChatChannel): ChatChannel {
  const snapshot = policy.getSnapshot();
  const active = snapshot.activeChannel ?? fallback;
  const evaluation = policy.evaluateChannel({ channel: active, intent: 'read' });
  return evaluation.allowed ? active : evaluation.fallbackChannel;
}

function preferredChannelForRunEvent(
  eventName: RunDeltaEventName,
  snapshot: RunStoreMirrorSnapshot,
  policy: ChatChannelPolicy,
  fallback: ChatChannel,
): ChatChannel {
  switch (eventName) {
    case 'RUNSTORE_INITIALIZED':
    case 'RUNSTORE_RESET':
      return policy.evaluateChannel({ channel: 'LOBBY', intent: 'notify' }).allowed ? 'LOBBY' : fallback;
    case 'FIRST_INCOME_RECORDED':
    case 'INCOME_UP':
    case 'NET_WORTH_MILESTONE_UP':
      return 'GLOBAL';
    case 'BANKRUPTCY_WARNING':
    case 'BANKRUPTCY_TRIGGERED':
    case 'CASHFLOW_NEGATIVE':
    case 'DRAWDOWN_WARNING':
      return 'GLOBAL';
    case 'HATER_HEAT_SPIKE':
    case 'THREAT_COUNT_SURGE':
      return policy.evaluateChannel({ channel: 'SYNDICATE', intent: 'notify' }).allowed ? 'SYNDICATE' : 'GLOBAL';
    case 'RUN_COMEBACK':
      return 'GLOBAL';
    case 'PRESSURE_TIER_CHANGED':
      return snapshot.haterHeat >= DEFAULT_THRESHOLDS.haterHeatSpikeThreshold ? 'GLOBAL' : fallback;
    default:
      return fallback;
  }
}

function buildPayload(
  next: RunStoreMirrorSnapshot,
  previous: RunStoreMirrorSnapshot | null,
  eventName: RunDeltaEventName,
): Record<string, unknown> {
  return {
    eventName,
    runId: next.runId,
    userId: next.userId,
    seed: next.seed,
    netWorth: next.netWorth,
    cashBalance: next.cashBalance,
    monthlyIncome: next.monthlyIncome,
    monthlyExpenses: next.monthlyExpenses,
    cashflow: next.cashflow,
    haterHeat: next.haterHeat,
    activeThreatCardCount: next.activeThreatCardCount,
    previousNetWorth: previous?.netWorth,
    previousCashBalance: previous?.cashBalance,
    previousMonthlyIncome: previous?.monthlyIncome,
    previousMonthlyExpenses: previous?.monthlyExpenses,
    previousCashflow: previous?.cashflow,
    previousHaterHeat: previous?.haterHeat,
    previousActiveThreatCardCount: previous?.activeThreatCardCount,
  };
}

function classifyHealthBand(snapshot: RunStoreMirrorSnapshot, thresholds: RunStoreThresholds): RunHealthBand {
  if (isBankruptcyTriggered(snapshot, thresholds)) return 'COLLAPSE';
  if (isBankruptcyWarning(snapshot, thresholds)) return 'CRITICAL';
  if (snapshot.cashflow < thresholds.negativeCashflowWarning || snapshot.haterHeat >= thresholds.haterHeatSpikeThreshold) return 'STRAINED';
  if (snapshot.cashflow < thresholds.stabilizationCashflowFloor || snapshot.activeThreatCardCount > 0) return 'WATCH';
  return 'STABLE';
}

function classifyPressureTier(
  snapshot: RunStoreMirrorSnapshot,
  previous: RunStoreMirrorSnapshot | null,
  thresholds: RunStoreThresholds,
): string {
  const stressScore =
    (snapshot.cashflow < 0 ? 2 : 0)
    + (snapshot.cashBalance <= thresholds.cashCriticalThreshold ? 2 : 0)
    + (snapshot.haterHeat >= thresholds.haterHeatSpikeThreshold ? 2 : snapshot.haterHeat >= thresholds.haterHeatSpikeThreshold * 0.7 ? 1 : 0)
    + (snapshot.activeThreatCardCount >= thresholds.threatSurgeThreshold ? 2 : snapshot.activeThreatCardCount > 0 ? 1 : 0)
    + (previous && snapshot.netWorth < previous.netWorth ? 1 : 0);

  if (stressScore >= 6) return 'CRITICAL';
  if (stressScore >= 4) return 'HIGH';
  if (stressScore >= 2) return 'MEDIUM';
  return 'LOW';
}

function inferGamePhase(snapshot: RunStoreMirrorSnapshot): string {
  if (!snapshot.isInitialized) return 'FOYER';
  if (snapshot.netWorth <= 0) return 'COLLAPSE';
  if (snapshot.activeThreatCardCount > 0 || snapshot.haterHeat >= 60) return 'PRESSURE_MONITOR';
  if (snapshot.monthlyIncome > 0 && snapshot.cashflow > 0) return 'BUILD';
  return 'RUN_ACTIVE';
}

function isBankruptcyWarning(snapshot: RunStoreMirrorSnapshot, thresholds: RunStoreThresholds): boolean {
  return snapshot.netWorth <= thresholds.bankruptcyWarningNetWorth
    || snapshot.cashBalance <= thresholds.cashCriticalThreshold
    || snapshot.cashflow < thresholds.negativeCashflowWarning;
}

function isBankruptcyTriggered(snapshot: RunStoreMirrorSnapshot, thresholds: RunStoreThresholds): boolean {
  return snapshot.netWorth <= thresholds.bankruptcyTriggerNetWorth
    || (snapshot.cashBalance <= 0 && snapshot.cashflow < thresholds.negativeCashflowWarning)
    || (snapshot.netWorth <= thresholds.bankruptcyWarningNetWorth * 0.2 && snapshot.activeThreatCardCount >= thresholds.threatSurgeThreshold);
}

function detectComeback(
  previous: RunStoreMirrorSnapshot,
  next: RunStoreMirrorSnapshot,
  anchorNetWorth: number,
  thresholds: RunStoreThresholds,
): boolean {
  const absoluteGain = next.netWorth - anchorNetWorth;
  const relativeGain = anchorNetWorth <= 0 ? (absoluteGain >= thresholds.comebackAbsoluteGain ? 1 : 0) : absoluteGain / Math.max(1, Math.abs(anchorNetWorth));
  return next.netWorth > previous.netWorth
    && absoluteGain >= thresholds.comebackAbsoluteGain
    && relativeGain >= thresholds.comebackPercentGain;
}

function computeDrawdown(previousNetWorth: number, nextNetWorth: number, peakNetWorth: number): number {
  const peak = Math.max(1, peakNetWorth, previousNetWorth, nextNetWorth);
  return clamp((peak - nextNetWorth) / peak, 0, 1);
}

function buildDedupKey(
  eventName: RunDeltaEventName,
  next: RunStoreMirrorSnapshot,
  previous: RunStoreMirrorSnapshot | null,
  channel: ChatChannel,
): string {
  return stableStringify({
    eventName,
    channel,
    runId: next.runId,
    netWorth: roundedBucket(next.netWorth, 250),
    cashBalance: roundedBucket(next.cashBalance, 100),
    cashflow: roundedBucket(next.cashflow, 100),
    haterHeat: roundedBucket(next.haterHeat, 2),
    activeThreatCardCount: next.activeThreatCardCount,
    previousNetWorth: previous ? roundedBucket(previous.netWorth, 250) : null,
    previousCashflow: previous ? roundedBucket(previous.cashflow, 100) : null,
  });
}

function inferTickTierFromLastUpdated(lastUpdated: number | null | undefined): string | undefined {
  if (lastUpdated == null) return undefined;
  const age = Math.max(0, now() - lastUpdated);
  if (age < 2_000) return 'LIVE';
  if (age < 12_000) return 'FRESH';
  return 'STALE';
}

function resolveWitnessChannel(policy: ChatChannelPolicy, preferred: ChatChannel): ChatChannel {
  const evaluation = policy.evaluateChannel({ channel: preferred, intent: 'notify' });
  return evaluation.allowed ? preferred : evaluation.fallbackChannel;
}

function milestoneBucket(value: number, step: number): number {
  if (step <= 0) return 0;
  return Math.floor(value / step);
}

function milestoneFloor(value: number, step: number): number {
  return milestoneBucket(value, step) * step;
}

function roundedBucket(value: number, size: number): number {
  if (!Number.isFinite(value) || size <= 0) return 0;
  return Math.round(value / size) * size;
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

function hashRecordKey(parts: readonly string[]): string {
  let hash = 2166136261;
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 1) {
      hash ^= part.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `run.${(hash >>> 0).toString(36)}`;
}

function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
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

function mergeConfig(base: RunStoreAdapterConfig, override?: Partial<RunStoreAdapterConfig>): RunStoreAdapterConfig {
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
