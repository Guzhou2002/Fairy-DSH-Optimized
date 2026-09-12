export const FAIRY_LOG_PREFIX = 'DSH_FAIRY_LOG';
export const FAIRY_LOG_SCHEMA_VERSION = 1;

const SENSITIVE_KEY = /authorization|credential|password|secret|token|api[_-]?key|cookie/i;
const MAX_STRING_LENGTH = 320;

function safeString(value) {
  const text = String(value ?? '');
  return text.length > MAX_STRING_LENGTH ? `${text.slice(0, MAX_STRING_LENGTH)}…` : text;
}

function sanitize(value, key = '', depth = 0) {
  if (SENSITIVE_KEY.test(key)) return '[redacted]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return safeString(value);
  if (depth >= 2) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => sanitize(item, '', depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 24).map(([name, item]) => [name, sanitize(item, name, depth + 1)]));
  }
  return safeString(value);
}

export function normalizeFairyError(error) {
  if (!error) return undefined;
  return {
    name: safeString(error.name || 'Error'),
    code: error.code == null ? undefined : safeString(error.code),
    message: safeString(error.message || error),
  };
}

export function createFairyDiagnostics(moduleName, {
  sink = console,
  wallClock = () => new Date().toISOString(),
  monotonicClock = () => globalThis.performance?.now?.() ?? Date.now(),
  dedupeWindowMs = 60_000,
} = {}) {
  const recentErrors = new Map();
  const module = safeString(moduleName);
  const start = () => monotonicClock();
  const emit = (level, operation, event, context, error, durationMs) => {
    const normalizedError = normalizeFairyError(error);
    if (normalizedError) {
      const signature = `${operation}:${normalizedError.code || normalizedError.message}`;
      const now = Date.now();
      if (now - (recentErrors.get(signature) || 0) < dedupeWindowMs) return null;
      recentErrors.set(signature, now);
    }
    const record = {
      schema: FAIRY_LOG_SCHEMA_VERSION,
      timestamp: wallClock(),
      level,
      module,
      operation: safeString(operation),
      event,
      context: sanitize(context || {}),
      ...(normalizedError ? { error: normalizedError } : {}),
      ...(Number.isFinite(durationMs) ? { duration_ms: Number(durationMs.toFixed(3)) } : {}),
    };
    const output = `${FAIRY_LOG_PREFIX} ${JSON.stringify(record)}`;
    const writer = level === 'error' ? sink.error : level === 'warn' ? sink.warn : sink.info || sink.log;
    writer.call(sink, output);
    return record;
  };
  const metric = (operation, startedAt, context = {}, { thresholdMs = 0 } = {}) => {
    const duration = monotonicClock() - startedAt;
    if (duration < thresholdMs) return null;
    return emit('info', operation, 'metric', context, undefined, duration);
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
  const guardAsync = async (operation, callback, context = {}) => {
    const startedAt = start();
    try {
      const result = await callback();
      metric(operation, startedAt, { ...context, outcome: 'success' });
      return result;
    } catch (error) {
      emit('error', operation, 'failure', context, error);
      metric(operation, startedAt, { ...context, outcome: 'failure' });
      throw error;
    }
  };
  return {
    start,
    metric,
    guard,
    guardAsync,
    info: (operation, context) => emit('info', operation, 'event', context),
    warn: (operation, context, error) => emit('warn', operation, 'failure', context, error),
    error: (operation, error, context) => emit('error', operation, 'failure', context, error),
  };
}
