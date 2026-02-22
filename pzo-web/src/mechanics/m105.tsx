import React from 'react';
import { useGame } from '../game-context';

interface M105LastLookWindowProps {
  game: any;
}

const M105LastLookWindow = ({ game }: M105LastLookWindowProps) => {
  const mlEnabled = game.ml_enabled;

  if (!mlEnabled) return null;

  const lastLookWindowOpen = game.last_look_window_open;
  const lastLookWindowClose = game.last_look_window_close;
  const lastLookWindowAuditHash = game.last_look_window_audit_hash;

  const boundedOutput = Math.min(Math.max(game.last_look_window_output, 0), 1);

  return (
    <div className="last-look-window">
      <h2>Last Look Window</h2>
      <p>One Final Chance, No Debates</p>
      <button onClick={lastLookWindowOpen}>Open Last Look Window</button>
      <button onClick={lastLookWindowClose}>Close Last Look Window</button>
      <div className="audit-hash">
        <span>Audit Hash:</span>
        <span>{lastLookWindowAuditHash}</span>
      </div>
      <div className="output">
        <span>Output:</span>
        <span>{boundedOutput.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default M105LastLookWindow;
