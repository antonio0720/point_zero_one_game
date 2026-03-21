
/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT MODERATION CONTRACTS
 * FILE: shared/contracts/chat/ChatModeration.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for moderation law, redaction plans,
 * suppression windows, rate-limit budgets, risk scoring, classifier outputs,
 * review workflows, appeals, audit trails, and transcript-safe policy actions.
 *
 * This file is the shared moderation authority for:
 *   - /shared/contracts/chat
 *   - /pzo-web/src/engines/chat
 *   - /backend/src/game/engine/chat
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Moderation is upstream of transcript truth. It is not a post-render patch.
 * 2. Frontend may warn optimistically, but backend decides allow/block/redact/
 *    suppress/reroute outcomes.
 * 3. Moderation must preserve proof, replay, and audit semantics even when
 *    content is redacted or shadow-suppressed.
 * 4. Shared moderation contracts must be import-safe for frontend, backend,
 *    and transport without dragging runtime engine code across boundaries.
 * 5. Rescue, helper reroute, negotiation pressure, and rivalry staging all
 *    require moderation-aware outcomes so the system can de-escalate or redirect
 *    instead of only hard-blocking.
 * 6. Existing moderation state already lives inside shared event vocabulary as
 *    PENDING, ALLOWED, BLOCKED, REDACTED, SHADOW_SUPPRESSED, and RATE_LIMITED.
 *    This file expands that minimal event vocabulary into the full policy layer
 *    without creating a competing truth surface.
 * ============================================================================
 */

import {
  type Brand,
  type ChatChannelFamily,
  type ChatChannelId,
  type ChatModeScope,
  type ChatRoomId,
  type JsonObject,
  type JsonValue,
  type Nullable,
  type Optional,
  type Score01,
  type Score100,
  type UnixMs,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
  CHAT_SHADOW_CHANNELS,
  CHAT_VISIBLE_CHANNELS,
} from './ChatChannels';

import {
  type ChatActorKind,
  type ChatMessageId,
  type ChatNpcId,
  type ChatProofHash,
  type ChatRange,
  type ChatReplayId,
  type ChatRequestId,
  type ChatSessionId,
  type ChatUserId,
  CHAT_ACTOR_KINDS,
} from './ChatChannels';

import {
  type ChatAuthority,
  type ChatModerationDecision,
  type ChatModerationState,
  CHAT_AUTHORITIES,
  CHAT_MODERATION_STATES,
} from './ChatEvents';

import {
  type ChatCanonicalMessage,
  type ChatMessageModerationEnvelope,
  type ChatMessageProofEnvelope,
  type ChatMessageVersion,
} from './ChatMessage';

import {
  type ChatPresenceEntry,
} from './ChatPresence';

import {
  type ChatTypingSimulationPlan,
  type ChatTypingSuppressionWindow,
} from './ChatTyping';

import {
  type ChatTranscriptExcerpt,
  type ChatTranscriptLedgerState,
  type ChatTranscriptRedactionMutation,
  type ChatTranscriptSnapshot,
} from './ChatTranscript';

import {
  type ChatNpcDescriptor,
} from './ChatNpc';

// ============================================================================
// MARK: Branded identifiers
// ============================================================================

export type ChatModerationPolicyId = Brand<string, 'ChatModerationPolicyId'>;
export type ChatModerationRuleId = Brand<string, 'ChatModerationRuleId'>;
export type ChatModerationActionId = Brand<string, 'ChatModerationActionId'>;
export type ChatModerationEvidenceId = Brand<string, 'ChatModerationEvidenceId'>;
export type ChatModerationClassifierId = Brand<string, 'ChatModerationClassifierId'>;
export type ChatModerationReviewId = Brand<string, 'ChatModerationReviewId'>;
export type ChatModerationAppealId = Brand<string, 'ChatModerationAppealId'>;
export type ChatModerationAuditId = Brand<string, 'ChatModerationAuditId'>;
export type ChatRedactionPlanId = Brand<string, 'ChatRedactionPlanId'>;
export type ChatSuppressionWindowId = Brand<string, 'ChatSuppressionWindowId'>;
export type ChatRateBudgetId = Brand<string, 'ChatRateBudgetId'>;
export type ChatModerationTelemetryId = Brand<string, 'ChatModerationTelemetryId'>;
export type ChatModerationReasonCode = Brand<string, 'ChatModerationReasonCode'>;
export type ChatModerationQueueId = Brand<string, 'ChatModerationQueueId'>;
export type ChatClassifierLabelId = Brand<string, 'ChatClassifierLabelId'>;
export type ChatMaskToken = Brand<string, 'ChatMaskToken'>;
export type ChatModerationCaseId = Brand<string, 'ChatModerationCaseId'>;
export type ChatModerationPresetId = Brand<string, 'ChatModerationPresetId'>;
export type ChatModerationEnvelopeId = Brand<string, 'ChatModerationEnvelopeId'>;

// ============================================================================
// MARK: Vocabularies
// ============================================================================

export const CHAT_MODERATION_REASON_CODES = [
  'OK',
  'TOXICITY',
  'SPAM',
  'RATE_LIMIT',
  'POLICY_BLOCK',
  'HIDDEN_SHADOW',
  'EMPTY',
  'HARASSMENT',
  'THREAT',
  'DOXXING',
  'HATE',
  'SELF_HARM',
  'SCAM',
  'IMPERSONATION',
  'MANIPULATION',
  'NEGOTIATION_ABUSE',
  'LIVEOPS_LOCK',
  'NPC_SUPPRESSION',
  'RESCUE_ESCALATION',
] as const;

export type ChatModerationReasonLiteral =
  (typeof CHAT_MODERATION_REASON_CODES)[number];

export const CHAT_MODERATION_SEVERITY_BANDS = [
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export type ChatModerationSeverityBand =
  (typeof CHAT_MODERATION_SEVERITY_BANDS)[number];

export const CHAT_MODERATION_ACTION_KINDS = [
  'ALLOW',
  'WARN',
  'REWRITE_VISIBLE_TEXT',
  'REDACT',
  'SHADOW_SUPPRESS',
  'RATE_LIMIT',
  'DROP',
  'REROUTE_TO_HELPER',
  'REROUTE_TO_SYSTEM',
  'QUARANTINE_ACTOR',
  'CREATE_SHADOW_NOTE',
  'MARK_FOR_REVIEW',
] as const;

export type ChatModerationActionKind =
  (typeof CHAT_MODERATION_ACTION_KINDS)[number];

export const CHAT_MODERATION_POLICY_FAMILIES = [
  'GLOBAL_PUBLIC',
  'SYNDICATE_PRIVATE',
  'DEALROOM_NEGOTIATION',
  'LOBBY_SOCIAL',
  'SHADOW_SYSTEM',
  'NPC_AUTHORED',
  'LIVEOPS',
] as const;

export type ChatModerationPolicyFamily =
  (typeof CHAT_MODERATION_POLICY_FAMILIES)[number];

export const CHAT_MODERATION_RISK_LABELS = [
  'toxicity',
  'spam',
  'harassment',
  'threat',
  'doxxing',
  'hate',
  'self_harm',
  'scam',
  'impersonation',
  'manipulation',
  'dealroom_pressure',
  'helper_need',
  'rage_quit_risk',
] as const;

export type ChatModerationRiskLabel =
  (typeof CHAT_MODERATION_RISK_LABELS)[number];

export const CHAT_MODERATION_EVIDENCE_KINDS = [
  'MESSAGE_TEXT',
  'TOKEN_FEATURE',
  'RISK_SCORE',
  'HISTORY_WINDOW',
  'CHANNEL_STATE',
  'RELATIONSHIP_STATE',
  'RATE_BUDGET',
  'LIVEOPS_LOCK',
  'MANUAL_NOTE',
  'NPC_POLICY',
] as const;

export type ChatModerationEvidenceKind =
  (typeof CHAT_MODERATION_EVIDENCE_KINDS)[number];

export const CHAT_REDACTION_KINDS = [
  'FULL',
  'PARTIAL',
  'MASK_NUMBERS',
  'MASK_IDENTIFIERS',
  'MASK_NAMES',
  'MASK_TACTICAL_DATA',
] as const;

export type ChatRedactionKind = (typeof CHAT_REDACTION_KINDS)[number];

export const CHAT_REVIEW_STATES = [
  'UNREVIEWED',
  'PENDING',
  'RESOLVED_ALLOW',
  'RESOLVED_REDACT',
  'RESOLVED_BLOCK',
  'RESOLVED_QUARANTINE',
] as const;

export type ChatReviewState = (typeof CHAT_REVIEW_STATES)[number];

export const CHAT_APPEAL_STATES = [
  'NONE',
  'REQUESTED',
  'IN_REVIEW',
  'UPHELD',
  'OVERTURNED',
] as const;

export type ChatAppealState = (typeof CHAT_APPEAL_STATES)[number];

export const CHAT_RATE_BUDGET_SCOPES = [
  'SESSION',
  'ROOM',
  'CHANNEL',
  'ACCOUNT',
  'GLOBAL',
] as const;

export type ChatRateBudgetScope = (typeof CHAT_RATE_BUDGET_SCOPES)[number];

export const CHAT_MODERATION_TELEMETRY_EVENT_NAMES = [
  'chat_moderation_scored',
  'chat_moderation_allowed',
  'chat_moderation_warned',
  'chat_moderation_redacted',
  'chat_moderation_shadow_suppressed',
  'chat_moderation_rate_limited',
  'chat_moderation_dropped',
  'chat_moderation_review_requested',
  'chat_moderation_appeal_requested',
] as const;

export type ChatModerationTelemetryEventName =
  (typeof CHAT_MODERATION_TELEMETRY_EVENT_NAMES)[number];

// ============================================================================
// MARK: Core classifier and evidence contracts
// ============================================================================

export interface ChatModerationRiskScore {
  readonly label: ChatModerationRiskLabel;
  readonly score: Score01;
  readonly severity: ChatModerationSeverityBand;
  readonly classifierId: ChatModerationClassifierId;
}

export interface ChatModerationEvidence {
  readonly evidenceId: ChatModerationEvidenceId;
  readonly kind: ChatModerationEvidenceKind;
  readonly summary: string;
  readonly payload: JsonObject;
  readonly confidence?: Score01;
  readonly sourceAuthority?: ChatAuthority;
}

export interface ChatModerationClassifierOutput {
  readonly classifierId: ChatModerationClassifierId;
  readonly label: ChatClassifierLabelId;
  readonly version: string;
  readonly scoredAt: UnixMs;
  readonly risks: readonly ChatModerationRiskScore[];
}

export interface ChatRateBudget {
  readonly budgetId: ChatRateBudgetId;
  readonly scope: ChatRateBudgetScope;
  readonly key: string;
  readonly limit: number;
  readonly used: number;
  readonly windowMs: number;
  readonly resetAt: UnixMs;
}

export interface ChatSuppressionWindow {
  readonly suppressionWindowId: ChatSuppressionWindowId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly state: ChatModerationState;
  readonly reason: ChatModerationReasonLiteral;
  readonly startedAt: UnixMs;
  readonly endsAt?: UnixMs;
  readonly visibleToActor: boolean;
}

export interface ChatRedactionPlan {
  readonly redactionPlanId: ChatRedactionPlanId;
  readonly kind: ChatRedactionKind;
  readonly maskToken: ChatMaskToken;
  readonly displayText: string;
  readonly originalRanges?: readonly ChatRange[];
  readonly preserveLengthHint: boolean;
}

export interface ChatModerationAction {
  readonly actionId: ChatModerationActionId;
  readonly kind: ChatModerationActionKind;
  readonly state: ChatModerationState;
  readonly reason: ChatModerationReasonLiteral;
  readonly playerVisible: boolean;
  readonly displayText?: string;
  readonly redactionPlan?: ChatRedactionPlan;
  readonly suppressionWindow?: ChatSuppressionWindow;
  readonly helperReroute?: { readonly helperHint?: ChatNpcId; readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' };
}

export interface ChatModerationPolicyRule {
  readonly ruleId: ChatModerationRuleId;
  readonly family: ChatModerationPolicyFamily;
  readonly name: string;
  readonly description: string;
  readonly reason: ChatModerationReasonLiteral;
  readonly appliesToChannels: readonly ChatChannelId[];
  readonly appliesToActorKinds: readonly ChatActorKind[];
  readonly appliesToModeScopes: readonly ChatModeScope[];
  readonly minScore?: Score01;
  readonly actionKind: ChatModerationActionKind;
  readonly severity: ChatModerationSeverityBand;
  readonly playerVisible: boolean;
}

export interface ChatModerationPolicyProfile {
  readonly policyId: ChatModerationPolicyId;
  readonly family: ChatModerationPolicyFamily;
  readonly title: string;
  readonly description: string;
  readonly rules: readonly ChatModerationPolicyRule[];
  readonly defaultAllowedState: ChatModerationState;
  readonly requiresProofPreservation: boolean;
  readonly allowsHelperReroute: boolean;
  readonly allowsShadowSuppression: boolean;
}

// ============================================================================
// MARK: Decision envelopes and review state
// ============================================================================

export interface ChatModerationContext {
  readonly sessionId?: ChatSessionId;
  readonly actorId: ChatUserId | ChatNpcId;
  readonly actorKind: ChatActorKind;
  readonly authorityHint: ChatAuthority;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly modeScope: ChatModeScope;
  readonly messageId?: ChatMessageId;
  readonly parentMessageId?: ChatMessageId;
  readonly presence?: ChatPresenceEntry;
  readonly relatedMessage?: ChatCanonicalMessage;
  readonly relatedNpc?: ChatNpcDescriptor;
  readonly relatedSlice?: ChatTranscriptSnapshot;
  readonly liveReplayId?: ChatReplayId;
  readonly requestId?: ChatRequestId;
  readonly evaluatedAt: UnixMs;
}

export interface ChatModerationInput {
  readonly context: ChatModerationContext;
  readonly rawText: string;
  readonly normalizedText: string;
  readonly classifierOutputs: readonly ChatModerationClassifierOutput[];
  readonly evidence: readonly ChatModerationEvidence[];
  readonly rateBudgets: readonly ChatRateBudget[];
  readonly transcriptDescriptor?: ChatTranscriptLedgerState;
}

export interface ChatExpandedModerationDecision {
  readonly state: ChatModerationState;
  readonly reasonCode?: ChatModerationReasonLiteral;
  readonly displayText?: string;
  readonly playerVisible: boolean;
  readonly severity: ChatModerationSeverityBand;
  readonly actionKind: ChatModerationActionKind;
  readonly ruleId?: ChatModerationRuleId;
  readonly evidenceIds: readonly ChatModerationEvidenceId[];
  readonly redactionPlan?: ChatRedactionPlan;
  readonly helperReroute?: { readonly helperHint?: ChatNpcId; readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' };
  readonly reviewRequired: boolean;
}

export interface ChatModerationResult {
  readonly envelopeId: ChatModerationEnvelopeId;
  readonly context: ChatModerationContext;
  readonly decision: ChatExpandedModerationDecision;
  readonly classifierOutputs: readonly ChatModerationClassifierOutput[];
  readonly evidence: readonly ChatModerationEvidence[];
  readonly appliedRules: readonly ChatModerationPolicyRule[];
  readonly auditId: ChatModerationAuditId;
}

export interface ChatModerationReviewRecord {
  readonly reviewId: ChatModerationReviewId;
  readonly caseId: ChatModerationCaseId;
  readonly state: ChatReviewState;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly reviewedByAuthority?: ChatAuthority;
  readonly reviewedByUserId?: ChatUserId;
  readonly finalDecision?: ChatExpandedModerationDecision;
  readonly summary?: string;
}

export interface ChatModerationAppeal {
  readonly appealId: ChatModerationAppealId;
  readonly caseId: ChatModerationCaseId;
  readonly state: ChatAppealState;
  readonly actorId: ChatUserId;
  readonly requestedAt: UnixMs;
  readonly reason?: string;
}

export interface ChatModerationAuditRecord {
  readonly auditId: ChatModerationAuditId;
  readonly caseId: ChatModerationCaseId;
  readonly at: UnixMs;
  readonly authority: ChatAuthority;
  readonly action: ChatModerationActionKind;
  readonly reason: ChatModerationReasonLiteral;
  readonly messageId?: ChatMessageId;
  readonly transcriptVisible: boolean;
  readonly notes?: string;
}

// ============================================================================
// MARK: Default policy helpers
// ============================================================================

function rule(
  id: string,
  family: ChatModerationPolicyFamily,
  name: string,
  description: string,
  reason: ChatModerationReasonLiteral,
  appliesToChannels: readonly ChatChannelId[],
  appliesToActorKinds: readonly ChatActorKind[],
  appliesToModeScopes: readonly ChatModeScope[],
  actionKind: ChatModerationActionKind,
  severity: ChatModerationSeverityBand,
  playerVisible: boolean,
  minScore?: number,
): ChatModerationPolicyRule {
  return Object.freeze({
    ruleId: id as ChatModerationRuleId,
    family,
    name,
    description,
    reason,
    appliesToChannels,
    appliesToActorKinds,
    appliesToModeScopes,
    minScore: minScore == null ? undefined : (minScore as Score01),
    actionKind,
    severity,
    playerVisible,
  });
}

function profile(
  id: string,
  family: ChatModerationPolicyFamily,
  title: string,
  description: string,
  rules: readonly ChatModerationPolicyRule[],
  options?: Partial<ChatModerationPolicyProfile>,
): ChatModerationPolicyProfile {
  return Object.freeze({
    policyId: id as ChatModerationPolicyId,
    family,
    title,
    description,
    rules,
    defaultAllowedState: options?.defaultAllowedState ?? 'ALLOWED',
    requiresProofPreservation: options?.requiresProofPreservation ?? true,
    allowsHelperReroute: options?.allowsHelperReroute ?? true,
    allowsShadowSuppression: options?.allowsShadowSuppression ?? true,
  });
}

export const GLOBAL_PUBLIC_MODERATION_POLICY = profile(
  'policy:global-public',
  'GLOBAL_PUBLIC',
  'Global Public Policy',
  'Public-facing channels prioritize safety, anti-spam, and room readability.',
  [
    rule('global:spam', 'GLOBAL_PUBLIC', 'Spam throttle', 'Burst spam in public channels should be rate-limited before transcript mutation.', 'SPAM', [...CHAT_VISIBLE_CHANNELS], ['PLAYER'], ['BATTLE', 'EMPIRE', 'LEAGUE', 'LOBBY', 'PREDATOR', 'PHANTOM', 'SYNDICATE', 'POST_RUN'], 'RATE_LIMIT', 'MEDIUM', true, 0.65),
    rule('global:toxicity', 'GLOBAL_PUBLIC', 'Public toxicity', 'Public toxicity or harassment should be redacted or blocked depending on severity.', 'TOXICITY', [...CHAT_VISIBLE_CHANNELS], ['PLAYER', 'HATER'], ['BATTLE', 'EMPIRE', 'LEAGUE', 'LOBBY', 'PREDATOR', 'PHANTOM', 'SYNDICATE', 'POST_RUN'], 'REDACT', 'HIGH', true, 0.75),
  ],
);

export const DEALROOM_MODERATION_POLICY = profile(
  'policy:dealroom',
  'DEALROOM_NEGOTIATION',
  'Deal Room Policy',
  'Negotiation channels allow sharp pressure but still block scams, impersonation, and coercive abuse.',
  [
    rule('deal:scam', 'DEALROOM_NEGOTIATION', 'Scam prevention', 'Deal-room scam language must be blocked or quarantined.', 'SCAM', ['DEAL_ROOM'], ['PLAYER', 'HATER', 'NPC'], ['BATTLE', 'EMPIRE', 'PREDATOR', 'SYNDICATE'], 'DROP', 'CRITICAL', true, 0.7),
    rule('deal:impersonation', 'DEALROOM_NEGOTIATION', 'Impersonation prevention', 'Impersonation attempts in negotiation channels must be quarantined.', 'IMPERSONATION', ['DEAL_ROOM'], ['PLAYER', 'HATER'], ['BATTLE', 'EMPIRE', 'PREDATOR', 'SYNDICATE'], 'QUARANTINE_ACTOR', 'CRITICAL', false, 0.7),
    rule('deal:manipulation', 'DEALROOM_NEGOTIATION', 'Manipulation reroute', 'Manipulative pressure should be marked and may route a helper warning.', 'NEGOTIATION_ABUSE', ['DEAL_ROOM'], ['PLAYER', 'HATER'], ['BATTLE', 'EMPIRE', 'PREDATOR', 'SYNDICATE'], 'REROUTE_TO_HELPER', 'MEDIUM', true, 0.68),
  ],
);

export const SHADOW_SYSTEM_MODERATION_POLICY = profile(
  'policy:shadow-system',
  'SHADOW_SYSTEM',
  'Shadow System Policy',
  'Shadow channels preserve auditability and policy actions while avoiding visible transcript noise.',
  [
    rule('shadow:system', 'SHADOW_SYSTEM', 'Shadow note', 'System shadow notes remain shadow-only and must not leak into visible transcript.', [...CHAT_SHADOW_CHANNELS].includes('SYSTEM_SHADOW') ? 'HIDDEN_SHADOW' : 'POLICY_BLOCK', [...CHAT_SHADOW_CHANNELS], ['SYSTEM', 'HELPER', 'HATER', 'NPC'], ['BATTLE', 'EMPIRE', 'LEAGUE', 'LOBBY', 'PREDATOR', 'PHANTOM', 'SYNDICATE', 'POST_RUN'], 'SHADOW_SUPPRESS', 'LOW', false),
  ],
  { allowsHelperReroute: false },
);

export const CHAT_MODERATION_POLICIES: readonly ChatModerationPolicyProfile[] = [
  GLOBAL_PUBLIC_MODERATION_POLICY,
  DEALROOM_MODERATION_POLICY,
  SHADOW_SYSTEM_MODERATION_POLICY,
] as const;

export const CHAT_MODERATION_POLICY_BY_FAMILY: Readonly<Record<ChatModerationPolicyFamily, ChatModerationPolicyProfile | undefined>> =
  Object.freeze({
    GLOBAL_PUBLIC: GLOBAL_PUBLIC_MODERATION_POLICY,
    SYNDICATE_PRIVATE: undefined,
    DEALROOM_NEGOTIATION: DEALROOM_MODERATION_POLICY,
    LOBBY_SOCIAL: undefined,
    SHADOW_SYSTEM: SHADOW_SYSTEM_MODERATION_POLICY,
    NPC_AUTHORED: undefined,
    LIVEOPS: undefined,
  });

// ============================================================================
// MARK: Builders and conversion helpers
// ============================================================================

export function buildNeutralModerationDecision(
  displayText?: string,
): ChatExpandedModerationDecision {
  return Object.freeze({
    state: 'ALLOWED',
    reasonCode: 'OK',
    displayText,
    playerVisible: true,
    severity: 'NONE',
    actionKind: 'ALLOW',
    evidenceIds: [],
    reviewRequired: false,
  });
}

export function buildRateLimitedModerationDecision(
  displayText = 'Slow down.',
): ChatExpandedModerationDecision {
  return Object.freeze({
    state: 'RATE_LIMITED',
    reasonCode: 'RATE_LIMIT',
    displayText,
    playerVisible: true,
    severity: 'MEDIUM',
    actionKind: 'RATE_LIMIT',
    evidenceIds: [],
    reviewRequired: false,
  });
}

export function buildShadowSuppressedDecision(
  reason: ChatModerationReasonLiteral = 'HIDDEN_SHADOW',
): ChatExpandedModerationDecision {
  return Object.freeze({
    state: 'SHADOW_SUPPRESSED',
    reasonCode: reason,
    playerVisible: false,
    severity: 'LOW',
    actionKind: 'SHADOW_SUPPRESS',
    evidenceIds: [],
    reviewRequired: false,
  });
}

export function toBasicModerationDecision(
  value: ChatExpandedModerationDecision,
): ChatModerationDecision {
  const allowedReasonCodes: readonly NonNullable<ChatModerationDecision['reasonCode']>[] = [
    'TOXICITY',
    'SPAM',
    'RATE_LIMIT',
    'POLICY_BLOCK',
    'HIDDEN_SHADOW',
    'EMPTY',
  ] as const;
  const normalizedReasonCode =
    value.reasonCode && allowedReasonCodes.includes(value.reasonCode as any)
      ? (value.reasonCode as NonNullable<ChatModerationDecision['reasonCode']>)
      : undefined;

  return Object.freeze({
    state: value.state,
    reasonCode: normalizedReasonCode,
    displayText: value.displayText,
    playerVisible: value.playerVisible,
  });
}

export function moderationStateIsTerminal(state: ChatModerationState): boolean {
  return state !== 'PENDING';
}

export function moderationDecisionBlocksVisibleTranscript(
  decision: ChatExpandedModerationDecision,
): boolean {
  return decision.state === 'BLOCKED' || decision.state === 'REDACTED' || decision.state === 'SHADOW_SUPPRESSED';
}

export function moderationDecisionPreservesVisiblePlaceholder(
  decision: ChatExpandedModerationDecision,
): boolean {
  return decision.state === 'REDACTED' || decision.actionKind === 'REWRITE_VISIBLE_TEXT';
}

export function getModerationPolicyFamilyForChannel(
  channelId: ChatChannelId,
): ChatModerationPolicyFamily {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[channelId];
  switch (descriptor.family) {
    case 'NEGOTIATION':
      return 'DEALROOM_NEGOTIATION';
    case 'SHADOW':
      return 'SHADOW_SYSTEM';
    case 'PRE_RUN':
      return 'LOBBY_SOCIAL';
    case 'PRIVATE':
      return 'SYNDICATE_PRIVATE';
    default:
      return 'GLOBAL_PUBLIC';
  }
}

export function buildMessageModerationEnvelope(
  decision: ChatExpandedModerationDecision,
  moderatedAt?: UnixMs,
  moderatedByAuthority?: ChatAuthority,
): ChatMessageModerationEnvelope {
  return Object.freeze({
    decision: toBasicModerationDecision(decision),
    moderatedAt,
    moderatedByAuthority,
    visibleTextOverride: decision.displayText,
    redactionMask: decision.redactionPlan?.displayText,
  });
}

export function applyModerationDecisionToText(
  text: string,
  decision: ChatExpandedModerationDecision,
): string {
  if (decision.redactionPlan) {
    return decision.redactionPlan.displayText;
  }
  if (decision.displayText) {
    return decision.displayText;
  }
  return text;
}

// ============================================================================
// MARK: Review and appeal presets
// ============================================================================

export interface ChatModerationPreset {
  readonly presetId: ChatModerationPresetId;
  readonly title: string;
  readonly description: string;
  readonly family: ChatModerationPolicyFamily;
  readonly ruleIds: readonly ChatModerationRuleId[];
}

export const CHAT_MODERATION_PRESETS: readonly ChatModerationPreset[] = [
  Object.freeze({
    presetId: 'preset:public' as ChatModerationPresetId,
    title: 'Public safety baseline',
    description: 'Baseline public-channel moderation with replay-safe redaction.',
    family: 'GLOBAL_PUBLIC',
    ruleIds: GLOBAL_PUBLIC_MODERATION_POLICY.rules.map((item) => item.ruleId),
  }),
  Object.freeze({
    presetId: 'preset:dealroom' as ChatModerationPresetId,
    title: 'Deal-room negotiation baseline',
    description: 'Negotiation-aware moderation for offers, counters, and pressure tactics.',
    family: 'DEALROOM_NEGOTIATION',
    ruleIds: DEALROOM_MODERATION_POLICY.rules.map((item) => item.ruleId),
  }),
] as const;



// ============================================================================
// MARK: Queueing, escalation, and review routing
// ============================================================================

export const CHAT_MODERATION_QUEUE_KINDS = [
  'AUTOMATED_ONLY',
  'HUMAN_REVIEW',
  'LIVEOPS_REVIEW',
  'POST_RUN_REVIEW',
] as const;

export type ChatModerationQueueKind = (typeof CHAT_MODERATION_QUEUE_KINDS)[number];

export const CHAT_MODERATION_ESCALATION_KINDS = [
  'NONE',
  'HELPER_REROUTE',
  'HUMAN_REVIEW',
  'LIVEOPS_ESCALATION',
  'ACCOUNT_ACTION',
] as const;

export type ChatModerationEscalationKind =
  (typeof CHAT_MODERATION_ESCALATION_KINDS)[number];

export interface ChatModerationQueueDescriptor {
  readonly queueId: ChatModerationQueueId;
  readonly kind: ChatModerationQueueKind;
  readonly title: string;
  readonly description: string;
  readonly visibleToPlayer: boolean;
  readonly targetReviewState: ChatReviewState;
}

export interface ChatModerationEscalationPlan {
  readonly escalationKind: ChatModerationEscalationKind;
  readonly queueId?: ChatModerationQueueId;
  readonly helperHint?: ChatNpcId;
  readonly summary: string;
}

export const CHAT_MODERATION_QUEUE_DESCRIPTORS: readonly ChatModerationQueueDescriptor[] = [
  Object.freeze({
    queueId: 'queue:auto' as ChatModerationQueueId,
    kind: 'AUTOMATED_ONLY',
    title: 'Automated policy lane',
    description: 'Resolved without a human review queue unless appealed.',
    visibleToPlayer: false,
    targetReviewState: 'RESOLVED_ALLOW',
  }),
  Object.freeze({
    queueId: 'queue:human' as ChatModerationQueueId,
    kind: 'HUMAN_REVIEW',
    title: 'Human review lane',
    description: 'Used for ambiguous or high-severity moderation cases.',
    visibleToPlayer: false,
    targetReviewState: 'PENDING',
  }),
  Object.freeze({
    queueId: 'queue:liveops' as ChatModerationQueueId,
    kind: 'LIVEOPS_REVIEW',
    title: 'Liveops review lane',
    description: 'Reserved for world-event or seasonal policy incidents.',
    visibleToPlayer: false,
    targetReviewState: 'PENDING',
  }),
  Object.freeze({
    queueId: 'queue:postrun' as ChatModerationQueueId,
    kind: 'POST_RUN_REVIEW',
    title: 'Post-run review lane',
    description: 'Used when moderation can safely defer until the run ends.',
    visibleToPlayer: false,
    targetReviewState: 'UNREVIEWED',
  }),
] as const;

export function buildModerationEscalationPlan(
  result: ChatModerationResult,
): ChatModerationEscalationPlan {
  if (result.decision.helperReroute) {
    return Object.freeze({
      escalationKind: 'HELPER_REROUTE',
      helperHint: result.decision.helperReroute.helperHint,
      summary: 'Route this moderation result toward a helper intervention.',
    });
  }

  if (result.decision.reviewRequired) {
    return Object.freeze({
      escalationKind: 'HUMAN_REVIEW',
      queueId: 'queue:human' as ChatModerationQueueId,
      summary: 'Send this moderation result to human review.',
    });
  }

  return Object.freeze({
    escalationKind: 'NONE',
    summary: 'No escalation required.',
  });
}

// ============================================================================
// MARK: Contract descriptor
// ============================================================================

export const CHAT_MODERATION_CONTRACT_DESCRIPTOR = Object.freeze({
  name: 'ChatModeration',
  version: '1.0.0-alpha',
  contractVersion: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  states: CHAT_MODERATION_STATES,
  reasonCodes: CHAT_MODERATION_REASON_CODES,
  severityBands: CHAT_MODERATION_SEVERITY_BANDS,
  actionKinds: CHAT_MODERATION_ACTION_KINDS,
  policyFamilies: CHAT_MODERATION_POLICY_FAMILIES,
  telemetryEvents: CHAT_MODERATION_TELEMETRY_EVENT_NAMES,
  presets: CHAT_MODERATION_PRESETS.map((item) => item.presetId),
} as const);

export type ChatModerationContractDescriptor = typeof CHAT_MODERATION_CONTRACT_DESCRIPTOR;
