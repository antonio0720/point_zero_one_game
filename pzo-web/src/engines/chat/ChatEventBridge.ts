/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ENGINE EVENT BRIDGE
 * FILE: pzo-web/src/engines/chat/ChatEventBridge.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Translate authoritative frontend engine events into normalized chat directives
 * for the new unified chat engine.
 *
 * This file is deliberately placed between:
 * - Engine 0 EventBus / mode runtime / mechanics runtime / other engine signals
 * and
 * - the future ChatEngine transcript / NPC / socket / intelligence layers.
 *
 * It is NOT a transcript store.
 * It is NOT a socket client.
 * It is NOT a UI component hook.
 *
 * It is the deterministic translation seam.
 *
 * Design doctrine
 * ---------------
 * 1. Frontend engine signals are inputs, not final authority.
 * 2. Event translation is explicit and testable.
 * 3. Major run moments emit structured chat batches, not ad hoc strings.
 * 4. Mode policy influences channel routing.
 * 5. Critical alerts can generate auxiliary mount hints for nearby surfaces.
 * 6. Dedupe is mandatory because the current repo already uses deferred batch
 *    flush semantics on the EventBus and some UI bridges can produce clustered
 *    signals in the same frame.
 *
 * Self-containment note
 * ---------------------
 * The new canonical chat contracts tree is part of the larger migration, but it
 * does not exist yet in the repo. This file therefore exports its own bridge
 * contracts so it can land immediately without waiting on the rest of the chat
 * extraction.
 */

import type { RunMode } from '../core/types';
import { EventBus, sharedEventBus } from '../zero/EventBus';
import { BotId, BotState, AttackType } from '../battle/types';
import { PressureTier } from '../pressure/types';
import { TickTier, type RunOutcome } from '../zero/types';
import { ShieldLayerId } from '../shield/types';

export type ChatBridgeChannel =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'DM'
  | 'SPECTATOR';

export type ChatBridgeMessageKind =
  | 'SYSTEM'
  | 'MARKET_ALERT'
  | 'ACHIEVEMENT'
  | 'BOT_TAUNT'
  | 'BOT_ATTACK'
  | 'HELPER_TIP'
  | 'SHIELD_EVENT'
  | 'CASCADE_ALERT'
  | 'LEGEND'
  | 'DEAL_RECAP'
  | 'NOTICE';

export type ChatBridgeSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

export type ChatBridgeMountTarget =
  | 'PRIMARY_DOCK'
  | 'COUNTERPLAY_MODAL'
  | 'EMPIRE_BLEED_BANNER'
  | 'MOMENT_FLASH'
  | 'PROOF_CARD'
  | 'PROOF_CARD_V2'
  | 'RESCUE_WINDOW_BANNER'
  | 'SABOTAGE_IMPACT_PANEL'
  | 'THREAT_RADAR_PANEL';

export interface ChatBridgeRuntimeSnapshot {
  mode: RunMode;
  runId?: string | null;
  userId?: string | null;
  tick?: number;
  cashBalance?: number;
  netWorth?: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  cashflow?: number;
  haterHeat?: number;
  pressureTier?: PressureTier;
  tickTier?: TickTier;
  activeThreatCardCount?: number;
  activeChannels?: ChatBridgeChannel[];
}

export interface ChatBridgeMessage {
  id: string;
  channel: ChatBridgeChannel;
  kind: ChatBridgeMessageKind;
  senderId: string;
  senderName: string;
  senderRank?: string;
  body: string;
  emoji?: string;
  ts: number;
  severity: ChatBridgeSeverity;
  tickIndex?: number;
  triggeredByEventType: string;
  proofHash?: string;
  pressureTier?: PressureTier;
  tickTier?: TickTier;
  runOutcome?: RunOutcome | string;
  targetLayerId?: ShieldLayerId | string;
  botId?: BotId;
  attackType?: AttackType;
  tags?: string[];
}

export interface ChatBridgeNotification {
  id: string;
  title: string;
  body: string;
  severity: ChatBridgeSeverity;
  target: ChatBridgeMountTarget;
  ts: number;
}

export interface ChatBridgeMountHint {
  target: ChatBridgeMountTarget;
  severity: ChatBridgeSeverity;
  reason: string;
}

export interface ChatBridgeBatch {
  bridgeBatchId: string;
  sourceEventType: string;
  tickIndex: number;
  messages: ChatBridgeMessage[];
  notifications: ChatBridgeNotification[];
  mountHints: ChatBridgeMountHint[];
  snapshot: ChatBridgeRuntimeSnapshot;
}

export type ChatBridgeListener = (batch: ChatBridgeBatch) => void;
export type SnapshotProvider = () => ChatBridgeRuntimeSnapshot;
export type Clock = () => number;

export interface ChatEventBridgeOptions {
  eventBus?: EventBus;
  snapshotProvider?: SnapshotProvider;
  clock?: Clock;
  dedupeWindowMs?: number;
}

/**
 * Known EventBus envelope shape.
 *
 * We keep this permissive because zero/types.ts is extremely broad and the
 * bridge only needs a subset of the payload graph.
 */
interface AnyBusEvent {
  eventType: string;
  payload: unknown;
  tickIndex?: number;
  timestamp?: number;
  sourceEngine?: unknown;
}

interface PressureTierChangedPayload {
  from?: PressureTier | string;
  to?: PressureTier | string;
  score?: number;
  triggerSignals?: string[];
}

interface ShieldLayerBreachedPayload {
  layerId?: ShieldLayerId | string;
  layerName?: string;
  breachConsequenceText?: string;
  cascadeTriggered?: boolean;
}

interface ShieldRepairPayload {
  layerId?: ShieldLayerId | string;
  ptsRepaired?: number;
  newIntegrity?: number;
  isFullyRepaired?: boolean;
}

interface ShieldFortifiedPayload {
  tickNumber?: number;
}

interface BotStateChangedPayload {
  botId?: BotId;
  from?: BotState | string;
  to?: BotState | string;
}

interface BotAttackEventPayload {
  attackId?: string;
  botId?: BotId;
  attackType?: AttackType | string;
  targetLayerId?: ShieldLayerId | string;
  secondaryAttackType?: AttackType | string | null;
  rawPower?: number;
}

interface BotAttackFiredPayload {
  botId?: BotId;
  attackEvent?: BotAttackEventPayload;
}

interface BotNeutralizedPayload {
  botId?: BotId;
  neutralizedTicks?: number;
}

interface CascadeTriggeredPayload {
  chainId?: string;
  severity?: string;
  direction?: 'NEGATIVE' | 'POSITIVE' | string;
  sourceLayerId?: ShieldLayerId | string;
}

interface CascadeChainBrokenPayload {
  chainId?: string;
  byCardId?: string;
  turnsRemaining?: number;
}

interface PositiveCascadePayload {
  cascadeId?: string;
  label?: string;
  multiplier?: number;
}

interface RunEndedPayload {
  outcome?: RunOutcome | string;
  proofHash?: string;
}

interface TickTierChangedPayload {
  from?: TickTier | string;
  to?: TickTier | string;
}

interface TickCompletePayload {
  tier?: TickTier | string;
  tickDurationMs?: number;
  tierChangedThisTick?: boolean;
}

interface SeasonTimeoutPayload {
  ticksRemaining?: number;
}

interface CardPlayedPayload {
  cardId?: string;
  cardName?: string;
  title?: string;
  type?: string;
  incomeDelta?: number;
  expenseDelta?: number;
}

interface ForcedCardInjectedPayload {
  injectionType?: string;
  cardName?: string;
  sourceBotId?: BotId;
  timerTicks?: number;
}

interface ForcedCardResolvedPayload {
  cardId?: string;
  cardName?: string;
  chosenOptionIndex?: number;
}

interface RescueWindowOpenedPayload {
  cardId?: string;
  secondsRemaining?: number;
  source?: string;
}

interface DecisionWindowOpenedPayload {
  window?: {
    cardId?: string;
    durationMs?: number;
    cardType?: string;
    expiresAtMs?: number;
  };
  cardId?: string;
  durationMs?: number;
  cardType?: string;
}

interface DecisionWindowExpiredPayload {
  cardId?: string;
  autoResolvedToOptionIndex?: number;
}

interface DecisionWindowResolvedPayload {
  cardId?: string;
  chosenOptionIndex?: number;
  msRemainingAtResolution?: number;
}

interface MechanicFiredPayload {
  mechanicId?: string;
  family?: string;
  signal?: number;
  reason?: string;
}

const BOT_DISPLAY: Readonly<Record<BotId, { name: string; emoji: string }>> = Object.freeze({
  [BotId.BOT_01_LIQUIDATOR]: { name: 'THE LIQUIDATOR', emoji: '🩸' },
  [BotId.BOT_02_BUREAUCRAT]: { name: 'THE BUREAUCRAT', emoji: '📑' },
  [BotId.BOT_03_MANIPULATOR]: { name: 'THE MANIPULATOR', emoji: '🧠' },
  [BotId.BOT_04_CRASH_PROPHET]: { name: 'THE CRASH PROPHET', emoji: '📉' },
  [BotId.BOT_05_LEGACY_HEIR]: { name: 'THE LEGACY HEIR', emoji: '👑' },
});

const HELPER_VOICES = Object.freeze({
  mentor: { senderId: 'helper_mentor', senderName: 'THE MENTOR', emoji: '🛡️' },
  insider: { senderId: 'helper_insider', senderName: 'THE INSIDER', emoji: '🧾' },
  survivor: { senderId: 'helper_survivor', senderName: 'THE SURVIVOR', emoji: '🫀' },
  rival: { senderId: 'helper_rival', senderName: 'THE RIVAL', emoji: '⚡' },
});

const CROWD_LINES = Object.freeze({
  runStart: [
    'Another run is live. Build clean. Survive first. Flex later.',
    'Clock is moving. Income before ego.',
  ],
  pressureCritical: [
    'Pressure just snapped to CRITICAL. Hide nothing. Fix the leak now.',
    'That pressure tier kills lazy sequencing. Tighten up.',
  ],
  shieldBreach: [
    'One layer down. This is where sloppy players spiral.',
    'Rebuild now or the next hit owns the tempo.',
  ],
  sovereignty: [
    'That is how you leave the rat race.',
    'Run remembered. Transcript earned.',
  ],
  cascade: [
    'Cascade live. Isolate damage before it writes the story for you.',
    'That chain gets ugly fast. Counter early.',
  ],
});

function defaultSnapshot(): ChatBridgeRuntimeSnapshot {
  return {
    mode: 'solo',
    tick: 0,
    cashBalance: 0,
    netWorth: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    cashflow: 0,
    haterHeat: 0,
    activeThreatCardCount: 0,
    activeChannels: ['GLOBAL', 'DEAL_ROOM', 'DM'],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
}

function castPayload<T>(value: unknown): T {
  return asRecord(value) as T;
}

function pick<T>(values: readonly T[], seed: number): T {
  return values[seed % values.length] ?? values[0]!;
}

function botDisplay(botId?: BotId): { name: string; emoji: string } {
  if (!botId) {
    return { name: 'HOSTILE SIGNAL', emoji: '⚠️' };
  }
  return BOT_DISPLAY[botId] ?? { name: botId, emoji: '⚠️' };
}

function coercePressureTier(value: unknown): PressureTier | undefined {
  return Object.values(PressureTier).find((entry) => entry === value);
}

function coerceTickTier(value: unknown): TickTier | undefined {
  return Object.values(TickTier).find((entry) => entry === value);
}

function modeChannels(mode: RunMode): readonly ChatBridgeChannel[] {
  switch (mode) {
    case 'co-op':
      return ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'DM'];
    case 'asymmetric-pvp':
      return ['GLOBAL', 'DEAL_ROOM', 'DM', 'SPECTATOR'];
    case 'ghost':
      return ['GLOBAL', 'DEAL_ROOM', 'DM'];
    case 'solo':
    default:
      return ['GLOBAL', 'DEAL_ROOM', 'DM'];
  }
}

export class ChatEventBridge {
  private readonly eventBus: EventBus;
  private snapshotProvider: SnapshotProvider;
  private readonly clock: Clock;
  private readonly dedupeWindowMs: number;
  private readonly listeners = new Set<ChatBridgeListener>();
  private readonly unsubscribers: Array<() => void> = [];
  private readonly lastEmissionByKey = new Map<string, number>();
  private started = false;
  private sequence = 0;

  public constructor(options: ChatEventBridgeOptions = {}) {
    this.eventBus = options.eventBus ?? sharedEventBus;
    this.snapshotProvider = options.snapshotProvider ?? defaultSnapshot;
    this.clock = options.clock ?? Date.now;
    this.dedupeWindowMs = options.dedupeWindowMs ?? 120;
  }

  public setSnapshotProvider(provider: SnapshotProvider): void {
    this.snapshotProvider = provider;
  }

  public start(): void {
    if (this.started) {
      return;
    }

    this.started = true;

    this.bind('RUN_STARTED');
    this.bind('RUN_ENDED');
    this.bind('TICK_COMPLETE');
    this.bind('TICK_TIER_CHANGED');
    this.bind('SEASON_TIMEOUT_IMMINENT');
    this.bind('PRESSURE_TIER_CHANGED');
    this.bind('PRESSURE_CRITICAL');
    this.bind('SHIELD_LAYER_BREACHED');
    this.bind('SHIELD_REPAIRED');
    this.bind('SHIELD_FORTIFIED');
    this.bind('BOT_STATE_CHANGED');
    this.bind('BOT_ATTACK_FIRED');
    this.bind('BOT_NEUTRALIZED');
    this.bind('CASCADE_CHAIN_TRIGGERED');
    this.bind('CASCADE_CHAIN_BROKEN');
    this.bind('CASCADE_POSITIVE_ACTIVATED');
    this.bind('CARD_PLAYED');
    this.bind('FORCED_CARD_INJECTED');
    this.bind('FORCED_CARD_RESOLVED');
    this.bind('RESCUE_WINDOW_OPENED');
    this.bind('DECISION_WINDOW_OPENED');
    this.bind('DECISION_WINDOW_EXPIRED');
    this.bind('DECISION_WINDOW_RESOLVED');
    this.bind('MECHANIC_FIRED');
  }

  public stop(): void {
    while (this.unsubscribers.length > 0) {
      this.unsubscribers.pop()?.();
    }
    this.started = false;
  }

  public subscribe(listener: ChatBridgeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public processEvent(
    eventType: string,
    payload: unknown,
    meta: Partial<AnyBusEvent> = {},
  ): void {
    this.handleEvent({
      eventType,
      payload,
      ...(meta.tickIndex !== undefined ? { tickIndex: meta.tickIndex } : {}),
      ...(meta.timestamp !== undefined ? { timestamp: meta.timestamp } : {}),
      ...(meta.sourceEngine !== undefined ? { sourceEngine: meta.sourceEngine } : {}),
    });
  }

  private bind(eventType: string): void {
    const unsubscribe = this.eventBus.on(eventType as never, ((event: AnyBusEvent) => {
      this.handleEvent(event);
    }) as never);

    this.unsubscribers.push(unsubscribe);
  }

  private handleEvent(event: AnyBusEvent): void {
    const snapshot = this.snapshotProvider();
    const tickIndex = event.tickIndex ?? snapshot.tick ?? 0;
    const timestamp = event.timestamp ?? this.clock();

    switch (event.eventType) {
      case 'RUN_STARTED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: 'RUN_STARTED',
          messages: this.handleRunStarted(snapshot, timestamp, tickIndex),
        });
        return;

      case 'RUN_ENDED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.runEndedDedupeKey(event.payload),
          messages: this.handleRunEnded(castPayload<RunEndedPayload>(event.payload), snapshot, timestamp, tickIndex),
          notifications: [
            this.notification('Run ended', 'Final run state has been written.', 'INFO', 'PROOF_CARD_V2', timestamp),
          ],
          mountHints: [{ target: 'PROOF_CARD_V2', severity: 'INFO', reason: 'run-ended' }],
        });
        return;

      case 'TICK_COMPLETE':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.tickCompleteDedupeKey(castPayload<TickCompletePayload>(event.payload), tickIndex),
          messages: this.handleTickComplete(castPayload<TickCompletePayload>(event.payload), snapshot, timestamp, tickIndex),
        });
        return;

      case 'TICK_TIER_CHANGED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.tickTierChangedDedupeKey(castPayload<TickTierChangedPayload>(event.payload), tickIndex),
          messages: this.handleTickTierChanged(castPayload<TickTierChangedPayload>(event.payload), snapshot, timestamp, tickIndex),
          mountHints: [{ target: 'MOMENT_FLASH', severity: 'WARNING', reason: 'tick-tier-changed' }],
        });
        return;

      case 'SEASON_TIMEOUT_IMMINENT':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.timeoutDedupeKey(castPayload<SeasonTimeoutPayload>(event.payload), tickIndex),
          messages: this.handleSeasonTimeout(castPayload<SeasonTimeoutPayload>(event.payload), snapshot, timestamp, tickIndex),
          notifications: [
            this.notification('Run timeout imminent', 'The season timer is almost out.', 'CRITICAL', 'RESCUE_WINDOW_BANNER', timestamp),
          ],
          mountHints: [{ target: 'RESCUE_WINDOW_BANNER', severity: 'CRITICAL', reason: 'season-timeout' }],
        });
        return;

      case 'PRESSURE_TIER_CHANGED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.pressureDedupeKey(castPayload<PressureTierChangedPayload>(event.payload), tickIndex),
          messages: this.handlePressureTierChanged(castPayload<PressureTierChangedPayload>(event.payload), snapshot, timestamp, tickIndex),
          mountHints: [{ target: 'THREAT_RADAR_PANEL', severity: 'WARNING', reason: 'pressure-tier-changed' }],
        });
        return;

      case 'PRESSURE_CRITICAL':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: `PRESSURE_CRITICAL:${tickIndex}`,
          messages: this.handlePressureCritical(snapshot, timestamp, tickIndex),
          notifications: [
            this.notification('Pressure critical', 'Shield drain and attack windows are live.', 'CRITICAL', 'EMPIRE_BLEED_BANNER', timestamp),
          ],
          mountHints: [
            { target: 'EMPIRE_BLEED_BANNER', severity: 'CRITICAL', reason: 'pressure-critical' },
            { target: 'THREAT_RADAR_PANEL', severity: 'CRITICAL', reason: 'pressure-critical' },
          ],
        });
        return;

      case 'SHIELD_LAYER_BREACHED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.shieldBreachDedupeKey(castPayload<ShieldLayerBreachedPayload>(event.payload), tickIndex),
          messages: this.handleShieldBreach(castPayload<ShieldLayerBreachedPayload>(event.payload), snapshot, timestamp, tickIndex),
          notifications: [
            this.notification('Shield breach', 'A protection layer has failed.', 'CRITICAL', 'THREAT_RADAR_PANEL', timestamp),
          ],
          mountHints: [
            { target: 'THREAT_RADAR_PANEL', severity: 'CRITICAL', reason: 'shield-breach' },
            { target: 'SABOTAGE_IMPACT_PANEL', severity: 'CRITICAL', reason: 'shield-breach' },
          ],
        });
        return;

      case 'SHIELD_REPAIRED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.shieldRepairDedupeKey(castPayload<ShieldRepairPayload>(event.payload), tickIndex),
          messages: this.handleShieldRepair(castPayload<ShieldRepairPayload>(event.payload), snapshot, timestamp, tickIndex),
        });
        return;

      case 'SHIELD_FORTIFIED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: `SHIELD_FORTIFIED:${tickIndex}`,
          messages: this.handleShieldFortified(snapshot, timestamp, tickIndex),
        });
        return;

      case 'BOT_STATE_CHANGED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.botStateDedupeKey(castPayload<BotStateChangedPayload>(event.payload), tickIndex),
          messages: this.handleBotStateChanged(castPayload<BotStateChangedPayload>(event.payload), snapshot, timestamp, tickIndex),
        });
        return;

      case 'BOT_ATTACK_FIRED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.botAttackDedupeKey(castPayload<BotAttackFiredPayload>(event.payload), tickIndex),
          messages: this.handleBotAttack(castPayload<BotAttackFiredPayload>(event.payload), snapshot, timestamp, tickIndex),
          notifications: [
            this.notification('Hostile attack fired', 'A hater attack is in flight.', 'CRITICAL', 'SABOTAGE_IMPACT_PANEL', timestamp),
          ],
          mountHints: [
            { target: 'SABOTAGE_IMPACT_PANEL', severity: 'CRITICAL', reason: 'bot-attack-fired' },
            { target: 'COUNTERPLAY_MODAL', severity: 'CRITICAL', reason: 'bot-attack-fired' },
          ],
        });
        return;

      case 'BOT_NEUTRALIZED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.botNeutralizedDedupeKey(castPayload<BotNeutralizedPayload>(event.payload), tickIndex),
          messages: this.handleBotNeutralized(castPayload<BotNeutralizedPayload>(event.payload), snapshot, timestamp, tickIndex),
        });
        return;

      case 'CASCADE_CHAIN_TRIGGERED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.cascadeTriggeredDedupeKey(castPayload<CascadeTriggeredPayload>(event.payload), tickIndex),
          messages: this.handleCascadeTriggered(castPayload<CascadeTriggeredPayload>(event.payload), snapshot, timestamp, tickIndex),
          notifications: [
            this.notification('Cascade triggered', 'A negative chain is now live.', 'CRITICAL', 'THREAT_RADAR_PANEL', timestamp),
          ],
          mountHints: [
            { target: 'THREAT_RADAR_PANEL', severity: 'CRITICAL', reason: 'cascade-triggered' },
            { target: 'MOMENT_FLASH', severity: 'CRITICAL', reason: 'cascade-triggered' },
          ],
        });
        return;

      case 'CASCADE_CHAIN_BROKEN':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.cascadeBrokenDedupeKey(castPayload<CascadeChainBrokenPayload>(event.payload), tickIndex),
          messages: this.handleCascadeBroken(castPayload<CascadeChainBrokenPayload>(event.payload), snapshot, timestamp, tickIndex),
        });
        return;

      case 'CASCADE_POSITIVE_ACTIVATED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: `POSITIVE_CASCADE:${tickIndex}`,
          messages: this.handlePositiveCascade(castPayload<PositiveCascadePayload>(event.payload), snapshot, timestamp, tickIndex),
          mountHints: [{ target: 'MOMENT_FLASH', severity: 'SUCCESS', reason: 'positive-cascade' }],
        });
        return;

      case 'CARD_PLAYED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.cardPlayedDedupeKey(castPayload<CardPlayedPayload>(event.payload), tickIndex),
          messages: this.handleCardPlayed(castPayload<CardPlayedPayload>(event.payload), snapshot, timestamp, tickIndex),
        });
        return;

      case 'FORCED_CARD_INJECTED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.forcedCardInjectedDedupeKey(castPayload<ForcedCardInjectedPayload>(event.payload), tickIndex),
          messages: this.handleForcedCardInjected(castPayload<ForcedCardInjectedPayload>(event.payload), snapshot, timestamp, tickIndex),
          mountHints: [{ target: 'SABOTAGE_IMPACT_PANEL', severity: 'WARNING', reason: 'forced-card-injected' }],
        });
        return;

      case 'FORCED_CARD_RESOLVED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.forcedCardResolvedDedupeKey(castPayload<ForcedCardResolvedPayload>(event.payload), tickIndex),
          messages: this.handleForcedCardResolved(castPayload<ForcedCardResolvedPayload>(event.payload), snapshot, timestamp, tickIndex),
        });
        return;

      case 'RESCUE_WINDOW_OPENED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.rescueWindowDedupeKey(castPayload<RescueWindowOpenedPayload>(event.payload), tickIndex),
          messages: this.handleRescueWindowOpened(castPayload<RescueWindowOpenedPayload>(event.payload), snapshot, timestamp, tickIndex),
          notifications: [
            this.notification('Rescue window open', 'A recovery intervention is available.', 'CRITICAL', 'RESCUE_WINDOW_BANNER', timestamp),
          ],
          mountHints: [{ target: 'RESCUE_WINDOW_BANNER', severity: 'CRITICAL', reason: 'rescue-window-opened' }],
        });
        return;

      case 'DECISION_WINDOW_OPENED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.decisionWindowOpenedDedupeKey(castPayload<DecisionWindowOpenedPayload>(event.payload), tickIndex),
          messages: this.handleDecisionWindowOpened(castPayload<DecisionWindowOpenedPayload>(event.payload), snapshot, timestamp, tickIndex),
          mountHints: [{ target: 'COUNTERPLAY_MODAL', severity: 'WARNING', reason: 'decision-window-opened' }],
        });
        return;

      case 'DECISION_WINDOW_EXPIRED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.decisionWindowExpiredDedupeKey(castPayload<DecisionWindowExpiredPayload>(event.payload), tickIndex),
          messages: this.handleDecisionWindowExpired(castPayload<DecisionWindowExpiredPayload>(event.payload), snapshot, timestamp, tickIndex),
          mountHints: [{ target: 'COUNTERPLAY_MODAL', severity: 'CRITICAL', reason: 'decision-window-expired' }],
        });
        return;

      case 'DECISION_WINDOW_RESOLVED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.decisionWindowResolvedDedupeKey(castPayload<DecisionWindowResolvedPayload>(event.payload), tickIndex),
          messages: this.handleDecisionWindowResolved(castPayload<DecisionWindowResolvedPayload>(event.payload), snapshot, timestamp, tickIndex),
        });
        return;

      case 'MECHANIC_FIRED':
        this.emitBatch(event.eventType, tickIndex, snapshot, {
          dedupeKey: this.mechanicFiredDedupeKey(castPayload<MechanicFiredPayload>(event.payload), tickIndex),
          messages: this.handleMechanicFired(castPayload<MechanicFiredPayload>(event.payload), snapshot, timestamp, tickIndex),
        });
        return;

      default:
        return;
    }
  }

  private emitBatch(
    eventType: string,
    tickIndex: number,
    snapshot: ChatBridgeRuntimeSnapshot,
    input: {
      dedupeKey: string;
      messages: ChatBridgeMessage[];
      notifications?: ChatBridgeNotification[];
      mountHints?: ChatBridgeMountHint[];
    },
  ): void {
    if (input.messages.length === 0 && (input.notifications?.length ?? 0) === 0) {
      return;
    }

    const currentTs = this.clock();
    const lastTs = this.lastEmissionByKey.get(input.dedupeKey);
    if (typeof lastTs === 'number' && currentTs - lastTs < this.dedupeWindowMs) {
      return;
    }

    this.lastEmissionByKey.set(input.dedupeKey, currentTs);

    const batch: ChatBridgeBatch = {
      bridgeBatchId: this.nextId('bridge_batch'),
      sourceEventType: eventType,
      tickIndex,
      messages: input.messages,
      notifications: input.notifications ?? [],
      mountHints: input.mountHints ?? [],
      snapshot,
    };

    for (const listener of this.listeners) {
      listener(batch);
    }
  }

  private handleRunStarted(
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    return [
      this.systemMessage(
        'GLOBAL',
        'SYSTEM',
        'Run live. Authority transferred to the tick loop. Build cashflow before the pressure curve bites.',
        'SUCCESS',
        'RUN_STARTED',
        timestamp,
        tickIndex,
        {
          ...(snapshot.pressureTier !== undefined ? { pressureTier: snapshot.pressureTier } : {}),
          ...(snapshot.tickTier !== undefined ? { tickTier: snapshot.tickTier } : {}),
          tags: ['run', 'start'],
        },
      ),
      this.crowdMessage(
        'GLOBAL',
        pick(CROWD_LINES.runStart, tickIndex),
        timestamp + 160,
        tickIndex,
        'RUN_STARTED',
      ),
    ];
  }

  private handleRunEnded(
    payload: RunEndedPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const outcome = payload.outcome ?? 'ABANDONED';
    const proofHash = payload.proofHash;

    const body =
      outcome === 'FREEDOM'
        ? 'Run complete. Freedom threshold crossed. Proof pipeline ready.'
        : outcome === 'TIMEOUT'
          ? 'Run complete. Timer won the race. Post-run review is available.'
          : outcome === 'BANKRUPT'
            ? 'Run complete. Bankruptcy state locked. Transcript preserved for forensic review.'
            : 'Run complete. Session closed before sovereignty.';

    const messages: ChatBridgeMessage[] = [
      this.systemMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'RUN_ENDED'),
        outcome === 'FREEDOM' ? 'LEGEND' : 'SYSTEM',
        body,
        outcome === 'FREEDOM' ? 'SUCCESS' : 'INFO',
        'RUN_ENDED',
        timestamp,
        tickIndex,
        {
          ...(proofHash !== undefined ? { proofHash } : {}),
          runOutcome: outcome,
          tags: ['run', 'ended'],
        },
      ),
    ];

    if (outcome === 'FREEDOM') {
      messages.push(
        this.crowdMessage(
          'GLOBAL',
          pick(CROWD_LINES.sovereignty, tickIndex),
          timestamp + 180,
          tickIndex,
          'RUN_ENDED',
          'SUCCESS',
        ),
      );
    }

    return messages;
  }

  private handleTickComplete(
    payload: TickCompletePayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    if (!payload.tierChangedThisTick) {
      return [];
    }

    const tier = coerceTickTier(payload.tier) ?? snapshot.tickTier;
    if (!tier) {
      return [];
    }

    return [
      this.systemMessage(
        'GLOBAL',
        'NOTICE',
        `Tick cadence updated to ${tier}. Decision tempo has changed.`,
        tier === TickTier.CRISIS || tier === TickTier.COLLAPSE_IMMINENT ? 'WARNING' : 'INFO',
        'TICK_COMPLETE',
        timestamp,
        tickIndex,
        {
          tickTier: tier,
          tags: ['tick', 'cadence'],
        },
      ),
    ];
  }

  private handleTickTierChanged(
    payload: TickTierChangedPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const from = coerceTickTier(payload.from) ?? snapshot.tickTier;
    const to = coerceTickTier(payload.to) ?? snapshot.tickTier;
    const severity: ChatBridgeSeverity =
      to === TickTier.CRISIS || to === TickTier.COLLAPSE_IMMINENT ? 'WARNING' : 'INFO';

    return [
      this.systemMessage(
        'GLOBAL',
        'NOTICE',
        `Tick tier changed${from ? ` ${from} →` : ''} ${to ?? 'UNKNOWN'}. The game is compressing your response window.`,
        severity,
        'TICK_TIER_CHANGED',
        timestamp,
        tickIndex,
        {
          ...(to !== undefined ? { tickTier: to } : {}),
          tags: ['tick', 'tier-change'],
        },
      ),
    ];
  }

  private handleSeasonTimeout(
    payload: SeasonTimeoutPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const ticksRemaining = payload.ticksRemaining ?? 0;
    return [
      this.helperMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'SEASON_TIMEOUT_IMMINENT'),
        HELPER_VOICES.mentor,
        `Time is almost gone. ${ticksRemaining > 0 ? `${ticksRemaining} ticks remain.` : 'The window is closing now.'} Stop styling. Close the strongest line.`,
        'CRITICAL',
        'SEASON_TIMEOUT_IMMINENT',
        timestamp,
        tickIndex,
        { tags: ['timeout', 'mentor'] },
      ),
    ];
  }

  private handlePressureTierChanged(
    payload: PressureTierChangedPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const to = coercePressureTier(payload.to) ?? snapshot.pressureTier;
    if (!to) {
      return [];
    }

    const body =
      to === PressureTier.CRITICAL
        ? 'PRESSURE: CRITICAL — passive drain is live and hostile timing windows are open.'
        : to === PressureTier.HIGH
          ? 'PRESSURE: HIGH — one bad sequence can cost a layer. Tighten capital defense.'
          : to === PressureTier.ELEVATED
            ? 'PRESSURE: ELEVATED — the run is no longer forgiving. Tradeoffs matter now.'
            : to === PressureTier.BUILDING
              ? 'PRESSURE: BUILDING — early warning. Clean up before it compounds.'
              : 'PRESSURE: CALM — breathing room regained.';

    const severity: ChatBridgeSeverity =
      to === PressureTier.CRITICAL
        ? 'CRITICAL'
        : to === PressureTier.HIGH
          ? 'WARNING'
          : to === PressureTier.CALM
            ? 'SUCCESS'
            : 'INFO';

    const messages: ChatBridgeMessage[] = [
      this.systemMessage(
        'GLOBAL',
        'MARKET_ALERT',
        body,
        severity,
        'PRESSURE_TIER_CHANGED',
        timestamp,
        tickIndex,
        {
          pressureTier: to,
          tags: ['pressure', 'tier'],
        },
      ),
    ];

    if (to === PressureTier.CRITICAL) {
      messages.push(
        this.crowdMessage(
          'GLOBAL',
          pick(CROWD_LINES.pressureCritical, tickIndex),
          timestamp + 180,
          tickIndex,
          'PRESSURE_TIER_CHANGED',
          'WARNING',
        ),
      );
    }

    return messages;
  }

  private handlePressureCritical(
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    return [
      this.helperMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'PRESSURE_CRITICAL'),
        HELPER_VOICES.survivor,
        'This is the collapse edge. Stop chasing upside. Stabilize shields, protect cash, and remove ego from the next choice.',
        'CRITICAL',
        'PRESSURE_CRITICAL',
        timestamp,
        tickIndex,
        { tags: ['pressure', 'critical', 'rescue'] },
      ),
    ];
  }

  private handleShieldBreach(
    payload: ShieldLayerBreachedPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const layer = payload.layerId ?? 'UNKNOWN_LAYER';
    const consequence = payload.breachConsequenceText ?? 'Protection failed.';
    const channel = this.resolvePrimaryChannel(snapshot.mode, 'SHIELD_LAYER_BREACHED');

    const messages: ChatBridgeMessage[] = [
      this.systemMessage(
        channel,
        'SHIELD_EVENT',
        `SHIELD BREACH — ${layer} compromised. ${consequence}`,
        'CRITICAL',
        'SHIELD_LAYER_BREACHED',
        timestamp,
        tickIndex,
        {
          targetLayerId: layer,
          tags: ['shield', 'breach'],
        },
      ),
      this.crowdMessage(
        channel,
        pick(CROWD_LINES.shieldBreach, tickIndex),
        timestamp + 120,
        tickIndex,
        'SHIELD_LAYER_BREACHED',
        'WARNING',
      ),
    ];

    if (payload.cascadeTriggered) {
      messages.push(
        this.helperMessage(
          channel,
          HELPER_VOICES.insider,
          'That breach can cascade. Next defensive choice is worth more than the last aggressive one.',
          'CRITICAL',
          'SHIELD_LAYER_BREACHED',
          timestamp + 240,
          tickIndex,
          {
            targetLayerId: layer,
            tags: ['shield', 'cascade-risk'],
          },
        ),
      );
    }

    return messages;
  }

  private handleShieldRepair(
    payload: ShieldRepairPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const layer = payload.layerId ?? 'UNKNOWN_LAYER';
    const repaired = payload.ptsRepaired ?? 0;
    const body = payload.isFullyRepaired
      ? `${layer} fully restored. That buys breathing room.`
      : `${layer} repaired +${repaired}. Stabilization in progress.`;

    return [
      this.systemMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'SHIELD_REPAIRED'),
        'SHIELD_EVENT',
        body,
        payload.isFullyRepaired ? 'SUCCESS' : 'INFO',
        'SHIELD_REPAIRED',
        timestamp,
        tickIndex,
        {
          targetLayerId: layer,
          tags: ['shield', 'repair'],
        },
      ),
    ];
  }

  private handleShieldFortified(
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    return [
      this.systemMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'SHIELD_FORTIFIED'),
        'SHIELD_EVENT',
        'SHIELD FORTIFIED — every layer is holding strong enough to punish bad enemy timing.',
        'SUCCESS',
        'SHIELD_FORTIFIED',
        timestamp,
        tickIndex,
        { tags: ['shield', 'fortified'] },
      ),
    ];
  }

  private handleBotStateChanged(
    payload: BotStateChangedPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const display = botDisplay(payload.botId);
    const to = payload.to ?? 'UNKNOWN';

    if (to === BotState.WATCHING || to === 'WATCHING') {
      return [
        this.botMessage(
          this.resolvePrimaryChannel(snapshot.mode, 'BOT_STATE_CHANGED'),
          payload.botId,
          `${display.name} is watching. The game has marked your pattern.`,
          'WARNING',
          'BOT_STATE_CHANGED',
          timestamp,
          tickIndex,
          { tags: ['bot', 'watching'] },
        ),
      ];
    }

    if (to === BotState.TARGETING || to === 'TARGETING') {
      return [
        this.botMessage(
          this.resolvePrimaryChannel(snapshot.mode, 'BOT_STATE_CHANGED'),
          payload.botId,
          `${display.name} has shifted from watching to targeting. Your next line is legible. Change it.`,
          'WARNING',
          'BOT_STATE_CHANGED',
          timestamp,
          tickIndex,
          { tags: ['bot', 'targeting'] },
        ),
      ];
    }

    return [];
  }

  private handleBotAttack(
    payload: BotAttackFiredPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const attack = payload.attackEvent ?? {};
    const botId = payload.botId ?? attack.botId;
    const display = botDisplay(botId);
    const attackType = attack.attackType;
    const layer = attack.targetLayerId ?? 'UNKNOWN_LAYER';
    const channel = this.resolvePrimaryChannel(snapshot.mode, 'BOT_ATTACK_FIRED');

    return [
      this.systemMessage(
        channel,
        'BOT_ATTACK',
        `${display.name} fired ${attackType ?? 'HOSTILE_ACTION'} toward ${layer}. Counterplay window is open if you still have tempo.`,
        'CRITICAL',
        'BOT_ATTACK_FIRED',
        timestamp,
        tickIndex,
        {
          ...(botId !== undefined ? { botId } : {}),
          ...(typeof attackType === 'string' ? { attackType: attackType as AttackType } : {}),
          targetLayerId: layer,
          tags: ['bot', 'attack'],
        },
      ),
      this.botMessage(
        channel,
        botId,
        this.tauntForAttack(botId, attackType, layer),
        'CRITICAL',
        'BOT_ATTACK_FIRED',
        timestamp + 180,
        tickIndex,
        {
          ...(typeof attackType === 'string' ? { attackType: attackType as AttackType } : {}),
          targetLayerId: layer,
          tags: ['bot', 'taunt', 'attack'],
        },
      ),
      this.helperMessage(
        channel,
        HELPER_VOICES.rival,
        'Answer the line, not the ego hit. Read the target and trade efficiently.',
        'WARNING',
        'BOT_ATTACK_FIRED',
        timestamp + 320,
        tickIndex,
        { tags: ['counterplay', 'rival'] },
      ),
    ];
  }

  private handleBotNeutralized(
    payload: BotNeutralizedPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const display = botDisplay(payload.botId);
    return [
      this.systemMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'BOT_NEUTRALIZED'),
        'ACHIEVEMENT',
        `${display.name} neutralized. The hostile window is closed for now.`,
        'SUCCESS',
        'BOT_NEUTRALIZED',
        timestamp,
        tickIndex,
        {
          ...(payload.botId !== undefined ? { botId: payload.botId } : {}),
          tags: ['bot', 'neutralized'],
        },
      ),
    ];
  }

  private handleCascadeTriggered(
    payload: CascadeTriggeredPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const channel = this.resolvePrimaryChannel(snapshot.mode, 'CASCADE_CHAIN_TRIGGERED');
    const direction = payload.direction ?? 'NEGATIVE';
    const severity = direction === 'POSITIVE' ? 'SUCCESS' : 'CRITICAL';

    const messages: ChatBridgeMessage[] = [
      this.systemMessage(
        channel,
        'CASCADE_ALERT',
        `CASCADE ${direction} — chain ${payload.chainId ?? 'UNKNOWN'} is now active.`,
        severity,
        'CASCADE_CHAIN_TRIGGERED',
        timestamp,
        tickIndex,
        {
          ...(payload.sourceLayerId !== undefined ? { targetLayerId: payload.sourceLayerId } : {}),
          tags: ['cascade', 'triggered'],
        },
      ),
    ];

    if (direction !== 'POSITIVE') {
      messages.push(
        this.crowdMessage(
          channel,
          pick(CROWD_LINES.cascade, tickIndex),
          timestamp + 160,
          tickIndex,
          'CASCADE_CHAIN_TRIGGERED',
          'WARNING',
        ),
      );
    }

    return messages;
  }

  private handleCascadeBroken(
    payload: CascadeChainBrokenPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    return [
      this.systemMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'CASCADE_CHAIN_BROKEN'),
        'ACHIEVEMENT',
        `Cascade chain ${payload.chainId ?? 'UNKNOWN'} broken. Recovery line held.`,
        'SUCCESS',
        'CASCADE_CHAIN_BROKEN',
        timestamp,
        tickIndex,
        { tags: ['cascade', 'broken'] },
      ),
    ];
  }

  private handlePositiveCascade(
    payload: PositiveCascadePayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    return [
      this.systemMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'CASCADE_POSITIVE_ACTIVATED'),
        'LEGEND',
        `${payload.label ?? 'Positive cascade'} activated${payload.multiplier ? ` at ${payload.multiplier}x` : ''}. Momentum is now compounding in your favor.`,
        'SUCCESS',
        'CASCADE_POSITIVE_ACTIVATED',
        timestamp,
        tickIndex,
        { tags: ['cascade', 'positive'] },
      ),
    ];
  }

  private handleCardPlayed(
    payload: CardPlayedPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const cardName = payload.cardName ?? payload.title ?? payload.cardId ?? 'Card';
    const deltaParts: string[] = [];

    if (typeof payload.incomeDelta === 'number' && payload.incomeDelta !== 0) {
      deltaParts.push(`income ${payload.incomeDelta >= 0 ? '+' : ''}${payload.incomeDelta}`);
    }
    if (typeof payload.expenseDelta === 'number' && payload.expenseDelta !== 0) {
      deltaParts.push(`expense ${payload.expenseDelta >= 0 ? '+' : ''}${payload.expenseDelta}`);
    }

    const suffix = deltaParts.length > 0 ? ` (${deltaParts.join(' · ')})` : '';

    return [
      this.systemMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'CARD_PLAYED'),
        'ACHIEVEMENT',
        `CARD PLAYED — ${cardName}${suffix}.`,
        'INFO',
        'CARD_PLAYED',
        timestamp,
        tickIndex,
        { tags: ['card', 'played'] },
      ),
    ];
  }

  private handleForcedCardInjected(
    payload: ForcedCardInjectedPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const bot = botDisplay(payload.sourceBotId);
    return [
      this.botMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'FORCED_CARD_INJECTED'),
        payload.sourceBotId,
        `${bot.name} injected ${payload.cardName ?? payload.injectionType ?? 'a forced card'}. You do not control the board right now.`,
        'WARNING',
        'FORCED_CARD_INJECTED',
        timestamp,
        tickIndex,
        { tags: ['forced-card', 'injected'] },
      ),
    ];
  }

  private handleForcedCardResolved(
    payload: ForcedCardResolvedPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    return [
      this.systemMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'FORCED_CARD_RESOLVED'),
        'NOTICE',
        `${payload.cardName ?? payload.cardId ?? 'Forced card'} resolved to option ${payload.chosenOptionIndex ?? 0}.`,
        'INFO',
        'FORCED_CARD_RESOLVED',
        timestamp,
        tickIndex,
        { tags: ['forced-card', 'resolved'] },
      ),
    ];
  }

  private handleRescueWindowOpened(
    payload: RescueWindowOpenedPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const secondsRemaining = payload.secondsRemaining ?? 0;
    return [
      this.helperMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'RESCUE_WINDOW_OPENED'),
        HELPER_VOICES.mentor,
        `Recovery window is open${secondsRemaining > 0 ? ` for ${secondsRemaining}s` : ''}. Take the save if the board is already writing your obituary.`,
        'CRITICAL',
        'RESCUE_WINDOW_OPENED',
        timestamp,
        tickIndex,
        { tags: ['rescue', 'window'] },
      ),
    ];
  }

  private handleDecisionWindowOpened(
    payload: DecisionWindowOpenedPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    const cardId = payload.window?.cardId ?? payload.cardId ?? 'unknown-card';
    const durationMs = payload.window?.durationMs ?? payload.durationMs ?? 0;
    const seconds = Math.max(1, Math.round(durationMs / 1000));

    return [
      this.systemMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'DECISION_WINDOW_OPENED'),
        'NOTICE',
        `Decision window opened for ${cardId}. ${seconds}s on the clock.`,
        'WARNING',
        'DECISION_WINDOW_OPENED',
        timestamp,
        tickIndex,
        { tags: ['decision', 'window-opened'] },
      ),
    ];
  }

  private handleDecisionWindowExpired(
    payload: DecisionWindowExpiredPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    return [
      this.systemMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'DECISION_WINDOW_EXPIRED'),
        'NOTICE',
        `${payload.cardId ?? 'Decision card'} expired and auto-resolved to option ${payload.autoResolvedToOptionIndex ?? 0}.`,
        'CRITICAL',
        'DECISION_WINDOW_EXPIRED',
        timestamp,
        tickIndex,
        { tags: ['decision', 'expired'] },
      ),
    ];
  }

  private handleDecisionWindowResolved(
    payload: DecisionWindowResolvedPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    return [
      this.systemMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'DECISION_WINDOW_RESOLVED'),
        'NOTICE',
        `${payload.cardId ?? 'Decision card'} resolved by player choice ${payload.chosenOptionIndex ?? 0}.`,
        'INFO',
        'DECISION_WINDOW_RESOLVED',
        timestamp,
        tickIndex,
        { tags: ['decision', 'resolved'] },
      ),
    ];
  }

  private handleMechanicFired(
    payload: MechanicFiredPayload,
    snapshot: ChatBridgeRuntimeSnapshot,
    timestamp: number,
    tickIndex: number,
  ): ChatBridgeMessage[] {
    if (!payload.mechanicId && !payload.family) {
      return [];
    }

    return [
      this.systemMessage(
        this.resolvePrimaryChannel(snapshot.mode, 'MECHANIC_FIRED'),
        'NOTICE',
        `Mechanic fired — ${payload.mechanicId ?? payload.family}${payload.reason ? ` (${payload.reason})` : ''}.`,
        'INFO',
        'MECHANIC_FIRED',
        timestamp,
        tickIndex,
        { tags: ['mechanic', payload.family ?? 'unknown'] },
      ),
    ];
  }

  private systemMessage(
    channel: ChatBridgeChannel,
    kind: ChatBridgeMessageKind,
    body: string,
    severity: ChatBridgeSeverity,
    triggeredByEventType: string,
    timestamp: number,
    tickIndex: number,
    extras: Partial<ChatBridgeMessage> = {},
  ): ChatBridgeMessage {
    return {
      id: this.nextId('system'),
      channel,
      kind,
      senderId: 'SYSTEM',
      senderName: 'SYSTEM',
      body,
      ts: timestamp,
      severity,
      tickIndex,
      triggeredByEventType,
      ...extras,
    };
  }

  private botMessage(
    channel: ChatBridgeChannel,
    botId: BotId | undefined,
    body: string,
    severity: ChatBridgeSeverity,
    triggeredByEventType: string,
    timestamp: number,
    tickIndex: number,
    extras: Partial<ChatBridgeMessage> = {},
  ): ChatBridgeMessage {
    const display = botDisplay(botId);
    return {
      id: this.nextId('bot'),
      channel,
      kind: 'BOT_TAUNT',
      senderId: botId ?? 'HOSTILE_SIGNAL',
      senderName: display.name,
      emoji: display.emoji,
      body,
      ts: timestamp,
      severity,
      tickIndex,
      triggeredByEventType,
      ...(botId !== undefined ? { botId } : {}),
      ...extras,
    };
  }

  private helperMessage(
    channel: ChatBridgeChannel,
    helper: { senderId: string; senderName: string; emoji: string },
    body: string,
    severity: ChatBridgeSeverity,
    triggeredByEventType: string,
    timestamp: number,
    tickIndex: number,
    extras: Partial<ChatBridgeMessage> = {},
  ): ChatBridgeMessage {
    return {
      id: this.nextId('helper'),
      channel,
      kind: 'HELPER_TIP',
      senderId: helper.senderId,
      senderName: helper.senderName,
      emoji: helper.emoji,
      body,
      ts: timestamp,
      severity,
      tickIndex,
      triggeredByEventType,
      ...extras,
    };
  }

  private crowdMessage(
    channel: ChatBridgeChannel,
    body: string,
    timestamp: number,
    tickIndex: number,
    triggeredByEventType: string,
    severity: ChatBridgeSeverity = 'INFO',
  ): ChatBridgeMessage {
    return {
      id: this.nextId('crowd'),
      channel,
      kind: 'NOTICE',
      senderId: 'crowd_global',
      senderName: 'CROWD',
      senderRank: 'Observer',
      body,
      ts: timestamp,
      severity,
      tickIndex,
      triggeredByEventType,
      tags: ['crowd'],
    };
  }

  private notification(
    title: string,
    body: string,
    severity: ChatBridgeSeverity,
    target: ChatBridgeMountTarget,
    timestamp: number,
  ): ChatBridgeNotification {
    return {
      id: this.nextId('notification'),
      title,
      body,
      severity,
      target,
      ts: timestamp,
    };
  }

  private resolvePrimaryChannel(
    mode: RunMode,
    eventType: string,
  ): ChatBridgeChannel {
    if (mode === 'co-op') {
      if (
        eventType === 'RESCUE_WINDOW_OPENED' ||
        eventType === 'SHIELD_LAYER_BREACHED' ||
        eventType === 'SHIELD_REPAIRED'
      ) {
        return 'SYNDICATE';
      }
    }

    if (mode === 'asymmetric-pvp') {
      if (
        eventType === 'BOT_ATTACK_FIRED' ||
        eventType === 'FORCED_CARD_INJECTED' ||
        eventType === 'DECISION_WINDOW_OPENED'
      ) {
        return 'DEAL_ROOM';
      }
    }

    return modeChannels(mode)[0] ?? 'GLOBAL';
  }

  private tauntForAttack(
    botId: BotId | undefined,
    attackType: unknown,
    layer: unknown,
  ): string {
    const display = botDisplay(botId);
    switch (botId) {
      case BotId.BOT_01_LIQUIDATOR:
        return `Your ${String(layer)} looked expensive. ${display.name} prefers distressed pricing.`;
      case BotId.BOT_02_BUREAUCRAT:
        return `Compliance found a crack in ${String(layer)}. Forms were never optional.`;
      case BotId.BOT_03_MANIPULATOR:
        return `Pattern confirmed. ${String(attackType ?? 'attack')} was always the next branch.`;
      case BotId.BOT_04_CRASH_PROPHET:
        return `Volatility always arrives exactly when your protection is overconfident.`;
      case BotId.BOT_05_LEGACY_HEIR:
        return `Inheritance loves leverage. ${String(layer)} was never yours for long.`;
      default:
        return `${display.name} has committed to ${String(attackType ?? 'hostile action')} against ${String(layer)}.`;
    }
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.clock()}_${this.sequence}`;
  }

  private runEndedDedupeKey(payload: unknown): string {
    const p = castPayload<RunEndedPayload>(payload);
    return `RUN_ENDED:${p.outcome ?? 'UNKNOWN'}:${p.proofHash ?? 'none'}`;
  }

  private tickCompleteDedupeKey(payload: TickCompletePayload, tickIndex: number): string {
    return `TICK_COMPLETE:${tickIndex}:${payload.tier ?? 'none'}:${payload.tierChangedThisTick ? 'tier-change' : 'plain'}`;
  }

  private tickTierChangedDedupeKey(payload: TickTierChangedPayload, tickIndex: number): string {
    return `TICK_TIER_CHANGED:${tickIndex}:${payload.from ?? 'none'}:${payload.to ?? 'none'}`;
  }

  private timeoutDedupeKey(payload: SeasonTimeoutPayload, tickIndex: number): string {
    return `SEASON_TIMEOUT_IMMINENT:${tickIndex}:${payload.ticksRemaining ?? 'unknown'}`;
  }

  private pressureDedupeKey(payload: PressureTierChangedPayload, tickIndex: number): string {
    return `PRESSURE_TIER_CHANGED:${tickIndex}:${payload.from ?? 'none'}:${payload.to ?? 'none'}`;
  }

  private shieldBreachDedupeKey(payload: ShieldLayerBreachedPayload, tickIndex: number): string {
    return `SHIELD_LAYER_BREACHED:${tickIndex}:${payload.layerId ?? 'unknown'}:${payload.cascadeTriggered ? 'cascade' : 'plain'}`;
  }

  private shieldRepairDedupeKey(payload: ShieldRepairPayload, tickIndex: number): string {
    return `SHIELD_REPAIRED:${tickIndex}:${payload.layerId ?? 'unknown'}:${payload.newIntegrity ?? 'unknown'}`;
  }

  private botStateDedupeKey(payload: BotStateChangedPayload, tickIndex: number): string {
    return `BOT_STATE_CHANGED:${tickIndex}:${payload.botId ?? 'unknown'}:${payload.from ?? 'none'}:${payload.to ?? 'none'}`;
  }

  private botAttackDedupeKey(payload: BotAttackFiredPayload, tickIndex: number): string {
    return `BOT_ATTACK_FIRED:${tickIndex}:${payload.attackEvent?.attackId ?? 'unknown'}`;
  }

  private botNeutralizedDedupeKey(payload: BotNeutralizedPayload, tickIndex: number): string {
    return `BOT_NEUTRALIZED:${tickIndex}:${payload.botId ?? 'unknown'}`;
  }

  private cascadeTriggeredDedupeKey(payload: CascadeTriggeredPayload, tickIndex: number): string {
    return `CASCADE_CHAIN_TRIGGERED:${tickIndex}:${payload.chainId ?? 'unknown'}`;
  }

  private cascadeBrokenDedupeKey(payload: CascadeChainBrokenPayload, tickIndex: number): string {
    return `CASCADE_CHAIN_BROKEN:${tickIndex}:${payload.chainId ?? 'unknown'}`;
  }

  private cardPlayedDedupeKey(payload: CardPlayedPayload, tickIndex: number): string {
    return `CARD_PLAYED:${tickIndex}:${payload.cardId ?? payload.cardName ?? payload.title ?? 'unknown'}`;
  }

  private forcedCardInjectedDedupeKey(payload: ForcedCardInjectedPayload, tickIndex: number): string {
    return `FORCED_CARD_INJECTED:${tickIndex}:${payload.cardName ?? payload.injectionType ?? 'unknown'}`;
  }

  private forcedCardResolvedDedupeKey(payload: ForcedCardResolvedPayload, tickIndex: number): string {
    return `FORCED_CARD_RESOLVED:${tickIndex}:${payload.cardId ?? payload.cardName ?? 'unknown'}:${payload.chosenOptionIndex ?? 'unknown'}`;
  }

  private rescueWindowDedupeKey(payload: RescueWindowOpenedPayload, tickIndex: number): string {
    return `RESCUE_WINDOW_OPENED:${tickIndex}:${payload.cardId ?? 'unknown'}`;
  }

  private decisionWindowOpenedDedupeKey(payload: DecisionWindowOpenedPayload, tickIndex: number): string {
    return `DECISION_WINDOW_OPENED:${tickIndex}:${payload.window?.cardId ?? payload.cardId ?? 'unknown'}`;
  }

  private decisionWindowExpiredDedupeKey(payload: DecisionWindowExpiredPayload, tickIndex: number): string {
    return `DECISION_WINDOW_EXPIRED:${tickIndex}:${payload.cardId ?? 'unknown'}:${payload.autoResolvedToOptionIndex ?? 'unknown'}`;
  }

  private decisionWindowResolvedDedupeKey(payload: DecisionWindowResolvedPayload, tickIndex: number): string {
    return `DECISION_WINDOW_RESOLVED:${tickIndex}:${payload.cardId ?? 'unknown'}:${payload.chosenOptionIndex ?? 'unknown'}`;
  }

  private mechanicFiredDedupeKey(payload: MechanicFiredPayload, tickIndex: number): string {
    return `MECHANIC_FIRED:${tickIndex}:${payload.mechanicId ?? payload.family ?? 'unknown'}`;
  }
}

/**
 * Canonical frontend singleton. Safe to import wherever the new chat engine is
 * assembled, but keep actual consumer wiring out of UI shells.
 */
export const chatEventBridge = new ChatEventBridge();
