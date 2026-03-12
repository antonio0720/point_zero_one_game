/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ENGINE 0 ZERO BINDINGS
 * pzo-web/src/engines/zero/ZeroBindings.ts
 *
 * Purpose
 * - Establish the single authoritative frontend binding surface for Engine 0.
 * - Wire the shared EventBus into the unified engine store exactly once per
 *   event-bus lifecycle.
 * - Preserve existing orchestrator, event flow, store bindings, and mode
 *   projections without inventing a parallel primitive layer.
 * - Expose runtime diagnostics and mode metadata for UI, tooling, and tests.
 *
 * Doctrine
 * - Do NOT duplicate EventBus / EngineRegistry / RunStateSnapshot primitives.
 * - Do NOT bypass EngineOrchestrator with direct engine method calls.
 * - Do NOT flatten mode logic into Engine 0; surface mode metadata/config only.
 * - Do NOT re-wire store handlers on every call; wire once per bus lifecycle.
 * - After a full event-bus reset(), mark bindings dirty and rebind intentionally.
 *
 * Density6 LLC · Point Zero One · Engine 0 · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  EventBus,
  sharedEventBus,
  type EventChannelConfig,
} from '../core/EventBus';
import { EngineOrchestrator } from './EngineOrchestrator';
import type {
  EngineEventName,
  EngineHealth,
  EngineId,
  RunLifecycleState,
} from './types';
import { wireAllEngineHandlers, wireRunStoreMirror } from '../../store/engineStore';
import { runStore } from '../../store/runStore';
import * as EngineStoreModule from '../../store/engineStore';
import {
  frontendModeDirector,
  type FrontendModeCode,
  type FrontendRunMode,
} from '../../game/modes';

type UnknownRecord = Record<string, unknown>;

type EngineStoreApiLike = {
  getState?: () => unknown;
  setState?: (...args: any[]) => unknown;
  subscribe?: (...args: any[]) => unknown;
};

const MODE_CODE_BY_RUN_MODE: Record<FrontendRunMode, FrontendModeCode> = {
  solo: 'empire',
  'asymmetric-pvp': 'predator',
  'co-op': 'syndicate',
  ghost: 'phantom',
};

export interface ZeroModeBindingState {
  runMode: FrontendRunMode;
  modeCode: FrontendModeCode;
  metadata: ReturnType<typeof frontendModeDirector.getModeMetadata>;
  engineConfig: UnknownRecord;
}

export interface ZeroBindingOptions {
  orchestrator?: EngineOrchestrator;
  eventBus?: EventBus;
  engineStoreSetState?: (...args: any[]) => unknown;
  wireStoreHandlers?: boolean;
  wireRunMirror?: boolean;
  registerDefaultChannels?: boolean;
  mode?: FrontendRunMode;
  modeSeed?: string | number;
  modeOverrides?: UnknownRecord;
}

export interface ZeroRuntimeBindings {
  readonly orchestrator: EngineOrchestrator;
  readonly eventBus: EventBus;
  readonly storeHandlersWired: boolean;
  readonly runMirrorWired: boolean;
  readonly mode: ZeroModeBindingState | null;
  readonly getEngineStoreApi: () => EngineStoreApiLike | null;
  readonly cleanup: () => void;
}

export interface ZeroRuntimeStatusSnapshot {
  readonly lifecycleState: RunLifecycleState | 'UNKNOWN';
  readonly healthReport: Partial<Record<EngineId, EngineHealth>> | null;
  readonly pendingEventCount: number;
  readonly isFlushing: boolean;
  readonly runStoreSnapshot: ReturnType<typeof runStore.getState>;
  readonly engineStoreSnapshot: unknown;
  readonly mode: ZeroModeBindingState | null;
}

interface InternalZeroBindingState {
  orchestrator: EngineOrchestrator | null;
  eventBus: EventBus;
  storeHandlersWired: boolean;
  runMirrorUnsubscribe: (() => void) | null;
  mode: ZeroModeBindingState | null;
}

const internalState: InternalZeroBindingState = {
  orchestrator: null,
  eventBus: sharedEventBus,
  storeHandlersWired: false,
  runMirrorUnsubscribe: null,
  mode: null,
};

function buildDefaultEventChannels(): EventChannelConfig[] {
  const names: EngineEventName[] = [
    'RUN_STARTED',
    'RUN_ENDED',
    'ENGINE_ERROR',
    'TICK_STEP_ERROR',

    'TICK_START',
    'TICK_COMPLETE',
    'TICK_TIER_CHANGED',
    'TICK_TIER_FORCED',
    'DECISION_WINDOW_OPENED',
    'DECISION_WINDOW_EXPIRED',
    'DECISION_WINDOW_RESOLVED',
    'SEASON_TIMEOUT_IMMINENT',

    'PRESSURE_TIER_CHANGED',
    'PRESSURE_CRITICAL',
    'PRESSURE_SCORE_UPDATED',

    'TENSION_SCORE_UPDATED',
    'ANTICIPATION_PULSE',
    'THREAT_VISIBILITY_CHANGED',
    'THREAT_QUEUED',
    'THREAT_ARRIVED',
    'THREAT_MITIGATED',
    'THREAT_EXPIRED',

    'SHIELD_LAYER_DAMAGED',
    'SHIELD_LAYER_BREACHED',
    'SHIELD_REPAIRED',
    'SHIELD_PASSIVE_REGEN',
    'SHIELD_FORTIFIED',
    'SHIELD_SNAPSHOT_UPDATED',

    'BOT_STATE_CHANGED',
    'BOT_ATTACK_FIRED',
    'BOT_NEUTRALIZED',
    'COUNTER_INTEL_AVAILABLE',
    'BATTLE_BUDGET_UPDATED',
    'SYNDICATE_DUEL_RESULT',
    'BUDGET_ACTION_EXECUTED',
    'BATTLE_SNAPSHOT_UPDATED',

    'CASCADE_CHAIN_TRIGGERED',
    'CASCADE_LINK_FIRED',
    'CASCADE_CHAIN_BROKEN',
    'CASCADE_CHAIN_COMPLETED',
    'POSITIVE_CASCADE_ACTIVATED',
    'CASCADE_POSITIVE_ACTIVATED',
    'CASCADE_POSITIVE_DISSOLVED',
    'CASCADE_POSITIVE_PAUSED',
    'CASCADE_POSITIVE_RESUMED',
    'NEMESIS_BROKEN',
    'HATER_HEAT_WRITE_QUEUED',
    'CASCADE_TRIGGER_CAPPED',
    'CASCADE_SNAPSHOT_UPDATED',

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

    'RUN_COMPLETED',
    'PROOF_VERIFICATION_FAILED',
    'RUN_REWARD_DISPATCHED',
    'PROOF_ARTIFACT_READY',

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
  ];

  return names.map((name) => ({
    name,
    description: `Engine 0 registered channel: ${name}`,
  }));
}

function registerDefaultChannels(eventBus: EventBus): void {
  const maybeRegister = (
    eventBus as EventBus & {
      registerEventChannels?: (channels: EventChannelConfig[]) => void;
    }
  ).registerEventChannels;

  if (typeof maybeRegister === 'function') {
    maybeRegister.call(eventBus, buildDefaultEventChannels());
  }
}

function resolveEngineStoreApi(
  explicitSetState?: (...args: any[]) => unknown,
): EngineStoreApiLike | null {
  const mod = EngineStoreModule as unknown as Record<string, unknown>;

  const candidates: unknown[] = [
    mod.useEngineStore,
    mod.engineStore,
    mod.default,
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      typeof (candidate as EngineStoreApiLike).setState === 'function'
    ) {
      return candidate as EngineStoreApiLike;
    }
  }

  if (typeof explicitSetState === 'function') {
    return {
      setState: explicitSetState,
    };
  }

  return null;
}

function resolveModeBinding(
  mode: FrontendRunMode,
  seed?: string | number,
  overrides: UnknownRecord = {},
): ZeroModeBindingState {
  const metadata = frontendModeDirector.getModeMetadata(mode);
  const resolvedSeed = seed ?? `zero:${mode}`;
  const engineConfig = frontendModeDirector.createEngineConfig(
    mode,
    resolvedSeed,
    overrides,
  ) as UnknownRecord;

  return {
    runMode: mode,
    modeCode: MODE_CODE_BY_RUN_MODE[mode],
    metadata,
    engineConfig,
  };
}

function safeGetLifecycleState(
  orchestrator: EngineOrchestrator | null,
): RunLifecycleState | 'UNKNOWN' {
  if (!orchestrator) {
    return 'UNKNOWN';
  }

  const maybeGetLifecycleState = (orchestrator as any).getLifecycleState;
  if (typeof maybeGetLifecycleState === 'function') {
    return maybeGetLifecycleState.call(orchestrator) as RunLifecycleState;
  }

  return 'UNKNOWN';
}

function safeGetHealthReport(
  orchestrator: EngineOrchestrator | null,
): Partial<Record<EngineId, EngineHealth>> | null {
  if (!orchestrator) {
    return null;
  }

  const maybeGetHealthReport = (orchestrator as any).getHealthReport;
  if (typeof maybeGetHealthReport === 'function') {
    return maybeGetHealthReport.call(orchestrator) as Partial<
      Record<EngineId, EngineHealth>
    >;
  }

  return null;
}

function safeGetPendingCount(eventBus: EventBus): number {
  const maybe = (eventBus as any).getPendingCount;
  return typeof maybe === 'function' ? Number(maybe.call(eventBus) ?? 0) : 0;
}

function safeGetFlushingState(eventBus: EventBus): boolean {
  return Boolean((eventBus as any).isCurrentlyFlushing);
}

export function getZeroEventBus(): EventBus {
  return internalState.eventBus;
}

export function getZeroOrchestrator(): EngineOrchestrator {
  if (!internalState.orchestrator) {
    internalState.orchestrator = new EngineOrchestrator();
  }

  return internalState.orchestrator;
}

export function markZeroEventBusWiringDirty(): void {
  internalState.storeHandlersWired = false;
}

export function clearZeroModeBinding(): void {
  internalState.mode = null;
}

export function unbindZeroRuntime(): void {
  if (internalState.runMirrorUnsubscribe) {
    internalState.runMirrorUnsubscribe();
    internalState.runMirrorUnsubscribe = null;
  }

  internalState.mode = null;
}

export function bindZeroRuntime(
  options: ZeroBindingOptions = {},
): ZeroRuntimeBindings {
  const orchestrator =
    options.orchestrator ?? internalState.orchestrator ?? new EngineOrchestrator();
  const eventBus = options.eventBus ?? internalState.eventBus;

  internalState.orchestrator = orchestrator;
  internalState.eventBus = eventBus;

  if (options.registerDefaultChannels !== false) {
    registerDefaultChannels(eventBus);
  }

  if (options.mode) {
    internalState.mode = resolveModeBinding(
      options.mode,
      options.modeSeed,
      options.modeOverrides,
    );
  }

  const shouldWireStoreHandlers = options.wireStoreHandlers !== false;
  if (shouldWireStoreHandlers && !internalState.storeHandlersWired) {
    const engineStoreApi = resolveEngineStoreApi(options.engineStoreSetState);

    if (!engineStoreApi?.setState) {
      throw new Error(
        '[ZeroBindings] Unable to resolve engineStore.setState(). ' +
          'Pass engineStoreSetState explicitly or export a Zustand store API ' +
          'from pzo-web/src/store/engineStore.ts.',
      );
    }

    wireAllEngineHandlers(eventBus as any, engineStoreApi.setState as any);
    internalState.storeHandlersWired = true;
  }

  const shouldWireRunMirror = options.wireRunMirror !== false;
  if (shouldWireRunMirror && !internalState.runMirrorUnsubscribe) {
    internalState.runMirrorUnsubscribe = wireRunStoreMirror();
  }

  return {
    orchestrator,
    eventBus,
    storeHandlersWired: internalState.storeHandlersWired,
    runMirrorWired: Boolean(internalState.runMirrorUnsubscribe),
    mode: internalState.mode,
    getEngineStoreApi: () =>
      resolveEngineStoreApi(options.engineStoreSetState),
    cleanup: () => {
      unbindZeroRuntime();
    },
  };
}

export function rebindZeroRuntime(
  options: ZeroBindingOptions = {},
): ZeroRuntimeBindings {
  unbindZeroRuntime();
  markZeroEventBusWiringDirty();

  return bindZeroRuntime(options);
}

export function getZeroRuntimeBindings(): ZeroRuntimeBindings {
  return bindZeroRuntime({
    wireStoreHandlers: false,
    wireRunMirror: false,
    registerDefaultChannels: true,
  });
}

export function buildZeroRuntimeStatusSnapshot(
  orchestrator: EngineOrchestrator | null = internalState.orchestrator,
): ZeroRuntimeStatusSnapshot {
  const engineStoreApi = resolveEngineStoreApi();
  const engineStoreSnapshot = engineStoreApi?.getState
    ? engineStoreApi.getState()
    : null;

  return {
    lifecycleState: safeGetLifecycleState(orchestrator),
    healthReport: safeGetHealthReport(orchestrator),
    pendingEventCount: safeGetPendingCount(internalState.eventBus),
    isFlushing: safeGetFlushingState(internalState.eventBus),
    runStoreSnapshot: runStore.getState(),
    engineStoreSnapshot,
    mode: internalState.mode,
  };
}

export function getBoundModeState(): ZeroModeBindingState | null {
  return internalState.mode;
}