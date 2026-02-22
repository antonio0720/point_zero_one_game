import React from 'react';
import { useM111PortfolioRulesMacrosIfThenAutopilotHardCapped } from './useM111PortfolioRulesMacrosIfThenAutopilotHardCapped';

interface M111PortfolioRulesMacrosIfThenAutopilotHardCappedProps {
  mlEnabled: boolean;
}

const M111PortfolioRulesMacrosIfThenAutopilotHardCapped = ({
  mlEnabled,
}: M111PortfolioRulesMacrosIfThenAutopilotHardCappedProps) => {
  const { output, auditHash } = useM111PortfolioRulesMacrosIfThenAutopilotHardCapped(mlEnabled);

  return (
    <div className="virality-surface">
      <h2>Portfolio Rules Macros (If/Then Autopilot, Hard-Capped)</h2>
      <p>
        This section displays the portfolio rules macros for the M111 strategy.
      </p>
      {output && (
        <div>
          <h3>Output:</h3>
          <pre>{JSON.stringify(output, null, 2)}</pre>
        </div>
      )}
      {!mlEnabled && (
        <div>
          <h3>Audit Hash:</h3>
          <p>{auditHash}</p>
        </div>
      )}
    </div>
  );
};

export default M111PortfolioRulesMacrosIfThenAutopilotHardCapped;
