import React from 'react';
import { useM44StarterPathsArchetypeBuilds } from './useM44StarterPathsArchetypeBuilds';

interface Props {
  mlEnabled?: boolean;
}

const M044 = ({ mlEnabled }: Props) => {
  const { starterPaths, archetypeBuilds, auditHash } = useM44StarterPathsArchetypeBuilds(mlEnabled);

  return (
    <div className="m-4">
      <h2>Starter Paths</h2>
      <ul>
        {starterPaths.map((path) => (
          <li key={path.id}>{path.name}</li>
        ))}
      </ul>

      <h2>Archetype Builds</h2>
      <ul>
        {archetypeBuilds.map((build) => (
          <li key={build.id}>{build.name}</li>
        ))}
      </ul>

      <p>Audit Hash: {auditHash}</p>
    </div>
  );
};

export default M044;
