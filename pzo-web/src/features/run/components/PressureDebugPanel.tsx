import React from 'react';
import { usePressureEngine, PressureDebugPanelProps } from '@/features/run/hooks/usePressureEngine';
import { usePressureSignalBreakdown } from '@/features/run/hooks/usePressureSignalBreakdown';
import { snapshotJSON } from '@/store/snapshotJSON'; // Assuming this hook is provided to access the store's history.

interface PressureDebugPanelProps extends PressureDebugPanelProps {}

const PressureDebugPanel: React.FC<PressureDebugPanelProps> = () => {
  const pressureEngine = usePressureEngine();
  const signalBreakdown = usePressureSignalBreakdown();
  const snapshotJSON = snapshotJSON(); // Assuming this hook is provided to access the store' end history.

  return (
    <div>
      <h2>Pressure Debug Panel</h2>
      {/* Tier, score and ticksToCalm are assumed available from pressureEngine */}
      <p><strong>Tier: </strong>{pressureEngine.tier}</p>
      <p><strong>Score: </strong>{pressureEngine.score}</p>
      <p><strong>Ticks to Calm: </strong>{pressureEngine.ticksToCalm}</p>
      
      {/* Renders signal rows from usePressureSignalBreakdown sorted array */}
      <table>
        <thead>
          <tr>
            <th>Dominant Signal</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {signalBreakdown.map((signal, index) => (
            <tr key={index}>
              <td>{pressureEngine.dominantSignal}</td>
              <td>{signal.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Renders snapshot JSON from store */}
      <pre>{JSON.stringify(snapshotJSON(), null, 2)}</pre>
    </div>
  );
};

export default PressureDebugPanel;
