import React from 'react';
import PropTypes from 'prop-types';

function ReplayViewer({ videoUrl }) {
return (
<div>
<video src={videoUrl} controls />
</div>
);
}

ReplayViewer.propTypes = {
videoUrl: PropTypes.string.isRequired,
};

export default ReplayViewer;
