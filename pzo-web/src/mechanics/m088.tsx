import React from 'react';
import { useM88 } from '../hooks/useM88';
import { M88TeamTitlesCoopIdentityNamesWithSharedRootHash } from '../types/M88';

const M088 = () => {
  const { mlEnabled, auditHash, teamTitles } = useM88();

  if (!mlEnabled) return null;

  const boundedOutput = Math.min(Math.max(teamTitles.length / (auditHash + 1), 0), 1);

  return (
    <div className="pzo-m088-virality-surface">
      <h2>Team Titles</h2>
      {teamTitles.map((title, index) => (
        <div key={index}>
          <span>{title}</span>
          <progress value={boundedOutput} max={1} />
        </div>
      ))}
    </div>
  );
};

export default M088;
