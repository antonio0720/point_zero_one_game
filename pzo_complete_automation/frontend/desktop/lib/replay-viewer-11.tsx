import React from 'react';
import PropTypes from 'prop-types';

const ReplayViewer = ({ replay }) => {
return (
<div>
{replay.map((frame, index) => (
<div key={index}>
{/* Render frame data or components here */}
</div>
))}
</div>
);
};

ReplayViewer.propTypes = {
replay: PropTypes.arrayOf(PropTypes.shape({ /* Frame shape */ })).isRequired,
};

export default ReplayViewer;
