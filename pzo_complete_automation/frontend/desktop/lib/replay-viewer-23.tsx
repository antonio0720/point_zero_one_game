import React from 'react';
import { useReplayContext } from '@contexts/ReplayContext';

const ReplayViewer = () => {
const { state, actions } = useReplayContext();

// Handle play/pause and seek events
const handlePlayPause = () => {
actions.togglePlayback();
};

const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
const seekTo = parseFloat(event.target.value);
actions.seek(seekTo);
};

return (
<div className="replay-viewer">
<video
src={state.currentReplay?.file}
controls
ref={state.videoRef}
onClick={handlePlayPause}
/>
{state.isPlaying && (
<input
type="range"
min={0}
max={state.duration || 0}
value={state.currentTime}
onChange={handleSeek}
/>
)}
</div>
);
};

export default ReplayViewer;
