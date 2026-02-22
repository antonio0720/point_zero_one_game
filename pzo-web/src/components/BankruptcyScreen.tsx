import React from 'react';
import { useGame } from '../hooks/useGame';
import { useML } from '../hooks/useML';
import { useAuditHash } from '../hooks/useAuditHash';

interface Props {
  className?: string;
}

const BankruptcyScreen = ({ className }: Props) => {
  const game = useGame();
  const ml = useML();
  const auditHash = useAuditHash();

  if (!game || !ml) return null;

  const clipReadyImage = async () => {
    const screenshot = await html2canvas(document.body);
    return screenshot.toDataURL();
  };

  const shareButtonClicked = async () => {
    const image = await clipReadyImage();
    navigator.clipboard.writeText(image);
  };

  if (ml_enabled) {
    ml.predict(game.state).then((output) => {
      console.log(output);
    });
  }

  return (
    <div className={className}>
      <h1>Game Over</h1>
      <p>
        You have gone bankrupt. The forensic cause of your demise is:
      </p>
      <ul>
        {game.state.cause.map((cause, index) => (
          <li key={index}>{cause}</li>
        ))}
      </ul>
      <button onClick={shareButtonClicked}>Share Screenshot</button>
      <a href="#" onClick={() => game.reset()}>
        See what killed me
      </a>
      <button onClick={() => game.playAgain()}>Play Again</button>
    </div>
  );
};

export default BankruptcyScreen;
