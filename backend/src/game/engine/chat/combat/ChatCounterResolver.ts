/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT COUNTER RESOLVER
 * FILE: backend/src/game/engine/chat/combat/ChatCounterResolver.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend authority for language-as-defense inside the chat combat lane.
 *
 * This file is not a UI quick-reply helper and not a thin score wrapper around
 * the shared contracts. It translates authoritative backend truth into real
 * counterplay windows, candidates, resolutions, and receipts that can survive
 * transport boundaries and later be replayed or audited.
 *
 * What this module owns
 * ---------------------
 * - turning an incoming conversational attack into a legal counter window,
 * - deriving a signal snapshot from backend room / affect / relationship truth,
 * - generating authored counter move candidates from repo-shaped heuristics,
 * - ranking and selecting candidates through the shared counterplay contract,
 * - resolving player typed replies or backend-forced closures,
 * - tracking recent plans/resolutions in an authoritative ledger,
 * - and returning enough debug metadata for higher layers to explain decisions.
 *
 * What this module does not own
 * -----------------------------
 * - transcript mutation,
 * - socket fanout,
 * - React/UI quick reply rendering,
 * - hater scene planning,
 * - or final fight-level win/loss judgment.
 *
 * Design doctrine
 * ---------------
 * - A counter is not generic text. It is a timed defensive instrument.
 * - Silent counters, proof counters, quote turns, and negotiation reprices all
 *   deserve the same authority-grade scoring surface.
 * - The backend must be able to explain why a counter succeeded or failed.
 * - Helper-assisted counters are valid, but they must remain visible in the
 *   ledger rather than masquerading as player-only brilliance.
 * - Public witness, embarrassment exposure, quote leverage, and timing pressure
 *   are first-class battle variables.
 * ============================================================================
 */

import type {
  ChatCounterActorSnapshot,
  ChatCounterCandidate,
  ChatCounterEfficacyBand,
  ChatCounterFailureReason,
  ChatCounterIntent,
  ChatCounterMove,
  ChatCounterplayKind,
  ChatCounterplayLedger,
  ChatCounterplayPlan,
  ChatCounterplayResolution,
  ChatCounterRiskBand,
  ChatCounterSignalSnapshot,
  ChatCounterTimingClass,
  ChatCounterValidationStatus,
  ChatCounterWindow,
  ChatCounterWindowId,
} from '../../../../../../shared/contracts/chat/ChatCounterplay';
import type { ChatQuoteReference } from '../../../../../../shared/contracts/chat/ChatMessage';
import {
  buildCounterCandidate,
  buildCounterplayPlan,
  createEmptyCounterplayLedger,
  rankCounterCandidates,
  resolveCounterplay,
  shouldCounterBecomeLegend,
  toScore01 as toContractScore01,
  toScore100 as toContractScore100,
} from '../../../../../../shared/contracts/chat/ChatCounterplay';
import type {
  ChatBossAttack,
  ChatBossCounterWindowBinding,
  ChatBossFightPlan,
  ChatBossRound,
} from '../../../../../../shared/contracts/chat/ChatBossFight';

import type {
  AttackType,
  BotId,
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatChannelId,
  ChatEventId,
  ChatInferenceSnapshot,
  ChatLearningProfile,
  ChatMessage,
  ChatMessageId,
  ChatRelationshipState,
  ChatRescueDecision,
  ChatRoomId,
  ChatRoomState,
  ChatSessionId,
  ChatSessionState,
  ChatSignalEnvelope,
  ChatState,
  ChatVisibleChannel,
  JsonValue,
  Nullable,
  PressureTier,
  Score01,
  Score100,
  UnixMs,
} from '../types';
import {
  asUnixMs,
  clamp01,
  clamp100,
  isVisibleChannelId,
} from '../types';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface ChatCounterResolverClock {
  now(): number;
}

export interface ChatCounterResolverLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatCounterResolverPolicy {
  readonly minimumWindowMs: number;
  readonly defaultWindowMs: number;
  readonly maximumWindowMs: number;
  readonly quoteWindowBonusMs: number;
  readonly proofWindowBonusMs: number;
  readonly helperAssistBonusMs: number;
  readonly strongEmbarrassmentThreshold01: Score01;
  readonly strongProofThreshold01: Score01;
  readonly strongQuoteThreshold01: Score01;
  readonly lowConfidenceThreshold01: Score01;
  readonly legendWitnessThreshold01: Score01;
}

export interface ChatCounterResolverOptions {
  readonly clock?: ChatCounterResolverClock;
  readonly logger?: ChatCounterResolverLogger;
  readonly policy?: Partial<ChatCounterResolverPolicy>;
}

export interface ChatCounterSourceContext {
  readonly state: ChatState;
  readonly room: ChatRoomState;
  readonly session: ChatSessionState;
  readonly now?: UnixMs;
  readonly causeEventId?: ChatEventId | null;
  readonly signal?: ChatSignalEnvelope | null;
  readonly sourceMessage?: ChatMessage | null;
  readonly visibleChannel?: ChatVisibleChannel | null;
  readonly rescue?: ChatRescueDecision | null;
  readonly notes?: readonly string[];
}


export interface ChatCounterRuntimeContext {
  readonly windowId: ChatCounterWindowId;
  readonly sessionId: ChatSessionId;
  readonly sourceMessageId: Nullable<ChatMessageId>;
  readonly attackType: AttackType;
  readonly validationStatus: ChatCounterValidationStatus;
  readonly assignedBotId: Nullable<BotId>;
  readonly audienceHeat: Nullable<ChatAudienceHeat>;
  readonly inference: Nullable<ChatInferenceSnapshot>;
  readonly learningProfile: Nullable<ChatLearningProfile>;
  readonly confidenceScore100: Score100;
  readonly pressureScore100: Score100;
  readonly witnessScore100: Score100;
  readonly rescueScore100: Score100;
  readonly notes: readonly string[];
}

type CounterplayAttackType = ChatCounterWindow['sourceAttackType'];

export interface ChatCounterWindowSeed {
  readonly fight: ChatBossFightPlan;
  readonly round: ChatBossRound;
  readonly binding: ChatBossCounterWindowBinding;
  readonly source: ChatCounterSourceContext;
}

export interface ChatCounterPlanRequest {
  readonly ledger?: ChatCounterplayLedger | null;
  readonly fight: ChatBossFightPlan;
  readonly round: ChatBossRound;
  readonly binding: ChatBossCounterWindowBinding;
  readonly source: ChatCounterSourceContext;
  readonly playerDraftText?: string | null;
  readonly forceHelperSuggestion?: boolean;
}

export interface ChatCounterResolveRequest {
  readonly ledger: ChatCounterplayLedger;
  readonly plan: ChatCounterplayPlan;
  readonly fight: ChatBossFightPlan;
  readonly round: ChatBossRound;
  readonly binding: ChatBossCounterWindowBinding;
  readonly source: ChatCounterSourceContext;
  readonly playerMessage?: ChatMessage | null;
  readonly selectedCounterplayId?: string | null;
  readonly forceCloseReason?: string | null;
}

export interface ChatCounterExpirationRequest {
  readonly ledger: ChatCounterplayLedger;
  readonly plan: ChatCounterplayPlan;
  readonly fight: ChatBossFightPlan;
  readonly round: ChatBossRound;
  readonly binding: ChatBossCounterWindowBinding;
  readonly source: ChatCounterSourceContext;
  readonly reason: string;
}

export interface ChatCounterPlanResult {
  readonly ledger: ChatCounterplayLedger;
  readonly window: ChatCounterWindow;
  readonly signal: ChatCounterSignalSnapshot;
  readonly actor: ChatCounterActorSnapshot;
  readonly context: ChatCounterRuntimeContext;
  readonly generatedMoves: readonly ChatCounterMove[];
  readonly plan: ChatCounterplayPlan;
  readonly bestCandidate?: ChatCounterCandidate | null;
  readonly helperSuggested: boolean;
  readonly debug: Readonly<Record<string, JsonValue>>;
}

export interface ChatCounterResolveResult {
  readonly ledger: ChatCounterplayLedger;
  readonly plan: ChatCounterplayPlan;
  readonly context: ChatCounterRuntimeContext;
  readonly chosenCandidate?: ChatCounterCandidate | null;
  readonly resolution: ChatCounterplayResolution;
  readonly forcedClose: boolean;
  readonly summary: string;
  readonly debug: Readonly<Record<string, JsonValue>>;
}

export interface ChatCounterSuggestionTemplate {
  readonly templateId: string;
  readonly label: string;
  readonly kind: ChatCounterplayKind;
  readonly intent: ChatCounterIntent;
  readonly timingClass: ChatCounterTimingClass;
  readonly riskBand: ChatCounterRiskBand;
  readonly requiresProof: boolean;
  readonly requiresQuote: boolean;
  readonly requiresVisibleReply: boolean;
  readonly canBeSilent: boolean;
  readonly canEscalateCrowd: boolean;
  readonly canReducePressure: boolean;
  readonly canTriggerReprice: boolean;
  readonly canOpenExitWindow: boolean;
  readonly canBecomeLegend: boolean;
  readonly notes: readonly string[];
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_CLOCK: ChatCounterResolverClock = Object.freeze({
  now: () => Date.now(),
});

const DEFAULT_LOGGER: ChatCounterResolverLogger = Object.freeze({
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
});

export const DEFAULT_CHAT_COUNTER_RESOLVER_POLICY: ChatCounterResolverPolicy = Object.freeze({
  minimumWindowMs: 2_200,
  defaultWindowMs: 5_400,
  maximumWindowMs: 12_500,
  quoteWindowBonusMs: 1_250,
  proofWindowBonusMs: 900,
  helperAssistBonusMs: 1_100,
  strongEmbarrassmentThreshold01: clamp01(0.66),
  strongProofThreshold01: clamp01(0.58),
  strongQuoteThreshold01: clamp01(0.56),
  lowConfidenceThreshold01: clamp01(0.38),
  legendWitnessThreshold01: clamp01(0.54),
});

const COUNTERPLAY_TEMPLATES: readonly ChatCounterSuggestionTemplate[] = Object.freeze([
  {
    templateId: 'direct-defense',
    label: 'Direct defense',
    kind: 'DIRECT_DEFENSE',
    intent: 'DEFEND',
    timingClass: 'FAST',
    riskBand: 'MEASURED',
    requiresProof: false,
    requiresQuote: false,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: false,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: false,
    canBecomeLegend: false,
    notes: ['Baseline protective reply.', 'Used when the attack is real but not yet owning the room.'],
  },
  {
    templateId: 'proof-spike',
    label: 'Proof spike',
    kind: 'PROOF_SPIKE',
    intent: 'EXPOSE',
    timingClass: 'BEAT_LOCKED',
    riskBand: 'MEASURED',
    requiresProof: true,
    requiresQuote: false,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: true,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: false,
    canBecomeLegend: true,
    notes: ['Best when the enemy is leaning on false certainty.', 'Turns documentary weight into social reversal.'],
  },
  {
    templateId: 'quote-turn',
    label: 'Quote turn',
    kind: 'QUOTE_TURN',
    intent: 'REVERSE',
    timingClass: 'FAST',
    riskBand: 'MEASURED',
    requiresProof: false,
    requiresQuote: true,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: true,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: false,
    canBecomeLegend: true,
    notes: ['Reflects their own line back into the attack surface.', 'High value against boast, bluff, and receipt pressure.'],
  },
  {
    templateId: 'bluff-call',
    label: 'Bluff call',
    kind: 'BLUFF_CALL',
    intent: 'EXPOSE',
    timingClass: 'FAST',
    riskBand: 'VOLATILE',
    requiresProof: false,
    requiresQuote: false,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: true,
    canReducePressure: true,
    canTriggerReprice: true,
    canOpenExitWindow: false,
    canBecomeLegend: true,
    notes: ['Punishes the enemy when threat display is ahead of actual leverage.', 'Dangerous when player confidence is weak.'],
  },
  {
    templateId: 'stall-break',
    label: 'Stall break',
    kind: 'STALL_BREAK',
    intent: 'CLOSE',
    timingClass: 'INSTANT',
    riskBand: 'SAFE',
    requiresProof: false,
    requiresQuote: false,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: false,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: false,
    canBecomeLegend: false,
    notes: ['Used when the enemy is farming hesitation more than substance.'],
  },
  {
    templateId: 'pressure-redirect',
    label: 'Pressure redirect',
    kind: 'PRESSURE_REDIRECT',
    intent: 'REVERSE',
    timingClass: 'BEAT_LOCKED',
    riskBand: 'VOLATILE',
    requiresProof: false,
    requiresQuote: false,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: true,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: false,
    canBecomeLegend: true,
    notes: ['Pushes the social spotlight back onto the aggressor.'],
  },
  {
    templateId: 'humiliation-reversal',
    label: 'Humiliation reversal',
    kind: 'HUMILIATION_REVERSAL',
    intent: 'REVERSE',
    timingClass: 'FAST',
    riskBand: 'DANGEROUS',
    requiresProof: false,
    requiresQuote: true,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: true,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: false,
    canBecomeLegend: true,
    notes: ['A public flip of embarrassment geometry.', 'Needs witness density or quote leverage to justify risk.'],
  },
  {
    templateId: 'negotiation-escape',
    label: 'Negotiation escape',
    kind: 'NEGOTIATION_ESCAPE',
    intent: 'ESCAPE',
    timingClass: 'READ_PRESSURE_DELAYED',
    riskBand: 'SAFE',
    requiresProof: false,
    requiresQuote: false,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: false,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: true,
    canBecomeLegend: false,
    notes: ['Breaks contact when staying visible only helps the attacker.'],
  },
  {
    templateId: 'negotiation-reprice',
    label: 'Negotiation reprice',
    kind: 'NEGOTIATION_REPRICE',
    intent: 'REPRICE',
    timingClass: 'FAST',
    riskBand: 'MEASURED',
    requiresProof: false,
    requiresQuote: false,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: false,
    canReducePressure: true,
    canTriggerReprice: true,
    canOpenExitWindow: false,
    canBecomeLegend: false,
    notes: ['Best in deal-room squeeze encounters.', 'Changes terms instead of arguing optics.'],
  },
  {
    templateId: 'helper-assist',
    label: 'Helper assist',
    kind: 'HELPER_ASSIST',
    intent: 'RESCUE',
    timingClass: 'FAST',
    riskBand: 'SAFE',
    requiresProof: false,
    requiresQuote: false,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: false,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: true,
    canBecomeLegend: false,
    notes: ['Rescue-biased move when user stability matters more than theatrics.'],
  },
  {
    templateId: 'crowd-reframe',
    label: 'Crowd reframe',
    kind: 'CROWD_REFRAME',
    intent: 'HYPE',
    timingClass: 'FAST',
    riskBand: 'VOLATILE',
    requiresProof: false,
    requiresQuote: false,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: true,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: false,
    canBecomeLegend: true,
    notes: ['Rewrites witness interpretation without needing full proof.'],
  },
  {
    templateId: 'shield-stabilize',
    label: 'Shield stabilize',
    kind: 'SHIELD_STABILIZE',
    intent: 'QUIET_RESET',
    timingClass: 'INSTANT',
    riskBand: 'SAFE',
    requiresProof: false,
    requiresQuote: false,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: false,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: false,
    canBecomeLegend: false,
    notes: ['Prioritizes stability and sequence over style.'],
  },
  {
    templateId: 'exit-window',
    label: 'Exit window',
    kind: 'EXIT_WINDOW',
    intent: 'ESCAPE',
    timingClass: 'FAST',
    riskBand: 'SAFE',
    requiresProof: false,
    requiresQuote: false,
    requiresVisibleReply: false,
    canBeSilent: true,
    canEscalateCrowd: false,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: true,
    canBecomeLegend: false,
    notes: ['Used when survival of posture matters more than winning the line.'],
  },
  {
    templateId: 'silent-absorb',
    label: 'Silent absorb',
    kind: 'SILENT_ABSORB',
    intent: 'MASK',
    timingClass: 'BEAT_LOCKED',
    riskBand: 'MEASURED',
    requiresProof: false,
    requiresQuote: false,
    requiresVisibleReply: false,
    canBeSilent: true,
    canEscalateCrowd: false,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: false,
    canBecomeLegend: false,
    notes: ['Useful when silence is stronger than a rushed visible answer.'],
  },
  {
    templateId: 'legend-counter',
    label: 'Legend counter',
    kind: 'LEGEND_COUNTER',
    intent: 'REVERSE',
    timingClass: 'FAST',
    riskBand: 'DANGEROUS',
    requiresProof: true,
    requiresQuote: true,
    requiresVisibleReply: true,
    canBeSilent: false,
    canEscalateCrowd: true,
    canReducePressure: true,
    canTriggerReprice: false,
    canOpenExitWindow: false,
    canBecomeLegend: true,
    notes: ['Only valid when proof and quote leverage align under witness pressure.'],
  },
]);

// ============================================================================
// MARK: ChatCounterResolver
// ============================================================================

export class ChatCounterResolver {
  private readonly clock: ChatCounterResolverClock;
  private readonly logger: ChatCounterResolverLogger;
  private readonly policy: ChatCounterResolverPolicy;

  public constructor(options: ChatCounterResolverOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.policy = Object.freeze({
      ...DEFAULT_CHAT_COUNTER_RESOLVER_POLICY,
      ...(options.policy ?? {}),
    });
  }

  public createEmptyLedger(roomId: ChatRoomId, channelId: ChatChannelId, now?: UnixMs): ChatCounterplayLedger {
    return createEmptyCounterplayLedger(roomId, channelId, now ?? this.now());
  }

  public plan(request: ChatCounterPlanRequest): ChatCounterPlanResult {
    const now = request.source.now ?? this.now();
    const ledger = request.ledger ?? this.createEmptyLedger(request.source.room.roomId, request.source.room.activeVisibleChannel, now);
    let window = this.createWindow({
      fight: request.fight,
      round: request.round,
      binding: request.binding,
      source: request.source,
    });

    const actor = this.createActorSnapshot(request.source);
    const signal = this.createSignalSnapshot(request.source, request.fight, request.round, window);
    const context = this.createRuntimeContext(request.source, request.fight, request.round, window, signal);
    window = this.applyRuntimeContextToWindow(window, context);
    const helperSuggested = Boolean(request.forceHelperSuggestion || shouldForceHelperSuggestion(request.source, signal));
    const generatedMoves = this.generateMoves({
      source: request.source,
      fight: request.fight,
      round: request.round,
      window,
      signal,
      helperSuggested,
      playerDraftText: request.playerDraftText,
    });

    const candidates = generatedMoves.map((move) =>
      this.decorateCandidate(
        buildCounterCandidate(
          window,
          move,
          signal,
          now,
          actor,
          'BACKEND_AUTHORITATIVE',
          (`pattern:${request.fight.pattern.patternId}:${request.round.attack.attackClass}`) as any,
        ),
        window,
        move,
        signal,
        context,
      ),
    );

    const ranked = rankCounterCandidates(candidates);
    const bestCandidate = ranked[0] ?? null;
    const expiresAt = asUnixMs(Number(window.closesAt));

    const plan = buildCounterplayPlan(
      request.source.room.roomId,
      window.channelId,
      window,
      ranked,
      now,
      expiresAt,
      helperSuggested ? ('helper:counter:assist' as any) : null,
      Object.freeze({
        helperSuggested,
        fightId: request.fight.bossFightId,
        roundId: request.round.roundId,
        attackClass: request.round.attack.attackClass,
        validationStatus: context.validationStatus,
        assignedBotId: context.assignedBotId,
      }),
    );

    const nextLedger = appendPlanToLedger(ledger, window, plan, now);

    this.logger.debug('chat.counter.plan', {
      roomId: request.source.room.roomId,
      windowId: window.windowId,
      rankedCount: ranked.length,
      bestCounterplayId: bestCandidate?.counterplayId ?? null,
      helperSuggested,
      validationStatus: context.validationStatus,
      assignedBotId: context.assignedBotId ?? null,
      confidenceScore100: context.confidenceScore100,
      pressureScore100: context.pressureScore100,
    });

    return {
      ledger: nextLedger,
      window,
      signal,
      actor,
      context,
      generatedMoves,
      plan,
      bestCandidate,
      helperSuggested,
      debug: Object.freeze({
        rankedCount: ranked.length,
        helperSuggested,
        bestScore01: bestCandidate?.score01 ?? null,
        bestValidationStatus: bestCandidate?.validationStatus ?? null,
        validationStatus: context.validationStatus,
        assignedBotId: context.assignedBotId ?? null,
        sourceMessageId: context.sourceMessageId ?? null,
        confidenceScore100: context.confidenceScore100,
        pressureScore100: context.pressureScore100,
        witnessScore100: context.witnessScore100,
      }),
    };
  }

  public resolve(request: ChatCounterResolveRequest): ChatCounterResolveResult {
    const now = request.source.now ?? this.now();
    const actor = this.createActorSnapshot(request.source);
    const baseWindow = this.createWindow({
      fight: request.fight,
      round: request.round,
      binding: request.binding,
      source: request.source,
    });
    const signal = this.createSignalSnapshot(request.source, request.fight, request.round, baseWindow);
    const context = this.createRuntimeContext(request.source, request.fight, request.round, baseWindow, signal);

    const chosenCandidate = this.selectCandidateForResolution({
      plan: request.plan,
      playerMessage: request.playerMessage,
      selectedCounterplayId: request.selectedCounterplayId,
      signal,
      actor,
      now,
    });

    const forcedClose = Boolean(request.forceCloseReason);
    const resolution = chosenCandidate
      ? resolveCounterplay(chosenCandidate, now)
      : this.resolveWithoutCandidate(request, now);

    const nextLedger = appendResolutionToLedger(request.ledger, request.plan, resolution, now);
    const summary = summarizeResolution(chosenCandidate, resolution, request.forceCloseReason ?? null);

    this.logger.info('chat.counter.resolve', {
      roomId: request.source.room.roomId,
      windowId: request.binding.windowId,
      succeeded: resolution.succeeded,
      efficacyBand: resolution.efficacyBand,
      chosenCounterplayId: chosenCandidate?.counterplayId ?? null,
      forcedClose,
      validationStatus: context.validationStatus,
      assignedBotId: context.assignedBotId ?? null,
      pressureScore100: context.pressureScore100,
    });

    return {
      ledger: nextLedger,
      plan: request.plan,
      context,
      chosenCandidate,
      resolution,
      forcedClose,
      summary,
      debug: Object.freeze({
        chosenCounterplayId: chosenCandidate?.counterplayId ?? null,
        chosenValidationStatus: chosenCandidate?.validationStatus ?? null,
        reputationDeltaScore: resolution.reputationDeltaScore,
        legendQualified: resolution.legendQualified,
        validationStatus: context.validationStatus,
        sourceMessageId: context.sourceMessageId ?? null,
        sessionId: context.sessionId,
        confidenceScore100: context.confidenceScore100,
      }),
    };
  }

  public expire(request: ChatCounterExpirationRequest): ChatCounterResolveResult {
    return this.resolve({
      ledger: request.ledger,
      plan: request.plan,
      fight: request.fight,
      round: request.round,
      binding: request.binding,
      source: request.source,
      forceCloseReason: request.reason,
      playerMessage: null,
      selectedCounterplayId: null,
    });
  }

  // ========================================================================
  // MARK: Window + signal synthesis
  // ========================================================================

  public createWindow(seed: ChatCounterWindowSeed): ChatCounterWindow {
    const now = seed.source.now ?? this.now();
    const openedAt = asUnixMs(Math.max(Number(seed.round.openedAt), Number(now)));
    const baseWindowMs = deriveBaseWindowMs(seed.round.attack, this.policy);
    const closesAt = asUnixMs(Number(openedAt) + baseWindowMs);
    const idealResponseAt = deriveIdealResponseAt(openedAt, closesAt, seed.round.attack);
    const windowId: ChatCounterWindowId = seed.binding.windowId;
    const sessionId: ChatSessionId = seed.source.session.identity.sessionId;
    const sourceMessageId: Nullable<ChatMessageId> = coerceMessageId(seed.source.sourceMessage?.id ?? null);
    const sourceAttackType: AttackType = mapAttackType(seed.round.attack.attackType);
    const counterplayAttackType: CounterplayAttackType = mapCounterplayAttackType(sourceAttackType);
    const validationStatus: ChatCounterValidationStatus = 'UNVALIDATED';

    return {
      windowId,
      roomId: seed.source.room.roomId,
      sessionId,
      requestId: seed.fight.requestId ?? null,
      channelId: seed.fight.channelId,
      sourceMessageId,
      sourceMomentId: seed.fight.momentId ?? null,
      sourceSceneId: seed.fight.sceneId ?? null,
      sourceTick: null,
      sourceAttackType: counterplayAttackType,
      sourceMomentType: seed.fight.pattern.momentTypeHint ?? null,
      sourceSceneArchetype: seed.fight.pattern.preferredSceneArchetype ?? null,
      sourceSceneRole: seed.fight.pattern.preferredSceneRole ?? null,
      targetActor: this.createActorSnapshot(seed.source),
      openedAt,
      closesAt,
      idealResponseAt,
      timingClass: mapCounterTiming(seed.round.attack.preferredCounterTiming),
      validationStatus,
      preferredDeliveryPriority: 'HIGH' as any,
      playerVisible: isVisibleChannelId(seed.fight.visibleChannel),
      requiresVisibleReply: seed.round.attack.counterDemands.includes('VISIBLE_REPLY'),
      allowsSilence: seed.round.attack.allowsSilenceOutplay,
      allowsHelperAssist: seed.round.attack.allowsHelperAssistance,
      allowsProofSpike: seed.round.attack.proofWeighted,
      allowsQuoteTurn: seed.round.attack.quoteWeighted,
      allowsNegotiationEscape: seed.round.attack.allowsNegotiationEscape,
      riskBand: deriveWindowRiskBand(seed.round.attack),
      notes: Object.freeze([
        `fight=${seed.fight.bossFightId}`,
        `round=${seed.round.roundId}`,
        `attack=${seed.round.attack.attackClass}`,
      ]),
    };
  }

  public createSignalSnapshot(
    source: ChatCounterSourceContext,
    fight: ChatBossFightPlan,
    round: ChatBossRound,
    window: ChatCounterWindow,
  ): ChatCounterSignalSnapshot {
    const now = source.now ?? this.now();
    const sourceAttackType: AttackType = mapAttackType(round.attack.attackType);
    const counterplayAttackType: CounterplayAttackType = mapCounterplayAttackType(sourceAttackType);
    const affect = selectAffect(source.state, source.session.identity.userId);
    const relationship = selectPrimaryRelationship(source.state, source.room.roomId, source.session.identity.userId, fight.boss.actorId);
    const publicWitness01 = deriveWitness01(source.state, source.room.roomId, source.room.activeVisibleChannel);
    const humiliationRisk01 = deriveHumiliationRisk01(source, round.attack, relationship, publicWitness01);
    const bluffLikelihood01 = deriveBluffLikelihood01(source.signal, round.attack, source.sourceMessage);
    const trapLikelihood01 = deriveTrapLikelihood01(round.attack, source.signal, relationship);
    const closeWindowRisk01 = deriveCloseWindowRisk01(round, source, publicWitness01);
    const proofAdvantage01 = deriveProofAdvantage01(round.attack, source.sourceMessage, source.signal);
    const quoteAdvantage01 = deriveQuoteAdvantage01(source.sourceMessage, round.attack);
    const silenceValue01 = deriveSilenceValue01(source, round.attack, affect, publicWitness01);
    const helperNeed01 = deriveHelperNeed01(source, affect, humiliationRisk01, relationship);

    return {
      signalId: (`signal:${fight.bossFightId}:${round.roundId}`) as any,
      roomId: source.room.roomId,
      channelId: window.channelId,
      signalAt: now,
      attackType: counterplayAttackType,
      pressureTier: mapPressureTier(source.signal?.battle?.pressureTier ?? null),
      affect: mapAffectToContract(affect),
      reputation: null,
      publicWitness01: toContractScore01(Number(publicWitness01)),
      humiliationRisk01: toContractScore01(Number(humiliationRisk01)),
      bluffLikelihood01: toContractScore01(Number(bluffLikelihood01)),
      trapLikelihood01: toContractScore01(Number(trapLikelihood01)),
      closeWindowRisk01: toContractScore01(Number(closeWindowRisk01)),
      proofAdvantage01: toContractScore01(Number(proofAdvantage01)),
      quoteAdvantage01: toContractScore01(Number(quoteAdvantage01)),
      silenceValue01: toContractScore01(Number(silenceValue01)),
      helperNeed01: toContractScore01(Number(helperNeed01)),
      dominantThreatTag: dominantThreatTag(round.attack, humiliationRisk01, proofAdvantage01, quoteAdvantage01),
      tags: Object.freeze([
        round.attack.attackClass,
        round.attack.attackType,
        fight.kind,
      ]),
    };
  }

  public createActorSnapshot(source: ChatCounterSourceContext): ChatCounterActorSnapshot {
    const affect = selectAffect(source.state, source.session.identity.userId);
    return {
      actorId: source.session.identity.userId,
      actorKind: 'PLAYER' as any,
      userId: source.session.identity.userId,
      npcId: null,
      relationshipId: null,
      counterpartKind: null,
      stanceHint: null,
      objectiveHint: null,
      confidenceScore: toContractScore100(Number(affect?.confidence01 ?? 0.5) * 100),
      intimidationScore: toContractScore100(Number(affect?.intimidation01 ?? 0.25) * 100),
      embarrassmentScore: toContractScore100(Number(affect?.embarrassment01 ?? 0.25) * 100),
    };
  }


  public createRuntimeContext(
    source: ChatCounterSourceContext,
    fight: ChatBossFightPlan,
    round: ChatBossRound,
    window: ChatCounterWindow,
    signal: ChatCounterSignalSnapshot,
  ): ChatCounterRuntimeContext {
    const learningProfile = selectLearningProfile(source.state, source.session.identity.userId);
    const audienceHeat = selectAudienceHeat(source, signal);
    const inference = selectInferenceSnapshot(source);
    const assignedBotId = selectAssignedBotId(source);
    const validationStatus = deriveWindowValidationStatus(window, signal, source);
    const confidenceScore100: Score100 = clamp100(Number(signal.affect?.confidence ?? 0.5) * 100);
    const pressureScore100: Score100 = clamp100(score01To100(Number(signal.closeWindowRisk01)));
    const witnessScore100: Score100 = clamp100(score01To100(Number(signal.publicWitness01)));
    const rescueScore100: Score100 = clamp100(score01To100(Number(signal.helperNeed01)));
    const sourceMessageId: Nullable<ChatMessageId> = coerceMessageId(source.sourceMessage?.id ?? null);
    const sessionId: ChatSessionId = source.session.identity.sessionId;
    const windowId: ChatCounterWindowId = window.windowId;
    const attackType: AttackType = mapAttackType(round.attack.attackType);

    return {
      windowId,
      sessionId,
      sourceMessageId,
      attackType,
      validationStatus,
      assignedBotId,
      audienceHeat,
      inference,
      learningProfile,
      confidenceScore100,
      pressureScore100,
      witnessScore100,
      rescueScore100,
      notes: Object.freeze([
        `fight=${fight.bossFightId}`,
        `round=${round.roundId}`,
        `validation=${validationStatus}`,
        assignedBotId ? `bot=${assignedBotId}` : 'bot=none',
        sourceMessageId ? `message=${sourceMessageId}` : 'message=none',
      ]),
    };
  }

  public applyRuntimeContextToWindow(
    window: ChatCounterWindow,
    context: ChatCounterRuntimeContext,
  ): ChatCounterWindow {
    return {
      ...window,
      validationStatus: context.validationStatus,
      notes: Object.freeze([
        ...window.notes,
        ...context.notes,
      ]),
    };
  }

  public decorateCandidate(
    candidate: ChatCounterCandidate,
    window: ChatCounterWindow,
    move: ChatCounterMove,
    signal: ChatCounterSignalSnapshot,
    context: ChatCounterRuntimeContext,
  ): ChatCounterCandidate {
    const validationStatus = deriveCandidateValidationStatus(window, move, signal, context);
    const validationBonus = validationStatus === 'AUTHORITATIVE_ACCEPT'
      ? 0.04
      : validationStatus === 'WINDOW_OPEN'
        ? 0.02
        : 0;
    const adjustedScore01 = clamp01(Number(candidate.score01) + validationBonus);
    const adjustedRiskScore01 = clamp01(Number(candidate.riskAdjustedScore01) + validationBonus * 0.75);

    return {
      ...candidate,
      validationStatus,
      score01: toContractScore01(adjustedScore01),
      riskAdjustedScore01: toContractScore01(adjustedRiskScore01),
      notes: Object.freeze([
        ...candidate.notes,
        `validationStatus=${validationStatus}`,
        `attackType=${context.attackType}`,
        context.assignedBotId ? `assignedBotId=${context.assignedBotId}` : 'assignedBotId=none',
      ]),
    };
  }

  // ========================================================================
  // MARK: Candidate generation
  // ========================================================================

  private generateMoves(input: {
    source: ChatCounterSourceContext;
    fight: ChatBossFightPlan;
    round: ChatBossRound;
    window: ChatCounterWindow;
    signal: ChatCounterSignalSnapshot;
    helperSuggested: boolean;
    playerDraftText?: string | null;
  }): readonly ChatCounterMove[] {
    const now = input.source.now ?? this.now();
    const proofHash = input.source.sourceMessage?.proof?.proofHash ?? null;
    const quoteReference = createQuoteReference(input.source.sourceMessage);
    const confidence01 = selectAffect(input.source.state, input.source.session.identity.userId)?.confidence01 ?? clamp01(0.5);
    const embarrassment01 = input.signal.humiliationRisk01;
    const moveText = sanitizeDraft(input.playerDraftText);

    return COUNTERPLAY_TEMPLATES
      .filter((template) => this.templateAllowed(template, input.window, input.signal))
      .map((template, index) => this.materializeMove({
        template,
        window: input.window,
        signal: input.signal,
        fight: input.fight,
        round: input.round,
        proofHash,
        quoteReference,
        helperSuggested: input.helperSuggested,
        confidence01,
        embarrassment01,
        moveText,
        ordinal: index,
        now,
      }))
      .sort((a, b) => compareMoves(a, b, input.signal));
  }

  private templateAllowed(
    template: ChatCounterSuggestionTemplate,
    window: ChatCounterWindow,
    signal: ChatCounterSignalSnapshot,
  ): boolean {
    if (template.requiresProof && !(window.allowsProofSpike && Number(signal.proofAdvantage01) > 0.12)) return false;
    if (template.requiresQuote && !(window.allowsQuoteTurn && Number(signal.quoteAdvantage01) > 0.12)) return false;
    if (!window.allowsSilence && template.canBeSilent) return false;
    if (!window.allowsHelperAssist && template.kind === 'HELPER_ASSIST') return false;
    if (!window.allowsNegotiationEscape && (template.kind === 'NEGOTIATION_ESCAPE' || template.kind === 'NEGOTIATION_REPRICE')) return false;
    return true;
  }

  private materializeMove(input: {
    template: ChatCounterSuggestionTemplate;
    window: ChatCounterWindow;
    signal: ChatCounterSignalSnapshot;
    fight: ChatBossFightPlan;
    round: ChatBossRound;
    proofHash: string | null;
    quoteReference: ChatQuoteReference | null;
    helperSuggested: boolean;
    confidence01: Score01;
    embarrassment01: Score01;
    moveText: string | null;
    ordinal: number;
    now: UnixMs;
  }): ChatCounterMove {
    const template = input.template;
    const proofWeight = template.requiresProof ? Math.max(Number(input.signal.proofAdvantage01), 0.55) : Number(input.signal.proofAdvantage01) * 0.65;
    const quoteWeight = template.requiresQuote ? Math.max(Number(input.signal.quoteAdvantage01), 0.55) : Number(input.signal.quoteAdvantage01) * 0.65;
    const silenceWeight = template.canBeSilent ? Number(input.signal.silenceValue01) : 0;
    const helperWeight = template.kind === 'HELPER_ASSIST' ? Math.max(Number(input.signal.helperNeed01), 0.48) : Number(input.signal.helperNeed01) * 0.45;
    const embarrassmentRelief = Math.max(0, Number(input.signal.humiliationRisk01) - riskPenalty(template.riskBand));
    const dominanceSwing = computeDominanceSwing(template, input.signal, input.confidence01);
    const legendEfficacy: ChatCounterEfficacyBand =
      dominanceSwing >= 80 ? 'LEGENDARY' :
      dominanceSwing >= 60 ? 'DOMINANT' :
      dominanceSwing >= 40 ? 'STRONG' :
      'STABLE';
    const legendReady = shouldCounterBecomeLegend({
      legendQualified: template.canBecomeLegend && Number(input.signal.publicWitness01) >= 0.5,
      efficacyBand: legendEfficacy,
      pressureReliefScore: toContractScore100(Math.max(proofWeight, quoteWeight) * 100),
      dominanceSwingScore: toContractScore100(dominanceSwing),
    });

    return {
      moveId: (`move:${template.templateId}:${input.ordinal}`) as any,
      templateId: template.templateId as any,
      label: template.label,
      shortLabel: template.label,
      kind: template.kind,
      intent: template.intent,
      executionMode: input.helperSuggested && template.kind === 'HELPER_ASSIST'
        ? 'HELPER_ASSISTED'
        : input.moveText
          ? 'PLAYER_TYPED'
          : 'SYSTEM_GUIDED',
      surface: chooseSurface(template, input.window),
      timingClass: template.timingClass,
      toneBand: chooseToneBand(template, input.round.attack.attackClass),
      riskBand: template.riskBand,
      requiresProof: template.requiresProof,
      requiresQuote: template.requiresQuote,
      requiresVisibleReply: template.requiresVisibleReply,
      canBeSilent: template.canBeSilent,
      canEscalateCrowd: template.canEscalateCrowd,
      canReducePressure: template.canReducePressure,
      canTriggerReprice: template.canTriggerReprice,
      canOpenExitWindow: template.canOpenExitWindow,
      canBecomeLegend: legendReady,
      estimatedConfidence01: toContractScore01(Number(input.confidence01) * confidenceModifier(template.intent)),
      estimatedEmbarrassmentSwing01: toContractScore01(embarrassmentRelief),
      estimatedPressureRelief01: toContractScore01(computePressureRelief(template, input.signal, silenceWeight, helperWeight)),
      estimatedDominanceSwing01: toContractScore01(dominanceSwing),
      estimatedTrustGain01: toContractScore01(computeTrustGain(template, input.signal, helperWeight)),
      estimatedHumiliationRisk01: toContractScore01(computeHumiliationRisk(template, input.signal, input.embarrassment01)),
      estimatedWindowConsumption01: toContractScore01(computeWindowConsumption(template, input.window)),
      recommendedReplyText: materializeReplyText(template, input.fight, input.round, input.moveText),
      proofHash: template.requiresProof || input.signal.proofAdvantage01 > this.policy.strongProofThreshold01
        ? (input.proofHash as any)
        : null,
      quoteReference: template.requiresQuote || input.signal.quoteAdvantage01 > this.policy.strongQuoteThreshold01
        ? input.quoteReference
        : null,
      callbackAnchorIds: Object.freeze([
        (`anchor:${input.fight.bossFightId}:${template.templateId}`) as any,
      ]),
      notes: Object.freeze([
        ...template.notes,
        `attack=${input.round.attack.attackClass}`,
        `proofWeight=${proofWeight.toFixed(3)}`,
        `quoteWeight=${quoteWeight.toFixed(3)}`,
      ]),
    };
  }

  // ========================================================================
  // MARK: Resolution selection
  // ========================================================================

  private selectCandidateForResolution(input: {
    plan: ChatCounterplayPlan;
    playerMessage?: ChatMessage | null;
    selectedCounterplayId?: string | null;
    signal: ChatCounterSignalSnapshot;
    actor: ChatCounterActorSnapshot;
    now: UnixMs;
  }): ChatCounterCandidate | null {
    const ranked = input.plan.rankedCandidates;
    if (ranked.length === 0) return null;

    if (input.selectedCounterplayId) {
      const explicit = ranked.find((candidate) => candidate.counterplayId === input.selectedCounterplayId);
      if (explicit) return explicit;
    }

    if (!input.playerMessage) {
      return ranked[0] ?? null;
    }

    const interpreted = interpretPlayerMessage(input.playerMessage.plainText, input.signal);
    const rescored = ranked.map((candidate) => {
      const textualBoost = textualAlignmentBoost(candidate.move, interpreted, input.playerMessage?.plainText ?? '');
      const score = clamp01(Number(candidate.score01) + textualBoost);
      return {
        ...candidate,
        score01: toContractScore01(score),
        riskAdjustedScore01: toContractScore01(Math.max(0, Number(candidate.riskAdjustedScore01) + textualBoost * 0.75)),
        notes: Object.freeze([...candidate.notes, `textualBoost=${textualBoost.toFixed(3)}`]),
      } as ChatCounterCandidate;
    });

    return rankCounterCandidates(rescored)[0] ?? null;
  }

  private resolveWithoutCandidate(
    request: ChatCounterResolveRequest,
    resolvedAt: UnixMs,
  ): ChatCounterplayResolution {
    const failureReason = deriveForcedFailureReason(request.forceCloseReason);
    return {
      counterplayId: (`counter:forced:${request.binding.windowId}`) as any,
      windowId: request.binding.windowId,
      resolvedAt,
      succeeded: false,
      efficacyBand: 'WHIFF',
      validationStatus: 'AUTHORITATIVE_REJECT',
      pressureReliefScore: toContractScore100(0),
      embarrassmentSwingScore: toContractScore100(0),
      dominanceSwingScore: toContractScore100(0),
      trustGainScore: toContractScore100(0),
      reputationDeltaScore: toContractScore100(0),
      consumedWindow: true,
      legendQualified: false,
      likelyMemoryEvent: null,
      failureReason,
      receipt: null,
      notes: Object.freeze([
        'Resolved without a ranked candidate.',
        request.forceCloseReason ? `forceClose=${request.forceCloseReason}` : 'player message missing',
      ]),
    };
  }

  private now(): UnixMs {
    return asUnixMs(this.clock.now());
  }
}

export function createChatCounterResolver(options: ChatCounterResolverOptions = {}): ChatCounterResolver {
  return new ChatCounterResolver(options);
}


// ============================================================================
// MARK: Runtime context + validation helpers
// ============================================================================

function score01To100(value: number): number {
  return value * 100;
}

function coerceMessageId(value: string | null | undefined): Nullable<ChatMessageId> {
  return value ? (value as ChatMessageId) : null;
}

function selectLearningProfile(state: ChatState, userId: string): Nullable<ChatLearningProfile> {
  const profile = state.learningProfiles[userId] ?? null;
  return (profile as Nullable<ChatLearningProfile>);
}

function selectAudienceHeat(
  source: ChatCounterSourceContext,
  signal: ChatCounterSignalSnapshot,
): Nullable<ChatAudienceHeat> {
  const signalRecord = source.signal as unknown as Readonly<Record<string, unknown>> | null | undefined;
  const roomRecord = source.room as unknown as Readonly<Record<string, unknown>>;
  const direct = (signalRecord?.['audienceHeat'] ?? roomRecord['audienceHeat'] ?? null) as Nullable<ChatAudienceHeat>;
  if (direct) return direct;

  return ({
    roomId: source.room.roomId,
    channelId: source.room.activeVisibleChannel,
    witnessScore100: clamp100(score01To100(Number(signal.publicWitness01))),
    hostilityScore100: clamp100(score01To100(Number(signal.humiliationRisk01))),
    volatilityScore100: clamp100(score01To100(Number(signal.trapLikelihood01))),
  } as unknown) as ChatAudienceHeat;
}

function selectInferenceSnapshot(source: ChatCounterSourceContext): Nullable<ChatInferenceSnapshot> {
  const signalRecord = source.signal as unknown as Readonly<Record<string, unknown>> | null | undefined;
  const stateRecord = source.state as unknown as Readonly<Record<string, unknown>>;
  return (signalRecord?.['inference'] ?? stateRecord['chatInferenceSnapshot'] ?? null) as Nullable<ChatInferenceSnapshot>;
}

function selectAssignedBotId(source: ChatCounterSourceContext): Nullable<BotId> {
  const signalRecord = source.signal as unknown as Readonly<Record<string, unknown>> | null | undefined;
  const rescueRecord = source.rescue as unknown as Readonly<Record<string, unknown>> | null | undefined;
  const roomRecord = source.room as unknown as Readonly<Record<string, unknown>>;
  const candidate = signalRecord?.['botId'] ?? rescueRecord?.['botId'] ?? roomRecord['botId'] ?? null;
  return candidate ? (candidate as BotId) : null;
}

function deriveWindowValidationStatus(
  window: ChatCounterWindow,
  signal: ChatCounterSignalSnapshot,
  source: ChatCounterSourceContext,
): ChatCounterValidationStatus {
  const now = Number(source.now ?? asUnixMs(Date.now()));
  if (now >= Number(window.closesAt)) return 'WINDOW_CLOSED';
  if (window.allowsProofSpike && Number(signal.proofAdvantage01) >= 0.52) return 'REQUIRES_PROOF';
  if (window.allowsQuoteTurn && Number(signal.quoteAdvantage01) >= 0.52) return 'REQUIRES_QUOTE';
  if (window.allowsSilence && Number(signal.silenceValue01) >= 0.68) return 'REQUIRES_SILENCE';
  if (window.requiresVisibleReply && Number(signal.closeWindowRisk01) >= 0.72) return 'REQUIRES_TIMING';
  return 'WINDOW_OPEN';
}

function deriveCandidateValidationStatus(
  window: ChatCounterWindow,
  move: ChatCounterMove,
  signal: ChatCounterSignalSnapshot,
  context: ChatCounterRuntimeContext,
): ChatCounterValidationStatus {
  if (context.validationStatus === 'WINDOW_CLOSED') return 'WINDOW_CLOSED';
  if (move.requiresProof && !move.proofHash) return 'REQUIRES_PROOF';
  if (move.requiresQuote && !move.quoteReference) return 'REQUIRES_QUOTE';
  if (move.canBeSilent && !move.requiresVisibleReply && Number(signal.silenceValue01) >= 0.60) return 'REQUIRES_SILENCE';
  if (window.requiresVisibleReply && !move.recommendedReplyText && !move.canBeSilent) return 'REQUIRES_TIMING';
  if (Number(signal.closeWindowRisk01) >= 0.94) return 'WINDOW_CLOSED';
  if (Number(signal.helperNeed01) >= 0.72 && move.kind !== 'HELPER_ASSIST' && context.assignedBotId) return 'BLOCKED_BY_POLICY';
  if (Number(signal.trapLikelihood01) >= 0.84 && move.riskBand === 'DANGEROUS') return 'AUTHORITATIVE_REJECT';
  if (Number(signal.publicWitness01) >= 0.56 || Number(signal.proofAdvantage01) >= 0.54 || Number(signal.quoteAdvantage01) >= 0.54) {
    return 'AUTHORITATIVE_ACCEPT';
  }
  return 'WINDOW_OPEN';
}

// ============================================================================
// MARK: Ledger helpers
// ============================================================================

function appendPlanToLedger(
  ledger: ChatCounterplayLedger,
  window: ChatCounterWindow,
  plan: ChatCounterplayPlan,
  now: UnixMs,
): ChatCounterplayLedger {
  return {
    ...ledger,
    openWindows: Object.freeze([
      window,
      ...ledger.openWindows.filter((candidate) => candidate.windowId !== window.windowId),
    ]),
    pendingPlans: Object.freeze([
      plan,
      ...ledger.pendingPlans.filter((candidate) => candidate.windowId !== plan.windowId),
    ]),
    lastUpdatedAt: now,
  };
}

function appendResolutionToLedger(
  ledger: ChatCounterplayLedger,
  plan: ChatCounterplayPlan,
  resolution: ChatCounterplayResolution,
  now: UnixMs,
): ChatCounterplayLedger {
  return {
    ...ledger,
    openWindows: Object.freeze(ledger.openWindows.filter((window) => window.windowId !== plan.windowId)),
    pendingPlans: Object.freeze(ledger.pendingPlans.filter((pending) => pending.windowId !== plan.windowId)),
    recentResolutions: Object.freeze([
      resolution,
      ...ledger.recentResolutions,
    ].slice(0, 32)),
    lastUpdatedAt: now,
  };
}

// ============================================================================
// MARK: Derivation helpers
// ============================================================================

function deriveBaseWindowMs(attack: ChatBossAttack, policy: ChatCounterResolverPolicy): number {
  let duration = policy.defaultWindowMs;
  if (attack.timeboxedMs != null) duration = Math.min(duration, Number(attack.timeboxedMs));
  if (attack.proofWeighted) duration += policy.proofWindowBonusMs;
  if (attack.quoteWeighted) duration += policy.quoteWindowBonusMs;
  if (attack.allowsHelperAssistance) duration += policy.helperAssistBonusMs;
  if (attack.severity === 'CRITICAL') duration -= 600;
  if (attack.severity === 'EXECUTION') duration -= 1_100;
  return clampNumber(duration, policy.minimumWindowMs, policy.maximumWindowMs);
}

function deriveIdealResponseAt(openedAt: UnixMs, closesAt: UnixMs, attack: ChatBossAttack): UnixMs {
  const open = Number(openedAt);
  const close = Number(closesAt);
  const window = close - open;
  if (attack.severity === 'EXECUTION') return asUnixMs(open + Math.floor(window * 0.35));
  if (attack.attackClass === 'SILENCE_BAIT') return asUnixMs(open + Math.floor(window * 0.6));
  if (attack.attackClass === 'DEAL_ROOM_SQUEEZE') return asUnixMs(open + Math.floor(window * 0.45));
  return asUnixMs(open + Math.floor(window * 0.5));
}

function deriveWindowRiskBand(attack: ChatBossAttack): ChatCounterRiskBand {
  if (attack.severity === 'EXECUTION') return 'DANGEROUS';
  if (attack.attackClass === 'PUBLIC_SHAME' || attack.attackClass === 'CROWD_SIGNAL') return 'VOLATILE';
  if (attack.attackClass === 'DEAL_ROOM_SQUEEZE') return 'MEASURED';
  return 'SAFE';
}

function selectAffect(state: ChatState, userId: string): ChatAffectSnapshot | null {
  return state.learningProfiles[userId]?.affect ?? null;
}

function selectPrimaryRelationship(
  state: ChatState,
  roomId: ChatRoomId,
  userId: string,
  actorId: string,
): ChatRelationshipState | null {
  const relationships = Object.values(state.relationships) as ChatRelationshipState[];
  return relationships.find((relationship) =>
    relationship.roomId === roomId && relationship.userId === userId && relationship.actorId === actorId,
  ) ?? null;
}

function deriveWitness01(state: ChatState, roomId: ChatRoomId, channelId: ChatVisibleChannel): Score01 {
  const roomSessions = state.roomSessions.byRoom[roomId] ?? [];
  const channelBoost = channelId === 'GLOBAL' || channelId === 'LOBBY' ? 0.18 : channelId === 'DEAL_ROOM' ? 0.08 : 0.02;
  return clamp01(Math.min(1, roomSessions.length / 8) + channelBoost);
}

function deriveHumiliationRisk01(
  source: ChatCounterSourceContext,
  attack: ChatBossAttack,
  relationship: ChatRelationshipState | null,
  publicWitness01: Score01,
): Score01 {
  const affect = selectAffect(source.state, source.session.identity.userId);
  const base =
    Number(publicWitness01) * 0.34 +
    Number(affect?.embarrassment01 ?? 0.28) * 0.26 +
    Number(relationship?.contempt01 ?? 0.2) * 0.18 +
    Number(relationship?.rivalry01 ?? 0.24) * 0.12 +
    (attack.attackClass === 'PUBLIC_SHAME' ? 0.18 : 0) +
    (attack.crowdAmplified ? 0.10 : 0);
  return clamp01(base);
}

function deriveBluffLikelihood01(
  signal: ChatSignalEnvelope | null | undefined,
  attack: ChatBossAttack,
  sourceMessage: ChatMessage | null | undefined,
): Score01 {
  const base =
    Number(signal?.economy?.bluffRisk01 ?? 0.2) * 0.45 +
    (attack.attackClass === 'FALSE_RESPECT' ? 0.18 : 0) +
    (attack.attackClass === 'DEAL_ROOM_SQUEEZE' ? 0.14 : 0) +
    (sourceMessage?.plainText.includes('easy') ? 0.08 : 0);
  return clamp01(base);
}

function deriveTrapLikelihood01(
  attack: ChatBossAttack,
  signal: ChatSignalEnvelope | null | undefined,
  relationship: ChatRelationshipState | null,
): Score01 {
  const base =
    (attack.attackClass === 'QUOTE_TRAP' ? 0.34 : 0.12) +
    (attack.attackClass === 'SILENCE_BAIT' ? 0.22 : 0) +
    Number(relationship?.fascination01 ?? 0.2) * 0.18 +
    Number(signal?.battle?.hostileMomentum ?? 40) / 100 * 0.18;
  return clamp01(base);
}

function deriveCloseWindowRisk01(
  round: ChatBossRound,
  source: ChatCounterSourceContext,
  publicWitness01: Score01,
): Score01 {
  const now = Number(source.now ?? asUnixMs(Date.now()));
  const total = Math.max(1, Number(round.closesAt) - Number(round.openedAt));
  const elapsed = Math.max(0, now - Number(round.openedAt));
  const elapsed01 = elapsed / total;
  return clamp01(elapsed01 * 0.62 + Number(publicWitness01) * 0.18 + (round.attack.severity === 'EXECUTION' ? 0.16 : 0));
}

function deriveProofAdvantage01(
  attack: ChatBossAttack,
  sourceMessage: ChatMessage | null | undefined,
  signal: ChatSignalEnvelope | null | undefined,
): Score01 {
  const hasProof = sourceMessage?.proof?.proofHash ? 0.34 : 0;
  const economyBias = Number(signal?.economy?.overpayRisk01 ?? 0.15) * (attack.attackClass === 'DEAL_ROOM_SQUEEZE' ? 0.28 : 0.14);
  return clamp01(hasProof + economyBias + (attack.proofWeighted ? 0.22 : 0.08));
}

function deriveQuoteAdvantage01(sourceMessage: ChatMessage | null | undefined, attack: ChatBossAttack): Score01 {
  const quoted = sourceMessage?.plainText?.length ? 0.24 : 0;
  const attackBias = attack.quoteWeighted ? 0.30 : attack.attackClass === 'QUOTE_TRAP' ? 0.22 : 0.08;
  return clamp01(quoted + attackBias);
}

function deriveSilenceValue01(
  source: ChatCounterSourceContext,
  attack: ChatBossAttack,
  affect: ChatAffectSnapshot | null,
  publicWitness01: Score01,
): Score01 {
  const base =
    (attack.allowsSilenceOutplay ? 0.34 : 0.04) +
    Number(affect?.frustration01 ?? 0.18) * 0.16 +
    Number(affect?.intimidation01 ?? 0.16) * 0.10 +
    (source.room.activeVisibleChannel === 'DEAL_ROOM' ? 0.12 : 0) -
    Number(publicWitness01) * 0.08;
  return clamp01(base);
}

function deriveHelperNeed01(
  source: ChatCounterSourceContext,
  affect: ChatAffectSnapshot | null,
  humiliationRisk01: Score01,
  relationship: ChatRelationshipState | null,
): Score01 {
  const base =
    (source.rescue?.triggered ? 0.34 : 0) +
    Number(source.state.learningProfiles[source.session.identity.userId]?.churnRisk01 ?? 0.18) * 0.24 +
    Number(affect?.frustration01 ?? 0.15) * 0.18 +
    Number(humiliationRisk01) * 0.14 +
    Number(relationship?.rescueDebt01 ?? 0.04) * 0.12;
  return clamp01(base);
}

function dominantThreatTag(
  attack: ChatBossAttack,
  humiliationRisk01: Score01,
  proofAdvantage01: Score01,
  quoteAdvantage01: Score01,
): string {
  if (Number(proofAdvantage01) >= 0.6) return 'PROOF_RACE';
  if (Number(quoteAdvantage01) >= 0.6) return 'QUOTE_TURN';
  if (Number(humiliationRisk01) >= 0.65) return 'PUBLIC_HUMILIATION';
  return attack.attackClass;
}

function shouldForceHelperSuggestion(source: ChatCounterSourceContext, signal: ChatCounterSignalSnapshot): boolean {
  return Boolean(source.rescue?.triggered) || Number(signal.helperNeed01) >= 0.62;
}

function sanitizeDraft(text: string | null | undefined): string | null {
  const next = text?.trim();
  return next ? next.slice(0, 320) : null;
}

function createQuoteReference(message: ChatMessage | null | undefined): ChatQuoteReference | null {
  if (!message?.plainText) return null;
  return {
    quoteId: message.id as any,
    quotedMessageId: message.id as any,
    quotedSenderName: message.attribution.actorId,
    quotedExcerpt: message.plainText.slice(0, 120),
  } as ChatQuoteReference;
}

function computeDominanceSwing(
  template: ChatCounterSuggestionTemplate,
  signal: ChatCounterSignalSnapshot,
  confidence01: Score01,
): number {
  const base =
    Number(confidence01) * 0.36 +
    Number(signal.publicWitness01) * (template.canEscalateCrowd ? 0.18 : 0.06) +
    Number(signal.quoteAdvantage01) * (template.requiresQuote ? 0.20 : 0.10) +
    Number(signal.proofAdvantage01) * (template.requiresProof ? 0.20 : 0.08);
  return clampNumber(base, 0, 1);
}

function computePressureRelief(
  template: ChatCounterSuggestionTemplate,
  signal: ChatCounterSignalSnapshot,
  silenceWeight: number,
  helperWeight: number,
): number {
  const base =
    Number(signal.closeWindowRisk01) * 0.16 +
    Number(signal.humiliationRisk01) * 0.22 +
    silenceWeight * (template.canBeSilent ? 0.24 : 0.02) +
    helperWeight * (template.kind === 'HELPER_ASSIST' ? 0.28 : 0.05) +
    (template.canReducePressure ? 0.18 : 0.04);
  return clampNumber(base, 0, 1);
}

function computeTrustGain(
  template: ChatCounterSuggestionTemplate,
  signal: ChatCounterSignalSnapshot,
  helperWeight: number,
): number {
  const base =
    (template.kind === 'HELPER_ASSIST' ? 0.20 : 0.06) +
    (template.kind === 'SHIELD_STABILIZE' ? 0.14 : 0) +
    helperWeight * 0.18 +
    Number(signal.humiliationRisk01) * 0.08;
  return clampNumber(base, 0, 1);
}

function computeHumiliationRisk(
  template: ChatCounterSuggestionTemplate,
  signal: ChatCounterSignalSnapshot,
  embarrassment01: Score01,
): number {
  const base =
    Number(embarrassment01) * 0.28 +
    Number(signal.publicWitness01) * (template.canEscalateCrowd ? 0.22 : 0.08) +
    riskPenalty(template.riskBand) * 0.32;
  return clampNumber(base, 0, 1);
}

function computeWindowConsumption(template: ChatCounterSuggestionTemplate, window: ChatCounterWindow): number {
  const visiblePenalty = template.requiresVisibleReply ? 0.16 : 0.04;
  const riskPenaltyValue = riskPenalty(template.riskBand) * 0.26;
  const timingBias = template.timingClass === 'INSTANT' ? 0.18 : template.timingClass === 'FAST' ? 0.12 : 0.08;
  return clampNumber(visiblePenalty + riskPenaltyValue + timingBias + (window.allowsProofSpike && template.requiresProof ? 0.08 : 0), 0, 1);
}

function confidenceModifier(intent: ChatCounterIntent): number {
  switch (intent) {
    case 'REVERSE':
    case 'EXPOSE':
      return 1.0;
    case 'ESCAPE':
    case 'RESCUE':
    case 'QUIET_RESET':
      return 0.82;
    case 'HYPE':
      return 0.94;
    default:
      return 0.88;
  }
}

function chooseSurface(template: ChatCounterSuggestionTemplate, window: ChatCounterWindow): any {
  if (!template.requiresVisibleReply && template.canBeSilent) return 'SHADOW_QUEUE';
  if (template.kind === 'HELPER_ASSIST') return 'HELPER_BANNER';
  if (template.requiresProof) return 'PROOF_CARD';
  if (window.channelId === 'DEAL_ROOM' && (template.kind === 'NEGOTIATION_ESCAPE' || template.kind === 'NEGOTIATION_REPRICE')) return 'DEAL_ROOM_ACTION';
  return 'COMPOSER';
}

function chooseToneBand(template: ChatCounterSuggestionTemplate, attackClass: ChatBossAttack['attackClass']): any {
  if (template.kind === 'SHIELD_STABILIZE' || template.kind === 'HELPER_ASSIST') return 'CALM';
  if (template.kind === 'HUMILIATION_REVERSAL' || template.kind === 'LEGEND_COUNTER') return 'SEVERE';
  if (attackClass === 'FALSE_RESPECT') return 'WATCHFUL';
  return 'FIRM';
}

function materializeReplyText(
  template: ChatCounterSuggestionTemplate,
  fight: ChatBossFightPlan,
  round: ChatBossRound,
  playerDraftText: string | null,
): string | null {
  if (playerDraftText) return playerDraftText;

  switch (template.kind) {
    case 'DIRECT_DEFENSE':
      return 'That line does not land. You still have not proved the premise.';
    case 'PROOF_SPIKE':
      return 'Document the claim or withdraw it. The room can read the gap.';
    case 'QUOTE_TURN':
      return 'You are now trapped inside your own earlier line.';
    case 'BLUFF_CALL':
      return 'Show the leverage. If you cannot, this is theater.';
    case 'STALL_BREAK':
      return 'Enough circling. State the real demand.';
    case 'PRESSURE_REDIRECT':
      return `${fight.boss.displayName} is leaning on posture because substance is thinner than the delivery.`;
    case 'HUMILIATION_REVERSAL':
      return 'You tried to make me the spectacle. The room just watched that fail.';
    case 'NEGOTIATION_ESCAPE':
      return 'No deal at this price, and no free performance on the way out.';
    case 'NEGOTIATION_REPRICE':
      return 'Your pressure changed the terms. It did not improve them.';
    case 'HELPER_ASSIST':
      return 'One clean move. Stabilize. Ignore the extra noise.';
    case 'CROWD_REFRAME':
      return `${round.attack.label} only works if the room mistakes volume for control.`;
    case 'SHIELD_STABILIZE':
      return 'Resetting posture. Solving sequence first.';
    case 'EXIT_WINDOW':
      return null;
    case 'SILENT_ABSORB':
      return null;
    case 'LEGEND_COUNTER':
      return 'Receipt attached. Quote attached. Try the line again if you need the lesson twice.';
    default:
      return null;
  }
}

function interpretPlayerMessage(text: string, signal: ChatCounterSignalSnapshot): {
  readonly wantsProof: boolean;
  readonly wantsQuote: boolean;
  readonly wantsSilence: boolean;
  readonly wantsExit: boolean;
  readonly confrontational: boolean;
} {
  const normalized = text.toLowerCase();
  return {
    wantsProof: /proof|show|document|receipt|evidence/.test(normalized) || Number(signal.proofAdvantage01) > 0.7,
    wantsQuote: /you said|earlier|quote|your own/.test(normalized) || Number(signal.quoteAdvantage01) > 0.7,
    wantsSilence: /no reply|silence|not feeding this/.test(normalized),
    wantsExit: /walk away|done here|not taking this|no deal/.test(normalized),
    confrontational: /wrong|lie|prove it|stop|enough/.test(normalized),
  };
}

function textualAlignmentBoost(
  move: ChatCounterMove,
  interpreted: ReturnType<typeof interpretPlayerMessage>,
  rawText: string,
): number {
  let boost = 0;
  if (interpreted.wantsProof && move.requiresProof) boost += 0.18;
  if (interpreted.wantsQuote && move.requiresQuote) boost += 0.18;
  if (interpreted.wantsSilence && move.canBeSilent) boost += 0.22;
  if (interpreted.wantsExit && move.canOpenExitWindow) boost += 0.18;
  if (interpreted.confrontational && (move.intent === 'REVERSE' || move.intent === 'EXPOSE')) boost += 0.14;
  if (rawText.length < 24 && move.kind === 'SILENT_ABSORB') boost += 0.04;
  return clampNumber(boost, 0, 0.35);
}

function compareMoves(a: ChatCounterMove, b: ChatCounterMove, signal: ChatCounterSignalSnapshot): number {
  const aScore = Number(a.estimatedPressureRelief01) * 0.28 + Number(a.estimatedDominanceSwing01) * 0.24 + Number(a.estimatedTrustGain01) * 0.12 + (a.canBecomeLegend ? Number(signal.publicWitness01) * 0.16 : 0);
  const bScore = Number(b.estimatedPressureRelief01) * 0.28 + Number(b.estimatedDominanceSwing01) * 0.24 + Number(b.estimatedTrustGain01) * 0.12 + (b.canBecomeLegend ? Number(signal.publicWitness01) * 0.16 : 0);
  return bScore - aScore;
}

function riskPenalty(riskBand: ChatCounterRiskBand): number {
  switch (riskBand) {
    case 'SAFE':
      return 0.04;
    case 'MEASURED':
      return 0.12;
    case 'VOLATILE':
      return 0.22;
    case 'DANGEROUS':
      return 0.34;
    case 'SUICIDAL':
    default:
      return 0.48;
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mapAttackType(attackType: string | null | undefined): any {
  switch (attackType) {
    case 'LIQUIDATION':
      return 'LIQUIDATION';
    case 'SABOTAGE':
      return 'SABOTAGE';
    case 'COMPLIANCE':
      return 'COMPLIANCE';
    case 'CROWD_SWARM':
      return 'CROWD_SWARM';
    case 'SHADOW_LEAK':
      return 'SHADOW_LEAK';
    case 'TAUNT':
    default:
      return 'TAUNT';
  }
}

function mapCounterplayAttackType(attackType: AttackType): CounterplayAttackType {
  switch (attackType) {
    case 'SABOTAGE':
      return 'SABOTAGE';
    case 'TAUNT':
      return 'TAUNT';
    case 'LIQUIDATION':
      return 'LIQUIDITY_STRIKE';
    case 'COMPLIANCE':
      return 'NEGOTIATION_TRAP';
    case 'CROWD_SWARM':
      return 'CASCADE_PUSH';
    case 'SHADOW_LEAK':
      return 'TELEGRAPH';
    default:
      return 'TAUNT';
  }
}

function mapCounterTiming(value: string | null | undefined): any {
  switch (value) {
    case 'INSTANT':
    case 'FAST':
    case 'BEAT_LOCKED':
    case 'READ_PRESSURE_DELAYED':
    case 'LATE_BUT_VALID':
    case 'POST_SCENE':
    case 'SHADOW_ONLY':
      return value;
    default:
      return 'FAST';
  }
}

function mapPressureTier(value: PressureTier | null | undefined): any {
  switch (value) {
    case 'NONE':
    case 'BUILDING':
    case 'ELEVATED':
    case 'HIGH':
    case 'CRITICAL':
      return value;
    default:
      return null;
  }
}

function mapAffectToContract(affect: ChatAffectSnapshot | null): any {
  if (!affect) return null;
  return {
    confidence: toContractScore01(Number(affect.confidence01)),
    frustration01: toContractScore01(Number(affect.frustration01)),
    intimidation01: toContractScore01(Number(affect.intimidation01)),
    attachment01: toContractScore01(Number(affect.attachment01)),
    curiosity01: toContractScore01(Number(affect.curiosity01)),
    embarrassment01: toContractScore01(Number(affect.embarrassment01)),
    relief01: toContractScore01(Number(affect.relief01)),
  };
}

function summarizeResolution(
  candidate: ChatCounterCandidate | null | undefined,
  resolution: ChatCounterplayResolution,
  forceCloseReason: string | null,
): string {
  if (!candidate) {
    return forceCloseReason
      ? `Counter window closed without a valid answer: ${forceCloseReason}.`
      : 'Counter window closed without a valid answer.';
  }

  if (resolution.succeeded) {
    return `${candidate.move.label} landed as ${resolution.efficacyBand.toLowerCase()} counterplay.`;
  }

  const reason = resolution.failureReason ?? 'unknown failure';
  return `${candidate.move.label} failed: ${reason}.`;
}

function deriveForcedFailureReason(forceCloseReason: string | null | undefined): ChatCounterFailureReason {
  switch (forceCloseReason) {
    case 'window_closed':
      return 'TOO_LATE';
    case 'no_active_window':
      return 'NO_ACTIVE_WINDOW';
    case 'wrong_channel':
      return 'WRONG_CHANNEL';
    case 'system_lockout':
      return 'SYSTEM_LOCKOUT';
    default:
      return 'ATTACK_ALREADY_LANDED';
  }
}

// ============================================================================
// MARK: End
// ============================================================================




