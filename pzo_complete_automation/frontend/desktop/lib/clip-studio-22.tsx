import React, { useState, useEffect } from 'react';
import Electron from 'electron';
const { app, BrowserWindow } = Electron;

function createMainWindow() {
const win = new BrowserWindow({
width: 800,
height: 600,
webPreferences: {
nodeIntegration: true,
},
});

win.loadURL('http://localhost:3000');
}

app.on('ready', createMainWindow);

app.on('window-all-closed', () => {
if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
