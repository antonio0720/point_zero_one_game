// pzo-web/src/features/modes/EmpireModeContainer.tsx
import React from 'react';
import EmpireGameScreen from '../../components/EmpireGameScreen';
import { RUN_TICKS }   from '../../game/core/constants';
import type { RunState } from '../../game/types/runState';

interface Props {
  runState: RunState;
  onPlayCard: (id: string) => void;
  onMitigate: (id: string) => void;
  modeState: unknown;
}

export function EmpireModeContainer({ runState, onPlayCard, onMitigate, modeState }: Props) {
  const { cash, income, expenses, netWorth, shields, shieldConsuming, tick,
          freezeTicks, regime, intelligence, equityHistory, hand, events } = runState;
  return (
    <EmpireGameScreen
      cash={cash} income={income} expenses={expenses} netWorth={netWorth}
      shields={shields} shieldConsuming={shieldConsuming}
      tick={tick} totalTicks={RUN_TICKS} freezeTicks={freezeTicks}
      regime={regime} intelligence={intelligence as any} equityHistory={equityHistory}
      hand={hand as any} onPlayCard={onPlayCard}
      threats={[]} onMitigate={onMitigate}
      events={events.slice(-30)} modeState={modeState}
    />
  );
}
