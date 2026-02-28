import React, { useState } from 'react';
import PressureGauge from './PressureGauge/PressureGauge'; // Adjust the import path as necessary.
import withTooltip from './withTooltip';

interface RunHUDProps {}

const RunHUD: React.FC<RunHUDProps> = () => {
  const [pressure, setPressure] = useState(0); // Assuming initial pressure is zero for simplicity.

  return (
    <div className="run-hud">
      <PressureGauge value={pressure} onChange={setPressure} />
      {/* Ensuring PressureSignalTooltip appears only when gauge has focus */}
      <withTooltip asChild>
        <PressureGauge ref={(g) => g && setFocusOnGauge(g)} value={pressure} onChange={setPressure} />
      </withTooltip>
    </div>
  );
};

export default RunHUD;
