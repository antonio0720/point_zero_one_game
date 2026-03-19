/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT RESCUE BANNER BRIDGE
 * FILE: pzo-web/src/engines/chat/rescue/RescueBannerBridge.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * State-centric bridge that projects rescue and recovery into live chat/UI
 * state, schedules helper/system messages, and exposes render-safe banner
 * models to mount surfaces like RescueWindowBanner, CounterplayModal, and
 * threat/pressure-adjacent overlays.
 *
 * This bridge respects the repo's division of labor:
 * - shared/contracts/chat defines rescue/recovery truth shapes,
 * - RageQuitInterceptor decides whether a rescue window should open,
 * - RecoveryPromptPolicy decides what the recovery options look like,
 * - RescueBannerBridge mutates frontend state in a compile-safe, reversible way.
 * ============================================================================
 */

import {
  beginSilenceInState,
  buildLocalSystemMessage,
  countUnread,
  endSilenceInState,
  markChannelReadInState,
  popDueRevealsFromState,
  pushMessageToState,
  scheduleRevealInState,
  setActiveSceneInState,
  setAudienceHeatInState,
  setChannelMoodInState,
  setComposerDisabledInState,
  upsertRelationshipInState,
} from '../ChatState';
import type {
  ChatAudienceHeat,
  ChatChannelMood,
  ChatEngineState,
  ChatMessage,
  ChatRelationshipState,
  ChatRevealSchedule,
  ChatRescueDecision,
  ChatScenePlan,
  ChatVisibleChannel,
  JsonObject,
  Score100,
  UnixMs,
} from '../types';
import {
  RageQuitInterceptor,
  createRageQuitInterceptor,
  type RageQuitInterceptResult,
  type RageQuitInterceptorOptions,
  type RageQuitRuntimeFrame,
} from './RageQuitInterceptor';
import {
  RecoveryPromptPolicy,
  createRecoveryPromptPolicy,
  type RecoveryPromptContext,
  type RecoveryPromptPolicyOptions,
  type RecoveryPromptProjection,
  type RecoveryQuickAction,
} from './RecoveryPromptPolicy';
import type {
  ChatRecoveryPlan,
} from '../../../../shared/contracts/chat/ChatRecovery';
import type {
  ChatRescuePlan,
  ChatRescueWindow,
} from '../../../../shared/contracts/chat/ChatRescue';

export interface RescueBannerViewModel {
  readonly rescueId: string;
  readonly recoveryId: string;
  readonly title: string;
  readonly body: string;
  readonly helperLine: string;
  readonly visibleChannel: ChatVisibleChannel;
  readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly mode: 'INLINE' | 'BANNER' | 'SIDECARD' | 'MODAL';
  readonly suppressCrowd: boolean;
  readonly quickActions: readonly RecoveryQuickAction[];
  readonly expiresAt: UnixMs | null;
  readonly unreadCount: number;
  readonly notes: readonly string[];
}

export interface RescueBannerBridgeOptions {
  readonly interceptor?: RageQuitInterceptor;
  readonly policy?: RecoveryPromptPolicy;
  readonly interceptorOptions?: RageQuitInterceptorOptions;
  readonly policyOptions?: RecoveryPromptPolicyOptions;
  readonly autoOpenRescueMessages?: boolean;
  readonly autoOpenRecoveryMessages?: boolean;
  readonly autoReadOwnBannerChannel?: boolean;
}

export interface RescueBannerBridgeResult {
  readonly state: ChatEngineState;
  readonly rescueOpened: boolean;
  readonly rescueClosed: boolean;
  readonly viewModel?: RescueBannerViewModel | null;
  readonly decision?: ChatRescueDecision | null;
  readonly reasons: readonly string[];
}

interface ActiveBridgeState {
  readonly plan: ChatRescuePlan;
  readonly recovery: ChatRecoveryPlan;
  readonly window: ChatRescueWindow | null;
  readonly projection: RecoveryPromptProjection;
  readonly openedAt: UnixMs;
  readonly systemMessageIds: readonly string[];
}

const DEFAULT_OPTIONS: Required<Pick<RescueBannerBridgeOptions, 'autoOpenRescueMessages' | 'autoOpenRecoveryMessages' | 'autoReadOwnBannerChannel'>> = {
  autoOpenRescueMessages: true,
  autoOpenRecoveryMessages: true,
  autoReadOwnBannerChannel: false,
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function helperRelationship(plan: ChatRescuePlan, now: UnixMs): ChatRelationshipState | null {
  if (!plan.helperActor?.actorId) return null;
  return {
    relationshipId: (plan.helperActor.relationshipId ?? (`relationship:${String(plan.helperActor.actorId)}` as never)) as never,
    counterpartId: plan.helperActor.actorId as never,
    counterpartKind: (plan.helperActor.counterpartKind ?? 'ALLY') as never,
    stance: (plan.helperActor.relationshipStance ?? 'SUPPORTIVE') as never,
    respect: 68 as Score100,
    fear: 8 as Score100,
    contempt: 0 as Score100,
    fascination: 20 as Score100,
    trust: 66 as Score100,
    familiarity: 54 as Score100,
    rivalryIntensity: 0 as Score100,
    rescueDebt: 22 as Score100,
    updatedAt: now,
  } as ChatRelationshipState;
}

function buildRescueMood(plan: ChatRescuePlan): ChatChannelMood {
  return {
    channelId: plan.visibleChannel as never,
    mood:
      plan.urgency === 'CRITICAL' ? 'TENSE' as never :
      plan.kind === 'DEAL_ROOM_BAILOUT' ? 'PREDATORY' as never :
      'WATCHFUL' as never,
    reason: `rescue:${plan.kind}`,
    updatedAt: Date.now() as UnixMs,
  } as ChatChannelMood;
}

function buildRescueHeat(plan: ChatRescuePlan): ChatAudienceHeat {
  return {
    global01: (plan.visibleChannel === 'GLOBAL' ? 0.56 : 0.24) as never,
    syndicate01: (plan.visibleChannel === 'SYNDICATE' ? 0.48 : 0.18) as never,
    dealRoom01: (plan.visibleChannel === 'DEAL_ROOM' ? 0.62 : 0.12) as never,
    spectator01: 0.18 as never,
    updatedAt: Date.now() as UnixMs,
  } as ChatAudienceHeat;
}

export class RescueBannerBridge {
  private readonly interceptor: RageQuitInterceptor;
  private readonly policy: RecoveryPromptPolicy;
  private readonly options: Required<Pick<RescueBannerBridgeOptions, 'autoOpenRescueMessages' | 'autoOpenRecoveryMessages' | 'autoReadOwnBannerChannel'>>;
  private active: ActiveBridgeState | null = null;

  public constructor(options: RescueBannerBridgeOptions = {}) {
    this.interceptor = options.interceptor ?? createRageQuitInterceptor(options.interceptorOptions);
    this.policy = options.policy ?? createRecoveryPromptPolicy(options.policyOptions);
    this.options = {
      ...DEFAULT_OPTIONS,
      autoOpenRescueMessages: options.autoOpenRescueMessages ?? DEFAULT_OPTIONS.autoOpenRescueMessages,
      autoOpenRecoveryMessages: options.autoOpenRecoveryMessages ?? DEFAULT_OPTIONS.autoOpenRecoveryMessages,
      autoReadOwnBannerChannel: options.autoReadOwnBannerChannel ?? DEFAULT_OPTIONS.autoReadOwnBannerChannel,
    };
  }

  public ingest(state: ChatEngineState, frame: RageQuitRuntimeFrame): RescueBannerBridgeResult {
    let nextState = clone(state);
    const result = this.interceptor.ingest(frame);

    if (!result.candidate || !result.activePlan || !result.activeRecovery) {
      nextState = this.advanceScheduled(nextState, frame.now);
      return {
        state: nextState,
        rescueOpened: false,
        rescueClosed: false,
        viewModel: this.active ? this.toViewModel(nextState, this.active) : null,
        decision: result.decision ?? null,
        reasons: result.reasons,
      };
    }

    const projection = this.policy.build({
      now: frame.now,
      visibleChannel: result.activePlan.visibleChannel,
      affect: frame.affect,
      learning: frame.learning,
      rescuePlan: result.activePlan,
      selectedOffer: result.activePlan.selectedOffer,
      helperPosture: result.activePlan.helperPosture,
      recentCollapse: Boolean((result.activePlan.trigger.kind === 'POST_COLLAPSE_FREEZE')),
      inDealRoom: result.activePlan.visibleChannel === 'DEAL_ROOM',
      counterWindowOpen: Boolean((frame.state as any).bossFight?.counterWindowId),
      notes: result.reasons,
    });

    this.active = {
      plan: result.activePlan,
      recovery: result.activeRecovery,
      window: result.candidate.window,
      projection,
      openedAt: frame.now,
      systemMessageIds: [],
    };

    nextState = this.applyOpen(nextState, result, projection, frame.now);
    nextState = this.advanceScheduled(nextState, frame.now);

    return {
      state: nextState,
      rescueOpened: true,
      rescueClosed: false,
      viewModel: this.toViewModel(nextState, this.active),
      decision: result.decision ?? null,
      reasons: result.reasons,
    };
  }

  public acceptAction(state: ChatEngineState, actionId: string, at: UnixMs): RescueBannerBridgeResult {
    let nextState = clone(state);
    if (!this.active) {
      return { state: nextState, rescueOpened: false, rescueClosed: false, viewModel: null, decision: null, reasons: ['no-active-bridge'] };
    }

    const acceptResult = this.interceptor.acceptRescue(actionId, at);
    nextState = this.writeAcceptanceMessage(nextState, this.active, actionId, at);
    nextState = this.closeBridgeState(nextState, at, false);

    return {
      state: nextState,
      rescueOpened: false,
      rescueClosed: true,
      viewModel: null,
      decision: acceptResult.decision ?? null,
      reasons: ['accepted-action', ...acceptResult.reasons],
    };
  }

  public dismiss(state: ChatEngineState, at: UnixMs, reason = 'dismissed'): RescueBannerBridgeResult {
    let nextState = clone(state);
    if (!this.active) {
      return { state: nextState, rescueOpened: false, rescueClosed: false, viewModel: null, decision: null, reasons: ['no-active-bridge'] };
    }

    this.interceptor.dismissRescue(at, reason);
    nextState = this.writeDismissMessage(nextState, this.active, reason, at);
    nextState = this.closeBridgeState(nextState, at, true);

    return {
      state: nextState,
      rescueOpened: false,
      rescueClosed: true,
      viewModel: null,
      decision: null,
      reasons: [`dismissed:${reason}`],
    };
  }

  public tick(state: ChatEngineState, now: UnixMs): RescueBannerBridgeResult {
    const nextState = this.advanceScheduled(clone(state), now);
    const expired = Boolean(this.active?.window && Number(now) >= Number(this.active.window.closesAt));
    if (expired) {
      const closed = this.closeBridgeState(nextState, now, true);
      return { state: closed, rescueOpened: false, rescueClosed: true, viewModel: null, decision: null, reasons: ['window-expired'] };
    }

    return {
      state: nextState,
      rescueOpened: false,
      rescueClosed: false,
      viewModel: this.active ? this.toViewModel(nextState, this.active) : null,
      decision: null,
      reasons: ['tick'],
    };
  }

  public getViewModel(state: ChatEngineState): RescueBannerViewModel | null {
    return this.active ? this.toViewModel(state, this.active) : null;
  }

  private applyOpen(
    state: ChatEngineState,
    result: RageQuitInterceptResult,
    projection: RecoveryPromptProjection,
    now: UnixMs,
  ): ChatEngineState {
    if (!this.active) return state;
    let nextState = clone(state);
    const { plan, recovery } = this.active;

    setComposerDisabledInState(nextState as any, plan.visibleChannel as never, false);
    setActiveSceneInState(nextState as any, projection.plan ? this.buildSceneFromProjection(plan, projection, now) : null);
    setChannelMoodInState(nextState as any, buildRescueMood(plan));
    setAudienceHeatInState(nextState as any, buildRescueHeat(plan));

    const relationship = helperRelationship(plan, now);
    if (relationship) {
      upsertRelationshipInState(nextState as any, relationship);
    }

    if (projection.suggestedMode === 'SIDECARD' || projection.suggestedMode === 'MODAL') {
      beginSilenceInState(nextState as any, {
        silenceId: (`rescue-silence:${String(plan.rescueId)}` as never),
        reason: `rescue:${plan.kind}`,
        startedAt: now,
        until: ((Number(now) + safeNumber(plan.selectedOffer.prompt.quietWindowMs, 2200)) as UnixMs),
        visibleChannel: plan.visibleChannel as never,
        suppressBots: true,
        suppressCrowd: projection.suppressCrowd,
        allowHelperWhisper: true,
        notes: ['rescue-banner-open'],
      } as any);
    }

    if (this.options.autoOpenRescueMessages) {
      const rescueMsg = this.buildPrimaryMessage(plan, projection, now);
      pushMessageToState(nextState as any, rescueMsg as any);
      this.active = {
        ...this.active,
        systemMessageIds: [...this.active.systemMessageIds, String((rescueMsg as any).messageId)],
      };
    }

    if (this.options.autoOpenRecoveryMessages) {
      const helperMsg = this.buildHelperMessage(plan, projection, now);
      const schedule: ChatRevealSchedule = {
        revealAt: ((Number(now) + safeNumber(plan.selectedOffer.prompt.quietWindowMs, 900)) as UnixMs),
        channelId: plan.visibleChannel as never,
        reason: `recovery:${recovery.kind}`,
      } as ChatRevealSchedule;
      scheduleRevealInState(nextState as any, schedule as any, helperMsg as any);
    }

    if (this.options.autoReadOwnBannerChannel) {
      markChannelReadInState(nextState as any, plan.visibleChannel as never, now);
    }

    return nextState;
  }

  private buildPrimaryMessage(plan: ChatRescuePlan, projection: RecoveryPromptProjection, now: UnixMs): ChatMessage {
    return buildLocalSystemMessage({
      channelId: plan.visibleChannel as never,
      body: `${projection.bannerTitle} — ${projection.bannerBody}`,
      createdAt: now,
      kind: 'SYSTEM' as never,
      actorId: 'system:rescue' as never,
      metadata: {
        rescueId: String(plan.rescueId),
        recoveryId: String(projection.plan.recoveryId),
        mode: projection.suggestedMode,
        urgency: plan.urgency,
      },
    } as any) as ChatMessage;
  }

  private buildHelperMessage(plan: ChatRescuePlan, projection: RecoveryPromptProjection, now: UnixMs): ChatMessage {
    return buildLocalSystemMessage({
      channelId: plan.visibleChannel as never,
      body: projection.helperLine,
      createdAt: now,
      kind: 'NPC' as never,
      actorId: (plan.helperActor?.actorId ?? 'npc:helper:kade') as never,
      metadata: {
        rescueId: String(plan.rescueId),
        helperPosture: plan.helperPosture,
      },
    } as any) as ChatMessage;
  }

  private writeAcceptanceMessage(state: ChatEngineState, active: ActiveBridgeState, actionId: string, at: UnixMs): ChatEngineState {
    const nextState = clone(state);
    const option = active.projection.plan.bundle.options.find((item) => String(item.optionId) === actionId) ?? active.projection.plan.bundle.options[0];
    const msg = buildLocalSystemMessage({
      channelId: active.plan.visibleChannel as never,
      body: `Recovery locked: ${option?.label ?? 'Stable move selected'}.`,
      createdAt: at,
      kind: 'SYSTEM' as never,
      actorId: 'system:recovery' as never,
      metadata: { recoveryId: String(active.recovery.recoveryId), actionId },
    } as any) as ChatMessage;
    pushMessageToState(nextState as any, msg as any);
    return nextState;
  }

  private writeDismissMessage(state: ChatEngineState, active: ActiveBridgeState, reason: string, at: UnixMs): ChatEngineState {
    const nextState = clone(state);
    const msg = buildLocalSystemMessage({
      channelId: active.plan.visibleChannel as never,
      body: `Rescue window closed${reason ? ` — ${reason}` : ''}.`,
      createdAt: at,
      kind: 'SYSTEM' as never,
      actorId: 'system:rescue' as never,
      metadata: { rescueId: String(active.plan.rescueId), reason },
    } as any) as ChatMessage;
    pushMessageToState(nextState as any, msg as any);
    return nextState;
  }

  private closeBridgeState(state: ChatEngineState, at: UnixMs, restoreComposer: boolean): ChatEngineState {
    const nextState = clone(state);
    if (restoreComposer && this.active) {
      setComposerDisabledInState(nextState as any, this.active.plan.visibleChannel as never, false);
      endSilenceInState(nextState as any, `rescue:${String(this.active.plan.rescueId)}` as never);
    }
    this.active = null;
    return nextState;
  }

  private advanceScheduled(state: ChatEngineState, now: UnixMs): ChatEngineState {
    const nextState = clone(state);
    const due = popDueRevealsFromState(nextState as any, now);
    for (const reveal of due as any[]) {
      if (reveal?.message) {
        pushMessageToState(nextState as any, reveal.message);
      }
    }
    return nextState;
  }

  private buildSceneFromProjection(plan: ChatRescuePlan, projection: RecoveryPromptProjection, now: UnixMs): ChatScenePlan {
    return {
      sceneId: (`rescue-scene:${String(plan.rescueId)}` as never),
      archetype: 'RESCUE_WINDOW' as never,
      visibleChannel: plan.visibleChannel as never,
      openedAt: now,
      priority: plan.urgency === 'CRITICAL' ? 100 : 80,
      beats: [
        {
          beatId: (`scene-beat:${String(plan.rescueId)}:banner`) as never,
          kind: 'SYSTEM_NOTICE' as never,
          actorId: 'system:rescue' as never,
          delayMs: 0,
          body: projection.bannerTitle,
          tags: ['rescue', plan.kind.toLowerCase()],
        },
      ],
      notes: projection.notes,
    } as ChatScenePlan;
  }

  private toViewModel(state: ChatEngineState, active: ActiveBridgeState): RescueBannerViewModel {
    return {
      rescueId: String(active.plan.rescueId),
      recoveryId: String(active.recovery.recoveryId),
      title: active.projection.bannerTitle,
      body: active.projection.bannerBody,
      helperLine: active.projection.helperLine,
      visibleChannel: active.plan.visibleChannel,
      urgency: active.plan.urgency,
      mode: active.projection.suggestedMode,
      suppressCrowd: active.projection.suppressCrowd,
      quickActions: active.projection.quickActions,
      expiresAt: active.window?.closesAt ?? null,
      unreadCount: countUnread(state as any, active.plan.visibleChannel as never),
      notes: active.projection.notes,
    };
  }
}

export function createRescueBannerBridge(options: RescueBannerBridgeOptions = {}): RescueBannerBridge {
  return new RescueBannerBridge(options);
}

export const RescueBannerBridgeModule = Object.freeze({
  displayName: 'RescueBannerBridge',
  file: 'pzo-web/src/engines/chat/rescue/RescueBannerBridge.ts',
  category: 'frontend-chat-rescue-bridge',
  create: createRescueBannerBridge,
});


// ============================================================================
// MARK: Extended bridge diagnostics, mount payloads, and UI projections
// ============================================================================

export interface RescueWindowPayload {
  readonly banner: RescueBannerViewModel;
  readonly surface: 'RescueWindowBanner';
  readonly showCountdown: boolean;
  readonly emphasizePrimaryAction: boolean;
  readonly notes: readonly string[];
}

export interface CounterplayModalRescuePayload {
  readonly surface: 'CounterplayModal';
  readonly rescueId: string;
  readonly title: string;
  readonly quickActions: readonly RecoveryQuickAction[];
  readonly helperLine: string;
  readonly shouldPin: boolean;
}

export interface ThreatRadarRescueHint {
  readonly surface: 'ThreatRadarPanel';
  readonly urgency: RescueBannerViewModel['urgency'];
  readonly label: string;
  readonly intensity01: number;
}

export interface RescueBridgeDiagnostics {
  readonly activeRescueId?: string | null;
  readonly activeRecoveryId?: string | null;
  readonly activeMode?: string | null;
  readonly unreadCount: number;
  readonly hasScene: boolean;
  readonly composerDisabled: boolean;
  readonly notes: readonly string[];
}

export interface ManualRescueOpenInput {
  readonly state: ChatEngineState;
  readonly plan: ChatRescuePlan;
  readonly recovery: ChatRecoveryPlan;
  readonly projection: RecoveryPromptProjection;
  readonly window?: ChatRescueWindow | null;
  readonly now: UnixMs;
}

export function buildRescueWindowPayload(viewModel: RescueBannerViewModel): RescueWindowPayload {
  return {
    banner: viewModel,
    surface: 'RescueWindowBanner',
    showCountdown: Boolean(viewModel.expiresAt),
    emphasizePrimaryAction: true,
    notes: viewModel.notes,
  };
}

export function buildCounterplayModalRescuePayload(
  viewModel: RescueBannerViewModel,
): CounterplayModalRescuePayload {
  return {
    surface: 'CounterplayModal',
    rescueId: viewModel.rescueId,
    title: viewModel.title,
    quickActions: viewModel.quickActions,
    helperLine: viewModel.helperLine,
    shouldPin: viewModel.urgency === 'CRITICAL' || viewModel.mode === 'MODAL',
  };
}

export function buildThreatRadarRescueHint(
  viewModel: RescueBannerViewModel,
): ThreatRadarRescueHint {
  return {
    surface: 'ThreatRadarPanel',
    urgency: viewModel.urgency,
    label: viewModel.title,
    intensity01:
      viewModel.urgency === 'CRITICAL' ? 1 :
      viewModel.urgency === 'HIGH' ? 0.78 :
      viewModel.urgency === 'MEDIUM' ? 0.54 : 0.28,
  };
}

export function buildRescueBridgeDiagnostics(
  state: ChatEngineState,
  active: ActiveBridgeState | null,
): RescueBridgeDiagnostics {
  if (!active) {
    return {
      activeRescueId: null,
      activeRecoveryId: null,
      activeMode: null,
      unreadCount: 0,
      hasScene: Boolean((state as any).activeScene),
      composerDisabled: false,
      notes: ['idle'],
    };
  }

  return {
    activeRescueId: String(active.plan.rescueId),
    activeRecoveryId: String(active.recovery.recoveryId),
    activeMode: active.projection.suggestedMode,
    unreadCount: countUnread(state as any, active.plan.visibleChannel as never),
    hasScene: Boolean((state as any).activeScene),
    composerDisabled: Boolean((state as any).composer?.disabledByChannel?.[active.plan.visibleChannel]),
    notes: active.projection.notes,
  };
}

export function openRescueManually(
  bridge: RescueBannerBridge,
  input: ManualRescueOpenInput,
): RescueBannerBridgeResult {
  const fakeResult: RageQuitInterceptResult = {
    candidate: {
      plan: input.plan,
      recovery: input.recovery,
      window: input.window ?? null,
      stateSnapshot: {
        rescueId: input.plan.rescueId,
        outcome: input.plan.state,
        urgency: input.plan.urgency,
        style: input.plan.style,
        visibleChannel: input.plan.visibleChannel,
        helperPosture: input.plan.helperPosture,
        activeWindowId: input.window?.windowId ?? null,
        activeOfferId: input.plan.selectedOffer.offerId,
        publicRisk01: input.plan.trigger.publicRisk01,
        recoverability01: input.plan.trigger.recoverability01,
        playerTilt01: 0.5 as never,
        embarrassment01: 0.5 as never,
        frustration01: 0.5 as never,
        trustOpportunity01: 0.5 as never,
        updatedAt: input.now,
      },
      signalSummary: [],
      confidenceScore: 90 as Score100,
      shouldInterruptScene: true,
      prefersSilence: false,
      silenceDecision: null,
      replacementScene: null,
    },
    decision: null,
    digest: {
      digestId: ('rescue-digest:manual' as never),
      updatedAt: input.now,
      activeRescueIds: [input.plan.rescueId],
      criticalRescueIds: input.plan.urgency === 'CRITICAL' ? [input.plan.rescueId] : [],
      shadowRescueIds: input.plan.channelStrategy === 'SHADOW_FIRST' ? [input.plan.rescueId] : [],
      acceptedRescueIds: [],
      strongestOutcome: input.plan.state,
      strongestUrgency: input.plan.urgency,
    },
    updatedStateSnapshot: null,
    activePlan: input.plan,
    activeRecovery: input.recovery,
    reasons: ['manual-open'],
  };
  (bridge as any).active = {
    plan: input.plan,
    recovery: input.recovery,
    window: input.window ?? null,
    projection: input.projection,
    openedAt: input.now,
    systemMessageIds: [],
  };
  const state = (bridge as any).applyOpen(clone(input.state), fakeResult, input.projection, input.now);
  return {
    state,
    rescueOpened: true,
    rescueClosed: false,
    viewModel: (bridge as any).toViewModel(state, (bridge as any).active),
    decision: null,
    reasons: ['manual-open'],
  };
}

export function projectAllRescueSurfaces(
  state: ChatEngineState,
  bridge: RescueBannerBridge,
): {
  readonly banner: RescueWindowPayload | null;
  readonly counterplay: CounterplayModalRescuePayload | null;
  readonly radar: ThreatRadarRescueHint | null;
  readonly diagnostics: RescueBridgeDiagnostics;
} {
  const active = (bridge as any).active as ActiveBridgeState | null;
  const diagnostics = buildRescueBridgeDiagnostics(state, active);
  if (!active) {
    return {
      banner: null,
      counterplay: null,
      radar: null,
      diagnostics,
    };
  }

  const viewModel = (bridge as any).toViewModel(state, active) as RescueBannerViewModel;
  return {
    banner: buildRescueWindowPayload(viewModel),
    counterplay: buildCounterplayModalRescuePayload(viewModel),
    radar: buildThreatRadarRescueHint(viewModel),
    diagnostics,
  };
}

export function closeRescueIfChannelChanged(
  bridge: RescueBannerBridge,
  state: ChatEngineState,
  nextChannel: ChatVisibleChannel,
  now: UnixMs,
): RescueBannerBridgeResult | null {
  const active = (bridge as any).active as ActiveBridgeState | null;
  if (!active) return null;
  if (active.plan.visibleChannel === nextChannel) return null;
  return bridge.dismiss(state, now, `channel-changed:${nextChannel}`);
}

export function refreshRescueRelationshipState(
  bridge: RescueBannerBridge,
  state: ChatEngineState,
  now: UnixMs,
): ChatEngineState {
  const active = (bridge as any).active as ActiveBridgeState | null;
  if (!active) return state;
  const relationship = helperRelationship(active.plan, now);
  if (!relationship) return state;
  const nextState = clone(state);
  upsertRelationshipInState(nextState as any, relationship);
  return nextState;
}

export function pinRescueChannelReadState(
  state: ChatEngineState,
  bridge: RescueBannerBridge,
  now: UnixMs,
): ChatEngineState {
  const active = (bridge as any).active as ActiveBridgeState | null;
  if (!active) return state;
  const nextState = clone(state);
  markChannelReadInState(nextState as any, active.plan.visibleChannel as never, now);
  return nextState;
}


// ============================================================================
// MARK: Rescue surface synchronizers and render-safe utilities
// ============================================================================

export interface RescueSurfaceSnapshot {
  readonly hasBanner: boolean;
  readonly hasCounterplayPayload: boolean;
  readonly hasRadarHint: boolean;
  readonly unreadCount: number;
  readonly notes: readonly string[];
}

export function snapshotRescueSurfaces(
  state: ChatEngineState,
  bridge: RescueBannerBridge,
): RescueSurfaceSnapshot {
  const surfaces = projectAllRescueSurfaces(state, bridge);
  return {
    hasBanner: Boolean(surfaces.banner),
    hasCounterplayPayload: Boolean(surfaces.counterplay),
    hasRadarHint: Boolean(surfaces.radar),
    unreadCount: surfaces.diagnostics.unreadCount,
    notes: surfaces.diagnostics.notes,
  };
}

export function reopenRescueComposer(
  state: ChatEngineState,
  bridge: RescueBannerBridge,
): ChatEngineState {
  const active = (bridge as any).active as ActiveBridgeState | null;
  if (!active) return state;
  const nextState = clone(state);
  setComposerDisabledInState(nextState as any, active.plan.visibleChannel as never, false);
  return nextState;
}

export function suppressCrowdForRescue(
  state: ChatEngineState,
  bridge: RescueBannerBridge,
): ChatEngineState {
  const active = (bridge as any).active as ActiveBridgeState | null;
  if (!active) return state;
  const nextState = clone(state);
  if (active.projection.suppressCrowd) {
    setAudienceHeatInState(nextState as any, {
      global01: 0.14 as never,
      syndicate01: 0.18 as never,
      dealRoom01: 0.12 as never,
      spectator01: 0.08 as never,
      updatedAt: Date.now() as UnixMs,
    } as any);
  }
  return nextState;
}


export function buildRescueBannerTranscriptPreview(viewModel: RescueBannerViewModel): readonly string[] {
  return [
    `[${viewModel.urgency}] ${viewModel.title}`,
    viewModel.body,
    viewModel.helperLine,
  ];
}

export function hasActiveCriticalRescue(bridge: RescueBannerBridge): boolean {
  const active = (bridge as any).active as ActiveBridgeState | null;
  return Boolean(active && active.plan.urgency === 'CRITICAL');
}

export function getActiveRescueChannel(bridge: RescueBannerBridge): ChatVisibleChannel | null {
  const active = (bridge as any).active as ActiveBridgeState | null;
  return active?.plan.visibleChannel ?? null;
}

export function countRescueQuickActions(viewModel: RescueBannerViewModel | null | undefined): number {
  return viewModel?.quickActions?.length ?? 0;
}
