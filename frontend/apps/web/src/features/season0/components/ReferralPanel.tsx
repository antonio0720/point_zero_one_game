/**
 * ReferralPanel component for Season0 of Point Zero One Digital's web app.
 */

import React, { useState } from 'react';

type ReferralData = {
  code: string;
  invitesRemaining: number;
}

type InviteAction = {
  label: string;
  onClick: () => void;
}

type CompletionProgress = {
  completed: number;
  total: number;
}

/**
 * Props for the ReferralPanel component.
 */
interface Props {
  referralData: ReferralData;
  inviteActions: InviteAction[];
  completionProgress: CompletionProgress;
}

/**
 * The ReferralPanel component.
 * @param props - The props object containing the data for the panel.
 */
const ReferralPanel: React.FC<Props> = ({ referralData, inviteActions, completionProgress }) => {
  return (
    <div className="referral-panel">
      <h2>Your Referral Code:</h2>
      <p>{referralData.code}</p>

      <h2>Invites Remaining:</h2>
      <p>{referralData.invitesRemaining}</p>

      <ul className="invite-actions">
        {inviteActions.map((action, index) => (
          <li key={index}>
            <button onClick={action.onClick}>{action.label}</button>
          </li>
        ))}
      </ul>

      <h2>Completion Progress:</h2>
      <p>{`Completed: ${completionProgress.completed}, Total: ${completionProgress.total}`}</p>
    </div>
  );
};

export default ReferralPanel;
