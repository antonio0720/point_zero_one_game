/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ENGINE 0 ZERO EVENT BRIDGE
 * pzo-web/src/engines/zero/ZeroEventBridge.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Purpose
 * - Provide a zero-owned subscription and observation layer for frontend/runtime
 *   consumers that need EventBus access without touching engine primitives.
 * - Preserve the existing EventBus contract already present in the repo.
 * - Register a broad authoritative channel set once, then expose:
 *   - strongly typed event subscriptions
 *   - one-shot listeners
 *   - grouped subscriptions
 *   - event history / counts / metrics
 *   - pending-queue inspection
 *   - relay hooks for diagnostics and devtools
 *
 * Doctrine
 * - This file does NOT mutate engine state.
 * - This file does NOT call engine methods.
 * - This file does NOT replace EventBus.
 * - This file observes, routes, and records.
 *
 * Architecture notes
 * - core/EventBus.ts extends zero/EventBus.ts and adds:
 *   - eventRegistry
 *   - handlers
 *   - registerEventChannels()
 *   - register()
 *   - unregister()
 * - zero/EventBus.ts already provides:
 *   - on()
 *   - once()
 *   - emit()
 *   - flush()
 *   - getPendingCount()
 *   - getPendingSnapshot()
 *   - isCurrentlyFlushing
 *
 * Density6 LLC · Point Zero One · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  EventBus,
  sharedEventBus,
  type EventChannelConfig,
} from '../core/EventBus';
import type {
  EngineEvent,
  EngineEventName,
  EngineId,
} from './types';

export type ZeroEventBridgeSubscriptionScope =
  | 'LIFECYCLE'
  | 'TIME'
  | 'PRESSURE'
  | 'TENSION'
  | 'SHIELD'
  | 'BATTLE'
  | 'CASCADE'
  | 'CARD'
  | 'SOVEREIGNTY'
  | 'MECHANICS'
  | 'ALL';

export interface ZeroObservedEventRecord<
  T extends EngineEventName = EngineEventName,
> {
  readonly sequence: number;
  readonly observedAt: number;
  readonly event: EngineEvent<T>;
}

export interface ZeroEventBridgeMetrics {
  readonly registeredChannelCount: number;
  readonly trackedEventTypeCount: number;
  readonly totalObservedEvents: number;
  readonly pendingEventCount: number;
  readonly isFlushing: boolean;
  readonly countsByType: Readonly<Record<string, number>>;
  readonly countsBySourceEngine: Readonly<Record<string, number>>;
  readonly lastObservedEvent: ZeroObservedEventRecord | null;
}

export interface ZeroEventBridgeOptions {
  eventBus?: EventBus;
  autoRegisterDefaultChannels?: boolean;
  captureHistory?: boolean;
  historyLimit?: number;
}

export interface ZeroEventRelayTarget {
  onEventObserved?: (
    record: ZeroObservedEventRecord,
    bridge: ZeroEventBridge,
  ) => void;
}

export interface ZeroEventBridgeChannelGroup {
  readonly scope: ZeroEventBridgeSubscriptionScope;
  readonly events: readonly EngineEventName[];
}

type EventHandler<T extends EngineEventName> = (event: EngineEvent<T>) => void;
type Unsubscribe = () => void;

const CHANNEL_SCOPE_MAP: Readonly<Record<ZeroEventBridgeSubscriptionScope, readonly EngineEventName[]>> = {
  LIFECYCLE: [
    'RUN_STARTED',
    'RUN_ENDED',
    'ENGINE_ERROR',
    'TICK_STEP_ERROR',
    'TICK_START',
    'TICK_COMPLETE',
  ],
  TIME: [
    'TICK_TIER_CHANGED',
    'TICK_TIER_FORCED',
    'DECISION_WINDOW_OPENED',
    'DECISION_WINDOW_EXPIRED',
    'DECISION_WINDOW_RESOLVED',
    'SEASON_TIMEOUT_IMMINENT',
  ],
  PRESSURE: [
    'PRESSURE_TIER_CHANGED',
    'PRESSURE_CRITICAL',
    'PRESSURE_SCORE_UPDATED',
  ],
  TENSION: [
    'TENSION_SCORE_UPDATED',
    'ANTICIPATION_PULSE',
    'THREAT_VISIBILITY_CHANGED',
    'THREAT_QUEUED',
    'THREAT_ARRIVED',
    'THREAT_MITIGATED',
    'THREAT_EXPIRED',
  ],
  SHIELD: [
    'SHIELD_LAYER_DAMAGED',
    'SHIELD_LAYER_BREACHED',
    'SHIELD_REPAIRED',
    'SHIELD_PASSIVE_REGEN',
  ],
  BATTLE: [
    'BOT_STATE_CHANGED',
    'BOT_ATTACK_FIRED',
    'BOT_NEUTRALIZED',
    'COUNTER_INTEL_AVAILABLE',
    'BATTLE_BUDGET_UPDATED',
    'SYNDICATE_DUEL_RESULT',
  ],
  CASCADE: [
    'CASCADE_CHAIN_TRIGGERED',
    'CASCADE_LINK_FIRED',
    'CASCADE_CHAIN_BROKEN',
    'CASCADE_CHAIN_COMPLETED',
    'POSITIVE_CASCADE_ACTIVATED',
  ],
  CARD: [
    'CARD_DRAWN',
    'CARD_PLAYED',
    'CARD_DISCARDED',
    'CARD_HELD',
    'CARD_UNHELD',
    'CARD_AUTO_RESOLVED',
    'FORCED_CARD_INJECTED',
    'FORCED_CARD_RESOLVED',
    'MISSED_OPPORTUNITY',
    'PHASE_BOUNDARY_CARD_AVAILABLE',
    'PHASE_BOUNDARY_WINDOW_CLOSED',
    'LEGENDARY_CARD_DRAWN',
    'BLUFF_CARD_DISPLAYED',
    'COUNTER_WINDOW_OPENED',
    'COUNTER_WINDOW_CLOSED',
    'RESCUE_WINDOW_OPENED',
    'RESCUE_WINDOW_CLOSED',
    'DEFECTION_STEP_PLAYED',
    'DEFECTION_COMPLETED',
    'AID_TERMS_ACTIVATED',
    'AID_REPAID',
    'AID_DEFAULTED',
    'GHOST_CARD_ACTIVATED',
    'PROOF_BADGE_CONDITION_MET',
    'CARD_HAND_SNAPSHOT',
  ],
  SOVEREIGNTY: [
    'RUN_COMPLETED',
    'PROOF_VERIFICATION_FAILED',
    'RUN_REWARD_DISPATCHED',
    'PROOF_ARTIFACT_READY',
  ],
  MECHANICS: [
    'MECHANIC_INCOME_DELTA',
    'MECHANIC_EXPENSE_DELTA',
    'MECHANIC_CASH_DELTA',
    'MECHANIC_NET_WORTH_DELTA',
    'MECHANIC_SHIELD_DELTA',
    'MECHANIC_HEAT_DELTA',
    'MECHANIC_PRESSURE_DELTA',
    'MECHANIC_TENSION_DELTA',
    'MECHANIC_CORD_DELTA',
    'MECHANIC_FREEZE_TICKS',
    'MECHANIC_CUSTOM_PAYLOAD',
    'MECHANIC_FIRED',
    'MECHANIC_CASCADE_LINK',
    'MECHANICS_TICK_COMPLETE',
  ],
  ALL: [],
} as const;

const DEFAULT_CHANNELS: ReadonlyArray<EventChannelConfig> = [
  // ── Lifecycle ─────────────────────────────────────────────────────────────
  { name: 'RUN_STARTED', description: 'Engine 0 lifecycle start event' },
  { name: 'RUN_ENDED', description: 'Engine 0 lifecycle end event' },
  { name: 'ENGINE_ERROR', description: 'Immediate engine fault event' },
  { name: 'TICK_STEP_ERROR', description: 'Immediate per-step fault event' },
  { name: 'TICK_START', description: 'Tick pre-step marker' },
  { name: 'TICK_COMPLETE', description: 'Tick completion envelope' },

  // ── Time ─────────────────────────────────────────────────────────────────
  { name: 'TICK_TIER_CHANGED', description: 'Tick tier changed for next cadence' },
  { name: 'TICK_TIER_FORCED', description: 'Forced tick tier override' },
  { name: 'DECISION_WINDOW_OPENED', description: 'Decision window opened' },
  { name: 'DECISION_WINDOW_EXPIRED', description: 'Decision window expired' },
  { name: 'DECISION_WINDOW_RESOLVED', description: 'Decision window resolved' },
  { name: 'SEASON_TIMEOUT_IMMINENT', description: 'Timeout warning for run clock' },

  // ── Pressure ─────────────────────────────────────────────────────────────
  { name: 'PRESSURE_TIER_CHANGED', description: 'Pressure tier change' },
  { name: 'PRESSURE_CRITICAL', description: 'Pressure critical threshold crossed' },
  { name: 'PRESSURE_SCORE_UPDATED', description: 'Pressure score updated' },

  // ── Tension ──────────────────────────────────────────────────────────────
  { name: 'TENSION_SCORE_UPDATED', description: 'Tension score updated' },
  { name: 'ANTICIPATION_PULSE', description: 'Tension pulse fired' },
  { name: 'THREAT_VISIBILITY_CHANGED', description: 'Threat visibility changed' },
  { name: 'THREAT_QUEUED', description: 'Threat entered queue' },
  { name: 'THREAT_ARRIVED', description: 'Threat arrived in active lane' },
  { name: 'THREAT_MITIGATED', description: 'Threat mitigated' },
  { name: 'THREAT_EXPIRED', description: 'Threat expired' },

  // ── Shield ───────────────────────────────────────────────────────────────
  { name: 'SHIELD_LAYER_DAMAGED', description: 'Shield layer damaged' },
  { name: 'SHIELD_LAYER_BREACHED', description: 'Shield layer breached' },
  { name: 'SHIELD_REPAIRED', description: 'Shield layer repaired' },
  { name: 'SHIELD_PASSIVE_REGEN', description: 'Shield passive regeneration applied' },

  // ── Battle ───────────────────────────────────────────────────────────────
  { name: 'BOT_STATE_CHANGED', description: 'Hater bot state changed' },
  { name: 'BOT_ATTACK_FIRED', description: 'Hater bot fired an attack' },
  { name: 'BOT_NEUTRALIZED', description: 'Hater bot neutralized' },
  { name: 'COUNTER_INTEL_AVAILABLE', description: 'Counter-intel data became available' },
  { name: 'BATTLE_BUDGET_UPDATED', description: 'Battle budget updated' },
  { name: 'SYNDICATE_DUEL_RESULT', description: 'Syndicate duel result published' },

  // ── Cascade ──────────────────────────────────────────────────────────────
  { name: 'CASCADE_CHAIN_TRIGGERED', description: 'Cascade chain triggered' },
  { name: 'CASCADE_LINK_FIRED', description: 'Cascade link executed' },
  { name: 'CASCADE_CHAIN_BROKEN', description: 'Cascade chain broken' },
  { name: 'CASCADE_CHAIN_COMPLETED', description: 'Cascade chain completed' },
  { name: 'POSITIVE_CASCADE_ACTIVATED', description: 'Positive cascade activated' },

  // ── Card ─────────────────────────────────────────────────────────────────
  { name: 'CARD_DRAWN', description: 'Card drawn into hand' },
  { name: 'CARD_PLAYED', description: 'Card played' },
  { name: 'CARD_DISCARDED', description: 'Card discarded' },
  { name: 'CARD_HELD', description: 'Card placed on hold' },
  { name: 'CARD_UNHELD', description: 'Card hold released' },
  { name: 'CARD_AUTO_RESOLVED', description: 'Card auto-resolved' },
  { name: 'FORCED_CARD_INJECTED', description: 'Forced card injected' },
  { name: 'FORCED_CARD_RESOLVED', description: 'Forced card resolved' },
  { name: 'MISSED_OPPORTUNITY', description: 'Opportunity missed' },
  { name: 'PHASE_BOUNDARY_CARD_AVAILABLE', description: 'Phase boundary card available' },
  { name: 'PHASE_BOUNDARY_WINDOW_CLOSED', description: 'Phase boundary closed' },
  { name: 'LEGENDARY_CARD_DRAWN', description: 'Legendary card drawn' },
  { name: 'BLUFF_CARD_DISPLAYED', description: 'Bluff card displayed' },
  { name: 'COUNTER_WINDOW_OPENED', description: 'Counter window opened' },
  { name: 'COUNTER_WINDOW_CLOSED', description: 'Counter window closed' },
  { name: 'RESCUE_WINDOW_OPENED', description: 'Rescue window opened' },
  { name: 'RESCUE_WINDOW_CLOSED', description: 'Rescue window closed' },
  { name: 'DEFECTION_STEP_PLAYED', description: 'Defection step played' },
  { name: 'DEFECTION_COMPLETED', description: 'Defection sequence completed' },
  { name: 'AID_TERMS_ACTIVATED', description: 'Aid terms activated' },
  { name: 'AID_REPAID', description: 'Aid repaid' },
  { name: 'AID_DEFAULTED', description: 'Aid defaulted' },
  { name: 'GHOST_CARD_ACTIVATED', description: 'Ghost card activated' },
  { name: 'PROOF_BADGE_CONDITION_MET', description: 'Proof badge condition met' },
  { name: 'CARD_HAND_SNAPSHOT', description: 'Card hand snapshot updated' },

  // ── Sovereignty ──────────────────────────────────────────────────────────
  { name: 'RUN_COMPLETED', description: 'Sovereignty completion payload ready' },
  { name: 'PROOF_VERIFICATION_FAILED', description: 'Proof verification failed' },
  { name: 'RUN_REWARD_DISPATCHED', description: 'Reward dispatched' },
  { name: 'PROOF_ARTIFACT_READY', description: 'Proof artifact export ready' },

  // ── Mechanics ────────────────────────────────────────────────────────────
  { name: 'MECHANIC_INCOME_DELTA', description: 'Mechanic income delta' },
  { name: 'MECHANIC_EXPENSE_DELTA', description: 'Mechanic expense delta' },
  { name: 'MECHANIC_CASH_DELTA', description: 'Mechanic cash delta' },
  { name: 'MECHANIC_NET_WORTH_DELTA', description: 'Mechanic net worth delta' },
  { name: 'MECHANIC_SHIELD_DELTA', description: 'Mechanic shield delta' },
  { name: 'MECHANIC_HEAT_DELTA', description: 'Mechanic heat delta' },
  { name: 'MECHANIC_PRESSURE_DELTA', description: 'Mechanic pressure delta' },
  { name: 'MECHANIC_TENSION_DELTA', description: 'Mechanic tension delta' },
  { name: 'MECHANIC_CORD_DELTA', description: 'Mechanic CORD delta' },
  { name: 'MECHANIC_FREEZE_TICKS', description: 'Mechanic freeze tick effect' },
  { name: 'MECHANIC_CUSTOM_PAYLOAD', description: 'Mechanic custom payload' },
  { name: 'MECHANIC_FIRED', description: 'Mechanic fired' },
  { name: 'MECHANIC_CASCADE_LINK', description: 'Mechanic cascade link' },
  { name: 'MECHANICS_TICK_COMPLETE', description: 'Mechanics tick completion' },
] as const;

function buildAllScopeEvents(): readonly EngineEventName[] {
  const out = new Set<EngineEventName>();

  for (const [scope, events] of Object.entries(CHANNEL_SCOPE_MAP)) {
    if (scope === 'ALL') continue;
    for (const eventName of events) {
      out.add(eventName);
    }
  }

  return [...out];
}

function safeEventSourceKey(sourceEngine?: EngineId): string {
  return sourceEngine ?? 'UNKNOWN_SOURCE';
}

export class ZeroEventBridge {
  private readonly eventBus: EventBus;
  private readonly captureHistory: boolean;
  private readonly historyLimit: number;

  private readonly eventCounts = new Map<EngineEventName, number>();
  private readonly sourceCounts = new Map<string, number>();
  private readonly history: ZeroObservedEventRecord[] = [];
  private readonly relayTargets = new Set<ZeroEventRelayTarget>();

  private sequence = 0;

  public constructor(options: ZeroEventBridgeOptions = {}) {
    this.eventBus = options.eventBus ?? sharedEventBus;
    this.captureHistory = options.captureHistory !== false;
    this.historyLimit = Math.max(64, options.historyLimit ?? 1024);

    if (options.autoRegisterDefaultChannels !== false) {
      this.registerDefaultChannels();
    }
  }

  public getEventBus(): EventBus {
    return this.eventBus;
  }

  public registerDefaultChannels(): void {
    this.eventBus.registerEventChannels([...DEFAULT_CHANNELS]);
  }

  public registerChannels(channels: readonly EventChannelConfig[]): void {
    this.eventBus.registerEventChannels([...channels]);
  }

  public getDefaultChannelGroups(): readonly ZeroEventBridgeChannelGroup[] {
    return [
      { scope: 'LIFECYCLE', events: CHANNEL_SCOPE_MAP.LIFECYCLE },
      { scope: 'TIME', events: CHANNEL_SCOPE_MAP.TIME },
      { scope: 'PRESSURE', events: CHANNEL_SCOPE_MAP.PRESSURE },
      { scope: 'TENSION', events: CHANNEL_SCOPE_MAP.TENSION },
      { scope: 'SHIELD', events: CHANNEL_SCOPE_MAP.SHIELD },
      { scope: 'BATTLE', events: CHANNEL_SCOPE_MAP.BATTLE },
      { scope: 'CASCADE', events: CHANNEL_SCOPE_MAP.CASCADE },
      { scope: 'CARD', events: CHANNEL_SCOPE_MAP.CARD },
      { scope: 'SOVEREIGNTY', events: CHANNEL_SCOPE_MAP.SOVEREIGNTY },
      { scope: 'MECHANICS', events: CHANNEL_SCOPE_MAP.MECHANICS },
      { scope: 'ALL', events: buildAllScopeEvents() },
    ] as const;
  }

  public subscribe<T extends EngineEventName>(
    eventType: T,
    handler: EventHandler<T>,
    options: { captureHistory?: boolean } = {},
  ): Unsubscribe {
    const unsubscribe = this.eventBus.on(eventType, (event) => {
      if (options.captureHistory !== false) {
        this.observeEvent(event as EngineEvent);
      }

      handler(event as EngineEvent<T>);
    });

    return unsubscribe;
  }

  public once<T extends EngineEventName>(
    eventType: T,
    handler: EventHandler<T>,
    options: { captureHistory?: boolean } = {},
  ): void {
    this.eventBus.once(eventType, (event) => {
      if (options.captureHistory !== false) {
        this.observeEvent(event as EngineEvent);
      }

      handler(event as EngineEvent<T>);
    });
  }

  public subscribeMany(
    eventTypes: readonly EngineEventName[],
    handler: (event: EngineEvent) => void,
    options: { captureHistory?: boolean } = {},
  ): Unsubscribe {
    const unsubscribers = eventTypes.map((eventType) =>
      this.subscribe(eventType, handler as EventHandler<any>, options),
    );

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }

  public subscribeScope(
    scope: ZeroEventBridgeSubscriptionScope,
    handler: (event: EngineEvent) => void,
    options: { captureHistory?: boolean } = {},
  ): Unsubscribe {
    const eventTypes =
      scope === 'ALL' ? buildAllScopeEvents() : CHANNEL_SCOPE_MAP[scope];

    return this.subscribeMany(eventTypes, handler, options);
  }

  public addRelayTarget(target: ZeroEventRelayTarget): () => void {
    this.relayTargets.add(target);

    return () => {
      this.relayTargets.delete(target);
    };
  }

  public observeEvent<T extends EngineEventName>(event: EngineEvent<T>): ZeroObservedEventRecord<T> {
    const record: ZeroObservedEventRecord<T> = {
      sequence: ++this.sequence,
      observedAt: Date.now(),
      event,
    };

    this.eventCounts.set(event.eventType, (this.eventCounts.get(event.eventType) ?? 0) + 1);

    const sourceKey = safeEventSourceKey(event.sourceEngine);
    this.sourceCounts.set(sourceKey, (this.sourceCounts.get(sourceKey) ?? 0) + 1);

    if (this.captureHistory) {
      this.history.push(record as ZeroObservedEventRecord);

      while (this.history.length > this.historyLimit) {
        this.history.shift();
      }
    }

    for (const target of this.relayTargets) {
      try {
        target.onEventObserved?.(record, this);
      } catch {
        // Relay observers are non-authoritative and must never destabilize runtime.
      }
    }

    return record;
  }

  public getMetrics(): ZeroEventBridgeMetrics {
    const countsByType: Record<string, number> = {};
    const countsBySourceEngine: Record<string, number> = {};

    for (const [eventName, count] of this.eventCounts.entries()) {
      countsByType[eventName] = count;
    }

    for (const [source, count] of this.sourceCounts.entries()) {
      countsBySourceEngine[source] = count;
    }

    return {
      registeredChannelCount: this.eventBus.getRegisteredChannels().length,
      trackedEventTypeCount: this.eventCounts.size,
      totalObservedEvents: this.history.length,
      pendingEventCount: this.eventBus.getPendingCount(),
      isFlushing: this.eventBus.isCurrentlyFlushing,
      countsByType,
      countsBySourceEngine,
      lastObservedEvent: this.history.length ? this.history[this.history.length - 1] : null,
    };
  }

  public getObservedHistory(limit = 256): readonly ZeroObservedEventRecord[] {
    const safeLimit = Math.max(1, Math.trunc(limit));
    return this.history.slice(-safeLimit);
  }

  public getPendingQueueSnapshot(): ReadonlyArray<EngineEvent> {
    return this.eventBus.getPendingSnapshot();
  }

  public clearObservedHistory(): void {
    this.history.length = 0;
  }

  public resetMetrics(): void {
    this.eventCounts.clear();
    this.sourceCounts.clear();
    this.history.length = 0;
    this.sequence = 0;
  }

  public destroy(): void {
    this.relayTargets.clear();
    this.resetMetrics();
  }
}

export const zeroEventBridge = new ZeroEventBridge();

export default zeroEventBridge;