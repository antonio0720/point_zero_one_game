/**
 * MembershipCardHeader component for Season0 app.
 * Displays tier chip, countdown, and share button.
 */

import React from 'react';
import { TierChip } from '../TierChip';
import { CountdownTimer } from '../CountdownTimer';
import { ShareButton } from '../ShareButton';

type Props = {
  tier: string;
  daysLeft: number;
  onShare: () => void;
};

export const MembershipCardHeader: React.FC<Props> = ({ tier, daysLeft, onShare }) => (
  <div className="membership-card-header">
    <TierChip tier={tier} />
    <CountdownTimer days={daysLeft} />
    <ShareButton onClick={onShare} />
  </div>
);
