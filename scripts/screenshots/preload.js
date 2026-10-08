// Same API as app/preload.js, wired to the screenshot script instead of the real widget.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('robots', {
  onState: (fn) => ipcRenderer.on('state', (_e, sessions) => fn(sessions)),
  resize: () => {},
  decide: () => {},
  quit: () => {},
  minimize: () => {},
  setMuted: () => {},
  setIcon: () => {},
  drag: () => {},
});
