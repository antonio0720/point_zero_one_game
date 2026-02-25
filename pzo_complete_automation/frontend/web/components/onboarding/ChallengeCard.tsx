/**
 * ChallengeCard
 * pzo_complete_automation/frontend/web/components/onboarding/ChallengeCard.tsx
 */

import React from 'react';

interface ChallengeCardProps {
  children: React.ReactNode;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ children }) => (
  <div
    style={{
      background:   '#1a1a2e',
      borderRadius: 12,
      padding:      24,
      maxWidth:     720,
      margin:       '0 auto',
      display:      'flex',
      flexDirection: 'column',
      gap:          16,
      boxShadow:    '0 4px 24px rgba(0,0,0,0.4)',
    }}
  >
    {children}
  </div>
);

export default ChallengeCard;
