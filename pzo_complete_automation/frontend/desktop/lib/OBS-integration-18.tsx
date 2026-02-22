import * as electron from 'electron';
import * as obsWebsocket from 'obs-websocket-js';

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

let mainWindow;
let obs;

function createMainWindow() {
mainWindow = new BrowserWindow({
width: 800,
height: 600,
webPreferences: {
nodeIntegration: true,
},
});

mainWindow.loadFile('index.html');
mainWindow.on('ready-to-show', () => {
mainWindow.show();
});
}

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
if (process.platform !== 'darwin') {
app.quit();
}
});

app.on('activate', () => {
if (!mainWindow) {
createMainWindow();
} else {
mainWindow.show();
}
});

function connectToOBS() {
obs = new obsWebsocket.ObsWebSocket();

obs.connect('localhost', 4444).then(() => {
console.log('Connected to OBS');
});
}

connectToOBS();
