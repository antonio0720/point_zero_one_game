/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT DEALROOM BARREL
 * FILE: backend/src/game/engine/chat/dealroom/index.ts
 * VERSION: 2026.03.23-dealroom-barrel.v1
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative export surface for the chat dealroom lane.
 * The dealroom lane governs negotiation lifecycle, offer analysis, bluff
 * resolution, and reputation impact from deal outcomes.
 *
 * Subsystems
 * ----------
 * 1. BluffResolver              — resolves bluff confidence, family, dominant
 *                                 evidence, and exploit windows from transcript
 *                                 and offer behavior.
 * 2. NegotiationEngine          — orchestrates full negotiation lifecycle:
 *                                 open, ingest, post offer, counter, resolve.
 * 3. NegotiationReputationPolicy — converts negotiation moves and outcomes
 *                                  into backend reputation deltas and policy
 *                                  actions for other systems.
 * 4. OfferCounterEngine         — backend offer-counter authority: fairness,
 *                                  aggression, urgency, desperation, trust,
 *                                  leak risk, and counter recommendation.
 *
 * Design doctrine
 * ---------------
 * - No UI ownership. No socket ownership. Backend authority only.
 * - All four subsystems are independently importable and composable.
 * - ChatDealroomModule provides the single frozen authority object consumed
 *   by the chat root barrel.
 * ============================================================================
 */

// ============================================================================
// MARK: Namespace imports — all four subsystems
// ============================================================================

import * as BluffResolver from './BluffResolver';
import * as NegotiationEngine from './NegotiationEngine';
import * as NegotiationReputationPolicy from './NegotiationReputationPolicy';
import * as OfferCounterEngine from './OfferCounterEngine';

// ============================================================================
// MARK: Flat re-exports — all four subsystems (no name conflicts)
// ============================================================================

export * from './BluffResolver';
export * from './NegotiationEngine';
export * from './NegotiationReputationPolicy';
export * from './OfferCounterEngine';

// ============================================================================
// MARK: Namespace re-exports
// ============================================================================

export { BluffResolver, NegotiationEngine, NegotiationReputationPolicy, OfferCounterEngine };

// ============================================================================
// MARK: Convenience class surface
// ============================================================================

/** Resolves bluff confidence, family, exploit windows from deal-room signals. */
export const BluffResolverClass = BluffResolver.BluffResolver;

/** Orchestrates full negotiation lifecycle: open, post, counter, resolve. */
export const NegotiationEngineClass = NegotiationEngine.NegotiationEngine;

/** Converts negotiation outcomes into reputation deltas and policy actions. */
export const NegotiationReputationPolicyClass = NegotiationReputationPolicy.NegotiationReputationPolicy;

/** Backend offer-counter authority: analysis, scoring, counter recommendation. */
export const OfferCounterEngineClass = OfferCounterEngine.OfferCounterEngine;

// ============================================================================
// MARK: Convenience factory surface
// ============================================================================

export const createBluffResolver = BluffResolver.createBluffResolver;
export const createNegotiationEngine = NegotiationEngine.createNegotiationEngine;
export const createNegotiationReputationPolicy = NegotiationReputationPolicy.createNegotiationReputationPolicy;
export const createOfferCounterEngine = OfferCounterEngine.createOfferCounterEngine;

// ============================================================================
// MARK: Sub-module authority bundles
// ============================================================================

export const BluffResolverModule = BluffResolver.ChatBluffResolverModule;
export const NegotiationEngineModule = NegotiationEngine.ChatNegotiationEngineModule;
export const NegotiationReputationPolicyModule = NegotiationReputationPolicy.ChatNegotiationReputationPolicyModule;

// ============================================================================
// MARK: Dealroom barrel version
// ============================================================================

export const CHAT_DEALROOM_BARREL_VERSION = '2026.03.23-dealroom-barrel.v1' as const;
export const CHAT_DEALROOM_AUTHORITY = 'BACKEND' as const;

export interface ChatDealroomBarrelMeta {
  readonly version: typeof CHAT_DEALROOM_BARREL_VERSION;
  readonly authority: typeof CHAT_DEALROOM_AUTHORITY;
  readonly subsystems: readonly [
    'BluffResolver',
    'NegotiationEngine',
    'NegotiationReputationPolicy',
    'OfferCounterEngine',
  ];
}

export const CHAT_DEALROOM_BARREL_META: ChatDealroomBarrelMeta = Object.freeze({
  version: CHAT_DEALROOM_BARREL_VERSION,
  authority: CHAT_DEALROOM_AUTHORITY,
  subsystems: [
    'BluffResolver',
    'NegotiationEngine',
    'NegotiationReputationPolicy',
    'OfferCounterEngine',
  ] as const,
});

// ============================================================================
// MARK: Dealroom lane type aliases — BluffResolver
// ============================================================================

export type DealroomBluffFamily = BluffResolver.BluffFamily;
export type DealroomBluffSignalCode = BluffResolver.BluffSignalCode;
export type DealroomBluffResolverRequest = BluffResolver.BluffResolverRequest;
export type DealroomBluffSignal = BluffResolver.BluffSignal;
export type DealroomBluffExploitWindow = BluffResolver.BluffExploitWindow;
export type DealroomBluffActorRead = BluffResolver.BluffActorRead;
export type DealroomBluffVisibilityRead = BluffResolver.BluffVisibilityRead;
export type DealroomBluffConcessionRead = BluffResolver.BluffConcessionRead;
export type DealroomBluffIntentRead = BluffResolver.BluffIntentRead;
export type DealroomBluffAnalysis = BluffResolver.BluffAnalysis;
export type DealroomBluffResolverLedger = BluffResolver.BluffResolverLedger;
export type DealroomBluffResolverOptions = BluffResolver.BluffResolverOptions;

// ============================================================================
// MARK: Dealroom lane type aliases — NegotiationEngine
// ============================================================================

export type DealroomNegotiationOpenRequest = NegotiationEngine.NegotiationOpenRequest;
export type DealroomNegotiationIngestRequest = NegotiationEngine.NegotiationIngestMessageRequest;
export type DealroomNegotiationPostOfferRequest = NegotiationEngine.NegotiationPostOfferRequest;
export type DealroomNegotiationCounterRequest = NegotiationEngine.NegotiationCounterRequest;
export type DealroomNegotiationAcceptRequest = NegotiationEngine.NegotiationAcceptRequest;
export type DealroomNegotiationRejectRequest = NegotiationEngine.NegotiationRejectRequest;
export type DealroomNegotiationExpireRequest = NegotiationEngine.NegotiationExpireRequest;
export type DealroomNegotiationResolveRequest = NegotiationEngine.NegotiationResolveRequest;
export type DealroomNegotiationRoomLedger = NegotiationEngine.NegotiationEngineRoomLedger;
export type DealroomNegotiationCounterResult = NegotiationEngine.NegotiationCounterResult;
export type DealroomNegotiationEngineOptions = NegotiationEngine.NegotiationEngineOptions;

// ============================================================================
// MARK: Dealroom lane type aliases — NegotiationReputationPolicy
// ============================================================================

export type DealroomReputationSurface = NegotiationReputationPolicy.ReputationSurface;
export type DealroomReputationEventKind = NegotiationReputationPolicy.ReputationEventKind;
export type DealroomReputationDelta = NegotiationReputationPolicy.ReputationDelta;
export type DealroomReputationPolicyAction = NegotiationReputationPolicy.ReputationPolicyAction;
export type DealroomNegotiationReputationRequest = NegotiationReputationPolicy.NegotiationReputationRequest;
export type DealroomNegotiationReputationEvidenceSummary = NegotiationReputationPolicy.NegotiationReputationEvidenceSummary;
export type DealroomNegotiationReputationScorecard = NegotiationReputationPolicy.NegotiationReputationScorecard;
export type DealroomNegotiationReputationOfferContext = NegotiationReputationPolicy.NegotiationReputationOfferContext;
export type DealroomNegotiationReputationProjection = NegotiationReputationPolicy.NegotiationReputationProjection;
export type DealroomNegotiationReputationLedger = NegotiationReputationPolicy.NegotiationReputationLedger;
export type DealroomReputationPolicyOptions = NegotiationReputationPolicy.NegotiationReputationPolicyOptions;

// ============================================================================
// MARK: Dealroom lane type aliases — OfferCounterEngine
// ============================================================================

export type DealroomOfferCounterEvaluationRequest = OfferCounterEngine.OfferCounterEvaluationRequest;
export type DealroomOfferCounterBuildRequest = OfferCounterEngine.OfferCounterBuildRequest;
export type DealroomOfferCounterProbabilityVector = OfferCounterEngine.OfferCounterProbabilityVector;
export type DealroomOfferCounterScoreCard = OfferCounterEngine.OfferCounterScoreCard;
export type DealroomOfferCounterActorLens = OfferCounterEngine.OfferCounterActorLens;
export type DealroomOfferCounterInferenceSummary = OfferCounterEngine.OfferCounterInferenceSummary;
export type DealroomOfferCounterLeakProfile = OfferCounterEngine.OfferCounterLeakProfile;
export type DealroomOfferCounterResolutionProfile = OfferCounterEngine.OfferCounterResolutionProfile;
export type DealroomOfferCounterWindowDiagnostics = OfferCounterEngine.OfferCounterWindowDiagnostics;
export type DealroomOfferCounterEngineEvaluation = OfferCounterEngine.OfferCounterEngineEvaluation;
export type DealroomOfferCounterReason = OfferCounterEngine.OfferCounterReason;
export type DealroomOfferCounterReasonCode = OfferCounterEngine.OfferCounterReasonCode;
export type DealroomCounterStrategy = OfferCounterEngine.CounterStrategy;
export type DealroomOfferCounterBuildResult = OfferCounterEngine.OfferCounterBuildResult;
export type DealroomOfferCounterRoomLedger = OfferCounterEngine.OfferCounterRoomLedger;
export type DealroomOfferCounterEngineOptions = OfferCounterEngine.OfferCounterEngineOptions;

// ============================================================================
// MARK: Dealroom lane readiness
// ============================================================================

export interface ChatDealroomLaneReadiness {
  readonly bluffResolver: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly negotiationEngine: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly negotiationReputationPolicy: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly offerCounterEngine: 'GENERATED' | 'PENDING' | 'PLANNED';
}

export const CHAT_DEALROOM_LANE_READINESS: ChatDealroomLaneReadiness = Object.freeze({
  bluffResolver: 'GENERATED',
  negotiationEngine: 'GENERATED',
  negotiationReputationPolicy: 'GENERATED',
  offerCounterEngine: 'GENERATED',
});

// ============================================================================
// MARK: Dealroom lane module descriptor table
// ============================================================================

export interface ChatDealroomModuleDescriptor {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly category: 'BLUFF' | 'NEGOTIATION' | 'REPUTATION' | 'OFFER';
  readonly readiness: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly ownsTruth: boolean;
  readonly description: string;
  readonly primaryClass: string;
  readonly factoryFn: string;
}

export const CHAT_DEALROOM_MODULE_DESCRIPTORS: readonly ChatDealroomModuleDescriptor[] =
  Object.freeze([
    {
      id: 'bluff-resolver',
      name: 'BluffResolver',
      file: 'dealroom/BluffResolver.ts',
      category: 'BLUFF',
      readiness: 'GENERATED',
      ownsTruth: true,
      description: 'Resolves bluff confidence, family, dominant evidence, and exploit windows from transcript and offer behavior.',
      primaryClass: 'BluffResolver',
      factoryFn: 'createBluffResolver',
    },
    {
      id: 'negotiation-engine',
      name: 'NegotiationEngine',
      file: 'dealroom/NegotiationEngine.ts',
      category: 'NEGOTIATION',
      readiness: 'GENERATED',
      ownsTruth: true,
      description: 'Orchestrates full negotiation lifecycle: open, ingest, post offer, counter, resolve.',
      primaryClass: 'NegotiationEngine',
      factoryFn: 'createNegotiationEngine',
    },
    {
      id: 'negotiation-reputation-policy',
      name: 'NegotiationReputationPolicy',
      file: 'dealroom/NegotiationReputationPolicy.ts',
      category: 'REPUTATION',
      readiness: 'GENERATED',
      ownsTruth: true,
      description: 'Converts negotiation moves and outcomes into backend reputation deltas and policy actions.',
      primaryClass: 'NegotiationReputationPolicy',
      factoryFn: 'createNegotiationReputationPolicy',
    },
    {
      id: 'offer-counter-engine',
      name: 'OfferCounterEngine',
      file: 'dealroom/OfferCounterEngine.ts',
      category: 'OFFER',
      readiness: 'GENERATED',
      ownsTruth: true,
      description: 'Backend offer-counter authority: fairness, aggression, urgency, desperation, trust, leak risk, counter recommendation.',
      primaryClass: 'OfferCounterEngine',
      factoryFn: 'createOfferCounterEngine',
    },
  ]);

export function dealroomModuleDescriptorById(id: string): ChatDealroomModuleDescriptor | undefined {
  return CHAT_DEALROOM_MODULE_DESCRIPTORS.find((m) => m.id === id);
}

export function dealroomModuleDescriptorsByCategory(
  category: ChatDealroomModuleDescriptor['category'],
): readonly ChatDealroomModuleDescriptor[] {
  return CHAT_DEALROOM_MODULE_DESCRIPTORS.filter((m) => m.category === category);
}

// ============================================================================
// MARK: Dealroom bluff confidence tier registry
// ============================================================================

export const DEALROOM_BLUFF_CONFIDENCE_TIERS = Object.freeze([
  'UNDETECTED',   // No bluff signal detected
  'SUSPECTED',    // Weak signals, inconclusive
  'PROBABLE',     // Multiple signals pointing to bluff
  'CONFIRMED',    // High confidence bluff read
  'CERTAIN',      // Near-certain bluff — player should act
] as const);

export type DealroomBluffConfidenceTier = (typeof DEALROOM_BLUFF_CONFIDENCE_TIERS)[number];

export function dealroomBluffConfidenceTierFrom01(confidence01: number): DealroomBluffConfidenceTier {
  if (confidence01 >= 0.90) return 'CERTAIN';
  if (confidence01 >= 0.72) return 'CONFIRMED';
  if (confidence01 >= 0.50) return 'PROBABLE';
  if (confidence01 >= 0.25) return 'SUSPECTED';
  return 'UNDETECTED';
}

export function dealroomBluffConfidenceTierIsActionable(tier: DealroomBluffConfidenceTier): boolean {
  return tier === 'CONFIRMED' || tier === 'CERTAIN';
}

export function dealroomBluffConfidenceTierWeight(tier: DealroomBluffConfidenceTier): number {
  switch (tier) {
    case 'CERTAIN': return 1.0;
    case 'CONFIRMED': return 0.82;
    case 'PROBABLE': return 0.60;
    case 'SUSPECTED': return 0.35;
    case 'UNDETECTED': return 0.05;
    default: return 0.05;
  }
}

// ============================================================================
// MARK: Dealroom negotiation stage registry
// ============================================================================

export const DEALROOM_NEGOTIATION_STAGES = Object.freeze([
  'OPENING',
  'OFFER_POSTED',
  'COUNTER_PENDING',
  'COUNTER_ACTIVE',
  'LEAK_DETECTED',
  'HELPER_INTERCEPT',
  'RESCUE_PENDING',
  'AUDIENCE_WATCHING',
  'NEAR_CLOSE',
  'CLOSED_ACCEPTED',
  'CLOSED_REJECTED',
  'EXPIRED',
  'ABANDONED',
] as const);

export type DealroomNegotiationStage = (typeof DEALROOM_NEGOTIATION_STAGES)[number];

export function dealroomNegotiationStageIsActive(stage: DealroomNegotiationStage): boolean {
  return (
    stage === 'OFFER_POSTED' ||
    stage === 'COUNTER_PENDING' ||
    stage === 'COUNTER_ACTIVE' ||
    stage === 'NEAR_CLOSE'
  );
}

export function dealroomNegotiationStageIsTerminal(stage: DealroomNegotiationStage): boolean {
  return (
    stage === 'CLOSED_ACCEPTED' ||
    stage === 'CLOSED_REJECTED' ||
    stage === 'EXPIRED' ||
    stage === 'ABANDONED'
  );
}

export function dealroomNegotiationStageIsRisky(stage: DealroomNegotiationStage): boolean {
  return (
    stage === 'LEAK_DETECTED' ||
    stage === 'RESCUE_PENDING' ||
    stage === 'AUDIENCE_WATCHING'
  );
}

// ============================================================================
// MARK: Dealroom offer outcome tier registry
// ============================================================================

export const DEALROOM_OFFER_OUTCOME_TIERS = Object.freeze([
  'SWEEP',        // Player wins far more than expected
  'WIN',          // Player achieves primary goal
  'FAIR',         // Balanced outcome
  'PARTIAL',      // Some concessions but not full goal
  'LOSS',         // Boss wins primary terms
  'CAPITULATION', // Player accepts unfavorable deal under pressure
  'NO_DEAL',      // Negotiation ends without agreement
] as const);

export type DealroomOfferOutcomeTier = (typeof DEALROOM_OFFER_OUTCOME_TIERS)[number];

export function dealroomOfferOutcomeTierIsPositive(tier: DealroomOfferOutcomeTier): boolean {
  return tier === 'SWEEP' || tier === 'WIN' || tier === 'FAIR';
}

export function dealroomOfferOutcomeTierScore(tier: DealroomOfferOutcomeTier): number {
  switch (tier) {
    case 'SWEEP': return 1.0;
    case 'WIN': return 0.82;
    case 'FAIR': return 0.60;
    case 'PARTIAL': return 0.40;
    case 'LOSS': return 0.20;
    case 'CAPITULATION': return 0.10;
    case 'NO_DEAL': return 0.30;
    default: return 0.3;
  }
}

export function dealroomOfferOutcomeTierDamagesReputation(tier: DealroomOfferOutcomeTier): boolean {
  return tier === 'CAPITULATION' || tier === 'LOSS';
}

export function dealroomOfferOutcomeTierGrantsReputationBoost(tier: DealroomOfferOutcomeTier): boolean {
  return tier === 'SWEEP';
}

// ============================================================================
// MARK: Dealroom pressure tier registry
// ============================================================================

export const DEALROOM_PRESSURE_TIERS = Object.freeze([
  'COLD',         // No pressure, exploratory
  'WARM',         // Some tension, active interest
  'PRESSURED',    // Clear urgency or desperation signal
  'HOSTILE',      // Aggressive posturing / threat
  'CRITICAL',     // Near collapse or hostile takeover
] as const);

export type DealroomPressureTier = (typeof DEALROOM_PRESSURE_TIERS)[number];

export function dealroomPressureTierFrom01(pressure01: number): DealroomPressureTier {
  if (pressure01 >= 0.88) return 'CRITICAL';
  if (pressure01 >= 0.70) return 'HOSTILE';
  if (pressure01 >= 0.50) return 'PRESSURED';
  if (pressure01 >= 0.25) return 'WARM';
  return 'COLD';
}

export function dealroomPressureTierIsElevated(tier: DealroomPressureTier): boolean {
  return tier === 'HOSTILE' || tier === 'CRITICAL';
}

export function dealroomPressureTierWeight(tier: DealroomPressureTier): number {
  switch (tier) {
    case 'CRITICAL': return 1.0;
    case 'HOSTILE': return 0.82;
    case 'PRESSURED': return 0.60;
    case 'WARM': return 0.35;
    case 'COLD': return 0.10;
    default: return 0.1;
  }
}

// ============================================================================
// MARK: Dealroom run state
// ============================================================================

export interface DealroomRunState {
  readonly dealId: string;
  readonly stage: DealroomNegotiationStage;
  readonly pressureTier: DealroomPressureTier;
  readonly bluffConfidenceTier: DealroomBluffConfidenceTier;
  readonly roundCount: number;
  readonly leakDetected: boolean;
  readonly rescueActive: boolean;
  readonly helperActive: boolean;
  readonly audienceWatching: boolean;
  readonly witnessDensity01: number;
  readonly playerAdvantage01: number;
  readonly capturedAtMs: number;
}

export function buildDealroomRunStateShell(dealId: string, nowMs: number): DealroomRunState {
  return Object.freeze({
    dealId,
    stage: 'OPENING',
    pressureTier: 'COLD',
    bluffConfidenceTier: 'UNDETECTED',
    roundCount: 0,
    leakDetected: false,
    rescueActive: false,
    helperActive: false,
    audienceWatching: false,
    witnessDensity01: 0,
    playerAdvantage01: 0.5,
    capturedAtMs: nowMs,
  });
}

export function dealroomRunStateIsActive(state: DealroomRunState): boolean {
  return dealroomNegotiationStageIsActive(state.stage);
}

export function dealroomRunStateIsTerminal(state: DealroomRunState): boolean {
  return dealroomNegotiationStageIsTerminal(state.stage);
}

export function dealroomRunStatePlayerIsWinning(state: DealroomRunState): boolean {
  return state.playerAdvantage01 > 0.5;
}

export function describeDealroomRunState(state: DealroomRunState): string {
  return (
    `[deal:${state.dealId}] stage=${state.stage} pressure=${state.pressureTier} ` +
    `bluff=${state.bluffConfidenceTier} rounds=${state.roundCount} ` +
    `player=${state.playerAdvantage01.toFixed(2)}`
  );
}

// ============================================================================
// MARK: Dealroom bluff exploitation helpers
// ============================================================================

export interface DealroomBluffExploitDecision {
  readonly shouldExploit: boolean;
  readonly confidenceTier: DealroomBluffConfidenceTier;
  readonly recommendedCounterStrategy: DealroomCounterStrategy | null;
  readonly exploitWindowOpenMs: number;
  readonly exploitRisk01: number;
}

export function buildDealroomBluffExploitDecision(
  confidence01: number,
  pressureTier: DealroomPressureTier,
): DealroomBluffExploitDecision {
  const tier = dealroomBluffConfidenceTierFrom01(confidence01);
  const shouldExploit = dealroomBluffConfidenceTierIsActionable(tier);

  const exploitWindowOpenMs = shouldExploit
    ? 4000 + Math.round((1 - confidence01) * 3000)
    : 0;

  const exploitRisk01 = dealroomPressureTierIsElevated(pressureTier)
    ? Math.min(1, confidence01 * 0.6 + dealroomPressureTierWeight(pressureTier) * 0.4)
    : confidence01 * 0.3;

  const recommendedCounterStrategy: DealroomCounterStrategy | null = shouldExploit
    ? 'EXPOSE_BLUFF'
    : null;

  return Object.freeze({
    shouldExploit,
    confidenceTier: tier,
    recommendedCounterStrategy,
    exploitWindowOpenMs,
    exploitRisk01,
  });
}

export function dealroomBluffExploitDecisionIsHighRisk(decision: DealroomBluffExploitDecision): boolean {
  return decision.exploitRisk01 >= 0.7;
}

// ============================================================================
// MARK: Dealroom offer analysis helpers
// ============================================================================

export interface DealroomOfferAnalysisSummary {
  readonly offerCount: number;
  readonly averageFairness01: number;
  readonly peakAggression01: number;
  readonly leakRiskCount: number;
  readonly rescueDemandCount: number;
  readonly desperationSignalCount: number;
  readonly recommendedOutcomeTier: DealroomOfferOutcomeTier;
}

export function buildDealroomOfferAnalysisSummaryShell(): DealroomOfferAnalysisSummary {
  return Object.freeze({
    offerCount: 0,
    averageFairness01: 0.5,
    peakAggression01: 0,
    leakRiskCount: 0,
    rescueDemandCount: 0,
    desperationSignalCount: 0,
    recommendedOutcomeTier: 'FAIR',
  });
}

export function describeDealroomOfferAnalysis(summary: DealroomOfferAnalysisSummary): string {
  return (
    `[offers] count=${summary.offerCount} fairness=${summary.averageFairness01.toFixed(2)} ` +
    `aggression=${summary.peakAggression01.toFixed(2)} leaks=${summary.leakRiskCount} ` +
    `outcome=${summary.recommendedOutcomeTier}`
  );
}

// ============================================================================
// MARK: Dealroom health monitor
// ============================================================================

export type DealroomLaneHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';

export interface DealroomLaneHealth {
  readonly status: DealroomLaneHealthStatus;
  readonly stageIsActive: boolean;
  readonly pressureElevated: boolean;
  readonly bluffDetected: boolean;
  readonly rescueActive: boolean;
  readonly leakDetected: boolean;
  readonly issues: readonly string[];
  readonly capturedAtMs: number;
}

export function buildDealroomLaneHealth(state: DealroomRunState): DealroomLaneHealth {
  const issues: string[] = [];
  const pressureElevated = dealroomPressureTierIsElevated(state.pressureTier);
  const bluffDetected = dealroomBluffConfidenceTierIsActionable(state.bluffConfidenceTier);

  if (pressureElevated) issues.push(`pressureTier=${state.pressureTier}`);
  if (state.leakDetected) issues.push('LEAK_DETECTED');
  if (state.rescueActive) issues.push('RESCUE_ACTIVE');

  const status: DealroomLaneHealthStatus =
    issues.length === 0 ? 'HEALTHY' : issues.length === 1 ? 'DEGRADED' : 'CRITICAL';

  return Object.freeze({
    status,
    stageIsActive: dealroomRunStateIsActive(state),
    pressureElevated,
    bluffDetected,
    rescueActive: state.rescueActive,
    leakDetected: state.leakDetected,
    issues: Object.freeze(issues),
    capturedAtMs: state.capturedAtMs,
  });
}

export function dealroomLaneIsHealthy(health: DealroomLaneHealth): boolean {
  return health.status === 'HEALTHY';
}

export function describeDealroomLaneHealth(health: DealroomLaneHealth): string {
  return `[dealroom-health:${health.status}] active=${health.stageIsActive} bluff=${health.bluffDetected} issues=${health.issues.length}`;
}

// ============================================================================
// MARK: Dealroom lane audit entry
// ============================================================================

export interface DealroomLaneAuditEntry {
  readonly subsystem: 'BluffResolver' | 'NegotiationEngine' | 'NegotiationReputationPolicy' | 'OfferCounterEngine';
  readonly eventKind: string;
  readonly dealId: string;
  readonly summary: string;
  readonly pressure01: number;
  readonly timestampMs: number;
}

export function buildNegotiationAuditEntry(
  dealId: string,
  eventKind: string,
  pressure01: number,
  summary: string,
  nowMs: number,
): DealroomLaneAuditEntry {
  return Object.freeze({
    subsystem: 'NegotiationEngine' as const,
    eventKind,
    dealId,
    summary,
    pressure01,
    timestampMs: nowMs,
  });
}

export function buildBluffAuditEntry(
  dealId: string,
  confidence01: number,
  tier: DealroomBluffConfidenceTier,
  nowMs: number,
): DealroomLaneAuditEntry {
  return Object.freeze({
    subsystem: 'BluffResolver' as const,
    eventKind: 'BLUFF_RESOLVED',
    dealId,
    summary: `confidence=${confidence01.toFixed(2)} tier=${tier} actionable=${dealroomBluffConfidenceTierIsActionable(tier)}`,
    pressure01: dealroomBluffConfidenceTierWeight(tier),
    timestampMs: nowMs,
  });
}

export function buildOfferAuditEntry(
  dealId: string,
  fairness01: number,
  aggression01: number,
  leakRisk: boolean,
  nowMs: number,
): DealroomLaneAuditEntry {
  return Object.freeze({
    subsystem: 'OfferCounterEngine' as const,
    eventKind: 'OFFER_EVALUATED',
    dealId,
    summary: `fairness=${fairness01.toFixed(2)} aggression=${aggression01.toFixed(2)} leakRisk=${leakRisk}`,
    pressure01: aggression01,
    timestampMs: nowMs,
  });
}

// ============================================================================
// MARK: Dealroom reputation impact model
// ============================================================================

export interface DealroomReputationImpact {
  readonly dealId: string;
  readonly outcomeTier: DealroomOfferOutcomeTier;
  readonly reputationDeltaDirection: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  readonly magnitude01: number;
  readonly affectedSurfaces: readonly DealroomReputationSurface[];
  readonly witnessAmplified: boolean;
}

export function buildDealroomReputationImpact(
  dealId: string,
  outcomeTier: DealroomOfferOutcomeTier,
  witnessDensity01: number,
): DealroomReputationImpact {
  const isPositive = dealroomOfferOutcomeTierIsPositive(outcomeTier);
  const isDamaging = dealroomOfferOutcomeTierDamagesReputation(outcomeTier);
  const isBoost = dealroomOfferOutcomeTierGrantsReputationBoost(outcomeTier);

  const direction = isBoost ? 'POSITIVE' : isDamaging ? 'NEGATIVE' : isPositive ? 'POSITIVE' : 'NEUTRAL';
  const magnitude01 = dealroomOfferOutcomeTierScore(outcomeTier) * (witnessDensity01 > 0.5 ? 1.3 : 1.0);

  const affectedSurfaces: DealroomReputationSurface[] = ['GLOBAL'];
  if (witnessDensity01 >= 0.6) affectedSurfaces.push('PUBLIC');
  if (outcomeTier === 'SWEEP') affectedSurfaces.push('SYNDICATE');

  return Object.freeze({
    dealId,
    outcomeTier,
    reputationDeltaDirection: direction,
    magnitude01: Math.min(1, magnitude01),
    affectedSurfaces: Object.freeze(affectedSurfaces),
    witnessAmplified: witnessDensity01 >= 0.6,
  });
}

// ============================================================================
// MARK: Dealroom lane doctrine
// ============================================================================

export const CHAT_DEALROOM_DOCTRINE = Object.freeze({
  version: CHAT_DEALROOM_BARREL_VERSION,
  rules: Object.freeze([
    'Negotiation does not stop at price. It spills into witness memory, trust, and future willingness to transact.',
    'Bluff reads are probabilistic; exploit only when confidence is actionable.',
    'Offers are social instruments. Aggression, desperation, and anchor manipulation are first-class signals.',
    'Leak risk is a tactical variable — not all leaks are accidental.',
    'Helper presence changes the negotiation plane; it must remain visible in the ledger.',
    'Rescue saves the deal, not the player\'s record. Face loss still registers.',
    'Reputation consequences from deals compound across the run.',
    'No transcript mutation, no socket fanout, no frontend rendering decisions here.',
    'Backend owns counter analysis; frontend may preview but not finalize counter choices.',
    'Every accepted deal must be replay-safe and auditable.',
  ] as const),
  subsystemWeights: Object.freeze({
    NEGOTIATION: 0.38,
    OFFER: 0.28,
    BLUFF: 0.20,
    REPUTATION: 0.14,
  }),
} as const);

// ============================================================================
// MARK: Dealroom lane coverage report
// ============================================================================

export interface ChatDealroomCoverageReport {
  readonly totalModules: number;
  readonly generatedModules: number;
  readonly negotiationStagesSupported: number;
  readonly offerOutcomeTiersSupported: number;
  readonly bluffConfidenceTiersSupported: number;
  readonly pressureTiersSupported: number;
}

export function buildDealroomCoverageReport(): ChatDealroomCoverageReport {
  return Object.freeze({
    totalModules: CHAT_DEALROOM_MODULE_DESCRIPTORS.length,
    generatedModules: CHAT_DEALROOM_MODULE_DESCRIPTORS.filter((d) => d.readiness === 'GENERATED').length,
    negotiationStagesSupported: DEALROOM_NEGOTIATION_STAGES.length,
    offerOutcomeTiersSupported: DEALROOM_OFFER_OUTCOME_TIERS.length,
    bluffConfidenceTiersSupported: DEALROOM_BLUFF_CONFIDENCE_TIERS.length,
    pressureTiersSupported: DEALROOM_PRESSURE_TIERS.length,
  });
}

// ============================================================================
// MARK: Dealroom lane constants
// ============================================================================

export const DEALROOM_LANE_CONSTANTS = Object.freeze({
  MAX_NEGOTIATION_ROUNDS: 12,
  MIN_OFFER_FAIRNESS_01: 0.05,
  BLUFF_EXPLOIT_WINDOW_DEFAULT_MS: 4000,
  REPUTATION_WITNESS_AMPLIFIER_THRESHOLD_01: 0.6,
  LEAK_DETECTION_SIGNAL_THRESHOLD: 3,
  RESCUE_ELIGIBILITY_THRESHOLD_01: 0.7,
  HELPER_INTERCEPT_AGGRESSION_THRESHOLD_01: 0.75,
  AUDIENCE_ACTIVATION_WITNESS_THRESHOLD_01: 0.55,
  SWEEP_OUTCOME_FAIRNESS_MINIMUM_01: 0.8,
  COLD_DEAL_PRESSURE_THRESHOLD_01: 0.25,
} as const);

// ============================================================================
// MARK: Dealroom lane gating authority
// ============================================================================

export function dealroomLaneShouldGateOutput(state: DealroomRunState): boolean {
  if (dealroomNegotiationStageIsTerminal(state.stage)) return false;
  if (state.stage === 'COUNTER_ACTIVE') return true;
  if (state.leakDetected) return true;
  return false;
}

export function dealroomLaneShouldInvokeHelper(state: DealroomRunState): boolean {
  return (
    !state.helperActive &&
    dealroomPressureTierIsElevated(state.pressureTier) &&
    !state.rescueActive
  );
}

export function dealroomLaneShouldOpenRescue(state: DealroomRunState): boolean {
  return (
    !state.rescueActive &&
    state.playerAdvantage01 <= (1 - DEALROOM_LANE_CONSTANTS.RESCUE_ELIGIBILITY_THRESHOLD_01)
  );
}

// ============================================================================
// MARK: ChatDealroomModule — unified frozen authority object
// ============================================================================

export const ChatDealroomModule = Object.freeze({
  version: CHAT_DEALROOM_BARREL_VERSION,

  // Subsystem namespaces
  BluffResolver,
  NegotiationEngine,
  NegotiationReputationPolicy,
  OfferCounterEngine,

  // Class references
  BluffResolverClass,
  NegotiationEngineClass,
  NegotiationReputationPolicyClass,
  OfferCounterEngineClass,

  // Factory references
  createBluffResolver,
  createNegotiationEngine,
  createNegotiationReputationPolicy,
  createOfferCounterEngine,

  // Sub-module authority bundles
  BluffResolverModule,
  NegotiationEngineModule,
  NegotiationReputationPolicyModule,

  // Registries
  DEALROOM_BLUFF_CONFIDENCE_TIERS,
  DEALROOM_NEGOTIATION_STAGES,
  DEALROOM_OFFER_OUTCOME_TIERS,
  DEALROOM_PRESSURE_TIERS,
  DEALROOM_LANE_CONSTANTS,

  // Tier helpers
  dealroomBluffConfidenceTierFrom01,
  dealroomBluffConfidenceTierIsActionable,
  dealroomBluffConfidenceTierWeight,
  dealroomNegotiationStageIsActive,
  dealroomNegotiationStageIsTerminal,
  dealroomNegotiationStageIsRisky,
  dealroomOfferOutcomeTierIsPositive,
  dealroomOfferOutcomeTierScore,
  dealroomOfferOutcomeTierDamagesReputation,
  dealroomOfferOutcomeTierGrantsReputationBoost,
  dealroomPressureTierFrom01,
  dealroomPressureTierIsElevated,
  dealroomPressureTierWeight,

  // Run state
  buildDealroomRunStateShell,
  dealroomRunStateIsActive,
  dealroomRunStateIsTerminal,
  dealroomRunStatePlayerIsWinning,
  describeDealroomRunState,

  // Bluff exploit helpers
  buildDealroomBluffExploitDecision,
  dealroomBluffExploitDecisionIsHighRisk,

  // Offer analysis
  buildDealroomOfferAnalysisSummaryShell,
  describeDealroomOfferAnalysis,

  // Reputation impact
  buildDealroomReputationImpact,

  // Health monitor
  buildDealroomLaneHealth,
  dealroomLaneIsHealthy,
  describeDealroomLaneHealth,

  // Audit builders
  buildNegotiationAuditEntry,
  buildBluffAuditEntry,
  buildOfferAuditEntry,

  // Coverage report
  buildDealroomCoverageReport,

  // Gating authority
  dealroomLaneShouldGateOutput,
  dealroomLaneShouldInvokeHelper,
  dealroomLaneShouldOpenRescue,

  // Module descriptors
  CHAT_DEALROOM_MODULE_DESCRIPTORS,
  dealroomModuleDescriptorById,
  dealroomModuleDescriptorsByCategory,

  // Doctrine
  CHAT_DEALROOM_DOCTRINE,

  // Readiness
  CHAT_DEALROOM_LANE_READINESS,

  // Barrel meta
  meta: CHAT_DEALROOM_BARREL_META,
});

// ============================================================================
// MARK: Dealroom negotiation round record
// ============================================================================

export interface DealroomNegotiationRoundRecord {
  readonly roundIndex: number;
  readonly offerFairness01: number;
  readonly offerAggression01: number;
  readonly bluffConfidence01: number;
  readonly bluffConfidenceTier: DealroomBluffConfidenceTier;
  readonly pressureTier: DealroomPressureTier;
  readonly leakOccurred: boolean;
  readonly helperPresent: boolean;
  readonly counterStrategy: DealroomCounterStrategy | null;
  readonly outcomeTier: DealroomOfferOutcomeTier | null;
  readonly timestampMs: number;
}

export function buildDealroomNegotiationRoundRecord(
  roundIndex: number,
  offerFairness01: number,
  offerAggression01: number,
  bluffConfidence01: number,
  leakOccurred: boolean,
  helperPresent: boolean,
  counterStrategy: DealroomCounterStrategy | null,
  nowMs: number,
): DealroomNegotiationRoundRecord {
  const bluffTier = dealroomBluffConfidenceTierFrom01(bluffConfidence01);
  const pressure01 = offerAggression01 * 0.6 + bluffConfidence01 * 0.4;
  const pressureTier = dealroomPressureTierFrom01(pressure01);

  return Object.freeze({
    roundIndex,
    offerFairness01,
    offerAggression01,
    bluffConfidence01,
    bluffConfidenceTier: bluffTier,
    pressureTier,
    leakOccurred,
    helperPresent,
    counterStrategy,
    outcomeTier: null,
    timestampMs: nowMs,
  });
}

export function describeNegotiationRoundRecord(record: DealroomNegotiationRoundRecord): string {
  return (
    `[round:${record.roundIndex}] fairness=${record.offerFairness01.toFixed(2)} ` +
    `aggression=${record.offerAggression01.toFixed(2)} bluff=${record.bluffConfidenceTier} ` +
    `counter=${record.counterStrategy ?? 'NONE'} outcome=${record.outcomeTier ?? 'PENDING'}`
  );
}

// ============================================================================
// MARK: Dealroom negotiation history
// ============================================================================

export interface DealroomNegotiationHistory {
  readonly dealId: string;
  readonly rounds: readonly DealroomNegotiationRoundRecord[];
  readonly openedAtMs: number;
  readonly closedAtMs: number | null;
  readonly finalOutcome: DealroomOfferOutcomeTier | null;
  readonly finalPressureTier: DealroomPressureTier;
  readonly totalLeaks: number;
  readonly helperUsed: boolean;
  readonly rescueUsed: boolean;
  readonly witnessedByAudience: boolean;
}

export function buildDealroomNegotiationHistoryShell(
  dealId: string,
  nowMs: number,
): DealroomNegotiationHistory {
  return Object.freeze({
    dealId,
    rounds: [],
    openedAtMs: nowMs,
    closedAtMs: null,
    finalOutcome: null,
    finalPressureTier: 'COLD',
    totalLeaks: 0,
    helperUsed: false,
    rescueUsed: false,
    witnessedByAudience: false,
  });
}

export function dealroomNegotiationHistoryIsClosed(history: DealroomNegotiationHistory): boolean {
  return history.closedAtMs !== null;
}

export function dealroomNegotiationHistoryDurationMs(history: DealroomNegotiationHistory): number {
  if (history.closedAtMs === null) return 0;
  return history.closedAtMs - history.openedAtMs;
}

export function dealroomNegotiationHistoryIsPositiveOutcome(history: DealroomNegotiationHistory): boolean {
  return history.finalOutcome != null && dealroomOfferOutcomeTierIsPositive(history.finalOutcome);
}

export function describeDealroomNegotiationHistory(history: DealroomNegotiationHistory): string {
  const durationSec = (dealroomNegotiationHistoryDurationMs(history) / 1000).toFixed(1);
  return (
    `[deal:${history.dealId}] rounds=${history.rounds.length} ` +
    `outcome=${history.finalOutcome ?? 'PENDING'} leaks=${history.totalLeaks} ` +
    `duration=${durationSec}s helper=${history.helperUsed}`
  );
}

// ============================================================================
// MARK: Dealroom multi-round aggregator
// ============================================================================

export interface DealroomMultiRoundSummary {
  readonly roundCount: number;
  readonly averageFairness01: number;
  readonly averageAggression01: number;
  readonly peakPressureTier: DealroomPressureTier;
  readonly bluffCountByTier: Readonly<Record<DealroomBluffConfidenceTier, number>>;
  readonly leakCount: number;
  readonly helperRoundCount: number;
}

export function summarizeDealroomRounds(
  rounds: readonly DealroomNegotiationRoundRecord[],
): DealroomMultiRoundSummary {
  if (rounds.length === 0) {
    return Object.freeze({
      roundCount: 0,
      averageFairness01: 0.5,
      averageAggression01: 0,
      peakPressureTier: 'COLD',
      bluffCountByTier: Object.freeze({
        UNDETECTED: 0, SUSPECTED: 0, PROBABLE: 0, CONFIRMED: 0, CERTAIN: 0,
      }),
      leakCount: 0,
      helperRoundCount: 0,
    });
  }

  const avgFairness = rounds.reduce((s, r) => s + r.offerFairness01, 0) / rounds.length;
  const avgAggression = rounds.reduce((s, r) => s + r.offerAggression01, 0) / rounds.length;

  const pressureWeights = rounds.map((r) => dealroomPressureTierWeight(r.pressureTier));
  const peakIdx = pressureWeights.indexOf(Math.max(...pressureWeights));
  const peakPressureTier = rounds[peakIdx]?.pressureTier ?? 'COLD';

  const bluffDist: Record<DealroomBluffConfidenceTier, number> = {
    UNDETECTED: 0, SUSPECTED: 0, PROBABLE: 0, CONFIRMED: 0, CERTAIN: 0,
  };
  for (const r of rounds) bluffDist[r.bluffConfidenceTier]++;

  return Object.freeze({
    roundCount: rounds.length,
    averageFairness01: avgFairness,
    averageAggression01: avgAggression,
    peakPressureTier,
    bluffCountByTier: Object.freeze(bluffDist),
    leakCount: rounds.filter((r) => r.leakOccurred).length,
    helperRoundCount: rounds.filter((r) => r.helperPresent).length,
  });
}

// ============================================================================
// MARK: Dealroom session summary
// ============================================================================

export interface DealroomSessionSummary {
  readonly totalDeals: number;
  readonly positiveOutcomeDeals: number;
  readonly sweepDeals: number;
  readonly capitulationDeals: number;
  readonly averageDurationMs: number;
  readonly totalLeaks: number;
  readonly helperAssistedDeals: number;
  readonly rescueDeals: number;
  readonly witnessedDeals: number;
}

export function buildDealroomSessionSummaryFromHistory(
  histories: readonly DealroomNegotiationHistory[],
): DealroomSessionSummary {
  if (histories.length === 0) {
    return Object.freeze({
      totalDeals: 0,
      positiveOutcomeDeals: 0,
      sweepDeals: 0,
      capitulationDeals: 0,
      averageDurationMs: 0,
      totalLeaks: 0,
      helperAssistedDeals: 0,
      rescueDeals: 0,
      witnessedDeals: 0,
    });
  }

  const closed = histories.filter(dealroomNegotiationHistoryIsClosed);
  const avgDuration = closed.length > 0
    ? closed.reduce((s, h) => s + dealroomNegotiationHistoryDurationMs(h), 0) / closed.length
    : 0;

  return Object.freeze({
    totalDeals: histories.length,
    positiveOutcomeDeals: histories.filter(dealroomNegotiationHistoryIsPositiveOutcome).length,
    sweepDeals: histories.filter((h) => h.finalOutcome === 'SWEEP').length,
    capitulationDeals: histories.filter((h) => h.finalOutcome === 'CAPITULATION').length,
    averageDurationMs: avgDuration,
    totalLeaks: histories.reduce((s, h) => s + h.totalLeaks, 0),
    helperAssistedDeals: histories.filter((h) => h.helperUsed).length,
    rescueDeals: histories.filter((h) => h.rescueUsed).length,
    witnessedDeals: histories.filter((h) => h.witnessedByAudience).length,
  });
}

export function dealroomSessionPlayerWinRate(summary: DealroomSessionSummary): number {
  if (summary.totalDeals === 0) return 0;
  return summary.positiveOutcomeDeals / summary.totalDeals;
}

export function describeDealroomSessionSummary(summary: DealroomSessionSummary): string {
  const rate = dealroomSessionPlayerWinRate(summary).toFixed(2);
  return (
    `[dealroom-session] deals=${summary.totalDeals} win_rate=${rate} ` +
    `sweeps=${summary.sweepDeals} leaks=${summary.totalLeaks} ` +
    `helper=${summary.helperAssistedDeals}`
  );
}

// ============================================================================
// MARK: Dealroom offer scenario registry
// ============================================================================

export const DEALROOM_OFFER_SCENARIOS = Object.freeze([
  'STANDARD_NEGOTIATION',   // Normal price/terms discussion
  'HOSTILE_TAKEOVER',       // Aggressive power play
  'DESPERATION_REVEAL',     // One side shows urgency
  'PROOF_BACKED',           // Player has receipts supporting their position
  'WITNESS_AMPLIFIED',      // Room is watching; public stakes
  'HELPER_MEDIATED',        // Helper is actively facilitating
  'RESCUE_PENDING',         // Deal is only happening to avoid collapse
  'SYNDICATE_OBSERVED',     // Multiple parties tracking the outcome
  'LEAKED_TERMS',           // Confidential terms have been exposed
  'ANCHOR_REVERSAL',        // Counter anchor dramatically shifts the frame
] as const);

export type DealroomOfferScenario = (typeof DEALROOM_OFFER_SCENARIOS)[number];

export function dealroomOfferScenarioIsPublic(scenario: DealroomOfferScenario): boolean {
  return scenario === 'WITNESS_AMPLIFIED' || scenario === 'SYNDICATE_OBSERVED' || scenario === 'LEAKED_TERMS';
}

export function dealroomOfferScenarioPlayerHasLeverage(scenario: DealroomOfferScenario): boolean {
  return scenario === 'PROOF_BACKED' || scenario === 'HELPER_MEDIATED';
}

export function dealroomOfferScenarioPressureWeight(scenario: DealroomOfferScenario): number {
  switch (scenario) {
    case 'HOSTILE_TAKEOVER': return 0.95;
    case 'SYNDICATE_OBSERVED': return 0.88;
    case 'LEAKED_TERMS': return 0.85;
    case 'WITNESS_AMPLIFIED': return 0.80;
    case 'ANCHOR_REVERSAL': return 0.75;
    case 'DESPERATION_REVEAL': return 0.70;
    case 'RESCUE_PENDING': return 0.68;
    case 'PROOF_BACKED': return 0.45;
    case 'HELPER_MEDIATED': return 0.40;
    case 'STANDARD_NEGOTIATION': return 0.30;
    default: return 0.3;
  }
}

// ============================================================================
// MARK: Dealroom offer window advisor
// ============================================================================

export type DealroomOfferWindowAdvice =
  | 'ACCEPT'
  | 'COUNTER_IMMEDIATELY'
  | 'COUNTER_WITH_PROOF'
  | 'INVOKE_HELPER'
  | 'CALL_RESCUE'
  | 'HOLD_SILENCE'
  | 'REJECT';

export function adviseDealroomOfferWindow(
  state: DealroomRunState,
  offerFairness01: number,
  bluffConfidence01: number,
): DealroomOfferWindowAdvice {
  if (offerFairness01 >= 0.75) return 'ACCEPT';
  if (dealroomBluffConfidenceTierIsActionable(dealroomBluffConfidenceTierFrom01(bluffConfidence01))) {
    return 'COUNTER_WITH_PROOF';
  }
  if (dealroomLaneShouldOpenRescue(state)) return 'CALL_RESCUE';
  if (dealroomLaneShouldInvokeHelper(state)) return 'INVOKE_HELPER';
  if (state.pressureTier === 'CRITICAL') return 'HOLD_SILENCE';
  if (offerFairness01 < 0.2) return 'REJECT';
  return 'COUNTER_IMMEDIATELY';
}

export function dealroomOfferWindowAdviceIsImmediate(advice: DealroomOfferWindowAdvice): boolean {
  return advice === 'ACCEPT' || advice === 'COUNTER_IMMEDIATELY' || advice === 'REJECT';
}

// ============================================================================
// MARK: Dealroom integration with continuity
// ============================================================================

export interface DealroomContinuityIntegration {
  readonly dealId: string;
  readonly shouldCarryoverToContinuity: boolean;
  readonly continuityBandSuggestion: string;
  readonly escortStyleSuggestion: string;
  readonly revealSuggested: boolean;
}

export function buildDealroomContinuityIntegration(
  state: DealroomRunState,
  outcomeTier: DealroomOfferOutcomeTier | null,
): DealroomContinuityIntegration {
  const shouldCarryover = outcomeTier != null && !dealroomNegotiationStageIsTerminal(state.stage)
    ? true
    : outcomeTier === 'CAPITULATION' || outcomeTier === 'LOSS';

  const continuityBandSuggestion = dealroomPressureTierIsElevated(state.pressureTier)
    ? 'HOT'
    : state.pressureTier === 'PRESSURED'
    ? 'WARM'
    : 'LOW';

  const escortStyleSuggestion = state.audienceWatching
    ? 'VISIBLE_ESCORT'
    : state.leakDetected
    ? 'SHADOW_ESCORT'
    : 'NONE';

  return Object.freeze({
    dealId: state.dealId,
    shouldCarryoverToContinuity: shouldCarryover,
    continuityBandSuggestion,
    escortStyleSuggestion,
    revealSuggested: outcomeTier === 'SWEEP' && state.audienceWatching,
  });
}

// ============================================================================
// MARK: Dealroom integration with combat
// ============================================================================

export interface DealroomCombatIntegration {
  readonly dealId: string;
  readonly negotiationCouldTriggerFight: boolean;
  readonly suggestedBossPatternClass: string;
  readonly pressureForCombat01: number;
}

export function buildDealroomCombatIntegration(
  state: DealroomRunState,
): DealroomCombatIntegration {
  const pressure01 = dealroomPressureTierWeight(state.pressureTier);

  const negotiationCouldTriggerFight = dealroomPressureTierIsElevated(state.pressureTier);

  const suggestedBossPatternClass = state.pressureTier === 'CRITICAL'
    ? 'PUBLIC_TRIBUNAL'
    : state.leakDetected
    ? 'EVIDENCE_WAR'
    : 'DIRECT_ASSAULT';

  return Object.freeze({
    dealId: state.dealId,
    negotiationCouldTriggerFight,
    suggestedBossPatternClass,
    pressureForCombat01: pressure01,
  });
}

// ============================================================================
// MARK: Dealroom lane constants and signature count
// ============================================================================

export const DEALROOM_LANE_MODULE_COUNT = CHAT_DEALROOM_MODULE_DESCRIPTORS.length;
export const DEALROOM_LANE_IS_AUTHORITY = true as const;
export const DEALROOM_LANE_SCOPE = 'BACKEND' as const;
export const DEALROOM_LANE_VERSION = CHAT_DEALROOM_BARREL_VERSION;

export const DEALROOM_LANE_SIGNATURE_COUNT = Object.freeze({
  bluffConfidenceTiers: DEALROOM_BLUFF_CONFIDENCE_TIERS.length,
  negotiationStages: DEALROOM_NEGOTIATION_STAGES.length,
  offerOutcomeTiers: DEALROOM_OFFER_OUTCOME_TIERS.length,
  pressureTiers: DEALROOM_PRESSURE_TIERS.length,
  offerScenarios: DEALROOM_OFFER_SCENARIOS.length,
  moduleCount: DEALROOM_LANE_MODULE_COUNT,
} as const);

// ============================================================================
// MARK: Dealroom lane extended doctrine
// ============================================================================

export const CHAT_DEALROOM_EXTENDED_DOCTRINE = Object.freeze([
  'Bluff confidence is probabilistic — never exploit without crossing the actionable threshold.',
  'Leaked terms change negotiation posture irrevocably; treat leaks as first-class events.',
  'Anchor reversals are high-risk, high-reward moves that require proof or helper support.',
  'Witness amplification makes every outcome land harder — publicly bad deals compound reputationally.',
  'Desperation signals are exploitable but risky — they can also bait emotional overreaction.',
  'Helper mediation should be clearly attributed in the ledger to preserve accountability.',
  'Sweep outcomes require backend validation — the win must be earned, not claimed.',
  'Capitulation must register as a loss in reputation even if the player accepted willingly.',
  'Counter strategies must match the scenario — EXPOSE_BLUFF without evidence backfires.',
  'Deal room transcripts feed continuity — unresolved tensions travel to the next scene.',
] as const);

// ============================================================================
// MARK: Dealroom lane final summary constant
// ============================================================================

export const DEALROOM_LANE_SUMMARY = Object.freeze({
  version: CHAT_DEALROOM_BARREL_VERSION,
  scope: DEALROOM_LANE_SCOPE,
  isAuthority: DEALROOM_LANE_IS_AUTHORITY,
  moduleCount: DEALROOM_LANE_MODULE_COUNT,
  signatureCounts: DEALROOM_LANE_SIGNATURE_COUNT,
  doctrine: CHAT_DEALROOM_DOCTRINE,
  extendedDoctrine: CHAT_DEALROOM_EXTENDED_DOCTRINE,
  constants: DEALROOM_LANE_CONSTANTS,
  meta: CHAT_DEALROOM_BARREL_META,
} as const);

// ============================================================================
// MARK: Dealroom lane exports table
// ============================================================================

export const DEALROOM_LANE_EXPORTS = Object.freeze({
  ChatDealroomModule: 'frozen authority object with all subsystem namespaces',
  BluffResolver: 'namespace: BluffResolver subsystem',
  NegotiationEngine: 'namespace: NegotiationEngine subsystem',
  NegotiationReputationPolicy: 'namespace: NegotiationReputationPolicy subsystem',
  OfferCounterEngine: 'namespace: OfferCounterEngine subsystem',
  createBluffResolver: 'factory: create BluffResolver',
  createNegotiationEngine: 'factory: create NegotiationEngine',
  createNegotiationReputationPolicy: 'factory: create NegotiationReputationPolicy',
  createOfferCounterEngine: 'factory: create OfferCounterEngine',
  DEALROOM_BLUFF_CONFIDENCE_TIERS: 'all bluff confidence tier identifiers',
  DEALROOM_NEGOTIATION_STAGES: 'all negotiation stage identifiers',
  DEALROOM_OFFER_OUTCOME_TIERS: 'all offer outcome tier identifiers',
  DEALROOM_PRESSURE_TIERS: 'all dealroom pressure tier identifiers',
  DEALROOM_OFFER_SCENARIOS: 'all offer scenario identifiers',
  DEALROOM_LANE_CONSTANTS: 'numeric constants for the dealroom lane',
  adviseDealroomOfferWindow: 'top-level offer window advice authority',
  dealroomLaneShouldGateOutput: 'top-level output gating authority',
  buildDealroomReputationImpact: 'reputation impact from deal outcome',
} as const);

// ============================================================================
// MARK: Dealroom lane shorthand type bundle
// ============================================================================

/** All dealroom-related shorthand type aliases assembled for external use. */
export type DealroomLaneTypeBundle = {
  RunState: DealroomRunState;
  AuditEntry: DealroomLaneAuditEntry;
  NegotiationRoundRecord: DealroomNegotiationRoundRecord;
  NegotiationHistory: DealroomNegotiationHistory;
  ReputationImpact: DealroomReputationImpact;
  BluffExploitDecision: DealroomBluffExploitDecision;
  LaneHealth: DealroomLaneHealth;
  MultiRoundSummary: DealroomMultiRoundSummary;
  SessionSummary: DealroomSessionSummary;
  OfferWindowAdvice: DealroomOfferWindowAdvice;
  ContinuityIntegration: DealroomContinuityIntegration;
  CombatIntegration: DealroomCombatIntegration;
};

// ============================================================================
// MARK: Dealroom offer fairness band registry
// ============================================================================

export const DEALROOM_OFFER_FAIRNESS_BANDS = Object.freeze([
  'EXPLOITATIVE',  // Grossly unfair — take or be humiliated
  'AGGRESSIVE',    // Unfair but within game rules
  'BELOW_FAIR',    // Slightly favoring the offerer
  'FAIR',          // Roughly balanced value
  'ABOVE_FAIR',    // Slightly favoring the receiver
  'GENEROUS',      // Deliberately favorable — signal or bait?
  'SWEEP_OFFER',   // Extremely favorable — likely a trap or gift
] as const);

export type DealroomOfferFairnessBand = (typeof DEALROOM_OFFER_FAIRNESS_BANDS)[number];

export function dealroomOfferFairnessBandFrom01(fairness01: number): DealroomOfferFairnessBand {
  if (fairness01 >= 0.92) return 'SWEEP_OFFER';
  if (fairness01 >= 0.78) return 'GENEROUS';
  if (fairness01 >= 0.60) return 'ABOVE_FAIR';
  if (fairness01 >= 0.45) return 'FAIR';
  if (fairness01 >= 0.28) return 'BELOW_FAIR';
  if (fairness01 >= 0.12) return 'AGGRESSIVE';
  return 'EXPLOITATIVE';
}

export function dealroomOfferFairnessBandIsAcceptable(band: DealroomOfferFairnessBand): boolean {
  return band === 'FAIR' || band === 'ABOVE_FAIR' || band === 'GENEROUS' || band === 'SWEEP_OFFER';
}

export function dealroomOfferFairnessBandShouldCounter(band: DealroomOfferFairnessBand): boolean {
  return band === 'AGGRESSIVE' || band === 'BELOW_FAIR';
}

export function dealroomOfferFairnessBandShouldReject(band: DealroomOfferFairnessBand): boolean {
  return band === 'EXPLOITATIVE';
}

export function dealroomOfferFairnessBandWeight(band: DealroomOfferFairnessBand): number {
  switch (band) {
    case 'SWEEP_OFFER': return 1.0;
    case 'GENEROUS': return 0.85;
    case 'ABOVE_FAIR': return 0.68;
    case 'FAIR': return 0.55;
    case 'BELOW_FAIR': return 0.38;
    case 'AGGRESSIVE': return 0.22;
    case 'EXPLOITATIVE': return 0.05;
    default: return 0.3;
  }
}

// ============================================================================
// MARK: Dealroom anchor manipulation detector
// ============================================================================

export const DEALROOM_ANCHOR_MANIPULATION_CLASSES = Object.freeze([
  'NONE',              // No anchor manipulation detected
  'HIGH_ANCHOR',       // Unusually high opening offer to shift perception
  'LOW_ANCHOR',        // Unusually low opening offer to anchor downward
  'DECOY_ANCHOR',      // Presenting a sacrificial term to win elsewhere
  'GRADUAL_SHIFT',     // Small moves designed to move the window slowly
  'REVERSAL_ANCHOR',   // Sudden dramatic counter to reset the frame
] as const);

export type DealroomAnchorManipulationClass = (typeof DEALROOM_ANCHOR_MANIPULATION_CLASSES)[number];

export function dealroomAnchorManipulationIsDetected(cls: DealroomAnchorManipulationClass): boolean {
  return cls !== 'NONE';
}

export function dealroomAnchorManipulationIsAggressive(cls: DealroomAnchorManipulationClass): boolean {
  return cls === 'HIGH_ANCHOR' || cls === 'LOW_ANCHOR' || cls === 'REVERSAL_ANCHOR';
}

export function dealroomAnchorManipulationPressureBonus(cls: DealroomAnchorManipulationClass): number {
  switch (cls) {
    case 'REVERSAL_ANCHOR': return 0.2;
    case 'HIGH_ANCHOR': return 0.15;
    case 'LOW_ANCHOR': return 0.12;
    case 'DECOY_ANCHOR': return 0.08;
    case 'GRADUAL_SHIFT': return 0.05;
    case 'NONE': return 0;
    default: return 0;
  }
}

// ============================================================================
// MARK: Dealroom counter strategy registry
// ============================================================================

export const DEALROOM_COUNTER_STRATEGIES = Object.freeze([
  'EXPOSE_BLUFF',       // Call out the bluff directly
  'COUNTER_ANCHOR',     // Re-anchor the negotiation frame
  'PROOF_SUPPORT',      // Present evidence for your position
  'CONCESSION_TRADE',   // Trade a low-value concession for a high-value one
  'HELPER_INVOKE',      // Call in helper support to mediate
  'WALKAWAY_THREAT',    // Credibly signal willingness to end the deal
  'AUDIENCE_APPEAL',    // Turn public pressure in your favor
  'DELAY_TACTIC',       // Slow down to change pressure dynamics
  'SILENCE_MOVE',       // Non-response to force the other side to reveal more
] as const);

export type DealroomCounterStrategyAll = (typeof DEALROOM_COUNTER_STRATEGIES)[number];

export function dealroomCounterStrategyRequiresEvidence(strategy: DealroomCounterStrategyAll): boolean {
  return strategy === 'EXPOSE_BLUFF' || strategy === 'PROOF_SUPPORT';
}

export function dealroomCounterStrategyRequiresHelper(strategy: DealroomCounterStrategyAll): boolean {
  return strategy === 'HELPER_INVOKE';
}

export function dealroomCounterStrategyIsHighRisk(strategy: DealroomCounterStrategyAll): boolean {
  return strategy === 'EXPOSE_BLUFF' || strategy === 'WALKAWAY_THREAT' || strategy === 'AUDIENCE_APPEAL';
}

export function dealroomCounterStrategyBaseEfficacy(strategy: DealroomCounterStrategyAll): number {
  switch (strategy) {
    case 'PROOF_SUPPORT': return 0.85;
    case 'EXPOSE_BLUFF': return 0.80;
    case 'HELPER_INVOKE': return 0.72;
    case 'AUDIENCE_APPEAL': return 0.68;
    case 'COUNTER_ANCHOR': return 0.65;
    case 'CONCESSION_TRADE': return 0.60;
    case 'WALKAWAY_THREAT': return 0.55;
    case 'SILENCE_MOVE': return 0.50;
    case 'DELAY_TACTIC': return 0.42;
    default: return 0.5;
  }
}

// ============================================================================
// MARK: Dealroom pressure projection
// ============================================================================

export interface DealroomPressureProjection {
  readonly currentTier: DealroomPressureTier;
  readonly trend: 'RISING' | 'STABLE' | 'FALLING';
  readonly nextTier: DealroomPressureTier;
  readonly distanceToCritical: number;
  readonly recommendedStrategy: DealroomCounterStrategyAll;
}

export function projectDealroomPressure(
  currentPressure01: number,
  previousPressure01: number,
): DealroomPressureProjection {
  const delta = currentPressure01 - previousPressure01;
  const trend: 'RISING' | 'STABLE' | 'FALLING' =
    delta > 0.05 ? 'RISING' : delta < -0.05 ? 'FALLING' : 'STABLE';

  const currentTier = dealroomPressureTierFrom01(currentPressure01);
  const nextTierMap: Record<DealroomPressureTier, DealroomPressureTier> = {
    COLD: 'WARM',
    WARM: 'PRESSURED',
    PRESSURED: 'HOSTILE',
    HOSTILE: 'CRITICAL',
    CRITICAL: 'CRITICAL',
  };

  const recommendedStrategy: DealroomCounterStrategyAll =
    currentPressure01 >= 0.85 ? 'SILENCE_MOVE'
    : currentPressure01 >= 0.70 ? 'HELPER_INVOKE'
    : currentPressure01 >= 0.50 ? 'COUNTER_ANCHOR'
    : 'CONCESSION_TRADE';

  return Object.freeze({
    currentTier,
    trend,
    nextTier: nextTierMap[currentTier],
    distanceToCritical: Math.max(0, 0.88 - currentPressure01),
    recommendedStrategy,
  });
}

export function dealroomPressureProjectionIsNearCritical(proj: DealroomPressureProjection): boolean {
  return proj.distanceToCritical < 0.1;
}

// ============================================================================
// MARK: Dealroom lane combined score
// ============================================================================

/**
 * Returns a combined deal health score (0–1).
 * 1.0 = player in full control, no pressure, deal progressing.
 */
export function dealroomCombinedHealthScore(state: DealroomRunState): number {
  const pressureScore = 1 - dealroomPressureTierWeight(state.pressureTier);
  const bluffScore = dealroomBluffConfidenceTierIsActionable(state.bluffConfidenceTier) ? 0.8 : 0.4;
  const playerAdvantageFactor = state.playerAdvantage01;
  return Math.min(1, pressureScore * 0.4 + bluffScore * 0.2 + playerAdvantageFactor * 0.4);
}

export function dealroomHealthScoreIsHealthy(score: number): boolean {
  return score >= 0.6;
}

export function dealroomHealthScoreIsCritical(score: number): boolean {
  return score < 0.3;
}

// ============================================================================
// MARK: Dealroom lane final checks
// ============================================================================

/**
 * Returns whether the dealroom lane is ready to emit a counter offer.
 */
export function dealroomLaneIsReadyToEmitCounter(
  state: DealroomRunState,
  health: DealroomLaneHealth,
): boolean {
  if (health.status === 'CRITICAL') return false;
  if (dealroomNegotiationStageIsTerminal(state.stage)) return false;
  if (state.stage === 'COUNTER_ACTIVE') return false; // already in counter
  return true;
}

/**
 * One-line status for the dealroom lane.
 */
export function describeDealroomLaneStatus(
  state: DealroomRunState,
  health: DealroomLaneHealth,
): string {
  const ready = dealroomLaneIsReadyToEmitCounter(state, health);
  return `[dealroom-lane] ready=${ready} ${describeDealroomRunState(state)} | ${describeDealroomLaneHealth(health)}`;
}

// ============================================================================
// MARK: Dealroom lane replay frame
// ============================================================================

export interface DealroomReplayFrame {
  readonly frameIndex: number;
  readonly roundIndex: number;
  readonly stage: DealroomNegotiationStage;
  readonly eventKind: string;
  readonly summary: string;
  readonly fairness01: number;
  readonly aggression01: number;
  readonly playerAdvantage01: number;
  readonly timestampMs: number;
}

export function buildDealroomReplayFrameFromRound(
  round: DealroomNegotiationRoundRecord,
  frameIndex: number,
  playerAdvantage01: number,
): DealroomReplayFrame {
  const stage: DealroomNegotiationStage = round.outcomeTier
    ? 'NEAR_CLOSE'
    : 'COUNTER_ACTIVE';

  return Object.freeze({
    frameIndex,
    roundIndex: round.roundIndex,
    stage,
    eventKind: 'ROUND_RESOLVED',
    summary: describeNegotiationRoundRecord(round),
    fairness01: round.offerFairness01,
    aggression01: round.offerAggression01,
    playerAdvantage01,
    timestampMs: round.timestampMs,
  });
}

export function buildDealroomReplayFrames(
  history: DealroomNegotiationHistory,
): readonly DealroomReplayFrame[] {
  let playerAdv = 0.5;
  return history.rounds.map((round, i) => {
    const fairnessDelta = (round.offerFairness01 - 0.5) * 0.15;
    const bluffDelta = dealroomBluffConfidenceTierIsActionable(round.bluffConfidenceTier)
      && round.counterStrategy != null ? 0.08 : 0;
    playerAdv = Math.max(0, Math.min(1, playerAdv + fairnessDelta + bluffDelta));
    return buildDealroomReplayFrameFromRound(round, i, playerAdv);
  });
}

// ============================================================================
// MARK: Dealroom lane scenario analysis helpers
// ============================================================================

export function analyzeDealroomScenario(
  scenario: DealroomOfferScenario,
  state: DealroomRunState,
): { scenarioPressure01: number; playerHasLeverage: boolean; isPublic: boolean; recommendedStage: DealroomNegotiationStage } {
  const scenarioPressure01 = dealroomOfferScenarioPressureWeight(scenario);
  const playerHasLeverage = dealroomOfferScenarioPlayerHasLeverage(scenario);
  const isPublic = dealroomOfferScenarioIsPublic(scenario);

  const combined = scenarioPressure01 * 0.6 + dealroomPressureTierWeight(state.pressureTier) * 0.4;
  const recommendedStage: DealroomNegotiationStage =
    combined >= 0.85 ? 'AUDIENCE_WATCHING'
    : playerHasLeverage ? 'COUNTER_ACTIVE'
    : combined >= 0.5 ? 'COUNTER_PENDING'
    : 'OFFER_POSTED';

  return { scenarioPressure01, playerHasLeverage, isPublic, recommendedStage };
}

// ============================================================================
// MARK: Dealroom lane deal snapshot
// ============================================================================

export interface DealroomDealSnapshot {
  readonly dealId: string;
  readonly stage: DealroomNegotiationStage;
  readonly scenario: DealroomOfferScenario | null;
  readonly fairnessBand: DealroomOfferFairnessBand;
  readonly pressureTier: DealroomPressureTier;
  readonly bluffConfidenceTier: DealroomBluffConfidenceTier;
  readonly anchorManipulation: DealroomAnchorManipulationClass;
  readonly recommendedAdvice: DealroomOfferWindowAdvice;
  readonly combinedHealthScore: number;
  readonly capturedAtMs: number;
}

export function buildDealroomDealSnapshot(
  state: DealroomRunState,
  fairness01: number,
  bluffConfidence01: number,
  anchorManipulation: DealroomAnchorManipulationClass,
  scenario: DealroomOfferScenario | null,
): DealroomDealSnapshot {
  return Object.freeze({
    dealId: state.dealId,
    stage: state.stage,
    scenario,
    fairnessBand: dealroomOfferFairnessBandFrom01(fairness01),
    pressureTier: state.pressureTier,
    bluffConfidenceTier: dealroomBluffConfidenceTierFrom01(bluffConfidence01),
    anchorManipulation,
    recommendedAdvice: adviseDealroomOfferWindow(state, fairness01, bluffConfidence01),
    combinedHealthScore: dealroomCombinedHealthScore(state),
    capturedAtMs: state.capturedAtMs,
  });
}

export function describeDealroomDealSnapshot(snapshot: DealroomDealSnapshot): string {
  return (
    `[snapshot:${snapshot.dealId}] stage=${snapshot.stage} ` +
    `fairness=${snapshot.fairnessBand} pressure=${snapshot.pressureTier} ` +
    `bluff=${snapshot.bluffConfidenceTier} advice=${snapshot.recommendedAdvice} ` +
    `score=${snapshot.combinedHealthScore.toFixed(2)}`
  );
}

// ============================================================================
// MARK: Dealroom lane extended shorthand type bundle
// ============================================================================

/** Shorthand: dealroom negotiation round record. */
export type AnyDealroomRoundRecord = DealroomNegotiationRoundRecord;

/** Shorthand: dealroom negotiation history. */
export type AnyDealroomHistory = DealroomNegotiationHistory;

/** Shorthand: dealroom replay frame. */
export type AnyDealroomReplayFrame = DealroomReplayFrame;

/** Shorthand: dealroom deal snapshot. */
export type AnyDealroomDealSnapshot = DealroomDealSnapshot;

/** Shorthand: dealroom pressure projection. */
export type AnyDealroomPressureProjection = DealroomPressureProjection;

/** Shorthand: dealroom bluff exploit decision. */
export type AnyDealroomBluffExploitDecision = DealroomBluffExploitDecision;

/** Shorthand: dealroom offer analysis summary. */
export type AnyDealroomOfferAnalysisSummary = DealroomOfferAnalysisSummary;

/** Shorthand: dealroom session summary. */
export type AnyDealroomSessionSummary = DealroomSessionSummary;

// ============================================================================
// MARK: Dealroom lane signal event types
// ============================================================================

export const DEALROOM_SIGNAL_EVENT_TYPES = Object.freeze([
  'OFFER_RECEIVED',
  'COUNTER_SUBMITTED',
  'BLUFF_DETECTED',
  'LEAK_OCCURRED',
  'ANCHOR_SHIFT',
  'HELPER_ENTERED',
  'RESCUE_TRIGGERED',
  'AUDIENCE_ACTIVATED',
  'CONCESSION_MADE',
  'DEAL_ACCEPTED',
  'DEAL_REJECTED',
  'DEAL_EXPIRED',
  'NEGOTIATION_OPENED',
  'NEGOTIATION_CLOSED',
] as const);

export type DealroomSignalEventType = (typeof DEALROOM_SIGNAL_EVENT_TYPES)[number];

export function dealroomSignalEventIsTerminating(event: DealroomSignalEventType): boolean {
  return event === 'DEAL_ACCEPTED' || event === 'DEAL_REJECTED' || event === 'DEAL_EXPIRED' || event === 'NEGOTIATION_CLOSED';
}

export function dealroomSignalEventIsEscalating(event: DealroomSignalEventType): boolean {
  return event === 'BLUFF_DETECTED' || event === 'AUDIENCE_ACTIVATED' || event === 'ANCHOR_SHIFT';
}

export function dealroomSignalEventIsHelperRelated(event: DealroomSignalEventType): boolean {
  return event === 'HELPER_ENTERED' || event === 'RESCUE_TRIGGERED';
}

// ============================================================================
// MARK: Dealroom signal event record
// ============================================================================

export interface DealroomSignalEvent {
  readonly dealId: string;
  readonly eventType: DealroomSignalEventType;
  readonly stage: DealroomNegotiationStage;
  readonly pressure01: number;
  readonly timestampMs: number;
  readonly notes: string;
}

export function buildDealroomSignalEvent(
  dealId: string,
  eventType: DealroomSignalEventType,
  state: DealroomRunState,
  notes: string,
): DealroomSignalEvent {
  return Object.freeze({
    dealId,
    eventType,
    stage: state.stage,
    pressure01: dealroomPressureTierWeight(state.pressureTier),
    timestampMs: state.capturedAtMs,
    notes,
  });
}

export function describeDealroomSignalEvent(event: DealroomSignalEvent): string {
  return `[event:${event.eventType}] deal=${event.dealId} stage=${event.stage} pressure=${event.pressure01.toFixed(2)}`;
}

// ============================================================================
// MARK: Dealroom signal event batch helpers
// ============================================================================

export function filterEscalatingSignalEvents(
  events: readonly DealroomSignalEvent[],
): DealroomSignalEvent[] {
  return events.filter((e) => dealroomSignalEventIsEscalating(e.eventType));
}

export function filterTerminatingSignalEvents(
  events: readonly DealroomSignalEvent[],
): DealroomSignalEvent[] {
  return events.filter((e) => dealroomSignalEventIsTerminating(e.eventType));
}

export function sortSignalEventsByTimestampDesc(
  events: readonly DealroomSignalEvent[],
): DealroomSignalEvent[] {
  return [...events].sort((a, b) => b.timestampMs - a.timestampMs);
}

export function dealroomSignalEventBatchHasEscalation(
  events: readonly DealroomSignalEvent[],
): boolean {
  return events.some((e) => dealroomSignalEventIsEscalating(e.eventType));
}

// ============================================================================
// MARK: Dealroom lane v2 summary constant
// ============================================================================

export const DEALROOM_LANE_V2_SUMMARY = Object.freeze({
  version: CHAT_DEALROOM_BARREL_VERSION,
  scope: DEALROOM_LANE_SCOPE,
  signalEventTypes: DEALROOM_SIGNAL_EVENT_TYPES.length,
  offerFairnessBands: DEALROOM_OFFER_FAIRNESS_BANDS.length,
  anchorManipulationClasses: DEALROOM_ANCHOR_MANIPULATION_CLASSES.length,
  counterStrategies: DEALROOM_COUNTER_STRATEGIES.length,
  offerScenarios: DEALROOM_OFFER_SCENARIOS.length,
  totalRegistries: 10,
} as const);

// ============================================================================
// MARK: Dealroom lane complete type bundle (extended)
// ============================================================================

/** Shorthand: any dealroom signal event. */
export type AnyDealroomSignalEvent = DealroomSignalEvent;

/** Shorthand: any dealroom signal event type identifier. */
export type AnyDealroomSignalEventType = DealroomSignalEventType;

/** Shorthand: any dealroom offer fairness band. */
export type AnyDealroomFairnessBand = DealroomOfferFairnessBand;

/** Shorthand: any dealroom anchor manipulation class. */
export type AnyDealroomAnchorManipulation = DealroomAnchorManipulationClass;

/** Shorthand: any extended dealroom counter strategy. */
export type AnyDealroomCounterStrategyAll = DealroomCounterStrategyAll;

/** Shorthand: any dealroom offer scenario. */
export type AnyDealroomOfferScenario = DealroomOfferScenario;

/** Shorthand: any dealroom multi-round summary. */
export type AnyDealroomMultiRoundSummary = DealroomMultiRoundSummary;

/** Shorthand: any dealroom combat integration. */
export type AnyDealroomCombatIntegration = DealroomCombatIntegration;

/** Shorthand: any dealroom continuity integration. */
export type AnyDealroomContinuityIntegration = DealroomContinuityIntegration;

// ============================================================================
// MARK: Dealroom lane authority constants
// ============================================================================

export const DEALROOM_LANE_IS_AUTHORITY = true as const;
export const DEALROOM_LANE_SCOPE = 'BACKEND' as const;

export const DEALROOM_LANE_FULL_CONSTANTS = Object.freeze({
  ...DEALROOM_LANE_CONSTANTS,
  bluffConfidenceTierCount: DEALROOM_BLUFF_CONFIDENCE_TIERS.length,
  negotiationStageCount: DEALROOM_NEGOTIATION_STAGES.length,
  offerOutcomeTierCount: DEALROOM_OFFER_OUTCOME_TIERS.length,
  pressureTierCount: DEALROOM_PRESSURE_TIERS.length,
  offerScenarioCount: DEALROOM_OFFER_SCENARIOS.length,
  offerFairnessBandCount: DEALROOM_OFFER_FAIRNESS_BANDS.length,
  anchorManipulationClassCount: DEALROOM_ANCHOR_MANIPULATION_CLASSES.length,
  counterStrategyCount: DEALROOM_COUNTER_STRATEGIES.length,
  signalEventTypeCount: DEALROOM_SIGNAL_EVENT_TYPES.length,
  totalRegistries: 9,
} as const);

export const DEALROOM_LANE_DOCTRINE_RULE_COUNT = CHAT_DEALROOM_DOCTRINE.rules.length;
export const DEALROOM_LANE_EXTENDED_DOCTRINE_RULE_COUNT = CHAT_DEALROOM_EXTENDED_DOCTRINE.length;

// ============================================================================
// MARK: Dealroom lane combined meta export
// ============================================================================

export const DEALROOM_LANE_COMBINED_META = Object.freeze({
  version: CHAT_DEALROOM_BARREL_VERSION,
  barrelMeta: CHAT_DEALROOM_BARREL_META,
  laneSummary: DEALROOM_LANE_SUMMARY,
  v2Summary: DEALROOM_LANE_V2_SUMMARY,
  fullConstants: DEALROOM_LANE_FULL_CONSTANTS,
  signatureCount: DEALROOM_LANE_SIGNATURE_COUNT,
  doctrinRuleCount: DEALROOM_LANE_DOCTRINE_RULE_COUNT,
  extendedDoctrineRuleCount: DEALROOM_LANE_EXTENDED_DOCTRINE_RULE_COUNT,
  isAuthority: DEALROOM_LANE_IS_AUTHORITY,
  scope: DEALROOM_LANE_SCOPE,
} as const);

/** Dealroom lane fully assembled module count. */
export const DEALROOM_LANE_MODULE_COUNT = CHAT_DEALROOM_MODULE_DESCRIPTORS.length;

// ============================================================================
// MARK: Dealroom lane barrel final shorthand type bundle
// ============================================================================

/** Complete dealroom type bundle including extended types. */
export type DealroomLaneExtendedTypeBundle = DealroomLaneTypeBundle & {
  SignalEvent: AnyDealroomSignalEvent;
  SignalEventType: AnyDealroomSignalEventType;
  FairnessBand: AnyDealroomFairnessBand;
  AnchorManipulation: AnyDealroomAnchorManipulation;
  CounterStrategyAll: AnyDealroomCounterStrategyAll;
  OfferScenario: AnyDealroomOfferScenario;
  MultiRoundSummary: AnyDealroomMultiRoundSummary;
  CombatIntegration: AnyDealroomCombatIntegration;
  ContinuityIntegration: AnyDealroomContinuityIntegration;
  ReplayFrame: AnyDealroomReplayFrame;
  DealSnapshot: AnyDealroomDealSnapshot;
};

// Ensure all registries are exported at the top level for index tree-shaking
export const _DEALROOM_REGISTRY_KEYS = Object.freeze({
  BLUFF_CONFIDENCE_TIERS: 'DEALROOM_BLUFF_CONFIDENCE_TIERS',
  NEGOTIATION_STAGES: 'DEALROOM_NEGOTIATION_STAGES',
  OFFER_OUTCOME_TIERS: 'DEALROOM_OFFER_OUTCOME_TIERS',
  PRESSURE_TIERS: 'DEALROOM_PRESSURE_TIERS',
  OFFER_SCENARIOS: 'DEALROOM_OFFER_SCENARIOS',
  FAIRNESS_BANDS: 'DEALROOM_OFFER_FAIRNESS_BANDS',
  ANCHOR_MANIPULATION_CLASSES: 'DEALROOM_ANCHOR_MANIPULATION_CLASSES',
  COUNTER_STRATEGIES: 'DEALROOM_COUNTER_STRATEGIES',
  SIGNAL_EVENT_TYPES: 'DEALROOM_SIGNAL_EVENT_TYPES',
} as const);

export const DEALROOM_LANE_READY = true as const;
