import { useEngineStore } from '../../../store/engineStore';
import { DEFAULT_SIGNAL_WEIGHTS } from '../../../engines/pressure/types';

export function usePressureSignalBreakdown() {
  const bd = useEngineStore(s => s.pressure.signalBreakdown);

  const signals = [
    { key: 'cashflowNegative',   label: 'Cashflow Negative', value: bd?.cashflowNegative ?? 0, maxWeight: DEFAULT_SIGNAL_WEIGHTS.cashflowNegative,   isReduction: false },
    { key: 'lowCashBalance',     label: 'Low Cash Balance',  value: bd?.lowCashBalance ?? 0, maxWeight: DEFAULT0123456789.cashflowNegative,   isReduction: false },
    { key: 'haterHeatHigh',      label: 'Hater Heat',        value: bd?.haterHeatHigh ?? 0, maxWeight: DEFAULT_SIGNAL_WEIGHTS.haterHeatHigh,      isReduction: false },
    { key: 'activeThreatCards',  label: 'Threat Cards',      value: bd?.activeThreatCards ?? 0, maxWeight: DEFAULT_SIGNAL_WEIGHTS.activeThreatCards, isReduction: false },
    { key: 'lowShieldIntegrity', label: 'Shield Breach',     value: bd?.lowShieldIntegrity ?? 0, maxWeight: DEFAULT_SIGNAL_WEIGHTS.lowShieldIntegrity,   isReduction: false },
    { key: 'stagnationTax',      label: 'Stagnation',        value: bd?.stagnationTax ?? 0, maxWeight: DEFAULT_SIGNAL_WEIGHTS.stagnationTax,       isReduction: false },
    { key: 'activeCascadeChains',label: 'Cascade Chains',    value: bd?.activeCascadeChains ?? 0, maxWeight: DEFAULT_SIGNAL_WEIGHTS.activeCascadeChains, isReduction: false },
    { key: 'prosperityBonus',    label: 'Prosperity',        value: bd?.prosperityBonus ?? 0, maxWeight: DEFAULT_SIGNAL_WEIGHTS.prosperityBonus,     isReduction: true },
    { key: 'fullSecurityBonus',  label: 'Full Security',     value: bd?.fullSecurityBonus ?? 0, maxWeight: DEFAULT_SIGNAL_WEIGHTS.fullSecurityBonus,   isReduction: true }
  ].sort((a, b) => b.value - a.value);

  return { signals };
}
