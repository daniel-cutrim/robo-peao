// Registers the widget hooks in ~/.claude/settings.json.
//   node scripts/install-hooks.mjs           -> dry run: prints what would be added
//   node scripts/install-hooks.mjs --apply   -> backup + write
//   node scripts/install-hooks.mjs --remove  -> backup + remove our hooks

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const settingsPath = join(homedir(), '.claude', 'settings.json');
const relay = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'relay.mjs').replaceAll('\\', '/');
// The trailing marker (ignored by the relay) identifies our hooks wherever the repo was cloned.
const MARKER = '--robo-peao';
const OLD_MARKERS = ['--ai-robots-flutuantes', 'ai_robots_flutuantes/hooks/relay.mjs']; // installs from before the rename
// macOS/Linux: absolute node path, since apps opened from the Dock/Finder (Claude desktop) may not have
// Homebrew/nvm on PATH. Switched node versions? Run hooks:install again.
const node = process.platform === 'win32' ? 'node' : `"${process.execPath}"`;
const command = `${node} "${relay}" ${MARKER}`;
const isOurs = (group) => group.hooks?.some((h) => [MARKER, ...OLD_MARKERS].some((m) => h.command?.includes(m)));

const TOOL_EVENTS = ['PreToolUse', 'PostToolUse', 'PermissionRequest'];
const EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Notification', 'SubagentStart', 'SubagentStop', 'Stop'];

function ourGroup(event) {
  const group = { hooks: [{ type: 'command', command, timeout: event === 'PermissionRequest' ? 90 : 5 }] };
  return TOOL_EVENTS.includes(event) ? { matcher: '*', ...group } : group;
}

const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--remove') ? 'remove' : 'dry';
const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {};
settings.hooks ??= {};

for (const event of EVENTS) {
  const kept = (settings.hooks[event] ?? []).filter((g) => !isOurs(g));
  if (mode !== 'remove') kept.push(ourGroup(event));
  if (kept.length) settings.hooks[event] = kept;
  else delete settings.hooks[event];
}
if (!Object.keys(settings.hooks).length) delete settings.hooks;

if (mode === 'dry') {
  console.log(`Arquivo: ${settingsPath}\nHooks que seriam adicionados (rode com --apply pra gravar):\n`);
  console.log(JSON.stringify(Object.fromEntries(EVENTS.map((e) => [e, [ourGroup(e)]])), null, 2));
} else {
  if (existsSync(settingsPath)) {
    const backup = `${settingsPath}.bak-robots-${Date.now()}`;
    copyFileSync(settingsPath, backup);
    console.log(`Backup: ${backup}`);
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  console.log(mode === 'apply' ? 'Hooks instalados.' : 'Hooks removidos.');
}
