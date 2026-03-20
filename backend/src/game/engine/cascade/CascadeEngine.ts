/*
 * POINT ZERO ONE — BACKEND CASCADE ENGINE
 * /backend/src/game/engine/cascade/CascadeEngine.ts
 *
 * Doctrine:
 * - backend is the authoritative cascade runtime
 * - chains are triggered from authoritative events, not UI assumptions
 * - recovery and progression are deterministic per tick
 * - shield/economy writes must return a self-consistent snapshot
 * - mode/native identity must materially change cascade pacing and effect shape
 * - cascade execution must produce inspectable, replay-safe event consequences
 * - positive cascades are earned operational states, not cosmetic applause
 */

import type {
  CascadeChainInstance,
  EffectPayload,
  ModeCode,
  PressureTier,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type {
  EngineHealth,
  SimulationEngine,
  TickContext,
} from '../core/EngineContracts';
import type {
  EconomyState,
  RunStateSnapshot,
  ShieldLayerState,
  ShieldState,
} from '../core/RunStateSnapshot';
import { CascadeChainRegistry } from './CascadeChainRegistry';
import { CascadeQueueManager } from './CascadeQueueManager';
import { PositiveCascadeTracker } from './PositiveCascadeTracker';
import { RecoveryConditionChecker } from './RecoveryConditionChecker';
import type {
  CascadeSeverity,
  CascadeTemplate,
  CascadeTemplateId,
} from './types';

/**
 * A stable family of authoritative inbound events that may generate cascade pressure.
 * The engine accepts aliases because the broader runtime is still converging on
 * final event vocabulary, but the internal normalization is deterministic.
 */
type CascadeInboundEventName =
  | 'shield.breached'
  | 'shield.layer_breached'
  | 'battle.attack.resolved'
  | 'battle.attack.applied'
  | 'pressure.critical'
  | 'pressure.tier_changed'
  | 'economy.networth_collapsed'
  | 'economy.cash_negative'
  | 'economy.privileged_play_recorded'
  | 'mode.shared_treasury_collapsed'
  | 'mode.trust_cracked'
  | 'cards.fubar_injected'
  | 'cards.fate_triggered';

type CascadeEventOrigin = 'SHIELD' | 'BATTLE' | 'PRESSURE' | 'ECONOMY' | 'MODE' | 'CARDS' | 'SYSTEM';

type CascadeTriggerFamily =
  | `shield:${ShieldLayerId}`
  | `pressure:${PressureTier}`
  | `economy:${string}`
  | `mode:${string}`
  | `cards:${string}`
  | `positive:${CascadeTemplateId}`
  | `manual:${string}`;

interface NormalizedCascadeEvent {
  readonly sourceEvent: CascadeInboundEventName;
  readonly origin: CascadeEventOrigin;
  readonly tick: number;
  readonly id: string;
  readonly triggerFamily: CascadeTriggerFamily;
  readonly severityHint: CascadeSeverity;
  readonly layerId?: ShieldLayerId;
  readonly attackId?: string;
  readonly templateHint?: CascadeTemplateId;
  readonly notes: readonly string[];
  readonly payload: Readonly<Record<string, unknown>>;
}

interface ChainExecutionDelta {
  readonly cashDelta: number;
  readonly debtDelta: number;
  readonly incomeDelta: number;
  readonly expensesDelta: number;
  readonly heatDelta: number;
  readonly shieldDelta: number;
  readonly trustDelta: number;
  readonly timeDeltaMs: number;
  readonly divergenceDelta: number;
  readonly injectedCards: readonly string[];
  readonly proofBadges: readonly string[];
  readonly auditFlags: readonly string[];
  readonly notes: readonly string[];
}

interface ChainProgressResult {
  readonly nextChain: CascadeChainInstance | null;
  readonly delta: ChainExecutionDelta;
  readonly progressedLinks: readonly ChainProgressedLink[];
  readonly completed: boolean;
  readonly broken: boolean;
  readonly stateTransitionNotes: readonly string[];
}

interface ChainProgressedLink {
  readonly chainId: string;
  readonly templateId: string;
  readonly linkId: string;
  readonly tick: number;
  readonly summary: string;
  readonly effect: EffectPayload;
}

interface CascadeRuntimeStats {
  readonly createdNegative: number;
  readonly createdPositive: number;
  readonly completed: number;
  readonly broken: number;
  readonly progressed: number;
  readonly triggeredByShield: number;
  readonly triggeredByPressure: number;
  readonly triggeredByEconomy: number;
  readonly triggeredByMode: number;
  readonly triggeredByCards: number;
  readonly suppressed: number;
}

interface CascadeRuntimeMemory {
  readonly dedupeByTick: Readonly<Record<number, readonly string[]>>;
  readonly unlockedPositiveIds: readonly string[];
  readonly lastSignals: readonly string[];
  readonly lastTickProcessed: number | null;
}

interface CascadeDecisionTrace {
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunStateSnapshot['phase'];
  readonly normalizedEvents: readonly NormalizedCascadeEvent[];
  readonly createdChains: readonly CascadeChainInstance[];
  readonly suppressedEventIds: readonly string[];
  readonly progressedLinks: readonly ChainProgressedLink[];
  readonly stats: CascadeRuntimeStats;
  readonly notes: readonly string[];
}

interface MutableRuntimeStats {
  createdNegative: number;
  createdPositive: number;
  completed: number;
  broken: number;
  progressed: number;
  triggeredByShield: number;
  triggeredByPressure: number;
  triggeredByEconomy: number;
  triggeredByMode: number;
  triggeredByCards: number;
  suppressed: number;
}

const CASCADE_EVENT_NAMES: readonly CascadeInboundEventName[] = Object.freeze([
  'shield.breached',
  'shield.layer_breached',
  'battle.attack.resolved',
  'battle.attack.applied',
  'pressure.critical',
  'pressure.tier_changed',
  'economy.networth_collapsed',
  'economy.cash_negative',
  'economy.privileged_play_recorded',
  'mode.shared_treasury_collapsed',
  'mode.trust_cracked',
  'cards.fubar_injected',
  'cards.fate_triggered',
]);

const LAYER_TEMPLATE_FALLBACK: Readonly<Record<ShieldLayerId, CascadeTemplateId>> = Object.freeze({
  L1: 'LIQUIDITY_SPIRAL',
  L2: 'CREDIT_FREEZE',
  L3: 'INCOME_SHOCK',
  L4: 'NETWORK_LOCKDOWN',
});

const PRESSURE_TEMPLATE_HINTS: Readonly<Record<PressureTier, readonly CascadeTemplateId[]>> = Object.freeze({
  T0: Object.freeze([]),
  T1: Object.freeze(['LIQUIDITY_SPIRAL']),
  T2: Object.freeze(['LIQUIDITY_SPIRAL', 'CREDIT_FREEZE']),
  T3: Object.freeze(['CREDIT_FREEZE', 'INCOME_SHOCK']),
  T4: Object.freeze(['INCOME_SHOCK', 'NETWORK_LOCKDOWN']),
});

const MODE_SEVERITY_BIAS: Readonly<Record<ModeCode, Readonly<Record<CascadeSeverity, number>>>> = Object.freeze({
  solo: Object.freeze({ LOW: 1.0, MEDIUM: 1.0, HIGH: 1.1, CRITICAL: 1.2 }),
  pvp: Object.freeze({ LOW: 0.9, MEDIUM: 1.05, HIGH: 1.15, CRITICAL: 1.25 }),
  coop: Object.freeze({ LOW: 0.95, MEDIUM: 1.0, HIGH: 1.1, CRITICAL: 1.15 }),
  ghost: Object.freeze({ LOW: 0.85, MEDIUM: 0.95, HIGH: 1.0, CRITICAL: 1.1 }),
});

const PRESSURE_SCALAR_ORDER: readonly PressureTier[] = Object.freeze(['T0', 'T1', 'T2', 'T3', 'T4']);
const SEVERITY_ORDER: readonly CascadeSeverity[] = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const MAX_RUNTIME_MEMORY_TICKS = 24;
const DEFAULT_HEALTHY_NOTE = 'Cascade engine operational.';
const DEFAULT_RESET_NOTE = 'Cascade engine reset.';
const DEFAULT_INIT_NOTE = 'Cascade engine initialized.';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function safeArray<T>(value: readonly T[] | null | undefined): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function createEmptyDelta(): ChainExecutionDelta {
  return {
    cashDelta: 0,
    debtDelta: 0,
    incomeDelta: 0,
    expensesDelta: 0,
    heatDelta: 0,
    shieldDelta: 0,
    trustDelta: 0,
    timeDeltaMs: 0,
    divergenceDelta: 0,
    injectedCards: [],
    proofBadges: [],
    auditFlags: [],
    notes: [],
  };
}

function mergeDelta(
  left: ChainExecutionDelta,
  right: Partial<ChainExecutionDelta>,
): ChainExecutionDelta {
  return {
    cashDelta: left.cashDelta + (right.cashDelta ?? 0),
    debtDelta: left.debtDelta + (right.debtDelta ?? 0),
    incomeDelta: left.incomeDelta + (right.incomeDelta ?? 0),
    expensesDelta: left.expensesDelta + (right.expensesDelta ?? 0),
    heatDelta: left.heatDelta + (right.heatDelta ?? 0),
    shieldDelta: left.shieldDelta + (right.shieldDelta ?? 0),
    trustDelta: left.trustDelta + (right.trustDelta ?? 0),
    timeDeltaMs: left.timeDeltaMs + (right.timeDeltaMs ?? 0),
    divergenceDelta: left.divergenceDelta + (right.divergenceDelta ?? 0),
    injectedCards: [...left.injectedCards, ...(right.injectedCards ?? [])],
    proofBadges: [...left.proofBadges, ...(right.proofBadges ?? [])],
    auditFlags: [...left.auditFlags, ...(right.auditFlags ?? [])],
    notes: [...left.notes, ...(right.notes ?? [])],
  };
}

function freezeStats(stats: MutableRuntimeStats): CascadeRuntimeStats {
  return Object.freeze({
    createdNegative: stats.createdNegative,
    createdPositive: stats.createdPositive,
    completed: stats.completed,
    broken: stats.broken,
    progressed: stats.progressed,
    triggeredByShield: stats.triggeredByShield,
    triggeredByPressure: stats.triggeredByPressure,
    triggeredByEconomy: stats.triggeredByEconomy,
    triggeredByMode: stats.triggeredByMode,
    triggeredByCards: stats.triggeredByCards,
    suppressed: stats.suppressed,
  });
}

function createMutableStats(): MutableRuntimeStats {
  return {
    createdNegative: 0,
    createdPositive: 0,
    completed: 0,
    broken: 0,
    progressed: 0,
    triggeredByShield: 0,
    triggeredByPressure: 0,
    triggeredByEconomy: 0,
    triggeredByMode: 0,
    triggeredByCards: 0,
    suppressed: 0,
  };
}

/**
 * Authoritative backend cascade runtime.
 *
 * The original file was intentionally thin. This rewrite keeps the same public
 * shape while upgrading runtime depth in five concrete ways:
 * 1. normalized multi-family event harvesting
 * 2. deterministic template routing with mode/pressure bias
 * 3. explicit per-link effect realization + delta buffering
 * 4. auditable recovery/completion/suppression traces
 * 5. self-consistent economy/shield/sovereignty side-effect reconciliation
 */
export class CascadeEngine implements SimulationEngine {
  public readonly engineId = 'cascade' as const;

  private readonly registry = new CascadeChainRegistry();
  private readonly queue = new CascadeQueueManager();
  private readonly positive = new PositiveCascadeTracker();
  private readonly recovery = new RecoveryConditionChecker();

  private health: EngineHealth = {
    engineId: this.engineId,
    status: 'HEALTHY',
    updatedAt: Date.now(),
    notes: [DEFAULT_INIT_NOTE],
  };

  private runtimeMemory: CascadeRuntimeMemory = {
    dedupeByTick: Object.freeze({}),
    unlockedPositiveIds: Object.freeze([]),
    lastSignals: Object.freeze([]),
    lastTickProcessed: null,
  };

  private lastDecisionTrace: CascadeDecisionTrace | null = null;

  public reset(): void {
    this.runtimeMemory = {
      dedupeByTick: Object.freeze({}),
      unlockedPositiveIds: Object.freeze([]),
      lastSignals: Object.freeze([]),
      lastTickProcessed: null,
    };

    this.lastDecisionTrace = null;

    this.health = {
      engineId: this.engineId,
      status: 'HEALTHY',
      updatedAt: Date.now(),
      notes: [DEFAULT_RESET_NOTE],
    };
  }

  public canRun(snapshot: RunStateSnapshot): boolean {
    if (snapshot.outcome !== null) {
      return false;
    }

    if (snapshot.phase === 'FOUNDATION' && snapshot.tick < 0) {
      return false;
    }

    return true;
  }

  public tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    if (!this.canRun(snapshot)) {
      this.markHealthy(context.nowMs, ['Cascade tick skipped.']);
      return snapshot;
    }

    try {
      const stats = createMutableStats();
      const notes: string[] = [];

      const normalizedEvents = this.collectNormalizedEvents(snapshot, context, stats, notes);
      const creationPlan = this.planChainCreation(snapshot, context, normalizedEvents, stats, notes);
      const workingChains = this.buildWorkingChainSet(snapshot, creationPlan.createdChains);

      const progressedLinks: ChainProgressedLink[] = [];
      const stateTransitionNotes: string[] = [];
      let aggregateDelta = createEmptyDelta();
      let completedChains = snapshot.cascade.completedChains;
      let brokenChains = snapshot.cascade.brokenChains;
      const nextActiveChains: CascadeChainInstance[] = [];

      for (const chain of workingChains) {
        const template = this.resolveTemplate(chain.templateId, stateTransitionNotes);

        const progress = this.progressChain(
          snapshot,
          context,
          chain,
          template,
          stats,
          stateTransitionNotes,
        );

        aggregateDelta = mergeDelta(aggregateDelta, progress.delta);
        progressedLinks.push(...progress.progressedLinks);

        if (progress.completed) {
          completedChains += 1;
        }

        if (progress.broken) {
          brokenChains += 1;
        }

        if (progress.nextChain) {
          nextActiveChains.push(progress.nextChain);
        }
      }

      const nextRepeatedTriggerCounts = this.buildNextRepeatedTriggerCounts(
        snapshot,
        normalizedEvents,
        creationPlan.createdChains,
      );

      const unlockedPositiveIds = this.nextUnlockedPositiveIds(snapshot, creationPlan.createdChains);
      const nextEconomy = this.applyEconomyDelta(snapshot.economy, aggregateDelta, snapshot, notes);
      const nextShield = this.applyShieldDelta(snapshot.shield, snapshot.tick, aggregateDelta.shieldDelta, notes);
      const nextModeState = this.applyModeMutations(snapshot.modeState, aggregateDelta, snapshot, notes);
      const nextSovereignty = this.applySovereigntyMutations(snapshot, aggregateDelta, notes);
      const lastResolvedTick = this.resolveLastResolvedTick(
        snapshot,
        normalizedEvents,
        creationPlan.createdChains,
        progressedLinks,
      );

      this.emitChainCreationSignals(context, creationPlan.createdChains, snapshot.tick);
      this.emitProgressSignals(context, progressedLinks, notes);
      this.emitCompletionSignals(
        context,
        workingChains,
        nextActiveChains,
        creationPlan.createdChains,
        snapshot.tick,
      );
      this.emitAggregateSideEffectSignals(context, aggregateDelta, snapshot);
      this.emitDiagnosticSignals(context, normalizedEvents, creationPlan.suppressedEventIds, stats, notes, snapshot);

      const nextSnapshot: RunStateSnapshot = {
        ...snapshot,
        economy: nextEconomy,
        shield: nextShield,
        modeState: nextModeState,
        sovereignty: nextSovereignty,
        cascade: {
          activeChains: nextActiveChains,
          positiveTrackers: unlockedPositiveIds,
          brokenChains,
          completedChains,
          repeatedTriggerCounts: nextRepeatedTriggerCounts,
          lastResolvedTick,
        },
        emittedEventCount:
          snapshot.emittedEventCount +
          creationPlan.createdChains.length +
          progressedLinks.length +
          aggregateDelta.injectedCards.length,
        warnings: this.buildWarnings(snapshot.warnings, notes),
      };

      this.runtimeMemory = this.buildNextRuntimeMemory(
        snapshot,
        normalizedEvents,
        unlockedPositiveIds,
        notes,
      );

      this.lastDecisionTrace = {
        tick: snapshot.tick,
        mode: snapshot.mode,
        phase: snapshot.phase,
        normalizedEvents,
        createdChains: creationPlan.createdChains,
        suppressedEventIds: creationPlan.suppressedEventIds,
        progressedLinks,
        stats: freezeStats(stats),
        notes: dedupeStrings([...notes, ...stateTransitionNotes]),
      };

      this.markHealthy(context.nowMs, this.buildHealthNotes(stats, notes));

      return nextSnapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown cascade engine failure.';

      this.health = {
        engineId: this.engineId,
        status: 'FAILED',
        updatedAt: context.nowMs,
        notes: [message],
      };

      throw error;
    }
  }

  public getHealth(): EngineHealth {
    return this.health;
  }

  public getLastDecisionTrace(): CascadeDecisionTrace | null {
    return this.lastDecisionTrace;
  }

  // ---------------------------------------------------------------------------
  // Event Harvesting
  // ---------------------------------------------------------------------------

  private collectNormalizedEvents(
    snapshot: RunStateSnapshot,
    context: TickContext,
    stats: MutableRuntimeStats,
    notes: string[],
  ): readonly NormalizedCascadeEvent[] {
    const normalized: NormalizedCascadeEvent[] = [];
    const seen = new Set<string>();

    for (const eventName of CASCADE_EVENT_NAMES) {
      const rawEvents = this.peekEvents(context, eventName);

      for (const rawEvent of rawEvents) {
        const event = this.normalizeInboundEvent(snapshot, eventName, rawEvent, notes);
        if (!event) {
          continue;
        }

        if (event.tick !== snapshot.tick) {
          continue;
        }

        const dedupeKey = this.buildEventDedupeKey(event);
        if (seen.has(dedupeKey)) {
          continue;
        }

        seen.add(dedupeKey);
        normalized.push(event);
        this.incrementOriginStat(stats, event.origin);
      }
    }

    // Native snapshot-derived fallback for shield breaches and pressure spikes.
    normalized.push(...this.buildSnapshotDerivedEvents(snapshot, seen, stats));

    return normalized.sort((left, right) => {
      if (left.tick !== right.tick) {
        return left.tick - right.tick;
      }

      return left.id.localeCompare(right.id);
    });
  }

  private peekEvents(
    context: TickContext,
    eventName: CascadeInboundEventName,
  ): readonly Readonly<Record<string, unknown>>[] {
    const peekable = context.bus as {
      peek?: (name: string) => readonly Readonly<Record<string, unknown>>[] | undefined;
    };

    const raw = peekable.peek?.(eventName);
    return Array.isArray(raw) ? raw : [];
  }

  private normalizeInboundEvent(
    snapshot: RunStateSnapshot,
    eventName: CascadeInboundEventName,
    raw: Readonly<Record<string, unknown>>,
    notes: string[],
  ): NormalizedCascadeEvent | null {
    switch (eventName) {
      case 'shield.breached':
      case 'shield.layer_breached':
        return this.normalizeShieldBreachEvent(snapshot, eventName, raw);

      case 'battle.attack.resolved':
      case 'battle.attack.applied':
        return this.normalizeBattleEvent(snapshot, eventName, raw);

      case 'pressure.critical':
      case 'pressure.tier_changed':
        return this.normalizePressureEvent(snapshot, eventName, raw);

      case 'economy.networth_collapsed':
      case 'economy.cash_negative':
      case 'economy.privileged_play_recorded':
        return this.normalizeEconomyEvent(snapshot, eventName, raw);

      case 'mode.shared_treasury_collapsed':
      case 'mode.trust_cracked':
        return this.normalizeModeEvent(snapshot, eventName, raw);

      case 'cards.fubar_injected':
      case 'cards.fate_triggered':
        return this.normalizeCardsEvent(snapshot, eventName, raw);

      default:
        notes.push(`Unsupported cascade inbound event skipped: ${eventName}`);
        return null;
    }
  }

  private normalizeShieldBreachEvent(
    snapshot: RunStateSnapshot,
    eventName: CascadeInboundEventName,
    raw: Readonly<Record<string, unknown>>,
  ): NormalizedCascadeEvent | null {
    const layerId = this.asLayerId(raw.layerId ?? raw.layer ?? raw.targetLayer);
    if (!layerId) {
      return null;
    }

    return {
      sourceEvent: eventName,
      origin: 'SHIELD',
      tick: safeNumber(raw.tick, snapshot.tick),
      id: safeString(raw.attackId, `shield:${layerId}:${snapshot.tick}`),
      triggerFamily: `shield:${layerId}`,
      severityHint: this.severityForLayer(layerId),
      layerId,
      attackId: safeString(raw.attackId, ''),
      templateHint: LAYER_TEMPLATE_FALLBACK[layerId],
      notes: dedupeStrings([
        safeString(raw.reason),
        `Authoritative shield breach on ${layerId}`,
      ]),
      payload: {
        ...raw,
        layerId,
      },
    };
  }

  private normalizeBattleEvent(
    snapshot: RunStateSnapshot,
    eventName: CascadeInboundEventName,
    raw: Readonly<Record<string, unknown>>,
  ): NormalizedCascadeEvent | null {
    const layerId = this.asLayerId(raw.layerId ?? raw.targetLayer);
    const magnitude = safeNumber(raw.magnitude);
    const severityHint = magnitude >= 30 ? 'HIGH' : magnitude >= 15 ? 'MEDIUM' : 'LOW';

    return {
      sourceEvent: eventName,
      origin: 'BATTLE',
      tick: safeNumber(raw.tick ?? raw.createdAtTick, snapshot.tick),
      id: safeString(raw.attackId, `battle:${snapshot.tick}:${magnitude}`),
      triggerFamily: layerId ? `shield:${layerId}` : `economy:battle-pressure`,
      severityHint,
      layerId: layerId ?? undefined,
      attackId: safeString(raw.attackId, ''),
      templateHint: layerId ? LAYER_TEMPLATE_FALLBACK[layerId] : undefined,
      notes: dedupeStrings([
        safeString(raw.summary),
        safeString(raw.category),
        'Battle pressure event normalized for cascade consideration',
      ]),
      payload: raw,
    };
  }

  private normalizePressureEvent(
    snapshot: RunStateSnapshot,
    eventName: CascadeInboundEventName,
    raw: Readonly<Record<string, unknown>>,
  ): NormalizedCascadeEvent | null {
    const tier = this.asPressureTier(raw.tier ?? raw.to ?? raw.level ?? snapshot.pressure.tier);
    if (!tier) {
      return null;
    }

    return {
      sourceEvent: eventName,
      origin: 'PRESSURE',
      tick: safeNumber(raw.tick, snapshot.tick),
      id: safeString(raw.eventId, `${eventName}:${tier}:${snapshot.tick}`),
      triggerFamily: `pressure:${tier}`,
      severityHint: this.severityForPressureTier(tier),
      templateHint: PRESSURE_TEMPLATE_HINTS[tier][0],
      notes: dedupeStrings([
        safeString(raw.reason),
        `Pressure event at ${tier}`,
      ]),
      payload: {
        ...raw,
        tier,
      },
    };
  }

  private normalizeEconomyEvent(
    snapshot: RunStateSnapshot,
    eventName: CascadeInboundEventName,
    raw: Readonly<Record<string, unknown>>,
  ): NormalizedCascadeEvent | null {
    const idSuffix = safeString(raw.kind, eventName.replace(/\./g, ':'));
    return {
      sourceEvent: eventName,
      origin: 'ECONOMY',
      tick: safeNumber(raw.tick, snapshot.tick),
      id: safeString(raw.eventId, `${eventName}:${snapshot.tick}:${idSuffix}`),
      triggerFamily: `economy:${idSuffix}`,
      severityHint:
        eventName === 'economy.privileged_play_recorded'
          ? 'LOW'
          : snapshot.economy.cash < 0 || snapshot.economy.netWorth < 0
            ? 'HIGH'
            : 'MEDIUM',
      notes: dedupeStrings([
        safeString(raw.reason),
        'Economy collapse signal normalized for cascade runtime',
      ]),
      payload: raw,
    };
  }

  private normalizeModeEvent(
    snapshot: RunStateSnapshot,
    eventName: CascadeInboundEventName,
    raw: Readonly<Record<string, unknown>>,
  ): NormalizedCascadeEvent | null {
    const family = eventName === 'mode.trust_cracked' ? 'trust-cracked' : 'shared-treasury-collapsed';
    return {
      sourceEvent: eventName,
      origin: 'MODE',
      tick: safeNumber(raw.tick, snapshot.tick),
      id: safeString(raw.eventId, `${eventName}:${snapshot.tick}`),
      triggerFamily: `mode:${family}`,
      severityHint: eventName === 'mode.trust_cracked' ? 'MEDIUM' : 'HIGH',
      notes: dedupeStrings([
        safeString(raw.reason),
        `Mode-native stress signal: ${family}`,
      ]),
      payload: raw,
    };
  }

  private normalizeCardsEvent(
    snapshot: RunStateSnapshot,
    eventName: CascadeInboundEventName,
    raw: Readonly<Record<string, unknown>>,
  ): NormalizedCascadeEvent | null {
    const family = eventName === 'cards.fate_triggered' ? 'fate' : 'fubar';
    return {
      sourceEvent: eventName,
      origin: 'CARDS',
      tick: safeNumber(raw.tick, snapshot.tick),
      id: safeString(raw.eventId, `${eventName}:${snapshot.tick}`),
      triggerFamily: `cards:${family}`,
      severityHint: eventName === 'cards.fubar_injected' ? 'MEDIUM' : 'LOW',
      notes: dedupeStrings([
        safeString(raw.summary),
        `Cards-driven cascade hint: ${family}`,
      ]),
      payload: raw,
    };
  }

  private buildSnapshotDerivedEvents(
    snapshot: RunStateSnapshot,
    seen: Set<string>,
    stats: MutableRuntimeStats,
  ): readonly NormalizedCascadeEvent[] {
    const derived: NormalizedCascadeEvent[] = [];

    if (snapshot.pressure.tier !== snapshot.pressure.previousTier) {
      const event: NormalizedCascadeEvent = {
        sourceEvent: 'pressure.tier_changed',
        origin: 'PRESSURE',
        tick: snapshot.tick,
        id: `snapshot:pressure:${snapshot.pressure.previousTier}->${snapshot.pressure.tier}:${snapshot.tick}`,
        triggerFamily: `pressure:${snapshot.pressure.tier}`,
        severityHint: this.severityForPressureTier(snapshot.pressure.tier),
        templateHint: PRESSURE_TEMPLATE_HINTS[snapshot.pressure.tier][0],
        notes: Object.freeze([
          'Derived from authoritative pressure state transition',
        ]),
        payload: {
          from: snapshot.pressure.previousTier,
          to: snapshot.pressure.tier,
        },
      };

      const dedupeKey = this.buildEventDedupeKey(event);
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        derived.push(event);
        this.incrementOriginStat(stats, event.origin);
      }
    }

    for (const layer of snapshot.shield.layers) {
      if (!layer.breached) {
        continue;
      }

      const event: NormalizedCascadeEvent = {
        sourceEvent: 'shield.layer_breached',
        origin: 'SHIELD',
        tick: snapshot.tick,
        id: `snapshot:shield:${layer.layerId}:${snapshot.tick}`,
        triggerFamily: `shield:${layer.layerId}`,
        severityHint: this.severityForLayer(layer.layerId),
        layerId: layer.layerId,
        templateHint: LAYER_TEMPLATE_FALLBACK[layer.layerId],
        notes: Object.freeze([
          'Derived from authoritative breached shield layer state',
        ]),
        payload: {
          layerId: layer.layerId,
          current: layer.current,
          max: layer.max,
        },
      };

      const dedupeKey = this.buildEventDedupeKey(event);
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        derived.push(event);
        this.incrementOriginStat(stats, event.origin);
      }
    }

    if (snapshot.modeState.sharedTreasury && snapshot.modeState.sharedTreasuryBalance <= 0) {
      const event: NormalizedCascadeEvent = {
        sourceEvent: 'mode.shared_treasury_collapsed',
        origin: 'MODE',
        tick: snapshot.tick,
        id: `snapshot:mode:shared-treasury:${snapshot.tick}`,
        triggerFamily: 'mode:shared-treasury-collapsed',
        severityHint: 'HIGH',
        notes: Object.freeze(['Derived from shared treasury collapse.']),
        payload: {
          sharedTreasuryBalance: snapshot.modeState.sharedTreasuryBalance,
        },
      };

      const dedupeKey = this.buildEventDedupeKey(event);
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        derived.push(event);
        this.incrementOriginStat(stats, event.origin);
      }
    }

    return derived;
  }

  private buildEventDedupeKey(event: NormalizedCascadeEvent): string {
    return [
      event.sourceEvent,
      event.id,
      event.triggerFamily,
      String(event.tick),
      event.layerId ?? '',
      event.templateHint ?? '',
    ].join('|');
  }

  private incrementOriginStat(stats: MutableRuntimeStats, origin: CascadeEventOrigin): void {
    switch (origin) {
      case 'SHIELD':
      case 'BATTLE':
        stats.triggeredByShield += 1;
        break;
      case 'PRESSURE':
        stats.triggeredByPressure += 1;
        break;
      case 'ECONOMY':
        stats.triggeredByEconomy += 1;
        break;
      case 'MODE':
        stats.triggeredByMode += 1;
        break;
      case 'CARDS':
        stats.triggeredByCards += 1;
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Chain Planning / Creation
  // ---------------------------------------------------------------------------

  private planChainCreation(
    snapshot: RunStateSnapshot,
    context: TickContext,
    events: readonly NormalizedCascadeEvent[],
    stats: MutableRuntimeStats,
    notes: string[],
  ): {
    readonly createdChains: readonly CascadeChainInstance[];
    readonly suppressedEventIds: readonly string[];
  } {
    const created: CascadeChainInstance[] = [];
    const suppressedEventIds: string[] = [];
    const pendingTriggerCounts: Record<string, number> = {};

    for (const event of events) {
      const templateIds = this.resolveTemplateCandidates(snapshot, event, notes);
      if (templateIds.length === 0) {
        suppressedEventIds.push(event.id);
        stats.suppressed += 1;
        continue;
      }

      let anyCreatedFromEvent = false;

      for (const templateId of templateIds) {
        const template = this.resolveTemplate(templateId, notes);
        const trigger = this.composeTriggerFamily(event, template);
        const pendingForTrigger = pendingTriggerCounts[trigger] ?? 0;

        if (!this.queue.canCreate(snapshot, template, trigger, created, pendingForTrigger)) {
          continue;
        }

        const seededChain = this.queue.create(snapshot, template, trigger, created);
        const adjustedChain = this.applyTemplatePacingAdjustments(
          snapshot,
          seededChain,
          template,
          event,
          notes,
        );

        created.push(adjustedChain);
        pendingTriggerCounts[trigger] = pendingForTrigger + 1;
        anyCreatedFromEvent = true;

        if (template.positive) {
          stats.createdPositive += 1;
        } else {
          stats.createdNegative += 1;
        }
      }

      if (!anyCreatedFromEvent) {
        suppressedEventIds.push(event.id);
        stats.suppressed += 1;
      }
    }

    // Positive cascades are also inferred from state, not just inbound events.
    for (const positiveChain of this.buildPositiveChains(snapshot, created, notes)) {
      created.push(positiveChain);
      stats.createdPositive += 1;
    }

    this.pruneDuplicateCreatedChains(created, suppressedEventIds, stats);
    this.emitCreationPreviewSignals(context, created, snapshot.tick);

    return {
      createdChains: created,
      suppressedEventIds: dedupeStrings(suppressedEventIds),
    };
  }

  private buildPositiveChains(
    snapshot: RunStateSnapshot,
    alreadyCreated: readonly CascadeChainInstance[],
    notes: string[],
  ): readonly CascadeChainInstance[] {
    const created: CascadeChainInstance[] = [];
    const inferred = this.positive.infer(snapshot);

    for (const templateId of inferred) {
      const template = this.resolveTemplate(templateId, notes);
      const trigger = `positive:${templateId}` as const;
      const pending = alreadyCreated.filter((chain) => chain.trigger === trigger).length + created.filter((chain) => chain.trigger === trigger).length;

      if (!this.queue.canCreate(snapshot, template, trigger, [...alreadyCreated, ...created], pending)) {
        continue;
      }

      const seededChain = this.queue.create(snapshot, template, trigger, [...alreadyCreated, ...created]);
      const adjustedChain = this.applyTemplatePacingAdjustments(
        snapshot,
        seededChain,
        template,
        {
          sourceEvent: 'pressure.tier_changed',
          origin: 'SYSTEM',
          tick: snapshot.tick,
          id: `positive:${templateId}:${snapshot.tick}`,
          triggerFamily: trigger,
          severityHint: template.severity,
          templateHint: templateId,
          notes: Object.freeze(['Positive cascade inferred from authoritative run state']),
          payload: Object.freeze({}),
        },
        notes,
      );

      created.push(adjustedChain);
    }

    return created;
  }

  private resolveTemplateCandidates(
    snapshot: RunStateSnapshot,
    event: NormalizedCascadeEvent,
    notes: string[],
  ): readonly CascadeTemplateId[] {
    if (event.templateHint) {
      return Object.freeze([event.templateHint]);
    }

    if (event.origin === 'PRESSURE') {
      const tier = this.asPressureTier(event.triggerFamily.replace('pressure:', ''));
      return tier ? PRESSURE_TEMPLATE_HINTS[tier] : [];
    }

    if (event.origin === 'ECONOMY') {
      if (event.triggerFamily.includes('privileged')) {
        return Object.freeze(['LIQUIDITY_SPIRAL']);
      }
      if (snapshot.economy.netWorth < 0) {
        return Object.freeze(['INCOME_SHOCK', 'CREDIT_FREEZE']);
      }
      return Object.freeze(['LIQUIDITY_SPIRAL']);
    }

    if (event.origin === 'MODE') {
      if (snapshot.mode === 'coop') {
        return event.triggerFamily.includes('trust')
          ? Object.freeze(['CREDIT_FREEZE'])
          : Object.freeze(['LIQUIDITY_SPIRAL', 'INCOME_SHOCK']);
      }
      return Object.freeze(['LIQUIDITY_SPIRAL']);
    }

    if (event.origin === 'CARDS') {
      return event.triggerFamily.includes('fubar')
        ? Object.freeze(['INCOME_SHOCK'])
        : Object.freeze(['LIQUIDITY_SPIRAL']);
    }

    notes.push(`No explicit template hint for event ${event.id}; no chains created.`);
    return [];
  }

  private applyTemplatePacingAdjustments(
    snapshot: RunStateSnapshot,
    chain: CascadeChainInstance,
    template: CascadeTemplate,
    event: NormalizedCascadeEvent,
    notes: string[],
  ): CascadeChainInstance {
    const modeOffsetBias = template.modeOffsetModifier?.[snapshot.mode] ?? 0;
    const severityBias = this.modeSeverityBias(snapshot.mode, template.severity);
    const pressureBias = this.templatePressureScalar(template, snapshot.pressure.tier);
    const eventSeverityBias = this.severityMultiplier(event.severityHint);
    const combinedScalar = round4(severityBias * pressureBias * eventSeverityBias);

    const adjustedLinks = chain.links.map((link, index) => {
      const originalEffect = template.effects[index] ?? link.effect;
      const effect = this.scaleEffectPayload(originalEffect, combinedScalar, notes);
      const adjustedTick = Math.max(
        snapshot.tick,
        link.scheduledTick + Math.trunc(modeOffsetBias),
      );

      return {
        ...link,
        scheduledTick: adjustedTick,
        effect,
        summary: `${link.summary} [${snapshot.mode}/${template.severity}/${event.severityHint}]`,
      };
    });

    return {
      ...chain,
      links: adjustedLinks,
      recoveryTags: dedupeStrings([
        ...chain.recoveryTags,
        ...template.recoveryTags,
        ...this.legacyRecoveryTagsForTemplate(template),
      ]) as string[],
    };
  }

  private pruneDuplicateCreatedChains(
    created: CascadeChainInstance[],
    suppressedEventIds: string[],
    stats: MutableRuntimeStats,
  ): void {
    const seen = new Set<string>();

    for (let index = created.length - 1; index >= 0; index -= 1) {
      const chain = created[index];
      const key = `${chain.templateId}|${chain.trigger}|${chain.createdAtTick}`;
      if (seen.has(key)) {
        created.splice(index, 1);
        suppressedEventIds.push(`deduped:${key}`);
        stats.suppressed += 1;
        continue;
      }
      seen.add(key);
    }
  }

  private composeTriggerFamily(
    event: NormalizedCascadeEvent,
    template: CascadeTemplate,
  ): CascadeTriggerFamily {
    if (template.positive) {
      return `positive:${template.templateId}`;
    }

    return event.triggerFamily;
  }

  private buildWorkingChainSet(
    snapshot: RunStateSnapshot,
    createdChains: readonly CascadeChainInstance[],
  ): readonly CascadeChainInstance[] {
    return [...snapshot.cascade.activeChains, ...createdChains].sort((left, right) => {
      if (left.createdAtTick !== right.createdAtTick) {
        return left.createdAtTick - right.createdAtTick;
      }

      return left.chainId.localeCompare(right.chainId);
    });
  }

  // ---------------------------------------------------------------------------
  // Chain Progression / Recovery / Completion
  // ---------------------------------------------------------------------------

  private progressChain(
    snapshot: RunStateSnapshot,
    context: TickContext,
    chain: CascadeChainInstance,
    template: CascadeTemplate,
    stats: MutableRuntimeStats,
    notes: string[],
  ): ChainProgressResult {
    if (chain.status !== 'ACTIVE') {
      return {
        nextChain: chain,
        delta: createEmptyDelta(),
        progressedLinks: [],
        completed: false,
        broken: false,
        stateTransitionNotes: [],
      };
    }

    if (
      !template.positive &&
      this.recovery.isRecovered(chain, snapshot, template)
    ) {
      context.bus.emit('cascade.chain.broken', {
        chainId: chain.chainId,
        templateId: chain.templateId,
        tick: snapshot.tick,
      });

      stats.broken += 1;

      return {
        nextChain: null,
        delta: mergeDelta(createEmptyDelta(), {
          notes: [`Chain ${chain.chainId} recovered and broken.`],
        }),
        progressedLinks: [],
        completed: false,
        broken: true,
        stateTransitionNotes: [`Recovery succeeded for ${chain.templateId}`],
      };
    }

    const dueLinks = chain.links.filter((link) => link.scheduledTick <= snapshot.tick);
    if (dueLinks.length === 0) {
      return {
        nextChain: chain,
        delta: createEmptyDelta(),
        progressedLinks: [],
        completed: false,
        broken: false,
        stateTransitionNotes: [],
      };
    }

    let delta = createEmptyDelta();
    const progressedLinks: ChainProgressedLink[] = [];

    for (const link of dueLinks) {
      const linkDelta = this.realizeLinkEffect(snapshot, chain, template, link, notes);
      delta = mergeDelta(delta, linkDelta);

      const progressed: ChainProgressedLink = {
        chainId: chain.chainId,
        templateId: chain.templateId,
        linkId: link.linkId,
        tick: snapshot.tick,
        summary: link.summary,
        effect: link.effect,
      };

      progressedLinks.push(progressed);
      stats.progressed += 1;

      context.bus.emit('cascade.chain.progressed', {
        chainId: chain.chainId,
        templateId: chain.templateId,
        linkId: link.linkId,
        tick: snapshot.tick,
        summary: link.summary,
      });
    }

    const remainingLinks = chain.links.filter((link) => link.scheduledTick > snapshot.tick);

    if (remainingLinks.length === 0) {
      context.bus.emit('cascade.chain.completed', {
        chainId: chain.chainId,
        templateId: chain.templateId,
        tick: snapshot.tick,
      });

      stats.completed += 1;

      return {
        nextChain: null,
        delta,
        progressedLinks,
        completed: true,
        broken: false,
        stateTransitionNotes: [`Chain ${chain.chainId} completed.`],
      };
    }

    return {
      nextChain: {
        ...chain,
        links: remainingLinks,
      },
      delta,
      progressedLinks,
      completed: false,
      broken: false,
      stateTransitionNotes: [],
    };
  }

  private realizeLinkEffect(
    snapshot: RunStateSnapshot,
    chain: CascadeChainInstance,
    template: CascadeTemplate,
    link: CascadeChainProgressedLinkCompat,
    notes: string[],
  ): ChainExecutionDelta {
    const effect = link.effect;
    let delta = createEmptyDelta();

    delta = mergeDelta(delta, {
      cashDelta: safeNumber(effect.cashDelta),
      incomeDelta: safeNumber(effect.incomeDelta),
      heatDelta: safeNumber(effect.heatDelta),
      shieldDelta: safeNumber(effect.shieldDelta),
      trustDelta: safeNumber(effect.trustDelta),
      timeDeltaMs: safeNumber(effect.timeDeltaMs),
      divergenceDelta: safeNumber(effect.divergenceDelta),
      injectedCards: safeArray(effect.injectCards),
    });

    // Derive secondary effects from template identity and mode posture.
    delta = mergeDelta(delta, this.deriveSecondaryEffects(snapshot, chain, template, effect));

    if (effect.cascadeTag) {
      delta = mergeDelta(delta, {
        auditFlags: [`cascade-tag:${effect.cascadeTag}`],
      });
    }

    if (template.positive) {
      delta = mergeDelta(delta, {
        proofBadges: this.positiveProofBadgesForTemplate(snapshot, template),
      });
    }

    notes.push(
      `Cascade link realized: ${chain.templateId}::${link.linkId} at tick ${snapshot.tick}`,
    );

    return delta;
  }

  private deriveSecondaryEffects(
    snapshot: RunStateSnapshot,
    chain: CascadeChainInstance,
    template: CascadeTemplate,
    effect: EffectPayload,
  ): Partial<ChainExecutionDelta> {
    const secondary = createEmptyDelta();

    if (!template.positive && template.templateId === 'LIQUIDITY_SPIRAL') {
      secondary.debtDelta += Math.max(0, Math.round(Math.abs(safeNumber(effect.cashDelta)) * 0.2));
      secondary.expensesDelta += Math.max(0, Math.round(Math.abs(safeNumber(effect.cashDelta)) * 0.05));
    }

    if (!template.positive && template.templateId === 'CREDIT_FREEZE') {
      secondary.expensesDelta += 1;
      secondary.auditFlags = [...secondary.auditFlags, 'credit-freeze-active'];
    }

    if (!template.positive && template.templateId === 'INCOME_SHOCK') {
      secondary.expensesDelta += snapshot.mode === 'solo' ? 1 : 0;
      secondary.auditFlags = [...secondary.auditFlags, 'income-shock-active'];
    }

    if (!template.positive && template.templateId === 'NETWORK_LOCKDOWN') {
      secondary.timeDeltaMs += 5_000;
      secondary.auditFlags = [...secondary.auditFlags, 'network-lockdown-active'];
    }

    if (template.positive && template.templateId === 'COMEBACK_SURGE') {
      secondary.cashDelta += Math.max(0, Math.round(snapshot.economy.expensesPerTick * 0.5));
      secondary.heatDelta -= snapshot.mode === 'coop' ? 2 : 1;
    }

    if (template.positive && template.templateId === 'MOMENTUM_ENGINE') {
      secondary.incomeDelta += snapshot.mode === 'ghost' ? 0 : 1;
      secondary.divergenceDelta += snapshot.mode === 'ghost' ? 0.01 : 0;
    }

    return secondary;
  }

  // ---------------------------------------------------------------------------
  // Snapshot Reconciliation
  // ---------------------------------------------------------------------------

  private applyEconomyDelta(
    economy: EconomyState,
    delta: ChainExecutionDelta,
    snapshot: RunStateSnapshot,
    notes: string[],
  ): EconomyState {
    const cash = round2(economy.cash + delta.cashDelta);
    const debt = Math.max(0, round2(economy.debt + delta.debtDelta));
    const incomePerTick = round2(economy.incomePerTick + delta.incomeDelta);
    const expensesPerTick = Math.max(0, round2(economy.expensesPerTick + delta.expensesDelta));
    const haterHeat = clamp(round2(economy.haterHeat + delta.heatDelta), 0, 100);
    const netWorth = round2(
      economy.netWorth +
      delta.cashDelta -
      delta.debtDelta +
      (incomePerTick - economy.incomePerTick) * 5,
    );

    if (cash < 0) {
      notes.push('Cascade economy delta pushed cash below zero.');
    }
    if (netWorth < economy.netWorth) {
      notes.push('Cascade economy delta reduced net worth.');
    }
    if (snapshot.mode === 'solo' && delta.heatDelta > 0) {
      notes.push('Solo mode cascade increased heat exposure.');
    }

    return {
      ...economy,
      cash,
      debt,
      incomePerTick,
      expensesPerTick,
      netWorth,
      haterHeat,
    };
  }

  private applyShieldDelta(
    shield: ShieldState,
    tick: number,
    totalDelta: number,
    notes: string[],
  ): ShieldState {
    if (totalDelta === 0) {
      return shield;
    }

    const originalLayers = shield.layers.map((layer) => ({ ...layer }));
    const nextLayers = shield.layers.map((layer) => ({ ...layer }));

    if (totalDelta < 0) {
      let remainingDamage = Math.abs(totalDelta);
      const order = [...nextLayers].sort(
        (a, b) => a.integrityRatio - b.integrityRatio || a.current - b.current,
      );

      for (const layer of order) {
        if (remainingDamage <= 0) {
          break;
        }

        const applied = Math.min(remainingDamage, layer.current);
        if (applied <= 0) {
          continue;
        }

        layer.current -= applied;
        remainingDamage -= applied;
        notes.push(`Cascade shield damage applied to ${layer.layerId}: ${applied}`);
      }
    } else {
      let remainingRecovery = totalDelta;
      const order = [...nextLayers].sort(
        (a, b) => a.integrityRatio - b.integrityRatio || a.current - b.current,
      );

      for (const layer of order) {
        if (remainingRecovery <= 0) {
          break;
        }

        const capacity = layer.max - layer.current;
        const applied = Math.min(remainingRecovery, capacity);
        if (applied <= 0) {
          continue;
        }

        layer.current += applied;
        remainingRecovery -= applied;
        notes.push(`Cascade shield recovery applied to ${layer.layerId}: ${applied}`);
      }
    }

    const normalizedLayers = nextLayers.map((layer) => {
      const previous = originalLayers.find((candidate) => candidate.layerId === layer.layerId)!;
      const current = clamp(layer.current, 0, layer.max);
      const breached = current <= 0;
      const integrityRatio = layer.max <= 0 ? 0 : round4(current / layer.max);

      return {
        ...layer,
        current,
        breached,
        integrityRatio,
        lastDamagedTick: current < previous.current ? tick : previous.lastDamagedTick,
        lastRecoveredTick: current > previous.current ? tick : previous.lastRecoveredTick,
      };
    });

    const weakest = normalizedLayers.reduce<{ layerId: ShieldLayerId; integrityRatio: number }>(
      (best, layer) => {
        if (layer.integrityRatio < best.integrityRatio) {
          return {
            layerId: layer.layerId,
            integrityRatio: layer.integrityRatio,
          };
        }
        return best;
      },
      {
        layerId: normalizedLayers[0].layerId,
        integrityRatio: normalizedLayers[0].integrityRatio,
      },
    );

    const newlyBreachedCount = normalizedLayers.filter((layer) => {
      const previous = originalLayers.find((candidate) => candidate.layerId === layer.layerId)!;
      return !previous.breached && layer.breached;
    }).length;

    const damagedLayerCount = normalizedLayers.filter((layer) => {
      const previous = originalLayers.find((candidate) => candidate.layerId === layer.layerId)!;
      return layer.current < previous.current;
    }).length;

    return {
      ...shield,
      layers: normalizedLayers,
      weakestLayerId: weakest.layerId,
      weakestLayerRatio: weakest.integrityRatio,
      damagedThisRun: shield.damagedThisRun + damagedLayerCount,
      breachesThisRun: shield.breachesThisRun + newlyBreachedCount,
      repairQueueDepth: normalizedLayers.filter((layer) => layer.current < layer.max).length,
    };
  }

  private applyModeMutations(
    modeState: RunStateSnapshot['modeState'],
    delta: ChainExecutionDelta,
    snapshot: RunStateSnapshot,
    notes: string[],
  ): RunStateSnapshot['modeState'] {
    const nextTrustScores = { ...modeState.trustScores };
    if (delta.trustDelta !== 0) {
      for (const actorId of Object.keys(nextTrustScores)) {
        nextTrustScores[actorId] = clamp(
          round2((nextTrustScores[actorId] ?? 0) + delta.trustDelta),
          0,
          100,
        );
      }

      notes.push(`Cascade trust delta applied across trust scores: ${delta.trustDelta}`);
    }

    const nextSharedTreasuryBalance = modeState.sharedTreasury
      ? round2(modeState.sharedTreasuryBalance + delta.cashDelta)
      : modeState.sharedTreasuryBalance;

    return {
      ...modeState,
      trustScores: nextTrustScores,
      sharedTreasuryBalance: nextSharedTreasuryBalance,
      bleedMode:
        modeState.bleedMode ||
        (!snapshot.modeState.bleedMode && snapshot.mode === 'coop' && nextSharedTreasuryBalance < 0),
    };
  }

  private applySovereigntyMutations(
    snapshot: RunStateSnapshot,
    delta: ChainExecutionDelta,
    notes: string[],
  ): RunStateSnapshot['sovereignty'] {
    const proofBadges = dedupeStrings([
      ...snapshot.sovereignty.proofBadges,
      ...delta.proofBadges,
    ]);

    const auditFlags = dedupeStrings([
      ...snapshot.sovereignty.auditFlags,
      ...delta.auditFlags,
    ]);

    const gapVsLegend = round4(snapshot.sovereignty.gapVsLegend - delta.divergenceDelta);
    const gapClosingRate = round4(
      snapshot.sovereignty.gapClosingRate + (delta.divergenceDelta !== 0 ? delta.divergenceDelta : 0),
    );
    const cordScore = round4(snapshot.sovereignty.cordScore + delta.divergenceDelta);

    if (delta.divergenceDelta !== 0) {
      notes.push(`Cascade divergence delta applied: ${delta.divergenceDelta}`);
    }

    return {
      ...snapshot.sovereignty,
      proofBadges,
      auditFlags,
      gapVsLegend,
      gapClosingRate,
      cordScore,
      lastVerifiedTick: delta.divergenceDelta !== 0 ? snapshot.tick : snapshot.sovereignty.lastVerifiedTick,
    };
  }

  private resolveLastResolvedTick(
    snapshot: RunStateSnapshot,
    normalizedEvents: readonly NormalizedCascadeEvent[],
    createdChains: readonly CascadeChainInstance[],
    progressedLinks: readonly ChainProgressedLink[],
  ): number | null {
    const hadResolution =
      normalizedEvents.length > 0 ||
      createdChains.length > 0 ||
      progressedLinks.length > 0;

    return hadResolution ? snapshot.tick : snapshot.cascade.lastResolvedTick;
  }

  private buildNextRepeatedTriggerCounts(
    snapshot: RunStateSnapshot,
    events: readonly NormalizedCascadeEvent[],
    createdChains: readonly CascadeChainInstance[],
  ): Readonly<Record<string, number>> {
    const next = {
      ...snapshot.cascade.repeatedTriggerCounts,
    };

    for (const event of events) {
      next[event.triggerFamily] = (next[event.triggerFamily] ?? 0) + 1;
    }

    for (const chain of createdChains) {
      next[chain.trigger] = (next[chain.trigger] ?? 0) + 1;
    }

    return next;
  }

  private nextUnlockedPositiveIds(
    snapshot: RunStateSnapshot,
    createdChains: readonly CascadeChainInstance[],
  ): readonly string[] {
    return dedupeStrings([
      ...snapshot.cascade.positiveTrackers,
      ...this.runtimeMemory.unlockedPositiveIds,
      ...createdChains.filter((chain) => chain.positive).map((chain) => chain.templateId),
    ]);
  }

  private buildWarnings(
    existingWarnings: readonly string[],
    notes: readonly string[],
  ): readonly string[] {
    return dedupeStrings([
      ...existingWarnings,
      ...notes.filter((note) => note.toLowerCase().includes('warning')),
    ]);
  }

  private buildNextRuntimeMemory(
    snapshot: RunStateSnapshot,
    normalizedEvents: readonly NormalizedCascadeEvent[],
    unlockedPositiveIds: readonly string[],
    notes: readonly string[],
  ): CascadeRuntimeMemory {
    const nextDedupeByTick: Record<number, readonly string[]> = {
      ...this.runtimeMemory.dedupeByTick,
      [snapshot.tick]: normalizedEvents.map((event) => this.buildEventDedupeKey(event)),
    };

    for (const tickKey of Object.keys(nextDedupeByTick)) {
      const numericTick = Number(tickKey);
      if (!Number.isFinite(numericTick)) {
        continue;
      }
      if (numericTick < snapshot.tick - MAX_RUNTIME_MEMORY_TICKS) {
        delete nextDedupeByTick[numericTick];
      }
    }

    return {
      dedupeByTick: nextDedupeByTick,
      unlockedPositiveIds,
      lastSignals: dedupeStrings(notes),
      lastTickProcessed: snapshot.tick,
    };
  }

  // ---------------------------------------------------------------------------
  // Signal Emission
  // ---------------------------------------------------------------------------

  private emitCreationPreviewSignals(
    context: TickContext,
    created: readonly CascadeChainInstance[],
    tick: number,
  ): void {
    for (const chain of created) {
      context.bus.emit('cascade.chain.created', {
        chainId: chain.chainId,
        templateId: chain.templateId,
        positive: chain.positive,
        tick,
      });
    }
  }

  private emitChainCreationSignals(
    context: TickContext,
    created: readonly CascadeChainInstance[],
    tick: number,
  ): void {
    for (const chain of created) {
      context.bus.emit('cascade.chain.authorized', {
        chainId: chain.chainId,
        templateId: chain.templateId,
        trigger: chain.trigger,
        positive: chain.positive,
        tick,
      });
    }
  }

  private emitProgressSignals(
    context: TickContext,
    progressedLinks: readonly ChainProgressedLink[],
    notes: readonly string[],
  ): void {
    for (const link of progressedLinks) {
      this.emitNonNativeEffects(context, link.chainId, link.tick, link.effect);
    }

    if (progressedLinks.length > 0) {
      context.bus.emit('cascade.runtime.progress_summary', {
        tick: progressedLinks[0].tick,
        progressed: progressedLinks.length,
        notes: [...notes],
      });
    }
  }

  private emitCompletionSignals(
    context: TickContext,
    workingChains: readonly CascadeChainInstance[],
    nextActiveChains: readonly CascadeChainInstance[],
    createdChains: readonly CascadeChainInstance[],
    tick: number,
  ): void {
    const nextIds = new Set(nextActiveChains.map((chain) => chain.chainId));
    const workingIds = new Set(workingChains.map((chain) => chain.chainId));

    for (const chain of workingChains) {
      if (!nextIds.has(chain.chainId)) {
        context.bus.emit('cascade.chain.resolved', {
          chainId: chain.chainId,
          templateId: chain.templateId,
          tick,
        });
      }
    }

    for (const chain of createdChains) {
      if (!workingIds.has(chain.chainId) && !nextIds.has(chain.chainId)) {
        context.bus.emit('cascade.chain.resolved_same_tick', {
          chainId: chain.chainId,
          templateId: chain.templateId,
          tick,
        });
      }
    }
  }

  private emitAggregateSideEffectSignals(
    context: TickContext,
    delta: ChainExecutionDelta,
    snapshot: RunStateSnapshot,
  ): void {
    if (delta.trustDelta !== 0) {
      context.bus.emit('cascade.effect.trust_delta', {
        tick: snapshot.tick,
        trustDelta: delta.trustDelta,
      });
    }

    if (delta.timeDeltaMs !== 0) {
      context.bus.emit('cascade.effect.time_delta', {
        tick: snapshot.tick,
        timeDeltaMs: delta.timeDeltaMs,
      });
    }

    if (delta.divergenceDelta !== 0) {
      context.bus.emit('cascade.effect.divergence_delta', {
        tick: snapshot.tick,
        divergenceDelta: delta.divergenceDelta,
      });
    }

    if (delta.injectedCards.length > 0) {
      context.bus.emit('cascade.effect.inject_cards', {
        tick: snapshot.tick,
        injectCards: [...delta.injectedCards],
      });
    }
  }

  private emitDiagnosticSignals(
    context: TickContext,
    normalizedEvents: readonly NormalizedCascadeEvent[],
    suppressedEventIds: readonly string[],
    stats: MutableRuntimeStats,
    notes: readonly string[],
    snapshot: RunStateSnapshot,
  ): void {
    context.bus.emit('cascade.runtime.diagnostics', {
      tick: snapshot.tick,
      mode: snapshot.mode,
      phase: snapshot.phase,
      inboundEvents: normalizedEvents.length,
      suppressedEvents: suppressedEventIds.length,
      stats: freezeStats(stats),
      notes: [...notes],
    });
  }

  private emitNonNativeEffects(
    context: TickContext,
    chainId: string,
    tick: number,
    effect: EffectPayload,
  ): void {
    if (effect.trustDelta !== undefined && effect.trustDelta !== 0) {
      context.bus.emit('cascade.effect.trust_delta', {
        chainId,
        tick,
        trustDelta: effect.trustDelta,
      });
    }

    if (effect.timeDeltaMs !== undefined && effect.timeDeltaMs !== 0) {
      context.bus.emit('cascade.effect.time_delta', {
        chainId,
        tick,
        timeDeltaMs: effect.timeDeltaMs,
      });
    }

    if (effect.divergenceDelta !== undefined && effect.divergenceDelta !== 0) {
      context.bus.emit('cascade.effect.divergence_delta', {
        chainId,
        tick,
        divergenceDelta: effect.divergenceDelta,
      });
    }

    if (effect.injectCards && effect.injectCards.length > 0) {
      context.bus.emit('cascade.effect.inject_cards', {
        chainId,
        tick,
        injectCards: [...effect.injectCards],
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Template / Typing Utilities
  // ---------------------------------------------------------------------------

  private resolveTemplate(templateId: string, notes: string[]): CascadeTemplate {
    try {
      return this.registry.get(templateId as CascadeTemplateId);
    } catch {
      notes.push(`Missing cascade template requested: ${templateId}. Falling back to LIQUIDITY_SPIRAL.`);
      return this.registry.get('LIQUIDITY_SPIRAL');
    }
  }

  private templatePressureScalar(template: CascadeTemplate, tier: PressureTier): number {
    return template.pressureScalar?.[tier] ?? 1;
  }

  private modeSeverityBias(mode: ModeCode, severity: CascadeSeverity): number {
    return MODE_SEVERITY_BIAS[mode][severity] ?? 1;
  }

  private severityMultiplier(severity: CascadeSeverity): number {
    switch (severity) {
      case 'LOW':
        return 0.9;
      case 'MEDIUM':
        return 1;
      case 'HIGH':
        return 1.15;
      case 'CRITICAL':
        return 1.3;
      default:
        return 1;
    }
  }

  private scaleEffectPayload(
    effect: EffectPayload,
    scalar: number,
    notes: string[],
  ): EffectPayload {
    if (scalar === 1) {
      return effect;
    }

    notes.push(`Cascade effect payload scaled by ${scalar}.`);

    return {
      ...effect,
      cashDelta: this.scaleMaybeNumber(effect.cashDelta, scalar),
      incomeDelta: this.scaleMaybeNumber(effect.incomeDelta, scalar),
      heatDelta: this.scaleMaybeNumber(effect.heatDelta, scalar),
      shieldDelta: this.scaleMaybeNumber(effect.shieldDelta, scalar),
      trustDelta: this.scaleMaybeNumber(effect.trustDelta, scalar),
      timeDeltaMs: this.scaleMaybeNumber(effect.timeDeltaMs, scalar),
      divergenceDelta: this.scaleMaybeNumber(effect.divergenceDelta, scalar, true),
    };
  }

  private scaleMaybeNumber(
    value: number | undefined,
    scalar: number,
    preserveFraction = false,
  ): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    const next = value * scalar;
    return preserveFraction ? round4(next) : Math.round(next);
  }

  private legacyRecoveryTagsForTemplate(template: CascadeTemplate): readonly string[] {
    if (template.recoveryTags.length > 0) {
      return template.recoveryTags;
    }

    switch (template.templateId) {
      case 'LIQUIDITY_SPIRAL':
        return ['liquidity', 'cash_recovery'];
      case 'CREDIT_FREEZE':
        return ['counter', 'credit_repair'];
      case 'INCOME_SHOCK':
        return ['income', 'resilience'];
      case 'NETWORK_LOCKDOWN':
        return ['privileged', 'network'];
      case 'COMEBACK_SURGE':
        return ['recovery', 'momentum'];
      case 'MOMENTUM_ENGINE':
        return ['momentum', 'discipline'];
      default:
        return [];
    }
  }

  private severityForLayer(layerId: ShieldLayerId): CascadeSeverity {
    switch (layerId) {
      case 'L1':
        return 'LOW';
      case 'L2':
        return 'MEDIUM';
      case 'L3':
        return 'HIGH';
      case 'L4':
        return 'CRITICAL';
      default:
        return 'MEDIUM';
    }
  }

  private severityForPressureTier(tier: PressureTier): CascadeSeverity {
    switch (tier) {
      case 'T0':
        return 'LOW';
      case 'T1':
        return 'LOW';
      case 'T2':
        return 'MEDIUM';
      case 'T3':
        return 'HIGH';
      case 'T4':
        return 'CRITICAL';
      default:
        return 'MEDIUM';
    }
  }

  private asLayerId(value: unknown): ShieldLayerId | null {
    if (value === 'L1' || value === 'L2' || value === 'L3' || value === 'L4') {
      return value;
    }
    return null;
  }

  private asPressureTier(value: unknown): PressureTier | null {
    if (value === 'T0' || value === 'T1' || value === 'T2' || value === 'T3' || value === 'T4') {
      return value;
    }
    return null;
  }

  private positiveProofBadgesForTemplate(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): readonly string[] {
    switch (template.templateId) {
      case 'COMEBACK_SURGE':
        return snapshot.pressure.tier === 'T4' || snapshot.pressure.tier === 'T3'
          ? ['CASCADE_COMEBACK']
          : [];
      case 'MOMENTUM_ENGINE':
        return snapshot.mode === 'ghost'
          ? ['DISCIPLINED_GAP_CLOSE']
          : ['MOMENTUM_CHAIN'];
      default:
        return [];
    }
  }

  private buildHealthNotes(
    stats: MutableRuntimeStats,
    notes: readonly string[],
  ): readonly string[] {
    const summaries = [
      DEFAULT_HEALTHY_NOTE,
      `createdNegative=${stats.createdNegative}`,
      `createdPositive=${stats.createdPositive}`,
      `completed=${stats.completed}`,
      `broken=${stats.broken}`,
      `progressed=${stats.progressed}`,
    ];

    return dedupeStrings([...summaries, ...notes]).slice(0, 16);
  }

  private markHealthy(updatedAt: number, notes: readonly string[]): void {
    this.health = {
      engineId: this.engineId,
      status: 'HEALTHY',
      updatedAt,
      notes,
    };
  }
}

type CascadeChainProgressedLinkCompat = {
  readonly linkId: string;
  readonly scheduledTick: number;
  readonly effect: EffectPayload;
  readonly summary: string;
};
