import React from 'react';
import { useM101MutatorDraftRunRulesYouChoose } from './useM101MutatorDraftRunRulesYouChoose';
import { M101MutatorDraftRunRulesYouChooseProps } from './types';

const M101MutatorDraftRunRulesYouChoose = ({
  mlEnabled,
  auditHash,
}: M101MutatorDraftRunRulesYouChooseProps) => {
  const { runRules, mutate } = useM101MutatorDraftRunRulesYouChoose({
    mlEnabled,
    auditHash,
  });

  return (
    <div className="pzo-m101-virality-surface">
      <h2>Run Rules You Choose</h2>
      <ul>
        {runRules.map((rule, index) => (
          <li key={index}>
            <span>{rule.name}</span>
            <button onClick={() => mutate(rule.id)}>Mutate</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default M101MutatorDraftRunRulesYouChoose;
