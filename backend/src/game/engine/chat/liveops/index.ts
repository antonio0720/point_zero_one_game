/* eslint-disable max-lines */
/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT LIVEOPS SOVEREIGN CONTROL PLANE BARREL
 * FILE: backend/src/game/engine/chat/liveops/index.ts
 * VERSION: 2026.03.22-liveops-omnibus-control-plane
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 */

export * from "./GlobalEventScheduler";
export * from "./FactionSurgePlanner";
export * from "./WorldEventDirector";

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
} from "./GlobalEventScheduler";

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
} from "./GlobalEventScheduler";

import type {
  FactionDescriptor,
  FactionPlanBatchResult,
  FactionRoomSignalProfile,
  FactionSurgePlan,
  FactionSurgePlanAudit,
  FactionSurgePlanSummary,
  FactionSurgePlannerOptions,
  FactionSurgeNarrativePacket,
} from "./FactionSurgePlanner";

import {
  FactionSurgePlanner,
  buildFactionSurgeNarrativePacket,
  buildFactionSurgePlanAudit,
  createDefaultFactionDescriptors,
  createFactionSurgePlanner,
  planFactionSurge,
  summarizeFactionSurgePlan,
} from "./FactionSurgePlanner";

import type {
  WorldEventDirectorOptions,
  WorldEventDirectorTickResult,
  WorldEventDirectorDetailedTickResult,
  WorldEventDirectorManifest,
  WorldEventDirectorLibraryDiff,
  WorldEventDirectorBatchResult,
  WorldEventRoomPlan,
  WorldEventRoomPlanDetailed,
  WorldEventAnnouncementDigest,
  WorldEventShadowDigest,
  WorldEventVisibleChannelDigest,
  WorldEventPlanDigest,
  WorldEventNarrativeScorecard,
  WorldEventRoomPlanMatrixRow,
} from "./WorldEventDirector";

import {
  WorldEventDirector,
  WorldEventDirectorInspector,
  createWorldEventDirector,
  createWorldEventDirectorInspector,
  summarizeWorldEventAnnouncementDirective,
  summarizeWorldEventShadowDirective,
  summarizeWorldEventVisibleChannelDirective,
  summarizeWorldEventRoomPlan,
  scoreWorldEventNarrativePacket,
  listWorldEventAnnouncementDigests,
  listWorldEventShadowDigests,
  listWorldEventVisibleChannelDigests,
  listWorldEventPlanDigests,
  listWorldEventNarrativeScorecards,
  collectWorldEventRoomIds,
  collectWorldEventPrimaryFactionIds,
  collectWorldEventActiveEventIds,
  collectWorldEventActivationIds,
  collectWorldEventDominantChannels,
  countWorldEventPressureBands,
  countWorldEventAnnouncementStyles,
  countWorldEventVisibleDisposition,
  countWorldEventShadowDisposition,
  buildWorldEventPressureRanking,
  buildWorldEventAnnouncementRanking,
  buildWorldEventShadowRanking,
  buildWorldEventVisibleChannelRanking,
  collectWorldEventTags,
  buildWorldEventNarrativeHeadlines,
  buildWorldEventSummaryLedger,
  buildWorldEventModeHistogram,
  buildWorldEventFactionHistogram,
  buildWorldEventClimateHistogram,
  buildWorldEventAnnouncementStyleHistogram,
  buildWorldEventDigestStrings,
  buildWorldEventNarrativeDigestStrings,
} from "./WorldEventDirector";

export type ChatLiveOpsModePresetId =
  | "DEFAULT"
  | "EMPIRE"
  | "PREDATOR"
  | "SYNDICATE"
  | "PHANTOM"
  | "LOBBY"
  | "POST_RUN";
export type ChatLiveOpsSchedulerContext = GlobalEventSchedulerEvaluationContext;
export type ChatLiveOpsSchedulerManifest = GlobalEventSchedulerManifest;
export type ChatLiveOpsSchedulerSnapshot = GlobalEventSchedulerDetailedSnapshot;
export type ChatLiveOpsSchedulerRoom = GlobalEventSchedulerRoomContext;
export type ChatLiveOpsSchedulerProjection = GlobalEventProjection;
export type ChatLiveOpsSchedulerRoomProjection = GlobalEventRoomProjection;
export type ChatLiveOpsSchedulerPreview = GlobalEventWindowPreview;
export type ChatLiveOpsSchedulerAudit = GlobalEventDefinitionAudit;
export type ChatLiveOpsSchedulerTimelineSlice = GlobalEventTimelineSlice;
export type ChatLiveOpsSchedulerChannelLoad = GlobalEventChannelLoad;
export type ChatLiveOpsSchedulerFamilyLoad = GlobalEventFamilyLoad;
export type ChatLiveOpsSchedulerLibraryDiff = GlobalEventLibraryDiff;
export type ChatLiveOpsPreviewInput = PreviewWindowsInput;
export type ChatLiveOpsFactionDescriptor = FactionDescriptor;
export type ChatLiveOpsFactionBatch = FactionPlanBatchResult;
export type ChatLiveOpsFactionSignalProfile = FactionRoomSignalProfile;
export type ChatLiveOpsFactionPlan = FactionSurgePlan;
export type ChatLiveOpsFactionPlanAudit = FactionSurgePlanAudit;
export type ChatLiveOpsFactionPlanSummary = FactionSurgePlanSummary;
export type ChatLiveOpsFactionNarrativePacket = FactionSurgeNarrativePacket;
export type ChatLiveOpsWorldOptions = WorldEventDirectorOptions;
export type ChatLiveOpsWorldTick = WorldEventDirectorTickResult;
export type ChatLiveOpsWorldTickDetailed = WorldEventDirectorDetailedTickResult;
export type ChatLiveOpsWorldManifest = WorldEventDirectorManifest;
export type ChatLiveOpsWorldLibraryDiff = WorldEventDirectorLibraryDiff;
export type ChatLiveOpsWorldBatch = WorldEventDirectorBatchResult;
export type ChatLiveOpsWorldRoomPlan = WorldEventRoomPlan;
export type ChatLiveOpsWorldRoomPlanDetailed = WorldEventRoomPlanDetailed;
export type ChatLiveOpsWorldAnnouncementDigest = WorldEventAnnouncementDigest;
export type ChatLiveOpsWorldShadowDigest = WorldEventShadowDigest;
export type ChatLiveOpsWorldVisibleChannelDigest =
  WorldEventVisibleChannelDigest;
export type ChatLiveOpsWorldPlanDigest = WorldEventPlanDigest;
export type ChatLiveOpsWorldNarrativeScorecard = WorldEventNarrativeScorecard;
export type ChatLiveOpsWorldRoomPlanMatrixRow = WorldEventRoomPlanMatrixRow;

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}
function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}
function uniqueStrings(values: readonly string[]): readonly string[] {
  const s = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!s.has(v)) {
      s.add(v);
      out.push(v);
    }
  }
  return freezeArray(out);
}
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
function indexActiveEventsByRoom(
  rooms: readonly GlobalEventSchedulerRoomContext[],
  roomProjections: readonly GlobalEventRoomProjection[],
  activeProjections: readonly GlobalEventProjection[],
): Readonly<Record<string, readonly GlobalEventProjection[]>> {
  const index: Record<string, readonly GlobalEventProjection[]> = {};
  for (const room of rooms) {
    const activationIds = new Set(
      roomProjections
        .filter((projection) => projection.roomId === room.roomId)
        .map((projection) => projection.activationId),
    );
    index[room.roomId] = freezeArray(
      activeProjections.filter((projection) =>
        activationIds.has(projection.activationId),
      ),
    );
  }
  return freeze(index);
}
function mapPlansByRoomId<T extends { readonly roomId: string }>(
  plans: readonly T[],
): Readonly<Record<string, T>> {
  const output: Record<string, T> = {};
  for (const plan of plans) {
    output[plan.roomId] = plan;
  }
  return freeze(output);
}

export interface ChatLiveOpsHelperDescriptor<
  Name extends string = string,
  Ref = unknown,
> {
  readonly name: Name;
  readonly family: "scheduler" | "planner" | "director" | "control-plane";
  readonly description: string;
  readonly ref: Ref;
  readonly tags: readonly string[];
}
export interface ChatLiveOpsSurfaceSummary {
  readonly helperNames: readonly string[];
  readonly helperCount: number;
  readonly schedulerHelperCount: number;
  readonly plannerHelperCount: number;
  readonly directorHelperCount: number;
}
export interface ChatLiveOpsSchedulerSurfacePacket {
  readonly manifest: GlobalEventSchedulerManifest;
  readonly snapshot: GlobalEventSchedulerDetailedSnapshot;
  readonly stateDescription: ReturnType<
    typeof describeGlobalEventSchedulerState
  >;
  readonly roomMatrix: ReturnType<typeof buildRoomProjectionMatrix>;
  readonly roomProjections: readonly GlobalEventRoomProjection[];
  readonly previews: readonly GlobalEventWindowPreview[];
  readonly audits: readonly GlobalEventDefinitionAudit[];
  readonly timeline: readonly GlobalEventTimelineSlice[];
  readonly channelLoads: readonly GlobalEventChannelLoad[];
  readonly familyLoads: readonly GlobalEventFamilyLoad[];
  readonly summaryLines: readonly string[];
  readonly projectionSummaryLines: readonly string[];
  readonly roomProjectionSummaryLines: readonly string[];
  readonly previewSummaryLines: readonly string[];
  readonly auditSummaryLines: readonly string[];
  readonly channelLoadSummaryLines: readonly string[];
  readonly familyLoadSummaryLines: readonly string[];
}
export interface ChatLiveOpsPlannerSurfacePacket {
  readonly descriptors: readonly FactionDescriptor[];
  readonly plans: readonly FactionSurgePlan[];
  readonly planSummaries: readonly FactionSurgePlanSummary[];
  readonly planAudits: readonly FactionSurgePlanAudit[];
  readonly narrativePackets: readonly FactionSurgeNarrativePacket[];
  readonly batch: FactionPlanBatchResult;
  readonly planIndexByRoomId: Readonly<Record<string, FactionSurgePlan>>;
  readonly summaryLines: readonly string[];
  readonly roomSignalProfilesByRoomId: Readonly<
    Record<string, FactionRoomSignalProfile | null>
  >;
}
export interface ChatLiveOpsWorldSurfacePacket {
  readonly tick: WorldEventDirectorTickResult;
  readonly detailed: WorldEventDirectorDetailedTickResult;
  readonly manifest: WorldEventDirectorManifest;
  readonly libraryDiff: WorldEventDirectorLibraryDiff | null;
  readonly roomPlanMatrix: readonly WorldEventRoomPlanMatrixRow[];
  readonly planDigests: readonly WorldEventPlanDigest[];
  readonly announcementDigests: readonly WorldEventAnnouncementDigest[];
  readonly shadowDigests: readonly WorldEventShadowDigest[];
  readonly visibleChannelDigests: readonly WorldEventVisibleChannelDigest[];
  readonly narrativeScorecards: readonly WorldEventNarrativeScorecard[];
  readonly roomIds: readonly string[];
  readonly primaryFactionIds: readonly string[];
  readonly activeEventIds: readonly string[];
  readonly activationIds: readonly string[];
  readonly dominantChannels: readonly string[];
  readonly pressureBands: Readonly<Record<string, number>>;
  readonly announcementStyles: Readonly<Record<string, number>>;
  readonly visibleDisposition: Readonly<Record<string, number>>;
  readonly shadowDisposition: Readonly<Record<string, number>>;
  readonly pressureRanking: readonly WorldEventPlanDigest[];
  readonly announcementRanking: readonly WorldEventAnnouncementDigest[];
  readonly shadowRanking: readonly WorldEventShadowDigest[];
  readonly visibleChannelRanking: readonly WorldEventVisibleChannelDigest[];
  readonly tags: readonly string[];
  readonly headlines: readonly string[];
  readonly summaryLedger: readonly string[];
  readonly modeHistogram: Readonly<Record<string, number>>;
  readonly factionHistogram: Readonly<Record<string, number>>;
  readonly climateHistogram: Readonly<Record<string, number>>;
  readonly announcementStyleHistogram: Readonly<Record<string, number>>;
  readonly digestStrings: readonly string[];
  readonly narrativeDigestStrings: readonly string[];
  readonly planSummaryLines: readonly string[];
}
export interface ChatLiveOpsRuntimeHealth {
  readonly band: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly activeEvents: number;
  readonly upcomingEvents: number;
  readonly rooms: number;
  readonly factionPlans: number;
  readonly visibleAnnouncements: number;
  readonly shadowDirectives: number;
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
  readonly dominantChannels: readonly string[];
  readonly roomProjectionCount: number;
  readonly factionPlanCount: number;
  readonly visibleAnnouncementCount: number;
  readonly shadowDirectiveCount: number;
  readonly pressureWeight: number;
  readonly notes: readonly string[];
}
export interface ChatLiveOpsOverview {
  readonly summaryLines: readonly string[];
  readonly topEvents: readonly string[];
  readonly topRooms: readonly string[];
  readonly channelHeat: readonly string[];
  readonly familyHeat: readonly string[];
  readonly worldNarrative: readonly string[];
  readonly plannerNarrative: readonly string[];
}
export interface ChatLiveOpsManifestDiff {
  readonly schedulerDiff: GlobalEventLibraryDiff;
  readonly schedulerManifestBefore: GlobalEventSchedulerManifest;
  readonly schedulerManifestAfter: GlobalEventSchedulerManifest;
  readonly worldManifestBefore: WorldEventDirectorManifest;
  readonly worldManifestAfter: WorldEventDirectorManifest;
  readonly worldLibraryDiff: WorldEventDirectorLibraryDiff;
}
export interface ChatLiveOpsEvaluation {
  readonly scheduler: ChatLiveOpsSchedulerSurfacePacket;
  readonly planner: ChatLiveOpsPlannerSurfacePacket;
  readonly world: ChatLiveOpsWorldSurfacePacket;
  readonly roomCoverage: readonly ChatLiveOpsRoomCoverage[];
  readonly runtimeHealth: ChatLiveOpsRuntimeHealth;
  readonly overview: ChatLiveOpsOverview;
  readonly surfaceSummary: ChatLiveOpsSurfaceSummary;
}
export interface ChatLiveOpsDiagnosticsPacket {
  readonly evaluation: ChatLiveOpsEvaluation;
  readonly schedulerState: ReturnType<
    ChatLiveOpsControlPlane["describeSchedulerState"]
  >;
  readonly schedulerHelpers: readonly ChatLiveOpsHelperDescriptor[];
  readonly plannerHelpers: readonly ChatLiveOpsHelperDescriptor[];
  readonly directorHelpers: readonly ChatLiveOpsHelperDescriptor[];
  readonly controlPlaneHelpers: readonly ChatLiveOpsHelperDescriptor[];
  readonly helperRegistry: Readonly<Record<string, string>>;
}
export interface ChatLiveOpsPresetRuntime {
  readonly id: ChatLiveOpsModePresetId;
  readonly displayName: string;
  readonly controlPlane: ChatLiveOpsControlPlane;
}
export interface ChatLiveOpsControlPlaneOptions {
  readonly scheduler?: GlobalEventScheduler;
  readonly planner?: FactionSurgePlanner;
  readonly director?: WorldEventDirector;
  readonly schedulerOptions?: ConstructorParameters<
    typeof GlobalEventScheduler
  >[0];
  readonly plannerOptions?: FactionSurgePlannerOptions;
  readonly directorOptions?: WorldEventDirectorOptions;
}

export const CHAT_LIVEOPS_SCHEDULER_HELPERS = freezeArray([
  freeze({
    name: "GlobalEventScheduler",
    family: "scheduler" as const,
    description:
      "GlobalEventScheduler helper surfaced through the liveops barrel.",
    ref: GlobalEventScheduler,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "GlobalEventSchedulerInspector",
    family: "scheduler" as const,
    description:
      "GlobalEventSchedulerInspector helper surfaced through the liveops barrel.",
    ref: GlobalEventSchedulerInspector,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildGlobalEventSchedulerManifest",
    family: "scheduler" as const,
    description:
      "buildGlobalEventSchedulerManifest helper surfaced through the liveops barrel.",
    ref: buildGlobalEventSchedulerManifest,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildRoomProjectionMatrix",
    family: "scheduler" as const,
    description:
      "buildRoomProjectionMatrix helper surfaced through the liveops barrel.",
    ref: buildRoomProjectionMatrix,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "computeChannelLoads",
    family: "scheduler" as const,
    description:
      "computeChannelLoads helper surfaced through the liveops barrel.",
    ref: computeChannelLoads,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "computeFamilyLoads",
    family: "scheduler" as const,
    description:
      "computeFamilyLoads helper surfaced through the liveops barrel.",
    ref: computeFamilyLoads,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "createGlobalEventScheduler",
    family: "scheduler" as const,
    description:
      "createGlobalEventScheduler helper surfaced through the liveops barrel.",
    ref: createGlobalEventScheduler,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "createGlobalEventSchedulerInspector",
    family: "scheduler" as const,
    description:
      "createGlobalEventSchedulerInspector helper surfaced through the liveops barrel.",
    ref: createGlobalEventSchedulerInspector,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "describeGlobalEventSchedulerState",
    family: "scheduler" as const,
    description:
      "describeGlobalEventSchedulerState helper surfaced through the liveops barrel.",
    ref: describeGlobalEventSchedulerState,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "evaluateGlobalEventSchedulerDetailed",
    family: "scheduler" as const,
    description:
      "evaluateGlobalEventSchedulerDetailed helper surfaced through the liveops barrel.",
    ref: evaluateGlobalEventSchedulerDetailed,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "previewLibraryWindows",
    family: "scheduler" as const,
    description:
      "previewLibraryWindows helper surfaced through the liveops barrel.",
    ref: previewLibraryWindows,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "summarizeGlobalEventChannelLoad",
    family: "scheduler" as const,
    description:
      "summarizeGlobalEventChannelLoad helper surfaced through the liveops barrel.",
    ref: summarizeGlobalEventChannelLoad,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "summarizeGlobalEventDefinitionAudit",
    family: "scheduler" as const,
    description:
      "summarizeGlobalEventDefinitionAudit helper surfaced through the liveops barrel.",
    ref: summarizeGlobalEventDefinitionAudit,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "summarizeGlobalEventFamilyLoad",
    family: "scheduler" as const,
    description:
      "summarizeGlobalEventFamilyLoad helper surfaced through the liveops barrel.",
    ref: summarizeGlobalEventFamilyLoad,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "summarizeGlobalEventProjection",
    family: "scheduler" as const,
    description:
      "summarizeGlobalEventProjection helper surfaced through the liveops barrel.",
    ref: summarizeGlobalEventProjection,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "summarizeGlobalEventRoomProjection",
    family: "scheduler" as const,
    description:
      "summarizeGlobalEventRoomProjection helper surfaced through the liveops barrel.",
    ref: summarizeGlobalEventRoomProjection,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "summarizeGlobalEventSchedulerDetailedSnapshot",
    family: "scheduler" as const,
    description:
      "summarizeGlobalEventSchedulerDetailedSnapshot helper surfaced through the liveops barrel.",
    ref: summarizeGlobalEventSchedulerDetailedSnapshot,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
  freeze({
    name: "summarizeGlobalEventWindowPreview",
    family: "scheduler" as const,
    description:
      "summarizeGlobalEventWindowPreview helper surfaced through the liveops barrel.",
    ref: summarizeGlobalEventWindowPreview,
    tags: freezeArray(["scheduler", "liveops", "barrel"]),
  }),
]);

export const CHAT_LIVEOPS_PLANNER_HELPERS = freezeArray([
  freeze({
    name: "FactionSurgePlanner",
    family: "planner" as const,
    description:
      "FactionSurgePlanner helper surfaced through the liveops barrel.",
    ref: FactionSurgePlanner,
    tags: freezeArray(["planner", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildFactionSurgeNarrativePacket",
    family: "planner" as const,
    description:
      "buildFactionSurgeNarrativePacket helper surfaced through the liveops barrel.",
    ref: buildFactionSurgeNarrativePacket,
    tags: freezeArray(["planner", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildFactionSurgePlanAudit",
    family: "planner" as const,
    description:
      "buildFactionSurgePlanAudit helper surfaced through the liveops barrel.",
    ref: buildFactionSurgePlanAudit,
    tags: freezeArray(["planner", "liveops", "barrel"]),
  }),
  freeze({
    name: "createDefaultFactionDescriptors",
    family: "planner" as const,
    description:
      "createDefaultFactionDescriptors helper surfaced through the liveops barrel.",
    ref: createDefaultFactionDescriptors,
    tags: freezeArray(["planner", "liveops", "barrel"]),
  }),
  freeze({
    name: "createFactionSurgePlanner",
    family: "planner" as const,
    description:
      "createFactionSurgePlanner helper surfaced through the liveops barrel.",
    ref: createFactionSurgePlanner,
    tags: freezeArray(["planner", "liveops", "barrel"]),
  }),
  freeze({
    name: "planFactionSurge",
    family: "planner" as const,
    description: "planFactionSurge helper surfaced through the liveops barrel.",
    ref: planFactionSurge,
    tags: freezeArray(["planner", "liveops", "barrel"]),
  }),
  freeze({
    name: "summarizeFactionSurgePlan",
    family: "planner" as const,
    description:
      "summarizeFactionSurgePlan helper surfaced through the liveops barrel.",
    ref: summarizeFactionSurgePlan,
    tags: freezeArray(["planner", "liveops", "barrel"]),
  }),
]);

export const CHAT_LIVEOPS_DIRECTOR_HELPERS = freezeArray([
  freeze({
    name: "WorldEventDirector",
    family: "director" as const,
    description:
      "WorldEventDirector helper surfaced through the liveops barrel.",
    ref: WorldEventDirector,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "WorldEventDirectorInspector",
    family: "director" as const,
    description:
      "WorldEventDirectorInspector helper surfaced through the liveops barrel.",
    ref: WorldEventDirectorInspector,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "createWorldEventDirector",
    family: "director" as const,
    description:
      "createWorldEventDirector helper surfaced through the liveops barrel.",
    ref: createWorldEventDirector,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "createWorldEventDirectorInspector",
    family: "director" as const,
    description:
      "createWorldEventDirectorInspector helper surfaced through the liveops barrel.",
    ref: createWorldEventDirectorInspector,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "summarizeWorldEventAnnouncementDirective",
    family: "director" as const,
    description:
      "summarizeWorldEventAnnouncementDirective helper surfaced through the liveops barrel.",
    ref: summarizeWorldEventAnnouncementDirective,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "summarizeWorldEventShadowDirective",
    family: "director" as const,
    description:
      "summarizeWorldEventShadowDirective helper surfaced through the liveops barrel.",
    ref: summarizeWorldEventShadowDirective,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "summarizeWorldEventVisibleChannelDirective",
    family: "director" as const,
    description:
      "summarizeWorldEventVisibleChannelDirective helper surfaced through the liveops barrel.",
    ref: summarizeWorldEventVisibleChannelDirective,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "summarizeWorldEventRoomPlan",
    family: "director" as const,
    description:
      "summarizeWorldEventRoomPlan helper surfaced through the liveops barrel.",
    ref: summarizeWorldEventRoomPlan,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "scoreWorldEventNarrativePacket",
    family: "director" as const,
    description:
      "scoreWorldEventNarrativePacket helper surfaced through the liveops barrel.",
    ref: scoreWorldEventNarrativePacket,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "listWorldEventAnnouncementDigests",
    family: "director" as const,
    description:
      "listWorldEventAnnouncementDigests helper surfaced through the liveops barrel.",
    ref: listWorldEventAnnouncementDigests,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "listWorldEventShadowDigests",
    family: "director" as const,
    description:
      "listWorldEventShadowDigests helper surfaced through the liveops barrel.",
    ref: listWorldEventShadowDigests,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "listWorldEventVisibleChannelDigests",
    family: "director" as const,
    description:
      "listWorldEventVisibleChannelDigests helper surfaced through the liveops barrel.",
    ref: listWorldEventVisibleChannelDigests,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "listWorldEventPlanDigests",
    family: "director" as const,
    description:
      "listWorldEventPlanDigests helper surfaced through the liveops barrel.",
    ref: listWorldEventPlanDigests,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "listWorldEventNarrativeScorecards",
    family: "director" as const,
    description:
      "listWorldEventNarrativeScorecards helper surfaced through the liveops barrel.",
    ref: listWorldEventNarrativeScorecards,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "collectWorldEventRoomIds",
    family: "director" as const,
    description:
      "collectWorldEventRoomIds helper surfaced through the liveops barrel.",
    ref: collectWorldEventRoomIds,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "collectWorldEventPrimaryFactionIds",
    family: "director" as const,
    description:
      "collectWorldEventPrimaryFactionIds helper surfaced through the liveops barrel.",
    ref: collectWorldEventPrimaryFactionIds,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "collectWorldEventActiveEventIds",
    family: "director" as const,
    description:
      "collectWorldEventActiveEventIds helper surfaced through the liveops barrel.",
    ref: collectWorldEventActiveEventIds,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "collectWorldEventActivationIds",
    family: "director" as const,
    description:
      "collectWorldEventActivationIds helper surfaced through the liveops barrel.",
    ref: collectWorldEventActivationIds,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "collectWorldEventDominantChannels",
    family: "director" as const,
    description:
      "collectWorldEventDominantChannels helper surfaced through the liveops barrel.",
    ref: collectWorldEventDominantChannels,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "countWorldEventPressureBands",
    family: "director" as const,
    description:
      "countWorldEventPressureBands helper surfaced through the liveops barrel.",
    ref: countWorldEventPressureBands,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "countWorldEventAnnouncementStyles",
    family: "director" as const,
    description:
      "countWorldEventAnnouncementStyles helper surfaced through the liveops barrel.",
    ref: countWorldEventAnnouncementStyles,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "countWorldEventVisibleDisposition",
    family: "director" as const,
    description:
      "countWorldEventVisibleDisposition helper surfaced through the liveops barrel.",
    ref: countWorldEventVisibleDisposition,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "countWorldEventShadowDisposition",
    family: "director" as const,
    description:
      "countWorldEventShadowDisposition helper surfaced through the liveops barrel.",
    ref: countWorldEventShadowDisposition,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildWorldEventPressureRanking",
    family: "director" as const,
    description:
      "buildWorldEventPressureRanking helper surfaced through the liveops barrel.",
    ref: buildWorldEventPressureRanking,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildWorldEventAnnouncementRanking",
    family: "director" as const,
    description:
      "buildWorldEventAnnouncementRanking helper surfaced through the liveops barrel.",
    ref: buildWorldEventAnnouncementRanking,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildWorldEventShadowRanking",
    family: "director" as const,
    description:
      "buildWorldEventShadowRanking helper surfaced through the liveops barrel.",
    ref: buildWorldEventShadowRanking,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildWorldEventVisibleChannelRanking",
    family: "director" as const,
    description:
      "buildWorldEventVisibleChannelRanking helper surfaced through the liveops barrel.",
    ref: buildWorldEventVisibleChannelRanking,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "collectWorldEventTags",
    family: "director" as const,
    description:
      "collectWorldEventTags helper surfaced through the liveops barrel.",
    ref: collectWorldEventTags,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildWorldEventNarrativeHeadlines",
    family: "director" as const,
    description:
      "buildWorldEventNarrativeHeadlines helper surfaced through the liveops barrel.",
    ref: buildWorldEventNarrativeHeadlines,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildWorldEventSummaryLedger",
    family: "director" as const,
    description:
      "buildWorldEventSummaryLedger helper surfaced through the liveops barrel.",
    ref: buildWorldEventSummaryLedger,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildWorldEventModeHistogram",
    family: "director" as const,
    description:
      "buildWorldEventModeHistogram helper surfaced through the liveops barrel.",
    ref: buildWorldEventModeHistogram,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildWorldEventFactionHistogram",
    family: "director" as const,
    description:
      "buildWorldEventFactionHistogram helper surfaced through the liveops barrel.",
    ref: buildWorldEventFactionHistogram,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildWorldEventClimateHistogram",
    family: "director" as const,
    description:
      "buildWorldEventClimateHistogram helper surfaced through the liveops barrel.",
    ref: buildWorldEventClimateHistogram,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildWorldEventAnnouncementStyleHistogram",
    family: "director" as const,
    description:
      "buildWorldEventAnnouncementStyleHistogram helper surfaced through the liveops barrel.",
    ref: buildWorldEventAnnouncementStyleHistogram,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildWorldEventDigestStrings",
    family: "director" as const,
    description:
      "buildWorldEventDigestStrings helper surfaced through the liveops barrel.",
    ref: buildWorldEventDigestStrings,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
  freeze({
    name: "buildWorldEventNarrativeDigestStrings",
    family: "director" as const,
    description:
      "buildWorldEventNarrativeDigestStrings helper surfaced through the liveops barrel.",
    ref: buildWorldEventNarrativeDigestStrings,
    tags: freezeArray(["director", "world", "liveops", "barrel"]),
  }),
]);

export function listChatLiveOpsHelperSurface(): readonly string[] {
  return freezeArray([
    "GlobalEventScheduler",
    "GlobalEventSchedulerInspector",
    "buildGlobalEventSchedulerManifest",
    "buildRoomProjectionMatrix",
    "computeChannelLoads",
    "computeFamilyLoads",
    "createGlobalEventScheduler",
    "createGlobalEventSchedulerInspector",
    "describeGlobalEventSchedulerState",
    "evaluateGlobalEventSchedulerDetailed",
    "previewLibraryWindows",
    "summarizeGlobalEventChannelLoad",
    "summarizeGlobalEventDefinitionAudit",
    "summarizeGlobalEventFamilyLoad",
    "summarizeGlobalEventProjection",
    "summarizeGlobalEventRoomProjection",
    "summarizeGlobalEventSchedulerDetailedSnapshot",
    "summarizeGlobalEventWindowPreview",
    "FactionSurgePlanner",
    "buildFactionSurgeNarrativePacket",
    "buildFactionSurgePlanAudit",
    "createDefaultFactionDescriptors",
    "createFactionSurgePlanner",
    "planFactionSurge",
    "summarizeFactionSurgePlan",
    "WorldEventDirector",
    "WorldEventDirectorInspector",
    "createWorldEventDirector",
    "createWorldEventDirectorInspector",
    "summarizeWorldEventAnnouncementDirective",
    "summarizeWorldEventShadowDirective",
    "summarizeWorldEventVisibleChannelDirective",
    "summarizeWorldEventRoomPlan",
    "scoreWorldEventNarrativePacket",
    "listWorldEventAnnouncementDigests",
    "listWorldEventShadowDigests",
    "listWorldEventVisibleChannelDigests",
    "listWorldEventPlanDigests",
    "listWorldEventNarrativeScorecards",
    "collectWorldEventRoomIds",
    "collectWorldEventPrimaryFactionIds",
    "collectWorldEventActiveEventIds",
    "collectWorldEventActivationIds",
    "collectWorldEventDominantChannels",
    "countWorldEventPressureBands",
    "countWorldEventAnnouncementStyles",
    "countWorldEventVisibleDisposition",
    "countWorldEventShadowDisposition",
    "buildWorldEventPressureRanking",
    "buildWorldEventAnnouncementRanking",
    "buildWorldEventShadowRanking",
    "buildWorldEventVisibleChannelRanking",
    "collectWorldEventTags",
    "buildWorldEventNarrativeHeadlines",
    "buildWorldEventSummaryLedger",
    "buildWorldEventModeHistogram",
    "buildWorldEventFactionHistogram",
    "buildWorldEventClimateHistogram",
    "buildWorldEventAnnouncementStyleHistogram",
    "buildWorldEventDigestStrings",
    "buildWorldEventNarrativeDigestStrings",
    "createChatLiveOpsControlPlane",
    "createDefaultChatLiveOpsControlPlane",
    "createEmpireChatLiveOpsControlPlane",
    "createPredatorChatLiveOpsControlPlane",
    "createSyndicateChatLiveOpsControlPlane",
    "createPhantomChatLiveOpsControlPlane",
    "createLobbyChatLiveOpsControlPlane",
    "createPostRunChatLiveOpsControlPlane",
    "evaluateChatLiveOpsControlPlane",
    "buildChatLiveOpsDiagnosticsPacket",
    "listChatLiveOpsHelperSurface",
    "buildChatLiveOpsHelperRegistry",
  ]);
}
export function buildChatLiveOpsHelperRegistry(): Readonly<
  Record<string, string>
> {
  const registry: Record<string, string> = {};
  registry["GlobalEventScheduler"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["GlobalEventSchedulerInspector"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildGlobalEventSchedulerManifest"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildRoomProjectionMatrix"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["computeChannelLoads"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["computeFamilyLoads"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createGlobalEventScheduler"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createGlobalEventSchedulerInspector"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["describeGlobalEventSchedulerState"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["evaluateGlobalEventSchedulerDetailed"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["previewLibraryWindows"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["summarizeGlobalEventChannelLoad"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["summarizeGlobalEventDefinitionAudit"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["summarizeGlobalEventFamilyLoad"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["summarizeGlobalEventProjection"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["summarizeGlobalEventRoomProjection"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["summarizeGlobalEventSchedulerDetailedSnapshot"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["summarizeGlobalEventWindowPreview"] =
    "scheduler surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["FactionSurgePlanner"] =
    "planner surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildFactionSurgeNarrativePacket"] =
    "planner surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildFactionSurgePlanAudit"] =
    "planner surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createDefaultFactionDescriptors"] =
    "planner surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createFactionSurgePlanner"] =
    "planner surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["planFactionSurge"] =
    "planner surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["summarizeFactionSurgePlan"] =
    "planner surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["WorldEventDirector"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["WorldEventDirectorInspector"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createWorldEventDirector"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createWorldEventDirectorInspector"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["summarizeWorldEventAnnouncementDirective"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["summarizeWorldEventShadowDirective"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["summarizeWorldEventVisibleChannelDirective"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["summarizeWorldEventRoomPlan"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["scoreWorldEventNarrativePacket"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["listWorldEventAnnouncementDigests"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["listWorldEventShadowDigests"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["listWorldEventVisibleChannelDigests"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["listWorldEventPlanDigests"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["listWorldEventNarrativeScorecards"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["collectWorldEventRoomIds"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["collectWorldEventPrimaryFactionIds"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["collectWorldEventActiveEventIds"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["collectWorldEventActivationIds"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["collectWorldEventDominantChannels"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["countWorldEventPressureBands"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["countWorldEventAnnouncementStyles"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["countWorldEventVisibleDisposition"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["countWorldEventShadowDisposition"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildWorldEventPressureRanking"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildWorldEventAnnouncementRanking"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildWorldEventShadowRanking"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildWorldEventVisibleChannelRanking"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["collectWorldEventTags"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildWorldEventNarrativeHeadlines"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildWorldEventSummaryLedger"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildWorldEventModeHistogram"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildWorldEventFactionHistogram"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildWorldEventClimateHistogram"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildWorldEventAnnouncementStyleHistogram"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildWorldEventDigestStrings"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildWorldEventNarrativeDigestStrings"] =
    "director surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createChatLiveOpsControlPlane"] =
    "control-plane surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createDefaultChatLiveOpsControlPlane"] =
    "control-plane surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createEmpireChatLiveOpsControlPlane"] =
    "control-plane surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createPredatorChatLiveOpsControlPlane"] =
    "control-plane surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createSyndicateChatLiveOpsControlPlane"] =
    "control-plane surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createPhantomChatLiveOpsControlPlane"] =
    "control-plane surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createLobbyChatLiveOpsControlPlane"] =
    "control-plane surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["createPostRunChatLiveOpsControlPlane"] =
    "control-plane surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["evaluateChatLiveOpsControlPlane"] =
    "control-plane surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildChatLiveOpsDiagnosticsPacket"] =
    "control-plane surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["listChatLiveOpsHelperSurface"] =
    "control-plane surface available through backend/src/game/engine/chat/liveops/index.ts";
  registry["buildChatLiveOpsHelperRegistry"] =
    "control-plane surface available through backend/src/game/engine/chat/liveops/index.ts";
  return freeze(registry);
}

export class ChatLiveOpsControlPlane {
  private readonly scheduler: GlobalEventScheduler;
  private readonly planner: FactionSurgePlanner;
  private readonly director: WorldEventDirector;
  private readonly schedulerInspector: GlobalEventSchedulerInspector;
  private readonly directorInspector: WorldEventDirectorInspector;
  public constructor(options: ChatLiveOpsControlPlaneOptions = {}) {
    this.scheduler =
      options.scheduler ??
      createGlobalEventScheduler(options.schedulerOptions ?? {});
    this.planner =
      options.planner ??
      createFactionSurgePlanner(options.plannerOptions ?? {});
    this.director =
      options.director ??
      createWorldEventDirector({
        scheduler: this.scheduler,
        factionPlanner: this.planner,
        ...(options.directorOptions ?? {}),
      });
    this.schedulerInspector = createGlobalEventSchedulerInspector(
      this.scheduler,
    );
    this.directorInspector = createWorldEventDirectorInspector(this.director);
  }
  public getScheduler(): GlobalEventScheduler {
    return this.scheduler;
  }
  public getPlanner(): FactionSurgePlanner {
    return this.planner;
  }
  public getDirector(): WorldEventDirector {
    return this.director;
  }
  public getSchedulerInspector(): GlobalEventSchedulerInspector {
    return this.schedulerInspector;
  }
  public getDirectorInspector(): WorldEventDirectorInspector {
    return this.directorInspector;
  }
  public describeSchedulerState(): ReturnType<
    typeof describeGlobalEventSchedulerState
  > {
    return describeGlobalEventSchedulerState(this.scheduler.serialize());
  }
  public previewWindows(
    input: PreviewWindowsInput = {},
  ): readonly GlobalEventWindowPreview[] {
    const direct = previewLibraryWindows(
      this.scheduler.listDefinitions(),
      input,
    );
    const inspected = this.schedulerInspector.previewLibraryWindows(input);
    const merged = new Map<string, GlobalEventWindowPreview>();
    for (const preview of [...direct, ...inspected]) {
      merged.set(
        `${preview.eventId}::${preview.startsAt}::${preview.endsAt}::${preview.source}`,
        preview,
      );
    }
    return freezeArray(
      [...merged.values()].sort(
        (left, right) => left.startsAt - right.startsAt,
      ),
    );
  }
  public buildSchedulerSurfacePacket(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): ChatLiveOpsSchedulerSurfacePacket {
    const snapshot = evaluateGlobalEventSchedulerDetailed(
      this.scheduler,
      context,
    );
    const manifest = buildGlobalEventSchedulerManifest(
      this.scheduler.serialize(),
      snapshot.evaluatedAt,
    );
    const roomMatrix = buildRoomProjectionMatrix(
      context.rooms ?? [],
      snapshot.activeProjections,
      snapshot.upcomingProjections,
    );
    const channelLoads = computeChannelLoads(
      snapshot.activeProjections,
      snapshot.upcomingProjections,
    );
    const familyLoads = computeFamilyLoads(
      snapshot.activeProjections,
      snapshot.upcomingProjections,
    );
    const previews = this.previewWindows({ now: snapshot.evaluatedAt });
    const audits = this.schedulerInspector.auditLibrary();
    const timeline = this.schedulerInspector.buildTimeline(context);
    return freeze({
      manifest,
      snapshot,
      stateDescription: this.describeSchedulerState(),
      roomMatrix,
      roomProjections: snapshot.roomProjections,
      previews,
      audits,
      timeline,
      channelLoads,
      familyLoads,
      summaryLines: summarizeGlobalEventSchedulerDetailedSnapshot(snapshot),
      projectionSummaryLines: freezeArray(
        snapshot.activeProjections.map((projection) =>
          summarizeGlobalEventProjection(projection),
        ),
      ),
      roomProjectionSummaryLines: freezeArray(
        snapshot.roomProjections.map((projection) =>
          summarizeGlobalEventRoomProjection(projection),
        ),
      ),
      previewSummaryLines: freezeArray(
        previews.map((preview) => summarizeGlobalEventWindowPreview(preview)),
      ),
      auditSummaryLines: freezeArray(
        audits.map((audit) => summarizeGlobalEventDefinitionAudit(audit)),
      ),
      channelLoadSummaryLines: freezeArray(
        channelLoads.map((load) => summarizeGlobalEventChannelLoad(load)),
      ),
      familyLoadSummaryLines: freezeArray(
        familyLoads.map((load) => summarizeGlobalEventFamilyLoad(load)),
      ),
    });
  }
  public buildPlannerSurfacePacket(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): ChatLiveOpsPlannerSurfacePacket {
    const schedulerPacket = this.buildSchedulerSurfacePacket(context);
    const rooms = context.rooms ?? [];
    const activeEventsByRoomId = indexActiveEventsByRoom(
      rooms,
      schedulerPacket.roomProjections,
      schedulerPacket.snapshot.activeProjections,
    );
    const batch = this.planner.planBatch(
      rooms,
      activeEventsByRoomId,
      schedulerPacket.snapshot.evaluatedAt,
    );
    const directPlans = freezeArray(
      rooms.map((room) =>
        planFactionSurge(room, activeEventsByRoomId[room.roomId] ?? [], {
          factions: this.planner.getFactions(),
        }),
      ),
    );
    const plans = batch.plans.length > 0 ? batch.plans : directPlans;
    const summaries = freezeArray(
      plans.map((plan) => summarizeFactionSurgePlan(plan)),
    );
    const audits = freezeArray(
      plans.map((plan) => buildFactionSurgePlanAudit(plan)),
    );
    const narrativePackets = freezeArray(
      plans.map((plan) => buildFactionSurgeNarrativePacket(plan)),
    );
    const roomSignalProfilesByRoomId: Record<
      string,
      FactionRoomSignalProfile | null
    > = {};
    for (const room of rooms) {
      roomSignalProfilesByRoomId[room.roomId] = null;
    }
    return freeze({
      descriptors: this.planner.getFactions(),
      plans,
      planSummaries: summaries,
      planAudits: audits,
      narrativePackets,
      batch,
      planIndexByRoomId: mapPlansByRoomId(plans),
      summaryLines: freezeArray(
        plans.flatMap((plan) => summarizeFactionSurgePlan(plan).summaryLines),
      ),
      roomSignalProfilesByRoomId: freeze(roomSignalProfilesByRoomId),
    });
  }
  public buildWorldSurfacePacket(
    context: GlobalEventSchedulerEvaluationContext = {},
    manifestToCompare: WorldEventDirectorManifest | null = null,
  ): ChatLiveOpsWorldSurfacePacket {
    const tick = this.director.tick(context);
    const detailed = this.director.tickDetailed(context);
    const manifest = this.director.buildManifest();
    const libraryDiff = manifestToCompare
      ? this.director.diffManifest(manifestToCompare)
      : null;
    const roomPlanMatrix = this.director.buildRoomPlanMatrix(context);
    const planDigests = listWorldEventPlanDigests(tick.roomPlans);
    const announcementDigests = listWorldEventAnnouncementDigests(
      tick.roomPlans,
    );
    const shadowDigests = listWorldEventShadowDigests(tick.roomPlans);
    const visibleChannelDigests = listWorldEventVisibleChannelDigests(
      tick.roomPlans,
    );
    const narrativeScorecards = listWorldEventNarrativeScorecards(
      tick.roomPlans,
    );
    return freeze({
      tick,
      detailed,
      manifest,
      libraryDiff,
      roomPlanMatrix,
      planDigests,
      announcementDigests,
      shadowDigests,
      visibleChannelDigests,
      narrativeScorecards,
      roomIds: collectWorldEventRoomIds(tick.roomPlans),
      primaryFactionIds: collectWorldEventPrimaryFactionIds(tick.roomPlans),
      activeEventIds: collectWorldEventActiveEventIds(tick.roomPlans),
      activationIds: collectWorldEventActivationIds(tick.roomPlans),
      dominantChannels: collectWorldEventDominantChannels(tick.roomPlans),
      pressureBands: countWorldEventPressureBands(tick.roomPlans),
      announcementStyles: countWorldEventAnnouncementStyles(tick.roomPlans),
      visibleDisposition: countWorldEventVisibleDisposition(
        detailed.roomPlansDetailed,
      ),
      shadowDisposition: countWorldEventShadowDisposition(
        detailed.roomPlansDetailed,
      ),
      pressureRanking: buildWorldEventPressureRanking(tick.roomPlans),
      announcementRanking: buildWorldEventAnnouncementRanking(tick.roomPlans),
      shadowRanking: buildWorldEventShadowRanking(tick.roomPlans),
      visibleChannelRanking: buildWorldEventVisibleChannelRanking(
        tick.roomPlans,
      ),
      tags: collectWorldEventTags(tick.roomPlans),
      headlines: buildWorldEventNarrativeHeadlines(tick.roomPlans),
      summaryLedger: buildWorldEventSummaryLedger(tick.roomPlans),
      modeHistogram: buildWorldEventModeHistogram(tick.roomPlans),
      factionHistogram: buildWorldEventFactionHistogram(tick.roomPlans),
      climateHistogram: buildWorldEventClimateHistogram(tick.roomPlans),
      announcementStyleHistogram: buildWorldEventAnnouncementStyleHistogram(
        tick.roomPlans,
      ),
      digestStrings: buildWorldEventDigestStrings(tick.roomPlans),
      narrativeDigestStrings: buildWorldEventNarrativeDigestStrings(
        tick.roomPlans,
      ),
      planSummaryLines: freezeArray(
        tick.roomPlans.flatMap((plan) => {
          const summaries: string[] = [];
          for (const announcement of plan.visibleAnnouncements) {
            const digest =
              summarizeWorldEventAnnouncementDirective(announcement);
            summaries.push(
              `${digest.roomId}:${digest.eventId}:${digest.style}:${digest.priority}`,
            );
          }
          for (const shadow of plan.shadowDirectives) {
            const digest = summarizeWorldEventShadowDirective(shadow);
            summaries.push(
              `${digest.roomId}:${digest.activationId}:${digest.shadowChannelId}:${digest.queuePriority}`,
            );
          }
          for (const channel of plan.visibleChannels) {
            const digest = summarizeWorldEventVisibleChannelDirective(channel);
            summaries.push(
              `${digest.roomId}:${digest.channelId}:${digest.dominantFactionId}:${digest.pressureDelta}`,
            );
          }
          const planDigest = summarizeWorldEventRoomPlan(plan);
          const narrativeScore = scoreWorldEventNarrativePacket(plan.narrative);
          summaries.push(
            `${planDigest.roomId}:${planDigest.primaryFactionId}:${planDigest.climate}:${narrativeScore.aggregateScore}`,
          );
          return summaries;
        }),
      ),
    });
  }
  public buildRoomCoverage(
    scheduler: ChatLiveOpsSchedulerSurfacePacket,
    planner: ChatLiveOpsPlannerSurfacePacket,
    world: ChatLiveOpsWorldSurfacePacket,
  ): readonly ChatLiveOpsRoomCoverage[] {
    const worldByRoomId = mapPlansByRoomId(world.tick.roomPlans);
    const plannerByRoomId = planner.planIndexByRoomId;
    return freezeArray(
      (scheduler.snapshot.roomMatrix ?? []).map((row) => {
        const worldPlan = worldByRoomId[row.roomId];
        const plannerPlan = plannerByRoomId[row.roomId];
        const activeEventIds = uniqueStrings(row.activeEventIds);
        const upcomingEventIds = uniqueStrings(row.upcomingEventIds);
        const projectedChannels = uniqueStrings(
          row.projectedChannels.map((channel) => String(channel)),
        );
        const dominantChannels = worldPlan
          ? uniqueStrings(
              worldPlan.roomClimate.dominantChannels.map((channel) =>
                String(channel),
              ),
            )
          : [];
        const pressureWeight = round2(
          row.cumulativePressureWeight +
            (plannerPlan
              ? plannerPlan.witnessPressureDelta +
                plannerPlan.pressureBiasDelta +
                plannerPlan.publicnessBiasDelta +
                plannerPlan.shadowPressureDelta
              : 0),
        );
        return freeze({
          roomId: row.roomId,
          mode: row.mode ?? null,
          activeEventIds,
          upcomingEventIds,
          projectedChannels,
          dominantChannels,
          roomProjectionCount:
            row.activeEventIds.length + row.upcomingEventIds.length,
          factionPlanCount: plannerPlan ? 1 : 0,
          visibleAnnouncementCount: worldPlan
            ? worldPlan.visibleAnnouncements.length
            : 0,
          shadowDirectiveCount: worldPlan
            ? worldPlan.shadowDirectives.length
            : 0,
          pressureWeight,
          notes: freezeArray(
            uniqueStrings([
              `ROOM:${row.roomId}`,
              `MODE:${row.mode ?? "UNKNOWN"}`,
              plannerPlan
                ? `FACTION:${plannerPlan.primaryFactionId}`
                : "NO_FACTION_PLAN",
              worldPlan
                ? `CLIMATE:${worldPlan.roomClimate.pressureBand}`
                : "NO_WORLD_PLAN",
            ]),
          ),
        });
      }),
    );
  }
  public buildRuntimeHealth(
    scheduler: ChatLiveOpsSchedulerSurfacePacket,
    planner: ChatLiveOpsPlannerSurfacePacket,
    world: ChatLiveOpsWorldSurfacePacket,
  ): ChatLiveOpsRuntimeHealth {
    const schedulerPressure =
      scheduler.snapshot.detailedDiagnostics.totalProjectedPressure;
    const factionPressure = round2(
      planner.plans.reduce(
        (sum, plan) =>
          sum +
          plan.witnessPressureDelta +
          plan.pressureBiasDelta +
          plan.publicnessBiasDelta +
          plan.shadowPressureDelta,
        0,
      ),
    );
    const total = schedulerPressure + factionPressure;
    const band =
      total >= 1200
        ? "CRITICAL"
        : total >= 700
          ? "HIGH"
          : total >= 280
            ? "MEDIUM"
            : "LOW";
    const visibleAnnouncements = world.tick.roomPlans.reduce(
      (sum, plan) => sum + plan.visibleAnnouncements.length,
      0,
    );
    const shadowDirectives = world.tick.roomPlans.reduce(
      (sum, plan) => sum + plan.shadowDirectives.length,
      0,
    );
    return freeze({
      band,
      activeEvents: scheduler.snapshot.activeProjections.length,
      upcomingEvents: scheduler.snapshot.upcomingProjections.length,
      rooms: scheduler.snapshot.roomMatrix.length,
      factionPlans: planner.plans.length,
      visibleAnnouncements,
      shadowDirectives,
      schedulerPressure,
      factionPressure,
      notes: freezeArray([
        `schedulerPressure=${schedulerPressure}`,
        `factionPressure=${factionPressure}`,
        `visibleAnnouncements=${visibleAnnouncements}`,
        `shadowDirectives=${shadowDirectives}`,
        `health=${band}`,
      ]),
    });
  }
  public buildOverview(
    scheduler: ChatLiveOpsSchedulerSurfacePacket,
    planner: ChatLiveOpsPlannerSurfacePacket,
    world: ChatLiveOpsWorldSurfacePacket,
    roomCoverage: readonly ChatLiveOpsRoomCoverage[],
  ): ChatLiveOpsOverview {
    const topEvents = freezeArray(
      scheduler.snapshot.activeProjections
        .slice()
        .sort((left, right) => right.timeRemainingMs - left.timeRemainingMs)
        .slice(0, 8)
        .map((projection) => summarizeGlobalEventProjection(projection)),
    );
    const topRooms = freezeArray(
      roomCoverage
        .slice()
        .sort((left, right) => right.pressureWeight - left.pressureWeight)
        .slice(0, 8)
        .map((room) => `${room.roomId}::${room.pressureWeight}`),
    );
    const worldNarrative = freezeArray(world.headlines.slice(0, 8));
    const plannerNarrative = freezeArray(
      planner.narrativePackets
        .slice(0, 8)
        .map((packet) => `${packet.primaryFactionId}::${packet.headline}`),
    );
    return freeze({
      summaryLines: scheduler.summaryLines,
      topEvents,
      topRooms,
      channelHeat: scheduler.channelLoadSummaryLines,
      familyHeat: scheduler.familyLoadSummaryLines,
      worldNarrative,
      plannerNarrative,
    });
  }
  public buildSurfaceSummary(): ChatLiveOpsSurfaceSummary {
    return freeze({
      helperNames: listChatLiveOpsHelperSurface(),
      helperCount: listChatLiveOpsHelperSurface().length,
      schedulerHelperCount: CHAT_LIVEOPS_SCHEDULER_HELPERS.length,
      plannerHelperCount: CHAT_LIVEOPS_PLANNER_HELPERS.length,
      directorHelperCount: CHAT_LIVEOPS_DIRECTOR_HELPERS.length,
    });
  }
  public evaluate(
    context: GlobalEventSchedulerEvaluationContext = {},
    manifestToCompare: WorldEventDirectorManifest | null = null,
  ): ChatLiveOpsEvaluation {
    const scheduler = this.buildSchedulerSurfacePacket(context);
    const planner = this.buildPlannerSurfacePacket(context);
    const world = this.buildWorldSurfacePacket(context, manifestToCompare);
    const roomCoverage = this.buildRoomCoverage(scheduler, planner, world);
    const runtimeHealth = this.buildRuntimeHealth(scheduler, planner, world);
    const overview = this.buildOverview(
      scheduler,
      planner,
      world,
      roomCoverage,
    );
    return freeze({
      scheduler,
      planner,
      world,
      roomCoverage,
      runtimeHealth,
      overview,
      surfaceSummary: this.buildSurfaceSummary(),
    });
  }
  public diffAgainstCurrentManifests(
    schedulerManifestBefore: GlobalEventSchedulerManifest,
    worldManifestBefore: WorldEventDirectorManifest,
  ): ChatLiveOpsManifestDiff {
    const schedulerManifestAfter = this.schedulerInspector.buildManifest();
    const worldManifestAfter = this.directorInspector.buildManifest();
    return freeze({
      schedulerDiff: this.schedulerInspector.diffManifest(
        schedulerManifestBefore,
      ),
      schedulerManifestBefore,
      schedulerManifestAfter,
      worldManifestBefore,
      worldManifestAfter,
      worldLibraryDiff:
        this.directorInspector.diffManifest(worldManifestBefore),
    });
  }
  public createPreset(
    id: ChatLiveOpsModePresetId,
    displayName: string,
  ): ChatLiveOpsPresetRuntime {
    return freeze({ id, displayName, controlPlane: this });
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
  manifestToCompare: WorldEventDirectorManifest | null = null,
): ChatLiveOpsEvaluation {
  return controlPlane.evaluate(context, manifestToCompare);
}
export function createDefaultChatLiveOpsControlPlane(): ChatLiveOpsControlPlane {
  return createChatLiveOpsControlPlane({
    plannerOptions: { factions: createDefaultFactionDescriptors() },
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
export function buildChatLiveOpsDiagnosticsPacket(
  controlPlane: ChatLiveOpsControlPlane,
  context: GlobalEventSchedulerEvaluationContext = {},
  manifestToCompare: WorldEventDirectorManifest | null = null,
): ChatLiveOpsDiagnosticsPacket {
  const evaluation = controlPlane.evaluate(context, manifestToCompare);
  return freeze({
    evaluation,
    schedulerState: controlPlane.describeSchedulerState(),
    schedulerHelpers: CHAT_LIVEOPS_SCHEDULER_HELPERS,
    plannerHelpers: CHAT_LIVEOPS_PLANNER_HELPERS,
    directorHelpers: CHAT_LIVEOPS_DIRECTOR_HELPERS,
    controlPlaneHelpers: freezeArray([
      freeze({
        name: "createChatLiveOpsControlPlane",
        family: "control-plane" as const,
        description: "Factory for the sovereign liveops control plane.",
        ref: createChatLiveOpsControlPlane,
        tags: freezeArray(["control-plane"]),
      }),
      freeze({
        name: "evaluateChatLiveOpsControlPlane",
        family: "control-plane" as const,
        description: "Runs combined scheduler/planner/director evaluation.",
        ref: evaluateChatLiveOpsControlPlane,
        tags: freezeArray(["control-plane"]),
      }),
      freeze({
        name: "buildChatLiveOpsDiagnosticsPacket",
        family: "control-plane" as const,
        description: "Builds the omnibus diagnostics packet.",
        ref: buildChatLiveOpsDiagnosticsPacket,
        tags: freezeArray(["control-plane"]),
      }),
      freeze({
        name: "listChatLiveOpsHelperSurface",
        family: "control-plane" as const,
        description: "Lists the helper surface exported by the barrel.",
        ref: listChatLiveOpsHelperSurface,
        tags: freezeArray(["control-plane"]),
      }),
      freeze({
        name: "buildChatLiveOpsHelperRegistry",
        family: "control-plane" as const,
        description: "Builds a string registry for helper discovery.",
        ref: buildChatLiveOpsHelperRegistry,
        tags: freezeArray(["control-plane"]),
      }),
    ]),
    helperRegistry: buildChatLiveOpsHelperRegistry(),
  });
}
export function summarizeChatLiveOpsOverview(
  overview: ChatLiveOpsOverview,
): readonly string[] {
  return freezeArray([
    ...overview.summaryLines,
    ...overview.topEvents.slice(0, 3),
    ...overview.topRooms.slice(0, 3),
  ]);
}
export function summarizeChatLiveOpsEvaluation(
  evaluation: ChatLiveOpsEvaluation,
): readonly string[] {
  return freezeArray([
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
  return freezeArray([
    `version=${manifest.version}`,
    `definitions=${manifest.definitionIds.length}`,
    `activations=${manifest.activationIds.length}`,
    `cancelled=${manifest.cancelledActivationIds.length}`,
    `families=${manifest.families.join(",")}`,
  ]);
}
export function summarizeChatLiveOpsManifestDiff(
  diff: ChatLiveOpsManifestDiff,
): readonly string[] {
  return freezeArray([
    `schedulerAdded=${diff.schedulerDiff.added.length}`,
    `schedulerRemoved=${diff.schedulerDiff.removed.length}`,
    `schedulerChanged=${diff.schedulerDiff.changed.length}`,
    `worldChanged=${diff.worldLibraryDiff.changedDefinitionIds.length}`,
    `worldNotes=${diff.worldLibraryDiff.notes.join("|")}`,
  ]);
}
export function buildChatLiveOpsSchedulerFunctionMap(): Readonly<
  Record<string, unknown>
> {
  return freeze(
    Object.fromEntries(
      CHAT_LIVEOPS_SCHEDULER_HELPERS.map((entry) => [entry.name, entry.ref]),
    ),
  );
}
export function buildChatLiveOpsPlannerFunctionMap(): Readonly<
  Record<string, unknown>
> {
  return freeze(
    Object.fromEntries(
      CHAT_LIVEOPS_PLANNER_HELPERS.map((entry) => [entry.name, entry.ref]),
    ),
  );
}
export function buildChatLiveOpsDirectorFunctionMap(): Readonly<
  Record<string, unknown>
> {
  return freeze(
    Object.fromEntries(
      CHAT_LIVEOPS_DIRECTOR_HELPERS.map((entry) => [entry.name, entry.ref]),
    ),
  );
}

export const CHAT_LIVEOPS_MODE_PRESET_DESCRIPTORS = freeze({
  DEFAULT: freeze({
    id: "DEFAULT" as ChatLiveOpsModePresetId,
    displayName: "Default runtime",
    notes: freezeArray([
      "DEFAULT preset is exposed by the liveops control plane barrel.",
      "Scheduler, planner, and world director remain mounted through one authority lane.",
      "Preset factories are intentionally thin so mode logic remains in the underlying engines.",
    ]),
  }),
  EMPIRE: freeze({
    id: "EMPIRE" as ChatLiveOpsModePresetId,
    displayName: "Empire runtime",
    notes: freezeArray([
      "EMPIRE preset is exposed by the liveops control plane barrel.",
      "Scheduler, planner, and world director remain mounted through one authority lane.",
      "Preset factories are intentionally thin so mode logic remains in the underlying engines.",
    ]),
  }),
  PREDATOR: freeze({
    id: "PREDATOR" as ChatLiveOpsModePresetId,
    displayName: "Predator runtime",
    notes: freezeArray([
      "PREDATOR preset is exposed by the liveops control plane barrel.",
      "Scheduler, planner, and world director remain mounted through one authority lane.",
      "Preset factories are intentionally thin so mode logic remains in the underlying engines.",
    ]),
  }),
  SYNDICATE: freeze({
    id: "SYNDICATE" as ChatLiveOpsModePresetId,
    displayName: "Syndicate runtime",
    notes: freezeArray([
      "SYNDICATE preset is exposed by the liveops control plane barrel.",
      "Scheduler, planner, and world director remain mounted through one authority lane.",
      "Preset factories are intentionally thin so mode logic remains in the underlying engines.",
    ]),
  }),
  PHANTOM: freeze({
    id: "PHANTOM" as ChatLiveOpsModePresetId,
    displayName: "Phantom runtime",
    notes: freezeArray([
      "PHANTOM preset is exposed by the liveops control plane barrel.",
      "Scheduler, planner, and world director remain mounted through one authority lane.",
      "Preset factories are intentionally thin so mode logic remains in the underlying engines.",
    ]),
  }),
  LOBBY: freeze({
    id: "LOBBY" as ChatLiveOpsModePresetId,
    displayName: "Lobby runtime",
    notes: freezeArray([
      "LOBBY preset is exposed by the liveops control plane barrel.",
      "Scheduler, planner, and world director remain mounted through one authority lane.",
      "Preset factories are intentionally thin so mode logic remains in the underlying engines.",
    ]),
  }),
  POST_RUN: freeze({
    id: "POST_RUN" as ChatLiveOpsModePresetId,
    displayName: "Post-run runtime",
    notes: freezeArray([
      "POST_RUN preset is exposed by the liveops control plane barrel.",
      "Scheduler, planner, and world director remain mounted through one authority lane.",
      "Preset factories are intentionally thin so mode logic remains in the underlying engines.",
    ]),
  }),
});
export function createChatLiveOpsPresetRuntime(
  id: ChatLiveOpsModePresetId,
): ChatLiveOpsPresetRuntime {
  switch (id) {
    case "EMPIRE":
      return createEmpireChatLiveOpsControlPlane().createPreset(
        "EMPIRE",
        CHAT_LIVEOPS_MODE_PRESET_DESCRIPTORS.EMPIRE.displayName,
      );
    case "PREDATOR":
      return createPredatorChatLiveOpsControlPlane().createPreset(
        "PREDATOR",
        CHAT_LIVEOPS_MODE_PRESET_DESCRIPTORS.PREDATOR.displayName,
      );
    case "SYNDICATE":
      return createSyndicateChatLiveOpsControlPlane().createPreset(
        "SYNDICATE",
        CHAT_LIVEOPS_MODE_PRESET_DESCRIPTORS.SYNDICATE.displayName,
      );
    case "PHANTOM":
      return createPhantomChatLiveOpsControlPlane().createPreset(
        "PHANTOM",
        CHAT_LIVEOPS_MODE_PRESET_DESCRIPTORS.PHANTOM.displayName,
      );
    case "LOBBY":
      return createLobbyChatLiveOpsControlPlane().createPreset(
        "LOBBY",
        CHAT_LIVEOPS_MODE_PRESET_DESCRIPTORS.LOBBY.displayName,
      );
    case "POST_RUN":
      return createPostRunChatLiveOpsControlPlane().createPreset(
        "POST_RUN",
        CHAT_LIVEOPS_MODE_PRESET_DESCRIPTORS.POST_RUN.displayName,
      );
    default:
      return createDefaultChatLiveOpsControlPlane().createPreset(
        "DEFAULT",
        CHAT_LIVEOPS_MODE_PRESET_DESCRIPTORS.DEFAULT.displayName,
      );
  }
}

export const CHAT_LIVEOPS_TYPE_SURFACE = freezeArray([
  freeze({
    name: "GlobalEventSchedulerEvaluationContext",
    family: "scheduler",
    description:
      "GlobalEventSchedulerEvaluationContext type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "GlobalEventSchedulerManifest",
    family: "scheduler",
    description:
      "GlobalEventSchedulerManifest type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "GlobalEventSchedulerDetailedSnapshot",
    family: "scheduler",
    description:
      "GlobalEventSchedulerDetailedSnapshot type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "GlobalEventSchedulerRoomContext",
    family: "scheduler",
    description:
      "GlobalEventSchedulerRoomContext type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "GlobalEventProjection",
    family: "scheduler",
    description:
      "GlobalEventProjection type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "GlobalEventRoomProjection",
    family: "scheduler",
    description:
      "GlobalEventRoomProjection type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "GlobalEventWindowPreview",
    family: "scheduler",
    description:
      "GlobalEventWindowPreview type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "GlobalEventDefinitionAudit",
    family: "scheduler",
    description:
      "GlobalEventDefinitionAudit type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "GlobalEventTimelineSlice",
    family: "scheduler",
    description:
      "GlobalEventTimelineSlice type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "GlobalEventChannelLoad",
    family: "scheduler",
    description:
      "GlobalEventChannelLoad type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "GlobalEventFamilyLoad",
    family: "scheduler",
    description:
      "GlobalEventFamilyLoad type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "GlobalEventLibraryDiff",
    family: "scheduler",
    description:
      "GlobalEventLibraryDiff type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "PreviewWindowsInput",
    family: "scheduler",
    description:
      "PreviewWindowsInput type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "FactionDescriptor",
    family: "planner",
    description:
      "FactionDescriptor type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "FactionPlanBatchResult",
    family: "planner",
    description:
      "FactionPlanBatchResult type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "FactionRoomSignalProfile",
    family: "planner",
    description:
      "FactionRoomSignalProfile type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "FactionSurgePlan",
    family: "planner",
    description:
      "FactionSurgePlan type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "FactionSurgePlanAudit",
    family: "planner",
    description:
      "FactionSurgePlanAudit type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "FactionSurgePlanSummary",
    family: "planner",
    description:
      "FactionSurgePlanSummary type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "FactionSurgePlannerOptions",
    family: "planner",
    description:
      "FactionSurgePlannerOptions type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "FactionSurgeNarrativePacket",
    family: "planner",
    description:
      "FactionSurgeNarrativePacket type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventDirectorOptions",
    family: "director",
    description:
      "WorldEventDirectorOptions type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventDirectorTickResult",
    family: "director",
    description:
      "WorldEventDirectorTickResult type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventDirectorDetailedTickResult",
    family: "director",
    description:
      "WorldEventDirectorDetailedTickResult type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventDirectorManifest",
    family: "director",
    description:
      "WorldEventDirectorManifest type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventDirectorLibraryDiff",
    family: "director",
    description:
      "WorldEventDirectorLibraryDiff type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventDirectorBatchResult",
    family: "director",
    description:
      "WorldEventDirectorBatchResult type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventRoomPlan",
    family: "director",
    description:
      "WorldEventRoomPlan type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventRoomPlanDetailed",
    family: "director",
    description:
      "WorldEventRoomPlanDetailed type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventAnnouncementDigest",
    family: "director",
    description:
      "WorldEventAnnouncementDigest type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventShadowDigest",
    family: "director",
    description:
      "WorldEventShadowDigest type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventVisibleChannelDigest",
    family: "director",
    description:
      "WorldEventVisibleChannelDigest type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventPlanDigest",
    family: "director",
    description:
      "WorldEventPlanDigest type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventNarrativeScorecard",
    family: "director",
    description:
      "WorldEventNarrativeScorecard type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
  freeze({
    name: "WorldEventRoomPlanMatrixRow",
    family: "director",
    description:
      "WorldEventRoomPlanMatrixRow type is intentionally threaded through the liveops barrel surface so downstream code can depend on the index without losing deep type access.",
  }),
]);
export function summarizeChatLiveOpsTypeSurface(): readonly string[] {
  return freezeArray(
    CHAT_LIVEOPS_TYPE_SURFACE.map((entry) => `${entry.family}:${entry.name}`),
  );
}
export const CHAT_LIVEOPS_HELPER_GROUPS = freeze({
  scheduler: CHAT_LIVEOPS_SCHEDULER_HELPERS,
  planner: CHAT_LIVEOPS_PLANNER_HELPERS,
  director: CHAT_LIVEOPS_DIRECTOR_HELPERS,
});
export function listChatLiveOpsSchedulerHelperNames(): readonly string[] {
  return freezeArray(CHAT_LIVEOPS_SCHEDULER_HELPERS.map((entry) => entry.name));
}
export function listChatLiveOpsPlannerHelperNames(): readonly string[] {
  return freezeArray(CHAT_LIVEOPS_PLANNER_HELPERS.map((entry) => entry.name));
}
export function listChatLiveOpsDirectorHelperNames(): readonly string[] {
  return freezeArray(CHAT_LIVEOPS_DIRECTOR_HELPERS.map((entry) => entry.name));
}

export function getGlobalEventSchedulerReference(): typeof GlobalEventScheduler {
  return GlobalEventScheduler;
}
export function getGlobalEventSchedulerInspectorReference(): typeof GlobalEventSchedulerInspector {
  return GlobalEventSchedulerInspector;
}
export function getbuildGlobalEventSchedulerManifestReference(): typeof buildGlobalEventSchedulerManifest {
  return buildGlobalEventSchedulerManifest;
}
export function getbuildRoomProjectionMatrixReference(): typeof buildRoomProjectionMatrix {
  return buildRoomProjectionMatrix;
}
export function getcomputeChannelLoadsReference(): typeof computeChannelLoads {
  return computeChannelLoads;
}
export function getcomputeFamilyLoadsReference(): typeof computeFamilyLoads {
  return computeFamilyLoads;
}
export function getcreateGlobalEventSchedulerReference(): typeof createGlobalEventScheduler {
  return createGlobalEventScheduler;
}
export function getcreateGlobalEventSchedulerInspectorReference(): typeof createGlobalEventSchedulerInspector {
  return createGlobalEventSchedulerInspector;
}
export function getdescribeGlobalEventSchedulerStateReference(): typeof describeGlobalEventSchedulerState {
  return describeGlobalEventSchedulerState;
}
export function getevaluateGlobalEventSchedulerDetailedReference(): typeof evaluateGlobalEventSchedulerDetailed {
  return evaluateGlobalEventSchedulerDetailed;
}
export function getpreviewLibraryWindowsReference(): typeof previewLibraryWindows {
  return previewLibraryWindows;
}
export function getsummarizeGlobalEventChannelLoadReference(): typeof summarizeGlobalEventChannelLoad {
  return summarizeGlobalEventChannelLoad;
}
export function getsummarizeGlobalEventDefinitionAuditReference(): typeof summarizeGlobalEventDefinitionAudit {
  return summarizeGlobalEventDefinitionAudit;
}
export function getsummarizeGlobalEventFamilyLoadReference(): typeof summarizeGlobalEventFamilyLoad {
  return summarizeGlobalEventFamilyLoad;
}
export function getsummarizeGlobalEventProjectionReference(): typeof summarizeGlobalEventProjection {
  return summarizeGlobalEventProjection;
}
export function getsummarizeGlobalEventRoomProjectionReference(): typeof summarizeGlobalEventRoomProjection {
  return summarizeGlobalEventRoomProjection;
}
export function getsummarizeGlobalEventSchedulerDetailedSnapshotReference(): typeof summarizeGlobalEventSchedulerDetailedSnapshot {
  return summarizeGlobalEventSchedulerDetailedSnapshot;
}
export function getsummarizeGlobalEventWindowPreviewReference(): typeof summarizeGlobalEventWindowPreview {
  return summarizeGlobalEventWindowPreview;
}
export function getFactionSurgePlannerReference(): typeof FactionSurgePlanner {
  return FactionSurgePlanner;
}
export function getbuildFactionSurgeNarrativePacketReference(): typeof buildFactionSurgeNarrativePacket {
  return buildFactionSurgeNarrativePacket;
}
export function getbuildFactionSurgePlanAuditReference(): typeof buildFactionSurgePlanAudit {
  return buildFactionSurgePlanAudit;
}
export function getcreateDefaultFactionDescriptorsReference(): typeof createDefaultFactionDescriptors {
  return createDefaultFactionDescriptors;
}
export function getcreateFactionSurgePlannerReference(): typeof createFactionSurgePlanner {
  return createFactionSurgePlanner;
}
export function getplanFactionSurgeReference(): typeof planFactionSurge {
  return planFactionSurge;
}
export function getsummarizeFactionSurgePlanReference(): typeof summarizeFactionSurgePlan {
  return summarizeFactionSurgePlan;
}
export function getWorldEventDirectorReference(): typeof WorldEventDirector {
  return WorldEventDirector;
}
export function getWorldEventDirectorInspectorReference(): typeof WorldEventDirectorInspector {
  return WorldEventDirectorInspector;
}
export function getcreateWorldEventDirectorReference(): typeof createWorldEventDirector {
  return createWorldEventDirector;
}
export function getcreateWorldEventDirectorInspectorReference(): typeof createWorldEventDirectorInspector {
  return createWorldEventDirectorInspector;
}
export function getsummarizeWorldEventAnnouncementDirectiveReference(): typeof summarizeWorldEventAnnouncementDirective {
  return summarizeWorldEventAnnouncementDirective;
}
export function getsummarizeWorldEventShadowDirectiveReference(): typeof summarizeWorldEventShadowDirective {
  return summarizeWorldEventShadowDirective;
}
export function getsummarizeWorldEventVisibleChannelDirectiveReference(): typeof summarizeWorldEventVisibleChannelDirective {
  return summarizeWorldEventVisibleChannelDirective;
}
export function getsummarizeWorldEventRoomPlanReference(): typeof summarizeWorldEventRoomPlan {
  return summarizeWorldEventRoomPlan;
}
export function getscoreWorldEventNarrativePacketReference(): typeof scoreWorldEventNarrativePacket {
  return scoreWorldEventNarrativePacket;
}
export function getlistWorldEventAnnouncementDigestsReference(): typeof listWorldEventAnnouncementDigests {
  return listWorldEventAnnouncementDigests;
}
export function getlistWorldEventShadowDigestsReference(): typeof listWorldEventShadowDigests {
  return listWorldEventShadowDigests;
}
export function getlistWorldEventVisibleChannelDigestsReference(): typeof listWorldEventVisibleChannelDigests {
  return listWorldEventVisibleChannelDigests;
}
export function getlistWorldEventPlanDigestsReference(): typeof listWorldEventPlanDigests {
  return listWorldEventPlanDigests;
}
export function getlistWorldEventNarrativeScorecardsReference(): typeof listWorldEventNarrativeScorecards {
  return listWorldEventNarrativeScorecards;
}
export function getcollectWorldEventRoomIdsReference(): typeof collectWorldEventRoomIds {
  return collectWorldEventRoomIds;
}
export function getcollectWorldEventPrimaryFactionIdsReference(): typeof collectWorldEventPrimaryFactionIds {
  return collectWorldEventPrimaryFactionIds;
}
export function getcollectWorldEventActiveEventIdsReference(): typeof collectWorldEventActiveEventIds {
  return collectWorldEventActiveEventIds;
}
export function getcollectWorldEventActivationIdsReference(): typeof collectWorldEventActivationIds {
  return collectWorldEventActivationIds;
}
export function getcollectWorldEventDominantChannelsReference(): typeof collectWorldEventDominantChannels {
  return collectWorldEventDominantChannels;
}
export function getcountWorldEventPressureBandsReference(): typeof countWorldEventPressureBands {
  return countWorldEventPressureBands;
}
export function getcountWorldEventAnnouncementStylesReference(): typeof countWorldEventAnnouncementStyles {
  return countWorldEventAnnouncementStyles;
}
export function getcountWorldEventVisibleDispositionReference(): typeof countWorldEventVisibleDisposition {
  return countWorldEventVisibleDisposition;
}
export function getcountWorldEventShadowDispositionReference(): typeof countWorldEventShadowDisposition {
  return countWorldEventShadowDisposition;
}
export function getbuildWorldEventPressureRankingReference(): typeof buildWorldEventPressureRanking {
  return buildWorldEventPressureRanking;
}
export function getbuildWorldEventAnnouncementRankingReference(): typeof buildWorldEventAnnouncementRanking {
  return buildWorldEventAnnouncementRanking;
}
export function getbuildWorldEventShadowRankingReference(): typeof buildWorldEventShadowRanking {
  return buildWorldEventShadowRanking;
}
export function getbuildWorldEventVisibleChannelRankingReference(): typeof buildWorldEventVisibleChannelRanking {
  return buildWorldEventVisibleChannelRanking;
}
export function getcollectWorldEventTagsReference(): typeof collectWorldEventTags {
  return collectWorldEventTags;
}
export function getbuildWorldEventNarrativeHeadlinesReference(): typeof buildWorldEventNarrativeHeadlines {
  return buildWorldEventNarrativeHeadlines;
}
export function getbuildWorldEventSummaryLedgerReference(): typeof buildWorldEventSummaryLedger {
  return buildWorldEventSummaryLedger;
}
export function getbuildWorldEventModeHistogramReference(): typeof buildWorldEventModeHistogram {
  return buildWorldEventModeHistogram;
}
export function getbuildWorldEventFactionHistogramReference(): typeof buildWorldEventFactionHistogram {
  return buildWorldEventFactionHistogram;
}
export function getbuildWorldEventClimateHistogramReference(): typeof buildWorldEventClimateHistogram {
  return buildWorldEventClimateHistogram;
}
export function getbuildWorldEventAnnouncementStyleHistogramReference(): typeof buildWorldEventAnnouncementStyleHistogram {
  return buildWorldEventAnnouncementStyleHistogram;
}
export function getbuildWorldEventDigestStringsReference(): typeof buildWorldEventDigestStrings {
  return buildWorldEventDigestStrings;
}
export function getbuildWorldEventNarrativeDigestStringsReference(): typeof buildWorldEventNarrativeDigestStrings {
  return buildWorldEventNarrativeDigestStrings;
}

export const CHAT_LIVEOPS_OPERATIONAL_LANES = freezeArray([
  freeze({
    laneId: "SCHEDULER_MANIFEST",
    description:
      "Operational lane exported by the sovereign liveops barrel for downstream orchestration, diagnostics, or UI wiring.",
    tags: freezeArray(["liveops", "control-plane", "backend"]),
  }),
  freeze({
    laneId: "SCHEDULER_TIMELINE",
    description:
      "Operational lane exported by the sovereign liveops barrel for downstream orchestration, diagnostics, or UI wiring.",
    tags: freezeArray(["liveops", "control-plane", "backend"]),
  }),
  freeze({
    laneId: "SCHEDULER_PREVIEW",
    description:
      "Operational lane exported by the sovereign liveops barrel for downstream orchestration, diagnostics, or UI wiring.",
    tags: freezeArray(["liveops", "control-plane", "backend"]),
  }),
  freeze({
    laneId: "SCHEDULER_AUDIT",
    description:
      "Operational lane exported by the sovereign liveops barrel for downstream orchestration, diagnostics, or UI wiring.",
    tags: freezeArray(["liveops", "control-plane", "backend"]),
  }),
  freeze({
    laneId: "PLANNER_PRIMARY_FACTION",
    description:
      "Operational lane exported by the sovereign liveops barrel for downstream orchestration, diagnostics, or UI wiring.",
    tags: freezeArray(["liveops", "control-plane", "backend"]),
  }),
  freeze({
    laneId: "PLANNER_NARRATIVE",
    description:
      "Operational lane exported by the sovereign liveops barrel for downstream orchestration, diagnostics, or UI wiring.",
    tags: freezeArray(["liveops", "control-plane", "backend"]),
  }),
  freeze({
    laneId: "PLANNER_AUDIT",
    description:
      "Operational lane exported by the sovereign liveops barrel for downstream orchestration, diagnostics, or UI wiring.",
    tags: freezeArray(["liveops", "control-plane", "backend"]),
  }),
  freeze({
    laneId: "WORLD_VISIBLE",
    description:
      "Operational lane exported by the sovereign liveops barrel for downstream orchestration, diagnostics, or UI wiring.",
    tags: freezeArray(["liveops", "control-plane", "backend"]),
  }),
  freeze({
    laneId: "WORLD_SHADOW",
    description:
      "Operational lane exported by the sovereign liveops barrel for downstream orchestration, diagnostics, or UI wiring.",
    tags: freezeArray(["liveops", "control-plane", "backend"]),
  }),
  freeze({
    laneId: "WORLD_NARRATIVE",
    description:
      "Operational lane exported by the sovereign liveops barrel for downstream orchestration, diagnostics, or UI wiring.",
    tags: freezeArray(["liveops", "control-plane", "backend"]),
  }),
  freeze({
    laneId: "WORLD_DIGEST",
    description:
      "Operational lane exported by the sovereign liveops barrel for downstream orchestration, diagnostics, or UI wiring.",
    tags: freezeArray(["liveops", "control-plane", "backend"]),
  }),
  freeze({
    laneId: "CONTROL_PLANE_DIAGNOSTICS",
    description:
      "Operational lane exported by the sovereign liveops barrel for downstream orchestration, diagnostics, or UI wiring.",
    tags: freezeArray(["liveops", "control-plane", "backend"]),
  }),
]);
export function summarizeChatLiveOpsOperationalLanes(): readonly string[] {
  return freezeArray(CHAT_LIVEOPS_OPERATIONAL_LANES.map((lane) => lane.laneId));
}
export function buildChatLiveOpsOperationalLaneRegistry(): Readonly<
  Record<string, string>
> {
  const registry: Record<string, string> = {};
  for (const lane of CHAT_LIVEOPS_OPERATIONAL_LANES) {
    registry[lane.laneId] = lane.description;
  }
  return freeze(registry);
}
export function buildDefaultChatLiveOpsDiagnostics(
  context: GlobalEventSchedulerEvaluationContext = {},
): ChatLiveOpsDiagnosticsPacket {
  return buildChatLiveOpsDiagnosticsPacket(
    createDefaultChatLiveOpsControlPlane(),
    context,
  );
}
export function buildEmpireChatLiveOpsDiagnostics(
  context: GlobalEventSchedulerEvaluationContext = {},
): ChatLiveOpsDiagnosticsPacket {
  return buildChatLiveOpsDiagnosticsPacket(
    createEmpireChatLiveOpsControlPlane(),
    context,
  );
}
export function buildPredatorChatLiveOpsDiagnostics(
  context: GlobalEventSchedulerEvaluationContext = {},
): ChatLiveOpsDiagnosticsPacket {
  return buildChatLiveOpsDiagnosticsPacket(
    createPredatorChatLiveOpsControlPlane(),
    context,
  );
}
export function buildSyndicateChatLiveOpsDiagnostics(
  context: GlobalEventSchedulerEvaluationContext = {},
): ChatLiveOpsDiagnosticsPacket {
  return buildChatLiveOpsDiagnosticsPacket(
    createSyndicateChatLiveOpsControlPlane(),
    context,
  );
}
export function buildPhantomChatLiveOpsDiagnostics(
  context: GlobalEventSchedulerEvaluationContext = {},
): ChatLiveOpsDiagnosticsPacket {
  return buildChatLiveOpsDiagnosticsPacket(
    createPhantomChatLiveOpsControlPlane(),
    context,
  );
}
export function buildLobbyChatLiveOpsDiagnostics(
  context: GlobalEventSchedulerEvaluationContext = {},
): ChatLiveOpsDiagnosticsPacket {
  return buildChatLiveOpsDiagnosticsPacket(
    createLobbyChatLiveOpsControlPlane(),
    context,
  );
}
export function buildPostRunChatLiveOpsDiagnostics(
  context: GlobalEventSchedulerEvaluationContext = {},
): ChatLiveOpsDiagnosticsPacket {
  return buildChatLiveOpsDiagnosticsPacket(
    createPostRunChatLiveOpsControlPlane(),
    context,
  );
}
