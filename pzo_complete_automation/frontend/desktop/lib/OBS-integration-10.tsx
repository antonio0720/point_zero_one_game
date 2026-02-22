import * as electron from 'electron';
import { app, BrowserWindow } from 'electron';
import { OBSWebsocket } from 'obs-websocket-js';

const main = () => {
const win = new BrowserWindow({
width: 800,
height: 600,
webPreferences: {
nodeIntegration: true,
},
});

win.loadFile('index.html');

const obs = new OBSWebsocket();

obs.connect({ address: 'localhost', port: 4444 })
.then(() => {
console.log('Connected to OBS');
})
.catch((err) => {
console.error('Error connecting to OBS:', err);
});

obs.on('sceneChanged', (data) => {
console.log('Current scene changed:', data.newSceneName);
});
};

app.whenReady().then(main);
