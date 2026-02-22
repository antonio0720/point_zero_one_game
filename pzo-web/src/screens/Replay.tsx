import React from 'react';
import { useReplay } from './useReplay';
import { TimelineScrubber } from './TimelineScrubber';

interface Props {
  replayId: string;
}

const Replay = ({ replayId }: Props) => {
  const { mlEnabled, auditHash, timeline } = useReplay(replayId);

  if (!mlEnabled) return null;

  return (
    <div>
      <h2>Ghost Replay Viewer</h2>
      <p>Audit Hash: {auditHash}</p>
      <TimelineScrubber timeline={timeline} />
    </div>
  );
};

export default Replay;
