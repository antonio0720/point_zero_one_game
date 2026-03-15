/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TRAINING DATASET BUILDER
 * FILE: backend/src/game/engine/chat/training/DatasetBuilder.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Offline dataset assembly for the authoritative backend chat lane.
 *
 * This file is not a toy exporter and not a generic ML helper. It is the
 * training-side authority that turns accepted backend chat truth into
 * deterministic, replay-safe, model-ready examples.
 *
 * It only consumes authoritative artifacts:
 * - transcript truth
 * - proof edges
 * - replay artifacts
 * - telemetry truth
 * - inference snapshots
 * - authoritative signal envelopes
 * - accepted room/session/presence state
 *
 * It does not scrape raw client guesses and does not treat optimistic client
 * buffers as durable truth.
 *
 * Training doctrine encoded here
 * -----------------------------
 * 1. Dataset rows must be reproducible from authoritative room artifacts.
 * 2. Splits must be deterministic.
 * 3. Example windows must preserve causal context around anchor moments.
 * 4. Shadow / redacted / deleted material must remain auditable.
 * 5. Replay and proof chains must stay attached so label generation can reason
 *    about what actually happened after the anchor.
 * 6. The builder must support both classical ML tasks and sequence/DL tasks.
 *
 * Canonical lane alignment
 * ------------------------
 * Long-term authorities:
 * - /shared/contracts/chat
 * - /shared/contracts/chat/learning
 * - /backend/src/game/engine/chat
 * - /pzo-server/src/chat
 *
 * This file intentionally stays self-sufficient in phase one so it can land
 * immediately beside the already-created backend chat authority files without
 * forcing premature coupling to still-moving shared learning contracts.
 */

// ============================================================================
// MARK: Primitive types and JSON contracts
// ============================================================================

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export type UnixMs = number;
export type Score01 = number;
export type Score100 = number;
export type Percentage = number;

export type TrainingTaskKey =
  | 'ENGAGEMENT'
  | 'HATER_TARGETING'
  | 'HELPER_TIMING'
  | 'CHANNEL_AFFINITY'
  | 'TOXICITY_RISK'
  | 'CHURN_RISK'
  | 'INTERVENTION_POLICY'
  | 'RESPONSE_RANKING'
  | 'SEQUENCE_MEMORY'
  | 'MODERATION_OUTCOME';

export type TrainingSplit = 'TRAIN' | 'VALIDATION' | 'TEST';
export type TranscriptVisibility = 'VISIBLE' | 'SHADOW' | 'REDACTED' | 'DELETED';
export type TranscriptSourceType = 'PLAYER' | 'SYSTEM' | 'HATER' | 'HELPER' | 'AMBIENT' | 'MODERATOR' | string;
export type ModerationOutcome = 'ALLOWED' | 'MASKED' | 'REWRITTEN' | 'SHADOW_ONLY' | 'REJECTED' | string;
export type RateOutcome = 'ALLOWED' | 'THROTTLED' | 'COOLDOWN' | 'BLOCKED' | string;
export type InferenceSource = 'NONE' | 'HEURISTIC' | 'ML' | 'DL' | 'HYBRID' | string;

export type TrainingRoomId = string;
export type TrainingSessionId = string;
export type TrainingUserId = string;
export type TrainingMessageId = string;
export type TrainingEventId = string;
export type TrainingTelemetryId = string;
export type TrainingReplayId = string;
export type TrainingInferenceId = string;
export type TrainingProofEdgeId = string;
export type TrainingPersonaId = string;
export type TrainingChannelId = string;
export type TrainingSceneId = string;
export type TrainingMomentId = string;
export type TrainingLegendId = string;

export interface TrainingRange {
  readonly startSequenceNumber: number;
  readonly endSequenceNumber: number;
}

// ============================================================================
// MARK: Authoritative backend-artifact mirrors
// ============================================================================

export interface TrainingAffectSnapshot {
  readonly intimidation01?: Score01;
  readonly confidence01?: Score01;
  readonly frustration01?: Score01;
  readonly curiosity01?: Score01;
  readonly attachment01?: Score01;
  readonly embarrassment01?: Score01;
  readonly relief01?: Score01;
  readonly dominance01?: Score01;
  readonly desperation01?: Score01;
  readonly trust01?: Score01;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface TrainingMessagePolicyMetadata {
  readonly moderationOutcome: ModerationOutcome;
  readonly moderationReasons: readonly string[];
  readonly rateOutcome: RateOutcome;
  readonly commandName: string | null;
  readonly shadowOnly: boolean;
  readonly wasRewritten: boolean;
  readonly wasMasked: boolean;
}

export interface TrainingMessageReplayMetadata {
  readonly replayId: TrainingReplayId | null;
  readonly replayAnchorKey: string | null;
  readonly sceneId: TrainingSceneId | null;
  readonly momentId: TrainingMomentId | null;
  readonly legendId: TrainingLegendId | null;
}

export interface TrainingMessageLearningMetadata {
  readonly learningTriggered: boolean;
  readonly affectAfterMessage: TrainingAffectSnapshot | null;
  readonly inferenceSource: InferenceSource;
  readonly inferenceId: TrainingInferenceId | null;
}

export interface TrainingMessageProofMetadata {
  readonly proofHash: string | null;
  readonly causalParentMessageIds: readonly TrainingMessageId[];
  readonly causalParentEventIds: readonly TrainingEventId[];
}

export interface TrainingMessageBodyPart {
  readonly type: 'TEXT' | 'SYSTEM_TAG' | 'QUOTE' | 'OFFER' | 'EMOTE' | string;
  readonly text?: string;
  readonly tag?: string;
  readonly value?: string;
  readonly messageId?: TrainingMessageId;
  readonly offerId?: string;
  readonly summary?: string;
  readonly name?: string;
}

export interface TrainingMessageAttribution {
  readonly sourceType: TranscriptSourceType;
  readonly authorSessionId: TrainingSessionId | null;
  readonly authorUserId: TrainingUserId | null;
  readonly actorId: string;
  readonly displayName: string;
  readonly npcRole: string | null;
  readonly botId: string | null;
}

export interface TrainingTranscriptMessage {
  readonly id: TrainingMessageId;
  readonly roomId: TrainingRoomId;
  readonly channelId: TrainingChannelId;
  readonly sequenceNumber: number;
  readonly createdAt: UnixMs;
  readonly editedAt: UnixMs | null;
  readonly deletedAt: UnixMs | null;
  readonly redactedAt: UnixMs | null;
  readonly bodyParts: readonly TrainingMessageBodyPart[];
  readonly plainText: string;
  readonly attribution: TrainingMessageAttribution;
  readonly policy: TrainingMessagePolicyMetadata;
  readonly replay: TrainingMessageReplayMetadata;
  readonly learning: TrainingMessageLearningMetadata;
  readonly proof: TrainingMessageProofMetadata;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface TrainingTranscriptEntry {
  readonly message: TrainingTranscriptMessage;
  readonly appendedAt: UnixMs;
  readonly visibility: TranscriptVisibility;
}

export interface TrainingProofEdge {
  readonly id: TrainingProofEdgeId;
  readonly roomId: TrainingRoomId;
  readonly createdAt: UnixMs;
  readonly fromMessageId: TrainingMessageId | null;
  readonly fromEventId: TrainingEventId | null;
  readonly toMessageId: TrainingMessageId | null;
  readonly toReplayId: TrainingReplayId | null;
  readonly toTelemetryId: TrainingTelemetryId | null;
  readonly toInferenceId: TrainingInferenceId | null;
  readonly edgeType:
    | 'MESSAGE_TO_MESSAGE'
    | 'EVENT_TO_MESSAGE'
    | 'MESSAGE_TO_REPLAY'
    | 'MESSAGE_TO_TELEMETRY'
    | 'MESSAGE_TO_INFERENCE'
    | 'MODERATION_DECISION'
    | string;
  readonly hash: string;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface TrainingReplayArtifact {
  readonly id: TrainingReplayId;
  readonly roomId: TrainingRoomId;
  readonly createdAt: UnixMs;
  readonly eventId: TrainingEventId;
  readonly range: TrainingRange;
  readonly anchorKey: string;
  readonly label: string;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface TrainingTelemetryRecord {
  readonly id: TrainingTelemetryId;
  readonly roomId: TrainingRoomId;
  readonly eventId: TrainingEventId | null;
  readonly messageId: TrainingMessageId | null;
  readonly sessionId: TrainingSessionId | null;
  readonly emittedAt: UnixMs;
  readonly type: string;
  readonly actorType: string | null;
  readonly channelId: TrainingChannelId | null;
  readonly value01: Score01 | null;
  readonly value100: Score100 | null;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface TrainingInferenceSnapshot {
  readonly id: TrainingInferenceId;
  readonly roomId: TrainingRoomId;
  readonly sessionId: TrainingSessionId | null;
  readonly messageId: TrainingMessageId | null;
  readonly eventId: TrainingEventId | null;
  readonly inferredAt: UnixMs;
  readonly source: InferenceSource;
  readonly task: TrainingTaskKey | string;
  readonly score01: Score01 | null;
  readonly score100: Score100 | null;
  readonly label: string | null;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface TrainingSessionState {
  readonly sessionId: TrainingSessionId;
  readonly userId: TrainingUserId | null;
  readonly displayName: string;
  readonly role: string | null;
  readonly entitlementTier: string | null;
  readonly factionId: string | null;
  readonly joinedAt: UnixMs | null;
  readonly lastSeenAt: UnixMs | null;
  readonly mutedUntil: UnixMs | null;
  readonly shadowMuted: boolean;
  readonly invisible: boolean;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface TrainingPresenceSnapshot {
  readonly roomId: TrainingRoomId;
  readonly sessionId: TrainingSessionId;
  readonly mode: string;
  readonly visibleToRoom: boolean;
  readonly updatedAt: UnixMs;
  readonly spectating: boolean;
  readonly actorLabel: string;
}

export interface TrainingSignalEnvelope {
  readonly type: string;
  readonly emittedAt: UnixMs;
  readonly roomId: TrainingRoomId | null;
  readonly battle?: {
    readonly tickNumber?: number;
    readonly pressureTier?: string | null;
    readonly activeAttackType?: string | null;
    readonly activeBotId?: string | null;
    readonly hostileMomentum?: Score100;
    readonly rescueWindowOpen?: boolean;
    readonly shieldIntegrity01?: Score01;
    readonly lastAttackAt?: UnixMs | null;
  };
  readonly run?: {
    readonly runId?: string;
    readonly runPhase?: string;
    readonly tickTier?: string;
    readonly outcome?: string;
    readonly bankruptcyWarning?: boolean;
    readonly nearSovereignty?: boolean;
    readonly elapsedMs?: number;
  };
  readonly multiplayer?: {
    readonly roomMemberCount?: number;
    readonly partySize?: number;
    readonly spectatingCount?: number;
    readonly factionName?: string | null;
    readonly rankingPressure?: Score100;
  };
  readonly economy?: {
    readonly activeDealCount?: number;
    readonly liquidityStress01?: Score01;
    readonly overpayRisk01?: Score01;
    readonly bluffRisk01?: Score01;
  };
  readonly liveops?: {
    readonly worldEventName?: string | null;
    readonly heatMultiplier01?: Score01;
    readonly helperBlackout?: boolean;
    readonly haterRaidActive?: boolean;
  };
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface TrainingRoomArtifacts {
  readonly roomId: TrainingRoomId;
  readonly transcript: readonly TrainingTranscriptEntry[];
  readonly proofEdges: readonly TrainingProofEdge[];
  readonly replayArtifacts: readonly TrainingReplayArtifact[];
  readonly telemetry: readonly TrainingTelemetryRecord[];
  readonly inferenceSnapshots: readonly TrainingInferenceSnapshot[];
  readonly sessions: readonly TrainingSessionState[];
  readonly presence: readonly TrainingPresenceSnapshot[];
  readonly signals: readonly TrainingSignalEnvelope[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// MARK: Dataset output contracts
// ============================================================================

export interface TrainingScalarFeatures {
  readonly [key: string]: number;
}

export interface TrainingBooleanFeatures {
  readonly [key: string]: boolean;
}

export interface TrainingCategoricalFeatures {
  readonly [key: string]: string | null;
}

export interface TrainingSequenceFeatures {
  readonly [key: string]: readonly string[];
}

export interface TrainingExampleFeatures {
  readonly scalar: TrainingScalarFeatures;
  readonly boolean: TrainingBooleanFeatures;
  readonly categorical: TrainingCategoricalFeatures;
  readonly sequence: TrainingSequenceFeatures;
}

export interface TrainingEvidenceRef {
  readonly kind: 'MESSAGE' | 'TELEMETRY' | 'REPLAY' | 'PROOF' | 'INFERENCE' | 'SIGNAL' | 'SESSION' | 'PRESENCE';
  readonly id: string;
  readonly at: UnixMs | null;
  readonly role: string;
}

export interface TrainingWindow {
  readonly roomId: TrainingRoomId;
  readonly anchorMessageId: TrainingMessageId | null;
  readonly anchorEventId: TrainingEventId | null;
  readonly anchorTelemetryId: TrainingTelemetryId | null;
  readonly anchorReplayId: TrainingReplayId | null;
  readonly anchorInferenceId: TrainingInferenceId | null;
  readonly anchorAt: UnixMs;
  readonly lookbackMs: number;
  readonly lookaheadMs: number;
  readonly preMessages: readonly TrainingTranscriptEntry[];
  readonly anchorMessages: readonly TrainingTranscriptEntry[];
  readonly postMessages: readonly TrainingTranscriptEntry[];
  readonly telemetry: readonly TrainingTelemetryRecord[];
  readonly proofEdges: readonly TrainingProofEdge[];
  readonly replayArtifacts: readonly TrainingReplayArtifact[];
  readonly inferenceSnapshots: readonly TrainingInferenceSnapshot[];
  readonly signals: readonly TrainingSignalEnvelope[];
  readonly sessions: readonly TrainingSessionState[];
  readonly presence: readonly TrainingPresenceSnapshot[];
  readonly evidence: readonly TrainingEvidenceRef[];
}

export interface TrainingExample {
  readonly id: string;
  readonly task: TrainingTaskKey;
  readonly split: TrainingSplit;
  readonly roomId: TrainingRoomId;
  readonly sceneKey: string;
  readonly anchorKey: string;
  readonly anchorAt: UnixMs;
  readonly features: TrainingExampleFeatures;
  readonly window: TrainingWindow;
  readonly weakTargets: Readonly<Record<string, JsonValue>>;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface TrainingTaskDataset {
  readonly task: TrainingTaskKey;
  readonly examples: readonly TrainingExample[];
  readonly bySplit: Readonly<Record<TrainingSplit, readonly TrainingExample[]>>;
  readonly stats: TrainingTaskDatasetStats;
}

export interface TrainingTaskDatasetStats {
  readonly totalExamples: number;
  readonly trainExamples: number;
  readonly validationExamples: number;
  readonly testExamples: number;
  readonly roomCount: number;
  readonly sceneCount: number;
  readonly messageAnchors: number;
  readonly telemetryAnchors: number;
  readonly replayAnchors: number;
  readonly inferenceAnchors: number;
  readonly averageMessagesPerWindow: number;
  readonly averageTelemetryPerWindow: number;
  readonly shadowWindowCount: number;
  readonly moderationWindowCount: number;
}

export interface TrainingCorpusManifest {
  readonly version: string;
  readonly builtAt: UnixMs;
  readonly builderSignature: string;
  readonly taskCount: number;
  readonly roomCount: number;
  readonly sourceStats: TrainingSourceStats;
  readonly splitPolicy: TrainingSplitPolicy;
  readonly options: NormalizedTrainingBuildOptions;
}

export interface TrainingSourceStats {
  readonly transcriptEntries: number;
  readonly proofEdges: number;
  readonly replayArtifacts: number;
  readonly telemetryRecords: number;
  readonly inferenceSnapshots: number;
  readonly sessions: number;
  readonly presenceSnapshots: number;
  readonly signalEnvelopes: number;
}

export interface TrainingCorpus {
  readonly manifest: TrainingCorpusManifest;
  readonly tasks: Readonly<Record<TrainingTaskKey, TrainingTaskDataset>>;
}

// ============================================================================
// MARK: Builder configuration contracts
// ============================================================================

export interface TrainingSplitPolicy {
  readonly trainPercentage: Percentage;
  readonly validationPercentage: Percentage;
  readonly testPercentage: Percentage;
  readonly salt: string;
}

export interface TrainingTaskWindowPolicy {
  readonly lookbackMs: number;
  readonly lookaheadMs: number;
  readonly minimumVisibleMessages: number;
  readonly maximumMessages: number;
  readonly maximumTelemetry: number;
  readonly maximumProofEdges: number;
  readonly maximumReplayArtifacts: number;
  readonly maximumInferenceSnapshots: number;
}

export interface TrainingQualityGatePolicy {
  readonly excludeDeletedAnchors: boolean;
  readonly excludeRedactedAnchorsFromNonModerationTasks: boolean;
  readonly requireAcceptedAuthoritySignal: boolean;
  readonly allowShadowWindows: boolean;
  readonly dedupeIdenticalAnchorKeys: boolean;
  readonly minimumFeatureDensity: number;
}

export interface TrainingBuildOptions {
  readonly tasks?: readonly TrainingTaskKey[];
  readonly splitPolicy?: Partial<TrainingSplitPolicy>;
  readonly taskWindowPolicy?: Partial<Record<TrainingTaskKey, Partial<TrainingTaskWindowPolicy>>>;
  readonly quality?: Partial<TrainingQualityGatePolicy>;
  readonly enableWeakTargets?: boolean;
  readonly includeShadowExamples?: boolean;
  readonly includeModerationExamples?: boolean;
  readonly sceneMergeGapMs?: number;
  readonly sceneReplayBiasMs?: number;
}

export interface NormalizedTrainingBuildOptions {
  readonly tasks: readonly TrainingTaskKey[];
  readonly splitPolicy: TrainingSplitPolicy;
  readonly taskWindowPolicy: Readonly<Record<TrainingTaskKey, TrainingTaskWindowPolicy>>;
  readonly quality: TrainingQualityGatePolicy;
  readonly enableWeakTargets: boolean;
  readonly includeShadowExamples: boolean;
  readonly includeModerationExamples: boolean;
  readonly sceneMergeGapMs: number;
  readonly sceneReplayBiasMs: number;
}

// ============================================================================
// MARK: Internal room indexes
// ============================================================================

interface IndexedRoomArtifacts {
  readonly roomId: TrainingRoomId;
  readonly transcript: readonly TrainingTranscriptEntry[];
  readonly transcriptByMessageId: Readonly<Record<TrainingMessageId, TrainingTranscriptEntry>>;
  readonly proofEdges: readonly TrainingProofEdge[];
  readonly proofByMessageId: Readonly<Record<TrainingMessageId, readonly TrainingProofEdge[]>>;
  readonly proofByEventId: Readonly<Record<TrainingEventId, readonly TrainingProofEdge[]>>;
  readonly replayArtifacts: readonly TrainingReplayArtifact[];
  readonly replayByMessageId: Readonly<Record<TrainingMessageId, readonly TrainingReplayArtifact[]>>;
  readonly telemetry: readonly TrainingTelemetryRecord[];
  readonly telemetryByMessageId: Readonly<Record<TrainingMessageId, readonly TrainingTelemetryRecord[]>>;
  readonly telemetryByEventId: Readonly<Record<TrainingEventId, readonly TrainingTelemetryRecord[]>>;
  readonly inferenceSnapshots: readonly TrainingInferenceSnapshot[];
  readonly inferenceByMessageId: Readonly<Record<TrainingMessageId, readonly TrainingInferenceSnapshot[]>>;
  readonly signals: readonly TrainingSignalEnvelope[];
  readonly sessions: readonly TrainingSessionState[];
  readonly presence: readonly TrainingPresenceSnapshot[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
  readonly scenes: readonly IndexedScene[];
}

interface IndexedScene {
  readonly key: string;
  readonly roomId: TrainingRoomId;
  readonly startAt: UnixMs;
  readonly endAt: UnixMs;
  readonly anchorReplayIds: readonly TrainingReplayId[];
  readonly replayLabels: readonly string[];
  readonly range: TrainingRange | null;
  readonly messageIds: readonly TrainingMessageId[];
  readonly eventIds: readonly TrainingEventId[];
}

interface AnchorCandidate {
  readonly task: TrainingTaskKey;
  readonly roomId: TrainingRoomId;
  readonly sceneKey: string;
  readonly anchorMessageId: TrainingMessageId | null;
  readonly anchorEventId: TrainingEventId | null;
  readonly anchorTelemetryId: TrainingTelemetryId | null;
  readonly anchorReplayId: TrainingReplayId | null;
  readonly anchorInferenceId: TrainingInferenceId | null;
  readonly anchorAt: UnixMs;
  readonly reason: string;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

export const CHAT_TRAINING_DATASET_BUILDER_VERSION = '2026.03.14' as const;

const DEFAULT_TASKS: readonly TrainingTaskKey[] = Object.freeze([
  'ENGAGEMENT',
  'HATER_TARGETING',
  'HELPER_TIMING',
  'CHANNEL_AFFINITY',
  'TOXICITY_RISK',
  'CHURN_RISK',
  'INTERVENTION_POLICY',
  'RESPONSE_RANKING',
  'SEQUENCE_MEMORY',
  'MODERATION_OUTCOME',
]);

const DEFAULT_SPLIT_POLICY: TrainingSplitPolicy = Object.freeze({
  trainPercentage: 0.8,
  validationPercentage: 0.1,
  testPercentage: 0.1,
  salt: 'pzo-chat-training-2026-03-14',
});

const DEFAULT_WINDOW_POLICY: TrainingTaskWindowPolicy = Object.freeze({
  lookbackMs: 45_000,
  lookaheadMs: 60_000,
  minimumVisibleMessages: 1,
  maximumMessages: 120,
  maximumTelemetry: 200,
  maximumProofEdges: 120,
  maximumReplayArtifacts: 24,
  maximumInferenceSnapshots: 64,
});

const DEFAULT_QUALITY_POLICY: TrainingQualityGatePolicy = Object.freeze({
  excludeDeletedAnchors: true,
  excludeRedactedAnchorsFromNonModerationTasks: true,
  requireAcceptedAuthoritySignal: true,
  allowShadowWindows: true,
  dedupeIdenticalAnchorKeys: true,
  minimumFeatureDensity: 0.15,
});

const TASK_WINDOW_OVERRIDES: Readonly<Record<TrainingTaskKey, TrainingTaskWindowPolicy>> = Object.freeze({
  ENGAGEMENT: { ...DEFAULT_WINDOW_POLICY, lookbackMs: 30_000, lookaheadMs: 45_000 },
  HATER_TARGETING: { ...DEFAULT_WINDOW_POLICY, lookbackMs: 60_000, lookaheadMs: 35_000 },
  HELPER_TIMING: { ...DEFAULT_WINDOW_POLICY, lookbackMs: 75_000, lookaheadMs: 60_000 },
  CHANNEL_AFFINITY: { ...DEFAULT_WINDOW_POLICY, lookbackMs: 40_000, lookaheadMs: 25_000 },
  TOXICITY_RISK: { ...DEFAULT_WINDOW_POLICY, lookbackMs: 50_000, lookaheadMs: 20_000 },
  CHURN_RISK: { ...DEFAULT_WINDOW_POLICY, lookbackMs: 90_000, lookaheadMs: 120_000 },
  INTERVENTION_POLICY: { ...DEFAULT_WINDOW_POLICY, lookbackMs: 90_000, lookaheadMs: 75_000 },
  RESPONSE_RANKING: { ...DEFAULT_WINDOW_POLICY, lookbackMs: 30_000, lookaheadMs: 20_000 },
  SEQUENCE_MEMORY: { ...DEFAULT_WINDOW_POLICY, lookbackMs: 180_000, lookaheadMs: 30_000, maximumMessages: 180 },
  MODERATION_OUTCOME: { ...DEFAULT_WINDOW_POLICY, lookbackMs: 20_000, lookaheadMs: 10_000 },
});

const HELP_LEXICON = Object.freeze(['help', 'how', 'stuck', 'what do i do', 'why did', 'explain', 'teach']);
const FLEX_LEXICON = Object.freeze(['easy', 'too easy', 'owned', 'dominated', 'cooked', 'i won', 'i am him']);
const TROLL_LEXICON = Object.freeze(['cope', 'cry', 'trash', 'skill issue', 'ratio', 'clown']);
const STRATEGIC_LEXICON = Object.freeze(['hedge', 'rotate', 'reserve', 'tempo', 'window', 'counter', 'sequence', 'timing']);
const TOXIC_LEXICON = Object.freeze(['idiot', 'stupid', 'hate', 'kill', 'loser', 'worthless', 'garbage']);
const RAGE_TELEMETRY_TYPES = Object.freeze(['chat_closed', 'rage_quit_risk', 'rapid_channel_hop', 'help_ignored']);
const RESCUE_TELEMETRY_TYPES = Object.freeze(['helper_fire', 'recovery_prompt', 'rescue_window_opened']);

// ============================================================================
// MARK: Dataset builder implementation
// ============================================================================

export class DatasetBuilder {
  private readonly roomArtifactsById = new Map<TrainingRoomId, TrainingRoomArtifacts>();
  private readonly options: NormalizedTrainingBuildOptions;

  public constructor(options: TrainingBuildOptions = {}) {
    this.options = normalizeBuildOptions(options);
  }

  public registerRoomArtifacts(bundle: TrainingRoomArtifacts): this {
    this.roomArtifactsById.set(bundle.roomId, freezeRoomArtifacts(bundle));
    return this;
  }

  public registerRoomArtifactsMany(bundles: readonly TrainingRoomArtifacts[]): this {
    for (const bundle of bundles) {
      this.registerRoomArtifacts(bundle);
    }
    return this;
  }

  public clear(): this {
    this.roomArtifactsById.clear();
    return this;
  }

  public getRegisteredRoomIds(): readonly TrainingRoomId[] {
    return Object.freeze([...this.roomArtifactsById.keys()].sort());
  }

  public buildCorpus(): TrainingCorpus {
    const indexedRooms = [...this.roomArtifactsById.values()]
      .map((bundle) => this.indexRoomArtifacts(bundle))
      .sort((a, b) => compareStrings(a.roomId, b.roomId));

    const sourceStats = accumulateSourceStats(indexedRooms);
    const taskDatasets = {} as Record<TrainingTaskKey, TrainingTaskDataset>;

    for (const task of this.options.tasks) {
      const examples = this.buildTaskExamples(task, indexedRooms);
      const bySplit = Object.freeze({
        TRAIN: Object.freeze(examples.filter((example) => example.split === 'TRAIN')),
        VALIDATION: Object.freeze(examples.filter((example) => example.split === 'VALIDATION')),
        TEST: Object.freeze(examples.filter((example) => example.split === 'TEST')),
      });

      taskDatasets[task] = Object.freeze({
        task,
        examples: Object.freeze(examples),
        bySplit,
        stats: this.buildTaskStats(examples),
      });
    }

    const manifest: TrainingCorpusManifest = Object.freeze({
      version: CHAT_TRAINING_DATASET_BUILDER_VERSION,
      builtAt: Date.now(),
      builderSignature: 'backend/src/game/engine/chat/training/DatasetBuilder.ts',
      taskCount: this.options.tasks.length,
      roomCount: indexedRooms.length,
      sourceStats,
      splitPolicy: this.options.splitPolicy,
      options: this.options,
    });

    return Object.freeze({
      manifest,
      tasks: Object.freeze(taskDatasets),
    });
  }

  public exportTaskNdjson(corpus: TrainingCorpus, task: TrainingTaskKey): string {
    const dataset = corpus.tasks[task];
    return dataset.examples.map((example) => JSON.stringify(example)).join('\n');
  }

  public exportCorpusManifest(corpus: TrainingCorpus): string {
    return JSON.stringify(corpus.manifest, null, 2);
  }

  private indexRoomArtifacts(bundle: TrainingRoomArtifacts): IndexedRoomArtifacts {
    const transcript = Object.freeze(
      [...bundle.transcript]
        .map(normalizeTranscriptEntry)
        .sort(compareTranscriptEntries),
    );

    const proofEdges = Object.freeze(
      [...bundle.proofEdges]
        .map((edge) => freezeShallow(edge))
        .sort((a, b) => compareNumbers(a.createdAt, b.createdAt) || compareStrings(a.id, b.id)),
    );

    const replayArtifacts = Object.freeze(
      [...bundle.replayArtifacts]
        .map((artifact) => freezeShallow(artifact))
        .sort((a, b) => compareNumbers(a.createdAt, b.createdAt) || compareStrings(a.id, b.id)),
    );

    const telemetry = Object.freeze(
      [...bundle.telemetry]
        .map((record) => freezeShallow(record))
        .sort((a, b) => compareNumbers(a.emittedAt, b.emittedAt) || compareStrings(a.id, b.id)),
    );

    const inferenceSnapshots = Object.freeze(
      [...bundle.inferenceSnapshots]
        .map((snapshot) => freezeShallow(snapshot))
        .sort((a, b) => compareNumbers(a.inferredAt, b.inferredAt) || compareStrings(a.id, b.id)),
    );

    const signals = Object.freeze(
      [...bundle.signals]
        .map((signal) => freezeShallow(signal))
        .sort((a, b) => compareNumbers(a.emittedAt, b.emittedAt) || compareStrings(a.type, b.type)),
    );

    const sessions = Object.freeze(
      [...bundle.sessions]
        .map((session) => freezeShallow(session))
        .sort((a, b) => compareStrings(a.sessionId, b.sessionId)),
    );

    const presence = Object.freeze(
      [...bundle.presence]
        .map((snapshot) => freezeShallow(snapshot))
        .sort((a, b) => compareNumbers(a.updatedAt, b.updatedAt) || compareStrings(a.sessionId, b.sessionId)),
    );

    const transcriptByMessageId = Object.freeze(
      transcript.reduce<Record<TrainingMessageId, TrainingTranscriptEntry>>((acc, entry) => {
        acc[entry.message.id] = entry;
        return acc;
      }, Object.create(null) as Record<TrainingMessageId, TrainingTranscriptEntry>),
    );

    const proofByMessageId = indexMany(proofEdges, (edge) => [edge.fromMessageId, edge.toMessageId].filter(Boolean) as string[]);
    const proofByEventId = indexMany(proofEdges, (edge) => edge.fromEventId ? [edge.fromEventId] : []);
    const replayByMessageId = indexReplayByMessageId(replayArtifacts, transcript);
    const telemetryByMessageId = indexMany(telemetry, (record) => record.messageId ? [record.messageId] : []);
    const telemetryByEventId = indexMany(telemetry, (record) => record.eventId ? [record.eventId] : []);
    const inferenceByMessageId = indexMany(inferenceSnapshots, (snapshot) => snapshot.messageId ? [snapshot.messageId] : []);
    const scenes = this.buildScenes(bundle.roomId, transcript, replayArtifacts, telemetry, signals, proofEdges);

    return Object.freeze({
      roomId: bundle.roomId,
      transcript,
      transcriptByMessageId,
      proofEdges,
      proofByMessageId,
      proofByEventId,
      replayArtifacts,
      replayByMessageId,
      telemetry,
      telemetryByMessageId,
      telemetryByEventId,
      inferenceSnapshots,
      inferenceByMessageId,
      signals,
      sessions,
      presence,
      metadata: freezeRecord(bundle.metadata ?? {}),
      scenes,
    });
  }

  private buildScenes(
    roomId: TrainingRoomId,
    transcript: readonly TrainingTranscriptEntry[],
    replayArtifacts: readonly TrainingReplayArtifact[],
    telemetry: readonly TrainingTelemetryRecord[],
    signals: readonly TrainingSignalEnvelope[],
    proofEdges: readonly TrainingProofEdge[],
  ): readonly IndexedScene[] {
    if (replayArtifacts.length === 0) {
      return this.buildSyntheticScenes(roomId, transcript, telemetry, signals);
    }

    const scenes: IndexedScene[] = [];
    let current: IndexedScene | null = null;

    for (const artifact of replayArtifacts) {
      const startAt = deriveReplayStartAt(artifact, transcript);
      const endAt = deriveReplayEndAt(artifact, transcript);

      if (current && startAt - current.endAt <= this.options.sceneMergeGapMs) {
        const currentScene: IndexedScene = current as IndexedScene;
        current = Object.freeze({
          ...currentScene,
          endAt: Math.max(currentScene.endAt, endAt),
          anchorReplayIds: Object.freeze([...currentScene.anchorReplayIds, artifact.id]),
          replayLabels: Object.freeze([...currentScene.replayLabels, artifact.label]),
          range: mergeRanges(currentScene.range, artifact.range),
          eventIds: Object.freeze([...currentScene.eventIds, artifact.eventId]),
          messageIds: Object.freeze(
            uniqueStrings([
              ...currentScene.messageIds,
              ...collectMessageIdsInRange(transcript, artifact.range),
            ]),
          ),
        }) as IndexedScene;
        scenes[scenes.length - 1] = current;
        continue;
      }

      current = Object.freeze({
        key: `scene:${roomId}:${artifact.anchorKey}`,
        roomId,
        startAt,
        endAt,
        anchorReplayIds: Object.freeze([artifact.id]),
        replayLabels: Object.freeze([artifact.label]),
        range: artifact.range,
        messageIds: Object.freeze(collectMessageIdsInRange(transcript, artifact.range)),
        eventIds: Object.freeze([artifact.eventId]),
      });
      scenes.push(current);
    }

    return Object.freeze(scenes.map((scene) => enrichSceneEventIds(scene, telemetry, signals, proofEdges)));
  }

  private buildSyntheticScenes(
    roomId: TrainingRoomId,
    transcript: readonly TrainingTranscriptEntry[],
    telemetry: readonly TrainingTelemetryRecord[],
    signals: readonly TrainingSignalEnvelope[],
  ): readonly IndexedScene[] {
    if (transcript.length === 0 && telemetry.length === 0 && signals.length === 0) {
      return Object.freeze([]);
    }

    const anchors = uniqueNumbers([
      ...transcript.map((entry) => entry.message.createdAt),
      ...telemetry.map((record) => record.emittedAt),
      ...signals.map((signal) => signal.emittedAt),
    ]).sort(compareNumbers);

    const scenes: IndexedScene[] = [];
    let currentStart = anchors[0] ?? 0;
    let currentEnd = anchors[0] ?? 0;
    let counter = 0;

    for (let index = 1; index < anchors.length; index += 1) {
      const point = anchors[index]!;
      if (point - currentEnd <= this.options.sceneMergeGapMs) {
        currentEnd = point;
        continue;
      }

      scenes.push(this.materializeSyntheticScene(roomId, transcript, currentStart, currentEnd, counter));
      counter += 1;
      currentStart = point;
      currentEnd = point;
    }

    scenes.push(this.materializeSyntheticScene(roomId, transcript, currentStart, currentEnd, counter));
    return Object.freeze(scenes);
  }

  private materializeSyntheticScene(
    roomId: TrainingRoomId,
    transcript: readonly TrainingTranscriptEntry[],
    startAt: UnixMs,
    endAt: UnixMs,
    ordinal: number,
  ): IndexedScene {
    const messageIds = transcript
      .filter((entry) => entry.message.createdAt >= startAt && entry.message.createdAt <= endAt)
      .map((entry) => entry.message.id);

    const range = buildRangeFromMessageIds(transcript, messageIds);

    return Object.freeze({
      key: `scene:${roomId}:synthetic:${ordinal}`,
      roomId,
      startAt,
      endAt,
      anchorReplayIds: Object.freeze([]),
      replayLabels: Object.freeze([]),
      range,
      messageIds: Object.freeze(messageIds),
      eventIds: Object.freeze([]),
    });
  }

  private buildTaskExamples(task: TrainingTaskKey, indexedRooms: readonly IndexedRoomArtifacts[]): readonly TrainingExample[] {
    const examples: TrainingExample[] = [];
    const seenAnchorKeys = new Set<string>();

    for (const room of indexedRooms) {
      const candidates = this.deriveCandidatesForTask(task, room);
      for (const candidate of candidates) {
        const anchorKey = buildAnchorKey(task, candidate);
        if (this.options.quality.dedupeIdenticalAnchorKeys && seenAnchorKeys.has(anchorKey)) {
          continue;
        }

        const window = this.buildWindow(room, task, candidate);
        if (!this.windowPassesQualityGate(task, window)) {
          continue;
        }

        const features = this.extractFeatures(task, window);
        if (!this.featureDensityPasses(features)) {
          continue;
        }

        const split = determineSplit(anchorKey, this.options.splitPolicy);
        const example: TrainingExample = Object.freeze({
          id: buildExampleId(task, room.roomId, anchorKey),
          task,
          split,
          roomId: room.roomId,
          sceneKey: candidate.sceneKey,
          anchorKey,
          anchorAt: candidate.anchorAt,
          features,
          window,
          weakTargets: this.options.enableWeakTargets ? this.buildWeakTargets(task, window) : Object.freeze({}),
          metadata: Object.freeze({
            reason: candidate.reason,
            roomMetadata: room.metadata,
          }),
        });

        examples.push(example);
        seenAnchorKeys.add(anchorKey);
      }
    }

    return Object.freeze(examples.sort(compareExamples));
  }

  private deriveCandidatesForTask(task: TrainingTaskKey, room: IndexedRoomArtifacts): readonly AnchorCandidate[] {
    switch (task) {
      case 'ENGAGEMENT':
        return this.deriveEngagementCandidates(room);
      case 'HATER_TARGETING':
        return this.deriveHaterTargetingCandidates(room);
      case 'HELPER_TIMING':
        return this.deriveHelperTimingCandidates(room);
      case 'CHANNEL_AFFINITY':
        return this.deriveChannelAffinityCandidates(room);
      case 'TOXICITY_RISK':
        return this.deriveToxicityCandidates(room);
      case 'CHURN_RISK':
        return this.deriveChurnCandidates(room);
      case 'INTERVENTION_POLICY':
        return this.deriveInterventionCandidates(room);
      case 'RESPONSE_RANKING':
        return this.deriveResponseRankingCandidates(room);
      case 'SEQUENCE_MEMORY':
        return this.deriveSequenceMemoryCandidates(room);
      case 'MODERATION_OUTCOME':
        return this.deriveModerationCandidates(room);
      default:
        return Object.freeze([]);
    }
  }

  private deriveEngagementCandidates(room: IndexedRoomArtifacts): readonly AnchorCandidate[] {
    return Object.freeze(
      room.transcript
        .filter((entry) => entry.visibility !== 'DELETED')
        .filter((entry) => entry.message.attribution.sourceType === 'PLAYER')
        .map((entry) => this.buildMessageCandidate('ENGAGEMENT', room, entry, 'player_message')),
    );
  }

  private deriveHaterTargetingCandidates(room: IndexedRoomArtifacts): readonly AnchorCandidate[] {
    const messageCandidates = room.transcript
      .filter((entry) => entry.message.attribution.sourceType === 'PLAYER')
      .filter((entry) => messageLooksLikeHaterBait(entry.message))
      .map((entry) => this.buildMessageCandidate('HATER_TARGETING', room, entry, 'bait_message'));

    const signalCandidates = room.signals
      .filter((signal) => Boolean(signal.battle?.activeAttackType || signal.battle?.hostileMomentum))
      .map((signal) => this.buildSignalCandidate('HATER_TARGETING', room, signal, 'battle_hostility'));

    return Object.freeze([...messageCandidates, ...signalCandidates].sort(compareCandidates));
  }

  private deriveHelperTimingCandidates(room: IndexedRoomArtifacts): readonly AnchorCandidate[] {
    const distressedMessages = room.transcript
      .filter((entry) => entry.message.attribution.sourceType === 'PLAYER')
      .filter((entry) => messageLooksLikeHelp(entry.message) || messageLooksDistressed(entry.message))
      .map((entry) => this.buildMessageCandidate('HELPER_TIMING', room, entry, 'distress_message'));

    const rescueSignals = room.signals
      .filter((signal) => signal.battle?.rescueWindowOpen || signal.run?.bankruptcyWarning)
      .map((signal) => this.buildSignalCandidate('HELPER_TIMING', room, signal, 'rescue_window'));

    return Object.freeze([...distressedMessages, ...rescueSignals].sort(compareCandidates));
  }

  private deriveChannelAffinityCandidates(room: IndexedRoomArtifacts): readonly AnchorCandidate[] {
    return Object.freeze(
      room.transcript
        .filter((entry) => entry.visibility !== 'DELETED')
        .map((entry) => this.buildMessageCandidate('CHANNEL_AFFINITY', room, entry, 'channel_decision'))
        .sort(compareCandidates),
    );
  }

  private deriveToxicityCandidates(room: IndexedRoomArtifacts): readonly AnchorCandidate[] {
    const toxicMessages = room.transcript
      .filter((entry) => entry.message.attribution.sourceType === 'PLAYER' || entry.message.attribution.sourceType === 'HATER')
      .filter((entry) => entry.message.policy.moderationOutcome !== 'ALLOWED' || messageLooksToxic(entry.message))
      .map((entry) => this.buildMessageCandidate('TOXICITY_RISK', room, entry, 'moderation_or_lexicon'));

    return Object.freeze(toxicMessages.sort(compareCandidates));
  }

  private deriveChurnCandidates(room: IndexedRoomArtifacts): readonly AnchorCandidate[] {
    const rageTelemetry = room.telemetry
      .filter((record) => RAGE_TELEMETRY_TYPES.includes(record.type) || record.type.includes('drop') || record.type.includes('rage'))
      .map((record) => this.buildTelemetryCandidate('CHURN_RISK', room, record, 'rage_telemetry'));

    const silenceCandidates = deriveLongSilenceCandidates(room)
      .map((candidate) => ({
        task: 'CHURN_RISK' as const,
        roomId: room.roomId,
        sceneKey: candidate.sceneKey,
        anchorMessageId: candidate.anchorMessageId,
        anchorEventId: null,
        anchorTelemetryId: null,
        anchorReplayId: null,
        anchorInferenceId: null,
        anchorAt: candidate.anchorAt,
        reason: 'long_player_silence',
      }));

    return Object.freeze([...rageTelemetry, ...silenceCandidates].sort(compareCandidates));
  }

  private deriveInterventionCandidates(room: IndexedRoomArtifacts): readonly AnchorCandidate[] {
    const helperTelemetry = room.telemetry
      .filter((record) => RESCUE_TELEMETRY_TYPES.includes(record.type))
      .map((record) => this.buildTelemetryCandidate('INTERVENTION_POLICY', room, record, 'helper_or_recovery_event'));

    const distressMessages = room.transcript
      .filter((entry) => entry.message.attribution.sourceType === 'PLAYER')
      .filter((entry) => messageLooksDistressed(entry.message) || messageLooksLikeHelp(entry.message))
      .map((entry) => this.buildMessageCandidate('INTERVENTION_POLICY', room, entry, 'distressed_player'));

    return Object.freeze([...helperTelemetry, ...distressMessages].sort(compareCandidates));
  }

  private deriveResponseRankingCandidates(room: IndexedRoomArtifacts): readonly AnchorCandidate[] {
    const candidateMessages = room.transcript
      .filter((entry) => entry.visibility !== 'DELETED')
      .filter((entry) => ['PLAYER', 'HATER', 'HELPER', 'SYSTEM'].includes(entry.message.attribution.sourceType))
      .map((entry) => this.buildMessageCandidate('RESPONSE_RANKING', room, entry, 'dialogue_turn'));

    return Object.freeze(candidateMessages.sort(compareCandidates));
  }

  private deriveSequenceMemoryCandidates(room: IndexedRoomArtifacts): readonly AnchorCandidate[] {
    const replayCandidates = room.replayArtifacts.map((artifact) => this.buildReplayCandidate('SEQUENCE_MEMORY', room, artifact, 'replay_anchor'));
    const proofCandidates = room.proofEdges
      .filter((edge) => edge.edgeType === 'MESSAGE_TO_REPLAY' || edge.edgeType === 'MESSAGE_TO_INFERENCE')
      .map((edge) => this.buildProofCandidate('SEQUENCE_MEMORY', room, edge, 'proof_chain_memory'));

    return Object.freeze([...replayCandidates, ...proofCandidates].sort(compareCandidates));
  }

  private deriveModerationCandidates(room: IndexedRoomArtifacts): readonly AnchorCandidate[] {
    return Object.freeze(
      room.transcript
        .filter((entry) => entry.message.policy.moderationOutcome !== 'ALLOWED' || entry.message.policy.wasMasked || entry.message.policy.wasRewritten)
        .map((entry) => this.buildMessageCandidate('MODERATION_OUTCOME', room, entry, 'moderation_decision'))
        .sort(compareCandidates),
    );
  }

  private buildMessageCandidate(
    task: TrainingTaskKey,
    room: IndexedRoomArtifacts,
    entry: TrainingTranscriptEntry,
    reason: string,
  ): AnchorCandidate {
    return Object.freeze({
      task,
      roomId: room.roomId,
      sceneKey: this.resolveSceneKeyForMessage(room, entry.message.id, entry.message.createdAt),
      anchorMessageId: entry.message.id,
      anchorEventId: pickFirst(entry.message.proof.causalParentEventIds),
      anchorTelemetryId: null,
      anchorReplayId: entry.message.replay.replayId,
      anchorInferenceId: entry.message.learning.inferenceId,
      anchorAt: entry.message.createdAt,
      reason,
    });
  }

  private buildTelemetryCandidate(
    task: TrainingTaskKey,
    room: IndexedRoomArtifacts,
    record: TrainingTelemetryRecord,
    reason: string,
  ): AnchorCandidate {
    return Object.freeze({
      task,
      roomId: room.roomId,
      sceneKey: this.resolveSceneKeyAt(room, record.emittedAt),
      anchorMessageId: record.messageId,
      anchorEventId: record.eventId,
      anchorTelemetryId: record.id,
      anchorReplayId: null,
      anchorInferenceId: null,
      anchorAt: record.emittedAt,
      reason,
    });
  }

  private buildReplayCandidate(
    task: TrainingTaskKey,
    room: IndexedRoomArtifacts,
    artifact: TrainingReplayArtifact,
    reason: string,
  ): AnchorCandidate {
    return Object.freeze({
      task,
      roomId: room.roomId,
      sceneKey: this.resolveSceneKeyAt(room, artifact.createdAt),
      anchorMessageId: pickFirst(collectMessageIdsInRange(room.transcript, artifact.range)),
      anchorEventId: artifact.eventId,
      anchorTelemetryId: null,
      anchorReplayId: artifact.id,
      anchorInferenceId: null,
      anchorAt: artifact.createdAt,
      reason,
    });
  }

  private buildProofCandidate(
    task: TrainingTaskKey,
    room: IndexedRoomArtifacts,
    edge: TrainingProofEdge,
    reason: string,
  ): AnchorCandidate {
    const anchorAt = edge.createdAt;
    return Object.freeze({
      task,
      roomId: room.roomId,
      sceneKey: this.resolveSceneKeyAt(room, anchorAt),
      anchorMessageId: edge.fromMessageId ?? edge.toMessageId,
      anchorEventId: edge.fromEventId,
      anchorTelemetryId: edge.toTelemetryId,
      anchorReplayId: edge.toReplayId,
      anchorInferenceId: edge.toInferenceId,
      anchorAt,
      reason,
    });
  }

  private buildSignalCandidate(
    task: TrainingTaskKey,
    room: IndexedRoomArtifacts,
    signal: TrainingSignalEnvelope,
    reason: string,
  ): AnchorCandidate {
    const eventId = extractSignalEventId(signal);
    return Object.freeze({
      task,
      roomId: room.roomId,
      sceneKey: this.resolveSceneKeyAt(room, signal.emittedAt),
      anchorMessageId: null,
      anchorEventId: eventId,
      anchorTelemetryId: null,
      anchorReplayId: null,
      anchorInferenceId: null,
      anchorAt: signal.emittedAt,
      reason,
    });
  }

  private buildWindow(room: IndexedRoomArtifacts, task: TrainingTaskKey, candidate: AnchorCandidate): TrainingWindow {
    const policy = this.options.taskWindowPolicy[task];
    const startAt = candidate.anchorAt - policy.lookbackMs;
    const endAt = candidate.anchorAt + policy.lookaheadMs;
    const anchorMessageIds = uniqueStrings([
      candidate.anchorMessageId ?? '',
      ...(candidate.anchorReplayId ? findReplayAnchorMessageIds(room, candidate.anchorReplayId) : []),
    ].filter(Boolean));

    const allMessages = room.transcript.filter((entry) => entry.message.createdAt >= startAt && entry.message.createdAt <= endAt);
    const preMessages = allMessages.filter((entry) => entry.message.createdAt < candidate.anchorAt).slice(-policy.maximumMessages);
    const anchorMessages = allMessages.filter((entry) => anchorMessageIds.includes(entry.message.id));
    const postMessages = allMessages.filter((entry) => entry.message.createdAt >= candidate.anchorAt).slice(0, policy.maximumMessages);

    const telemetry = room.telemetry
      .filter((record) => record.emittedAt >= startAt && record.emittedAt <= endAt)
      .slice(0, policy.maximumTelemetry);

    const proofEdges = room.proofEdges
      .filter((edge) => edge.createdAt >= startAt && edge.createdAt <= endAt)
      .slice(0, policy.maximumProofEdges);

    const replayArtifacts = room.replayArtifacts
      .filter((artifact) => artifact.createdAt >= startAt - this.options.sceneReplayBiasMs && artifact.createdAt <= endAt + this.options.sceneReplayBiasMs)
      .slice(0, policy.maximumReplayArtifacts);

    const inferenceSnapshots = room.inferenceSnapshots
      .filter((snapshot) => snapshot.inferredAt >= startAt && snapshot.inferredAt <= endAt)
      .slice(0, policy.maximumInferenceSnapshots);

    const signals = room.signals.filter((signal) => signal.emittedAt >= startAt && signal.emittedAt <= endAt);
    const sessions = room.sessions;
    const presence = room.presence.filter((snapshot) => snapshot.updatedAt >= startAt && snapshot.updatedAt <= endAt);

    const evidence = collectWindowEvidence(candidate, preMessages, anchorMessages, postMessages, telemetry, proofEdges, replayArtifacts, inferenceSnapshots, signals, sessions, presence);

    return Object.freeze({
      roomId: room.roomId,
      anchorMessageId: candidate.anchorMessageId,
      anchorEventId: candidate.anchorEventId,
      anchorTelemetryId: candidate.anchorTelemetryId,
      anchorReplayId: candidate.anchorReplayId,
      anchorInferenceId: candidate.anchorInferenceId,
      anchorAt: candidate.anchorAt,
      lookbackMs: policy.lookbackMs,
      lookaheadMs: policy.lookaheadMs,
      preMessages: Object.freeze(preMessages),
      anchorMessages: Object.freeze(anchorMessages),
      postMessages: Object.freeze(postMessages),
      telemetry: Object.freeze(telemetry),
      proofEdges: Object.freeze(proofEdges),
      replayArtifacts: Object.freeze(replayArtifacts),
      inferenceSnapshots: Object.freeze(inferenceSnapshots),
      signals: Object.freeze(signals),
      sessions: Object.freeze(sessions),
      presence: Object.freeze(presence),
      evidence: Object.freeze(evidence),
    });
  }

  private windowPassesQualityGate(task: TrainingTaskKey, window: TrainingWindow): boolean {
    const anchorEntry = window.anchorMessageId ? findTranscriptEntry(window, window.anchorMessageId) : null;

    if (anchorEntry && this.options.quality.excludeDeletedAnchors && anchorEntry.visibility === 'DELETED') {
      return false;
    }

    if (
      anchorEntry &&
      this.options.quality.excludeRedactedAnchorsFromNonModerationTasks &&
      task !== 'MODERATION_OUTCOME' &&
      anchorEntry.visibility === 'REDACTED'
    ) {
      return false;
    }

    if (!this.options.includeShadowExamples && containsShadowWindow(window)) {
      return false;
    }

    if (task !== 'MODERATION_OUTCOME' && !this.options.includeModerationExamples && containsModeratedWindow(window)) {
      return false;
    }

    if (this.options.quality.requireAcceptedAuthoritySignal) {
      const hasAuthority = Boolean(window.anchorMessages.length || window.telemetry.length || window.replayArtifacts.length || window.inferenceSnapshots.length);
      if (!hasAuthority) {
        return false;
      }
    }

    const visibleCount = countVisibleMessages(window);
    return visibleCount >= this.options.taskWindowPolicy[task].minimumVisibleMessages;
  }

  private extractFeatures(task: TrainingTaskKey, window: TrainingWindow): TrainingExampleFeatures {
    const allMessages = [...window.preMessages, ...window.anchorMessages, ...window.postMessages];
    const visibleMessages = allMessages.filter((entry) => entry.visibility === 'VISIBLE');
    const playerMessages = visibleMessages.filter((entry) => entry.message.attribution.sourceType === 'PLAYER');
    const helperMessages = visibleMessages.filter((entry) => entry.message.attribution.sourceType === 'HELPER');
    const haterMessages = visibleMessages.filter((entry) => entry.message.attribution.sourceType === 'HATER');
    const systemMessages = visibleMessages.filter((entry) => entry.message.attribution.sourceType === 'SYSTEM');
    const anchorText = window.anchorMessages.map((entry) => entry.message.plainText).join(' ').trim();
    const playerText = playerMessages.map((entry) => entry.message.plainText).join(' ').trim();
    const haterText = haterMessages.map((entry) => entry.message.plainText).join(' ').trim();
    const helperText = helperMessages.map((entry) => entry.message.plainText).join(' ').trim();
    const fullText = visibleMessages.map((entry) => entry.message.plainText).join(' ').trim();

    const latestSignal = pickLatest(window.signals, (signal) => signal.emittedAt);
    const latestAffect = pickLatest(window.anchorMessages.map((entry) => entry.message.learning.affectAfterMessage).filter(Boolean) as TrainingAffectSnapshot[], () => window.anchorAt);
    const latestRunSignal = pickLatest(window.signals.filter((signal) => Boolean(signal.run)), (signal) => signal.emittedAt);
    const latestBattleSignal = pickLatest(window.signals.filter((signal) => Boolean(signal.battle)), (signal) => signal.emittedAt);
    const latestEconomySignal = pickLatest(window.signals.filter((signal) => Boolean(signal.economy)), (signal) => signal.emittedAt);
    const latestLiveopsSignal = pickLatest(window.signals.filter((signal) => Boolean(signal.liveops)), (signal) => signal.emittedAt);

    const scalar: TrainingScalarFeatures = {
      message_count_total: allMessages.length,
      message_count_visible: visibleMessages.length,
      message_count_player: playerMessages.length,
      message_count_helper: helperMessages.length,
      message_count_hater: haterMessages.length,
      message_count_system: systemMessages.length,
      telemetry_count: window.telemetry.length,
      replay_count: window.replayArtifacts.length,
      proof_edge_count: window.proofEdges.length,
      inference_count: window.inferenceSnapshots.length,
      silence_before_anchor_ms: deriveSilenceBeforeAnchor(window),
      silence_after_anchor_ms: deriveSilenceAfterAnchor(window),
      average_message_length: average(visibleMessages.map((entry) => entry.message.plainText.length)),
      player_help_lexicon_hits: lexiconHits(playerText, HELP_LEXICON),
      player_flex_lexicon_hits: lexiconHits(playerText, FLEX_LEXICON),
      player_troll_lexicon_hits: lexiconHits(playerText, TROLL_LEXICON),
      player_strategic_lexicon_hits: lexiconHits(playerText, STRATEGIC_LEXICON),
      toxic_lexicon_hits: lexiconHits(fullText, TOXIC_LEXICON),
      moderation_hit_count: allMessages.filter((entry) => entry.message.policy.moderationOutcome !== 'ALLOWED').length,
      shadow_count: allMessages.filter((entry) => entry.visibility === 'SHADOW').length,
      redact_count: allMessages.filter((entry) => entry.visibility === 'REDACTED').length,
      delete_count: allMessages.filter((entry) => entry.visibility === 'DELETED').length,
      hater_after_anchor_count: window.postMessages.filter((entry) => entry.message.attribution.sourceType === 'HATER').length,
      helper_after_anchor_count: window.postMessages.filter((entry) => entry.message.attribution.sourceType === 'HELPER').length,
      reply_after_anchor_count: window.postMessages.filter((entry) => entry.message.attribution.sourceType === 'PLAYER').length,
      recovery_telemetry_count: window.telemetry.filter((record) => RESCUE_TELEMETRY_TYPES.includes(record.type)).length,
      rage_telemetry_count: window.telemetry.filter((record) => RAGE_TELEMETRY_TYPES.includes(record.type)).length,
      hostile_momentum_100: latestBattleSignal?.battle?.hostileMomentum ?? 0,
      shield_integrity_01: latestBattleSignal?.battle?.shieldIntegrity01 ?? 0,
      ranking_pressure_100: latestSignal?.multiplayer?.rankingPressure ?? 0,
      liquidity_stress_01: latestEconomySignal?.economy?.liquidityStress01 ?? 0,
      overpay_risk_01: latestEconomySignal?.economy?.overpayRisk01 ?? 0,
      bluff_risk_01: latestEconomySignal?.economy?.bluffRisk01 ?? 0,
      heat_multiplier_01: latestLiveopsSignal?.liveops?.heatMultiplier01 ?? 0,
      intimidation_01: latestAffect?.intimidation01 ?? 0,
      confidence_01: latestAffect?.confidence01 ?? 0,
      frustration_01: latestAffect?.frustration01 ?? 0,
      curiosity_01: latestAffect?.curiosity01 ?? 0,
      attachment_01: latestAffect?.attachment01 ?? 0,
      embarrassment_01: latestAffect?.embarrassment01 ?? 0,
      relief_01: latestAffect?.relief01 ?? 0,
      dominance_01: latestAffect?.dominance01 ?? 0,
      desperation_01: latestAffect?.desperation01 ?? 0,
      trust_01: latestAffect?.trust01 ?? 0,
      elapsed_run_ms: latestRunSignal?.run?.elapsedMs ?? 0,
      near_bankruptcy_flag_as_score: latestRunSignal?.run?.bankruptcyWarning ? 1 : 0,
      near_sovereignty_flag_as_score: latestRunSignal?.run?.nearSovereignty ? 1 : 0,
      task_bias: taskBiasValue(task),
    };

    const boolean: TrainingBooleanFeatures = {
      has_anchor_message: window.anchorMessageId !== null,
      has_anchor_telemetry: window.anchorTelemetryId !== null,
      has_anchor_replay: window.anchorReplayId !== null,
      has_anchor_inference: window.anchorInferenceId !== null,
      rescue_window_open: Boolean(latestBattleSignal?.battle?.rescueWindowOpen),
      bankruptcy_warning: Boolean(latestRunSignal?.run?.bankruptcyWarning),
      near_sovereignty: Boolean(latestRunSignal?.run?.nearSovereignty),
      helper_blackout: Boolean(latestLiveopsSignal?.liveops?.helperBlackout),
      hater_raid_active: Boolean(latestLiveopsSignal?.liveops?.haterRaidActive),
      world_event_active: Boolean(latestLiveopsSignal?.liveops?.worldEventName),
      contains_shadow_content: containsShadowWindow(window),
      contains_moderation: containsModeratedWindow(window),
      anchor_was_rewritten: Boolean(window.anchorMessages.some((entry) => entry.message.policy.wasRewritten)),
      anchor_was_masked: Boolean(window.anchorMessages.some((entry) => entry.message.policy.wasMasked)),
      player_asked_for_help: lexiconHits(anchorText || playerText, HELP_LEXICON) > 0,
      player_flexed: lexiconHits(anchorText || playerText, FLEX_LEXICON) > 0,
      player_trolled: lexiconHits(anchorText || playerText, TROLL_LEXICON) > 0,
      player_used_strategic_language: lexiconHits(anchorText || playerText, STRATEGIC_LEXICON) > 0,
      anchor_contains_toxicity: lexiconHits(anchorText, TOXIC_LEXICON) > 0,
      post_window_contains_recovery: postWindowContains(window, ['recovery', 'saved', 'stabilized', 'breathe']),
      post_window_contains_escalation: postWindowContains(window, ['swarm', 'liquidation', 'compliance', 'attack']),
      room_is_stage_like: fullText.toLowerCase().includes('crowd') || fullText.toLowerCase().includes('room'),
    };

    const categorical: TrainingCategoricalFeatures = {
      anchor_channel: window.anchorMessages[0]?.message.channelId ?? inferDominantChannel(allMessages),
      anchor_source_type: window.anchorMessages[0]?.message.attribution.sourceType ?? null,
      dominant_channel: inferDominantChannel(allMessages),
      dominant_source: inferDominantSource(allMessages),
      pressure_tier: latestBattleSignal?.battle?.pressureTier ?? null,
      attack_type: latestBattleSignal?.battle?.activeAttackType ?? null,
      active_bot_id: latestBattleSignal?.battle?.activeBotId ?? null,
      tick_tier: latestRunSignal?.run?.tickTier ?? null,
      run_outcome: latestRunSignal?.run?.outcome ?? null,
      run_phase: latestRunSignal?.run?.runPhase ?? null,
      world_event_name: latestLiveopsSignal?.liveops?.worldEventName ?? null,
      inference_task: window.inferenceSnapshots[0]?.task ?? null,
      inference_label: window.inferenceSnapshots[0]?.label ?? null,
    };

    const sequence: TrainingSequenceFeatures = {
      message_ids: allMessages.map((entry) => entry.message.id),
      channels: uniqueStrings(allMessages.map((entry) => entry.message.channelId)),
      source_types: uniqueStrings(allMessages.map((entry) => entry.message.attribution.sourceType)),
      moderation_outcomes: uniqueStrings(allMessages.map((entry) => entry.message.policy.moderationOutcome)),
      replay_labels: uniqueStrings(window.replayArtifacts.map((artifact) => artifact.label)),
      telemetry_types: uniqueStrings(window.telemetry.map((record) => record.type)),
      evidence_roles: uniqueStrings(window.evidence.map((ref) => ref.role)),
      helper_personas: uniqueStrings(helperMessages.map((entry) => entry.message.attribution.actorId)),
      hater_personas: uniqueStrings(haterMessages.map((entry) => entry.message.attribution.actorId)),
      anchor_tags: uniqueStrings(window.anchorMessages.flatMap((entry) => entry.message.tags)),
      quoted_message_ids: uniqueStrings(window.anchorMessages.flatMap((entry) => entry.message.bodyParts.filter((part) => part.type === 'QUOTE').map((part) => part.messageId ?? ''))),
      offer_ids: uniqueStrings(window.anchorMessages.flatMap((entry) => entry.message.bodyParts.filter((part) => part.type === 'OFFER').map((part) => part.offerId ?? ''))),
      signal_types: uniqueStrings(window.signals.map((signal) => signal.type)),
      raw_anchor_tokens: tokenize(anchorText),
      raw_player_tokens: tokenize(playerText),
      raw_hater_tokens: tokenize(haterText),
      raw_helper_tokens: tokenize(helperText),
    };

    return Object.freeze({
      scalar: Object.freeze(scalar),
      boolean: Object.freeze(boolean),
      categorical: Object.freeze(categorical),
      sequence: Object.freeze(sequence),
    });
  }

  private featureDensityPasses(features: TrainingExampleFeatures): boolean {
    const populated = countPopulatedFeatures(features);
    const total = countTotalFeatureSlots(features);
    const density = total === 0 ? 0 : populated / total;
    return density >= this.options.quality.minimumFeatureDensity;
  }

  private buildWeakTargets(task: TrainingTaskKey, window: TrainingWindow): Readonly<Record<string, JsonValue>> {
    switch (task) {
      case 'ENGAGEMENT':
        return Object.freeze({
          reply_after_anchor: window.postMessages.some((entry) => entry.message.attribution.sourceType === 'PLAYER'),
          reply_count_after_anchor: window.postMessages.filter((entry) => entry.message.attribution.sourceType === 'PLAYER').length,
        });
      case 'HATER_TARGETING':
        return Object.freeze({
          hater_fired: window.postMessages.some((entry) => entry.message.attribution.sourceType === 'HATER'),
          hostile_telemetry: window.telemetry.some((record) => record.type.includes('hater') || record.type.includes('attack')),
        });
      case 'HELPER_TIMING':
        return Object.freeze({
          helper_fired: window.postMessages.some((entry) => entry.message.attribution.sourceType === 'HELPER'),
          recovery_telemetry: window.telemetry.some((record) => RESCUE_TELEMETRY_TYPES.includes(record.type)),
        });
      case 'CHANNEL_AFFINITY':
        return Object.freeze({
          dominant_channel: inferDominantChannel([...window.preMessages, ...window.anchorMessages, ...window.postMessages]),
        });
      case 'TOXICITY_RISK':
        return Object.freeze({
          moderation_hit: containsModeratedWindow(window),
          toxic_post_reaction: postWindowContains(window, ['masked', 'rewrite', 'watch it', 'easy now']),
        });
      case 'CHURN_RISK':
        return Object.freeze({
          long_silence_after_anchor_ms: deriveSilenceAfterAnchor(window),
          rage_signal_after_anchor: window.telemetry.some((record) => RAGE_TELEMETRY_TYPES.includes(record.type)),
        });
      case 'INTERVENTION_POLICY':
        return Object.freeze({
          helper_fired: window.postMessages.some((entry) => entry.message.attribution.sourceType === 'HELPER'),
          hater_fired: window.postMessages.some((entry) => entry.message.attribution.sourceType === 'HATER'),
          recovery_detected: postWindowContains(window, ['recover', 'breathe', 'stabilize', 'steady']),
        });
      case 'RESPONSE_RANKING':
        return Object.freeze({
          next_visible_response_source: window.postMessages[0]?.message.attribution.sourceType ?? null,
          next_visible_response_text: window.postMessages[0]?.message.plainText ?? null,
        });
      case 'SEQUENCE_MEMORY':
        return Object.freeze({
          replay_count: window.replayArtifacts.length,
          proof_depth: window.proofEdges.length,
          callback_material_present: window.anchorMessages.some((entry) => entry.message.bodyParts.some((part) => part.type === 'QUOTE')),
        });
      case 'MODERATION_OUTCOME':
        return Object.freeze({
          moderation_outcome: window.anchorMessages[0]?.message.policy.moderationOutcome ?? null,
          was_masked: window.anchorMessages.some((entry) => entry.message.policy.wasMasked),
          was_rewritten: window.anchorMessages.some((entry) => entry.message.policy.wasRewritten),
        });
      default:
        return Object.freeze({});
    }
  }

  private buildTaskStats(examples: readonly TrainingExample[]): TrainingTaskDatasetStats {
    const roomCount = new Set(examples.map((example) => example.roomId)).size;
    const sceneCount = new Set(examples.map((example) => example.sceneKey)).size;

    return Object.freeze({
      totalExamples: examples.length,
      trainExamples: examples.filter((example) => example.split === 'TRAIN').length,
      validationExamples: examples.filter((example) => example.split === 'VALIDATION').length,
      testExamples: examples.filter((example) => example.split === 'TEST').length,
      roomCount,
      sceneCount,
      messageAnchors: examples.filter((example) => example.window.anchorMessageId !== null).length,
      telemetryAnchors: examples.filter((example) => example.window.anchorTelemetryId !== null).length,
      replayAnchors: examples.filter((example) => example.window.anchorReplayId !== null).length,
      inferenceAnchors: examples.filter((example) => example.window.anchorInferenceId !== null).length,
      averageMessagesPerWindow: average(examples.map((example) => countMessages(example.window))),
      averageTelemetryPerWindow: average(examples.map((example) => example.window.telemetry.length)),
      shadowWindowCount: examples.filter((example) => containsShadowWindow(example.window)).length,
      moderationWindowCount: examples.filter((example) => containsModeratedWindow(example.window)).length,
    });
  }

  private resolveSceneKeyForMessage(room: IndexedRoomArtifacts, messageId: TrainingMessageId, fallbackAt: UnixMs): string {
    const scene = room.scenes.find((candidate) => candidate.messageIds.includes(messageId));
    return scene?.key ?? this.resolveSceneKeyAt(room, fallbackAt);
  }

  private resolveSceneKeyAt(room: IndexedRoomArtifacts, point: UnixMs): string {
    const scene = room.scenes.find((candidate) => point >= candidate.startAt && point <= candidate.endAt);
    return scene?.key ?? `scene:${room.roomId}:floating:${Math.floor(point / 1000)}`;
  }
}

// ============================================================================
// MARK: Option normalization helpers
// ============================================================================

function normalizeBuildOptions(options: TrainingBuildOptions): NormalizedTrainingBuildOptions {
  const tasks = Object.freeze([...(options.tasks ?? DEFAULT_TASKS)]);
  const splitPolicy = Object.freeze({
    ...DEFAULT_SPLIT_POLICY,
    ...(options.splitPolicy ?? {}),
  });

  const taskWindowPolicy = Object.freeze(
    tasks.reduce<Record<TrainingTaskKey, TrainingTaskWindowPolicy>>((acc, task) => {
      acc[task] = Object.freeze({
        ...TASK_WINDOW_OVERRIDES[task],
        ...((options.taskWindowPolicy ?? {})[task] ?? {}),
      });
      return acc;
    }, createTaskRecord(() => DEFAULT_WINDOW_POLICY)),
  );

  const quality = Object.freeze({
    ...DEFAULT_QUALITY_POLICY,
    ...(options.quality ?? {}),
  });

  return Object.freeze({
    tasks,
    splitPolicy,
    taskWindowPolicy,
    quality,
    enableWeakTargets: options.enableWeakTargets ?? true,
    includeShadowExamples: options.includeShadowExamples ?? true,
    includeModerationExamples: options.includeModerationExamples ?? true,
    sceneMergeGapMs: options.sceneMergeGapMs ?? 12_000,
    sceneReplayBiasMs: options.sceneReplayBiasMs ?? 4_000,
  });
}

// ============================================================================
// MARK: Room artifact normalization helpers
// ============================================================================

function freezeRoomArtifacts(bundle: TrainingRoomArtifacts): TrainingRoomArtifacts {
  return Object.freeze({
    roomId: bundle.roomId,
    transcript: Object.freeze([...bundle.transcript].map(normalizeTranscriptEntry)),
    proofEdges: Object.freeze([...bundle.proofEdges].map((edge) => freezeShallow(edge))),
    replayArtifacts: Object.freeze([...bundle.replayArtifacts].map((artifact) => freezeShallow(artifact))),
    telemetry: Object.freeze([...bundle.telemetry].map((record) => freezeShallow(record))),
    inferenceSnapshots: Object.freeze([...bundle.inferenceSnapshots].map((snapshot) => freezeShallow(snapshot))),
    sessions: Object.freeze([...bundle.sessions].map((session) => freezeShallow(session))),
    presence: Object.freeze([...bundle.presence].map((presence) => freezeShallow(presence))),
    signals: Object.freeze([...bundle.signals].map((signal) => freezeShallow(signal))),
    metadata: freezeRecord(bundle.metadata ?? {}),
  });
}

function normalizeTranscriptEntry(entry: TrainingTranscriptEntry): TrainingTranscriptEntry {
  return Object.freeze({
    appendedAt: entry.appendedAt,
    visibility: entry.visibility,
    message: Object.freeze({
      ...entry.message,
      bodyParts: Object.freeze([...(entry.message.bodyParts ?? [])]),
      tags: Object.freeze([...(entry.message.tags ?? [])]),
      metadata: freezeRecord(entry.message.metadata ?? {}),
      attribution: Object.freeze({ ...entry.message.attribution }),
      policy: Object.freeze({
        ...entry.message.policy,
        moderationReasons: Object.freeze([...(entry.message.policy.moderationReasons ?? [])]),
      }),
      replay: Object.freeze({ ...entry.message.replay }),
      learning: Object.freeze({
        ...entry.message.learning,
        affectAfterMessage: entry.message.learning.affectAfterMessage
          ? Object.freeze({ ...entry.message.learning.affectAfterMessage })
          : null,
      }),
      proof: Object.freeze({
        ...entry.message.proof,
        causalParentMessageIds: Object.freeze([...(entry.message.proof.causalParentMessageIds ?? [])]),
        causalParentEventIds: Object.freeze([...(entry.message.proof.causalParentEventIds ?? [])]),
      }),
    }),
  });
}

function indexMany<T extends { readonly id: string }>(items: readonly T[], keys: (item: T) => readonly string[]): Readonly<Record<string, readonly T[]>> {
  const acc: Record<string, T[]> = Object.create(null);
  for (const item of items) {
    for (const key of keys(item)) {
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
    }
  }
  return Object.freeze(
    Object.keys(acc).reduce<Record<string, readonly T[]>>((result, key) => {
      result[key] = Object.freeze(acc[key]!.slice());
      return result;
    }, Object.create(null) as Record<string, readonly T[]>),
  );
}

function indexReplayByMessageId(
  replayArtifacts: readonly TrainingReplayArtifact[],
  transcript: readonly TrainingTranscriptEntry[],
): Readonly<Record<TrainingMessageId, readonly TrainingReplayArtifact[]>> {
  const map: Record<string, TrainingReplayArtifact[]> = Object.create(null);
  for (const artifact of replayArtifacts) {
    const ids = collectMessageIdsInRange(transcript, artifact.range);
    for (const id of ids) {
      if (!map[id]) {
        map[id] = [];
      }
      map[id].push(artifact);
    }
  }
  return Object.freeze(
    Object.keys(map).reduce<Record<string, readonly TrainingReplayArtifact[]>>((acc, key) => {
      acc[key] = Object.freeze(map[key]!.slice());
      return acc;
    }, Object.create(null) as Record<string, readonly TrainingReplayArtifact[]>),
  );
}

function accumulateSourceStats(indexedRooms: readonly IndexedRoomArtifacts[]): TrainingSourceStats {
  return Object.freeze(indexedRooms.reduce<TrainingSourceStats>((acc, room) => ({
    transcriptEntries: acc.transcriptEntries + room.transcript.length,
    proofEdges: acc.proofEdges + room.proofEdges.length,
    replayArtifacts: acc.replayArtifacts + room.replayArtifacts.length,
    telemetryRecords: acc.telemetryRecords + room.telemetry.length,
    inferenceSnapshots: acc.inferenceSnapshots + room.inferenceSnapshots.length,
    sessions: acc.sessions + room.sessions.length,
    presenceSnapshots: acc.presenceSnapshots + room.presence.length,
    signalEnvelopes: acc.signalEnvelopes + room.signals.length,
  }), {
    transcriptEntries: 0,
    proofEdges: 0,
    replayArtifacts: 0,
    telemetryRecords: 0,
    inferenceSnapshots: 0,
    sessions: 0,
    presenceSnapshots: 0,
    signalEnvelopes: 0,
  }));
}

function enrichSceneEventIds(
  scene: IndexedScene,
  telemetry: readonly TrainingTelemetryRecord[],
  signals: readonly TrainingSignalEnvelope[],
  proofEdges: readonly TrainingProofEdge[],
): IndexedScene {
  const eventIds = uniqueStrings([
    ...scene.eventIds,
    ...telemetry
      .filter((record) => record.emittedAt >= scene.startAt && record.emittedAt <= scene.endAt)
      .map((record) => record.eventId ?? '')
      .filter(Boolean),
    ...proofEdges
      .filter((edge) => edge.createdAt >= scene.startAt && edge.createdAt <= scene.endAt)
      .map((edge) => edge.fromEventId ?? '')
      .filter(Boolean),
    ...signals.map(extractSignalEventId).filter(Boolean) as string[],
  ]);

  return Object.freeze({
    ...scene,
    eventIds: Object.freeze(eventIds),
  });
}

// ============================================================================
// MARK: Feature extraction helpers
// ============================================================================

function countVisibleMessages(window: TrainingWindow): number {
  return [...window.preMessages, ...window.anchorMessages, ...window.postMessages].filter((entry) => entry.visibility === 'VISIBLE').length;
}

function countMessages(window: TrainingWindow): number {
  return window.preMessages.length + window.anchorMessages.length + window.postMessages.length;
}

function findTranscriptEntry(window: TrainingWindow, messageId: TrainingMessageId): TrainingTranscriptEntry | null {
  for (const entry of [...window.preMessages, ...window.anchorMessages, ...window.postMessages]) {
    if (entry.message.id === messageId) {
      return entry;
    }
  }
  return null;
}

function containsShadowWindow(window: TrainingWindow): boolean {
  return [...window.preMessages, ...window.anchorMessages, ...window.postMessages].some((entry) => entry.visibility === 'SHADOW');
}

function containsModeratedWindow(window: TrainingWindow): boolean {
  return [...window.preMessages, ...window.anchorMessages, ...window.postMessages].some((entry) => entry.message.policy.moderationOutcome !== 'ALLOWED');
}

function deriveSilenceBeforeAnchor(window: TrainingWindow): number {
  const lastPlayerBefore = [...window.preMessages]
    .reverse()
    .find((entry) => entry.message.attribution.sourceType === 'PLAYER');
  return lastPlayerBefore ? Math.max(0, window.anchorAt - lastPlayerBefore.message.createdAt) : window.lookbackMs;
}

function deriveSilenceAfterAnchor(window: TrainingWindow): number {
  const firstPlayerAfter = window.postMessages.find((entry) => entry.message.attribution.sourceType === 'PLAYER');
  return firstPlayerAfter ? Math.max(0, firstPlayerAfter.message.createdAt - window.anchorAt) : window.lookaheadMs;
}

function lexiconHits(text: string, lexicon: readonly string[]): number {
  const lowered = text.toLowerCase();
  return lexicon.reduce((count, phrase) => count + (lowered.includes(phrase) ? 1 : 0), 0);
}

function inferDominantChannel(entries: readonly TrainingTranscriptEntry[]): string | null {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.message.channelId, (counts.get(entry.message.channelId) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]))[0]?.[0] ?? null;
}

function inferDominantSource(entries: readonly TrainingTranscriptEntry[]): string | null {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.message.attribution.sourceType, (counts.get(entry.message.attribution.sourceType) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]))[0]?.[0] ?? null;
}

function postWindowContains(window: TrainingWindow, needles: readonly string[]): boolean {
  const lowered = window.postMessages.map((entry) => entry.message.plainText.toLowerCase()).join(' ');
  return needles.some((needle) => lowered.includes(needle.toLowerCase()));
}

function taskBiasValue(task: TrainingTaskKey): number {
  switch (task) {
    case 'ENGAGEMENT': return 0.11;
    case 'HATER_TARGETING': return 0.22;
    case 'HELPER_TIMING': return 0.33;
    case 'CHANNEL_AFFINITY': return 0.44;
    case 'TOXICITY_RISK': return 0.55;
    case 'CHURN_RISK': return 0.66;
    case 'INTERVENTION_POLICY': return 0.77;
    case 'RESPONSE_RANKING': return 0.88;
    case 'SEQUENCE_MEMORY': return 0.93;
    case 'MODERATION_OUTCOME': return 0.99;
    default: return 0;
  }
}

function countPopulatedFeatures(features: TrainingExampleFeatures): number {
  return [
    ...Object.values(features.scalar).map((value) => Number.isFinite(value) ? 1 : 0),
    ...Object.values(features.boolean).map(() => 1),
    ...Object.values(features.categorical).map((value) => value ? 1 : 0),
    ...Object.values(features.sequence).map((value) => value.length > 0 ? 1 : 0),
  ].reduce((sum, value) => sum + value, 0);
}

function countTotalFeatureSlots(features: TrainingExampleFeatures): number {
  return Object.keys(features.scalar).length
    + Object.keys(features.boolean).length
    + Object.keys(features.categorical).length
    + Object.keys(features.sequence).length;
}

// ============================================================================
// MARK: Weak-target / candidate heuristics
// ============================================================================

function messageLooksLikeHelp(message: TrainingTranscriptMessage): boolean {
  return lexiconHits(message.plainText, HELP_LEXICON) > 0;
}

function messageLooksLikeHaterBait(message: TrainingTranscriptMessage): boolean {
  return message.attribution.sourceType === 'PLAYER'
    && (lexiconHits(message.plainText, FLEX_LEXICON) > 0 || lexiconHits(message.plainText, TROLL_LEXICON) > 0);
}

function messageLooksToxic(message: TrainingTranscriptMessage): boolean {
  return lexiconHits(message.plainText, TOXIC_LEXICON) > 0;
}

function messageLooksDistressed(message: TrainingTranscriptMessage): boolean {
  const lowered = message.plainText.toLowerCase();
  return lowered.includes('i can\'t')
    || lowered.includes('stuck')
    || lowered.includes('lost')
    || lowered.includes('done')
    || lowered.includes('broke')
    || lowered.includes('bankrupt')
    || lowered.includes('why is this happening');
}

function deriveLongSilenceCandidates(room: IndexedRoomArtifacts): readonly { sceneKey: string; anchorMessageId: TrainingMessageId | null; anchorAt: UnixMs }[] {
  const playerMessages = room.transcript
    .filter((entry) => entry.message.attribution.sourceType === 'PLAYER')
    .sort(compareTranscriptEntries);

  const result: { sceneKey: string; anchorMessageId: TrainingMessageId | null; anchorAt: UnixMs }[] = [];
  for (let index = 1; index < playerMessages.length; index += 1) {
    const previous = playerMessages[index - 1]!;
    const current = playerMessages[index]!;
    const gap = current.message.createdAt - previous.message.createdAt;
    if (gap >= 45_000) {
      result.push({
        sceneKey: `scene:${room.roomId}:floating:${Math.floor(previous.message.createdAt / 1000)}`,
        anchorMessageId: previous.message.id,
        anchorAt: previous.message.createdAt,
      });
    }
  }
  return Object.freeze(result);
}

// ============================================================================
// MARK: Evidence and anchor helpers
// ============================================================================

function collectWindowEvidence(
  candidate: AnchorCandidate,
  preMessages: readonly TrainingTranscriptEntry[],
  anchorMessages: readonly TrainingTranscriptEntry[],
  postMessages: readonly TrainingTranscriptEntry[],
  telemetry: readonly TrainingTelemetryRecord[],
  proofEdges: readonly TrainingProofEdge[],
  replayArtifacts: readonly TrainingReplayArtifact[],
  inferenceSnapshots: readonly TrainingInferenceSnapshot[],
  signals: readonly TrainingSignalEnvelope[],
  sessions: readonly TrainingSessionState[],
  presence: readonly TrainingPresenceSnapshot[],
): readonly TrainingEvidenceRef[] {
  const refs: TrainingEvidenceRef[] = [];

  for (const entry of preMessages) {
    refs.push({ kind: 'MESSAGE', id: entry.message.id, at: entry.message.createdAt, role: 'PRE_MESSAGE' });
  }
  for (const entry of anchorMessages) {
    refs.push({ kind: 'MESSAGE', id: entry.message.id, at: entry.message.createdAt, role: 'ANCHOR_MESSAGE' });
  }
  for (const entry of postMessages) {
    refs.push({ kind: 'MESSAGE', id: entry.message.id, at: entry.message.createdAt, role: 'POST_MESSAGE' });
  }
  for (const record of telemetry) {
    refs.push({ kind: 'TELEMETRY', id: record.id, at: record.emittedAt, role: record.type });
  }
  for (const edge of proofEdges) {
    refs.push({ kind: 'PROOF', id: edge.id, at: edge.createdAt, role: edge.edgeType });
  }
  for (const artifact of replayArtifacts) {
    refs.push({ kind: 'REPLAY', id: artifact.id, at: artifact.createdAt, role: artifact.label });
  }
  for (const snapshot of inferenceSnapshots) {
    refs.push({ kind: 'INFERENCE', id: snapshot.id, at: snapshot.inferredAt, role: snapshot.task });
  }
  for (const signal of signals) {
    const signalId = extractSignalEventId(signal) ?? `${signal.type}:${signal.emittedAt}`;
    refs.push({ kind: 'SIGNAL', id: signalId, at: signal.emittedAt, role: signal.type });
  }
  for (const session of sessions) {
    refs.push({ kind: 'SESSION', id: session.sessionId, at: session.joinedAt, role: session.role ?? 'SESSION' });
  }
  for (const snapshot of presence) {
    refs.push({ kind: 'PRESENCE', id: `${snapshot.sessionId}:${snapshot.updatedAt}`, at: snapshot.updatedAt, role: snapshot.mode });
  }

  if (candidate.anchorTelemetryId) {
    refs.push({ kind: 'TELEMETRY', id: candidate.anchorTelemetryId, at: candidate.anchorAt, role: 'EXPLICIT_ANCHOR' });
  }
  if (candidate.anchorReplayId) {
    refs.push({ kind: 'REPLAY', id: candidate.anchorReplayId, at: candidate.anchorAt, role: 'EXPLICIT_ANCHOR' });
  }
  if (candidate.anchorInferenceId) {
    refs.push({ kind: 'INFERENCE', id: candidate.anchorInferenceId, at: candidate.anchorAt, role: 'EXPLICIT_ANCHOR' });
  }

  return Object.freeze(refs.sort((a, b) => compareNumbers(a.at ?? 0, b.at ?? 0) || compareStrings(a.id, b.id)));
}

function buildAnchorKey(task: TrainingTaskKey, candidate: AnchorCandidate): string {
  return [
    task,
    candidate.roomId,
    candidate.sceneKey,
    candidate.anchorMessageId ?? 'no-msg',
    candidate.anchorEventId ?? 'no-evt',
    candidate.anchorTelemetryId ?? 'no-tel',
    candidate.anchorReplayId ?? 'no-rpl',
    candidate.anchorInferenceId ?? 'no-inf',
    candidate.anchorAt,
    candidate.reason,
  ].join('::');
}

function buildExampleId(task: TrainingTaskKey, roomId: TrainingRoomId, anchorKey: string): string {
  return `example:${task}:${roomId}:${fnv1aHex(anchorKey)}`;
}

function determineSplit(anchorKey: string, policy: TrainingSplitPolicy): TrainingSplit {
  const normalized = hashToUnit(anchorKey + '::' + policy.salt);
  if (normalized < policy.trainPercentage) {
    return 'TRAIN';
  }
  if (normalized < policy.trainPercentage + policy.validationPercentage) {
    return 'VALIDATION';
  }
  return 'TEST';
}

// ============================================================================
// MARK: Scene / replay / range helpers
// ============================================================================

function deriveReplayStartAt(artifact: TrainingReplayArtifact, transcript: readonly TrainingTranscriptEntry[]): UnixMs {
  const first = transcript.find((entry) => entry.message.sequenceNumber >= artifact.range.startSequenceNumber);
  return first?.message.createdAt ?? artifact.createdAt;
}

function deriveReplayEndAt(artifact: TrainingReplayArtifact, transcript: readonly TrainingTranscriptEntry[]): UnixMs {
  const last = [...transcript].reverse().find((entry) => entry.message.sequenceNumber <= artifact.range.endSequenceNumber);
  return last?.message.createdAt ?? artifact.createdAt;
}

function collectMessageIdsInRange(transcript: readonly TrainingTranscriptEntry[], range: TrainingRange): TrainingMessageId[] {
  return transcript
    .filter((entry) => entry.message.sequenceNumber >= range.startSequenceNumber && entry.message.sequenceNumber <= range.endSequenceNumber)
    .map((entry) => entry.message.id);
}

function buildRangeFromMessageIds(transcript: readonly TrainingTranscriptEntry[], messageIds: readonly TrainingMessageId[]): TrainingRange | null {
  const messages = transcript.filter((entry) => messageIds.includes(entry.message.id));
  if (messages.length === 0) {
    return null;
  }
  return {
    startSequenceNumber: messages[0]!.message.sequenceNumber,
    endSequenceNumber: messages[messages.length - 1]!.message.sequenceNumber,
  };
}

function mergeRanges(left: TrainingRange | null, right: TrainingRange | null): TrainingRange | null {
  if (!left) return right;
  if (!right) return left;
  return {
    startSequenceNumber: Math.min(left.startSequenceNumber, right.startSequenceNumber),
    endSequenceNumber: Math.max(left.endSequenceNumber, right.endSequenceNumber),
  };
}

function findReplayAnchorMessageIds(room: IndexedRoomArtifacts, replayId: TrainingReplayId): readonly TrainingMessageId[] {
  const artifact = room.replayArtifacts.find((candidate) => candidate.id === replayId);
  return artifact ? Object.freeze(collectMessageIdsInRange(room.transcript, artifact.range)) : Object.freeze([]);
}

function extractSignalEventId(signal: TrainingSignalEnvelope): TrainingEventId | null {
  const eventId = signal.metadata?.eventId;
  return typeof eventId === 'string' ? eventId : null;
}

// ============================================================================
// MARK: Generic utilities
// ============================================================================

function compareExamples(left: TrainingExample, right: TrainingExample): number {
  return compareStrings(left.task, right.task)
    || compareStrings(left.roomId, right.roomId)
    || compareNumbers(left.anchorAt, right.anchorAt)
    || compareStrings(left.id, right.id);
}

function compareCandidates(left: AnchorCandidate, right: AnchorCandidate): number {
  return compareNumbers(left.anchorAt, right.anchorAt)
    || compareStrings(left.reason, right.reason)
    || compareStrings(left.sceneKey, right.sceneKey);
}

function compareTranscriptEntries(left: TrainingTranscriptEntry, right: TrainingTranscriptEntry): number {
  return compareNumbers(left.message.sequenceNumber, right.message.sequenceNumber)
    || compareNumbers(left.message.createdAt, right.message.createdAt)
    || compareStrings(left.message.id, right.message.id);
}

function compareNumbers(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function tokenize(text: string): readonly string[] {
  return Object.freeze(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s_:-]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort(compareStrings);
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)))].sort(compareNumbers);
}

function pickLatest<T>(values: readonly T[], selector: (value: T) => number): T | null {
  if (values.length === 0) {
    return null;
  }
  return [...values].sort((a, b) => selector(b) - selector(a))[0] ?? null;
}

function pickFirst<T>(values: readonly T[]): T | null {
  return values.length > 0 ? values[0]! : null;
}

function freezeShallow<T extends object>(value: T): T {
  return Object.freeze({ ...(value as object) }) as T;
}

function freezeRecord(record: Readonly<Record<string, JsonValue>>): Readonly<Record<string, JsonValue>> {
  return Object.freeze({ ...record });
}

function createTaskRecord<T>(factory: () => T): Record<TrainingTaskKey, T> {
  return {
    ENGAGEMENT: factory(),
    HATER_TARGETING: factory(),
    HELPER_TIMING: factory(),
    CHANNEL_AFFINITY: factory(),
    TOXICITY_RISK: factory(),
    CHURN_RISK: factory(),
    INTERVENTION_POLICY: factory(),
    RESPONSE_RANKING: factory(),
    SEQUENCE_MEMORY: factory(),
    MODERATION_OUTCOME: factory(),
  };
}

function hashToUnit(input: string): number {
  const hex = fnv1aHex(input).slice(0, 8);
  const numeric = Number.parseInt(hex, 16);
  return numeric / 0xffffffff;
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
