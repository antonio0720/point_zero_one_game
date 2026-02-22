import React from 'react';
import { useGame } from '../game-context';
import { OpportunityWindow } from './opportunity-window';
import { OpenTableAuction } from './open-table-auction';

interface M09Props {
  mlEnabled?: boolean;
}

const M09: React.FC<M09Props> = ({ mlEnabled }) => {
  const game = useGame();

  if (!game) return null;

  const opportunityWindow = (
    <OpportunityWindow
      mlEnabled={mlEnabled}
      auditHash={game.auditHash}
      boundedOutput={(output: number) => Math.min(Math.max(output, 0), 1)}
    />
  );

  const openTableAuction = (
    <OpenTableAuction
      mlEnabled={mlEnabled}
      auditHash={game.auditHash}
      boundedOutput={(output: number) => Math.min(Math.max(output, 0), 1)}
    />
  );

  return (
    <div className="virality-surface">
      {opportunityWindow}
      {openTableAuction}
    </div>
  );
};

export default M09;
