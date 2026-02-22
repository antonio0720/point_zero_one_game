import React from 'react';
import { useM81SynergyTreePathsBranchingPortfolioIdentity } from './useM81SynergyTreePathsBranchingPortfolioIdentity';

interface M081Props {
  mlEnabled?: boolean;
}

const M081 = ({ mlEnabled }: M081Props) => {
  const synergyTreePathsBranchingPortfolioIdentity = useM81SynergyTreePathsBranchingPortfolioIdentity(mlEnabled);

  return (
    <div className="virality-surface">
      <h2>Synergy Tree Paths (Branching Portfolio Identity)</h2>
      {synergyTreePathsBranchingPortfolioIdentity.map((path, index) => (
        <div key={index} className="synergy-tree-path">
          <p>Path: {path}</p>
          <p>Probability: {(path.probability * 100).toFixed(2)}%</p>
        </div>
      ))}
    </div>
  );
};

export default M081;
