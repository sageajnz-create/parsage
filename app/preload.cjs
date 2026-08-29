const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('parsage', {
  sendInputPacket: (packet) => ipcRenderer.send('input-packet', packet),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  startNativePeer: (options) => ipcRenderer.invoke('native-peer-start', options),
  signalNativePeer: (payload) => ipcRenderer.send('native-peer-signal', payload),
  stopNativePeer: () => ipcRenderer.invoke('native-peer-stop'),
  onNativePeerMessage: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('native-peer-message', listener);
    return () => ipcRenderer.removeListener('native-peer-message', listener);
  }
});
