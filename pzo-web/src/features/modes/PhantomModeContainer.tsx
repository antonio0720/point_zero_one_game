// pzo-web/src/features/modes/PhantomModeContainer.tsx
import React   from 'react';
import PhantomGameScreen from '../../components/PhantomGameScreen';
import { RUN_TICKS }     from '../../game/core/constants';
import type { RunState } from '../../game/types/runState';
import { buildReplayEvents } from '../../game/core/replayBuilder';
import { useMemo }           from 'react';

interface Props {
  runState: RunState;
  modeState: unknown;
  seed: number;
}

export function PhantomModeContainer({ runState, modeState, seed }: Props) {
  const { cash, income, expenses, netWorth, shields, tick,
          freezeTicks, regime, intelligence, equityHistory, events, telemetry } = runState;
  const replayEvents = useMemo(() => buildReplayEvents(telemetry), [telemetry]);

  return (
    <PhantomGameScreen
      cash={cash} income={income} expenses={expenses} netWorth={netWorth}
      shields={shields}
      tick={tick} totalTicks={RUN_TICKS} freezeTicks={freezeTicks}
      regime={regime} intelligence={intelligence as any} equityHistory={equityHistory}
      events={events.slice(-30)} replayEvents={replayEvents}
      modeState={modeState} seed={seed}
    />
  );
}
