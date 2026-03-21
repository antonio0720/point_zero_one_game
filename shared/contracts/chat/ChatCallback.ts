/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT CALLBACK CONTRACTS
 * FILE: shared/contracts/chat/ChatCallback.ts
 * ============================================================================
 * Canonical shared contract surface for callback planning, quote-backed
 * receipts, relationship-backed recalls, helper trust interventions, scene
 * aware callback beats, and callback ledger synchronization.
 * ============================================================================
 */

import type {
  Brand,
  ChatChannelId,
  ChatInterventionId,
  ChatMemoryAnchorId,
  ChatRelationshipId,
  ChatRequestId,
  ChatRoomId,
  ChatUserId,
  JsonObject,
  Score01,
  UnixMs,
} from './ChatChannels';
import { CHAT_CONTRACT_AUTHORITIES, CHAT_CONTRACT_VERSION } from './ChatChannels';
import type { ChatActorKind, ChatMessageId } from './ChatChannels';
import type { ChatPressureTier } from './ChatEvents';
import type { ChatQuoteReference } from './ChatMessage';
import type {
  ChatQuoteAudienceClass,
  ChatQuoteRecord,
  ChatQuoteSelectionCandidate,
  ChatQuoteToneClass,
  ChatQuoteUseIntent,
} from './ChatQuote';
import type { EpisodicMemoryCallbackCandidate, EpisodicMemoryEventType } from './memory';
import type {
  ChatRelationshipCallbackHint,
  ChatRelationshipCounterpartKind,
  ChatRelationshipCounterpartState,
  ChatRelationshipSnapshot,
} from './relationship';
import type {
  SharedChatMomentType,
  SharedChatSceneArchetype,
  SharedChatSceneRole,
} from './scene';

export type ChatCallbackId = Brand<string, 'ChatCallbackId'>;
export type ChatCallbackPlanId = Brand<string, 'ChatCallbackPlanId'>;
export type ChatCallbackLedgerId = Brand<string, 'ChatCallbackLedgerId'>;
export type ChatCallbackCandidateId = Brand<string, 'ChatCallbackCandidateId'>;
export type ChatCallbackTemplateId = Brand<string, 'ChatCallbackTemplateId'>;
export type ChatCallbackRuleId = Brand<string, 'ChatCallbackRuleId'>;
export type ChatCallbackWindowId = Brand<string, 'ChatCallbackWindowId'>;
export type ChatCallbackSelectorId = Brand<string, 'ChatCallbackSelectorId'>;

export const CHAT_CALLBACK_KINDS = [
  'RELATIONSHIP',
  'QUOTE',
  'MEMORY',
  'RESCUE',
  'NEGOTIATION',
  'SCENE_REVEAL',
  'POST_RUN',
  'LEGEND',
  'WORLD_EVENT',
  'SYSTEM_RECEIPT',
] as const;
export const CHAT_CALLBACK_TIMINGS = [
  'IMMEDIATE',
  'FAST_FOLLOW',
  'DELAYED',
  'REVEAL_WINDOW',
  'POST_SCENE',
  'POST_RUN',
  'NEXT_MODE',
  'SILENT',
] as const;
export const CHAT_CALLBACK_PRIVACY_CLASSES = [
  'PUBLIC',
  'PRIVATE',
  'HELPER_ONLY',
  'RIVAL_ONLY',
  'SYSTEM_ONLY',
  'SHADOW',
] as const;
export const CHAT_CALLBACK_NARRATIVE_INTENTS = [
  'WITNESS',
  'HUMILIATE',
  'GUIDE',
  'RESCUE',
  'WARN',
  'ESCALATE',
  'DE_ESCALATE',
  'INTERPRET',
  'MEMORIALIZE',
  'REPRICE',
  'REVEAL',
  'FORESHADOW',
] as const;
export const CHAT_CALLBACK_LIFECYCLE_STATES = [
  'PENDING',
  'PLANNED',
  'SUPPRESSED',
  'EMITTED',
  'SPENT',
  'ARCHIVED',
  'CANCELLED',
] as const;
export const CHAT_CALLBACK_SUPPRESSION_REASONS = [
  'NONE',
  'SILENCE_WINDOW',
  'DUPLICATE_FACT',
  'PRIVACY_MISMATCH',
  'REDACTION',
  'LOW_CONFIDENCE',
  'COOLDOWN',
  'AUTHORITATIVE_OVERRIDE',
  'HELPER_WAITING',
  'RIVAL_HOLDING',
] as const;
export const CHAT_CALLBACK_GENERATED_PAYLOAD_KINDS = [
  'RELATIONSHIP_CALLBACK',
  'QUOTE_CALLBACK',
  'HELPER_RESCUE',
  'CROWD_REACTION',
  'POST_RUN_RITUAL',
  'SYSTEM_SHADOW_MARKER',
] as const;
export type ChatCallbackKind = (typeof CHAT_CALLBACK_KINDS)[number];
export type ChatCallbackTiming = (typeof CHAT_CALLBACK_TIMINGS)[number];
export type ChatCallbackPrivacyClass = (typeof CHAT_CALLBACK_PRIVACY_CLASSES)[number];
export type ChatCallbackNarrativeIntent = (typeof CHAT_CALLBACK_NARRATIVE_INTENTS)[number];
export type ChatCallbackLifecycleState = (typeof CHAT_CALLBACK_LIFECYCLE_STATES)[number];
export type ChatCallbackSuppressionReason = (typeof CHAT_CALLBACK_SUPPRESSION_REASONS)[number];
export type ChatCallbackGeneratedPayloadKind = (typeof CHAT_CALLBACK_GENERATED_PAYLOAD_KINDS)[number];

export interface ChatCallbackContext {
  readonly requestId: ChatRequestId;
  readonly createdAt: UnixMs;
  readonly roomId?: ChatRoomId | null;
  readonly channelId?: ChatChannelId | null;
  readonly playerId?: ChatUserId | null;
  readonly targetActorId?: string | null;
  readonly targetActorKind?: ChatActorKind | ChatRelationshipCounterpartKind | null;
  readonly counterpartId?: string | null;
  readonly counterpartKind?: ChatRelationshipCounterpartKind | null;
  readonly sceneId?: string | null;
  readonly sceneArchetype?: SharedChatSceneArchetype | null;
  readonly sceneRole?: SharedChatSceneRole | null;
  readonly momentType?: SharedChatMomentType | null;
  readonly pressureTier?: ChatPressureTier | null;
  readonly privacyClass: ChatCallbackPrivacyClass;
  readonly requestedIntent?: ChatCallbackNarrativeIntent | null;
  readonly useIntent?: ChatQuoteUseIntent | null;
  readonly allowQuoteReuse: boolean;
  readonly allowRelationshipReuse: boolean;
  readonly allowMemoryReuse: boolean;
  readonly allowPublicReceipt: boolean;
  readonly allowSilentOutcome: boolean;
  readonly tags: readonly string[];
}

export interface ChatCallbackRelationshipJoin {
  readonly relationshipId?: ChatRelationshipId | null;
  readonly counterpartState?: ChatRelationshipCounterpartState | null;
  readonly relationshipSnapshot?: ChatRelationshipSnapshot | null;
  readonly callbackHints: readonly ChatRelationshipCallbackHint[];
}

export interface ChatCallbackQuoteJoin {
  readonly primaryQuote?: ChatQuoteRecord | null;
  readonly candidateQuotes: readonly ChatQuoteRecord[];
  readonly selectedQuoteCandidate?: ChatQuoteSelectionCandidate | null;
  readonly quoteReference?: ChatQuoteReference | null;
}

export interface ChatCallbackMemoryJoin {
  readonly memoryAnchorId?: ChatMemoryAnchorId | null;
  readonly memoryEventType?: EpisodicMemoryEventType | null;
  readonly candidateMemories: readonly EpisodicMemoryCallbackCandidate[];
}

export interface ChatCallbackRescueJoin {
  readonly interventionId?: ChatInterventionId | null;
  readonly rescueDebt01?: number;
  readonly frustration01?: number;
  readonly attachment01?: number;
  readonly trustNeed01?: number;
}

export interface ChatCallbackEligibilityRule {
  readonly ruleId: ChatCallbackRuleId;
  readonly label: string;
  readonly appliesToKinds: readonly ChatCallbackKind[];
  readonly minScore01?: number;
  readonly allowedPrivacyClasses?: readonly ChatCallbackPrivacyClass[];
  readonly allowedChannels?: readonly ChatChannelId[];
  readonly requiredTags?: readonly string[];
  readonly bannedTags?: readonly string[];
  readonly requiresQuote?: boolean;
  readonly requiresRelationship?: boolean;
  readonly requiresMemory?: boolean;
  readonly requiresRescueJoin?: boolean;
  readonly notes: readonly string[];
}

export interface ChatCallbackTemplate {
  readonly templateId: ChatCallbackTemplateId;
  readonly callbackKind: ChatCallbackKind;
  readonly narrativeIntent: ChatCallbackNarrativeIntent;
  readonly payloadKind: ChatCallbackGeneratedPayloadKind;
  readonly preferredTiming: ChatCallbackTiming;
  readonly preferredPrivacyClass: ChatCallbackPrivacyClass;
  readonly preferredToneClass?: ChatQuoteToneClass | null;
  readonly bodyHint: string;
  readonly openingHint?: string;
  readonly closingHint?: string;
  readonly sceneRoles?: readonly SharedChatSceneRole[];
  readonly allowedMoments?: readonly SharedChatMomentType[];
  readonly notes: readonly string[];
}

export interface ChatCallbackCandidate {
  readonly candidateId: ChatCallbackCandidateId;
  readonly callbackKind: ChatCallbackKind;
  readonly narrativeIntent: ChatCallbackNarrativeIntent;
  readonly privacyClass: ChatCallbackPrivacyClass;
  readonly timing: ChatCallbackTiming;
  readonly payloadKind: ChatCallbackGeneratedPayloadKind;
  readonly score01: Score01;
  readonly confidence01: Score01;
  readonly suppressionReason: ChatCallbackSuppressionReason;
  readonly selectedTemplateId?: ChatCallbackTemplateId | null;
  readonly relationshipJoin?: ChatCallbackRelationshipJoin | null;
  readonly quoteJoin?: ChatCallbackQuoteJoin | null;
  readonly memoryJoin?: ChatCallbackMemoryJoin | null;
  readonly rescueJoin?: ChatCallbackRescueJoin | null;
  readonly explanation: readonly string[];
}

export interface ChatCallbackSelectionResponse {
  readonly requestId: ChatRequestId;
  readonly createdAt: UnixMs;
  readonly candidates: readonly ChatCallbackCandidate[];
  readonly selectedCandidateId?: ChatCallbackCandidateId | null;
  readonly silentOutcome: boolean;
  readonly silentReason?: ChatCallbackSuppressionReason | null;
}

export interface ChatCallbackPlanBeat {
  readonly beatIndex: number;
  readonly timing: ChatCallbackTiming;
  readonly payloadKind: ChatCallbackGeneratedPayloadKind;
  readonly delayMs: number;
  readonly channelId?: ChatChannelId | null;
  readonly privacyClass: ChatCallbackPrivacyClass;
  readonly callbackId?: ChatCallbackId | null;
  readonly relatedMessageId?: ChatMessageId | null;
  readonly notes: readonly string[];
}

export interface ChatCallbackPlan {
  readonly planId: ChatCallbackPlanId;
  readonly createdAt: UnixMs;
  readonly requestId: ChatRequestId;
  readonly selectedCandidate: ChatCallbackCandidate;
  readonly beats: readonly ChatCallbackPlanBeat[];
  readonly allowComposerDuringPlan: boolean;
  readonly canBeSuppressedBySilenceWindow: boolean;
  readonly canBeOverriddenByAuthoritativeEvent: boolean;
  readonly notes: readonly string[];
}

export interface ChatCallbackRecord {
  readonly callbackId: ChatCallbackId;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly lifecycleState: ChatCallbackLifecycleState;
  readonly context: ChatCallbackContext;
  readonly selectedCandidate: ChatCallbackCandidate;
  readonly executedPlan?: ChatCallbackPlan | null;
  readonly emittedMessageIds: readonly ChatMessageId[];
  readonly suppressionReason: ChatCallbackSuppressionReason;
  readonly tags: readonly string[];
  readonly customData?: JsonObject;
}

export interface ChatCallbackLedgerSnapshot {
  readonly ledgerId: ChatCallbackLedgerId;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly callbacks: readonly ChatCallbackRecord[];
  readonly countsByKind: Readonly<Record<ChatCallbackKind, number>>;
  readonly countsByLifecycle: Readonly<Record<ChatCallbackLifecycleState, number>>;
  readonly countsBySuppression: Readonly<Record<ChatCallbackSuppressionReason, number>>;
}

export interface ChatCallbackTransportEnvelope {
  readonly envelopeType: 'CHAT_CALLBACK_LEDGER';
  readonly schemaVersion: typeof CHAT_CONTRACT_VERSION;
  readonly authorities: typeof CHAT_CONTRACT_AUTHORITIES;
  readonly snapshot: ChatCallbackLedgerSnapshot;
}

export const DEFAULT_CHAT_CALLBACK_TEMPLATES: readonly ChatCallbackTemplate[] = [
  {
    templateId: 'callback-template:relationship-receipt' as ChatCallbackTemplateId,
    callbackKind: 'RELATIONSHIP',
    narrativeIntent: 'WITNESS',
    payloadKind: 'RELATIONSHIP_CALLBACK',
    preferredTiming: 'FAST_FOLLOW',
    preferredPrivacyClass: 'PRIVATE',
    preferredToneClass: 'CLINICAL',
    bodyHint: 'Relationship memory callback tied to counterpart state shift.',
    notes: ['relationship-receipt'],
  },
  {
    templateId: 'callback-template:quote-receipt' as ChatCallbackTemplateId,
    callbackKind: 'QUOTE',
    narrativeIntent: 'HUMILIATE',
    payloadKind: 'QUOTE_CALLBACK',
    preferredTiming: 'DELAYED',
    preferredPrivacyClass: 'RIVAL_ONLY',
    preferredToneClass: 'MOCKING',
    bodyHint: 'Quote-backed receipt that echoes an earlier boast or claim.',
    notes: ['quote-receipt'],
  },
  {
    templateId: 'callback-template:helper-rescue' as ChatCallbackTemplateId,
    callbackKind: 'RESCUE',
    narrativeIntent: 'RESCUE',
    payloadKind: 'HELPER_RESCUE',
    preferredTiming: 'FAST_FOLLOW',
    preferredPrivacyClass: 'HELPER_ONLY',
    preferredToneClass: 'HELPFUL',
    bodyHint: 'Helper callback that converts trust and rescue debt into guidance.',
    notes: ['helper-rescue'],
  },
  {
    templateId: 'callback-template:memory-default' as ChatCallbackTemplateId,
    callbackKind: 'MEMORY',
    narrativeIntent: 'WITNESS',
    payloadKind: 'SYSTEM_SHADOW_MARKER',
    preferredTiming: 'DELAYED',
    preferredPrivacyClass: 'SHADOW',
    preferredToneClass: 'CLINICAL',
    bodyHint: 'Memory callback fallback.',
    notes: ['memory-default'],
  },
  {
    templateId: 'callback-template:post-run-ritual' as ChatCallbackTemplateId,
    callbackKind: 'POST_RUN',
    narrativeIntent: 'MEMORIALIZE',
    payloadKind: 'POST_RUN_RITUAL',
    preferredTiming: 'POST_RUN',
    preferredPrivacyClass: 'PRIVATE',
    preferredToneClass: 'CEREMONIAL',
    bodyHint: 'Post-run callback for reckoning and authorship.',
    notes: ['post-run-ritual'],
  },
  {
    templateId: 'callback-template:crowd-reaction' as ChatCallbackTemplateId,
    callbackKind: 'SYSTEM_RECEIPT',
    narrativeIntent: 'WITNESS',
    payloadKind: 'CROWD_REACTION',
    preferredTiming: 'FAST_FOLLOW',
    preferredPrivacyClass: 'PUBLIC',
    preferredToneClass: 'MOCKING',
    bodyHint: 'Crowd callback bound to witnessed pressure.',
    notes: ['crowd-reaction'],
  },
];

export const DEFAULT_CHAT_CALLBACK_RULES: readonly ChatCallbackEligibilityRule[] = [
  {
    ruleId: 'callback-rule:privacy' as ChatCallbackRuleId,
    label: 'Privacy gating',
    appliesToKinds: CHAT_CALLBACK_KINDS,
    notes: ['baseline-privacy-check'],
  },
  {
    ruleId: 'callback-rule:quotes-require-quote' as ChatCallbackRuleId,
    label: 'Quote callbacks require a quote join',
    appliesToKinds: ['QUOTE'],
    requiresQuote: true,
    notes: ['quote-join-required'],
  },
  {
    ruleId: 'callback-rule:relationship-requires-relationship' as ChatCallbackRuleId,
    label: 'Relationship callbacks require relationship state',
    appliesToKinds: ['RELATIONSHIP'],
    requiresRelationship: true,
    notes: ['relationship-join-required'],
  },
  {
    ruleId: 'callback-rule:memory-requires-memory' as ChatCallbackRuleId,
    label: 'Memory callbacks require memory candidates',
    appliesToKinds: ['MEMORY'],
    requiresMemory: true,
    notes: ['memory-join-required'],
  },
  {
    ruleId: 'callback-rule:rescue-requires-rescue-join' as ChatCallbackRuleId,
    label: 'Rescue callbacks require rescue context',
    appliesToKinds: ['RESCUE'],
    requiresRescueJoin: true,
    notes: ['rescue-join-required'],
  },
];

export const CHAT_CALLBACK_MODULE_MANIFEST = Object.freeze({
  module: 'ChatCallback',
  schemaVersion: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  primaryExports: [
    'ChatCallbackContext',
    'ChatCallbackCandidate',
    'ChatCallbackPlan',
    'ChatCallbackRecord',
    'ChatCallbackLedgerSnapshot',
  ],
} as const);

export interface CreateChatCallbackCandidateInput {
  readonly callbackKind: ChatCallbackKind;
  readonly narrativeIntent: ChatCallbackNarrativeIntent;
  readonly privacyClass: ChatCallbackPrivacyClass;
  readonly timing: ChatCallbackTiming;
  readonly payloadKind: ChatCallbackGeneratedPayloadKind;
  readonly score01?: number;
  readonly confidence01?: number;
  readonly suppressionReason?: ChatCallbackSuppressionReason;
  readonly selectedTemplateId?: ChatCallbackTemplateId | null;
  readonly relationshipJoin?: ChatCallbackRelationshipJoin | null;
  readonly quoteJoin?: ChatCallbackQuoteJoin | null;
  readonly memoryJoin?: ChatCallbackMemoryJoin | null;
  readonly rescueJoin?: ChatCallbackRescueJoin | null;
  readonly explanation?: readonly string[];
}

export function createChatCallbackCandidate(input: CreateChatCallbackCandidateInput): ChatCallbackCandidate {
  return {
    candidateId: asChatCallbackCandidateId(
      `callback-candidate:${stableFragment(JSON.stringify({
        kind: input.callbackKind,
        intent: input.narrativeIntent,
        privacy: input.privacyClass,
        timing: input.timing,
        payload: input.payloadKind,
      }))}`,
    ),
    callbackKind: input.callbackKind,
    narrativeIntent: input.narrativeIntent,
    privacyClass: input.privacyClass,
    timing: input.timing,
    payloadKind: input.payloadKind,
    score01: asScore01(input.score01 ?? 0.5),
    confidence01: asScore01(input.confidence01 ?? 0.5),
    suppressionReason: input.suppressionReason ?? 'NONE',
    selectedTemplateId: input.selectedTemplateId ?? null,
    relationshipJoin: input.relationshipJoin ?? null,
    quoteJoin: input.quoteJoin ?? null,
    memoryJoin: input.memoryJoin ?? null,
    rescueJoin: input.rescueJoin ?? null,
    explanation: input.explanation ?? [],
  };
}

export function createChatCallbackPlan(
  requestId: ChatRequestId,
  selectedCandidate: ChatCallbackCandidate,
  channelId?: ChatChannelId | null,
): ChatCallbackPlan {
  const createdAt = asUnixMs(Date.now());
  return {
    planId: asChatCallbackPlanId(`callback-plan:${stableFragment(`${requestId}|${selectedCandidate.candidateId}`)}`),
    createdAt,
    requestId,
    selectedCandidate,
    beats: buildDefaultPlanBeats(selectedCandidate, channelId),
    allowComposerDuringPlan: selectedCandidate.timing !== 'IMMEDIATE',
    canBeSuppressedBySilenceWindow: selectedCandidate.timing !== 'POST_RUN',
    canBeOverriddenByAuthoritativeEvent: true,
    notes: ['default-plan'],
  };
}

export function createEmptyChatCallbackLedgerSnapshot(
  ledgerId: ChatCallbackLedgerId,
): ChatCallbackLedgerSnapshot {
  return {
    ledgerId,
    createdAt: asUnixMs(Date.now()),
    updatedAt: asUnixMs(Date.now()),
    callbacks: [],
    countsByKind: createCallbackKindCountSeed(),
    countsByLifecycle: createCallbackLifecycleCountSeed(),
    countsBySuppression: createCallbackSuppressionCountSeed(),
  };
}

export interface ChatCallbackSelectionInput {
  readonly context: ChatCallbackContext;
  readonly relationshipJoin?: ChatCallbackRelationshipJoin | null;
  readonly quoteJoin?: ChatCallbackQuoteJoin | null;
  readonly memoryJoin?: ChatCallbackMemoryJoin | null;
  readonly rescueJoin?: ChatCallbackRescueJoin | null;
  readonly rules?: readonly ChatCallbackEligibilityRule[];
  readonly templates?: readonly ChatCallbackTemplate[];
}

export function selectChatCallbackCandidates(input: ChatCallbackSelectionInput): ChatCallbackSelectionResponse {
  const templates = input.templates ?? DEFAULT_CHAT_CALLBACK_TEMPLATES;
  const rules = input.rules ?? DEFAULT_CHAT_CALLBACK_RULES;
  const candidates: ChatCallbackCandidate[] = [];

  if (input.context.allowRelationshipReuse && input.relationshipJoin?.callbackHints.length) {
    candidates.push(createRelationshipCallbackCandidate(input.context, input.relationshipJoin, templates));
  }
  if (input.context.allowQuoteReuse && input.quoteJoin?.candidateQuotes.length) {
    candidates.push(createQuoteCallbackCandidate(input.context, input.quoteJoin, templates));
  }
  if (input.context.allowMemoryReuse && input.memoryJoin?.candidateMemories.length) {
    candidates.push(createMemoryCallbackCandidate(input.context, input.memoryJoin, templates));
  }
  if (input.rescueJoin && shouldEmitRescueCandidate(input.context, input.rescueJoin)) {
    candidates.push(createRescueCallbackCandidate(input.context, input.rescueJoin, templates));
  }

  const afterRules = candidates.map((candidate) => applyCallbackRules(candidate, input.context, rules));
  const ranked = afterRules
    .map((candidate) => ({
      ...candidate,
      score01: asScore01(scoreCallbackCandidate(candidate, input.context)),
    }))
    .sort((a, b) => Number(b.score01) - Number(a.score01));

  const selected = ranked.find((candidate) => candidate.suppressionReason === 'NONE') ?? null;
  return {
    requestId: input.context.requestId,
    createdAt: input.context.createdAt,
    candidates: ranked,
    selectedCandidateId: selected?.candidateId ?? null,
    silentOutcome: !selected,
    silentReason: selected ? null : ranked[0]?.suppressionReason ?? 'LOW_CONFIDENCE',
  };
}

export function createRelationshipCallbackCandidate(
  context: ChatCallbackContext,
  relationshipJoin: ChatCallbackRelationshipJoin,
  templates: readonly ChatCallbackTemplate[],
): ChatCallbackCandidate {
  const topHint = relationshipJoin.callbackHints[0];
  const template = templates.find((entry) => entry.callbackKind === 'RELATIONSHIP') ?? DEFAULT_CHAT_CALLBACK_TEMPLATES[0];
  const score =
    0.35 +
    (relationshipJoin.counterpartState?.intensity01 ?? 0) * 0.18 +
    (relationshipJoin.counterpartState?.vector.unfinishedBusiness01 ?? 0) * 0.18 +
    (topHint?.weight01 ?? 0) * 0.18;

  return createChatCallbackCandidate({
    callbackKind: 'RELATIONSHIP',
    narrativeIntent: deriveNarrativeIntentFromRelationship(relationshipJoin.counterpartState),
    privacyClass: derivePrivacyClassFromContext(context, 'RELATIONSHIP'),
    timing: deriveTimingFromContext(context, 'RELATIONSHIP'),
    payloadKind: 'RELATIONSHIP_CALLBACK',
    score01: score,
    confidence01: 0.68,
    selectedTemplateId: template.templateId,
    relationshipJoin,
    explanation: [
      'relationship-join-present',
      relationshipJoin.counterpartState ? 'counterpart-state-present' : 'counterpart-state-missing',
      topHint ? 'relationship-callback-hint-present' : 'no-top-hint',
    ],
  });
}

export function createQuoteCallbackCandidate(
  context: ChatCallbackContext,
  quoteJoin: ChatCallbackQuoteJoin,
  templates: readonly ChatCallbackTemplate[],
): ChatCallbackCandidate {
  const selectedQuote = quoteJoin.primaryQuote ?? quoteJoin.candidateQuotes[0] ?? null;
  const template = templates.find((entry) => entry.callbackKind === 'QUOTE') ?? DEFAULT_CHAT_CALLBACK_TEMPLATES[1];
  const humiliationBias = selectedQuote?.semanticMarkers.embarrassment01 ?? 0;
  const trustBias = selectedQuote?.semanticMarkers.trustSignal01 ?? 0;
  const score = 0.34 + humiliationBias * 0.24 + trustBias * 0.06;

  return createChatCallbackCandidate({
    callbackKind: 'QUOTE',
    narrativeIntent: humiliationBias >= trustBias ? 'HUMILIATE' : 'GUIDE',
    privacyClass: derivePrivacyClassFromQuote(context, selectedQuote),
    timing: deriveTimingFromContext(context, 'QUOTE'),
    payloadKind: 'QUOTE_CALLBACK',
    score01: score,
    confidence01: 0.74,
    selectedTemplateId: template.templateId,
    quoteJoin,
    explanation: [
      selectedQuote ? 'selected-quote-present' : 'selected-quote-missing',
      humiliationBias >= 0.6 ? 'humiliation-bias-high' : 'humiliation-bias-normal',
      trustBias >= 0.6 ? 'trust-bias-high' : 'trust-bias-normal',
    ],
  });
}

export function createMemoryCallbackCandidate(
  context: ChatCallbackContext,
  memoryJoin: ChatCallbackMemoryJoin,
  templates: readonly ChatCallbackTemplate[],
): ChatCallbackCandidate {
  const top = memoryJoin.candidateMemories[0];
  const template = templates.find((entry) => entry.callbackKind === 'MEMORY') ?? DEFAULT_CHAT_CALLBACK_TEMPLATES[3];
  const score = 0.28 + (top?.score01 ?? 0) * 0.35 + (top?.salience01 ?? 0) * 0.15;

  return createChatCallbackCandidate({
    callbackKind: 'MEMORY',
    narrativeIntent: deriveNarrativeIntentFromMemory(memoryJoin.memoryEventType),
    privacyClass: derivePrivacyClassFromContext(context, 'MEMORY'),
    timing: deriveTimingFromContext(context, 'MEMORY'),
    payloadKind: template.payloadKind,
    score01: score,
    confidence01: 0.66,
    selectedTemplateId: template.templateId,
    memoryJoin,
    explanation: [
      top ? 'memory-candidate-present' : 'memory-candidate-missing',
      memoryJoin.memoryEventType ? `memory-event:${memoryJoin.memoryEventType}` : 'memory-event:unset',
    ],
  });
}

export function createRescueCallbackCandidate(
  context: ChatCallbackContext,
  rescueJoin: ChatCallbackRescueJoin,
  templates: readonly ChatCallbackTemplate[],
): ChatCallbackCandidate {
  const template = templates.find((entry) => entry.callbackKind === 'RESCUE') ?? DEFAULT_CHAT_CALLBACK_TEMPLATES[2];
  const score =
    0.3 +
    (rescueJoin.frustration01 ?? 0) * 0.17 +
    (rescueJoin.trustNeed01 ?? 0) * 0.2 +
    (rescueJoin.attachment01 ?? 0) * 0.08;

  return createChatCallbackCandidate({
    callbackKind: 'RESCUE',
    narrativeIntent: 'RESCUE',
    privacyClass: 'HELPER_ONLY',
    timing: context.momentType === 'RUN_END' ? 'POST_SCENE' : 'FAST_FOLLOW',
    payloadKind: 'HELPER_RESCUE',
    score01: score,
    confidence01: 0.82,
    selectedTemplateId: template.templateId,
    rescueJoin,
    explanation: [
      'rescue-join-present',
      rescueJoin.frustration01 && rescueJoin.frustration01 >= 0.7 ? 'frustration-high' : 'frustration-normal',
      rescueJoin.trustNeed01 && rescueJoin.trustNeed01 >= 0.6 ? 'trust-need-high' : 'trust-need-normal',
    ],
  });
}

export function applyCallbackRules(
  candidate: ChatCallbackCandidate,
  context: ChatCallbackContext,
  rules: readonly ChatCallbackEligibilityRule[],
): ChatCallbackCandidate {
  let suppression: ChatCallbackSuppressionReason = candidate.suppressionReason;
  for (const rule of rules) {
    if (!rule.appliesToKinds.includes(candidate.callbackKind)) continue;
    if (rule.allowedPrivacyClasses?.length && !rule.allowedPrivacyClasses.includes(candidate.privacyClass)) {
      suppression = 'PRIVACY_MISMATCH';
      break;
    }
    if (rule.allowedChannels?.length && context.channelId && !rule.allowedChannels.includes(context.channelId)) {
      suppression = 'AUTHORITATIVE_OVERRIDE';
      break;
    }
    if (rule.requiredTags?.length) {
      for (const tag of rule.requiredTags) {
        if (!context.tags.includes(tag)) {
          suppression = 'LOW_CONFIDENCE';
          break;
        }
      }
    }
    if (suppression !== 'NONE') break;
    if (rule.bannedTags?.length) {
      for (const tag of rule.bannedTags) {
        if (context.tags.includes(tag)) {
          suppression = 'AUTHORITATIVE_OVERRIDE';
          break;
        }
      }
    }
    if (suppression !== 'NONE') break;
    if (rule.requiresQuote && !candidate.quoteJoin?.candidateQuotes.length) {
      suppression = 'LOW_CONFIDENCE';
      break;
    }
    if (rule.requiresRelationship && !candidate.relationshipJoin?.counterpartState) {
      suppression = 'LOW_CONFIDENCE';
      break;
    }
    if (rule.requiresMemory && !candidate.memoryJoin?.candidateMemories.length) {
      suppression = 'LOW_CONFIDENCE';
      break;
    }
    if (rule.requiresRescueJoin && !candidate.rescueJoin) {
      suppression = 'LOW_CONFIDENCE';
      break;
    }
    if (typeof rule.minScore01 === 'number' && Number(candidate.score01) < rule.minScore01) {
      suppression = 'LOW_CONFIDENCE';
      break;
    }
  }
  if (context.allowSilentOutcome && context.tags.includes('SILENCE_WINDOW')) suppression = 'SILENCE_WINDOW';
  return { ...candidate, suppressionReason: suppression };
}

export function scoreCallbackCandidate(candidate: ChatCallbackCandidate, context: ChatCallbackContext): number {
  let score = Number(candidate.score01);
  if (candidate.suppressionReason !== 'NONE') score -= 0.35;
  if (candidate.privacyClass === context.privacyClass) score += 0.06;
  if (context.requestedIntent && matchesNarrativeIntent(candidate, context.requestedIntent)) score += 0.08;
  if (context.privacyClass === 'HELPER_ONLY' && candidate.callbackKind === 'RESCUE') score += 0.06;
  if (context.useIntent === 'RECEIPT' && candidate.callbackKind === 'QUOTE') score += 0.08;
  if (context.momentType === 'RUN_END' && candidate.narrativeIntent === 'MEMORIALIZE') score += 0.07;
  return clamp01(score);
}

export function matchesNarrativeIntent(
  candidate: ChatCallbackCandidate,
  intent: ChatCallbackNarrativeIntent,
): boolean {
  if (candidate.narrativeIntent === intent) return true;
  if (intent === 'WARN' && candidate.narrativeIntent === 'GUIDE') return true;
  if (intent === 'ESCALATE' && candidate.narrativeIntent === 'HUMILIATE') return true;
  if (intent === 'DE_ESCALATE' && candidate.narrativeIntent === 'RESCUE') return true;
  return false;
}

export function buildDefaultPlanBeats(
  candidate: ChatCallbackCandidate,
  channelId?: ChatChannelId | null,
): readonly ChatCallbackPlanBeat[] {
  const primaryDelayMs =
    candidate.timing === 'IMMEDIATE'
      ? 0
      : candidate.timing === 'FAST_FOLLOW'
        ? 800
        : candidate.timing === 'DELAYED'
          ? 2200
          : candidate.timing === 'POST_SCENE'
            ? 4000
            : candidate.timing === 'POST_RUN'
              ? 6000
              : candidate.timing === 'REVEAL_WINDOW'
                ? 3000
                : 0;

  return [{
    beatIndex: 0,
    timing: candidate.timing,
    payloadKind: candidate.payloadKind,
    delayMs: primaryDelayMs,
    channelId: channelId ?? null,
    privacyClass: candidate.privacyClass,
    callbackId: null,
    relatedMessageId: null,
    notes: ['primary-beat'],
  }];
}

export function createCallbackKindCountSeed(): Readonly<Record<ChatCallbackKind, number>> {
  return {
    RELATIONSHIP: 0,
    QUOTE: 0,
    MEMORY: 0,
    RESCUE: 0,
    NEGOTIATION: 0,
    SCENE_REVEAL: 0,
    POST_RUN: 0,
    LEGEND: 0,
    WORLD_EVENT: 0,
    SYSTEM_RECEIPT: 0,
  };
}

export function createCallbackLifecycleCountSeed(): Readonly<Record<ChatCallbackLifecycleState, number>> {
  return {
    PENDING: 0,
    PLANNED: 0,
    SUPPRESSED: 0,
    EMITTED: 0,
    SPENT: 0,
    ARCHIVED: 0,
    CANCELLED: 0,
  };
}

export function createCallbackSuppressionCountSeed(): Readonly<Record<ChatCallbackSuppressionReason, number>> {
  return {
    NONE: 0,
    SILENCE_WINDOW: 0,
    DUPLICATE_FACT: 0,
    PRIVACY_MISMATCH: 0,
    REDACTION: 0,
    LOW_CONFIDENCE: 0,
    COOLDOWN: 0,
    AUTHORITATIVE_OVERRIDE: 0,
    HELPER_WAITING: 0,
    RIVAL_HOLDING: 0,
  };
}

export function countCallbacksByKind(callbacks: readonly ChatCallbackRecord[]): Readonly<Record<ChatCallbackKind, number>> {
  const out: Record<ChatCallbackKind, number> = { ...createCallbackKindCountSeed() };
  for (const callback of callbacks) out[callback.selectedCandidate.callbackKind] += 1;
  return out;
}

export function countCallbacksByLifecycle(
  callbacks: readonly ChatCallbackRecord[],
): Readonly<Record<ChatCallbackLifecycleState, number>> {
  const out: Record<ChatCallbackLifecycleState, number> = { ...createCallbackLifecycleCountSeed() };
  for (const callback of callbacks) out[callback.lifecycleState] += 1;
  return out;
}

export function countCallbacksBySuppression(
  callbacks: readonly ChatCallbackRecord[],
): Readonly<Record<ChatCallbackSuppressionReason, number>> {
  const out: Record<ChatCallbackSuppressionReason, number> = { ...createCallbackSuppressionCountSeed() };
  for (const callback of callbacks) out[callback.suppressionReason] += 1;
  return out;
}

export function buildChatCallbackLedgerSnapshot(
  ledgerId: ChatCallbackLedgerId,
  callbacks: readonly ChatCallbackRecord[],
): ChatCallbackLedgerSnapshot {
  return {
    ledgerId,
    createdAt: callbacks[0]?.createdAt ?? asUnixMs(Date.now()),
    updatedAt: asUnixMs(Date.now()),
    callbacks,
    countsByKind: countCallbacksByKind(callbacks),
    countsByLifecycle: countCallbacksByLifecycle(callbacks),
    countsBySuppression: countCallbacksBySuppression(callbacks),
  };
}

export function isChatCallbackRecord(value: unknown): value is ChatCallbackRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ChatCallbackRecord>;
  return (
    typeof v.callbackId === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number' &&
    typeof v.lifecycleState === 'string' &&
    !!v.context &&
    !!v.selectedCandidate
  );
}

export function deriveNarrativeIntentFromRelationship(
  state?: ChatRelationshipCounterpartState | null,
): ChatCallbackNarrativeIntent {
  if (!state) return 'WITNESS';
  if (state.objective === 'RESCUE') return 'RESCUE';
  if (state.objective === 'NEGOTIATE' || state.objective === 'REPRICE') return 'REPRICE';
  if (state.stance === 'OBSESSED' || state.stance === 'HUNTING') return 'ESCALATE';
  if (state.stance === 'PROTECTIVE') return 'GUIDE';
  if (state.stance === 'WOUNDED') return 'INTERPRET';
  return 'WITNESS';
}

export function deriveNarrativeIntentFromMemory(
  eventType?: EpisodicMemoryEventType | null,
): ChatCallbackNarrativeIntent {
  switch (eventType) {
    case 'HUMILIATION':
      return 'HUMILIATE';
    case 'COMEBACK':
      return 'MEMORIALIZE';
    case 'COLLAPSE':
      return 'INTERPRET';
    case 'RESCUE':
      return 'RESCUE';
    case 'DEAL_ROOM_STANDOFF':
      return 'REPRICE';
    case 'SOVEREIGNTY':
      return 'MEMORIALIZE';
    default:
      return 'WITNESS';
  }
}

export function derivePrivacyClassFromContext(
  context: ChatCallbackContext,
  kind: ChatCallbackKind,
): ChatCallbackPrivacyClass {
  if (kind === 'RESCUE') return 'HELPER_ONLY';
  if (kind === 'RELATIONSHIP' && context.privacyClass === 'PUBLIC') return 'PRIVATE';
  return context.privacyClass;
}

export function derivePrivacyClassFromQuote(
  context: ChatCallbackContext,
  quote?: ChatQuoteRecord | null,
): ChatCallbackPrivacyClass {
  if (!quote) return context.privacyClass;
  if (quote.context.witnessClass === 'HELPER_ONLY') return 'HELPER_ONLY';
  if (quote.context.witnessClass === 'RIVAL_ONLY') return 'RIVAL_ONLY';
  if (quote.context.witnessClass === 'SHADOW') return 'SHADOW';
  if (!quote.redaction.allowPublicReuse) return 'PRIVATE';
  return context.privacyClass;
}

export function deriveTimingFromContext(
  context: ChatCallbackContext,
  kind: ChatCallbackKind,
): ChatCallbackTiming {
  if (context.momentType === 'RUN_END') return kind === 'RESCUE' ? 'POST_SCENE' : 'POST_RUN';
  if (context.tags.includes('REVEAL_WINDOW')) return 'REVEAL_WINDOW';
  if (context.tags.includes('SILENCE_WINDOW')) return 'SILENT';
  return kind === 'RESCUE' ? 'FAST_FOLLOW' : 'DELAYED';
}

export function shouldEmitRescueCandidate(
  context: ChatCallbackContext,
  rescueJoin: ChatCallbackRescueJoin,
): boolean {
  if (!context.allowRelationshipReuse && !context.allowMemoryReuse) return false;
  return (
    (rescueJoin.frustration01 ?? 0) >= 0.58 ||
    (rescueJoin.trustNeed01 ?? 0) >= 0.55 ||
    (rescueJoin.rescueDebt01 ?? 0) >= 0.5
  );
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

export function asScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

export function asUnixMs(value: number): UnixMs {
  return Math.trunc(value) as UnixMs;
}

export function asChatCallbackId(value: string): ChatCallbackId {
  return value as ChatCallbackId;
}

export function asChatCallbackPlanId(value: string): ChatCallbackPlanId {
  return value as ChatCallbackPlanId;
}

export function asChatCallbackCandidateId(value: string): ChatCallbackCandidateId {
  return value as ChatCallbackCandidateId;
}

export function stableFragment(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, '0');
}