/**
 * Creator Studio home (create episode type, recent drafts, level badge)
 */

import React, { useState } from 'react';
import { EpisodeType, Draft, LevelBadge } from '../types';
import CreateEpisodeForm from './CreateEpisodeForm';
import RecentDraftsList from './RecentDraftsList';
import LevelBadgeComponent from './LevelBadge';

type Props = {};

const CreatorPage: React.FC<Props> = () => {
  const [selectedEpisodeType, setSelectedEpisodeType] = useState<EpisodeType | null>(null);

  return (
    <div className="creator-page">
      <h1>Creator Studio</h1>
      <CreateEpisodeForm onSelect={setSelectedEpisodeType} />
      {selectedEpisodeType && <LevelBadgeComponent level={selectedEpisodeType.level} />}
      <RecentDraftsList drafts={[/* ... */]} />
    </div>
  );
};

export default CreatorPage;

// Types

type EpisodeType = {
  id: number;
  name: string;
  description: string;
  level: number;
};

type Draft = {
  id: number;
  episodeTypeId: number;
  title: string;
  content: string;
  createdAt: Date;
};
