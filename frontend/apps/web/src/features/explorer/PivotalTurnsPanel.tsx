/**
 * PivotalTurnsPanel component for Point Zero One Digital's financial roguelike game.
 * Renders 3-7 pivots, jump-to-turn anchors, delta chips, and a collapsible detail section.
 */

import React, { useState } from 'react';
import { Turn } from '../../types';

type Props = {
  turns: Turn[];
};

const PivotalTurnsPanel: React.FC<Props> = ({ turns }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pivotal-turns-panel">
      <div className="header" onClick={() => setExpanded(!expanded)}>
        <h3>{`Pivots (${turns.length})`}</h3>
        {expanded ? <i className="fa fa-chevron-up" /> : <i className="fa fa-chevron-down" />}
      </div>
      {expanded && (
        <div className="body">
          {turns.map((turn, index) => (
            <TurnRow key={index} turn={turn} />
          ))}
        </div>
      )}
    </div>
  );
};

const TurnRow: React.FC<{ turn: Turn }> = ({ turn }) => {
  return (
    <div className="turn-row">
      <a href={`#turn-${turn.id}`} className="jump-to-turn">
        Jump to Turn {turn.id}
      </a>
      <div className="delta-chips">
        {turn.deltaChips.map((chip, index) => (
          <span key={index}>{chip}</span>
        ))}
      </div>
      <details className="detail">
        <summary>Details</summary>
        {/* Render turn details here */}
      </details>
    </div>
  );
};

export { PivotalTurnsPanel, TurnRow };
