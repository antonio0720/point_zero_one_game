/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT TELEMETRY SCHEMA
 * FILE: pzo-web/src/engines/chat/telemetry/ChatTelemetrySchema.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend schema + validation + normalization layer for the new
 * chat telemetry lane.
 *
 * This file is intentionally not a thin type wrapper.
 * It is the authoritative schema surface that sits between:
 *
 * - frontend capture (`ChatTelemetryEmitter.ts`),
 * - frontend queue / persistence / retry (`ChatTelemetryQueue.ts`),
 * - future socket / HTTP transport from `pzo-server/src/chat`, and
 * - backend ingestion / learning / replay truth in `backend/src/game/engine/chat`.
 *
 * Design Doctrine
 * ---------------
 * - the emitter may capture quickly, but schema decides what is structurally
 *   valid enough to move forward,
 * - schema normalization must preserve gameplay meaning without requiring raw
 *   transcript text,
 * - event families, payload expectations, severity alignment, and privacy
 *   redaction are first-class concerns,
 * - replay, legend, rescue, learning, negotiation, and NPC cadence are not
 *   second-tier telemetry domains,
 * - this file is forward-compatible with the future shared/contracts/chat and
 *   shared/contracts/chat/learning authorities while remaining immediately
 *   compatible with the generated frontend emitter surface.
 *
 * Current Integration Reality
 * ---------------------------
 * The generated `ChatTelemetryEmitter.ts` already exports the stable envelope,
 * payload, config, and snapshot contracts. To avoid destabilizing that file in
 * this pass, this schema locks onto those exported types today.
 *
 * In the next migration pass, emitter types can be moved here and re-exported
 * outward. For now, this file still acts as the behavioral authority by:
 * - validating envelopes,
 * - normalizing severity / tags / timestamps / sample rate,
 * - redacting sensitive or unstable fields,
 * - deriving queue policy hints,
 * - mapping every event into a stable telemetry family,
 * - providing deterministic summaries for logs, replay, and diagnostics.
 *
 * ============================================================================
 */

import type {
  ChatTelemetryChannel,
  ChatTelemetryConfig,
  ChatTelemetryDraftSummary,
  ChatTelemetryEnvelope,
  ChatTelemetryEventName,
  ChatTelemetryHash,
  ChatTelemetryLearningSnapshot,
  ChatTelemetryOrigin,
  ChatTelemetryPerformanceMark,
  ChatTelemetryReplayReference,
  ChatTelemetryRunSnapshot,
  ChatTelemetrySafeTextSummary,
  ChatTelemetrySenderRole,
  ChatTelemetrySeverity,
  ChannelSelectedPayload,
  ChatClosedPayload,
  ChatOpenedPayload,
  EngineEventIngestedPayload,
  InvasionTriggeredPayload,
  LearningFeatureSnapshotPayload,
  LegendMomentPayload,
  MessageReceivedPayload,
  MessageSendRequestedPayload,
  MessageSendResultPayload,
  NpcResponsePlannedPayload,
  PerformanceMarkPayload,
  RecoveryPromptPayload,
  ReplayOpenedPayload,
} from './ChatTelemetryEmitter';

/* ========================================================================== *
 * Section 1 — Schema-local core types
 * ========================================================================== */

export type ChatTelemetryFamily =
  | 'SESSION'
  | 'VIEW'
  | 'CHANNEL'
  | 'ROOM'
  | 'COMPOSER'
  | 'MESSAGE'
  | 'THREAD'
  | 'PRESENCE'
  | 'NPC'
  | 'HATER'
  | 'HELPER'
  | 'AUDIENCE'
  | 'INVASION'
  | 'NEGOTIATION'
  | 'RECOVERY'
  | 'LEGEND'
  | 'PROOF'
  | 'REPLAY'
  | 'LEARNING'
  | 'INFERENCE'
  | 'MODERATION'
  | 'SOCKET'
  | 'QUEUE'
  | 'ENGINE'
  | 'PERFORMANCE'
  | 'DIAGNOSTIC';

export type ChatTelemetryDispatchPriority =
  | 'BACKGROUND'
  | 'STANDARD'
  | 'HIGH'
  | 'CRITICAL';

export type ChatTelemetryRetentionClass =
  | 'EPHEMERAL'
  | 'SESSION'
  | 'REPLAY'
  | 'LEARNING'
  | 'AUDIT';

export type ChatTelemetryValidationIssueCode =
  | 'ENVELOPE_NOT_OBJECT'
  | 'EVENT_NAME_INVALID'
  | 'SEVERITY_INVALID'
  | 'ORIGIN_INVALID'
  | 'SESSION_ID_INVALID'
  | 'SEQ_INVALID'
  | 'EVENT_ID_INVALID'
  | 'TIMESTAMP_INVALID'
  | 'SAMPLE_RATE_INVALID'
  | 'PAYLOAD_NOT_OBJECT'
  | 'RUN_NOT_OBJECT'
  | 'LEARNING_NOT_OBJECT'
  | 'PERFORMANCE_NOT_OBJECT'
  | 'TAGS_INVALID'
  | 'PAYLOAD_MISSING_REQUIRED_FIELD'
  | 'PAYLOAD_FIELD_INVALID'
  | 'PAYLOAD_SHAPE_INVALID'
  | 'RUN_FIELD_INVALID'
  | 'LEARNING_FIELD_INVALID'
  | 'PERFORMANCE_FIELD_INVALID'
  | 'CHANNEL_INVALID'
  | 'SENDER_ROLE_INVALID'
  | 'SAFE_TEXT_INVALID'
  | 'REPLAY_REFERENCE_INVALID'
  | 'DRAFT_SUMMARY_INVALID'
  | 'CONFIG_PRIVACY_MISMATCH';

export interface ChatTelemetryValidationIssue {
  code: ChatTelemetryValidationIssueCode;
  path: string;
  message: string;
  fatal: boolean;
}

export interface ChatTelemetryValidationResult {
  ok: boolean;
  issues: ChatTelemetryValidationIssue[];
}

export interface ChatTelemetryQueuePolicyHint {
  priority: ChatTelemetryDispatchPriority;
  retention: ChatTelemetryRetentionClass;
  flushImmediately: boolean;
  dedupeEligible: boolean;
  replayWorthy: boolean;
  learningRelevant: boolean;
  allowOfflinePersistence: boolean;
}

export interface ChatTelemetryEventSchemaSpec<
  TPayload extends object = Record<string, unknown>,
> {
  family: ChatTelemetryFamily;
  payloadGuard: (payload: unknown, issues?: ChatTelemetryValidationIssue[]) => payload is TPayload;
  policy: ChatTelemetryQueuePolicyHint;
  preferredSeverity?: ChatTelemetrySeverity;
  requiredTags?: readonly string[];
  description: string;
}

export type AnyChatTelemetryEnvelope = ChatTelemetryEnvelope<Record<string, unknown>>;

/* ========================================================================== *
 * Section 2 — Stable event payload map
 * ========================================================================== */

export interface ChatTelemetryEventPayloadMap {
  CHAT_SESSION_STARTED: ChatOpenedPayload;
  CHAT_SESSION_ENDED: ChatClosedPayload;
  CHAT_OPENED: ChatOpenedPayload;
  CHAT_CLOSED: ChatClosedPayload;
  CHAT_COLLAPSED: ChatClosedPayload;
  CHAT_EXPANDED: ChatOpenedPayload;
  CHAT_RENDERED: Record<string, unknown>;
  CHANNEL_SELECTED: ChannelSelectedPayload;
  CHANNEL_VIEWED: ChannelSelectedPayload;
  CHANNEL_MUTED: ChannelSelectedPayload;
  CHANNEL_UNMUTED: ChannelSelectedPayload;
  ROOM_BOUND: Record<string, unknown>;
  ROOM_UNBOUND: Record<string, unknown>;
  COMPOSER_FOCUSED: Record<string, unknown>;
  COMPOSER_BLURRED: Record<string, unknown>;
  COMPOSER_DRAFT_CHANGED: { channel?: ChatTelemetryChannel; roomId?: string; draft: ChatTelemetryDraftSummary };
  COMPOSER_COMMAND_DETECTED: { channel?: ChatTelemetryChannel; roomId?: string; command: string; hasArgs?: boolean };
  COMPOSER_ATTACHMENT_STAGED: { channel?: ChatTelemetryChannel; roomId?: string; attachmentCount: number; attachmentKinds?: string[] };
  MESSAGE_SEND_REQUESTED: MessageSendRequestedPayload;
  MESSAGE_SEND_QUEUED: MessageSendResultPayload;
  MESSAGE_SENT: MessageSendResultPayload;
  MESSAGE_SEND_FAILED: MessageSendResultPayload;
  MESSAGE_RECEIVED: MessageReceivedPayload;
  MESSAGE_RENDERED: MessageReceivedPayload;
  MESSAGE_SUPPRESSED: MessageReceivedPayload & { suppressionReason?: string };
  MESSAGE_REDACTED: MessageReceivedPayload & { redactionReason?: string };
  MESSAGE_ACTION_TRIGGERED: { actionId?: string; messageId?: string; channel?: ChatTelemetryChannel; roomId?: string; actionKind?: string };
  THREAD_OPENED: { threadId?: string; rootMessageId?: string; channel?: ChatTelemetryChannel; roomId?: string };
  THREAD_CLOSED: { threadId?: string; rootMessageId?: string; channel?: ChatTelemetryChannel; roomId?: string };
  TYPING_STARTED: { channel?: ChatTelemetryChannel; roomId?: string; senderRole?: ChatTelemetrySenderRole; senderId?: string };
  TYPING_STOPPED: { channel?: ChatTelemetryChannel; roomId?: string; senderRole?: ChatTelemetrySenderRole; senderId?: string };
  PRESENCE_CHANGED: { channel?: ChatTelemetryChannel; roomId?: string; senderId?: string; status?: string; wasOnline?: boolean; isOnline?: boolean };
  READ_RECEIPT_RENDERED: { channel?: ChatTelemetryChannel; roomId?: string; messageId?: string; readerId?: string };
  DELIVERY_RECEIPT_RENDERED: { channel?: ChatTelemetryChannel; roomId?: string; messageId?: string; receiptState?: string };
  NPC_TYPING_STARTED: NpcResponsePlannedPayload;
  NPC_TYPING_STOPPED: NpcResponsePlannedPayload;
  NPC_MESSAGE_PLANNED: NpcResponsePlannedPayload;
  NPC_MESSAGE_RENDERED: NpcResponsePlannedPayload & { messageId?: string };
  NPC_RESPONSE_SKIPPED: NpcResponsePlannedPayload & { skipReason?: string };
  NPC_CADENCE_ESCALATED: NpcResponsePlannedPayload & { cadenceDelta?: number };
  NPC_CADENCE_DAMPENED: NpcResponsePlannedPayload & { cadenceDelta?: number };
  HATER_TARGET_LOCKED: NpcResponsePlannedPayload & { targetPlayerId?: string; targetProfileId?: string };
  HATER_TAUNT_RENDERED: NpcResponsePlannedPayload & { messageId?: string; aggressionScore?: number };
  HELPER_INTERVENTION_TRIGGERED: RecoveryPromptPayload;
  HELPER_INTERVENTION_SKIPPED: RecoveryPromptPayload & { skipReason?: string };
  AUDIENCE_HEAT_CHANGED: { channel?: ChatTelemetryChannel; roomId?: string; fromHeat?: number; toHeat?: number; source?: string };
  INVASION_TRIGGERED: InvasionTriggeredPayload;
  INVASION_RESOLVED: InvasionTriggeredPayload & { resolvedAtMs?: number; result?: string };
  NEGOTIATION_SIGNAL_CAPTURED: { channel?: ChatTelemetryChannel; roomId?: string; bluffRisk?: number; urgencyScore?: number; overpayRisk?: number; offerValue?: number };
  NEGOTIATION_COUNTER_WINDOW_OPENED: { channel?: ChatTelemetryChannel; roomId?: string; assetId?: string; offerValue?: number; expiresAtMs?: number };
  RECOVERY_PROMPT_TRIGGERED: RecoveryPromptPayload;
  RECOVERY_PROMPT_ACCEPTED: RecoveryPromptPayload;
  RECOVERY_PROMPT_DISMISSED: RecoveryPromptPayload;
  LEGEND_MOMENT_CAPTURED: LegendMomentPayload;
  PROOF_BADGE_RENDERED: LegendMomentPayload;
  PROOF_HASH_EXPOSED: LegendMomentPayload;
  REPLAY_OPENED: ReplayOpenedPayload;
  REPLAY_CLOSED: ReplayOpenedPayload;
  REPLAY_RANGE_REQUESTED: ReplayOpenedPayload;
  REPLAY_RANGE_LOADED: ReplayOpenedPayload;
  REPLAY_SLICE_EXPORTED: ReplayOpenedPayload;
  REPLAY_LEGEND_JUMPED: ReplayOpenedPayload;
  LEARNING_FEATURE_SNAPSHOT: LearningFeatureSnapshotPayload;
  LEARNING_HANDOFF_REQUESTED: LearningFeatureSnapshotPayload;
  LEARNING_HANDOFF_ACKED: LearningFeatureSnapshotPayload;
  INFERENCE_REQUESTED: LearningFeatureSnapshotPayload;
  INFERENCE_COMPLETED: LearningFeatureSnapshotPayload;
  INFERENCE_FAILED: LearningFeatureSnapshotPayload & { failureCode?: string };
  MODERATION_WARNING_RENDERED: { channel?: ChatTelemetryChannel; roomId?: string; messageId?: string; reason?: string; policyId?: string };
  MODERATION_ENFORCEMENT_APPLIED: { channel?: ChatTelemetryChannel; roomId?: string; messageId?: string; reason?: string; action?: string; policyId?: string };
  SOCKET_CONNECTED: { roomId?: string; socketId?: string; transport?: string };
  SOCKET_DISCONNECTED: { roomId?: string; socketId?: string; transport?: string; code?: string };
  SOCKET_RECONNECTING: { roomId?: string; socketId?: string; attempt?: number; backoffMs?: number };
  QUEUE_ENQUEUED: { eventName?: ChatTelemetryEventName; pendingCount?: number; roomId?: string; channel?: ChatTelemetryChannel };
  QUEUE_FLUSHED: { count?: number; roomId?: string; channel?: ChatTelemetryChannel };
  QUEUE_DROPPED: { eventName?: ChatTelemetryEventName; roomId?: string; channel?: ChatTelemetryChannel; dropReason?: string };
  QUEUE_RETRIED: { count?: number; roomId?: string; channel?: ChatTelemetryChannel; attempt?: number };
  ENGINE_EVENT_INGESTED: EngineEventIngestedPayload;
  ENGINE_EVENT_IGNORED: EngineEventIngestedPayload & { ignoreReason?: string };
  PERFORMANCE_MARK: PerformanceMarkPayload;
  DIAGNOSTIC: { label?: string; detail?: string; context?: Record<string, unknown> };
}

export type ChatTelemetryPayloadForEvent<TEventName extends ChatTelemetryEventName> =
  TEventName extends keyof ChatTelemetryEventPayloadMap
    ? ChatTelemetryEventPayloadMap[TEventName]
    : Record<string, unknown>;

/* ========================================================================== *
 * Section 3 — Primitive validators
 * ========================================================================== */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isOptionalString(value: unknown): value is string | undefined {
  return typeof value === 'undefined' || typeof value === 'string';
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return typeof value === 'undefined' || typeof value === 'boolean';
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return typeof value === 'undefined' || isFiniteNumber(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function pushIssue(
  issues: ChatTelemetryValidationIssue[] | undefined,
  code: ChatTelemetryValidationIssueCode,
  path: string,
  message: string,
  fatal: boolean = true,
): void {
  if (!issues) return;
  issues.push({ code, path, message, fatal });
}

function assertField(
  condition: boolean,
  issues: ChatTelemetryValidationIssue[] | undefined,
  code: ChatTelemetryValidationIssueCode,
  path: string,
  message: string,
  fatal: boolean = true,
): boolean {
  if (condition) return true;
  pushIssue(issues, code, path, message, fatal);
  return false;
}

/* ========================================================================== *
 * Section 4 — Stable domains / enums / sets
 * ========================================================================== */

export const CHAT_TELEMETRY_SCHEMA_VERSION = 1 as const;

export const CHAT_TELEMETRY_CHANNELS: ReadonlySet<ChatTelemetryChannel> = new Set([
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
  'SYSTEM_SHADOW',
  'NPC_SHADOW',
  'RIVALRY_SHADOW',
  'RESCUE_SHADOW',
  'LIVEOPS_SHADOW',
]);

export const CHAT_TELEMETRY_SEVERITIES: ReadonlySet<ChatTelemetrySeverity> = new Set([
  'TRACE',
  'INFO',
  'NOTICE',
  'WARNING',
  'CRITICAL',
]);

export const CHAT_TELEMETRY_ORIGINS: ReadonlySet<ChatTelemetryOrigin> = new Set([
  'UI',
  'ENGINE',
  'EVENT_BUS',
  'SOCKET',
  'NPC',
  'SYSTEM',
  'REPLAY',
  'LEARNING',
  'QUEUE',
  'MANUAL',
]);

export const CHAT_TELEMETRY_SENDER_ROLES: ReadonlySet<ChatTelemetrySenderRole> = new Set([
  'PLAYER',
  'NPC',
  'HELPER',
  'HATER',
  'SYSTEM',
  'LIVEOPS',
  'MODERATOR',
  'UNKNOWN',
]);

export const CHAT_TELEMETRY_EVENT_NAMES: readonly ChatTelemetryEventName[] = [
  'CHAT_SESSION_STARTED',
  'CHAT_SESSION_ENDED',
  'CHAT_OPENED',
  'CHAT_CLOSED',
  'CHAT_COLLAPSED',
  'CHAT_EXPANDED',
  'CHAT_RENDERED',
  'CHANNEL_SELECTED',
  'CHANNEL_VIEWED',
  'CHANNEL_MUTED',
  'CHANNEL_UNMUTED',
  'ROOM_BOUND',
  'ROOM_UNBOUND',
  'COMPOSER_FOCUSED',
  'COMPOSER_BLURRED',
  'COMPOSER_DRAFT_CHANGED',
  'COMPOSER_COMMAND_DETECTED',
  'COMPOSER_ATTACHMENT_STAGED',
  'MESSAGE_SEND_REQUESTED',
  'MESSAGE_SEND_QUEUED',
  'MESSAGE_SENT',
  'MESSAGE_SEND_FAILED',
  'MESSAGE_RECEIVED',
  'MESSAGE_RENDERED',
  'MESSAGE_SUPPRESSED',
  'MESSAGE_REDACTED',
  'MESSAGE_ACTION_TRIGGERED',
  'THREAD_OPENED',
  'THREAD_CLOSED',
  'TYPING_STARTED',
  'TYPING_STOPPED',
  'PRESENCE_CHANGED',
  'READ_RECEIPT_RENDERED',
  'DELIVERY_RECEIPT_RENDERED',
  'NPC_TYPING_STARTED',
  'NPC_TYPING_STOPPED',
  'NPC_MESSAGE_PLANNED',
  'NPC_MESSAGE_RENDERED',
  'NPC_RESPONSE_SKIPPED',
  'NPC_CADENCE_ESCALATED',
  'NPC_CADENCE_DAMPENED',
  'HATER_TARGET_LOCKED',
  'HATER_TAUNT_RENDERED',
  'HELPER_INTERVENTION_TRIGGERED',
  'HELPER_INTERVENTION_SKIPPED',
  'AUDIENCE_HEAT_CHANGED',
  'INVASION_TRIGGERED',
  'INVASION_RESOLVED',
  'NEGOTIATION_SIGNAL_CAPTURED',
  'NEGOTIATION_COUNTER_WINDOW_OPENED',
  'RECOVERY_PROMPT_TRIGGERED',
  'RECOVERY_PROMPT_ACCEPTED',
  'RECOVERY_PROMPT_DISMISSED',
  'LEGEND_MOMENT_CAPTURED',
  'PROOF_BADGE_RENDERED',
  'PROOF_HASH_EXPOSED',
  'REPLAY_OPENED',
  'REPLAY_CLOSED',
  'REPLAY_RANGE_REQUESTED',
  'REPLAY_RANGE_LOADED',
  'REPLAY_SLICE_EXPORTED',
  'REPLAY_LEGEND_JUMPED',
  'LEARNING_FEATURE_SNAPSHOT',
  'LEARNING_HANDOFF_REQUESTED',
  'LEARNING_HANDOFF_ACKED',
  'INFERENCE_REQUESTED',
  'INFERENCE_COMPLETED',
  'INFERENCE_FAILED',
  'MODERATION_WARNING_RENDERED',
  'MODERATION_ENFORCEMENT_APPLIED',
  'SOCKET_CONNECTED',
  'SOCKET_DISCONNECTED',
  'SOCKET_RECONNECTING',
  'QUEUE_ENQUEUED',
  'QUEUE_FLUSHED',
  'QUEUE_DROPPED',
  'QUEUE_RETRIED',
  'ENGINE_EVENT_INGESTED',
  'ENGINE_EVENT_IGNORED',
  'PERFORMANCE_MARK',
  'DIAGNOSTIC',
] as const;

const CHAT_TELEMETRY_EVENT_NAME_SET = new Set<ChatTelemetryEventName>(CHAT_TELEMETRY_EVENT_NAMES);

/* ========================================================================== *
 * Section 5 — Structural validators for nested contracts
 * ========================================================================== */

export function isChatTelemetryHash(
  value: unknown,
  issues?: ChatTelemetryValidationIssue[],
  path: string = 'hash',
): value is ChatTelemetryHash {
  if (!isRecord(value)) {
    pushIssue(issues, 'PAYLOAD_SHAPE_INVALID', path, 'Hash must be an object.');
    return false;
  }

  const ok =
    assertField(value.algorithm === 'fnv1a-32', issues, 'PAYLOAD_FIELD_INVALID', `${path}.algorithm`, 'Hash algorithm must be fnv1a-32.') &&
    assertField(isString(value.value) && value.value.length > 0, issues, 'PAYLOAD_FIELD_INVALID', `${path}.value`, 'Hash value must be a non-empty string.');

  return ok;
}

export function isChatTelemetrySafeTextSummary(
  value: unknown,
  issues?: ChatTelemetryValidationIssue[],
  path: string = 'safeText',
): value is ChatTelemetrySafeTextSummary {
  if (!isRecord(value)) {
    pushIssue(issues, 'SAFE_TEXT_INVALID', path, 'Safe text summary must be an object.');
    return false;
  }

  let ok = true;
  ok = assertField(isFiniteNumber(value.charCount), issues, 'SAFE_TEXT_INVALID', `${path}.charCount`, 'charCount must be a finite number.') && ok;
  ok = assertField(isFiniteNumber(value.tokenEstimate), issues, 'SAFE_TEXT_INVALID', `${path}.tokenEstimate`, 'tokenEstimate must be a finite number.') && ok;
  ok = assertField(isFiniteNumber(value.lineCount), issues, 'SAFE_TEXT_INVALID', `${path}.lineCount`, 'lineCount must be a finite number.') && ok;
  ok = assertField(isFiniteNumber(value.mentionCount), issues, 'SAFE_TEXT_INVALID', `${path}.mentionCount`, 'mentionCount must be a finite number.') && ok;
  ok = assertField(isFiniteNumber(value.emojiCount), issues, 'SAFE_TEXT_INVALID', `${path}.emojiCount`, 'emojiCount must be a finite number.') && ok;
  ok = assertField(isBoolean(value.looksLikeCommand), issues, 'SAFE_TEXT_INVALID', `${path}.looksLikeCommand`, 'looksLikeCommand must be boolean.') && ok;
  ok = assertField(isBoolean(value.containsUrl), issues, 'SAFE_TEXT_INVALID', `${path}.containsUrl`, 'containsUrl must be boolean.') && ok;
  ok = assertField(isBoolean(value.containsQuestion), issues, 'SAFE_TEXT_INVALID', `${path}.containsQuestion`, 'containsQuestion must be boolean.') && ok;
  ok = assertField(isBoolean(value.containsNumericOffer), issues, 'SAFE_TEXT_INVALID', `${path}.containsNumericOffer`, 'containsNumericOffer must be boolean.') && ok;
  ok = assertField(isBoolean(value.containsProfanityRisk), issues, 'SAFE_TEXT_INVALID', `${path}.containsProfanityRisk`, 'containsProfanityRisk must be boolean.') && ok;

  if (typeof value.firstWordLowerHash !== 'undefined') {
    ok = isChatTelemetryHash(value.firstWordLowerHash, issues, `${path}.firstWordLowerHash`) && ok;
  }
  if (typeof value.bodyHash !== 'undefined') {
    ok = isChatTelemetryHash(value.bodyHash, issues, `${path}.bodyHash`) && ok;
  }
  if (typeof value.preview !== 'undefined') {
    ok = assertField(isString(value.preview), issues, 'SAFE_TEXT_INVALID', `${path}.preview`, 'preview must be a string when present.') && ok;
  }

  return ok;
}

export function isChatTelemetryReplayReference(
  value: unknown,
  issues?: ChatTelemetryValidationIssue[],
  path: string = 'replay',
): value is ChatTelemetryReplayReference {
  if (!isRecord(value)) {
    pushIssue(issues, 'REPLAY_REFERENCE_INVALID', path, 'Replay reference must be an object.');
    return false;
  }

  let ok = true;
  ok = assertField(isOptionalString(value.replayId), issues, 'REPLAY_REFERENCE_INVALID', `${path}.replayId`, 'replayId must be a string when present.') && ok;
  ok = assertField(isOptionalString(value.sliceId), issues, 'REPLAY_REFERENCE_INVALID', `${path}.sliceId`, 'sliceId must be a string when present.') && ok;
  ok = assertField(isOptionalFiniteNumber(value.cursorStart), issues, 'REPLAY_REFERENCE_INVALID', `${path}.cursorStart`, 'cursorStart must be numeric when present.') && ok;
  ok = assertField(isOptionalFiniteNumber(value.cursorEnd), issues, 'REPLAY_REFERENCE_INVALID', `${path}.cursorEnd`, 'cursorEnd must be numeric when present.') && ok;
  ok = assertField(isOptionalString(value.momentId), issues, 'REPLAY_REFERENCE_INVALID', `${path}.momentId`, 'momentId must be a string when present.') && ok;
  ok = assertField(isOptionalString(value.legendId), issues, 'REPLAY_REFERENCE_INVALID', `${path}.legendId`, 'legendId must be a string when present.') && ok;
  return ok;
}

export function isChatTelemetryDraftSummary(
  value: unknown,
  issues?: ChatTelemetryValidationIssue[],
  path: string = 'draft',
): value is ChatTelemetryDraftSummary {
  if (!isRecord(value)) {
    pushIssue(issues, 'DRAFT_SUMMARY_INVALID', path, 'Draft summary must be an object.');
    return false;
  }

  let ok = true;
  ok = isChatTelemetrySafeTextSummary(value.safeText, issues, `${path}.safeText`) && ok;
  ok = assertField(isFiniteNumber(value.attachmentCount), issues, 'DRAFT_SUMMARY_INVALID', `${path}.attachmentCount`, 'attachmentCount must be numeric.') && ok;
  ok = assertField(isOptionalString(value.replyToMessageId), issues, 'DRAFT_SUMMARY_INVALID', `${path}.replyToMessageId`, 'replyToMessageId must be string when present.') && ok;
  ok = assertField(isOptionalBoolean(value.isWhisper), issues, 'DRAFT_SUMMARY_INVALID', `${path}.isWhisper`, 'isWhisper must be boolean when present.') && ok;
  ok = assertField(isOptionalBoolean(value.isNegotiationOffer), issues, 'DRAFT_SUMMARY_INVALID', `${path}.isNegotiationOffer`, 'isNegotiationOffer must be boolean when present.') && ok;
  ok = assertField(isOptionalBoolean(value.isCounterplayReply), issues, 'DRAFT_SUMMARY_INVALID', `${path}.isCounterplayReply`, 'isCounterplayReply must be boolean when present.') && ok;
  ok = assertField(isOptionalFiniteNumber(value.draftVersion), issues, 'DRAFT_SUMMARY_INVALID', `${path}.draftVersion`, 'draftVersion must be numeric when present.') && ok;
  return ok;
}

export function isChatTelemetryRunSnapshot(
  value: unknown,
  issues?: ChatTelemetryValidationIssue[],
  path: string = 'run',
): value is ChatTelemetryRunSnapshot {
  if (!isRecord(value)) {
    pushIssue(issues, 'RUN_NOT_OBJECT', path, 'Run snapshot must be an object.');
    return false;
  }

  const fields: Array<[string, unknown]> = Object.entries(value);
  let ok = true;
  for (const [key, fieldValue] of fields) {
    const fieldPath = `${path}.${key}`;
    switch (key) {
      case 'runId':
      case 'playerId':
      case 'profileId':
      case 'roomId':
      case 'modeId':
      case 'modeVariantId':
      case 'tickTier':
      case 'pressureTier':
      case 'battlePhase':
      case 'sovereigntyGrade':
      case 'activeNpcId':
      case 'activeHaterId':
      case 'activeHelperId':
      case 'activeLegendMomentId':
        ok = assertField(isOptionalString(fieldValue), issues, 'RUN_FIELD_INVALID', fieldPath, `${key} must be a string when present.`) && ok;
        break;
      case 'activeChannel':
        ok = assertField(typeof fieldValue === 'undefined' || isChatTelemetryChannel(fieldValue), issues, 'CHANNEL_INVALID', fieldPath, 'activeChannel must be a valid channel when present.') && ok;
        break;
      default:
        ok = assertField(
          typeof fieldValue === 'undefined' || isFiniteNumber(fieldValue) || isBoolean(fieldValue),
          issues,
          'RUN_FIELD_INVALID',
          fieldPath,
          `${key} must be numeric or boolean when present.`,
        ) && ok;
        break;
    }
  }
  return ok;
}

export function isChatTelemetryLearningSnapshot(
  value: unknown,
  issues?: ChatTelemetryValidationIssue[],
  path: string = 'learning',
): value is ChatTelemetryLearningSnapshot {
  if (!isRecord(value)) {
    pushIssue(issues, 'LEARNING_NOT_OBJECT', path, 'Learning snapshot must be an object.');
    return false;
  }

  let ok = true;
  for (const [key, fieldValue] of Object.entries(value)) {
    const fieldPath = `${path}.${key}`;
    if (key === 'coldStartProfileId') {
      ok = assertField(isOptionalString(fieldValue), issues, 'LEARNING_FIELD_INVALID', fieldPath, 'coldStartProfileId must be a string when present.') && ok;
      continue;
    }
    ok = assertField(isOptionalFiniteNumber(fieldValue), issues, 'LEARNING_FIELD_INVALID', fieldPath, `${key} must be numeric when present.`) && ok;
  }
  return ok;
}

export function isChatTelemetryPerformanceMark(
  value: unknown,
  issues?: ChatTelemetryValidationIssue[],
  path: string = 'performance',
): value is ChatTelemetryPerformanceMark {
  if (!isRecord(value)) {
    pushIssue(issues, 'PERFORMANCE_NOT_OBJECT', path, 'Performance mark must be an object.');
    return false;
  }

  let ok = true;
  ok = assertField(isString(value.label), issues, 'PERFORMANCE_FIELD_INVALID', `${path}.label`, 'Performance mark label must be a string.') && ok;
  ok = assertField(isOptionalFiniteNumber(value.startedAtMs), issues, 'PERFORMANCE_FIELD_INVALID', `${path}.startedAtMs`, 'startedAtMs must be numeric when present.') && ok;
  ok = assertField(isOptionalFiniteNumber(value.completedAtMs), issues, 'PERFORMANCE_FIELD_INVALID', `${path}.completedAtMs`, 'completedAtMs must be numeric when present.') && ok;
  ok = assertField(isOptionalFiniteNumber(value.durationMs), issues, 'PERFORMANCE_FIELD_INVALID', `${path}.durationMs`, 'durationMs must be numeric when present.') && ok;
  return ok;
}

export function isChatTelemetryChannel(value: unknown): value is ChatTelemetryChannel {
  return typeof value === 'string' && value.length > 0;
}

export function isChatTelemetrySeverity(value: unknown): value is ChatTelemetrySeverity {
  return typeof value === 'string' && CHAT_TELEMETRY_SEVERITIES.has(value as ChatTelemetrySeverity);
}

export function isChatTelemetryOrigin(value: unknown): value is ChatTelemetryOrigin {
  return typeof value === 'string' && CHAT_TELEMETRY_ORIGINS.has(value as ChatTelemetryOrigin);
}

export function isChatTelemetryEventName(value: unknown): value is ChatTelemetryEventName {
  return typeof value === 'string' && CHAT_TELEMETRY_EVENT_NAME_SET.has(value as ChatTelemetryEventName);
}

export function isChatTelemetrySenderRole(value: unknown): value is ChatTelemetrySenderRole {
  return typeof value === 'string' && CHAT_TELEMETRY_SENDER_ROLES.has(value as ChatTelemetrySenderRole);
}

/* ========================================================================== *
 * Section 6 — Payload validators by domain
 * ========================================================================== */

function validateMessageSendRequestedPayload(
  payload: unknown,
  issues?: ChatTelemetryValidationIssue[],
): payload is MessageSendRequestedPayload {
  if (!isRecord(payload)) {
    pushIssue(issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'MessageSendRequested payload must be an object.');
    return false;
  }

  let ok = true;
  ok = assertField(isChatTelemetryChannel(payload.channel), issues, 'CHANNEL_INVALID', 'payload.channel', 'channel must be a valid chat channel.') && ok;
  ok = assertField(isOptionalString(payload.roomId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.roomId', 'roomId must be string when present.') && ok;
  ok = assertField(isChatTelemetrySenderRole(payload.senderRole), issues, 'SENDER_ROLE_INVALID', 'payload.senderRole', 'senderRole must be valid.') && ok;
  ok = assertField(isOptionalString(payload.senderId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.senderId', 'senderId must be string when present.') && ok;
  ok = isChatTelemetryDraftSummary(payload.draft, issues, 'payload.draft') && ok;
  ok = assertField(isOptionalString(payload.clientMessageId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.clientMessageId', 'clientMessageId must be string when present.') && ok;

  if (typeof payload.negotiationContext !== 'undefined') {
    const context = payload.negotiationContext;
    ok = assertField(isRecord(context), issues, 'PAYLOAD_FIELD_INVALID', 'payload.negotiationContext', 'negotiationContext must be an object when present.') && ok;
    if (isRecord(context)) {
      ok = assertField(isOptionalFiniteNumber(context.offerValue), issues, 'PAYLOAD_FIELD_INVALID', 'payload.negotiationContext.offerValue', 'offerValue must be numeric when present.') && ok;
      ok = assertField(isOptionalString(context.assetId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.negotiationContext.assetId', 'assetId must be string when present.') && ok;
      ok = assertField(isOptionalBoolean(context.isCounter), issues, 'PAYLOAD_FIELD_INVALID', 'payload.negotiationContext.isCounter', 'isCounter must be boolean when present.') && ok;
    }
  }

  return ok;
}

function validateMessageSendResultPayload(
  payload: unknown,
  issues?: ChatTelemetryValidationIssue[],
): payload is MessageSendResultPayload {
  if (!isRecord(payload)) {
    pushIssue(issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'MessageSendResult payload must be an object.');
    return false;
  }

  let ok = true;
  ok = assertField(isOptionalString(payload.clientMessageId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.clientMessageId', 'clientMessageId must be string when present.') && ok;
  ok = assertField(isOptionalString(payload.serverMessageId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.serverMessageId', 'serverMessageId must be string when present.') && ok;
  ok = assertField(isChatTelemetryChannel(payload.channel), issues, 'CHANNEL_INVALID', 'payload.channel', 'channel must be valid.') && ok;
  ok = assertField(isOptionalString(payload.roomId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.roomId', 'roomId must be string when present.') && ok;
  ok = assertField(isChatTelemetrySenderRole(payload.senderRole), issues, 'SENDER_ROLE_INVALID', 'payload.senderRole', 'senderRole must be valid.') && ok;
  ok = assertField(isOptionalFiniteNumber(payload.roundTripMs), issues, 'PAYLOAD_FIELD_INVALID', 'payload.roundTripMs', 'roundTripMs must be numeric when present.') && ok;
  ok = assertField(isOptionalFiniteNumber(payload.queueLatencyMs), issues, 'PAYLOAD_FIELD_INVALID', 'payload.queueLatencyMs', 'queueLatencyMs must be numeric when present.') && ok;
  ok = assertField(
    payload.transport === 'socket' || payload.transport === 'http' || payload.transport === 'offline-buffer' || payload.transport === 'local-only',
    issues,
    'PAYLOAD_FIELD_INVALID',
    'payload.transport',
    'transport must be socket, http, offline-buffer, or local-only.',
  ) && ok;
  ok = assertField(isOptionalString(payload.failureCode), issues, 'PAYLOAD_FIELD_INVALID', 'payload.failureCode', 'failureCode must be string when present.') && ok;
  return ok;
}

function validateMessageReceivedPayload(
  payload: unknown,
  issues?: ChatTelemetryValidationIssue[],
): payload is MessageReceivedPayload {
  if (!isRecord(payload)) {
    pushIssue(issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'MessageReceived payload must be an object.');
    return false;
  }

  let ok = true;
  ok = assertField(isOptionalString(payload.serverMessageId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.serverMessageId', 'serverMessageId must be string when present.') && ok;
  ok = assertField(isChatTelemetryChannel(payload.channel), issues, 'CHANNEL_INVALID', 'payload.channel', 'channel must be valid.') && ok;
  ok = assertField(isOptionalString(payload.roomId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.roomId', 'roomId must be string when present.') && ok;
  ok = assertField(isChatTelemetrySenderRole(payload.senderRole), issues, 'SENDER_ROLE_INVALID', 'payload.senderRole', 'senderRole must be valid.') && ok;
  ok = assertField(isOptionalString(payload.senderId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.senderId', 'senderId must be string when present.') && ok;
  ok = assertField(isOptionalString(payload.senderName), issues, 'PAYLOAD_FIELD_INVALID', 'payload.senderName', 'senderName must be string when present.') && ok;
  if (typeof payload.safeText !== 'undefined') {
    ok = isChatTelemetrySafeTextSummary(payload.safeText, issues, 'payload.safeText') && ok;
  }
  ok = assertField(isOptionalString(payload.kind), issues, 'PAYLOAD_FIELD_INVALID', 'payload.kind', 'kind must be string when present.') && ok;
  ok = assertField(isOptionalString(payload.replyToMessageId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.replyToMessageId', 'replyToMessageId must be string when present.') && ok;
  ok = assertField(isOptionalString(payload.legendId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.legendId', 'legendId must be string when present.') && ok;
  ok = assertField(isOptionalString(payload.proofHash), issues, 'PAYLOAD_FIELD_INVALID', 'payload.proofHash', 'proofHash must be string when present.') && ok;
  if (typeof payload.replay !== 'undefined') {
    ok = isChatTelemetryReplayReference(payload.replay, issues, 'payload.replay') && ok;
  }
  return ok;
}

function validateNpcResponsePlannedPayload(
  payload: unknown,
  issues?: ChatTelemetryValidationIssue[],
): payload is NpcResponsePlannedPayload {
  if (!isRecord(payload)) {
    pushIssue(issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'NpcResponsePlanned payload must be an object.');
    return false;
  }

  let ok = true;
  ok = assertField(isString(payload.npcId), issues, 'PAYLOAD_MISSING_REQUIRED_FIELD', 'payload.npcId', 'npcId is required.') && ok;
  ok = assertField(payload.npcRole === 'HATER' || payload.npcRole === 'HELPER' || payload.npcRole === 'AMBIENT', issues, 'PAYLOAD_FIELD_INVALID', 'payload.npcRole', 'npcRole must be HATER, HELPER, or AMBIENT.') && ok;
  ok = assertField(isChatTelemetryChannel(payload.channel), issues, 'CHANNEL_INVALID', 'payload.channel', 'channel must be valid.') && ok;
  ok = assertField(isOptionalString(payload.roomId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.roomId', 'roomId must be string when present.') && ok;
  ok = assertField(
    payload.reason === 'ENGINE_EVENT' || payload.reason === 'CHANNEL_HEAT' || payload.reason === 'CADENCE' || payload.reason === 'HELPER_RESCUE' || payload.reason === 'INVASION' || payload.reason === 'NEGOTIATION' || payload.reason === 'POSTRUN' || payload.reason === 'MANUAL',
    issues,
    'PAYLOAD_FIELD_INVALID',
    'payload.reason',
    'reason must be a supported NPC planning reason.',
  ) && ok;
  ok = assertField(isOptionalFiniteNumber(payload.scheduledDelayMs), issues, 'PAYLOAD_FIELD_INVALID', 'payload.scheduledDelayMs', 'scheduledDelayMs must be numeric when present.') && ok;
  ok = assertField(isOptionalBoolean(payload.suppressible), issues, 'PAYLOAD_FIELD_INVALID', 'payload.suppressible', 'suppressible must be boolean when present.') && ok;
  ok = assertField(isOptionalString(payload.contextEventName), issues, 'PAYLOAD_FIELD_INVALID', 'payload.contextEventName', 'contextEventName must be string when present.') && ok;
  return ok;
}

function validateInvasionTriggeredPayload(
  payload: unknown,
  issues?: ChatTelemetryValidationIssue[],
): payload is InvasionTriggeredPayload {
  if (!isRecord(payload)) {
    pushIssue(issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'InvasionTriggered payload must be an object.');
    return false;
  }
  let ok = true;
  ok = assertField(isString(payload.invasionId), issues, 'PAYLOAD_MISSING_REQUIRED_FIELD', 'payload.invasionId', 'invasionId is required.') && ok;
  ok = assertField(isOptionalString(payload.haterId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.haterId', 'haterId must be string when present.') && ok;
  ok = assertField(isChatTelemetryChannel(payload.channel), issues, 'CHANNEL_INVALID', 'payload.channel', 'channel must be valid.') && ok;
  ok = assertField(isOptionalString(payload.roomId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.roomId', 'roomId must be string when present.') && ok;
  ok = assertField(isOptionalString(payload.triggerEvent), issues, 'PAYLOAD_FIELD_INVALID', 'payload.triggerEvent', 'triggerEvent must be string when present.') && ok;
  ok = assertField(isOptionalFiniteNumber(payload.intensity), issues, 'PAYLOAD_FIELD_INVALID', 'payload.intensity', 'intensity must be numeric when present.') && ok;
  ok = assertField(isOptionalString(payload.sceneId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.sceneId', 'sceneId must be string when present.') && ok;
  ok = assertField(isOptionalFiniteNumber(payload.audienceHeat), issues, 'PAYLOAD_FIELD_INVALID', 'payload.audienceHeat', 'audienceHeat must be numeric when present.') && ok;
  return ok;
}

function validateRecoveryPromptPayload(
  payload: unknown,
  issues?: ChatTelemetryValidationIssue[],
): payload is RecoveryPromptPayload {
  if (!isRecord(payload)) {
    pushIssue(issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'RecoveryPrompt payload must be an object.');
    return false;
  }
  let ok = true;
  ok = assertField(isOptionalString(payload.helperId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.helperId', 'helperId must be string when present.') && ok;
  ok = assertField(isString(payload.recoveryId), issues, 'PAYLOAD_MISSING_REQUIRED_FIELD', 'payload.recoveryId', 'recoveryId is required.') && ok;
  ok = assertField(isChatTelemetryChannel(payload.channel), issues, 'CHANNEL_INVALID', 'payload.channel', 'channel must be valid.') && ok;
  ok = assertField(isOptionalString(payload.roomId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.roomId', 'roomId must be string when present.') && ok;
  ok = assertField(
    payload.reason === 'DROP_OFF_RISK' || payload.reason === 'LONG_SILENCE' || payload.reason === 'RAPID_FAILURE' || payload.reason === 'NEGATIVE_SIGNAL' || payload.reason === 'ALT_CHANNEL_HOP' || payload.reason === 'BANKRUPTCY_NEAR',
    issues,
    'PAYLOAD_FIELD_INVALID',
    'payload.reason',
    'reason must be a supported recovery reason.',
  ) && ok;
  ok = assertField(isOptionalFiniteNumber(payload.predictedDropOffRisk), issues, 'PAYLOAD_FIELD_INVALID', 'payload.predictedDropOffRisk', 'predictedDropOffRisk must be numeric when present.') && ok;
  ok = assertField(isOptionalString(payload.recommendedAction), issues, 'PAYLOAD_FIELD_INVALID', 'payload.recommendedAction', 'recommendedAction must be string when present.') && ok;
  return ok;
}

function validateLegendMomentPayload(
  payload: unknown,
  issues?: ChatTelemetryValidationIssue[],
): payload is LegendMomentPayload {
  if (!isRecord(payload)) {
    pushIssue(issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'LegendMoment payload must be an object.');
    return false;
  }
  let ok = true;
  ok = assertField(isString(payload.legendId), issues, 'PAYLOAD_MISSING_REQUIRED_FIELD', 'payload.legendId', 'legendId is required.') && ok;
  ok = assertField(
    payload.momentType === 'SOVEREIGNTY' || payload.momentType === 'COUNTERPLAY' || payload.momentType === 'HUMILIATION_REVERSAL' || payload.momentType === 'MIRACLE_RESCUE' || payload.momentType === 'LAST_SECOND_COMEBACK' || payload.momentType === 'PERFECT_NEGOTIATION' || payload.momentType === 'OTHER',
    issues,
    'PAYLOAD_FIELD_INVALID',
    'payload.momentType',
    'momentType must be supported.',
  ) && ok;
  if (typeof payload.replay !== 'undefined') {
    ok = isChatTelemetryReplayReference(payload.replay, issues, 'payload.replay') && ok;
  }
  ok = assertField(isOptionalString(payload.proofHash), issues, 'PAYLOAD_FIELD_INVALID', 'payload.proofHash', 'proofHash must be string when present.') && ok;
  ok = assertField(typeof payload.channel === 'undefined' || isChatTelemetryChannel(payload.channel), issues, 'CHANNEL_INVALID', 'payload.channel', 'channel must be valid when present.') && ok;
  ok = assertField(isOptionalString(payload.roomId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.roomId', 'roomId must be string when present.') && ok;
  return ok;
}

function validateReplayOpenedPayload(
  payload: unknown,
  issues?: ChatTelemetryValidationIssue[],
): payload is ReplayOpenedPayload {
  if (!isRecord(payload)) {
    pushIssue(issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'ReplayOpened payload must be an object.');
    return false;
  }
  let ok = true;
  ok = isChatTelemetryReplayReference(payload.replay, issues, 'payload.replay') && ok;
  ok = assertField(typeof payload.channel === 'undefined' || isChatTelemetryChannel(payload.channel), issues, 'CHANNEL_INVALID', 'payload.channel', 'channel must be valid when present.') && ok;
  ok = assertField(isOptionalString(payload.roomId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.roomId', 'roomId must be string when present.') && ok;
  ok = assertField(payload.trigger === 'drawer' || payload.trigger === 'legend' || payload.trigger === 'result-screen' || payload.trigger === 'proof-card' || payload.trigger === 'system', issues, 'PAYLOAD_FIELD_INVALID', 'payload.trigger', 'trigger must be supported.') && ok;
  return ok;
}

function validateLearningFeatureSnapshotPayload(
  payload: unknown,
  issues?: ChatTelemetryValidationIssue[],
): payload is LearningFeatureSnapshotPayload {
  if (!isRecord(payload)) {
    pushIssue(issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'LearningFeatureSnapshot payload must be an object.');
    return false;
  }
  let ok = true;
  ok = isChatTelemetryLearningSnapshot(payload.featureSet, issues, 'payload.featureSet') && ok;
  ok = assertField(payload.reason === 'CHAT_OPEN' || payload.reason === 'MESSAGE_SEND' || payload.reason === 'MESSAGE_RECEIVE' || payload.reason === 'CHANNEL_SWITCH' || payload.reason === 'INVASION' || payload.reason === 'RECOVERY' || payload.reason === 'MANUAL', issues, 'PAYLOAD_FIELD_INVALID', 'payload.reason', 'reason must be supported.') && ok;
  return ok;
}

function validatePerformanceMarkPayload(
  payload: unknown,
  issues?: ChatTelemetryValidationIssue[],
): payload is PerformanceMarkPayload {
  if (!isRecord(payload)) {
    pushIssue(issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'PerformanceMark payload must be an object.');
    return false;
  }
  let ok = true;
  ok = isChatTelemetryPerformanceMark(payload.mark, issues, 'payload.mark') && ok;
  ok = assertField(
    payload.subsystem === 'RENDER' || payload.subsystem === 'QUEUE' || payload.subsystem === 'SOCKET' || payload.subsystem === 'INFERENCE' || payload.subsystem === 'NPC' || payload.subsystem === 'REPLAY' || payload.subsystem === 'COMPOSER' || payload.subsystem === 'GENERAL',
    issues,
    'PAYLOAD_FIELD_INVALID',
    'payload.subsystem',
    'subsystem must be supported.',
  ) && ok;
  return ok;
}

function validateEngineEventIngestedPayload(
  payload: unknown,
  issues?: ChatTelemetryValidationIssue[],
): payload is EngineEventIngestedPayload {
  if (!isRecord(payload)) {
    pushIssue(issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'EngineEventIngested payload must be an object.');
    return false;
  }
  let ok = true;
  ok = assertField(isString(payload.engineEventName), issues, 'PAYLOAD_MISSING_REQUIRED_FIELD', 'payload.engineEventName', 'engineEventName is required.') && ok;
  ok = assertField(isOptionalString(payload.roomId), issues, 'PAYLOAD_FIELD_INVALID', 'payload.roomId', 'roomId must be string when present.') && ok;
  ok = assertField(typeof payload.channel === 'undefined' || isChatTelemetryChannel(payload.channel), issues, 'CHANNEL_INVALID', 'payload.channel', 'channel must be valid when present.') && ok;
  ok = assertField(payload.bridgePath === 'EVENT_BUS_TO_CHAT' || payload.bridgePath === 'ENGINE_TO_CHAT' || payload.bridgePath === 'SOCKET_TO_CHAT' || payload.bridgePath === 'MANUAL', issues, 'PAYLOAD_FIELD_INVALID', 'payload.bridgePath', 'bridgePath must be supported.') && ok;
  ok = assertField(isOptionalString(payload.summary), issues, 'PAYLOAD_FIELD_INVALID', 'payload.summary', 'summary must be string when present.') && ok;
  return ok;
}

function validateGenericRecordPayload(
  payload: unknown,
  issues?: ChatTelemetryValidationIssue[],
): payload is Record<string, unknown> {
  const ok = isRecord(payload);
  if (!ok) {
    pushIssue(issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'Payload must be an object.');
  }
  return ok;
}

/* ========================================================================== *
 * Section 7 — Event specifications
 * ========================================================================== */

function queuePolicy(
  family: ChatTelemetryFamily,
  overrides: Partial<ChatTelemetryQueuePolicyHint> = {},
): ChatTelemetryQueuePolicyHint {
  const base: ChatTelemetryQueuePolicyHint = {
    priority: 'STANDARD',
    retention: 'SESSION',
    flushImmediately: false,
    dedupeEligible: true,
    replayWorthy: false,
    learningRelevant: false,
    allowOfflinePersistence: true,
  };

  switch (family) {
    case 'LEGEND':
    case 'PROOF':
    case 'REPLAY':
      base.retention = 'REPLAY';
      base.replayWorthy = true;
      break;
    case 'LEARNING':
    case 'INFERENCE':
      base.retention = 'LEARNING';
      base.learningRelevant = true;
      break;
    case 'MODERATION':
    case 'QUEUE':
    case 'ENGINE':
      base.retention = 'AUDIT';
      break;
    case 'PERFORMANCE':
    case 'DIAGNOSTIC':
      base.retention = 'EPHEMERAL';
      break;
    default:
      break;
  }

  return { ...base, ...overrides };
}

function spec<TPayload extends object>(
  family: ChatTelemetryFamily,
  payloadGuard: (payload: unknown, issues?: ChatTelemetryValidationIssue[]) => payload is TPayload,
  description: string,
  policyOverrides?: Partial<ChatTelemetryQueuePolicyHint>,
  preferredSeverity?: ChatTelemetrySeverity,
  requiredTags?: readonly string[],
): ChatTelemetryEventSchemaSpec<TPayload> {
  return {
    family,
    payloadGuard,
    description,
    policy: queuePolicy(family, policyOverrides),
    preferredSeverity,
    requiredTags,
  };
}

export const CHAT_TELEMETRY_EVENT_SPECS: Readonly<Record<ChatTelemetryEventName, ChatTelemetryEventSchemaSpec<any>>> = {
  CHAT_SESSION_STARTED: spec('SESSION', validateGenericRecordPayload, 'Chat session authority start.', { priority: 'HIGH' }, 'INFO', ['session', 'start']),
  CHAT_SESSION_ENDED: spec('SESSION', validateGenericRecordPayload, 'Chat session authority end.', { priority: 'CRITICAL', flushImmediately: true }, 'NOTICE', ['session', 'end']),
  CHAT_OPENED: spec('VIEW', validateGenericRecordPayload, 'Dock opened or surfaced.', { priority: 'HIGH' }, 'INFO', ['view', 'open']),
  CHAT_CLOSED: spec('VIEW', validateGenericRecordPayload, 'Dock closed.', { priority: 'HIGH' }, 'INFO', ['view', 'close']),
  CHAT_COLLAPSED: spec('VIEW', validateGenericRecordPayload, 'Dock collapsed.', {}, 'TRACE', ['view', 'collapse']),
  CHAT_EXPANDED: spec('VIEW', validateGenericRecordPayload, 'Dock expanded.', {}, 'TRACE', ['view', 'expand']),
  CHAT_RENDERED: spec('VIEW', validateGenericRecordPayload, 'Chat UI render completed.', {}, 'TRACE', ['view', 'render']),
  CHANNEL_SELECTED: spec('CHANNEL', validateGenericRecordPayload, 'Channel actively selected.', { priority: 'HIGH' }, 'INFO', ['channel', 'select']),
  CHANNEL_VIEWED: spec('CHANNEL', validateGenericRecordPayload, 'Channel viewed.', {}, 'TRACE', ['channel', 'view']),
  CHANNEL_MUTED: spec('CHANNEL', validateGenericRecordPayload, 'Channel muted by player.', {}, 'NOTICE', ['channel', 'mute']),
  CHANNEL_UNMUTED: spec('CHANNEL', validateGenericRecordPayload, 'Channel unmuted by player.', {}, 'NOTICE', ['channel', 'unmute']),
  ROOM_BOUND: spec('ROOM', validateGenericRecordPayload, 'Room bound to frontend chat.', { priority: 'HIGH' }, 'NOTICE', ['room', 'bind']),
  ROOM_UNBOUND: spec('ROOM', validateGenericRecordPayload, 'Room unbound from frontend chat.', { priority: 'HIGH' }, 'NOTICE', ['room', 'unbind']),
  COMPOSER_FOCUSED: spec('COMPOSER', validateGenericRecordPayload, 'Composer focused.', {}, 'TRACE', ['composer', 'focus']),
  COMPOSER_BLURRED: spec('COMPOSER', validateGenericRecordPayload, 'Composer blurred.', {}, 'TRACE', ['composer', 'blur']),
  COMPOSER_DRAFT_CHANGED: spec('COMPOSER', validateGenericRecordPayload, 'Draft changed.', {}, 'TRACE', ['composer', 'draft']),
  COMPOSER_COMMAND_DETECTED: spec('COMPOSER', validateGenericRecordPayload, 'Command syntax detected.', { priority: 'HIGH' }, 'NOTICE', ['composer', 'command']),
  COMPOSER_ATTACHMENT_STAGED: spec('COMPOSER', validateGenericRecordPayload, 'Attachment staged.', { priority: 'HIGH' }, 'INFO', ['composer', 'attachment']),
  MESSAGE_SEND_REQUESTED: spec('MESSAGE', validateMessageSendRequestedPayload, 'Outgoing send request.', { priority: 'HIGH' }, 'INFO', ['message', 'send']),
  MESSAGE_SEND_QUEUED: spec('MESSAGE', validateMessageSendResultPayload, 'Outgoing message queued.', { priority: 'HIGH' }, 'TRACE', ['message', 'queued']),
  MESSAGE_SENT: spec('MESSAGE', validateMessageSendResultPayload, 'Outgoing message sent.', { priority: 'HIGH' }, 'INFO', ['message', 'sent']),
  MESSAGE_SEND_FAILED: spec('MESSAGE', validateMessageSendResultPayload, 'Outgoing message failed.', { priority: 'CRITICAL', flushImmediately: true, retention: 'AUDIT' }, 'CRITICAL', ['message', 'failed']),
  MESSAGE_RECEIVED: spec('MESSAGE', validateMessageReceivedPayload, 'Inbound message received.', { priority: 'HIGH', replayWorthy: true }, 'INFO', ['message', 'receive']),
  MESSAGE_RENDERED: spec('MESSAGE', validateMessageReceivedPayload, 'Inbound message rendered.', { replayWorthy: true }, 'TRACE', ['message', 'render']),
  MESSAGE_SUPPRESSED: spec('MESSAGE', validateMessageReceivedPayload, 'Message suppressed.', { retention: 'AUDIT' }, 'WARNING', ['message', 'suppressed']),
  MESSAGE_REDACTED: spec('MESSAGE', validateMessageReceivedPayload, 'Message redacted.', { retention: 'AUDIT' }, 'WARNING', ['message', 'redacted']),
  MESSAGE_ACTION_TRIGGERED: spec('MESSAGE', validateGenericRecordPayload, 'Message action triggered.', { priority: 'HIGH' }, 'INFO', ['message', 'action']),
  THREAD_OPENED: spec('THREAD', validateGenericRecordPayload, 'Thread opened.', {}, 'INFO', ['thread', 'open']),
  THREAD_CLOSED: spec('THREAD', validateGenericRecordPayload, 'Thread closed.', {}, 'TRACE', ['thread', 'close']),
  TYPING_STARTED: spec('PRESENCE', validateGenericRecordPayload, 'Typing started.', {}, 'TRACE', ['presence', 'typing']),
  TYPING_STOPPED: spec('PRESENCE', validateGenericRecordPayload, 'Typing stopped.', {}, 'TRACE', ['presence', 'typing']),
  PRESENCE_CHANGED: spec('PRESENCE', validateGenericRecordPayload, 'Presence changed.', {}, 'TRACE', ['presence', 'change']),
  READ_RECEIPT_RENDERED: spec('PRESENCE', validateGenericRecordPayload, 'Read receipt rendered.', {}, 'TRACE', ['presence', 'receipt']),
  DELIVERY_RECEIPT_RENDERED: spec('PRESENCE', validateGenericRecordPayload, 'Delivery receipt rendered.', {}, 'TRACE', ['presence', 'delivery']),
  NPC_TYPING_STARTED: spec('NPC', validateNpcResponsePlannedPayload, 'NPC typing simulated.', {}, 'TRACE', ['npc', 'typing']),
  NPC_TYPING_STOPPED: spec('NPC', validateNpcResponsePlannedPayload, 'NPC typing stopped.', {}, 'TRACE', ['npc', 'typing']),
  NPC_MESSAGE_PLANNED: spec('NPC', validateNpcResponsePlannedPayload, 'NPC response planned.', { priority: 'HIGH', replayWorthy: true }, 'NOTICE', ['npc', 'planned']),
  NPC_MESSAGE_RENDERED: spec('NPC', validateNpcResponsePlannedPayload, 'NPC response rendered.', { priority: 'HIGH', replayWorthy: true }, 'INFO', ['npc', 'rendered']),
  NPC_RESPONSE_SKIPPED: spec('NPC', validateNpcResponsePlannedPayload, 'NPC response skipped.', {}, 'TRACE', ['npc', 'skipped']),
  NPC_CADENCE_ESCALATED: spec('NPC', validateNpcResponsePlannedPayload, 'NPC cadence escalated.', { priority: 'HIGH', learningRelevant: true }, 'NOTICE', ['npc', 'cadence']),
  NPC_CADENCE_DAMPENED: spec('NPC', validateNpcResponsePlannedPayload, 'NPC cadence dampened.', { priority: 'HIGH', learningRelevant: true }, 'NOTICE', ['npc', 'cadence']),
  HATER_TARGET_LOCKED: spec('HATER', validateNpcResponsePlannedPayload, 'Hater target lock established.', { priority: 'HIGH', learningRelevant: true }, 'NOTICE', ['hater', 'target']),
  HATER_TAUNT_RENDERED: spec('HATER', validateNpcResponsePlannedPayload, 'Hater taunt rendered.', { priority: 'HIGH', replayWorthy: true }, 'INFO', ['hater', 'taunt']),
  HELPER_INTERVENTION_TRIGGERED: spec('HELPER', validateRecoveryPromptPayload, 'Helper intervention triggered.', { priority: 'CRITICAL', learningRelevant: true }, 'WARNING', ['helper', 'intervention']),
  HELPER_INTERVENTION_SKIPPED: spec('HELPER', validateRecoveryPromptPayload, 'Helper intervention skipped.', { learningRelevant: true }, 'TRACE', ['helper', 'skipped']),
  AUDIENCE_HEAT_CHANGED: spec('AUDIENCE', validateGenericRecordPayload, 'Audience heat changed.', { priority: 'HIGH', learningRelevant: true }, 'TRACE', ['audience', 'heat']),
  INVASION_TRIGGERED: spec('INVASION', validateInvasionTriggeredPayload, 'Hater invasion triggered.', { priority: 'CRITICAL', flushImmediately: true, replayWorthy: true, learningRelevant: true }, 'CRITICAL', ['invasion', 'trigger']),
  INVASION_RESOLVED: spec('INVASION', validateInvasionTriggeredPayload, 'Hater invasion resolved.', { priority: 'HIGH', replayWorthy: true, learningRelevant: true }, 'NOTICE', ['invasion', 'resolve']),
  NEGOTIATION_SIGNAL_CAPTURED: spec('NEGOTIATION', validateGenericRecordPayload, 'Negotiation signal captured.', { priority: 'HIGH', learningRelevant: true }, 'INFO', ['negotiation', 'signal']),
  NEGOTIATION_COUNTER_WINDOW_OPENED: spec('NEGOTIATION', validateGenericRecordPayload, 'Negotiation counter window opened.', { priority: 'HIGH', replayWorthy: true }, 'NOTICE', ['negotiation', 'window']),
  RECOVERY_PROMPT_TRIGGERED: spec('RECOVERY', validateRecoveryPromptPayload, 'Recovery prompt triggered.', { priority: 'CRITICAL', flushImmediately: true, replayWorthy: true, learningRelevant: true }, 'WARNING', ['recovery', 'prompt']),
  RECOVERY_PROMPT_ACCEPTED: spec('RECOVERY', validateRecoveryPromptPayload, 'Recovery prompt accepted.', { priority: 'HIGH', replayWorthy: true, learningRelevant: true }, 'NOTICE', ['recovery', 'accept']),
  RECOVERY_PROMPT_DISMISSED: spec('RECOVERY', validateRecoveryPromptPayload, 'Recovery prompt dismissed.', { priority: 'HIGH', learningRelevant: true }, 'TRACE', ['recovery', 'dismiss']),
  LEGEND_MOMENT_CAPTURED: spec('LEGEND', validateLegendMomentPayload, 'Legend moment captured.', { priority: 'CRITICAL', flushImmediately: true, replayWorthy: true }, 'NOTICE', ['legend', 'moment']),
  PROOF_BADGE_RENDERED: spec('PROOF', validateLegendMomentPayload, 'Proof badge rendered.', { priority: 'HIGH', replayWorthy: true }, 'NOTICE', ['proof', 'badge']),
  PROOF_HASH_EXPOSED: spec('PROOF', validateLegendMomentPayload, 'Proof hash exposed.', { priority: 'HIGH', replayWorthy: true, retention: 'AUDIT' }, 'NOTICE', ['proof', 'hash']),
  REPLAY_OPENED: spec('REPLAY', validateReplayOpenedPayload, 'Replay opened.', { priority: 'HIGH', replayWorthy: true }, 'INFO', ['replay', 'open']),
  REPLAY_CLOSED: spec('REPLAY', validateReplayOpenedPayload, 'Replay closed.', { replayWorthy: true }, 'TRACE', ['replay', 'close']),
  REPLAY_RANGE_REQUESTED: spec('REPLAY', validateReplayOpenedPayload, 'Replay range requested.', { priority: 'HIGH', replayWorthy: true }, 'TRACE', ['replay', 'request']),
  REPLAY_RANGE_LOADED: spec('REPLAY', validateReplayOpenedPayload, 'Replay range loaded.', { priority: 'HIGH', replayWorthy: true }, 'INFO', ['replay', 'loaded']),
  REPLAY_SLICE_EXPORTED: spec('REPLAY', validateReplayOpenedPayload, 'Replay slice exported.', { priority: 'HIGH', replayWorthy: true, retention: 'AUDIT' }, 'NOTICE', ['replay', 'export']),
  REPLAY_LEGEND_JUMPED: spec('REPLAY', validateReplayOpenedPayload, 'Replay jumped to legend.', { priority: 'HIGH', replayWorthy: true }, 'NOTICE', ['replay', 'jump']),
  LEARNING_FEATURE_SNAPSHOT: spec('LEARNING', validateLearningFeatureSnapshotPayload, 'Learning snapshot captured.', { priority: 'HIGH', learningRelevant: true }, 'TRACE', ['learning', 'snapshot']),
  LEARNING_HANDOFF_REQUESTED: spec('LEARNING', validateLearningFeatureSnapshotPayload, 'Learning handoff requested.', { priority: 'HIGH', learningRelevant: true }, 'NOTICE', ['learning', 'handoff']),
  LEARNING_HANDOFF_ACKED: spec('LEARNING', validateLearningFeatureSnapshotPayload, 'Learning handoff acknowledged.', { priority: 'HIGH', learningRelevant: true }, 'NOTICE', ['learning', 'ack']),
  INFERENCE_REQUESTED: spec('INFERENCE', validateLearningFeatureSnapshotPayload, 'Inference requested.', { priority: 'HIGH', learningRelevant: true }, 'TRACE', ['inference', 'request']),
  INFERENCE_COMPLETED: spec('INFERENCE', validateLearningFeatureSnapshotPayload, 'Inference completed.', { priority: 'HIGH', learningRelevant: true }, 'NOTICE', ['inference', 'complete']),
  INFERENCE_FAILED: spec('INFERENCE', validateLearningFeatureSnapshotPayload, 'Inference failed.', { priority: 'CRITICAL', flushImmediately: true, retention: 'AUDIT', learningRelevant: true }, 'CRITICAL', ['inference', 'failed']),
  MODERATION_WARNING_RENDERED: spec('MODERATION', validateGenericRecordPayload, 'Moderation warning rendered.', { priority: 'HIGH', retention: 'AUDIT' }, 'WARNING', ['moderation', 'warning']),
  MODERATION_ENFORCEMENT_APPLIED: spec('MODERATION', validateGenericRecordPayload, 'Moderation enforcement applied.', { priority: 'CRITICAL', flushImmediately: true, retention: 'AUDIT' }, 'CRITICAL', ['moderation', 'enforcement']),
  SOCKET_CONNECTED: spec('SOCKET', validateGenericRecordPayload, 'Socket connected.', { priority: 'HIGH' }, 'NOTICE', ['socket', 'connect']),
  SOCKET_DISCONNECTED: spec('SOCKET', validateGenericRecordPayload, 'Socket disconnected.', { priority: 'HIGH', retention: 'AUDIT' }, 'WARNING', ['socket', 'disconnect']),
  SOCKET_RECONNECTING: spec('SOCKET', validateGenericRecordPayload, 'Socket reconnecting.', { priority: 'HIGH', retention: 'AUDIT' }, 'WARNING', ['socket', 'reconnect']),
  QUEUE_ENQUEUED: spec('QUEUE', validateGenericRecordPayload, 'Queue accepted envelope.', { priority: 'BACKGROUND', retention: 'EPHEMERAL' }, 'TRACE', ['queue', 'enqueue']),
  QUEUE_FLUSHED: spec('QUEUE', validateGenericRecordPayload, 'Queue flushed batch.', { priority: 'HIGH', retention: 'EPHEMERAL' }, 'NOTICE', ['queue', 'flush']),
  QUEUE_DROPPED: spec('QUEUE', validateGenericRecordPayload, 'Queue dropped telemetry.', { priority: 'CRITICAL', retention: 'AUDIT', flushImmediately: true }, 'CRITICAL', ['queue', 'drop']),
  QUEUE_RETRIED: spec('QUEUE', validateGenericRecordPayload, 'Queue scheduled retry.', { priority: 'HIGH', retention: 'AUDIT' }, 'WARNING', ['queue', 'retry']),
  ENGINE_EVENT_INGESTED: spec('ENGINE', validateEngineEventIngestedPayload, 'Engine event ingested into chat.', { priority: 'HIGH', retention: 'AUDIT', replayWorthy: true }, 'TRACE', ['engine', 'ingest']),
  ENGINE_EVENT_IGNORED: spec('ENGINE', validateEngineEventIngestedPayload, 'Engine event ignored by chat.', { retention: 'AUDIT' }, 'TRACE', ['engine', 'ignored']),
  PERFORMANCE_MARK: spec('PERFORMANCE', validatePerformanceMarkPayload, 'Performance mark captured.', { priority: 'BACKGROUND', retention: 'EPHEMERAL' }, 'TRACE', ['performance', 'mark']),
  DIAGNOSTIC: spec('DIAGNOSTIC', validateGenericRecordPayload, 'Diagnostic breadcrumb.', { priority: 'BACKGROUND', retention: 'EPHEMERAL' }, 'TRACE', ['diagnostic']),
};

/* ========================================================================== *
 * Section 8 — Public helpers for event semantics
 * ========================================================================== */

export function getChatTelemetryEventSpec(
  eventName: ChatTelemetryEventName,
): ChatTelemetryEventSchemaSpec {
  return CHAT_TELEMETRY_EVENT_SPECS[eventName];
}

export function getChatTelemetryFamily(
  eventName: ChatTelemetryEventName,
): ChatTelemetryFamily {
  return CHAT_TELEMETRY_EVENT_SPECS[eventName].family;
}

export function getChatTelemetryQueuePolicy(
  eventName: ChatTelemetryEventName,
): ChatTelemetryQueuePolicyHint {
  return CHAT_TELEMETRY_EVENT_SPECS[eventName].policy;
}

export function isReplayWorthyChatTelemetryEvent(
  eventName: ChatTelemetryEventName,
): boolean {
  return CHAT_TELEMETRY_EVENT_SPECS[eventName].policy.replayWorthy;
}

export function isLearningRelevantChatTelemetryEvent(
  eventName: ChatTelemetryEventName,
): boolean {
  return CHAT_TELEMETRY_EVENT_SPECS[eventName].policy.learningRelevant;
}

export function isImmediateFlushChatTelemetryEvent(
  eventName: ChatTelemetryEventName,
): boolean {
  return CHAT_TELEMETRY_EVENT_SPECS[eventName].policy.flushImmediately;
}

/* ========================================================================== *
 * Section 9 — Envelope validation / normalization / redaction
 * ========================================================================== */

function validateTags(
  tags: unknown,
  issues?: ChatTelemetryValidationIssue[],
  path: string = 'tags',
): tags is string[] {
  const ok = isStringArray(tags);
  if (!ok) {
    pushIssue(issues, 'TAGS_INVALID', path, 'tags must be an array of strings.');
  }
  return ok;
}

function uniqueTags(
  tags: readonly string[] | undefined,
  requiredTags: readonly string[] | undefined,
): string[] {
  const merged = [...(tags ?? []), ...(requiredTags ?? [])];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const tag of merged) {
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    output.push(tag);
  }
  return output;
}

function clampSampleRate(value: number): number {
  if (!Number.isFinite(value)) return 1;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeTimestampMs(value: number, nowMs?: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return nowMs ?? Date.now();
  }
  return Math.trunc(value);
}

function normalizeSeverity(
  eventName: ChatTelemetryEventName,
  severity: ChatTelemetrySeverity,
): ChatTelemetrySeverity {
  const preferred = CHAT_TELEMETRY_EVENT_SPECS[eventName].preferredSeverity;
  if (!preferred) return severity;

  if (preferred === 'CRITICAL') return 'CRITICAL';
  if (severity === 'CRITICAL') return severity;
  if (preferred === 'WARNING' && severity === 'TRACE') return 'WARNING';
  if (preferred === 'NOTICE' && severity === 'TRACE') return 'NOTICE';
  return severity;
}

export function validateChatTelemetryEnvelope(
  value: unknown,
): ChatTelemetryValidationResult {
  const issues: ChatTelemetryValidationIssue[] = [];

  if (!isRecord(value)) {
    pushIssue(issues, 'ENVELOPE_NOT_OBJECT', 'envelope', 'Envelope must be an object.');
    return { ok: false, issues };
  }

  const eventName = value.eventName;
  const eventNameValid = assertField(
    isChatTelemetryEventName(eventName),
    issues,
    'EVENT_NAME_INVALID',
    'eventName',
    'eventName must be a valid telemetry event.',
  );

  assertField(value.schemaVersion === CHAT_TELEMETRY_SCHEMA_VERSION, issues, 'PAYLOAD_FIELD_INVALID', 'schemaVersion', 'schemaVersion must be 1.');
  assertField(isFiniteNumber(value.seq) && value.seq >= 0, issues, 'SEQ_INVALID', 'seq', 'seq must be a non-negative number.');
  assertField(isString(value.eventId) && value.eventId.length > 0, issues, 'EVENT_ID_INVALID', 'eventId', 'eventId must be a non-empty string.');
  assertField(isChatTelemetrySeverity(value.severity), issues, 'SEVERITY_INVALID', 'severity', 'severity must be valid.');
  assertField(isChatTelemetryOrigin(value.origin), issues, 'ORIGIN_INVALID', 'origin', 'origin must be valid.');
  assertField(isFiniteNumber(value.timestampMs), issues, 'TIMESTAMP_INVALID', 'timestampMs', 'timestampMs must be numeric.');
  assertField(isString(value.sessionId) && value.sessionId.length > 0, issues, 'SESSION_ID_INVALID', 'sessionId', 'sessionId must be a non-empty string.');
  assertField(isOptionalString(value.traceId), issues, 'PAYLOAD_FIELD_INVALID', 'traceId', 'traceId must be a string when present.');
  assertField(isOptionalString(value.dedupeKey), issues, 'PAYLOAD_FIELD_INVALID', 'dedupeKey', 'dedupeKey must be a string when present.');
  assertField(isFiniteNumber(value.sampleRate), issues, 'SAMPLE_RATE_INVALID', 'sampleRate', 'sampleRate must be numeric.');
  assertField(isRecord(value.payload), issues, 'PAYLOAD_NOT_OBJECT', 'payload', 'payload must be an object.');
  isChatTelemetryRunSnapshot(value.run, issues, 'run');
  if (typeof value.learning !== 'undefined') {
    isChatTelemetryLearningSnapshot(value.learning, issues, 'learning');
  }
  if (typeof value.performance !== 'undefined') {
    isChatTelemetryPerformanceMark(value.performance, issues, 'performance');
  }
  validateTags(value.tags, issues, 'tags');

  if (eventNameValid && isRecord(value.payload)) {
    const specRecord = CHAT_TELEMETRY_EVENT_SPECS[eventName as ChatTelemetryEventName];
    specRecord.payloadGuard(value.payload, issues);
  }

  return {
    ok: issues.every((issue) => !issue.fatal),
    issues,
  };
}

export function normalizeChatTelemetryEnvelope<TPayload extends Record<string, unknown>>(
  envelope: ChatTelemetryEnvelope<TPayload>,
  nowMs?: number,
): ChatTelemetryEnvelope<TPayload> {
  const specRecord = CHAT_TELEMETRY_EVENT_SPECS[envelope.eventName];
  return {
    ...envelope,
    schemaVersion: CHAT_TELEMETRY_SCHEMA_VERSION,
    seq: Math.max(0, Math.trunc(envelope.seq)),
    timestampMs: normalizeTimestampMs(envelope.timestampMs, nowMs),
    sampleRate: clampSampleRate(envelope.sampleRate),
    severity: normalizeSeverity(envelope.eventName, envelope.severity),
    tags: uniqueTags(envelope.tags, specRecord.requiredTags),
    run: normalizeChatTelemetryRunSnapshot(envelope.run),
    learning: envelope.learning
      ? normalizeChatTelemetryLearningSnapshot(envelope.learning)
      : undefined,
    performance: envelope.performance
      ? normalizeChatTelemetryPerformanceMark(envelope.performance)
      : undefined,
  };
}

export function normalizeChatTelemetryRunSnapshot(
  snapshot: ChatTelemetryRunSnapshot,
): ChatTelemetryRunSnapshot {
  return {
    ...snapshot,
    tickIndex: normalizeOptionalNumber(snapshot.tickIndex),
    pressureScore: normalizeOptionalNumber(snapshot.pressureScore),
    tensionScore: normalizeOptionalNumber(snapshot.tensionScore),
    tensionQueueDepth: normalizeOptionalNumber(snapshot.tensionQueueDepth),
    battleHeat: normalizeOptionalNumber(snapshot.battleHeat),
    battleWave: normalizeOptionalNumber(snapshot.battleWave),
    shieldIntegrityTotal: normalizeOptionalNumber(snapshot.shieldIntegrityTotal),
    shieldBreachedLayerCount: normalizeOptionalNumber(snapshot.shieldBreachedLayerCount),
    sovereigntyScore: normalizeOptionalNumber(snapshot.sovereigntyScore),
    income: normalizeOptionalNumber(snapshot.income),
    expenses: normalizeOptionalNumber(snapshot.expenses),
    cash: normalizeOptionalNumber(snapshot.cash),
    netWorth: normalizeOptionalNumber(snapshot.netWorth),
  };
}

export function normalizeChatTelemetryLearningSnapshot(
  snapshot: ChatTelemetryLearningSnapshot,
): ChatTelemetryLearningSnapshot {
  const normalized: ChatTelemetryLearningSnapshot = { ...snapshot };
  for (const key of Object.keys(normalized) as Array<keyof ChatTelemetryLearningSnapshot>) {
    if (key === 'coldStartProfileId') continue;
    const value = normalized[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      normalized[key] = Number(value.toFixed(6)) as never;
    }
  }
  return normalized;
}

export function normalizeChatTelemetryPerformanceMark(
  mark: ChatTelemetryPerformanceMark,
): ChatTelemetryPerformanceMark {
  return {
    ...mark,
    label: mark.label.trim(),
    startedAtMs: normalizeOptionalNumber(mark.startedAtMs),
    completedAtMs: normalizeOptionalNumber(mark.completedAtMs),
    durationMs: normalizeOptionalNumber(mark.durationMs),
  };
}

function normalizeOptionalNumber(value: number | undefined): number | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!Number.isFinite(value)) return undefined;
  return Number(value.toFixed(6));
}

export function redactChatTelemetryEnvelope<TPayload extends Record<string, unknown>>(
  envelope: ChatTelemetryEnvelope<TPayload>,
  config: Pick<ChatTelemetryConfig, 'privacy' | 'includeSafePreview' | 'safePreviewMaxChars'>,
): ChatTelemetryEnvelope<TPayload> {
  const redacted = structuredCloneEnvelope(envelope);

  if (!config.privacy.includeRoomIds) {
    if (redacted.run.roomId) delete redacted.run.roomId;
    if (isRecord(redacted.payload) && 'roomId' in redacted.payload) {
      delete (redacted.payload as Record<string, unknown>).roomId;
    }
  }

  if (!config.privacy.includePlayerIds && redacted.run.playerId) {
    delete redacted.run.playerId;
  }

  if (!config.privacy.includeProfileIds && redacted.run.profileId) {
    delete redacted.run.profileId;
  }

  if (!config.privacy.includeReplyTargets && isRecord(redacted.payload) && 'replyToMessageId' in redacted.payload) {
    delete (redacted.payload as Record<string, unknown>).replyToMessageId;
  }

  if (!config.privacy.includeOfferValues && isRecord(redacted.payload)) {
    stripOfferValues(redacted.payload);
  }

  if (isRecord(redacted.payload) && 'safeText' in redacted.payload) {
    const safeText = redacted.payload.safeText;
    if (isRecord(safeText) && !config.includeSafePreview) {
      delete safeText.preview;
    }
    if (isRecord(safeText) && typeof safeText.preview === 'string') {
      safeText.preview = safeText.preview.slice(0, config.safePreviewMaxChars);
    }
  }

  return redacted;
}

function stripOfferValues(value: Record<string, unknown>): void {
  if ('offerValue' in value) {
    delete value.offerValue;
  }
  if ('negotiationContext' in value && isRecord(value.negotiationContext)) {
    delete value.negotiationContext.offerValue;
  }
}

function structuredCloneEnvelope<TPayload extends Record<string, unknown>>(
  envelope: ChatTelemetryEnvelope<TPayload>,
): ChatTelemetryEnvelope<TPayload> {
  return JSON.parse(JSON.stringify(envelope)) as ChatTelemetryEnvelope<TPayload>;
}

/* ========================================================================== *
 * Section 10 — Size / summary / sort utilities
 * ========================================================================== */

export function estimateChatTelemetryEnvelopeSizeBytes(
  envelope: AnyChatTelemetryEnvelope,
): number {
  try {
    return new TextEncoder().encode(JSON.stringify(envelope)).length;
  } catch {
    return JSON.stringify(envelope).length;
  }
}

export interface ChatTelemetryEnvelopeSummary {
  eventId: string;
  eventName: ChatTelemetryEventName;
  family: ChatTelemetryFamily;
  severity: ChatTelemetrySeverity;
  roomId?: string;
  channel?: ChatTelemetryChannel;
  sessionId: string;
  timestampMs: number;
  replayWorthy: boolean;
  learningRelevant: boolean;
  sizeBytes: number;
}

export function summarizeChatTelemetryEnvelope(
  envelope: AnyChatTelemetryEnvelope,
): ChatTelemetryEnvelopeSummary {
  const family = getChatTelemetryFamily(envelope.eventName);
  const policy = getChatTelemetryQueuePolicy(envelope.eventName);
  const payloadChannel = isRecord(envelope.payload) && isChatTelemetryChannel(envelope.payload.channel)
    ? envelope.payload.channel
    : undefined;
  const payloadRoomId = isRecord(envelope.payload) && typeof envelope.payload.roomId === 'string'
    ? envelope.payload.roomId
    : undefined;

  return {
    eventId: envelope.eventId,
    eventName: envelope.eventName,
    family,
    severity: envelope.severity,
    roomId: payloadRoomId ?? envelope.run.roomId,
    channel: payloadChannel ?? envelope.run.activeChannel,
    sessionId: envelope.sessionId,
    timestampMs: envelope.timestampMs,
    replayWorthy: policy.replayWorthy,
    learningRelevant: policy.learningRelevant,
    sizeBytes: estimateChatTelemetryEnvelopeSizeBytes(envelope),
  };
}

export function sortChatTelemetryEnvelopesStable(
  envelopes: readonly AnyChatTelemetryEnvelope[],
): AnyChatTelemetryEnvelope[] {
  return [...envelopes].sort((a, b) => {
    if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
    if (a.seq !== b.seq) return a.seq - b.seq;
    return a.eventId.localeCompare(b.eventId);
  });
}

export function groupChatTelemetryEnvelopesBySession(
  envelopes: readonly AnyChatTelemetryEnvelope[],
): Record<string, AnyChatTelemetryEnvelope[]> {
  const grouped: Record<string, AnyChatTelemetryEnvelope[]> = {};
  for (const envelope of envelopes) {
    const key = envelope.sessionId;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(envelope);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key] = sortChatTelemetryEnvelopesStable(grouped[key]);
  }
  return grouped;
}

export function groupChatTelemetryEnvelopesByFamily(
  envelopes: readonly AnyChatTelemetryEnvelope[],
): Record<ChatTelemetryFamily, AnyChatTelemetryEnvelope[]> {
  const grouped = {} as Record<ChatTelemetryFamily, AnyChatTelemetryEnvelope[]>;
  for (const envelope of envelopes) {
    const family = getChatTelemetryFamily(envelope.eventName);
    if (!grouped[family]) grouped[family] = [];
    grouped[family].push(envelope);
  }
  for (const key of Object.keys(grouped) as ChatTelemetryFamily[]) {
    grouped[key] = sortChatTelemetryEnvelopesStable(grouped[key]);
  }
  return grouped;
}

/* ========================================================================== *
 * Section 11 — Batch helpers
 * ========================================================================== */

export interface ChatTelemetryBatchValidationResult {
  valid: AnyChatTelemetryEnvelope[];
  invalid: Array<{
    envelope: unknown;
    validation: ChatTelemetryValidationResult;
  }>;
}

export function validateChatTelemetryBatch(
  envelopes: readonly unknown[],
): ChatTelemetryBatchValidationResult {
  const valid: AnyChatTelemetryEnvelope[] = [];
  const invalid: Array<{ envelope: unknown; validation: ChatTelemetryValidationResult }> = [];

  for (const envelope of envelopes) {
    const validation = validateChatTelemetryEnvelope(envelope);
    if (validation.ok) {
      valid.push(envelope as AnyChatTelemetryEnvelope);
    } else {
      invalid.push({ envelope, validation });
    }
  }

  return { valid, invalid };
}

export function normalizeChatTelemetryBatch(
  envelopes: readonly AnyChatTelemetryEnvelope[],
  nowMs?: number,
): AnyChatTelemetryEnvelope[] {
  return envelopes.map((envelope) => normalizeChatTelemetryEnvelope(envelope, nowMs));
}

export function redactChatTelemetryBatch(
  envelopes: readonly AnyChatTelemetryEnvelope[],
  config: Pick<ChatTelemetryConfig, 'privacy' | 'includeSafePreview' | 'safePreviewMaxChars'>,
): AnyChatTelemetryEnvelope[] {
  return envelopes.map((envelope) => redactChatTelemetryEnvelope(envelope, config));
}

export function estimateChatTelemetryBatchSizeBytes(
  envelopes: readonly AnyChatTelemetryEnvelope[],
): number {
  return envelopes.reduce((sum, envelope) => sum + estimateChatTelemetryEnvelopeSizeBytes(envelope), 0);
}

/* ========================================================================== *
 * Section 12 — Queue-oriented batch splitting
 * ========================================================================== */

export interface ChatTelemetrySplitBatchOptions {
  maxBatchCount: number;
  maxBatchBytes: number;
}

export function splitChatTelemetryBatchForTransport(
  envelopes: readonly AnyChatTelemetryEnvelope[],
  options: ChatTelemetrySplitBatchOptions,
): AnyChatTelemetryEnvelope[][] {
  const output: AnyChatTelemetryEnvelope[][] = [];
  let current: AnyChatTelemetryEnvelope[] = [];
  let currentBytes = 0;

  for (const envelope of sortChatTelemetryEnvelopesStable(envelopes)) {
    const sizeBytes = estimateChatTelemetryEnvelopeSizeBytes(envelope);
    const wouldOverflowCount = current.length >= options.maxBatchCount;
    const wouldOverflowBytes = current.length > 0 && currentBytes + sizeBytes > options.maxBatchBytes;

    if (wouldOverflowCount || wouldOverflowBytes) {
      output.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(envelope);
    currentBytes += sizeBytes;
  }

  if (current.length > 0) {
    output.push(current);
  }

  return output;
}

/* ========================================================================== *
 * Section 13 — Export-oriented snapshots for replay / diagnostics
 * ========================================================================== */

export interface ChatTelemetryExportSnapshot {
  schemaVersion: typeof CHAT_TELEMETRY_SCHEMA_VERSION;
  exportedAtMs: number;
  count: number;
  bySession: Record<string, AnyChatTelemetryEnvelope[]>;
  byFamily: Record<ChatTelemetryFamily, AnyChatTelemetryEnvelope[]>;
  envelopes: AnyChatTelemetryEnvelope[];
}

export function createChatTelemetryExportSnapshot(
  envelopes: readonly AnyChatTelemetryEnvelope[],
  exportedAtMs: number = Date.now(),
): ChatTelemetryExportSnapshot {
  const normalized = sortChatTelemetryEnvelopesStable(envelopes);
  return {
    schemaVersion: CHAT_TELEMETRY_SCHEMA_VERSION,
    exportedAtMs,
    count: normalized.length,
    bySession: groupChatTelemetryEnvelopesBySession(normalized),
    byFamily: groupChatTelemetryEnvelopesByFamily(normalized),
    envelopes: normalized,
  };
}

/* ========================================================================== *
 * Section 14 — Final convenience guards
 * ========================================================================== */

export function envelopeHasReplayContext(
  envelope: AnyChatTelemetryEnvelope,
): boolean {
  if (isReplayWorthyChatTelemetryEvent(envelope.eventName)) return true;
  if (isRecord(envelope.payload) && 'replay' in envelope.payload) {
    return isChatTelemetryReplayReference(envelope.payload.replay);
  }
  return false;
}

export function envelopeHasLearningContext(
  envelope: AnyChatTelemetryEnvelope,
): boolean {
  return Boolean(envelope.learning) || isLearningRelevantChatTelemetryEvent(envelope.eventName);
}

export function envelopeTouchesChannel(
  envelope: AnyChatTelemetryEnvelope,
  channel: ChatTelemetryChannel,
): boolean {
  if (envelope.run.activeChannel === channel) return true;
  if (isRecord(envelope.payload) && envelope.payload.channel === channel) return true;
  return false;
}
