import React from 'react';
import { useSpring, animated } from 'react-spring';
import './ReplayViewer.scss';

interface ReplayViewerProps {
videoUrl: string;
className?: string;
}

const ReplayViewer: React.FC<ReplayViewerProps> = ({ videoUrl, className }) => {
const props = useSpring({
config: { duration: 1000 },
from: { opacity: 0, transform: 'scale(0.9)' },
to: { opacity: 1, transform: 'scale(1)' },
});

return (
<div className={`replay-viewer ${className}`}>
<animated.div style={props}>
<iframe src={videoUrl} title="ReplayViewer" frameBorder="0" allowFullScreen></iframe>
</animated.div>
</div>
);
};

export default ReplayViewer;
