/**
 * DealFlipCard component for displaying a deal in a flippable card format.
 */

import React, { useState } from 'react';
import classnames from 'classnames';

type Deal = {
  name: string;
  cashDelta: number;
  outcome: 'win' | 'lose';
};

/**
 * Props for the DealFlipCard component.
 */
interface Props {
  deal: Deal;
  isFlipped: boolean;
  onFlip: () => void;
}

const DealFlipCard: React.FC<Props> = ({ deal, isFlipped, onFlip }) => {
  const [flipped, setFlipped] = useState(isFlipped);

  const handleClick = () => {
    setFlipped(!flipped);
    onFlip();
  };

  const cardClasses = classnames('deal-flip-card', { flipped });

  return (
    <div className={cardClasses} onClick={handleClick}>
      <div className="front">
        <h2>{deal.name}</h2>
        <p>{`${deal.cashDelta > 0 ? '+' : ''}${Math.abs(deal.cashDelta)}</p>
      </div>
      <div className="back">
        <h2>{deal.outcome === 'win' ? 'Victory!' : 'Defeat...'}</h2>
        <p>Share this deal!</p>
      </div>
    </div>
  );
};

export { DealFlipCard, Deal };
