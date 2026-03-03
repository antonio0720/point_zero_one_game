// TimeEngineVisuals.stories.tsx
import React from 'react';
import { render } from '@testing-library/react';
import TickTierBorderStates, { BorderStateType } from '../components/TickTierBorders';

describe('Time Engine Visual Regression Test - Time Tier Borders', () => {
  const borderClasses = ['.border-normal', '.border-urgent', '.border-critical', '.border-hold'];

  it('should render tick tier borders for all states', () => {
    const borderStates = [
      BorderStateType.NORMAL,
      BorderStateType.URGENT,
      BorderStateType.CRITICAL,
      BorderStateType.HOLD,
    ];

    borderClasses.forEach((className) => {
      const { container } = render(<TickTierBorderStates className={className} />);
      expect(container).toMatchSnapshot();
    });
  });
});
