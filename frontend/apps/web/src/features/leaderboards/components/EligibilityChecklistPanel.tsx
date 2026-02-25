/**
 * EligibilityChecklistPanel
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/frontend/apps/web/src/features/leaderboards/components/EligibilityChecklistPanel.tsx
 *
 * Shows the two requirements for Verified leaderboard access:
 *   1. Sport Mode opt-in
 *   2. 3 completed runs
 */

import React from 'react';

interface CheckItemProps {
  met:   boolean;
  label: string;
  hint:  string;
}

const CheckItem: React.FC<CheckItemProps> = ({ met, label, hint }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '10px 0',
      borderBottom: '1px solid #1f2937',
    }}
  >
    <span
      style={{
        marginTop: 2,
        flexShrink: 0,
        width: 20,
        height: 20,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: met ? '#059669' : '#374151',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {met ? '✓' : '✗'}
    </span>
    <div>
      <p style={{ margin: 0, fontWeight: 600, color: met ? '#d1fae5' : '#e5e7eb' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>{hint}</p>
    </div>
  </div>
);

export const EligibilityChecklistPanel: React.FC = () => (
  <div
    style={{
      background: '#111827',
      border: '1px solid #1f2937',
      borderRadius: 8,
      padding: '1rem',
    }}
  >
    <p
      style={{
        margin: '0 0 0.75rem',
        fontWeight: 700,
        fontSize: '0.875rem',
        color: '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      Requirements to unlock Verified Leaderboard
    </p>

    <CheckItem
      met={false}
      label="Enable Sport Mode"
      hint="Go to Settings → Gameplay → Enable Sport Mode to compete on the Verified ladder."
    />
    <CheckItem
      met={false}
      label="Complete 3 runs"
      hint="Finish at least 3 runs (any outcome) with Sport Mode active to qualify."
    />
  </div>
);

export default EligibilityChecklistPanel;
