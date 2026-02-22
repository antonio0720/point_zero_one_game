import React from 'react';
import { useM109MacroNewsBurstsHeadlinesThatMoveTicks } from './useM109MacroNewsBurstsHeadlinesThatMoveTicks';

interface M109MacroNewsBurstsHeadlinesThatMoveTicksProps {
  mlEnabled: boolean;
}

const M109MacroNewsBurstsHeadlinesThatMoveTicks = ({
  mlEnabled,
}: M109MacroNewsBurstsHeadlinesThatMoveTicksProps) => {
  const { headlines, auditHash } = useM109MacroNewsBurstsHeadlinesThatMoveTicks(mlEnabled);

  return (
    <div className="virality-surface">
      <h2>Macro News Bursts (Headlines That Move Ticks)</h2>
      <ul>
        {headlines.map((headline, index) => (
          <li key={index}>
            <span className="headline">{headline}</span>
            <button
              type="button"
              onClick={() => {
                // Simulate a click event to move the tick forward
                // This is a placeholder and should be replaced with actual logic
                console.log('Moving tick forward');
              }}
            >
              Move Tick Forward
            </button>
          </li>
        ))}
      </ul>
      <div className="audit-hash">
        Audit Hash: {auditHash}
      </div>
    </div>
  );
};

export default M109MacroNewsBurstsHeadlinesThatMoveTicks;
