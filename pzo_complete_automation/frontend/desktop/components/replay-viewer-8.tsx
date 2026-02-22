import React from 'react';
import VideoPlayer from 'react-video-player';
import 'react-video-player/dist/react-video-player.css';

interface ReplayViewerProps {
replayUrl: string;
}

const ReplayViewer: React.FC<ReplayViewerProps> = ({ replayUrl }) => {
return (
<div style={{ position: 'relative', width: '100%' }}>
<VideoPlayer
className="video-player"
autoPlay
controls
src={replayUrl}
/>
</div>
);
};

export default ReplayViewer;
