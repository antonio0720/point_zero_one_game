/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT PROOF CONTRACTS
 * FILE: shared/contracts/chat/ChatProof.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for transcript proof, causal lineage,
 * replay linkage, moderation mutation traceability, invasion sequencing proof,
 * command receipts, telemetry correlations, export bundles, and verification
 * snapshots across the unified chat system.
 *
 * This file is the long-term proof authority for:
 *   - /shared/contracts/chat
 *   - /pzo-web/src/engines/chat
 *   - /backend/src/game/engine/chat
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Proof is not cosmetic metadata; it is the lineage vocabulary that lets
 *    replay, audit, moderation, telemetry, and learning speak about the same
 *    authoritative chat reality.
 * 2. Frontend may stage local proof hints, but backend authority owns final
 *    verification state, chain mutation, and export-grade bundles.
 * 3. Server transport may attach correlation and fanout records, but it must
 *    not invent a second proof language separate from the shared contracts.
 * 4. Message proof, transcript proof, moderation proof, invasion proof, and
 *    telemetry proof must interoperate instead of forking into silo schemas.
 * 5. Proof contracts must stay import-safe for frontend, backend, and server
 *    transport without dragging runtime reducers or socket code into the
 *    shared lane.
 *
 * Repo-aligned doctrine
 * ---------------------
 * The repo already separates frontend chat engine logic under
 * /pzo-web/src/engines/chat, presentation under /pzo-web/src/components/chat,
 * transport under /pzo-server/src/ws plus /pzo-server/src/haters, and battle
 * authority under /backend/src/game/engine/battle. This proof layer gives the
 * unified chat system a single evidence vocabulary that can be imported by all
 * those lanes once backend chat authority is brought online. citeturn409074view0turn218451view0turn399251view0turn399251view1turn399251view2turn399251view3
 * ============================================================================
 */

import * as ChatChannelsModule from './ChatChannels';
import * as ChatEventsModule from './ChatEvents';
import * as ChatMessageModule from './ChatMessage';
import * as ChatTranscriptModule from './ChatTranscript';
import * as ChatNpcModule from './ChatNpc';
import * as ChatCommandModule from './ChatCommand';
import * as ChatModerationModule from './ChatModeration';
import * as ChatInvasionModule from './ChatInvasion';
import * as ChatTelemetryModule from './ChatTelemetry';

// ============================================================================
// MARK: Foundational aliases
// ============================================================================

export type Brand<TValue, TBrand extends string> = ChatChannelsModule.Brand<TValue, TBrand>;
export type UnixMs = ChatChannelsModule.UnixMs;
export type ChatRoomId = ChatChannelsModule.ChatRoomId;
export type ChatChannelId = ChatChannelsModule.ChatChannelId;
export type JsonObject = ChatChannelsModule.JsonObject;
export type JsonValue = ChatChannelsModule.JsonValue;
export type Score01 = ChatChannelsModule.Score01;
export type Score100 = ChatChannelsModule.Score100;
export type ChatProofHash = ChatChannelsModule.ChatProofHash;
export type ChatMessageId = ChatChannelsModule.ChatMessageId;
export type ChatSessionId = ChatChannelsModule.ChatSessionId;
export type ChatUserId = ChatChannelsModule.ChatUserId;
export type ChatNpcId = ChatChannelsModule.ChatNpcId;
export type ChatRequestId = ChatChannelsModule.ChatRequestId;
export type ChatAuthority = ChatEventsModule.ChatAuthority;
export type ChatRange = ChatChannelsModule.ChatRange;
export type ChatReplayId = ChatChannelsModule.ChatReplayId;
export type ChatTelemetryId = ChatChannelsModule.ChatTelemetryId;
export type ChatLegendId = ChatChannelsModule.ChatLegendId;
export type ChatMemoryAnchorId = ChatChannelsModule.ChatMemoryAnchorId;
export type ChatOfferId = ChatChannelsModule.ChatOfferId;
export type ChatWorldEventId = ChatChannelsModule.ChatWorldEventId;
export type ChatInterventionId = ChatChannelsModule.ChatInterventionId;
export type ChatCanonicalMessage = ChatMessageModule.ChatCanonicalMessage;
export type ChatMessageProofEnvelope = ChatMessageModule.ChatMessageProofEnvelope;
export type ChatMessageVersion = ChatMessageModule.ChatMessageVersion;
export type ChatCausalEdge = ChatMessageModule.ChatCausalEdge;
export type ChatTranscriptLedgerState = ChatTranscriptModule.ChatTranscriptLedgerState;
export type ChatTranscriptAuditEnvelope = ChatTranscriptModule.ChatTranscriptAuditEnvelope;
export type ChatTranscriptRedactionMutation = ChatTranscriptModule.ChatTranscriptRedactionMutation;
export type ChatTranscriptQuery = ChatTranscriptModule.ChatTranscriptQuery;
export type ChatTranscriptQueryResult = ChatTranscriptModule.ChatTranscriptQueryResult;
export type ChatAnyNpcDescriptor = ChatNpcModule.ChatAnyNpcDescriptor;
export type ChatNpcRegistrySnapshot = ChatNpcModule.ChatNpcRegistrySnapshot;
export type ChatCommandEnvelope = ChatCommandModule.ChatCommandEnvelope;
export type ChatCommandExecutionReceipt = ChatCommandModule.ChatCommandExecutionReceipt;
export type ChatExpandedModerationDecision = ChatModerationModule.ChatExpandedModerationDecision;
export type ChatModerationAuditRecord = ChatModerationModule.ChatModerationAuditRecord;
export type ChatModerationResult = ChatModerationModule.ChatModerationResult;
export type ChatInvasionRuntimeState = ChatInvasionModule.ChatInvasionRuntimeState;
export type ChatInvasionOutcome = ChatInvasionModule.ChatInvasionOutcome;
export type ChatTelemetryEnvelope = ChatEventsModule.ChatTelemetryEvent;
export type ChatTelemetryFact = ChatTelemetryModule.ChatTelemetryFact;

// ============================================================================
// MARK: Branded proof identifiers
// ============================================================================

export type ChatProofId = Brand<string, 'ChatProofId'>;
export type ChatProofNodeId = Brand<string, 'ChatProofNodeId'>;
export type ChatProofEdgeId = Brand<string, 'ChatProofEdgeId'>;
export type ChatProofLedgerId = Brand<string, 'ChatProofLedgerId'>;
export type ChatProofSnapshotId = Brand<string, 'ChatProofSnapshotId'>;
export type ChatProofBundleId = Brand<string, 'ChatProofBundleId'>;
export type ChatProofExportId = Brand<string, 'ChatProofExportId'>;
export type ChatProofPolicyId = Brand<string, 'ChatProofPolicyId'>;
export type ChatProofEvidenceId = Brand<string, 'ChatProofEvidenceId'>;
export type ChatProofAttachmentId = Brand<string, 'ChatProofAttachmentId'>;
export type ChatProofVerificationId = Brand<string, 'ChatProofVerificationId'>;
export type ChatProofConflictId = Brand<string, 'ChatProofConflictId'>;
export type ChatProofSignatureId = Brand<string, 'ChatProofSignatureId'>;
export type ChatProofNoteId = Brand<string, 'ChatProofNoteId'>;
export type ChatProofPacketId = Brand<string, 'ChatProofPacketId'>;
export type ChatProofChainId = Brand<string, 'ChatProofChainId'>;
export type ChatProofWindowId = Brand<string, 'ChatProofWindowId'>;
export type ChatProofRangeId = Brand<string, 'ChatProofRangeId'>;
export type ChatProofSubjectId = Brand<string, 'ChatProofSubjectId'>;
export type ChatProofCorrelatorId = Brand<string, 'ChatProofCorrelatorId'>;
export type ChatProofReplayLinkId = Brand<string, 'ChatProofReplayLinkId'>;
export type ChatProofAuditId = Brand<string, 'ChatProofAuditId'>;
export type ChatProofVersionId = Brand<string, 'ChatProofVersionId'>;
export type ChatProofMutationId = Brand<string, 'ChatProofMutationId'>;
export type ChatProofDiffId = Brand<string, 'ChatProofDiffId'>;
export type ChatProofQueryId = Brand<string, 'ChatProofQueryId'>;
export type ChatProofTraversalId = Brand<string, 'ChatProofTraversalId'>;
export type ChatProofCaseId = Brand<string, 'ChatProofCaseId'>;
export type ChatProofEnvelopeId = Brand<string, 'ChatProofEnvelopeId'>;
export type ChatProofHintId = Brand<string, 'ChatProofHintId'>;
export type ChatProofRuleId = Brand<string, 'ChatProofRuleId'>;
export type ChatProofDescriptorId = Brand<string, 'ChatProofDescriptorId'>;
export type ChatProofExportFileId = Brand<string, 'ChatProofExportFileId'>;
export type ChatProofAnchorId = Brand<string, 'ChatProofAnchorId'>;
export type ChatProofLineageId = Brand<string, 'ChatProofLineageId'>;
export type ChatProofDigestId = Brand<string, 'ChatProofDigestId'>;

// ----------------------------------------------------------------------------
// Node Kinds
// ----------------------------------------------------------------------------
export const CHAT_PROOF_NODE_KINDS = [
  'MESSAGE',
  'MESSAGE_VERSION',
  'THREAD',
  'ROOM',
  'CHANNEL',
  'TRANSCRIPT_SLICE',
  'TRANSCRIPT_RANGE',
  'REPLAY_ANCHOR',
  'REPLAY_SEGMENT',
  'REPLAY_SESSION',
  'NPC_TURN',
  'NPC_PLAN',
  'INVASION',
  'INVASION_BEAT',
  'INVASION_OUTCOME',
  'COMMAND',
  'COMMAND_EXECUTION',
  'MODERATION_CASE',
  'MODERATION_ACTION',
  'TELEMETRY_FACT',
  'TELEMETRY_BATCH',
  'LEARNING_EVENT',
  'MEMORY_ANCHOR',
  'LEGEND_MOMENT',
  'WORLD_EVENT',
  'NEGOTIATION_OFFER',
  'PRESENCE_ENTRY',
  'TYPING_WINDOW',
  'CURSOR_FRAME',
  'HELPER_INTERVENTION',
  'SYSTEM_DECISION',
  'PROOF_SNAPSHOT',
  'PROOF_BUNDLE',
  'PROOF_EXPORT',
] as const;
export type ChatProofNodeKind = (typeof CHAT_PROOF_NODE_KINDS)[number];

// ----------------------------------------------------------------------------
// Edge Kinds
// ----------------------------------------------------------------------------
export const CHAT_PROOF_EDGE_KINDS = [
  'CAUSED_BY',
  'LED_TO',
  'REFERENCES',
  'REDACTS',
  'REPLACES',
  'ACKNOWLEDGES',
  'MODERATED_BY',
  'TRIGGERED',
  'ESCALATED_TO',
  'DEESCALATED_TO',
  'RECORDED_IN',
  'REPLAYS_AT',
  'ANCHORED_BY',
  'RANKED_WITH',
  'SCORING_INPUT',
  'SCORING_OUTPUT',
  'SUPPRESSED_BY',
  'VISIBLE_COMPANION',
  'SHADOW_COMPANION',
  'SERVED_TO',
  'EMITTED_AS',
  'FANNED_OUT_TO',
  'DERIVED_FROM',
  'CORRELATED_WITH',
  'ATTACHED_TO',
  'SETTLED_BY',
  'VERIFIED_BY',
  'OVERRIDDEN_BY',
  'RESOLVED_BY',
  'CLOSED_BY',
] as const;
export type ChatProofEdgeKind = (typeof CHAT_PROOF_EDGE_KINDS)[number];

// ----------------------------------------------------------------------------
// Subject Kinds
// ----------------------------------------------------------------------------
export const CHAT_PROOF_SUBJECT_KINDS = [
  'MESSAGE',
  'TRANSCRIPT',
  'MODERATION',
  'COMMAND',
  'NPC',
  'INVASION',
  'REPLAY',
  'TELEMETRY',
  'LEARNING',
  'NEGOTIATION',
  'PRESENCE',
  'TYPING',
  'CURSOR',
  'WORLD_EVENT',
  'LEGEND',
  'SYSTEM',
] as const;
export type ChatProofSubjectKind = (typeof CHAT_PROOF_SUBJECT_KINDS)[number];

// ----------------------------------------------------------------------------
// Evidence Kinds
// ----------------------------------------------------------------------------
export const CHAT_PROOF_EVIDENCE_KINDS = [
  'HASH',
  'TEXT_SNIPPET',
  'MESSAGE_METADATA',
  'TRANSCRIPT_INDEX',
  'RANGE',
  'REPLAY_OFFSET',
  'SEQUENCE',
  'MODERATION_RECORD',
  'COMMAND_RECEIPT',
  'INVASION_STAGE',
  'NPC_PLAN',
  'TELEMETRY_FACT',
  'FEATURE_ROW',
  'MEMORY_ANCHOR',
  'LEGEND_RECORD',
  'WORLD_EVENT_STAGE',
  'PRESENCE_ROSTER',
  'TYPING_PLAN',
  'CURSOR_ANCHOR',
  'EXTERNAL_NOTE',
] as const;
export type ChatProofEvidenceKind = (typeof CHAT_PROOF_EVIDENCE_KINDS)[number];

// ----------------------------------------------------------------------------
// Hash Algorithms
// ----------------------------------------------------------------------------
export const CHAT_PROOF_HASH_ALGORITHMS = [
  'NONE',
  'SHA256',
  'SHA384',
  'SHA512',
  'BLAKE3',
  'XXHASH64',
  'CONTENT_ID',
] as const;
export type ChatProofHashAlgorithm = (typeof CHAT_PROOF_HASH_ALGORITHMS)[number];

// ----------------------------------------------------------------------------
// Verification States
// ----------------------------------------------------------------------------
export const CHAT_PROOF_VERIFICATION_STATES = [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'FAILED',
  'STALE',
  'SUPERSEDED',
  'PARTIAL',
] as const;
export type ChatProofVerificationState = (typeof CHAT_PROOF_VERIFICATION_STATES)[number];

// ----------------------------------------------------------------------------
// Signature States
// ----------------------------------------------------------------------------
export const CHAT_PROOF_SIGNATURE_STATES = [
  'UNSIGNED',
  'SIGNED',
  'TAMPERED',
  'ROTATED',
  'EXPIRED',
] as const;
export type ChatProofSignatureState = (typeof CHAT_PROOF_SIGNATURE_STATES)[number];

// ----------------------------------------------------------------------------
// Ledger Actions
// ----------------------------------------------------------------------------
export const CHAT_PROOF_LEDGER_ACTIONS = [
  'APPEND_NODE',
  'APPEND_EDGE',
  'UPSERT_HASH',
  'MARK_SUPERSEDED',
  'VERIFY',
  'FAIL_VERIFY',
  'ATTACH_EXPORT',
  'ATTACH_SNAPSHOT',
  'ATTACH_BUNDLE',
  'PRUNE_CACHE',
] as const;
export type ChatProofLedgerAction = (typeof CHAT_PROOF_LEDGER_ACTIONS)[number];

// ----------------------------------------------------------------------------
// Query Scopes
// ----------------------------------------------------------------------------
export const CHAT_PROOF_QUERY_SCOPES = [
  'ROOM',
  'CHANNEL',
  'MESSAGE',
  'THREAD',
  'RUN',
  'REPLAY',
  'INVASION',
  'NPC',
  'WORLD_EVENT',
  'ACCOUNT',
  'SYSTEM',
] as const;
export type ChatProofQueryScope = (typeof CHAT_PROOF_QUERY_SCOPES)[number];

// ----------------------------------------------------------------------------
// Bundle Classes
// ----------------------------------------------------------------------------
export const CHAT_PROOF_BUNDLE_CLASSES = [
  'MESSAGE_ONLY',
  'THREAD_CHAIN',
  'ROOM_SEGMENT',
  'INVASION_PACKET',
  'MODERATION_CASE',
  'REPLAY_SEGMENT',
  'LEGEND_PACKET',
  'EXPORT_ARCHIVE',
] as const;

// ----------------------------------------------------------------------------
// Export Formats
// ----------------------------------------------------------------------------
export const CHAT_PROOF_EXPORT_FORMATS = [
  'JSON',
  'NDJSON',
  'HASH_LEDGER',
  'REPLAY_LINKED_JSON',
  'AUDIT_PACKET',
] as const;
export type ChatProofExportFormat = (typeof CHAT_PROOF_EXPORT_FORMATS)[number];

// ----------------------------------------------------------------------------
// Mutation Kinds
// ----------------------------------------------------------------------------
export const CHAT_PROOF_MUTATION_KINDS = [
  'ADD_NODE',
  'ADD_EDGE',
  'REPLACE_EDGE',
  'SUPERSEDE_NODE',
  'UPDATE_HASH',
  'SET_VERIFICATION',
  'ATTACH_EVIDENCE',
  'ATTACH_NOTE',
] as const;
export type ChatProofMutationKind = (typeof CHAT_PROOF_MUTATION_KINDS)[number];

// ----------------------------------------------------------------------------
// Consistency Levels
// ----------------------------------------------------------------------------
export const CHAT_PROOF_CONSISTENCY_LEVELS = [
  'BEST_EFFORT',
  'ROOM_STRICT',
  'CHANNEL_STRICT',
  'LEDGER_STRICT',
  'EXPORT_STRICT',
] as const;
export type ChatProofConsistencyLevel = (typeof CHAT_PROOF_CONSISTENCY_LEVELS)[number];

// ----------------------------------------------------------------------------
// Replay Alignment States
// ----------------------------------------------------------------------------
export const CHAT_PROOF_REPLAY_ALIGNMENT_STATES = [
  'NONE',
  'QUEUED',
  'ATTACHED',
  'DRIFTED',
  'LOCKED',
] as const;
export type ChatProofReplayAlignmentState = (typeof CHAT_PROOF_REPLAY_ALIGNMENT_STATES)[number];

// ----------------------------------------------------------------------------
// Conflict Kinds
// ----------------------------------------------------------------------------
export const CHAT_PROOF_CONFLICT_KINDS = [
  'NONE',
  'HASH_MISMATCH',
  'MISSING_PARENT',
  'MISSING_SUBJECT',
  'STALE_RANGE',
  'AUTHORITATIVE_OVERRIDE',
  'REDACTION_SPLIT',
  'EXPORT_GAP',
] as const;
export type ChatProofConflictKind = (typeof CHAT_PROOF_CONFLICT_KINDS)[number];

// ----------------------------------------------------------------------------
// Policy Classes
// ----------------------------------------------------------------------------
export const CHAT_PROOF_POLICY_CLASSES = [
  'FRONTEND_HINT',
  'SERVER_TRANSPORT',
  'BACKEND_AUTHORITY',
  'AUDIT_EXPORT',
  'TRAINING_EXPORT',
] as const;
export type ChatProofBundleClass = (typeof CHAT_PROOF_BUNDLE_CLASSES)[number];
export type ChatProofPolicyClass = (typeof CHAT_PROOF_POLICY_CLASSES)[number];


export interface ChatProofSubjectRef {
  readonly subjectId: ChatProofSubjectId;
  readonly kind: ChatProofSubjectKind;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly messageId?: ChatMessageId;
  readonly replayId?: ChatReplayId;
  readonly npcId?: ChatNpcId;
  readonly userId?: ChatUserId;
  readonly requestId?: ChatRequestId;
  readonly offerId?: ChatOfferId;
  readonly worldEventId?: ChatWorldEventId;
  readonly interventionId?: ChatInterventionId;
  readonly legendId?: ChatLegendId;
  readonly memoryAnchorId?: ChatMemoryAnchorId;
  readonly externalKey?: string;
}

export interface ChatProofEvidenceBlock {
  readonly evidenceId: ChatProofEvidenceId;
  readonly kind: ChatProofEvidenceKind;
  readonly subject: ChatProofSubjectRef;
  readonly proofHash?: ChatProofHash;
  readonly parentProofHash?: ChatProofHash;
  readonly range?: ChatRange;
  readonly snippet?: string;
  readonly metadata?: JsonObject;
  readonly createdAt: UnixMs;
  readonly authority: ChatAuthority;
}

export interface ChatProofSignatureEnvelope {
  readonly signatureId: ChatProofSignatureId;
  readonly state: ChatProofSignatureState;
  readonly algorithm: ChatProofHashAlgorithm;
  readonly signerAuthority: ChatAuthority;
  readonly signedProofHash?: ChatProofHash;
  readonly signedAt?: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly keyRotationHint?: string;
}

export interface ChatProofVerificationEnvelope {
  readonly verificationId: ChatProofVerificationId;
  readonly state: ChatProofVerificationState;
  readonly checkedAt: UnixMs;
  readonly checkerAuthority: ChatAuthority;
  readonly algorithm: ChatProofHashAlgorithm;
  readonly expectedHash?: ChatProofHash;
  readonly computedHash?: ChatProofHash;
  readonly mismatchReason?: ChatProofConflictKind;
  readonly notes?: readonly string[];
}

export interface ChatProofReplayLink {
  readonly replayLinkId: ChatProofReplayLinkId;
  readonly replayId: ChatReplayId;
  readonly alignmentState: ChatProofReplayAlignmentState;
  readonly offsetMs?: number;
  readonly anchorLabel?: string;
  readonly createdAt: UnixMs;
}

export interface ChatProofTelemetryLink {
  readonly telemetryId: ChatTelemetryId;
  readonly recordId?: ChatTelemetryModule.ChatTelemetryRecordId;
  readonly streamId?: ChatTelemetryModule.ChatTelemetryStreamId;
  readonly correlationId?: ChatTelemetryModule.ChatTelemetryCorrelationId;
  readonly eventName?: ChatEventsModule.ChatTelemetryEventName;
}

export interface ChatProofTraversalHint {
  readonly traversalId: ChatProofTraversalId;
  readonly fromNodeId: ChatProofNodeId;
  readonly edgeKinds: readonly ChatProofEdgeKind[];
  readonly maxDepth: number;
  readonly stopAtKinds?: readonly ChatProofNodeKind[];
}

export interface ChatProofNodeDescriptor {
  readonly nodeId: ChatProofNodeId;
  readonly proofId: ChatProofId;
  readonly chainId: ChatProofChainId;
  readonly lineageId: ChatProofLineageId;
  readonly kind: ChatProofNodeKind;
  readonly subject: ChatProofSubjectRef;
  readonly hashAlgorithm: ChatProofHashAlgorithm;
  readonly proofHash?: ChatProofHash;
  readonly digestId?: ChatProofDigestId;
  readonly messageEnvelope?: ChatMessageProofEnvelope;
  readonly signature?: ChatProofSignatureEnvelope;
  readonly verification?: ChatProofVerificationEnvelope;
  readonly replayLink?: ChatProofReplayLink;
  readonly telemetryLink?: ChatProofTelemetryLink;
  readonly evidence: readonly ChatProofEvidenceBlock[];
  readonly createdAt: UnixMs;
  readonly updatedAt?: UnixMs;
  readonly authority: ChatAuthority;
  readonly consistencyLevel: ChatProofConsistencyLevel;
  readonly supersededByNodeId?: ChatProofNodeId;
  readonly tags?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface ChatProofEdgeDescriptor {
  readonly edgeId: ChatProofEdgeId;
  readonly chainId: ChatProofChainId;
  readonly kind: ChatProofEdgeKind;
  readonly fromNodeId: ChatProofNodeId;
  readonly toNodeId: ChatProofNodeId;
  readonly confidence01?: Score01;
  readonly createdAt: UnixMs;
  readonly authority: ChatAuthority;
  readonly evidenceIds?: readonly ChatProofEvidenceId[];
  readonly causalEdge?: ChatCausalEdge;
  readonly metadata?: JsonObject;
}

export interface ChatProofMessageAttachment {
  readonly messageId: ChatMessageId;
  readonly version?: ChatMessageVersion;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly authorUserId?: ChatUserId;
  readonly npcId?: ChatNpcId;
  readonly proofEnvelope?: ChatMessageProofEnvelope;
  readonly canonicalMessage?: ChatCanonicalMessage;
}

export interface ChatProofTranscriptAttachment {
  readonly transcriptId: ChatTranscriptModule.ChatTranscriptId;
  readonly ledgerId: ChatTranscriptModule.ChatTranscriptLedgerId;
  readonly roomId: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly auditEnvelope?: ChatTranscriptAuditEnvelope;
  readonly ledgerSnapshot?: ChatTranscriptLedgerState;
}

export interface ChatProofModerationAttachment {
  readonly moderationCaseId?: ChatModerationModule.ChatModerationCaseId;
  readonly result?: ChatModerationResult;
  readonly expandedDecision?: ChatExpandedModerationDecision;
  readonly auditRecord?: ChatModerationAuditRecord;
  readonly redactionMutation?: ChatTranscriptRedactionMutation;
}

export interface ChatProofCommandAttachment {
  readonly commandId?: ChatCommandModule.ChatCommandId;
  readonly envelope?: ChatCommandEnvelope;
  readonly receipt?: ChatCommandExecutionReceipt;
  readonly visibilityClass?: ChatCommandModule.ChatCommandVisibilityClass;
}

export interface ChatProofInvasionAttachment {
  readonly invasionId?: ChatInvasionModule.ChatInvasionId;
  readonly runtimeState?: ChatInvasionRuntimeState;
  readonly outcome?: ChatInvasionOutcome;
  readonly stage?: ChatInvasionModule.ChatInvasionStage;
  readonly kind?: ChatInvasionModule.ChatInvasionKind;
}

export interface ChatProofNpcAttachment {
  readonly npcId?: ChatNpcId;
  readonly descriptor?: ChatAnyNpcDescriptor;
  readonly registrySnapshot?: ChatNpcRegistrySnapshot;
  readonly lineCandidateKey?: string;
}

export interface ChatProofTelemetryAttachment {
  readonly envelope?: ChatTelemetryEnvelope;
  readonly record?: ChatTelemetryFact;
  readonly streamId?: ChatTelemetryModule.ChatTelemetryStreamId;
  readonly sinkId?: ChatTelemetryModule.ChatTelemetrySinkId;
}

export interface ChatProofConflict {
  readonly conflictId: ChatProofConflictId;
  readonly kind: ChatProofConflictKind;
  readonly nodeId?: ChatProofNodeId;
  readonly edgeId?: ChatProofEdgeId;
  readonly detectedAt: UnixMs;
  readonly detectedBy: ChatAuthority;
  readonly description: string;
  readonly recoverable: boolean;
  readonly metadata?: JsonObject;
}

export interface ChatProofMutation {
  readonly mutationId: ChatProofMutationId;
  readonly kind: ChatProofMutationKind;
  readonly action: ChatProofLedgerAction;
  readonly at: UnixMs;
  readonly authority: ChatAuthority;
  readonly targetNodeId?: ChatProofNodeId;
  readonly targetEdgeId?: ChatProofEdgeId;
  readonly payload?: JsonObject;
}

export interface ChatProofDiffOp {
  readonly diffId: ChatProofDiffId;
  readonly nodeId?: ChatProofNodeId;
  readonly edgeId?: ChatProofEdgeId;
  readonly op: 
    | 'APPEND_NODE'
    | 'APPEND_EDGE'
    | 'UPSERT_NODE'
    | 'UPSERT_EDGE'
    | 'SUPERSEDE_NODE'
    | 'VERIFY'
    | 'FLAG_CONFLICT';
  readonly at: UnixMs;
  readonly authority: ChatAuthority;
}

export interface ChatProofBundleDescriptor {
  readonly bundleId: ChatProofBundleId;
  readonly bundleClass: ChatProofBundleClass;
  readonly scope: ChatProofQueryScope;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly nodeIds: readonly ChatProofNodeId[];
  readonly edgeIds: readonly ChatProofEdgeId[];
  readonly exportFormat: ChatProofExportFormat;
  readonly createdAt: UnixMs;
  readonly createdBy: ChatAuthority;
  readonly notes?: readonly string[];
}

export interface ChatProofSnapshot {
  readonly snapshotId: ChatProofSnapshotId;
  readonly ledgerId: ChatProofLedgerId;
  readonly generatedAt: UnixMs;
  readonly proofNodeCount: number;
  readonly proofEdgeCount: number;
  readonly latestVerificationState: ChatProofVerificationState;
  readonly conflictCount: number;
  readonly bundleCount: number;
  readonly exportCount: number;
}

export interface ChatProofExportReceipt {
  readonly exportId: ChatProofExportId;
  readonly bundleId: ChatProofBundleId;
  readonly fileId: ChatProofExportFileId;
  readonly format: ChatProofExportFormat;
  readonly createdAt: UnixMs;
  readonly byteLength?: number;
  readonly digestHash?: ChatProofHash;
  readonly lineCount?: number;
}

export interface ChatProofPolicyDescriptor {
  readonly policyId: ChatProofPolicyId;
  readonly policyClass: ChatProofPolicyClass;
  readonly consistencyLevel: ChatProofConsistencyLevel;
  readonly requireParentHash: boolean;
  readonly requireReplayLinkForLegend: boolean;
  readonly requireModerationTraceOnRedaction: boolean;
  readonly allowFrontendHints: boolean;
  readonly allowServerTransportCorrelationOnly: boolean;
  readonly exportVerificationRequired: boolean;
}

export interface ChatProofLedgerState {
  readonly proofId: ChatProofId;
  readonly ledgerId: ChatProofLedgerId;
  readonly version: typeof ChatChannelsModule.CHAT_CONTRACT_VERSION;
  readonly nodesById: Readonly<Record<string, ChatProofNodeDescriptor>>;
  readonly edgesById: Readonly<Record<string, ChatProofEdgeDescriptor>>;
  readonly outgoingEdgesByNodeId: Readonly<Record<string, readonly ChatProofEdgeDescriptor[]>>;
  readonly incomingEdgesByNodeId: Readonly<Record<string, readonly ChatProofEdgeDescriptor[]>>;
  readonly conflictsById: Readonly<Record<string, ChatProofConflict>>;
  readonly bundlesById: Readonly<Record<string, ChatProofBundleDescriptor>>;
  readonly exportsById: Readonly<Record<string, ChatProofExportReceipt>>;
  readonly snapshotsById: Readonly<Record<string, ChatProofSnapshot>>;
  readonly latestSnapshotId?: ChatProofSnapshotId;
  readonly generatedAt: UnixMs;
}

export interface ChatProofQuery {
  readonly queryId: ChatProofQueryId;
  readonly scope: ChatProofQueryScope;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly messageId?: ChatMessageId;
  readonly replayId?: ChatReplayId;
  readonly invasionId?: ChatInvasionModule.ChatInvasionId;
  readonly npcId?: ChatNpcId;
  readonly userId?: ChatUserId;
  readonly legendId?: ChatLegendId;
  readonly includeEvidence: boolean;
  readonly includeTelemetryLinks: boolean;
  readonly includeReplayLinks: boolean;
  readonly maxNodes?: number;
  readonly traversalHint?: ChatProofTraversalHint;
}

export interface ChatProofQueryResult {
  readonly queryId: ChatProofQueryId;
  readonly scope: ChatProofQueryScope;
  readonly nodes: readonly ChatProofNodeDescriptor[];
  readonly edges: readonly ChatProofEdgeDescriptor[];
  readonly conflicts: readonly ChatProofConflict[];
  readonly bundles: readonly ChatProofBundleDescriptor[];
  readonly snapshot?: ChatProofSnapshot;
  readonly generatedAt: UnixMs;
}

// ============================================================================
// MARK: Default policies, descriptors, and registry hints
// ============================================================================

export const CHAT_PROOF_DEFAULT_POLICY: ChatProofPolicyDescriptor = Object.freeze({
  policyId: 'chat-proof-policy/default' as ChatProofPolicyId,
  policyClass: 'BACKEND_AUTHORITY',
  consistencyLevel: 'LEDGER_STRICT',
  requireParentHash: true,
  requireReplayLinkForLegend: true,
  requireModerationTraceOnRedaction: true,
  allowFrontendHints: true,
  allowServerTransportCorrelationOnly: true,
  exportVerificationRequired: true,
});

export const CHAT_PROOF_NODE_PRIORITY = Object.freeze({
  MESSAGE: 1,
  MESSAGE_VERSION: 2,
  THREAD: 3,
  ROOM: 4,
  CHANNEL: 5,
  TRANSCRIPT_SLICE: 6,
  TRANSCRIPT_RANGE: 7,
  REPLAY_ANCHOR: 8,
  REPLAY_SEGMENT: 9,
  REPLAY_SESSION: 10,
  NPC_TURN: 11,
  NPC_PLAN: 12,
  INVASION: 13,
  INVASION_BEAT: 14,
  INVASION_OUTCOME: 15,
  COMMAND: 16,
  COMMAND_EXECUTION: 17,
  MODERATION_CASE: 18,
  MODERATION_ACTION: 19,
  TELEMETRY_FACT: 20,
  TELEMETRY_BATCH: 21,
  LEARNING_EVENT: 22,
  MEMORY_ANCHOR: 23,
  LEGEND_MOMENT: 24,
  WORLD_EVENT: 25,
  NEGOTIATION_OFFER: 26,
  PRESENCE_ENTRY: 27,
  TYPING_WINDOW: 28,
  CURSOR_FRAME: 29,
  HELPER_INTERVENTION: 30,
  SYSTEM_DECISION: 31,
  PROOF_SNAPSHOT: 32,
  PROOF_BUNDLE: 33,
  PROOF_EXPORT: 34,
} as const);

export const CHAT_PROOF_EDGE_PRIORITY = Object.freeze({
  CAUSED_BY: 1,
  LED_TO: 2,
  REFERENCES: 3,
  REDACTS: 4,
  REPLACES: 5,
  ACKNOWLEDGES: 6,
  MODERATED_BY: 7,
  TRIGGERED: 8,
  ESCALATED_TO: 9,
  DEESCALATED_TO: 10,
  RECORDED_IN: 11,
  REPLAYS_AT: 12,
  ANCHORED_BY: 13,
  RANKED_WITH: 14,
  SCORING_INPUT: 15,
  SCORING_OUTPUT: 16,
  SUPPRESSED_BY: 17,
  VISIBLE_COMPANION: 18,
  SHADOW_COMPANION: 19,
  SERVED_TO: 20,
  EMITTED_AS: 21,
  FANNED_OUT_TO: 22,
  DERIVED_FROM: 23,
  CORRELATED_WITH: 24,
  ATTACHED_TO: 25,
  SETTLED_BY: 26,
  VERIFIED_BY: 27,
  OVERRIDDEN_BY: 28,
  RESOLVED_BY: 29,
  CLOSED_BY: 30,
} as const);

export const CHAT_PROOF_HASH_ALGORITHM_DESCRIPTOR = Object.freeze({
  NONE: { label: 'NONE', description: 'No runtime digest requirement' },
  SHA256: { label: 'SHA256', description: 'Primary default for transcript-safe hashing' },
  SHA384: { label: 'SHA384', description: 'Extended digest for export packets' },
  SHA512: { label: 'SHA512', description: 'Maximal digest for long-form archives' },
  BLAKE3: { label: 'BLAKE3', description: 'Fast tree-friendly hash for streaming proof' },
  XXHASH64: { label: 'XXHASH64', description: 'Non-cryptographic fast correlation hash' },
  CONTENT_ID: { label: 'CONTENT_ID', description: 'Content-addressed external identifier' },
} as const);

// ============================================================================
// MARK: Type guards and resolver helpers
// ============================================================================

export function isChatProofNodeKind(value: string): value is ChatProofNodeKind {
  return (CHAT_PROOF_NODE_KINDS as readonly string[]).includes(value);
}

export function isChatProofEdgeKind(value: string): value is ChatProofEdgeKind {
  return (CHAT_PROOF_EDGE_KINDS as readonly string[]).includes(value);
}

export function isChatProofSubjectKind(value: string): value is ChatProofSubjectKind {
  return (CHAT_PROOF_SUBJECT_KINDS as readonly string[]).includes(value);
}

export function isChatProofEvidenceKind(value: string): value is ChatProofEvidenceKind {
  return (CHAT_PROOF_EVIDENCE_KINDS as readonly string[]).includes(value);
}

export function isChatProofHashAlgorithm(value: string): value is ChatProofHashAlgorithm {
  return (CHAT_PROOF_HASH_ALGORITHMS as readonly string[]).includes(value);
}

export function isChatProofVerificationState(value: string): value is ChatProofVerificationState {
  return (CHAT_PROOF_VERIFICATION_STATES as readonly string[]).includes(value);
}

export function isChatProofBundleClass(value: string): value is ChatProofBundleClass {
  return (CHAT_PROOF_BUNDLE_CLASSES as readonly string[]).includes(value);
}

export function isChatProofExportFormat(value: string): value is ChatProofExportFormat {
  return (CHAT_PROOF_EXPORT_FORMATS as readonly string[]).includes(value);
}

export function isChatProofConflictKind(value: string): value is ChatProofConflictKind {
  return (CHAT_PROOF_CONFLICT_KINDS as readonly string[]).includes(value);
}

export function getProofNodePriority(kind: ChatProofNodeKind): number {
  return CHAT_PROOF_NODE_PRIORITY[kind] ?? 999;
}

export function getProofEdgePriority(kind: ChatProofEdgeKind): number {
  return CHAT_PROOF_EDGE_PRIORITY[kind] ?? 999;
}

export function proofNodeHasReplayLink(node: ChatProofNodeDescriptor): boolean {
  return Boolean(node.replayLink && node.replayLink.replayId);
}

export function proofNodeHasTelemetryLink(node: ChatProofNodeDescriptor): boolean {
  return Boolean(node.telemetryLink && (node.telemetryLink.telemetryId || node.telemetryLink.recordId));
}

export function proofNodeHasParentHash(node: ChatProofNodeDescriptor): boolean {
  return Boolean(node.messageEnvelope && node.messageEnvelope.parentProofHash);
}

export function proofVerificationPassed(verification?: ChatProofVerificationEnvelope): boolean {
  return verification?.state === 'VERIFIED';
}

export function proofVerificationFailed(verification?: ChatProofVerificationEnvelope): boolean {
  return verification?.state === 'FAILED';
}

export function proofBundleHasNodes(bundle: ChatProofBundleDescriptor): boolean {
  return bundle.nodeIds.length > 0;
}

export function proofBundleHasEdges(bundle: ChatProofBundleDescriptor): boolean {
  return bundle.edgeIds.length > 0;
}

export function proofExportNeedsVerification(policy: ChatProofPolicyDescriptor): boolean {
  return policy.exportVerificationRequired;
}

export function proofConflictIsRecoverable(conflict: ChatProofConflict): boolean {
  return conflict.recoverable;
}

export function resolveProofNodeById(
  ledger: ChatProofLedgerState,
  nodeId: ChatProofNodeId,
): ChatProofNodeDescriptor | undefined {
  return ledger.nodesById[nodeId];
}

export function resolveProofEdgeById(
  ledger: ChatProofLedgerState,
  edgeId: ChatProofEdgeId,
): ChatProofEdgeDescriptor | undefined {
  return ledger.edgesById[edgeId];
}

export function resolveOutgoingProofEdges(
  ledger: ChatProofLedgerState,
  nodeId: ChatProofNodeId,
): readonly ChatProofEdgeDescriptor[] {
  return ledger.outgoingEdgesByNodeId[nodeId] ?? [];
}

export function resolveIncomingProofEdges(
  ledger: ChatProofLedgerState,
  nodeId: ChatProofNodeId,
): readonly ChatProofEdgeDescriptor[] {
  return ledger.incomingEdgesByNodeId[nodeId] ?? [];
}

export function resolveProofConflictsForNode(
  ledger: ChatProofLedgerState,
  nodeId: ChatProofNodeId,
): readonly ChatProofConflict[] {
  return Object.values(ledger.conflictsById).filter((conflict) => conflict.nodeId === nodeId);
}

export function resolveProofBundleById(
  ledger: ChatProofLedgerState,
  bundleId: ChatProofBundleId,
): ChatProofBundleDescriptor | undefined {
  return ledger.bundlesById[bundleId];
}

export function resolveLatestProofSnapshot(
  ledger: ChatProofLedgerState,
): ChatProofSnapshot | undefined {
  return ledger.latestSnapshotId ? ledger.snapshotsById[ledger.latestSnapshotId] : undefined;
}

export function messageProofEnvelopeToSubjectRef(
  messageId: ChatMessageId,
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  envelope?: ChatMessageProofEnvelope,
): ChatProofSubjectRef {
  return {
    subjectId: (`message:${String(messageId)}` as ChatProofSubjectId),
    kind: 'MESSAGE',
    roomId,
    channelId,
    messageId,
    replayId: envelope?.replayId,
    memoryAnchorId: envelope?.anchorIds?.[0],
  };
}

export function transcriptAuditEnvelopeToEvidence(
  audit: ChatTranscriptAuditEnvelope,
): ChatProofEvidenceBlock {
  return {
    evidenceId: (`audit:${String(audit.messageId)}` as ChatProofEvidenceId),
    kind: 'TRANSCRIPT_INDEX',
    subject: {
      subjectId: (`message:${String(audit.messageId)}` as ChatProofSubjectId),
      kind: 'MESSAGE',
      roomId: audit.roomId,
      channelId: audit.channelId,
      messageId: audit.messageId,
      requestId: audit.requestId,
    },
    metadata: audit.auditMeta as unknown as JsonObject | undefined,
    createdAt: audit.messageAuditTrail.at(-1)?.at ?? (0 as UnixMs),
    authority: 'BACKEND_AUTHORITATIVE',
  };
}

export function moderationResultToProofConflict(
  result: ChatModerationResult,
  messageId?: ChatMessageId,
): ChatProofConflict | undefined {
  if (result.decision.state === 'ALLOWED') {
    return undefined;
  }
  return {
    conflictId: (`moderation:${String(messageId ?? 'unknown')}:${result.decision.state}` as ChatProofConflictId),
    kind: result.decision.state === 'REDACTED' ? 'REDACTION_SPLIT' : 'AUTHORITATIVE_OVERRIDE',
    detectedAt: result.context.evaluatedAt,
    detectedBy: result.context.authorityHint,
    nodeId: undefined,
    description: result.decision.reasonCode ?? result.decision.state,
    recoverable: result.decision.state !== 'BLOCKED',
    metadata: ({
      state: result.decision.state,
      actionKind: result.decision.actionKind,
      severity: result.decision.severity,
      ruleId: result.decision.ruleId,
    } as JsonObject),
  };
}

export function invasionOutcomeToProofEvidence(
  invasion: ChatInvasionOutcome,
): ChatProofEvidenceBlock {
  return {
    evidenceId: (`invasion:${String(invasion.outcomeId)}` as ChatProofEvidenceId),
    kind: 'INVASION_STAGE',
    subject: {
      subjectId: (`invasion:${String(invasion.invasionId)}` as ChatProofSubjectId),
      kind: 'INVASION',
    },
    metadata: invasion as unknown as JsonObject,
    createdAt: invasion.occurredAt,
    authority: 'BACKEND_AUTHORITATIVE',
  };
}

export function commandReceiptToProofEvidence(
  receipt: ChatCommandExecutionReceipt,
): ChatProofEvidenceBlock {
  return {
    evidenceId: (`command:${String(receipt.executionId)}` as ChatProofEvidenceId),
    kind: 'COMMAND_RECEIPT',
    subject: {
      subjectId: (`command:${String(receipt.executionId)}` as ChatProofSubjectId),
      kind: 'COMMAND',
      requestId: receipt.requestId,
    },
    metadata: receipt as unknown as JsonObject,
    createdAt: receipt.executedAt,
    authority: 'BACKEND_AUTHORITATIVE',
  };
}

export function buildEmptyChatProofLedgerState(now: UnixMs): ChatProofLedgerState {
  return {
    proofId: 'chat-proof-ledger/default' as ChatProofId,
    ledgerId: 'chat-proof-ledger/default' as ChatProofLedgerId,
    version: ChatChannelsModule.CHAT_CONTRACT_VERSION,
    nodesById: Object.freeze({}),
    edgesById: Object.freeze({}),
    outgoingEdgesByNodeId: Object.freeze({}),
    incomingEdgesByNodeId: Object.freeze({}),
    conflictsById: Object.freeze({}),
    bundlesById: Object.freeze({}),
    exportsById: Object.freeze({}),
    snapshotsById: Object.freeze({}),
    generatedAt: now,
  };
}

// ============================================================================
// MARK: Stable exported package
// ============================================================================

export const CHAT_PROOF_CONSTANTS = Object.freeze({
  version: ChatChannelsModule.CHAT_CONTRACT_VERSION,
  apiVersion: '1.0.0-alpha',
  authorities: ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES,
  defaultPolicy: CHAT_PROOF_DEFAULT_POLICY,
  defaultExportFormat: "JSON" as ChatProofExportFormat,
  defaultBundleClass: "MESSAGE_ONLY" as ChatProofBundleClass,
} as const);

export const CHAT_PROOF_CONTRACT = Object.freeze({
  constants: CHAT_PROOF_CONSTANTS,
  nodeKinds: CHAT_PROOF_NODE_KINDS,
  edgeKinds: CHAT_PROOF_EDGE_KINDS,
  subjectKinds: CHAT_PROOF_SUBJECT_KINDS,
  evidenceKinds: CHAT_PROOF_EVIDENCE_KINDS,
  hashAlgorithms: CHAT_PROOF_HASH_ALGORITHMS,
  verificationStates: CHAT_PROOF_VERIFICATION_STATES,
  signatureStates: CHAT_PROOF_SIGNATURE_STATES,
  ledgerActions: CHAT_PROOF_LEDGER_ACTIONS,
  queryScopes: CHAT_PROOF_QUERY_SCOPES,
  bundleClasses: CHAT_PROOF_BUNDLE_CLASSES,
  exportFormats: CHAT_PROOF_EXPORT_FORMATS,
  mutationKinds: CHAT_PROOF_MUTATION_KINDS,
  consistencyLevels: CHAT_PROOF_CONSISTENCY_LEVELS,
  replayAlignmentStates: CHAT_PROOF_REPLAY_ALIGNMENT_STATES,
  conflictKinds: CHAT_PROOF_CONFLICT_KINDS,
  policyClasses: CHAT_PROOF_POLICY_CLASSES,
  defaultPolicy: CHAT_PROOF_DEFAULT_POLICY,
  nodePriority: CHAT_PROOF_NODE_PRIORITY,
  edgePriority: CHAT_PROOF_EDGE_PRIORITY,
  hashAlgorithmDescriptor: CHAT_PROOF_HASH_ALGORITHM_DESCRIPTOR,
} as const);

export default CHAT_PROOF_CONTRACT;