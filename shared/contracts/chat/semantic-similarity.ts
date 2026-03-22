/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT SEMANTIC SIMILARITY CONTRACTS
 * FILE: shared/contracts/chat/semantic-similarity.ts
 * VERSION: 2026.03.21-sovereign.v1
 * AUTHORSHIP: Antonio T. Smith Jr. — Density6 LLC
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for deterministic semantic similarity,
 * novelty scoring, rhetorical form classification, and anti-repetition guard
 * logic used across:
 *
 *   - backend/src/game/engine/chat/intelligence/ChatSemanticSimilarityIndex.ts
 *   - pzo-web/src/engines/chat/intelligence (future frontend mirror)
 *   - pzo-server/src/chat (novelty guard at transport edge)
 *
 * Design doctrine
 * ---------------
 * 1. Semantic contracts are pure type and constant surfaces — zero runtime
 *    logic that could drift between frontend and backend.
 * 2. Rhetorical forms encode the chat system's authorial vocabulary, not
 *    generic NLP categories. Every form maps to the game's emotional grammar.
 * 3. Novelty guard config is shared so frontend and backend apply identical
 *    thresholds against the same document set.
 * 4. Pressure band integration ensures that anti-repetition thresholds respond
 *    to game state — calm runs allow more repetition; critical runs demand
 *    maximal novelty to prevent emotional fatigue.
 * 5. Per-mode and per-channel semantic policies are first-class. The same line
 *    may be novel in GLOBAL but stale in DEAL_ROOM because the audience and
 *    dramatic stakes are different.
 * 6. All float scores use the 01 suffix to signal normalized 0.0–1.0 range.
 *
 * Canonical authority roots
 * -------------------------
 * - /shared/contracts/chat
 * - /backend/src/game/engine/chat/intelligence
 * ============================================================================
 */

import type {
  Brand,
  ChatChannelId,
  ChatNpcId,
  Score01,
  UnixMs,
} from './ChatChannels';

import {
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
} from './ChatChannels';

// ============================================================================
// MARK: Version and authority stamps
// ============================================================================

export const CHAT_SEMANTIC_SIMILARITY_CONTRACT_VERSION =
  '2026.03.21-sovereign.v1' as const;

export const CHAT_SEMANTIC_SIMILARITY_CONTRACT_AUTHORITY = Object.freeze({
  owner: 'backend-intelligence',
  sourceContractRoot: '/shared/contracts/chat',
  contractVersion: CHAT_SEMANTIC_SIMILARITY_CONTRACT_VERSION,
  sharedContractVersion: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
});

// ============================================================================
// MARK: Branded identifiers
// ============================================================================

export type ChatSemanticDocumentId = Brand<string, 'ChatSemanticDocumentId'>;
export type ChatSemanticClusterId = Brand<string, 'ChatSemanticClusterId'>;
export type ChatSemanticQueryId = Brand<string, 'ChatSemanticQueryId'>;
export type ChatSemanticRequestId = Brand<string, 'ChatSemanticRequestId'>;
export type ChatSemanticIndexId = Brand<string, 'ChatSemanticIndexId'>;
export type ChatSemanticMotifId = Brand<string, 'ChatSemanticMotifId'>;
export type ChatSemanticCallbackSourceId = Brand<string, 'ChatSemanticCallbackSourceId'>;
export type ChatSemanticFederationKey = Brand<string, 'ChatSemanticFederationKey'>;

// ============================================================================
// MARK: Rhetorical form taxonomy
// ============================================================================

/**
 * ChatSemanticRhetoricalForm
 *
 * The rhetorical form classifies the structural and dramatic shape of a
 * dialogue line — not the topic, but the mode of speech act. Every form maps
 * to specific NPC archetypes and emotional functions in the PZO chat system.
 *
 * These forms are the semantic fingerprint that prevents the same emotional
 * move from firing twice in a row, regardless of surface-level word variation.
 */
export const CHAT_SEMANTIC_RHETORICAL_FORMS = [
  // ── Hostility forms (hater archetypes)
  'THREAT_DECLARATIVE',        // Direct personal threat. "You thought I'd let this pass."
  'REPRICING_DECLARATIVE',     // Market/asset repricing frame. "Your assets are distressed."
  'PROCEDURAL_DELAY',          // Bureaucratic obstruction. "Your file is under review."
  'PREDICTIVE_PROFILE',        // Pattern-reading attack. "Your next move is already modeled."
  'SYSTEMIC_INEVITABILITY',    // Macro doom. "The cycle always corrects."
  'STRUCTURAL_ASYMMETRY',      // Generational advantage claim. "I was born with what you earn."
  'SURVEILLANCE_SIGNAL',       // Observer watching. "I noticed that."
  'EXTRACTION_NOTICE',         // Value drain announcement. "Redirecting your income now."
  'BLUFF_EXPOSURE',            // Calling player's play. "That card doesn't work here."

  // ── Emotional weight forms
  'CALLBACK_WOUND',            // Memory as weapon. "Remember when you hesitated last time?"
  'WITNESS_JUDGMENT',          // Public spectacle. "The room saw that."
  'HUMILIATION_RECEIPT',       // Recording the loss. "This will be remembered."
  'RIVALRY_PRESSURE',          // Competitive escalation. "I'm ahead. Stay ahead."

  // ── Helper and rescue forms
  'RESCUE_STABILIZER',         // Grounding anchor. "Breathe. One move at a time."
  'TACTICAL_REDIRECT',         // Strategic pivot. "Cut expenses before income — here's why."
  'SURVIVOR_TESTIMONY',        // Personal loss history. "I've been exactly where you are."
  'INSIDER_SIGNAL',            // Hidden mechanic reveal. "That card has a synergy you haven't seen."
  'ARCHIVIST_RECORD',          // Historical/data citation. "Historically, 68% of players in this state..."
  'MENTOR_ANCHOR',             // Emotional grounding. "The fundamentals still hold. Focus."
  'RIVAL_DARE',                // Competitive push. "I hit that milestone 30 ticks ago."

  // ── Ambient / witness forms
  'CROWD_REACTION',            // Ambient witness. "The floor sees it."
  'DEAL_ROOM_LOG',             // Ledger entry style. "Offer logged. Counter pending."
  'LOBBY_RUMOR',               // Speculative chatter. "Heard someone say..."
  'MARKET_WITNESS_NOTE',       // Public record. "Marked for the archive."

  // ── System and silence forms
  'SILENCE_MARKER',            // Intentional short silence. Single word or punctuation.
  'SYSTEM_NOTICE',             // Engine-sourced system line. "[Shield breach registered.]"
  'PROOF_STAMP',               // Proof-bearing declaration. "Run #{n}. Verified."
  'LIVEOPS_SIGNAL',            // Live operations overlay. "Season event active."

  // ── Negotiation-specific forms (Predator/DEAL_ROOM)
  'LEVERAGE_CLAIM',            // Establishing position. "I have what you need."
  'OFFER_FRAME',               // Structuring a deal. "Here's what I'm proposing."
  'COUNTER_PROBE',             // Reading intent. "You hesitated. What's the real number?"
  'BLUFF_DEPLOY',              // False signal. "I'm already talking to someone else."
  'SILENCE_WEAPON',            // Negotiation silence. "..."

  // ── Unknown fallback
  'UNKNOWN',
] as const;

export type ChatSemanticRhetoricalForm =
  (typeof CHAT_SEMANTIC_RHETORICAL_FORMS)[number];

// ============================================================================
// MARK: Pressure band alignment
// ============================================================================

/**
 * ChatSemanticPressureBand
 *
 * Maps to the PressureTier from the core engine. Semantic documents are
 * indexed with their pressure band so the novelty guard can tighten or loosen
 * thresholds based on the current game state.
 *
 * At CRITICAL pressure, the same emotional move repeated within 10 messages
 * creates fatigue. At CALM pressure, the threshold may be 20+ messages.
 */
export const CHAT_SEMANTIC_PRESSURE_BANDS = [
  'CALM',       // PressureTier.CALM — low stakes, relaxed repetition tolerance
  'BUILDING',   // PressureTier.BUILDING — moderate tolerance
  'ELEVATED',   // PressureTier.ELEVATED — tighter windows
  'HIGH',       // PressureTier.HIGH — near-crisis, tightest tolerance
  'CRITICAL',   // PressureTier.CRITICAL — maximum novelty required
] as const;

export type ChatSemanticPressureBand =
  (typeof CHAT_SEMANTIC_PRESSURE_BANDS)[number];

// ============================================================================
// MARK: Semantic party-mode scopes
// ============================================================================

/**
 * ChatSemanticModeScope
 *
 * This semantic contract tracks authored gameplay party modes, not the broader
 * chat scene/runtime mode union exported by ChatChannels.ts. Those runtime chat
 * modes are values like LOBBY, RUN, PREDATOR, and PHANTOM. The semantic
 * similarity layer instead reasons over authored party configurations such as
 * GO_ALONE and TEAM_UP.
 */
export const CHAT_SEMANTIC_MODE_SCOPES = [
  'GO_ALONE',
  'HEAD_TO_HEAD',
  'TEAM_UP',
  'CHASE_A_LEGEND',
] as const;

export type ChatSemanticModeScope =
  (typeof CHAT_SEMANTIC_MODE_SCOPES)[number];

export function isChatSemanticModeScope(
  value: string,
): value is ChatSemanticModeScope {
  return (CHAT_SEMANTIC_MODE_SCOPES as readonly string[]).includes(value);
}

// ============================================================================
// MARK: Mode-aware novelty policy
// ============================================================================

/**
 * ChatSemanticModePolicy
 *
 * Each game mode imposes different novelty requirements. Predator requires
 * maximum variety in deal-room lines because repetition destroys the pressure.
 * Phantom requires ghost-aware semantic separation. Syndicate requires trust-
 * weighted NPC diversity. Empire requires isolation-consistent emotional range.
 */
export interface ChatSemanticModePolicy {
  readonly modeScope: ChatSemanticModeScope;
  readonly maxSimilarityToRecent01: Score01;
  readonly maxRecentClusterReuses: number;
  readonly rhetoricalPenaltyMultiplier: number;
  readonly callbackBoostAllowed: boolean;
  readonly silenceMarkerPassthrough: boolean;
  readonly ghostAwareFiltering: boolean;
  readonly trustWeightedDiversity: boolean;
  readonly dealRoomPressureAmplified: boolean;
  readonly recentWindowSize: number;
}

export const CHAT_SEMANTIC_MODE_POLICIES: Readonly<Record<ChatSemanticModeScope, ChatSemanticModePolicy>> =
  Object.freeze({
    GO_ALONE: Object.freeze<ChatSemanticModePolicy>({
      modeScope: 'GO_ALONE',
      maxSimilarityToRecent01: 0.68 as Score01,
      maxRecentClusterReuses: 3,
      rhetoricalPenaltyMultiplier: 1.0,
      callbackBoostAllowed: true,
      silenceMarkerPassthrough: true,
      ghostAwareFiltering: false,
      trustWeightedDiversity: false,
      dealRoomPressureAmplified: false,
      recentWindowSize: 20,
    }),
    HEAD_TO_HEAD: Object.freeze<ChatSemanticModePolicy>({
      modeScope: 'HEAD_TO_HEAD',
      maxSimilarityToRecent01: 0.58 as Score01,
      maxRecentClusterReuses: 2,
      rhetoricalPenaltyMultiplier: 1.4,
      callbackBoostAllowed: true,
      silenceMarkerPassthrough: true,
      ghostAwareFiltering: false,
      trustWeightedDiversity: false,
      dealRoomPressureAmplified: true,
      recentWindowSize: 16,
    }),
    TEAM_UP: Object.freeze<ChatSemanticModePolicy>({
      modeScope: 'TEAM_UP',
      maxSimilarityToRecent01: 0.65 as Score01,
      maxRecentClusterReuses: 3,
      rhetoricalPenaltyMultiplier: 1.2,
      callbackBoostAllowed: true,
      silenceMarkerPassthrough: false,
      ghostAwareFiltering: false,
      trustWeightedDiversity: true,
      dealRoomPressureAmplified: false,
      recentWindowSize: 18,
    }),
    CHASE_A_LEGEND: Object.freeze<ChatSemanticModePolicy>({
      modeScope: 'CHASE_A_LEGEND',
      maxSimilarityToRecent01: 0.55 as Score01,
      maxRecentClusterReuses: 2,
      rhetoricalPenaltyMultiplier: 1.6,
      callbackBoostAllowed: true,
      silenceMarkerPassthrough: true,
      ghostAwareFiltering: true,
      trustWeightedDiversity: false,
      dealRoomPressureAmplified: false,
      recentWindowSize: 14,
    }),
  });

// ============================================================================
// MARK: Pressure-band novelty thresholds
// ============================================================================

export interface ChatSemanticPressureThresholds {
  readonly pressureBand: ChatSemanticPressureBand;
  readonly maxSimilarityToRecent01: Score01;
  readonly maxRecentClusterReuses: number;
  readonly fatigueScoreCap01: Score01;
  readonly exactRepeatWindow: number;
  readonly rhetoricalFatigueWindow: number;
}

export const CHAT_SEMANTIC_PRESSURE_THRESHOLDS: Readonly<
  Record<ChatSemanticPressureBand, ChatSemanticPressureThresholds>
> = Object.freeze({
  CALM: Object.freeze<ChatSemanticPressureThresholds>({
    pressureBand: 'CALM',
    maxSimilarityToRecent01: 0.74 as Score01,
    maxRecentClusterReuses: 4,
    fatigueScoreCap01: 0.88 as Score01,
    exactRepeatWindow: 30,
    rhetoricalFatigueWindow: 12,
  }),
  BUILDING: Object.freeze<ChatSemanticPressureThresholds>({
    pressureBand: 'BUILDING',
    maxSimilarityToRecent01: 0.70 as Score01,
    maxRecentClusterReuses: 3,
    fatigueScoreCap01: 0.90 as Score01,
    exactRepeatWindow: 24,
    rhetoricalFatigueWindow: 10,
  }),
  ELEVATED: Object.freeze<ChatSemanticPressureThresholds>({
    pressureBand: 'ELEVATED',
    maxSimilarityToRecent01: 0.64 as Score01,
    maxRecentClusterReuses: 3,
    fatigueScoreCap01: 0.93 as Score01,
    exactRepeatWindow: 18,
    rhetoricalFatigueWindow: 8,
  }),
  HIGH: Object.freeze<ChatSemanticPressureThresholds>({
    pressureBand: 'HIGH',
    maxSimilarityToRecent01: 0.58 as Score01,
    maxRecentClusterReuses: 2,
    fatigueScoreCap01: 0.96 as Score01,
    exactRepeatWindow: 12,
    rhetoricalFatigueWindow: 6,
  }),
  CRITICAL: Object.freeze<ChatSemanticPressureThresholds>({
    pressureBand: 'CRITICAL',
    maxSimilarityToRecent01: 0.50 as Score01,
    maxRecentClusterReuses: 1,
    fatigueScoreCap01: 0.99 as Score01,
    exactRepeatWindow: 8,
    rhetoricalFatigueWindow: 4,
  }),
});

// ============================================================================
// MARK: Sparse vector entry
// ============================================================================

export interface ChatSemanticSparseVectorEntry {
  /** Dimension index in the embedding space (0 to config.dimensions-1). */
  readonly dimension: number;
  /** Weighted value at this dimension. */
  readonly value: number;
}

// ============================================================================
// MARK: Document contracts
// ============================================================================

/**
 * ChatSemanticDocumentInput
 *
 * Input shape for indexing a new dialogue line or system message.
 * All fields except `documentId`, `text`, and `createdAt` are optional — they
 * enrich the vector representation but are not required for basic operation.
 */
export interface ChatSemanticDocumentInput {
  /** Unique stable identifier for this document. Usually canonical line ID. */
  readonly documentId: string;
  /** Canonical line ID from the NPC dialogue registry or system message pool. */
  readonly canonicalLineId?: string;
  /** NPC actor ID if this document is from a specific NPC persona. */
  readonly actorId?: string;
  /** Bot ID (BOT_01–BOT_05) if this document is a hater line. */
  readonly botId?: string;
  /** The raw authored text. Normalized text is computed during indexing. */
  readonly text: string;
  /** Content tags from the NPC dialogue tree (e.g., 'distress', 'callback'). */
  readonly tags?: readonly string[];
  /** Motif IDs that this line participates in (cross-run narrative threads). */
  readonly motifIds?: readonly string[];
  /** Scene roles this line was authored for (OPENER, CLOSER, etc.). */
  readonly sceneRoles?: readonly string[];
  /** IDs of earlier messages this line references (for callback detection). */
  readonly callbackSourceIds?: readonly string[];
  /** Game pressure band at indexing time — enriches similarity context. */
  readonly pressureBand?: ChatSemanticPressureBand;
  /** Channel ID this line was authored for — enriches channel-aware filtering. */
  readonly channelId?: ChatChannelId;
  /** Mode scope this line was authored for — enriches mode-aware filtering. */
  readonly modeScope?: ChatSemanticModeScope;
  /** Unix ms creation timestamp. */
  readonly createdAt: number;
}

/**
 * ChatSemanticIndexedDocument
 *
 * A fully processed document stored in the index. All computed fields are
 * frozen at index time and never mutated after upsert.
 */
export interface ChatSemanticIndexedDocument {
  readonly documentId: string;
  readonly canonicalLineId: string | undefined;
  readonly actorId: string | null;
  readonly botId: string | null;
  readonly text: string;
  readonly normalizedText: string;
  readonly tokens: readonly string[];
  readonly weightedTerms: Readonly<Record<string, number>>;
  readonly rhetoricalForm: ChatSemanticRhetoricalForm;
  readonly rhetoricalFingerprint: string;
  readonly semanticClusterId: string;
  readonly sparseVector: readonly ChatSemanticSparseVectorEntry[];
  readonly vectorNorm: number;
  readonly tags: readonly string[];
  readonly motifIds: readonly string[];
  readonly sceneRoles: readonly string[];
  readonly callbackSourceIds: readonly string[];
  readonly pressureBand: ChatSemanticPressureBand | undefined;
  readonly channelId: ChatChannelId | undefined;
  readonly modeScope: ChatSemanticModeScope | undefined;
  readonly createdAt: number;
}

// ============================================================================
// MARK: Neighbor and query result contracts
// ============================================================================

export interface ChatSemanticNeighbor {
  readonly documentId: string;
  readonly canonicalLineId: string | undefined;
  readonly similarity01: Score01;
  readonly semanticClusterId: string;
  readonly rhetoricalForm: ChatSemanticRhetoricalForm;
  readonly overlapTokens: readonly string[];
  readonly tags: readonly string[];
  readonly notes: readonly string[];
}

export interface ChatSemanticQuery {
  readonly queryId: string;
  readonly text: string;
  readonly sceneRoles?: readonly string[];
  readonly pressureBand?: ChatSemanticPressureBand;
  readonly channelId?: ChatChannelId;
  readonly modeScope?: ChatSemanticModeScope;
  readonly preferredTags?: readonly string[];
  readonly excludedDocumentIds?: readonly string[];
  readonly minSimilarity01?: Score01;
  readonly maxResults?: number;
  readonly actorFilter?: string;
  readonly botIdFilter?: string;
  readonly now: number;
}

export interface ChatSemanticQueryResult {
  readonly queryId: string;
  readonly computedAt: number;
  readonly queryDocument: ChatSemanticIndexedDocument;
  readonly neighbors: readonly ChatSemanticNeighbor[];
}

// ============================================================================
// MARK: Novelty guard contracts
// ============================================================================

export interface ChatSemanticNoveltyGuardConfig {
  readonly maxSimilarityToRecent01: Score01;
  readonly maxRecentClusterReuses: number;
  readonly exactTextPenalty01: Score01;
  readonly clusterPenalty01: Score01;
  readonly rhetoricalPenalty01: Score01;
  readonly fatigueScoreCap01: Score01;
}

export const DEFAULT_CHAT_SEMANTIC_NOVELTY_GUARD: ChatSemanticNoveltyGuardConfig =
  Object.freeze({
    maxSimilarityToRecent01: 0.68 as Score01,
    maxRecentClusterReuses: 3,
    exactTextPenalty01: 1.0 as Score01,
    clusterPenalty01: 0.35 as Score01,
    rhetoricalPenalty01: 0.18 as Score01,
    fatigueScoreCap01: 0.98 as Score01,
  });

export interface ChatSemanticNoveltyGuardRequest {
  readonly requestId: string;
  readonly candidate: ChatSemanticDocumentInput;
  readonly recentDocuments: readonly ChatSemanticIndexedDocument[];
  readonly config?: Partial<ChatSemanticNoveltyGuardConfig>;
  readonly pressureBand?: ChatSemanticPressureBand;
  readonly modeScope?: ChatSemanticModeScope;
  readonly channelId?: ChatChannelId;
  readonly now: number;
}

export interface ChatSemanticNoveltyDecision {
  readonly requestId: string;
  readonly computedAt: number;
  readonly candidateDocument: ChatSemanticIndexedDocument;
  readonly allowed: boolean;
  readonly noveltyScore01: Score01;
  readonly fatigueScore01: Score01;
  readonly highestSimilarity01: Score01;
  readonly repeatedClusterCount: number;
  readonly repeatedRhetoricalCount: number;
  readonly nearestNeighbors: readonly ChatSemanticNeighbor[];
  readonly blockedReasons: readonly string[];
  readonly appliedPressureThreshold?: ChatSemanticPressureThresholds;
  readonly appliedModePolicy?: ChatSemanticModePolicy;
}

// ============================================================================
// MARK: Per-actor index contracts
// ============================================================================

/**
 * ChatSemanticActorIndexSlot
 *
 * A scoped index for a single NPC actor. Prevents cross-persona semantic
 * leakage — LIQUIDATOR clusters should not suppress MENTOR lines even if
 * they share surface words like "you" or "the room."
 */
export interface ChatSemanticActorIndexSlot {
  readonly actorId: string;
  readonly npcId: ChatNpcId | undefined;
  readonly npcClass: 'HATER' | 'HELPER' | 'AMBIENT' | 'SYSTEM' | 'UNKNOWN';
  readonly documentCount: number;
  readonly clusterCount: number;
  readonly lastIndexedAt: number;
}

// ============================================================================
// MARK: Federation key contracts
// ============================================================================

/**
 * ChatSemanticFederationScope
 *
 * Describes the scope of an index federation slot. The full index is federated
 * across three scopes: global (all lines ever), room (per session), and actor
 * (per NPC). This prevents a busy hater suppressing helpers via shared cluster
 * space.
 */
export const CHAT_SEMANTIC_FEDERATION_SCOPES = [
  'GLOBAL',   // Full corpus across all rooms and actors
  'ROOM',     // Per-room session window
  'ACTOR',    // Per-NPC actor window
  'CHANNEL',  // Per-channel window (DEAL_ROOM has its own novelty space)
] as const;

export type ChatSemanticFederationScope =
  (typeof CHAT_SEMANTIC_FEDERATION_SCOPES)[number];

// ============================================================================
// MARK: Decay contract
// ============================================================================

/**
 * ChatSemanticDecayCurve
 *
 * Similarity scores decay over time so that a line seen 50 ticks ago is
 * less penalizing than a line seen 2 ticks ago. The curve is applied during
 * novelty guard computation.
 */
export interface ChatSemanticDecayCurve {
  readonly halfLifeTicks: number;
  readonly floorDecayFactor01: Score01;
  readonly ceilDecayFactor01: Score01;
  readonly pressureBandAccelerator: Readonly<Record<ChatSemanticPressureBand, number>>;
}

export const DEFAULT_CHAT_SEMANTIC_DECAY_CURVE: ChatSemanticDecayCurve =
  Object.freeze({
    halfLifeTicks: 15,
    floorDecayFactor01: 0.12 as Score01,
    ceilDecayFactor01: 1.00 as Score01,
    pressureBandAccelerator: Object.freeze({
      CALM: 0.7,
      BUILDING: 0.85,
      ELEVATED: 1.0,
      HIGH: 1.2,
      CRITICAL: 1.5,
    }),
  });

// ============================================================================
// MARK: Snapshot and hydration contracts
// ============================================================================

export interface ChatSemanticIndexSnapshot {
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly dimensions: number;
  readonly documents: readonly ChatSemanticIndexedDocument[];
  readonly clusterMembership: Readonly<Record<string, readonly string[]>>;
  /** Actor slot map for federated actor indexes. Optional on basic snapshots. */
  readonly actorSlots?: Readonly<Record<string, ChatSemanticActorIndexSlot>>;
  /** Version tag for migration safety. */
  readonly snapshotVersion?: string;
}

// ============================================================================
// MARK: Training data export contracts
// ============================================================================

/**
 * ChatSemanticTrainingRow
 *
 * A single training sample for the ML similarity model. Generated when a
 * novelty guard fires — the system records which candidate was rejected,
 * why, and what the player experience context was.
 */
export interface ChatSemanticTrainingRow {
  readonly rowId: string;
  readonly candidateDocumentId: string;
  readonly nearestNeighborId: string;
  readonly similarity01: Score01;
  readonly noveltyScore01: Score01;
  readonly fatigueScore01: Score01;
  readonly allowed: boolean;
  readonly blockedReasons: readonly string[];
  readonly pressureBand: ChatSemanticPressureBand | undefined;
  readonly modeScope: ChatSemanticModeScope | undefined;
  readonly channelId: ChatChannelId | undefined;
  readonly tickNumber: number | undefined;
  readonly capturedAt: number;
}

// ============================================================================
// MARK: Telemetry record contracts
// ============================================================================

export interface ChatSemanticTelemetryRecord {
  readonly telemetryId: string;
  readonly eventType:
    | 'DOCUMENT_INDEXED'
    | 'NOVELTY_GUARD_ALLOWED'
    | 'NOVELTY_GUARD_BLOCKED'
    | 'QUERY_EXECUTED'
    | 'SNAPSHOT_CREATED'
    | 'HYDRATION_COMPLETED'
    | 'BATCH_INDEXED'
    | 'ACTOR_SLOT_CREATED'
    | 'CLUSTER_EVICTED'
    | 'DECAY_APPLIED';
  readonly documentId?: string;
  readonly clusterId?: string;
  readonly actorId?: string;
  readonly noveltyScore01?: Score01;
  readonly fatigueScore01?: Score01;
  readonly pressureBand?: ChatSemanticPressureBand;
  readonly modeScope?: ChatSemanticModeScope;
  readonly channelId?: ChatChannelId;
  readonly durationMs?: number;
  readonly capturedAt: number;
}

// ============================================================================
// MARK: Utility helpers
// ============================================================================

/**
 * clamp01
 * Clamps a number to the [0, 1] range. Used throughout the similarity
 * computation pipeline to ensure score invariants are preserved.
 */
export function clamp01(value: number): Score01 {
  if (value <= 0) return 0 as Score01;
  if (value >= 1) return 1 as Score01;
  return value as Score01;
}

/**
 * isChatSemanticRhetoricalForm
 * Runtime guard for the rhetorical form union.
 */
export function isChatSemanticRhetoricalForm(
  value: string,
): value is ChatSemanticRhetoricalForm {
  return (CHAT_SEMANTIC_RHETORICAL_FORMS as readonly string[]).includes(value);
}

/**
 * isChatSemanticPressureBand
 * Runtime guard for the pressure band union.
 */
export function isChatSemanticPressureBand(
  value: string,
): value is ChatSemanticPressureBand {
  return (CHAT_SEMANTIC_PRESSURE_BANDS as readonly string[]).includes(value);
}

/**
 * resolvePressureThresholds
 * Returns the novelty thresholds for a given pressure band, falling back
 * to ELEVATED if the band is unrecognized.
 */
export function resolvePressureThresholds(
  band: ChatSemanticPressureBand | undefined,
): ChatSemanticPressureThresholds {
  if (!band || !(band in CHAT_SEMANTIC_PRESSURE_THRESHOLDS)) {
    return CHAT_SEMANTIC_PRESSURE_THRESHOLDS.ELEVATED;
  }
  return CHAT_SEMANTIC_PRESSURE_THRESHOLDS[band];
}

/**
 * resolveModePolicy
 * Returns the novelty mode policy for a given mode scope, falling back
 * to GO_ALONE if the scope is unrecognized.
 */
export function resolveModePolicy(
  modeScope: ChatSemanticModeScope | undefined,
): ChatSemanticModePolicy {
  if (!modeScope || !(modeScope in CHAT_SEMANTIC_MODE_POLICIES)) {
    return CHAT_SEMANTIC_MODE_POLICIES.GO_ALONE;
  }
  return CHAT_SEMANTIC_MODE_POLICIES[modeScope];
}

// ============================================================================
// MARK: Contract manifest
// ============================================================================

export const CHAT_SEMANTIC_SIMILARITY_CONTRACT = Object.freeze({
  version: CHAT_SEMANTIC_SIMILARITY_CONTRACT_VERSION,
  authority: CHAT_SEMANTIC_SIMILARITY_CONTRACT_AUTHORITY,
  rhetoricalForms: CHAT_SEMANTIC_RHETORICAL_FORMS,
  modeScopes: CHAT_SEMANTIC_MODE_SCOPES,
  pressureBands: CHAT_SEMANTIC_PRESSURE_BANDS,
  pressureThresholds: CHAT_SEMANTIC_PRESSURE_THRESHOLDS,
  modePolicies: CHAT_SEMANTIC_MODE_POLICIES,
  defaultNoveltyGuard: DEFAULT_CHAT_SEMANTIC_NOVELTY_GUARD,
  defaultDecayCurve: DEFAULT_CHAT_SEMANTIC_DECAY_CURVE,
  federationScopes: CHAT_SEMANTIC_FEDERATION_SCOPES,
});