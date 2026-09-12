import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, watch, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createFairyDiagnostics } from '../vendor/diagnostics.js';

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh');
const RUNTIME_DIR = join(DSH_HOME, 'browser-dock');
const STATE_FILE = join(RUNTIME_DIR, 'state.json');
const COMMAND_FILE = join(RUNTIME_DIR, 'command.json');
const CONTROL_TOKEN_FILE = join(RUNTIME_DIR, 'control-token');
const MAX_CONTROL_BYTES = 2048;
const appliedContexts = new WeakSet();
const diagnostics = createFairyDiagnostics('dsh-browser-dock');

function json(res, status, value) {
  if (res.writableEnded || res.destroyed) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(value));
}

function readState() {
  try {
    const value = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    return value && typeof value === 'object' ? value : { active: false, status: 'idle', revision: 0 };
  } catch (error) {
    if (error?.code !== 'ENOENT') diagnostics.warn('state.read', { file: 'state.json' }, error);
    return { active: false, status: 'idle', revision: 0 };
  }
}

function frameFile(revision) {
  return join(RUNTIME_DIR, `frame-${revision}.jpg`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on('data', (chunk) => {
      length += chunk.length;
      if (length > MAX_CONTROL_BYTES) {
        reject(new Error('control body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function writeCommand(command) {
  const temporary = `${COMMAND_FILE}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ ...command, nonce: `${Date.now()}-${Math.random()}` }), { mode: 0o600 });
  renameSync(temporary, COMMAND_FILE);
}

function writeControlToken() {
  const token = randomBytes(32).toString('hex');
  const temporary = `${CONTROL_TOKEN_FILE}.${process.pid}.tmp`;
  mkdirSync(RUNTIME_DIR, { recursive: true, mode: 0o700 });
  try {
    writeFileSync(temporary, token, { encoding: 'utf8', mode: 0o600 });
    renameSync(temporary, CONTROL_TOKEN_FILE);
    return token;
  } catch (error) {
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}

export const name = 'dsh-browser-dock';

export function apply(ctx) {
  return diagnostics.guard('apply', () => {
  if (appliedContexts.has(ctx)) return;
  const controlToken = writeControlToken();
  appliedContexts.add(ctx);
  const stateClients = new Set();
  let stateWatcher = null;
  let watcherAvailable = false;
  let watcherErrorReported = false;
  let stateNotifyScheduled = false;
  const closeStateClients = () => {
    stateClients.forEach((res) => {
      if (!res.writableEnded && !res.destroyed) res.end();
    });
    stateClients.clear();
  };
  const disableWatcher = (error) => {
    watcherAvailable = false;
    stateWatcher?.close();
    stateWatcher = null;
    closeStateClients();
    if (error && !watcherErrorReported) {
      watcherErrorReported = true;
      diagnostics.warn('state.watch', { fallback_poll_ms: 800 }, error);
    }
  };
  const notifyClients = () => {
    if (stateNotifyScheduled) return;
    stateNotifyScheduled = true;
    queueMicrotask(() => {
      stateNotifyScheduled = false;
      if (stateClients.size === 0) return;
    stateClients.forEach((res) => {
      if (res.writableEnded || res.destroyed) stateClients.delete(res);
      else res.write('event: state\ndata: changed\n\n');
    });
    });
  };

  ctx.effect(() => {
    try {
      // The proxy publishes with atomic rename, so watch the stable directory
      // instead of the replaceable state.json inode.
      stateWatcher = watch(RUNTIME_DIR, (event, filename) => {
        if ((event === 'change' || event === 'rename') && String(filename || '') === 'state.json') notifyClients();
      });
      watcherAvailable = true;
      diagnostics.metric('state.watch.start', diagnostics.start(), { implementation: 'fs.watch' });
      stateWatcher.on('error', disableWatcher);
    } catch (error) {
      disableWatcher(error);
    }
    return () => disableWatcher();
  }, 'dsh-browser-dock state watcher');

  ctx.effect(() => () => {
    try {
      if (existsSync(STATE_FILE)) writeCommand({ action: 'close', reason: 'plugin-unload' });
      else if (existsSync(COMMAND_FILE)) unlinkSync(COMMAND_FILE);
    } catch (error) {
      diagnostics.warn('lifecycle.cleanup', {}, error);
    } finally {
      try {
        if (existsSync(CONTROL_TOKEN_FILE)) unlinkSync(CONTROL_TOKEN_FILE);
      } catch (error) {
        diagnostics.warn('lifecycle.token_cleanup', {}, error);
      }
    }
    appliedContexts.delete(ctx);
  }, 'dsh-browser-dock lifecycle');

  ctx.inject(['webServer'], (scope) => {
    scope.effect(() => scope.webServer.register({
      kind: 'exact',
      path: '/browser-dock/state',
      handler: async (_req, res) => json(res, 200, { ...readState(), token: controlToken }),
    }));

    scope.effect(() => scope.webServer.register({
      kind: 'exact',
      path: '/browser-dock/events',
      handler: async (req, res) => {
        if (req.method && req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
        if (!watcherAvailable) return json(res, 503, { error: 'state watch unavailable', fallbackPollMs: 800 });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Connection', 'keep-alive');
        res.write(': connected\n\n');
        stateClients.add(res);
        const release = () => stateClients.delete(res);
        req.on('close', release);
        res.on?.('close', release);
      },
    }));

    scope.effect(() => scope.webServer.register({
      kind: 'exact',
      path: '/browser-dock/frame',
      handler: async (req, res) => {
        const revision = Number(new URL(req.url, 'http://localhost').searchParams.get('revision'));
        if (!Number.isSafeInteger(revision) || revision < 1) return json(res, 400, { error: 'invalid frame revision' });
        const file = frameFile(revision);
        if (!existsSync(file)) return json(res, 404, { error: 'frame unavailable' });
        const stat = statSync(file);
        if (res.writableEnded || res.destroyed) return;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const stream = createReadStream(file);
        const release = () => stream.destroy();
        res.on?.('close', release);
        stream.on('error', (error) => {
          diagnostics.warn('frame.read', { revision }, error);
          if (!res.headersSent) json(res, error?.code === 'ENOENT' ? 404 : 500, { error: 'frame unavailable' });
          else res.destroy?.(error);
        });
        stream.pipe(res);
      },
    }));

    scope.effect(() => scope.webServer.register({
      kind: 'exact',
      path: '/browser-dock/control',
      handler: async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
        try {
          const startedAt = diagnostics.start();
          const command = await readBody(req);
          if (command.token !== controlToken) return json(res, 403, { error: 'forbidden' });
          if (!['bind', 'close', 'takeover'].includes(command.action)) return json(res, 400, { error: 'unsupported action' });
          const state = readState();
          if (command.action === 'takeover') {
            if (!state.active || !state.takeoverAvailable || state.takeoverConsumed || command.revision !== state.revision) {
              return json(res, 409, { error: 'takeover is no longer available' });
            }
          }
          const { token: _token, ...controlCommand } = command;
          writeCommand(controlCommand);
          diagnostics.metric('control.write', startedAt, { action: command.action });
          return json(res, 202, { accepted: true });
        } catch (error) {
          diagnostics.warn('control.write', { status: 400 }, error);
          return json(res, 400, { error: error.message });
        }
      },
    }));
  });
  }, { surface: 'host' });
}
