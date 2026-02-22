import React, { useState } from 'react';
import obs from 'obs-websocket';

const OBSIntegration15 = () => {
const [connected, setConnected] = useState(false);
const [scenes, setScenes] = useState([]);
const obsClient = new obs();

obsClient.connect({ address: 'localhost:4444' });

obsClient.on('connectionopen', () => {
setConnected(true);
obsClient.sendOBS('GetScenes', null, (err, data) => {
if (!err && data) {
setScenes(data.scenes);
}
});
});

obsClient.on('message', (pack) => {
// Handle incoming messages here
});

const handleDisconnect = () => {
obsClient.disconnect();
setConnected(false);
};

return (
<div>
{connected ? (
<>
{scenes.map((scene) => (
<p key={scene.name}>{scene.name}</p>
))}
<button onClick={handleDisconnect}>Disconnect</button>
</>
) : (
<p>Connecting to OBS...</p>
)}
</div>
);
};

export default OBSIntegration15;
