window.__ModuleLoader__.load({
  id: 'dsh-fairy-voice',
  factory: (require) => {
    const React = require('react');
    const jsx = require('react/jsx-runtime');
    const { Tooltip, IconPauseOutline16, IconPlayOutline16, IconStopFill16 } = require('@deepseek-ai/dsh-client-ui-primitives');

    const EVENT_PLAY = 'fairy-voice-play';
    const EVENT_STATE = 'fairy-voice-state';
    const EVENT_AVAILABILITY = 'fairy-voice-availability';
    const EVENT_BRAIN_CONFIG = 'fairy-voice-brain-config';
    const SETTINGS_AUTO = 'dsh.fairyVoice.autoRead.v4';
    const SETTINGS_VOLUME = 'dsh.fairyVoice.volume';
    const PCM_SAMPLE_RATE = 32000;
    const PCM_BYTES_PER_SAMPLE = 2;
    const PLAYBACK_GROUP_SIZE = 4;
    /* The CPU service's smallest measured first PCM burst is about 740ms.
     * 450ms starts promptly while leaving scheduling headroom; subsequent
     * sources stay on Web Audio's absolute timeline rather than JS timers. */
    const PLAYBACK_PREBUFFER_SECONDS = 0.65;
    const PLAYBACK_SCHEDULE_LEAD_SECONDS = 0.075;
    const PLAYBACK_MAX_SCHEDULED_SECONDS = 4.8;
    const PLAYBACK_MIN_BUFFER_SECONDS = 0.08;
    const PLAYBACK_MIN_BUFFER_BYTES = PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE * PLAYBACK_MIN_BUFFER_SECONDS;
    const PCM_EDGE_RAMP_SAMPLES = Math.round(PCM_SAMPLE_RATE * 0.005);
    const STOP_FADE_SECONDS = 0.012;
    const SESSION_BASELINE_SETTLE_MS = 1250;
    const FINAL_PLAYBACK_SETTLE_MS = 900;
    const VOICE_REPORT_DELAY_MS = 4500;
    const VOICE_REPORT_COOLDOWN_MS = 15000;
    const VOICE_BRIEF_THRESHOLD = 260;
    const AVAILABILITY_TTL_MS = 30_000;
    const VOICE_STYLE_ID = 'dsh-fairy-voice-controls-style';
    const LOCAL_TTS_ENDPOINT = '/fairy-voice';
    const MAX_TRACKED_SESSION_STATES = 32;
    const { FAIRY_VOICE_CONTROL_ATTRIBUTE } = (() => {
      const module = { exports: {} };
// DSH_FAIRY_CLIENT_DOM_BEGIN
const FAIRY_VOICE_CONTROL_ATTRIBUTE = 'data-dsh-fairy-voice-control';

module.exports = { FAIRY_VOICE_CONTROL_ATTRIBUTE };
// DSH_FAIRY_CLIENT_DOM_END
      return module.exports;
    })();
    const createFairyDiagnostics = (() => {
      const module = { exports: {} };
// DSH_FAIRY_CLIENT_DIAGNOSTICS_BEGIN
const FAIRY_LOG_PREFIX = 'DSH_FAIRY_LOG';
const SENSITIVE_KEY = /authorization|credential|password|secret|token|api[_-]?key|cookie/i;

function sanitize(value, key = '', depth = 0) {
  if (SENSITIVE_KEY.test(key)) return '[redacted]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.length > 320 ? `${value.slice(0, 320)}…` : value;
  if (depth >= 2) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => sanitize(item, '', depth + 1));
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 24).map(([name, item]) => [name, sanitize(item, name, depth + 1)]));
  return String(value);
}

function createFairyDiagnostics(moduleName, sink = console) {
  const recentErrors = new Map();
  const clock = () => typeof performance === 'object' && performance?.now ? performance.now() : Date.now();
  const emit = (level, operation, event, context = {}, error, durationMs) => {
    const normalizedError = error ? { name: String(error.name || 'Error'), code: error.code == null ? undefined : String(error.code), message: String(error.message || error).slice(0, 320) } : undefined;
    if (normalizedError) {
      const signature = `${operation}:${normalizedError.code || normalizedError.message}`;
      const now = Date.now();
      if (now - (recentErrors.get(signature) || 0) < 60_000) return null;
      recentErrors.set(signature, now);
    }
    const record = { schema: 1, timestamp: new Date().toISOString(), level, module: moduleName, operation, event, context: sanitize(context), ...(normalizedError ? { error: normalizedError } : {}), ...(Number.isFinite(durationMs) ? { duration_ms: Number(durationMs.toFixed(3)) } : {}) };
    const writer = level === 'error' ? sink.error : level === 'warn' ? sink.warn : sink.info || sink.log;
    writer.call(sink, `${FAIRY_LOG_PREFIX} ${JSON.stringify(record)}`);
    return record;
  };
  const start = () => clock();
  const metric = (operation, startedAt, context = {}, options = {}) => {
    const duration = clock() - startedAt;
    return duration < (options.thresholdMs || 0) ? null : emit('info', operation, 'metric', context, undefined, duration);
  };
  const guard = (operation, callback, context = {}) => {
    const startedAt = start();
    try {
      const result = callback();
      metric(operation, startedAt, { ...context, outcome: 'success' });
      return result;
    } catch (error) {
      emit('error', operation, 'failure', context, error);
      metric(operation, startedAt, { ...context, outcome: 'failure' });
      throw error;
    }
  };
  return { start, metric, guard, info: (operation, context) => emit('info', operation, 'event', context), warn: (operation, context, error) => emit('warn', operation, 'failure', context, error), error: (operation, error, context) => emit('error', operation, 'failure', context, error) };
}

module.exports = { FAIRY_LOG_PREFIX, createFairyDiagnostics };
// DSH_FAIRY_CLIENT_DIAGNOSTICS_END
      return module.exports.createFairyDiagnostics;
    })();
    const diagnostics = createFairyDiagnostics('dsh-fairy-voice');
    const voiceStateBySession = new Map();
    const emptyActiveSelection = { key: 'empty-chat', epoch: 0 };
    const emptyActiveSessionStore = { getSnapshot: () => emptyActiveSelection, subscribe: () => () => {} };
    const emptyVoiceTimeline = { found: [], currentTurnFinals: [], messagesById: new Map(), userSeq: 0, sessionKey: 'empty-chat', activity: { running: false, phase: null, turn: 0, toolNames: [] } };
    let activeSessionStore = null;

    function createVoiceRequestScope() {
      const controller = new AbortController();
      const timers = new Set();
      const cleanups = new Set();
      let cancelled = false;
      const cancel = (reason = 'client-aborted') => {
        if (cancelled) return;
        cancelled = true;
        controller.abort(reason);
        for (const timer of timers) clearTimeout(timer);
        timers.clear();
        for (const cleanup of cleanups) {
          try { cleanup(); } catch (error) { reportAudioLifecycleFailure('request cleanup', error); }
        }
        cleanups.clear();
      };
      return {
        controller,
        signal: controller.signal,
        get cancelled() { return cancelled; },
        timeout(callback, delay) {
          if (cancelled) return 0;
          const timer = setTimeout(() => {
            timers.delete(timer);
            if (!cancelled) callback();
          }, delay);
          timers.add(timer);
          return timer;
        },
        addCleanup(cleanup) {
          if (typeof cleanup !== 'function') return cleanup;
          if (cancelled) cleanup();
          else cleanups.add(cleanup);
          return cleanup;
        },
        cancel,
      };
    }

    function createSessionTimelineStore() {
      const listeners = new Set();
      let snapshot = emptyVoiceTimeline;
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        set(next) {
          if (snapshot === next) return;
          snapshot = next;
          listeners.forEach((listener) => listener());
        },
        clear(expected) {
          if (expected && snapshot !== expected) return;
          snapshot = emptyVoiceTimeline;
          listeners.forEach((listener) => listener());
        },
      };
    }

    // Compatibility name retained for the existing plugin contract; the
    // implementation is the session-scoped timeline store above.
    function createVoiceTimelineStore() {
      return createSessionTimelineStore();
    }

    const voiceTimelineStore = createVoiceTimelineStore();

    // The client-side transport boundary keeps local TTS and Voice Brain HTTP
    // details out of playback policy and the settings UI.
    function createLocalTtsTransport(fetchImpl = fetch) {
      const request = (operation, url, options) => {
        const startedAt = diagnostics.start();
        return Promise.resolve().then(() => fetchImpl(url, options)).then((response) => {
          diagnostics.metric(operation, startedAt, { status: response.status }, { thresholdMs: 100 });
          return response;
        }, (error) => {
          if (error?.name !== 'AbortError') diagnostics.warn(operation, {}, error);
          diagnostics.metric(operation, startedAt, { outcome: 'failure' }, { thresholdMs: 100 });
          throw error;
        });
      };
      return {
        prepare(markdown, signal) {
          return request('speech.prepare.request', LOCAL_TTS_ENDPOINT + '/prepare', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markdown }), signal
          }).then(async (response) => {
            const value = await response.json();
            if (!response.ok) throw new Error(value?.error?.message || 'Unable to prepare speech.');
            return value.sentences || [];
          });
        },
        status(signal) {
          return request('status.request', LOCAL_TTS_ENDPOINT + '/status', { cache: 'no-store', signal }).then(async (response) => {
            const value = await response.json();
            return response.ok ? value : { available: false, reason: '本地 Fairy 服务未启动。' };
          });
        },
        stream(text, signal) {
          return request('tts.stream.request', LOCAL_TTS_ENDPOINT + '/tts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal
          });
        }
      };
    }

    function createVoiceBrainClient(fetchImpl = fetch) {
      const request = (operation, url, options) => {
        const startedAt = diagnostics.start();
        return Promise.resolve().then(() => fetchImpl(url, options)).then((response) => {
          diagnostics.metric(operation, startedAt, { status: response.status }, { thresholdMs: 100 });
          return response;
        }, (error) => {
          if (error?.name !== 'AbortError') diagnostics.warn(operation, {}, error);
          throw error;
        });
      };
      return {
        status() {
          return request('brain.status.request', LOCAL_TTS_ENDPOINT + '/brain/status', { cache: 'no-store' }).then(async (response) => {
            const value = await response.json();
            return response.ok ? value : { configured: false, model: 'deepseek-v4-flash' };
          });
        },
        brief(markdown, signal) {
          return request('brain.brief.request', LOCAL_TTS_ENDPOINT + '/brain/brief', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markdown }), signal
          }).then(async (response) => {
            const value = await response.json();
            if (!response.ok) throw new Error(value?.error?.message || 'Voice brief unavailable.');
            return typeof value?.brief === 'string' ? value.brief.trim() : '';
          });
        },
        config(payload) {
          return request('brain.config.request', LOCAL_TTS_ENDPOINT + '/brain/config', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store'
          }).then(async (response) => {
            const value = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(value?.error?.message || '本地语音简报服务未响应。');
            return value;
          }).catch((error) => {
            if (error instanceof TypeError || error?.name === 'SyntaxError') throw new Error('无法连接本地语音简报服务。请重新加载 DSH 后重试。');
            throw error;
          });
        }
      };
    }

    const localTtsTransport = createLocalTtsTransport();
    const voiceBrainClient = createVoiceBrainClient();

    const VOICE_REPORTS = {
      searching: ['主人，正在检索相关资料。', '资料仍在核验中，我继续盯着。', '检索还在进行，正在筛选有效信息。'],
      tool: ['行动步骤已启动，请稍候。', '必要操作仍在执行中。', '执行进度正常，我继续处理。'],
      working: ['主人，正在整理信息。', '信息还在汇总，我继续梳理。', '正在计算可执行结论。']
    };

    function isSearchTool(name) {
      // A search announcement is permitted only when the tool identifier says
      // so. Assistant prose, reasoning, and UI labels are never treated as evidence.
      const value = String(name || '').trim().toLowerCase();
      return /(^|[._/-])(web_)?search([._/-]|$)|(^|[._/-])search_web([._/-]|$)|搜索|检索/.test(value);
    }

    function clampVolume(value) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 1;
    }

    function reportAudioLifecycleFailure(operation, error) {
      if (error?.name === 'InvalidStateError' || error?.name === 'AbortError') return;
      diagnostics.warn('audio.lifecycle', { operation }, error);
    }

    function reportAudioResources(current, operation) {
      diagnostics.info('audio.resources', {
        operation,
        activeSources: current?.sources?.size || 0,
        activeObjectUrls: current?.urls?.size || 0,
        contextState: current?.context?.state || 'none',
      });
    }

    function createPcmStreamHandler() {
      return {
        decodeInto(bytes, samples) {
          for (let offset = 0, index = 0; offset < bytes.length && index < samples.length; offset += PCM_BYTES_PER_SAMPLE, index += 1) {
            const value16 = bytes[offset] | (bytes[offset + 1] << 8);
            samples[index] = (value16 & 0x8000 ? value16 - 0x10000 : value16) / 0x8000;
          }
        },
        playableLength(bytes) {
          return bytes.length - (bytes.length % PCM_BYTES_PER_SAMPLE);
        }
      };
    }

    const pcmStreamHandler = createPcmStreamHandler();

    // TTS fragments are independently synthesized and can begin/end away from
    // zero. A short edge ramp prevents a discontinuity becoming an audible click
    // when adjacent AudioBufferSourceNodes are scheduled back-to-back.
    function applyPcmEdgeRamp(samples) {
      const ramp = Math.min(PCM_EDGE_RAMP_SAMPLES, Math.floor(samples.length / 2));
      if (!ramp) return;
      for (let index = 0; index < ramp; index += 1) {
        const ratio = (index + 1) / ramp;
        samples[index] *= ratio;
        samples[samples.length - 1 - index] *= ratio;
      }
    }

    function createWebAudioScheduler({ current, getNextStart }) {
      const waitForPlayback = async () => {
        while (!current.stopped && current.context?.state === 'running' && getNextStart() !== null) {
          const remaining = getNextStart() - current.context.currentTime;
          if (remaining <= 0) return;
          await new Promise((resolve) => setTimeout(resolve, Math.min(remaining * 1000, 50)));
        }
      };
      const waitForQueueCapacity = async () => {
        while (!current.stopped && current.context?.state === 'running' && getNextStart() !== null) {
          const queued = getNextStart() - current.context.currentTime;
          if (queued <= PLAYBACK_MAX_SCHEDULED_SECONDS) return;
          await new Promise((resolve) => setTimeout(resolve, Math.min((queued - PLAYBACK_MAX_SCHEDULED_SECONDS) * 1000, 50)));
        }
      };
      return { waitForPlayback, waitForQueueCapacity };
    }

    function idleVoiceState(sessionKey) {
      return { status: 'idle', messageId: null, error: null, sessionKey: String(sessionKey), lastAccess: Date.now() };
    }

    function disposeVoiceSessionState(key, state) {
      try {
        state?.dispose?.();
      } catch (error) {
        reportAudioLifecycleFailure(`session state ${key} disposal`, error);
      } finally {
        voiceStateBySession.delete(key);
      }
    }

    function pruneOldSessions() {
      if (voiceStateBySession.size <= MAX_TRACKED_SESSION_STATES) return;
      const activeKey = String(activeSessionStore?.getSnapshot?.().key ?? 'empty-chat');
      const entries = [...voiceStateBySession.entries()];
      entries.sort((a, b) => {
        const activeOrder = Number(a[0] === activeKey) - Number(b[0] === activeKey);
        return activeOrder || (a[1].lastAccess || 0) - (b[1].lastAccess || 0);
      });
      const toRemove = entries.slice(0, entries.length - MAX_TRACKED_SESSION_STATES);
      toRemove.forEach(([key, state]) => disposeVoiceSessionState(key, state));
    }

    function clearVoiceSessionStates() {
      [...voiceStateBySession.entries()].forEach(([key, state]) => disposeVoiceSessionState(key, state));
    }

    function readVoiceState(sessionKey) {
      const key = String(sessionKey);
      const state = voiceStateBySession.get(key);
      if (!state) return idleVoiceState(key);
      state.lastAccess = Date.now();
      return state;
    }

    function dispatchVoiceState(detail) {
      const scoped = { ...detail, sessionKey: String(detail.sessionKey), lastAccess: Date.now() };
      voiceStateBySession.set(scoped.sessionKey, scoped);
      pruneOldSessions();
      window.dispatchEvent(new CustomEvent(EVENT_STATE, { detail: scoped }));
      return scoped;
    }

    function createActiveSessionStore(sessions) {
      const listeners = new Set();
      const readKey = () => String(sessions?.list?.getSnapshot?.().current ?? 'empty-chat');
      let snapshot = { key: readKey(), epoch: 0 };
      const sync = () => {
        const key = readKey();
        if (key === snapshot.key) return;
        snapshot = { key, epoch: snapshot.epoch + 1 };
        listeners.forEach((listener) => listener());
      };
      const off = sessions?.list?.subscribe?.(sync) || null;
      return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
        dispose: () => { off?.(); listeners.clear(); },
      };
    }

    const iconButton = {
      width: '28px', height: '28px', border: 'none', borderRadius: '999px', padding: '6px',
      display: 'inline-grid', placeItems: 'center', background: 'transparent',
      color: 'var(--dsw-alias-label-tertiary)', cursor: 'pointer'
    };

    function ensureVoiceControlStyles() {
      if (typeof document === 'undefined' || document.getElementById(VOICE_STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = VOICE_STYLE_ID;
      style.setAttribute('data-plugin', 'dsh-fairy-voice');
      style.textContent = `
.dsh-fairy-voice-controls{display:inline-flex;align-items:center;gap:4px;height:28px;padding:2px 5px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);box-sizing:border-box}
.dsh-fairy-voice-auto{width:22px;height:22px;display:grid;place-items:center;flex:none;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;transition:background .15s,color .15s}
.dsh-fairy-voice-auto:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.dsh-fairy-voice-auto[data-on="true"]{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 12%,transparent);color:var(--dsw-alias-label-secondary)}
.dsh-fairy-voice-auto:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-fairy-voice-auto:disabled,.dsh-fairy-voice-volume:disabled{cursor:not-allowed;opacity:.42}
.dsh-fairy-voice-volume{--dsh-fairy-volume:100%;appearance:none;-webkit-appearance:none;width:66px;height:22px;margin:0;background:transparent;cursor:pointer}
.dsh-fairy-voice-volume::-webkit-slider-runnable-track{height:3px;border-radius:999px;background:linear-gradient(to right,var(--dsw-alias-label-secondary) 0 var(--dsh-fairy-volume),var(--dsw-alias-border-l2) var(--dsh-fairy-volume) 100%)}
.dsh-fairy-voice-volume::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;margin-top:-4px;border:2px solid var(--dsw-alias-bg-layer-1);border-radius:50%;background:var(--dsw-alias-label-secondary);box-shadow:0 0 0 1px var(--dsw-alias-border-l2)}
.dsh-fairy-voice-volume:focus-visible{outline:none}
.dsh-fairy-voice-volume:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary)}
.dsh-fairy-voice-volume::-moz-range-track{height:3px;border:0;border-radius:999px;background:var(--dsw-alias-border-l2)}
.dsh-fairy-voice-volume::-moz-range-progress{height:3px;border-radius:999px;background:var(--dsw-alias-label-secondary)}
.dsh-fairy-voice-volume::-moz-range-thumb{width:9px;height:9px;border:2px solid var(--dsw-alias-bg-layer-1);border-radius:50%;background:var(--dsw-alias-label-secondary);box-shadow:0 0 0 1px var(--dsw-alias-border-l2)}
.dsh-fairy-voice-waveform{display:none;align-items:center;justify-content:space-between;gap:3px;flex:1;height:100%;padding:0 4px;pointer-events:none}
.dsh-fairy-voice-wave-bar{display:block;width:3px;min-width:3px;height:var(--dsh-fairy-wave-height);border-radius:999px;background:currentColor;opacity:var(--dsh-fairy-wave-opacity)}
.dsh-fairy-voice-brain{display:grid;gap:16px;width:min(640px,100%);padding:4px 0 12px;color:var(--dsw-alias-label-primary)}
.dsh-fairy-voice-brain-head{display:grid;gap:5px;padding-bottom:14px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dsh-fairy-voice-brain-title{margin:0;font-size:18px;font-weight:600;line-height:1.3}
.dsh-fairy-voice-brain-copy{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.65}
.dsh-fairy-voice-brain-panel{display:grid;gap:12px;padding:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
.dsh-fairy-voice-brain-row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.dsh-fairy-voice-brain-label{font-size:14px;font-weight:600}.dsh-fairy-voice-brain-value{font-size:13px;color:var(--dsw-alias-label-secondary);text-align:right}
.dsh-fairy-voice-brain-input{width:100%;height:34px;padding:0 10px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-0);color:var(--dsw-alias-label-primary);font:13px ui-monospace,SFMono-Regular,Menlo,monospace;outline:none}
.dsh-fairy-voice-brain-input:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent)}
.dsh-fairy-voice-brain-actions{display:flex;justify-content:flex-end;gap:8px}.dsh-fairy-voice-brain-button{height:30px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;cursor:pointer}.dsh-fairy-voice-brain-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dsh-fairy-voice-brain-button--primary{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:#fff}.dsh-fairy-voice-brain-button:disabled{opacity:.5;cursor:not-allowed}.dsh-fairy-voice-brain-status{min-height:18px;margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}.dsh-fairy-voice-brain-status[data-error="true"]{color:var(--dsw-alias-state-error-primary)}
`;
      (document.head || document.documentElement).appendChild(style);
    }

    function messageText(finalNode) {
      return (finalNode?.blocks || []).filter((block) => block.kind === 'text').map((block) => block.text).join('\n').trim();
    }

    function collectRunningTools(block, activeTools, seenCallIds = new Set()) {
      if (!block || seenCallIds.has(String(block.callId))) return;
      seenCallIds.add(String(block.callId));
      if (!('kind' in block)) {
        activeTools.push({ id: String(block.callId), name: String(block.name || ''), turn: block.turn, step: block.step });
      }
      for (const child of block.subCalls || []) collectRunningTools(child, activeTools, seenCallIds);
    }

    function readVoiceTimeline(snapshot) {
      const found = [];
      const currentTurnFinals = [];
      const activeAssistantSteps = [];
      const activeTools = [];
      const activeToolIds = new Set();
      const chat = snapshot?.chat;
      for (const key of chat?.order || []) {
        const node = chat.nodes?.get(key);
        const data = node?.kind === 'assistant-step' ? node.data : undefined;
        const finalNode = data?.finalNode;
        const text = messageText(finalNode);
        if (data?.status === 'settled' && finalNode?.messageId && text) found.push({ id: String(finalNode.messageId), markdown: text });
        if (data?.status === 'running') activeAssistantSteps.push({ turn: data.turn, step: data.step });
        // Tool rows remain in chat.order after completion. They are history,
        // not evidence of current activity, so do not infer "running" from
        // their retained root call. The authoritative live list is merged
        // below from legacy.runningCalls.
      }
      const userSeq = (snapshot?.chat?.legacy?.nodes || []).filter((node) => node.kind === 'user' || node.kind === 'steering').at(-1)?.seq || 0;
      // An assistant-step finalNode is the final message for that step, not
      // necessarily the final answer for the whole turn. The official
      // turn-tail projection is the authoritative whole-turn boundary: it is
      // published only for a closed turn and its closing value is the last
      // content-bearing assistant step in that turn. Process/reasoning steps
      // therefore never enter the automatic-final queue.
      //
      // Restrict the projection to the turn containing the latest user/steering
      // event. Without this boundary, a manually replayed historical answer
      // could look like a new automatic candidate on the next prompt.
      const timeline = chat?.timeline;
      for (const turnNumber of timeline?.turnOrder || []) {
        const turnLocation = timeline.turns?.get(turnNumber);
        if (turnLocation?.status !== 'closed') continue;
        const startSeq = turnLocation.start?.seq;
        const endSeq = turnLocation.end?.seq;
        if (typeof startSeq !== 'number' || startSeq > userSeq || (typeof endSeq === 'number' && userSeq > endSeq)) continue;
        const closing = turnLocation.data?.get?.('turn-tail')?.closing;
        const finalNode = closing?.finalNode;
        const text = messageText(finalNode);
        if (finalNode?.messageId && text) {
          currentTurnFinals.push({
            id: String(finalNode.messageId),
            markdown: text,
            turn: turnNumber,
            seq: finalNode.seq
          });
        }
      }
      const sessionKey = snapshot?.sessionId ?? snapshot?.chat?.sessionId ?? snapshot?.chat?.id ?? chat?.order?.[0] ?? 'empty-chat';
      // legacy.runningCalls covers a short interval before a tool row is
      // materialized in chat.order. Merge it by call id without relying on UI text.
      for (const call of snapshot?.chat?.legacy?.runningCalls || []) {
        collectRunningTools(call, activeTools, activeToolIds);
      }
      // snapshot.running can remain true during post-tool reconciliation even
      // after the final assistant node is settled. The concrete live lists
      // below are the reliable activity boundary for speech scheduling.
      const running = activeAssistantSteps.length > 0 || activeTools.length > 0;
      const phase = !running ? null : activeTools.some((tool) => isSearchTool(tool.name)) ? 'searching' : activeTools.length ? 'tool' : 'working';
      const turn = Math.max(0, ...activeAssistantSteps.map((step) => Number(step.turn) || 0), ...activeTools.map((tool) => Number(tool.turn) || 0));
      return {
        found,
        currentTurnFinals,
        messagesById: new Map(found.map((message) => [message.id, message])),
        userSeq,
        sessionKey: String(sessionKey),
        activity: { running, phase, turn, toolNames: activeTools.map((tool) => tool.name) }
      };
    }

    const prepare = (markdown, signal) => localTtsTransport.prepare(markdown, signal);
    const getAvailability = (signal) => localTtsTransport.status(signal);

    const INITIAL_AVAILABILITY = Object.freeze({ available: false, reason: 'Checking Fairy voice availability…' });
    const availabilityListeners = new Set();
    let availabilitySnapshot = INITIAL_AVAILABILITY;
    let availabilityCheckedAt = 0;
    let availabilityRequest = null;
    let availabilityController = null;

    function publishAvailability(value) {
      const next = value?.available === true
        ? { available: true, reason: null }
        : { available: false, reason: value?.reason || '本地 Fairy 服务未启动。' };
      const changed = next.available !== availabilitySnapshot.available || next.reason !== availabilitySnapshot.reason;
      availabilitySnapshot = changed ? next : availabilitySnapshot;
      availabilityCheckedAt = Date.now();
      if (changed) availabilityListeners.forEach((listener) => listener());
      window.dispatchEvent(new CustomEvent(EVENT_AVAILABILITY, { detail: availabilitySnapshot }));
      return availabilitySnapshot;
    }

    function requestAvailability(force = false) {
      if (availabilityRequest) return availabilityRequest;
      if (!force && availabilityCheckedAt && Date.now() - availabilityCheckedAt < AVAILABILITY_TTL_MS) {
        return Promise.resolve(availabilitySnapshot);
      }
      const controller = new AbortController();
      availabilityController = controller;
      const request = getAvailability(controller.signal)
        .catch((error) => {
          if (controller.signal.aborted) return availabilitySnapshot;
          return { available: false, reason: error?.message || '本地 Fairy 服务未启动。' };
        })
        .then((value) => controller.signal.aborted ? availabilitySnapshot : publishAvailability(value))
        .finally(() => {
          if (availabilityController === controller) availabilityController = null;
          if (availabilityRequest === request) availabilityRequest = null;
        });
      availabilityRequest = request;
      return request;
    }

    const availabilityStore = {
      getSnapshot: () => availabilitySnapshot,
      subscribe(listener) { availabilityListeners.add(listener); return () => availabilityListeners.delete(listener); },
    };

    function disposeAvailability() {
      availabilityController?.abort('disposed');
      availabilityController = null;
      availabilityRequest = null;
      availabilitySnapshot = INITIAL_AVAILABILITY;
      availabilityCheckedAt = 0;
      availabilityListeners.clear();
    }

    const getVoiceBrainStatus = () => voiceBrainClient.status();
    const createVoiceBrief = (markdown, signal) => voiceBrainClient.brief(markdown, signal);
    function requestVoiceBrainConfig(payload) {
      return voiceBrainClient.config(payload);
    }

    function reportText(phase, userSeq, turn, reportCount) {
      const options = VOICE_REPORTS[phase] || VOICE_REPORTS.working;
      const index = Math.abs((Number(userSeq) || 0) + (Number(turn) || 0) + (Number(reportCount) || 0) - 1) % options.length;
      return options[index];
    }

    function createAutoReadPolicy({ autoRead, audioReady, available, activity, silencedTurn, userSeq }) {
      return Boolean(autoRead && audioReady && available && activity?.running && activity?.phase && silencedTurn !== userSeq);
    }

    function useVoiceBrain({ sessionKey, timeline, baselineReady, autoRead, audioReady, available }) {
      const state = React.useRef({ key: null, userSeq: 0, timer: null, epoch: 0, phase: null, activeTurn: 0, phaseStartedAt: 0, reports: 0, lastReportAt: 0, silencedTurn: null });
      const latest = React.useRef({ sessionKey, timeline, baselineReady, autoRead, audioReady, available });
      latest.current = { sessionKey, timeline, baselineReady, autoRead, audioReady, available };
      const clearTimer = React.useCallback(() => {
        const current = state.current;
        if (current.timer) clearTimeout(current.timer);
        current.timer = null;
        current.epoch += 1;
      }, []);

      React.useEffect(() => {
        const current = state.current;
        if (current.key !== sessionKey) {
          clearTimer();
          state.current = { key: sessionKey, userSeq: timeline.userSeq, timer: null, epoch: current.epoch + 1, phase: null, activeTurn: 0, phaseStartedAt: 0, reports: 0, lastReportAt: 0, silencedTurn: null };
        }
        const policy = state.current;
        if (!baselineReady) {
          clearTimer();
          policy.userSeq = timeline.userSeq;
          return;
        }
        if (timeline.userSeq !== policy.userSeq) {
          clearTimer();
          policy.userSeq = timeline.userSeq;
          policy.phase = null;
          policy.activeTurn = 0;
          policy.phaseStartedAt = 0;
          policy.reports = 0;
          policy.lastReportAt = 0;
          policy.silencedTurn = null;
        }
        const phase = timeline.activity.phase;
        const activeTurn = timeline.activity.turn;
        const canReport = createAutoReadPolicy({
          autoRead,
          audioReady,
          available,
          activity: timeline.activity,
          silencedTurn: policy.silencedTurn,
          userSeq: timeline.userSeq,
        });
        if (!canReport) {
          clearTimer();
          policy.phase = null;
          return;
        }
        if (policy.phase !== phase || policy.activeTurn !== activeTurn) {
          clearTimer();
          policy.phase = phase;
          policy.activeTurn = activeTurn;
          policy.phaseStartedAt = Date.now();
        }
        // A long-running search/thinking turn has no fixed duration. Keep one
        // low-frequency heartbeat scheduled for as long as DSH reports live
        // activity; the activity boundary and lifecycle cancellation stop it.
        if (policy.timer) return;
        const now = Date.now();
        const eligibleAt = Math.max(policy.phaseStartedAt + VOICE_REPORT_DELAY_MS, policy.lastReportAt + VOICE_REPORT_COOLDOWN_MS);
        const epoch = policy.epoch;
        const reportUserSeq = timeline.userSeq;
        const schedule = (delay) => {
          policy.timer = setTimeout(() => {
          const fresh = latest.current;
          const live = state.current;
          live.timer = null;
          if (live.epoch !== epoch || fresh.sessionKey !== sessionKey || fresh.timeline.userSeq !== reportUserSeq) return;
          if (!fresh.baselineReady || !fresh.autoRead || !fresh.audioReady || !fresh.available) return;
          if (!fresh.timeline.activity.running || fresh.timeline.activity.phase !== phase || live.silencedTurn === reportUserSeq) return;
          live.reports += 1;
          live.lastReportAt = Date.now();
          window.dispatchEvent(new CustomEvent(EVENT_PLAY, {
            detail: {
              kind: 'status', priority: 10, sessionKey,
              messageId: `fairy-status:${reportUserSeq}:${phase}:${live.reports}`,
              markdown: reportText(phase, reportUserSeq, fresh.timeline.activity.turn, live.reports)
            }
          }));
          if (live.phase === phase && live.silencedTurn !== reportUserSeq) {
            schedule(VOICE_REPORT_COOLDOWN_MS);
          }
          }, Math.max(0, delay));
        };
        schedule(Math.max(0, eligibleAt - now));
      }, [sessionKey, timeline, baselineReady, autoRead, audioReady, available, clearTimer]);

      React.useEffect(() => {
        const onVoiceCommand = (event) => {
          const detail = event.detail || {};
          if (detail.sessionKey !== sessionKey || (!detail.stop && detail.kind === 'status')) return;
          clearTimer();
          state.current.silencedTurn = latest.current.timeline.userSeq;
        };
        window.addEventListener(EVENT_PLAY, onVoiceCommand);
        window.addEventListener('pagehide', clearTimer);
        return () => {
          window.removeEventListener(EVENT_PLAY, onVoiceCommand);
          window.removeEventListener('pagehide', clearTimer);
          clearTimer();
        };
      }, [sessionKey, clearTimer]);
    }

    function VoiceBrainSection() {
      const [configured, setConfigured] = React.useState(false);
      const [apiKey, setApiKey] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [status, setStatus] = React.useState('正在读取配置…');
      const [error, setError] = React.useState(false);
      const refresh = React.useCallback(() => {
        getVoiceBrainStatus().then((value) => {
          setConfigured(value?.configured === true);
          setStatus(value?.configured === true ? '已配置。密钥保存在本机，不会在页面回显。' : '未配置。未配置时，长回答会直接使用原文朗读。');
          setError(false);
          window.dispatchEvent(new CustomEvent(EVENT_BRAIN_CONFIG, { detail: value }));
        }).catch(() => {
          setStatus('暂时无法读取本地配置状态。');
          setError(true);
        });
      }, []);
      React.useEffect(() => { refresh(); }, [refresh]);
      const save = async () => {
        if (!apiKey.trim()) return;
        setBusy(true); setError(false);
        try {
          const value = await requestVoiceBrainConfig({ apiKey: apiKey.trim() });
          setApiKey('');
          setConfigured(true);
          setStatus('已配置。密钥保存在本机，不会在页面回显。');
          window.dispatchEvent(new CustomEvent(EVENT_BRAIN_CONFIG, { detail: value }));
        } catch (saveError) {
          setStatus(saveError?.message || '保存失败。');
          setError(true);
        } finally { setBusy(false); }
      };
      const clear = async () => {
        setBusy(true); setError(false);
        try {
          const value = await requestVoiceBrainConfig({ clear: true });
          setConfigured(false); setApiKey('');
          setStatus('已移除。未配置时不会调用云端模型。');
          window.dispatchEvent(new CustomEvent(EVENT_BRAIN_CONFIG, { detail: value }));
        } catch (clearError) {
          setStatus(clearError?.message || '移除失败。');
          setError(true);
        } finally { setBusy(false); }
      };
      return jsx.jsxs('section', { className: 'dsh-fairy-voice-brain', children: [
        jsx.jsxs('div', { className: 'dsh-fairy-voice-brain-head', children: [
          jsx.jsx('h2', { className: 'dsh-fairy-voice-brain-title', children: 'Fairy 语音简报' }),
          jsx.jsx('p', { className: 'dsh-fairy-voice-brain-copy', children: '仅用于压缩较长的最终回答，帮助 Fairy 更自然地朗读。搜索、思考、工具执行和过程汇报不会发送给模型。' }),
          jsx.jsx('p', { className: 'dsh-fairy-voice-brain-copy', children: '固定模型：DeepSeek V4 Flash。未配置、超时或请求失败时，自动回退到本地原文朗读。' })
        ] }),
        jsx.jsxs('div', { className: 'dsh-fairy-voice-brain-panel', children: [
          jsx.jsxs('div', { className: 'dsh-fairy-voice-brain-row', children: [
            jsx.jsx('span', { className: 'dsh-fairy-voice-brain-label', children: '连接状态' }),
            jsx.jsx('span', { className: 'dsh-fairy-voice-brain-value', children: configured ? '已配置 · deepseek-v4-flash' : '未配置' })
          ] }),
          jsx.jsx('input', { className: 'dsh-fairy-voice-brain-input', type: 'password', autoComplete: 'new-password', value: apiKey, onChange: (event) => setApiKey(event.target.value), placeholder: configured ? '输入新 API Key 以替换当前密钥' : '输入 DeepSeek API Key', 'aria-label': 'DeepSeek API Key' }),
          jsx.jsxs('div', { className: 'dsh-fairy-voice-brain-actions', children: [
            configured ? jsx.jsx('button', { className: 'dsh-fairy-voice-brain-button', type: 'button', disabled: busy, onClick: clear, children: '移除密钥' }) : null,
            jsx.jsx('button', { className: 'dsh-fairy-voice-brain-button dsh-fairy-voice-brain-button--primary', type: 'button', disabled: busy || !apiKey.trim(), onClick: save, children: busy ? '处理中…' : '保存密钥' })
          ] }),
          jsx.jsx('p', { className: 'dsh-fairy-voice-brain-status', 'data-error': error ? 'true' : 'false', children: status })
        ] })
      ] });
    }

    function usePlayer(sessionKey) {
      const [state, setState] = React.useState({ status: 'idle', messageId: null, error: null });
      const work = React.useRef({ controller: null, audio: null, context: null, gain: null, sources: new Set(), urls: new Set(), stopped: false });
      const idleSuspendTimer = React.useRef(null);
      const publish = React.useCallback((next) => {
        const scoped = dispatchVoiceState({ ...next, sessionKey });
        setState(scoped);
      }, [sessionKey]);
      const clearIdleSuspend = React.useCallback(() => {
        if (idleSuspendTimer.current) clearTimeout(idleSuspendTimer.current);
        idleSuspendTimer.current = null;
      }, []);
      const suspendWhenIdle = React.useCallback((context) => {
        clearIdleSuspend();
        if (!context || context.state !== 'running') return;
        idleSuspendTimer.current = setTimeout(() => {
          idleSuspendTimer.current = null;
          const current = work.current;
          if (current.context !== context || current.sources.size || context.state !== 'running') return;
          context.suspend().catch((error) => reportAudioLifecycleFailure('suspend', error));
        }, 0);
      }, [clearIdleSuspend]);
      const unlockAudio = React.useCallback(async (initialVolume = 1) => {
        clearIdleSuspend();
        const current = work.current;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Web Audio is unavailable in this browser.');
        if (!current.context || current.context.state === 'closed') {
          current.context = new AudioContextClass({ sampleRate: PCM_SAMPLE_RATE });
          current.gain = current.context.createGain();
          current.gain.gain.value = initialVolume;
          current.gain.connect(current.context.destination);
        } else if (current.gain) {
          const now = current.context.currentTime;
          current.gain.gain.cancelScheduledValues(now);
          current.gain.gain.setValueAtTime(initialVolume, now);
        }
        await current.context.resume();
        return current.context;
      }, [clearIdleSuspend]);
      const primeAudio = React.useCallback(async (initialVolume = 1) => {
        const context = await unlockAudio(initialVolume);
        suspendWhenIdle(context);
        return context;
      }, [suspendWhenIdle, unlockAudio]);
      const stop = React.useCallback(() => {
        const current = work.current;
        current.stopped = true;
        current.controller?.abort();
        if (current.audio) { current.audio.pause(); current.audio.src = ''; }
        const now = current.context?.state !== 'closed' ? current.context?.currentTime : null;
        if (current.gain && current.context && now !== null) {
          try {
            const currentGain = Number(current.gain.gain.value) || 0;
            current.gain.gain.cancelScheduledValues(now);
            current.gain.gain.setValueAtTime(currentGain, now);
            current.gain.gain.linearRampToValueAtTime(0, now + STOP_FADE_SECONDS);
          } catch (error) { reportAudioLifecycleFailure('fade out', error); }
        }
        for (const source of current.sources) {
          try { source.stop(now === null ? undefined : now + STOP_FADE_SECONDS); } catch (error) { reportAudioLifecycleFailure('source stop', error); }
          try { source.onended = null; source.disconnect(); } catch (error) { reportAudioLifecycleFailure('source disconnect', error); }
        }
        window.speechSynthesis?.cancel();
        for (const url of current.urls) URL.revokeObjectURL(url);
        suspendWhenIdle(current.context);
        work.current = { controller: null, audio: null, context: current.context, gain: current.gain, sources: new Set(), urls: new Set(), stopped: false };
        reportAudioResources(current, 'stop');
        publish({ status: 'stopped', messageId: null, error: null });
      }, [publish, suspendWhenIdle]);
      const setOutputVolume = React.useCallback((value) => {
        const current = work.current;
        const gain = current.gain;
        const context = current.context;
        if (gain && context && context.state !== 'closed') {
          gain.gain.setTargetAtTime(value, context.currentTime, 0.015);
        }
      }, []);
      const play = React.useCallback(async (messageId, sentences, volume) => {
        if (!sentences.length) return false;
        // Keep the work object captured before the user-gesture unlock. Stop
        // or session replacement can reset work.current while resume() is
        // pending; the old request must not adopt that fresh object and start
        // playback after cancellation.
        const requestedWork = work.current;
        await unlockAudio(volume);
        if (work.current !== requestedWork || requestedWork.stopped) return false;
        const current = requestedWork;
        const controller = new AbortController();
        current.controller = controller;
        current.stopped = false;
        let nextStart = null;
        const scheduler = createWebAudioScheduler({ current, getNextStart: () => nextStart });
        const { waitForPlayback, waitForQueueCapacity } = scheduler;
        const streamRawAudio = async (text) => {
          const response = await localTtsTransport.stream(text, controller.signal);
          if (!response.ok) {
            const value = await response.json().catch(() => ({}));
            const error = new Error(value?.error?.message || 'Speech synthesis failed.');
            error.code = value?.error?.code;
            throw error;
          }
          if (!response.body) throw new Error('Speech synthesis returned no audio.');
          const context = current.context;
          const gain = current.gain;
          if (!context || context.state !== 'running' || !gain) throw new Error('Audio output is unavailable.');
          const reader = response.body.getReader();
          let pendingBytes = new Uint8Array(0);
          let receivedSamples = 0;
          if (nextStart === null) nextStart = context.currentTime + PLAYBACK_PREBUFFER_SECONDS;
          const schedulePcm = (bytes) => {
            const sampleCount = bytes.length / PCM_BYTES_PER_SAMPLE;
            const buffer = context.createBuffer(1, sampleCount, PCM_SAMPLE_RATE);
            const samples = buffer.getChannelData(0);
            pcmStreamHandler.decodeInto(bytes, samples);
            applyPcmEdgeRamp(samples);
            receivedSamples += sampleCount;
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(gain);
            source.onended = () => {
              current.sources.delete(source);
              try { source.disconnect(); } catch (error) { reportAudioLifecycleFailure('source disconnect', error); }
              reportAudioResources(current, 'source-ended');
            };
            current.sources.add(source);
            const startAt = Math.max(nextStart, context.currentTime + PLAYBACK_SCHEDULE_LEAD_SECONDS);
            source.start(startAt);
            nextStart = startAt + buffer.duration;
            publish({ status: 'playing', messageId, error: null });
          };
          const consumePcm = (incoming, final = false) => {
            let bytes = incoming;
            if (pendingBytes.length) {
              bytes = new Uint8Array(pendingBytes.length + incoming.length);
              bytes.set(pendingBytes);
              bytes.set(incoming, pendingBytes.length);
              pendingBytes = new Uint8Array(0);
            }
            const playableLength = pcmStreamHandler.playableLength(bytes);
            if (bytes.length % PCM_BYTES_PER_SAMPLE) {
              pendingBytes = bytes.slice(playableLength);
            }
            if (!playableLength) return;
            // HTTP chunking is arbitrary. Never schedule a few samples as a
            // separate source: it can click, jump, and create needless work.
            if (!final && playableLength < PLAYBACK_MIN_BUFFER_BYTES) {
              const held = new Uint8Array(pendingBytes.length + playableLength);
              held.set(bytes.subarray(0, playableLength));
              held.set(pendingBytes, playableLength);
              pendingBytes = held;
              return;
            }
            schedulePcm(bytes.subarray(0, playableLength));
          };
          try {
            while (true) {
              // Let fetch backpressure reach the server when inference gets
              // ahead of playback. This keeps AudioBufferSource allocation
              // bounded without sacrificing the startup safety buffer.
              await waitForQueueCapacity();
              if (current.stopped) break;
              const { done, value } = await reader.read();
              if (done) {
                if (pendingBytes.length % PCM_BYTES_PER_SAMPLE) throw new Error('Fairy returned an incomplete PCM frame.');
                if (!current.stopped && pendingBytes.length) consumePcm(new Uint8Array(0), true);
                break;
              }
              if (current.stopped) break;
              consumePcm(value);
            }
            if (receivedSamples === 0 && !current.stopped) throw new Error('Fairy returned empty audio.');
          } finally {
            reader.releaseLock();
          }
        };
        try {
          for (let index = 0; index < sentences.length; index += PLAYBACK_GROUP_SIZE) {
            publish({ status: 'loading', messageId, error: null });
            await streamRawAudio(sentences.slice(index, index + PLAYBACK_GROUP_SIZE).join('\n'));
            if (current.stopped) return false;
          }
          await waitForPlayback();
          if (current.stopped) return false;
          // A running AudioContext retains a render thread even with no
          // sources. Resume the same context on the next request instead of
          // leaving that idle work alive between replies.
          if (work.current === current && current.context?.state === 'running') {
            clearIdleSuspend();
            await current.context.suspend().catch((error) => reportAudioLifecycleFailure('suspend', error));
          }
          reportAudioResources(current, 'playback-idle');
          publish({ status: 'idle', messageId: null, error: null });
          return true;
        } catch (error) {
          if (controller.signal.aborted || current.stopped) return;
          publish({ status: 'error', messageId, error: error instanceof Error ? error.message : 'Speech synthesis failed.' });
          return false;
        }
      }, [clearIdleSuspend, publish, unlockAudio]);
      const playSystem = React.useCallback((messageId, sentences, volume) => {
        if (!sentences.length || !window.speechSynthesis) {
          publish({ status: 'error', messageId, error: 'System speech is unavailable in this browser.' });
          return Promise.resolve(false);
        }
        const current = work.current;
        let index = 0;
        return new Promise((resolve) => {
          const speakNext = () => {
            if (current.stopped) { resolve(false); return; }
            if (index >= sentences.length) {
              publish({ status: 'idle', messageId: null, error: null });
              resolve(true);
              return;
            }
            const utterance = new SpeechSynthesisUtterance(sentences[index]);
            const voices = window.speechSynthesis.getVoices();
            utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith('zh')) || null;
            utterance.lang = utterance.voice?.lang || 'zh-CN';
            utterance.volume = volume;
            utterance.onend = () => { index += 1; speakNext(); };
            utterance.onerror = () => {
              publish({ status: 'error', messageId, error: 'System speech playback failed.' });
              resolve(false);
            };
            publish({ status: 'playing', messageId, error: null });
            window.speechSynthesis.speak(utterance);
          };
          speakNext();
        });
      }, [publish]);
      React.useEffect(() => () => {
        const context = work.current.context;
        stop();
        clearIdleSuspend();
        context?.close().catch((error) => reportAudioLifecycleFailure('close', error));
      }, [clearIdleSuspend, stop]);
      return { state, play, playSystem, stop, primeAudio, setOutputVolume };
    }

    function VoiceController({ useSession, sessionId }) {
      const snapshot = useSession(readVoiceTimeline);
      const sessionKey = String(sessionId ?? snapshot.sessionKey ?? 'empty-chat');
      const activeSessions = activeSessionStore || emptyActiveSessionStore;
      const activeSelection = React.useSyncExternalStore(activeSessions.subscribe, activeSessions.getSnapshot, activeSessions.getSnapshot);
      const sessionActive = activeSelection.key === sessionKey;
      const { state, play, playSystem, stop, primeAudio, setOutputVolume } = usePlayer(sessionKey);
      // Auto-read is the product default. An explicit false remains respected.
      const [autoRead, setAutoRead] = React.useState(() => localStorage.getItem(SETTINGS_AUTO) !== 'false');
      const [volume, setVolume] = React.useState(() => clampVolume(localStorage.getItem(SETTINGS_VOLUME) || '1'));
      const [audioReady, setAudioReady] = React.useState(false);
      const [baselineReady, setBaselineReady] = React.useState(false);
      // Fairy is the only supported voice. Keeping this fixed avoids an accidental
      // fallback to a non-Fairy system voice from an old local preference.
      const engine = 'fairy';
      const availability = React.useSyncExternalStore(availabilityStore.subscribe, availabilityStore.getSnapshot, availabilityStore.getSnapshot);
      const seen = React.useRef(new Set());
      const autoReadRef = React.useRef(autoRead);
      autoReadRef.current = autoRead;
      const audioUnlocked = React.useRef(false);
      const prepareController = React.useRef(null);
      const prepareScope = React.useRef(null);
      const lifecycleEpoch = React.useRef(0);
      const activeIntent = React.useRef(null);
      const voiceBrainConfigured = React.useRef(false);
      // The initial status request races with the first settled answer on a
      // cold start. Keep its promise so a long final answer can wait for the
      // authoritative configuration instead of silently skipping the brief.
      const voiceBrainReady = React.useRef(Promise.resolve({ configured: false }));
      const timelineRef = React.useRef(snapshot);
      timelineRef.current = snapshot;
      const baseline = React.useRef({ key: null, timer: null, finalTimer: null, pendingFinal: null, signature: null, ready: false, baselineUserSeq: 0, lastUserSeq: 0, armedUserSeq: null });
      const autoMessageIds = React.useRef(new Set());
      const activeAutoMessageId = React.useRef(null);
      // Keep the newest process report instead of dropping it while an earlier
      // report is still being synthesized or played. Final answers always clear
      // this slot and preempt the report path.
      const pendingStatus = React.useRef(null);
      const autoRetryTimers = React.useRef(new Map());
      const autoRetryCounts = React.useRef(new Map());
      React.useLayoutEffect(() => {
        voiceTimelineStore.set(snapshot);
        return () => voiceTimelineStore.clear(snapshot);
      }, [snapshot]);
      const cancelPlayback = React.useCallback(() => {
        lifecycleEpoch.current += 1;
        activeIntent.current = null;
        prepareController.current?.abort();
        prepareController.current = null;
        prepareScope.current?.cancel('client-aborted');
        prepareScope.current = null;
        for (const timer of autoRetryTimers.current.values()) clearTimeout(timer);
        autoRetryTimers.current.clear();
        const finalState = baseline.current;
        if (finalState.finalTimer) clearTimeout(finalState.finalTimer);
        finalState.finalTimer = null;
        finalState.pendingFinal = null;
        stop();
      }, [stop]);
      React.useEffect(() => {
        if (!sessionActive) cancelPlayback();
        return activeSessions.subscribe(() => {
          if (activeSessions.getSnapshot().key !== sessionKey) cancelPlayback();
        });
      }, [activeSessions, sessionActive, activeSelection.epoch, sessionKey, cancelPlayback]);
      React.useEffect(() => { localStorage.setItem(SETTINGS_AUTO, String(autoRead)); if (!autoRead) cancelPlayback(); }, [autoRead, cancelPlayback]);
      React.useEffect(() => {
        localStorage.setItem(SETTINGS_VOLUME, String(volume));
        setOutputVolume(volume);
      }, [volume, setOutputVolume]);
      React.useEffect(() => {
        if (audioReady) return undefined;
        const unlockFromGesture = () => {
          if (audioUnlocked.current) return;
          audioUnlocked.current = true;
          primeAudio(volume).then(() => {
            setAudioReady(true);
          }).catch(() => { audioUnlocked.current = false; });
        };
        window.addEventListener('pointerdown', unlockFromGesture, { passive: true });
        window.addEventListener('keydown', unlockFromGesture, { passive: true });
        window.addEventListener('touchstart', unlockFromGesture, { passive: true });
        return () => {
          window.removeEventListener('pointerdown', unlockFromGesture);
          window.removeEventListener('keydown', unlockFromGesture);
          window.removeEventListener('touchstart', unlockFromGesture);
        };
      }, [audioReady, primeAudio, volume]);
      React.useEffect(() => {
        requestAvailability();
        const refresh = () => requestAvailability(true);
        const refreshWhenVisible = () => { if (document.visibilityState !== 'hidden') requestAvailability(); };
        window.addEventListener('pageshow', refresh);
        document.addEventListener('visibilitychange', refreshWhenVisible);
        return () => {
          window.removeEventListener('pageshow', refresh);
          document.removeEventListener('visibilitychange', refreshWhenVisible);
        };
      }, []);
      React.useEffect(() => {
        let alive = true;
        const update = (value) => {
          const next = { configured: value?.configured === true, model: value?.model || 'deepseek-v4-flash' };
          voiceBrainConfigured.current = next.configured;
          if (!alive) return;
        };
        const pending = getVoiceBrainStatus().then((value) => { update(value); return value; }).catch(() => {
          const value = { configured: false, model: 'deepseek-v4-flash' };
          update(value);
          return value;
        });
        voiceBrainReady.current = pending;
        const onConfig = (event) => update(event.detail);
        window.addEventListener(EVENT_BRAIN_CONFIG, onConfig);
        return () => { alive = false; window.removeEventListener(EVENT_BRAIN_CONFIG, onConfig); };
      }, []);
      const drainPendingStatus = React.useCallback(() => {
        const queued = pendingStatus.current;
        if (!queued) return;
        pendingStatus.current = null;
        setTimeout(() => {
          const selection = activeSessions.getSnapshot();
          if (selection.key !== sessionKey || activeIntent.current?.kind === 'final') return;
          if (activeIntent.current || prepareController.current) {
            pendingStatus.current = queued;
            return;
          }
          window.dispatchEvent(new CustomEvent(EVENT_PLAY, { detail: queued }));
        }, 0);
      }, [activeSessions, sessionKey]);
      React.useEffect(() => {
        const onPlay = async (event) => {
          const detail = event.detail || {};
          const selection = activeSessions.getSnapshot();
          if (detail.sessionKey !== sessionKey || selection.key !== sessionKey) return;
          const { messageId, markdown } = detail;
          const automatic = detail.auto === true;
          if (detail.stop) {
            pendingStatus.current = null;
            cancelPlayback();
            return;
          }
          const kind = detail.kind === 'status' ? 'status' : 'final';
          const priority = kind === 'status' ? 10 : 100;
          // A status report never interrupts an answer. If another status is
          // active, retain only the newest report and drain it after the active
          // intent reaches a terminal state instead of silently losing it.
          if (kind === 'status') {
            if (activeIntent.current?.kind === 'final') return;
            if (activeIntent.current?.priority >= priority || prepareController.current) {
              pendingStatus.current = { ...detail, sessionKey };
              return;
            }
          }
          if (kind === 'final') {
            pendingStatus.current = null;
            // stop() emits `stopped`. Reclaim automatic ownership only after
            // that event, then publish preparation for the current answer.
            cancelPlayback();
            const id = String(messageId || '');
            if (automatic && id) {
              // Claim the message only after the play event is received. This
              // keeps a dispatch/preparation failure retryable instead of
              // marking the final answer consumed before audio exists.
              seen.current.add(id);
              autoMessageIds.current.add(id);
              activeAutoMessageId.current = id;
            } else {
              activeAutoMessageId.current = null;
              if (id) autoMessageIds.current.delete(id);
            }
          }
          dispatchVoiceState({ status: kind === 'final' ? 'preparing' : 'loading', messageId, error: null, sessionKey });
          const requestScope = createVoiceRequestScope();
          const controller = requestScope.controller;
          prepareScope.current?.cancel('superseded');
          prepareScope.current = requestScope;
          prepareController.current = controller;
          const requestEpoch = ++lifecycleEpoch.current;
          const selectionEpoch = selection.epoch;
          const intent = { id: `${requestEpoch}:${String(messageId || kind)}`, kind, priority };
          activeIntent.current = intent;
          const isCurrentRequest = () => {
            const currentSelection = activeSessions.getSnapshot();
            return lifecycleEpoch.current === requestEpoch && !controller.signal.aborted
              && currentSelection.key === sessionKey && currentSelection.epoch === selectionEpoch;
          };
          const retryAutomatic = () => {
            if (!automatic || kind !== 'final' || !autoReadRef.current || !isCurrentRequest()) return;
            const id = String(messageId || '');
            const count = autoRetryCounts.current.get(id) || 0;
            if (!id || count >= 2 || autoRetryTimers.current.has(id)) return;
            autoRetryCounts.current.set(id, count + 1);
            seen.current.delete(id);
            const timer = setTimeout(() => {
              autoRetryTimers.current.delete(id);
              // EVENT_STATE is a UI notification, not the retry owner. In
              // particular, an error notification may arrive before this
              // timer is installed. Keep retry eligibility tied to the
              // session, generation, and intent map instead of a ref that UI
              // cleanup is allowed to clear.
              if (!isCurrentRequest() || !autoReadRef.current || !autoMessageIds.current.has(id)) return;
              activeAutoMessageId.current = id;
              window.dispatchEvent(new CustomEvent(EVENT_PLAY, { detail: { messageId: id, markdown, sessionKey, auto: true, retry: count + 1 } }));
            }, count === 0 ? 900 : 2400);
            autoRetryTimers.current.set(id, timer);
          };
          try {
            // Acquire browser playback permission, then suspend while text and
            // optional briefing are prepared. play() resumes immediately before
            // scheduling PCM, so preparation never holds an idle render thread.
            await primeAudio(volume);
            if (!isCurrentRequest()) return;
            audioUnlocked.current = true;
            setAudioReady(true);
            let speechMarkdown = markdown;
            // Only final, visibly long answers are sent to the optional cloud
            // brief endpoint. Process reports, reasoning, tools, and short
            // replies always remain local.
            if (kind === 'final' && Array.from(String(markdown || '')).length >= VOICE_BRIEF_THRESHOLD) {
              // Resolve the status race on cold start. The normal status
              // effect usually completes first; this bounded wait makes the
              // long-answer path deterministic without delaying short speech.
              await Promise.race([
                voiceBrainReady.current,
                new Promise((resolve) => requestScope.timeout(resolve, 1500))
              ]);
              if (!isCurrentRequest()) return;
              if (!voiceBrainConfigured.current) {
                const refreshed = await getVoiceBrainStatus().catch(() => ({ configured: false }));
                if (refreshed?.configured === true) {
                  voiceBrainConfigured.current = true;
                }
              }
            }
            if (kind === 'final' && voiceBrainConfigured.current && Array.from(String(markdown || '')).length >= VOICE_BRIEF_THRESHOLD) {
              dispatchVoiceState({ status: 'briefing', messageId, error: null, sessionKey });
              try {
                const brief = await createVoiceBrief(markdown, controller.signal);
                if (isCurrentRequest() && brief) speechMarkdown = brief;
              } catch (error) {
                if (controller.signal.aborted) return;
                // Voice continuity matters more than a cloud enhancement.
                // The visible answer is already authoritative, so fallback is local.
                dispatchVoiceState({ status: 'brief-fallback', messageId, error: error?.message || 'Voice brief unavailable.', sessionKey });
              }
            }
            if (!isCurrentRequest()) return;
            const sentences = await prepare(speechMarkdown, controller.signal);
            if (!isCurrentRequest()) return;
            if (!sentences.length) {
              if (automatic) retryAutomatic();
              dispatchVoiceState({ status: 'error', messageId, error: '没有可朗读的文本。', sessionKey });
              return;
            }
            const played = engine === 'system'
              ? await playSystem(messageId, sentences, volume)
              : await play(messageId, sentences, volume);
            if (played !== true) retryAutomatic();
          } catch (error) {
            if (controller.signal.aborted) return;
            if (error?.code === 'local-service-unavailable') {
              const value = {
                available: false,
                reason: '本地 Fairy 服务未启动。',
              };
              publishAvailability(value);
            }
            dispatchVoiceState({ status: 'error', messageId, error: error?.message || 'Speech preparation failed.', sessionKey });
            retryAutomatic();
          } finally {
            if (prepareController.current === controller) prepareController.current = null;
            if (activeIntent.current === intent) activeIntent.current = null;
            if (prepareScope.current === requestScope) {
              requestScope.cancel('request-complete');
              prepareScope.current = null;
            }
            if (kind === 'status') drainPendingStatus();
          }
        };
        window.addEventListener(EVENT_PLAY, onPlay);
        return () => { pendingStatus.current = null; prepareScope.current?.cancel('effect-cleanup'); prepareScope.current = null; prepareController.current = null; for (const timer of autoRetryTimers.current.values()) clearTimeout(timer); autoRetryTimers.current.clear(); window.removeEventListener(EVENT_PLAY, onPlay); };
      }, [activeSessions, cancelPlayback, drainPendingStatus, engine, play, playSystem, primeAudio, sessionKey, volume]);
      React.useEffect(() => {
        const onState = (event) => {
          const detail = event.detail || {};
          if (detail.sessionKey !== sessionKey) return;
          if (['idle', 'stopped'].includes(detail.status) && activeAutoMessageId.current) {
            const id = activeAutoMessageId.current;
            autoMessageIds.current.delete(activeAutoMessageId.current);
            activeAutoMessageId.current = null;
            if (detail.status === 'idle') autoRetryCounts.current.delete(id);
          }
          if (['idle', 'error'].includes(detail.status)) drainPendingStatus();
        };
        window.addEventListener(EVENT_STATE, onState);
        return () => window.removeEventListener(EVENT_STATE, onState);
      }, [sessionKey]);
      React.useEffect(() => {
        const state = baseline.current;
        const signature = `${snapshot.userSeq}:${snapshot.found.map((message) => message.id).join('|')}:${snapshot.currentTurnFinals.map((message) => message.id).join('|')}`;
        if (state.key !== sessionKey) {
          if (state.timer) clearTimeout(state.timer);
          cancelPlayback();
          seen.current = new Set();
          autoMessageIds.current.clear();
          activeAutoMessageId.current = null;
          pendingStatus.current = null;
          setBaselineReady(false);
          baseline.current = { key: sessionKey, timer: null, finalTimer: null, pendingFinal: null, signature: null, ready: false, baselineUserSeq: snapshot.userSeq, lastUserSeq: snapshot.userSeq, armedUserSeq: null };
        }
        const current = baseline.current;
        if (current.ready) return;
        // During cold start and a session switch, every lazily arriving message is
        // historical. Only a user message created after this baseline can arm auto-read.
        for (const message of snapshot.found) seen.current.add(message.id);
        current.baselineUserSeq = Math.max(current.baselineUserSeq, snapshot.userSeq);
        current.lastUserSeq = snapshot.userSeq;
        if (current.signature === signature) return;
        current.signature = signature;
        if (current.timer) clearTimeout(current.timer);
        current.timer = setTimeout(() => {
          if (baseline.current !== current || current.key !== sessionKey) return;
          current.timer = null;
          current.ready = true;
          setBaselineReady(true);
        }, SESSION_BASELINE_SETTLE_MS);
      }, [cancelPlayback, sessionKey, snapshot.found, snapshot.currentTurnFinals, snapshot.userSeq]);
      React.useEffect(() => {
        const current = baseline.current;
        if (current.key !== sessionKey || !current.ready) return;
        if (snapshot.userSeq > current.lastUserSeq) {
          current.lastUserSeq = snapshot.userSeq;
          current.armedUserSeq = snapshot.userSeq;
          cancelPlayback();
        }
      }, [cancelPlayback, sessionKey, snapshot.userSeq, baselineReady]);
      React.useEffect(() => {
        const current = baseline.current;
        if (!sessionActive || current.key !== sessionKey || !current.ready) return;
        // A render can contain both the new user sequence and a settled
        // assistant node. Do not consume anything until the user-turn effect
        // has armed this sequence; importantly, never mark it as seen here.
        if (current.armedUserSeq !== snapshot.userSeq) return;
        if (!autoRead || (engine !== 'system' && !availability.available)) return;

        // Only a closed turn's official closing final may trigger automatic
        // playback. Never infer a final answer from the last settled
        // assistant-step: search/thinking/tool turns can settle several such
        // nodes before the actual answer is emitted.
        const candidate = [...snapshot.currentTurnFinals].reverse().find((message) => !seen.current.has(message.id) && !autoMessageIds.current.has(message.id));
        if (!candidate) return;
        const pending = current.pendingFinal;
        if (!pending || pending.id !== candidate.id) {
          if (current.finalTimer) clearTimeout(current.finalTimer);
          current.pendingFinal = { ...candidate, userSeq: snapshot.userSeq };
          current.finalTimer = null;
        }

        // Defer dispatch briefly so the closed-turn projection and the
        // rendered answer settle together. Activity is intentionally not used
        // as a timeout-based final detector: a running flag cannot promote an
        // intermediate assistant-step into a final answer.
        if (!current.finalTimer) {
          const schedule = (delay) => {
            current.finalTimer = setTimeout(() => {
              current.finalTimer = null;
              const selection = activeSessions.getSnapshot();
              if (baseline.current !== current || current.key !== sessionKey
                || selection.key !== sessionKey || selection.epoch !== activeSelection.epoch) return;
              const latest = timelineRef.current;
              const final = current.pendingFinal;
              if (!final || latest.userSeq !== final.userSeq || current.armedUserSeq !== latest.userSeq) {
                current.pendingFinal = null;
                return;
              }
              const stillAuthoritative = latest.currentTurnFinals.some((message) => message.id === final.id);
              if (!stillAuthoritative) {
                current.pendingFinal = null;
                return;
              }
              current.pendingFinal = null;
              autoMessageIds.current.add(final.id);
              activeAutoMessageId.current = final.id;
              current.armedUserSeq = null;
              window.dispatchEvent(new CustomEvent(EVENT_PLAY, { detail: { messageId: final.id, markdown: final.markdown, sessionKey, auto: true } }));
            }, delay);
          };
          schedule(FINAL_PLAYBACK_SETTLE_MS);
        }
      }, [activeSelection.epoch, sessionActive, sessionKey, snapshot.currentTurnFinals, snapshot.userSeq, autoRead, engine, availability.available, audioReady, baselineReady]);
      React.useEffect(() => () => {
        const current = baseline.current;
        if (current.timer) clearTimeout(current.timer);
        cancelPlayback();
      }, [cancelPlayback]);
      React.useEffect(() => {
        window.addEventListener('pagehide', cancelPlayback);
        const cancelWhenHidden = () => { if (document.visibilityState === 'hidden') cancelPlayback(); };
        document.addEventListener('visibilitychange', cancelWhenHidden);
        return () => {
          window.removeEventListener('pagehide', cancelPlayback);
          document.removeEventListener('visibilitychange', cancelWhenHidden);
        };
      }, [cancelPlayback]);
      useVoiceBrain({
        sessionKey,
        timeline: snapshot,
        baselineReady,
        autoRead: autoRead && sessionActive,
        audioReady,
        available: engine === 'system' || availability.available
      });
      const autoLabel = autoRead ? '关闭自动朗读' : '开启自动朗读';
      const engineAvailable = engine === 'system' || availability.available;
      // Fixed irregular heights avoid a visible repeating cadence while keeping
      // React renders deterministic and free from animation jitter.
      const waveHeights = [6, 11, 8, 14, 10, 5, 13, 9, 14, 7, 12, 13, 6, 10, 14, 8, 13, 5, 11, 9, 13, 7, 10, 14, 6, 12, 8, 11, 5, 13];
      const waveform = waveHeights.map((height, index) => {
        const active = index / (waveHeights.length - 1) <= volume;
        return jsx.jsx('span', { className: 'dsh-fairy-voice-wave-bar', 'data-dsh-fairy-wave-bar': 'true', 'data-active': active ? 'true' : 'false', style: { '--dsh-fairy-wave-height': `${height}px`, '--dsh-fairy-wave-opacity': active ? '.86' : '.22' }, 'aria-hidden': 'true', key: index });
      });
      return jsx.jsxs('span', { className: 'dsh-fairy-voice-controls', role: 'group', 'aria-label': 'Fairy 朗读控制', [FAIRY_VOICE_CONTROL_ATTRIBUTE]: 'true', children: [
        jsx.jsx(Tooltip, { label: engineAvailable ? autoLabel : availability.reason, children: jsx.jsx('button', { type: 'button', className: 'dsh-fairy-voice-auto', 'data-dsh-fairy-auto-control': 'true', 'data-on': autoRead ? 'true' : 'false', disabled: !engineAvailable, onClick: () => setAutoRead((value) => !value), 'aria-label': autoLabel, 'aria-pressed': autoRead, children: jsx.jsx('span', { className: 'dsh-fairy-voice-auto-dot', 'data-dsh-fairy-auto-dot': 'true', 'aria-hidden': 'true' }) }) }),
        jsx.jsx('span', { className: 'dsh-fairy-voice-waveform', 'data-dsh-fairy-waveform': 'true', 'aria-hidden': 'true', children: waveform }),
        jsx.jsx(Tooltip, { label: `语音音量 ${Math.round(volume * 100)}%`, children: jsx.jsx('input', { className: 'dsh-fairy-voice-volume', 'data-dsh-fairy-volume-input': 'true', disabled: !engineAvailable, min: '0', max: '1', step: '0.05', type: 'range', value: volume, onChange: (event) => setVolume(Number(event.target.value)), 'aria-label': '语音音量', style: { '--dsh-fairy-volume': `${Math.round(volume * 100)}%` } }) }),
        engine === 'fairy' && state.status === 'error' ? jsx.jsx('span', { title: state.error, style: { color: 'var(--dsw-alias-state-error-primary)', fontSize: '12px', maxWidth: '96px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: '朗读失败' }) : null
      ] });
    }

    function useHddVisualMode() {
      const readMode = () => document.documentElement?.hasAttribute('data-dsh-fairy-visual') === true;
      return React.useSyncExternalStore((notify) => {
        // The visual plugin owns this document attribute. Observing that one
        // source keeps the Voice slot in lockstep without coupling to its
        // settings store or duplicating its mode state.
        if (typeof MutationObserver !== 'function' || !document.documentElement) return () => {};
        const observer = new MutationObserver(notify);
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-dsh-fairy-visual'],
        });
        return () => observer.disconnect();
      }, readMode, readMode);
    }

    function SessionScopedVoiceController(props) {
      const hddVisualMode = useHddVisualMode();
      // In normal DSH mode this slot has no Voice surface or controller
      // lifecycle at all. Switching back to HDD mounts a fresh, session-keyed
      // controller, so mode changes cannot retain audio or DOM ownership.
      if (!hddVisualMode) return null;
      // Force a clean controller/ref lifecycle when DSH changes the active
      // session. This prevents playback and seen-message state leaking across
      // conversation providers during the transition frame.
      return jsx.jsx(VoiceController, { ...props, key: String(props.sessionId ?? 'empty-chat') });
    }

    function MessageAction({ messageId, sessionId }) {
      const conversation = React.useSyncExternalStore(voiceTimelineStore.subscribe, voiceTimelineStore.getSnapshot, voiceTimelineStore.getSnapshot);
      const sessionKey = String(sessionId ?? activeSessionStore?.getSnapshot().key ?? 'empty-chat');
      const message = conversation.sessionKey === sessionKey
        ? conversation.messagesById.get(String(messageId))
        : undefined;
      const [state, setState] = React.useState(() => readVoiceState(sessionKey));
      const availability = React.useSyncExternalStore(availabilityStore.subscribe, availabilityStore.getSnapshot, availabilityStore.getSnapshot);
      const engine = 'fairy';
      React.useLayoutEffect(() => {
        setState(readVoiceState(sessionKey));
        const listener = (event) => { if (event.detail?.sessionKey === sessionKey) setState(event.detail); };
        window.addEventListener(EVENT_STATE, listener);
        return () => window.removeEventListener(EVENT_STATE, listener);
      }, [sessionKey]);
      if (!message) return null;
      const active = state.messageId === String(messageId) && ['preparing', 'briefing', 'brief-fallback', 'loading', 'playing'].includes(state.status);
      const enabled = engine === 'system' || availability.available;
      const label = enabled ? (active ? '停止朗读' : '朗读回复') : availability.reason;
      return jsx.jsx(Tooltip, { label, children: jsx.jsx('button', {
        type: 'button', disabled: !enabled, onClick: () => active ? window.dispatchEvent(new CustomEvent(EVENT_PLAY, { detail: { sessionKey, stop: true } })) : window.dispatchEvent(new CustomEvent(EVENT_PLAY, { detail: { sessionKey, messageId: message.id, markdown: message.markdown } })),
        style: iconButton, 'aria-label': label, children: active ? jsx.jsx(IconStopFill16, { size: 16 }) : jsx.jsx(IconPlayOutline16, { size: 16 })
      }) });
    }

    function injectVoiceSlot(ctx, name, definition, component) {
      let disposeRegistration = null;
      const releaseRegistration = () => {
        const dispose = disposeRegistration;
        disposeRegistration = null;
        dispose?.();
      };
      return ctx.slots.inject(name, () => {
        // Slot providers may be invoked again when the official node is
        // replaced or the client bundle is reloaded. Release the prior
        // registration before publishing the replacement.
        releaseRegistration();
        const registration = ctx.slots.register({ name, ...definition }, component);
        disposeRegistration = typeof registration === 'function' ? registration : null;
        return releaseRegistration;
      });
    }

    function apply(ctx) {
      return diagnostics.guard('apply', () => {
      ensureVoiceControlStyles();
      const activeSessions = createActiveSessionStore(ctx.sessions);
      activeSessionStore = activeSessions;
      ctx.effect(() => () => {
        activeSessions.dispose();
        if (activeSessionStore === activeSessions) activeSessionStore = null;
        clearVoiceSessionStates();
        voiceTimelineStore.clear();
        disposeAvailability();
        document.getElementById(VOICE_STYLE_ID)?.remove();
      }, 'dsh-fairy-voice session lifecycle');
      const slotDisposers = [
        injectVoiceSlot(ctx, 'conversation.input.left', { name: 'conversation.input.left', id: 'fairy-voice-controller', order: 40 }, SessionScopedVoiceController),
        injectVoiceSlot(ctx, 'conversation.chat.assistant-actions', { id: 'fairy-voice-message-action', order: 20 }, MessageAction),
        injectVoiceSlot(ctx, 'settings.section', { id: 'fairy-voice-brain', order: 30, label: () => '语音简报' }, VoiceBrainSection),
      ].filter((dispose) => typeof dispose === 'function');
      ctx.effect(() => () => slotDisposers.forEach((dispose) => dispose()), 'dsh-fairy-voice slot registrations');
      }, { surface: 'client' });
    }

    return { apply, inject: ['slots', 'sessions'] };
  }
});
