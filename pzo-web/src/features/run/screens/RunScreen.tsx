// pzo-web/src/features/run/screens/RunScreen.tsx
import React, { memo } from 'react';
import { useDecisionWindow } from '../hooks/useDecisionWindow';
import CountdownRing from './CountdownRing';
import HUD from './HUD';

const RunScreen = memo(() => {
  const { countdown } = useDecisionWindow();
  
  return (
    <div className="run-screen">
      <CountdownRing value={countdown} />
      <HUD />
    </div>
  );
});

export default RunScreen;
