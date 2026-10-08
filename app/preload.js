const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('robots', {
  onState: (fn) => ipcRenderer.on('state', (_e, sessions) => fn(sessions)),
  resize: (width, height) => ipcRenderer.send('resize', { width, height }),
  decide: (sessionId, requestId, choice, message) => ipcRenderer.send('decide', { sessionId, requestId, choice, message }),
  quit: () => ipcRenderer.send('quit'),
  minimize: () => ipcRenderer.send('minimize'),
  setMuted: (muted) => ipcRenderer.send('set-muted', muted),
  drag: (phase, dx = 0, dy = 0) => ipcRenderer.send('drag', { phase, dx, dy }),
  setIcon: (dataUrl) => ipcRenderer.send('set-icon', dataUrl),
});
