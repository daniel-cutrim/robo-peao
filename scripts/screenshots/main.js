// Renders the widget offscreen with demo data and saves README images to docs/images.
//   npm run screenshots
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createState, applyEvent, snapshot, robotFor } = require('../../app/state');

const OUT = path.join(__dirname, '..', '..', 'docs', 'images');

// Session ids whose hash gives each robot, so the demo shows the whole cast.
function idFor(robot, prefix) {
  for (let i = 0; ; i++) if (robotFor(`${prefix}-${i}`) === robot) return `${prefix}-${i}`;
}

function demoSessions() {
  const st = createState();
  const t = Date.now();
  const ev = (id, cwd, type, extra = {}, at = t) => applyEvent(st, { session_id: id, cwd, hook_event_name: type, ...extra }, at);

  const loja = idFor('atlas', 'loja');
  ev(loja, '~/projetos/loja-online', 'UserPromptSubmit', {}, t - 6 * 60000);
  ev(loja, '', 'PreToolUse', { tool_name: 'TodoWrite', tool_input: { todos: [{ status: 'completed' }, { status: 'completed' }, { status: 'in_progress' }, { status: 'pending' }] } }, t - 5 * 60000);
  ev(loja, '', 'PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'src/api/routes.ts' } }, t - 4 * 60000);
  ev(loja, '', 'PreToolUse', { tool_name: 'Grep', tool_input: { pattern: 'createSession' } }, t - 3 * 60000);
  ev(loja, '', 'SubagentStart', { agent_id: 'd1', agent_type: 'Explore' });
  ev(loja, '', 'SubagentStop', { agent_id: 'd1' });
  ev(loja, '', 'SubagentStart', { agent_id: 'd2', agent_type: 'test-engineer' });
  ev(loja, '', 'PreToolUse', { agent_id: 'd2', tool_name: 'Bash', tool_input: { command: 'npm test -- auth' } });
  ev(loja, '', 'PreToolUse', { tool_name: 'Edit', tool_input: { file_path: 'src/api/auth.ts' } }, t - 40000);

  const api = idFor('bronze', 'api');
  ev(api, '~/projetos/api-pagamentos', 'UserPromptSubmit', {}, t - 2 * 60000);
  ev(api, '', 'PermissionRequest', {
    request_id: 'demo',
    tool_name: 'Bash',
    tool_input: { command: 'npm run migrate -- --env=staging' },
    permission_suggestions: [{ type: 'addRules', behavior: 'allow', destination: 'localSettings', rules: [{ toolName: 'Bash', ruleContent: 'npm run migrate:*' }] }],
  });

  const blog = idFor('cora', 'blog');
  ev(blog, '~/projetos/blog', 'UserPromptSubmit', {}, t - 9 * 60000);
  ev(blog, '', 'Stop', {}, t - 60000);

  const docs = idFor('grafite', 'docs');
  ev(docs, '~/projetos/docs', 'SessionStart');

  return { sessions: snapshot(st), ids: { loja, api, blog, docs } };
}

async function shoot(win, name, setup) {
  await win.webContents.executeJavaScript(`(() => { ${setup}; render(); })()`);
  await new Promise((r) => setTimeout(r, 400));
  const rect = await win.webContents.executeJavaScript(
    `(() => { const r = document.getElementById('root').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`,
  );
  const pad = 24;
  const crop = {
    x: Math.max(0, Math.floor(rect.x - pad)),
    y: Math.max(0, Math.floor(rect.y - pad)),
    width: Math.ceil(rect.width + pad * 2),
    height: Math.ceil(rect.height + pad * 2),
  };
  const img = await win.webContents.capturePage(crop);
  fs.writeFileSync(path.join(OUT, `${name}.png`), img.toPNG());
  console.log(`docs/images/${name}.png`);
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { sessions, ids } = demoSessions();
  const width = 760;
  const height = 740;
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true, preload: path.join(__dirname, 'preload.js') },
  });
  await win.loadFile(path.join(__dirname, '..', '..', 'app', 'renderer', 'index.html'));
  win.webContents.setZoomFactor(1); // Chromium remembers zoom per page; never inherit an old one
  // The OS caps window height at the screen height; keep the open panel short enough to fit.
  await win.webContents.insertCSS('.panel { max-height: 520px !important; }');
  win.webContents.send('state', sessions);
  await new Promise((r) => setTimeout(r, 600));

  const reset = `ui.open = false; ui.expanded = null; ui.bubbles = {}; document.querySelector('.fab-wrap')?.classList.remove('show-controls')`;
  await shoot(win, 'botao', reset);
  await shoot(win, 'botao-controles', `${reset}; document.body.classList.add('force-controls')`);
  await shoot(win, 'fala', `${reset}; document.body.classList.remove('force-controls'); ui.bubbles['${ids.loja}'] = { text: 'Tô que nem o Rocky Balboa: só tomando porrada e levantando.', until: Date.now() + 60000 }`);
  await shoot(win, 'painel', `${reset}; ui.open = true; ui.expanded = '${ids.loja}'; ui.bubbles['${ids.loja}'] = { text: 'Esse escopo cresce mais que massa de pão esquecida no forno.', until: Date.now() + 60000 }`);
  await shoot(win, 'aprovacao', `${reset}; ui.open = true; ui.expanded = '${ids.api}'`);
  await shoot(
    win,
    'elenco',
    `ui.open = false; render = () => {}; document.getElementById('root').innerHTML = '<div style="display:flex;gap:28px;align-items:flex-end;padding:8px">' + ['atlas','cora','bronze','grafite'].map(k => robotSVG(k, 120)).join('') + robotSVG('drone', 96, '#FFFFFF') + '</div>'`,
  );
  app.quit();
});
