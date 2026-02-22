import React from 'react';
import ReactDOMServer from 'react-dom/server';

interface ReplayViewerProps {
replayData: any;
}

const ReplayViewer: React.FC<ReplayViewerProps> = ({ replayData }) => {
const replayHTML = ReactDOMServer.renderToString(replayData);

return (
<div dangerouslySetInnerHTML={{ __html: replayHTML }} />
);
};

export default ReplayViewer;
