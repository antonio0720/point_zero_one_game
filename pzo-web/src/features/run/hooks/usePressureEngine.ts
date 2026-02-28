import { useEngineStore } from '../../../store/engineStore';

export function usePressureEngine() {
  const score          = useEngineStore(s => s.pressure.score);
  const tier           = useEngineStore(s => s.pressure.currentTier);
  const prevTier       = useEngineStore(s => s.pressure.previousTier);
  const history        = useEngineStore(s => s.pressure.scoreHistory);
  const isEscalating   = useEngineStore(s => s.pressure.isEscalating);
  const isDecaying     = useEngineStore(s => s.pressure.isDecaying);
  const dominantSignal = useEngineStore(s => s.pressure.dominantSignal);
  const breakdown      = useEngineStore(s => s.pressure.signalBreakdown);
  const ticksToCalm    = useEngineStore(s => s.pressure.ticksToCalm);

  return {
    score,
    scorePct: score * 100,
    tier,
    previousTier: prevTier,
    history,
    isEscalating,
    isDecaying,
    dominantSignal,
    breakdown,
    ticksToCalm,
    isCritical: tier === 'CRITICAL',
    isHigh: tier === 'HIGH' || tier === 'CRITICAL',
  };
}
