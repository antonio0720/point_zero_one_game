import React from 'react';
import { useM43PracticeSandboxRewindWhatIf } from './m043-practice-sandbox-rewind-what-if.hooks';
import { M43PracticeSandboxRewindWhatIfProps } from './m043-practice-sandbox-rewind-what-if.types';

const M43PracticeSandboxRewindWhatIf: React.FC<M43PracticeSandboxRewindWhatIfProps> = ({
  mlEnabled,
  auditHash,
}) => {
  const { rewind, whatIf } = useM43PracticeSandboxRewindWhatIf();

  return (
    <div className="virality-surface">
      <h2>Practice Sandbox (Rewind + What-If)</h2>
      <button onClick={rewind}>Rewind</button>
      <button onClick={whatIf}>What-If</button>
      {mlEnabled && (
        <p>
          Audit Hash: <code>{auditHash}</code>
        </p>
      )}
    </div>
  );
};

export default M43PracticeSandboxRewindWhatIf;
