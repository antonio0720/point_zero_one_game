/**
 * AutopsySnippetPlayer component for Point Zero One Digital's financial roguelike game.
 */

import React, { useState } from 'react';
import { SnippetData } from '../../types/snippets';

type AutopsySnippetPlayerProps = {
  snippet: SnippetData;
};

const AutopsySnippetPlayer: React.FC<AutopsySnippetPlayerProps> = ({ snippet }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpandClick = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="autopsy-snippet-player">
      <h3>{snippet.title}</h3>
      <p>{snippet.content}</p>
      <button onClick={handleExpandClick}>
        {isExpanded ? 'Collapse' : 'Expand'} deep dive (1 click)
      </button>
      {isExpanded && (
        <a href={snippet.deepDiveLink} target="_blank" rel="noopener noreferrer">
          Deep Dive Link
        </a>
      )}
    </div>
  );
};

export { AutopsySnippetPlayer, AutopsySnippetPlayerProps };
