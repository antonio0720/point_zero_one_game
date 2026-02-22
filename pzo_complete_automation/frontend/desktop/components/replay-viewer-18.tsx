import React from 'react';
import PropTypes from 'prop-types';

const ReplayViewer = ({ replay }) => {
if (!replay) return null;

const playbackRate = 1; // Adjust this to control the speed of the replay

return (
<video src={replay} controls playsInline loop data-testid="replay-viewer">
Your browser does not support the video tag.
</video>
);
};

ReplayViewer.propTypes = {
replay: PropTypes.string,
};

export default ReplayViewer;
