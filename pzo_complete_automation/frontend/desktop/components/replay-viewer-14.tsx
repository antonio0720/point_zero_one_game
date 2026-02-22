import React from 'react';

type ReplayViewer14Props = {
replayData: any; // Replace this with your actual data type
};

const ReplayViewer14: React.FC<ReplayViewer14Props> = ({ replayData }) => {
return (
<div className="replay-viewer-14">
{/* Render the replay data as per your requirement */}
{/* Assume replayData has properties: startTime, endTime, events */}
<h3>Replay - {replayData.startTime} to {replayData.endTime}</h3>
{replayData.events.map((event) => (
<div key={event.id}>
<h4>{event.name}</h4>
<p>{event.description}</p>
</div>
))}
</div>
);
};

export default ReplayViewer14;
