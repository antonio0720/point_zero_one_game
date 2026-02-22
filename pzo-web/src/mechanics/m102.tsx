import React from 'react';
import { M102State } from './M102State';
import { M102Action } from './M102Action';
import { mlEnabled } from '../ml/mlEnabled';

interface Props {
  state: M102State;
}

const M102 = ({ state }: Props) => {
  const [decision, setDecision] = React.useState(state.decision);
  const [branch1, setBranch1] = React.useState(state.branch1);
  const [branch2, setBranch2] = React.useState(state.branch2);

  const handleDecisionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDecision(event.target.checked);
  };

  const handleBranch1Change = (event: React.ChangeEvent<HTMLInputElement>) => {
    setBranch1(event.target.checked);
  };

  const handleBranch2Change = (event: React.ChangeEvent<HTMLInputElement>) => {
    setBranch2(event.target.checked);
  };

  const handleFinalize = () => {
    if (!mlEnabled) {
      return;
    }

    const auditHash = crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex');
    const output1 = decision ? 1 : 0;
    const output2 = branch1 ? 1 : 0;

    // Ensure outputs are bounded between 0 and 1
    const boundedOutput1 = Math.min(Math.max(output1, 0), 1);
    const boundedOutput2 = Math.min(Math.max(output2, 0), 1);

    console.log(`Audit Hash: ${auditHash}`);
    console.log(`Output 1: ${boundedOutput1}`);
    console.log(`Output 2: ${boundedOutput2}`);

    // Preserve determinism by using a hash of the state as a seed for the random number generator
    const seed = crypto.createHash('sha256').update(auditHash).digest('hex');
    const random1 = Math.floor(Math.random() * 100) / 100;
    const random2 = Math.floor(Math.random() * 100) / 100;

    // Use the bounded outputs and random numbers to determine the final outcome
    const finalOutcome1 = boundedOutput1 + (random1 * (1 - boundedOutput1));
    const finalOutcome2 = boundedOutput2 + (random2 * (1 - boundedOutput2));

    console.log(`Final Outcome 1: ${finalOutcome1}`);
    console.log(`Final Outcome 2: ${finalOutcome2}`);

    // Update the state with the final outcome
    state.decision = decision;
    state.branch1 = branch1;
    state.branch2 = branch2;

    return { ...state, decision, branch1, branch2 };
  };

  return (
    <div>
      <h1>Forked Timeline Choice (One Decision, Two Branches, One Final)</h1>
      <p>Make your decision:</p>
      <input
        type="checkbox"
        checked={decision}
        onChange={handleDecisionChange}
      />
      <label>Take the risk</label>

      {decision && (
        <>
          <p>Choose a branch:</p>
          <input
            type="checkbox"
            checked={branch1}
            onChange={handleBranch1Change}
          />
          <label>Branch 1: High Reward, High Risk</label>

          <input
            type="checkbox"
            checked={branch2}
            onChange={handleBranch2Change}
          />
          <label>Branch 2: Low Reward, Low Risk</label>
        </>
      )}

      {decision && branch1 && (
        <p>
          You have chosen Branch 1. The outcome is:
          {finalOutcome1.toFixed(2)}
        </p>
      )}

      {decision && branch2 && (
        <p>
          You have chosen Branch 2. The outcome is:
          {finalOutcome2.toFixed(2)}
        </p>
      )}

      <button onClick={handleFinalize}>Finalize</button>
    </div>
  );
};

export default M102;
