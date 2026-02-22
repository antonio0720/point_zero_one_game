/**
 * FormatSelector component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type Format = 'CasualTable' | 'CommunityNight' | 'CompetitiveNight';

interface Props {
  format: Format;
  onFormatChange: (format: Format) => void;
}

const formats = [
  { name: 'Casual Table', timeBlock: '12:00 - 14:00', playerCount: 8, clipTarget: 5000, debriefDepth: 3 },
  { name: 'Community Night', timeBlock: '18:00 - 20:00', playerCount: 16, clipTarget: 10000, debriefDepth: 4 },
  { name: 'Competitive Night', timeBlock: '22:00 - 00:00', playerCount: 32, clipTarget: 25000, debriefDepth: 5 },
];

const FormatSelector: React.FC<Props> = ({ format, onFormatChange }) => {
  const handleFormatClick = (newFormat: Format) => () => {
    onFormatChange(newFormat);
  };

  return (
    <div className="format-selector">
      {formats.map(({ name, timeBlock, playerCount, clipTarget, debriefDepth }) => (
        <button
          key={name}
          className={`format-card ${format === name ? 'active' : ''}`}
          onClick={handleFormatClick(name)}
        >
          <div>{timeBlock}</div>
          <div>{playerCount} players</div>
          <div>Clip target: {clipTarget}</div>
          <div>Debrief depth: {debriefDepth}</div>
        </button>
      ))}
    </div>
  );
};

export default FormatSelector;
