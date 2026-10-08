const { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage, screen } = require('electron');
const http = require('node:http');
const path = require('node:path');
const { randomUUID, randomBytes, timingSafeEqual } = require('node:crypto');
const fs = require('node:fs');
const { createState, applyEvent, prune, snapshot, INTERACTIVE_TOOLS } = require('./state');

const PORT = 47821;
const MARGIN = 16;
const LOG_MAX_BYTES = 1_000_000;
const state = createState();
const held = new Map(); // session_id -> { requestId, res, suggestions } of a PermissionRequest waiting for a click

// Shared secret with hooks/relay.mjs: a fresh random token per run, in a file only this user can read.
// Blocks web pages (they cannot read the file nor send the header without a CORS preflight we never answer).
const TOKEN = randomBytes(32).toString('hex');
// Open at login. Running unpackaged (npm start), the entry must launch electron.exe with this app's folder.
function loginOptions() {
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}
// macOS: setLoginItemSettings ignores path/args and would open the bare Electron app, so use a LaunchAgent.
const launchAgent = path.join(require('node:os').homedir(), 'Library', 'LaunchAgents', 'com.robopeao.widget.plist');
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function setAutostart(on) {
  if (process.platform !== 'darwin') return app.setLoginItemSettings({ openAtLogin: on, ...loginOptions() });
  if (!on) return fs.rmSync(launchAgent, { force: true });
  const args = [process.execPath, ...(app.isPackaged ? [] : [app.getAppPath()])];
  fs.mkdirSync(path.dirname(launchAgent), { recursive: true });
  fs.writeFileSync(
    launchAgent,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.robopeao.widget</string>
  <key>ProgramArguments</key><array>${args.map((a) => `<string>${xml(a)}</string>`).join('')}</array>
  <key>RunAtLoad</key><true/>
</dict></plist>
`,
  );
}
function isAutostart() {
  if (process.platform === 'darwin') return fs.existsSync(launchAgent);
  return app.getLoginItemSettings(loginOptions()).openAtLogin;
}
// First run turns it on; after that the tray checkbox is the only thing that changes it.
function autostartFirstRun() {
  const flag = path.join(app.getPath('userData'), 'autostart-configured');
  if (fs.existsSync(flag)) return;
  setAutostart(true);
  fs.writeFileSync(flag, '1');
}

function writeToken() {
  const file = path.join(app.getPath('userData'), 'token');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, TOKEN, { mode: 0o600 });
}

function authorized(req) {
  if (req.headers.origin) return false; // browsers always send Origin on cross-site POST; the relay never does
  const got = Buffer.from(String(req.headers['x-robots-token'] || ''));
  const want = Buffer.from(TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
}

// Event log for debugging (event types and tool names only, never tool input).
let logFile;
function log(line) {
  try {
    logFile ??= path.join(app.getPath('userData'), 'events.log');
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > LOG_MAX_BYTES) fs.writeFileSync(logFile, '');
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // log is best effort
  }
}
let win;
let tray;
let muted = false;
let anchor; // bottom-right corner of the widget on screen; the window grows up and left from it
let size = { width: 360, height: 100 };
let dragFrom = null;

function push() {
  if (win && !win.isDestroyed()) win.webContents.send('state', snapshot(state));
}

function release(sessionId, decision = null, reason = 'liberado') {
  const h = held.get(sessionId);
  if (!h) return;
  held.delete(sessionId);
  log(`release ${sessionId.slice(0, 8)} ${decision ? decision.behavior : 'sem decisão'} (${reason})`);
  h.res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ decision }));
}

// Widget choice -> PermissionRequest decision (shape from the Claude Code hooks docs).
function buildDecision(choice, message, suggestions) {
  if (choice === 'allow') return { behavior: 'allow' };
  if (choice === 'allow-always' && suggestions.length) return { behavior: 'allow', updatedPermissions: suggestions };
  if (choice === 'deny') {
    const text = typeof message === 'string' && message.trim() ? message.trim().slice(0, 2000) : 'Negado pelo widget Robô Peão.';
    return { behavior: 'deny', message: text };
  }
  return null;
}

function handleEvent(ev, res) {
  const isPermission = ev.hook_event_name === 'PermissionRequest';
  log(`${ev.hook_event_name} ${String(ev.session_id).slice(0, 8)}${ev.tool_name ? ' ' + ev.tool_name : ''}${ev.notification_type ? ' ' + ev.notification_type : ''}`);
  // Any other activity in the session means the prompt was answered elsewhere (e.g. in the terminal).
  if (!isPermission && ev.hook_event_name !== 'Notification') release(ev.session_id, null, `veio ${ev.hook_event_name}`);

  if (isPermission) ev.request_id = randomUUID();
  const { notify } = applyEvent(state, ev);
  if (notify && !muted && Notification.isSupported()) {
    const n = new Notification({ title: notify.title, body: notify.body, silent: false });
    n.on('click', () => win.show());
    n.show();
  }
  push();

  if (isPermission && INTERACTIVE_TOOLS.has(ev.tool_name)) {
    // Questions need a real answer: never hold them, Claude Code shows its own dialog.
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ decision: null }));
  } else if (isPermission) {
    release(ev.session_id, null, 'novo pedido');
    const suggestions = Array.isArray(ev.permission_suggestions) ? ev.permission_suggestions : [];
    held.set(ev.session_id, { requestId: ev.request_id, res, suggestions });
    res.on('close', () => {
      if (held.get(ev.session_id)?.res === res) {
        held.delete(ev.session_id);
        log(`timeout ${String(ev.session_id).slice(0, 8)}: o relay desistiu de esperar`);
      }
    });
  } else {
    res.writeHead(204).end();
  }
}

function startServer(attempt = 1) {
  const server = http
    .createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/event') return res.writeHead(404).end();
      if (!authorized(req)) return res.writeHead(403).end();
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 1_000_000) req.destroy();
      });
      req.on('end', () => {
        try {
          handleEvent(JSON.parse(body), res);
        } catch {
          res.writeHead(400).end();
        }
      });
    })
    .on('error', (err) => {
      // Right after a restart the previous widget may still hold the port for a moment.
      if (err.code === 'EADDRINUSE' && attempt < 10) {
        server.close();
        setTimeout(() => startServer(attempt + 1), 1000);
      } else {
        console.error('Servidor do widget:', err.message);
      }
    })
    .listen(PORT, '127.0.0.1');
}

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

function placeWindow() {
  const area = screen.getDisplayNearestPoint(anchor).workArea;
  const width = Math.min(size.width, area.width);
  const height = Math.min(size.height, area.height);
  // Windows ignores size changes on non-resizable windows, so unlock just for this call.
  win.setResizable(true);
  win.setBounds({
    // If the open panel does not fit above/left of the anchor, slide the whole widget back on screen.
    x: Math.round(clamp(anchor.x - width, area.x, area.x + area.width - width)),
    y: Math.round(clamp(anchor.y - height, area.y, area.y + area.height - height)),
    width,
    height,
  });
  win.setResizable(false);
}

function createWindow() {
  win = new BrowserWindow({
    width: 360,
    height: 100,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.setAlwaysOnTop(true, 'floating');
  // macOS: follow the user across Spaces and over full-screen apps.
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const area = screen.getPrimaryDisplay().workArea;
  anchor = { x: area.x + area.width - MARGIN, y: area.y + area.height - MARGIN };
  placeWindow();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', push);
}

ipcMain.on('resize', (_e, { width, height }) => {
  size = { width: Math.ceil(width), height: Math.ceil(height) };
  placeWindow();
});

// Drag the floating button: the renderer sends the pointer offset since the drag started.
ipcMain.on('drag', (_e, { phase, dx, dy }) => {
  if (phase === 'start') {
    const b = win.getBounds();
    dragFrom = { x: b.x + b.width, y: b.y + b.height };
  } else if (phase === 'move' && dragFrom) {
    anchor = { x: dragFrom.x + dx, y: dragFrom.y + dy };
    placeWindow();
  } else if (phase === 'end' && dragFrom) {
    // Keep the anchor where the widget actually landed after clamping.
    const b = win.getBounds();
    anchor = { x: b.x + b.width, y: b.y + b.height };
    dragFrom = null;
  }
});

ipcMain.on('set-muted', (_e, value) => {
  muted = value === true;
});

// Minimize = hide the widget; the tray icon (next to the clock) brings it back.
ipcMain.on('minimize', () => win.hide());

// The renderer draws the Atlas robot to a PNG; it becomes the tray icon.
ipcMain.on('set-icon', (_e, dataUrl) => {
  if (tray || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) return;
  const img = nativeImage.createFromDataURL(dataUrl);
  if (process.platform === 'darwin') {
    // Menu bar icons are 18pt; @2x keeps it sharp on Retina. setIcon does not exist on macOS.
    tray = new Tray(nativeImage.createFromBuffer(img.resize({ width: 36, height: 36 }).toPNG(), { scaleFactor: 2 }));
  } else {
    win.setIcon(img);
    tray = new Tray(img.resize({ width: 32, height: 32 }));
  }
  tray.setToolTip('Robô Peão');
  tray.on('click', () => (win.isVisible() ? win.hide() : win.show()));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Mostrar widget', click: () => win.show() },
      { label: 'Abrir ao ligar o computador', type: 'checkbox', checked: isAutostart(), click: (item) => setAutostart(item.checked) },
      { label: 'Minimizar', click: () => win.hide() },
      { type: 'separator' },
      { label: 'Sair', click: () => app.quit() },
    ]),
  );
});

ipcMain.on('decide', (_e, { sessionId, requestId, choice, message }) => {
  const h = held.get(sessionId);
  if (!h || h.requestId !== requestId) {
    // The relay already gave up (timeout) or the prompt was answered elsewhere: Claude Code shows its own dialog.
    log(`decide ${String(sessionId).slice(0, 8)} ${choice}: pedido não está mais esperando`);
    const s = state.sessions.get(sessionId);
    if (s?.pending) s.pending = { ...s.pending, requestId: null, expired: true };
    return push();
  }
  const decision = buildDecision(choice, message, h.suggestions);
  if (!decision) return;
  release(sessionId, decision, `clique: ${choice}`);
  applyEvent(state, { hook_event_name: 'PostToolUse', session_id: sessionId });
  push();
});

ipcMain.on('quit', () => app.quit());

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('Robô Peão');
    // macOS: menu bar app only, like skipTaskbar on Windows.
    if (process.platform === 'darwin') app.dock.hide();
    writeToken();
    autostartFirstRun();
    startServer();
    createWindow();
    setInterval(() => {
      prune(state);
      push();
    }, 30_000);
  });
  app.on('window-all-closed', () => app.quit());
}
