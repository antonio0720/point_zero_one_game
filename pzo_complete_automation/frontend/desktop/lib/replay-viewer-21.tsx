import React from 'react';
import { useReplayContext } from '../../context/ReplayContext';
import ReplayControls from './ReplayControls';
import ReplayProgressBar from './ReplayProgressBar';
import ReplayVideoPlayer from './ReplayVideoPlayer';

const ReplayViewer = () => {
const { replay, seek, play, pause, isPlaying } = useReplayContext();

return (
<div className="replay-viewer">
<ReplayProgressBar />
<ReplayVideoPlayer src={replay.videoUrl} />
<ReplayControls
isPlaying={isPlaying}
seek={seek}
play={play}
pause={pause}
/>
</div>
);
};

export default ReplayViewer;
