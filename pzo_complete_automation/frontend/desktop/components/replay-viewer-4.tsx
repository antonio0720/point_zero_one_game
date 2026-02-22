import React from 'react';
import PropTypes from 'prop-types';
import styles from './replay-viewer-4.module.css';

const ReplayViewer4 = ({ replayData, onPlayPause, onSeek }) => {
const handleTimeUpdate = (e) => {
if (onSeek) {
onSeek(e.target.currentTime);
}
};

return (
<div className={styles.replayViewer}>
<video
src={replayData.url}
className={styles.video}
onClick={onPlayPause}
onTimeUpdate={handleTimeUpdate}
/>
{/* Add other UI components like controls or progress bar here */}
</div>
);
};

ReplayViewer4.propTypes = {
replayData: PropTypes.shape({
url: PropTypes.string.isRequired,
}).isRequired,
onPlayPause: PropTypes.func.isRequired,
onSeek: PropTypes.func,
};

export default ReplayViewer4;
