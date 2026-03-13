/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE BATTLE ADAPTER
 * FILE: pzo-web/src/engines/chat/adapters/BattleEngineAdapter.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical adapter that translates the real frontend battle donor lane into
 * the canonical frontend chat engine spine.
 *
 * Why this file exists
 * --------------------
 * The battle lane in this repo already has a public engine, a fixed bot
 * registry, a budget model, a shield-facing attack model, and a canonical
 * outbound EventBus contract. Chat should not create a second battle language.
 * It should consume battle truth, preserve battle semantics, and translate that
 * truth into:
 *   - social witness,
 *   - helper timing,
 *   - hater pressure,
 *   - invasion escalation,
 *   - channel routing,
 *   - tactical recommendations,
 *   - and minimal system witness when the higher-order directors choose silence.
 *
 * Repo truths preserved here
 * --------------------------
 * - BattleEngine.ts is already the public API and Step 4 owner for bot
 *   processing, pending attack registration, and snapshot emission.
 * - BattleUXBridge.ts is already the only outbound EventBus channel for battle.
 * - BattleUXBridge emits BOT_STATE_CHANGED, BOT_ATTACK_FIRED,
 *   BOT_NEUTRALIZED, COUNTER_INTEL_AVAILABLE, BATTLE_BUDGET_UPDATED,
 *   BUDGET_ACTION_EXECUTED, SYNDICATE_DUEL_RESULT, and
 *   BATTLE_SNAPSHOT_UPDATED.
 * - BotProfileRegistry.ts already defines the five adversaries:
 *   THE LIQUIDATOR, THE BUREAUCRAT, THE MANIPULATOR, THE CRASH PROPHET,
 *   and THE LEGACY HEIR.
 * - The chat engine owns emotional orchestration; the battle engine owns battle
 *   truth. This file keeps that boundary intact.
 *
 * What this adapter owns
 * ----------------------
 * - battle EventBus compatibility
 * - snapshot normalization
 * - bot identity continuity
 * - event dedup and saturation protection
 * - routing into ChatChannelPolicy
 * - escalation into ChatInvasionDirector
 * - social handling into ChatNpcDirector
 * - optional transcript witness / notification mirror / socket mirror
 * - tactical recommendation generation
 *
 * Design laws
 * -----------
 * - Preserve battle words. Do not genericize them.
 * - Bot attacks are not flavor. They are battle truth made social.
 * - Not every event becomes an invasion.
 * - Not every silence should be filled.
 * - The adapter may stage immediate client-side witness, but it never rewrites
 *   battle consequences or long-term truth.
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 * ============================================================================
 */

import {
  ChatSocketClient,
  type ChatChannel,
  type ChatGameEventIntent,
  type ChatMessage,
  type ChatMessageKind,
  type ChatSabotageEvent,
} from '../ChatSocketClient';

import {
  ChatChannelPolicy,
  type ChatModeSnapshot,
} from '../ChatChannelPolicy';

import {
  ChatInvasionDirector,
  type ChatInvasionPlan,
} from '../ChatInvasionDirector';

import {
  ChatNpcDirector,
  type ChatNpcPlan,
} from '../ChatNpcDirector';

import {
  ChatNotificationController,
  type ChatNotificationSeverity,
} from '../ChatNotificationController';

import {
  ChatTranscriptBuffer,
} from '../ChatTranscriptBuffer';

// -----------------------------------------------------------------------------
// Battle-domain compatibility surface
// -----------------------------------------------------------------------------

export type BattleBotId =
  | 'BOT_01'
  | 'BOT_02'
  | 'BOT_03'
  | 'BOT_04'
  | 'BOT_05';

export type BattleBotState =
  | 'DORMANT'
  | 'WATCHING'
  | 'TARGETING'
  | 'ATTACKING'
  | 'RETREATING'
  | 'NEUTRALIZED';

export type BattleAttackType =
  | 'ASSET_STRIP'
  | 'REGULATORY_ATTACK'
  | 'FINANCIAL_SABOTAGE'
  | 'REPUTATION_ATTACK'
  | 'EXPENSE_INJECTION'
  | 'OPPORTUNITY_KILL'
  | string;

export type BattleActionType =
  | 'SHIELD_REPAIR_BOOST'
  | 'THREAT_DELAY'
  | 'DECOY_CARD'
  | 'COUNTER_SABOTAGE'
  | 'HATER_DISTRACTION'
  | 'COUNTER_EVIDENCE_FILE'
  | 'INCOME_REINFORCE'
  | 'ALLIANCE_SIGNAL';

export type BattleIncomeTier =
  | 'SURVIVAL'
  | 'STABILITY'
  | 'MOMENTUM'
  | 'LEVERAGE'
  | 'SOVEREIGN';

export type BattleInjectionType =
  | 'FORCED_SALE'
  | 'REGULATORY_HOLD'
  | 'INVERSION_CURSE'
  | 'EXPENSE_SPIKE'
  | 'DILUTION_NOTICE'
  | 'HATER_HEAT_SURGE';

export type BattleEventName =
  | 'BOT_STATE_CHANGED'
  | 'BOT_ATTACK_FIRED'
  | 'BOT_NEUTRALIZED'
  | 'COUNTER_INTEL_AVAILABLE'
  | 'BATTLE_BUDGET_UPDATED'
  | 'BUDGET_ACTION_EXECUTED'
  | 'SYNDICATE_DUEL_RESULT'
  | 'BATTLE_SNAPSHOT_UPDATED';

export type BattleThreatBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BattleNarrativeWeight = 'AMBIENT' | 'TACTICAL' | 'PREDATORY' | 'INVASION';

export interface BattleBotProfile {
  readonly id: BattleBotId;
  readonly name: string;
  readonly archetype: string;
  readonly primaryAttackType: BattleAttackType;
  readonly secondaryAttackType: BattleAttackType | null;
  readonly targetLayerId: string;
  readonly secondaryTargetLayerId: string | null;
  readonly attackPowerMin: number;
  readonly attackPowerMax: number;
  readonly secondaryPowerMin: number;
  readonly secondaryPowerMax: number;
  readonly watchingHeatThreshold: number;
  readonly targetingHeatThreshold: number;
  readonly attackingHeatThreshold: number;
  readonly retreatTicks: number;
  readonly neutralizedTicks: number;
  readonly counterEvidenceCardType: string;
  readonly attackDialogue: string;
  readonly retreatDialogue: string;
  readonly consequenceText: string;
  readonly escalationConditionDescription: string;
}

export interface BattleBotRuntimeState {
  readonly profileId: BattleBotId;
  readonly state: BattleBotState;
  readonly stateEnteredAtTick?: number;
  readonly retreatTicksRemaining?: number;
  readonly neutralizedTicksRemaining?: number;
  readonly preloadedArrivalTick?: number | null;
  readonly preloadedAttackPower?: number | null;
  readonly damageReductionPct?: number;
  readonly damageReductionTicksRemaining?: number;
  readonly attacksThisRun?: number;
  readonly lastStateBeforeNeutralized?: BattleBotState;
}

export interface BattleBudgetAction {
  readonly actionId: string;
  readonly actionType: BattleActionType;
  readonly targetBotId: BattleBotId | null;
  readonly targetLayerId: string | null;
  readonly cost: number;
  readonly tickNumber: number;
}

export interface BattleBudgetState {
  readonly incomeTier: BattleIncomeTier;
  readonly totalPts: number;
  readonly remainingPts: number;
  readonly spentPts: number;
  readonly tickNumber: number;
  readonly actionsExecutedThisTick: BattleActionType[];
}

export interface BattleInjectedCard {
  readonly injectionId: string;
  readonly injectionType: BattleInjectionType;
  readonly sourceBotId: BattleBotId;
  readonly cardName: string;
  readonly timerTicks: number;
  readonly ticksRemaining: number;
  readonly isMitigated: boolean;
  readonly isExpired: boolean;
  readonly injectedAtTick: number;
}

export interface BattleAttackEvent {
  readonly attackId: string;
  readonly botId: BattleBotId;
  readonly attackType: BattleAttackType;
  readonly targetLayerId?: string;
  readonly secondaryAttackType?: BattleAttackType | null;
  readonly secondaryTargetLayerId?: string | null;
  readonly rawPower?: number;
  readonly secondaryRawPower?: number;
  readonly isCritical?: boolean;
  readonly tickNumber?: number;
  readonly sourceHaterId?: string;
}

export interface BattleSyndicateDuel {
  readonly duelId: string;
  readonly challengerSyndicateId: string;
  readonly defenderSyndicateId: string;
  readonly declaredAt: number;
  readonly endsAt: number;
  readonly state: string;
  readonly challengerScore: number;
  readonly defenderScore: number;
  readonly currentChallenge: number;
  readonly winnerSyndicateId: string | null;
}

export interface BattleSnapshot {
  readonly bots: Record<string, BattleBotRuntimeState>;
  readonly budget?: BattleBudgetState;
  readonly activeBotsCount?: number;
  readonly injectedCards?: readonly BattleInjectedCard[];
  readonly haterHeat?: number;
  readonly activeDuel?: BattleSyndicateDuel | null;
  readonly tickNumber?: number;
  readonly timestamp?: number;
}

export interface BattleBotStateChangedPayload {
  readonly botId: BattleBotId;
  readonly from: BattleBotState;
  readonly to: BattleBotState;
}

export interface BattleBudgetUpdatedPayload {
  readonly remaining: number;
  readonly spent: number;
  readonly tickBudget: number;
}

export interface BattleNeutralizedPayload {
  readonly botId: BattleBotId;
  readonly immunityTicks?: number;
}

export interface BattleCounterIntelPayload {
  readonly botId: BattleBotId;
  readonly attackProfile?: Record<string, unknown>;
  readonly tier?: string;
}

export interface BattleSyndicateDuelResultPayload {
  readonly duelId: string;
  readonly winnerId: string;
  readonly loserId: string;
  readonly reward?: Record<string, unknown>;
}

export interface BattleEventEnvelope {
  readonly event: BattleEventName | string;
  readonly payload?: Record<string, unknown>;
  readonly tickIndex?: number;
  readonly timestamp?: number;
}

export interface BattleEventBusLike {
  on(event: string, handler: (payload?: unknown) => void): void;
  off?(event: string, handler: (payload?: unknown) => void): void;
  removeListener?(event: string, handler: (payload?: unknown) => void): void;
}

export interface BattleRecommendation {
  readonly id: string;
  readonly kind:
    | 'WATCH'
    | 'COUNTER_EVIDENCE_FILE'
    | 'COUNTER_SABOTAGE'
    | 'HATER_DISTRACTION'
    | 'SHIELD_REPAIR_BOOST'
    | 'THREAT_DELAY'
    | 'DECOY_CARD'
    | 'INCOME_REINFORCE'
    | 'ALLIANCE_SIGNAL';
  readonly importance: BattleThreatBand;
  readonly title: string;
  readonly body: string;
  readonly channel: ChatChannel;
  readonly botId?: BattleBotId;
  readonly targetLayerId?: string;
  readonly expiresAt?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface BattleAdapterHistoryEntry {
  readonly id: string;
  readonly ts: number;
  readonly tick?: number;
  readonly eventName: string;
  readonly botId?: BattleBotId;
  readonly attackType?: BattleAttackType;
  readonly channel?: ChatChannel;
  readonly threatBand: BattleThreatBand;
  readonly narrativeWeight: BattleNarrativeWeight;
  readonly dedupKey: string;
  readonly metadata?: Record<string, unknown>;
}

export interface BattleEngineAdapterSnapshot {
  readonly modeId?: string;
  readonly screenId?: string;
  readonly runId?: string;
  readonly roomId?: string;
  readonly activeChannel: ChatChannel;
  readonly transportConnected: boolean;
  readonly heat: number;
  readonly tick?: number;
  readonly activeBotsCount: number;
  readonly activeBotIds: BattleBotId[];
  readonly targetBotIds: BattleBotId[];
  readonly attackingBotIds: BattleBotId[];
  readonly neutralizedBotIds: BattleBotId[];
  readonly injectedCardsCount: number;
  readonly duelActive: boolean;
  readonly duelId?: string;
  readonly currentDuelState?: string;
  readonly recommendations: BattleRecommendation[];
  readonly recentHistory: BattleAdapterHistoryEntry[];
  readonly modeSnapshot: ChatModeSnapshot;
}

export interface BattleEngineAdapterCallbacks {
  onBattleEventNormalized?(entry: BattleAdapterHistoryEntry): void;
  onRecommendationsChanged?(recommendations: BattleRecommendation[]): void;
  onModeSnapshotApplied?(snapshot: ChatModeSnapshot): void;
}

export interface BattleEngineAdapterConfig {
  readonly activeChannel: ChatChannel;
  readonly maxHistory: number;
  readonly maxRecommendations: number;
  readonly eventDedupWindowMs: number;
  readonly snapshotDedupWindowMs: number;
  readonly directWitnessCooldownMs: number;
  readonly lowHeatThreshold: number;
  readonly mediumHeatThreshold: number;
  readonly highHeatThreshold: number;
  readonly criticalHeatThreshold: number;
  readonly attackEscalationCriticalPower: number;
  readonly targetingEscalationMinBots: number;
  readonly emitSocketGameEvents: boolean;
  readonly emitTranscriptWitness: boolean;
  readonly allowFallbackWitness: boolean;
  readonly namespace: string;
}

export interface BattleEngineAdapterOptions {
  socketClient?: ChatSocketClient;
  channelPolicy: ChatChannelPolicy;
  invasionDirector: ChatInvasionDirector;
  npcDirector: ChatNpcDirector;
  transcriptBuffer?: ChatTranscriptBuffer;
  notificationController?: ChatNotificationController;
  callbacks?: BattleEngineAdapterCallbacks;
  config?: Partial<BattleEngineAdapterConfig>;
}

// -----------------------------------------------------------------------------
// Donor battle truth preserved from BotProfileRegistry.ts
// -----------------------------------------------------------------------------

const BOT_PROFILES: Readonly<Record<BattleBotId, BattleBotProfile>> = deepFreeze({
  BOT_01: {
    id: 'BOT_01',
    name: 'THE LIQUIDATOR',
    archetype: 'Predatory creditor / distressed-asset buyer / short interest position',
    primaryAttackType: 'ASSET_STRIP',
    secondaryAttackType: null,
    targetLayerId: 'ASSET_FLOOR',
    secondaryTargetLayerId: null,
    attackPowerMin: 25,
    attackPowerMax: 45,
    secondaryPowerMin: 0,
    secondaryPowerMax: 0,
    watchingHeatThreshold: 20,
    targetingHeatThreshold: 41,
    attackingHeatThreshold: 61,
    retreatTicks: 5,
    neutralizedTicks: 3,
    counterEvidenceCardType: 'LEGAL_DEFENSE',
    attackDialogue: 'Your assets are priced for distress. I am simply here to help the market find the floor.',
    retreatDialogue: 'The market will correct again. I will return when the window reopens.',
    consequenceText: 'Highest-value asset card removed from play for 3 ticks. L3 ASSET_FLOOR receives damage. Income reduced 25% for 3 ticks.',
    escalationConditionDescription: 'Activates when player net worth exceeds 2× their starting baseline. Targets players who have grown — not struggling players.',
  },
  BOT_02: {
    id: 'BOT_02',
    name: 'THE BUREAUCRAT',
    archetype: 'Regulatory burden / licensing gatekeeping / compliance overhead that disproportionately targets emerging wealth',
    primaryAttackType: 'REGULATORY_ATTACK',
    secondaryAttackType: null,
    targetLayerId: 'NETWORK_CORE',
    secondaryTargetLayerId: null,
    attackPowerMin: 15,
    attackPowerMax: 30,
    secondaryPowerMin: 0,
    secondaryPowerMax: 0,
    watchingHeatThreshold: 20,
    targetingHeatThreshold: 41,
    attackingHeatThreshold: 61,
    retreatTicks: 5,
    neutralizedTicks: 3,
    counterEvidenceCardType: 'LEGAL_FILING',
    attackDialogue: 'Every income stream requires verification. There are forms. I am simply doing my job.',
    retreatDialogue: 'Your paperwork appears to be in order. For now. We will revisit your compliance posture.',
    consequenceText: 'One income card gains REGULATORY_HOLD status for 2 ticks (3 on crit). Card cannot be played. L4 NETWORK_CORE takes damage.',
    escalationConditionDescription: 'Activates when player has 3+ distinct active income streams. Punishes complexity and diversification.',
  },
  BOT_03: {
    id: 'BOT_03',
    name: 'THE MANIPULATOR',
    archetype: 'Disinformation campaigns / manufactured scarcity / FOMO-driven market signals designed to invert sound decisions',
    primaryAttackType: 'FINANCIAL_SABOTAGE',
    secondaryAttackType: 'REPUTATION_ATTACK',
    targetLayerId: 'LIQUIDITY_BUFFER',
    secondaryTargetLayerId: 'NETWORK_CORE',
    attackPowerMin: 10,
    attackPowerMax: 20,
    secondaryPowerMin: 8,
    secondaryPowerMax: 15,
    watchingHeatThreshold: 20,
    targetingHeatThreshold: 41,
    attackingHeatThreshold: 61,
    retreatTicks: 5,
    neutralizedTicks: 3,
    counterEvidenceCardType: 'COUNTER_NARRATIVE',
    attackDialogue: 'Predictable decisions create exploitable markets. I have been studying your moves before you made them.',
    retreatDialogue: 'You changed your pattern. Interesting. I will need to recalibrate the model.',
    consequenceText: 'INVERSION_CURSE applied for 2 ticks (3 on crit). Next income card played has inverted effect. L1 takes primary damage. L4 takes secondary damage simultaneously.',
    escalationConditionDescription: 'Activates when card pattern entropy drops below 0.4. Monitors play patterns — activates when patterns become predictable.',
  },
  BOT_04: {
    id: 'BOT_04',
    name: 'THE CRASH PROPHET',
    archetype: 'Macro volatility / recession narrative / manufactured systemic shocks that wipe out players without deep reserves',
    primaryAttackType: 'EXPENSE_INJECTION',
    secondaryAttackType: null,
    targetLayerId: 'LIQUIDITY_BUFFER',
    secondaryTargetLayerId: null,
    attackPowerMin: 30,
    attackPowerMax: 60,
    secondaryPowerMin: 0,
    secondaryPowerMax: 0,
    watchingHeatThreshold: 20,
    targetingHeatThreshold: 61,
    attackingHeatThreshold: 61,
    retreatTicks: 5,
    neutralizedTicks: 3,
    counterEvidenceCardType: 'MACRO_HEDGE',
    attackDialogue: 'The market always corrects. The only question is whether you have positioned yourself to survive the correction, or to be consumed by it.',
    retreatDialogue: 'The correction happened. Rebuild your reserves. I will return when you have forgotten this lesson.',
    consequenceText: 'Global expense multiplier +35% for 3 ticks (+50% on crit). L1 LIQUIDITY_BUFFER takes heavy damage. All income calculations recalculated at reduced rate for 3 ticks.',
    escalationConditionDescription: 'Activates ONLY on high-income runs: hater_heat > 60 AND monthly income > $10,000. Exclusively targets players who have climbed high enough to lose the most.',
  },
  BOT_05: {
    id: 'BOT_05',
    name: 'THE LEGACY HEIR',
    archetype: 'Inherited structural advantage / generational wealth gap / passive systems that compound against new entrants',
    primaryAttackType: 'OPPORTUNITY_KILL',
    secondaryAttackType: null,
    targetLayerId: 'CREDIT_LINE',
    secondaryTargetLayerId: null,
    attackPowerMin: 18,
    attackPowerMax: 35,
    secondaryPowerMin: 0,
    secondaryPowerMax: 0,
    watchingHeatThreshold: 20,
    targetingHeatThreshold: 41,
    attackingHeatThreshold: 61,
    retreatTicks: 5,
    neutralizedTicks: 3,
    counterEvidenceCardType: 'SOVEREIGNTY_CLAIM',
    attackDialogue: 'You have done well. It would be a shame if the system remembered that you were not born into this position.',
    retreatDialogue: 'You found a way through. The system will need to recalibrate its thresholds for you.',
    consequenceText: 'Highest income-growth card removed from active pool for 2 ticks (3 on crit). L2 CREDIT_LINE takes damage. Income growth rate capped at 0% (-5% on crit) for 2 ticks.',
    escalationConditionDescription: 'Activates in late-game only: net worth > 5× freedom threshold. Exclusively targets wealth consolidation momentum — does not interfere early.',
  },
});

const DEFAULT_CONFIG: BattleEngineAdapterConfig = deepFreeze({
  activeChannel: 'GLOBAL',
  maxHistory: 280,
  maxRecommendations: 8,
  eventDedupWindowMs: 1_500,
  snapshotDedupWindowMs: 700,
  directWitnessCooldownMs: 4_000,
  lowHeatThreshold: 20,
  mediumHeatThreshold: 41,
  highHeatThreshold: 61,
  criticalHeatThreshold: 81,
  attackEscalationCriticalPower: 42,
  targetingEscalationMinBots: 2,
  emitSocketGameEvents: true,
  emitTranscriptWitness: true,
  allowFallbackWitness: true,
  namespace: 'battle',
});

const BATTLE_EVENT_NAMES: readonly BattleEventName[] = Object.freeze([
  'BOT_STATE_CHANGED',
  'BOT_ATTACK_FIRED',
  'BOT_NEUTRALIZED',
  'COUNTER_INTEL_AVAILABLE',
  'BATTLE_BUDGET_UPDATED',
  'BUDGET_ACTION_EXECUTED',
  'SYNDICATE_DUEL_RESULT',
  'BATTLE_SNAPSHOT_UPDATED',
]);

// -----------------------------------------------------------------------------
// BattleEngineAdapter
// -----------------------------------------------------------------------------

export class BattleEngineAdapter {
  private readonly socketClient?: ChatSocketClient;
  private readonly channelPolicy: ChatChannelPolicy;
  private readonly invasionDirector: ChatInvasionDirector;
  private readonly npcDirector: ChatNpcDirector;
  private readonly transcriptBuffer?: ChatTranscriptBuffer;
  private readonly notificationController?: ChatNotificationController;
  private readonly callbacks?: BattleEngineAdapterCallbacks;
  private readonly config: BattleEngineAdapterConfig;

  private destroyed = false;
  private activeChannel: ChatChannel;
  private modeSnapshot: ChatModeSnapshot;
  private heat = 0;
  private tick?: number;
  private battleSnapshot: BattleSnapshot = { bots: {} };
  private recommendations: BattleRecommendation[] = [];
  private history: BattleAdapterHistoryEntry[] = [];
  private dedupMap = new Map<string, number>();
  private lastWitnessAt = 0;
  private busBinding?: {
    bus: BattleEventBusLike;
    handlers: Map<string, (payload?: unknown) => void>;
  };

  public constructor(options: BattleEngineAdapterOptions) {
    this.socketClient = options.socketClient;
    this.channelPolicy = options.channelPolicy;
    this.invasionDirector = options.invasionDirector;
    this.npcDirector = options.npcDirector;
    this.transcriptBuffer = options.transcriptBuffer;
    this.notificationController = options.notificationController;
    this.callbacks = options.callbacks;
    this.config = deepFreeze({ ...DEFAULT_CONFIG, ...(options.config ?? {}) });
    this.activeChannel = this.config.activeChannel;
    this.modeSnapshot = deepFreeze({
      modeId: 'battle',
      modeFamily: 'BATTLE',
      screenId: 'BattleHUD',
      isMounted: true,
      isPreRun: false,
      isInRun: true,
      isPostRun: false,
      isMultiplayer: false,
      isNegotiationWindow: false,
      isDealVisible: false,
      isSyndicateVisible: true,
      isLobbyVisible: false,
      allowGlobal: true,
      allowSyndicate: true,
      allowDealRoom: false,
      allowLobby: false,
      haterHeat: 0,
      gamePhase: 'PRESSURE_MONITOR',
      metadata: { adapter: 'BattleEngineAdapter' },
    } satisfies ChatModeSnapshot);

    this.channelPolicy.updateModeSnapshot(this.modeSnapshot);
    this.callbacks?.onModeSnapshotApplied?.(this.modeSnapshot);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.unbindBattleEventBus();
    this.destroyed = true;
    this.recommendations = [];
    this.history = [];
    this.dedupMap.clear();
  }

  public getSnapshot(): BattleEngineAdapterSnapshot {
    this.assertAlive('getSnapshot');
    const socket = this.socketClient?.getStateSnapshot();
    const bots = normalizeBotMap(this.battleSnapshot.bots);
    return {
      modeId: this.modeSnapshot.modeId,
      screenId: this.modeSnapshot.screenId,
      runId: this.modeSnapshot.runId,
      roomId: this.modeSnapshot.roomId,
      activeChannel: this.activeChannel,
      transportConnected: socket?.state === 'CONNECTED',
      heat: this.heat,
      tick: this.tick,
      activeBotsCount: countActiveBots(bots),
      activeBotIds: listActiveBots(bots),
      targetBotIds: listBotsInState(bots, 'TARGETING'),
      attackingBotIds: listBotsInState(bots, 'ATTACKING'),
      neutralizedBotIds: listBotsInState(bots, 'NEUTRALIZED'),
      injectedCardsCount: this.battleSnapshot.injectedCards?.length ?? 0,
      duelActive: Boolean(this.battleSnapshot.activeDuel && !isResolvedDuel(this.battleSnapshot.activeDuel)),
      duelId: this.battleSnapshot.activeDuel?.duelId,
      currentDuelState: this.battleSnapshot.activeDuel?.state,
      recommendations: this.recommendations.slice(),
      recentHistory: this.history.slice(-20),
      modeSnapshot: this.modeSnapshot,
    };
  }

  public bindBattleEventBus(bus: BattleEventBusLike): void {
    this.assertAlive('bindBattleEventBus');
    this.unbindBattleEventBus();

    const handlers = new Map<string, (payload?: unknown) => void>();
    for (const eventName of BATTLE_EVENT_NAMES) {
      const handler = (payload?: unknown) => {
        this.handleBattleEvent({
          event: eventName,
          payload: asRecord(payload) ?? {},
          timestamp: now(),
        });
      };
      handlers.set(eventName, handler);
      bus.on(eventName, handler);
    }

    this.busBinding = { bus, handlers };
  }

  public unbindBattleEventBus(): void {
    if (!this.busBinding) return;
    for (const [eventName, handler] of this.busBinding.handlers) {
      if (typeof this.busBinding.bus.off === 'function') {
        this.busBinding.bus.off(eventName, handler);
      } else if (typeof this.busBinding.bus.removeListener === 'function') {
        this.busBinding.bus.removeListener(eventName, handler);
      }
    }
    this.busBinding = undefined;
  }

  public updateRuntime(next: Partial<ChatModeSnapshot>): void {
    this.assertAlive('updateRuntime');
    this.modeSnapshot = deepFreeze({
      ...this.modeSnapshot,
      ...next,
      metadata: {
        ...(this.modeSnapshot.metadata ?? {}),
        ...(next.metadata ?? {}),
      },
    } satisfies ChatModeSnapshot);
    this.activeChannel = chooseBootChannel(this.modeSnapshot, this.activeChannel);
    this.channelPolicy.updateModeSnapshot(this.modeSnapshot);
    this.callbacks?.onModeSnapshotApplied?.(this.modeSnapshot);
  }

  public handleBattleEvent(envelope: BattleEventEnvelope): void {
    this.assertAlive('handleBattleEvent');

    const event = normalizeEventName(envelope.event);
    const payload = envelope.payload ?? {};
    const ts = envelope.timestamp ?? now();
    const tick = envelope.tickIndex ?? inferTick(payload) ?? this.tick;

    if (!event) return;

    switch (event) {
      case 'BATTLE_SNAPSHOT_UPDATED':
        this.handleSnapshotUpdated(payload, ts);
        break;
      case 'BOT_STATE_CHANGED':
        this.handleBotStateChanged(payload, ts, tick);
        break;
      case 'BOT_ATTACK_FIRED':
        this.handleBotAttackFired(payload, ts, tick);
        break;
      case 'BOT_NEUTRALIZED':
        this.handleBotNeutralized(payload, ts, tick);
        break;
      case 'BATTLE_BUDGET_UPDATED':
        this.handleBudgetUpdated(payload, ts, tick);
        break;
      case 'BUDGET_ACTION_EXECUTED':
        this.handleBudgetActionExecuted(payload, ts, tick);
        break;
      case 'COUNTER_INTEL_AVAILABLE':
        this.handleCounterIntel(payload, ts, tick);
        break;
      case 'SYNDICATE_DUEL_RESULT':
        this.handleSyndicateDuelResult(payload, ts, tick);
        break;
      default:
        this.handleUnknownBattleEvent(event, payload, ts, tick);
        break;
    }
  }

  public ingestBattleSnapshot(snapshot: BattleSnapshot, ts: number = now()): void {
    this.assertAlive('ingestBattleSnapshot');
    this.applySnapshot(snapshot, ts, 'manual_ingest');
  }

  public getRecommendations(): BattleRecommendation[] {
    this.assertAlive('getRecommendations');
    return this.recommendations.slice();
  }

  public pulse(at: number = now()): BattleRecommendation[] {
    this.assertAlive('pulse');
    this.evictDedup(at);
    this.recomputeRecommendations('pulse', at);
    return this.recommendations.slice();
  }

  public stageManualBattleWitness(input: {
    title: string;
    body: string;
    channel?: ChatChannel;
    severity?: BattleThreatBand;
    metadata?: Record<string, unknown>;
  }): ChatMessage | null {
    this.assertAlive('stageManualBattleWitness');
    return this.emitWitness({
      channel: resolveWitnessChannel(this.channelPolicy, input.channel ?? this.activeChannel),
      title: input.title,
      body: input.body,
      severity: input.severity ?? 'MEDIUM',
      metadata: input.metadata,
      kind: 'SYSTEM',
    });
  }

  // ---------------------------------------------------------------------------
  // Snapshot handling
  // ---------------------------------------------------------------------------

  private handleSnapshotUpdated(payload: Record<string, unknown>, ts: number): void {
    const raw = asRecord(payload.snapshot);
    if (!raw) return;
    const snapshot = normalizeSnapshot(raw);
    this.applySnapshot(snapshot, ts, 'event');
  }

  private applySnapshot(snapshot: BattleSnapshot, ts: number, reason: 'event' | 'manual_ingest'): void {
    const dedupKey = buildSnapshotDedupKey(snapshot);
    if (this.isDeduped(dedupKey, ts, this.config.snapshotDedupWindowMs)) return;

    this.battleSnapshot = snapshot;
    this.heat = clamp(snapshot.haterHeat ?? this.heat, 0, 9_999);
    this.tick = snapshot.tickNumber ?? this.tick;

    const bots = normalizeBotMap(snapshot.bots);
    this.modeSnapshot = buildModeSnapshotFromBattle(snapshot, bots, this.modeSnapshot, this.heat);
    this.activeChannel = chooseBootChannel(this.modeSnapshot, this.activeChannel);
    this.channelPolicy.updateModeSnapshot(this.modeSnapshot);
    this.callbacks?.onModeSnapshotApplied?.(this.modeSnapshot);

    const entry: BattleAdapterHistoryEntry = {
      id: createId('battle.snapshot'),
      ts,
      tick: this.tick,
      eventName: 'BATTLE_SNAPSHOT_UPDATED',
      threatBand: heatToThreatBand(this.heat, this.config),
      narrativeWeight: classifySnapshotNarrativeWeight(snapshot, bots, this.heat, this.config),
      dedupKey,
      metadata: {
        reason,
        activeBotsCount: countActiveBots(bots),
        targetingBotsCount: listBotsInState(bots, 'TARGETING').length,
        attackingBotsCount: listBotsInState(bots, 'ATTACKING').length,
        injectedCardsCount: snapshot.injectedCards?.length ?? 0,
      },
    };

    this.recordEvent(entry);

    this.forwardSocketGameEvent('BATTLE_SNAPSHOT_UPDATED', {
      haterHeat: this.heat,
      tick: this.tick,
      activeBotsCount: countActiveBots(bots),
      targetingBots: listBotsInState(bots, 'TARGETING'),
      attackingBots: listBotsInState(bots, 'ATTACKING'),
      duelId: snapshot.activeDuel?.duelId,
      duelState: snapshot.activeDuel?.state,
    });

    const targetingBots = listBotsInState(bots, 'TARGETING');
    if (targetingBots.length >= this.config.targetingEscalationMinBots) {
      this.invasionDirector.handleGameEvent({
        event: 'MULTI_BOT_TARGETING_WINDOW',
        payload: {
          targetingBots,
          haterHeat: this.heat,
          snapshot,
        },
        preferredChannels: preferredChannelsForSnapshot(this.modeSnapshot, snapshot),
      });
    } else if (countActiveBots(bots) > 0) {
      this.npcDirector.handleGameEvent({
        eventType: 'BOT_WINNING',
        payload: {
          activeBots: listActiveBots(bots),
          targetingBots,
          attackingBots: listBotsInState(bots, 'ATTACKING'),
          haterHeat: this.heat,
          snapshot,
        },
        preferredChannel: 'GLOBAL',
        ts,
        metadata: {
          source: 'BattleEngineAdapter.snapshot',
        },
      });
    }

    if (snapshot.activeDuel && !isResolvedDuel(snapshot.activeDuel)) {
      this.npcDirector.handleGameEvent({
        eventType: 'NEGOTIATION_WINDOW',
        payload: {
          duel: snapshot.activeDuel,
          haterHeat: this.heat,
          snapshot,
        },
        preferredChannel: 'SYNDICATE',
        ts,
        metadata: {
          source: 'BattleEngineAdapter.snapshot_duel',
        },
      });
    }

    this.recomputeRecommendations('snapshot', ts);
  }

  // ---------------------------------------------------------------------------
  // Event handling
  // ---------------------------------------------------------------------------

  private handleBotStateChanged(payload: Record<string, unknown>, ts: number, tick?: number): void {
    const data = normalizeBotStateChanged(payload);
    if (!data) return;

    const profile = BOT_PROFILES[data.botId];
    const dedupKey = `state:${data.botId}:${data.from}:${data.to}:${tick ?? this.tick ?? 'na'}`;
    if (this.isDeduped(dedupKey, ts, this.config.eventDedupWindowMs)) return;

    const threatBand = scoreStateThreat(data.to, profile, this.heat, this.config);
    const narrativeWeight = classifyStateNarrativeWeight(data.from, data.to);
    const channel = channelForBot(profile, narrativeWeight, this.modeSnapshot);

    this.recordEvent({
      ts,
      tick,
      eventName: 'BOT_STATE_CHANGED',
      botId: data.botId,
      threatBand,
      narrativeWeight,
      dedupKey,
      metadata: {
        from: data.from,
        to: data.to,
        botName: profile.name,
      },
    });

    this.forwardSocketGameEvent('BOT_STATE_CHANGED', {
      botId: data.botId,
      botName: profile.name,
      from: data.from,
      to: data.to,
      haterHeat: this.heat,
      tick,
    });

    if (data.to === 'TARGETING') {
      this.invasionDirector.handleGameEvent({
        event: 'BOT_TARGET_LOCKED',
        payload: {
          botId: data.botId,
          botName: profile.name,
          from: data.from,
          to: data.to,
          attackDialogue: profile.attackDialogue,
          consequenceText: profile.consequenceText,
          haterHeat: this.heat,
        },
        preferredChannels: [channel, 'GLOBAL', 'SYNDICATE'],
      });
    } else if (data.to === 'WATCHING') {
      this.npcDirector.handleGameEvent({
        eventType: 'BOT_WINNING',
        payload: {
          botId: data.botId,
          botName: profile.name,
          from: data.from,
          to: data.to,
          haterHeat: this.heat,
        },
        preferredChannel: channel,
        ts,
        metadata: {
          source: 'BattleEngineAdapter.bot_state_changed',
        },
      });
    } else if (data.to === 'NEUTRALIZED') {
      this.handleBotNeutralized({ botId: data.botId, immunityTicks: profile.neutralizedTicks }, ts, tick);
    }

    this.recomputeRecommendations('bot_state_changed', ts);
  }

  private handleBotAttackFired(payload: Record<string, unknown>, ts: number, tick?: number): void {
    const attack = normalizeAttack(payload);
    if (!attack) return;

    const profile = BOT_PROFILES[attack.botId];
    const dedupKey = `attack:${attack.attackId}:${attack.botId}:${attack.attackType}:${tick ?? attack.tickNumber ?? this.tick ?? 'na'}`;
    if (this.isDeduped(dedupKey, ts, this.config.eventDedupWindowMs)) return;

    const threatBand = scoreAttackThreat(attack, profile, this.config);
    const narrativeWeight = classifyAttackNarrativeWeight(attack, threatBand);
    const channel = channelForBot(profile, narrativeWeight, this.modeSnapshot);

    this.recordEvent({
      ts,
      tick: tick ?? attack.tickNumber,
      eventName: 'BOT_ATTACK_FIRED',
      botId: attack.botId,
      attackType: attack.attackType,
      channel,
      threatBand,
      narrativeWeight,
      dedupKey,
      metadata: {
        botName: profile.name,
        targetLayerId: attack.targetLayerId,
        isCritical: attack.isCritical,
        rawPower: attack.rawPower,
        secondaryAttackType: attack.secondaryAttackType,
        secondaryTargetLayerId: attack.secondaryTargetLayerId,
      },
    });

    this.forwardSocketGameEvent('BOT_ATTACK_FIRED', {
      botId: attack.botId,
      botName: profile.name,
      attackType: attack.attackType,
      targetLayerId: attack.targetLayerId,
      isCritical: attack.isCritical,
      rawPower: attack.rawPower,
      secondaryAttackType: attack.secondaryAttackType,
      secondaryTargetLayerId: attack.secondaryTargetLayerId,
      haterHeat: this.heat,
      tick: tick ?? attack.tickNumber,
    });

    const sabotage = toSabotageEvent(attack, profile, ts);
    const invasion = this.invasionDirector.handleSabotage(sabotage);
    const npcPlans = this.npcDirector.handleSabotage(sabotage);

    if (!invasion && npcPlans.length === 0 && this.config.allowFallbackWitness) {
      this.emitWitness({
        channel,
        title: `${profile.name} ATTACK`,
        body: buildAttackWitnessBody(profile, attack),
        severity: threatBand,
        metadata: {
          source: 'BattleEngineAdapter.attack_fallback',
          botId: attack.botId,
          attackType: attack.attackType,
          targetLayerId: attack.targetLayerId,
        },
        kind: 'BOT_ATTACK',
      });
    }

    if (attack.secondaryAttackType) {
      this.npcDirector.handleGameEvent({
        eventType: 'CASCADE_CHAIN',
        payload: {
          botId: attack.botId,
          botName: profile.name,
          attackType: attack.attackType,
          secondaryAttackType: attack.secondaryAttackType,
          secondaryTargetLayerId: attack.secondaryTargetLayerId,
          haterHeat: this.heat,
        },
        preferredChannel: channel,
        ts,
        metadata: { source: 'BattleEngineAdapter.secondary_attack' },
      });
    }

    this.recomputeRecommendations('bot_attack_fired', ts);
  }

  private handleBotNeutralized(payload: Record<string, unknown>, ts: number, tick?: number): void {
    const data = normalizeNeutralized(payload);
    if (!data) return;

    const profile = BOT_PROFILES[data.botId];
    const dedupKey = `neutralized:${data.botId}:${tick ?? this.tick ?? 'na'}`;
    if (this.isDeduped(dedupKey, ts, this.config.eventDedupWindowMs)) return;

    this.recordEvent({
      ts,
      tick,
      eventName: 'BOT_NEUTRALIZED',
      botId: data.botId,
      threatBand: 'LOW',
      narrativeWeight: 'TACTICAL',
      dedupKey,
      metadata: {
        botName: profile.name,
        immunityTicks: data.immunityTicks,
      },
    });

    this.forwardSocketGameEvent('BOT_NEUTRALIZED', {
      botId: data.botId,
      botName: profile.name,
      immunityTicks: data.immunityTicks,
      tick,
    });

    this.npcDirector.handleGameEvent({
      eventType: 'BOT_DEFEATED',
      payload: {
        botId: data.botId,
        botName: profile.name,
        immunityTicks: data.immunityTicks,
        haterHeat: this.heat,
      },
      preferredChannel: 'GLOBAL',
      ts,
      metadata: { source: 'BattleEngineAdapter.bot_neutralized' },
    });

    this.emitWitness({
      channel: 'GLOBAL',
      title: `${profile.name} CHECKED`,
      body: `${profile.name} has been neutralized${data.immunityTicks ? ` for ${data.immunityTicks} ticks` : ''}. Pressure window temporarily reduced.`,
      severity: 'LOW',
      metadata: {
        source: 'BattleEngineAdapter.bot_neutralized_witness',
        botId: data.botId,
      },
      kind: 'SYSTEM',
    });

    this.recomputeRecommendations('bot_neutralized', ts);
  }

  private handleBudgetUpdated(payload: Record<string, unknown>, ts: number, tick?: number): void {
    const data = normalizeBudgetUpdated(payload, this.battleSnapshot.budget);
    if (!data) return;

    const dedupKey = `budget-updated:${data.remaining}:${data.spent}:${data.tickBudget}:${tick ?? this.tick ?? 'na'}`;
    if (this.isDeduped(dedupKey, ts, this.config.eventDedupWindowMs)) return;

    const severity: BattleThreatBand = data.remaining <= 1 ? 'HIGH' : data.remaining <= 2 ? 'MEDIUM' : 'LOW';

    this.recordEvent({
      ts,
      tick,
      eventName: 'BATTLE_BUDGET_UPDATED',
      threatBand: severity,
      narrativeWeight: 'TACTICAL',
      dedupKey,
      metadata: {
        remaining: data.remaining,
        spent: data.spent,
        tickBudget: data.tickBudget,
      },
    });

    this.forwardSocketGameEvent('BATTLE_BUDGET_UPDATED', {
      remaining: data.remaining,
      spent: data.spent,
      tickBudget: data.tickBudget,
      haterHeat: this.heat,
      tick,
    });

    if (data.remaining <= 1) {
      this.npcDirector.handleGameEvent({
        eventType: 'TIME_PRESSURE',
        payload: {
          battleBudgetRemaining: data.remaining,
          battleBudgetSpent: data.spent,
          tickBudget: data.tickBudget,
          haterHeat: this.heat,
        },
        preferredChannel: this.modeSnapshot.allowSyndicate ? 'SYNDICATE' : 'GLOBAL',
        ts,
        metadata: { source: 'BattleEngineAdapter.budget_updated' },
      });
    }

    this.recomputeRecommendations('budget_updated', ts);
  }

  private handleBudgetActionExecuted(payload: Record<string, unknown>, ts: number, tick?: number): void {
    const action = normalizeBudgetAction(asRecord(payload.action) ?? payload);
    if (!action) return;

    const dedupKey = `budget-action:${action.actionId}:${action.actionType}:${tick ?? action.tickNumber}`;
    if (this.isDeduped(dedupKey, ts, this.config.eventDedupWindowMs)) return;

    const preferredChannel: ChatChannel = action.actionType === 'ALLIANCE_SIGNAL'
      ? 'SYNDICATE'
      : action.actionType === 'HATER_DISTRACTION'
        ? 'GLOBAL'
        : (this.modeSnapshot.allowSyndicate ? 'SYNDICATE' : 'GLOBAL');

    this.recordEvent({
      ts,
      tick: tick ?? action.tickNumber,
      eventName: 'BUDGET_ACTION_EXECUTED',
      botId: action.targetBotId ?? undefined,
      threatBand: action.actionType === 'COUNTER_EVIDENCE_FILE' ? 'LOW' : 'MEDIUM',
      narrativeWeight: 'TACTICAL',
      dedupKey,
      metadata: {
        actionType: action.actionType,
        targetBotId: action.targetBotId,
        targetLayerId: action.targetLayerId,
        cost: action.cost,
      },
    });

    this.forwardSocketGameEvent('BUDGET_ACTION_EXECUTED', {
      actionType: action.actionType,
      targetBotId: action.targetBotId,
      targetLayerId: action.targetLayerId,
      cost: action.cost,
      haterHeat: this.heat,
      tick: tick ?? action.tickNumber,
    });

    const body = buildBudgetActionWitness(action);
    if (body) {
      this.npcDirector.handleGameEvent({
        eventType: action.actionType === 'COUNTER_EVIDENCE_FILE' ? 'PLAYER_COMEBACK' : 'PLAYER_CARD_PLAY',
        payload: {
          actionType: action.actionType,
          targetBotId: action.targetBotId,
          targetLayerId: action.targetLayerId,
          cost: action.cost,
          haterHeat: this.heat,
        },
        preferredChannel,
        ts,
        metadata: { source: 'BattleEngineAdapter.budget_action' },
      });

      if (action.actionType === 'COUNTER_EVIDENCE_FILE') {
        this.emitWitness({
          channel: preferredChannel,
          title: 'COUNTER-EVIDENCE FILED',
          body,
          severity: 'LOW',
          metadata: {
            source: 'BattleEngineAdapter.counter_evidence',
            targetBotId: action.targetBotId ?? undefined,
          },
          kind: 'SYSTEM',
        });
      }
    }

    this.recomputeRecommendations('budget_action_executed', ts);
  }

  private handleCounterIntel(payload: Record<string, unknown>, ts: number, tick?: number): void {
    const data = normalizeCounterIntel(payload);
    if (!data) return;

    const profile = BOT_PROFILES[data.botId];
    const dedupKey = `counter-intel:${data.botId}:${data.tier ?? 'na'}:${tick ?? this.tick ?? 'na'}`;
    if (this.isDeduped(dedupKey, ts, this.config.eventDedupWindowMs * 2)) return;

    this.recordEvent({
      ts,
      tick,
      eventName: 'COUNTER_INTEL_AVAILABLE',
      botId: data.botId,
      threatBand: 'LOW',
      narrativeWeight: 'TACTICAL',
      dedupKey,
      metadata: {
        botName: profile.name,
        tier: data.tier,
      },
    });

    this.forwardSocketGameEvent('COUNTER_INTEL_AVAILABLE', {
      botId: data.botId,
      botName: profile.name,
      tier: data.tier,
      attackProfile: data.attackProfile,
      tick,
    });

    this.emitWitness({
      channel: 'GLOBAL',
      title: `COUNTER INTEL — ${profile.name}`,
      body: `Forensics signal available${data.tier ? ` (${data.tier})` : ''}. Recommended counter: ${profile.counterEvidenceCardType.replace(/_/g, ' ')}.`,
      severity: 'LOW',
      metadata: { source: 'BattleEngineAdapter.counter_intel', botId: data.botId },
      kind: 'SYSTEM',
    });
  }

  private handleSyndicateDuelResult(payload: Record<string, unknown>, ts: number, tick?: number): void {
    const data = normalizeDuelResult(payload);
    if (!data) return;

    const dedupKey = `duel:${data.duelId}:${data.winnerId}:${data.loserId}`;
    if (this.isDeduped(dedupKey, ts, this.config.eventDedupWindowMs * 2)) return;

    this.recordEvent({
      ts,
      tick,
      eventName: 'SYNDICATE_DUEL_RESULT',
      threatBand: 'MEDIUM',
      narrativeWeight: 'TACTICAL',
      dedupKey,
      metadata: {
        duelId: data.duelId,
        winnerId: data.winnerId,
        loserId: data.loserId,
        reward: data.reward,
      },
    });

    this.modeSnapshot = deepFreeze({
      ...this.modeSnapshot,
      isMultiplayer: true,
      isSyndicateVisible: true,
      allowSyndicate: true,
      metadata: {
        ...(this.modeSnapshot.metadata ?? {}),
        latestDuelId: data.duelId,
        latestDuelWinnerId: data.winnerId,
        latestDuelLoserId: data.loserId,
      },
    } satisfies ChatModeSnapshot);
    this.channelPolicy.updateModeSnapshot(this.modeSnapshot);
    this.callbacks?.onModeSnapshotApplied?.(this.modeSnapshot);

    this.forwardSocketGameEvent('SYNDICATE_DUEL_RESULT', {
      duelId: data.duelId,
      winnerId: data.winnerId,
      loserId: data.loserId,
      reward: data.reward,
      tick,
    });

    this.emitWitness({
      channel: 'SYNDICATE',
      title: 'SYNDICATE DUEL RESOLVED',
      body: `Duel ${data.duelId} resolved. Winner: ${data.winnerId}. Loser: ${data.loserId}.`,
      severity: 'MEDIUM',
      metadata: { source: 'BattleEngineAdapter.duel_result' },
      kind: 'SYSTEM',
    });

    this.recomputeRecommendations('duel_result', ts);
  }

  private handleUnknownBattleEvent(eventName: string, payload: Record<string, unknown>, ts: number, tick?: number): void {
    const dedupKey = `unknown:${eventName}:${stableStringify(payload)}`;
    if (this.isDeduped(dedupKey, ts, this.config.eventDedupWindowMs)) return;

    this.recordEvent({
      ts,
      tick,
      eventName,
      threatBand: heatToThreatBand(this.heat, this.config),
      narrativeWeight: 'AMBIENT',
      dedupKey,
      metadata: payload,
    });

    this.forwardSocketGameEvent(eventName, { payload, tick });
  }

  // ---------------------------------------------------------------------------
  // Recommendations + mirroring
  // ---------------------------------------------------------------------------

  private recomputeRecommendations(reason: string, ts: number): void {
    const bots = normalizeBotMap(this.battleSnapshot.bots);
    const next: BattleRecommendation[] = [];

    for (const botId of listBotsInState(bots, 'TARGETING')) {
      const profile = BOT_PROFILES[botId];
      next.push({
        id: createId('rec.counter_evidence'),
        kind: 'COUNTER_EVIDENCE_FILE',
        importance: 'HIGH',
        title: `Counter ${profile.name}`,
        body: `Target lock detected. Recommended response: ${profile.counterEvidenceCardType.replace(/_/g, ' ')} before the next attack window.`,
        channel: channelForBot(profile, 'TACTICAL', this.modeSnapshot),
        botId,
        targetLayerId: profile.targetLayerId,
        expiresAt: ts + 10_000,
        metadata: { reason, state: 'TARGETING' },
      });
    }

    for (const botId of listBotsInState(bots, 'ATTACKING')) {
      const profile = BOT_PROFILES[botId];
      next.push({
        id: createId('rec.counter_sabotage'),
        kind: 'COUNTER_SABOTAGE',
        importance: 'CRITICAL',
        title: `${profile.name} is firing`,
        body: `Active attack window. Counter-sabotage and shield routing should happen now. Target layer: ${profile.targetLayerId}.`,
        channel: channelForBot(profile, 'INVASION', this.modeSnapshot),
        botId,
        targetLayerId: profile.targetLayerId,
        expiresAt: ts + 6_000,
        metadata: { reason, state: 'ATTACKING' },
      });
    }

    if (this.heat >= this.config.highHeatThreshold) {
      next.push({
        id: createId('rec.hater_heat'),
        kind: 'HATER_DISTRACTION',
        importance: this.heat >= this.config.criticalHeatThreshold ? 'CRITICAL' : 'HIGH',
        title: 'Hater heat surge',
        body: `Heat is elevated at ${this.heat}. Distraction / decoy plays are worth more right now.`,
        channel: 'GLOBAL',
        expiresAt: ts + 12_000,
        metadata: { reason, haterHeat: this.heat },
      });
    }

    if (this.battleSnapshot.budget && this.battleSnapshot.budget.remainingPts <= 1) {
      next.push({
        id: createId('rec.budget_low'),
        kind: 'THREAT_DELAY',
        importance: 'HIGH',
        title: 'Low battle budget',
        body: `Only ${this.battleSnapshot.budget.remainingPts} point remains this tick. Delay, reinforce, or stop over-spending.`,
        channel: this.modeSnapshot.allowSyndicate ? 'SYNDICATE' : 'GLOBAL',
        expiresAt: ts + 8_000,
        metadata: { reason, remainingPts: this.battleSnapshot.budget.remainingPts },
      });
    }

    if (this.battleSnapshot.activeDuel && !isResolvedDuel(this.battleSnapshot.activeDuel)) {
      next.push({
        id: createId('rec.duel_active'),
        kind: 'ALLIANCE_SIGNAL',
        importance: 'MEDIUM',
        title: 'Syndicate duel active',
        body: `Duel ${this.battleSnapshot.activeDuel.duelId} is active. Coordinate alliance signals and challenge pacing.`,
        channel: 'SYNDICATE',
        expiresAt: ts + 15_000,
        metadata: { reason, duelId: this.battleSnapshot.activeDuel.duelId },
      });
    }

    this.recommendations = next
      .sort((a, b) => threatRank(b.importance) - threatRank(a.importance))
      .slice(0, this.config.maxRecommendations);

    this.callbacks?.onRecommendationsChanged?.(this.recommendations.slice());
  }

  private forwardSocketGameEvent(event: string, payload: Record<string, unknown>): void {
    if (!this.socketClient || !this.config.emitSocketGameEvents) return;
    const intent: ChatGameEventIntent = {
      event,
      channel: this.activeChannel,
      metadata: {
        ...payload,
        namespace: this.config.namespace,
        ts: now(),
      },
    };
    this.socketClient.queueGameEvent(intent);
  }

  private emitWitness(input: {
    channel: ChatChannel;
    title: string;
    body: string;
    severity: BattleThreatBand;
    kind: ChatMessageKind;
    metadata?: Record<string, unknown>;
  }): ChatMessage | null {
    if (!this.transcriptBuffer || !this.config.emitTranscriptWitness) return null;

    const ts = now();
    if (ts - this.lastWitnessAt < this.config.directWitnessCooldownMs && input.severity !== 'CRITICAL') {
      return null;
    }

    const channel = resolveWitnessChannel(this.channelPolicy, input.channel);

    const message: ChatMessage = {
      id: createId('battle.witness'),
      channel,
      kind: input.kind,
      senderId: 'battle-system',
      senderName: 'BATTLE SYSTEM',
      body: `${input.title} — ${input.body}`,
      ts,
      metadata: {
        severity: input.severity,
        title: input.title,
        source: 'BattleEngineAdapter',
        ...(input.metadata ?? {}),
      },
    };

    const record = this.transcriptBuffer.insertSystemMessage(message);
    this.lastWitnessAt = ts;

    if (this.notificationController) {
      this.notificationController.noteSystem({
        channel,
        title: input.title,
        body: input.body,
        severity: mapThreatToNotificationSeverity(input.severity),
        metadata: {
          source: 'BattleEngineAdapter.emitWitness',
          messageId: record.messageId,
          ...(input.metadata ?? {}),
        },
      });
    }

    return message;
  }

  private recordEvent(entry: Omit<BattleAdapterHistoryEntry, 'id'> | BattleAdapterHistoryEntry): void {
    const fullEntry: BattleAdapterHistoryEntry = 'id' in entry
      ? entry
      : { id: createId('battle.history'), ...entry };
    this.history.push(fullEntry);
    if (this.history.length > this.config.maxHistory) {
      this.history.splice(0, this.history.length - this.config.maxHistory);
    }
    this.callbacks?.onBattleEventNormalized?.(fullEntry);
  }

  private isDeduped(key: string, ts: number, windowMs: number): boolean {
    const previous = this.dedupMap.get(key);
    if (typeof previous === 'number' && ts - previous <= windowMs) {
      return true;
    }
    this.dedupMap.set(key, ts);
    return false;
  }

  private evictDedup(at: number): void {
    const ttl = Math.max(this.config.eventDedupWindowMs, this.config.snapshotDedupWindowMs) * 8;
    for (const [key, ts] of this.dedupMap) {
      if (at - ts > ttl) this.dedupMap.delete(key);
    }
  }

  private assertAlive(method: string): void {
    if (this.destroyed) {
      throw new Error(`[BattleEngineAdapter] Cannot call ${method}() after destroy().`);
    }
  }
}

export function createBattleEngineAdapter(options: BattleEngineAdapterOptions): BattleEngineAdapter {
  return new BattleEngineAdapter(options);
}

// -----------------------------------------------------------------------------
// Normalization helpers
// -----------------------------------------------------------------------------

function normalizeEventName(value: unknown): BattleEventName | string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

function normalizeSnapshot(raw: Record<string, unknown>): BattleSnapshot {
  const bots = normalizeBotMap(raw.bots);
  return {
    bots,
    budget: normalizeBudgetState(asRecord(raw.budget)),
    activeBotsCount: asNumber(raw.activeBotsCount) ?? countActiveBots(bots),
    injectedCards: normalizeInjectedCards(raw.injectedCards),
    haterHeat: asNumber(raw.haterHeat) ?? 0,
    activeDuel: normalizeDuel(asRecord(raw.activeDuel)),
    tickNumber: asNumber(raw.tickNumber),
    timestamp: asNumber(raw.timestamp),
  };
}

function normalizeBotMap(input: unknown): Record<string, BattleBotRuntimeState> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const rawMap = input as Record<string, unknown>;
  const out: Record<string, BattleBotRuntimeState> = {};
  for (const [key, value] of Object.entries(rawMap)) {
    const raw = asRecord(value);
    const botId = normalizeBotId(raw?.profileId ?? key);
    if (!raw || !botId) continue;
    out[botId] = {
      profileId: botId,
      state: normalizeBotState(raw.state) ?? 'DORMANT',
      stateEnteredAtTick: asNumber(raw.stateEnteredAtTick),
      retreatTicksRemaining: asNumber(raw.retreatTicksRemaining),
      neutralizedTicksRemaining: asNumber(raw.neutralizedTicksRemaining),
      preloadedArrivalTick: asNullableNumber(raw.preloadedArrivalTick),
      preloadedAttackPower: asNullableNumber(raw.preloadedAttackPower),
      damageReductionPct: asNumber(raw.damageReductionPct),
      damageReductionTicksRemaining: asNumber(raw.damageReductionTicksRemaining),
      attacksThisRun: asNumber(raw.attacksThisRun),
      lastStateBeforeNeutralized: normalizeBotState(raw.lastStateBeforeNeutralized) ?? undefined,
    };
  }
  return out;
}

function normalizeBudgetState(raw?: Record<string, unknown>): BattleBudgetState | undefined {
  if (!raw) return undefined;
  return {
    incomeTier: normalizeIncomeTier(raw.incomeTier) ?? 'SURVIVAL',
    totalPts: asNumber(raw.totalPts) ?? 0,
    remainingPts: asNumber(raw.remainingPts) ?? 0,
    spentPts: asNumber(raw.spentPts) ?? 0,
    tickNumber: asNumber(raw.tickNumber) ?? 0,
    actionsExecutedThisTick: normalizeActionTypeArray(raw.actionsExecutedThisTick),
  };
}

function normalizeInjectedCards(input: unknown): readonly BattleInjectedCard[] {
  if (!Array.isArray(input)) return [];
  const out: BattleInjectedCard[] = [];
  for (const item of input) {
    const raw = asRecord(item);
    const sourceBotId = normalizeBotId(raw?.sourceBotId);
    const injectionType = normalizeInjectionType(raw?.injectionType);
    if (!raw || !sourceBotId || !injectionType) continue;
    out.push({
      injectionId: String(raw.injectionId ?? createId('battle.injected')),
      injectionType,
      sourceBotId,
      cardName: String(raw.cardName ?? injectionType),
      timerTicks: asNumber(raw.timerTicks) ?? 0,
      ticksRemaining: asNumber(raw.ticksRemaining) ?? 0,
      isMitigated: Boolean(raw.isMitigated),
      isExpired: Boolean(raw.isExpired),
      injectedAtTick: asNumber(raw.injectedAtTick) ?? 0,
    });
  }
  return out;
}

function normalizeDuel(raw?: Record<string, unknown>): BattleSyndicateDuel | null {
  if (!raw) return null;
  const duelId = asString(raw.duelId);
  const challengerSyndicateId = asString(raw.challengerSyndicateId);
  const defenderSyndicateId = asString(raw.defenderSyndicateId);
  if (!duelId || !challengerSyndicateId || !defenderSyndicateId) return null;
  return {
    duelId,
    challengerSyndicateId,
    defenderSyndicateId,
    declaredAt: asNumber(raw.declaredAt) ?? 0,
    endsAt: asNumber(raw.endsAt) ?? 0,
    state: asString(raw.state) ?? 'ACTIVE',
    challengerScore: asNumber(raw.challengerScore) ?? 0,
    defenderScore: asNumber(raw.defenderScore) ?? 0,
    currentChallenge: asNumber(raw.currentChallenge) ?? 1,
    winnerSyndicateId: asNullableString(raw.winnerSyndicateId) ?? null,
  };
}

function normalizeBotStateChanged(raw: Record<string, unknown>): BattleBotStateChangedPayload | null {
  const botId = normalizeBotId(raw.botId);
  const from = normalizeBotState(raw.from);
  const to = normalizeBotState(raw.to);
  if (!botId || !from || !to) return null;
  return { botId, from, to };
}

function normalizeAttack(raw: Record<string, unknown>): BattleAttackEvent | null {
  const botId = normalizeBotId(raw.botId);
  const attackType = normalizeAttackType(raw.attackType);
  if (!botId || !attackType) return null;
  return {
    attackId: asString(raw.attackId) ?? createId('battle.attack'),
    botId,
    attackType,
    targetLayerId: asString(raw.targetLayer) ?? asString(raw.targetLayerId) ?? BOT_PROFILES[botId].targetLayerId,
    secondaryAttackType: normalizeAttackType(raw.secondaryAttackType) ?? undefined,
    secondaryTargetLayerId: asNullableString(raw.secondaryTargetLayerId) ?? undefined,
    rawPower: asNumber(raw.rawPower) ?? undefined,
    secondaryRawPower: asNumber(raw.secondaryRawPower) ?? undefined,
    isCritical: asBoolean(raw.isCritical) ?? undefined,
    tickNumber: asNumber(raw.tickNumber) ?? undefined,
    sourceHaterId: asString(raw.sourceHaterId) ?? undefined,
  };
}

function normalizeNeutralized(raw: Record<string, unknown>): BattleNeutralizedPayload | null {
  const botId = normalizeBotId(raw.botId);
  if (!botId) return null;
  return {
    botId,
    immunityTicks: asNumber(raw.immunityTicks) ?? undefined,
  };
}

function normalizeBudgetUpdated(
  raw: Record<string, unknown>,
  fallback?: BattleBudgetState,
): BattleBudgetUpdatedPayload | null {
  const remaining = asNumber(raw.remaining) ?? fallback?.remainingPts;
  const spent = asNumber(raw.spent) ?? fallback?.spentPts;
  const tickBudget = asNumber(raw.tickBudget) ?? fallback?.totalPts;
  if (remaining === undefined || spent === undefined || tickBudget === undefined) return null;
  return { remaining, spent, tickBudget };
}

function normalizeBudgetAction(raw: Record<string, unknown>): BattleBudgetAction | null {
  const actionType = normalizeActionType(raw.actionType);
  if (!actionType) return null;
  return {
    actionId: asString(raw.actionId) ?? createId('battle.action'),
    actionType,
    targetBotId: normalizeBotId(raw.targetBotId) ?? null,
    targetLayerId: asNullableString(raw.targetLayerId) ?? null,
    cost: asNumber(raw.cost) ?? 0,
    tickNumber: asNumber(raw.tickNumber) ?? 0,
  };
}

function normalizeCounterIntel(raw: Record<string, unknown>): BattleCounterIntelPayload | null {
  const botId = normalizeBotId(raw.botId);
  if (!botId) return null;
  return {
    botId,
    attackProfile: asRecord(raw.attackProfile) ?? undefined,
    tier: asString(raw.tier) ?? undefined,
  };
}

function normalizeDuelResult(raw: Record<string, unknown>): BattleSyndicateDuelResultPayload | null {
  const duelId = asString(raw.duelId);
  const winnerId = asString(raw.winnerId);
  const loserId = asString(raw.loserId);
  if (!duelId || !winnerId || !loserId) return null;
  return {
    duelId,
    winnerId,
    loserId,
    reward: asRecord(raw.reward) ?? undefined,
  };
}

function normalizeBotId(value: unknown): BattleBotId | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'BOT_01') return 'BOT_01';
  if (normalized === 'BOT_02') return 'BOT_02';
  if (normalized === 'BOT_03') return 'BOT_03';
  if (normalized === 'BOT_04') return 'BOT_04';
  if (normalized === 'BOT_05') return 'BOT_05';
  return null;
}

function normalizeBotState(value: unknown): BattleBotState | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case 'DORMANT':
    case 'WATCHING':
    case 'TARGETING':
    case 'ATTACKING':
    case 'RETREATING':
    case 'NEUTRALIZED':
      return normalized;
    default:
      return null;
  }
}

function normalizeAttackType(value: unknown): BattleAttackType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

function normalizeActionType(value: unknown): BattleActionType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case 'SHIELD_REPAIR_BOOST':
    case 'THREAT_DELAY':
    case 'DECOY_CARD':
    case 'COUNTER_SABOTAGE':
    case 'HATER_DISTRACTION':
    case 'COUNTER_EVIDENCE_FILE':
    case 'INCOME_REINFORCE':
    case 'ALLIANCE_SIGNAL':
      return normalized;
    default:
      return null;
  }
}

function normalizeIncomeTier(value: unknown): BattleIncomeTier | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case 'SURVIVAL':
    case 'STABILITY':
    case 'MOMENTUM':
    case 'LEVERAGE':
    case 'SOVEREIGN':
      return normalized;
    default:
      return null;
  }
}

function normalizeInjectionType(value: unknown): BattleInjectionType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case 'FORCED_SALE':
    case 'REGULATORY_HOLD':
    case 'INVERSION_CURSE':
    case 'EXPENSE_SPIKE':
    case 'DILUTION_NOTICE':
    case 'HATER_HEAT_SURGE':
      return normalized;
    default:
      return null;
  }
}

function normalizeActionTypeArray(value: unknown): BattleActionType[] {
  if (!Array.isArray(value)) return [];
  const out: BattleActionType[] = [];
  for (const entry of value) {
    const normalized = normalizeActionType(entry);
    if (normalized) out.push(normalized);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Decision helpers
// -----------------------------------------------------------------------------

function buildModeSnapshotFromBattle(
  snapshot: BattleSnapshot,
  bots: Record<string, BattleBotRuntimeState>,
  previous: ChatModeSnapshot,
  heat: number,
): ChatModeSnapshot {
  const duel = snapshot.activeDuel;
  const syndicateVisible = Boolean(previous.isSyndicateVisible || previous.allowSyndicate || duel);
  const dealVisible = Boolean(previous.isDealVisible || previous.allowDealRoom);

  return deepFreeze({
    ...previous,
    modeId: previous.modeId ?? 'battle',
    modeFamily: 'BATTLE',
    screenId: previous.screenId ?? 'BattleHUD',
    isMounted: true,
    isPreRun: false,
    isInRun: true,
    isPostRun: false,
    isMultiplayer: syndicateVisible,
    isNegotiationWindow: dealVisible,
    isDealVisible: dealVisible,
    isSyndicateVisible: syndicateVisible,
    isLobbyVisible: false,
    allowGlobal: true,
    allowSyndicate: syndicateVisible,
    allowDealRoom: dealVisible,
    allowLobby: false,
    haterHeat: heat,
    pressureTier: inferPressureTier(snapshot, bots, heat),
    tickTier: inferTickTier(snapshot.tickNumber),
    gamePhase: inferGamePhase(snapshot, bots),
    negotiationUrgency: duel ? duelUrgency(duel) : previous.negotiationUrgency,
    metadata: {
      ...(previous.metadata ?? {}),
      activeBotsCount: countActiveBots(bots),
      injectedCardsCount: snapshot.injectedCards?.length ?? 0,
      activeDuelId: duel?.duelId,
    },
  } satisfies ChatModeSnapshot);
}

function preferredChannelsForSnapshot(mode: ChatModeSnapshot, snapshot: BattleSnapshot): ChatChannel[] {
  const out: ChatChannel[] = [];
  if (snapshot.activeDuel && !isResolvedDuel(snapshot.activeDuel)) out.push('SYNDICATE');
  if (mode.isNegotiationWindow && mode.allowDealRoom) out.push('DEAL_ROOM');
  out.push('GLOBAL');
  if (mode.allowSyndicate) out.push('SYNDICATE');
  return dedupeChannels(out);
}

function chooseBootChannel(mode: ChatModeSnapshot, fallback: ChatChannel): ChatChannel {
  if (mode.isNegotiationWindow && mode.allowDealRoom) return 'DEAL_ROOM';
  if (mode.isMultiplayer && mode.allowSyndicate) return 'SYNDICATE';
  if (mode.allowGlobal) return 'GLOBAL';
  return fallback;
}

function channelForBot(
  profile: BattleBotProfile,
  weight: BattleNarrativeWeight,
  mode: ChatModeSnapshot,
): ChatChannel {
  if (profile.id === 'BOT_05' && mode.allowDealRoom) return 'DEAL_ROOM';
  if (profile.id === 'BOT_03' && mode.allowDealRoom) return 'DEAL_ROOM';
  if (weight === 'TACTICAL' && mode.allowSyndicate) return 'SYNDICATE';
  if (weight === 'AMBIENT' && mode.allowSyndicate) return 'SYNDICATE';
  return 'GLOBAL';
}

function resolveWitnessChannel(policy: ChatChannelPolicy, preferred: ChatChannel): ChatChannel {
  const evaluation = policy.evaluateChannel({
    channel: preferred,
    intent: 'notify',
  });
  return evaluation.allowed ? preferred : evaluation.fallbackChannel;
}

function scoreStateThreat(
  to: BattleBotState,
  profile: BattleBotProfile,
  heat: number,
  config: BattleEngineAdapterConfig,
): BattleThreatBand {
  if (to === 'ATTACKING') return 'CRITICAL';
  if (to === 'TARGETING') return 'HIGH';
  if (to === 'WATCHING') return heat >= profile.targetingHeatThreshold ? 'MEDIUM' : 'LOW';
  if (to === 'NEUTRALIZED') return 'LOW';
  return heatToThreatBand(heat, config);
}

function scoreAttackThreat(
  attack: BattleAttackEvent,
  profile: BattleBotProfile,
  config: BattleEngineAdapterConfig,
): BattleThreatBand {
  const raw = attack.rawPower ?? average(profile.attackPowerMin, profile.attackPowerMax);
  if (attack.isCritical) return 'CRITICAL';
  if (raw >= config.attackEscalationCriticalPower) return 'CRITICAL';
  if (raw >= average(profile.attackPowerMin, profile.attackPowerMax)) return 'HIGH';
  if (raw >= profile.attackPowerMin) return 'MEDIUM';
  return 'LOW';
}

function classifySnapshotNarrativeWeight(
  snapshot: BattleSnapshot,
  bots: Record<string, BattleBotRuntimeState>,
  heat: number,
  config: BattleEngineAdapterConfig,
): BattleNarrativeWeight {
  if (listBotsInState(bots, 'ATTACKING').length > 0 || heat >= config.highHeatThreshold) return 'INVASION';
  if (listBotsInState(bots, 'TARGETING').length > 0) return 'PREDATORY';
  if (countActiveBots(bots) > 0) return 'TACTICAL';
  return 'AMBIENT';
}

function classifyStateNarrativeWeight(from: BattleBotState, to: BattleBotState): BattleNarrativeWeight {
  if (to === 'ATTACKING') return 'INVASION';
  if (to === 'TARGETING') return 'PREDATORY';
  if (to === 'WATCHING') return 'TACTICAL';
  if (from === 'ATTACKING' && to === 'RETREATING') return 'TACTICAL';
  return 'AMBIENT';
}

function classifyAttackNarrativeWeight(
  attack: BattleAttackEvent,
  threat: BattleThreatBand,
): BattleNarrativeWeight {
  if (attack.isCritical || threat === 'CRITICAL') return 'INVASION';
  if (attack.secondaryAttackType) return 'INVASION';
  if (threat === 'HIGH') return 'PREDATORY';
  return 'TACTICAL';
}

function inferPressureTier(
  snapshot: BattleSnapshot,
  bots: Record<string, BattleBotRuntimeState>,
  heat: number,
): string {
  if (listBotsInState(bots, 'ATTACKING').length > 0) return 'CRITICAL';
  if (listBotsInState(bots, 'TARGETING').length > 0) return 'HIGH';
  if ((snapshot.injectedCards?.length ?? 0) > 0 || heat >= 41) return 'MEDIUM';
  return 'LOW';
}

function inferTickTier(tick?: number): string {
  const value = tick ?? 0;
  if (value >= 150) return 'LATE';
  if (value >= 80) return 'MID';
  return 'EARLY';
}

function inferGamePhase(
  snapshot: BattleSnapshot,
  bots: Record<string, BattleBotRuntimeState>,
): string {
  if (snapshot.activeDuel && !isResolvedDuel(snapshot.activeDuel)) return 'SYNDICATE_DUEL';
  if (listBotsInState(bots, 'ATTACKING').length > 0) return 'BATTLE_ACTIVE';
  if (listBotsInState(bots, 'TARGETING').length > 0) return 'THREAT_LOCK';
  if ((snapshot.injectedCards?.length ?? 0) > 0) return 'SABOTAGE_RESOLUTION';
  return 'PRESSURE_MONITOR';
}

function duelUrgency(duel: BattleSyndicateDuel): number {
  const total = Math.max(1, duel.endsAt - duel.declaredAt);
  const remaining = Math.max(0, duel.endsAt - now());
  return round(100 * (1 - remaining / total), 2);
}

function toSabotageEvent(
  attack: BattleAttackEvent,
  profile: BattleBotProfile,
  ts: number,
): ChatSabotageEvent {
  return {
    botId: attack.botId,
    botName: profile.name,
    attackType: attack.attackType,
    targetLayer: attack.targetLayerId,
    dialogue: profile.attackDialogue,
    ts,
    metadata: {
      rawPower: attack.rawPower,
      secondaryRawPower: attack.secondaryRawPower,
      secondaryAttackType: attack.secondaryAttackType,
      secondaryTargetLayerId: attack.secondaryTargetLayerId,
      isCritical: attack.isCritical,
      sourceHaterId: attack.sourceHaterId,
      consequenceText: profile.consequenceText,
    },
  };
}

function buildAttackWitnessBody(
  profile: BattleBotProfile,
  attack: BattleAttackEvent,
): string {
  const parts: string[] = [profile.attackDialogue];
  if (attack.targetLayerId) parts.push(`Target layer: ${attack.targetLayerId}.`);
  if (typeof attack.rawPower === 'number') parts.push(`Raw power ${attack.rawPower}.`);
  if (attack.isCritical) parts.push('Critical hit window detected.');
  if (attack.secondaryAttackType) {
    parts.push(`Secondary vector: ${attack.secondaryAttackType}${attack.secondaryTargetLayerId ? ` on ${attack.secondaryTargetLayerId}` : ''}.`);
  }
  return parts.join(' ');
}

function buildBudgetActionWitness(action: BattleBudgetAction): string | null {
  switch (action.actionType) {
    case 'COUNTER_EVIDENCE_FILE':
      return `Counter-evidence filed${action.targetBotId ? ` against ${action.targetBotId}` : ''}.`;
    case 'COUNTER_SABOTAGE':
      return `Counter-sabotage deployed${action.targetBotId ? ` against ${action.targetBotId}` : ''}.`;
    case 'HATER_DISTRACTION':
      return 'Distraction play deployed to bleed hater heat.';
    case 'SHIELD_REPAIR_BOOST':
      return `Shield repair boost committed${action.targetLayerId ? ` to ${action.targetLayerId}` : ''}.`;
    case 'THREAT_DELAY':
      return 'Threat delay executed to widen the next response window.';
    case 'DECOY_CARD':
      return 'Decoy card deployed to split incoming pressure.';
    case 'INCOME_REINFORCE':
      return 'Income reinforce play committed.';
    case 'ALLIANCE_SIGNAL':
      return 'Alliance signal sent across the syndicate lane.';
    default:
      return null;
  }
}

function buildSnapshotDedupKey(snapshot: BattleSnapshot): string {
  return stableStringify({
    tickNumber: snapshot.tickNumber,
    haterHeat: snapshot.haterHeat,
    activeBotsCount: snapshot.activeBotsCount,
    duelId: snapshot.activeDuel?.duelId,
    duelState: snapshot.activeDuel?.state,
    bots: Object.values(normalizeBotMap(snapshot.bots)).map((bot) => ({
      id: bot.profileId,
      state: bot.state,
      attacksThisRun: bot.attacksThisRun,
      neutralizedTicksRemaining: bot.neutralizedTicksRemaining,
      retreatTicksRemaining: bot.retreatTicksRemaining,
    })),
    injected: (snapshot.injectedCards ?? []).map((card) => ({
      sourceBotId: card.sourceBotId,
      type: card.injectionType,
      ticksRemaining: card.ticksRemaining,
      mitigated: card.isMitigated,
      expired: card.isExpired,
    })),
  });
}

function countActiveBots(bots: Record<string, BattleBotRuntimeState>): number {
  return listActiveBots(bots).length;
}

function listActiveBots(bots: Record<string, BattleBotRuntimeState>): BattleBotId[] {
  return Object.values(bots)
    .filter((bot) => bot.state === 'WATCHING' || bot.state === 'TARGETING' || bot.state === 'ATTACKING')
    .map((bot) => bot.profileId);
}

function listBotsInState(
  bots: Record<string, BattleBotRuntimeState>,
  state: BattleBotState,
): BattleBotId[] {
  return Object.values(bots)
    .filter((bot) => bot.state === state)
    .map((bot) => bot.profileId);
}

function isResolvedDuel(duel: BattleSyndicateDuel): boolean {
  return ['RESOLVED', 'CANCELLED'].includes(duel.state.toUpperCase());
}

function heatToThreatBand(heat: number, config: BattleEngineAdapterConfig): BattleThreatBand {
  if (heat >= config.criticalHeatThreshold) return 'CRITICAL';
  if (heat >= config.highHeatThreshold) return 'HIGH';
  if (heat >= config.mediumHeatThreshold) return 'MEDIUM';
  return 'LOW';
}

function mapThreatToNotificationSeverity(threat: BattleThreatBand): ChatNotificationSeverity {
  switch (threat) {
    case 'CRITICAL': return 'CRITICAL';
    case 'HIGH': return 'WARN';
    case 'MEDIUM': return 'TACTICAL';
    default: return 'INFO';
  }
}

function threatRank(value: BattleThreatBand): number {
  switch (value) {
    case 'CRITICAL': return 4;
    case 'HIGH': return 3;
    case 'MEDIUM': return 2;
    default: return 1;
  }
}

function preferredSeverityBody(parts: Array<string | undefined | null>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' ');
}

function inferTick(payload: Record<string, unknown>): number | undefined {
  return asNumber(payload.tickIndex) ?? asNumber(payload.tickNumber);
}

function dedupeChannels(values: readonly ChatChannel[]): ChatChannel[] {
  const out: ChatChannel[] = [];
  for (const value of values) {
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Generic helpers
// -----------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return asString(value);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asNullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return asNumber(value);
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function average(a: number, b: number): number {
  return (a + b) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function createId(prefix: string): string {
  return `${prefix}.${Math.random().toString(36).slice(2, 10)}.${Date.now().toString(36)}`;
}

function now(): number {
  return Date.now();
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== 'object') return value as Readonly<T>;
  const seen = new WeakSet<object>();
  const visit = (input: unknown): void => {
    if (!input || typeof input !== 'object') return;
    const obj = input as Record<PropertyKey, unknown>;
    if (seen.has(obj)) return;
    seen.add(obj);
    for (const item of Object.values(obj)) visit(item);
    Object.freeze(obj);
  };
  visit(value);
  return value as Readonly<T>;
}

function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}
