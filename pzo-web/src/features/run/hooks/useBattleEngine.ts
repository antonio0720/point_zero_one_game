// pzo-web/src/features/run/hooks/useBattleEngine.ts

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  useEngineStore,
  type EngineStoreState,
} from '../../../store/engineStore';
import {
  AttackType,
  BATTLE_CONSTANTS,
  BotId,
  BotState,
  type BattleBudgetState,
  type BattleSnapshot,
  type BotAttackFiredEvent,
  type BotStateChangedEvent,
  type HaterBotRuntimeState,
  type InjectedCard,
} from '../../../engines/battle/types';
import type { ShieldLayerId } from '../../../engines/shield/types';

export interface BattleHeatState {
  readonly isTotalSuppression: boolean;
  readonly isExtractionActive: boolean;
  readonly isTargeted: boolean;
  readonly isSurveillance: boolean;
  readonly isClearField: boolean;
}

export interface NormalizedBattleAttack
  extends BotAttackFiredEvent {
  readonly attackType: AttackType;
  readonly secondaryAttackType: AttackType | null;
  readonly targetLayer: ShieldLayerId | null;
  readonly rawPower: number;
  readonly isCritical: boolean;
}

export interface UseBattleEngineReturn {
  readonly snapshot: BattleSnapshot | null;
  readonly budget: BattleBudgetState | null;

  readonly haterHeat: number;
  readonly haterHeatPct: number;

  readonly injectedCards: readonly InjectedCard[];
  readonly hasActiveInjections: boolean;
  readonly injectedCardCount: number;

  readonly activeBots: readonly HaterBotRuntimeState[];
  readonly allBots: readonly HaterBotRuntimeState[];

  readonly attackingBots: readonly HaterBotRuntimeState[];
  readonly targetingBots: readonly HaterBotRuntimeState[];
  readonly watchingBots: readonly HaterBotRuntimeState[];
  readonly retreatingBots: readonly HaterBotRuntimeState[];
  readonly neutralizedBots: readonly HaterBotRuntimeState[];
  readonly dormantBots: readonly HaterBotRuntimeState[];

  readonly activeBotsCount: number;
  readonly allBotsCount: number;

  readonly budgetPtsRemaining: number;
  readonly budgetPtsTotal: number;
  readonly budgetPtsSpent: number;
  readonly budgetRemainingPct: number;
  readonly budgetSpentPct: number;
  readonly isBudgetDry: boolean;

  readonly heatState: BattleHeatState;
  readonly isTotalSuppression: boolean;
  readonly isExtractionActive: boolean;
  readonly isTargeted: boolean;
  readonly isSurveillance: boolean;
  readonly isClearField: boolean;

  readonly hasAttackingBots: boolean;
  readonly hasTargetingBots: boolean;
  readonly hasWatchingBots: boolean;

  readonly dominantThreatBot: HaterBotRuntimeState | null;

  readonly lastStateChange: BotStateChangedEvent | null;
  readonly lastAttackFired: NormalizedBattleAttack | null;

  readonly isRunActive: boolean;
  readonly tickNumber: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function safeInt(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function normalizeLastAttack(
  event: BotAttackFiredEvent | null,
  allBots: readonly HaterBotRuntimeState[],
): NormalizedBattleAttack | null {
  if (!event) return null;

  const sourceBot =
    allBots.find((bot) => bot.profileId === event.botId) ?? null;

  return {
    ...event,
    attackType: event.attackEvent.attackType,
    secondaryAttackType: event.attackEvent.secondaryAttackType ?? null,
    targetLayer: sourceBot?.profile.targetLayerId ?? null,
    rawPower: event.attackEvent.rawPower,
    isCritical: event.attackEvent.isCritical,
  };
}

function buildHeatState(haterHeat: number): BattleHeatState {
  const heat = Math.max(0, haterHeat);

  const isTotalSuppression = heat >= BATTLE_CONSTANTS.HATER_HEAT_ATTACKING_MIN + 20;
  const isExtractionActive =
    heat >= BATTLE_CONSTANTS.HATER_HEAT_ATTACKING_MIN && !isTotalSuppression;
  const isTargeted =
    heat >= BATTLE_CONSTANTS.HATER_HEAT_TARGETING_MIN &&
    heat < BATTLE_CONSTANTS.HATER_HEAT_ATTACKING_MIN;
  const isSurveillance =
    heat >= BATTLE_CONSTANTS.HATER_HEAT_WATCHING_MIN &&
    heat < BATTLE_CONSTANTS.HATER_HEAT_TARGETING_MIN;
  const isClearField = heat < BATTLE_CONSTANTS.HATER_HEAT_WATCHING_MIN;

  return {
    isTotalSuppression,
    isExtractionActive,
    isTargeted,
    isSurveillance,
    isClearField,
  };
}

export function useBattleEngine(): UseBattleEngineReturn {
  const battle = useEngineStore(
    useShallow((state: EngineStoreState) => ({
      snapshot: state.battle.snapshot,
      budget: state.battle.budget,
      haterHeat: state.battle.haterHeat,
      injectedCards: state.battle.injectedCards,
      activeBots: state.battle.activeBots,
      activeBotsCount: state.battle.activeBotsCount,
      lastStateChange: state.battle.lastStateChange,
      lastAttackFired: state.battle.lastAttackFired,
      isRunActive: state.battle.isRunActive,
      tickNumber: state.battle.tickNumber,
    })),
  );

  return useMemo<UseBattleEngineReturn>(() => {
    const snapshot = battle.snapshot ?? null;
    const budget = battle.budget ?? null;
    const haterHeat = clamp01(battle.haterHeat ?? 0);

    const injectedCards = [...(battle.injectedCards ?? [])];
    const activeBots = [...(battle.activeBots ?? [])];
    const allBots = snapshot
      ? (Object.values(snapshot.bots) as HaterBotRuntimeState[])
      : [];

    const attackingBots = allBots.filter((bot) => bot.state === BotState.ATTACKING);
    const targetingBots = allBots.filter((bot) => bot.state === BotState.TARGETING);
    const watchingBots = allBots.filter((bot) => bot.state === BotState.WATCHING);
    const retreatingBots = allBots.filter((bot) => bot.state === BotState.RETREATING);
    const neutralizedBots = allBots.filter((bot) => bot.state === BotState.NEUTRALIZED);
    const dormantBots = allBots.filter((bot) => bot.state === BotState.DORMANT);

    const activeBotsCount =
      safeInt(snapshot?.activeBotsCount ?? battle.activeBotsCount, activeBots.length) ||
      activeBots.length;

    const budgetPtsTotal = safeInt(budget?.totalPts ?? 0, 0);
    const budgetPtsRemaining = safeInt(budget?.remainingPts ?? 0, 0);
    const budgetPtsSpent = safeInt(budget?.spentPts ?? 0, 0);

    const budgetRemainingPct =
      budgetPtsTotal > 0 ? clamp01(budgetPtsRemaining / budgetPtsTotal) : 0;
    const budgetSpentPct =
      budgetPtsTotal > 0 ? clamp01(budgetPtsSpent / budgetPtsTotal) : 0;

    const heatState = buildHeatState(haterHeat * 100);
    const lastAttackFired = normalizeLastAttack(
      battle.lastAttackFired ?? null,
      allBots,
    );

    const dominantThreatBot =
      attackingBots[0] ??
      targetingBots[0] ??
      watchingBots[0] ??
      activeBots[0] ??
      null;

    return {
      snapshot,
      budget,

      haterHeat,
      haterHeatPct: haterHeat * 100,

      injectedCards,
      hasActiveInjections: injectedCards.length > 0,
      injectedCardCount: injectedCards.length,

      activeBots,
      allBots,

      attackingBots,
      targetingBots,
      watchingBots,
      retreatingBots,
      neutralizedBots,
      dormantBots,

      activeBotsCount,
      allBotsCount: allBots.length,

      budgetPtsRemaining,
      budgetPtsTotal,
      budgetPtsSpent,
      budgetRemainingPct,
      budgetSpentPct,
      isBudgetDry: budgetPtsTotal > 0 && budgetPtsRemaining <= 0,

      heatState,
      isTotalSuppression: heatState.isTotalSuppression,
      isExtractionActive: heatState.isExtractionActive,
      isTargeted: heatState.isTargeted,
      isSurveillance: heatState.isSurveillance,
      isClearField: heatState.isClearField,

      hasAttackingBots: attackingBots.length > 0,
      hasTargetingBots: targetingBots.length > 0,
      hasWatchingBots: watchingBots.length > 0,

      dominantThreatBot,

      lastStateChange: battle.lastStateChange ?? null,
      lastAttackFired,

      isRunActive: Boolean(battle.isRunActive),
      tickNumber: safeInt(snapshot?.tickNumber ?? battle.tickNumber, 0),
    };
  }, [battle]);
}

export function useHaterHeat(): number {
  return useEngineStore((state) => state.battle.haterHeat ?? 0);
}

export function useBattleBudget(): BattleBudgetState | null {
  return useEngineStore((state) => state.battle.budget ?? null);
}

export function useInjectedCards(): InjectedCard[] {
  return useEngineStore((state) => state.battle.injectedCards ?? []);
}

export function useActiveThreatBots(): HaterBotRuntimeState[] {
  return useEngineStore((state) => state.battle.activeBots ?? []);
}

export default useBattleEngine;