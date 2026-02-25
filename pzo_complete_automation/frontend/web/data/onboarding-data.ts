/**
 * onboarding-data
 * pzo_complete_automation/frontend/web/data/onboarding-data.ts
 */

import React from 'react';

export interface OnboardingChallengeData {
  title:       string;
  description: string;
  explanation: React.ReactNode;
  starterCode: string;
}

export const PracticeSandbox8Data: OnboardingChallengeData = {
  title:       'Average Age Challenge',
  description: 'Write a function that takes an array of people objects and returns the average age.',
  starterCode: `function averageAge(people) {
  // Your code here
}`,
  explanation: React.createElement(
    'div',
    null,
    React.createElement('p', { style: { marginBottom: 8 } },
      'To find the average age, sum all the ages and divide by the number of people:',
    ),
    React.createElement('pre', {
      style: {
        background:   '#0d0d1a',
        padding:      12,
        borderRadius: 6,
        fontSize:     12,
        overflowX:    'auto',
      },
    },
      `function averageAge(people) {
  const total = people.reduce((sum, p) => sum + p.age, 0);
  return total / people.length;
}`,
    ),
    React.createElement('p', { style: { marginTop: 8, color: '#9ca3af', fontSize: 13 } },
      'Array.reduce() accumulates the sum; dividing by people.length gives the mean.',
    ),
  ),
};
