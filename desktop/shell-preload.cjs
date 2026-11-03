'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('tapnova', Object.freeze({
  command: (name, value) => ipcRenderer.invoke('tapnova:command', name, value),
  onStatus: callback => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('tapnova:status', listener);
    return () => ipcRenderer.removeListener('tapnova:status', listener);
  },
  onUpdate: callback => {
    const listener=(_event,state)=>callback(state);
    ipcRenderer.on('tapnova:update',listener);
    return ()=>ipcRenderer.removeListener('tapnova:update',listener);
  },
  onLicense: callback => {
    const listener=(_event,state)=>callback(state);ipcRenderer.on('tapnova:license',listener);
    return ()=>ipcRenderer.removeListener('tapnova:license',listener);
  },
  onPresence: callback => {
    const listener=(_event,state)=>callback(state);ipcRenderer.on('tapnova:presence',listener);
    return ()=>ipcRenderer.removeListener('tapnova:presence',listener);
  },
  onAccount: callback => {
    const listener=(_event,state)=>callback(state);ipcRenderer.on('tapnova:account',listener);
    return ()=>ipcRenderer.removeListener('tapnova:account',listener);
  },
  platform: process.platform
}));
