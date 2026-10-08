const test = require('node:test');
const assert = require('node:assert/strict');
const { createState, applyEvent, prune, snapshot, describeTool } = require('./state');

const base = { session_id: 's1', cwd: 'C:\\proj\\meu-app' };
const ev = (hook_event_name, extra = {}) => ({ ...base, hook_event_name, ...extra });

test('ciclo de vida de uma sessão', () => {
  const st = createState();
  applyEvent(st, ev('SessionStart'));
  let [s] = snapshot(st);
  assert.equal(s.status, 'idle');
  assert.equal(s.project, 'meu-app');

  applyEvent(st, ev('UserPromptSubmit'));
  applyEvent(st, ev('PreToolUse', { tool_name: 'Edit', tool_input: { file_path: 'C:\\proj\\meu-app\\src\\auth.ts' } }));
  [s] = snapshot(st);
  assert.equal(s.status, 'running');
  assert.equal(s.action, 'Edit auth.ts');

  const out = applyEvent(st, ev('Stop'));
  [s] = snapshot(st);
  assert.equal(s.status, 'done');
  assert.ok(out.notify.title.endsWith('terminou'));

  applyEvent(st, ev('SessionEnd'));
  assert.equal(snapshot(st).length, 0);
});

test('Stop sem trabalho não notifica', () => {
  const st = createState();
  applyEvent(st, ev('SessionStart'));
  assert.deepEqual(applyEvent(st, ev('Stop')), {});
});

test('subagentes recebem as próprias ferramentas', () => {
  const st = createState();
  applyEvent(st, ev('UserPromptSubmit'));
  applyEvent(st, ev('PreToolUse', { tool_name: 'Read', tool_input: { file_path: '/a/main.ts' } }));
  applyEvent(st, ev('SubagentStart', { agent_id: 'a1', agent_type: 'Explore' }));
  applyEvent(st, ev('PreToolUse', { agent_id: 'a1', tool_name: 'Grep', tool_input: { pattern: 'login' } }));
  let [s] = snapshot(st);
  assert.equal(s.action, 'Read main.ts');
  assert.equal(s.subagents[0].action, 'Grep login');
  assert.equal(s.subagents[0].status, 'running');

  applyEvent(st, ev('SubagentStop', { agent_id: 'a1' }));
  [s] = snapshot(st);
  assert.equal(s.subagents[0].status, 'done');
});

test('drones sem SubagentStart, em segundo plano e limpos no próximo pedido', () => {
  const st = createState();
  applyEvent(st, ev('UserPromptSubmit'));
  applyEvent(st, ev('PreToolUse', { agent_id: 'bg', agent_type: 'Explore', tool_name: 'Grep', tool_input: { pattern: 'x' } }));
  let [s] = snapshot(st);
  assert.equal(s.subagents[0].type, 'Explore');
  assert.equal(s.subagents[0].status, 'running');

  applyEvent(st, ev('Stop'));
  applyEvent(st, ev('PreToolUse', { agent_id: 'bg', tool_name: 'Read', tool_input: { file_path: '/a/b.ts' } }));
  [s] = snapshot(st);
  assert.equal(s.subagents[0].status, 'running');

  applyEvent(st, ev('SubagentStop', { agent_id: 'bg' }));
  applyEvent(st, ev('SubagentStop', { agent_id: 'desconhecido' }));
  applyEvent(st, ev('UserPromptSubmit'));
  [s] = snapshot(st);
  assert.equal(s.subagents.length, 0);
});

test('agente com drone trabalhando não fica pronto no Stop', () => {
  const st = createState();
  applyEvent(st, ev('UserPromptSubmit'));
  applyEvent(st, ev('SubagentStart', { agent_id: 'bg', agent_type: 'general-purpose' }));
  assert.deepEqual(applyEvent(st, ev('Stop')), {});
  let [s] = snapshot(st);
  assert.equal(s.status, 'running');
  assert.equal(s.action, 'Esperando os drones…');

  const out = applyEvent(st, ev('SubagentStop', { agent_id: 'bg' }));
  [s] = snapshot(st);
  assert.equal(s.status, 'done');
  assert.match(out.notify.title, /terminou/);
});

test('pedido de permissão e retomada', () => {
  const st = createState();
  applyEvent(st, ev('UserPromptSubmit'));
  const out = applyEvent(st, ev('PermissionRequest', { request_id: 'r1', tool_name: 'Bash', tool_input: { command: 'vercel deploy --prod' } }));
  let [s] = snapshot(st);
  assert.equal(s.status, 'waiting');
  assert.deepEqual(s.pending, { requestId: 'r1', action: 'Bash vercel deploy --prod', always: null });
  assert.ok(out.notify);

  applyEvent(st, ev('PostToolUse', { tool_name: 'Bash' }));
  [s] = snapshot(st);
  assert.equal(s.status, 'running');
  assert.equal(s.pending, null);
});

test('histórico guarda as últimas ações do pedido atual', () => {
  const st = createState();
  applyEvent(st, ev('UserPromptSubmit'), 1000);
  for (let i = 1; i <= 8; i++) applyEvent(st, ev('PreToolUse', { tool_name: 'Read', tool_input: { file_path: `/a/f${i}.ts` } }), 1000 + i);
  let [s] = snapshot(st);
  assert.equal(s.history.length, 6);
  assert.equal(s.history.at(-1).action, 'Read f8.ts');
  assert.equal(s.startedAt, 1000);

  applyEvent(st, ev('UserPromptSubmit'), 5000);
  [s] = snapshot(st);
  assert.equal(s.history.length, 0);
});

test('"sempre permitir" vem das sugestões de permissão', () => {
  const st = createState();
  const permission_suggestions = [
    { type: 'addRules', behavior: 'allow', destination: 'localSettings', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }] },
    { type: 'setMode', mode: 'acceptEdits', destination: 'session' },
  ];
  applyEvent(st, ev('PermissionRequest', { request_id: 'r1', tool_name: 'Bash', tool_input: { command: 'npm test' }, permission_suggestions }));
  assert.equal(snapshot(st)[0].pending.always, 'Bash(npm test:*)');
});

test('perguntas ao usuário não ganham botões de aprovar', () => {
  const st = createState();
  applyEvent(st, ev('PermissionRequest', { request_id: 'r1', tool_name: 'AskUserQuestion', tool_input: { questions: [] } }));
  const { pending } = snapshot(st)[0];
  assert.equal(pending.requestId, null);
  assert.equal(pending.always, null);
});

test('progresso vem do TodoWrite', () => {
  const st = createState();
  applyEvent(st, ev('PreToolUse', { tool_name: 'TodoWrite', tool_input: { todos: [{ status: 'completed' }, { status: 'in_progress' }, { status: 'pending' }] } }));
  assert.deepEqual(snapshot(st)[0].progress, { done: 1, total: 3 });
});

test('eventos inválidos são ignorados', () => {
  const st = createState();
  assert.deepEqual(applyEvent(st, null), {});
  assert.deepEqual(applyEvent(st, { hook_event_name: 'Stop' }), {});
  assert.equal(snapshot(st).length, 0);
});

test('limpeza de sessões paradas', () => {
  const st = createState();
  applyEvent(st, ev('SessionStart'), 0);
  prune(st, 31 * 60 * 1000);
  assert.equal(snapshot(st).length, 0);
});

test('descrição de ferramentas', () => {
  assert.equal(describeTool('WebFetch', { url: 'https://docs.bullmq.io/guide' }), 'WebFetch docs.bullmq.io');
  assert.equal(describeTool('Agent', {}), 'Agent');
});
