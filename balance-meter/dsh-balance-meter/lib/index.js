import { chmodSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createFairyDiagnostics } from '../vendor/diagnostics.js';

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh');
const BALANCE_URL = 'https://api.deepseek.com/user/balance';
const BALANCE_TTL_MS = 60_000;
const BALANCE_TIMEOUT_MS = 10_000;
const DAILY_FILE = join(DSH_HOME, 'balance-meter-daily.json');
const diagnostics = createFairyDiagnostics('dsh-balance-meter');

function tokenCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

/** Read the DeepSeek API key on the server only; its value is never logged or returned. */
function parseApiKey(content) {
  const match = String(content).match(/DEEPSEEK_API_KEY:\s*(?:'([^']+)'|"([^"]+)"|([^'"\s]+))/);
  return match ? match[1] ?? match[2] ?? match[3] : undefined;
}

function readApiKey() {
  try {
    const content = readFileSync(join(DSH_HOME, '.credentials.yaml'), 'utf8');
    return parseApiKey(content);
  } catch {
    return undefined;
  }
}

let cachedBalance = null;
let cachedAt = 0;
let balanceRequest = null;
let activeBalanceController = null;
const appliedContexts = new WeakSet();

async function getBalance() {
  if (cachedBalance && Date.now() - cachedAt < BALANCE_TTL_MS) return cachedBalance;
  if (balanceRequest) return balanceRequest;

  const controller = new AbortController();
  const startedAt = diagnostics.start();
  activeBalanceController = controller;
  const request = (async () => {
    const key = readApiKey();
    if (!key) return { is_available: false };
    const timeout = setTimeout(() => controller.abort('timeout'), BALANCE_TIMEOUT_MS);
    try {
      const response = await fetch(BALANCE_URL, {
        headers: { Authorization: `Bearer ${key}` },
        signal: controller.signal,
      });
      if (!response.ok) return { is_available: false };
      cachedBalance = await response.json();
      cachedAt = Date.now();
      return cachedBalance;
    } catch (error) {
      if (error?.name !== 'AbortError' || controller.signal.reason === 'timeout') {
        diagnostics.warn('balance.fetch', { reason: controller.signal.reason || 'request-failed' }, error);
      }
      return { is_available: false };
    } finally {
      clearTimeout(timeout);
      diagnostics.metric('balance.fetch', startedAt, { aborted: controller.signal.aborted });
    }
  })();
  balanceRequest = request;

  try {
    return await request;
  } finally {
    if (activeBalanceController === controller) activeBalanceController = null;
    if (balanceRequest === request) balanceRequest = null;
  }
}

function disposeBalanceRequests() {
  activeBalanceController?.abort('disposed');
  activeBalanceController = null;
  balanceRequest = null;
}

const PRICING_MODEL = 'deepseek-v4-flash';
const PRICING_VERSION = 'deepseek-v4-flash-2026-08-26';
const PRICING_VERIFIED_DATE = '2026-08-26';
const PRICING_SOURCE_URL = 'https://api-docs.deepseek.com/quick_start/pricing/';
const USD_TO_CNY_ESTIMATE = 7.2;
const USD_PER_MILLION = Object.freeze({
  offPeak: Object.freeze({ cacheHit: 0.007, cacheMiss: 0.22, output: 0.66 }),
  peak: Object.freeze({ cacheHit: 0.014, cacheMiss: 0.44, output: 1.32 }),
});

export function pricingBandForDate(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(value.getTime())) return 'offPeak';
  const day = value.getUTCDay();
  const hour = value.getUTCHours();
  const weekday = day >= 1 && day <= 5;
  return weekday && ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10)) ? 'peak' : 'offPeak';
}

export function estimateUsageUsd(usage, date = new Date()) {
  const rate = USD_PER_MILLION[pricingBandForDate(date)];
  return (
    tokenCount(usage?.cacheReadTokens) * rate.cacheHit
    + (tokenCount(usage?.inputTokens) + tokenCount(usage?.cacheWriteTokens)) * rate.cacheMiss
    + tokenCount(usage?.outputTokens) * rate.output
  ) / 1_000_000;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

let todayKey = localDateKey();
let todayInput = 0;
let todayOutput = 0;
let todayCacheRead = 0;
let todayCacheWrite = 0;
let todayEstimatedUsd = 0;
let todayEstimateComplete = true;
let dailyPersistenceError = null;

function reportDailyPersistenceError(operation, error) {
  const signature = `${operation}:${error?.code || error?.message || 'unknown'}`;
  if (dailyPersistenceError === signature) return;
  dailyPersistenceError = signature;
  diagnostics.error(`persistence.${operation.replaceAll(' ', '-')}`, error, { file: 'balance-meter-daily.json' });
}

function loadDaily() {
  try {
    const data = JSON.parse(readFileSync(DAILY_FILE, 'utf8'));
    chmodSync(DAILY_FILE, 0o600);
    if (data.date === todayKey) {
      todayInput = tokenCount(data.inputTokens);
      todayOutput = tokenCount(data.outputTokens);
      todayCacheRead = tokenCount(data.cacheReadTokens);
      todayCacheWrite = tokenCount(data.cacheWriteTokens);
      const storedEstimate = Number(data.estimatedCostUsd);
      if (data.pricingVersion === PRICING_VERSION && Number.isFinite(storedEstimate) && storedEstimate >= 0) {
        todayEstimatedUsd = storedEstimate;
        todayEstimateComplete = data.estimateComplete !== false;
      } else {
        todayEstimatedUsd = estimateUsageUsd({
          inputTokens: todayInput,
          outputTokens: todayOutput,
          cacheReadTokens: todayCacheRead,
          cacheWriteTokens: todayCacheWrite,
        });
        todayEstimateComplete = todayTokens() === 0;
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') reportDailyPersistenceError('daily usage load', error);
  }
}

function saveDaily() {
  const temporary = `${DAILY_FILE}.${process.pid}.tmp`;
  try {
    const value = JSON.stringify({
      date: todayKey,
      inputTokens: todayInput,
      outputTokens: todayOutput,
      cacheReadTokens: todayCacheRead,
      cacheWriteTokens: todayCacheWrite,
      estimatedCostUsd: todayEstimatedUsd,
      estimateComplete: todayEstimateComplete,
      pricingVersion: PRICING_VERSION,
    });
    writeFileSync(temporary, value, { encoding: 'utf8', mode: 0o600 });
    renameSync(temporary, DAILY_FILE);
    chmodSync(DAILY_FILE, 0o600);
    dailyPersistenceError = null;
  } catch (error) {
    reportDailyPersistenceError('daily usage save', error);
    try {
      unlinkSync(temporary);
    } catch (cleanupError) {
      if (cleanupError?.code !== 'ENOENT') reportDailyPersistenceError('temporary daily usage cleanup', cleanupError);
    }
  }
}

function rollDay() {
  const key = localDateKey();
  if (key === todayKey) return;
  todayKey = key;
  todayInput = 0;
  todayOutput = 0;
  todayCacheRead = 0;
  todayCacheWrite = 0;
  todayEstimatedUsd = 0;
  todayEstimateComplete = true;
  saveDaily();
}

function todayTokens() {
  return todayInput + todayOutput + todayCacheRead + todayCacheWrite;
}

function todayCostCny() {
  return todayEstimatedUsd * USD_TO_CNY_ESTIMATE;
}

export function apply(ctx) {
  return diagnostics.guard('apply', () => {
  if (appliedContexts.has(ctx)) return;
  appliedContexts.add(ctx);
  loadDaily();
  ctx.effect(() => () => {
    disposeBalanceRequests();
    appliedContexts.delete(ctx);
  }, 'dsh-balance-meter request lifecycle');

  ctx.on('session/event', (_session, event) => {
    if (event?.type !== 'assistant/message' || !event.data?.usage) return;
    rollDay();
    const usage = event.data.usage;
    todayInput += tokenCount(usage.inputTokens);
    todayOutput += tokenCount(usage.outputTokens);
    todayCacheRead += tokenCount(usage.cacheReadTokens);
    todayCacheWrite += tokenCount(usage.cacheWriteTokens);
    todayEstimatedUsd += estimateUsageUsd(usage, event.time ?? new Date());
    saveDaily();
  });

  ctx.inject(['webServer'], (ws) => {
    ws.effect(() => ws.webServer.register({
      kind: 'exact',
      path: '/balance-meter',
      handler: async (_req, res) => {
        rollDay();
        const balance = await getBalance();
        if (res.writableEnded || res.destroyed) return;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({
          balance,
          todayTokens: todayTokens(),
          todayCost: todayCostCny(),
          pricing: {
            model: PRICING_MODEL,
            verifiedDate: PRICING_VERIFIED_DATE,
            sourceUrl: PRICING_SOURCE_URL,
            band: pricingBandForDate(),
            usdToCnyEstimate: USD_TO_CNY_ESTIMATE,
            estimateComplete: todayEstimateComplete,
          },
        }));
      },
    }));
  });
  }, { surface: 'host' });
}
