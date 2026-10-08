// Turns Claude Code hook events into the widget state. No Electron here, so it runs under `node --test`.

const ROBOTS = ['atlas', 'cora', 'bronze', 'grafite'];
const ROBOT_NAMES = { atlas: 'Atlas', cora: 'Cora', bronze: 'Bronze', grafite: 'Grafite' };
const STALE_MS = 30 * 60 * 1000;
const HISTORY_SIZE = 6;

function robotFor(sessionId) {
  let h = 0;
  for (const c of String(sessionId)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ROBOTS[h % ROBOTS.length];
}

function baseName(p) {
  return String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';
}

function describeTool(name, input) {
  const i = input || {};
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  if (i.file_path) return `${name} ${baseName(i.file_path)}`;
  if (i.command) return `${name} ${cut(String(i.command), 60)}`;
  if (i.url) {
    try { return `${name} ${new URL(i.url).host}`; } catch { return name; }
  }
  if (i.query) return `${name} ${cut(String(i.query), 50)}`;
  if (i.pattern) return `${name} ${cut(String(i.pattern), 40)}`;
  if (i.description) return `${name} ${cut(String(i.description), 50)}`;
  return name;
}

// Tools that need a real answer from the user (not yes/no): the widget only points to Claude Code.
const INTERACTIVE_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode']);

// "Sempre permitir" label from the hook's permission_suggestions (only addRules/allow are offered).
function alwaysLabel(suggestions) {
  if (!Array.isArray(suggestions)) return null;
  const rules = suggestions
    .filter((s) => s && s.type === 'addRules' && s.behavior === 'allow' && Array.isArray(s.rules))
    .flatMap((s) => s.rules)
    .map((r) => (r.ruleContent ? `${r.toolName}(${r.ruleContent})` : r.toolName))
    .filter(Boolean);
  return rules.length ? rules.join(', ') : null;
}

function createState() {
  return { sessions: new Map() };
}

function getSession(state, ev, now) {
  let s = state.sessions.get(ev.session_id);
  if (!s) {
    const robot = robotFor(ev.session_id);
    s = {
      id: ev.session_id,
      robot,
      name: ROBOT_NAMES[robot],
      project: baseName(ev.cwd),
      cwd: ev.cwd || '',
      status: 'idle',
      startedAt: null,
      history: [],
      action: '',
      progress: null,
      pending: null,
      subagents: new Map(),
      updatedAt: now,
    };
    state.sessions.set(ev.session_id, s);
  }
  if (ev.cwd && !s.project) s.project = baseName(ev.cwd);
  if (ev.cwd && !s.cwd) s.cwd = ev.cwd;
  s.updatedAt = now;
  return s;
}

// Returns { notify } when the event deserves an OS notification, else {}.
function applyEvent(state, ev, now = Date.now()) {
  if (!ev || !ev.session_id || !ev.hook_event_name) return {};
  const type = ev.hook_event_name;

  if (type === 'SessionEnd') {
    state.sessions.delete(ev.session_id);
    return {};
  }

  const s = getSession(state, ev, now);
  // A drone is created by whichever of its events arrives first: SubagentStart can be missed (widget opened
  // mid-run) and background subagents keep working after the main Stop marked them done.
  let sub = ev.agent_id ? s.subagents.get(ev.agent_id) : null;
  if (ev.agent_id && type !== 'SubagentStop') {
    sub ??= { id: ev.agent_id, type: ev.agent_type || 'subagente', action: '' };
    sub.status = 'running';
    s.subagents.set(ev.agent_id, sub);
    if (s.status === 'done') waitDrones(s);
  }

  const finish = () => {
    s.status = 'done';
    s.action = '';
    s.pending = null;
    s.finishedAt = now;
    s.waitingDrones = false;
    return { notify: { title: `${s.name} terminou`, body: s.project } };
  };

  switch (type) {
    case 'SessionStart':
      break;
    case 'UserPromptSubmit':
      s.status = 'running';
      s.action = 'Pensando…';
      s.startedAt = now;
      s.history = [];
      s.waitingDrones = false;
      for (const [id, a] of s.subagents) if (a.status === 'done') s.subagents.delete(id);
      break;
    case 'PreToolUse': {
      const action = describeTool(ev.tool_name, ev.tool_input);
      if (sub) {
        sub.action = action;
      } else {
        s.status = 'running';
        s.action = action;
        s.pending = null;
        s.waitingDrones = false;
        s.history = [...s.history, { action, at: now }].slice(-HISTORY_SIZE);
      }
      if (ev.tool_name === 'TodoWrite' && Array.isArray(ev.tool_input?.todos) && ev.tool_input.todos.length) {
        const todos = ev.tool_input.todos;
        s.progress = { done: todos.filter((t) => t.status === 'completed').length, total: todos.length };
      }
      break;
    }
    case 'PostToolUse':
      if (!sub) {
        s.status = 'running';
        s.pending = null;
      }
      break;
    case 'PermissionRequest': {
      const interactive = INTERACTIVE_TOOLS.has(ev.tool_name);
      s.status = 'waiting';
      s.pending = {
        requestId: interactive ? null : ev.request_id || null,
        action: interactive ? 'Tem uma pergunta pra você' : describeTool(ev.tool_name, ev.tool_input),
        always: interactive ? null : alwaysLabel(ev.permission_suggestions),
      };
      return { notify: { title: `${s.name} precisa de você`, body: `${s.project}: ${s.pending.action}` } };
    }
    case 'Notification':
      if (ev.notification_type === 'permission_prompt' && s.status !== 'waiting') {
        s.status = 'waiting';
        s.pending = s.pending || { requestId: null, action: ev.message || 'Pedido de permissão', always: null };
        return { notify: { title: `${s.name} precisa de você`, body: `${s.project}: ${s.pending.action}` } };
      }
      break;
    case 'SubagentStart':
      break;
    case 'SubagentStop':
      if (sub) {
        sub.status = 'done';
        sub.action = '';
      }
      if (s.waitingDrones && !hasBusyDrones(s)) return finish();
      break;
    case 'Stop':
      if (s.status === 'idle') break;
      // ponytail: a drone whose SubagentStop never comes keeps the session "working" until the 30 min prune.
      if (hasBusyDrones(s)) {
        waitDrones(s);
        break;
      }
      return finish();
  }
  return {};
}

const hasBusyDrones = (s) => [...s.subagents.values()].some((a) => a.status === 'running');

// The main agent ended its turn but background subagents are still at it: not done yet.
function waitDrones(s) {
  s.status = 'running';
  s.action = 'Esperando os drones…';
  s.pending = null;
  s.waitingDrones = true;
}

function prune(state, now = Date.now()) {
  for (const [id, s] of state.sessions) {
    if (s.status !== 'running' && now - s.updatedAt > STALE_MS) state.sessions.delete(id);
  }
}

// Plain JSON for the renderer.
function snapshot(state) {
  return [...state.sessions.values()].map((s) => ({
    id: s.id,
    robot: s.robot,
    name: s.name,
    project: s.project,
    cwd: s.cwd,
    status: s.status,
    startedAt: s.startedAt,
    history: s.history,
    action: s.action,
    progress: s.progress,
    pending: s.pending,
    finishedAt: s.finishedAt || null,
    subagents: [...s.subagents.values()],
  }));
}

module.exports = { createState, applyEvent, prune, snapshot, describeTool, robotFor, INTERACTIVE_TOOLS };
