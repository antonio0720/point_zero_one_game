/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PERSONA DOMAIN INDEX
 * FILE: backend/src/game/engine/chat/persona/index.ts
 * VERSION: 2026.03.22
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative barrel export and unified orchestration layer for the entire
 * backend chat persona subsystem.
 *
 * This index:
 * - Re-exports every public symbol from PersonaRegistry, VoiceprintPolicy,
 *   and LatencyStyleResolver without omission.
 * - Provides a unified BackendPersonaDomain class that combines registry
 *   lookup, voiceprint composition, and latency timing into a single
 *   request-response pipeline.
 * - Provides standalone composition utilities for consumers who want
 *   function-level control without instantiating the domain class.
 * - Aggregates all namespace exports into a single BackendPersonaDomainNS
 *   object for callers that prefer namespace-style access.
 *
 * Design laws
 * -----------
 * - No new business logic lives here. All logic lives in the three source
 *   files. This file orchestrates and re-exports.
 * - PersonaRegistry is the authority for identity and corpus.
 * - VoiceprintPolicy is the authority for text shaping.
 * - LatencyStyleResolver is the authority for timing.
 * - This orchestration layer composes them left-to-right without coupling.
 * ============================================================================
 */

// ============================================================================
// MARK: Re-exports — PersonaRegistry
// ============================================================================

export type {
  BackendPersonaAliasKey,
  BackendPersonaLineCategory,
  BackendPersonaRoomMood,
  BackendPersonaRuntimePresentation,
  BackendPersonaLineBank,
  BackendPersonaSelectionWeights,
  BackendPersonaRegistryEntry,
  BackendPersonaRegistrySnapshot,
  BackendPersonaLookupResult,
  BackendPersonaSelectionContext,
  BackendPersonaContextScore,
  BackendPersonaSelectionResult,
  BackendPersonaHealthReport,
  BackendPersonaRankSummary,
  BackendPersonaLineSummary,
} from './PersonaRegistry';

export {
  BACKEND_PERSONA_REGISTRY_VERSION,
  BACKEND_PERSONA_REGISTRY,
  PERSONA_REGISTRY_PUBLIC_SURFACE,
  listPersonaEntries,
  listPersonaKeys,
  getPersonaEntry,
  resolvePersonaLookup,
  resolvePersonaEntry,
  getPersonaByRuntimePersonaId,
  getPersonaByRuntimeActorId,
  getPersonaByBotId,
  rankPersonaEntries,
  listHelperCandidates,
  listHaterCandidates,
  listAmbientCandidates,
  getPersonaLineBank,
  getPersonaLineCategory,
  pickPersonaLine,
  pickPersonaLines,
  pickLineAcrossPersonas,
  sampleLineBankCoverage,
  resolveIntentToCategory,
  pickBestPersonaLine,
  buildPersonaRegistrySnapshot,
  buildPersonaContextScore,
  scoreEntryBreakdown,
  selectBestPersona,
  selectPersonaForIntent,
  selectPersonasByRankedScore,
  filterPersonasByNpcClass,
  filterPersonasByRoomMood,
  filterPersonasByPressureBand,
  filterPersonasByAliasKey,
  filterPersonasByBotId,
  filterPersonasByTag,
  personaHasAlias,
  personaHasTag,
  personaHasBotBinding,
  personaHasLineCategory,
  countLinesForEntry,
  countPersonaLines,
  totalRegistryLines,
  buildPersonaLineSummary,
  listPersonaLineSummaries,
  getPersonaDisplayInfo,
  describePersona,
  describeLineBank,
  buildPersonaHealthReport,
  buildPersonaRankSummary,
  getPersonaEvolutionStage,
  getPersonaTemperament,
  getPersonaTransformBiases,
  getPersonaEvolutionSeed,
  listPersonasWithBotBinding,
  getBotIdForPersona,
  resolveBotIdToSharedKey,
} from './PersonaRegistry';

// ============================================================================
// MARK: Re-exports — VoiceprintPolicy
// ============================================================================

export type {
  BackendVoiceprintIntent,
  BackendVoiceprintAggressionBand,
  BackendVoiceprintClarityBand,
  BackendVoiceprintContext,
  BackendVoiceprintPolicyInput,
  BackendVoiceprintPolicyResolution,
  BackendVoiceprintRenderPreview,
  BackendVoiceprintCompositionBundle,
  BackendVoiceprintBatchEntry,
  BackendVoiceprintBatchResult,
  BackendVoiceprintDiagnostic,
  BackendVoiceprintCompositionStats,
  BackendVoiceprintResolutionDiff,
  BackendPersonaVoiceprintProfile,
} from './VoiceprintPolicy';

export {
  resolveVoiceprintPolicy,
  previewVoiceprintPolicy,
  composePersonaLine,
  resolveAggressionBand,
  resolveClarityBand,
  computeAggressionScore,
  computeClarityScore,
  aggressionScoreToBand,
  clarityScoreToBand,
  compareAggressionBands,
  compareClarityBands,
  resolvePreferredEntryStyle,
  resolvePreferredExitStyle,
  classifyEntryStyle,
  classifyExitStyle,
  selectSignatureOpener,
  selectSignatureCloser,
  resolveVoiceprintPolicySafe,
  resolveVoiceprintBatch,
  batchComposeLines,
  resolveVoiceprintForIntent,
  buildCompositionBundle,
  isHostileIntent,
  isReflectiveIntent,
  isRescueIntent,
  classifyIntent,
  intentRequiresClarityEscalation,
  buildVoiceprintDiagnostic,
  describeAggressionBand,
  describeClarityBand,
  describeTransformationFlags,
  describeVoiceprintResolution,
  diffPolicyResolutions,
  buildVoiceprintCompositionStats,
  buildPersonaVoiceprintProfile,
  buildVoiceprintSummary,
  selectBestLine,
  selectAndComposeLines,
  scoreLineForAggression,
  scoreLineForClarity,
  rankLinesByFit,
  filterResolutionsByAggression,
  filterResolutionsByClarity,
  filterResolutionsByFlag,
  groupResolutionsByAggression,
} from './VoiceprintPolicy';

// ============================================================================
// MARK: Re-exports — LatencyStyleResolver
// ============================================================================

export type {
  BackendLatencyUrgencyBand,
  BackendLatencyReason,
  BackendLatencyResolutionInput,
  BackendTypingEnvelope,
  BackendLatencyResolution,
  BackendInterruptionDecision,
  BackendLatencyBatchPreview,
  BackendLatencyTimingProfile,
  BackendLatencyBatchResult,
  BackendLatencyDiagnostic,
  BackendLatencySceneAnalysis,
  BackendLatencyStats,
  BackendLatencyResolutionDiff,
  BackendLatencyChannelContext,
  BackendLatencyRankEntry,
} from './LatencyStyleResolver';

export {
  resolveLatencyStyle,
  resolveInterruptionDecision,
  previewSceneLatencyBatch,
  LATENCY_TIMING_PROFILES,
  getTimingProfileForEntry,
  getTimingProfileForClass,
  buildTimingProfileSummary,
  resolveUrgencyBand,
  resolveInterruptionPriority,
  canInterrupt,
  resolveUrgencyBandFromScore,
  urgencyBandToScore,
  resolveBaseDelayMs,
  resolveQueueCooldownMs,
  resolveSilenceWindowBefore,
  resolveSilenceWindowAfter,
  clampLatencyDelayMs,
  resolveTypingEnvelope,
  shouldUseTypingTheater,
  resolveTypingDurationMs,
  resolveLingerMs,
  resolveLatencyReason,
  resolveLatencyReasonFromContext,
  resolveLatencyStyleSafe,
  resolveLatencyBatch,
  buildLatencyDiagnostic,
  describeUrgencyBand,
  describeLatencyReason,
  describeTypingEnvelope,
  describeLatencyResolution,
  buildLatencyPresenceSummary,
  buildLatencyReport,
  buildSceneTimingAnalysis,
  estimateSceneDuration,
  buildChannelTimingContext,
  resolveLatencyForChannel,
  compareLatencyResolutions,
  diffLatencyResolutions,
  compareByDelay,
  compareByInterruptionPriority,
  compareLatencyInputsByClass,
  buildLatencyStats,
  computeAverageDelay,
  computeAverageTypingDuration,
  summarizeUrgencyDistribution,
  computeInterruptionScore,
  isInterruptEligible,
  buildInterruptionMatrix,
  resolveSceneInterruptionOrder,
  rankInputsByPriority,
  rankInputsByUrgency,
  rankResolutionsByDelay,
  findFastestResolution,
  findSlowestResolution,
  filterInputsByUrgency,
  filterResolutionsByUrgency,
  groupResolutionsByUrgency,
  groupResolutionsByReason,
  serializeLatencyResolution,
  serializeTypingEnvelope,
  serializeBatchPreview,
  buildMinimalLatencyInput,
  latencyResolutionIsImmediate,
  latencyResolutionIsCritical,
  latencyResolutionNeedsTyping,
} from './LatencyStyleResolver';

// ============================================================================
// MARK: Unified pipeline contracts
// ============================================================================

import type {
  BackendPersonaRegistryEntry,
  BackendPersonaSelectionContext,
  BackendPersonaLineCategory,
} from './PersonaRegistry';
import type {
  BackendVoiceprintIntent,
  BackendVoiceprintContext,
  BackendVoiceprintPolicyResolution,
} from './VoiceprintPolicy';
import type {
  BackendLatencyResolutionInput,
  BackendLatencyResolution,
  BackendLatencyUrgencyBand,
} from './LatencyStyleResolver';
import {
  resolvePersonaEntry,
  selectPersonaForIntent,
  rankPersonaEntries,
  listPersonaEntries as _listPersonaEntries,
  pickBestPersonaLine as _pickBestPersonaLine,
  buildPersonaContextScore,
  buildPersonaHealthReport as _buildPersonaHealthReport,
  buildPersonaLineSummary as _buildPersonaLineSummary,
  PersonaRegistryNS,
  resolveIntentToCategory,
} from './PersonaRegistry';
import {
  VoiceprintPolicyNS,
  resolveVoiceprintPolicy,
  composePersonaLine,
  resolveAggressionBand,
  resolveClarityBand,
  resolvePreferredEntryStyle,
  resolvePreferredExitStyle,
  buildVoiceprintSummary,
  buildPersonaVoiceprintProfile,
} from './VoiceprintPolicy';
import {
  LatencyStyleResolverNS,
  resolveLatencyStyle,
  resolveLatencyStyleSafe,
  resolveUrgencyBand,
  buildLatencyDiagnostic,
  describeLatencyResolution,
  buildChannelTimingContext,
  resolveLatencyForChannel,
  getTimingProfileForEntry,
} from './LatencyStyleResolver';

export interface BackendPersonaPipelineRequest {
  readonly identity: string;
  readonly intent: BackendVoiceprintIntent;
  readonly sourceText?: string | null;
  readonly context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null;
  readonly channelId?: string | null;
  readonly now?: number | null;
  readonly queueDepth?: number | null;
  readonly allowInterruption?: boolean;
  readonly seed?: string | null;
}

export interface BackendPersonaPipelineResult {
  readonly entry: BackendPersonaRegistryEntry;
  readonly composedText: string;
  readonly originalText: string;
  readonly voiceprint: BackendVoiceprintPolicyResolution;
  readonly latency: BackendLatencyResolution;
  readonly intent: BackendVoiceprintIntent;
  readonly channelId: string | null;
  readonly notes: readonly string[];
}

export interface BackendPersonaLinePipelineRequest {
  readonly identity: string;
  readonly intent: BackendVoiceprintIntent;
  readonly context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null;
  readonly channelId?: string | null;
  readonly now?: number | null;
  readonly queueDepth?: number | null;
  readonly seed?: string | null;
}

export interface BackendPersonaLinePipelineResult {
  readonly entry: BackendPersonaRegistryEntry;
  readonly selectedLine: string | null;
  readonly composedLine: string | null;
  readonly voiceprint: BackendVoiceprintPolicyResolution | null;
  readonly latency: BackendLatencyResolution | null;
  readonly category: BackendPersonaLineCategory;
  readonly intent: BackendVoiceprintIntent;
}

export interface BackendPersonaSceneRequest {
  readonly entries: readonly BackendPersonaRegistryEntry[];
  readonly intents: readonly BackendVoiceprintIntent[];
  readonly sourceTexts?: readonly string[] | null;
  readonly context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null;
  readonly channelId?: string | null;
  readonly now?: number | null;
  readonly seed?: string | null;
}

export interface BackendPersonaSceneResult {
  readonly turns: readonly BackendPersonaPipelineResult[];
  readonly totalDurationMs: number;
  readonly finalRevealAt: number;
}

export interface BackendPersonaDomainSnapshot {
  readonly version: string;
  readonly createdAt: number;
  readonly totalPersonas: number;
  readonly totalLines: number;
  readonly haterCount: number;
  readonly helperCount: number;
  readonly ambientCount: number;
  readonly healthNotes: readonly string[];
}

// ============================================================================
// MARK: Standalone pipeline functions
// ============================================================================

export function runPersonaPipeline(
  request: BackendPersonaPipelineRequest,
): BackendPersonaPipelineResult | null {
  const entry = resolvePersonaEntry(request.identity);
  if (!entry) return null;

  const context = request.context as BackendVoiceprintContext | null;
  const now = request.now ?? Date.now();
  const seed = request.seed ?? undefined;

  const sourceText = request.sourceText ?? `[${entry.runtime.runtimeDisplayName}:${request.intent}]`;

  const voiceprint = resolveVoiceprintPolicy({
    entry,
    intent: request.intent,
    sourceText,
    context,
    seed,
  });

  const latencyInput: BackendLatencyResolutionInput = {
    entry,
    intent: request.intent,
    context,
    now,
    queueDepth: request.queueDepth ?? 0,
    allowInterruption: request.allowInterruption,
    seed,
  };

  const latency = request.channelId
    ? resolveLatencyForChannel(latencyInput, request.channelId)
    : resolveLatencyStyle(latencyInput);

  const notes: string[] = [];
  if (voiceprint.aggressionBand === 'PREDATORY') notes.push('Predatory aggression active.');
  if (latency.urgency === 'IMMEDIATE') notes.push('Immediate urgency: minimal delay path.');
  if (latency.interruptionAllowed) notes.push(`Interruption eligible at priority ${latency.interruptionPriority}.`);
  if (latency.shadowPrimed) notes.push('Shadow-primed delivery active.');

  return Object.freeze({
    entry,
    composedText: voiceprint.text,
    originalText: voiceprint.originalText,
    voiceprint,
    latency,
    intent: request.intent,
    channelId: request.channelId ?? null,
    notes: Object.freeze(notes),
  });
}

export function runLinePipeline(
  request: BackendPersonaLinePipelineRequest,
): BackendPersonaLinePipelineResult {
  const entry = resolvePersonaEntry(request.identity);
  const category = resolveIntentToCategory(request.intent);

  if (!entry) {
    return Object.freeze({
      entry: null as unknown as BackendPersonaRegistryEntry,
      selectedLine: null,
      composedLine: null,
      voiceprint: null,
      latency: null,
      category,
      intent: request.intent,
    });
  }

  const context = request.context as BackendVoiceprintContext | null;
  const now = request.now ?? Date.now();
  const seed = request.seed ?? `line::${entry.sharedKey}::${request.intent}`;

  const selectedLine = _pickBestPersonaLine(entry.sharedKey, request.intent, seed);

  if (!selectedLine) {
    return Object.freeze({
      entry,
      selectedLine: null,
      composedLine: null,
      voiceprint: null,
      latency: null,
      category,
      intent: request.intent,
    });
  }

  const voiceprint = resolveVoiceprintPolicy({
    entry,
    intent: request.intent,
    sourceText: selectedLine,
    context,
    seed,
  });

  const latencyInput: BackendLatencyResolutionInput = {
    entry,
    intent: request.intent,
    context,
    now,
    queueDepth: request.queueDepth ?? 0,
    seed,
  };

  const latency = request.channelId
    ? resolveLatencyForChannel(latencyInput, request.channelId)
    : resolveLatencyStyleSafe(latencyInput);

  return Object.freeze({
    entry,
    selectedLine,
    composedLine: voiceprint.text,
    voiceprint,
    latency,
    category,
    intent: request.intent,
  });
}

export function runScenePipeline(
  request: BackendPersonaSceneRequest,
): BackendPersonaSceneResult {
  const now = request.now ?? Date.now();
  const turns: BackendPersonaPipelineResult[] = [];
  let cursor = now;

  for (let i = 0; i < request.entries.length; i += 1) {
    const entry = request.entries[i];
    const intent = request.intents[i] ?? request.intents[0];
    const sourceText = request.sourceTexts?.[i] ?? null;
    if (!entry || !intent) continue;

    const result = runPersonaPipeline({
      identity: entry.sharedKey,
      intent,
      sourceText,
      context: request.context,
      channelId: request.channelId,
      now: cursor,
      seed: request.seed ? `${request.seed}::${i}` : undefined,
    });

    if (!result) continue;
    turns.push(result);
    cursor = result.latency.revealAt + result.latency.typing.lingerMs + result.latency.silenceWindowAfterMs;
  }

  const finalRevealAt = turns.at(-1)?.latency.revealAt ?? now;

  return Object.freeze({
    turns: Object.freeze(turns),
    totalDurationMs: cursor - now,
    finalRevealAt,
  });
}

// ============================================================================
// MARK: BackendPersonaDomain class
// ============================================================================

export class BackendPersonaDomain {
  // ---- Registry access ----

  getEntry(identity: string): BackendPersonaRegistryEntry | null {
    return resolvePersonaEntry(identity);
  }

  requireEntry(identity: string): BackendPersonaRegistryEntry {
    const entry = resolvePersonaEntry(identity);
    if (!entry) throw new Error(`BackendPersonaDomain: no persona found for identity="${identity}"`);
    return entry;
  }

  rankForContext(
    context: BackendPersonaSelectionContext,
  ): readonly BackendPersonaRegistryEntry[] {
    return rankPersonaEntries(_listPersonaEntries(), context);
  }

  selectForIntent(
    intent: BackendVoiceprintIntent,
    context: BackendPersonaSelectionContext = {},
    seed?: string,
  ): BackendPersonaRegistryEntry | null {
    return selectPersonaForIntent(resolveIntentToCategory(intent), context, seed);
  }

  // ---- Voiceprint ----

  compose(
    entry: BackendPersonaRegistryEntry,
    sourceText: string,
    intent: BackendVoiceprintIntent,
    context?: BackendVoiceprintContext | null,
    seed?: string | null,
  ): string {
    return composePersonaLine(entry, sourceText, intent, context, seed);
  }

  voiceprintSummary(
    entry: BackendPersonaRegistryEntry,
    intent: BackendVoiceprintIntent,
    context?: BackendVoiceprintContext | null,
  ): string {
    return buildVoiceprintSummary(entry, intent, context);
  }

  voiceprintProfile(
    entry: BackendPersonaRegistryEntry,
    context?: BackendVoiceprintContext | null,
  ) {
    return buildPersonaVoiceprintProfile(entry, context);
  }

  // ---- Latency ----

  timing(
    entry: BackendPersonaRegistryEntry,
    intent: BackendVoiceprintIntent,
    context?: BackendVoiceprintContext | null,
    now?: number,
    channelId?: string | null,
  ): BackendLatencyResolution {
    const input: BackendLatencyResolutionInput = {
      entry,
      intent,
      context,
      now: now ?? Date.now(),
    };
    return channelId
      ? resolveLatencyForChannel(input, channelId)
      : resolveLatencyStyle(input);
  }

  urgency(
    entry: BackendPersonaRegistryEntry,
    intent: BackendVoiceprintIntent,
    context?: BackendVoiceprintContext | null,
  ): BackendLatencyUrgencyBand {
    return resolveUrgencyBand(entry, intent, context);
  }

  timingDiagnostic(
    entry: BackendPersonaRegistryEntry,
    intent: BackendVoiceprintIntent,
    context?: BackendVoiceprintContext | null,
    now?: number,
  ) {
    const input: BackendLatencyResolutionInput = {
      entry,
      intent,
      context,
      now: now ?? Date.now(),
    };
    return buildLatencyDiagnostic(input);
  }

  timingProfile(entry: BackendPersonaRegistryEntry) {
    return getTimingProfileForEntry(entry);
  }

  // ---- Full pipeline ----

  run(request: BackendPersonaPipelineRequest): BackendPersonaPipelineResult | null {
    return runPersonaPipeline(request);
  }

  runLine(request: BackendPersonaLinePipelineRequest): BackendPersonaLinePipelineResult {
    return runLinePipeline(request);
  }

  runScene(request: BackendPersonaSceneRequest): BackendPersonaSceneResult {
    return runScenePipeline(request);
  }

  // ---- Snapshot ----

  snapshot(now = Date.now()): BackendPersonaDomainSnapshot {
    return buildPersonaDomainSnapshot(now);
  }
}

// ============================================================================
// MARK: Domain snapshot
// ============================================================================

export function buildPersonaDomainSnapshot(now = Date.now()): BackendPersonaDomainSnapshot {
  const health = _buildPersonaHealthReport();
  return Object.freeze({
    version: health.version,
    createdAt: now,
    totalPersonas: health.totalPersonas,
    totalLines: health.totalLines,
    haterCount: health.haterCount,
    helperCount: health.helperCount,
    ambientCount: health.ambientCount,
    healthNotes: health.notes,
  });
}

// ============================================================================
// MARK: Convenience helpers
// ============================================================================

export function composeForIdentity(
  identity: string,
  sourceText: string,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
  seed?: string | null,
): string | null {
  const entry = resolvePersonaEntry(identity);
  if (!entry) return null;
  return composePersonaLine(entry, sourceText, intent, context, seed);
}

export function timingForIdentity(
  identity: string,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
  now?: number,
  channelId?: string | null,
): BackendLatencyResolution | null {
  const entry = resolvePersonaEntry(identity);
  if (!entry) return null;
  const input: BackendLatencyResolutionInput = {
    entry,
    intent,
    context,
    now: now ?? Date.now(),
  };
  return channelId
    ? resolveLatencyForChannel(input, channelId)
    : resolveLatencyStyleSafe(input);
}

export function urgencyForIdentity(
  identity: string,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
): BackendLatencyUrgencyBand | null {
  const entry = resolvePersonaEntry(identity);
  if (!entry) return null;
  return resolveUrgencyBand(entry, intent, context);
}

export function aggressionForIdentity(
  identity: string,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
): string | null {
  const entry = resolvePersonaEntry(identity);
  if (!entry) return null;
  return resolveAggressionBand(entry, intent, context);
}

export function clarityForIdentity(
  identity: string,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
): string | null {
  const entry = resolvePersonaEntry(identity);
  if (!entry) return null;
  return resolveClarityBand(entry, intent, context);
}

export function describePersonaTimingAndVoice(
  identity: string,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
  now?: number,
): string | null {
  const entry = resolvePersonaEntry(identity);
  if (!entry) return null;
  const input: BackendLatencyResolutionInput = {
    entry,
    intent,
    context,
    now: now ?? Date.now(),
  };
  const latency = resolveLatencyStyleSafe(input);
  const voiceSummary = buildVoiceprintSummary(entry, intent, context);
  const latencySummary = latency ? describeLatencyResolution(latency) : 'latency unavailable';
  return `${voiceSummary} || ${latencySummary}`;
}

export function buildPersonaFullProfile(
  identity: string,
  context?: BackendVoiceprintContext | null,
): Readonly<{
  entry: BackendPersonaRegistryEntry;
  lineSummary: ReturnType<typeof _buildPersonaLineSummary>;
  voiceprintProfile: ReturnType<typeof buildPersonaVoiceprintProfile>;
  timingProfile: ReturnType<typeof getTimingProfileForEntry>;
  evolutionStage: string | null;
  temperament: string | null;
}> | null {
  const entry = resolvePersonaEntry(identity);
  if (!entry) return null;

  return Object.freeze({
    entry,
    lineSummary: _buildPersonaLineSummary(entry),
    voiceprintProfile: buildPersonaVoiceprintProfile(entry, context),
    timingProfile: getTimingProfileForEntry(entry),
    evolutionStage: entry.evolutionSeed.stage,
    temperament: entry.evolutionSeed.temperament,
  });
}

// ============================================================================
// MARK: Scoring convenience
// ============================================================================

export function scoreAllPersonasForContext(
  context: BackendPersonaSelectionContext,
): readonly { readonly identity: string; readonly score: number; readonly npcClass: string }[] {
  return _listPersonaEntries()
    .map((entry) => ({
      identity: String(entry.sharedKey),
      score: buildPersonaContextScore(entry, context).totalScore,
      npcClass: entry.descriptor.npcClass,
    }))
    .sort((a, b) => b.score - a.score);
}

export function rankPersonasWithScores(
  context: BackendPersonaSelectionContext,
): readonly { readonly entry: BackendPersonaRegistryEntry; readonly score: number }[] {
  return _listPersonaEntries()
    .map((entry) => ({
      entry,
      score: buildPersonaContextScore(entry, context).totalScore,
    }))
    .sort((a, b) => b.score - a.score);
}

// ============================================================================
// MARK: Singleton and factory
// ============================================================================

let _domainSingleton: BackendPersonaDomain | null = null;

export function createBackendPersonaDomain(): BackendPersonaDomain {
  return new BackendPersonaDomain();
}

export function getBackendPersonaDomain(): BackendPersonaDomain {
  if (!_domainSingleton) {
    _domainSingleton = new BackendPersonaDomain();
  }
  return _domainSingleton;
}

export const backendPersonaDomain: BackendPersonaDomain = createBackendPersonaDomain();

// ============================================================================
// MARK: Namespace aggregation
// ============================================================================

// Re-export the three namespace objects (imported above for local use)
export { PersonaRegistryNS, VoiceprintPolicyNS, LatencyStyleResolverNS };

export const BackendPersonaDomainNS = Object.freeze({
  // Sub-namespaces
  Registry: PersonaRegistryNS,
  Voiceprint: VoiceprintPolicyNS,
  Latency: LatencyStyleResolverNS,

  // Standalone pipeline
  runPersonaPipeline,
  runLinePipeline,
  runScenePipeline,

  // Domain snapshot
  buildPersonaDomainSnapshot,

  // Convenience helpers
  composeForIdentity,
  timingForIdentity,
  urgencyForIdentity,
  aggressionForIdentity,
  clarityForIdentity,
  describePersonaTimingAndVoice,
  buildPersonaFullProfile,

  // Scoring convenience
  scoreAllPersonasForContext,
  rankPersonasWithScores,

  // Factory / singleton
  createBackendPersonaDomain,
  getBackendPersonaDomain,
});
