/**
 * BoundedDecisionPanel component for Leverage/Asset choice decision type in onboarding run2.
 */

import React, { useState } from 'react';
import { Decision, DecisionType, Outcome } from '../../types';
import DecisionPanel from '../DecisionPanel';

type Props = {
  /** The current decision to be rendered */
  decision: Decision;
  /** Callback for handling the user's choice */
  onChoice: (choice: Outcome) => void;
};

const BoundedDecisionPanel: React.FC<Props> = ({ decision, onChoice }) => {
  const [selectedOption, setSelectedOption] = useState<Outcome | null>(null);

  const handleChoice = (choice: Outcome) => {
    setSelectedOption(choice);
    onChoice(choice);
  };

  if (!decision || !decision.outcomes) {
    return null;
  }

  const decisionType = decision.type as DecisionType.LEVERAGE_ASSET_CHOICE;
  const outcomes = decision.outcomes;

  return (
    <DecisionPanel
      title={decision.title}
      subtitle={decision.subtitle}
      options={outcomes.map((option) => ({
        label: option.label,
        value: option.value,
        isSelected: selectedOption?.value === option.value,
        onClick: () => handleChoice(option),
      }))}
    />
  );
};

export default BoundedDecisionPanel;
```

This TypeScript file defines a `BoundedDecisionPanel` component for the Leverage/Asset choice decision type in onboarding run2. The component uses React hooks to manage user interaction and communicates with its parent component through a provided callback function `onChoice`. The component also exports the default export, following the strict TypeScript guidelines.
