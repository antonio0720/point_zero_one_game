/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT CONTINUITY BARREL
 * FILE: backend/src/game/engine/chat/continuity/index.ts
 * VERSION: 2026.03.23-continuity-barrel.v1
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative export surface for the chat continuity lane.
 * The continuity lane governs cross-mode state persistence: which tensions
 * remain unresolved, which actors stay attached, which reveals are pending,
 * and which relationship vectors are hot enough to survive screen transitions.
 *
 * Subsystems
 * ----------
 * 1. CrossModeContinuityLedger — durable backend record of continuity snapshots,
 *                                mount transitions, and player/room state across
 *                                mode boundaries.
 * 2. CarryoverResolver         — resolves durable continuity into a mount-aware
 *                                carryover package for frontend, transport,
 *                                replay, and orchestration surfaces.
 *
 * Design doctrine
 * ---------------
 * - No UI rendering. No direct socket fanout. Backend authority only.
 * - Both subsystems are independently importable and composable.
 * - CrossModeContinuityLedger and CarryoverResolver share no conflicting
 *   top-level names, so both are flat-exported.
 * - ChatContinuityModule provides the single frozen authority object consumed
 *   by the chat root barrel.
 * ============================================================================
 */

// ============================================================================
// MARK: Namespace imports — both subsystems
// ============================================================================

import * as ContinuityLedger from './CrossModeContinuityLedger';
import * as Carryover from './CarryoverResolver';

// ============================================================================
// MARK: Flat re-exports — both subsystems (no name conflicts)
// ============================================================================

export * from './CrossModeContinuityLedger';
export * from './CarryoverResolver';

// ============================================================================
// MARK: Namespace re-exports
// ============================================================================

export { ContinuityLedger, Carryover };

// ============================================================================
// MARK: Convenience class surface
// ============================================================================

/** Durable backend ledger of cross-mode continuity snapshots and transitions. */
export const CrossModeContinuityLedgerClass = ContinuityLedger.CrossModeContinuityLedger;

/** Resolves durable continuity into a mount-aware carryover package. */
export const CarryoverResolverClass = Carryover.CarryoverResolver;

// ============================================================================
// MARK: Convenience factory surface
// ============================================================================

export const createCrossModeContinuityLedger = ContinuityLedger.createCrossModeContinuityLedger;
export const createCarryoverResolver = Carryover.createCarryoverResolver;

// ============================================================================
// MARK: Default config surface
// ============================================================================

export const DEFAULT_CONTINUITY_LEDGER_CONFIG = ContinuityLedger.DEFAULT_CROSS_MODE_CONTINUITY_LEDGER_CONFIG;
export const DEFAULT_CARRYOVER_RESOLVER_CONFIG = Carryover.DEFAULT_CARRYOVER_RESOLVER_CONFIG;

// ============================================================================
// MARK: Continuity barrel version
// ============================================================================

export const CHAT_CONTINUITY_BARREL_VERSION = '2026.03.23-continuity-barrel.v1' as const;
export const CHAT_CONTINUITY_AUTHORITY = 'BACKEND' as const;

export interface ChatContinuityBarrelMeta {
  readonly version: typeof CHAT_CONTINUITY_BARREL_VERSION;
  readonly authority: typeof CHAT_CONTINUITY_AUTHORITY;
  readonly subsystems: readonly ['CrossModeContinuityLedger', 'CarryoverResolver'];
}

export const CHAT_CONTINUITY_BARREL_META: ChatContinuityBarrelMeta = Object.freeze({
  version: CHAT_CONTINUITY_BARREL_VERSION,
  authority: CHAT_CONTINUITY_AUTHORITY,
  subsystems: ['CrossModeContinuityLedger', 'CarryoverResolver'] as const,
});

// ============================================================================
// MARK: Continuity lane type aliases — CrossModeContinuityLedger
// ============================================================================

export type ContinuityMountTarget = ContinuityLedger.BackendChatMountTarget;
export type ContinuityTemperature = ContinuityLedger.BackendChatContinuityTemperature;
export type ContinuityBand = ContinuityLedger.BackendChatContinuityBand;
export type ContinuityEscortStyle = ContinuityLedger.BackendChatEscortStyle;
export type ContinuityTransitionReason = ContinuityLedger.BackendChatTransitionReason;
export type ContinuityMountPreset = ContinuityLedger.BackendChatMountPreset;
export type ContinuityRelationshipDigest = ContinuityLedger.BackendChatContinuityRelationshipDigest;
export type ContinuityActorCue = ContinuityLedger.BackendChatContinuityActorCue;
export type ContinuitySessionCue = ContinuityLedger.BackendChatContinuitySessionCue;
export type ContinuityRevealCue = ContinuityLedger.BackendChatContinuityRevealCue;
export type ContinuityTranscriptCue = ContinuityLedger.BackendChatContinuityTranscriptCue;
export type ContinuityMomentCue = ContinuityLedger.BackendChatContinuityMomentCue;
export type ContinuityOverlayState = ContinuityLedger.BackendChatContinuityOverlayState;
export type ContinuityRoomSnapshot = ContinuityLedger.BackendChatRoomContinuitySnapshot;
export type ContinuityPlayerState = ContinuityLedger.BackendChatPlayerContinuityState;
export type ContinuityMountTransitionRecord = ContinuityLedger.BackendChatMountTransitionRecord;
export type ContinuityLedgerSnapshot = ContinuityLedger.BackendChatContinuityLedgerSnapshot;
export type ContinuityLedgerConfig = ContinuityLedger.CrossModeContinuityLedgerConfig;

// ============================================================================
// MARK: Continuity lane type aliases — CarryoverResolver
// ============================================================================

export type CarryoverSceneEntry = Carryover.CarryoverSceneEntryMode;
export type CarryoverRevealWindow = Carryover.CarryoverRevealWindowClass;
export type CarryoverOverlayStrategy = Carryover.CarryoverOverlayStrategy;
export type CarryoverHealth = Carryover.CarryoverContinuityHealth;
export type CarryoverEscortDirective = Carryover.CarryoverEscortDirective;
export type CarryoverRelationshipDirective = Carryover.CarryoverRelationshipDirective;
export type CarryoverRevealDirective = Carryover.CarryoverRevealDirective;
export type CarryoverOverlayDirective = Carryover.CarryoverOverlayDirective;
export type CarryoverTransportHint = Carryover.CarryoverTransportHint;
export type CarryoverMetrics = Carryover.CarryoverMetrics;
export type CarryoverFrontendPatch = Carryover.CarryoverFrontendPatch;
export type CarryoverServerEnvelope = Carryover.CarryoverServerEnvelope;
export type CarryoverResolution = Carryover.CarryoverResolution;
export type CarryoverResolveArgs = Carryover.ResolveCarryoverArgs;
export type CarryoverResolverConfig = Carryover.CarryoverResolverConfig;

// ============================================================================
// MARK: Continuity lane readiness
// ============================================================================

export interface ChatContinuityLaneReadiness {
  readonly crossModeContinuityLedger: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly carryoverResolver: 'GENERATED' | 'PENDING' | 'PLANNED';
}

export const CHAT_CONTINUITY_LANE_READINESS: ChatContinuityLaneReadiness = Object.freeze({
  crossModeContinuityLedger: 'GENERATED',
  carryoverResolver: 'GENERATED',
});

// ============================================================================
// MARK: Continuity lane module descriptor table
// ============================================================================

export interface ChatContinuityModuleDescriptor {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly category: 'LEDGER' | 'RESOLVER';
  readonly readiness: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly ownsTruth: boolean;
  readonly description: string;
  readonly primaryClass: string;
  readonly factoryFn: string;
}

export const CHAT_CONTINUITY_MODULE_DESCRIPTORS: readonly ChatContinuityModuleDescriptor[] =
  Object.freeze([
    {
      id: 'cross-mode-continuity-ledger',
      name: 'CrossModeContinuityLedger',
      file: 'continuity/CrossModeContinuityLedger.ts',
      category: 'LEDGER',
      readiness: 'GENERATED',
      ownsTruth: true,
      description:
        'Durable backend record of continuity snapshots, mount transitions, and player/room state across mode boundaries.',
      primaryClass: 'CrossModeContinuityLedger',
      factoryFn: 'createCrossModeContinuityLedger',
    },
    {
      id: 'carryover-resolver',
      name: 'CarryoverResolver',
      file: 'continuity/CarryoverResolver.ts',
      category: 'RESOLVER',
      readiness: 'GENERATED',
      ownsTruth: true,
      description:
        'Resolves durable continuity into a mount-aware carryover package. Ranks escorts, reveals, and relationships.',
      primaryClass: 'CarryoverResolver',
      factoryFn: 'createCarryoverResolver',
    },
  ]);

export function continuityModuleDescriptorById(
  id: string,
): ChatContinuityModuleDescriptor | undefined {
  return CHAT_CONTINUITY_MODULE_DESCRIPTORS.find((m) => m.id === id);
}

// ============================================================================
// MARK: Continuity temperature helpers
// ============================================================================

export const CONTINUITY_TEMPERATURES = Object.freeze([
  'COOL',
  'STEADY',
  'TENSE',
  'PRESSURED',
  'HOSTILE',
] as const);

export function continuityTemperatureIsElevated(temp: ContinuityTemperature): boolean {
  return temp === 'PRESSURED' || temp === 'HOSTILE';
}

export function continuityTemperatureIsCalm(temp: ContinuityTemperature): boolean {
  return temp === 'COOL' || temp === 'STEADY';
}

export function continuityTemperatureWeight(temp: ContinuityTemperature): number {
  switch (temp) {
    case 'HOSTILE': return 1.0;
    case 'PRESSURED': return 0.80;
    case 'TENSE': return 0.60;
    case 'STEADY': return 0.35;
    case 'COOL': return 0.15;
    default: return 0.3;
  }
}

export function continuityTemperatureFrom01(pressure01: number): ContinuityTemperature {
  if (pressure01 >= 0.82) return 'HOSTILE';
  if (pressure01 >= 0.65) return 'PRESSURED';
  if (pressure01 >= 0.45) return 'TENSE';
  if (pressure01 >= 0.25) return 'STEADY';
  return 'COOL';
}

// ============================================================================
// MARK: Continuity band helpers
// ============================================================================

export const CONTINUITY_BANDS = Object.freeze([
  'DORMANT',
  'LOW',
  'WARM',
  'HOT',
  'VOLATILE',
  'CRITICAL',
] as const);

export function continuityBandIsActive(band: ContinuityBand): boolean {
  return band === 'HOT' || band === 'VOLATILE' || band === 'CRITICAL';
}

export function continuityBandRequiresCarryover(band: ContinuityBand): boolean {
  return band !== 'DORMANT';
}

export function continuityBandWeight(band: ContinuityBand): number {
  switch (band) {
    case 'CRITICAL': return 1.0;
    case 'VOLATILE': return 0.88;
    case 'HOT': return 0.72;
    case 'WARM': return 0.52;
    case 'LOW': return 0.28;
    case 'DORMANT': return 0.05;
    default: return 0.3;
  }
}

export function continuityBandFrom01(intensity01: number): ContinuityBand {
  if (intensity01 >= 0.90) return 'CRITICAL';
  if (intensity01 >= 0.75) return 'VOLATILE';
  if (intensity01 >= 0.55) return 'HOT';
  if (intensity01 >= 0.35) return 'WARM';
  if (intensity01 >= 0.15) return 'LOW';
  return 'DORMANT';
}

// ============================================================================
// MARK: Continuity escort style helpers
// ============================================================================

export const CONTINUITY_ESCORT_STYLES = Object.freeze([
  'VISIBLE_ESCORT',
  'SHADOW_ESCORT',
  'SILENT_WATCH',
  'PREDATOR_STALK',
  'NONE',
] as const);

export function continuityEscortStyleIsVisible(style: ContinuityEscortStyle): boolean {
  return style === 'VISIBLE_ESCORT';
}

export function continuityEscortStyleIsHostile(style: ContinuityEscortStyle): boolean {
  return style === 'PREDATOR_STALK';
}

export function continuityEscortStylePressureWeight(style: ContinuityEscortStyle): number {
  switch (style) {
    case 'PREDATOR_STALK': return 0.95;
    case 'VISIBLE_ESCORT': return 0.7;
    case 'SHADOW_ESCORT': return 0.55;
    case 'SILENT_WATCH': return 0.35;
    case 'NONE': return 0.0;
    default: return 0.0;
  }
}

// ============================================================================
// MARK: Continuity mount target helpers
// ============================================================================

export const CONTINUITY_MOUNT_TARGETS = ContinuityLedger.BACKEND_CHAT_CONTINUITY_MOUNT_TARGETS;
export const CONTINUITY_MOUNT_PRESETS = ContinuityLedger.BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS;

export function continuityMountTargetIsChat(target: ContinuityMountTarget): boolean {
  return typeof target === 'string' && target.toLowerCase().includes('chat');
}

export function continuityMountPresetFor(target: ContinuityMountTarget): ContinuityMountPreset {
  return CONTINUITY_MOUNT_PRESETS[target];
}

// ============================================================================
// MARK: Continuity health helpers
// ============================================================================

export function carryoverHealthIsStable(health: CarryoverHealth): boolean {
  return health === 'STABLE';
}

export function carryoverHealthIsActive(health: CarryoverHealth): boolean {
  return health === 'ACTIVE' || health === 'CRITICAL';
}

export function carryoverHealthWeight(health: CarryoverHealth): number {
  switch (health) {
    case 'CRITICAL': return 1.0;
    case 'ACTIVE': return 0.75;
    case 'WATCH': return 0.45;
    case 'STABLE': return 0.1;
    default: return 0.1;
  }
}

// ============================================================================
// MARK: Continuity run state
// ============================================================================

export interface ContinuityRunState {
  readonly runId: string;
  readonly capturedAtMs: number;
  readonly temperature: ContinuityTemperature;
  readonly band: ContinuityBand;
  readonly carryoverHealth: CarryoverHealth;
  readonly activeMountTarget: ContinuityMountTarget | null;
  readonly escortStyle: ContinuityEscortStyle;
  readonly pendingRevealCount: number;
  readonly hotRelationshipCount: number;
  readonly transitionCount: number;
  readonly overlayActive: boolean;
}

export function buildContinuityRunStateShell(
  runId: string,
  nowMs: number,
  mountTarget: ContinuityMountTarget | null,
): ContinuityRunState {
  return Object.freeze({
    runId,
    capturedAtMs: nowMs,
    temperature: 'COOL',
    band: 'DORMANT',
    carryoverHealth: 'STABLE',
    activeMountTarget: mountTarget,
    escortStyle: 'NONE',
    pendingRevealCount: 0,
    hotRelationshipCount: 0,
    transitionCount: 0,
    overlayActive: false,
  });
}

export function continuityRunStateIsLive(state: ContinuityRunState): boolean {
  return continuityBandIsActive(state.band) || state.pendingRevealCount > 0;
}

export function continuityRunStateNeedsCarryover(state: ContinuityRunState): boolean {
  return continuityBandRequiresCarryover(state.band);
}

export function describeContinuityRunState(state: ContinuityRunState): string {
  return (
    `[continuity:${state.runId}] temp=${state.temperature} band=${state.band} ` +
    `health=${state.carryoverHealth} reveals=${state.pendingRevealCount} ` +
    `relationships=${state.hotRelationshipCount}`
  );
}

// ============================================================================
// MARK: Continuity actor cue helpers
// ============================================================================

export function continuityActorCueIsEscort(cue: ContinuityActorCue): boolean {
  return continuityEscortStyleIsVisible(cue.escortStyle as ContinuityEscortStyle);
}

export function continuityActorCueIsHostile(cue: ContinuityActorCue): boolean {
  return continuityEscortStyleIsHostile(cue.escortStyle as ContinuityEscortStyle);
}

export function sortActorCuesByIntensityDesc(
  cues: readonly ContinuityActorCue[],
): ContinuityActorCue[] {
  return [...cues].sort((a, b) => b.intensity01 - a.intensity01);
}

export function filterActiveActorCues(
  cues: readonly ContinuityActorCue[],
): ContinuityActorCue[] {
  return cues.filter((c) => c.intensity01 > 0.1);
}

export function topNActorCues(
  cues: readonly ContinuityActorCue[],
  n: number,
): ContinuityActorCue[] {
  return sortActorCuesByIntensityDesc(filterActiveActorCues(cues)).slice(0, n);
}

// ============================================================================
// MARK: Continuity reveal cue helpers
// ============================================================================

export function continuityRevealCueIsUrgent(cue: ContinuityRevealCue): boolean {
  return (cue.urgency01 ?? 0) >= 0.75;
}

export function sortRevealCuesByUrgencyDesc(
  cues: readonly ContinuityRevealCue[],
): ContinuityRevealCue[] {
  return [...cues].sort((a, b) => (b.urgency01 ?? 0) - (a.urgency01 ?? 0));
}

export function filterUrgentRevealCues(
  cues: readonly ContinuityRevealCue[],
): ContinuityRevealCue[] {
  return cues.filter(continuityRevealCueIsUrgent);
}

// ============================================================================
// MARK: Continuity room snapshot helpers
// ============================================================================

export function continuityRoomSnapshotIsHot(snapshot: ContinuityRoomSnapshot): boolean {
  return continuityBandIsActive(snapshot.continuityBand as ContinuityBand);
}

export function continuityRoomSnapshotNeedsTransition(snapshot: ContinuityRoomSnapshot): boolean {
  return continuityTemperatureIsElevated(snapshot.temperature as ContinuityTemperature);
}

export function describeRoomSnapshot(snapshot: ContinuityRoomSnapshot): string {
  return (
    `[room:${snapshot.roomId}] band=${snapshot.continuityBand} temp=${snapshot.temperature} ` +
    `reveals=${snapshot.revealCues?.length ?? 0} actors=${snapshot.actorCues?.length ?? 0}`
  );
}

// ============================================================================
// MARK: Continuity carryover resolution helpers
// ============================================================================

export function carryoverResolutionHasEscort(resolution: CarryoverResolution): boolean {
  return (resolution.escorts?.length ?? 0) > 0;
}

export function carryoverResolutionHasPendingReveals(resolution: CarryoverResolution): boolean {
  return (resolution.reveals?.length ?? 0) > 0;
}

export function carryoverResolutionHasActiveOverlay(resolution: CarryoverResolution): boolean {
  return resolution.overlay?.isActive ?? false;
}

export function carryoverResolutionIsLiveCarryover(resolution: CarryoverResolution): boolean {
  return (
    carryoverResolutionHasEscort(resolution) ||
    carryoverResolutionHasPendingReveals(resolution) ||
    carryoverResolutionHasActiveOverlay(resolution)
  );
}

export function describeCarryoverResolution(resolution: CarryoverResolution): string {
  return (
    `[carryover] health=${resolution.health} escorts=${resolution.escorts?.length ?? 0} ` +
    `reveals=${resolution.reveals?.length ?? 0} overlay=${resolution.overlay?.isActive ?? false}`
  );
}

// ============================================================================
// MARK: Continuity mount transition helpers
// ============================================================================

export function continuityMountTransitionIsRecent(
  record: ContinuityMountTransitionRecord,
  nowMs: number,
  windowMs = 15000,
): boolean {
  return nowMs - record.transitionedAtMs < windowMs;
}

export function continuityMountTransitionWasForced(
  record: ContinuityMountTransitionRecord,
): boolean {
  return record.reason === 'FORCED' || record.reason === 'COMBAT_EXIT';
}

export function sortMountTransitionsByRecencyDesc(
  records: readonly ContinuityMountTransitionRecord[],
): ContinuityMountTransitionRecord[] {
  return [...records].sort((a, b) => b.transitionedAtMs - a.transitionedAtMs);
}

export function getMostRecentMountTransition(
  records: readonly ContinuityMountTransitionRecord[],
): ContinuityMountTransitionRecord | null {
  return sortMountTransitionsByRecencyDesc(records)[0] ?? null;
}

// ============================================================================
// MARK: Continuity lane health monitor
// ============================================================================

export type ContinuityLaneHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';

export interface ContinuityLaneHealth {
  readonly status: ContinuityLaneHealthStatus;
  readonly bandActive: boolean;
  readonly temperatureElevated: boolean;
  readonly carryoverHealthCritical: boolean;
  readonly pendingRevealOverflow: boolean;
  readonly issues: readonly string[];
  readonly capturedAtMs: number;
}

export function buildContinuityLaneHealth(state: ContinuityRunState): ContinuityLaneHealth {
  const issues: string[] = [];
  const bandActive = continuityBandIsActive(state.band);
  const temperatureElevated = continuityTemperatureIsElevated(state.temperature);
  const carryoverHealthCritical = state.carryoverHealth === 'CRITICAL';
  const pendingRevealOverflow = state.pendingRevealCount > 8;

  if (carryoverHealthCritical) issues.push(`carryoverHealth=CRITICAL`);
  if (pendingRevealOverflow) issues.push(`pendingReveals=${state.pendingRevealCount}`);
  if (temperatureElevated && bandActive) issues.push(`temperature=${state.temperature} band=${state.band}`);

  const status: ContinuityLaneHealthStatus =
    issues.length === 0 ? 'HEALTHY' : issues.length === 1 ? 'DEGRADED' : 'CRITICAL';

  return Object.freeze({
    status,
    bandActive,
    temperatureElevated,
    carryoverHealthCritical,
    pendingRevealOverflow,
    issues: Object.freeze(issues),
    capturedAtMs: state.capturedAtMs,
  });
}

export function continuityLaneIsHealthy(health: ContinuityLaneHealth): boolean {
  return health.status === 'HEALTHY';
}

export function describeContinuityLaneHealth(health: ContinuityLaneHealth): string {
  return `[continuity-health:${health.status}] band=${health.bandActive} temp=${health.temperatureElevated} issues=${health.issues.length}`;
}

// ============================================================================
// MARK: Continuity lane audit entry
// ============================================================================

export interface ContinuityLaneAuditEntry {
  readonly subsystem: 'CrossModeContinuityLedger' | 'CarryoverResolver';
  readonly eventKind: string;
  readonly runId: string;
  readonly summary: string;
  readonly band: ContinuityBand;
  readonly temperature: ContinuityTemperature;
  readonly timestampMs: number;
}

export function buildLedgerAuditEntry(
  runId: string,
  eventKind: string,
  band: ContinuityBand,
  temperature: ContinuityTemperature,
  summary: string,
  nowMs: number,
): ContinuityLaneAuditEntry {
  return Object.freeze({
    subsystem: 'CrossModeContinuityLedger' as const,
    eventKind,
    runId,
    summary,
    band,
    temperature,
    timestampMs: nowMs,
  });
}

export function buildCarryoverAuditEntry(
  runId: string,
  resolution: CarryoverResolution,
  nowMs: number,
): ContinuityLaneAuditEntry {
  return Object.freeze({
    subsystem: 'CarryoverResolver' as const,
    eventKind: 'CARRYOVER_RESOLVED',
    runId,
    summary: describeCarryoverResolution(resolution),
    band: continuityBandFrom01(carryoverHealthWeight(resolution.health)),
    temperature: continuityTemperatureFrom01(carryoverHealthWeight(resolution.health)),
    timestampMs: nowMs,
  });
}

// ============================================================================
// MARK: Continuity lane doctrine
// ============================================================================

export const CHAT_CONTINUITY_DOCTRINE = Object.freeze({
  version: CHAT_CONTINUITY_BARREL_VERSION,
  rules: Object.freeze([
    'Continuity comes from backend state, not UI memory.',
    'The resolver is mode-aware but never mode-coupled to donor zones.',
    'Escorts, reveals, and relationships are ranked, not merely copied.',
    'Overlay recovery is deliberate, not an accidental side effect.',
    'Server envelopes carry explanation, not just raw identifiers.',
    'Debug notes must explain why continuity moved, not only that it moved.',
    'Not every room transition deserves carryover — entropy matters.',
    'Unresolved tensions compound. The ledger must cap and decay stale entries.',
    'Relationship vectors that cross temperature=HOSTILE deserve priority carryover.',
    'Pending reveals must not be silently dropped on mode transition.',
  ] as const),
  subsystemWeights: Object.freeze({
    LEDGER: 0.55,
    RESOLVER: 0.45,
  }),
} as const);

// ============================================================================
// MARK: Continuity lane coverage report
// ============================================================================

export interface ChatContinuityCoverageReport {
  readonly totalModules: number;
  readonly generatedModules: number;
  readonly mountTargetsSupported: number;
  readonly temperaturesSupported: number;
  readonly bandsSupported: number;
  readonly escortStylesSupported: number;
}

export function buildContinuityCoverageReport(): ChatContinuityCoverageReport {
  return Object.freeze({
    totalModules: CHAT_CONTINUITY_MODULE_DESCRIPTORS.length,
    generatedModules: CHAT_CONTINUITY_MODULE_DESCRIPTORS.filter((d) => d.readiness === 'GENERATED').length,
    mountTargetsSupported: CONTINUITY_MOUNT_TARGETS.length,
    temperaturesSupported: CONTINUITY_TEMPERATURES.length,
    bandsSupported: CONTINUITY_BANDS.length,
    escortStylesSupported: CONTINUITY_ESCORT_STYLES.length,
  });
}

// ============================================================================
// MARK: Continuity lane constants
// ============================================================================

export const CONTINUITY_LANE_CONSTANTS = Object.freeze({
  MAX_PENDING_REVEALS_BEFORE_OVERFLOW: 8,
  MAX_HOT_RELATIONSHIPS_PER_RUN: 12,
  MAX_MOUNT_TRANSITIONS_PER_SESSION: 20,
  RELATIONSHIP_CARRYOVER_INTENSITY_THRESHOLD_01: 0.35,
  ACTOR_CUE_MINIMUM_INTENSITY_01: 0.10,
  REVEAL_URGENCY_CRITICAL_THRESHOLD_01: 0.75,
  CONTINUITY_DECAY_INTERVAL_MS: 30000,
  TRANSITION_RECENCY_WINDOW_MS: 15000,
  DORMANT_BAND_DECAY_MS: 60000,
} as const);

// ============================================================================
// MARK: Continuity lane gating authority
// ============================================================================

/**
 * Returns whether the continuity lane should hold output until carryover resolves.
 */
export function continuityLaneShouldHoldOutput(state: ContinuityRunState): boolean {
  return (
    state.pendingRevealCount > 0 &&
    continuityTemperatureIsElevated(state.temperature)
  );
}

/**
 * Returns whether a new mount transition should trigger full carryover resolution.
 */
export function continuityLaneMountTransitionNeedsCarryover(
  state: ContinuityRunState,
): boolean {
  return continuityBandRequiresCarryover(state.band) || state.pendingRevealCount > 0;
}

/**
 * Returns whether the continuity lane should emit an escort signal.
 */
export function continuityLaneShouldEmitEscort(state: ContinuityRunState): boolean {
  return (
    state.escortStyle !== 'NONE' &&
    continuityEscortStylePressureWeight(state.escortStyle) > 0
  );
}

// ============================================================================
// MARK: Continuity lane multi-snapshot aggregator
// ============================================================================

export interface ContinuityMultiSnapshotSummary {
  readonly snapshotCount: number;
  readonly averageBandWeight: number;
  readonly peakTemperature: ContinuityTemperature;
  readonly totalPendingReveals: number;
  readonly hotSnapshotCount: number;
  readonly anyOverlayActive: boolean;
}

export function summarizeContinuitySnapshots(
  snapshots: readonly ContinuityRoomSnapshot[],
): ContinuityMultiSnapshotSummary {
  if (snapshots.length === 0) {
    return Object.freeze({
      snapshotCount: 0,
      averageBandWeight: 0,
      peakTemperature: 'COOL',
      totalPendingReveals: 0,
      hotSnapshotCount: 0,
      anyOverlayActive: false,
    });
  }

  const bandWeights = snapshots.map((s) =>
    continuityBandWeight(s.continuityBand as ContinuityBand),
  );
  const avgBand = bandWeights.reduce((a, b) => a + b, 0) / bandWeights.length;

  const temperatures = snapshots.map((s) => s.temperature as ContinuityTemperature);
  const tempWeights = temperatures.map(continuityTemperatureWeight);
  const peakIdx = tempWeights.indexOf(Math.max(...tempWeights));
  const peakTemperature = temperatures[peakIdx] ?? 'COOL';

  return Object.freeze({
    snapshotCount: snapshots.length,
    averageBandWeight: avgBand,
    peakTemperature,
    totalPendingReveals: snapshots.reduce((s, ss) => s + (ss.revealCues?.length ?? 0), 0),
    hotSnapshotCount: snapshots.filter(continuityRoomSnapshotIsHot).length,
    anyOverlayActive: snapshots.some((s) => s.overlayState?.isActive ?? false),
  });
}

// ============================================================================
// MARK: Continuity lane session summary
// ============================================================================

export interface ContinuitySessionSummary {
  readonly runId: string;
  readonly totalTransitions: number;
  readonly forcedTransitions: number;
  readonly peakBand: ContinuityBand;
  readonly peakTemperature: ContinuityTemperature;
  readonly totalResolvedCarryovers: number;
  readonly totalLegendEscorts: number;
  readonly averageCarryoverHealthWeight: number;
}

export function buildContinuitySessionSummaryShell(runId: string): ContinuitySessionSummary {
  return Object.freeze({
    runId,
    totalTransitions: 0,
    forcedTransitions: 0,
    peakBand: 'DORMANT',
    peakTemperature: 'COOL',
    totalResolvedCarryovers: 0,
    totalLegendEscorts: 0,
    averageCarryoverHealthWeight: 0,
  });
}

export function describeContinuitySessionSummary(summary: ContinuitySessionSummary): string {
  return (
    `[continuity-session:${summary.runId}] transitions=${summary.totalTransitions} ` +
    `forced=${summary.forcedTransitions} peakBand=${summary.peakBand} ` +
    `peakTemp=${summary.peakTemperature} carryovers=${summary.totalResolvedCarryovers}`
  );
}

// ============================================================================
// MARK: ChatContinuityModule — unified frozen authority object
// ============================================================================

export const ChatContinuityModule = Object.freeze({
  version: CHAT_CONTINUITY_BARREL_VERSION,

  // Subsystem namespaces
  ContinuityLedger,
  Carryover,

  // Class references
  CrossModeContinuityLedgerClass,
  CarryoverResolverClass,

  // Factory references
  createCrossModeContinuityLedger,
  createCarryoverResolver,

  // Default configs
  DEFAULT_CONTINUITY_LEDGER_CONFIG,
  DEFAULT_CARRYOVER_RESOLVER_CONFIG,

  // Mount surface
  CONTINUITY_MOUNT_TARGETS,
  CONTINUITY_MOUNT_PRESETS,
  continuityMountTargetIsChat,
  continuityMountPresetFor,

  // Temperature helpers
  CONTINUITY_TEMPERATURES,
  continuityTemperatureIsElevated,
  continuityTemperatureIsCalm,
  continuityTemperatureWeight,
  continuityTemperatureFrom01,

  // Band helpers
  CONTINUITY_BANDS,
  continuityBandIsActive,
  continuityBandRequiresCarryover,
  continuityBandWeight,
  continuityBandFrom01,

  // Escort style helpers
  CONTINUITY_ESCORT_STYLES,
  continuityEscortStyleIsVisible,
  continuityEscortStyleIsHostile,
  continuityEscortStylePressureWeight,

  // Health helpers
  carryoverHealthIsStable,
  carryoverHealthIsActive,
  carryoverHealthWeight,

  // Run state
  buildContinuityRunStateShell,
  continuityRunStateIsLive,
  continuityRunStateNeedsCarryover,
  describeContinuityRunState,

  // Actor cue helpers
  continuityActorCueIsEscort,
  continuityActorCueIsHostile,
  sortActorCuesByIntensityDesc,
  filterActiveActorCues,
  topNActorCues,

  // Reveal cue helpers
  continuityRevealCueIsUrgent,
  sortRevealCuesByUrgencyDesc,
  filterUrgentRevealCues,

  // Room snapshot helpers
  continuityRoomSnapshotIsHot,
  continuityRoomSnapshotNeedsTransition,
  describeRoomSnapshot,

  // Carryover resolution helpers
  carryoverResolutionHasEscort,
  carryoverResolutionHasPendingReveals,
  carryoverResolutionHasActiveOverlay,
  carryoverResolutionIsLiveCarryover,
  describeCarryoverResolution,

  // Mount transition helpers
  continuityMountTransitionIsRecent,
  continuityMountTransitionWasForced,
  sortMountTransitionsByRecencyDesc,
  getMostRecentMountTransition,

  // Health monitor
  buildContinuityLaneHealth,
  continuityLaneIsHealthy,
  describeContinuityLaneHealth,

  // Audit builders
  buildLedgerAuditEntry,
  buildCarryoverAuditEntry,

  // Multi-snapshot aggregator
  summarizeContinuitySnapshots,

  // Session summary
  buildContinuitySessionSummaryShell,
  describeContinuitySessionSummary,

  // Coverage report
  buildContinuityCoverageReport,

  // Gating authority
  continuityLaneShouldHoldOutput,
  continuityLaneMountTransitionNeedsCarryover,
  continuityLaneShouldEmitEscort,

  // Registries and constants
  CONTINUITY_LANE_CONSTANTS,
  CHAT_CONTINUITY_DOCTRINE,
  CHAT_CONTINUITY_MODULE_DESCRIPTORS,
  CHAT_CONTINUITY_LANE_READINESS,

  // Barrel meta
  meta: CHAT_CONTINUITY_BARREL_META,
});

// ============================================================================
// MARK: Continuity server envelope helpers
// ============================================================================

export function carryoverServerEnvelopeIsExplained(envelope: CarryoverServerEnvelope): boolean {
  return typeof envelope.explanation === 'string' && envelope.explanation.length > 0;
}

export function carryoverServerEnvelopeIsUrgent(envelope: CarryoverServerEnvelope): boolean {
  return (envelope.urgency01 ?? 0) >= CONTINUITY_LANE_CONSTANTS.REVEAL_URGENCY_CRITICAL_THRESHOLD_01;
}

export function describeCarryoverServerEnvelope(envelope: CarryoverServerEnvelope): string {
  const urgent = carryoverServerEnvelopeIsUrgent(envelope) ? ' URGENT' : '';
  return `[envelope] urgency=${(envelope.urgency01 ?? 0).toFixed(2)}${urgent} explanation=${envelope.explanation ?? 'NONE'}`;
}

// ============================================================================
// MARK: Continuity transport hint helpers
// ============================================================================

export function carryoverTransportHintRequiresImmediateDelivery(hint: CarryoverTransportHint): boolean {
  return hint.priority === 'IMMEDIATE';
}

export function carryoverTransportHintCanDefer(hint: CarryoverTransportHint): boolean {
  return hint.priority === 'DEFERRED' || hint.priority === 'LOW';
}

export function describeCarryoverTransportHint(hint: CarryoverTransportHint): string {
  return `[transport] priority=${hint.priority} channel=${hint.channel ?? 'DEFAULT'}`;
}

// ============================================================================
// MARK: Continuity metrics helpers
// ============================================================================

export function carryoverMetricsIsHealthy(metrics: CarryoverMetrics): boolean {
  return (metrics.failedCues ?? 0) === 0 && (metrics.droppedReveals ?? 0) === 0;
}

export function carryoverMetricsHasDrop(metrics: CarryoverMetrics): boolean {
  return (metrics.droppedReveals ?? 0) > 0;
}

export function carryoverMetricsTotalCues(metrics: CarryoverMetrics): number {
  return (metrics.actorCues ?? 0) + (metrics.revealCues ?? 0) + (metrics.transcriptCues ?? 0);
}

export function describeCarryoverMetrics(metrics: CarryoverMetrics): string {
  const total = carryoverMetricsTotalCues(metrics);
  const dropped = metrics.droppedReveals ?? 0;
  const failed = metrics.failedCues ?? 0;
  return `[metrics] total=${total} dropped=${dropped} failed=${failed}`;
}

// ============================================================================
// MARK: Continuity frontend patch helpers
// ============================================================================

export function carryoverFrontendPatchHasOverlayUpdate(patch: CarryoverFrontendPatch): boolean {
  return patch.overlayUpdate != null;
}

export function carryoverFrontendPatchHasRelationshipUpdate(patch: CarryoverFrontendPatch): boolean {
  return (patch.relationshipUpdates?.length ?? 0) > 0;
}

export function carryoverFrontendPatchHasEscortUpdate(patch: CarryoverFrontendPatch): boolean {
  return (patch.escortUpdates?.length ?? 0) > 0;
}

export function carryoverFrontendPatchIsEmpty(patch: CarryoverFrontendPatch): boolean {
  return (
    !carryoverFrontendPatchHasOverlayUpdate(patch) &&
    !carryoverFrontendPatchHasRelationshipUpdate(patch) &&
    !carryoverFrontendPatchHasEscortUpdate(patch)
  );
}

// ============================================================================
// MARK: Continuity directive builders
// ============================================================================

export interface ContinuityDirectiveSummary {
  readonly escortCount: number;
  readonly relationshipCount: number;
  readonly revealCount: number;
  readonly overlayStrategyCount: number;
  readonly totalDirectives: number;
  readonly hasUrgentReveals: boolean;
  readonly hasHostileEscorts: boolean;
}

export function buildContinuityDirectiveSummary(
  escorts: readonly CarryoverEscortDirective[],
  relationships: readonly CarryoverRelationshipDirective[],
  reveals: readonly CarryoverRevealDirective[],
  overlayDirectives: readonly CarryoverOverlayDirective[],
): ContinuityDirectiveSummary {
  const hasUrgentReveals = reveals.some((r) => (r.urgency01 ?? 0) >= 0.75);
  const hasHostileEscorts = escorts.some((e) =>
    continuityEscortStyleIsHostile(e.style as ContinuityEscortStyle),
  );

  return Object.freeze({
    escortCount: escorts.length,
    relationshipCount: relationships.length,
    revealCount: reveals.length,
    overlayStrategyCount: overlayDirectives.length,
    totalDirectives: escorts.length + relationships.length + reveals.length + overlayDirectives.length,
    hasUrgentReveals,
    hasHostileEscorts,
  });
}

export function continuityDirectiveSummaryIsNonTrivial(summary: ContinuityDirectiveSummary): boolean {
  return summary.totalDirectives > 0;
}

export function describeContinuityDirectiveSummary(summary: ContinuityDirectiveSummary): string {
  return (
    `[directives] total=${summary.totalDirectives} escorts=${summary.escortCount} ` +
    `reveals=${summary.revealCount} urgentReveals=${summary.hasUrgentReveals} ` +
    `hostileEscorts=${summary.hasHostileEscorts}`
  );
}

// ============================================================================
// MARK: Continuity lane player state helpers
// ============================================================================

export function continuityPlayerStateHasActiveRelationships(
  state: ContinuityPlayerState,
): boolean {
  return (state.hotRelationships?.length ?? 0) > 0;
}

export function continuityPlayerStateHasPendingReveals(
  state: ContinuityPlayerState,
): boolean {
  return (state.pendingReveals?.length ?? 0) > 0;
}

export function continuityPlayerStateIsLive(state: ContinuityPlayerState): boolean {
  return (
    continuityPlayerStateHasActiveRelationships(state) ||
    continuityPlayerStateHasPendingReveals(state)
  );
}

export function describePlayerContinuityState(state: ContinuityPlayerState): string {
  return (
    `[player:${state.playerId}] relationships=${state.hotRelationships?.length ?? 0} ` +
    `reveals=${state.pendingReveals?.length ?? 0} ` +
    `band=${state.continuityBand ?? 'UNKNOWN'}`
  );
}

// ============================================================================
// MARK: Continuity multi-carryover batch helpers
// ============================================================================

export interface ContinuityCarryoverBatchResult {
  readonly totalCarryovers: number;
  readonly liveCarryovers: number;
  readonly totalEscorts: number;
  readonly totalReveals: number;
  readonly urgentRevealCarryovers: number;
  readonly criticalHealthCarryovers: number;
  readonly allHealthy: boolean;
}

export function buildContinuityCarryoverBatchResult(
  resolutions: readonly CarryoverResolution[],
): ContinuityCarryoverBatchResult {
  const live = resolutions.filter(carryoverResolutionIsLiveCarryover);
  const totalEscorts = resolutions.reduce((s, r) => s + (r.escorts?.length ?? 0), 0);
  const totalReveals = resolutions.reduce((s, r) => s + (r.reveals?.length ?? 0), 0);
  const urgentRevealCarryovers = resolutions.filter(
    (r) => (r.reveals?.some((rv) => (rv.urgency01 ?? 0) >= 0.75)) ?? false,
  ).length;
  const criticalHealthCarryovers = resolutions.filter(
    (r) => r.health === 'CRITICAL',
  ).length;

  return Object.freeze({
    totalCarryovers: resolutions.length,
    liveCarryovers: live.length,
    totalEscorts,
    totalReveals,
    urgentRevealCarryovers,
    criticalHealthCarryovers,
    allHealthy: criticalHealthCarryovers === 0,
  });
}

export function describeContinuityCarryoverBatch(batch: ContinuityCarryoverBatchResult): string {
  return (
    `[batch] total=${batch.totalCarryovers} live=${batch.liveCarryovers} ` +
    `escorts=${batch.totalEscorts} reveals=${batch.totalReveals} ` +
    `criticalHealth=${batch.criticalHealthCarryovers}`
  );
}

// ============================================================================
// MARK: Continuity-combat integration
// ============================================================================

export interface ContinuityCombatIntegration {
  readonly fightId: string;
  readonly continuityBandAtFightOpen: ContinuityBand;
  readonly temperatureAtFightOpen: ContinuityTemperature;
  readonly escortsActiveAtFightOpen: number;
  readonly pendingRevealsAtFightOpen: number;
  readonly shouldHoldCarryoverDuringFight: boolean;
  readonly shouldFlushRevealsAfterFight: boolean;
}

export function buildContinuityCombatIntegration(
  fightId: string,
  continuityState: ContinuityRunState,
): ContinuityCombatIntegration {
  return Object.freeze({
    fightId,
    continuityBandAtFightOpen: continuityState.band,
    temperatureAtFightOpen: continuityState.temperature,
    escortsActiveAtFightOpen: continuityState.escortStyle !== 'NONE' ? 1 : 0,
    pendingRevealsAtFightOpen: continuityState.pendingRevealCount,
    shouldHoldCarryoverDuringFight: continuityBandIsActive(continuityState.band),
    shouldFlushRevealsAfterFight: continuityState.pendingRevealCount > 0,
  });
}

// ============================================================================
// MARK: Continuity-experience integration
// ============================================================================

export interface ContinuityExperienceIntegration {
  readonly runId: string;
  readonly pressureForExperience01: number;
  readonly suggestedArchetype: string;
  readonly silenceRecommendedMs: number;
  readonly witnessEscalationRequired: boolean;
  readonly carryoverActiveForScene: boolean;
}

export function buildContinuityExperienceIntegration(
  state: ContinuityRunState,
): ContinuityExperienceIntegration {
  const pressure01 = continuityBandWeight(state.band) * 0.6 +
    continuityTemperatureWeight(state.temperature) * 0.4;

  const suggestedArchetype =
    state.temperature === 'HOSTILE' ? 'CONFRONTATION'
    : state.temperature === 'PRESSURED' ? 'NEGOTIATION'
    : state.temperature === 'TENSE' ? 'EXPOSITION'
    : 'AFTERMATH';

  const silenceRecommendedMs =
    state.pendingRevealCount > 0 ? 1800
    : state.band === 'CRITICAL' ? 2400
    : 0;

  return Object.freeze({
    runId: state.runId,
    pressureForExperience01: Math.min(1, pressure01),
    suggestedArchetype,
    silenceRecommendedMs,
    witnessEscalationRequired: continuityTemperatureIsElevated(state.temperature),
    carryoverActiveForScene: continuityRunStateIsLive(state),
  });
}

// ============================================================================
// MARK: Continuity lane state machine transitions
// ============================================================================

export type ContinuityStateTransitionKind =
  | 'MOUNT_ENTER'
  | 'MOUNT_EXIT'
  | 'REVEAL_RESOLVED'
  | 'ESCORT_CHANGED'
  | 'RELATIONSHIP_HOT'
  | 'TEMPERATURE_SHIFT'
  | 'BAND_SHIFT'
  | 'FIGHT_START'
  | 'FIGHT_END'
  | 'FULL_CARRYOVER'
  | 'DECAY';

export interface ContinuityStateTransition {
  readonly kind: ContinuityStateTransitionKind;
  readonly fromBand: ContinuityBand;
  readonly toBand: ContinuityBand;
  readonly fromTemperature: ContinuityTemperature;
  readonly toTemperature: ContinuityTemperature;
  readonly reason: string;
  readonly timestampMs: number;
}

export function buildContinuityStateTransition(
  kind: ContinuityStateTransitionKind,
  fromState: ContinuityRunState,
  toBand: ContinuityBand,
  toTemperature: ContinuityTemperature,
  reason: string,
  nowMs: number,
): ContinuityStateTransition {
  return Object.freeze({
    kind,
    fromBand: fromState.band,
    toBand,
    fromTemperature: fromState.temperature,
    toTemperature,
    reason,
    timestampMs: nowMs,
  });
}

export function continuityStateTransitionIsEscalation(
  transition: ContinuityStateTransition,
): boolean {
  return (
    continuityBandWeight(transition.toBand) > continuityBandWeight(transition.fromBand) ||
    continuityTemperatureWeight(transition.toTemperature) > continuityTemperatureWeight(transition.fromTemperature)
  );
}

export function continuityStateTransitionIsDecay(
  transition: ContinuityStateTransition,
): boolean {
  return transition.kind === 'DECAY';
}

export function describeContinuityStateTransition(transition: ContinuityStateTransition): string {
  return (
    `[transition:${transition.kind}] ` +
    `band=${transition.fromBand}→${transition.toBand} ` +
    `temp=${transition.fromTemperature}→${transition.toTemperature} ` +
    `reason=${transition.reason}`
  );
}

// ============================================================================
// MARK: Continuity ledger snapshot comparison
// ============================================================================

export interface ContinuitySnapshotDiff {
  readonly bandChanged: boolean;
  readonly temperatureChanged: boolean;
  readonly pendingRevealCountDelta: number;
  readonly hotRelationshipCountDelta: number;
  readonly isEscalation: boolean;
  readonly isDecay: boolean;
}

export function diffContinuityRunStates(
  prev: ContinuityRunState,
  next: ContinuityRunState,
): ContinuitySnapshotDiff {
  const bandChanged = prev.band !== next.band;
  const tempChanged = prev.temperature !== next.temperature;
  const revealDelta = next.pendingRevealCount - prev.pendingRevealCount;
  const relDelta = next.hotRelationshipCount - prev.hotRelationshipCount;

  const isEscalation =
    (bandChanged && continuityBandWeight(next.band) > continuityBandWeight(prev.band)) ||
    (tempChanged && continuityTemperatureWeight(next.temperature) > continuityTemperatureWeight(prev.temperature));

  const isDecay =
    (bandChanged && continuityBandWeight(next.band) < continuityBandWeight(prev.band)) ||
    (tempChanged && continuityTemperatureWeight(next.temperature) < continuityTemperatureWeight(prev.temperature));

  return Object.freeze({
    bandChanged,
    temperatureChanged: tempChanged,
    pendingRevealCountDelta: revealDelta,
    hotRelationshipCountDelta: relDelta,
    isEscalation,
    isDecay,
  });
}

export function continuitySnapshotDiffIsMeaningful(diff: ContinuitySnapshotDiff): boolean {
  return (
    diff.bandChanged ||
    diff.temperatureChanged ||
    Math.abs(diff.pendingRevealCountDelta) > 0 ||
    Math.abs(diff.hotRelationshipCountDelta) > 0
  );
}

// ============================================================================
// MARK: Continuity lane extended doctrine
// ============================================================================

export const CHAT_CONTINUITY_EXTENDED_DOCTRINE = Object.freeze([
  'Cold rooms do not receive carryover — entropy must be respected.',
  'Every reveal that is dropped must appear in the audit trail.',
  'Escort style escalation (none → shadow → visible → predator) tracks hostility, not warmth.',
  'Relationship vectors that go cold in one session do not automatically revive in the next.',
  'Temperature is a directional signal — use it to predict, not just react.',
  'Band weight is a pressure multiplier — high bands amplify all continuity outputs.',
  'The frontend patch is an advisory, not a command. Backend truth is canonical.',
  'Forced transitions (combat exit, emergency) bypass normal decay rules.',
  'The carryover resolver must never invent relationships that were not in the ledger.',
  'Session summaries are the audit trail for continuity decisions across the entire run.',
] as const);

// ============================================================================
// MARK: Continuity lane final authority check
// ============================================================================

/**
 * Returns whether the continuity lane is ready to emit a carryover resolution.
 */
export function continuityLaneIsReadyToEmitCarryover(
  state: ContinuityRunState,
  health: ContinuityLaneHealth,
): boolean {
  if (health.status === 'CRITICAL') return false;
  if (!continuityBandRequiresCarryover(state.band)) return false;
  return true;
}

/**
 * Returns a one-line status string for the continuity lane.
 */
export function describeContinuityLaneStatus(
  state: ContinuityRunState,
  health: ContinuityLaneHealth,
): string {
  const ready = continuityLaneIsReadyToEmitCarryover(state, health);
  return `[continuity-lane] ready=${ready} ${describeContinuityRunState(state)} | ${describeContinuityLaneHealth(health)}`;
}

// ============================================================================
// MARK: Continuity lane version + exports table
// ============================================================================

export const CONTINUITY_LANE_VERSION = CHAT_CONTINUITY_BARREL_VERSION;

export const CONTINUITY_LANE_EXPORTS = Object.freeze({
  ChatContinuityModule: 'frozen authority object with all subsystem namespaces',
  ContinuityLedger: 'namespace: CrossModeContinuityLedger subsystem',
  Carryover: 'namespace: CarryoverResolver subsystem',
  CrossModeContinuityLedgerClass: 'class reference for continuity ledger',
  CarryoverResolverClass: 'class reference for carryover resolver',
  createCrossModeContinuityLedger: 'factory: create CrossModeContinuityLedger',
  createCarryoverResolver: 'factory: create CarryoverResolver',
  CONTINUITY_TEMPERATURES: 'all temperature identifiers',
  CONTINUITY_BANDS: 'all band identifiers',
  CONTINUITY_ESCORT_STYLES: 'all escort style identifiers',
  CONTINUITY_MOUNT_TARGETS: 'all mount target identifiers',
  CONTINUITY_LANE_CONSTANTS: 'numeric constants for the continuity lane',
  buildContinuityRunStateShell: 'builds an empty run state',
  buildContinuityLaneHealth: 'builds health from run state',
  buildCarryoverAuditEntry: 'builds an audit entry for carryover resolution',
  buildContinuityDirectiveSummary: 'aggregates all directives into a summary',
  buildContinuityCombatIntegration: 'builds cross-lane combat integration payload',
  buildContinuityExperienceIntegration: 'builds cross-lane experience integration payload',
  continuityLaneIsReadyToEmitCarryover: 'top-level carryover readiness authority',
  continuityLaneShouldHoldOutput: 'gating authority for holding output',
  diffContinuityRunStates: 'produces a diff between two run state snapshots',
} as const);

// ============================================================================
// MARK: Continuity lane summary constant
// ============================================================================

export const CONTINUITY_LANE_SUMMARY = Object.freeze({
  version: CHAT_CONTINUITY_BARREL_VERSION,
  scope: CHAT_CONTINUITY_AUTHORITY,
  moduleCount: CHAT_CONTINUITY_MODULE_DESCRIPTORS.length,
  doctrine: CHAT_CONTINUITY_DOCTRINE,
  extendedDoctrine: CHAT_CONTINUITY_EXTENDED_DOCTRINE,
  constants: CONTINUITY_LANE_CONSTANTS,
  meta: CHAT_CONTINUITY_BARREL_META,
} as const);

/** Shorthand type for any continuity audit entry. */
export type AnyContinuityAuditEntry = ContinuityLaneAuditEntry;

/** Shorthand type for any continuity run state. */
export type AnyContinuityRunState = ContinuityRunState;

/** Shorthand type for any carryover resolution. */
export type AnyCarryoverResolution = CarryoverResolution;

// ============================================================================
// MARK: Continuity overlay helpers
// ============================================================================

export function continuityOverlayIsActive(overlay: ContinuityOverlayState): boolean {
  return overlay.isActive;
}

export function continuityOverlayRequiresReopen(overlay: ContinuityOverlayState): boolean {
  return !overlay.isActive && (overlay.shouldReopenOnEscort || overlay.shouldReopenOnReveal);
}

export function describeOverlayState(overlay: ContinuityOverlayState): string {
  const reopenSignals: string[] = [];
  if (overlay.shouldReopenOnEscort) reopenSignals.push('ESCORT');
  if (overlay.shouldReopenOnReveal) reopenSignals.push('REVEAL');
  return `[overlay] active=${overlay.isActive} reopenOn=${reopenSignals.join(',') || 'NONE'}`;
}

// ============================================================================
// MARK: Continuity relationship digest helpers
// ============================================================================

export function continuityRelationshipDigestIsHot(digest: ContinuityRelationshipDigest): boolean {
  return (digest.intensity01 ?? 0) >= CONTINUITY_LANE_CONSTANTS.RELATIONSHIP_CARRYOVER_INTENSITY_THRESHOLD_01;
}

export function continuityRelationshipDigestIsHostile(digest: ContinuityRelationshipDigest): boolean {
  return digest.polarity === 'HOSTILE' || digest.polarity === 'ANTAGONIST';
}

export function sortRelationshipDigestsByIntensityDesc(
  digests: readonly ContinuityRelationshipDigest[],
): ContinuityRelationshipDigest[] {
  return [...digests].sort((a, b) => (b.intensity01 ?? 0) - (a.intensity01 ?? 0));
}

export function filterHotRelationshipDigests(
  digests: readonly ContinuityRelationshipDigest[],
): ContinuityRelationshipDigest[] {
  return digests.filter(continuityRelationshipDigestIsHot);
}

export function filterHostileRelationshipDigests(
  digests: readonly ContinuityRelationshipDigest[],
): ContinuityRelationshipDigest[] {
  return digests.filter(continuityRelationshipDigestIsHostile);
}

// ============================================================================
// MARK: Continuity session transition log
// ============================================================================

export interface ContinuityTransitionLog {
  readonly runId: string;
  readonly transitions: readonly ContinuityStateTransition[];
  readonly escalationCount: number;
  readonly decayCount: number;
  readonly fightTransitions: number;
  readonly mountTransitions: number;
}

export function buildContinuityTransitionLog(
  runId: string,
  transitions: readonly ContinuityStateTransition[],
): ContinuityTransitionLog {
  return Object.freeze({
    runId,
    transitions,
    escalationCount: transitions.filter(continuityStateTransitionIsEscalation).length,
    decayCount: transitions.filter(continuityStateTransitionIsDecay).length,
    fightTransitions: transitions.filter(
      (t) => t.kind === 'FIGHT_START' || t.kind === 'FIGHT_END',
    ).length,
    mountTransitions: transitions.filter(
      (t) => t.kind === 'MOUNT_ENTER' || t.kind === 'MOUNT_EXIT',
    ).length,
  });
}

export function describeContinuityTransitionLog(log: ContinuityTransitionLog): string {
  return (
    `[transition-log:${log.runId}] total=${log.transitions.length} ` +
    `escalations=${log.escalationCount} decays=${log.decayCount} ` +
    `fights=${log.fightTransitions} mounts=${log.mountTransitions}`
  );
}

// ============================================================================
// MARK: Continuity carryover queue
// ============================================================================

export interface ContinuityCarryoverQueueEntry {
  readonly queueId: string;
  readonly resolution: CarryoverResolution;
  readonly enqueueAtMs: number;
  readonly targetMountTarget: ContinuityMountTarget | null;
  readonly priority: 'IMMEDIATE' | 'NEXT_SCENE' | 'DEFERRED';
  readonly isUrgent: boolean;
}

export function buildContinuityCarryoverQueueEntry(
  queueId: string,
  resolution: CarryoverResolution,
  targetMountTarget: ContinuityMountTarget | null,
  nowMs: number,
): ContinuityCarryoverQueueEntry {
  const isUrgent = carryoverHealthIsActive(resolution.health);
  const priority = isUrgent ? 'IMMEDIATE' : carryoverResolutionHasPendingReveals(resolution) ? 'NEXT_SCENE' : 'DEFERRED';

  return Object.freeze({
    queueId,
    resolution,
    enqueueAtMs: nowMs,
    targetMountTarget,
    priority,
    isUrgent,
  });
}

export function carryoverQueueEntryIsStale(
  entry: ContinuityCarryoverQueueEntry,
  nowMs: number,
): boolean {
  return nowMs - entry.enqueueAtMs > CONTINUITY_LANE_CONSTANTS.DORMANT_BAND_DECAY_MS;
}

export function describeContinuityCarryoverQueueEntry(
  entry: ContinuityCarryoverQueueEntry,
): string {
  return (
    `[queue:${entry.queueId}] priority=${entry.priority} urgent=${entry.isUrgent} ` +
    `target=${entry.targetMountTarget ?? 'UNSET'} ` +
    `health=${entry.resolution.health}`
  );
}

// ============================================================================
// MARK: Continuity reveal window advisor
// ============================================================================

export type ContinuityRevealWindowAdvice =
  | 'REVEAL_NOW'
  | 'DEFER_TO_NEXT_BEAT'
  | 'DEFER_TO_PRESSURE'
  | 'HOLD_INDEFINITELY'
  | 'CANCEL';

export function adviseContinuityRevealWindow(
  state: ContinuityRunState,
  revealUrgency01: number,
): ContinuityRevealWindowAdvice {
  if (state.temperature === 'HOSTILE' && revealUrgency01 < 0.5) return 'HOLD_INDEFINITELY';
  if (revealUrgency01 >= CONTINUITY_LANE_CONSTANTS.REVEAL_URGENCY_CRITICAL_THRESHOLD_01) return 'REVEAL_NOW';
  if (state.band === 'CRITICAL') return 'DEFER_TO_PRESSURE';
  if (continuityTemperatureIsElevated(state.temperature)) return 'DEFER_TO_NEXT_BEAT';
  if (state.pendingRevealCount > CONTINUITY_LANE_CONSTANTS.MAX_PENDING_REVEALS_BEFORE_OVERFLOW) return 'CANCEL';
  return 'DEFER_TO_NEXT_BEAT';
}

export function continuityRevealAdviceIsImmediate(advice: ContinuityRevealWindowAdvice): boolean {
  return advice === 'REVEAL_NOW';
}

export function continuityRevealAdviceIsHold(advice: ContinuityRevealWindowAdvice): boolean {
  return advice === 'HOLD_INDEFINITELY' || advice === 'CANCEL';
}

// ============================================================================
// MARK: Continuity momentum tracker
// ============================================================================

export interface ContinuityMomentumSnapshot {
  readonly runId: string;
  readonly bandMomentum: number;    // positive = escalating, negative = decaying
  readonly temperatureMomentum: number;
  readonly revealMomentum: number;  // positive = more reveals queuing, negative = being resolved
  readonly overallMomentum: number;
  readonly capturedAtMs: number;
}

export function buildContinuityMomentumSnapshot(
  runId: string,
  prevState: ContinuityRunState,
  nextState: ContinuityRunState,
  nowMs: number,
): ContinuityMomentumSnapshot {
  const bandDelta = continuityBandWeight(nextState.band) - continuityBandWeight(prevState.band);
  const tempDelta = continuityTemperatureWeight(nextState.temperature) - continuityTemperatureWeight(prevState.temperature);
  const revealDelta = nextState.pendingRevealCount - prevState.pendingRevealCount;

  const overallMomentum = bandDelta * 0.5 + tempDelta * 0.3 + (revealDelta * 0.02) * 0.2;

  return Object.freeze({
    runId,
    bandMomentum: bandDelta,
    temperatureMomentum: tempDelta,
    revealMomentum: revealDelta,
    overallMomentum,
    capturedAtMs: nowMs,
  });
}

export function continuityMomentumIsEscalating(snapshot: ContinuityMomentumSnapshot): boolean {
  return snapshot.overallMomentum > 0.05;
}

export function continuityMomentumIsDecaying(snapshot: ContinuityMomentumSnapshot): boolean {
  return snapshot.overallMomentum < -0.05;
}

export function describeContinuityMomentum(snapshot: ContinuityMomentumSnapshot): string {
  const direction = continuityMomentumIsEscalating(snapshot)
    ? 'ESCALATING'
    : continuityMomentumIsDecaying(snapshot)
    ? 'DECAYING'
    : 'STABLE';
  return `[momentum:${snapshot.runId}] overall=${snapshot.overallMomentum.toFixed(3)} ${direction}`;
}

// ============================================================================
// MARK: Continuity lane module count constant
// ============================================================================

export const CONTINUITY_LANE_MODULE_COUNT = CHAT_CONTINUITY_MODULE_DESCRIPTORS.length;
export const CONTINUITY_LANE_IS_AUTHORITY = true as const;
export const CONTINUITY_LANE_SCOPE = 'BACKEND' as const;

export const CONTINUITY_LANE_SIGNATURE_COUNT = Object.freeze({
  moduleCount: CONTINUITY_LANE_MODULE_COUNT,
  mountTargets: CONTINUITY_MOUNT_TARGETS.length,
  temperatures: CONTINUITY_TEMPERATURES.length,
  bands: CONTINUITY_BANDS.length,
  escortStyles: CONTINUITY_ESCORT_STYLES.length,
} as const);

// ============================================================================
// MARK: Continuity lane decay controller
// ============================================================================

export interface ContinuityDecayDecision {
  readonly shouldDecayBand: boolean;
  readonly targetBand: ContinuityBand;
  readonly shouldDecayTemperature: boolean;
  readonly targetTemperature: ContinuityTemperature;
  readonly shouldFlushReveals: boolean;
  readonly reason: string;
}

export function buildContinuityDecayDecision(
  state: ContinuityRunState,
  idleMs: number,
): ContinuityDecayDecision {
  const bandShouldDecay = idleMs >= CONTINUITY_LANE_CONSTANTS.DORMANT_BAND_DECAY_MS && state.band !== 'DORMANT';
  const tempShouldDecay = idleMs >= CONTINUITY_LANE_CONSTANTS.CONTINUITY_DECAY_INTERVAL_MS;

  const decayedBand: ContinuityBand =
    state.band === 'CRITICAL' ? 'VOLATILE'
    : state.band === 'VOLATILE' ? 'HOT'
    : state.band === 'HOT' ? 'WARM'
    : state.band === 'WARM' ? 'LOW'
    : state.band === 'LOW' ? 'DORMANT'
    : 'DORMANT';

  const decayedTemp: ContinuityTemperature =
    state.temperature === 'HOSTILE' ? 'PRESSURED'
    : state.temperature === 'PRESSURED' ? 'TENSE'
    : state.temperature === 'TENSE' ? 'STEADY'
    : 'COOL';

  return Object.freeze({
    shouldDecayBand: bandShouldDecay,
    targetBand: bandShouldDecay ? decayedBand : state.band,
    shouldDecayTemperature: tempShouldDecay,
    targetTemperature: tempShouldDecay ? decayedTemp : state.temperature,
    shouldFlushReveals: state.pendingRevealCount > CONTINUITY_LANE_CONSTANTS.MAX_PENDING_REVEALS_BEFORE_OVERFLOW,
    reason: idleMs >= CONTINUITY_LANE_CONSTANTS.DORMANT_BAND_DECAY_MS ? 'IDLE_DECAY' : 'INTERVAL_DECAY',
  });
}

export function continuityDecayDecisionHasChanges(decision: ContinuityDecayDecision): boolean {
  return decision.shouldDecayBand || decision.shouldDecayTemperature || decision.shouldFlushReveals;
}

// ============================================================================
// MARK: Continuity lane escort tracking
// ============================================================================

export interface ContinuityEscortRecord {
  readonly actorId: string;
  readonly style: ContinuityEscortStyle;
  readonly attachedAtMs: number;
  readonly lastSeenAtMs: number;
  readonly intensity01: number;
  readonly isActive: boolean;
}

export function buildContinuityEscortRecord(
  actorId: string,
  style: ContinuityEscortStyle,
  intensity01: number,
  nowMs: number,
): ContinuityEscortRecord {
  return Object.freeze({
    actorId,
    style,
    attachedAtMs: nowMs,
    lastSeenAtMs: nowMs,
    intensity01,
    isActive: style !== 'NONE',
  });
}

export function continuityEscortRecordIsHostile(record: ContinuityEscortRecord): boolean {
  return continuityEscortStyleIsHostile(record.style);
}

export function continuityEscortRecordPressure(record: ContinuityEscortRecord): number {
  return continuityEscortStylePressureWeight(record.style) * record.intensity01;
}

export function sortEscortRecordsByPressureDesc(
  records: readonly ContinuityEscortRecord[],
): ContinuityEscortRecord[] {
  return [...records].sort(
    (a, b) => continuityEscortRecordPressure(b) - continuityEscortRecordPressure(a),
  );
}

export function filterActiveEscortRecords(
  records: readonly ContinuityEscortRecord[],
): ContinuityEscortRecord[] {
  return records.filter((r) => r.isActive);
}

export function describeEscortRecord(record: ContinuityEscortRecord): string {
  return `[escort:${record.actorId}] style=${record.style} intensity=${record.intensity01.toFixed(2)} active=${record.isActive}`;
}

// ============================================================================
// MARK: Continuity lane presence snapshot helpers
// ============================================================================

export interface ContinuityPresenceSummary {
  readonly totalSessions: number;
  readonly hotSessionCount: number;
  readonly escortCount: number;
  readonly hostileEscortCount: number;
  readonly averageIntensity01: number;
}

export function buildContinuityPresenceSummary(
  escorts: readonly ContinuityEscortRecord[],
  totalSessions: number,
): ContinuityPresenceSummary {
  const active = filterActiveEscortRecords(escorts);
  const hostile = active.filter(continuityEscortRecordIsHostile);
  const avgIntensity = active.length > 0
    ? active.reduce((s, r) => s + r.intensity01, 0) / active.length
    : 0;

  return Object.freeze({
    totalSessions,
    hotSessionCount: active.filter((r) => r.intensity01 >= 0.5).length,
    escortCount: active.length,
    hostileEscortCount: hostile.length,
    averageIntensity01: avgIntensity,
  });
}

export function continuityPresenceSummaryIsHostileRoom(
  summary: ContinuityPresenceSummary,
): boolean {
  return summary.hostileEscortCount > 0 && summary.hostileEscortCount >= summary.escortCount * 0.5;
}

// ============================================================================
// MARK: Continuity lane final summary
// ============================================================================

export const CONTINUITY_LANE_FINAL_SUMMARY = Object.freeze({
  version: CHAT_CONTINUITY_BARREL_VERSION,
  scope: CONTINUITY_LANE_SCOPE,
  isAuthority: CONTINUITY_LANE_IS_AUTHORITY,
  moduleCount: CONTINUITY_LANE_MODULE_COUNT,
  signatureCounts: CONTINUITY_LANE_SIGNATURE_COUNT,
  doctrine: CHAT_CONTINUITY_DOCTRINE,
  extendedDoctrine: CHAT_CONTINUITY_EXTENDED_DOCTRINE,
  constants: CONTINUITY_LANE_CONSTANTS,
  meta: CHAT_CONTINUITY_BARREL_META,
} as const);

/** Shorthand: any continuity state transition. */
export type AnyContinuityStateTransition = ContinuityStateTransition;

/** Shorthand: any continuity escort record. */
export type AnyContinuityEscortRecord = ContinuityEscortRecord;

/** Shorthand: any continuity decay decision. */
export type AnyContinuityDecayDecision = ContinuityDecayDecision;

/** Shorthand: any continuity momentum snapshot. */
export type AnyContinuityMomentumSnapshot = ContinuityMomentumSnapshot;

/** Shorthand: any continuity carryover queue entry. */
export type AnyContinuityCarryoverQueueEntry = ContinuityCarryoverQueueEntry;

// ============================================================================
// MARK: Continuity lane reveal resolution batch
// ============================================================================

export interface ContinuityRevealBatchResult {
  readonly totalReveals: number;
  readonly resolvedNow: number;
  readonly deferredToNextBeat: number;
  readonly deferredToPressure: number;
  readonly heldIndefinitely: number;
  readonly cancelled: number;
}

export function buildContinuityRevealBatchResult(
  state: ContinuityRunState,
  revealCues: readonly ContinuityRevealCue[],
): ContinuityRevealBatchResult {
  let resolvedNow = 0;
  let deferredToNextBeat = 0;
  let deferredToPressure = 0;
  let heldIndefinitely = 0;
  let cancelled = 0;

  for (const cue of revealCues) {
    const advice = adviseContinuityRevealWindow(state, cue.urgency01 ?? 0);
    switch (advice) {
      case 'REVEAL_NOW': resolvedNow++; break;
      case 'DEFER_TO_NEXT_BEAT': deferredToNextBeat++; break;
      case 'DEFER_TO_PRESSURE': deferredToPressure++; break;
      case 'HOLD_INDEFINITELY': heldIndefinitely++; break;
      case 'CANCEL': cancelled++; break;
    }
  }

  return Object.freeze({
    totalReveals: revealCues.length,
    resolvedNow,
    deferredToNextBeat,
    deferredToPressure,
    heldIndefinitely,
    cancelled,
  });
}

export function continuityRevealBatchIsClean(result: ContinuityRevealBatchResult): boolean {
  return result.cancelled === 0 && result.heldIndefinitely === 0;
}

export function describeContinuityRevealBatch(result: ContinuityRevealBatchResult): string {
  return (
    `[reveals] total=${result.totalReveals} now=${result.resolvedNow} ` +
    `deferred=${result.deferredToNextBeat + result.deferredToPressure} ` +
    `held=${result.heldIndefinitely} cancelled=${result.cancelled}`
  );
}

// ============================================================================
// MARK: Continuity lane snapshot scoring
// ============================================================================

/**
 * Returns a combined pressure score (0–1) for the continuity lane.
 * Useful for cross-lane pressure signaling.
 */
export function continuityCombinedPressureScore(state: ContinuityRunState): number {
  const bandWeight = continuityBandWeight(state.band);
  const tempWeight = continuityTemperatureWeight(state.temperature);
  const revealPressure = Math.min(0.3, state.pendingRevealCount * 0.04);
  const escortPressure = continuityEscortStylePressureWeight(state.escortStyle) * 0.25;
  return Math.min(1, bandWeight * 0.4 + tempWeight * 0.3 + revealPressure + escortPressure);
}

/**
 * Returns whether the continuity lane is above social urgency threshold.
 */
export function continuityLaneIsAboveSocialUrgencyThreshold(state: ContinuityRunState): boolean {
  return continuityCombinedPressureScore(state) >= 0.65;
}

/**
 * Returns whether the continuity lane is in a dormant/idle state.
 */
export function continuityLaneIsDormant(state: ContinuityRunState): boolean {
  return state.band === 'DORMANT' && state.temperature === 'COOL' && state.pendingRevealCount === 0;
}

// ============================================================================
// MARK: Continuity lane transition kind registry
// ============================================================================

export const CONTINUITY_TRANSITION_KINDS = Object.freeze([
  'MOUNT_ENTER',
  'MOUNT_EXIT',
  'REVEAL_RESOLVED',
  'ESCORT_CHANGED',
  'RELATIONSHIP_HOT',
  'TEMPERATURE_SHIFT',
  'BAND_SHIFT',
  'FIGHT_START',
  'FIGHT_END',
  'FULL_CARRYOVER',
  'DECAY',
] as const satisfies readonly ContinuityStateTransitionKind[]);

export const CONTINUITY_REVEAL_ADVICE_KINDS = Object.freeze([
  'REVEAL_NOW',
  'DEFER_TO_NEXT_BEAT',
  'DEFER_TO_PRESSURE',
  'HOLD_INDEFINITELY',
  'CANCEL',
] as const satisfies readonly ContinuityRevealWindowAdvice[]);

export const CONTINUITY_CARRYOVER_QUEUE_PRIORITIES = Object.freeze([
  'IMMEDIATE',
  'NEXT_SCENE',
  'DEFERRED',
] as const);

export const CONTINUITY_LANE_FULL_CONSTANTS = Object.freeze({
  ...CONTINUITY_LANE_CONSTANTS,
  transitionKindCount: CONTINUITY_TRANSITION_KINDS.length,
  revealAdviceKindCount: CONTINUITY_REVEAL_ADVICE_KINDS.length,
  carryoverQueuePriorityCount: CONTINUITY_CARRYOVER_QUEUE_PRIORITIES.length,
  totalRegistries: 5,
} as const);

// ============================================================================
// MARK: Continuity lane barrel shorthand exports
// ============================================================================

/** Shorthand: all continuity state transition kind identifiers. */
export type AnyContinuityTransitionKind = ContinuityStateTransitionKind;

/** Shorthand: any continuity reveal window advice. */
export type AnyContinuityRevealAdvice = ContinuityRevealWindowAdvice;

/** Shorthand: any continuity reveal batch result. */
export type AnyContinuityRevealBatchResult = ContinuityRevealBatchResult;

/** Shorthand: any continuity transition log. */
export type AnyContinuityTransitionLog = ContinuityTransitionLog;

/** Shorthand: any continuity presence summary. */
export type AnyContinuityPresenceSummary = ContinuityPresenceSummary;

/** Shorthand: any continuity snapshot diff. */
export type AnyContinuitySnapshotDiff = ContinuitySnapshotDiff;

/** All continuity-related shorthand type aliases assembled for external use. */
export type ContinuityLaneTypeBundle = {
  AuditEntry: AnyContinuityAuditEntry;
  RunState: AnyContinuityRunState;
  CarryoverResolution: AnyCarryoverResolution;
  StateTransition: AnyContinuityStateTransition;
  EscortRecord: AnyContinuityEscortRecord;
  DecayDecision: AnyContinuityDecayDecision;
  MomentumSnapshot: AnyContinuityMomentumSnapshot;
  CarryoverQueueEntry: AnyContinuityCarryoverQueueEntry;
  TransitionKind: AnyContinuityTransitionKind;
  RevealAdvice: AnyContinuityRevealAdvice;
  RevealBatchResult: AnyContinuityRevealBatchResult;
  TransitionLog: AnyContinuityTransitionLog;
  PresenceSummary: AnyContinuityPresenceSummary;
  SnapshotDiff: AnyContinuitySnapshotDiff;
};
