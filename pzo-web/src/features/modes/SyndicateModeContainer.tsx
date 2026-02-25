// pzo-web/src/features/modes/SyndicateModeContainer.tsx
import React    from 'react';
import SyndicateGameScreen from '../../components/SyndicateGameScreen';
import { RUN_TICKS }       from '../../game/core/constants';
import type { RunState }   from '../../game/types/runState';

interface Props {
  runState: RunState;
  modeState: unknown;
  onAidSubmit: (contract: { recipientId: string; aidType: string; amount: number }) => void;
  onRescueContribute: () => void;
  onRescueDismiss: () => void;
}

export function SyndicateModeContainer({ runState, modeState, onAidSubmit, onRescueContribute, onRescueDismiss }: Props) {
  const { cash, income, expenses, netWorth, shields, shieldConsuming, tick,
          freezeTicks, regime, intelligence, equityHistory, events, rescueWindow } = runState;
  return (
    <SyndicateGameScreen
      cash={cash} income={income} expenses={expenses} netWorth={netWorth}
      shields={shields} shieldConsuming={shieldConsuming}
      tick={tick} totalTicks={RUN_TICKS} freezeTicks={freezeTicks}
      regime={regime} intelligence={intelligence as any} equityHistory={equityHistory}
      events={events.slice(-30)} modeState={modeState}
      rescueWindow={rescueWindow as any}
      allianceMembers={[]}
      onAidSubmit={onAidSubmit as any}
      onRescueContribute={onRescueContribute}
      onRescueDismiss={onRescueDismiss}
    />
  );
}
