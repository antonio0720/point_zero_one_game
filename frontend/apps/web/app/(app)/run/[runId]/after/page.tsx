/**
 * AfterPage component for displaying the Cause-of-Death or Barely Lived screen,
 * along with a single insight and a Run Again CTA. The UI is stage-aware.
 */

import React from 'react';
import { useAppSelector } from '../../hooks';
import { GameStage, RunResult } from '../../types';
import Insight from '../Insight';
import Button from '../Button';

type Props = {
  runId: string;
};

const AfterPage: React.FC<Props> = ({ runId }) => {
  const gameState = useAppSelector(state => state.game[runId]);
  const { stage, result } = gameState || {};

  if (!stage || !result) return null; // Ensure we have valid data before rendering

  const insight = getInsightByStageAndResult(stage, result);

  return (
    <div>
      <h1>{getTitleByStageAndResult(stage, result)}</h1>
      {insight && <Insight insight={insight} />}
      <Button to="/runs" label="Run Again" />
    </div>
  );
};

const getTitleByStageAndResult = (stage: GameStage, result: RunResult) => {
  switch (result) {
    case RunResult.CauseOfDeath:
      return `You've met your end at stage ${stage}`;
    case RunResult.BarelyLived:
      return `You barely survived stage ${stage}`;
    default:
      throw new Error(`Unknown result: ${result}`);
  }
};

const getInsightByStageAndResult = (stage: GameStage, result: RunResult) => {
  switch (stage) {
    case GameStage.One:
      if (result === RunResult.CauseOfDeath) return 'You spent too much';
      if (result === RunResult.BarelyLived) return 'You were lucky this time';
      break;
    // Add more stages as needed...
    default:
      throw new Error(`Unknown stage: ${stage}`);
  }
};

export default AfterPage;
