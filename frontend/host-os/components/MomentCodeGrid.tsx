/**
 * MomentCodeGrid component for displaying a grid of moment codes as cards.
 */

import React from 'react';

type MomentCode = {
  code: string;
  familyName: string;
  triggerLine: string;
  calloutLine: string;
};

type Props = {
  momentCodes: MomentCode[];
};

const MomentCodeGrid: React.FC<Props> = ({ momentCodes }) => (
  <div className="moment-code-grid">
    {momentCodes.map(({ code, familyName, triggerLine, calloutLine }) => (
      <div key={code} className="moment-code-card">
        <div className="code">{code}</div>
        <div className="family-name">{familyName}</div>
        <div className="trigger-line">{triggerLine}</div>
        <div className="callout-line">{calloutLine}</div>
      </div>
    ))}
  </div>
);

export { MomentCodeGrid, MomentCode };
