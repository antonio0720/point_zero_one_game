import React from 'react';
import { useM70CoopBootcampTeamOnboardingRun } from './m070_coop_bootcamp_team_onboarding_run';

interface M70CoopBootcampTeamOnboardingRunProps {
  mlEnabled: boolean;
}

const M70CoopBootcampTeamOnboardingRun = ({
  mlEnabled,
}: M70CoopBootcampTeamOnboardingRunProps) => {
  const { viralitySurface } = useM70CoopBootcampTeamOnboardingRun(mlEnabled);

  return (
    <div className="virality-surface">
      <h2>Virality Surface</h2>
      <p>
        This is the virality surface for M70 Co-op Bootcamp (Team Onboarding Run).
      </p>
      {mlEnabled && (
        <div>
          <h3>ML Model Output:</h3>
          <p>
            {viralitySurface.auditHash} ({viralitySurface.output.toFixed(2)})
          </p>
        </div>
      )}
    </div>
  );
};

export default M70CoopBootcampTeamOnboardingRun;
