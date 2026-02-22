import React from 'react';
import { useGame } from '../hooks/useGame';
import { useMLModel } from '../hooks/useMLModel';

interface Props {
  shieldCount: number;
}

const ShieldIcons = ({ shieldCount }: Props) => {
  const game = useGame();
  const mlModel = useMLModel();

  if (!mlEnabled()) return null;

  const consumeAnimation = () => {
    if (shieldCount > 0 && game.player.shieldConsumed === false) {
      game.player.shieldConsumed = true;
      setTimeout(() => {
        game.player.shieldConsumed = false;
      }, 100);
    }
  };

  return (
    <div className="shield-icons">
      {Array(shieldCount)
        .fill(null)
        .map((_, index) => (
          <div key={index} onClick={() => consumeAnimation()}>
            <img src="/images/shield.png" alt="Shield Icon" />
          </div>
        ))}
    </div>
  );
};

export default ShieldIcons;
