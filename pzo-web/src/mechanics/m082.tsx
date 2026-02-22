import React from 'react';
import { useM82TimingChainsTickWindowSynergyCombos } from './useM82TimingChainsTickWindowSynergyCombos';

interface M82TimingChainsTickWindowSynergyCombosProps {
  mlEnabled?: boolean;
}

const M82TimingChainsTickWindowSynergyCombos: React.FC<M82TimingChainsTickWindowSynergyCombosProps> = ({
  mlEnabled,
}) => {
  const { auditHash, synergyCombos } = useM82TimingChainsTickWindowSynergyCombos(mlEnabled);

  return (
    <div className="pzo-m82-timing-chains-tick-window-synergy-combos">
      <h2>Timing Chains (Tick-Window Synergy Combos)</h2>
      {synergyCombos.map((combo, index) => (
        <div key={index} className="pzo-m82-timing-chains-tick-window-synergy-combo">
          <span>{combo.name}</span>
          <span>Combo Multiplier: {combo.comboMultiplier.toFixed(2)}</span>
          <span>Tick Window Multiplier: {combo.tickWindowMultiplier.toFixed(2)}</span>
        </div>
      ))}
      <p>Audit Hash: {auditHash}</p>
    </div>
  );
};

export default M82TimingChainsTickWindowSynergyCombos;
