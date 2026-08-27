const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('parsage', {
  sendInputPacket: (packet) => ipcRenderer.send('input-packet', packet),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
