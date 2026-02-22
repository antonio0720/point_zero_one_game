import { app, nativeImage } from 'electron';
import { execSync } from 'child_process';

const icon = nativeImage.createFromPath('path/to/your/icon.png');

function createWindow() {
const win = new electron.BrowserWindow({
show: false,
width: 800,
height: 600,
icon,
webPreferences: {
nodeIntegration: true,
},
});

win.loadURL('https://www.clip-studio.com/en');
win.on('ready-to-show', () => {
win.show();
});
}

app.whenReady().then(createWindow);

app.on('activate', createWindow);

function launchClipStudio() {
execSync('"path/to/your/clip_studio_paint_ex.exe"');
}

app.on('window-all-closed', () => {
if (process.platform !== 'darwin') {
app.quit();
}
});

// Add a command to launch Clip Studio 16
app.on('ready', () => {
const clipStudioMenu = electron.Menu.buildFromTemplate([
{
label: 'Launch Clip Studio 16',
click() {
launchClipStudio();
},
},
]);

// Insert the new menu item to the application menu (Mac) or system tray context menu (Windows/Linux)
// You may need to adjust this based on your Electron project's structure and platform-specific code.
});
