/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT POST-RUN BARREL INDEX
 * FILE: backend/src/game/engine/chat/postrun/index.ts
 * VERSION: 2026.03.23-postrun-index.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative public entry surface for the backend chat post-run ritual
 * subsystem. This barrel is the canonical import boundary for all consumers
 * of the post-run lane — `chat/index.ts`, server handlers, and test suites.
 *
 * Post-run ritual owns:
 * - What kind of closure rite this room receives
 * - Which turning point owns the narrative interpretation of the run
 * - How blame, directive, and foreshadow are shaped
 * - Which witness lines survive into the authoritative plan
 * - Which beats are visible, shadow, replayable, or archivable
 * - What summary/archive/ledger bundle downstream transport uses
 * - Whether the run is eligible for legend escalation, world echo, or replay
 *
 * Three subsystems compose this lane:
 *
 *   PostRunNarrativeEngine
 *   ──────────────────────
 *   Top-level authority. Composes the full post-run evaluation by wiring the
 *   turning point resolver and foreshadow planner. Produces the canonical
 *   PostRunNarrativeEvaluation containing plan, archive entry, digest, ledger
 *   entry, runtime state, and structured reasoning.
 *
 *   Engine profiles (CINEMATIC, DEBRIEF, COLD_CLOSE, GRIEF,
 *   SOVEREIGN_CEREMONY, LEGEND_CEREMONY, RAPID) tune delays, witness
 *   composition, beat selection, and emotional stances.
 *
 *   TurningPointResolver
 *   ─────────────────────
 *   Ranks and selects the canonical turning point from a set of candidates.
 *   Weight profiles (DEFAULT, NARRATIVE, COMBAT, EMOTIONAL, SOCIAL, ECONOMIC,
 *   LEGEND) tune the scoring surface. Supports diagnostics, audit, diff,
 *   stats, serialization, and batch resolution.
 *
 *   ForeshadowPlanner
 *   ──────────────────
 *   Plans foreshadow seeds and next-run directives from post-run evidence,
 *   blame vectors, and moments. Profiles (BALANCED, CONSERVATIVE, AGGRESSIVE,
 *   LEGEND_ORIENTED, WORLD_ECHO_PRIORITY, SHADOW_ONLY) tune foreshadow
 *   density and kind priority. Produces witness seeds for the narrative engine.
 *
 * Module objects
 * ──────────────
 * - ChatPostRunNarrativeEngineModule  — engine bundle (re-exported from engine file)
 * - ChatTurningPointResolverModule    — resolver bundle (re-exported from resolver file)
 * - ChatForeshadowPlannerModule       — planner bundle (re-exported from planner file)
 * - ChatPostRunModule                 — combined bundle (defined in this barrel)
 * ============================================================================
 */

// ============================================================================
// MARK: Full passthrough re-exports
// ============================================================================

export * from './PostRunNarrativeEngine';
export * from './TurningPointResolver';
export * from './ForeshadowPlanner';

// ============================================================================
// MARK: Namespace imports for combined module bundle
// ============================================================================

import * as NarrativeEngineNS from './PostRunNarrativeEngine';
import * as TurningPointResolverNS from './TurningPointResolver';
import * as ForeshadowPlannerNS from './ForeshadowPlanner';

// ============================================================================
// MARK: Combined barrel module object
// ============================================================================

/**
 * Combined namespace object exposing all three post-run subsystems
 * under a single import handle:
 *
 *   import { ChatPostRunModule } from './postrun';
 *   ChatPostRunModule.engine.create();
 *   ChatPostRunModule.turningPoint.createNarrative();
 *   ChatPostRunModule.foreshadow.createAggressive();
 */
export const ChatPostRunModule = Object.freeze({
  engine: NarrativeEngineNS.ChatPostRunNarrativeEngineModule,
  turningPoint: TurningPointResolverNS.ChatTurningPointResolverModule,
  foreshadow: ForeshadowPlannerNS.ChatForeshadowPlannerModule,
} as const);

// ============================================================================
// MARK: Barrel-level type aliases
// ============================================================================

export type PostRunEngine = typeof NarrativeEngineNS.ChatPostRunNarrativeEngineModule;
export type PostRunTurningPointResolver = typeof TurningPointResolverNS.ChatTurningPointResolverModule;
export type PostRunForeshadowPlanner = typeof ForeshadowPlannerNS.ChatForeshadowPlannerModule;

// ============================================================================
// MARK: Barrel-level diagnostics
// ============================================================================

export const CHAT_POSTRUN_BARREL_VERSION = '2026.03.14' as const;
export const CHAT_POSTRUN_BARREL_ID = 'chat_postrun_barrel' as const;

export const CHAT_POSTRUN_SUBSYSTEM_IDS = Object.freeze([
  'post_run_narrative_engine',
  'turning_point_resolver',
  'foreshadow_planner',
] as const);

export type ChatPostRunSubsystemId = (typeof CHAT_POSTRUN_SUBSYSTEM_IDS)[number];

export const CHAT_POSTRUN_BARREL_DESCRIPTOR = Object.freeze({
  barrelId: CHAT_POSTRUN_BARREL_ID,
  version: CHAT_POSTRUN_BARREL_VERSION,
  subsystems: CHAT_POSTRUN_SUBSYSTEM_IDS,
  subsystemCount: CHAT_POSTRUN_SUBSYSTEM_IDS.length,
  capabilities: Object.freeze([
    'narrative_evaluation',
    'turning_point_resolution',
    'foreshadow_planning',
    'witness_seed_generation',
    'archive_entry_production',
    'ledger_entry_production',
    'replay_eligibility',
    'legend_escalation_check',
    'world_echo_check',
    'batch_resolution',
    'diagnostics',
    'audit',
    'epoch_tracking',
    'fingerprinting',
    'watch_bus',
  ]),
});

// ============================================================================
// MARK: Post-run watch bus (barrel-level)
// ============================================================================

export interface ChatPostRunBarrelWatchEvent {
  readonly kind:
    | 'evaluation_completed'
    | 'turning_point_resolved'
    | 'foreshadow_planned'
    | 'archive_produced'
    | 'legend_eligible';
  readonly roomId: string;
  readonly at: number;
  readonly subsystem: ChatPostRunSubsystemId;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type ChatPostRunBarrelWatchHandler = (event: ChatPostRunBarrelWatchEvent) => void;

export class ChatPostRunBarrelWatchBus {
  private readonly handlers: ChatPostRunBarrelWatchHandler[] = [];

  subscribe(handler: ChatPostRunBarrelWatchHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  emit(event: ChatPostRunBarrelWatchEvent): void {
    for (const h of this.handlers) {
      try { h(event); } catch { /* isolated */ }
    }
  }

  get listenerCount(): number {
    return this.handlers.length;
  }
}

// ============================================================================
// MARK: Subsystem availability registry
// ============================================================================

export interface ChatPostRunSubsystemRegistryEntry {
  readonly subsystemId: ChatPostRunSubsystemId;
  readonly isAvailable: boolean;
  readonly version: string;
  readonly capabilities: readonly string[];
}

export const CHAT_POSTRUN_SUBSYSTEM_REGISTRY: readonly ChatPostRunSubsystemRegistryEntry[] = Object.freeze([
  Object.freeze({
    subsystemId: 'post_run_narrative_engine' as const,
    isAvailable: true,
    version: CHAT_POSTRUN_BARREL_VERSION,
    capabilities: Object.freeze(['narrative_evaluation', 'archive_production', 'ledger_entry', 'beat_sequencing', 'witness_selection']),
  }),
  Object.freeze({
    subsystemId: 'turning_point_resolver' as const,
    isAvailable: true,
    version: CHAT_POSTRUN_BARREL_VERSION,
    capabilities: Object.freeze(['candidate_ranking', 'weight_profiles', 'diagnostics', 'epoch_tracking', 'batch_resolution']),
  }),
  Object.freeze({
    subsystemId: 'foreshadow_planner' as const,
    isAvailable: true,
    version: CHAT_POSTRUN_BARREL_VERSION,
    capabilities: Object.freeze(['foreshadow_planning', 'directive_synthesis', 'witness_seed_generation', 'confidence_adjustment', 'threat_scoring']),
  }),
]);

export function getPostRunSubsystemEntry(id: ChatPostRunSubsystemId): ChatPostRunSubsystemRegistryEntry | null {
  return CHAT_POSTRUN_SUBSYSTEM_REGISTRY.find((e) => e.subsystemId === id) ?? null;
}

export function allPostRunSubsystemsAvailable(): boolean {
  return CHAT_POSTRUN_SUBSYSTEM_REGISTRY.every((e) => e.isAvailable);
}

// ============================================================================
// MARK: Combined module constructor helpers
// ============================================================================

export function createPostRunEngine(options?: Parameters<typeof NarrativeEngineNS.createPostRunNarrativeEngine>[0]): ReturnType<typeof NarrativeEngineNS.createPostRunNarrativeEngine> {
  return NarrativeEngineNS.createPostRunNarrativeEngine(options);
}

export function createPostRunTurningPointResolver(options?: Parameters<typeof TurningPointResolverNS.createTurningPointResolver>[0]): ReturnType<typeof TurningPointResolverNS.createTurningPointResolver> {
  return TurningPointResolverNS.createTurningPointResolver(options);
}

export function createPostRunForeshadowPlanner(options?: Parameters<typeof ForeshadowPlannerNS.createForeshadowPlanner>[0]): ReturnType<typeof ForeshadowPlannerNS.createForeshadowPlanner> {
  return ForeshadowPlannerNS.createForeshadowPlanner(options);
}

// ============================================================================
// MARK: Batch evaluation types
// ============================================================================

export interface ChatPostRunBatchRequest {
  readonly roomId: string;
  readonly options?: Parameters<typeof NarrativeEngineNS.createPostRunNarrativeEngine>[0];
}

export interface ChatPostRunBatchSummary {
  readonly evaluatedCount: number;
  readonly legendEligibleCount: number;
  readonly worldEchoEligibleCount: number;
  readonly failedCount: number;
  readonly completedAt: number;
}

export function buildPostRunBatchSummary(
  evaluated: number,
  legendEligible: number,
  worldEchoEligible: number,
  failed: number,
  now: number,
): ChatPostRunBatchSummary {
  return Object.freeze({
    evaluatedCount: evaluated,
    legendEligibleCount: legendEligible,
    worldEchoEligibleCount: worldEchoEligible,
    failedCount: failed,
    completedAt: now,
  });
}

// ============================================================================
// MARK: Profile selectors
// ============================================================================

export const CHAT_POSTRUN_NARRATIVE_PROFILES = Object.freeze([
  'CINEMATIC',
  'DEBRIEF',
  'COLD_CLOSE',
  'GRIEF',
  'SOVEREIGN_CEREMONY',
  'LEGEND_CEREMONY',
  'RAPID',
] as const);

export type ChatPostRunNarrativeProfile = (typeof CHAT_POSTRUN_NARRATIVE_PROFILES)[number];

export const CHAT_POSTRUN_TURNING_POINT_PROFILES = Object.freeze([
  'DEFAULT',
  'NARRATIVE',
  'COMBAT',
  'EMOTIONAL',
  'SOCIAL',
  'ECONOMIC',
  'LEGEND',
] as const);

export type ChatPostRunTurningPointProfile = (typeof CHAT_POSTRUN_TURNING_POINT_PROFILES)[number];

export const CHAT_POSTRUN_FORESHADOW_PROFILES = Object.freeze([
  'BALANCED',
  'CONSERVATIVE',
  'AGGRESSIVE',
  'LEGEND_ORIENTED',
  'WORLD_ECHO_PRIORITY',
  'SHADOW_ONLY',
] as const);

export type ChatPostRunForeshadowProfile = (typeof CHAT_POSTRUN_FORESHADOW_PROFILES)[number];

export function isPostRunNarrativeProfile(value: string): value is ChatPostRunNarrativeProfile {
  return (CHAT_POSTRUN_NARRATIVE_PROFILES as readonly string[]).includes(value);
}

export function isPostRunTurningPointProfile(value: string): value is ChatPostRunTurningPointProfile {
  return (CHAT_POSTRUN_TURNING_POINT_PROFILES as readonly string[]).includes(value);
}

export function isPostRunForeshadowProfile(value: string): value is ChatPostRunForeshadowProfile {
  return (CHAT_POSTRUN_FORESHADOW_PROFILES as readonly string[]).includes(value);
}

// ============================================================================
// MARK: Module namespace extended
// ============================================================================

export namespace ChatPostRunModuleExtended {
  export type WatchBus = ChatPostRunBarrelWatchBus;
  export type WatchEvent = ChatPostRunBarrelWatchEvent;
  export type SubsystemId = ChatPostRunSubsystemId;
  export type NarrativeProfile = ChatPostRunNarrativeProfile;
  export type TurningPointProfile = ChatPostRunTurningPointProfile;
  export type ForeshadowProfile = ChatPostRunForeshadowProfile;

  export function createWatchBus(): ChatPostRunBarrelWatchBus {
    return new ChatPostRunBarrelWatchBus();
  }

  export function describe(): string {
    return `${CHAT_POSTRUN_BARREL_ID}@${CHAT_POSTRUN_BARREL_VERSION} [${CHAT_POSTRUN_SUBSYSTEM_IDS.length} subsystems]`;
  }

  export function getDescriptor(): typeof CHAT_POSTRUN_BARREL_DESCRIPTOR {
    return CHAT_POSTRUN_BARREL_DESCRIPTOR;
  }
}

// ============================================================================
// MARK: Outcome kind helpers
// ============================================================================

export const CHAT_POSTRUN_OUTCOME_KINDS = Object.freeze([
  'WIN',
  'LOSS',
  'DRAW',
  'DISQUALIFIED',
  'ABANDONED',
  'LEGEND',
] as const);

export type ChatPostRunOutcomeKind = (typeof CHAT_POSTRUN_OUTCOME_KINDS)[number];

export function isPostRunOutcomeKind(value: string): value is ChatPostRunOutcomeKind {
  return (CHAT_POSTRUN_OUTCOME_KINDS as readonly string[]).includes(value);
}

export function postRunOutcomeIsPositive(outcome: ChatPostRunOutcomeKind): boolean {
  return outcome === 'WIN' || outcome === 'LEGEND';
}

export function postRunOutcomeIsNegative(outcome: ChatPostRunOutcomeKind): boolean {
  return outcome === 'LOSS' || outcome === 'DISQUALIFIED' || outcome === 'ABANDONED';
}

export function postRunOutcomeLabel(outcome: ChatPostRunOutcomeKind): string {
  const labels: Record<ChatPostRunOutcomeKind, string> = {
    WIN: 'Victory',
    LOSS: 'Defeat',
    DRAW: 'Draw',
    DISQUALIFIED: 'Disqualified',
    ABANDONED: 'Abandoned',
    LEGEND: 'Legend Moment',
  };
  return labels[outcome];
}

// ============================================================================
// MARK: Full combined module
// ============================================================================

export const CHAT_POSTRUN_FULL_MODULE = Object.freeze({
  barrel: CHAT_POSTRUN_BARREL_DESCRIPTOR,
  modules: ChatPostRunModule,
  registry: CHAT_POSTRUN_SUBSYSTEM_REGISTRY,
  createWatchBus: () => new ChatPostRunBarrelWatchBus(),
  allSubsystemsAvailable: allPostRunSubsystemsAvailable,
  getSubsystem: getPostRunSubsystemEntry,
  createEngine: createPostRunEngine,
  createTurningPointResolver: createPostRunTurningPointResolver,
  createForeshadowPlanner: createPostRunForeshadowPlanner,
});

