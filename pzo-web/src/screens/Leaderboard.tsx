import React from 'react';
import { useReplay } from '../hooks/useReplay';
import { LeaderboardFilters } from './LeaderboardFilters';
import { VerifiedRunsTable } from './VerifiedRunsTable';

export const Leaderboard = () => {
  const { verifiedRuns, filters, setFilters, mlEnabled, auditHash } =
    useReplay();

  if (!verifiedRuns || !mlEnabled) return null;

  return (
    <div>
      <LeaderboardFilters
        filters={filters}
        setFilters={setFilters}
        mlEnabled={mlEnabled}
        auditHash={auditHash}
      />
      {verifiedRuns.length > 0 && (
        <VerifiedRunsTable verifiedRuns={verifiedRuns} />
      )}
    </div>
  );
};
