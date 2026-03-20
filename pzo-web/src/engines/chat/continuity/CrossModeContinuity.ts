/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT CONTINUITY / CROSS-MODE CONTINUITY
 * FILE: pzo-web/src/engines/chat/continuity/CrossModeContinuity.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Orchestrates chat continuity across mount changes without taking ownership away
 * from ChatEngine, ChatMountRegistry, or the existing event bridge.
 *
 * This file treats chat continuity as a runtime director over existing authority:
 * - ChatEngine remains owner of transcript state, channel state, panel state,
 *   presence, typing, event ingestion, and transport-facing mutation.
 * - ChatMountRegistry remains owner of legal surface policy and runtime mounting.
 * - This module watches both, computes a carryover plan, and reapplies only the
 *   minimum continuity needed for the next mount to feel like the same world.
 */

import { CHAT_MOUNT_PRESETS } from '../types';
import type { ChatMountTarget, ChatVisibleChannel } from '../types';
import {
  CarryoverSceneState,
  type CarryoverHydrationPlan,
  type CarryoverProjection,
  type CarryoverSceneSummary,
  type CarryoverStateLike,
  type JsonObject,
  type UnixMs,
} from './CarryoverSceneState';
import {
  CompanionContinuity,
  type CompanionContinuitySnapshot,
  type CompanionContinuityTransitionDigest,
} from './CompanionContinuity';

export interface CrossModeContinuityObserverSnapshot {
  readonly updatedAt: UnixMs;
  readonly activeMountTarget?: ChatMountTarget;
  readonly lastKnownVisibleChannel?: ChatVisibleChannel;
  readonly currentProjection?: CarryoverProjection;
  readonly lastAppliedPlan?: CrossModeContinuityAppliedPlan;
  readonly companionSnapshot: CompanionContinuitySnapshot;
  readonly recentTransitions: readonly CrossModeContinuityAppliedPlan[];
}

export interface CrossModeContinuityAppliedPlan {
  readonly planId: string;
  readonly builtAt: UnixMs;
  readonly fromMount: ChatMountTarget;
  readonly toMount: ChatMountTarget;
  readonly preferredChannel: ChatVisibleChannel;
  readonly restoredChannel?: ChatVisibleChannel;
  readonly restorePanelOpen: boolean;
  readonly restoreCollapsed: boolean;
  readonly carryoverSummary: JsonObject;
  readonly companionDigest?: CompanionContinuityTransitionDigest;
  readonly hydration: CarryoverHydrationPlan;
  readonly summary: CarryoverSceneSummary;
  readonly notes: readonly string[];
}

export interface CrossModeContinuityMountMemory {
  readonly mountTarget: ChatMountTarget;
  readonly lastVisibleChannel: ChatVisibleChannel;
  readonly panelWasOpen: boolean;
  readonly panelWasCollapsed: boolean;
  readonly updatedAt: UnixMs;
  readonly lastSummaryLine?: string;
}

export interface CrossModeContinuityEngineState extends CarryoverStateLike {
  readonly activeMountTarget?: ChatMountTarget;
  readonly activeVisibleChannel?: ChatVisibleChannel;
}

export type CrossModeContinuityEngineObserver = (state: Readonly<CrossModeContinuityEngineState>) => void;
export type CrossModeContinuityEventObserver = (event: { readonly name: string; readonly payload?: JsonObject; readonly emittedAt?: UnixMs }) => void;

export interface CrossModeContinuityChatEngineLike {
  subscribe(observer: CrossModeContinuityEngineObserver): () => void;
  onEvent?(observer: CrossModeContinuityEventObserver): () => void;
  mount(nextTarget: ChatMountTarget): void;
  setVisibleChannel?(channelId: ChatVisibleChannel): void;
  openPanel?(): void;
  closePanel?(): void;
  toggleCollapsed?(): void;
}

export interface CrossModeContinuityMountRegistryLike {
  subscribe?(observer: (snapshot: { readonly activePrimarySurfaceId?: string | null; readonly registrations?: readonly unknown[] }) => void): () => void;
  getRuntimeSnapshot?(): { readonly activePrimarySurfaceId?: string | null; readonly registrations?: readonly unknown[] };
}

export interface CrossModeContinuityOptions {
  readonly restoreChannelPerMount?: boolean;
  readonly restorePanelPerMount?: boolean;
  readonly respectPresetDefaultCollapse?: boolean;
  readonly stickyMemoryWindowMs?: number;
  readonly maxRecentTransitions?: number;
  readonly automaticPanelReopenThreshold01?: number;
  readonly debugEcho?: boolean;
}

const DEFAULT_OPTIONS: Required<CrossModeContinuityOptions> = Object.freeze({
  restoreChannelPerMount: true,
  restorePanelPerMount: true,
  respectPresetDefaultCollapse: true,
  stickyMemoryWindowMs: 8 * 60 * 1000,
  maxRecentTransitions: 32,
  automaticPanelReopenThreshold01: 0.42,
  debugEcho: false,
});

function nowUnixMs(): UnixMs {
  return Date.now();
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function normalizeMountTarget(value: unknown, fallback: ChatMountTarget = 'GAME_BOARD' as ChatMountTarget): ChatMountTarget {
  return (typeof value === 'string' && value in CHAT_MOUNT_PRESETS)
    ? (value as ChatMountTarget)
    : fallback;
}

function normalizeVisibleChannel(value: unknown, fallback: ChatVisibleChannel): ChatVisibleChannel {
  return typeof value === 'string' ? (value as ChatVisibleChannel) : fallback;
}

function shallowClone<T extends object>(value: T | undefined): T | undefined {
  if (!value) return undefined;
  return { ...(value as Record<string, unknown>) } as T;
}

export class CrossModeContinuity {
  private readonly options: Required<CrossModeContinuityOptions>;
  private readonly projector: CarryoverSceneState;
  private readonly companions: CompanionContinuity;
  private readonly mountMemory = new Map<ChatMountTarget, CrossModeContinuityMountMemory>();
  private readonly observers = new Set<(snapshot: CrossModeContinuityObserverSnapshot) => void>();
  private readonly recentTransitions: CrossModeContinuityAppliedPlan[] = [];
  private readonly debugNotes: string[] = [];

  private engine: CrossModeContinuityChatEngineLike | null = null;
  private mountRegistry: CrossModeContinuityMountRegistryLike | null = null;
  private unsubscribeEngine: (() => void) | null = null;
  private unsubscribeEvents: (() => void) | null = null;
  private unsubscribeRegistry: (() => void) | null = null;

  private lastState: CrossModeContinuityEngineState | null = null;
  private currentProjection: CarryoverProjection | undefined;
  private lastAppliedPlan: CrossModeContinuityAppliedPlan | undefined;
  private registryPrimarySurfaceId?: string | null;
  private updatedAt: UnixMs = 0;
  private pendingTransitionTarget: ChatMountTarget | null = null;
  private pendingTransitionFrom: ChatMountTarget | null = null;
  private suppressNextMemoryCapture = false;

  public constructor(options: CrossModeContinuityOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.projector = new CarryoverSceneState();
    this.companions = new CompanionContinuity();
  }

  public attachEngine(engine: CrossModeContinuityChatEngineLike): () => void {
    this.detachEngine();
    this.engine = engine;
    this.unsubscribeEngine = engine.subscribe((state) => this.handleState(state));
    this.unsubscribeEvents = engine.onEvent?.((event) => this.handleEvent(event)) ?? null;
    return () => this.detachEngine();
  }

  public attachMountRegistry(registry: CrossModeContinuityMountRegistryLike): () => void {
    this.detachMountRegistry();
    this.mountRegistry = registry;
    this.registryPrimarySurfaceId = registry.getRuntimeSnapshot?.().activePrimarySurfaceId;
    this.unsubscribeRegistry = registry.subscribe?.((snapshot) => {
      this.registryPrimarySurfaceId = snapshot.activePrimarySurfaceId;
      this.updatedAt = nowUnixMs();
      this.emitSnapshot();
    }) ?? null;
    return () => this.detachMountRegistry();
  }

  public subscribe(observer: (snapshot: CrossModeContinuityObserverSnapshot) => void): () => void {
    this.observers.add(observer);
    observer(this.getSnapshot());
    return () => this.observers.delete(observer);
  }

  public transitionTo(nextTarget: ChatMountTarget, now: UnixMs = nowUnixMs()): CrossModeContinuityAppliedPlan | undefined {
    if (!this.engine || !this.lastState) return undefined;
    const fromMount = normalizeMountTarget(this.lastState.activeMountTarget, nextTarget);
    this.captureMountMemory(this.lastState, now);
    const projection = this.projector.projectTransition(this.lastState, nextTarget, now);
    const companionDigest = this.companions.projectTransition(this.lastState, fromMount, nextTarget, now);
    const appliedPlan = this.buildAppliedPlan(fromMount, nextTarget, projection, companionDigest, now);

    this.pendingTransitionTarget = nextTarget;
    this.pendingTransitionFrom = fromMount;
    this.currentProjection = projection;
    this.lastAppliedPlan = appliedPlan;
    this.pushTransition(appliedPlan);

    this.debug(`transition:${fromMount}->${nextTarget}`, {
      preferredChannel: appliedPlan.preferredChannel,
      panelOpen: appliedPlan.restorePanelOpen,
      collapsed: appliedPlan.restoreCollapsed,
      escortActor: companionDigest.escortPlan?.actorId,
    });

    this.engine.mount(nextTarget);
    this.updatedAt = now;
    this.emitSnapshot();
    return appliedPlan;
  }

  public getSnapshot(): CrossModeContinuityObserverSnapshot {
    return {
      updatedAt: this.updatedAt,
      activeMountTarget: this.lastState?.activeMountTarget,
      lastKnownVisibleChannel: this.lastState?.activeVisibleChannel,
      currentProjection: this.currentProjection,
      lastAppliedPlan: this.lastAppliedPlan,
      companionSnapshot: this.companions.getSnapshot(),
      recentTransitions: [...this.recentTransitions],
    };
  }

  public getMountMemory(target: ChatMountTarget): CrossModeContinuityMountMemory | undefined {
    return this.mountMemory.get(target);
  }

  public getDebugNotes(): readonly string[] {
    return [...this.debugNotes];
  }

  public detach(): void {
    this.detachEngine();
    this.detachMountRegistry();
    this.observers.clear();
  }

  private detachEngine(): void {
    this.unsubscribeEngine?.();
    this.unsubscribeEvents?.();
    this.unsubscribeEngine = null;
    this.unsubscribeEvents = null;
    this.engine = null;
  }

  private detachMountRegistry(): void {
    this.unsubscribeRegistry?.();
    this.unsubscribeRegistry = null;
    this.mountRegistry = null;
    this.registryPrimarySurfaceId = undefined;
  }

  private handleState(state: Readonly<CrossModeContinuityEngineState>): void {
    const now = nowUnixMs();
    const previous = this.lastState;
    this.lastState = state;
    this.companions.ingestState(state, normalizeMountTarget(state.activeMountTarget), now);

    if (previous && !this.suppressNextMemoryCapture) {
      const previousMount = normalizeMountTarget(previous.activeMountTarget);
      const nextMount = normalizeMountTarget(state.activeMountTarget, previousMount);
      const mountChanged = previousMount !== nextMount;
      if (!mountChanged) this.captureMountMemory(state, now);
      if (mountChanged) this.handleMountChange(previousMount, nextMount, state, now);
    } else if (!previous) {
      this.captureMountMemory(state, now);
    }

    this.updatedAt = now;
    this.emitSnapshot();
  }

  private handleEvent(event: { readonly name: string; readonly payload?: JsonObject; readonly emittedAt?: UnixMs }): void {
    const at = event.emittedAt ?? nowUnixMs();
    const state = this.lastState;
    if (!state) return;

    switch (event.name) {
      case 'CHAT_CHANNEL_CHANGED': {
        const to = normalizeVisibleChannel(event.payload?.to, state.activeVisibleChannel ?? CHAT_MOUNT_PRESETS[normalizeMountTarget(state.activeMountTarget)].defaultVisibleChannel);
        this.captureMountMemory({ ...state, activeVisibleChannel: to }, at);
        break;
      }
      case 'CHAT_OPENED':
      case 'CHAT_PANEL_OPENED':
        this.captureMountMemory(state, at, { panelWasOpen: true });
        break;
      case 'CHAT_CLOSED':
      case 'CHAT_PANEL_CLOSED':
        this.captureMountMemory(state, at, { panelWasOpen: false });
        break;
      default:
        break;
    }

    this.updatedAt = at;
  }

  private handleMountChange(
    previousMount: ChatMountTarget,
    nextMount: ChatMountTarget,
    state: Readonly<CrossModeContinuityEngineState>,
    now: UnixMs,
  ): void {
    const transitionWasRequested = this.pendingTransitionTarget === nextMount;
    const baseState = previousMount === nextMount ? state : (this.lastState ?? state);
    const projection = transitionWasRequested && this.currentProjection
      ? this.currentProjection
      : this.projector.projectTransition(baseState, nextMount, now);
    const companionDigest = transitionWasRequested && this.lastAppliedPlan?.companionDigest
      ? this.lastAppliedPlan.companionDigest
      : this.companions.projectTransition(baseState, previousMount, nextMount, now);
    const plan = transitionWasRequested && this.lastAppliedPlan
      ? this.lastAppliedPlan
      : this.buildAppliedPlan(previousMount, nextMount, projection, companionDigest, now);

    this.applyPlan(state, plan, now);
    this.pendingTransitionTarget = null;
    this.pendingTransitionFrom = null;
    this.currentProjection = projection;
    this.lastAppliedPlan = plan;
    this.updatedAt = now;
  }

  private buildAppliedPlan(
    fromMount: ChatMountTarget,
    toMount: ChatMountTarget,
    projection: Readonly<CarryoverProjection>,
    companionDigest: CompanionContinuityTransitionDigest | undefined,
    now: UnixMs,
  ): CrossModeContinuityAppliedPlan {
    const memory = this.mountMemory.get(toMount);
    const restoredChannel = this.options.restoreChannelPerMount
      ? this.restoreChannelFromMemory(toMount, projection.summary.preferredVisibleChannel, memory)
      : undefined;
    const preferredChannel = restoredChannel ?? projection.summary.preferredVisibleChannel;
    const restoreCollapsed = this.resolveCollapsedState(toMount, projection.summary, memory);
    const restorePanelOpen = this.resolvePanelOpenState(toMount, projection.summary, memory);
    const notes = this.buildPlanNotes(projection.summary, memory, companionDigest, preferredChannel, restorePanelOpen, restoreCollapsed);

    return {
      planId: `cross-mode:${fromMount}:${toMount}:${now}`,
      builtAt: now,
      fromMount,
      toMount,
      preferredChannel: projection.summary.preferredVisibleChannel,
      restoredChannel,
      restorePanelOpen,
      restoreCollapsed,
      carryoverSummary: {
        ...projection.hydration.carrySummaryPatch,
        restoredChannel,
        restorePanelOpen,
        restoreCollapsed,
        companionDigestId: companionDigest?.digestId,
      },
      companionDigest,
      hydration: projection.hydration,
      summary: projection.summary,
      notes,
    };
  }

  private applyPlan(
    state: Readonly<CrossModeContinuityEngineState>,
    plan: Readonly<CrossModeContinuityAppliedPlan>,
    now: UnixMs,
  ): void {
    if (!this.engine) return;

    const targetPreset = CHAT_MOUNT_PRESETS[plan.toMount];
    const stateChannel = normalizeVisibleChannel(state.activeVisibleChannel, targetPreset.defaultVisibleChannel);
    const nextChannel = plan.restoredChannel ?? plan.preferredChannel;
    if (nextChannel !== stateChannel) this.engine.setVisibleChannel?.(nextChannel);

    if (plan.restorePanelOpen) {
      this.engine.openPanel?.();
    } else if (this.options.restorePanelPerMount) {
      this.engine.closePanel?.();
    }

    const shouldBeCollapsed = plan.restoreCollapsed;
    const memory = this.mountMemory.get(plan.toMount);
    const rememberedCollapsed = memory?.panelWasCollapsed;
    const currentCollapsedGuess = rememberedCollapsed ?? targetPreset.defaultCollapsed;
    if (this.options.restorePanelPerMount && currentCollapsedGuess !== shouldBeCollapsed) {
      this.suppressNextMemoryCapture = true;
      try {
        this.engine.toggleCollapsed?.();
      } finally {
        this.suppressNextMemoryCapture = false;
      }
    }

    this.captureMountMemory(
      {
        ...state,
        activeMountTarget: plan.toMount,
        activeVisibleChannel: nextChannel,
        continuity: {
          ...(state.continuity ?? {}),
          carryoverSummary: plan.carryoverSummary,
        },
      },
      now,
      {
        panelWasOpen: plan.restorePanelOpen,
        panelWasCollapsed: plan.restoreCollapsed,
        lastSummaryLine: plan.summary.summaryLine,
      },
    );
  }

  private restoreChannelFromMemory(
    target: ChatMountTarget,
    preferred: ChatVisibleChannel,
    memory: CrossModeContinuityMountMemory | undefined,
  ): ChatVisibleChannel | undefined {
    if (!memory) return undefined;
    if (memory.updatedAt < nowUnixMs() - this.options.stickyMemoryWindowMs) return undefined;
    const allowed = CHAT_MOUNT_PRESETS[target].allowedVisibleChannels;
    return allowed.includes(memory.lastVisibleChannel) ? memory.lastVisibleChannel : preferred;
  }

  private resolveCollapsedState(
    target: ChatMountTarget,
    summary: Readonly<CarryoverSceneSummary>,
    memory: CrossModeContinuityMountMemory | undefined,
  ): boolean {
    if (!this.options.restorePanelPerMount) return CHAT_MOUNT_PRESETS[target].defaultCollapsed;
    if (summary.pressure01 >= this.options.automaticPanelReopenThreshold01) return false;
    if (memory && memory.updatedAt >= nowUnixMs() - this.options.stickyMemoryWindowMs) return memory.panelWasCollapsed;
    return this.options.respectPresetDefaultCollapse ? CHAT_MOUNT_PRESETS[target].defaultCollapsed : summary.overlay.restoreCollapsed;
  }

  private resolvePanelOpenState(
    target: ChatMountTarget,
    summary: Readonly<CarryoverSceneSummary>,
    memory: CrossModeContinuityMountMemory | undefined,
  ): boolean {
    if (!this.options.restorePanelPerMount) return summary.overlay.restorePanelOpen;
    if (summary.pressure01 >= this.options.automaticPanelReopenThreshold01) return true;
    if (memory && memory.updatedAt >= nowUnixMs() - this.options.stickyMemoryWindowMs) return memory.panelWasOpen;
    return summary.overlay.restorePanelOpen || !CHAT_MOUNT_PRESETS[target].defaultCollapsed;
  }

  private buildPlanNotes(
    summary: Readonly<CarryoverSceneSummary>,
    memory: CrossModeContinuityMountMemory | undefined,
    companionDigest: CompanionContinuityTransitionDigest | undefined,
    preferredChannel: ChatVisibleChannel,
    restorePanelOpen: boolean,
    restoreCollapsed: boolean,
  ): string[] {
    const notes = [
      `channel=${preferredChannel}`,
      `panelOpen=${String(restorePanelOpen)}`,
      `collapsed=${String(restoreCollapsed)}`,
      `tension=${summary.tensionBand}`,
    ];
    if (memory) notes.push(`memory=${memory.mountTarget}:${memory.lastVisibleChannel}`);
    if (summary.shouldHoldSilence) notes.push('hold_silence');
    if (summary.pendingReveals.length > 0) notes.push(`pending_reveals=${summary.pendingReveals.length}`);
    if (companionDigest?.escortPlan?.actorId) notes.push(`escort=${companionDigest.escortPlan.actorId}`);
    return notes;
  }

  private captureMountMemory(
    state: Readonly<CrossModeContinuityEngineState>,
    at: UnixMs,
    overrides: Partial<Omit<CrossModeContinuityMountMemory, 'mountTarget' | 'lastVisibleChannel' | 'updatedAt'>> = {},
  ): void {
    const mountTarget = normalizeMountTarget(state.activeMountTarget);
    const visibleChannel = normalizeVisibleChannel(state.activeVisibleChannel, CHAT_MOUNT_PRESETS[mountTarget].defaultVisibleChannel);
    const existing = this.mountMemory.get(mountTarget);
    const summaryLine = asString(state.continuity?.carryoverSummary?.summaryLine);
    this.mountMemory.set(mountTarget, {
      mountTarget,
      lastVisibleChannel: visibleChannel,
      panelWasOpen: overrides.panelWasOpen ?? existing?.panelWasOpen ?? true,
      panelWasCollapsed: overrides.panelWasCollapsed ?? existing?.panelWasCollapsed ?? CHAT_MOUNT_PRESETS[mountTarget].defaultCollapsed,
      updatedAt: at,
      lastSummaryLine: overrides.lastSummaryLine ?? summaryLine ?? existing?.lastSummaryLine,
    });
  }

  private pushTransition(plan: CrossModeContinuityAppliedPlan): void {
    this.recentTransitions.push(plan);
    this.recentTransitions.splice(0, Math.max(0, this.recentTransitions.length - this.options.maxRecentTransitions));
  }

  private emitSnapshot(): void {
    const snapshot = this.getSnapshot();
    for (const observer of this.observers) observer(snapshot);
  }

  private debug(event: string, detail?: JsonObject): void {
    const line = `${event}${detail ? ` ${JSON.stringify(detail)}` : ''}`;
    this.debugNotes.push(line);
    this.debugNotes.splice(0, Math.max(0, this.debugNotes.length - 128));
    if (this.options.debugEcho) {
      // eslint-disable-next-line no-console
      console.debug('[CrossModeContinuity]', line);
    }
  }
}

export function createCrossModeContinuity(options: CrossModeContinuityOptions = {}): CrossModeContinuity {
  return new CrossModeContinuity(options);
}

export const CrossModeContinuityModule = Object.freeze({
  displayName: 'CrossModeContinuity',
  file: 'pzo-web/src/engines/chat/continuity/CrossModeContinuity.ts',
  category: 'frontend-chat-continuity-runtime',
  authorities: {
    frontend: '/pzo-web/src/engines/chat/continuity',
    backend: '/backend/src/game/engine/chat/continuity',
    shared: '/shared/contracts/chat',
  },
  create: createCrossModeContinuity,
});
