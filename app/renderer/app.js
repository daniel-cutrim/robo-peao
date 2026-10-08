const root = document.getElementById('root');
// seen: session id -> finishedAt the user already saw (closing the panel marks every "pronto" as seen)
// Toggles remembered between runs (best effort: without storage they last until the widget closes).
function loadPref(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}
function savePref(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // sem storage
  }
}

// drafts: session id -> text typed in "negar dizendo o que fazer"
// bubbles: session id -> { text, until } speech bubble on screen; lastSpoke: session id -> when it last spoke
const ui = {
  sessions: [], open: false, expanded: null, drag: null, seen: new Map(), drafts: {},
  muted: loadPref('muted', false), speech: loadPref('speech', true), bubbles: {}, lastSpoke: {}, recentLines: [],
};

function setMuted(muted) {
  ui.muted = muted;
  savePref('muted', muted);
  window.robots.setMuted(muted);
}

const SPEAK_EVERY_MS = 2 * 60 * 1000;
const BUBBLE_MS = 7000;

// Each robot that keeps working gets a line every 2 minutes; recent lines are not repeated.
function pickLine() {
  const pool = window.FALAS.filter((l) => !ui.recentLines.includes(l));
  const line = pool[Math.floor(Math.random() * pool.length)];
  ui.recentLines = [...ui.recentLines, line].slice(-30);
  return line;
}

function speechTick() {
  const now = Date.now();
  let changed = false;
  for (const id of Object.keys(ui.bubbles)) {
    if (ui.bubbles[id].until <= now) {
      delete ui.bubbles[id];
      changed = true;
    }
  }
  for (const s of ui.sessions) {
    if (view(s) !== 'working') {
      delete ui.lastSpoke[s.id];
      continue;
    }
    ui.lastSpoke[s.id] ??= Math.max(s.startedAt || now, now - SPEAK_EVERY_MS + 15000);
    if (ui.speech && now - ui.lastSpoke[s.id] >= SPEAK_EVERY_MS) {
      ui.lastSpoke[s.id] = now;
      ui.bubbles[s.id] = { text: pickLine(), until: now + BUBBLE_MS };
      changed = true;
    }
  }
  if (changed) render();
}
const DRAG_THRESHOLD = 4;

// What the user sees. The eyes and the badge carry the status; no blue (it vanishes on the navy background).
const EYES = { working: '#FFFFFF', needs: '#FF9F1C', ready: '#3DDC84', parked: window.EYE_OFF };
const SUB_EYE = { running: '#FFFFFF', done: '#3DDC84' };
const CHECK = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CHEVRON = '<svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E98B0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const BELL = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
const BELL_OFF = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7M10.3 21a1.94 1.94 0 0 0 3.4 0M2 2l20 20"/></svg>';
const TALK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H10l-5 4v-4H4z"/></svg>';
const TALK_OFF = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5h12v11h-2M14 16h-4l-5 4v-4H4V5M2 2l20 20"/></svg>';
const MINIMIZE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>';
const CLOSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

// Everything that comes from hooks goes through esc() before touching the HTML.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function ago(ts) {
  const min = Math.floor((Date.now() - ts) / 60000);
  return min < 1 ? 'agora' : `há ${min} min`;
}

function since(ts) {
  const min = Math.floor((Date.now() - ts) / 60000);
  return min < 1 ? 'menos de 1 min' : `${min} min`;
}

const clock = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// working: trabalhando · needs: precisa de você · ready: terminou e você ainda não viu · parked: parado
function view(s) {
  if (s.status === 'running') return 'working';
  if (s.status === 'waiting') return 'needs';
  if (s.status === 'done' && ui.seen.get(s.id) !== s.finishedAt) return 'ready';
  return 'parked';
}

function markSeen() {
  for (const s of ui.sessions) if (s.status === 'done') ui.seen.set(s.id, s.finishedAt);
}

function badge(v) {
  if (v === 'working') return '<span class="badge working" aria-hidden="true"></span>';
  if (v === 'needs') return '<span class="badge needs" aria-hidden="true">!</span>';
  if (v === 'ready') return `<span class="badge ready" aria-hidden="true">${CHECK}</span>`;
  return '';
}

function statusLine(s, v) {
  if (v === 'needs') return s.pending ? `Precisa de você: ${s.pending.action}` : 'Precisa de você';
  if (v === 'ready') return `Pronto · terminou ${s.finishedAt ? ago(s.finishedAt) : ''}`;
  if (v === 'parked') return s.finishedAt ? `Parado · terminou ${ago(s.finishedAt)}` : 'Parado';
  return s.action || 'Trabalhando';
}

function summary(sessions) {
  const count = (v) => sessions.filter((s) => view(s) === v).length;
  const needs = count('needs');
  const working = count('working');
  const ready = count('ready');
  return [
    needs && { v: 'needs', text: `${needs} ${needs === 1 ? 'precisa' : 'precisam'} de você` },
    working && { v: 'working', text: `${working} trabalhando` },
    ready && { v: 'ready', text: `${ready} ${ready === 1 ? 'pronto' : 'prontos'}` },
  ].filter(Boolean);
}

// Approval options. Only what the PermissionRequest hook can answer; anything else points to Claude Code.
function askHTML(s) {
  const p = s.pending;
  if (!p.requestId) {
    const hint = p.expired ? 'O widget parou de esperar. Responda na janela do Claude Code.' : 'Responda na janela do Claude Code.';
    return `<div class="ask"><code>${esc(p.action)}</code><span class="hint">${hint}</span></div>`;
  }
  const ids = `data-id="${esc(s.id)}" data-req="${esc(p.requestId)}"`;
  const always = p.always
    ? `<button class="btn always" data-decide="allow-always" ${ids}>Sempre permitir</button>`
    : '';
  const alwaysNote = p.always ? `<span class="hint">"Sempre permitir" libera <b>${esc(p.always)}</b> sem perguntar de novo.</span>` : '';
  const why = `why-${esc(s.id)}`;
  return `<div class="ask">
    <code>${esc(p.action)}</code>
    <div class="ask-buttons">
      <button class="btn allow" data-decide="allow" ${ids}>Aprovar</button>${always}
      <button class="btn deny" data-decide="deny" ${ids}>Negar</button>
    </div>${alwaysNote}
    <div class="deny-why">
      <label for="${why}">Ou negue dizendo o que fazer:</label>
      <div class="deny-row">
        <input id="${why}" data-why="${esc(s.id)}" value="${esc(ui.drafts[s.id] || '')}" placeholder="ex.: rode só os testes de auth" autocomplete="off">
        <button class="btn deny" data-decide="deny" data-with-message ${ids}>Enviar</button>
      </div>
    </div>
  </div>`;
}

function agentHTML(s) {
  const open = ui.expanded === s.id;
  const v = view(s);
  const bar = v === 'working' && s.progress
    ? `<div class="bar-row"><div class="bar"><div style="width:${Math.round((s.progress.done / s.progress.total) * 100)}%"></div></div><span class="step">${s.progress.done}/${s.progress.total}</span></div>`
    : '';

  // Collapsed row: the running drones peek out next to the status, so subagents show without expanding.
  const busy = s.subagents.filter((a) => a.status !== 'done');
  const drones = !open && busy.length
    ? `<span class="row-drones">${busy.slice(0, 4).map(() => robotSVG('drone', 20, SUB_EYE.running)).join('')}<span>${busy.length} ${busy.length === 1 ? 'drone' : 'drones'} trabalhando</span></span>`
    : '';

  let detail = '';
  if (open) {
    const ask = s.status === 'waiting' && s.pending ? askHTML(s) : '';
    const subs = s.subagents.length
      ? `<div class="subs-title">Drones (subagentes)</div>${s.subagents
          .map((a) => `<div class="sub"><div class="robot-box">${robotSVG('drone', 30, SUB_EYE[a.status] || SUB_EYE.running)}</div><div class="info"><span class="sub-name">${esc(a.type)}</span><span class="sub-action">${esc(a.action || '—')}</span></div><span class="sub-status ${a.status === 'done' ? 'done' : 'running'}">${a.status === 'done' ? 'pronto' : 'trabalhando'}</span></div>`)
          .join('')}`
      : '';
    const meta = `<div class="meta"><span title="${esc(s.cwd)}">${esc(s.cwd || s.project)}</span>${
      s.startedAt && v === 'working' ? `<span>trabalhando há ${since(s.startedAt)}</span>` : ''
    }</div>`;
    const history = s.history.length
      ? `<div class="subs-title">Últimas ações</div><ol class="history">${[...s.history]
          .reverse()
          .map((h) => `<li><span class="h-action">${esc(h.action)}</span><span class="h-time">${clock(h.at)}</span></li>`)
          .join('')}</ol>`
      : '';
    detail = `<div class="detail">${ask}${meta}${history}${subs}</div>`;
  }

  return `<div class="agent ${v} ${open ? 'open' : ''}">
    <button class="agent-row" data-toggle="${esc(s.id)}" aria-expanded="${open}">
      <span class="robot-box">${robotSVG(s.robot, 56, EYES[v])}${badge(v)}</span>
      <span class="info">
        <span class="title"><span class="name">${esc(s.name)}</span><span class="project">${esc(s.project)}</span></span>
        <span class="status">${esc(statusLine(s, v))}</span>${bar}${drones}${ui.bubbles[s.id] ? `<span class="row-bubble">${esc(ui.bubbles[s.id].text)}</span>` : ''}
      </span>
      ${CHEVRON}
    </button>${detail}
  </div>`;
}

function render() {
  if (ui.drag) return; // replacing the button mid-drag would drop the pointer capture; endDrag renders
  // Re-rendering while the user types would wipe the field and its focus; the blur handler renders.
  if (document.activeElement?.matches?.('[data-why]')) return;
  const sessions = ui.sessions;
  const parts = summary(sessions);
  const idleText = sessions.length ? 'Tudo parado' : 'Nenhum agente';

  const panel = ui.open
    ? `<section class="panel" aria-label="Agentes">
        <div class="panel-head"><h1>Agentes</h1><span class="summary">${parts.map((p) => `<span class="${p.v}">${p.text}</span>`).join(' · ') || idleText}</span></div>
        <div class="list">${sessions.length ? sessions.map(agentHTML).join('') : '<div class="empty">Nenhum agente aberto. Inicie o Claude Code com os hooks instalados.</div>'}</div>
      </section>`
    : '';

  const heads = sessions.length
    ? sessions.slice(0, 5).map((s) => `<span class="head">${robotSVG(s.robot, 40, EYES[view(s)])}${badge(view(s))}</span>`).join('')
    : `<span class="head ghost">${robotSVG('atlas', 40, window.EYE_OFF)}</span>`;
  const title = parts[0] ? parts[0].text : idleText;
  const titleClass = parts[0] ? parts[0].v : '';
  const sub = parts.slice(1).map((p) => p.text).join(' · ') || (sessions.length ? `${sessions.length} ${sessions.length === 1 ? 'sessão' : 'sessões'}` : 'Abra o Claude Code');

  // With the panel closed, the newest line floats above the button.
  const talker = !ui.open && sessions.filter((s) => ui.bubbles[s.id]).sort((a, b) => ui.bubbles[b.id].until - ui.bubbles[a.id].until)[0];
  const floating = talker
    ? `<div class="bubble" role="status">${esc(ui.bubbles[talker.id].text)}</div>`
    : '';

  root.innerHTML = `${panel}${floating}
    <div class="fab-wrap">
      <button class="fab" data-fab aria-label="${ui.open ? 'Fechar' : 'Abrir'} painel de agentes (arraste para mover)" aria-expanded="${ui.open}">
        <span class="heads">${heads}</span>
        <span class="fab-text"><span class="fab-title ${titleClass}">${title}</span><span class="fab-sub">${sub}</span></span>
      </button>
      <div class="fab-controls">
        <button class="mini-btn ${ui.speech ? '' : 'off'}" data-speech aria-pressed="${ui.speech}" aria-label="${ui.speech ? 'Desligar as falas dos robôs' : 'Ligar as falas dos robôs'}" title="${ui.speech ? 'Falas dos robôs ligadas' : 'Falas dos robôs desligadas'}">${ui.speech ? TALK : TALK_OFF}</button>
        <button class="mini-btn ${ui.muted ? 'muted' : ''}" data-mute aria-pressed="${ui.muted}" aria-label="${ui.muted ? 'Ativar notificações' : 'Silenciar notificações'}" title="${ui.muted ? 'Notificações silenciadas' : 'Silenciar notificações'}">${ui.muted ? BELL_OFF : BELL}</button>
        <button class="mini-btn" data-minimize aria-label="Minimizar para a área de notificação" title="Minimizar">${MINIMIZE}</button>
        <button class="mini-btn" data-quit aria-label="Fechar o widget" title="Fechar">${CLOSE}</button>
      </div>
    </div>`;

  requestAnimationFrame(() => {
    const r = root.getBoundingClientRect();
    window.robots.resize(r.width + 32, r.height + 32);
  });
}

root.addEventListener('click', (e) => {
  const el = e.target.closest('button');
  if (!el) return;
  // Resizing the window under the cursor makes Windows deliver the click again as a double click
  // (detail 2); acting on it would undo the first click (close what just opened).
  if (e.detail > 1) return;
  if (el.hasAttribute('data-fab')) {
    // Chromium still fires a click at the end of a drag; swallow that one.
    if (ui.dragged) {
      ui.dragged = false;
      return;
    }
    if (ui.open) markSeen();
    ui.open = !ui.open;
  } else if (el.hasAttribute('data-mute')) setMuted(!ui.muted);
  else if (el.hasAttribute('data-speech')) {
    ui.speech = !ui.speech;
    savePref('speech', ui.speech);
    if (!ui.speech) ui.bubbles = {};
  }
  else if (el.hasAttribute('data-minimize')) return window.robots.minimize();
  else if (el.hasAttribute('data-quit')) return window.robots.quit();
  else if (el.dataset.toggle) ui.expanded = ui.expanded === el.dataset.toggle ? null : el.dataset.toggle;
  else if (el.dataset.decide) decide(el);
  render();
});

function decide(el) {
  const id = el.dataset.id;
  const message = el.hasAttribute('data-with-message') ? ui.drafts[id] : undefined;
  if (el.hasAttribute('data-with-message') && !message?.trim()) return document.getElementById(`why-${id}`)?.focus();
  delete ui.drafts[id];
  window.robots.decide(id, el.dataset.req, el.dataset.decide, message);
}

root.addEventListener('input', (e) => {
  if (e.target.dataset.why) ui.drafts[e.target.dataset.why] = e.target.value;
});
root.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.dataset.why) {
    e.preventDefault();
    const send = e.target.closest('.deny-row').querySelector('[data-with-message]');
    e.target.blur();
    decide(send);
    render();
  }
});
root.addEventListener('focusout', (e) => {
  // Moving focus to a button (e.g. "Enviar") must not re-render before its click lands; the click renders.
  if (e.target.dataset?.why && !e.relatedTarget?.closest?.('button')) setTimeout(render, 0);
});

// Dragging the floating button moves the window; a plain click (handled above) toggles the panel.
root.addEventListener('pointerdown', (e) => {
  const fab = e.target.closest('[data-fab]');
  if (!fab || e.button !== 0) return;
  ui.dragged = false;
  fab.setPointerCapture(e.pointerId);
  ui.drag = { x: e.screenX, y: e.screenY, moved: false };
  window.robots.drag('start');
});

root.addEventListener('pointermove', (e) => {
  if (!ui.drag) return;
  const dx = e.screenX - ui.drag.x;
  const dy = e.screenY - ui.drag.y;
  if (!ui.drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  ui.drag.moved = true;
  window.robots.drag('move', dx, dy);
});

function endDrag() {
  if (!ui.drag) return;
  const { moved } = ui.drag;
  ui.drag = null;
  ui.dragged = moved;
  window.robots.drag('end');
  // Re-render only after a real drag (state may have changed meanwhile); a plain press must keep the
  // same button in the DOM so its click event still lands.
  if (moved) render();
}
root.addEventListener('pointerup', endDrag);
root.addEventListener('pointercancel', endDrag);

// Taskbar icon: the Atlas robot drawn to a PNG (the SVG needs the gradient defs inlined to stand alone).
function setTaskbarIcon() {
  const defs = document.querySelector('#rb-defs defs').outerHTML;
  const svg = robotSVG('atlas', 236).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('aria-hidden="true">', `aria-hidden="true">${defs}`);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    canvas.getContext('2d').drawImage(img, 10, 0, 236, 256);
    window.robots.setIcon(canvas.toDataURL('image/png'));
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

window.robots.onState((sessions) => {
  const before = new Set(ui.sessions.filter((s) => s.status === 'waiting').map((s) => s.id));
  ui.sessions = sessions;
  // A new approval request opens the panel on that agent.
  const fresh = sessions.find((s) => s.status === 'waiting' && !before.has(s.id));
  if (fresh) {
    ui.open = true;
    ui.expanded = fresh.id;
  }
  render();
});

setInterval(render, 30_000);
setInterval(speechTick, 5000);
render();
setTaskbarIcon();
window.robots.setMuted(ui.muted);
