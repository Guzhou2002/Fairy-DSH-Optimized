import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import z from '@deepseek-ai/schemastery';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FAIRY_IDENTITY_SETTINGS_NAMESPACE,
  FAIRY_VISUAL_SETTINGS_NAMESPACE,
  FAIRY_VISUAL_SETTINGS_VERSION,
} from '../vendor/fairy-contracts.js';
import { createFairyDiagnostics } from '../vendor/diagnostics.js';

const settingsNamespaceName = FAIRY_VISUAL_SETTINGS_NAMESPACE;
const FAIRY_VISUAL_SETTINGS = settingsNamespace(settingsNamespaceName);
const FAIRY_IDENTITY_SETTINGS = settingsNamespace(FAIRY_IDENTITY_SETTINGS_NAMESPACE);
const diagnostics = createFairyDiagnostics('dsh-fairy-visual');

export const FairyVisualSettings = z.object({
  version: z.number().step(1).default(FAIRY_VISUAL_SETTINGS_VERSION),
  enabled: z.boolean().default(false),
  theme: z.union(['dark', 'light']).default('dark'),
  mascotVisible: z.boolean().default(true),
  mascotScale: z.number().step(0.01).min(0.55).max(1).default(1),
  mascotAnimationSpeed: z.union([z.const(0.7), z.const(1), z.const(1.5)]).default(1),
  powerMode: z.union(['normal', 'low-power']).default('normal'),
  composerDockHeight: z.number().step(1).min(132).max(420).default(132),
});

export const FairyIdentitySettings = z.object({
  mode: z.union(['ling', 'zhe', 'custom']).default('ling'),
  customName: z.string().default(''),
  secondAssistant: z.string().default(''),
  household: z.array(z.string()).default([]),
});

export const name = 'dsh-fairy-visual';

// ---------------------------------------------------------------------------
// [local patch 0.2.1] Fairy 人设预设开关
//
// 人设只能通过 DSH 的 agent preset 机制生效（官方 dsh-persona 全局挂载会与
// system-prompt 自带的 deployment:persona 注册相撞报错），所以这里只负责
// 把包内的 .agent-presets/fairy 装进 / 移出 DSH 家目录；
// 是否在某个会话使用，仍由用户在界面的预设选择器里决定。
// ---------------------------------------------------------------------------
const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRESET_ID = 'fairy';
const PRESET_SOURCE = join(PLUGIN_ROOT, '.agent-presets', PRESET_ID);
const DSH_HOME = String(process.env.DSH_HOME ?? '').trim() || join(homedir(), '.dsh');
const PRESET_TARGET = join(DSH_HOME, '.agent-presets', PRESET_ID);
// ---------------------------------------------------------------------------
// [local patch 0.3.6] 启动时「仅同步一次」
//
// 预设装在 DSH 家目录里，只有用户去点开关时才刷新，于是包里的预设更新了、
// 家目录里那份却一直是旧的（上游 persona 从 text 改叫 prefix 那次就翻车了）。
// 这里记一份"上次同步时的源指纹"，启动时比一次：
//   源没变 → 一个字都不动（保护用户自己改过的预设）
//   源变了 → 整份重灌一次，并写回新指纹
// ⚠️ 目标目录不存在时【不】擅自安装 —— 否则用户关掉开关，重启后它自己又回来了。
const PRESET_SYNC_STAMP_PATH = join(DSH_HOME, '.fairy-persona', 'preset-sync.json');
// ---------------------------------------------------------------------------
// [local patch 0.2.3] 「一键设为默认预设」
//
// DSH 把"新会话默认用哪个预设"存在 settings 的 `agent-presets` 命名空间里
// （schema: { default: string }）。大多数使用者根本不知道要去哪儿改这个，
// 所以这里代劳：写之前先把原来的值存下来，关掉时原样还原。
// ---------------------------------------------------------------------------
const AGENT_PRESET_SETTINGS_NAMESPACE = 'agent-presets';
const DEFAULT_BACKUP_PATH = join(DSH_HOME, '.fairy-persona', 'default-preset-backup.json');
let settingsService = null;

function readDefaultBackup() {
  try {
    const value = JSON.parse(readFileSync(DEFAULT_BACKUP_PATH, 'utf8'));
    return typeof value?.previousDefault === 'string' ? value.previousDefault : null;
  } catch {
    return null;
  }
}

function writeDefaultBackup(previousDefault) {
  mkdirSync(dirname(DEFAULT_BACKUP_PATH), { recursive: true });
  writeFileSync(DEFAULT_BACKUP_PATH, `${JSON.stringify({ version: 1, previousDefault }, null, 2)}\n`, 'utf8');
}

/** 读取当前的默认预设。读不到就返回 null（表示"查不了"，不等于空）。 */
function readDefaultPreset() {
  if (settingsService === null) return null;
  try {
    const value = settingsService.get(AGENT_PRESET_SETTINGS_NAMESPACE);
    const current = typeof value?.default === 'string' ? value.default : '';
    return current === '' ? null : current;
  } catch {
    return null;
  }
}

/** 把 Fairy 设为新会话的默认预设；enabled=false 时还原成原来的值。 */
async function setDefaultPreset(enabled) {
  if (settingsService === null) {
    throw Object.assign(new Error('settings service unavailable'), { code: 'settings-unavailable' });
  }
  if (enabled === true) {
    if (!existsSync(join(PRESET_TARGET, 'agent.cordis.yml'))) setPresetEnabled(true);
    const previous = readDefaultPreset();
    if (previous !== PRESET_ID) writeDefaultBackup(previous === null ? '' : previous);
    await settingsService.update(AGENT_PRESET_SETTINGS_NAMESPACE, { default: PRESET_ID });
  } else {
    // 有备份就还原成原值；没有备份（例如默认值本来就是别人设的、或我们没记下）
    // 就回落到部署默认 —— 绝不能写空串，那会让新会话"没有默认预设"，比原来更糟。
    const previous = readDefaultBackup();
    if (previous !== null && previous !== '') {
      await settingsService.update(AGENT_PRESET_SETTINGS_NAMESPACE, { default: previous });
    } else if (typeof settingsService.replace === 'function') {
      await settingsService.replace(AGENT_PRESET_SETTINGS_NAMESPACE, {});
    } else {
      await settingsService.update(AGENT_PRESET_SETTINGS_NAMESPACE, { default: '' });
    }
  }
  return presetStatus();
}

function presetStatus() {
  const currentDefault = readDefaultPreset();
  return {
    presetId: PRESET_ID,
    source: PRESET_SOURCE,
    target: PRESET_TARGET,
    available: existsSync(join(PRESET_SOURCE, 'agent.cordis.yml')),
    installed: existsSync(join(PRESET_TARGET, 'agent.cordis.yml')),
    defaultPreset: currentDefault,
    isDefault: currentDefault === PRESET_ID,
    // settings 服务不可用（未注入）时前端要能区分"查不到"和"没设置"
    defaultReadable: settingsService !== null,
    previousDefault: readDefaultBackup(),
  };
}

/** 算源目录的内容指纹（相对路径 + 文件内容）。链接 / junction 一律跳过。 */
function fingerprintPresetSource() {
  if (!existsSync(join(PRESET_SOURCE, 'agent.cordis.yml'))) return null;
  const hash = createHash('sha256');
  const walk = (dir, prefix) => {
    const entries = readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) { walk(join(dir, entry.name), `${relative}/`); continue; }
      if (!entry.isFile()) continue;
      hash.update(relative);
      hash.update(readFileSync(join(dir, entry.name)));
    }
  };
  walk(PRESET_SOURCE, '');
  return hash.digest('hex');
}

function readSyncStamp() {
  try {
    const value = JSON.parse(readFileSync(PRESET_SYNC_STAMP_PATH, 'utf8'));
    return typeof value?.fingerprint === 'string' ? value.fingerprint : null;
  } catch {
    return null;
  }
}

function writeSyncStamp(fingerprint) {
  if (typeof fingerprint !== 'string') return;
  try {
    mkdirSync(dirname(PRESET_SYNC_STAMP_PATH), { recursive: true });
    writeFileSync(PRESET_SYNC_STAMP_PATH, `${JSON.stringify({ version: 1, fingerprint }, null, 2)}\n`, 'utf8');
  } catch {
    // 记不住就记不住：最多下次启动再同步一次，不影响正确性
  }
}

/** 把包内预设整份重灌到家目录，并记下这一版的指纹。 */
function installPreset(fingerprint) {
  mkdirSync(dirname(PRESET_TARGET), { recursive: true });
  rmSync(PRESET_TARGET, { recursive: true, force: true });
  cpSync(PRESET_SOURCE, PRESET_TARGET, { recursive: true, force: true });
  writeSyncStamp(typeof fingerprint === 'string' ? fingerprint : fingerprintPresetSource());
}

/** 启动时检查一次：只在"已经装过 + 包里的预设变了"时重灌。 */
function syncPresetOnce() {
  if (!existsSync(join(PRESET_TARGET, 'agent.cordis.yml'))) return 'not-installed';
  const fingerprint = fingerprintPresetSource();
  if (fingerprint === null) return 'source-missing';
  if (readSyncStamp() === fingerprint) return 'unchanged';
  installPreset(fingerprint);
  return 'updated';
}

function setPresetEnabled(enabled) {
  if (enabled === true) {
    if (!existsSync(join(PRESET_SOURCE, 'agent.cordis.yml'))) {
      throw Object.assign(new Error('package preset missing'), { code: 'preset-source-missing' });
    }
    installPreset();
  } else {
    rmSync(PRESET_TARGET, { recursive: true, force: true });
  }
  return presetStatus();
}

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

function readJsonBody(req, limitBytes = 16384) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(Object.assign(new Error('payload-too-large'), { code: 'payload-too-large' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw.length === 0) { resolve({}); return; }
      try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('invalid-json'), { code: 'invalid-json' })); }
    });
    req.on('error', reject);
  });
}

const personaHandlers = {
  status(_req, res) {
    try {
      sendJson(res, 200, presetStatus());
    } catch (error) {
      diagnostics.warn('persona.status', {}, error);
      sendJson(res, 500, { error: { code: 'preset-status-failed' } });
    }
  },
  async toggle(req, res) {
    try {
      const body = await readJsonBody(req);
      sendJson(res, 200, setPresetEnabled(body.enabled === true));
    } catch (error) {
      const code = error?.code || 'preset-toggle-failed';
      diagnostics.warn('persona.toggle', { code }, error);
      sendJson(res, 400, { error: { code } });
    }
  },
  // [local patch 0.2.3] 一键把 Fairy 设为「新会话的默认预设」（使用者不必自己找设置项）
  async setDefault(req, res) {
    try {
      const body = await readJsonBody(req);
      sendJson(res, 200, await setDefaultPreset(body.enabled === true));
    } catch (error) {
      const code = error?.code || 'preset-default-failed';
      diagnostics.warn('persona.default', { code }, error);
      sendJson(res, 400, { error: { code, message: error?.message } });
    }
  },
};

// ---------------------------------------------------------------------------
// [local patch 0.2.3] 启动就醒目：往 index.html 注入一小段脚本
//
// 没配置好时：侧边栏「设置」图标上点一个红点，右下角弹一个红色提示框。
// 提示框可一键去设置、可"不再提示"（localStorage 记住）。配置好了就什么都不显示。
// 整段包在 try/catch 里，且接口拿不到时静默退出——绝不影响 DSH 正常启动。
// ---------------------------------------------------------------------------
const SETUP_BADGE_SCRIPT = `<script data-dsh-fairy-setup-badge="true">(function(){try{
var KEY='dsh.fairy.setupNotice.v1';
var root=document.documentElement;
if(root.getAttribute('data-dsh-fairy-setup'))return;
root.setAttribute('data-dsh-fairy-setup','checking');
var style=document.createElement('style');
style.textContent='html[data-dsh-fairy-setup="todo"] [data-slot="settings.trigger"]{position:relative}'
+'html[data-dsh-fairy-setup="todo"] [data-slot="settings.trigger"]::after{content:"";position:absolute;top:2px;right:2px;width:9px;height:9px;border-radius:50%;background:#e5484d;box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1,#1b1b1b)}'
+'#dsh-fairy-setup-notice{position:fixed;right:18px;bottom:18px;z-index:2147483000;max-width:330px;border:2px solid #e5484d;background:var(--dsw-alias-bg-layer-1,#1e1e1e);color:var(--dsw-alias-label-primary,#eee);border-radius:10px;padding:13px 15px;font:13px/1.7 system-ui,"Microsoft YaHei",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)}'
+'#dsh-fairy-setup-notice b{display:block;margin-bottom:4px;color:#e5484d;font-size:14px}'
+'#dsh-fairy-setup-notice button{margin:8px 8px 0 0;padding:4px 12px;border:1px solid var(--dsw-alias-border-l2,#555);border-radius:6px;background:transparent;color:inherit;font-size:12px;cursor:pointer}'
+'#dsh-fairy-setup-notice button:hover{background:rgba(128,128,128,.16)}';
(document.head||root).appendChild(style);
var show=function(todo,detail){
  if(!todo)return;
  var dismissed=false;try{dismissed=localStorage.getItem(KEY)==='1'}catch(e){}
  if(dismissed)return;
  var box=document.createElement('div');box.id='dsh-fairy-setup-notice';
  var title=document.createElement('b');title.textContent='Fairy 还没配置好';
  var text=document.createElement('div');text.textContent=detail;
  var go=document.createElement('button');go.textContent='打开设置';
  go.onclick=function(){var t=document.querySelector('[data-slot="settings.trigger"]');if(t)t.click();};
  var hide=document.createElement('button');hide.textContent='不再提示';
  hide.onclick=function(){try{localStorage.setItem(KEY,'1')}catch(e){}box.remove();};
  box.appendChild(title);box.appendChild(text);box.appendChild(go);box.appendChild(hide);
  (document.body||root).appendChild(box);
};
fetch('/fairy-persona/status',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(v){
  if(!v){root.removeAttribute('data-dsh-fairy-setup');return;}
  var todo=v.installed!==true||v.isDefault!==true;
  root.setAttribute('data-dsh-fairy-setup',todo?'todo':'ok');
  if(!todo)return;
  var detail=v.installed!==true
    ?'人设预设还没装上。打开「设置 → Fairy」，勾一下开关、点一下按钮就好。'
    :'人设预设已装好，但还不是新会话的默认预设。打开「设置 → Fairy」，点一下「一键设为默认预设」。';
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',function(){show(true,detail)});}else{show(true,detail);}
}).catch(function(){root.removeAttribute('data-dsh-fairy-setup');});
}catch(e){}})();</script>`;

export function apply(ctx) {
  return diagnostics.guard('apply', () => {
    // [local patch 0.3.6] 启动同步一次预设（源没变就什么都不做；失败也绝不影响启动）
    try {
      diagnostics.info('persona.presetSync', { result: syncPresetOnce(), target: PRESET_TARGET });
    } catch (error) {
      diagnostics.warn('persona.presetSync', {}, error);
    }
    ctx.inject(['settings'], (settingsCtx) => {
      settingsService = settingsCtx.settings;
      settingsCtx.settings.register(FAIRY_VISUAL_SETTINGS, FairyVisualSettings);
      settingsCtx.settings.register(FAIRY_IDENTITY_SETTINGS, FairyIdentitySettings);
    });
    ctx.inject(['webServer'], (ws) => ws.effect(() => {
      const unregisterStatus = ws.webServer.register({ kind: 'exact', path: '/fairy-persona/status', handler: personaHandlers.status });
      const unregisterToggle = ws.webServer.register({ kind: 'exact', path: '/fairy-persona/toggle', handler: personaHandlers.toggle });
      const unregisterDefault = ws.webServer.register({ kind: 'exact', path: '/fairy-persona/default', handler: personaHandlers.setDefault });
      // [local patch 0.2.3] 页面加载时的醒目提示（红点 + 红色提示框）
      const disposeBadge = typeof ws.webServer.tapIndex === 'function'
        ? ws.webServer.tapIndex((html) => (html.includes('</body>') ? html.replace('</body>', `${SETUP_BADGE_SCRIPT}</body>`) : `${html}${SETUP_BADGE_SCRIPT}`))
        : undefined;
      diagnostics.info('persona.routes', { port: ws.webServer.port, target: PRESET_TARGET, settings: settingsService !== null, badge: disposeBadge !== undefined });
      return () => {
        unregisterStatus?.();
        unregisterToggle?.();
        unregisterDefault?.();
        disposeBadge?.();
      };
    }));
  }, { surface: 'host' });
}