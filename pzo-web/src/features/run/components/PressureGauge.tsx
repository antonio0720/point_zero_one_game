import { usePressureEngine } from '../hooks/usePressureEngine';

const TIER_COLORS = {
  CALM:     '#C9A84C',
  BUILDING: '#C9A84C',
  ELEVATED: '#B97D27',
  HIGH:     '#B92B27',
  CRITICAL: '#FF0000',
};

interface Props { orientation?: 'vertical' | 'horizontal'; }

export function PressureGauge({ orientation = 'vertical' }: Props) {
  const { score, tier, isEscalating, isDecaying, ticksToCalm } = usePressureEngine();
  const color = TIER_COLORS[tier] ?? '#CCCCCC';
  const pct   = Math.min(100, Maths.round(score * 100));

  const barStyle = orientation === 'vertical'
    ? { height: `${pct}%`, width: '100%' }
    : { width: `${pct}%`, height: '100%' };

  return (
    <div className={`pressure-gauge pressure-gauge--${orientation} tier-${tier.toLowerCase()}`}>
      <div className="pressure-gauge__track">
        <div
          className={`pressure-gauge__fill ${tier === 'CRITICAL' ? 'pulse-critical' : ''}`}
          style={{ ...barStyle, background: color, transition: 'all 1s linear' }}
        />
      </div>
      <div className="pressure-gauge__label">
        <span className="pressure-tier">{tier}</span>
        {isEscalating && <span className="pressure-arrow escalating">▲</span>}
        {isDecaying   && <span className="pressure-arrow decaying">▼</span>}
      </div>
      {tier !== 'CALM' && (
        <div className="pressure-recovery">{ticksToCalm}t to calm</div>
      )}
    </div>
  );
}
