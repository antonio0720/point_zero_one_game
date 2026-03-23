/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT EXPERIENCE BARREL
 * FILE: backend/src/game/engine/chat/experience/index.ts
 * VERSION: 2026.03.23-experience-barrel.v1
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative export surface for the chat experience lane.
 * The experience lane governs the emotional and cinematic texture of chat:
 * when scenes escalate, when silence is authored, when moments crystallise,
 * and how dramatic pressure drives NPC and player behavior.
 *
 * Subsystems
 * ----------
 * 1. ChatDramaOrchestrator  — top-level dramatic beat authority; coordinates
 *                             scene materialization, pressure escalation, and
 *                             authored drama across channels.
 * 2. ChatScenePlanner       — plans individual chat scenes from state snapshots;
 *                             resolves archetype, speaker order, beat structure,
 *                             and branch points.
 * 3. ChatMomentLedger       — tracks registered moments, reveal reservations,
 *                             silence windows, and carryover records across the
 *                             run lifecycle.
 * 4. ChatSilencePolicy      — decides when the room falls silent, when
 *                             interrupts are permitted, and how beat schedules
 *                             are composed from silence + reveal plans.
 *
 * Design doctrine
 * ---------------
 * - No UI ownership. No socket ownership. Backend authority only.
 * - All four subsystems are independently importable via this barrel.
 * - ChatSilencePolicy exports ChatSilenceDecision which overlaps with the
 *   root types.ts — within this barrel the flat re-export is safe; the root
 *   chat/index.ts namespace-guards this barrel to prevent the outer conflict.
 * - ChatExperienceModule provides the single frozen authority object consumed
 *   by the chat root barrel.
 * ============================================================================
 */

// ============================================================================
// MARK: Namespace imports
// ============================================================================

import * as DramaOrchestrator from './ChatDramaOrchestrator';
import * as ScenePlanner from './ChatScenePlanner';
import * as MomentLedger from './ChatMomentLedger';
import * as SilencePolicy from './ChatSilencePolicy';

// ============================================================================
// MARK: Flat re-exports
// Note: ChatSilencePolicy.ChatSilenceDecision shadows the root types.ts
// declaration at this level — intentional, the experience surface owns
// the runtime decision shape within this lane.
// ============================================================================

export * from './ChatDramaOrchestrator';
export * from './ChatScenePlanner';
export * from './ChatMomentLedger';
export * from './ChatSilencePolicy';

// ============================================================================
// MARK: Namespace re-exports
// ============================================================================

export { DramaOrchestrator, ScenePlanner, MomentLedger, SilencePolicy };

// ============================================================================
// MARK: Convenience class surface
// ============================================================================

/** Top-level dramatic beat authority for the run. */
export const ChatDramaOrchestratorClass = DramaOrchestrator.ChatDramaOrchestrator;

/** Plans individual scenes from pressure + memory + relationship state. */
export const ChatScenePlannerClass = ScenePlanner.ChatScenePlanner;

/** Tracks moments, reveals, silence windows, and carryover across the run. */
export const ChatMomentLedgerClass = MomentLedger.ChatMomentLedger;

/** Decides silence disposition, interrupt allowance, and beat scheduling. */
export const ChatSilencePolicyClass = SilencePolicy.ChatSilencePolicy;

// ============================================================================
// MARK: Convenience factory surface
// ============================================================================

export const createChatDramaOrchestrator = DramaOrchestrator.createChatDramaOrchestrator;
export const createChatScenePlanner = ScenePlanner.createChatScenePlanner;

export function createChatSilencePolicy(
  config: Partial<SilencePolicy.ChatSilencePolicyConfig> = {},
): SilencePolicy.ChatSilencePolicy {
  return new SilencePolicy.ChatSilencePolicy(config);
}

export function createChatMomentLedger(
  config: Partial<MomentLedger.ChatMomentLedgerConfig> = {},
): MomentLedger.ChatMomentLedger {
  return new MomentLedger.ChatMomentLedger(config);
}

// ============================================================================
// MARK: Experience barrel version
// ============================================================================

export const CHAT_EXPERIENCE_BARREL_VERSION = '2026.03.23-experience-barrel.v1' as const;
export const CHAT_EXPERIENCE_AUTHORITY = 'BACKEND' as const;

export interface ChatExperienceBarrelMeta {
  readonly version: typeof CHAT_EXPERIENCE_BARREL_VERSION;
  readonly authority: typeof CHAT_EXPERIENCE_AUTHORITY;
  readonly subsystems: readonly [
    'DramaOrchestrator',
    'ScenePlanner',
    'MomentLedger',
    'SilencePolicy',
  ];
  readonly readiness: 'GENERATED';
}

export const CHAT_EXPERIENCE_BARREL_META: ChatExperienceBarrelMeta = Object.freeze({
  version: CHAT_EXPERIENCE_BARREL_VERSION,
  authority: CHAT_EXPERIENCE_AUTHORITY,
  subsystems: [
    'DramaOrchestrator',
    'ScenePlanner',
    'MomentLedger',
    'SilencePolicy',
  ] as const,
  readiness: 'GENERATED',
});

// ============================================================================
// MARK: Experience lane type aliases
// These re-surface key types from each subsystem under a stable barrel name.
// ============================================================================

export type ExperienceBeatDescriptor = DramaOrchestrator.ChatDramaBeatDescriptor;
export type ExperienceContextSnapshot = DramaOrchestrator.ChatDramaContextSnapshot;
export type ExperienceMaterialization = DramaOrchestrator.ChatDramaMaterialization;
export type ExperienceDramaBudget = DramaOrchestrator.ChatDramaBudget;
export type ExperienceDramaTelemetryDigest = DramaOrchestrator.ChatDramaTelemetryDigest;
export type ExperienceDramaAuthorityPlans = DramaOrchestrator.ChatDramaAuthorityPlans;
export type ExperienceDramaConfig = DramaOrchestrator.ChatDramaOrchestratorConfig;
export type ExperienceDramaMaterializationDiagnostics = DramaOrchestrator.ChatDramaMaterializationDiagnostics;

export type ExperienceSceneTelemetry = ScenePlanner.ChatScenePlannerTelemetry;
export type ExperienceScenePlanValidation = ScenePlanner.ChatScenePlanValidationReport;
export type ExperienceScenePlanValidationIssue = ScenePlanner.ChatScenePlanValidationIssue;
export type ExperienceSceneDecisionExplanation = ScenePlanner.ChatSceneDecisionExplanation;
export type ExperienceScenePlannerConfig = ScenePlanner.ChatScenePlannerConfig;
export type ExperienceSceneDecision = ScenePlanner.ChatScenePlannerDecisionWithTelemetry;

export type ExperienceMomentStatus = MomentLedger.ChatMomentStatus;
export type ExperienceMomentRecord = MomentLedger.ChatMomentRecord;
export type ExperienceLedgerStats = MomentLedger.ChatMomentLedgerStats;
export type ExperienceLedgerSnapshot = MomentLedger.ChatMomentLedgerSnapshot;
export type ExperienceLedgerPlannerContext = MomentLedger.ChatMomentLedgerPlannerContext;
export type ExperienceLedgerConfig = MomentLedger.ChatMomentLedgerConfig;
export type ExperienceMomentEmission = MomentLedger.ChatMomentEmission;
export type ExperienceMomentSilenceWindow = MomentLedger.ChatMomentSilenceWindow;
export type ExperienceMomentRevealReservation = MomentLedger.ChatMomentRevealReservation;

export type ExperienceSilenceDecision = SilencePolicy.ChatSilenceDecision;
export type ExperienceSilencePurpose = SilencePolicy.ChatSilencePurpose;
export type ExperienceInterruptDisposition = SilencePolicy.ChatInterruptDisposition;
export type ExperienceSceneSilencePlan = SilencePolicy.ChatSceneSilencePlan;
export type ExperienceSilenceWindowPlan = SilencePolicy.ChatSilenceWindowPlan;
export type ExperienceSilencePolicyConfig = SilencePolicy.ChatSilencePolicyConfig;
export type ExperienceBeatScheduleEntry = SilencePolicy.ChatBeatScheduleEntry;
export type ExperienceInterruptAssessment = SilencePolicy.ChatInterruptAssessment;
export type ExperienceSilenceDecisionKind = SilencePolicy.ChatSilenceDecisionKind;

// ============================================================================
// MARK: Experience lane function re-surface
// ============================================================================

export const planChatScene = ScenePlanner.planChatScene;
export const projectSceneArchetype = ScenePlanner.projectSceneArchetype;
export const projectSceneStageMood = ScenePlanner.projectSceneStageMood;
export const projectSceneTelemetry = ScenePlanner.projectSceneTelemetry;
export const projectScenePlan = ScenePlanner.projectScenePlan;
export const projectSceneBranchPoints = ScenePlanner.projectSceneBranchPoints;
export const projectSceneSpeakerOrder = ScenePlanner.projectSceneSpeakerOrder;
export const projectSceneBeatTypes = ScenePlanner.projectSceneBeatTypes;
export const projectSceneCallbackAnchors = ScenePlanner.projectSceneCallbackAnchors;
export const validateScenePlan = ScenePlanner.validateScenePlan;

// ============================================================================
// MARK: Experience lane config defaults
// ============================================================================

export const DEFAULT_SCENE_PLANNER_CONFIG = ScenePlanner.DEFAULT_CHAT_SCENE_PLANNER_CONFIG;
export const DEFAULT_MOMENT_LEDGER_CONFIG = MomentLedger.DEFAULT_CHAT_MOMENT_LEDGER_CONFIG;
export const DEFAULT_SILENCE_POLICY_CONFIG = SilencePolicy.DEFAULT_CHAT_SILENCE_POLICY_CONFIG;

// ============================================================================
// MARK: Experience lane readiness
// ============================================================================

export interface ChatExperienceLaneReadiness {
  readonly dramaOrchestrator: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly scenePlanner: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly momentLedger: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly silencePolicy: 'GENERATED' | 'PENDING' | 'PLANNED';
}

export const CHAT_EXPERIENCE_LANE_READINESS: ChatExperienceLaneReadiness = Object.freeze({
  dramaOrchestrator: 'GENERATED',
  scenePlanner: 'GENERATED',
  momentLedger: 'GENERATED',
  silencePolicy: 'GENERATED',
});

// ============================================================================
// MARK: Experience beat type registry
// ============================================================================

export const EXPERIENCE_BEAT_TYPES = Object.freeze([
  'OPENING',
  'PROBE',
  'PRESSURE',
  'ESCALATION',
  'REVELATION',
  'CONFRONTATION',
  'PIVOT',
  'RESOLUTION',
  'AFTERMATH',
  'SILENCE',
  'CEREMONY',
  'PHANTOM',
] as const);

export type ExperienceBeatType = (typeof EXPERIENCE_BEAT_TYPES)[number];

export const EXPERIENCE_BEAT_TYPE_WEIGHT: Readonly<Record<ExperienceBeatType, number>> =
  Object.freeze({
    OPENING: 0.6,
    PROBE: 0.7,
    PRESSURE: 0.85,
    ESCALATION: 0.92,
    REVELATION: 0.96,
    CONFRONTATION: 0.94,
    PIVOT: 0.8,
    RESOLUTION: 0.72,
    AFTERMATH: 0.55,
    SILENCE: 0.4,
    CEREMONY: 0.5,
    PHANTOM: 0.3,
  });

export function beatTypeWeight(beatType: ExperienceBeatType): number {
  return EXPERIENCE_BEAT_TYPE_WEIGHT[beatType] ?? 0.5;
}

export function beatTypeIsActiveDrama(beatType: ExperienceBeatType): boolean {
  return beatTypeWeight(beatType) >= 0.8;
}

export function beatTypeIsPassive(beatType: ExperienceBeatType): boolean {
  return beatTypeWeight(beatType) < 0.5;
}

export function beatTypePressureMultiplier(beatType: ExperienceBeatType, pressure01: number): number {
  const base = beatTypeWeight(beatType);
  const boost = beatTypeIsActiveDrama(beatType) ? pressure01 * 0.15 : 0;
  return Math.min(1, base + boost);
}

// ============================================================================
// MARK: Experience scene archetype registry
// ============================================================================

export const EXPERIENCE_SCENE_ARCHETYPES = Object.freeze([
  'CONFRONTATION',
  'EXPOSITION',
  'REVELATION',
  'NEGOTIATION',
  'AFTERMATH',
  'CEREMONY',
  'CHASE',
  'RESCUE',
  'DEAL',
  'COLLAPSE',
  'COMEBACK',
  'SILENCE',
] as const);

export type ExperienceSceneArchetype = (typeof EXPERIENCE_SCENE_ARCHETYPES)[number];

export function sceneArchetypeIsClimax(archetype: ExperienceSceneArchetype): boolean {
  return (
    archetype === 'CONFRONTATION' ||
    archetype === 'REVELATION' ||
    archetype === 'COLLAPSE' ||
    archetype === 'COMEBACK'
  );
}

export function sceneArchetypePressureWeight(archetype: ExperienceSceneArchetype): number {
  switch (archetype) {
    case 'CONFRONTATION': return 0.96;
    case 'COLLAPSE': return 0.94;
    case 'COMEBACK': return 0.92;
    case 'REVELATION': return 0.90;
    case 'NEGOTIATION': return 0.80;
    case 'RESCUE': return 0.78;
    case 'DEAL': return 0.74;
    case 'CHASE': return 0.72;
    case 'CEREMONY': return 0.6;
    case 'AFTERMATH': return 0.5;
    case 'EXPOSITION': return 0.45;
    case 'SILENCE': return 0.3;
    default: return 0.5;
  }
}

export function sceneArchetypeRequiresWitness(archetype: ExperienceSceneArchetype): boolean {
  return (
    archetype === 'CONFRONTATION' ||
    archetype === 'REVELATION' ||
    archetype === 'COLLAPSE' ||
    archetype === 'COMEBACK' ||
    archetype === 'CEREMONY'
  );
}

export function sceneArchetypeExpectedBeatCount(archetype: ExperienceSceneArchetype): number {
  switch (archetype) {
    case 'CONFRONTATION': return 5;
    case 'COLLAPSE': return 4;
    case 'COMEBACK': return 4;
    case 'REVELATION': return 3;
    case 'CEREMONY': return 3;
    case 'NEGOTIATION': return 4;
    case 'RESCUE': return 3;
    case 'DEAL': return 3;
    case 'CHASE': return 4;
    case 'AFTERMATH': return 2;
    case 'EXPOSITION': return 2;
    case 'SILENCE': return 1;
    default: return 2;
  }
}

// ============================================================================
// MARK: Experience silence purpose registry
// ============================================================================

export const EXPERIENCE_SILENCE_PURPOSES = Object.freeze([
  'TENSION_BUILD',
  'POST_REVELATION',
  'PRESSURE_RELEASE',
  'CEREMONY',
  'AFTERMATH',
  'WITNESS_HOLD',
  'EDITORIAL',
  'AUTHORED',
] as const);

export type ExperienceSilencePurposeKey = (typeof EXPERIENCE_SILENCE_PURPOSES)[number];

export function silencePurposeIsHold(purpose: ExperienceSilencePurposeKey): boolean {
  return purpose === 'WITNESS_HOLD' || purpose === 'CEREMONY' || purpose === 'TENSION_BUILD';
}

export function silencePurposeIsAuthored(purpose: ExperienceSilencePurposeKey): boolean {
  return purpose === 'AUTHORED' || purpose === 'CEREMONY';
}

export function silencePurposeWeight(purpose: ExperienceSilencePurposeKey): number {
  switch (purpose) {
    case 'CEREMONY': return 1.0;
    case 'AUTHORED': return 0.95;
    case 'POST_REVELATION': return 0.85;
    case 'WITNESS_HOLD': return 0.80;
    case 'TENSION_BUILD': return 0.75;
    case 'AFTERMATH': return 0.65;
    case 'PRESSURE_RELEASE': return 0.5;
    case 'EDITORIAL': return 0.4;
    default: return 0.5;
  }
}

export function silencePurposeMinHoldMs(purpose: ExperienceSilencePurposeKey): number {
  switch (purpose) {
    case 'CEREMONY': return 3000;
    case 'AUTHORED': return 2500;
    case 'POST_REVELATION': return 2000;
    case 'WITNESS_HOLD': return 1800;
    case 'TENSION_BUILD': return 1500;
    case 'AFTERMATH': return 1200;
    case 'PRESSURE_RELEASE': return 800;
    case 'EDITORIAL': return 500;
    default: return 800;
  }
}

// ============================================================================
// MARK: Experience pressure tier helpers
// ============================================================================

export const EXPERIENCE_PRESSURE_TIERS = Object.freeze([
  'CALM',
  'WATCHFUL',
  'PRESSURED',
  'CRITICAL',
  'BREAKPOINT',
] as const);

export type ExperiencePressureTier = (typeof EXPERIENCE_PRESSURE_TIERS)[number];

export function pressureTierFrom01(pressure01: number): ExperiencePressureTier {
  if (pressure01 >= 0.92) return 'BREAKPOINT';
  if (pressure01 >= 0.75) return 'CRITICAL';
  if (pressure01 >= 0.55) return 'PRESSURED';
  if (pressure01 >= 0.3) return 'WATCHFUL';
  return 'CALM';
}

export function pressureTierTo01(tier: ExperiencePressureTier): number {
  switch (tier) {
    case 'BREAKPOINT': return 0.95;
    case 'CRITICAL': return 0.82;
    case 'PRESSURED': return 0.65;
    case 'WATCHFUL': return 0.4;
    case 'CALM': return 0.15;
    default: return 0.15;
  }
}

export function pressureTierIsElevated(tier: ExperiencePressureTier): boolean {
  return tier === 'CRITICAL' || tier === 'BREAKPOINT';
}

export function pressureTierRequiresSilence(tier: ExperiencePressureTier): boolean {
  return tier === 'BREAKPOINT';
}

// ============================================================================
// MARK: Experience escalation tier helpers
// ============================================================================

export const EXPERIENCE_ESCALATION_TIERS = Object.freeze([
  'NONE',
  'MILD',
  'ACTIVE',
  'OBSESSIVE',
] as const);

export type ExperienceEscalationTier = (typeof EXPERIENCE_ESCALATION_TIERS)[number];

export function escalationTierFrom01(escalation01: number): ExperienceEscalationTier {
  if (escalation01 >= 0.85) return 'OBSESSIVE';
  if (escalation01 >= 0.6) return 'ACTIVE';
  if (escalation01 >= 0.3) return 'MILD';
  return 'NONE';
}

export function escalationTierIsActive(tier: ExperienceEscalationTier): boolean {
  return tier === 'ACTIVE' || tier === 'OBSESSIVE';
}

// ============================================================================
// MARK: Experience scene planner utilities
// ============================================================================

/** Returns whether a scene plan has high branchPressureTags count. */
export function scenePlanHasBranchRisk(
  plan: ExperienceSceneDecision,
): boolean {
  return (
    (plan.telemetry.branchPressureTags?.length ?? 0) > 0 &&
    plan.telemetry.pressure01 > 0.5
  );
}

/** Returns whether a scene decision should force silence (high pressure, no beats). */
export function scenePlanShouldForceSilence(
  plan: ExperienceSceneDecision,
): boolean {
  return plan.telemetry.pressure01 >= 0.8 || plan.telemetry.expectedVisibleBeats === 0;
}

/** Returns the primary speaker from a scene decision. */
export function scenePlanPrimaryChannel(
  plan: ExperienceSceneDecision,
): string | null {
  return plan.plan?.speakerOrder?.[0] ?? null;
}

/** Returns whether a scene plan validation report has any blocking issues. */
export function scenePlanHasBlockingIssues(
  report: ExperienceScenePlanValidation,
): boolean {
  return !report.ok;
}

/** Returns a plain explanation string from a scene decision explanation. */
export function describeSceneDecision(
  explanation: ExperienceSceneDecisionExplanation,
): string {
  const reason = explanation.reasons?.[0] ?? 'UNKNOWN';
  return `archetype=${explanation.archetype} reason=${reason} confidence=${explanation.confidence01.toFixed(2)}`;
}

/** Returns whether a scene telemetry object represents high dramatic potential. */
export function sceneHasHighDramaticPotential(telemetry: ExperienceSceneTelemetry): boolean {
  return telemetry.pressure01 >= 0.7 && telemetry.crowdHeat01 >= 0.5;
}

/** Returns whether a scene should trigger a witness escalation. */
export function sceneRequiresWitnessEscalation(telemetry: ExperienceSceneTelemetry): boolean {
  return telemetry.witnessNeed01 >= 0.75;
}

/** Returns a drama score (0–1) from scene telemetry. */
export function deriveDramaScore(telemetry: ExperienceSceneTelemetry): number {
  return Math.min(1, (
    telemetry.pressure01 * 0.35 +
    telemetry.crowdHeat01 * 0.2 +
    telemetry.witnessNeed01 * 0.2 +
    telemetry.legendHeat01 * 0.15 +
    telemetry.revealNeed01 * 0.1
  ));
}

// ============================================================================
// MARK: Experience drama orchestrator utilities
// ============================================================================

/** Derives drama intensity score from a context snapshot. */
export function deriveDramaIntensityScore(
  ctx: ExperienceContextSnapshot,
): number {
  return Math.min(1, ctx.pressure01 * 1.1);
}

/** Returns whether the drama context is in witness-pressure mode. */
export function isWitnessPressureActive(
  ctx: ExperienceContextSnapshot,
): boolean {
  return ctx.pressure01 >= 0.75 && (ctx.worldTags?.some((t) => t.includes('WITNESS')) ?? false);
}

/** Returns whether a materialization is considered high-stakes. */
export function materializationIsHighStakes(
  m: ExperienceMaterialization,
): boolean {
  return (
    m.beatDescriptors.length >= 3 ||
    m.diagnostics.telemetry.pressure01 >= 0.8
  );
}

/** Returns whether a drama budget allows further visible output. */
export function dramaBudgetAllowsVisible(budget: ExperienceDramaBudget): boolean {
  return budget.maxVisibleMessages > 0;
}

/** Returns whether a drama budget allows legend insertion. */
export function dramaBudgetAllowsLegend(budget: ExperienceDramaBudget): boolean {
  return budget.allowLegendInsertion;
}

/** Returns whether a drama budget allows crowd beats. */
export function dramaBudgetAllowsCrowd(budget: ExperienceDramaBudget): boolean {
  return budget.allowCrowdVisible;
}

/** Returns a summary of what a materialization authorized. */
export function describeMaterializationAuthority(
  m: ExperienceMaterialization,
): string {
  const hater = m.diagnostics.authorityAccepted.hater ? 'HATER:Y' : 'HATER:N';
  const helper = m.diagnostics.authorityAccepted.helper ? 'HELPER:Y' : 'HELPER:N';
  const beats = m.beatDescriptors.length;
  const pressure = m.diagnostics.telemetry.pressure01.toFixed(2);
  return `pressure=${pressure} beats=${beats} ${hater} ${helper}`;
}

/** Merges multiple drama telemetry digests into one aggregate. */
export function mergeDramaTelemetryDigests(
  digests: readonly ExperienceDramaTelemetryDigest[],
): ExperienceDramaTelemetryDigest {
  if (digests.length === 0) {
    return {
      pressure01: 0,
      relationshipPressure01: 0,
      rescueNeed01: 0,
      callbackOpportunity01: 0,
      crowdHeat01: 0,
      silencePreference01: 0,
      expectedDurationMs: 0,
      expectedVisibleBeats: 0,
      expectedShadowBeats: 0,
      stageMood: 'NEUTRAL',
      archetype: 'EXPOSITION',
      reasons: [],
      witnessPressure01: 0,
    };
  }
  const avg = (key: keyof ExperienceDramaTelemetryDigest): number => {
    const nums = digests
      .map((d) => d[key])
      .filter((v): v is number => typeof v === 'number');
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  };
  return Object.freeze({
    pressure01: avg('pressure01'),
    relationshipPressure01: avg('relationshipPressure01'),
    rescueNeed01: avg('rescueNeed01'),
    callbackOpportunity01: avg('callbackOpportunity01'),
    crowdHeat01: avg('crowdHeat01'),
    silencePreference01: avg('silencePreference01'),
    expectedDurationMs: avg('expectedDurationMs'),
    expectedVisibleBeats: Math.round(avg('expectedVisibleBeats')),
    expectedShadowBeats: Math.round(avg('expectedShadowBeats')),
    stageMood: digests[digests.length - 1].stageMood,
    archetype: digests[digests.length - 1].archetype,
    reasons: digests.flatMap((d) => d.reasons),
    witnessPressure01: avg('witnessPressure01'),
  });
}

// ============================================================================
// MARK: Experience moment ledger utilities
// ============================================================================

/** Returns whether a moment is currently active (not resolved/cancelled). */
export function momentIsActive(record: ExperienceMomentRecord): boolean {
  return record.status === 'EMITTING' || record.status === 'PLANNED';
}

/** Returns whether a moment has pending reveal reservations. */
export function momentHasPendingReveals(record: ExperienceMomentRecord): boolean {
  return record.pendingRevealReservationIds.length > 0;
}

/** Returns whether a moment has active silence windows. */
export function momentIsInSilence(record: ExperienceMomentRecord): boolean {
  return record.activeSilenceWindowIds.length > 0;
}

/** Returns whether a moment has been emitted at least once. */
export function momentHasEmissions(record: ExperienceMomentRecord): boolean {
  return record.visibleEmissionIds.length > 0 || record.shadowEmissionIds.length > 0;
}

/** Returns the count of moments in each status group from a stats snapshot. */
export function momentStatsToReadinessRatio(
  stats: ExperienceLedgerStats,
): number {
  const total = stats.registeredMoments;
  if (total === 0) return 1;
  return stats.resolvedMoments / total;
}

/** Returns whether the ledger is healthy (no runaway unresolved moments). */
export function ledgerIsHealthy(stats: ExperienceLedgerStats): boolean {
  const unresolved = stats.registeredMoments - stats.resolvedMoments - stats.cancelledMoments;
  return unresolved < 20;
}

/** Returns a readable summary line for a moment record. */
export function describeMoment(record: ExperienceMomentRecord): string {
  return `[moment:${record.momentId}] status=${record.status} intensity=${record.intensity01.toFixed(2)} importance=${record.importance01.toFixed(2)}`;
}

// ============================================================================
// MARK: Experience silence policy utilities
// ============================================================================

/** Returns a readable summary of a silence decision. */
export function describeSilenceDecision(decision: ExperienceSilenceDecision): string {
  const kind = decision.kind;
  const purpose = decision.purpose ?? 'UNSPECIFIED';
  const holdMs = decision.holdMs;
  return `[silence:${kind}] purpose=${purpose} hold=${holdMs}ms score=${decision.score01.toFixed(2)}`;
}

/** Returns whether a silence decision demands an active hold. */
export function silenceDecisionIsBlocking(decision: ExperienceSilenceDecision): boolean {
  return decision.holdMs > 0 && decision.score01 >= 0.5;
}

/** Returns whether a silence decision suppresses crowd output. */
export function silenceDecisionSuppressesCrowd(decision: ExperienceSilenceDecision): boolean {
  return decision.shouldSuppressCrowd;
}

/** Returns whether a silence window plan contains any authored silence. */
export function silencePlanHasAuthoredSilence(
  plan: ExperienceSceneSilencePlan,
): boolean {
  return plan.windows.some(
    (w) => w.purpose === 'TYPING_THEATER' || w.purpose === 'LEGEND_BREATH',
  );
}

/** Returns the total beat count in a silence plan's schedule. */
export function silencePlanBeatCount(plan: ExperienceSceneSilencePlan): number {
  return plan.beatSchedule.length;
}

/** Returns the total silence window count in a plan. */
export function silencePlanWindowCount(plan: ExperienceSceneSilencePlan): number {
  return plan.windows.length;
}

/** Returns total silence hold time across all windows in a plan. */
export function silencePlanTotalHoldMs(plan: ExperienceSceneSilencePlan): number {
  return plan.windows.reduce(
    (sum, w) => sum + (w.closesAt - w.opensAt),
    0,
  );
}

/** Returns whether a silence window is still open at the given timestamp. */
export function silenceWindowIsOpen(
  window: ExperienceSilenceWindowPlan,
  nowMs: number,
): boolean {
  return window.opensAt <= nowMs && window.closesAt > nowMs;
}

/** Returns whether a silence window can be interrupted. */
export function silenceWindowIsInterruptible(
  window: ExperienceSilenceWindowPlan,
): boolean {
  return window.interruptible;
}

/** Returns whether an interrupt assessment permits the interrupt. */
export function interruptIsPermitted(assessment: ExperienceInterruptAssessment): boolean {
  return assessment.disposition === 'ALLOW' || assessment.disposition === 'ALLOW_SHADOW_ONLY';
}

/** Returns whether an interrupt assessment blocks. */
export function interruptIsBlocked(assessment: ExperienceInterruptAssessment): boolean {
  return assessment.disposition === 'DENY';
}

// ============================================================================
// MARK: Experience lane diagnostics
// ============================================================================

export interface ChatExperienceLaneDiagnostics {
  readonly version: typeof CHAT_EXPERIENCE_BARREL_VERSION;
  readonly dramaActive: boolean;
  readonly scenePressure01: number;
  readonly momentsRegistered: number;
  readonly momentsResolved: number;
  readonly activeSilenceWindows: number;
  readonly beatScheduleLength: number;
  readonly lastDecisionKind: ExperienceSilenceDecisionKind | null;
  readonly lastSceneArchetype: string | null;
  readonly ledgerHealthy: boolean;
}

export function buildExperienceLaneDiagnosticsShell(): ChatExperienceLaneDiagnostics {
  return Object.freeze({
    version: CHAT_EXPERIENCE_BARREL_VERSION,
    dramaActive: false,
    scenePressure01: 0,
    momentsRegistered: 0,
    momentsResolved: 0,
    activeSilenceWindows: 0,
    beatScheduleLength: 0,
    lastDecisionKind: null,
    lastSceneArchetype: null,
    ledgerHealthy: true,
  });
}

export function buildExperienceLaneDiagnosticsFromStats(
  stats: ExperienceLedgerStats,
  lastDecisionKind: ExperienceSilenceDecisionKind | null,
  lastSceneTelemetry: ExperienceSceneTelemetry | null,
): ChatExperienceLaneDiagnostics {
  return Object.freeze({
    version: CHAT_EXPERIENCE_BARREL_VERSION,
    dramaActive: (lastSceneTelemetry?.pressure01 ?? 0) > 0.4,
    scenePressure01: lastSceneTelemetry?.pressure01 ?? 0,
    momentsRegistered: stats.registeredMoments,
    momentsResolved: stats.resolvedMoments,
    activeSilenceWindows: stats.activeSilenceWindows,
    beatScheduleLength: 0,
    lastDecisionKind,
    lastSceneArchetype: lastSceneTelemetry?.archetype ?? null,
    ledgerHealthy: ledgerIsHealthy(stats),
  });
}

// ============================================================================
// MARK: Experience lane module descriptor table
// ============================================================================

export interface ChatExperienceModuleDescriptor {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly category: 'DRAMA' | 'SCENE' | 'MOMENT' | 'SILENCE';
  readonly readiness: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly ownsTruth: boolean;
  readonly description: string;
  readonly primaryClass: string;
  readonly factoryFn: string;
}

export const CHAT_EXPERIENCE_MODULE_DESCRIPTORS: readonly ChatExperienceModuleDescriptor[] =
  Object.freeze([
    {
      id: 'drama-orchestrator',
      name: 'ChatDramaOrchestrator',
      file: 'experience/ChatDramaOrchestrator.ts',
      category: 'DRAMA',
      readiness: 'GENERATED',
      ownsTruth: true,
      description: 'Top-level dramatic beat authority. Coordinates scene materialization, pressure escalation, and authored drama across channels.',
      primaryClass: 'ChatDramaOrchestrator',
      factoryFn: 'createChatDramaOrchestrator',
    },
    {
      id: 'scene-planner',
      name: 'ChatScenePlanner',
      file: 'experience/ChatScenePlanner.ts',
      category: 'SCENE',
      readiness: 'GENERATED',
      ownsTruth: true,
      description: 'Plans individual scenes from pressure + memory + relationship state. Resolves archetype, speaker order, beat structure, and branch points.',
      primaryClass: 'ChatScenePlanner',
      factoryFn: 'createChatScenePlanner',
    },
    {
      id: 'moment-ledger',
      name: 'ChatMomentLedger',
      file: 'experience/ChatMomentLedger.ts',
      category: 'MOMENT',
      readiness: 'GENERATED',
      ownsTruth: true,
      description: 'Tracks registered moments, reveal reservations, silence windows, and carryover records across the run lifecycle.',
      primaryClass: 'ChatMomentLedger',
      factoryFn: 'createChatMomentLedger',
    },
    {
      id: 'silence-policy',
      name: 'ChatSilencePolicy',
      file: 'experience/ChatSilencePolicy.ts',
      category: 'SILENCE',
      readiness: 'GENERATED',
      ownsTruth: true,
      description: 'Decides silence disposition, interrupt allowance, and beat scheduling. Produces authored silence plans for the current scene.',
      primaryClass: 'ChatSilencePolicy',
      factoryFn: 'createChatSilencePolicy',
    },
  ]);

export function experienceModuleDescriptorById(
  id: string,
): ChatExperienceModuleDescriptor | undefined {
  return CHAT_EXPERIENCE_MODULE_DESCRIPTORS.find((m) => m.id === id);
}

export function experienceModuleDescriptorsByCategory(
  category: ChatExperienceModuleDescriptor['category'],
): readonly ChatExperienceModuleDescriptor[] {
  return CHAT_EXPERIENCE_MODULE_DESCRIPTORS.filter((m) => m.category === category);
}

// ============================================================================
// MARK: Experience lane doctrine
// ============================================================================

export const CHAT_EXPERIENCE_DOCTRINE = Object.freeze({
  version: CHAT_EXPERIENCE_BARREL_VERSION,
  rules: Object.freeze([
    'Drama is authored, not random. Every beat must be intentional.',
    'Silence is a beat. The room going quiet is as meaningful as the room erupting.',
    'Scene archetypes shape the run. A run without archetype is noise.',
    'Moments must resolve. Unresolved moments compound into chaos.',
    'Pressure drives escalation. Escalation drives witnessing. Witnessing drives legend.',
    'Crowd reaction is delayed and gated. It must earn its moment.',
    'The experience lane owns the texture of chat — not the content.',
    'No direct socket writes. No frontend ownership. Backend authority only.',
    'Reveal reservations gate dramatic reveals. They must be honoured.',
    'Carryover rules prevent experience debt from compounding across scenes.',
  ] as const),
  categoryWeights: Object.freeze({
    DRAMA: 0.35,
    SCENE: 0.28,
    MOMENT: 0.22,
    SILENCE: 0.15,
  }),
} as const);

// ============================================================================
// MARK: Experience lane coverage report
// ============================================================================

export interface ChatExperienceCoverageReport {
  readonly totalModules: number;
  readonly generatedModules: number;
  readonly pendingModules: number;
  readonly plannedModules: number;
  readonly beatTypesSupported: number;
  readonly sceneArchetypesSupported: number;
  readonly silencePurposesSupported: number;
  readonly pressureTiersSupported: number;
  readonly escalationTiersSupported: number;
}

export function buildExperienceCoverageReport(): ChatExperienceCoverageReport {
  const descriptors = CHAT_EXPERIENCE_MODULE_DESCRIPTORS;
  return Object.freeze({
    totalModules: descriptors.length,
    generatedModules: descriptors.filter((d) => d.readiness === 'GENERATED').length,
    pendingModules: descriptors.filter((d) => d.readiness === 'PENDING').length,
    plannedModules: descriptors.filter((d) => d.readiness === 'PLANNED').length,
    beatTypesSupported: EXPERIENCE_BEAT_TYPES.length,
    sceneArchetypesSupported: EXPERIENCE_SCENE_ARCHETYPES.length,
    silencePurposesSupported: EXPERIENCE_SILENCE_PURPOSES.length,
    pressureTiersSupported: EXPERIENCE_PRESSURE_TIERS.length,
    escalationTiersSupported: EXPERIENCE_ESCALATION_TIERS.length,
  });
}

// ============================================================================
// MARK: Experience lane audit
// ============================================================================

export interface ChatExperienceLaneAuditEntry {
  readonly subsystem: 'DramaOrchestrator' | 'ScenePlanner' | 'MomentLedger' | 'SilencePolicy';
  readonly eventKind: string;
  readonly summary: string;
  readonly pressure01: number;
  readonly timestampMs: number;
  readonly tags: readonly string[];
}

export function buildDramaAuditEntry(
  m: ExperienceMaterialization,
  nowMs: number,
): ChatExperienceLaneAuditEntry {
  return Object.freeze({
    subsystem: 'DramaOrchestrator' as const,
    eventKind: 'MATERIALIZATION',
    summary: describeMaterializationAuthority(m),
    pressure01: m.diagnostics.telemetry.pressure01,
    timestampMs: nowMs,
    tags: m.chosenTags,
  });
}

export function buildSceneAuditEntry(
  decision: ExperienceSceneDecision,
  nowMs: number,
): ChatExperienceLaneAuditEntry {
  return Object.freeze({
    subsystem: 'ScenePlanner' as const,
    eventKind: 'SCENE_DECISION',
    summary: `archetype=${decision.telemetry.archetype} pressure=${decision.telemetry.pressure01.toFixed(2)}`,
    pressure01: decision.telemetry.pressure01,
    timestampMs: nowMs,
    tags: decision.plan?.planningTags ?? [],
  });
}

export function buildSilenceAuditEntry(
  decision: ExperienceSilenceDecision,
  nowMs: number,
): ChatExperienceLaneAuditEntry {
  return Object.freeze({
    subsystem: 'SilencePolicy' as const,
    eventKind: 'SILENCE_DECISION',
    summary: describeSilenceDecision(decision),
    pressure01: decision.score01,
    timestampMs: nowMs,
    tags: decision.tags,
  });
}

// ============================================================================
// MARK: Experience lane cross-subsystem integration helpers
// ============================================================================

/**
 * Returns whether a scene decision and a silence decision are mutually
 * compatible — i.e. the scene doesn't have beats that the silence plan blocks.
 */
export function sceneAndSilenceAreCompatible(
  scene: ExperienceSceneDecision,
  silence: ExperienceSilenceDecision,
): boolean {
  if (silence.shouldSuppressCrowd && scene.telemetry.crowdHeat01 > 0.8) return false;
  if (silence.holdMs > 5000 && scene.telemetry.expectedVisibleBeats > 3) return false;
  return true;
}

/**
 * Returns whether a drama materialization and a moment record are consistent —
 * i.e. the materialization's archetype matches the moment's planned archetype.
 */
export function materializationMatchesMoment(
  m: ExperienceMaterialization,
  record: ExperienceMomentRecord,
): boolean {
  if (!record.sceneArchetype) return true;
  return m.diagnostics.telemetry.archetype === record.sceneArchetype;
}

/**
 * Derives a combined experience score from all four subsystem outputs.
 * Score of 1.0 = perfect alignment, high pressure, authored beats, silence respected.
 */
export function deriveExperienceCombinedScore(
  sceneTelemetry: ExperienceSceneTelemetry,
  silenceDecision: ExperienceSilenceDecision,
  ledgerStats: ExperienceLedgerStats,
): number {
  const sceneScore = deriveDramaScore(sceneTelemetry);
  const silenceScore = silenceDecision.score01;
  const ledgerScore = momentStatsToReadinessRatio(ledgerStats);
  return Math.min(1, sceneScore * 0.5 + silenceScore * 0.25 + ledgerScore * 0.25);
}

// ============================================================================
// MARK: Experience lane constants
// ============================================================================

export const EXPERIENCE_LANE_CONSTANTS = Object.freeze({
  MAX_BEATS_PER_SCENE: 8,
  MIN_BEATS_PER_SCENE: 1,
  MAX_SILENCE_WINDOWS_PER_SCENE: 4,
  MAX_ACTIVE_MOMENTS_PER_PLAYER: 12,
  MAX_PENDING_REVEALS_PER_MOMENT: 3,
  DEFAULT_HOLD_MS: 1200,
  MINIMUM_DRAMATIC_PRESSURE_01: 0.15,
  WITNESS_ESCALATION_THRESHOLD_01: 0.75,
  LEGEND_BREATH_THRESHOLD_01: 0.82,
  CROWD_SWARM_THRESHOLD_01: 0.65,
  COMBAT_SILENCE_HOLD_MS: 2200,
  CEREMONY_SILENCE_HOLD_MS: 3500,
  REVELATION_BEAT_BONUS_DELAY_MS: 1400,
  CONFRONTATION_BEAT_WEIGHT_MULTIPLIER: 1.18,
  AFTERMATH_SILENCE_HOLD_MS: 1800,
} as const);

// ============================================================================
// MARK: ChatExperienceModule — unified frozen authority object
// ============================================================================

export const ChatExperienceModule = Object.freeze({
  version: CHAT_EXPERIENCE_BARREL_VERSION,

  DramaOrchestrator,
  ScenePlanner,
  MomentLedger,
  SilencePolicy,

  // Class references
  ChatDramaOrchestratorClass,
  ChatScenePlannerClass,
  ChatMomentLedgerClass,
  ChatSilencePolicyClass,

  // Factory references
  createChatDramaOrchestrator,
  createChatScenePlanner,
  createChatSilencePolicy,
  createChatMomentLedger,

  // Config defaults
  DEFAULT_SCENE_PLANNER_CONFIG,
  DEFAULT_MOMENT_LEDGER_CONFIG,
  DEFAULT_SILENCE_POLICY_CONFIG,

  // Scene planner helpers
  planChatScene,
  projectSceneArchetype,
  projectSceneStageMood,
  projectSceneTelemetry,
  projectScenePlan,
  projectSceneBranchPoints,
  projectSceneSpeakerOrder,
  projectSceneBeatTypes,
  projectSceneCallbackAnchors,
  validateScenePlan,
  scenePlanHasBranchRisk,
  scenePlanShouldForceSilence,
  scenePlanPrimaryChannel,
  scenePlanHasBlockingIssues,
  describeSceneDecision,
  sceneHasHighDramaticPotential,
  sceneRequiresWitnessEscalation,
  deriveDramaScore,

  // Drama orchestrator helpers
  deriveDramaIntensityScore,
  isWitnessPressureActive,
  materializationIsHighStakes,
  dramaBudgetAllowsVisible,
  dramaBudgetAllowsLegend,
  dramaBudgetAllowsCrowd,
  describeMaterializationAuthority,
  mergeDramaTelemetryDigests,

  // Moment ledger helpers
  momentIsActive,
  momentHasPendingReveals,
  momentIsInSilence,
  momentHasEmissions,
  momentStatsToReadinessRatio,
  ledgerIsHealthy,
  describeMoment,

  // Silence policy helpers
  describeSilenceDecision,
  silenceDecisionIsBlocking,
  silenceDecisionSuppressesCrowd,
  silencePlanHasAuthoredSilence,
  silencePlanBeatCount,
  silencePlanWindowCount,
  silencePlanTotalHoldMs,
  silenceWindowIsOpen,
  silenceWindowIsInterruptible,
  interruptIsPermitted,
  interruptIsBlocked,

  // Beat helpers
  beatTypeWeight,
  beatTypeIsActiveDrama,
  beatTypeIsPassive,
  beatTypePressureMultiplier,

  // Archetype helpers
  sceneArchetypeIsClimax,
  sceneArchetypePressureWeight,
  sceneArchetypeRequiresWitness,
  sceneArchetypeExpectedBeatCount,

  // Silence purpose helpers
  silencePurposeIsHold,
  silencePurposeIsAuthored,
  silencePurposeWeight,
  silencePurposeMinHoldMs,

  // Pressure / escalation tier helpers
  pressureTierFrom01,
  pressureTierTo01,
  pressureTierIsElevated,
  pressureTierRequiresSilence,
  escalationTierFrom01,
  escalationTierIsActive,

  // Diagnostics
  buildExperienceLaneDiagnosticsShell,
  buildExperienceLaneDiagnosticsFromStats,
  buildExperienceCoverageReport,

  // Audit helpers
  buildDramaAuditEntry,
  buildSceneAuditEntry,
  buildSilenceAuditEntry,

  // Cross-subsystem helpers
  sceneAndSilenceAreCompatible,
  materializationMatchesMoment,
  deriveExperienceCombinedScore,

  // Registries
  EXPERIENCE_BEAT_TYPES,
  EXPERIENCE_BEAT_TYPE_WEIGHT,
  EXPERIENCE_SILENCE_PURPOSES,
  EXPERIENCE_SCENE_ARCHETYPES,
  EXPERIENCE_PRESSURE_TIERS,
  EXPERIENCE_ESCALATION_TIERS,
  CHAT_EXPERIENCE_LANE_READINESS,
  CHAT_EXPERIENCE_DOCTRINE,
  CHAT_EXPERIENCE_MODULE_DESCRIPTORS,
  EXPERIENCE_LANE_CONSTANTS,

  meta: CHAT_EXPERIENCE_BARREL_META,
});

// ============================================================================
// MARK: Experience lane run-scoped state interface
// ============================================================================

/**
 * A lightweight view of the experience lane's state at one point in a run.
 * Composed from the four subsystem snapshots for logging/diagnostics.
 */
export interface ChatExperienceRunState {
  readonly runId: string;
  readonly capturedAtMs: number;
  readonly pressure01: number;
  readonly escalationTier: ExperienceEscalationTier;
  readonly pressureTier: ExperiencePressureTier;
  readonly activeMomentCount: number;
  readonly pendingRevealCount: number;
  readonly activeSilenceWindowCount: number;
  readonly lastArchetype: ExperienceSceneArchetype | null;
  readonly lastSilenceKind: ExperienceSilenceDecisionKind | null;
  readonly ledgerHealthy: boolean;
  readonly dramaIsActive: boolean;
  readonly beatScheduleLength: number;
  readonly combinedScore: number;
}

export function buildExperienceRunStateShell(runId: string, nowMs: number): ChatExperienceRunState {
  return Object.freeze({
    runId,
    capturedAtMs: nowMs,
    pressure01: 0,
    escalationTier: 'NONE',
    pressureTier: 'CALM',
    activeMomentCount: 0,
    pendingRevealCount: 0,
    activeSilenceWindowCount: 0,
    lastArchetype: null,
    lastSilenceKind: null,
    ledgerHealthy: true,
    dramaIsActive: false,
    beatScheduleLength: 0,
    combinedScore: 0,
  });
}

export function buildExperienceRunState(
  runId: string,
  nowMs: number,
  ledgerStats: ExperienceLedgerStats,
  lastSceneTelemetry: ExperienceSceneTelemetry | null,
  lastSilenceDecision: ExperienceSilenceDecision | null,
): ChatExperienceRunState {
  const pressure01 = lastSceneTelemetry?.pressure01 ?? 0;
  const combinedScore = lastSceneTelemetry && lastSilenceDecision
    ? deriveExperienceCombinedScore(lastSceneTelemetry, lastSilenceDecision, ledgerStats)
    : 0;
  return Object.freeze({
    runId,
    capturedAtMs: nowMs,
    pressure01,
    escalationTier: escalationTierFrom01(pressure01),
    pressureTier: pressureTierFrom01(pressure01),
    activeMomentCount: ledgerStats.registeredMoments - ledgerStats.resolvedMoments - ledgerStats.cancelledMoments - ledgerStats.timedOutMoments,
    pendingRevealCount: ledgerStats.activeRevealReservations,
    activeSilenceWindowCount: ledgerStats.activeSilenceWindows,
    lastArchetype: (lastSceneTelemetry?.archetype as ExperienceSceneArchetype) ?? null,
    lastSilenceKind: lastSilenceDecision?.kind ?? null,
    ledgerHealthy: ledgerIsHealthy(ledgerStats),
    dramaIsActive: pressure01 > 0.4,
    beatScheduleLength: lastSilenceDecision ? 1 : 0,
    combinedScore,
  });
}

export function runStateRequiresEscalation(state: ChatExperienceRunState): boolean {
  return state.escalationTier === 'ACTIVE' || state.escalationTier === 'OBSESSIVE';
}

export function runStateRequiresImmediateSilence(state: ChatExperienceRunState): boolean {
  return state.pressureTier === 'BREAKPOINT' || state.activeSilenceWindowCount > 0;
}

export function runStateIsStable(state: ChatExperienceRunState): boolean {
  return state.ledgerHealthy && state.combinedScore >= 0.4 && state.pressureTier !== 'BREAKPOINT';
}

export function describeRunState(state: ChatExperienceRunState): string {
  return (
    `[run:${state.runId}] pressure=${state.pressure01.toFixed(2)} ` +
    `tier=${state.pressureTier} escalation=${state.escalationTier} ` +
    `moments=${state.activeMomentCount} score=${state.combinedScore.toFixed(2)}`
  );
}

// ============================================================================
// MARK: Experience lane batch helpers
// ============================================================================

/**
 * Given a list of moment records, return only those that are both active
 * and have pending reveals.
 */
export function filterMomentsWithPendingReveals(
  records: readonly ExperienceMomentRecord[],
): readonly ExperienceMomentRecord[] {
  return records.filter((r) => momentIsActive(r) && momentHasPendingReveals(r));
}

/**
 * Given a list of moment records, return only those currently in a silence window.
 */
export function filterMomentsInSilence(
  records: readonly ExperienceMomentRecord[],
): readonly ExperienceMomentRecord[] {
  return records.filter((r) => momentIsInSilence(r));
}

/**
 * Sort moment records by descending intensity — highest pressure first.
 */
export function sortMomentsByIntensityDesc(
  records: readonly ExperienceMomentRecord[],
): ExperienceMomentRecord[] {
  return [...records].sort((a, b) => b.intensity01 - a.intensity01);
}

/**
 * Sort moment records by descending importance.
 */
export function sortMomentsByImportanceDesc(
  records: readonly ExperienceMomentRecord[],
): ExperienceMomentRecord[] {
  return [...records].sort((a, b) => b.importance01 - a.importance01);
}

/**
 * Returns the top-N highest intensity active moments.
 */
export function topNActiveMoments(
  records: readonly ExperienceMomentRecord[],
  n: number,
): ExperienceMomentRecord[] {
  return sortMomentsByIntensityDesc(records.filter((r) => momentIsActive(r))).slice(0, n);
}

/**
 * Aggregate pressure01 from multiple scene telemetry objects (weighted mean).
 */
export function aggregateScenePressure(
  telemetryList: readonly ExperienceSceneTelemetry[],
): number {
  if (telemetryList.length === 0) return 0;
  const total = telemetryList.reduce((sum, t) => sum + t.pressure01, 0);
  return Math.min(1, total / telemetryList.length);
}

/**
 * Returns whether any scene in the list requires witness escalation.
 */
export function anySceneRequiresWitnessEscalation(
  telemetryList: readonly ExperienceSceneTelemetry[],
): boolean {
  return telemetryList.some((t) => sceneRequiresWitnessEscalation(t));
}

/**
 * Returns whether all silence decisions in a list are non-blocking.
 */
export function allSilenceDecisionsNonBlocking(
  decisions: readonly ExperienceSilenceDecision[],
): boolean {
  return decisions.every((d) => !silenceDecisionIsBlocking(d));
}

/**
 * Merge multiple silence plans' total hold times.
 */
export function totalHoldMsFromPlans(plans: readonly ExperienceSceneSilencePlan[]): number {
  return plans.reduce((sum, p) => sum + silencePlanTotalHoldMs(p), 0);
}

/**
 * Returns all windows from a list of silence plans that are currently open.
 */
export function collectOpenWindows(
  plans: readonly ExperienceSceneSilencePlan[],
  nowMs: number,
): ExperienceSilenceWindowPlan[] {
  return plans.flatMap((p) => p.windows.filter((w) => silenceWindowIsOpen(w, nowMs)));
}

// ============================================================================
// MARK: Experience lane scene branch analysis
// ============================================================================

export interface ExperienceSceneBranchAnalysis {
  readonly hasBranchRisk: boolean;
  readonly shouldForceSilence: boolean;
  readonly primaryChannel: string | null;
  readonly hasBlockingIssues: boolean;
  readonly dramaPotential: boolean;
  readonly requiresWitness: boolean;
  readonly dramaScore: number;
  readonly expectedBeats: number;
  readonly pressure01: number;
  readonly archetype: string;
}

export function analyzeSceneDecision(
  decision: ExperienceSceneDecision,
): ExperienceSceneBranchAnalysis {
  return Object.freeze({
    hasBranchRisk: scenePlanHasBranchRisk(decision),
    shouldForceSilence: scenePlanShouldForceSilence(decision),
    primaryChannel: scenePlanPrimaryChannel(decision),
    hasBlockingIssues: false,
    dramaPotential: sceneHasHighDramaticPotential(decision.telemetry),
    requiresWitness: sceneRequiresWitnessEscalation(decision.telemetry),
    dramaScore: deriveDramaScore(decision.telemetry),
    expectedBeats: decision.telemetry.expectedVisibleBeats,
    pressure01: decision.telemetry.pressure01,
    archetype: decision.telemetry.archetype,
  });
}

export function sceneDecisionShouldTriggerCrowdWave(
  decision: ExperienceSceneDecision,
): boolean {
  return (
    decision.telemetry.crowdHeat01 >= EXPERIENCE_LANE_CONSTANTS.CROWD_SWARM_THRESHOLD_01 &&
    sceneArchetypeRequiresWitness(decision.telemetry.archetype as ExperienceSceneArchetype)
  );
}

export function sceneDecisionShouldTriggerLegendBeat(
  decision: ExperienceSceneDecision,
): boolean {
  return decision.telemetry.legendHeat01 >= EXPERIENCE_LANE_CONSTANTS.LEGEND_BREATH_THRESHOLD_01;
}

export function sceneDecisionExpectedDurationBand(
  decision: ExperienceSceneDecision,
): 'SHORT' | 'MEDIUM' | 'LONG' | 'EXTENDED' {
  const ms = decision.telemetry.expectedDurationMs;
  if (ms >= 12000) return 'EXTENDED';
  if (ms >= 7000) return 'LONG';
  if (ms >= 3000) return 'MEDIUM';
  return 'SHORT';
}

// ============================================================================
// MARK: Experience lane silence window schedule builder
// ============================================================================

export interface ExperienceSilenceScheduleEntry {
  readonly windowIndex: number;
  readonly opensAt: number;
  readonly closesAt: number;
  readonly durationMs: number;
  readonly purpose: string;
  readonly isInterruptible: boolean;
  readonly isOpen: boolean;
}

export function buildSilenceScheduleFromPlan(
  plan: ExperienceSceneSilencePlan,
  nowMs: number,
): readonly ExperienceSilenceScheduleEntry[] {
  return plan.windows.map((w, i) =>
    Object.freeze({
      windowIndex: i,
      opensAt: w.opensAt,
      closesAt: w.closesAt,
      durationMs: w.closesAt - w.opensAt,
      purpose: w.purpose,
      isInterruptible: silenceWindowIsInterruptible(w),
      isOpen: silenceWindowIsOpen(w, nowMs),
    }),
  );
}

export function silenceScheduleHasOpenWindow(
  schedule: readonly ExperienceSilenceScheduleEntry[],
): boolean {
  return schedule.some((e) => e.isOpen);
}

export function silenceScheduleTotalDurationMs(
  schedule: readonly ExperienceSilenceScheduleEntry[],
): number {
  return schedule.reduce((sum, e) => sum + e.durationMs, 0);
}

export function silenceScheduleInterruptibleWindowCount(
  schedule: readonly ExperienceSilenceScheduleEntry[],
): number {
  return schedule.filter((e) => e.isInterruptible).length;
}

export function silenceScheduleFirstOpenWindow(
  schedule: readonly ExperienceSilenceScheduleEntry[],
): ExperienceSilenceScheduleEntry | null {
  return schedule.find((e) => e.isOpen) ?? null;
}

// ============================================================================
// MARK: Experience lane beat sequencer helpers
// ============================================================================

export interface ExperienceBeatSequence {
  readonly sceneArchetype: ExperienceSceneArchetype;
  readonly beats: readonly ExperienceBeatType[];
  readonly totalWeight: number;
  readonly maxWeight: number;
  readonly climaxBeatIndex: number | null;
  readonly hasSilenceBeat: boolean;
  readonly expectedDurationMs: number;
}

export function buildBeatSequence(
  archetype: ExperienceSceneArchetype,
  pressure01: number,
): ExperienceBeatSequence {
  const count = sceneArchetypeExpectedBeatCount(archetype);
  const isClimax = sceneArchetypeIsClimax(archetype);

  const beats: ExperienceBeatType[] = [];
  beats.push('OPENING');
  if (pressure01 >= 0.5) beats.push('PROBE');
  if (pressure01 >= 0.65) beats.push('PRESSURE');
  if (isClimax && pressure01 >= 0.75) beats.push('ESCALATION');
  if (archetype === 'REVELATION' || archetype === 'CONFRONTATION') beats.push('REVELATION');
  if (isClimax) beats.push('CONFRONTATION');
  if (pressure01 >= 0.7) beats.push('PIVOT');
  beats.push('RESOLUTION');
  if (pressure01 >= 0.8) beats.push('AFTERMATH');

  const trimmed = beats.slice(0, count) as ExperienceBeatType[];
  const totalWeight = trimmed.reduce((s, b) => s + beatTypeWeight(b), 0);
  const maxWeight = Math.max(...trimmed.map(beatTypeWeight));
  const climaxIndex = trimmed.findIndex((b) => b === 'CONFRONTATION' || b === 'REVELATION');

  return Object.freeze({
    sceneArchetype: archetype,
    beats: trimmed,
    totalWeight,
    maxWeight,
    climaxBeatIndex: climaxIndex >= 0 ? climaxIndex : null,
    hasSilenceBeat: trimmed.includes('SILENCE'),
    expectedDurationMs: trimmed.length * 2200 + (pressure01 * 3000),
  });
}

export function beatSequenceHasClimax(seq: ExperienceBeatSequence): boolean {
  return seq.climaxBeatIndex !== null;
}

export function beatSequenceIntensityRatio(seq: ExperienceBeatSequence): number {
  if (seq.beats.length === 0) return 0;
  return seq.totalWeight / (seq.beats.length * 1.0);
}

export function beatSequenceDescribe(seq: ExperienceBeatSequence): string {
  return `[${seq.sceneArchetype}] beats=${seq.beats.join('>')} weight=${seq.totalWeight.toFixed(2)}`;
}

// ============================================================================
// MARK: Experience lane moment tracking table
// ============================================================================

export interface ExperienceMomentSummaryRow {
  readonly momentId: string;
  readonly status: ExperienceMomentStatus;
  readonly intensity01: number;
  readonly importance01: number;
  readonly hasPendingReveals: boolean;
  readonly isInSilence: boolean;
  readonly hasEmissions: boolean;
  readonly sceneArchetype: string | null;
  readonly description: string;
}

export function buildMomentSummaryRow(record: ExperienceMomentRecord): ExperienceMomentSummaryRow {
  return Object.freeze({
    momentId: record.momentId,
    status: record.status,
    intensity01: record.intensity01,
    importance01: record.importance01,
    hasPendingReveals: momentHasPendingReveals(record),
    isInSilence: momentIsInSilence(record),
    hasEmissions: momentHasEmissions(record),
    sceneArchetype: record.sceneArchetype ?? null,
    description: describeMoment(record),
  });
}

export function buildMomentSummaryTable(
  records: readonly ExperienceMomentRecord[],
): readonly ExperienceMomentSummaryRow[] {
  return records.map(buildMomentSummaryRow);
}

export function momentTableActiveCount(table: readonly ExperienceMomentSummaryRow[]): number {
  return table.filter((r) => r.status === 'EMITTING' || r.status === 'PLANNED').length;
}

export function momentTablePendingRevealCount(table: readonly ExperienceMomentSummaryRow[]): number {
  return table.filter((r) => r.hasPendingReveals).length;
}

export function momentTableAverageIntensity(table: readonly ExperienceMomentSummaryRow[]): number {
  if (table.length === 0) return 0;
  return table.reduce((sum, r) => sum + r.intensity01, 0) / table.length;
}

// ============================================================================
// MARK: Experience lane health monitor
// ============================================================================

export type ExperienceLaneHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';

export interface ExperienceLaneHealth {
  readonly status: ExperienceLaneHealthStatus;
  readonly activeMomentOverflow: boolean;
  readonly pendingRevealOverflow: boolean;
  readonly silenceWindowOverflow: boolean;
  readonly pressureTierElevated: boolean;
  readonly combinedScore: number;
  readonly issues: readonly string[];
  readonly capturedAtMs: number;
}

export function buildExperienceLaneHealth(
  state: ChatExperienceRunState,
): ExperienceLaneHealth {
  const issues: string[] = [];
  const activeMomentOverflow = state.activeMomentCount > EXPERIENCE_LANE_CONSTANTS.MAX_ACTIVE_MOMENTS_PER_PLAYER;
  const pendingRevealOverflow = state.pendingRevealCount > EXPERIENCE_LANE_CONSTANTS.MAX_PENDING_REVEALS_PER_MOMENT * 4;
  const silenceWindowOverflow = state.activeSilenceWindowCount > EXPERIENCE_LANE_CONSTANTS.MAX_SILENCE_WINDOWS_PER_SCENE;
  const pressureTierElevated = pressureTierIsElevated(state.pressureTier);

  if (activeMomentOverflow) issues.push(`activeMoments=${state.activeMomentCount} exceeds max`);
  if (pendingRevealOverflow) issues.push(`pendingReveals=${state.pendingRevealCount} exceeds max`);
  if (silenceWindowOverflow) issues.push(`silenceWindows=${state.activeSilenceWindowCount} exceeds max`);
  if (!state.ledgerHealthy) issues.push('ledger unhealthy');
  if (pressureTierElevated) issues.push(`pressureTier=${state.pressureTier}`);

  let status: ExperienceLaneHealthStatus;
  if (issues.length === 0) {
    status = 'HEALTHY';
  } else if (issues.length <= 1 && !activeMomentOverflow) {
    status = 'DEGRADED';
  } else {
    status = 'CRITICAL';
  }

  return Object.freeze({
    status,
    activeMomentOverflow,
    pendingRevealOverflow,
    silenceWindowOverflow,
    pressureTierElevated,
    combinedScore: state.combinedScore,
    issues: Object.freeze(issues),
    capturedAtMs: state.capturedAtMs,
  });
}

export function experienceLaneIsHealthy(health: ExperienceLaneHealth): boolean {
  return health.status === 'HEALTHY';
}

export function experienceLaneIsCritical(health: ExperienceLaneHealth): boolean {
  return health.status === 'CRITICAL';
}

export function describeExperienceLaneHealth(health: ExperienceLaneHealth): string {
  return `[health:${health.status}] score=${health.combinedScore.toFixed(2)} issues=${health.issues.length}`;
}

// ============================================================================
// MARK: Experience lane scene-to-silence integration
// ============================================================================

export interface ExperienceSceneSilenceIntegration {
  readonly compatible: boolean;
  readonly silenceIsBlocking: boolean;
  readonly sceneExpectedBeats: number;
  readonly silenceHoldMs: number;
  readonly conflictReason: string | null;
  readonly recommendedHoldMs: number;
}

export function integrateSceneAndSilence(
  scene: ExperienceSceneDecision,
  silence: ExperienceSilenceDecision,
): ExperienceSceneSilenceIntegration {
  const compatible = sceneAndSilenceAreCompatible(scene, silence);
  const conflictReason = compatible
    ? null
    : silence.shouldSuppressCrowd
    ? 'SILENCE_SUPPRESSES_CROWD_WHILE_SCENE_IS_HOT'
    : 'SILENCE_HOLD_TOO_LONG_FOR_BEAT_COUNT';

  const recommendedHoldMs = compatible
    ? silence.holdMs
    : Math.min(silence.holdMs, EXPERIENCE_LANE_CONSTANTS.DEFAULT_HOLD_MS);

  return Object.freeze({
    compatible,
    silenceIsBlocking: silenceDecisionIsBlocking(silence),
    sceneExpectedBeats: scene.telemetry.expectedVisibleBeats,
    silenceHoldMs: silence.holdMs,
    conflictReason,
    recommendedHoldMs,
  });
}

export function resolveSceneSilenceConflict(
  integration: ExperienceSceneSilenceIntegration,
): 'PROCEED_WITH_SCENE' | 'HOLD_FOR_SILENCE' | 'PARTIAL_HOLD' {
  if (!integration.silenceIsBlocking) return 'PROCEED_WITH_SCENE';
  if (!integration.compatible) return 'PARTIAL_HOLD';
  return 'HOLD_FOR_SILENCE';
}

// ============================================================================
// MARK: Experience lane drama pressure projector
// ============================================================================

export interface ExperiencePressureProjection {
  readonly current01: number;
  readonly trend: 'RISING' | 'STABLE' | 'FALLING';
  readonly nextTier: ExperiencePressureTier;
  readonly nextTierThreshold01: number;
  readonly distanceToBreakpoint: number;
  readonly suggestedBeatType: ExperienceBeatType;
}

export function projectDramaPressure(
  current01: number,
  previous01: number,
): ExperiencePressureProjection {
  const delta = current01 - previous01;
  const trend: 'RISING' | 'STABLE' | 'FALLING' =
    delta > 0.05 ? 'RISING' : delta < -0.05 ? 'FALLING' : 'STABLE';

  const currentTier = pressureTierFrom01(current01);
  const nextTierMap: Record<ExperiencePressureTier, ExperiencePressureTier> = {
    CALM: 'WATCHFUL',
    WATCHFUL: 'PRESSURED',
    PRESSURED: 'CRITICAL',
    CRITICAL: 'BREAKPOINT',
    BREAKPOINT: 'BREAKPOINT',
  };
  const nextTier = nextTierMap[currentTier];
  const nextTierThreshold01 = pressureTierTo01(nextTier);

  const suggestedBeat: ExperienceBeatType =
    current01 >= 0.9 ? 'CONFRONTATION'
    : current01 >= 0.75 ? 'ESCALATION'
    : current01 >= 0.6 ? 'PRESSURE'
    : current01 >= 0.4 ? 'PROBE'
    : 'OPENING';

  return Object.freeze({
    current01,
    trend,
    nextTier,
    nextTierThreshold01,
    distanceToBreakpoint: Math.max(0, 0.92 - current01),
    suggestedBeatType: suggestedBeat,
  });
}

export function pressureProjectionIsEscalating(proj: ExperiencePressureProjection): boolean {
  return proj.trend === 'RISING' && proj.current01 >= 0.5;
}

export function pressureProjectionIsNearBreakpoint(proj: ExperiencePressureProjection): boolean {
  return proj.distanceToBreakpoint < 0.1;
}

// ============================================================================
// MARK: Experience lane extended diagnostics
// ============================================================================

export interface ChatExperienceLaneExtendedDiagnostics extends ChatExperienceLaneDiagnostics {
  readonly activeMomentCount: number;
  readonly pendingRevealCount: number;
  readonly escalationTier: ExperienceEscalationTier;
  readonly pressureTierStr: ExperiencePressureTier;
  readonly coverageReport: ChatExperienceCoverageReport;
  readonly doctrineSummary: string;
}

export function buildExtendedDiagnostics(
  base: ChatExperienceLaneDiagnostics,
  ledgerStats: ExperienceLedgerStats,
  pressure01: number,
): ChatExperienceLaneExtendedDiagnostics {
  return Object.freeze({
    ...base,
    activeMomentCount: ledgerStats.registeredMoments - ledgerStats.resolvedMoments - ledgerStats.cancelledMoments - ledgerStats.timedOutMoments,
    pendingRevealCount: ledgerStats.activeRevealReservations,
    escalationTier: escalationTierFrom01(pressure01),
    pressureTierStr: pressureTierFrom01(pressure01),
    coverageReport: buildExperienceCoverageReport(),
    doctrineSummary: `${CHAT_EXPERIENCE_DOCTRINE.rules.length} rules | weights DRAMA=${CHAT_EXPERIENCE_DOCTRINE.categoryWeights.DRAMA} SCENE=${CHAT_EXPERIENCE_DOCTRINE.categoryWeights.SCENE}`,
  });
}

// ============================================================================
// MARK: Experience lane multi-scene telemetry aggregator
// ============================================================================

export interface ExperienceMultiSceneSummary {
  readonly sceneCount: number;
  readonly averagePressure01: number;
  readonly peakPressure01: number;
  readonly witnessEscalationRequired: boolean;
  readonly crowdWaveRequired: boolean;
  readonly legendBeatRequired: boolean;
  readonly archetypes: readonly string[];
  readonly totalExpectedBeats: number;
  readonly totalExpectedDurationMs: number;
}

export function summarizeMultipleScenes(
  telemetryList: readonly ExperienceSceneTelemetry[],
): ExperienceMultiSceneSummary {
  if (telemetryList.length === 0) {
    return Object.freeze({
      sceneCount: 0,
      averagePressure01: 0,
      peakPressure01: 0,
      witnessEscalationRequired: false,
      crowdWaveRequired: false,
      legendBeatRequired: false,
      archetypes: [],
      totalExpectedBeats: 0,
      totalExpectedDurationMs: 0,
    });
  }

  const pressures = telemetryList.map((t) => t.pressure01);
  const avg = pressures.reduce((a, b) => a + b, 0) / pressures.length;
  const peak = Math.max(...pressures);

  return Object.freeze({
    sceneCount: telemetryList.length,
    averagePressure01: avg,
    peakPressure01: peak,
    witnessEscalationRequired: anySceneRequiresWitnessEscalation(telemetryList),
    crowdWaveRequired: telemetryList.some(
      (t) => t.crowdHeat01 >= EXPERIENCE_LANE_CONSTANTS.CROWD_SWARM_THRESHOLD_01,
    ),
    legendBeatRequired: telemetryList.some(
      (t) => t.legendHeat01 >= EXPERIENCE_LANE_CONSTANTS.LEGEND_BREATH_THRESHOLD_01,
    ),
    archetypes: [...new Set(telemetryList.map((t) => t.archetype))],
    totalExpectedBeats: telemetryList.reduce((sum, t) => sum + t.expectedVisibleBeats, 0),
    totalExpectedDurationMs: telemetryList.reduce((sum, t) => sum + t.expectedDurationMs, 0),
  });
}

// ============================================================================
// MARK: Experience lane materialization batch analysis
// ============================================================================

export interface ExperienceMaterializationBatchResult {
  readonly total: number;
  readonly highStakesCount: number;
  readonly averagePressure01: number;
  readonly totalBeatDescriptors: number;
  readonly haterAuthorizedCount: number;
  readonly helperAuthorizedCount: number;
  readonly summaries: readonly string[];
}

export function analyzeMaterializationBatch(
  materializations: readonly ExperienceMaterialization[],
): ExperienceMaterializationBatchResult {
  if (materializations.length === 0) {
    return Object.freeze({
      total: 0,
      highStakesCount: 0,
      averagePressure01: 0,
      totalBeatDescriptors: 0,
      haterAuthorizedCount: 0,
      helperAuthorizedCount: 0,
      summaries: [],
    });
  }

  const highStakes = materializations.filter(materializationIsHighStakes);
  const avgPressure =
    materializations.reduce((s, m) => s + m.diagnostics.telemetry.pressure01, 0) /
    materializations.length;

  return Object.freeze({
    total: materializations.length,
    highStakesCount: highStakes.length,
    averagePressure01: avgPressure,
    totalBeatDescriptors: materializations.reduce((s, m) => s + m.beatDescriptors.length, 0),
    haterAuthorizedCount: materializations.filter((m) => m.diagnostics.authorityAccepted.hater)
      .length,
    helperAuthorizedCount: materializations.filter((m) => m.diagnostics.authorityAccepted.helper)
      .length,
    summaries: materializations.map(describeMaterializationAuthority),
  });
}

// ============================================================================
// MARK: Experience lane telemetry digest chain
// ============================================================================

/**
 * Builds a running digest chain from sequential scene telemetry objects.
 * Useful for tracking cumulative pressure over a run.
 */
export function buildTelemetryDigestChain(
  telemetryList: readonly ExperienceSceneTelemetry[],
): readonly ExperienceDramaTelemetryDigest[] {
  return telemetryList.map((t) =>
    Object.freeze({
      pressure01: t.pressure01,
      relationshipPressure01: t.relationshipPressure01 ?? 0,
      rescueNeed01: t.rescueNeed01 ?? 0,
      callbackOpportunity01: t.callbackOpportunity01 ?? 0,
      crowdHeat01: t.crowdHeat01,
      silencePreference01: t.silencePreference01 ?? 0,
      expectedDurationMs: t.expectedDurationMs,
      expectedVisibleBeats: t.expectedVisibleBeats,
      expectedShadowBeats: t.expectedShadowBeats ?? 0,
      stageMood: t.stageMood ?? 'NEUTRAL',
      archetype: t.archetype,
      reasons: t.reasons ?? [],
      witnessPressure01: t.witnessNeed01,
    }),
  );
}

/**
 * Derives a single merged digest from a sequence of scene telemetries.
 */
export function mergeSceneTelemetryToDigest(
  telemetryList: readonly ExperienceSceneTelemetry[],
): ExperienceDramaTelemetryDigest {
  return mergeDramaTelemetryDigests(buildTelemetryDigestChain(telemetryList));
}

// ============================================================================
// MARK: Experience lane final authority check
// ============================================================================

/**
 * Top-level authority gate: given a pressure reading, should the experience lane
 * gate output for this channel right now?
 */
export function experienceLaneShouldGateOutput(
  pressure01: number,
  activeSilenceWindowCount: number,
  pendingRevealCount: number,
): boolean {
  if (activeSilenceWindowCount > 0) return true;
  if (pressure01 >= 0.92) return true;
  if (pendingRevealCount > 0 && pressure01 >= 0.75) return true;
  return false;
}

/**
 * Returns whether the experience lane should escalate swarm behavior.
 */
export function experienceLaneShouldEscalateSwarm(
  pressure01: number,
  crowdHeat01: number,
): boolean {
  return (
    pressure01 >= EXPERIENCE_LANE_CONSTANTS.WITNESS_ESCALATION_THRESHOLD_01 &&
    crowdHeat01 >= EXPERIENCE_LANE_CONSTANTS.CROWD_SWARM_THRESHOLD_01
  );
}

/**
 * Returns whether the experience lane should trigger legend insertion.
 */
export function experienceLaneShouldTriggerLegend(
  pressure01: number,
  legendHeat01: number,
): boolean {
  return (
    pressure01 >= EXPERIENCE_LANE_CONSTANTS.LEGEND_BREATH_THRESHOLD_01 ||
    legendHeat01 >= EXPERIENCE_LANE_CONSTANTS.LEGEND_BREATH_THRESHOLD_01
  );
}

/**
 * Returns a single combined readiness signal for the experience lane.
 * TRUE = the lane is ready to author output. FALSE = hold.
 */
export function experienceLaneIsReadyToAuthor(
  health: ExperienceLaneHealth,
  activeSilenceWindowCount: number,
): boolean {
  return (
    health.status !== 'CRITICAL' &&
    activeSilenceWindowCount === 0
  );
}

// ============================================================================
// MARK: Experience lane version + exports table
// ============================================================================

export const EXPERIENCE_LANE_VERSION = CHAT_EXPERIENCE_BARREL_VERSION;

export const EXPERIENCE_LANE_EXPORTS = Object.freeze({
  // Module object
  ChatExperienceModule: 'frozen authority object with all subsystem namespaces',
  // Namespaces
  DramaOrchestrator: 'namespace: ChatDramaOrchestrator subsystem',
  ScenePlanner: 'namespace: ChatScenePlanner subsystem',
  MomentLedger: 'namespace: ChatMomentLedger subsystem',
  SilencePolicy: 'namespace: ChatSilencePolicy subsystem',
  // Class references
  ChatDramaOrchestratorClass: 'class reference for drama orchestrator',
  ChatScenePlannerClass: 'class reference for scene planner',
  ChatMomentLedgerClass: 'class reference for moment ledger',
  ChatSilencePolicyClass: 'class reference for silence policy',
  // Factory functions
  createChatDramaOrchestrator: 'factory: create ChatDramaOrchestrator',
  createChatScenePlanner: 'factory: create ChatScenePlanner',
  createChatMomentLedger: 'factory: create ChatMomentLedger',
  createChatSilencePolicy: 'factory: create ChatSilencePolicy',
  // Config defaults
  DEFAULT_SCENE_PLANNER_CONFIG: 'default config for ChatScenePlanner',
  DEFAULT_MOMENT_LEDGER_CONFIG: 'default config for ChatMomentLedger',
  DEFAULT_SILENCE_POLICY_CONFIG: 'default config for ChatSilencePolicy',
  // Registries
  EXPERIENCE_BEAT_TYPES: 'all beat type identifiers',
  EXPERIENCE_BEAT_TYPE_WEIGHT: 'weight map for beat types',
  EXPERIENCE_SILENCE_PURPOSES: 'all silence purpose identifiers',
  EXPERIENCE_SCENE_ARCHETYPES: 'all scene archetype identifiers',
  EXPERIENCE_PRESSURE_TIERS: 'all pressure tier identifiers',
  EXPERIENCE_ESCALATION_TIERS: 'all escalation tier identifiers',
  EXPERIENCE_LANE_CONSTANTS: 'numeric constants for the experience lane',
  // Utility functions
  beatTypeWeight: 'returns weight for a beat type',
  beatTypeIsActiveDrama: 'true if beat type weight >= 0.8',
  pressureTierFrom01: 'converts pressure01 to ExperiencePressureTier',
  pressureTierTo01: 'converts ExperiencePressureTier to pressure01',
  escalationTierFrom01: 'converts escalation01 to ExperienceEscalationTier',
  scenePlanHasBranchRisk: 'true if scene has branch pressure tags at pressure > 0.5',
  momentIsActive: 'true if moment status is ACTIVE or PLANNING',
  momentHasPendingReveals: 'true if pendingRevealReservationIds.length > 0',
  silenceWindowIsOpen: 'true if window is open at nowMs',
  interruptIsPermitted: 'true if interrupt disposition is ALLOW or DEFER',
  experienceLaneShouldGateOutput: 'top-level gating authority',
  experienceLaneShouldEscalateSwarm: 'swarm escalation authority',
  experienceLaneShouldTriggerLegend: 'legend insertion authority',
} as const);
