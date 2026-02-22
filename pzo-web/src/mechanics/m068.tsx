import React from 'react';
import { useM68FailureRehab } from './useM68FailureRehab';

interface Props {
  mlEnabled?: boolean;
}

const M68FailureRehab = ({ mlEnabled }: Props) => {
  const { 
    auditHash, 
    boundedOutput, 
    killSwitch, 
    output, 
    setKillSwitch, 
    setMLModelOutput 
  } = useM68FailureRehab(mlEnabled);

  return (
    <div className="virality-surface">
      <h2>Failure Rehab (2-Minute Targeted Recovery Run)</h2>
      {output !== null && (
        <p>
          Your current recovery run is: {output} minutes
        </p>
      )}
      <button onClick={() => setKillSwitch(true)}>Disable</button>
    </div>
  );
};

export default M68FailureRehab;
