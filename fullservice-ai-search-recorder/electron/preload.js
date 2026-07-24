'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  checkChromium: () => ipcRenderer.invoke('check-chromium'),
  installChromium: () => ipcRenderer.invoke('install-chromium'),
  onStatus: (cb) => ipcRenderer.on('status', (_, msg) => cb(msg)),
  onChromiumProgress: (cb) => ipcRenderer.on('chromium-progress', (_, msg) => cb(msg)),
});
