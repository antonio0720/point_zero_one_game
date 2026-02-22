import React from 'react';
import { useGame } from '../hooks/useGame';
import { Timer } from './Timer';
import { EquityChart } from './EquityChart';
import { Hand } from './Hand';
import { PlayZone } from './PlayZone';
import { Hud } from './Hud';

export const Run = () => {
  const game = useGame();

  return (
    <div className="run-screen">
      <Timer />
      <EquityChart equity={game.equity} />
      <Hand hand={game.hand} />
      <PlayZone playZone={game.playZone} />
      <Hud hud={game.hud} />
    </div>
  );
};

export default Run;
