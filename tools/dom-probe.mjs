// Fairy-DSH DOM 探针：无头 Chrome 加载 DSH Web UI，报告插件实际落地的 DOM 效果。
// 用法： node dom-probe.mjs <url> [--shot <path>]
// 依赖：本机 Chrome（可用 CHROME_PATH 环境变量覆盖）
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2];
if (!url) {
  console.error('usage: node dom-probe.mjs <url> [--shot <path>]');
  process.exit(2);
}
const shotIndex = process.argv.indexOf('--shot');
const shot = shotIndex > -1 ? process.argv[shotIndex + 1] : null;
const PORT = Number(process.env.PROBE_PORT ?? 9333);
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'fairy-probe-'))}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1440,900',
  url,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageTarget() {
  for (let i = 0; i < 40; i += 1) {
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
const consoleLines = [];
const exceptions = [];

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
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = (msg.params.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(' ');
    consoleLines.push(`${msg.params.type}: ${text}`);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  }
});

const send = (method, params = {}) => {
  const id = (nextId += 1);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
};

await send('Runtime.enable');
await send('Page.enable');
await sleep(1000);
await send('Page.navigate', { url });
await sleep(9000);

const expression = `(() => {
  const root = document.documentElement;
  const fairyAttrs = new Set();
  let fairyNodeCount = 0;
  for (const el of document.querySelectorAll('*')) {
    for (const a of el.attributes ?? []) {
      if (a.name.startsWith('data-dsh-fairy') || a.name.startsWith('data-dsh-hdd')) {
        fairyAttrs.add(a.name);
        fairyNodeCount += 1;
      }
    }
  }
  const seat = document.querySelector('[data-dsh-fairy-composer-seat]');
  const mascot = document.getElementById('dsh-fairy-root');
  const mRect = mascot ? mascot.getBoundingClientRect() : null;
  return {
    title: document.title,
    officialRootSlot: !!document.querySelector('body > #root > [data-slot="root"]'),
    officialSlotCount: document.querySelectorAll('[data-slot]').length,
    fairyStyleTags: [...document.querySelectorAll('style[id]')].map((s) => s.id).filter((id) => id.includes('fairy')),
    mascotPresent: !!mascot,
    mascotRect: mRect ? { x: Math.round(mRect.x), y: Math.round(mRect.y), w: Math.round(mRect.width), h: Math.round(mRect.height) } : null,
    fairyMode: root.getAttribute('data-dsh-fairy-mode'),
    fairyTheme: root.getAttribute('data-dsh-fairy-theme'),
    fairyPowerMode: root.getAttribute('data-dsh-fairy-power-mode'),
    composerSeatInline: seat ? seat.getAttribute('style') : null,
    composerDockHeight: (() => { const d = document.querySelector('[data-dsh-fairy-composer-dock]'); return d ? getComputedStyle(d).height : null; })(),
    hddScrollbars: document.querySelectorAll('.dsh-hdd-scrollbar-layer').length,
    glowNodes: document.querySelectorAll('[class*=dsh-hdd-glow]').length,
    heroHiddenCount: document.querySelectorAll('.dsh-fairy-hero-native-headline-hidden').length,
    heroTextPresent: document.body.innerText.includes('探索未至之境'),
    voiceStyleTag: !!document.getElementById('dsh-fairy-voice-controls-style'),
    voiceAutoButtons: document.querySelectorAll('.dsh-fairy-voice-auto').length,
    voiceVolumeInputs: document.querySelectorAll('.dsh-fairy-voice-volume').length,
    voiceAutoDisabled: (() => { const b = document.querySelector('.dsh-fairy-voice-auto'); return b ? b.disabled : null; })(),
    voiceAutoOn: (() => { const b = document.querySelector('.dsh-fairy-voice-auto'); return b ? b.getAttribute('data-on') : null; })(),
    speechSynthesisAvailable: typeof window.speechSynthesis === 'object' && window.speechSynthesis !== null,
    chineseVoices: (() => {
      try {
        return (window.speechSynthesis?.getVoices() ?? []).filter((v) => v.lang.toLowerCase().startsWith('zh')).map((v) => v.name).slice(0, 5);
      } catch { return null; }
    })(),
    fairyAttrCount: fairyAttrs.size,
    fairyNodeCount,
    fairyAttrNames: [...fairyAttrs].sort(),
  };
})()`;

const evaluated = await send('Runtime.evaluate', { expression, returnByValue: true });
if (shot) {
  const captured = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(shot, Buffer.from(captured.data, 'base64'));
}

const probe = evaluated.result?.value ?? {};
const fairyLogs = consoleLines.filter((l) => l.includes('DSH_FAIRY_LOG'));

console.log(JSON.stringify({ probe, fairyLogs, exceptions, consoleTail: consoleLines.slice(-20) }, null, 2));

const ok = probe.mascotPresent === true && (probe.fairyStyleTags ?? []).length > 0 && exceptions.length === 0;
console.log(ok ? '\nRESULT: PASS — Fairy 客户端插件已挂载且无异常' : '\nRESULT: FAIL — 见上面 probe/exceptions');

ws.close();
// chrome.kill() 只会结束启动器进程，浏览器子进程会残留；必须整棵进程树一起收掉
try { spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* 忽略 */ }
chrome.kill();
await sleep(600);
process.exit(ok ? 0 : 1);
