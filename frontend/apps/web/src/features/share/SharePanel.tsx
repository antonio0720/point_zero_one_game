/**
 * SharePanel component for Point Zero One Digital's financial roguelike game.
 * Displays three share card variants, one-tap share sheet, copy link, social platform deep-links (TikTok, Instagram, Twitter/X), and moment clip download.
 */

import React from 'react';
import { ShareData } from './types';

type Props = {
  gameId: number;
  shareData: ShareData[];
};

const SharePanel: React.FC<Props> = ({ gameId, shareData }) => {
  // Implementation of the SharePanel component goes here

  return (
    <div className="share-panel">
      {/* Render each share card variant */}
      {shareData.map((data) => (
        <ShareCard key={data.id} {...data} />
      ))}

      {/* Implement one-tap share sheet, copy link, social platform deep-links, and moment clip download */}
    </div>
  );
};

interface ShareData {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  url: string;
}

export default SharePanel;
