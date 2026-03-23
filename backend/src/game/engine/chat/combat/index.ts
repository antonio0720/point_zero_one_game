/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT COMBAT BARREL
 * FILE: backend/src/game/engine/chat/combat/index.ts
 * VERSION: 2026.03.23-combat-barrel.v1
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative export surface for the chat combat lane.
 * The combat lane governs conversational boss fights, attack windows,
 * telegraphs, and counter resolution inside the chat runtime.
 *
 * Subsystems
 * ----------
 * 1. ChatBossFightEngine      — orchestrates full conversational boss fight
 *                               lifecycle: open, advance, sweep, resolve.
 * 2. ChatAttackWindowPolicy   — timing law for counter windows: duration,
 *                               ideal target, grace, extension, hard close.
 * 3. ChatTelegraphPolicy      — governs how attacks announce themselves with
 *                               legible beat-by-beat lead-in and reveal timing.
 * 4. ChatCounterResolver      — translates incoming attacks into authoritative
 *                               counter windows, candidates, and resolutions.
 *
 * Design doctrine
 * ---------------
 * - No UI ownership. No socket ownership. Backend authority only.
 * - All four subsystems are independently importable and composable.
 * - ChatCombatModule provides the single frozen authority object consumed by
 *   the chat root barrel.
 * - No ambiguous re-exports: the four files share no conflicting top-level names,
 *   so all four are flat-exported.
 * ============================================================================
 */

// ============================================================================
// MARK: Namespace imports — all four subsystems
// ============================================================================

import * as BossFightEngine from './ChatBossFightEngine';
import * as AttackWindowPolicy from './ChatAttackWindowPolicy';
import * as TelegraphPolicy from './ChatTelegraphPolicy';
import * as CounterResolver from './ChatCounterResolver';

// ============================================================================
// MARK: Flat re-exports — all four subsystems (no name conflicts)
// ============================================================================

export * from './ChatBossFightEngine';
export * from './ChatAttackWindowPolicy';
export * from './ChatTelegraphPolicy';
export * from './ChatCounterResolver';

// ============================================================================
// MARK: Namespace re-exports
// ============================================================================

export { BossFightEngine, AttackWindowPolicy, TelegraphPolicy, CounterResolver };

// ============================================================================
// MARK: Convenience class surface
// ============================================================================

/** Orchestrates full conversational boss fight lifecycle. */
export const ChatBossFightEngineClass = BossFightEngine.ChatBossFightEngine;

/** Attack window timing law: duration, ideal target, grace, extension. */
export const ChatAttackWindowPolicyClass = AttackWindowPolicy.ChatAttackWindowPolicy;

/** Governs attack announcement with legible beat-by-beat telegraph. */
export const ChatTelegraphPolicyClass = TelegraphPolicy.ChatTelegraphPolicy;

/** Translates attacks into authoritative counter windows, candidates, resolutions. */
export const ChatCounterResolverClass = CounterResolver.ChatCounterResolver;

// ============================================================================
// MARK: Convenience factory surface
// ============================================================================

export const createChatBossFightEngine = BossFightEngine.createChatBossFightEngine;
export const createChatAttackWindowPolicy = AttackWindowPolicy.createChatAttackWindowPolicy;
export const createChatTelegraphPolicy = TelegraphPolicy.createChatTelegraphPolicy;
export const createChatCounterResolver = CounterResolver.createChatCounterResolver;

// ============================================================================
// MARK: Default policy tuning surface
// ============================================================================

export const DEFAULT_BOSS_FIGHT_ENGINE_POLICY = BossFightEngine.DEFAULT_CHAT_BOSS_FIGHT_ENGINE_POLICY;
export const DEFAULT_ATTACK_WINDOW_POLICY_TUNING = AttackWindowPolicy.DEFAULT_CHAT_ATTACK_WINDOW_POLICY_TUNING;
export const DEFAULT_TELEGRAPH_POLICY_TUNING = TelegraphPolicy.DEFAULT_CHAT_TELEGRAPH_POLICY_TUNING;
export const DEFAULT_COUNTER_RESOLVER_POLICY = CounterResolver.DEFAULT_CHAT_COUNTER_RESOLVER_POLICY;

// ============================================================================
// MARK: Signature / label surfaces
// ============================================================================

export const ATTACK_WINDOW_POLICY_SIGNATURES = AttackWindowPolicy.CHAT_ATTACK_WINDOW_POLICY_SIGNATURES;
export const TELEGRAPH_SCENE_SIGNATURES = TelegraphPolicy.CHAT_TELEGRAPH_SCENE_SIGNATURES;
export const TELEGRAPH_DEMAND_LABELS = TelegraphPolicy.CHAT_TELEGRAPH_DEMAND_LABELS;
export const TELEGRAPH_WINDOW_SIGNATURES = TelegraphPolicy.CHAT_TELEGRAPH_WINDOW_SIGNATURES;

// ============================================================================
// MARK: Combat barrel version
// ============================================================================

export const CHAT_COMBAT_BARREL_VERSION = '2026.03.23-combat-barrel.v1' as const;
export const CHAT_COMBAT_AUTHORITY = 'BACKEND' as const;

export interface ChatCombatBarrelMeta {
  readonly version: typeof CHAT_COMBAT_BARREL_VERSION;
  readonly authority: typeof CHAT_COMBAT_AUTHORITY;
  readonly subsystems: readonly [
    'ChatBossFightEngine',
    'ChatAttackWindowPolicy',
    'ChatTelegraphPolicy',
    'ChatCounterResolver',
  ];
}

export const CHAT_COMBAT_BARREL_META: ChatCombatBarrelMeta = Object.freeze({
  version: CHAT_COMBAT_BARREL_VERSION,
  authority: CHAT_COMBAT_AUTHORITY,
  subsystems: [
    'ChatBossFightEngine',
    'ChatAttackWindowPolicy',
    'ChatTelegraphPolicy',
    'ChatCounterResolver',
  ] as const,
});

// ============================================================================
// MARK: Combat lane type aliases
// ============================================================================

// Boss fight engine types
export type CombatBossFightOpenRequest = BossFightEngine.ChatBossFightOpenRequest;
export type CombatBossFightAdvanceRequest = BossFightEngine.ChatBossFightAdvanceRequest;
export type CombatBossFightSweepRequest = BossFightEngine.ChatBossFightSweepRequest;
export type CombatBossFightOpenResult = BossFightEngine.ChatBossFightOpenResult;
export type CombatBossFightAdvanceResult = BossFightEngine.ChatBossFightAdvanceResult;
export type CombatBossFightLedgerEnvelope = BossFightEngine.ChatBossFightLedgerEnvelope;
export type CombatBossFightEnginePolicy = BossFightEngine.ChatBossFightEnginePolicy;
export type CombatBossFightEngineClock = BossFightEngine.ChatBossFightEngineClock;
export type CombatBossFightEngineLogger = BossFightEngine.ChatBossFightEngineLogger;
export type CombatBossFightEngineOptions = BossFightEngine.ChatBossFightEngineOptions;

// Attack window policy types
export type CombatAttackWindowBudgetBreakdown = AttackWindowPolicy.ChatAttackWindowBudgetBreakdown;
export type CombatAttackWindowTimeline = AttackWindowPolicy.ChatAttackWindowTimeline;
export type CombatAttackWindowCreationRequest = AttackWindowPolicy.ChatAttackWindowCreationRequest;
export type CombatAttackWindowCreationResult = AttackWindowPolicy.ChatAttackWindowCreationResult;
export type CombatAttackWindowEvaluationRequest = AttackWindowPolicy.ChatAttackWindowEvaluationRequest;
export type CombatAttackWindowEvaluationResult = AttackWindowPolicy.ChatAttackWindowEvaluationResult;
export type CombatAttackWindowDerivedFactors = AttackWindowPolicy.ChatAttackWindowDerivedFactors;
export type CombatAttackWindowPolicyTuning = AttackWindowPolicy.ChatAttackWindowPolicyTuning;
export type CombatAttackWindowPolicyClock = AttackWindowPolicy.ChatAttackWindowPolicyClock;
export type CombatAttackWindowPolicyLogger = AttackWindowPolicy.ChatAttackWindowPolicyLogger;
export type CombatAttackWindowPolicyOptions = AttackWindowPolicy.ChatAttackWindowPolicyOptions;
export type CombatAttackWindowPolicySignatureId = AttackWindowPolicy.ChatAttackWindowPolicySignatureId;

// Telegraph policy types
export type CombatTelegraphBeat = TelegraphPolicy.ChatTelegraphBeat;
export type CombatTelegraphWitnessPlan = TelegraphPolicy.ChatTelegraphWitnessPlan;
export type CombatTelegraphOverlayPlan = TelegraphPolicy.ChatTelegraphOverlayPlan;
export type CombatTelegraphCounterHint = TelegraphPolicy.ChatTelegraphCounterHint;
export type CombatTelegraphProjection = TelegraphPolicy.ChatTelegraphProjection;
export type CombatTelegraphProjectionRequest = TelegraphPolicy.ChatTelegraphProjectionRequest;
export type CombatTelegraphPolicyTuning = TelegraphPolicy.ChatTelegraphPolicyTuning;
export type CombatTelegraphPolicyClock = TelegraphPolicy.ChatTelegraphPolicyClock;
export type CombatTelegraphPolicyLogger = TelegraphPolicy.ChatTelegraphPolicyLogger;
export type CombatTelegraphPolicyOptions = TelegraphPolicy.ChatTelegraphPolicyOptions;

// Counter resolver types
export type CombatCounterSourceContext = CounterResolver.ChatCounterSourceContext;
export type CombatCounterRuntimeContext = CounterResolver.ChatCounterRuntimeContext;
export type CombatCounterWindowSeed = CounterResolver.ChatCounterWindowSeed;
export type CombatCounterPlanRequest = CounterResolver.ChatCounterPlanRequest;
export type CombatCounterResolveRequest = CounterResolver.ChatCounterResolveRequest;
export type CombatCounterExpirationRequest = CounterResolver.ChatCounterExpirationRequest;
export type CombatCounterPlanResult = CounterResolver.ChatCounterPlanResult;
export type CombatCounterResolveResult = CounterResolver.ChatCounterResolveResult;
export type CombatCounterSuggestionTemplate = CounterResolver.ChatCounterSuggestionTemplate;
export type CombatCounterResolverPolicy = CounterResolver.ChatCounterResolverPolicy;
export type CombatCounterResolverClock = CounterResolver.ChatCounterResolverClock;
export type CombatCounterResolverLogger = CounterResolver.ChatCounterResolverLogger;
export type CombatCounterResolverOptions = CounterResolver.ChatCounterResolverOptions;

// ============================================================================
// MARK: Combat lane readiness
// ============================================================================

export interface ChatCombatLaneReadiness {
  readonly bossFightEngine: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly attackWindowPolicy: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly telegraphPolicy: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly counterResolver: 'GENERATED' | 'PENDING' | 'PLANNED';
}

export const CHAT_COMBAT_LANE_READINESS: ChatCombatLaneReadiness = Object.freeze({
  bossFightEngine: 'GENERATED',
  attackWindowPolicy: 'GENERATED',
  telegraphPolicy: 'GENERATED',
  counterResolver: 'GENERATED',
});

// ============================================================================
// MARK: Combat lane module descriptor table
// ============================================================================

export interface ChatCombatModuleDescriptor {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly category: 'FIGHT' | 'WINDOW' | 'TELEGRAPH' | 'COUNTER';
  readonly readiness: 'GENERATED' | 'PENDING' | 'PLANNED';
  readonly ownsTruth: boolean;
  readonly description: string;
  readonly primaryClass: string;
  readonly factoryFn: string;
}

export const CHAT_COMBAT_MODULE_DESCRIPTORS: readonly ChatCombatModuleDescriptor[] = Object.freeze([
  {
    id: 'boss-fight-engine',
    name: 'ChatBossFightEngine',
    file: 'combat/ChatBossFightEngine.ts',
    category: 'FIGHT',
    readiness: 'GENERATED',
    ownsTruth: true,
    description: 'Orchestrates full conversational boss fight lifecycle: open, advance, sweep, resolve.',
    primaryClass: 'ChatBossFightEngine',
    factoryFn: 'createChatBossFightEngine',
  },
  {
    id: 'attack-window-policy',
    name: 'ChatAttackWindowPolicy',
    file: 'combat/ChatAttackWindowPolicy.ts',
    category: 'WINDOW',
    readiness: 'GENERATED',
    ownsTruth: true,
    description: 'Attack window timing law: duration, ideal target, grace, extension, hard close.',
    primaryClass: 'ChatAttackWindowPolicy',
    factoryFn: 'createChatAttackWindowPolicy',
  },
  {
    id: 'telegraph-policy',
    name: 'ChatTelegraphPolicy',
    file: 'combat/ChatTelegraphPolicy.ts',
    category: 'TELEGRAPH',
    readiness: 'GENERATED',
    ownsTruth: true,
    description: 'Governs attack announcement with legible beat-by-beat lead-in, reveal timing, and overlay plans.',
    primaryClass: 'ChatTelegraphPolicy',
    factoryFn: 'createChatTelegraphPolicy',
  },
  {
    id: 'counter-resolver',
    name: 'ChatCounterResolver',
    file: 'combat/ChatCounterResolver.ts',
    category: 'COUNTER',
    readiness: 'GENERATED',
    ownsTruth: true,
    description: 'Translates attacks into authoritative counter windows, candidates, and resolutions.',
    primaryClass: 'ChatCounterResolver',
    factoryFn: 'createChatCounterResolver',
  },
]);

export function combatModuleDescriptorById(id: string): ChatCombatModuleDescriptor | undefined {
  return CHAT_COMBAT_MODULE_DESCRIPTORS.find((m) => m.id === id);
}

export function combatModuleDescriptorsByCategory(
  category: ChatCombatModuleDescriptor['category'],
): readonly ChatCombatModuleDescriptor[] {
  return CHAT_COMBAT_MODULE_DESCRIPTORS.filter((m) => m.category === category);
}

// ============================================================================
// MARK: Combat fight phase registry
// ============================================================================

export const COMBAT_FIGHT_PHASES = Object.freeze([
  'OPENING',
  'TELEGRAPH',
  'WINDOW_OPEN',
  'WINDOW_ACTIVE',
  'COUNTER_EVALUATED',
  'ROUND_RESOLVED',
  'ESCALATION',
  'BOSS_ADVANTAGE',
  'PLAYER_ADVANTAGE',
  'DRAW',
  'FIGHT_CLOSED',
] as const);

export type CombatFightPhase = (typeof COMBAT_FIGHT_PHASES)[number];

export function combatFightPhaseIsActive(phase: CombatFightPhase): boolean {
  return (
    phase === 'WINDOW_OPEN' ||
    phase === 'WINDOW_ACTIVE' ||
    phase === 'TELEGRAPH'
  );
}

export function combatFightPhaseIsResolved(phase: CombatFightPhase): boolean {
  return (
    phase === 'ROUND_RESOLVED' ||
    phase === 'FIGHT_CLOSED' ||
    phase === 'BOSS_ADVANTAGE' ||
    phase === 'PLAYER_ADVANTAGE' ||
    phase === 'DRAW'
  );
}

export function combatFightPhaseIsEscalated(phase: CombatFightPhase): boolean {
  return phase === 'ESCALATION' || phase === 'BOSS_ADVANTAGE';
}

// ============================================================================
// MARK: Combat window timing tier registry
// ============================================================================

export const COMBAT_WINDOW_TIMING_TIERS = Object.freeze([
  'INSTANT',    // < 500ms
  'FAST',       // 500–1500ms
  'NORMAL',     // 1500–3500ms
  'EXTENDED',   // 3500–7000ms
  'MARATHON',   // > 7000ms
] as const);

export type CombatWindowTimingTier = (typeof COMBAT_WINDOW_TIMING_TIERS)[number];

export function combatWindowTimingTierFrom(durationMs: number): CombatWindowTimingTier {
  if (durationMs < 500) return 'INSTANT';
  if (durationMs < 1500) return 'FAST';
  if (durationMs < 3500) return 'NORMAL';
  if (durationMs < 7000) return 'EXTENDED';
  return 'MARATHON';
}

export function combatWindowTimingTierScore(tier: CombatWindowTimingTier): number {
  switch (tier) {
    case 'INSTANT': return 1.0;
    case 'FAST': return 0.85;
    case 'NORMAL': return 0.7;
    case 'EXTENDED': return 0.5;
    case 'MARATHON': return 0.3;
    default: return 0.5;
  }
}

export function combatWindowTimingTierIsCompetitive(tier: CombatWindowTimingTier): boolean {
  return tier === 'INSTANT' || tier === 'FAST';
}

// ============================================================================
// MARK: Combat telegraph pressure band registry
// ============================================================================

export const COMBAT_TELEGRAPH_PRESSURE_BANDS = Object.freeze([
  'SILENT',       // No telegraph — surprise attack
  'WHISPER',      // Minimal tell, low pressure
  'READABLE',     // Clear but not alarming
  'OMINOUS',      // High visual weight, building dread
  'OVERWHELMING', // Maximum theater, crowd activated
] as const);

export type CombatTelegraphPressureBand = (typeof COMBAT_TELEGRAPH_PRESSURE_BANDS)[number];

export function combatTelegraphPressureBandFrom01(pressure01: number): CombatTelegraphPressureBand {
  if (pressure01 >= 0.9) return 'OVERWHELMING';
  if (pressure01 >= 0.72) return 'OMINOUS';
  if (pressure01 >= 0.5) return 'READABLE';
  if (pressure01 >= 0.25) return 'WHISPER';
  return 'SILENT';
}

export function combatTelegraphPressureBandWeight(band: CombatTelegraphPressureBand): number {
  switch (band) {
    case 'OVERWHELMING': return 1.0;
    case 'OMINOUS': return 0.85;
    case 'READABLE': return 0.65;
    case 'WHISPER': return 0.35;
    case 'SILENT': return 0.0;
    default: return 0.5;
  }
}

export function combatTelegraphPressureBandRequiresCrowdActivation(
  band: CombatTelegraphPressureBand,
): boolean {
  return band === 'OVERWHELMING';
}

// ============================================================================
// MARK: Combat counter efficacy tier registry
// ============================================================================

export const COMBAT_COUNTER_EFFICACY_TIERS = Object.freeze([
  'MISS',
  'PARTIAL',
  'SOLID',
  'PERFECT',
  'LEGEND',
] as const);

export type CombatCounterEfficacyTier = (typeof COMBAT_COUNTER_EFFICACY_TIERS)[number];

export function combatCounterEfficacyTierFrom01(efficacy01: number): CombatCounterEfficacyTier {
  if (efficacy01 >= 0.95) return 'LEGEND';
  if (efficacy01 >= 0.78) return 'PERFECT';
  if (efficacy01 >= 0.55) return 'SOLID';
  if (efficacy01 >= 0.3) return 'PARTIAL';
  return 'MISS';
}

export function combatCounterEfficacyTierIsSuccess(tier: CombatCounterEfficacyTier): boolean {
  return tier === 'SOLID' || tier === 'PERFECT' || tier === 'LEGEND';
}

export function combatCounterEfficacyTierScore(tier: CombatCounterEfficacyTier): number {
  switch (tier) {
    case 'LEGEND': return 1.0;
    case 'PERFECT': return 0.88;
    case 'SOLID': return 0.68;
    case 'PARTIAL': return 0.4;
    case 'MISS': return 0.1;
    default: return 0.1;
  }
}

export function combatCounterEfficacyTierGrantsLegend(tier: CombatCounterEfficacyTier): boolean {
  return tier === 'LEGEND';
}

// ============================================================================
// MARK: Combat fight run state
// ============================================================================

export interface CombatFightRunState {
  readonly fightId: string;
  readonly phase: CombatFightPhase;
  readonly roundIndex: number;
  readonly windowTimingTier: CombatWindowTimingTier;
  readonly telegraphBand: CombatTelegraphPressureBand;
  readonly lastCounterEfficacyTier: CombatCounterEfficacyTier | null;
  readonly bossAdvantage: number;
  readonly playerAdvantage: number;
  readonly rescueActive: boolean;
  readonly helperActive: boolean;
  readonly witnessDensity: number;
  readonly crowdActivated: boolean;
  readonly capturedAtMs: number;
}

export function buildCombatFightRunStateShell(fightId: string, nowMs: number): CombatFightRunState {
  return Object.freeze({
    fightId,
    phase: 'OPENING',
    roundIndex: 0,
    windowTimingTier: 'NORMAL',
    telegraphBand: 'READABLE',
    lastCounterEfficacyTier: null,
    bossAdvantage: 0,
    playerAdvantage: 0,
    rescueActive: false,
    helperActive: false,
    witnessDensity: 0,
    crowdActivated: false,
    capturedAtMs: nowMs,
  });
}

export function combatRunStateFightIsActive(state: CombatFightRunState): boolean {
  return combatFightPhaseIsActive(state.phase);
}

export function combatRunStateFightIsResolved(state: CombatFightRunState): boolean {
  return combatFightPhaseIsResolved(state.phase);
}

export function combatRunStatePlayerIsWinning(state: CombatFightRunState): boolean {
  return state.playerAdvantage > state.bossAdvantage;
}

export function describeCombatRunState(state: CombatFightRunState): string {
  return (
    `[fight:${state.fightId}] phase=${state.phase} round=${state.roundIndex} ` +
    `boss=${state.bossAdvantage.toFixed(2)} player=${state.playerAdvantage.toFixed(2)} ` +
    `timing=${state.windowTimingTier} telegraph=${state.telegraphBand}`
  );
}

// ============================================================================
// MARK: Combat fight analytics helpers
// ============================================================================

export interface CombatFightAnalytics {
  readonly totalRounds: number;
  readonly playerWinRounds: number;
  readonly bossWinRounds: number;
  readonly drawRounds: number;
  readonly legendCounters: number;
  readonly rescueUsed: boolean;
  readonly helperUsed: boolean;
  readonly averageWindowTimingMs: number;
  readonly peakTelegraphPressure: number;
  readonly witnessDensityPeak: number;
}

export function buildCombatFightAnalyticsShell(): CombatFightAnalytics {
  return Object.freeze({
    totalRounds: 0,
    playerWinRounds: 0,
    bossWinRounds: 0,
    drawRounds: 0,
    legendCounters: 0,
    rescueUsed: false,
    helperUsed: false,
    averageWindowTimingMs: 0,
    peakTelegraphPressure: 0,
    witnessDensityPeak: 0,
  });
}

export function combatFightAnalyticsPlayerWinRate(analytics: CombatFightAnalytics): number {
  if (analytics.totalRounds === 0) return 0;
  return analytics.playerWinRounds / analytics.totalRounds;
}

export function combatFightAnalyticsHasLegendMoment(analytics: CombatFightAnalytics): boolean {
  return analytics.legendCounters > 0;
}

export function describeCombatFightAnalytics(analytics: CombatFightAnalytics): string {
  const rate = combatFightAnalyticsPlayerWinRate(analytics);
  return (
    `rounds=${analytics.totalRounds} win_rate=${rate.toFixed(2)} ` +
    `legends=${analytics.legendCounters} rescue=${analytics.rescueUsed}`
  );
}

// ============================================================================
// MARK: Combat window pressure projector
// ============================================================================

export interface CombatWindowPressureProjection {
  readonly windowDurationMs: number;
  readonly timingTier: CombatWindowTimingTier;
  readonly telegraphBand: CombatTelegraphPressureBand;
  readonly estimatedSuccessProbability: number;
  readonly crowdActivationLikely: boolean;
  readonly graceAllowed: boolean;
  readonly extensionAllowed: boolean;
}

export function projectCombatWindowPressure(
  windowDurationMs: number,
  attackPressure01: number,
  witnessDensity01: number,
): CombatWindowPressureProjection {
  const timingTier = combatWindowTimingTierFrom(windowDurationMs);
  const telegraphBand = combatTelegraphPressureBandFrom01(attackPressure01);
  const timingScore = combatWindowTimingTierScore(timingTier);

  const estimatedSuccessProbability = Math.max(
    0.05,
    timingScore * 0.6 + (1 - attackPressure01) * 0.4,
  );

  return Object.freeze({
    windowDurationMs,
    timingTier,
    telegraphBand,
    estimatedSuccessProbability,
    crowdActivationLikely:
      witnessDensity01 >= 0.6 &&
      combatTelegraphPressureBandRequiresCrowdActivation(telegraphBand),
    graceAllowed: attackPressure01 < 0.85,
    extensionAllowed: attackPressure01 < 0.7,
  });
}

export function combatWindowProjectionFavorsBoss(proj: CombatWindowPressureProjection): boolean {
  return proj.estimatedSuccessProbability < 0.35;
}

export function combatWindowProjectionFavorsPlayer(proj: CombatWindowPressureProjection): boolean {
  return proj.estimatedSuccessProbability > 0.65;
}

// ============================================================================
// MARK: Combat lane doctrine
// ============================================================================

export const CHAT_COMBAT_DOCTRINE = Object.freeze({
  version: CHAT_COMBAT_BARREL_VERSION,
  rules: Object.freeze([
    'A boss fight is not flavor. It is a structured, stateful, replayable engagement.',
    'Telegraphs make attacks legible without flattening psychological tension.',
    'Counter windows are gameplay, not decoration. Timing is a first-class variable.',
    'Silence inside a fight is as intentional as silence outside one.',
    'Public witness, embarrassment exposure, and quote leverage are battle variables.',
    'Helper-assisted counters must stay visible in the ledger.',
    "Rescue saves the run, not the player's record. Accountability remains.",
    'Every opened fight must be replayable from the returned ledger.',
    'Backend owns authority; frontend may preview but not finalize outcomes.',
    'No transcript mutation, no socket fanout, no frontend rendering decisions here.',
  ] as const),
  subsystemWeights: Object.freeze({
    FIGHT: 0.38,
    WINDOW: 0.26,
    TELEGRAPH: 0.20,
    COUNTER: 0.16,
  }),
} as const);

// ============================================================================
// MARK: Combat lane coverage report
// ============================================================================

export interface ChatCombatCoverageReport {
  readonly totalModules: number;
  readonly generatedModules: number;
  readonly fightPhasesSupported: number;
  readonly windowTimingTiersSupported: number;
  readonly telegraphPressureBandsSupported: number;
  readonly counterEfficacyTiersSupported: number;
}

export function buildCombatCoverageReport(): ChatCombatCoverageReport {
  return Object.freeze({
    totalModules: CHAT_COMBAT_MODULE_DESCRIPTORS.length,
    generatedModules: CHAT_COMBAT_MODULE_DESCRIPTORS.filter((d) => d.readiness === 'GENERATED').length,
    fightPhasesSupported: COMBAT_FIGHT_PHASES.length,
    windowTimingTiersSupported: COMBAT_WINDOW_TIMING_TIERS.length,
    telegraphPressureBandsSupported: COMBAT_TELEGRAPH_PRESSURE_BANDS.length,
    counterEfficacyTiersSupported: COMBAT_COUNTER_EFFICACY_TIERS.length,
  });
}

// ============================================================================
// MARK: Combat lane health monitor
// ============================================================================

export type CombatLaneHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';

export interface CombatLaneHealth {
  readonly status: CombatLaneHealthStatus;
  readonly fightIsActive: boolean;
  readonly windowIsOpen: boolean;
  readonly telegraphInProgress: boolean;
  readonly bossLeading: boolean;
  readonly issues: readonly string[];
  readonly capturedAtMs: number;
}

export function buildCombatLaneHealth(
  state: CombatFightRunState,
): CombatLaneHealth {
  const issues: string[] = [];

  const fightIsActive = combatRunStateFightIsActive(state);
  const windowIsOpen = state.phase === 'WINDOW_OPEN' || state.phase === 'WINDOW_ACTIVE';
  const telegraphInProgress = state.phase === 'TELEGRAPH';
  const bossLeading = state.bossAdvantage > state.playerAdvantage;

  if (bossLeading && state.roundIndex > 2) issues.push(`boss leading after round ${state.roundIndex}`);
  if (state.witnessDensity > 0.85) issues.push('witness density critical');
  if (combatFightPhaseIsEscalated(state.phase)) issues.push(`phase=${state.phase} is escalated`);

  const status: CombatLaneHealthStatus =
    issues.length === 0 ? 'HEALTHY' : issues.length === 1 ? 'DEGRADED' : 'CRITICAL';

  return Object.freeze({
    status,
    fightIsActive,
    windowIsOpen,
    telegraphInProgress,
    bossLeading,
    issues: Object.freeze(issues),
    capturedAtMs: state.capturedAtMs,
  });
}

export function combatLaneIsHealthy(health: CombatLaneHealth): boolean {
  return health.status === 'HEALTHY';
}

export function describeCombatLaneHealth(health: CombatLaneHealth): string {
  return `[combat-health:${health.status}] active=${health.fightIsActive} boss_leading=${health.bossLeading} issues=${health.issues.length}`;
}

// ============================================================================
// MARK: Combat lane audit entry
// ============================================================================

export interface CombatLaneAuditEntry {
  readonly subsystem: 'BossFightEngine' | 'AttackWindowPolicy' | 'TelegraphPolicy' | 'CounterResolver';
  readonly eventKind: string;
  readonly fightId: string;
  readonly roundIndex: number;
  readonly summary: string;
  readonly pressure01: number;
  readonly timestampMs: number;
}

export function buildBossFightAuditEntry(
  fightId: string,
  roundIndex: number,
  eventKind: string,
  pressure01: number,
  summary: string,
  nowMs: number,
): CombatLaneAuditEntry {
  return Object.freeze({
    subsystem: 'BossFightEngine' as const,
    eventKind,
    fightId,
    roundIndex,
    summary,
    pressure01,
    timestampMs: nowMs,
  });
}

export function buildCounterAuditEntry(
  fightId: string,
  roundIndex: number,
  efficacyTier: CombatCounterEfficacyTier,
  pressure01: number,
  nowMs: number,
): CombatLaneAuditEntry {
  return Object.freeze({
    subsystem: 'CounterResolver' as const,
    eventKind: 'COUNTER_RESOLVED',
    fightId,
    roundIndex,
    summary: `efficacy=${efficacyTier} isSuccess=${combatCounterEfficacyTierIsSuccess(efficacyTier)}`,
    pressure01,
    timestampMs: nowMs,
  });
}

export function buildTelegraphAuditEntry(
  fightId: string,
  roundIndex: number,
  telegraphBand: CombatTelegraphPressureBand,
  pressure01: number,
  nowMs: number,
): CombatLaneAuditEntry {
  return Object.freeze({
    subsystem: 'TelegraphPolicy' as const,
    eventKind: 'TELEGRAPH_PROJECTED',
    fightId,
    roundIndex,
    summary: `band=${telegraphBand} crowdRequired=${combatTelegraphPressureBandRequiresCrowdActivation(telegraphBand)}`,
    pressure01,
    timestampMs: nowMs,
  });
}

// ============================================================================
// MARK: Combat lane multi-round aggregator
// ============================================================================

export interface CombatMultiRoundSummary {
  readonly roundCount: number;
  readonly playerSuccessCount: number;
  readonly legendCounterCount: number;
  readonly averagePressure01: number;
  readonly peakPressure01: number;
  readonly windowTimingDistribution: Readonly<Record<CombatWindowTimingTier, number>>;
  readonly telegraphBandDistribution: Readonly<Record<CombatTelegraphPressureBand, number>>;
}

export function buildCombatMultiRoundSummaryShell(): CombatMultiRoundSummary {
  return Object.freeze({
    roundCount: 0,
    playerSuccessCount: 0,
    legendCounterCount: 0,
    averagePressure01: 0,
    peakPressure01: 0,
    windowTimingDistribution: Object.freeze({
      INSTANT: 0, FAST: 0, NORMAL: 0, EXTENDED: 0, MARATHON: 0,
    }),
    telegraphBandDistribution: Object.freeze({
      SILENT: 0, WHISPER: 0, READABLE: 0, OMINOUS: 0, OVERWHELMING: 0,
    }),
  });
}

export function summarizeCombatRounds(
  rounds: readonly {
    pressure01: number;
    windowDurationMs: number;
    efficacyTier: CombatCounterEfficacyTier;
  }[],
): CombatMultiRoundSummary {
  if (rounds.length === 0) return buildCombatMultiRoundSummaryShell();

  const pressures = rounds.map((r) => r.pressure01);
  const avg = pressures.reduce((a, b) => a + b, 0) / pressures.length;
  const peak = Math.max(...pressures);

  const playerSuccessCount = rounds.filter((r) =>
    combatCounterEfficacyTierIsSuccess(r.efficacyTier),
  ).length;

  const legendCounterCount = rounds.filter((r) =>
    combatCounterEfficacyTierGrantsLegend(r.efficacyTier),
  ).length;

  const timingDist: Record<CombatWindowTimingTier, number> = {
    INSTANT: 0, FAST: 0, NORMAL: 0, EXTENDED: 0, MARATHON: 0,
  };
  const telegraphDist: Record<CombatTelegraphPressureBand, number> = {
    SILENT: 0, WHISPER: 0, READABLE: 0, OMINOUS: 0, OVERWHELMING: 0,
  };

  for (const r of rounds) {
    timingDist[combatWindowTimingTierFrom(r.windowDurationMs)]++;
    telegraphDist[combatTelegraphPressureBandFrom01(r.pressure01)]++;
  }

  return Object.freeze({
    roundCount: rounds.length,
    playerSuccessCount,
    legendCounterCount,
    averagePressure01: avg,
    peakPressure01: peak,
    windowTimingDistribution: Object.freeze(timingDist),
    telegraphBandDistribution: Object.freeze(telegraphDist),
  });
}

// ============================================================================
// MARK: Combat lane constants
// ============================================================================

export const COMBAT_LANE_CONSTANTS = Object.freeze({
  MAX_ROUNDS_PER_FIGHT: 10,
  MIN_WINDOW_DURATION_MS: 400,
  DEFAULT_WINDOW_DURATION_MS: 2200,
  MAX_WINDOW_DURATION_MS: 12000,
  GRACE_PERIOD_MS: 600,
  TELEGRAPH_LEAD_IN_MS: 1400,
  CROWD_ACTIVATION_WITNESS_THRESHOLD: 0.6,
  LEGEND_COUNTER_PRESSURE_THRESHOLD_01: 0.82,
  RESCUE_ELIGIBILITY_BOSS_ADVANTAGE_THRESHOLD: 0.65,
  HELPER_INTERCEPT_PRESSURE_THRESHOLD_01: 0.75,
  MINIMUM_TELEGRAPH_BEATS: 1,
  MAXIMUM_TELEGRAPH_BEATS: 5,
} as const);

// ============================================================================
// MARK: ChatCombatModule — unified frozen authority object
// ============================================================================

export const ChatCombatModule = Object.freeze({
  version: CHAT_COMBAT_BARREL_VERSION,

  // Subsystem namespaces
  BossFightEngine,
  AttackWindowPolicy,
  TelegraphPolicy,
  CounterResolver,

  // Class references
  ChatBossFightEngineClass,
  ChatAttackWindowPolicyClass,
  ChatTelegraphPolicyClass,
  ChatCounterResolverClass,

  // Factory references
  createChatBossFightEngine,
  createChatAttackWindowPolicy,
  createChatTelegraphPolicy,
  createChatCounterResolver,

  // Default policy surfaces
  DEFAULT_BOSS_FIGHT_ENGINE_POLICY,
  DEFAULT_ATTACK_WINDOW_POLICY_TUNING,
  DEFAULT_TELEGRAPH_POLICY_TUNING,
  DEFAULT_COUNTER_RESOLVER_POLICY,

  // Signature / label surfaces
  ATTACK_WINDOW_POLICY_SIGNATURES,
  TELEGRAPH_SCENE_SIGNATURES,
  TELEGRAPH_DEMAND_LABELS,
  TELEGRAPH_WINDOW_SIGNATURES,

  // Registries
  COMBAT_FIGHT_PHASES,
  COMBAT_WINDOW_TIMING_TIERS,
  COMBAT_TELEGRAPH_PRESSURE_BANDS,
  COMBAT_COUNTER_EFFICACY_TIERS,
  COMBAT_LANE_CONSTANTS,

  // Tier helpers
  combatFightPhaseIsActive,
  combatFightPhaseIsResolved,
  combatFightPhaseIsEscalated,
  combatWindowTimingTierFrom,
  combatWindowTimingTierScore,
  combatWindowTimingTierIsCompetitive,
  combatTelegraphPressureBandFrom01,
  combatTelegraphPressureBandWeight,
  combatTelegraphPressureBandRequiresCrowdActivation,
  combatCounterEfficacyTierFrom01,
  combatCounterEfficacyTierIsSuccess,
  combatCounterEfficacyTierScore,
  combatCounterEfficacyTierGrantsLegend,

  // Run state helpers
  buildCombatFightRunStateShell,
  combatRunStateFightIsActive,
  combatRunStateFightIsResolved,
  combatRunStatePlayerIsWinning,
  describeCombatRunState,

  // Analytics helpers
  buildCombatFightAnalyticsShell,
  combatFightAnalyticsPlayerWinRate,
  combatFightAnalyticsHasLegendMoment,
  describeCombatFightAnalytics,

  // Window pressure projection
  projectCombatWindowPressure,
  combatWindowProjectionFavorsBoss,
  combatWindowProjectionFavorsPlayer,

  // Health monitor
  buildCombatLaneHealth,
  combatLaneIsHealthy,
  describeCombatLaneHealth,

  // Audit builders
  buildBossFightAuditEntry,
  buildCounterAuditEntry,
  buildTelegraphAuditEntry,

  // Multi-round aggregator
  summarizeCombatRounds,
  buildCombatMultiRoundSummaryShell,

  // Coverage report
  buildCombatCoverageReport,

  // Module descriptors
  CHAT_COMBAT_MODULE_DESCRIPTORS,
  combatModuleDescriptorById,
  combatModuleDescriptorsByCategory,

  // Doctrine
  CHAT_COMBAT_DOCTRINE,

  // Readiness
  CHAT_COMBAT_LANE_READINESS,

  // Barrel meta
  meta: CHAT_COMBAT_BARREL_META,
});

// ============================================================================
// MARK: Combat lane fight scenario registry
// ============================================================================

export const COMBAT_FIGHT_SCENARIOS = Object.freeze([
  'PUBLIC_SHAMING',       // Room is watching; failure has social cost
  'PRIVATE_CONFRONTATION',// Quiet room; personal tension
  'AMBUSH',               // No telegraph; surprise attack
  'SUSTAINED_SIEGE',      // Multi-round pressure campaign
  'SYNDICATE_BACKED',     // Boss has crowd support
  'HELPER_BUFFERED',      // Helper has already entered
  'RESCUE_PENDING',       // Rescue lane is queued
  'PROOF_AVAILABLE',      // Player has receipts
  'QUOTE_ARMED',          // Player has prior quote to weaponise
  'REPUTATION_STAKE',     // Outcome changes reputation band
] as const);

export type CombatFightScenario = (typeof COMBAT_FIGHT_SCENARIOS)[number];

export function combatFightScenarioIsPublic(scenario: CombatFightScenario): boolean {
  return scenario === 'PUBLIC_SHAMING' || scenario === 'SYNDICATE_BACKED';
}

export function combatFightScenarioPlayerHasLeverage(scenario: CombatFightScenario): boolean {
  return scenario === 'PROOF_AVAILABLE' || scenario === 'QUOTE_ARMED' || scenario === 'HELPER_BUFFERED';
}

export function combatFightScenarioIsHighStakes(scenario: CombatFightScenario): boolean {
  return (
    scenario === 'PUBLIC_SHAMING' ||
    scenario === 'SUSTAINED_SIEGE' ||
    scenario === 'REPUTATION_STAKE'
  );
}

export function combatFightScenarioPressureWeight(scenario: CombatFightScenario): number {
  switch (scenario) {
    case 'SUSTAINED_SIEGE': return 0.95;
    case 'PUBLIC_SHAMING': return 0.90;
    case 'REPUTATION_STAKE': return 0.88;
    case 'SYNDICATE_BACKED': return 0.82;
    case 'AMBUSH': return 0.80;
    case 'PROOF_AVAILABLE': return 0.55;
    case 'QUOTE_ARMED': return 0.60;
    case 'HELPER_BUFFERED': return 0.45;
    case 'RESCUE_PENDING': return 0.50;
    case 'PRIVATE_CONFRONTATION': return 0.65;
    default: return 0.5;
  }
}

// ============================================================================
// MARK: Combat lane attack class descriptors
// ============================================================================

export const COMBAT_ATTACK_CLASSES = Object.freeze([
  'VERBAL_ASSAULT',     // Direct language attack
  'REPUTATION_HIT',     // Social/rep damage attempt
  'PUBLIC_EXPOSE',      // Broadcasting a failure/secret
  'QUOTE_TWIST',        // Weaponising player's own words
  'PROOF_DENIAL',       // Dismissing or burying evidence
  'CROWD_ESCALATION',   // Leveraging audience against player
  'HELPER_BAIT',        // Trying to make helpers look bad
  'SUSTAINED_PRESSURE', // Repeated low-intensity blows
  'FINISHER',           // Closing blow at end of fight
] as const);

export type CombatAttackClass = (typeof COMBAT_ATTACK_CLASSES)[number];

export function combatAttackClassRequiresProof(cls: CombatAttackClass): boolean {
  return cls === 'PROOF_DENIAL' || cls === 'QUOTE_TWIST';
}

export function combatAttackClassHasCrowdComponent(cls: CombatAttackClass): boolean {
  return cls === 'PUBLIC_EXPOSE' || cls === 'CROWD_ESCALATION';
}

export function combatAttackClassIsFinisher(cls: CombatAttackClass): boolean {
  return cls === 'FINISHER';
}

export function combatAttackClassPressukeWeight(cls: CombatAttackClass): number {
  switch (cls) {
    case 'FINISHER': return 1.0;
    case 'PUBLIC_EXPOSE': return 0.92;
    case 'CROWD_ESCALATION': return 0.88;
    case 'REPUTATION_HIT': return 0.85;
    case 'QUOTE_TWIST': return 0.80;
    case 'PROOF_DENIAL': return 0.78;
    case 'VERBAL_ASSAULT': return 0.72;
    case 'SUSTAINED_PRESSURE': return 0.65;
    case 'HELPER_BAIT': return 0.60;
    default: return 0.5;
  }
}

// ============================================================================
// MARK: Combat lane counter move descriptors
// ============================================================================

export const COMBAT_COUNTER_MOVE_CLASSES = Object.freeze([
  'VERBAL_PARRY',       // Direct linguistic counter
  'PROOF_REVEAL',       // Presenting receipts
  'QUOTE_REDIRECT',     // Turning the attack words back
  'CROWD_APPEAL',       // Winning audience trust
  'SILENT_HOLD',        // Non-response as power move
  'HELPER_INVOKE',      // Calling in helper support
  'NEGOTIATION_EXIT',   // Repositioning through deal offer
  'EMOTIONAL_RESET',    // Changing emotional register
  'LEGEND_COUNTER',     // Perfect response that changes the narrative
] as const);

export type CombatCounterMoveClass = (typeof COMBAT_COUNTER_MOVE_CLASSES)[number];

export function combatCounterMoveClassRequiresEvidence(cls: CombatCounterMoveClass): boolean {
  return cls === 'PROOF_REVEAL' || cls === 'QUOTE_REDIRECT';
}

export function combatCounterMoveClassRequiresHelper(cls: CombatCounterMoveClass): boolean {
  return cls === 'HELPER_INVOKE';
}

export function combatCounterMoveClassCanBecomeLegend(cls: CombatCounterMoveClass): boolean {
  return cls === 'LEGEND_COUNTER' || cls === 'PROOF_REVEAL' || cls === 'QUOTE_REDIRECT';
}

export function combatCounterMoveClassBaseEfficacy(cls: CombatCounterMoveClass): number {
  switch (cls) {
    case 'LEGEND_COUNTER': return 0.95;
    case 'PROOF_REVEAL': return 0.82;
    case 'QUOTE_REDIRECT': return 0.80;
    case 'CROWD_APPEAL': return 0.72;
    case 'VERBAL_PARRY': return 0.65;
    case 'SILENT_HOLD': return 0.60;
    case 'HELPER_INVOKE': return 0.58;
    case 'NEGOTIATION_EXIT': return 0.52;
    case 'EMOTIONAL_RESET': return 0.48;
    default: return 0.5;
  }
}

// ============================================================================
// MARK: Combat round record
// ============================================================================

export interface CombatRoundRecord {
  readonly roundIndex: number;
  readonly attackClass: CombatAttackClass;
  readonly counterMoveClass: CombatCounterMoveClass | null;
  readonly efficacyTier: CombatCounterEfficacyTier;
  readonly windowDurationMs: number;
  readonly attackPressure01: number;
  readonly witnessDensity01: number;
  readonly helperPresent: boolean;
  readonly rescueUsed: boolean;
  readonly legendGranted: boolean;
  readonly timestampMs: number;
}

export function buildCombatRoundRecord(
  roundIndex: number,
  attackClass: CombatAttackClass,
  counterMoveClass: CombatCounterMoveClass | null,
  attackPressure01: number,
  windowDurationMs: number,
  witnessDensity01: number,
  helperPresent: boolean,
  rescueUsed: boolean,
  nowMs: number,
): CombatRoundRecord {
  const baseEfficacy = counterMoveClass
    ? combatCounterMoveClassBaseEfficacy(counterMoveClass)
    : 0.1;
  const adjustedEfficacy = Math.min(1, baseEfficacy * (1 - attackPressure01 * 0.3));
  const efficacyTier = combatCounterEfficacyTierFrom01(adjustedEfficacy);

  return Object.freeze({
    roundIndex,
    attackClass,
    counterMoveClass,
    efficacyTier,
    windowDurationMs,
    attackPressure01,
    witnessDensity01,
    helperPresent,
    rescueUsed,
    legendGranted: combatCounterEfficacyTierGrantsLegend(efficacyTier),
    timestampMs: nowMs,
  });
}

export function combatRoundRecordPlayerSucceeded(record: CombatRoundRecord): boolean {
  return combatCounterEfficacyTierIsSuccess(record.efficacyTier);
}

export function describeRoundRecord(record: CombatRoundRecord): string {
  return (
    `[round:${record.roundIndex}] attack=${record.attackClass} ` +
    `counter=${record.counterMoveClass ?? 'NONE'} ` +
    `efficacy=${record.efficacyTier} legend=${record.legendGranted}`
  );
}

// ============================================================================
// MARK: Combat fight history
// ============================================================================

export interface CombatFightHistory {
  readonly fightId: string;
  readonly scenario: CombatFightScenario;
  readonly rounds: readonly CombatRoundRecord[];
  readonly openedAtMs: number;
  readonly closedAtMs: number | null;
  readonly playerWon: boolean | null;
  readonly legendMoments: number;
  readonly rescueUsed: boolean;
  readonly helperUsed: boolean;
  readonly peakPressure01: number;
}

export function buildCombatFightHistoryShell(
  fightId: string,
  scenario: CombatFightScenario,
  nowMs: number,
): CombatFightHistory {
  return Object.freeze({
    fightId,
    scenario,
    rounds: [],
    openedAtMs: nowMs,
    closedAtMs: null,
    playerWon: null,
    legendMoments: 0,
    rescueUsed: false,
    helperUsed: false,
    peakPressure01: 0,
  });
}

export function combatFightHistoryIsClosed(history: CombatFightHistory): boolean {
  return history.closedAtMs !== null;
}

export function combatFightHistoryDurationMs(history: CombatFightHistory): number {
  if (history.closedAtMs === null) return 0;
  return history.closedAtMs - history.openedAtMs;
}

export function combatFightHistoryPlayerWinRate(history: CombatFightHistory): number {
  const successRounds = history.rounds.filter(combatRoundRecordPlayerSucceeded);
  return history.rounds.length > 0 ? successRounds.length / history.rounds.length : 0;
}

export function describeCombatFightHistory(history: CombatFightHistory): string {
  const rate = combatFightHistoryPlayerWinRate(history).toFixed(2);
  const duration = (combatFightHistoryDurationMs(history) / 1000).toFixed(1);
  return (
    `[fight:${history.fightId}] scenario=${history.scenario} ` +
    `rounds=${history.rounds.length} win_rate=${rate} ` +
    `legends=${history.legendMoments} duration=${duration}s`
  );
}

// ============================================================================
// MARK: Combat lane multi-fight session aggregator
// ============================================================================

export interface CombatSessionSummary {
  readonly totalFights: number;
  readonly playerWonFights: number;
  readonly totalLegendMoments: number;
  readonly rescueFightsCount: number;
  readonly helperAssistedFights: number;
  readonly averageFightDurationMs: number;
  readonly peakPressure01: number;
  readonly scenarioDistribution: Readonly<Partial<Record<CombatFightScenario, number>>>;
}

export function buildCombatSessionSummaryFromHistory(
  histories: readonly CombatFightHistory[],
): CombatSessionSummary {
  if (histories.length === 0) {
    return Object.freeze({
      totalFights: 0,
      playerWonFights: 0,
      totalLegendMoments: 0,
      rescueFightsCount: 0,
      helperAssistedFights: 0,
      averageFightDurationMs: 0,
      peakPressure01: 0,
      scenarioDistribution: {},
    });
  }

  const closed = histories.filter(combatFightHistoryIsClosed);
  const avgDuration = closed.length > 0
    ? closed.reduce((s, h) => s + combatFightHistoryDurationMs(h), 0) / closed.length
    : 0;

  const scenarioDist: Partial<Record<CombatFightScenario, number>> = {};
  for (const h of histories) {
    scenarioDist[h.scenario] = (scenarioDist[h.scenario] ?? 0) + 1;
  }

  return Object.freeze({
    totalFights: histories.length,
    playerWonFights: histories.filter((h) => h.playerWon === true).length,
    totalLegendMoments: histories.reduce((s, h) => s + h.legendMoments, 0),
    rescueFightsCount: histories.filter((h) => h.rescueUsed).length,
    helperAssistedFights: histories.filter((h) => h.helperUsed).length,
    averageFightDurationMs: avgDuration,
    peakPressure01: Math.max(...histories.map((h) => h.peakPressure01)),
    scenarioDistribution: Object.freeze(scenarioDist),
  });
}

export function combatSessionPlayerWinRate(summary: CombatSessionSummary): number {
  if (summary.totalFights === 0) return 0;
  return summary.playerWonFights / summary.totalFights;
}

export function describeCombatSessionSummary(summary: CombatSessionSummary): string {
  const rate = combatSessionPlayerWinRate(summary).toFixed(2);
  return (
    `[combat-session] fights=${summary.totalFights} win_rate=${rate} ` +
    `legends=${summary.totalLegendMoments} rescue=${summary.rescueFightsCount}`
  );
}

// ============================================================================
// MARK: Combat fight resolution advisor
// ============================================================================

export type CombatResolutionAdvice =
  | 'PROCEED'
  | 'CALL_RESCUE'
  | 'INVOKE_HELPER'
  | 'HOLD_SILENCE'
  | 'ESCALATE'
  | 'CLOSE_FIGHT';

export function adviseCombatResolution(
  state: CombatFightRunState,
  health: CombatLaneHealth,
): CombatResolutionAdvice {
  if (combatFightPhaseIsResolved(state.phase)) return 'CLOSE_FIGHT';
  if (!health.fightIsActive) return 'CLOSE_FIGHT';

  if (state.bossAdvantage >= COMBAT_LANE_CONSTANTS.RESCUE_ELIGIBILITY_BOSS_ADVANTAGE_THRESHOLD) {
    return 'CALL_RESCUE';
  }
  if (
    state.phase === 'WINDOW_OPEN' &&
    state.telegraphBand === 'OVERWHELMING' &&
    !state.helperActive
  ) {
    return 'INVOKE_HELPER';
  }
  if (state.witnessDensity >= COMBAT_LANE_CONSTANTS.CROWD_ACTIVATION_WITNESS_THRESHOLD) {
    return 'ESCALATE';
  }
  if (state.phase === 'TELEGRAPH' && state.telegraphBand === 'OMINOUS') {
    return 'HOLD_SILENCE';
  }
  return 'PROCEED';
}

export function combatResolutionAdviceIsUrgent(advice: CombatResolutionAdvice): boolean {
  return advice === 'CALL_RESCUE' || advice === 'ESCALATE';
}

export function combatResolutionAdviceRequiresHelper(advice: CombatResolutionAdvice): boolean {
  return advice === 'INVOKE_HELPER';
}

// ============================================================================
// MARK: Combat lane version + exports table
// ============================================================================

export const COMBAT_LANE_VERSION = CHAT_COMBAT_BARREL_VERSION;

export const COMBAT_LANE_EXPORTS = Object.freeze({
  ChatCombatModule: 'frozen authority object with all subsystem namespaces',
  BossFightEngine: 'namespace: ChatBossFightEngine subsystem',
  AttackWindowPolicy: 'namespace: ChatAttackWindowPolicy subsystem',
  TelegraphPolicy: 'namespace: ChatTelegraphPolicy subsystem',
  CounterResolver: 'namespace: ChatCounterResolver subsystem',
  ChatBossFightEngineClass: 'class reference for boss fight engine',
  ChatAttackWindowPolicyClass: 'class reference for attack window policy',
  ChatTelegraphPolicyClass: 'class reference for telegraph policy',
  ChatCounterResolverClass: 'class reference for counter resolver',
  createChatBossFightEngine: 'factory: create ChatBossFightEngine',
  createChatAttackWindowPolicy: 'factory: create ChatAttackWindowPolicy',
  createChatTelegraphPolicy: 'factory: create ChatTelegraphPolicy',
  createChatCounterResolver: 'factory: create ChatCounterResolver',
  COMBAT_FIGHT_PHASES: 'all fight phase identifiers',
  COMBAT_WINDOW_TIMING_TIERS: 'all window timing tier identifiers',
  COMBAT_TELEGRAPH_PRESSURE_BANDS: 'all telegraph pressure band identifiers',
  COMBAT_COUNTER_EFFICACY_TIERS: 'all counter efficacy tier identifiers',
  COMBAT_FIGHT_SCENARIOS: 'all fight scenario identifiers',
  COMBAT_ATTACK_CLASSES: 'all attack class identifiers',
  COMBAT_COUNTER_MOVE_CLASSES: 'all counter move class identifiers',
  COMBAT_LANE_CONSTANTS: 'numeric constants for the combat lane',
  adviseCombatResolution: 'top-level resolution advice authority',
  buildCombatRoundRecord: 'builds an authoritative round record',
  summarizeCombatRounds: 'aggregates multiple rounds into a summary',
} as const);

// ============================================================================
// MARK: Combat lane boss pattern descriptor helpers
// ============================================================================

export const COMBAT_BOSS_PATTERN_CLASSES = Object.freeze([
  'DIRECT_ASSAULT',      // Frontal linguistic attack
  'SLOW_BURN',           // Sustained low heat until collapse
  'PUBLIC_TRIBUNAL',     // Crowd-driven shaming session
  'REFRAME_TRAP',        // Forcing player into defensive posture
  'EVIDENCE_WAR',        // Battle of proof / receipts
  'EMOTIONAL_EXTRACTION',// Baiting emotional overreaction
  'ALIBI_COLLAPSE',      // Breaking player's stated narrative
  'SYNDICATE_PRESSURE',  // Multiple actors coordinating
  'TIMING_EXPLOIT',      // Using silence and delay as weapons
] as const);

export type CombatBossPatternClass = (typeof COMBAT_BOSS_PATTERN_CLASSES)[number];

export function combatBossPatternClassPressureWeight(cls: CombatBossPatternClass): number {
  switch (cls) {
    case 'SYNDICATE_PRESSURE': return 0.98;
    case 'PUBLIC_TRIBUNAL': return 0.94;
    case 'EVIDENCE_WAR': return 0.88;
    case 'ALIBI_COLLAPSE': return 0.85;
    case 'REFRAME_TRAP': return 0.82;
    case 'SLOW_BURN': return 0.78;
    case 'EMOTIONAL_EXTRACTION': return 0.74;
    case 'TIMING_EXPLOIT': return 0.70;
    case 'DIRECT_ASSAULT': return 0.65;
    default: return 0.6;
  }
}

export function combatBossPatternClassRequiresMultipleActors(cls: CombatBossPatternClass): boolean {
  return cls === 'SYNDICATE_PRESSURE' || cls === 'PUBLIC_TRIBUNAL';
}

export function combatBossPatternClassIsSlowBuild(cls: CombatBossPatternClass): boolean {
  return cls === 'SLOW_BURN' || cls === 'TIMING_EXPLOIT';
}

export function combatBossPatternClassBestCounter(cls: CombatBossPatternClass): CombatCounterMoveClass {
  switch (cls) {
    case 'EVIDENCE_WAR': return 'PROOF_REVEAL';
    case 'ALIBI_COLLAPSE': return 'QUOTE_REDIRECT';
    case 'PUBLIC_TRIBUNAL': return 'CROWD_APPEAL';
    case 'SYNDICATE_PRESSURE': return 'HELPER_INVOKE';
    case 'EMOTIONAL_EXTRACTION': return 'SILENT_HOLD';
    case 'REFRAME_TRAP': return 'VERBAL_PARRY';
    case 'TIMING_EXPLOIT': return 'EMOTIONAL_RESET';
    case 'SLOW_BURN': return 'LEGEND_COUNTER';
    case 'DIRECT_ASSAULT': return 'VERBAL_PARRY';
    default: return 'VERBAL_PARRY';
  }
}

// ============================================================================
// MARK: Combat window grace and extension helpers
// ============================================================================

export interface CombatWindowTimingDecision {
  readonly windowDurationMs: number;
  readonly gracePeriodMs: number;
  readonly extensionAllowed: boolean;
  readonly maxExtensionMs: number;
  readonly hardCloseMs: number;
  readonly helperBufferMs: number;
  readonly rescueBufferMs: number;
}

export function buildCombatWindowTimingDecision(
  attackPressure01: number,
  witnessDensity01: number,
  helperPresent: boolean,
  rescueQueued: boolean,
): CombatWindowTimingDecision {
  const base = COMBAT_LANE_CONSTANTS.DEFAULT_WINDOW_DURATION_MS;
  const pressureScalar = 1 - attackPressure01 * 0.4;
  const windowDurationMs = Math.max(
    COMBAT_LANE_CONSTANTS.MIN_WINDOW_DURATION_MS,
    Math.round(base * pressureScalar),
  );

  const gracePeriodMs = attackPressure01 < 0.85
    ? COMBAT_LANE_CONSTANTS.GRACE_PERIOD_MS
    : 0;

  const extensionAllowed = attackPressure01 < 0.7 && witnessDensity01 < 0.75;
  const maxExtensionMs = extensionAllowed ? Math.round(windowDurationMs * 0.5) : 0;

  const helperBufferMs = helperPresent ? 800 : 0;
  const rescueBufferMs = rescueQueued ? 1200 : 0;

  const hardCloseMs = windowDurationMs + gracePeriodMs + maxExtensionMs + helperBufferMs + rescueBufferMs;

  return Object.freeze({
    windowDurationMs,
    gracePeriodMs,
    extensionAllowed,
    maxExtensionMs,
    hardCloseMs,
    helperBufferMs,
    rescueBufferMs,
  });
}

export function combatWindowTimingDecisionTotalMs(decision: CombatWindowTimingDecision): number {
  return decision.hardCloseMs;
}

export function describeCombatWindowTimingDecision(decision: CombatWindowTimingDecision): string {
  return (
    `window=${decision.windowDurationMs}ms grace=${decision.gracePeriodMs}ms ` +
    `extension=${decision.extensionAllowed}(+${decision.maxExtensionMs}ms) ` +
    `hardClose=${decision.hardCloseMs}ms`
  );
}

// ============================================================================
// MARK: Combat lane crowd interaction model
// ============================================================================

export const COMBAT_CROWD_REACTIONS = Object.freeze([
  'HUSHED',       // Crowd goes quiet, watching
  'MURMURING',    // Low-level noise, tension building
  'VOCAL',        // Clear crowd side-taking
  'ROARING',      // Loud crowd approval/disapproval
  'CHANTING',     // Crowd rallies with repeated calls
  'EXPLOSIVE',    // Maximum crowd participation
  'SILENT_JUDGE', // No sound, but intense observation
] as const);

export type CombatCrowdReaction = (typeof COMBAT_CROWD_REACTIONS)[number];

export function combatCrowdReactionFromDensityAndPressure(
  witnessDensity01: number,
  attackPressure01: number,
): CombatCrowdReaction {
  const combined = (witnessDensity01 * 0.6 + attackPressure01 * 0.4);
  if (combined >= 0.92) return 'EXPLOSIVE';
  if (combined >= 0.80) return 'CHANTING';
  if (combined >= 0.68) return 'ROARING';
  if (combined >= 0.55) return 'VOCAL';
  if (combined >= 0.40) return 'MURMURING';
  if (combined >= 0.25) return 'HUSHED';
  return 'SILENT_JUDGE';
}

export function combatCrowdReactionIntensity(reaction: CombatCrowdReaction): number {
  switch (reaction) {
    case 'EXPLOSIVE': return 1.0;
    case 'CHANTING': return 0.88;
    case 'ROARING': return 0.78;
    case 'VOCAL': return 0.65;
    case 'MURMURING': return 0.48;
    case 'HUSHED': return 0.30;
    case 'SILENT_JUDGE': return 0.15;
    default: return 0.3;
  }
}

export function combatCrowdReactionIsDisruptive(reaction: CombatCrowdReaction): boolean {
  return reaction === 'EXPLOSIVE' || reaction === 'CHANTING' || reaction === 'ROARING';
}

export function combatCrowdReactionGrantsPlayerBonus(
  reaction: CombatCrowdReaction,
  playerIsWinning: boolean,
): boolean {
  return playerIsWinning && (reaction === 'CHANTING' || reaction === 'ROARING');
}

// ============================================================================
// MARK: Combat lane fight setup builder
// ============================================================================

export interface CombatFightSetup {
  readonly fightId: string;
  readonly scenario: CombatFightScenario;
  readonly bossPatternClass: CombatBossPatternClass;
  readonly estimatedPressure01: number;
  readonly estimatedRounds: number;
  readonly crowdReaction: CombatCrowdReaction;
  readonly windowTimingDecision: CombatWindowTimingDecision;
  readonly telegraphBand: CombatTelegraphPressureBand;
  readonly helperEligible: boolean;
  readonly rescueEligible: boolean;
  readonly proofAvailable: boolean;
  readonly legendPotential: boolean;
}

export function buildCombatFightSetup(
  fightId: string,
  scenario: CombatFightScenario,
  bossPatternClass: CombatBossPatternClass,
  witnessDensity01: number,
  helperPresent: boolean,
  proofAvailable: boolean,
): CombatFightSetup {
  const estimatedPressure01 = Math.min(
    1,
    combatFightScenarioPressureWeight(scenario) * 0.5 +
      combatBossPatternClassPressureWeight(bossPatternClass) * 0.5,
  );

  const crowdReaction = combatCrowdReactionFromDensityAndPressure(
    witnessDensity01,
    estimatedPressure01,
  );

  const windowTimingDecision = buildCombatWindowTimingDecision(
    estimatedPressure01,
    witnessDensity01,
    helperPresent,
    false,
  );

  const estimatedRounds = combatBossPatternClassIsSlowBuild(bossPatternClass)
    ? Math.min(COMBAT_LANE_CONSTANTS.MAX_ROUNDS_PER_FIGHT, 6)
    : 3;

  return Object.freeze({
    fightId,
    scenario,
    bossPatternClass,
    estimatedPressure01,
    estimatedRounds,
    crowdReaction,
    windowTimingDecision,
    telegraphBand: combatTelegraphPressureBandFrom01(estimatedPressure01),
    helperEligible: helperPresent || estimatedPressure01 >= COMBAT_LANE_CONSTANTS.HELPER_INTERCEPT_PRESSURE_THRESHOLD_01,
    rescueEligible: estimatedPressure01 >= COMBAT_LANE_CONSTANTS.RESCUE_ELIGIBILITY_BOSS_ADVANTAGE_THRESHOLD,
    proofAvailable,
    legendPotential: estimatedPressure01 >= COMBAT_LANE_CONSTANTS.LEGEND_COUNTER_PRESSURE_THRESHOLD_01,
  });
}

export function combatFightSetupIsDangerous(setup: CombatFightSetup): boolean {
  return setup.estimatedPressure01 >= 0.8 && !setup.helperEligible && !setup.proofAvailable;
}

export function describeCombatFightSetup(setup: CombatFightSetup): string {
  return (
    `[setup:${setup.fightId}] scenario=${setup.scenario} pattern=${setup.bossPatternClass} ` +
    `pressure=${setup.estimatedPressure01.toFixed(2)} rounds~=${setup.estimatedRounds} ` +
    `crowd=${setup.crowdReaction} legend=${setup.legendPotential}`
  );
}

// ============================================================================
// MARK: Combat lane playback / replay surface
// ============================================================================

export interface CombatFightReplayFrame {
  readonly frameIndex: number;
  readonly roundIndex: number;
  readonly phase: CombatFightPhase;
  readonly eventKind: string;
  readonly summary: string;
  readonly pressure01: number;
  readonly bossAdvantage: number;
  readonly playerAdvantage: number;
  readonly timestampMs: number;
}

export function buildCombatReplayFrameFromRound(
  roundRecord: CombatRoundRecord,
  frameIndex: number,
  bossAdvantage: number,
  playerAdvantage: number,
): CombatFightReplayFrame {
  const phase: CombatFightPhase = combatRoundRecordPlayerSucceeded(roundRecord)
    ? 'PLAYER_ADVANTAGE'
    : 'BOSS_ADVANTAGE';

  return Object.freeze({
    frameIndex,
    roundIndex: roundRecord.roundIndex,
    phase,
    eventKind: 'ROUND_RESOLVED',
    summary: describeRoundRecord(roundRecord),
    pressure01: roundRecord.attackPressure01,
    bossAdvantage,
    playerAdvantage,
    timestampMs: roundRecord.timestampMs,
  });
}

export function buildCombatReplayFrames(
  history: CombatFightHistory,
): readonly CombatFightReplayFrame[] {
  let bossAdv = 0;
  let playerAdv = 0;
  return history.rounds.map((round, i) => {
    if (combatRoundRecordPlayerSucceeded(round)) {
      playerAdv = Math.min(1, playerAdv + 0.2);
    } else {
      bossAdv = Math.min(1, bossAdv + 0.25);
    }
    if (round.legendGranted) {
      playerAdv = Math.min(1, playerAdv + 0.15);
      bossAdv = Math.max(0, bossAdv - 0.1);
    }
    return buildCombatReplayFrameFromRound(round, i, bossAdv, playerAdv);
  });
}

export function combatReplayFramePlayerIsLeading(frame: CombatFightReplayFrame): boolean {
  return frame.playerAdvantage > frame.bossAdvantage;
}

// ============================================================================
// MARK: Combat lane authority gate
// ============================================================================

/**
 * Top-level authority gate: given current fight state, should combat output
 * be gated (hold until resolution) or permitted to flow?
 */
export function combatLaneShouldGateOutput(
  state: CombatFightRunState,
  activeSilenceWindowCount: number,
): boolean {
  if (activeSilenceWindowCount > 0) return true;
  if (state.phase === 'TELEGRAPH') return true;
  if (state.phase === 'WINDOW_OPEN') return false; // player must respond
  if (combatFightPhaseIsResolved(state.phase)) return false;
  return state.telegraphBand === 'OVERWHELMING';
}

/**
 * Returns whether the combat lane should broadcast a crowd signal.
 */
export function combatLaneShouldBroadcastCrowd(
  state: CombatFightRunState,
): boolean {
  return state.crowdActivated && combatFightPhaseIsActive(state.phase);
}

/**
 * Returns whether the combat lane should open a rescue window.
 */
export function combatLaneShouldOpenRescueWindow(
  state: CombatFightRunState,
): boolean {
  return (
    state.bossAdvantage >= COMBAT_LANE_CONSTANTS.RESCUE_ELIGIBILITY_BOSS_ADVANTAGE_THRESHOLD &&
    !state.rescueActive &&
    combatFightPhaseIsActive(state.phase)
  );
}

/**
 * Returns whether the combat lane should attempt helper intercept.
 */
export function combatLaneShouldAttemptHelperIntercept(
  state: CombatFightRunState,
): boolean {
  return (
    !state.helperActive &&
    state.witnessDensity >= COMBAT_LANE_CONSTANTS.HELPER_INTERCEPT_PRESSURE_THRESHOLD_01 &&
    combatFightPhaseIsActive(state.phase)
  );
}

// ============================================================================
// MARK: Combat lane boss archetype descriptors
// ============================================================================

export const COMBAT_BOSS_ARCHETYPES = Object.freeze([
  'TROLL',          // Disruptive, opportunistic, low-craft attacks
  'MANIPULATOR',    // Calculated gaslighting and framing
  'ENFORCER',       // Rule-citing authority figure
  'RIVAL',          // Competitive peer with genuine grievance
  'BETRAYER',       // Former ally now weaponising insider knowledge
  'MOB_LEADER',     // Coordinates crowd against the player
  'SILENT_JUDGE',   // Devastating through absence of support, not attack
  'LEGEND_HUNTER',  // Specifically targeting player's legacy/reputation
] as const);

export type CombatBossArchetype = (typeof COMBAT_BOSS_ARCHETYPES)[number];

export function combatBossArchetypeIsPublicThreat(archetype: CombatBossArchetype): boolean {
  return archetype === 'MOB_LEADER' || archetype === 'LEGEND_HUNTER' || archetype === 'ENFORCER';
}

export function combatBossArchetypeRequiresPrivateCounter(archetype: CombatBossArchetype): boolean {
  return archetype === 'SILENT_JUDGE' || archetype === 'BETRAYER';
}

export function combatBossArchetypePressureWeight(archetype: CombatBossArchetype): number {
  switch (archetype) {
    case 'LEGEND_HUNTER': return 0.97;
    case 'MOB_LEADER': return 0.93;
    case 'BETRAYER': return 0.88;
    case 'MANIPULATOR': return 0.85;
    case 'ENFORCER': return 0.80;
    case 'RIVAL': return 0.76;
    case 'SILENT_JUDGE': return 0.70;
    case 'TROLL': return 0.60;
    default: return 0.65;
  }
}

export function combatBossArchetypeBestPatternClass(
  archetype: CombatBossArchetype,
): CombatBossPatternClass {
  switch (archetype) {
    case 'LEGEND_HUNTER': return 'PUBLIC_TRIBUNAL';
    case 'MOB_LEADER': return 'SYNDICATE_PRESSURE';
    case 'BETRAYER': return 'ALIBI_COLLAPSE';
    case 'MANIPULATOR': return 'REFRAME_TRAP';
    case 'ENFORCER': return 'EVIDENCE_WAR';
    case 'RIVAL': return 'DIRECT_ASSAULT';
    case 'SILENT_JUDGE': return 'TIMING_EXPLOIT';
    case 'TROLL': return 'EMOTIONAL_EXTRACTION';
    default: return 'DIRECT_ASSAULT';
  }
}

// ============================================================================
// MARK: Combat lane fight outcome classifier
// ============================================================================

export type CombatFightOutcome =
  | 'PLAYER_VICTORY'
  | 'PLAYER_LEGEND_VICTORY'
  | 'DRAW'
  | 'BOSS_VICTORY'
  | 'RESCUED'
  | 'EXPIRED'
  | 'ABANDONED';

export function classifyCombatFightOutcome(
  history: CombatFightHistory,
): CombatFightOutcome {
  if (history.playerWon === null) return 'EXPIRED';

  if (history.rescueUsed && history.playerWon) return 'RESCUED';

  const winRate = combatFightHistoryPlayerWinRate(history);
  if (history.legendMoments > 0 && winRate >= 0.6) return 'PLAYER_LEGEND_VICTORY';
  if (winRate >= 0.5) return 'PLAYER_VICTORY';
  if (Math.abs(winRate - 0.5) < 0.1) return 'DRAW';
  return 'BOSS_VICTORY';
}

export function combatFightOutcomeIsPlayerPositive(outcome: CombatFightOutcome): boolean {
  return (
    outcome === 'PLAYER_VICTORY' ||
    outcome === 'PLAYER_LEGEND_VICTORY' ||
    outcome === 'RESCUED'
  );
}

export function combatFightOutcomeGrantsReputationBoost(outcome: CombatFightOutcome): boolean {
  return outcome === 'PLAYER_LEGEND_VICTORY';
}

export function combatFightOutcomeGrantsReputationDamage(outcome: CombatFightOutcome): boolean {
  return outcome === 'BOSS_VICTORY';
}

// ============================================================================
// MARK: Combat lane integration with experience lane
// ============================================================================

export interface CombatExperienceIntegration {
  readonly fightId: string;
  readonly pressureForExperience01: number;
  readonly suggestedBeatType: string;
  readonly silenceRecommendedMs: number;
  readonly crowdReactionForExperience: CombatCrowdReaction;
  readonly witnessEscalationRequired: boolean;
  readonly legendMomentTriggered: boolean;
}

export function buildCombatExperienceIntegration(
  state: CombatFightRunState,
  lastRound: CombatRoundRecord | null,
): CombatExperienceIntegration {
  const pressure01 = state.bossAdvantage * 0.5 + state.witnessDensity * 0.3 + (state.phase === 'WINDOW_ACTIVE' ? 0.2 : 0);
  const legendMomentTriggered = (lastRound?.legendGranted) ?? false;

  const suggestedBeatType =
    pressure01 >= 0.9 ? 'CONFRONTATION'
    : pressure01 >= 0.75 ? 'ESCALATION'
    : pressure01 >= 0.55 ? 'PRESSURE'
    : 'PROBE';

  const silenceRecommendedMs =
    state.phase === 'TELEGRAPH' ? COMBAT_LANE_CONSTANTS.TELEGRAPH_LEAD_IN_MS
    : legendMomentTriggered ? 2200
    : 0;

  return Object.freeze({
    fightId: state.fightId,
    pressureForExperience01: Math.min(1, pressure01),
    suggestedBeatType,
    silenceRecommendedMs,
    crowdReactionForExperience: combatCrowdReactionFromDensityAndPressure(
      state.witnessDensity,
      Math.min(1, pressure01),
    ),
    witnessEscalationRequired: state.witnessDensity >= 0.75 && pressure01 >= 0.65,
    legendMomentTriggered,
  });
}

export function combatExperienceIntegrationIsHighDrama(
  integration: CombatExperienceIntegration,
): boolean {
  return integration.pressureForExperience01 >= 0.75 || integration.legendMomentTriggered;
}

// ============================================================================
// MARK: Combat lane final readiness check
// ============================================================================

/**
 * Returns whether the combat lane is ready to process the next event.
 * TRUE = ready. FALSE = hold (window open, telegraph in progress, etc.)
 */
export function combatLaneIsReadyForNextEvent(
  state: CombatFightRunState,
  health: CombatLaneHealth,
): boolean {
  if (health.status === 'CRITICAL') return false;
  if (state.phase === 'TELEGRAPH') return false;
  if (state.phase === 'WINDOW_OPEN') return false;
  return true;
}

/**
 * Returns a one-line status summary for the combat lane.
 */
export function describeCombatLaneStatus(
  state: CombatFightRunState,
  health: CombatLaneHealth,
): string {
  const ready = combatLaneIsReadyForNextEvent(state, health);
  return (
    `[combat-lane] ready=${ready} ${describeCombatRunState(state)} | ${describeCombatLaneHealth(health)}`
  );
}

// ============================================================================
// MARK: Combat lane signature constants
// ============================================================================

export const COMBAT_LANE_SIGNATURE_COUNT = Object.freeze({
  attackWindowPolicySignatures: ATTACK_WINDOW_POLICY_SIGNATURES.length,
  telegraphSceneSignatures: TELEGRAPH_SCENE_SIGNATURES.length,
  telegraphWindowSignatures: TELEGRAPH_WINDOW_SIGNATURES.length,
  bossBossPatternClasses: COMBAT_BOSS_PATTERN_CLASSES.length,
  bossArchetypes: COMBAT_BOSS_ARCHETYPES.length,
  attackClasses: COMBAT_ATTACK_CLASSES.length,
  counterMoveClasses: COMBAT_COUNTER_MOVE_CLASSES.length,
  crowdReactions: COMBAT_CROWD_REACTIONS.length,
  fightScenarios: COMBAT_FIGHT_SCENARIOS.length,
  fightPhases: COMBAT_FIGHT_PHASES.length,
  windowTimingTiers: COMBAT_WINDOW_TIMING_TIERS.length,
  telegraphPressureBands: COMBAT_TELEGRAPH_PRESSURE_BANDS.length,
  counterEfficacyTiers: COMBAT_COUNTER_EFFICACY_TIERS.length,
} as const);

export const COMBAT_LANE_MODULE_COUNT = CHAT_COMBAT_MODULE_DESCRIPTORS.length;

export const COMBAT_LANE_IS_AUTHORITY = true as const;

export const COMBAT_LANE_SCOPE = 'BACKEND' as const;

// ============================================================================
// MARK: Combat lane doctrine
// ============================================================================

export const CHAT_COMBAT_EXTENDED_DOCTRINE = Object.freeze([
  'Boss archetypes determine which counter strategy is most effective.',
  'Window timing is calibrated by attack pressure — high pressure compresses windows.',
  'Grace periods exist because language combat is not binary; late-but-good counters deserve credit.',
  'Helper intercept pressure threshold exists so helpers do not trivialise every fight.',
  'Rescue preserves the run but registers in the outcome ledger — accountability never disappears.',
  'Crowd activation is earned, not automatic — density plus pressure must both clear threshold.',
  'Legend moments require both high pressure AND an excellent counter — luck alone never grants legend.',
  'Fight history is always replay-safe. Every event must be reconstructible from the ledger.',
  'Boss advantage accumulates per round, not per message — pacing matters as much as content.',
  'The combat lane owns fight state; the experience lane owns dramatic texture around fights.',
] as const);

// ============================================================================
// MARK: Combat lane final summary constant
// ============================================================================

export const COMBAT_LANE_SUMMARY = Object.freeze({
  version: CHAT_COMBAT_BARREL_VERSION,
  scope: COMBAT_LANE_SCOPE,
  isAuthority: COMBAT_LANE_IS_AUTHORITY,
  moduleCount: COMBAT_LANE_MODULE_COUNT,
  signatureCounts: COMBAT_LANE_SIGNATURE_COUNT,
  doctrine: CHAT_COMBAT_DOCTRINE,
  extendedDoctrine: CHAT_COMBAT_EXTENDED_DOCTRINE,
  constants: COMBAT_LANE_CONSTANTS,
  meta: CHAT_COMBAT_BARREL_META,
} as const);

/** Shorthand type for any combat lane audit entry. */
export type AnyCombatAuditEntry = CombatLaneAuditEntry;

/** Shorthand type for any combat fight run state. */
export type AnyCombatRunState = CombatFightRunState;

/** Shorthand type for any combat round record. */
export type AnyCombatRoundRecord = CombatRoundRecord;

/** Shorthand type for any combat fight history. */
export type AnyCombatFightHistory = CombatFightHistory;

/** Shorthand type for any combat fight setup. */
export type AnyCombatFightSetup = CombatFightSetup;

/** Shorthand type for the combat fight outcome classifier result. */
export type AnyCombatFightOutcome = CombatFightOutcome;

/** Shorthand type for a combat experience integration payload. */
export type AnyCombatExperienceIntegration = CombatExperienceIntegration;
