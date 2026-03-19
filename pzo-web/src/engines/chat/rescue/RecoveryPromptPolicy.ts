/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT RECOVERY PROMPT POLICY
 * FILE: pzo-web/src/engines/chat/rescue/RecoveryPromptPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Builds recovery prompts, option stacks, banner copy, and outcome scoring for
 * rescue windows created by the frontend chat runtime.
 *
 * This policy layer is intentionally separate from interception and banner state:
 * - RageQuitInterceptor decides whether rescue is needed.
 * - RecoveryPromptPolicy decides what recovery should look and feel like.
 * - RescueBannerBridge stages the chosen recovery into live chat/UI state.
 *
 * Design doctrine
 * ---------------
 * - Recovery copy must respect dignity first, then clarity.
 * - The player should receive one next move before three explanations.
 * - Recovery should scale with embarrassment, not just failure count.
 * - Deal-room recovery is fundamentally different from global-channel recovery.
 * - Post-collapse recovery should sound authored, not algorithmic.
 * ============================================================================
 */

import {
  buildRecoveryBundle,
  buildRecoveryPlan,
  createRecoveryOutcome,
  deriveRecoveryDifficulty,
  deriveRecoveryEntryPoint,
  deriveRecoveryLiftSnapshot,
  deriveRecoverySuccessBand,
  type ChatRecoveryBundle,
  type ChatRecoveryDifficultyBand,
  type ChatRecoveryEntryPoint,
  type ChatRecoveryKind,
  type ChatRecoveryOption,
  type ChatRecoveryOutcome,
  type ChatRecoveryOutcomeKind,
  type ChatRecoveryPace,
  type ChatRecoveryPlan,
  type ChatRecoverySuggestion,
  type ChatRecoverySuccessBand,
  type ChatRecoveryVisibility,
} from '../../../../shared/contracts/chat/ChatRecovery';
import type {
  ChatRescueAction,
  ChatRescueHelperPosture,
  ChatRescueOffer,
  ChatRescuePlan,
  ChatRescueStyle,
  ChatRescueUrgencyBand,
} from '../../../../shared/contracts/chat/ChatRescue';
import type {
  ChatAffectSnapshot,
  ChatLearningProfile,
  ChatVisibleChannel,
  JsonObject,
  Score100,
  UnixMs,
} from '../types';

export interface RecoveryPromptContext {
  readonly now: UnixMs;
  readonly visibleChannel: ChatVisibleChannel;
  readonly affect: ChatAffectSnapshot;
  readonly learning: ChatLearningProfile;
  readonly rescuePlan?: ChatRescuePlan | null;
  readonly selectedOffer?: ChatRescueOffer | null;
  readonly helperPosture: ChatRescueHelperPosture;
  readonly recentCollapse?: boolean;
  readonly inDealRoom?: boolean;
  readonly counterWindowOpen?: boolean;
  readonly notes?: readonly string[];
}

export interface RecoveryPromptProjection {
  readonly plan: ChatRecoveryPlan;
  readonly bannerTitle: string;
  readonly bannerBody: string;
  readonly helperLine: string;
  readonly quickActions: readonly RecoveryQuickAction[];
  readonly suggestedMode: 'INLINE' | 'BANNER' | 'SIDECARD' | 'MODAL';
  readonly suppressCrowd: boolean;
  readonly notes: readonly string[];
}

export interface RecoveryQuickAction {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly destructive: boolean;
  readonly recommended: boolean;
  readonly payload?: JsonObject;
}

export interface RecoveryResolutionInput {
  readonly at: UnixMs;
  readonly plan: ChatRecoveryPlan;
  readonly acceptedOptionId?: string | null;
  readonly affectBefore: ChatAffectSnapshot;
  readonly affectAfter?: Partial<ChatAffectSnapshot> | null;
  readonly rescueAccepted?: boolean;
  readonly helperAccepted?: boolean;
  readonly timedOut?: boolean;
  readonly dismissed?: boolean;
}

export interface RecoveryPromptPolicyOptions {
  readonly helperNames?: Partial<Record<ChatRescueHelperPosture | 'DEFAULT', string>>;
  readonly crisisThreshold?: Score100;
  readonly modalThreshold?: Score100;
}

const DEFAULT_OPTIONS: Required<RecoveryPromptPolicyOptions> = {
  helperNames: {},
  crisisThreshold: 82 as Score100,
  modalThreshold: 72 as Score100,
};

const DEFAULT_HELPER_NAMES: Record<ChatRescueHelperPosture | 'DEFAULT', string> = {
  NONE: 'System',
  READY: 'Kade',
  ACTIVE: 'Kade',
  ESCALATED: 'Nyra',
  SHADOWING: 'Observer',
  DEFAULT: 'Kade',
};

const TITLE_BY_KIND: Readonly<Record<ChatRecoveryKind, string>> = {
  ONE_CARD_RESET: 'Reset with one clean move',
  SHIELD_STABILIZE: 'Stabilize before the next hit',
  CROWD_COOLDOWN: 'Lower exposure and breathe',
  NEGOTIATION_EXIT: 'Exit the deal room with leverage intact',
  HELPER_GUIDED_REENTRY: 'Re-enter with a guide, not with panic',
  SILENT_RECENTER: 'Take the quiet lane and reset focus',
  QUICK_WIN_PATH: 'Choose the quickest safe win',
  RETRY_WITH_CONTEXT: 'Retry with context, not instinct',
  POST_COLLAPSE_DEBRIEF: 'Name the break, then rebuild',
  LEGEND_SALVAGE: 'Salvage the moment into a receipt',
};

const BODY_BY_KIND: Readonly<Record<ChatRecoveryKind, string>> = {
  ONE_CARD_RESET: 'You do not need a full speech here. You need one clean, low-friction move.',
  SHIELD_STABILIZE: 'Take one stabilizing action before you expose yourself to another public hit.',
  CROWD_COOLDOWN: 'Reduce crowd pressure first. Visibility is part of the problem now.',
  NEGOTIATION_EXIT: 'Leave the deal room in a controlled way. Dignity is part of the recovery.',
  HELPER_GUIDED_REENTRY: 'Let the helper lead the first step so you do not spend more confidence than necessary.',
  SILENT_RECENTER: 'Silence is allowed here. Reset first, then speak with intent.',
  QUICK_WIN_PATH: 'The recovery path is not dramatic. It is efficient.',
  RETRY_WITH_CONTEXT: 'Retry only after the situation is readable again.',
  POST_COLLAPSE_DEBRIEF: 'Name the turning point, reduce shame, and restart on purpose.',
  LEGEND_SALVAGE: 'Even a broken moment can be salvaged into a controlled finish.',
};

const HELPER_LINES: Readonly<Record<ChatRescueHelperPosture, readonly string[]>> = {
  NONE: [
    'System: Recover the lane before you re-enter it.',
    'System: Slow the next move down and regain readability.',
  ],
  READY: [
    'Kade: One move. Not ten. Take the clean one.',
    'Kade: I can give you a path. You still have to take it.',
    'Kade: Reset first. Pride later.',
  ],
  ACTIVE: [
    'Kade: Stay with me for one step. Then the lane opens again.',
    'Kade: I am narrowing this on purpose so you do not spend more than you need.',
    'Kade: Good. Breathe. Take the stabilizer, then re-enter.',
  ],
  ESCALATED: [
    'Nyra: You do not have time for shame right now. Choose the stabilizer.',
    'Nyra: Crowd noise is irrelevant. Execute the recovery path.',
    'Nyra: We are past comfort. We are in containment.',
  ],
  SHADOWING: [
    'Observer: Quiet is available. Use it before the next public mistake.',
    'Observer: The lane can be narrowed. Say less. Choose better.',
  ],
};

const MODE_BY_VISIBILITY: Readonly<Record<ChatRecoveryVisibility, RecoveryPromptProjection['suggestedMode']>> = {
  PRIVATE: 'SIDECARD',
  SEMI_PRIVATE: 'BANNER',
  PUBLIC: 'INLINE',
};

const ENTRYPOINT_NOTES: Readonly<Record<ChatRecoveryEntryPoint, readonly string[]>> = {
  POST_COLLAPSE: ['Collapse has narrative weight.', 'Give the player a turning-point frame.'],
  NEGOTIATION_ESCAPE: ['Protect reputation during exit.', 'Do not leak panic into global.'],
  BOSS_WINDOW_ESCAPE: ['Counter readability matters more than speech volume.'],
  PASSIVE_RECOVERY: ['Do not overtalk a passive recovery.'],
  HELPER_GUIDE: ['Helper can be visible here.'],
  DEFAULT: ['Keep copy compact.'],
};

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp100(value: number): Score100 {
  if (value <= 0) return 0 as Score100;
  if (value >= 100) return 100 as Score100;
  return Math.round(value) as Score100;
}

function pickHelperLine(posture: ChatRescueHelperPosture, indexSeed: number): string {
  const lines = HELPER_LINES[posture] ?? HELPER_LINES.READY;
  return lines[indexSeed % lines.length];
}

function selectSuggestedMode(
  visibility: ChatRecoveryVisibility,
  embarrassment: Score100,
  modalThreshold: Score100,
): RecoveryPromptProjection['suggestedMode'] {
  if (Number(embarrassment) >= Number(modalThreshold)) return 'MODAL';
  return MODE_BY_VISIBILITY[visibility];
}

function toQuickAction(option: ChatRecoveryOption, recommended = false): RecoveryQuickAction {
  return {
    id: String(option.optionId),
    label: option.label,
    detail: option.detail,
    destructive: option.visibility === 'PUBLIC' && option.requiresHelper === false,
    recommended,
    payload: option.payload,
  };
}

export class RecoveryPromptPolicy {
  private readonly options: Required<RecoveryPromptPolicyOptions>;
  private readonly helperNames: Record<ChatRescueHelperPosture | 'DEFAULT', string>;

  public constructor(options: RecoveryPromptPolicyOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      helperNames: options.helperNames ?? {},
    };
    this.helperNames = {
      ...DEFAULT_HELPER_NAMES,
      ...(options.helperNames ?? {}),
    };
  }

  public build(context: RecoveryPromptContext): RecoveryPromptProjection {
    const plan = buildRecoveryPlan({
      roomId: (context.rescuePlan?.roomId ?? 'room:recovery') as never,
      visibleChannel: context.visibleChannel,
      sessionId: (context.rescuePlan?.sessionId ?? null) as never,
      requestId: (context.rescuePlan?.requestId ?? null) as never,
      sceneId: (context.rescuePlan?.sceneId ?? null) as never,
      momentId: (context.rescuePlan?.momentId ?? null) as never,
      bossFightId: (context.rescuePlan?.bossFightId ?? null) as never,
      rescuePlan: context.rescuePlan ?? null,
      rescueOutcome: context.rescuePlan?.state ?? null,
      helperPosture: context.helperPosture,
      affect: context.affect,
      learning: context.learning,
      inDealRoom: context.inDealRoom,
      recentCollapse: context.recentCollapse,
      counterWindowId: context.counterWindowOpen ? (('counter:open' as never)) : null,
      now: context.now,
    });

    const suggestion = this.buildSuggestion(plan, context);
    const helperLabel = context.rescuePlan?.helperActor?.displayName ?? this.helperNames[context.helperPosture] ?? this.helperNames.DEFAULT;
    const helperLine = `${helperLabel}: ${pickHelperLine(context.helperPosture, Number(context.now) % 7)}`;

    const primary = plan.bundle.options[0] ?? this.buildFallbackOption(plan.kind, plan.entryPoint, context.visibleChannel, context.now);
    const quickActions = [
      toQuickAction(primary, true),
      ...plan.bundle.options.slice(1, 3).map((option) => toQuickAction(option, false)),
    ];

    const visibility = plan.bundle.visibility;
    const suggestedMode = selectSuggestedMode(visibility, context.affect.socialEmbarrassment, this.options.modalThreshold);
    const title = TITLE_BY_KIND[plan.kind] ?? suggestion.promptTitle;
    const body = this.buildBody(plan, context, suggestion);

    return {
      plan: {
        ...plan,
        bundle: {
          ...plan.bundle,
          suggestion,
        },
      },
      bannerTitle: title,
      bannerBody: body,
      helperLine,
      quickActions,
      suggestedMode,
      suppressCrowd: context.visibleChannel === 'GLOBAL' || Number(context.affect.socialEmbarrassment) >= 66,
      notes: [
        ...(ENTRYPOINT_NOTES[plan.entryPoint] ?? []),
        ...(context.notes ?? []),
        `difficulty=${deriveRecoveryDifficulty({
          confidence: context.affect.confidence,
          frustration: context.affect.frustration,
          embarrassment: context.affect.socialEmbarrassment,
          desperation: context.affect.desperation,
          helperReceptivity: context.learning.helperReceptivity,
        })}`,
      ],
    };
  }

  public resolve(input: RecoveryResolutionInput): ChatRecoveryOutcome {
    const before = input.affectBefore;
    const after = {
      confidence: safeNumber(input.affectAfter?.confidence, Number(before.confidence) + (input.rescueAccepted ? 10 : 2)),
      frustration: safeNumber(input.affectAfter?.frustration, Number(before.frustration) - (input.rescueAccepted ? 14 : 4)),
      socialEmbarrassment: safeNumber(input.affectAfter?.socialEmbarrassment, Number(before.socialEmbarrassment) - (input.dismissed ? 1 : 8)),
      trust: safeNumber(input.affectAfter?.trust, Number(before.trust) + (input.helperAccepted ? 10 : 4)),
      desperation: safeNumber(input.affectAfter?.desperation, Number(before.desperation) - (input.timedOut ? 1 : 7)),
      relief: safeNumber(input.affectAfter?.relief, Number(before.relief) + (input.rescueAccepted ? 14 : 3)),
    };

    const stabilityLift01 = Math.max(0, Math.min(1, ((after.confidence - Number(before.confidence)) + (Number(before.frustration) - after.frustration)) / 200));
    const embarrassmentReduction01 = Math.max(0, Math.min(1, (Number(before.socialEmbarrassment) - after.socialEmbarrassment) / 100));
    const confidenceLift01 = Math.max(0, Math.min(1, (after.confidence - Number(before.confidence)) / 100));
    const trustLift01 = Math.max(0, Math.min(1, (after.trust - Number(before.trust)) / 100));

    const outcomeKind: ChatRecoveryOutcomeKind =
      input.dismissed ? 'DISMISSED' :
      input.timedOut ? 'TIMED_OUT' :
      input.acceptedOptionId ? 'COMPLETED' : 'SOFT_SUCCESS';

    const successBand: ChatRecoverySuccessBand = deriveRecoverySuccessBand({
      stabilityLift01: stabilityLift01 as never,
      embarrassmentReduction01: embarrassmentReduction01 as never,
      confidenceLift01: confidenceLift01 as never,
      trustLift01: trustLift01 as never,
    });

    return createRecoveryOutcome({
      recoveryId: input.plan.recoveryId,
      kind: outcomeKind,
      successBand,
      acceptedOptionId: (input.acceptedOptionId ?? null) as never,
      stabilityLift01: stabilityLift01 as never,
      embarrassmentReduction01: embarrassmentReduction01 as never,
      confidenceLift01: confidenceLift01 as never,
      trustLift01: trustLift01 as never,
      updatedAt: input.at,
      notes: [
        `entry-point=${input.plan.entryPoint}`,
        `plan-kind=${input.plan.kind}`,
      ],
    });
  }

  public projectQuickActions(plan: ChatRecoveryPlan): readonly RecoveryQuickAction[] {
    return plan.bundle.options.map((option, index) => toQuickAction(option, index === 0));
  }

  public scoreProjection(plan: ChatRecoveryPlan, affect: ChatAffectSnapshot): Score100 {
    const difficulty = deriveRecoveryDifficulty({
      confidence: affect.confidence,
      frustration: affect.frustration,
      embarrassment: affect.socialEmbarrassment,
      desperation: affect.desperation,
      helperReceptivity: 50 as Score100,
    });
    const difficultyWeight =
      difficulty === 'LAST_CHANCE' ? 92 :
      difficulty === 'HIGH_FRICTION' ? 78 :
      difficulty === 'RECOVERABLE' ? 64 :
      difficulty === 'CONTROLLED' ? 48 : 32;
    const bundleDepth = Math.min(12, plan.bundle.options.length * 4);
    return clamp100(difficultyWeight + bundleDepth);
  }

  private buildBody(
    plan: ChatRecoveryPlan,
    context: RecoveryPromptContext,
    suggestion: ChatRecoverySuggestion,
  ): string {
    const base = BODY_BY_KIND[plan.kind] ?? suggestion.promptBody;
    const offerHint = context.selectedOffer?.prompt?.suggestedActionLabel
      ? ` Start with “${context.selectedOffer.prompt.suggestedActionLabel}.”`
      : '';
    const dealHint = context.inDealRoom ? ' Keep it quiet and controlled.' : '';
    const collapseHint = context.recentCollapse ? ' The last break is not the next move.' : '';
    return `${base}${offerHint}${dealHint}${collapseHint}`.trim();
  }

  private buildSuggestion(
    plan: ChatRecoveryPlan,
    context: RecoveryPromptContext,
  ): ChatRecoverySuggestion {
    const primary = plan.bundle.options[0];
    const title = TITLE_BY_KIND[plan.kind] ?? 'Recover the lane';
    const body = BODY_BY_KIND[plan.kind] ?? 'Take one stable next step.';
    return {
      suggestionId: (`recovery-suggestion:${String(plan.recoveryId)}` as never),
      mode:
        context.counterWindowOpen ? 'TACTICAL' as never :
        context.inDealRoom ? 'PRIVATE' as never :
        Number(context.affect.socialEmbarrassment) >= 70 ? 'QUIET' as never : 'DEFAULT' as never,
      promptTitle: title,
      promptBody: body,
      primaryOptionId: primary?.optionId ?? null,
      notes: [
        `entry=${plan.entryPoint}`,
        `kind=${plan.kind}`,
      ],
    };
  }

  private buildFallbackOption(
    kind: ChatRecoveryKind,
    entryPoint: ChatRecoveryEntryPoint,
    visibleChannel: ChatVisibleChannel,
    now: UnixMs,
  ): ChatRecoveryOption {
    return {
      optionId: (`recovery-option:fallback:${kind.toLowerCase()}:${Number(now)}` as never),
      kind,
      label: 'Take the stable route',
      detail: `Fallback recovery for ${entryPoint}.`,
      pace: 'SHORT' as ChatRecoveryPace,
      visibility: visibleChannel === 'GLOBAL' ? 'PRIVATE' as ChatRecoveryVisibility : 'SEMI_PRIVATE' as ChatRecoveryVisibility,
      difficulty: 'CONTROLLED' as ChatRecoveryDifficultyBand,
      confidence01: 0.64 as never,
      expectedStabilityLift01: 0.34 as never,
      expectedEmbarrassmentReduction01: 0.22 as never,
      requiresHelper: false,
      requiresCounterWindowOpen: false,
      suggestedCounterplayKind: null,
      suggestedChannel: visibleChannel as never,
      payload: { fallback: true, entryPoint },
      notes: [],
    };
  }
}

export function createRecoveryPromptPolicy(options: RecoveryPromptPolicyOptions = {}): RecoveryPromptPolicy {
  return new RecoveryPromptPolicy(options);
}

export const RecoveryPromptPolicyModule = Object.freeze({
  displayName: 'RecoveryPromptPolicy',
  file: 'pzo-web/src/engines/chat/rescue/RecoveryPromptPolicy.ts',
  category: 'frontend-chat-rescue-policy',
  create: createRecoveryPromptPolicy,
});


// ============================================================================
// MARK: Extended recovery diagnostics and projection helpers
// ============================================================================

export interface RecoveryPromptDiagnostics {
  readonly recoveryId: string;
  readonly planKind: ChatRecoveryKind;
  readonly entryPoint: ChatRecoveryEntryPoint;
  readonly difficulty: ChatRecoveryDifficultyBand;
  readonly helperPosture: ChatRescueHelperPosture;
  readonly visibility: ChatRecoveryVisibility;
  readonly paceHistogram: Readonly<Record<ChatRecoveryPace, number>>;
  readonly maxStabilityLift01: number;
  readonly minEmbarrassmentReduction01: number;
  readonly recommendedOptionId?: string | null;
  readonly notes: readonly string[];
}

export interface RecoveryBannerToken {
  readonly label: string;
  readonly value: string;
  readonly emphasis: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RecoveryOptionBucket {
  readonly bucket: 'PRIMARY' | 'SAFE' | 'QUIET' | 'AGGRESSIVE' | 'FALLBACK';
  readonly options: readonly ChatRecoveryOption[];
}

const PACE_PRIORITY: readonly ChatRecoveryPace[] = [
  'INSTANT',
  'SHORT',
  'BREATH',
  'FULL_RESET',
  'BETWEEN_ROUNDS',
];

const VISIBILITY_LABELS: Readonly<Record<ChatRecoveryVisibility, string>> = {
  PRIVATE: 'private',
  SEMI_PRIVATE: 'semi-private',
  PUBLIC: 'public',
};

const PACE_LABELS: Readonly<Record<ChatRecoveryPace, string>> = {
  INSTANT: 'instant',
  SHORT: 'short',
  BREATH: 'breath',
  FULL_RESET: 'full-reset',
  BETWEEN_ROUNDS: 'between-rounds',
};

const BUCKET_RULES = Object.freeze({
  PRIMARY: 'highest confidence and lowest ambiguity',
  SAFE: 'minimal embarrassment and helper-friendly',
  QUIET: 'silence-preserving or low-visibility',
  AGGRESSIVE: 'fast, direct, higher social exposure',
  FALLBACK: 'use when other buckets are empty',
} as const);

function computePaceHistogram(options: readonly ChatRecoveryOption[]): Readonly<Record<ChatRecoveryPace, number>> {
  const seed: Record<ChatRecoveryPace, number> = {
    INSTANT: 0,
    SHORT: 0,
    BREATH: 0,
    FULL_RESET: 0,
    BETWEEN_ROUNDS: 0,
  };
  for (const option of options) {
    seed[option.pace] += 1;
  }
  return seed;
}

function optionVisibilityPenalty(option: ChatRecoveryOption, embarrassment: Score100): number {
  if (option.visibility === 'PRIVATE') return 0;
  if (option.visibility === 'SEMI_PRIVATE') return Number(embarrassment) >= 70 ? 10 : 4;
  return Number(embarrassment) >= 70 ? 18 : 8;
}

function optionHelperBoost(option: ChatRecoveryOption, posture: ChatRescueHelperPosture): number {
  if (!option.requiresHelper) return posture === 'NONE' ? 0 : 4;
  if (posture === 'ACTIVE') return 12;
  if (posture === 'ESCALATED') return 10;
  if (posture === 'READY') return 8;
  if (posture === 'SHADOWING') return 6;
  return -6;
}

function optionPaceBoost(option: ChatRecoveryOption, urgency: ChatRescueUrgencyBand | null | undefined): number {
  if (!urgency) return 0;
  if (urgency === 'CRITICAL') {
    return option.pace === 'INSTANT' || option.pace === 'SHORT' ? 12 : -8;
  }
  if (urgency === 'HIGH') {
    return option.pace === 'SHORT' ? 8 : option.pace === 'BREATH' ? 3 : -2;
  }
  if (urgency === 'MEDIUM') {
    return option.pace === 'BREATH' ? 6 : option.pace === 'SHORT' ? 4 : 0;
  }
  return option.pace === 'FULL_RESET' ? 4 : 0;
}

function deriveProjectionTokens(plan: ChatRecoveryPlan, projection: RecoveryPromptProjection): readonly RecoveryBannerToken[] {
  const primary = plan.bundle.options[0];
  return [
    { label: 'mode', value: projection.suggestedMode.toLowerCase(), emphasis: 'LOW' },
    { label: 'visibility', value: VISIBILITY_LABELS[plan.bundle.visibility], emphasis: 'LOW' },
    { label: 'kind', value: plan.kind.toLowerCase(), emphasis: 'MEDIUM' },
    { label: 'entry', value: plan.entryPoint.toLowerCase(), emphasis: 'LOW' },
    { label: 'first-step', value: primary?.label ?? 'recover', emphasis: 'HIGH' },
  ];
}

function chooseRecommendedOption(
  options: readonly ChatRecoveryOption[],
  embarrassment: Score100,
  posture: ChatRescueHelperPosture,
  urgency: ChatRescueUrgencyBand | null | undefined,
): ChatRecoveryOption | null {
  if (!options.length) return null;

  const ranked = [...options].map((option) => {
    const score =
      Number(option.confidence01) * 100 * 0.42 +
      Number(option.expectedStabilityLift01) * 100 * 0.28 +
      Number(option.expectedEmbarrassmentReduction01) * 100 * 0.18 +
      optionHelperBoost(option, posture) +
      optionPaceBoost(option, urgency) -
      optionVisibilityPenalty(option, embarrassment);
    return { option, score };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.option ?? null;
}

function bucketOptions(options: readonly ChatRecoveryOption[]): readonly RecoveryOptionBucket[] {
  const primary = options.slice(0, 1);
  const safe = options.filter((option) => option.visibility !== 'PUBLIC' && option.requiresHelper);
  const quiet = options.filter((option) => option.visibility === 'PRIVATE' || option.pace === 'BREATH');
  const aggressive = options.filter((option) => option.visibility === 'PUBLIC' || option.pace === 'INSTANT');
  const fallback = options.length ? [options[options.length - 1]] : [];
  return [
    { bucket: 'PRIMARY', options: primary },
    { bucket: 'SAFE', options: safe },
    { bucket: 'QUIET', options: quiet },
    { bucket: 'AGGRESSIVE', options: aggressive },
    { bucket: 'FALLBACK', options: fallback },
  ];
}

export function buildRecoveryPromptDiagnostics(
  plan: ChatRecoveryPlan,
  posture: ChatRescueHelperPosture,
): RecoveryPromptDiagnostics {
  const histogram = computePaceHistogram(plan.bundle.options);
  const recommended = plan.bundle.suggestion.primaryOptionId ? String(plan.bundle.suggestion.primaryOptionId) : null;
  return {
    recoveryId: String(plan.recoveryId),
    planKind: plan.kind,
    entryPoint: plan.entryPoint,
    difficulty: deriveRecoveryDifficulty({
      confidence: 50 as Score100,
      frustration: 50 as Score100,
      embarrassment: 50 as Score100,
      desperation: 50 as Score100,
      helperReceptivity: 50 as Score100,
    }),
    helperPosture: posture,
    visibility: plan.bundle.visibility,
    paceHistogram: histogram,
    maxStabilityLift01: Math.max(0, ...plan.bundle.options.map((option) => Number(option.expectedStabilityLift01))),
    minEmbarrassmentReduction01: Math.min(1, ...plan.bundle.options.map((option) => Number(option.expectedEmbarrassmentReduction01))),
    recommendedOptionId: recommended,
    notes: [
      `bundle-options=${plan.bundle.options.length}`,
      `checkpoints=${plan.checkpoints.length}`,
    ],
  };
}

export function buildRecoveryProjectionTokens(
  projection: RecoveryPromptProjection,
): readonly RecoveryBannerToken[] {
  return deriveProjectionTokens(projection.plan, projection);
}

export function buildRecoveryOptionBuckets(
  plan: ChatRecoveryPlan,
): readonly RecoveryOptionBucket[] {
  return bucketOptions(plan.bundle.options);
}

export function describeRecoveryBucketRules(): Readonly<Record<RecoveryOptionBucket['bucket'], string>> {
  return BUCKET_RULES;
}

export function rankRecoveryOptionsForContext(
  options: readonly ChatRecoveryOption[],
  context: {
    readonly embarrassment: Score100;
    readonly posture: ChatRescueHelperPosture;
    readonly urgency?: ChatRescueUrgencyBand | null;
  },
): readonly ChatRecoveryOption[] {
  const ranked = [...options].map((option) => ({
    option,
    score:
      Number(option.confidence01) * 100 * 0.40 +
      Number(option.expectedStabilityLift01) * 100 * 0.26 +
      Number(option.expectedEmbarrassmentReduction01) * 100 * 0.20 +
      optionHelperBoost(option, context.posture) +
      optionPaceBoost(option, context.urgency ?? null) -
      optionVisibilityPenalty(option, context.embarrassment),
  }));
  ranked.sort((a, b) => b.score - a.score);
  return ranked.map((item) => item.option);
}

export function createRecoveryNarrativeFrame(plan: ChatRecoveryPlan): readonly string[] {
  const base = [
    `kind:${plan.kind}`,
    `entry:${plan.entryPoint}`,
    `visibility:${plan.bundle.visibility}`,
    `options:${plan.bundle.options.length}`,
  ];
  if (plan.sourceRescueKind) base.push(`source-rescue:${plan.sourceRescueKind}`);
  if (plan.sourceRescueStyle) base.push(`source-style:${plan.sourceRescueStyle}`);
  return base;
}

export function projectRecoverySummary(plan: ChatRecoveryPlan): string {
  const primary = plan.bundle.options[0];
  const label = primary?.label ?? 'Recover';
  const visibility = VISIBILITY_LABELS[plan.bundle.visibility];
  const pace = primary ? PACE_LABELS[primary.pace] : 'short';
  return `${label} · ${visibility} · ${pace}`;
}

export function chooseRecoverySuggestedMode(
  plan: ChatRecoveryPlan,
  embarrassment: Score100,
  modalThreshold: Score100,
): RecoveryPromptProjection['suggestedMode'] {
  return selectSuggestedMode(plan.bundle.visibility, embarrassment, modalThreshold);
}

export function buildRecoveryProjectionFromPlan(
  policy: RecoveryPromptPolicy,
  context: RecoveryPromptContext,
): RecoveryPromptProjection {
  return policy.build(context);
}

export function resolveRecoveryOutcome(
  policy: RecoveryPromptPolicy,
  input: RecoveryResolutionInput,
): ChatRecoveryOutcome {
  return policy.resolve(input);
}


// ============================================================================
// MARK: Recovery prompt audit and scenario helpers
// ============================================================================

export interface RecoveryScenarioSnapshot {
  readonly label: string;
  readonly entryPoint: ChatRecoveryEntryPoint;
  readonly difficulty: ChatRecoveryDifficultyBand;
  readonly recommendedMode: RecoveryPromptProjection['suggestedMode'];
  readonly firstActionLabel: string;
  readonly notes: readonly string[];
}

export function auditRecoveryPlan(plan: ChatRecoveryPlan): readonly string[] {
  const findings: string[] = [];
  if (!plan.bundle.options.length) findings.push('bundle-missing-options');
  if (!plan.checkpoints.length) findings.push('plan-missing-checkpoints');
  if (plan.bundle.visibility === 'PUBLIC' && plan.kind === 'SILENT_RECENTER') findings.push('silent-recenter-should-not-be-public');
  if (plan.entryPoint === 'NEGOTIATION_ESCAPE' && plan.kind !== 'NEGOTIATION_EXIT') findings.push('negotiation-entry-mismatch');
  const recommended = plan.bundle.options[0];
  if (recommended && recommended.requiresHelper && plan.helperPosture === 'NONE') findings.push('helper-required-but-posture-none');
  return findings;
}

export function simulateRecoveryScenario(
  policy: RecoveryPromptPolicy,
  context: RecoveryPromptContext,
): RecoveryScenarioSnapshot {
  const projection = policy.build(context);
  const diagnostics = buildRecoveryPromptDiagnostics(projection.plan, context.helperPosture);
  return {
    label: projection.bannerTitle,
    entryPoint: projection.plan.entryPoint,
    difficulty: diagnostics.difficulty,
    recommendedMode: projection.suggestedMode,
    firstActionLabel: projection.quickActions[0]?.label ?? 'Recover',
    notes: [...projection.notes, ...diagnostics.notes],
  };
}

export function compareRecoveryModes(
  policy: RecoveryPromptPolicy,
  contexts: readonly RecoveryPromptContext[],
): readonly RecoveryScenarioSnapshot[] {
  return contexts.map((context) => simulateRecoveryScenario(policy, context));
}

export function summarizeRecoveryProjection(projection: RecoveryPromptProjection): string {
  return [
    projection.bannerTitle,
    projection.suggestedMode,
    projection.quickActions[0]?.label ?? 'Recover',
  ].join(' · ');
}


export function buildRecoveryModeMatrix(): Readonly<Record<ChatRecoveryVisibility, readonly RecoveryPromptProjection['suggestedMode'][]>> {
  return {
    PRIVATE: ['SIDECARD', 'MODAL'],
    SEMI_PRIVATE: ['BANNER', 'SIDECARD'],
    PUBLIC: ['INLINE', 'BANNER'],
  };
}

export function explainRecoveryModeSelection(
  visibility: ChatRecoveryVisibility,
  embarrassment: Score100,
  modalThreshold: Score100,
): readonly string[] {
  const mode = selectSuggestedMode(visibility, embarrassment, modalThreshold);
  return [
    `visibility=${visibility}`,
    `embarrassment=${embarrassment}`,
    `mode=${mode}`,
  ];
}

export function buildRecoveryOptionNarrative(option: ChatRecoveryOption): string {
  return `${option.label}: ${option.detail} [${option.visibility.toLowerCase()} · ${option.pace.toLowerCase()}]`;
}

export function listRecoveryOptionNarratives(plan: ChatRecoveryPlan): readonly string[] {
  return plan.bundle.options.map((option) => buildRecoveryOptionNarrative(option));
}


export function isRecoveryProjectionHighFriction(plan: ChatRecoveryPlan): boolean {
  return plan.bundle.options.some((option) => option.difficulty === 'HIGH_FRICTION' || option.difficulty === 'LAST_CHANCE');
}
