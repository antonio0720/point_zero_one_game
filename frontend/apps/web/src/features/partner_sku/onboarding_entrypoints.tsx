/**
 * Entry points for HRIS checklist deep links and bank app deep links into claim flow.
 */

import React, { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  hrisChecklistDeepLink: string;
  bankAppDeepLink: string;
}

/**
 * Component for handling deep links from HRIS checklist and bank app.
 */
const OnboardingEntryPoints: FunctionComponent<Props> = ({ hrisChecklistDeepLink, bankAppDeepLink }) => {
  return (
    <div>
      <h2>Onboarding Entry Points</h2>
      <p>
        <strong>HRIS Checklist Deep Link:</strong>
        <br />
        <a href={hrisChecklistDeepLink} target="_blank" rel="noopener noreferrer">
          {hrisChecklinkDeepLink}
        </a>
      </p>
      <p>
        <strong>Bank App Deep Link:</strong>
        <br />
        <a href={bankAppDeepLink} target="_blank" rel="noopener noreferrer">
          {bankAppDeepLink}
        </a>
      </p>
    </div>
  );
};

export default OnboardingEntryPoints;
