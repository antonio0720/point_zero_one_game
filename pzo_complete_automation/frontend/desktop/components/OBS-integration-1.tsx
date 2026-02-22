import * as React from 'react';
import { useEffect } from 'react';
import electron, { ipcRenderer } from 'electron';
import path from 'path';
import obsStudioPath from '../constants/obs-studio-path';

const { app } = electron;

interface ObsIntegrationProps {
onStreamStarted: (streamKey: string) => void;
}

const ObsIntegration: React.FC<ObsIntegrationProps> = ({ onStreamStarted }) => {
useEffect(() => {
const startStream = () => {
ipcRenderer.send('start-stream');
};

const receiveStreamKey = (event, arg) => {
if (arg) {
onStreamStarted(arg);
}
};

app.on('ready', startStream);
ipcRenderer.on('stream-key', receiveStreamKey);

return () => {
app.off('ready', startStream);
ipcRenderer.removeListener('stream-key', receiveStreamKey);
};
}, []);

useEffect(() => {
if (!app.isReady()) {
setTimeout(async () => {
await electron.shell.openExternal(path.join(__dirname, obsStudioPath));
}, 1000);
}
}, []);

return null;
};

export default ObsIntegration;
