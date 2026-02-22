/**
 * CaptionGenerator component for Point Zero One Digital's financial roguelike game.
 * Generates captions using player name and outcome, and copies to clipboard. Works offline.
 */

import React, { useState } from 'react';
import ClipboardJS from 'clipboardjs';

interface CaptionData {
  id: number;
  template: string;
  caption: string;
}

const captions: CaptionData[] = require('./captions.csv').default;

/**
 * Generates a caption using the provided playerName and outcome, and copies it to the clipboard.
 * @param playerName The name of the player.
 * @param outcome The outcome of the game (win or lose).
 */
const generateCaption = (playerName: string, outcome: string): void => {
  const caption = captions.find((caption) => caption.template === `${outcome}_player`)?.caption
    .replace('{player}', playerName);

  if (caption) {
    navigator.clipboard.writeText(caption);
  }
};

const CaptionGenerator: React.FC<{ playerName: string; outcome: string }> = ({ playerName, outcome }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    generateCaption(playerName, outcome);
    setIsCopied(true);
  };

  return (
    <div>
      <p>{outcome === 'win' ? 'You won!' : 'You lost...'}</p>
      <button onClick={handleCopy}>{isCopied ? 'Copied!' : 'Copy Caption'}</button>
    </div>
  );
};

export { generateCaption, CaptionGenerator };
