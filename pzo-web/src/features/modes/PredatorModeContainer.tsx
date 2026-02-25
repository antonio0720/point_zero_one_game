// pzo-web/src/features/modes/PredatorModeContainer.tsx
import React from 'react';
import PredatorGameScreen from '../../components/PredatorGameScreen';
import { RUN_TICKS }      from '../../game/core/constants';
import type { RunState }  from '../../game/types/runState';
import type { BattlePhase } from '../../game/types/battlePhase';

interface Props {
  runState: RunState;
  modeState: unknown;
  onForfeit: () => void;
  onCounterplay: () => void;
}

export function PredatorModeContainer({ runState, modeState, onForfeit, onCounterplay }: Props) {
  const { cash, income, expenses, netWorth, shields, shieldConsuming, tick,
          freezeTicks, regime, intelligence, equityHistory, events,
          battleState, activeSabotages } = runState;

  // Normalize battlePhase to canonical type — COMPLETE is valid
  const battlePhase = battleState.phase as BattlePhase;

  return (
    <PredatorGameScreen
      cash={cash} income={income} expenses={expenses} netWorth={netWorth}
      shields={shields} shieldConsuming={shieldConsuming}
      tick={tick} totalTicks={RUN_TICKS} freezeTicks={freezeTicks}
      regime={regime} intelligence={intelligence as any} equityHistory={equityHistory}
      events={events.slice(-30)} modeState={modeState}
      battlePhase={battlePhase} battleParticipants={[]}
      battleScore={battleState.score} battleRound={battleState.round}
      activeSabotages={activeSabotages as any}
      pendingCounterplay={null}
      onForfeit={onForfeit}
      onCounterplay={onCounterplay}
    />
  );
}
