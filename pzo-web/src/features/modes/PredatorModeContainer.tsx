import React, { memo, useCallback, useMemo } from 'react';
import PredatorGameScreen from '../../components/PredatorGameScreen';
import type { PendingCounterplay } from '../../components/PredatorGameScreen';
import type { CounterplayAction } from '../../components/CounterplayModal';
import { BattleActionType, InjectionType, type InjectedCard } from '../../engines/battle/types';
import type { ZeroFacade } from '../../engines/zero/ZeroFacade';
import { useEngineStore } from '../../store/engineStore';

const INJECTION_META: Record<string, { label: string; description: string; emoji: string }> = {
  [InjectionType.FORCED_SALE]: {
    label: 'FORCED SALE',
    description: 'Liquidator pressure is forcing a bad exit window.',
    emoji: '💥',
  },
  [InjectionType.REGULATORY_HOLD]: {
    label: 'REGULATORY HOLD',
    description: 'Bureaucratic drag is trying to lock your move set.',
    emoji: '📋',
  },
  [InjectionType.INVERSION_CURSE]: {
    label: 'INVERSION CURSE',
    description: 'Manipulator pressure is distorting the board state.',
    emoji: '🌀',
  },
  [InjectionType.EXPENSE_SPIKE]: {
    label: 'EXPENSE SPIKE',
    description: 'Cashflow is under direct extraction pressure.',
    emoji: '📉',
  },
  [InjectionType.DILUTION_NOTICE]: {
    label: 'DILUTION NOTICE',
    description: 'Your upside is being cut before it compounds.',
    emoji: '🧬',
  },
  [InjectionType.HATER_HEAT_SURGE]: {
    label: 'HEAT SURGE',
    description: 'The room is accelerating toward hostile action.',
    emoji: '🔥',
  },
};

export interface PredatorModeContainerProps {
  facade?: ZeroFacade | null;
  chatEngine?: unknown;
  onForfeit?: () => void;
  onCounterplay?: (id: string) => void;
  onBeginExtraction?: () => void;
  onAbortExtraction?: () => void;
  onLockExtraction?: () => void;
  onCounterWindowCounter?: () => void;
  onCounterWindowAbsorb?: () => void;
}

function sortInjectedCards(cards: InjectedCard[]): InjectedCard[] {
  return [...cards].sort((a, b) => {
    if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
    if (a.isMitigated !== b.isMitigated) return a.isMitigated ? 1 : -1;
    return (a.ticksRemaining ?? 999) - (b.ticksRemaining ?? 999);
  });
}

function buildCounterplayActions(card: InjectedCard, handleCounter: (id: string) => void): CounterplayAction[] {
  return [
    {
      id: `${card.injectionId}:counter-sabotage`,
      label: 'COUNTER SABOTAGE',
      description: 'Spend battle budget to deflect the injected pressure back into the attack lane.',
      cost: 0,
      successChance: 0.78,
      emoji: '🛡️',
      available: true,
      battleAction: BattleActionType.COUNTER_SABOTAGE,
    },
    {
      id: `${card.injectionId}:threat-delay`,
      label: 'THREAT DELAY',
      description: 'Buy time by pushing the hostile window out one more decision cycle.',
      cost: 0,
      successChance: 0.64,
      emoji: '⏳',
      available: true,
      battleAction: BattleActionType.THREAT_DELAY,
    },
    {
      id: `${card.injectionId}:income-reinforce`,
      label: 'INCOME REINFORCE',
      description: 'Stabilize the economic base instead of reflecting the strike directly.',
      cost: 0,
      successChance: 0.58,
      emoji: '📈',
      available: true,
      battleAction: BattleActionType.INCOME_REINFORCE,
    },
  ].map((action) => ({
    ...action,
    available: true,
    description: action.description,
    label: action.label,
    id: action.id,
    battleAction: action.battleAction,
    cost: action.cost,
    emoji: action.emoji,
    successChance: action.successChance,
    onChoose: undefined,
  })) as CounterplayAction[];
}

export const PredatorModeContainer = memo(function PredatorModeContainer({
  facade,
  onForfeit,
  onCounterplay,
  onBeginExtraction,
  onAbortExtraction,
  onLockExtraction,
  onCounterWindowCounter,
  onCounterWindowAbsorb,
}: PredatorModeContainerProps) {
  const injectedCards = useEngineStore((state) => state.battle.injectedCards);
  const lastAttackFired = useEngineStore((state) => state.battle.lastAttackFired);
  const activeDecisionWindows = useEngineStore((state) => state.time.activeDecisionWindows);

  const handleForfeit = useCallback(() => {
    if (onForfeit) {
      onForfeit();
      return;
    }

    if (facade) {
      void facade.endRun('ABANDONED');
    }
  }, [facade, onForfeit]);

  const pendingCounterplay = useMemo<PendingCounterplay | null>(() => {
    const activeCard = sortInjectedCards(injectedCards).find((card) => !card.isExpired && !card.isMitigated);
    if (!activeCard) return null;

    const meta = INJECTION_META[activeCard.injectionType] ?? {
      label: activeCard.cardName,
      description: 'An active sabotage line is live against your economy.',
      emoji: '⚠️',
    };

    const ticksToRespond = Math.max(
      1,
      Math.min(
        activeCard.ticksRemaining ?? 1,
        activeDecisionWindows[0]?.remainingMs
          ? Math.ceil(activeDecisionWindows[0].remainingMs / 1000)
          : activeCard.ticksRemaining ?? 1,
      ),
    );

    return {
      eventLabel: meta.label,
      eventDescription:
        lastAttackFired?.attackEvent?.attackType
          ? `${meta.description} Attack vector: ${lastAttackFired.attackEvent.attackType}.`
          : meta.description,
      eventEmoji: meta.emoji,
      ticksToRespond,
      actions: buildCounterplayActions(activeCard, (actionId) => onCounterplay?.(actionId)),
      onChoose: (actionId) => {
        onCounterplay?.(actionId);
        onCounterWindowCounter?.();
      },
      onIgnore: () => {
        onCounterWindowAbsorb?.();
      },
    };
  }, [activeDecisionWindows, injectedCards, lastAttackFired?.attackEvent?.attackType, onCounterWindowAbsorb, onCounterWindowCounter, onCounterplay]);

  return (
    <PredatorGameScreen
      pendingCounterplay={pendingCounterplay}
      onForfeit={handleForfeit}
      onCounterplay={(id) => onCounterplay?.(id)}
      onBeginExtraction={() => onBeginExtraction?.()}
      onAbortExtraction={() => onAbortExtraction?.()}
      onLockExtraction={() => onLockExtraction?.()}
      onCounterWindowCounter={() => onCounterWindowCounter?.()}
      onCounterWindowAbsorb={() => onCounterWindowAbsorb?.()}
    />
  );
});

export default PredatorModeContainer;
