// Fairy-DSH 设置面板探针：无头 Chrome 打开 DSH Web UI，走进 设置 → Fairy，
// 点「开始自检」，把面板真实渲染出来的内容与客户端诊断读回来。
//
// 用法： node settings-probe.mjs <url> [--shot <path>] [--keep]
// 依赖：本机 Chrome（可用 CHROME_PATH 环境变量覆盖）
//
// 它验证的是"使用者真的能看到什么"，而不是"代码里写了什么"。
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2];
if (!url) {
  console.error('usage: node settings-probe.mjs <url> [--shot <path>]');
  process.exit(2);
}
const shotIndex = process.argv.indexOf('--shot');
const shot = shotIndex > -1 ? process.argv[shotIndex + 1] : null;
const PORT = Number(process.env.PROBE_PORT ?? 9344);
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'fairy-settings-probe-'))}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1440,1200',
  url,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageTarget() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch { /* chrome 还在启动 */ }
    await sleep(300);
  }
  throw new Error('DevTools 端点未就绪');
}

const page = await pageTarget();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const exceptions = [];
const consoleLines = [];

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id !== undefined) {
    const entry = pending.get(msg.id);
    if (entry) {
      pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
      else entry.resolve(msg.result);
    }
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    consoleLines.push(`${msg.params.type}: ${(msg.params.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(' ')}`);
  }
});

const send = (method, params = {}) => {
  const id = (nextId += 1);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
};

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'evaluate failed');
  return result.result?.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url });

/** 等到页面真正渲染出内容（DSH 的启动较慢）。 */
for (let i = 0; i < 60; i += 1) {
  await sleep(500);
  const ready = await evaluate('document.body ? document.body.innerText.trim().length : 0').catch(() => 0);
  if (ready > 40) break;
}
await sleep(3000);

const steps = [];

/** 点击第一个文本/aria-label 命中的可点元素。 */
const clickByText = async (label, extraSelector = '') => {
  const clicked = await evaluate(`(() => {
    const wanted = ${JSON.stringify(label)};
    const nodes = [...document.querySelectorAll('button, [role="button"], [role="tab"], a, li, div[tabindex]')];
    const hit = nodes.find((el) => {
      const text = ((el.getAttribute('aria-label') || '') + ' ' + (el.innerText || '')).trim();
      const visible = el.offsetParent !== null || el.getClientRects().length > 0;
      return visible && text.includes(wanted);
    });
    if (!hit) return null;
    hit.click();
    return ((hit.getAttribute('aria-label') || '') + ' ' + (hit.innerText || '')).trim().slice(0, 60);
  })()`);
  steps.push({ click: label, hit: clicked });
  if (clicked && extraSelector) {
    for (let i = 0; i < 20; i += 1) {
      await sleep(400);
      const seen = await evaluate(`!!document.querySelector(${JSON.stringify(extraSelector)})`);
      if (seen) return true;
    }
  }
  await sleep(1200);
  return Boolean(clicked);
};

// 1) 打开设置
await clickByText('设置');
// 2) 进入 Fairy 分区（合并后的设置栏标签）
await clickByText('Fairy');
const panelFound = await evaluate('!!document.querySelector("[data-dsh-fairy-voice-panel]")');
steps.push({ panelFound });

// 3) 点开始自检
const clickedSelfCheck = await evaluate(`(() => {
  const button = document.querySelector('[data-dsh-fairy-selfcheck]');
  if (!button) return false;
  button.click();
  return true;
})()`);
steps.push({ clickedSelfCheck });

// 4) 等自检跑完（没有 SoVITS 时会很快失败）
let status = null;
for (let i = 0; i < 60; i += 1) {
  await sleep(1000);
  status = await evaluate(`(() => {
    const bar = document.querySelector('[data-dsh-fairy-voice-status]');
    if (!bar) return null;
    const text = bar.innerText.trim();
    return { state: bar.getAttribute('data-dsh-fairy-voice-status'), text, running: text.includes('正在自检') };
  })()`);
  if (status && status.running === false && status.text.length > 0) break;
}

const report = await evaluate(`(() => {
  const bar = document.querySelector('[data-dsh-fairy-voice-status]');
  const checks = [...document.querySelectorAll('[data-dsh-fairy-check]')].map((node) => ({
    id: node.getAttribute('data-dsh-fairy-check'),
    level: node.getAttribute('data-level'),
    text: node.innerText.trim().replace(/\\n+/g, ' | ')
  }));
  const configPanel = document.querySelector('[data-dsh-fairy-tts-url]');
  const refAudio = document.querySelector('[data-dsh-fairy-ref-audio]');
  const saveButton = document.querySelector('[data-dsh-fairy-save-config]');
  return {
    statusBar: bar ? { state: bar.getAttribute('data-dsh-fairy-voice-status'), text: bar.innerText.trim() } : null,
    checks,
    hasTtsUrlField: Boolean(configPanel),
    ttsUrlValue: configPanel ? configPanel.value : null,
    hasRefAudioField: Boolean(refAudio),
    refAudioValue: refAudio ? refAudio.value : null,
    hasSaveButton: Boolean(saveButton),
    copyButtonPresent: document.body.innerText.includes('复制诊断信息'),
    voiceDiag: window.__FAIRY_VOICE_DIAG__ ?? null,
    voiceControlStyle: Boolean(document.getElementById('dsh-fairy-voice-controls-style')),
    panelHeadings: (() => {
      const panel = document.querySelector('[data-dsh-fairy-voice-panel]');
      return panel ? [...panel.querySelectorAll('h3')].map((h) => h.innerText.trim()) : null;
    })(),
    onboardingBox: (() => {
      const box = document.querySelector('[data-dsh-fairy-onboarding]');
      return box ? { kind: box.getAttribute('data-dsh-fairy-onboarding'), text: box.innerText.trim().replace(/\\n+/g, ' | ') } : null;
    })(),
    setupBadge: (() => {
      const trigger = document.querySelector('[data-slot="settings.trigger"]');
      const notice = document.getElementById('dsh-fairy-setup-notice');
      return {
        rootAttr: document.documentElement.getAttribute('data-dsh-fairy-setup'),
        noticeText: notice ? notice.innerText.trim().replace(/\\n+/g, ' | ') : null,
        dotContent: trigger ? getComputedStyle(trigger, '::after').content : null,
      };
    })(),
    defaultPresetButton: (() => {
      const button = document.querySelector('[data-dsh-fairy-default-preset]');
      return button ? { text: button.innerText.trim(), disabled: button.disabled } : null;
    })(),
    defaultPresetState: (() => {
      const node = document.querySelector('[data-dsh-fairy-default-state]');
      return node ? { state: node.getAttribute('data-dsh-fairy-default-state'), text: node.innerText.trim() } : null;
    })(),
    shell: {
      visualAttr: document.documentElement.hasAttribute('data-dsh-fairy-visual'),
      modeAttr: document.documentElement.getAttribute('data-dsh-fairy-mode'),
      hasInputLeftSlot: Boolean(document.querySelector('[data-slot="conversation.input.left"]')),
      slotNames: [...document.querySelectorAll('[data-slot]')].map((n) => n.getAttribute('data-slot')).slice(0, 40),
      voiceAutoButtons: document.querySelectorAll('.dsh-fairy-voice-auto').length,
      voiceControls: document.querySelectorAll('.dsh-fairy-voice-controls').length,
      readAloudButtons: [...document.querySelectorAll('button')].filter((b) => (b.getAttribute('aria-label') || '').includes('朗读')).length,
      assistantMessages: document.querySelectorAll('[data-dsh-fairy-assistant-actions]').length,
    },
  };
})()`);

if (shot) {
  const captured = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(shot, Buffer.from(captured.data, 'base64'));
}

// 4b) 点「一键设为默认预设」，再点回来，看状态是否真的翻转（含宿主 settings 写入）
const readDefaultState = () => evaluate(`(() => {
  const node = document.querySelector('[data-dsh-fairy-default-state]');
  const button = document.querySelector('[data-dsh-fairy-default-preset]');
  return {
    state: node ? node.getAttribute('data-dsh-fairy-default-state') : null,
    text: node ? node.innerText.trim() : null,
    button: button ? button.innerText.trim() : null,
  };
})()`);
const presetSteps = { before: await readDefaultState() };
await evaluate('document.querySelector("[data-dsh-fairy-default-preset]").click()');
await sleep(2500);
presetSteps.afterOn = await readDefaultState();
presetSteps.hostStatusOn = await evaluate(`fetch('/fairy-persona/status', { cache: 'no-store' }).then((r) => r.json()).catch((e) => String(e))`);
await evaluate('document.querySelector("[data-dsh-fairy-default-preset]").click()');
await sleep(2500);
presetSteps.afterOff = await readDefaultState();
presetSteps.hostStatusOff = await evaluate(`fetch('/fairy-persona/status', { cache: 'no-store' }).then((r) => r.json()).catch((e) => String(e))`);
steps.push({ presetDefault: presetSteps });
report.presetDefault = presetSteps;

// 5) 关掉设置 → 开一个会话 → 再读一次诊断。
// 这一步是判断"消息识别到底行不行"的关键：只有进过会话，插件才会真的去读消息结构。
await evaluate('document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
await sleep(1200);
const homeLabels = await evaluate(`(() => [...document.querySelectorAll('button, [role="button"], a')]
  .filter((el) => el.offsetParent !== null)
  .map((el) => ((el.getAttribute('aria-label') || '') + ' ' + (el.innerText || '')).trim())
  .filter((text) => text.length > 0 && text.length < 40).slice(0, 40))()`);
steps.push({ homeLabels });

let sessionOpened = null;
for (const label of ['新对话', '新建对话', '新建会话', '开始新对话', '新会话', 'New chat', '开始对话']) {
  const hit = await evaluate(`(() => {
    const wanted = ${JSON.stringify(label)};
    const nodes = [...document.querySelectorAll('button, [role="button"], a')];
    const element = nodes.find((el) => el.offsetParent !== null && (((el.getAttribute('aria-label') || '') + ' ' + (el.innerText || '')).trim()).includes(wanted));
    if (!element) return null;
    element.click();
    return ((element.getAttribute('aria-label') || '') + ' ' + (element.innerText || '')).trim().slice(0, 40);
  })()`);
  if (hit) { sessionOpened = hit; break; }
}
await sleep(5000);
const diagAfterSession = await evaluate('window.__FAIRY_VOICE_DIAG__ ?? null');
const shellAfterSession = await evaluate(`(() => ({
  visualAttr: document.documentElement.hasAttribute('data-dsh-fairy-visual'),
  modeAttr: document.documentElement.getAttribute('data-dsh-fairy-mode'),
  hasInputLeftSlot: Boolean(document.querySelector('[data-slot="conversation.input.left"]')),
  slotNames: [...document.querySelectorAll('[data-slot]')].map((n) => n.getAttribute('data-slot')).slice(0, 40),
  voiceAutoButtons: document.querySelectorAll('.dsh-fairy-voice-auto').length,
  voiceControls: document.querySelectorAll('.dsh-fairy-voice-controls').length,
  readAloudButtons: [...document.querySelectorAll('button')].filter((b) => (b.getAttribute('aria-label') || '').includes('朗读')).length,
  composerPresent: Boolean(document.querySelector('[data-dsh-fairy-composer-dock], textarea, [contenteditable="true"]')),
}))()`);
steps.push({ sessionOpened, diagAfterSession, shellAfterSession });
report.diagAfterSession = diagAfterSession;
report.sessionOpened = sessionOpened;
report.shellAfterSession = shellAfterSession;

const failed = (report.checks ?? []).filter((check) => check.level === 'fail');
const pass = Boolean(report.statusBar) && (report.checks ?? []).length >= 3 && report.hasTtsUrlField && report.hasRefAudioField;

console.log(JSON.stringify({ steps, report, failedCount: failed.length, exceptions, consoleTail: consoleLines.slice(-15) }, null, 2));
console.error(pass
  ? '\nRESULT: PASS — 自检面板已渲染并跑完，检查项与可配置项都在'
  : '\nRESULT: FAIL — 面板未按预期渲染，见上面 report/steps');

ws.close();
try { spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* 忽略 */ }
chrome.kill();
await sleep(600);
process.exit(pass ? 0 : 1);
