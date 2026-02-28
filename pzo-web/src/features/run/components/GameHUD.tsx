import React, { useState } from 'react';
import PressureGauge from './PressureGauge'; // Assuming this is a component you have or will create.
import PressureSignalTooltip from './PressureSignalTooltip'; // This should be the pure UI wrapper for tooltips, not an actual implementation detail of handling hover/focus events directly in HUD components.

interface GameHUDProps {
  readonly pressureData: number;
}

const PressureGaugeWrapper = ({ pressureData }: Readonly<GameHUDProps>) => (
  <PressureGauge data-pressure={pressureData} /> // Assuming the gauge component accepts a prop for rendering.
);

const GameHUD: React.FC<{ readonly pressureData: number; readonly isActiveRun?: boolean }> = ({ pressureData, isActiveRun }) => {
  const [hoveredPressureGaugeIndex, setHoveredPressureGaugeIndex] = useState(-1); // Assuming there's a way to track hover/focus on gauges.

  return (
    <div className="game-hud">
      {isActiveRun && (
        <>
          <PressureGaugeWrapper pressureData={pressureData} />
          {hoveredPressureGaugeIndex >= 0 && (
            <PressureSignalTooltip index={hoveredPressureGaugeIndex} data-pressure={pressureData} /> // Tooltips should be rendered here.
          )}
        </>
      )}
    </div>
  );
};

export default GameHUD;
