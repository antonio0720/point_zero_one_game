import React from 'react';
import { useEffect } from 'react';
import obs from 'obs-websocket';

interface OBSProps {
onSceneChanged: (scene: string) => void;
}

const OBSIntegration3: React.FC<OBSProps> = ({ onSceneChanged }) => {
useEffect(() => {
const client = new obs();

client.connect({ address: 'localhost', port: 4445 });

client.on('scenechanged', (scene) => {
onSceneChanged(scene);
});

return () => {
client.disconnect();
};
}, []);

return <div>OBS Integration - Ready</div>;
};

export default OBSIntegration3;
