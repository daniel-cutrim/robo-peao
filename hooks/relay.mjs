// Called by Claude Code hooks: forwards the event JSON (stdin) to the widget.
// Must never break Claude Code: any failure exits 0 with no output.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const URL = 'http://127.0.0.1:47821/event';
const PERMISSION_WAIT_MS = 60_000;

// Same folder Electron uses as app.getPath('userData') for this app.
function userDataDir() {
  if (process.platform === 'win32') return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'robo-peao');
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'robo-peao');
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'robo-peao');
}

try {
  // No token file = widget never ran: nothing to do.
  const token = readFileSync(join(userDataDir(), 'token'), 'utf8').trim();
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const event = JSON.parse(raw);
  const isPermission = event.hook_event_name === 'PermissionRequest';

  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-robots-token': token },
    body: raw,
    signal: AbortSignal.timeout(isPermission ? PERMISSION_WAIT_MS : 800),
  });

  if (isPermission && res.ok) {
    // The widget builds the decision object ({ behavior, message?, updatedPermissions? }); null = no answer.
    const { decision } = await res.json();
    if (decision && (decision.behavior === 'allow' || decision.behavior === 'deny')) {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } }));
    }
  }
} catch {
  // widget fechado, timeout ou JSON inválido: deixa o Claude Code seguir normal
}
process.exit(0);
