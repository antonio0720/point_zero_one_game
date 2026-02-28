import { usePressureSignalBreakdown } from '../hooks/usePressureSignalBreakdown';

export function PressureSignalTooltip() {
  const { signals, maxWeight } = usePressureSignalBreakdown();

  return (
    <div className="pressure-tooltip">
      <div className="pressure-tooltip__title">PRESSURE SIGNALS</div>
      {signals.map(sig => (
        <div key={sig.key} className={`pressure-signal ${sig.isReduction ? 'signal-reduction' : 'signal-increase'}`}>
          <span className="signal-label">{sig.label}</span>
          <div className="signal-bar-track">
            <div
              className="signal-bar-fill"
              style={{
                width: `${(Math.round(sig.value / maxWeight) * 100)}%`,
                backgroundColor: sig.isReduction ? '#4EC9B0' : '#B92B27',
              }}
            />
          </div>
          <span className="signal-value">{sig.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
