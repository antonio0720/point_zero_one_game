import * as electron from 'electron';
import * as obsWebSocket from 'obs-websocket-js';

const { app, BrowserWindow } = electron;
let mainWindow: BrowserWindow;
let obs: obsWebSocket.WebSocketClient | null = null;

app.on('ready', () => {
mainWindow = new BrowserWindow({
show: false,
width: 800,
height: 600,
webPreferences: {
nodeIntegration: true,
},
});

mainWindow.loadFile('index.html');
mainWindow.once('ready-to-show', () => {
mainWindow.show();
});

const serverURL = 'ws://localhost:4443'; // Replace with your OBS WebSocket server URL
obs = new obsWebSocket.WebSocketClient(serverURL);

obs?.on('connectionopen', () => {
console.log('Connected to OBS');
obs?.sendOBSMessage({ Command: 'GetSources' });
});

obs?.on('message', (pack: any) => {
if (pack.Data && pack.Data.Sources) {
// Handle sources data from OBS
}
});
});

app.on('window-all-closed', () => {
if (process.platform !== 'darwin') app.quit();
});

app.whenReady().then(() => {
if (!mainWindow) createWindow();
});
