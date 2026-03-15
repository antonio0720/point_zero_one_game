/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ML BARREL + STACK
 * FILE: backend/src/game/engine/chat/ml/index.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Single public entry surface for the backend authoritative chat ML lane.
 *
 * This index does two jobs:
 * 1. it re-exports every model/store/ingestor contract in the lane, and
 * 2. it exposes one coordinated stack that can score the full chain in the
 *    repo-true order:
 *
 *    FeatureIngestor → OnlineFeatureStore → Engagement → Hater → Helper
 *    → Channel → Toxicity → Churn → InterventionPolicy
 *
 * The stack does not become transcript truth and does not bypass policy. It is
 * a composition helper for backend chat authority.
 * ============================================================================
 */

export * from './FeatureIngestor';
export * from './OnlineFeatureStore';
export * from './EngagementModel';
export * from './HaterTargetingModel';
export * from './HelperTimingModel';
export * from './ChannelAffinityModel';
export * from './ToxicityRiskModel';
export * from './ChurnRiskModel';
export * from './InterventionPolicyModel';

import type { JsonValue, Nullable, ChatLearningProfile, ChatSignalEnvelope, ChatRoomId, ChatSessionId, ChatUserId } from '../types';
import {
  type ChatFeatureIngestResult,
  type ChatFeatureRow,
  ChatFeatureIngestor,
  type ChatFeatureIngestorOptions,
} from './FeatureIngestor';
import {
  OnlineFeatureStore,
  type ChatOnlineFeatureAggregate,
  type ChatOnlineFeatureStoreOptions,
  type ChatOnlineFeatureStoreQuery,
  type ChatOnlineInferenceWindow,
} from './OnlineFeatureStore';
import {
  EngagementModel,
  type EngagementModelOptions,
  type EngagementModelPriorState,
  type EngagementModelScore,
} from './EngagementModel';
import {
  HaterTargetingModel,
  type HaterTargetingModelOptions,
  type HaterTargetingPriorState,
  type HaterTargetingScore,
} from './HaterTargetingModel';
import {
  HelperTimingModel,
  type HelperTimingModelOptions,
  type HelperTimingPriorState,
  type HelperTimingScore,
} from './HelperTimingModel';
import {
  ChannelAffinityModel,
  type ChannelAffinityModelOptions,
  type ChannelAffinityPriorState,
  type ChannelAffinityScore,
} from './ChannelAffinityModel';
import {
  ToxicityRiskModel,
  type ToxicityRiskModelOptions,
  type ToxicityRiskPriorState,
  type ToxicityRiskScore,
} from './ToxicityRiskModel';
import {
  ChurnRiskModel,
  type ChurnRiskModelOptions,
  type ChurnRiskPriorState,
  type ChurnRiskScore,
} from './ChurnRiskModel';
import {
  InterventionPolicyModel,
  type InterventionPolicyModelOptions,
  type InterventionPolicyPriorState,
  type InterventionPolicyScore,
} from './InterventionPolicyModel';

export const CHAT_BACKEND_ML_STACK_MODULE_NAME =
  'PZO_BACKEND_CHAT_ML_STACK' as const;

export const CHAT_BACKEND_ML_STACK_VERSION =
  '2026.03.14-backend-chat-ml-stack.v1' as const;

export interface ChatMlStackLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatMlModelStackOptions {
  readonly logger?: ChatMlStackLoggerPort;
  readonly featureIngestor?: ChatFeatureIngestorOptions;
  readonly onlineFeatureStore?: ChatOnlineFeatureStoreOptions;
  readonly engagement?: EngagementModelOptions;
  readonly hater?: HaterTargetingModelOptions;
  readonly helper?: HelperTimingModelOptions;
  readonly channel?: ChannelAffinityModelOptions;
  readonly toxicity?: ToxicityRiskModelOptions;
  readonly churn?: ChurnRiskModelOptions;
  readonly intervention?: InterventionPolicyModelOptions;
}

export interface ChatMlPriorStateBundle {
  readonly engagement?: Nullable<EngagementModelPriorState>;
  readonly hater?: Nullable<HaterTargetingPriorState>;
  readonly helper?: Nullable<HelperTimingPriorState>;
  readonly channel?: Nullable<ChannelAffinityPriorState>;
  readonly toxicity?: Nullable<ToxicityRiskPriorState>;
  readonly churn?: Nullable<ChurnRiskPriorState>;
  readonly intervention?: Nullable<InterventionPolicyPriorState>;
}

export interface ChatMlScoreBundle {
  readonly engagement: EngagementModelScore;
  readonly hater: HaterTargetingScore;
  readonly helper: HelperTimingScore;
  readonly channel: ChannelAffinityScore;
  readonly toxicity: ToxicityRiskScore;
  readonly churn: ChurnRiskScore;
  readonly intervention: InterventionPolicyScore;
}

export interface ChatMlEvaluationContext {
  readonly learningProfile?: Nullable<ChatLearningProfile>;
  readonly sourceSignals?: readonly ChatSignalEnvelope[];
  readonly priors?: ChatMlPriorStateBundle;
}

export interface ChatMlAggregateEvaluation {
  readonly aggregate: ChatOnlineFeatureAggregate;
  readonly scores: ChatMlScoreBundle;
}

export interface ChatMlRowsEvaluation {
  readonly rows: readonly ChatFeatureRow[];
  readonly scores: ChatMlScoreBundle;
}

export interface ChatMlIngestEvaluation {
  readonly ingestResult: ChatFeatureIngestResult;
  readonly storedRowCount: number;
  readonly scores: ChatMlScoreBundle;
}

const DEFAULT_LOGGER: ChatMlStackLoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function entityQueryFromAggregate(aggregate: ChatOnlineFeatureAggregate): ChatOnlineFeatureStoreQuery {
  return {
    roomId: aggregate.roomId ?? undefined,
    sessionId: aggregate.sessionId ?? undefined,
    userId: aggregate.userId ?? undefined,
    entityKey: aggregate.entityKeys[0],
  };
}

export class ChatMlModelStack {
  public readonly featureIngestor: ChatFeatureIngestor;
  public readonly store: OnlineFeatureStore;
  public readonly engagement: EngagementModel;
  public readonly hater: HaterTargetingModel;
  public readonly helper: HelperTimingModel;
  public readonly channel: ChannelAffinityModel;
  public readonly toxicity: ToxicityRiskModel;
  public readonly churn: ChurnRiskModel;
  public readonly intervention: InterventionPolicyModel;
  private readonly logger: ChatMlStackLoggerPort;

  public constructor(options: ChatMlModelStackOptions = {}) {
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.featureIngestor = new ChatFeatureIngestor(options.featureIngestor ?? {});
    this.store = new OnlineFeatureStore(options.onlineFeatureStore ?? {});
    this.engagement = new EngagementModel(options.engagement ?? {});
    this.hater = new HaterTargetingModel(options.hater ?? {});
    this.helper = new HelperTimingModel(options.helper ?? {});
    this.channel = new ChannelAffinityModel(options.channel ?? {});
    this.toxicity = new ToxicityRiskModel(options.toxicity ?? {});
    this.churn = new ChurnRiskModel(options.churn ?? {});
    this.intervention = new InterventionPolicyModel(options.intervention ?? {});
  }

  public evaluateAggregate(
    aggregate: ChatOnlineFeatureAggregate,
    context: ChatMlEvaluationContext = {},
  ): ChatMlAggregateEvaluation {
    const priors = context.priors ?? {};
    const engagement = this.engagement.scoreAggregate(aggregate, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal: context.sourceSignals?.[0] ?? null,
      prior: priors.engagement ?? null,
    });

    const hater = this.hater.scoreAggregate(aggregate, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal: context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      prior: priors.hater ?? null,
    });

    const helper = this.helper.scoreAggregate(aggregate, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal: context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      hater,
      haterPrior: priors.hater ?? null,
      prior: priors.helper ?? null,
    });

    const channel = this.channel.scoreAggregate(aggregate, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal: context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      hater,
      haterPrior: priors.hater ?? null,
      helper,
      helperPrior: priors.helper ?? null,
      prior: priors.channel ?? null,
    });

    const toxicity = this.toxicity.scoreAggregate({
      aggregate,
      engagementScore: engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore: hater,
      haterPriorState: priors.hater ?? null,
      helperScore: helper,
      helperPriorState: priors.helper ?? null,
      channelScore: channel,
      channelPriorState: priors.channel ?? null,
      signals: context.sourceSignals ?? [],
    }).score;

    const churn = this.churn.scoreAggregate({
      aggregate,
      engagementScore: engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore: hater,
      haterPriorState: priors.hater ?? null,
      helperScore: helper,
      helperPriorState: priors.helper ?? null,
      channelScore: channel,
      channelPriorState: priors.channel ?? null,
      toxicityScore: toxicity,
      toxicityPriorState: priors.toxicity ?? null,
      signals: context.sourceSignals ?? [],
    }).score;

    const intervention = this.intervention.scoreAggregate({
      aggregate,
      learningProfile: context.learningProfile ?? null,
      sourceSignals: context.sourceSignals ?? [],
      engagementScore: engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore: hater,
      haterPriorState: priors.hater ?? null,
      helperScore: helper,
      helperPriorState: priors.helper ?? null,
      channelScore: channel,
      channelPriorState: priors.channel ?? null,
      toxicityScore: toxicity,
      toxicityPriorState: priors.toxicity ?? null,
      churnScore: churn,
      churnPriorState: priors.churn ?? null,
      prior: priors.intervention ?? null,
    }).score;

    const scores = Object.freeze({
      engagement,
      hater,
      helper,
      channel,
      toxicity,
      churn,
      intervention,
    }) satisfies ChatMlScoreBundle;

    this.logger.debug('chat_ml_stack_evaluate_aggregate', {
      roomId: aggregate.roomId,
      userId: aggregate.userId,
      intervention: intervention.recommendation,
    });

    return Object.freeze({ aggregate, scores });
  }

  public evaluateRows(
    rows: readonly ChatFeatureRow[],
    context: ChatMlEvaluationContext & { readonly generatedAt?: number } = {},
  ): ChatMlRowsEvaluation {
    const priors = context.priors ?? {};
    const engagement = this.engagement.scoreRows(rows, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal: context.sourceSignals?.[0] ?? null,
      prior: priors.engagement ?? null,
    });

    const hater = this.hater.scoreRows(rows, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal: context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      prior: priors.hater ?? null,
    });

    const helper = this.helper.scoreRows(rows, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal: context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      hater,
      haterPrior: priors.hater ?? null,
      prior: priors.helper ?? null,
    });

    const channel = this.channel.scoreRows(rows, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal: context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      hater,
      haterPrior: priors.hater ?? null,
      helper,
      helperPrior: priors.helper ?? null,
      prior: priors.channel ?? null,
    });

    const toxicity = this.toxicity.scoreRows({
      rows,
      generatedAt: context.generatedAt,
      engagementScore: engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore: hater,
      haterPriorState: priors.hater ?? null,
      helperScore: helper,
      helperPriorState: priors.helper ?? null,
      channelScore: channel,
      channelPriorState: priors.channel ?? null,
      signals: context.sourceSignals ?? [],
    }).score;

    const churn = this.churn.scoreRows({
      rows,
      generatedAt: context.generatedAt,
      engagementScore: engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore: hater,
      haterPriorState: priors.hater ?? null,
      helperScore: helper,
      helperPriorState: priors.helper ?? null,
      channelScore: channel,
      channelPriorState: priors.channel ?? null,
      toxicityScore: toxicity,
      toxicityPriorState: priors.toxicity ?? null,
      signals: context.sourceSignals ?? [],
    }).score;

    const intervention = this.intervention.scoreRows({
      rows,
      generatedAt: context.generatedAt,
      learningProfile: context.learningProfile ?? null,
      sourceSignals: context.sourceSignals ?? [],
      engagementScore: engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore: hater,
      haterPriorState: priors.hater ?? null,
      helperScore: helper,
      helperPriorState: priors.helper ?? null,
      channelScore: channel,
      channelPriorState: priors.channel ?? null,
      toxicityScore: toxicity,
      toxicityPriorState: priors.toxicity ?? null,
      churnScore: churn,
      churnPriorState: priors.churn ?? null,
      prior: priors.intervention ?? null,
    }).score;

    return Object.freeze({
      rows,
      scores: Object.freeze({
        engagement,
        hater,
        helper,
        channel,
        toxicity,
        churn,
        intervention,
      }),
    });
  }

  public evaluateStore(
    query: ChatOnlineFeatureStoreQuery,
    context: ChatMlEvaluationContext = {},
  ): ChatMlAggregateEvaluation {
    const aggregate = this.store.aggregate(query);
    return this.evaluateAggregate(aggregate, context);
  }

  public evaluateInferenceWindow(
    window: ChatOnlineInferenceWindow,
    identity: {
      readonly roomId?: Nullable<ChatRoomId>;
      readonly sessionId?: Nullable<ChatSessionId>;
      readonly userId?: Nullable<ChatUserId>;
    } = {},
    context: ChatMlEvaluationContext = {},
  ): ChatMlAggregateEvaluation {
    const query: ChatOnlineFeatureStoreQuery = {
      roomId: identity.roomId ?? undefined,
      sessionId: identity.sessionId ?? undefined,
      userId: identity.userId ?? undefined,
      entityKey: undefined,
    };
    const fallbackAggregate = this.store.aggregate(query);
    const scores = this.evaluateAggregate(fallbackAggregate, context).scores;

    const intervention = this.intervention.scoreInferenceWindow({
      window,
      roomId: identity.roomId ?? null,
      sessionId: identity.sessionId ?? null,
      userId: identity.userId ?? null,
      learningProfile: context.learningProfile ?? null,
      sourceSignals: context.sourceSignals ?? [],
      engagementScore: scores.engagement,
      engagementPriorState: context.priors?.engagement ?? null,
      haterScore: scores.hater,
      haterPriorState: context.priors?.hater ?? null,
      helperScore: scores.helper,
      helperPriorState: context.priors?.helper ?? null,
      channelScore: scores.channel,
      channelPriorState: context.priors?.channel ?? null,
      toxicityScore: scores.toxicity,
      toxicityPriorState: context.priors?.toxicity ?? null,
      churnScore: scores.churn,
      churnPriorState: context.priors?.churn ?? null,
      prior: context.priors?.intervention ?? null,
    }).score;

    return Object.freeze({
      aggregate: fallbackAggregate,
      scores: Object.freeze({ ...scores, intervention }),
    });
  }

  public appendIngestResult(ingestResult: ChatFeatureIngestResult): number {
    this.store.upsert(ingestResult);
    return this.store.stats().rowCount;
  }

  public ingestAndEvaluate(
    ingestResult: ChatFeatureIngestResult,
    context: ChatMlEvaluationContext = {},
  ): ChatMlIngestEvaluation {
    const storedRowCount = this.appendIngestResult(ingestResult);
    const aggregate = this.store.aggregate({
      roomId: ingestResult.roomId ?? undefined,
      sessionId: ingestResult.sessionId ?? undefined,
      userId: ingestResult.userId ?? undefined,
    });
    const evaluation = this.evaluateAggregate(aggregate, context);
    return Object.freeze({ ingestResult, storedRowCount, scores: evaluation.scores });
  }

  public priorsFromScores(scores: ChatMlScoreBundle): ChatMlPriorStateBundle {
    return Object.freeze({
      engagement: this.engagement.toPriorState(scores.engagement),
      hater: this.hater.toPriorState(scores.hater),
      helper: this.helper.toPriorState(scores.helper),
      channel: this.channel.toPriorState(scores.channel),
      toxicity: {
        generatedAt: scores.toxicity.generatedAt,
        toxicity01: scores.toxicity.toxicity01,
        escalation01: scores.toxicity.escalation01,
        moderationSensitivity01: scores.toxicity.moderationSensitivity01,
      },
      churn: {
        generatedAt: scores.churn.generatedAt,
        churnRisk01: scores.churn.churnRisk01,
        withdrawalRisk01: scores.churn.withdrawalRisk01,
        rageQuitRisk01: scores.churn.rageQuitRisk01,
      },
      intervention: this.intervention.toPriorState(scores.intervention),
    });
  }
}

export function createChatMlModelStack(
  options: ChatMlModelStackOptions = {},
): ChatMlModelStack {
  return new ChatMlModelStack(options);
}

export const CHAT_BACKEND_ML_STACK_NAMESPACE = Object.freeze({
  moduleName: CHAT_BACKEND_ML_STACK_MODULE_NAME,
  moduleVersion: CHAT_BACKEND_ML_STACK_VERSION,
  createChatMlModelStack,
  ChatFeatureIngestor,
  OnlineFeatureStore,
  EngagementModel,
  HaterTargetingModel,
  HelperTimingModel,
  ChannelAffinityModel,
  ToxicityRiskModel,
  ChurnRiskModel,
  InterventionPolicyModel,
});

export default ChatMlModelStack;
