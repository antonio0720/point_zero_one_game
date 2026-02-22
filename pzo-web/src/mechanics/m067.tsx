import React from 'react';
import { useM67 } from './useM67';

interface M067Props {
  className?: string;
}

const M067 = ({ className }: M067Props) => {
  const { mlEnabled, auditHash, boundedOutput } = useM67();

  if (!mlEnabled) return null;

  return (
    <div className={`m067 ${className}`}>
      <h2>Unlock Complexity, Not Power</h2>
      <p>
        As you progress through the game, new mechanics and features will be
        unlocked. These will add complexity to the game, but not necessarily
        power.
      </p>
      <ul>
        {[
          'New item types',
          'Additional enemy behaviors',
          'Environmental hazards',
          'Player abilities',
        ].map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

export default M067;
