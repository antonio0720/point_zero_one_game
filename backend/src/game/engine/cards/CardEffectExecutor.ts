/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardEffectExecutor.ts
 *
 * Doctrine:
 * - backend applies card state changes immutably and authoritatively
 * - effect execution must preserve deterministic replay for the same snapshot and card instance
 * - card lifecycle side effects must not corrupt snapshot invariants
 * - mode-specific card behavior is enforced backend-side, never delegated to UI
 * - compilation metadata from CardEffectCompiler is first-class execution input, not optional decoration
 * - unsupported/deferred effect fields must be surfaced into backend state or telemetry, never silently discarded
 * - execution must leave enough deterministic residue for proof, chat witness, and post-run audit systems
 */

import type {
  CardInstance,
  DeckType,
  ModeCode,
  Targeting,
  TimingClass,
} from '../core/GamePrimitives';
import type {
  BotRuntimeState,
  EconomyState,
  RunStateSnapshot,
  ShieldLayerState,
  ShieldState,
} from '../core/RunStateSnapshot';
import {
  CardEffectCompiler,
  type CardCompilationPlan,
  type CompiledOperation,
  type DeferredCompiledRequirement,
} from './CardEffectCompiler';

const LAST_PLAYED_LIMIT = 16;
const DRAW_HISTORY_LIMIT = 256;
const POSITIVE_TRACKER_LIMIT = 64;
const BADGE_LIMIT = 128;
const TELEMETRY_HINT_LIMIT = 256;
const TELEMETRY_WARNING_LIMIT = 128;
const DISCARD_LIMIT = 512;
const EXHAUST_LIMIT = 512;
const CHECKSUM_LIMIT = 512;
const TRUST_DEFAULT = 70;
const TRUST_MIN = 0;
const TRUST_MAX = 100;
const BATTLE_BUDGET_MIN = 0;
const COUNTER_INTEL_MIN = 0;
const COUNTER_INTEL_MAX = 10;
const HOLD_CHARGE_MIN = 0;
const SHARED_TREASURY_MIN = 0;
const HEAT_MIN = 0;
const DECK_ENTROPY_MIN = 0;
const DECK_ENTROPY_MAX = 1;
const MAX_TRACE_MARKERS = 128;
const DEFECTOR_HEAT_ON_FINALIZE = 35;
const DEFECTION_TREASURY_SHARE = 0.4;
const DEFECTION_CORD_PENALTY = 0.15;
const TRUST_ALERT_THRESHOLD = 35;
const LOYALTY_SIGNAL_SELF_BOOST = 10;
const LOYALTY_SIGNAL_TEAM_ECHO = 5;
const CASCADE_BREAK_COOP_TRUST_BONUS = 15;
const SHIELD_EMERGENCY_L4_FULL = 20;
const SHIELD_EMERGENCY_L4_DELAYED = 10;
const RESCUE_CAPITAL_FULL = 8000;
const LIQUIDITY_BRIDGE_REPAY_MULTIPLIER = 1.1;
const EXPANSION_LEASE_SOLO_INCOME = 1200;
const EXPANSION_LEASE_COMBO_INCOME = 2800;
const PHANTOM_GHOST_PASS_WINDOWS = 3;
const PHANTOM_LEVERAGE_REQUIRED_BADGE = 'DYNASTY';
const SYSTEMIC_OVERRIDE_BOT_HEAT = 0;
const PHANTOM_MINIMUM_CASH_THRESHOLD = 3000;
const PVP_SOVEREIGN_LEVERAGE_BONUS_BB = 50;
const PVP_SOVEREIGNTY_LOCK_PENALTY_BB = 30;

type NumericOperationKind = Extract<CompiledOperation['kind'], 'cash' | 'income' | 'shield' | 'heat' | 'trust' | 'time' | 'divergence'>;

type CostPool = 'FREE' | 'CASH' | 'TREASURY' | 'BATTLE_BUDGET';
type ExecutionSeverity = 'INFO' | 'WARN' | 'CRITICAL';
type ExecutionTracePhase =
  | 'PRECONDITION'
  | 'COST'
  | 'LIFECYCLE'
  | 'OPERATION'
  | 'DEFERRED'
  | 'NAMED_ACTION'
  | 'SPECIAL_RULE'
  | 'FINALIZE';

type NamedActionPayload = string | number | readonly string[] | null;

type TrustBandCode =
  | 'SOVEREIGN_TRUST'
  | 'HIGH_TRUST'
  | 'STANDARD_TRUST'
  | 'LOW_TRUST'
  | 'BROKEN_TRUST';

interface ExecutionTraceMarker {
  readonly id: string;
  readonly phase: ExecutionTracePhase;
  readonly severity: ExecutionSeverity;
  readonly code: string;
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

interface CostResolution {
  readonly pool: CostPool;
  readonly amount: number;
  readonly explanation: string;
}

interface TrustBandProfile {
  readonly code: TrustBandCode;
  readonly minimum: number;
  readonly maximum: number;
  readonly aidEfficiency: number;
  readonly comboMultiplier: number;
  readonly loanAccessRatio: number;
  readonly riskSignal: 'NONE' | 'WATCH' | 'ALERT';
}

interface ExecutionContext {
  readonly actorId: string;
  readonly plan: CardCompilationPlan;
  readonly cost: CostResolution;
  readonly trustBefore: number;
  readonly markers: readonly ExecutionTraceMarker[];
}

interface NamedActionContext {
  readonly actorId: string;
  readonly card: CardInstance;
  readonly plan: CardCompilationPlan;
  readonly payload: NamedActionPayload;
}

type NamedActionHandler = (
  snapshot: RunStateSnapshot,
  context: NamedActionContext,
) => RunStateSnapshot;

const TRUST_BANDS: readonly TrustBandProfile[] = Object.freeze([
  Object.freeze({
    code: 'SOVEREIGN_TRUST',
    minimum: 90,
    maximum: 100,
    aidEfficiency: 1,
    comboMultiplier: 1.25,
    loanAccessRatio: 0.2,
    riskSignal: 'NONE',
  }),
  Object.freeze({
    code: 'HIGH_TRUST',
    minimum: 70,
    maximum: 89,
    aidEfficiency: 0.95,
    comboMultiplier: 1.12,
    loanAccessRatio: 0.15,
    riskSignal: 'NONE',
  }),
  Object.freeze({
    code: 'STANDARD_TRUST',
    minimum: 50,
    maximum: 69,
    aidEfficiency: 0.88,
    comboMultiplier: 1,
    loanAccessRatio: 0.1,
    riskSignal: 'NONE',
  }),
  Object.freeze({
    code: 'LOW_TRUST',
    minimum: 30,
    maximum: 49,
    aidEfficiency: 0.75,
    comboMultiplier: 0.9,
    loanAccessRatio: 0.05,
    riskSignal: 'WATCH',
  }),
  Object.freeze({
    code: 'BROKEN_TRUST',
    minimum: 0,
    maximum: 29,
    aidEfficiency: 0.6,
    comboMultiplier: 0.75,
    loanAccessRatio: 0,
    riskSignal: 'ALERT',
  }),
]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function toMoney(value: number): number {
  return Math.round(value);
}

function uniqueStrings(entries: readonly string[], limit: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const entry of entries) {
    const normalized = String(entry).trim();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);

    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function appendBounded<T>(
  existing: readonly T[],
  additions: readonly T[],
  limit: number,
): T[] {
  const merged = [...existing, ...additions];
  return merged.slice(Math.max(0, merged.length - limit));
}

function prependBounded<T>(
  existing: readonly T[],
  additions: readonly T[],
  limit: number,
): T[] {
  const merged = [...additions, ...existing];
  return merged.slice(0, limit);
}

function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function createTraceId(parts: readonly (string | number | null | undefined)[]): string {
  return `exec_${hashString(
    parts
      .map((part) => (part === null || part === undefined ? '∅' : String(part)))
      .join('|'),
  )}`;
}

function buildHint(
  namespace: string,
  card: CardInstance,
  actorId: string,
  detail: string,
): string {
  return [
    namespace,
    card.instanceId,
    card.definitionId,
    actorId,
    detail,
  ].join(':');
}

function removeCardInstanceFromHand(
  hand: readonly CardInstance[],
  instanceId: string,
): CardInstance[] {
  return hand.filter((entry) => entry.instanceId !== instanceId);
}

function findTrustBand(score: number): TrustBandProfile {
  return (
    TRUST_BANDS.find(
      (band) => score >= band.minimum && score <= band.maximum,
    ) ?? TRUST_BANDS[TRUST_BANDS.length - 1]
  );
}

function getActorTrust(snapshot: RunStateSnapshot, actorId: string): number {
  return clamp(
    snapshot.modeState.trustScores[actorId] ?? TRUST_DEFAULT,
    TRUST_MIN,
    TRUST_MAX,
  );
}

function getOpposingTrustAverage(snapshot: RunStateSnapshot, actorId: string): number {
  const entries = Object.entries(snapshot.modeState.trustScores)
    .filter(([key]) => key !== actorId)
    .map(([, value]) => clamp(value, TRUST_MIN, TRUST_MAX));

  if (entries.length === 0) {
    return TRUST_DEFAULT;
  }

  const total = entries.reduce((sum, value) => sum + value, 0);
  return round4(total / entries.length);
}

function withEconomyPatch(
  economy: EconomyState,
  patch: Partial<EconomyState>,
): EconomyState {
  const cash = toMoney(patch.cash ?? economy.cash);
  const debt = toMoney(patch.debt ?? economy.debt);
  const incomePerTick = toMoney(
    Math.max(0, patch.incomePerTick ?? economy.incomePerTick),
  );
  const expensesPerTick = toMoney(
    Math.max(0, patch.expensesPerTick ?? economy.expensesPerTick),
  );
  const freedomTarget = toMoney(
    Math.max(0, patch.freedomTarget ?? economy.freedomTarget),
  );
  const haterHeat = Math.max(HEAT_MIN, patch.haterHeat ?? economy.haterHeat);
  const opportunitiesPurchased = Math.max(
    0,
    Math.round(
      patch.opportunitiesPurchased ?? economy.opportunitiesPurchased,
    ),
  );
  const privilegePlays = Math.max(
    0,
    Math.round(patch.privilegePlays ?? economy.privilegePlays),
  );

  return {
    ...economy,
    ...patch,
    cash,
    debt,
    incomePerTick,
    expensesPerTick,
    freedomTarget,
    haterHeat,
    opportunitiesPurchased,
    privilegePlays,
    netWorth: toMoney(cash - debt),
  };
}

function updateShieldLayer(
  layer: ShieldLayerState,
  delta: number,
  tick: number,
): ShieldLayerState {
  const nextCurrent = clamp(layer.current + delta, 0, layer.max);
  const damaged = nextCurrent < layer.current;
  const recovered = nextCurrent > layer.current;

  return {
    ...layer,
    current: nextCurrent,
    breached: nextCurrent <= 0,
    integrityRatio: layer.max <= 0 ? 0 : round4(nextCurrent / layer.max),
    lastDamagedTick: damaged ? tick : layer.lastDamagedTick,
    lastRecoveredTick: recovered ? tick : layer.lastRecoveredTick,
  };
}

function resolveWeakestLayer(
  layers: readonly ShieldLayerState[],
): ShieldLayerState {
  return layers.reduce((weakest, current) => {
    if (current.integrityRatio < weakest.integrityRatio) {
      return current;
    }

    if (current.integrityRatio === weakest.integrityRatio) {
      if (current.current < weakest.current) {
        return current;
      }

      if (current.current === weakest.current) {
        return current.layerId < weakest.layerId ? current : weakest;
      }
    }

    return weakest;
  }, layers[0]);
}

function withShieldDelta(
  shield: ShieldState,
  delta: number,
  tick: number,
): ShieldState {
  if (!Number.isFinite(delta) || delta === 0 || shield.layers.length === 0) {
    return shield;
  }

  const layers = shield.layers.map((layer) => updateShieldLayer(layer, delta, tick));
  const weakest = resolveWeakestLayer(layers);
  const previousBreaches = shield.layers.filter((layer) => layer.breached).length;
  const nextBreaches = layers.filter((layer) => layer.breached).length;

  return {
    ...shield,
    layers,
    weakestLayerId: weakest.layerId,
    weakestLayerRatio: weakest.integrityRatio,
    blockedThisRun: shield.blockedThisRun,
    damagedThisRun: shield.damagedThisRun + (delta < 0 ? Math.abs(delta) : 0),
    breachesThisRun:
      shield.breachesThisRun + Math.max(0, nextBreaches - previousBreaches),
    repairQueueDepth: shield.repairQueueDepth,
  };
}

function withSpecificShieldLayerDelta(
  shield: ShieldState,
  layerId: ShieldLayerState['layerId'],
  delta: number,
  tick: number,
): ShieldState {
  if (!Number.isFinite(delta) || delta === 0 || shield.layers.length === 0) {
    return shield;
  }

  const layers = shield.layers.map((layer) =>
    layer.layerId === layerId ? updateShieldLayer(layer, delta, tick) : layer,
  );
  const weakest = resolveWeakestLayer(layers);
  const previousBreaches = shield.layers.filter((layer) => layer.breached).length;
  const nextBreaches = layers.filter((layer) => layer.breached).length;

  return {
    ...shield,
    layers,
    weakestLayerId: weakest.layerId,
    weakestLayerRatio: weakest.integrityRatio,
    blockedThisRun: shield.blockedThisRun,
    damagedThisRun: shield.damagedThisRun + (delta < 0 ? Math.abs(delta) : 0),
    breachesThisRun:
      shield.breachesThisRun + Math.max(0, nextBreaches - previousBreaches),
    repairQueueDepth: shield.repairQueueDepth,
  };
}

function resetBotForSystemicOverride(bot: BotRuntimeState): BotRuntimeState {
  if (bot.neutralized) {
    return {
      ...bot,
      heat: SYSTEMIC_OVERRIDE_BOT_HEAT,
      state: 'NEUTRALIZED',
      lastAttackTick: bot.lastAttackTick,
    };
  }

  return {
    ...bot,
    heat: SYSTEMIC_OVERRIDE_BOT_HEAT,
    state: 'DORMANT',
    lastAttackTick: null,
  };
}

function withTelemetryMutation(
  snapshot: RunStateSnapshot,
  hints: readonly string[],
  warnings: readonly string[] = [],
  emittedEventDelta: number = 0,
): RunStateSnapshot {
  const nextHints = appendBounded(
    snapshot.telemetry.forkHints,
    uniqueStrings(hints, hints.length || 1),
    TELEMETRY_HINT_LIMIT,
  );
  const nextWarnings = appendBounded(
    snapshot.telemetry.warnings,
    uniqueStrings(warnings, warnings.length || 1),
    TELEMETRY_WARNING_LIMIT,
  );

  return {
    ...snapshot,
    telemetry: {
      ...snapshot.telemetry,
      forkHints: nextHints,
      warnings: nextWarnings,
      emittedEventCount: Math.max(
        0,
        snapshot.telemetry.emittedEventCount + emittedEventDelta,
      ),
    },
  };
}

function withTelemetryTrace(
  snapshot: RunStateSnapshot,
  markers: readonly ExecutionTraceMarker[],
): RunStateSnapshot {
  if (markers.length === 0) {
    return snapshot;
  }

  const hints = markers.map((marker) => {
    const detail = marker.detail
      ? JSON.stringify(marker.detail)
      : '∅';
    return [
      'card_exec',
      marker.phase,
      marker.severity,
      marker.code,
      detail,
    ].join('|');
  });

  const warnings = markers
    .filter((marker) => marker.severity !== 'INFO')
    .map((marker) => `${marker.code}:${marker.message}`);

  return withTelemetryMutation(snapshot, hints, warnings, markers.length);
}

function withTrustDelta(
  snapshot: RunStateSnapshot,
  actorId: string,
  delta: number,
): RunStateSnapshot {
  const nextTrust = clamp(getActorTrust(snapshot, actorId) + delta, TRUST_MIN, TRUST_MAX);

  return {
    ...snapshot,
    modeState: {
      ...snapshot.modeState,
      trustScores: {
        ...snapshot.modeState.trustScores,
        [actorId]: nextTrust,
      },
    },
  };
}

function withTrustEchoToTeam(
  snapshot: RunStateSnapshot,
  actorId: string,
  delta: number,
): RunStateSnapshot {
  const nextTrustScores: Record<string, number> = {
    ...snapshot.modeState.trustScores,
    [actorId]: clamp(getActorTrust(snapshot, actorId) + delta, TRUST_MIN, TRUST_MAX),
  };

  for (const teammateId of Object.keys(snapshot.modeState.trustScores)) {
    if (teammateId === actorId) {
      continue;
    }
    nextTrustScores[teammateId] = clamp(
      (snapshot.modeState.trustScores[teammateId] ?? TRUST_DEFAULT) + LOYALTY_SIGNAL_TEAM_ECHO,
      TRUST_MIN,
      TRUST_MAX,
    );
  }

  return {
    ...snapshot,
    modeState: {
      ...snapshot.modeState,
      trustScores: nextTrustScores,
    },
  };
}

function withSharedTreasury(
  snapshot: RunStateSnapshot,
  nextBalance: number,
): RunStateSnapshot {
  return {
    ...snapshot,
    modeState: {
      ...snapshot.modeState,
      sharedTreasuryBalance: Math.max(SHARED_TREASURY_MIN, toMoney(nextBalance)),
    },
  };
}

function withBattleBudget(
  snapshot: RunStateSnapshot,
  nextValue: number,
): RunStateSnapshot {
  return {
    ...snapshot,
    battle: {
      ...snapshot.battle,
      battleBudget: clamp(
        Math.round(nextValue),
        BATTLE_BUDGET_MIN,
        snapshot.battle.battleBudgetCap,
      ),
    },
  };
}

function withHoldCharges(
  snapshot: RunStateSnapshot,
  nextValue: number,
): RunStateSnapshot {
  return {
    ...snapshot,
    timers: {
      ...snapshot.timers,
      holdCharges: Math.max(HOLD_CHARGE_MIN, Math.round(nextValue)),
    },
  };
}

function withCounterIntelTier(
  snapshot: RunStateSnapshot,
  nextValue: number,
): RunStateSnapshot {
  return {
    ...snapshot,
    modeState: {
      ...snapshot.modeState,
      counterIntelTier: clamp(
        Math.round(nextValue),
        COUNTER_INTEL_MIN,
        COUNTER_INTEL_MAX,
      ),
    },
  };
}

function withProofBadges(
  snapshot: RunStateSnapshot,
  badges: readonly string[],
): RunStateSnapshot {
  const normalized = uniqueStrings(badges, BADGE_LIMIT);
  if (normalized.length === 0) {
    return snapshot;
  }

  return {
    ...snapshot,
    sovereignty: {
      ...snapshot.sovereignty,
      proofBadges: appendBounded(
        snapshot.sovereignty.proofBadges,
        normalized,
        BADGE_LIMIT,
      ),
    },
  };
}

function withExhaustCards(
  snapshot: RunStateSnapshot,
  cards: readonly string[],
): RunStateSnapshot {
  const normalized = uniqueStrings(cards, EXHAUST_LIMIT);
  if (normalized.length === 0) {
    return snapshot;
  }

  return {
    ...snapshot,
    cards: {
      ...snapshot.cards,
      exhaust: appendBounded(snapshot.cards.exhaust, normalized, EXHAUST_LIMIT),
    },
  };
}

function withPlayedCardLifecycle(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): RunStateSnapshot {
  const hint = buildHint('played', card, 'system', card.overlayAppliedForMode);

  return withTelemetryMutation(
    {
      ...snapshot,
      cards: {
        ...snapshot.cards,
        hand: removeCardInstanceFromHand(snapshot.cards.hand, card.instanceId),
        discard: appendBounded(snapshot.cards.discard, [card.definitionId], DISCARD_LIMIT),
        lastPlayed: appendBounded(
          snapshot.cards.lastPlayed,
          [card.definitionId],
          LAST_PLAYED_LIMIT,
        ),
        drawHistory: appendBounded(
          snapshot.cards.drawHistory,
          [card.definitionId],
          DRAW_HISTORY_LIMIT,
        ),
        deckEntropy: clamp(
          round4(snapshot.cards.deckEntropy + 0.001),
          DECK_ENTROPY_MIN,
          DECK_ENTROPY_MAX,
        ),
      },
    },
    [hint],
  );
}

function isDefectionCard(definitionId: string): boolean {
  return (
    definitionId === 'BREAK_PACT' ||
    definitionId === 'SILENT_EXIT' ||
    definitionId === 'ASSET_SEIZURE'
  );
}

function resolveDefectionStep(definitionId: string): 1 | 2 | 3 | null {
  if (definitionId === 'BREAK_PACT') {
    return 1;
  }

  if (definitionId === 'SILENT_EXIT') {
    return 2;
  }

  if (definitionId === 'ASSET_SEIZURE') {
    return 3;
  }

  return null;
}

function deckIsModeLegal(mode: ModeCode, deckType: DeckType): boolean {
  switch (mode) {
    case 'solo':
      return !['SABOTAGE', 'COUNTER', 'BLUFF', 'AID', 'RESCUE', 'TRUST', 'GHOST'].includes(deckType);
    case 'pvp':
      return !['AID', 'RESCUE', 'TRUST', 'GHOST'].includes(deckType);
    case 'coop':
      return !['SABOTAGE', 'COUNTER', 'BLUFF', 'GHOST'].includes(deckType);
    case 'ghost':
      return !['SABOTAGE', 'COUNTER', 'BLUFF', 'AID', 'RESCUE', 'TRUST'].includes(deckType);
    default:
      return true;
  }
}

function resolveCostPool(snapshot: RunStateSnapshot, card: CardInstance): CostResolution {
  if (card.cost <= 0) {
    return {
      pool: 'FREE',
      amount: 0,
      explanation: 'card cost resolves to zero',
    };
  }

  if (snapshot.mode === 'pvp') {
    if (card.card.deckType === 'SABOTAGE' || card.card.deckType === 'COUNTER') {
      return {
        pool: 'BATTLE_BUDGET',
        amount: card.cost,
        explanation: 'predator combat cards spend battle budget, not cash',
      };
    }

    if (card.card.deckType === 'BLUFF') {
      return {
        pool: 'CASH',
        amount: card.cost,
        explanation: 'bluff cards are cash-funded even when they appear as BB spend to the opponent',
      };
    }
  }

  if (snapshot.mode === 'coop' && snapshot.modeState.sharedTreasury) {
    return {
      pool: 'TREASURY',
      amount: card.cost,
      explanation: 'team-up mode routes card spend through the shared treasury',
    };
  }

  return {
    pool: 'CASH',
    amount: card.cost,
    explanation: 'default card spend routes through economy cash',
  };
}

function applyCost(
  snapshot: RunStateSnapshot,
  cost: CostResolution,
): RunStateSnapshot {
  if (cost.amount <= 0 || cost.pool === 'FREE') {
    return snapshot;
  }

  switch (cost.pool) {
    case 'CASH':
      return {
        ...snapshot,
        economy: withEconomyPatch(snapshot.economy, {
          cash: snapshot.economy.cash - cost.amount,
        }),
      };

    case 'TREASURY':
      return withSharedTreasury(
        snapshot,
        snapshot.modeState.sharedTreasuryBalance - cost.amount,
      );

    case 'BATTLE_BUDGET':
      return withBattleBudget(snapshot, snapshot.battle.battleBudget - cost.amount);

    case 'FREE':
      return snapshot;
  }
}

function resolveAvailableResource(snapshot: RunStateSnapshot, pool: CostPool): number {
  switch (pool) {
    case 'FREE':
      return Number.POSITIVE_INFINITY;
    case 'CASH':
      return snapshot.economy.cash;
    case 'TREASURY':
      return snapshot.modeState.sharedTreasuryBalance;
    case 'BATTLE_BUDGET':
      return snapshot.battle.battleBudget;
  }
}

function withOutcomeReasonHint(
  snapshot: RunStateSnapshot,
  card: CardInstance,
  detail: string,
): RunStateSnapshot {
  return withTelemetryMutation(
    snapshot,
    [buildHint('card_outcome', card, 'system', detail)],
  );
}

function createTraceMarker(
  phase: ExecutionTracePhase,
  severity: ExecutionSeverity,
  code: string,
  message: string,
  detail?: Readonly<Record<string, unknown>>,
): ExecutionTraceMarker {
  return {
    id: createTraceId([phase, severity, code, message, detail ? JSON.stringify(detail) : '∅']),
    phase,
    severity,
    code,
    message,
    detail,
  };
}

function boostOpportunityPurchaseCount(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): RunStateSnapshot {
  if (card.card.deckType !== 'OPPORTUNITY') {
    return snapshot;
  }

  return {
    ...snapshot,
    economy: withEconomyPatch(snapshot.economy, {
      opportunitiesPurchased: snapshot.economy.opportunitiesPurchased + 1,
    }),
  };
}

function boostPrivilegePlayCount(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): RunStateSnapshot {
  if (card.card.deckType !== 'PRIVILEGED') {
    return snapshot;
  }

  return {
    ...snapshot,
    economy: withEconomyPatch(snapshot.economy, {
      privilegePlays: snapshot.economy.privilegePlays + 1,
    }),
  };
}

function applyHeatTradeoffIfPrivileged(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): RunStateSnapshot {
  if (card.card.deckType !== 'PRIVILEGED') {
    return snapshot;
  }

  const weightByMode: Readonly<Record<ModeCode, number>> = Object.freeze({
    solo: 0.6,
    pvp: 1.5,
    coop: 0.8,
    ghost: 1,
  });

  const explicitHeat = card.card.baseEffect.heatDelta ?? 0;
  if (explicitHeat === 0) {
    return snapshot;
  }

  const weightedHeat = Math.round(explicitHeat * (weightByMode[snapshot.mode] ?? 1));
  if (weightedHeat === explicitHeat) {
    return snapshot;
  }

  return {
    ...snapshot,
    economy: withEconomyPatch(snapshot.economy, {
      haterHeat: snapshot.economy.haterHeat + (weightedHeat - explicitHeat),
    }),
  };
}

function applyLegendaryPvpBonus(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): RunStateSnapshot {
  if (
    snapshot.mode !== 'pvp' ||
    card.definitionId !== 'SOVEREIGN_LEVERAGE'
  ) {
    return snapshot;
  }

  return withBattleBudget(
    snapshot,
    snapshot.battle.battleBudget + PVP_SOVEREIGN_LEVERAGE_BONUS_BB,
  );
}

function applyCoopTrustEnhancement(
  snapshot: RunStateSnapshot,
  card: CardInstance,
  actorId: string,
): RunStateSnapshot {
  if (snapshot.mode !== 'coop') {
    return snapshot;
  }

  if (card.definitionId === 'CASCADE_BREAK') {
    return withTrustDelta(snapshot, actorId, CASCADE_BREAK_COOP_TRUST_BONUS);
  }

  return snapshot;
}

function applyGhostLegendaryBadges(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): RunStateSnapshot {
  if (snapshot.mode !== 'ghost') {
    return snapshot;
  }

  if (card.definitionId === 'PHANTOM_LEVERAGE') {
    return withProofBadges(snapshot, ['PHANTOM_LEVERAGE_CAST']);
  }

  if (card.definitionId === 'SOVEREIGN_LEVERAGE') {
    return withTelemetryMutation(
      snapshot,
      [buildHint('ghost_legendary', card, 'system', 'HIGH_DIVERGENCE')],
    );
  }

  return snapshot;
}

function applyOperation(
  snapshot: RunStateSnapshot,
  operation: CompiledOperation,
  actorId: string,
): RunStateSnapshot {
  switch (operation.kind) {
    case 'cash':
      return {
        ...snapshot,
        economy: withEconomyPatch(snapshot.economy, {
          cash: snapshot.economy.cash + operation.magnitude,
        }),
      };

    case 'income':
      return {
        ...snapshot,
        economy: withEconomyPatch(snapshot.economy, {
          incomePerTick: snapshot.economy.incomePerTick + operation.magnitude,
        }),
      };

    case 'shield':
      return {
        ...snapshot,
        shield: withShieldDelta(snapshot.shield, operation.magnitude, snapshot.tick),
      };

    case 'heat':
      return {
        ...snapshot,
        economy: withEconomyPatch(snapshot.economy, {
          haterHeat: snapshot.economy.haterHeat + operation.magnitude,
        }),
      };

    case 'trust':
      return withTrustDelta(snapshot, actorId, operation.magnitude);

    case 'time':
      return {
        ...snapshot,
        timers: {
          ...snapshot.timers,
          extensionBudgetMs: Math.max(
            0,
            snapshot.timers.extensionBudgetMs + operation.magnitude,
          ),
        },
      };

    case 'divergence':
      return {
        ...snapshot,
        sovereignty: {
          ...snapshot.sovereignty,
          gapVsLegend: round4(snapshot.sovereignty.gapVsLegend + operation.magnitude),
        },
      };

    case 'inject':
      return {
        ...snapshot,
        cards: {
          ...snapshot.cards,
          drawHistory: appendBounded(
            snapshot.cards.drawHistory,
            operation.magnitude,
            DRAW_HISTORY_LIMIT,
          ),
        },
      };

    case 'cascadeTag': {
      const alreadyTracked = snapshot.cascade.positiveTrackers.includes(operation.magnitude);

      return {
        ...snapshot,
        cascade: {
          ...snapshot.cascade,
          positiveTrackers: alreadyTracked
            ? [...snapshot.cascade.positiveTrackers]
            : appendBounded(
                snapshot.cascade.positiveTrackers,
                [operation.magnitude],
                POSITIVE_TRACKER_LIMIT,
              ),
          repeatedTriggerCounts: {
            ...snapshot.cascade.repeatedTriggerCounts,
            [operation.magnitude]:
              (snapshot.cascade.repeatedTriggerCounts[operation.magnitude] ?? 0) + 1,
          },
          lastResolvedTick: snapshot.tick,
        },
      };
    }
  }
}

function applyDeferredRequirement(
  snapshot: RunStateSnapshot,
  requirement: DeferredCompiledRequirement,
  actorId: string,
): RunStateSnapshot {
  switch (requirement.field) {
    case 'debtDelta': {
      const value = typeof requirement.payload === 'number' ? requirement.payload : 0;
      return {
        ...snapshot,
        economy: withEconomyPatch(snapshot.economy, {
          debt: snapshot.economy.debt + value,
        }),
      };
    }

    case 'expenseDelta': {
      const value = typeof requirement.payload === 'number' ? requirement.payload : 0;
      return {
        ...snapshot,
        economy: withEconomyPatch(snapshot.economy, {
          expensesPerTick: snapshot.economy.expensesPerTick + value,
        }),
      };
    }

    case 'treasuryDelta': {
      const value = typeof requirement.payload === 'number' ? requirement.payload : 0;
      return withSharedTreasury(
        snapshot,
        snapshot.modeState.sharedTreasuryBalance + value,
      );
    }

    case 'battleBudgetDelta': {
      const value = typeof requirement.payload === 'number' ? requirement.payload : 0;
      return withBattleBudget(snapshot, snapshot.battle.battleBudget + value);
    }

    case 'holdChargeDelta': {
      const value = typeof requirement.payload === 'number' ? requirement.payload : 0;
      return withHoldCharges(snapshot, snapshot.timers.holdCharges + value);
    }

    case 'counterIntelDelta': {
      const value = typeof requirement.payload === 'number' ? requirement.payload : 0;
      return withCounterIntelTier(
        snapshot,
        snapshot.modeState.counterIntelTier + value,
      );
    }

    case 'exhaustCards': {
      const value = Array.isArray(requirement.payload) ? requirement.payload : [];
      return withExhaustCards(snapshot, value);
    }

    case 'grantBadges': {
      const value = Array.isArray(requirement.payload) ? requirement.payload : [];
      return withProofBadges(snapshot, value);
    }

    case 'namedActionId': {
      const value = typeof requirement.payload === 'string' ? requirement.payload : null;
      if (!value) {
        return snapshot;
      }

      return withTelemetryMutation(snapshot, [
        ['named_action', actorId, value, requirement.definitionId, requirement.instanceId].join(':'),
      ]);
    }
  }
}

function applyDefectionProgression(
  snapshot: RunStateSnapshot,
  step: 1 | 2 | 3,
  actorId: string,
): RunStateSnapshot {
  let next: RunStateSnapshot = {
    ...snapshot,
    modeState: {
      ...snapshot.modeState,
      defectionStepByPlayer: {
        ...snapshot.modeState.defectionStepByPlayer,
        [actorId]: step,
      },
    },
  };

  if (step === 1) {
    next = withTrustDelta(next, actorId, -5);
    next = withTelemetryMutation(next, [
      `defection:hidden:${actorId}:BREAK_PACT:${snapshot.tick}`,
    ]);
    return next;
  }

  if (step === 2) {
    const divertedIncome = toMoney(next.economy.incomePerTick * 0.15);
    next = {
      ...next,
      economy: withEconomyPatch(next.economy, {
        cash: next.economy.cash + divertedIncome,
      }),
      modeState: {
        ...next.modeState,
        defectionStepByPlayer: {
          ...next.modeState.defectionStepByPlayer,
          [actorId]: step,
        },
      },
    };
    next = withTrustDelta(next, actorId, -5);
    next = withTelemetryMutation(next, [
      `defection:diversion:${actorId}:${divertedIncome}:${snapshot.tick}`,
    ]);
    return next;
  }

  const treasury = snapshot.modeState.sharedTreasuryBalance;
  const theft = Math.floor(treasury * DEFECTION_TREASURY_SHARE);
  const cooledBots = snapshot.battle.bots.map((bot) => ({
    ...bot,
    heat: Math.max(bot.heat, DEFECTOR_HEAT_ON_FINALIZE),
  }));

  next = {
    ...next,
    economy: withEconomyPatch(next.economy, {
      cash: next.economy.cash + theft,
    }),
    modeState: {
      ...next.modeState,
      sharedTreasuryBalance: Math.max(0, treasury - theft),
    },
    sovereignty: {
      ...next.sovereignty,
      sovereigntyScore: round4(
        Math.max(0, next.sovereignty.sovereigntyScore - DEFECTION_CORD_PENALTY),
      ),
    },
    battle: {
      ...next.battle,
      bots: cooledBots,
    },
  };

  next = withTelemetryMutation(next, [
    `defection:executed:${actorId}:${theft}:${snapshot.tick}`,
  ]);
  next = withProofBadges(next, ['DEFECTION_EXECUTED']);
  return next;
}

function applySystemicOverride(snapshot: RunStateSnapshot): RunStateSnapshot {
  return {
    ...snapshot,
    battle: {
      ...snapshot.battle,
      bots: snapshot.battle.bots.map(resetBotForSystemicOverride),
      pendingAttacks: [],
      rivalryHeatCarry: 0,
      extractionCooldownTicks: 0,
      firstBloodClaimed: false,
      neutralizedBotIds: [],
    },
    economy: withEconomyPatch(snapshot.economy, {
      haterHeat: 0,
    }),
  };
}

function applyCascadeBreak(snapshot: RunStateSnapshot): RunStateSnapshot {
  return {
    ...snapshot,
    cascade: {
      ...snapshot.cascade,
      brokenChains:
        snapshot.cascade.brokenChains + snapshot.cascade.activeChains.length,
      activeChains: [],
      positiveTrackers: [],
      repeatedTriggerCounts: {},
      lastResolvedTick: snapshot.tick,
    },
  };
}

function applyNetworkCall(snapshot: RunStateSnapshot, card: CardInstance): RunStateSnapshot {
  return withTelemetryMutation(snapshot, [
    buildHint('network_call', card, 'system', `draw2_choose1:${snapshot.mode}`),
  ]);
}

function applyLoyaltySignal(
  snapshot: RunStateSnapshot,
  actorId: string,
): RunStateSnapshot {
  return withTrustEchoToTeam(snapshot, actorId, LOYALTY_SIGNAL_SELF_BOOST);
}

function applyBetrayalDetection(
  snapshot: RunStateSnapshot,
  actorId: string,
): RunStateSnapshot {
  const warningThresholdCrossed = Object.entries(snapshot.modeState.trustScores).some(
    ([key, value]) => key !== actorId && value < TRUST_ALERT_THRESHOLD,
  );

  return withTelemetryMutation(
    snapshot,
    [
      `betrayal_detection:armed:${actorId}:${snapshot.tick}`,
      `betrayal_detection:threshold:${TRUST_ALERT_THRESHOLD}`,
    ],
    warningThresholdCrossed
      ? [`BETRAYAL_DETECTION threshold already violated below ${TRUST_ALERT_THRESHOLD}.`]
      : [],
  );
}

function applyVarianceLock(snapshot: RunStateSnapshot, card: CardInstance): RunStateSnapshot {
  return withTelemetryMutation(snapshot, [
    buildHint('variance_lock', card, 'system', `suspend_negative_injections_until:${snapshot.tick + 8}`),
  ]);
}

function applyPrecisionHold(snapshot: RunStateSnapshot, card: CardInstance): RunStateSnapshot {
  return withTelemetryMutation(snapshot, [
    buildHint('precision_hold', card, 'system', `freeze_window_for_ticks:4`),
  ]);
}

function applyPhantomLeverage(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): RunStateSnapshot {
  const hasDynasty = snapshot.sovereignty.proofBadges.includes(
    PHANTOM_LEVERAGE_REQUIRED_BADGE,
  );

  if (!hasDynasty) {
    return withTelemetryMutation(
      snapshot,
      [buildHint('phantom_leverage', card, 'system', 'badge_missing')],
      [`PHANTOM_LEVERAGE attempted without ${PHANTOM_LEVERAGE_REQUIRED_BADGE} badge.`],
    );
  }

  return withTelemetryMutation(snapshot, [
    buildHint('phantom_leverage', card, 'system', `ghost_pass_windows:${PHANTOM_GHOST_PASS_WINDOWS}`),
  ]);
}

function applyGhostPassExploit(snapshot: RunStateSnapshot, card: CardInstance): RunStateSnapshot {
  return withTelemetryMutation(snapshot, [
    buildHint('ghost_pass_exploit', card, 'system', 'superior_decision_audit_candidate'),
  ]);
}

function applyCounterLegendLine(snapshot: RunStateSnapshot, card: CardInstance): RunStateSnapshot {
  return withTelemetryMutation(snapshot, [
    buildHint('counter_legend_line', card, 'system', 'alternative_opportunity_subpool_request'),
  ]);
}

function applyMarkerExploit(snapshot: RunStateSnapshot, card: CardInstance): RunStateSnapshot {
  return withTelemetryMutation(snapshot, [
    buildHint('marker_exploit', card, 'system', 'silver_marker_window'),
  ]);
}

function applyEmergencyCapital(snapshot: RunStateSnapshot): RunStateSnapshot {
  return {
    ...snapshot,
    economy: withEconomyPatch(snapshot.economy, {
      cash: snapshot.economy.cash + RESCUE_CAPITAL_FULL,
    }),
  };
}

function applyShieldEmergency(snapshot: RunStateSnapshot): RunStateSnapshot {
  return {
    ...snapshot,
    shield: withSpecificShieldLayerDelta(snapshot.shield, 'L4', SHIELD_EMERGENCY_L4_FULL, snapshot.tick),
  };
}

function applyShieldLoan(snapshot: RunStateSnapshot, actorId: string): RunStateSnapshot {
  let next: RunStateSnapshot = {
    ...snapshot,
    shield: withSpecificShieldLayerDelta(snapshot.shield, 'L1', -15, snapshot.tick),
  };
  next = withTrustDelta(next, actorId, 8);
  return next;
}

function applyLiquidityBridge(snapshot: RunStateSnapshot, actorId: string): RunStateSnapshot {
  const trustBand = findTrustBand(getActorTrust(snapshot, actorId));
  const transferBase = 10000;
  const transfer = toMoney(transferBase * trustBand.aidEfficiency);
  const repayment = toMoney(transfer * LIQUIDITY_BRIDGE_REPAY_MULTIPLIER);

  return withTelemetryMutation(
    {
      ...snapshot,
      economy: withEconomyPatch(snapshot.economy, {
        cash: snapshot.economy.cash + transfer,
      }),
    },
    [
      `aid_contract:LIQUIDITY_BRIDGE:${actorId}:transfer=${transfer}`,
      `aid_contract:LIQUIDITY_BRIDGE:${actorId}:repay=${repayment}`,
      `aid_contract:LIQUIDITY_BRIDGE:${actorId}:trust_band=${trustBand.code}`,
    ],
  );
}

function applyExpansionLease(snapshot: RunStateSnapshot, actorId: string): RunStateSnapshot {
  const trustBand = findTrustBand(getActorTrust(snapshot, actorId));
  const comboHint = snapshot.cards.hand.some((entry) => entry.definitionId === 'LIQUIDITY_BRIDGE');
  const baseIncome = comboHint ? EXPANSION_LEASE_COMBO_INCOME : EXPANSION_LEASE_SOLO_INCOME;
  const amplified = toMoney(baseIncome * trustBand.comboMultiplier);

  return withTelemetryMutation(
    {
      ...snapshot,
      economy: withEconomyPatch(snapshot.economy, {
        incomePerTick: snapshot.economy.incomePerTick + amplified,
      }),
    },
    [
      `aid_combo:EXPANSION_LEASE:${actorId}:combo=${comboHint ? '1' : '0'}`,
      `aid_combo:EXPANSION_LEASE:${actorId}:income=${amplified}`,
      `aid_combo:EXPANSION_LEASE:${actorId}:trust_band=${trustBand.code}`,
    ],
  );
}

function applyIncomeInfusion(snapshot: RunStateSnapshot): RunStateSnapshot {
  return {
    ...snapshot,
    economy: withEconomyPatch(snapshot.economy, {
      cash: snapshot.economy.cash + snapshot.economy.incomePerTick * 2,
    }),
  };
}

function applyTimeDebtPaid(snapshot: RunStateSnapshot, card: CardInstance): RunStateSnapshot {
  const next = {
    ...snapshot,
    timers: {
      ...snapshot.timers,
      extensionBudgetMs: snapshot.timers.extensionBudgetMs + 90_000,
    },
  };

  if (snapshot.mode !== 'pvp') {
    return next;
  }

  return withTelemetryMutation(next, [
    buildHint('time_debt_paid', card, 'system', 'mirror_extension_required_for_opponent'),
  ]);
}

function applyGhostProofBadges(snapshot: RunStateSnapshot, card: CardInstance): RunStateSnapshot {
  const definitionId = card.definitionId;
  if (definitionId === 'FUBAR_CHAMPION') {
    return withProofBadges(snapshot, ['FUBAR_CHAMPION']);
  }
  if (definitionId === 'CLEAN_RUN') {
    return withProofBadges(snapshot, ['CLEAN_RUN']);
  }
  if (definitionId === 'MINIMALIST') {
    return withProofBadges(snapshot, ['MINIMALIST']);
  }
  if (definitionId === 'GHOST_SYNCED') {
    return withProofBadges(snapshot, ['GHOST_SYNCED']);
  }
  if (definitionId === 'COMEBACK_LEGEND') {
    return withProofBadges(snapshot, ['COMEBACK_LEGEND']);
  }
  return snapshot;
}

function applySpecialCardRules(
  snapshot: RunStateSnapshot,
  card: CardInstance,
  actorId: string,
): RunStateSnapshot {
  let next = snapshot;

  if (card.definitionId === 'SYSTEMIC_OVERRIDE') {
    next = applySystemicOverride(next);
  }

  if (card.definitionId === 'CASCADE_BREAK') {
    next = applyCascadeBreak(next);
  }

  if (card.definitionId === 'NETWORK_CALL') {
    next = applyNetworkCall(next, card);
  }

  if (card.definitionId === 'LOYALTY_SIGNAL') {
    next = applyLoyaltySignal(next, actorId);
  }

  if (card.definitionId === 'BETRAYAL_DETECTION') {
    next = applyBetrayalDetection(next, actorId);
  }

  if (card.definitionId === 'VARIANCE_LOCK') {
    next = applyVarianceLock(next, card);
  }

  if (card.definitionId === 'PRECISION_HOLD') {
    next = applyPrecisionHold(next, card);
  }

  if (card.definitionId === 'PHANTOM_LEVERAGE') {
    next = applyPhantomLeverage(next, card);
  }

  if (card.definitionId === 'GHOST_PASS_EXPLOIT') {
    next = applyGhostPassExploit(next, card);
  }

  if (card.definitionId === 'COUNTER_LEGEND_LINE') {
    next = applyCounterLegendLine(next, card);
  }

  if (card.definitionId === 'MARKER_EXPLOIT') {
    next = applyMarkerExploit(next, card);
  }

  if (card.definitionId === 'EMERGENCY_CAPITAL') {
    next = applyEmergencyCapital(next);
  }

  if (card.definitionId === 'SHIELD_EMERGENCY') {
    next = applyShieldEmergency(next);
  }

  if (card.definitionId === 'SHIELD_LOAN') {
    next = applyShieldLoan(next, actorId);
  }

  if (card.definitionId === 'LIQUIDITY_BRIDGE') {
    next = applyLiquidityBridge(next, actorId);
  }

  if (card.definitionId === 'EXPANSION_LEASE') {
    next = applyExpansionLease(next, actorId);
  }

  if (card.definitionId === 'INCOME_INFUSION') {
    next = applyIncomeInfusion(next);
  }

  if (card.definitionId === 'TIME_DEBT_PAID') {
    next = applyTimeDebtPaid(next, card);
  }

  next = applyGhostProofBadges(next, card);

  const defectionStep = resolveDefectionStep(card.definitionId);
  if (defectionStep !== null) {
    next = applyDefectionProgression(next, defectionStep, actorId);
  }

  return next;
}

function buildNamedActionRegistry(): Readonly<Record<string, NamedActionHandler>> {
  return Object.freeze({
    VARIANCE_LOCK: (snapshot, context) => applyVarianceLock(snapshot, context.card),
    PRECISION_HOLD: (snapshot, context) => applyPrecisionHold(snapshot, context.card),
    PHANTOM_LEVERAGE: (snapshot, context) => applyPhantomLeverage(snapshot, context.card),
    GHOST_PASS_EXPLOIT: (snapshot, context) => applyGhostPassExploit(snapshot, context.card),
    COUNTER_LEGEND_LINE: (snapshot, context) => applyCounterLegendLine(snapshot, context.card),
    MARKER_EXPLOIT: (snapshot, context) => applyMarkerExploit(snapshot, context.card),
    NETWORK_CALL: (snapshot, context) => applyNetworkCall(snapshot, context.card),
    LOYALTY_SIGNAL: (snapshot, context) => applyLoyaltySignal(snapshot, context.actorId),
    BETRAYAL_DETECTION: (snapshot, context) => applyBetrayalDetection(snapshot, context.actorId),
    LIQUIDITY_BRIDGE: (snapshot, context) => applyLiquidityBridge(snapshot, context.actorId),
    SHIELD_LOAN: (snapshot, context) => applyShieldLoan(snapshot, context.actorId),
    EXPANSION_LEASE: (snapshot, context) => applyExpansionLease(snapshot, context.actorId),
    EMERGENCY_CAPITAL: (snapshot) => applyEmergencyCapital(snapshot),
    SHIELD_EMERGENCY: (snapshot) => applyShieldEmergency(snapshot),
    INCOME_INFUSION: (snapshot) => applyIncomeInfusion(snapshot),
    TIME_DEBT_PAID: (snapshot, context) => applyTimeDebtPaid(snapshot, context.card),
  });
}

function finalizeSnapshot(
  snapshot: RunStateSnapshot,
  card: CardInstance,
  actorId: string,
  plan: CardCompilationPlan,
): RunStateSnapshot {
  let next = snapshot;

  next = boostOpportunityPurchaseCount(next, card);
  next = boostPrivilegePlayCount(next, card);
  next = applyHeatTradeoffIfPrivileged(next, card);
  next = applyLegendaryPvpBonus(next, card);
  next = applyCoopTrustEnhancement(next, card, actorId);
  next = applyGhostLegendaryBadges(next, card);

  const currentTrust = getActorTrust(next, actorId);
  const trustBand = findTrustBand(currentTrust);
  const opposingTrustAverage = getOpposingTrustAverage(next, actorId);

  const finalHints = [
    `card_finalize:${card.definitionId}:mode=${next.mode}`,
    `card_finalize:${card.definitionId}:strategy=${plan.strategicClass}`,
    `card_finalize:${card.definitionId}:priority=${plan.priorityBand}`,
    `card_finalize:${card.definitionId}:witness=${plan.witnessHint}`,
    `card_finalize:${card.definitionId}:trust_band=${trustBand.code}`,
    `card_finalize:${card.definitionId}:opp_trust_avg=${opposingTrustAverage}`,
    `card_finalize:${card.definitionId}:timing=${plan.canonicalTimingClass.join('+') || 'NONE'}`,
    `card_finalize:${card.definitionId}:targeting=${plan.targeting}`,
    `card_finalize:${card.definitionId}:deferred=${plan.deferredRequirements.length}`,
    `card_finalize:${card.definitionId}:ops=${plan.supportedOperations.length}`,
    `card_finalize:${card.definitionId}:determinism=${plan.overlayDeterminismKey}`,
  ];

  const warnings: string[] = [];
  if (trustBand.riskSignal === 'ALERT') {
    warnings.push(
      `Trust for actor ${actorId} is in BROKEN range after ${card.definitionId}; defection alert conditions may exist.`,
    );
  } else if (trustBand.riskSignal === 'WATCH') {
    warnings.push(
      `Trust for actor ${actorId} is in LOW range after ${card.definitionId}; cooperative efficiency is reduced.`,
    );
  }

  if (
    next.mode === 'ghost' &&
    next.economy.cash < PHANTOM_MINIMUM_CASH_THRESHOLD
  ) {
    warnings.push(
      `Ghost run cash dropped below ${PHANTOM_MINIMUM_CASH_THRESHOLD} after ${card.definitionId}; comeback legend pressure is now relevant.`,
    );
  }

  next = withTelemetryMutation(next, finalHints, warnings);

  return next;
}

export class CardEffectExecutor {
  private readonly compiler = new CardEffectCompiler();

  private readonly namedActionRegistry = buildNamedActionRegistry();

  public apply(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    actorId: string,
  ): RunStateSnapshot {
    this.compiler.assertDeterministic(card);

    const plan = this.compiler.compileDetailed(card);
    const cost = resolveCostPool(snapshot, card);
    const preMarkers = this.assertExecutionPreconditions(
      snapshot,
      card,
      actorId,
      plan,
      cost,
    );

    let next = snapshot;

    next = withTelemetryTrace(next, preMarkers);
    next = withPlayedCardLifecycle(next, card);
    next = applyCost(next, cost);
    next = withOutcomeReasonHint(next, card, `cost_pool=${cost.pool}`);

    next = this.applyCompiledOperations(next, plan.supportedOperations, actorId);
    next = this.applyDeferredRequirements(next, plan.deferredRequirements, actorId, card, plan);
    next = this.applyNamedActions(next, plan.deferredRequirements, actorId, card, plan);
    next = applySpecialCardRules(next, card, actorId);
    next = finalizeSnapshot(next, card, actorId, plan);

    return next;
  }

  private assertExecutionPreconditions(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    actorId: string,
    plan: CardCompilationPlan,
    cost: CostResolution,
  ): ExecutionTraceMarker[] {
    const markers: ExecutionTraceMarker[] = [];

    if (card.overlayAppliedForMode !== snapshot.mode) {
      throw new Error(
        `Card ${card.definitionId} was resolved for ${card.overlayAppliedForMode} but attempted in ${snapshot.mode}.`,
      );
    }

    markers.push(
      createTraceMarker(
        'PRECONDITION',
        'INFO',
        'MODE_OVERLAY_ALIGNED',
        `overlay mode ${card.overlayAppliedForMode} matches snapshot mode ${snapshot.mode}`,
        {
          definitionId: card.definitionId,
          mode: snapshot.mode,
        },
      ),
    );

    if (!card.card.modeLegal.includes(snapshot.mode)) {
      throw new Error(
        `Card ${card.definitionId} is not legal for mode ${snapshot.mode}.`,
      );
    }

    markers.push(
      createTraceMarker(
        'PRECONDITION',
        'INFO',
        'MODE_LEGALITY_CONFIRMED',
        `card is legal in ${snapshot.mode}`,
        {
          definitionId: card.definitionId,
          mode: snapshot.mode,
          legalModes: [...card.card.modeLegal],
        },
      ),
    );

    if (!deckIsModeLegal(snapshot.mode, card.card.deckType)) {
      throw new Error(
        `Deck type ${card.card.deckType} is not legal in mode ${snapshot.mode}.`,
      );
    }

    markers.push(
      createTraceMarker(
        'PRECONDITION',
        'INFO',
        'DECK_MODE_MATRIX_CONFIRMED',
        `deck ${card.card.deckType} is mode-legal in ${snapshot.mode}`,
        {
          deckType: card.card.deckType,
          mode: snapshot.mode,
        },
      ),
    );

    const handContainsCard = snapshot.cards.hand.some(
      (entry) => entry.instanceId === card.instanceId,
    );
    if (!handContainsCard) {
      throw new Error(
        `Card instance ${card.instanceId} (${card.definitionId}) is not present in hand.`,
      );
    }

    markers.push(
      createTraceMarker(
        'PRECONDITION',
        'INFO',
        'HAND_MEMBERSHIP_CONFIRMED',
        `card instance is present in hand and eligible for lifecycle transition`,
        {
          instanceId: card.instanceId,
          definitionId: card.definitionId,
        },
      ),
    );

    const available = resolveAvailableResource(snapshot, cost.pool);
    if (available < cost.amount) {
      throw new Error(
        `Insufficient ${cost.pool.toLowerCase()} to execute ${card.definitionId}. Required ${cost.amount}, current ${available}.`,
      );
    }

    markers.push(
      createTraceMarker(
        'COST',
        'INFO',
        'AFFORDABILITY_CONFIRMED',
        `${cost.pool} covers the requested spend`,
        {
          pool: cost.pool,
          amount: cost.amount,
          available,
          explanation: cost.explanation,
        },
      ),
    );

    if (isDefectionCard(card.definitionId)) {
      if (snapshot.mode !== 'coop') {
        throw new Error(
          `Defection card ${card.definitionId} cannot execute outside coop mode.`,
        );
      }

      const expectedStep = resolveDefectionStep(card.definitionId);
      const currentStep = snapshot.modeState.defectionStepByPlayer[actorId] ?? 0;

      if (expectedStep === null || expectedStep !== currentStep + 1) {
        throw new Error(
          `Defection card ${card.definitionId} is out of sequence for actor ${actorId}. Current step ${currentStep}.`,
        );
      }

      markers.push(
        createTraceMarker(
          'PRECONDITION',
          'WARN',
          'DEFECTION_SEQUENCE_ADVANCING',
          `defection sequence step ${expectedStep} is valid for actor ${actorId}`,
          {
            actorId,
            expectedStep,
            currentStep,
          },
        ),
      );
    }

    if (
      snapshot.mode === 'ghost' &&
      card.card.deckType === 'GHOST' &&
      !card.timingClass.includes('GBM')
    ) {
      markers.push(
        createTraceMarker(
          'PRECONDITION',
          'WARN',
          'GHOST_CARD_WITHOUT_GBM',
          'ghost deck card executed without GBM timing lock; backend is preserving it but audit should inspect this draw',
          {
            definitionId: card.definitionId,
            timingClass: [...card.timingClass],
          },
        ),
      );
    }

    if (
      snapshot.mode === 'pvp' &&
      (card.card.deckType === 'SABOTAGE' || card.card.deckType === 'COUNTER') &&
      cost.pool !== 'BATTLE_BUDGET'
    ) {
      throw new Error(
        `Predator combat card ${card.definitionId} must resolve through battle budget.`,
      );
    }

    markers.push(
      createTraceMarker(
        'PRECONDITION',
        'INFO',
        'COMPILATION_PLAN_ACCEPTED',
        `compiler plan accepted with ${plan.supportedOperations.length} executable ops and ${plan.deferredRequirements.length} deferred requirements`,
        {
          strategy: plan.strategicClass,
          priority: plan.priorityBand,
          witness: plan.witnessHint,
          determinism: plan.overlayDeterminismKey,
        },
      ),
    );

    return markers.slice(0, MAX_TRACE_MARKERS);
  }

  private applyCompiledOperations(
    snapshot: RunStateSnapshot,
    operations: readonly CompiledOperation[],
    actorId: string,
  ): RunStateSnapshot {
    let next = snapshot;

    for (const operation of operations) {
      next = applyOperation(next, operation, actorId);
      next = withTelemetryMutation(next, [
        [
          'compiled_op',
          operation.operationId,
          operation.kind,
          String(operation.executionOrder),
          operation.sourceField,
          operation.strategicClass,
        ].join(':'),
      ]);
    }

    return next;
  }

  private applyDeferredRequirements(
    snapshot: RunStateSnapshot,
    requirements: readonly DeferredCompiledRequirement[],
    actorId: string,
    card: CardInstance,
    plan: CardCompilationPlan,
  ): RunStateSnapshot {
    let next = snapshot;

    for (const requirement of requirements) {
      next = applyDeferredRequirement(next, requirement, actorId);

      const payloadSummary = Array.isArray(requirement.payload)
        ? requirement.payload.join(',')
        : requirement.payload === null
          ? 'null'
          : String(requirement.payload);

      next = withTelemetryMutation(next, [
        [
          'deferred_req',
          requirement.requirementId,
          requirement.field,
          payloadSummary,
          requirement.strategicClass,
          requirement.witnessHint,
        ].join(':'),
      ]);
    }

    if (requirements.length === 0) {
      return next;
    }

    return withTelemetryMutation(next, [
      buildHint('deferred_complete', card, actorId, plan.strategicClass),
    ]);
  }

  private applyNamedActions(
    snapshot: RunStateSnapshot,
    requirements: readonly DeferredCompiledRequirement[],
    actorId: string,
    card: CardInstance,
    plan: CardCompilationPlan,
  ): RunStateSnapshot {
    let next = snapshot;

    for (const requirement of requirements) {
      if (requirement.field !== 'namedActionId') {
        continue;
      }

      const payload = typeof requirement.payload === 'string'
        ? requirement.payload
        : null;
      if (!payload) {
        continue;
      }

      const handler = this.namedActionRegistry[payload];
      if (!handler) {
        next = withTelemetryMutation(
          next,
          [buildHint('named_action_missing', card, actorId, payload)],
          [`Named action ${payload} has no registered backend handler.`],
        );
        continue;
      }

      next = handler(next, {
        actorId,
        card,
        plan,
        payload,
      });

      next = withTelemetryMutation(next, [
        buildHint('named_action_applied', card, actorId, payload),
      ]);
    }

    return next;
  }
}
