/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT LIVEOPS CONTROL PLANE BARREL
 * FILE: backend/src/game/engine/chat/liveops/index.ts
 * VERSION: 2026.03.22-liveops-control-plane
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This barrel does more than re-export files. It exposes a true liveops control
 * plane over the scheduler and the faction surge planner so the rest of the
 * backend can mount one authoritative runtime and still access every deep helper
 * surface these files now carry.
 */

export * from './GlobalEventScheduler';
export * from './FactionSurgePlanner';

import type {
  GlobalEventSchedulerEvaluationContext,
  GlobalEventSchedulerManifest,
  GlobalEventSchedulerDetailedSnapshot,
  GlobalEventSchedulerRoomContext,
  GlobalEventProjection,
  GlobalEventRoomProjection,
  GlobalEventWindowPreview,
  GlobalEventDefinitionAudit,
  GlobalEventTimelineSlice,
  GlobalEventChannelLoad,
  GlobalEventFamilyLoad,
  GlobalEventLibraryDiff,
  PreviewWindowsInput,
} from './GlobalEventScheduler';

import {
  GlobalEventScheduler,
  GlobalEventSchedulerInspector,
  buildGlobalEventSchedulerManifest,
  buildRoomProjectionMatrix,
  computeChannelLoads,
  computeFamilyLoads,
  createGlobalEventScheduler,
  createGlobalEventSchedulerInspector,
  describeGlobalEventSchedulerState,
  evaluateGlobalEventSchedulerDetailed,
  previewLibraryWindows,
  summarizeGlobalEventChannelLoad,
  summarizeGlobalEventDefinitionAudit,
  summarizeGlobalEventFamilyLoad,
  summarizeGlobalEventProjection,
  summarizeGlobalEventRoomProjection,
  summarizeGlobalEventSchedulerDetailedSnapshot,
  summarizeGlobalEventWindowPreview,
} from './GlobalEventScheduler';

import type {
  FactionDescriptor,
  FactionPlanBatchResult,
  FactionRoomSignalProfile,
  FactionSurgePlan,
  FactionSurgePlanAudit,
  FactionSurgePlanSummary,
  FactionSurgePlannerOptions,
  FactionSurgeNarrativePacket,
} from './FactionSurgePlanner';

import {
  FactionSurgePlanner,
  buildFactionSurgeNarrativePacket,
  buildFactionSurgePlanAudit,
  createDefaultFactionDescriptors,
  createFactionSurgePlanner,
  planFactionSurge,
  summarizeFactionSurgePlan,
} from './FactionSurgePlanner';

export interface ChatLiveOpsControlPlaneOptions {
  readonly scheduler?: GlobalEventScheduler;
  readonly planner?: FactionSurgePlanner;
  readonly schedulerOptions?: ConstructorParameters<typeof GlobalEventScheduler>[0];
  readonly plannerOptions?: FactionSurgePlannerOptions;
}

export interface ChatLiveOpsControlPlaneEvaluation {
  readonly schedulerSnapshot: GlobalEventSchedulerDetailedSnapshot;
  readonly factionPlans: readonly FactionSurgePlan[];
  readonly factionPlanSummaries: readonly FactionSurgePlanSummary[];
  readonly factionPlanAudits: readonly FactionSurgePlanAudit[];
  readonly factionNarrativePackets: readonly FactionSurgeNarrativePacket[];
  readonly roomCoverage: readonly ChatLiveOpsRoomCoverage[];
  readonly runtimeHealth: ChatLiveOpsRuntimeHealth;
  readonly manifest: GlobalEventSchedulerManifest;
  readonly overview: ChatLiveOpsOverview;
}

export interface ChatLiveOpsRuntimeHealth {
  readonly band: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly activeEvents: number;
  readonly upcomingEvents: number;
  readonly rooms: number;
  readonly factionPlans: number;
  readonly schedulerPressure: number;
  readonly factionPressure: number;
  readonly notes: readonly string[];
}

export interface ChatLiveOpsRoomCoverage {
  readonly roomId: string;
  readonly mode: string | null;
  readonly activeEventIds: readonly string[];
  readonly upcomingEventIds: readonly string[];
  readonly projectedChannels: readonly string[];
  readonly roomProjectionCount: number;
  readonly factionPlanCount: number;
  readonly pressureWeight: number;
  readonly notes: readonly string[];
}

export interface ChatLiveOpsOverview {
  readonly summaryLines: readonly string[];
  readonly topEvents: readonly string[];
  readonly topRooms: readonly string[];
  readonly channelHeat: readonly string[];
  readonly familyHeat: readonly string[];
}

export interface ChatLiveOpsManifestDiff {
  readonly schedulerDiff: GlobalEventLibraryDiff;
  readonly manifestBefore: GlobalEventSchedulerManifest;
  readonly manifestAfter: GlobalEventSchedulerManifest;
}

export interface ChatLiveOpsPresetRuntime {
  readonly id: string;
  readonly displayName: string;
  readonly controlPlane: ChatLiveOpsControlPlane;
}

export class ChatLiveOpsControlPlane {
  private readonly scheduler: GlobalEventScheduler;
  private readonly planner: FactionSurgePlanner;
  private readonly inspector: GlobalEventSchedulerInspector;

  public constructor(options: ChatLiveOpsControlPlaneOptions = {}) {
    this.scheduler =
      options.scheduler ??
      createGlobalEventScheduler(options.schedulerOptions ?? {});
    this.planner =
      options.planner ??
      createFactionSurgePlanner(options.plannerOptions ?? {});
    this.inspector = createGlobalEventSchedulerInspector(this.scheduler);
  }

  public getScheduler(): GlobalEventScheduler {
    return this.scheduler;
  }

  public getPlanner(): FactionSurgePlanner {
    return this.planner;
  }

  public getInspector(): GlobalEventSchedulerInspector {
    return this.inspector;
  }

  public evaluate(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): ChatLiveOpsControlPlaneEvaluation {
    const schedulerSnapshot = this.inspector.snapshotDetailed(context);
    const factionPlans = this.planRooms(
      context.rooms ?? [],
      schedulerSnapshot.activeProjections,
    );
    const factionPlanSummaries = factionPlans.map((plan) => summarizeFactionSurgePlan(plan));
    const factionPlanAudits = factionPlans.map((plan) => buildFactionSurgePlanAudit(plan));
    const factionNarrativePackets = factionPlans.map((plan) => buildFactionSurgeNarrativePacket(plan));
    const roomCoverage = buildChatLiveOpsRoomCoverage(
      context.rooms ?? [],
      schedulerSnapshot.roomProjections,
      factionPlans,
      schedulerSnapshot.activeProjections,
      schedulerSnapshot.upcomingProjections,
    );
    const runtimeHealth = buildChatLiveOpsRuntimeHealth(
      schedulerSnapshot,
      factionPlans,
      roomCoverage,
    );
    const manifest = buildGlobalEventSchedulerManifest(
      this.scheduler.serialize(),
      schedulerSnapshot.evaluatedAt,
    );
    const overview = buildChatLiveOpsOverview(
      schedulerSnapshot,
      factionPlans,
      roomCoverage,
    );

    return Object.freeze({
      schedulerSnapshot,
      factionPlans,
      factionPlanSummaries,
      factionPlanAudits,
      factionNarrativePackets,
      roomCoverage,
      runtimeHealth,
      manifest,
      overview,
    });
  }

  public evaluateSchedulerOnly(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): GlobalEventSchedulerDetailedSnapshot {
    return evaluateGlobalEventSchedulerDetailed(this.scheduler, context);
  }

  public planRooms(
    rooms: readonly GlobalEventSchedulerRoomContext[],
    activeProjections: readonly GlobalEventProjection[],
  ): readonly FactionSurgePlan[] {
    return rooms
      .map((room) => this.planner.plan(room, activeProjections))
      .sort((left, right) => right.summary.witnessPressureDelta + right.pressureBiasDelta - (left.summary.witnessPressureDelta + left.pressureBiasDelta));
  }

  public previewWindows(
    input: PreviewWindowsInput = {},
  ): readonly GlobalEventWindowPreview[] {
    return this.inspector.previewLibraryWindows(input);
  }

  public manifest(): GlobalEventSchedulerManifest {
    return this.inspector.buildManifest();
  }

  public diffAgainstManifest(
    before: GlobalEventSchedulerManifest,
  ): ChatLiveOpsManifestDiff {
    const after = this.inspector.buildManifest();
    return Object.freeze({
      schedulerDiff: this.inspector.diffManifest(before),
      manifestBefore: before,
      manifestAfter: after,
    });
  }

  public auditDefinitions(): readonly GlobalEventDefinitionAudit[] {
    return this.inspector.auditLibrary();
  }

  public summarize(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): ChatLiveOpsOverview {
    return this.evaluate(context).overview;
  }

  public describeState(): ReturnType<typeof describeGlobalEventSchedulerState> {
    return describeGlobalEventSchedulerState(this.scheduler.serialize());
  }

  public createPreset(
    id: string,
    displayName: string,
  ): ChatLiveOpsPresetRuntime {
    return Object.freeze({
      id,
      displayName,
      controlPlane: this,
    });
  }
}

export function createChatLiveOpsControlPlane(
  options: ChatLiveOpsControlPlaneOptions = {},
): ChatLiveOpsControlPlane {
  return new ChatLiveOpsControlPlane(options);
}

export function evaluateChatLiveOpsControlPlane(
  controlPlane: ChatLiveOpsControlPlane,
  context: GlobalEventSchedulerEvaluationContext = {},
): ChatLiveOpsControlPlaneEvaluation {
  return controlPlane.evaluate(context);
}

export function buildChatLiveOpsRuntimeHealth(
  schedulerSnapshot: GlobalEventSchedulerDetailedSnapshot,
  factionPlans: readonly FactionSurgePlan[],
  roomCoverage: readonly ChatLiveOpsRoomCoverage[],
): ChatLiveOpsRuntimeHealth {
  const schedulerPressure = schedulerSnapshot.detailedDiagnostics.totalProjectedPressure;
  const factionPressure = Math.round(
    factionPlans.reduce((sum, plan) => sum + plan.summary.witnessPressureDelta + plan.pressureBiasDelta + plan.publicnessBiasDelta + plan.shadowPressureDelta, 0) * 100,
  ) / 100;
  const total = schedulerPressure + factionPressure;

  const band =
    total >= 1200
      ? 'CRITICAL'
      : total >= 700
        ? 'HIGH'
        : total >= 280
          ? 'MEDIUM'
          : 'LOW';

  const notes = [
    `schedulerPressure=${schedulerPressure}`,
    `factionPressure=${factionPressure}`,
    `roomCoverage=${roomCoverage.length}`,
    `health=${band}`,
  ] as const;

  return Object.freeze({
    band,
    activeEvents: schedulerSnapshot.activeProjections.length,
    upcomingEvents: schedulerSnapshot.upcomingProjections.length,
    rooms: schedulerSnapshot.roomMatrix.length,
    factionPlans: factionPlans.length,
    schedulerPressure,
    factionPressure,
    notes,
  });
}

export function buildChatLiveOpsRoomCoverage(
  rooms: readonly GlobalEventSchedulerRoomContext[],
  roomProjections: readonly GlobalEventRoomProjection[],
  factionPlans: readonly FactionSurgePlan[],
  activeProjections: readonly GlobalEventProjection[],
  upcomingProjections: readonly GlobalEventProjection[],
): readonly ChatLiveOpsRoomCoverage[] {
  return rooms.map((room) => {
    const roomProjectionList = roomProjections.filter((projection) => projection.roomId === room.roomId);
    const factionPlanList = factionPlans.filter((plan) => plan.roomId === room.roomId);
    const activeEventIds = Array.from(
      new Set(
        activeProjections
          .filter((projection) => roomProjectionList.some((item) => item.activationId === projection.activationId))
          .map((projection) => projection.eventId),
      ),
    );
    const upcomingEventIds = Array.from(
      new Set(
        upcomingProjections
          .filter((projection) => roomProjectionList.some((item) => item.activationId === projection.activationId))
          .map((projection) => projection.eventId),
      ),
    );
    const projectedChannels = Array.from(
      new Set(roomProjectionList.flatMap((projection) => [...projection.preferredChannels])),
    );
    const pressureWeight = Math.round(
      (
        roomProjectionList.reduce((sum, projection) => sum + projection.pressureWeight, 0) +
        factionPlanList.reduce((sum, plan) => sum + plan.summary.witnessPressureDelta + plan.pressureBiasDelta + plan.publicnessBiasDelta + plan.shadowPressureDelta, 0)
      ) * 100,
    ) / 100;

    const notes = [
      ...(room.crowdHeat ?? 0) > 6 ? ['CROWD_HEATED'] : [],
      ...(room.panicLevel ?? 0) > 6 ? ['PANIC_ELEVATED'] : [],
      ...(factionPlanList.length === 0 ? ['NO_FACTION_SURGE'] : ['FACTION_SURGE_PRESENT']),
    ];

    return Object.freeze({
      roomId: room.roomId,
      mode: room.mode ?? null,
      activeEventIds,
      upcomingEventIds,
      projectedChannels,
      roomProjectionCount: roomProjectionList.length,
      factionPlanCount: factionPlanList.length,
      pressureWeight,
      notes,
    });
  });
}

export function buildChatLiveOpsOverview(
  schedulerSnapshot: GlobalEventSchedulerDetailedSnapshot,
  factionPlans: readonly FactionSurgePlan[],
  roomCoverage: readonly ChatLiveOpsRoomCoverage[],
): ChatLiveOpsOverview {
  const topEvents = schedulerSnapshot.activeProjections
    .slice()
    .sort((left, right) => right.timeRemainingMs - left.timeRemainingMs)
    .slice(0, 8)
    .map((projection) => summarizeGlobalEventProjection(projection));

  const topRooms = roomCoverage
    .slice()
    .sort((left, right) => right.pressureWeight - left.pressureWeight)
    .slice(0, 8)
    .map((room) => `${room.roomId}::${room.pressureWeight}`);

  const channelHeat = schedulerSnapshot.detailedDiagnostics.channelLoads.map((load) =>
    summarizeGlobalEventChannelLoad(load),
  );

  const familyHeat = schedulerSnapshot.detailedDiagnostics.familyLoads.map((load) =>
    summarizeGlobalEventFamilyLoad(load),
  );

  const summaryLines = summarizeGlobalEventSchedulerDetailedSnapshot(schedulerSnapshot);

  return Object.freeze({
    summaryLines,
    topEvents,
    topRooms,
    channelHeat,
    familyHeat,
  });
}

export function createDefaultChatLiveOpsControlPlane(): ChatLiveOpsControlPlane {
  return createChatLiveOpsControlPlane({
    plannerOptions: {
      factions: createDefaultFactionDescriptors(),
    },
  });
}

export function createEmpireChatLiveOpsControlPlane(): ChatLiveOpsControlPlane {
  return createDefaultChatLiveOpsControlPlane();
}

export function createPredatorChatLiveOpsControlPlane(): ChatLiveOpsControlPlane {
  return createDefaultChatLiveOpsControlPlane();
}

export function createSyndicateChatLiveOpsControlPlane(): ChatLiveOpsControlPlane {
  return createDefaultChatLiveOpsControlPlane();
}

export function createPhantomChatLiveOpsControlPlane(): ChatLiveOpsControlPlane {
  return createDefaultChatLiveOpsControlPlane();
}

export function createLobbyChatLiveOpsControlPlane(): ChatLiveOpsControlPlane {
  return createDefaultChatLiveOpsControlPlane();
}

export function createPostRunChatLiveOpsControlPlane(): ChatLiveOpsControlPlane {
  return createDefaultChatLiveOpsControlPlane();
}

export function summarizeChatLiveOpsOverview(
  overview: ChatLiveOpsOverview,
): readonly string[] {
  return Object.freeze([
    ...overview.summaryLines,
    ...overview.topEvents.slice(0, 3),
    ...overview.topRooms.slice(0, 3),
  ]);
}

export function summarizeChatLiveOpsControlPlaneEvaluation(
  evaluation: ChatLiveOpsControlPlaneEvaluation,
): readonly string[] {
  return Object.freeze([
    `health=${evaluation.runtimeHealth.band}`,
    `activeEvents=${evaluation.runtimeHealth.activeEvents}`,
    `upcomingEvents=${evaluation.runtimeHealth.upcomingEvents}`,
    `rooms=${evaluation.runtimeHealth.rooms}`,
    `factionPlans=${evaluation.runtimeHealth.factionPlans}`,
  ]);
}

export function summarizeChatLiveOpsManifest(
  manifest: GlobalEventSchedulerManifest,
): readonly string[] {
  return Object.freeze([
    `version=${manifest.version}`,
    `definitions=${manifest.definitionIds.length}`,
    `activations=${manifest.activationIds.length}`,
    `cancelled=${manifest.cancelledActivationIds.length}`,
    `families=${manifest.families.join(',')}`,
  ]);
}

export function summarizeChatLiveOpsManifestDiff(
  diff: ChatLiveOpsManifestDiff,
): readonly string[] {
  return Object.freeze([
    `added=${diff.schedulerDiff.added.length}`,
    `removed=${diff.schedulerDiff.removed.length}`,
    `changed=${diff.schedulerDiff.changed.length}`,
    `before=${diff.manifestBefore.definitionIds.length}`,
    `after=${diff.manifestAfter.definitionIds.length}`,
  ]);
}

export function listChatLiveOpsHelperSurface(): readonly string[] {
  return Object.freeze([
    'createChatLiveOpsControlPlane',
    'evaluateChatLiveOpsControlPlane',
    'buildChatLiveOpsRuntimeHealth',
    'buildChatLiveOpsRoomCoverage',
    'buildChatLiveOpsOverview',
    'summarizeChatLiveOpsOverview',
    'summarizeChatLiveOpsControlPlaneEvaluation',
    'summarizeChatLiveOpsManifest',
    'summarizeChatLiveOpsManifestDiff',
    'createDefaultChatLiveOpsControlPlane',
    'createEmpireChatLiveOpsControlPlane',
    'createPredatorChatLiveOpsControlPlane',
    'createSyndicateChatLiveOpsControlPlane',
    'createPhantomChatLiveOpsControlPlane',
    'createLobbyChatLiveOpsControlPlane',
    'createPostRunChatLiveOpsControlPlane',
  ]);
}

export function buildChatLiveOpsHelperRegistry(): Readonly<Record<string, string>> {
  return Object.freeze({
    createChatLiveOpsControlPlane: 'Factory for the authoritative liveops control plane.',
    evaluateChatLiveOpsControlPlane: 'Runs scheduler + planner evaluation in one step.',
    buildChatLiveOpsRuntimeHealth: 'Builds runtime health summary from scheduler and faction plans.',
    buildChatLiveOpsRoomCoverage: 'Builds per-room coverage rows for active liveops state.',
    buildChatLiveOpsOverview: 'Builds the executive overview packet.',
    summarizeChatLiveOpsOverview: 'Produces short readable overview strings.',
    summarizeChatLiveOpsControlPlaneEvaluation: 'Produces short readable runtime lines.',
    summarizeChatLiveOpsManifest: 'Produces short readable manifest lines.',
    summarizeChatLiveOpsManifestDiff: 'Produces short readable manifest diff lines.',
  });
}

export function buildChatLiveOpsDiagnosticsPacket(
  controlPlane: ChatLiveOpsControlPlane,
  context: GlobalEventSchedulerEvaluationContext = {},
): {
  readonly evaluation: ChatLiveOpsControlPlaneEvaluation;
  readonly state: ReturnType<ChatLiveOpsControlPlane['describeState']>;
  readonly helperSurface: readonly string[];
  readonly helperRegistry: Readonly<Record<string, string>>;
} {
  const evaluation = controlPlane.evaluate(context);
  return Object.freeze({
    evaluation,
    state: controlPlane.describeState(),
    helperSurface: listChatLiveOpsHelperSurface(),
    helperRegistry: buildChatLiveOpsHelperRegistry(),
  });
}
