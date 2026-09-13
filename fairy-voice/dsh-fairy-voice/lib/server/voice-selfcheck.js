/*
 * Fairy-DSH [local patch 0.2.3]
 *
 * 朗读链路自检 + 可配置的 SoVITS 地址/参考音频。
 *
 * 设计原则：面向完全不懂技术的使用者。
 *  - 每一项检查都用大白话说明"现在是好的还是坏的"；
 *  - 每一项都带上"怎么修"，能复制粘贴的都给现成的；
 *  - 最后一并给出结论句，坏在哪一环一眼可见，不需要看日志。
 */
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createLocalTtsTransport } from './local-tts-proxy.js';
/* [local patch 0.3.2] 第二条朗读路线：本机 MOSS-TTS-Nano */
import { createMossTtsTransport } from './moss-tts-transport.js';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const FAIRY_VOICE_DIR = join(homedir(), '.dsh', 'fairy-voice');
const RUNTIME_DIR = join(FAIRY_VOICE_DIR, 'runtime');
export const RUNTIME_CONFIG_PATH = join(RUNTIME_DIR, 'config.json');
/* [local patch 0.3.2] 参考音频放哪儿 —— 这里挪过几次，把结论和【为什么】都写下来。
 *
 * 最终位置：`~/.dsh/fairy-voice/reference/fairy_ref.wav`
 *
 * ★ 为什么用户数据【绝不能放进插件目录】（这条最容易被搞错，别改回去）：
 *   插件代码装在哪，和"你该把音色/密钥放哪"完全没关系：
 *     · 源码装法（git clone / `link:`）→ 代码在 ~/.dsh/plugins/… 或你 clone 的地方
 *     · 发布包装法（`dsh plugin add <tgz>`）→ 代码被解进 **profile 下的 node_modules**
 *   而 profile 的 node_modules 是 **pnpm 随时会清掉、重建、按版本重装的目录**。
 *   把「你的音色」「你的 API Key」放进去 = 放在定时炸弹上，升一次版本就没了。
 *   所以用户数据一律放 `~/.dsh/fairy-voice/` —— 这个目录由插件**运行时**用 homedir() 自己建，
 *   跟插件装在哪、怎么装、装几次都无关（见 index.js 里 ensureFairyDirectories 的调用）。
 *
 * 顺带留个记录：这里反复过两次，免得后人再走一遍 ——
 *   runtime/reference/  ← 最初。错在 runtime/ 是插件自己管状态（config.json）的地方，
 *                          使用者的素材塞进去不好找，看着也像"可随手清掉的临时文件"。
 *   顶层另起一个目录      ← 曾短暂改成 ~/.dsh/fairy-DSH-voice-reference/。
 *                          起因是误以为 ~/.dsh/fairy-voice 不存在、想避开撞名；
 *                          后来发现它本来就在（插件的数据目录），于是收回，仍放它下面。
 *
 * 旧位置 runtime/reference/ 保留兼容回退，老用户升级不会丢文件。 */
export const FAIRY_REFERENCE_DIR = join(FAIRY_VOICE_DIR, 'reference');
export const DEFAULT_REFERENCE_AUDIO_PATH = join(FAIRY_REFERENCE_DIR, 'fairy_ref.wav');
const LEGACY_REFERENCE_AUDIO_PATHS = [
  join(RUNTIME_DIR, 'reference', 'fairy_ref.wav'),   // 最初的位置（0.2.3–0.3.1）
];

/**
 * 参考音频的默认位置。新位置优先；新位置没有、旧位置有，就继续用旧的。
 * 都没有时返回新位置（提示语里显示的会是新位置，也就是让他把文件放这儿）。
 */
export function resolveDefaultReferenceAudioPath() {
  if (isExistingFile(DEFAULT_REFERENCE_AUDIO_PATH)) return DEFAULT_REFERENCE_AUDIO_PATH;
  for (const legacy of LEGACY_REFERENCE_AUDIO_PATHS) {
    if (isExistingFile(legacy)) return legacy;
  }
  return DEFAULT_REFERENCE_AUDIO_PATH;
}

function isExistingFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * [local patch 0.3.2] 启动时把参考音频目录建出来（幂等，已有就不动）。
 *
 * 为什么要在启动时建：这个目录"没放文件就压根不存在"，于是使用者根本不知道该往哪儿放 ——
 * 自检只会说"参考音频没找到"。先把它建出来，他打开文件管理器就能看见这个文件夹。
 * 顺手放一份说明进去，省得他还要回来翻文档。
 */
export async function ensureFairyDirectories() {
  await mkdir(FAIRY_REFERENCE_DIR, { recursive: true });
  const readme = join(FAIRY_REFERENCE_DIR, 'README.txt');
  if (!isExistingFile(readme)) {
    const lines = [
      '这里放 Fairy 朗读用的「参考音频」—— 你的音色就是它。',
      '',
      '【最重要的一句话】',
      '  念出来的音色，几乎完全由这个文件决定。它录成什么样，Fairy 就说成什么样。',
      '  换一个文件 = 换一种音色，随时可以换。',
      '',
      '【怎么挑】（照这个来，声音才好听）',
      '  1. 只要一个人的说话声，3–10 秒，不要音乐、不要多人、不要明显噪音。',
      '  2. 尽量用 48 kHz 的（44.1 kHz 也能用，会再多损失一点）。',
      '  3. 音量要够：整段最高点最好在 -1 ~ -3 dB。太轻的话，念出来也会没力气。',
      '  4. 不要用「降噪」「人声增强」处理过的音频 —— 处理留下的痕迹会被一起学过去，',
      '     听起来发毛、发沙。这一点最容易被忽略，也最影响最终效果。',
      '',
      '【怎么放】',
      '  1. 存成 fairy_ref.wav 放本目录下；或者把设置里的「参考音频路径」改成你的完整路径。',
      '  2. 回到 DSH：设置 → Fairy → 朗读设置 → 点「重新自检」，第 3 项应该变绿。',
      '',
      '【出问题先看这里】',
      '  · 发闷 / 发毛 → 多半是参考音频本身的问题（第 4 条），换一段干净的。',
      '  · 声音太轻 → 参考音频太轻（第 3 条）。',
      '  · 放在这里的好处：插件升级、重装、换目录都不会把它弄丢。',
      '',
      '本目录由 dsh-fairy-voice 插件在启动时自动创建。',
    ];
    await writeFile(readme, `${lines.join('\n')}\n`, 'utf8').catch(() => { /* 写不进去不影响功能 */ });
  }
  return FAIRY_REFERENCE_DIR;
}
const DEFAULT_TTS_BASE = 'http://127.0.0.1:9880';
/* [local patch 0.3.2] 朗读引擎。
 *   gpt-sovits = 上游原路（默认，行为与改动前完全一致）
 *   moss-nano  = 本机 MOSS-TTS-Nano（CPU 可跑，不需要显卡） */
export const ENGINE_SOVITS = 'gpt-sovits';
export const ENGINE_MOSS = 'moss-nano';
const DEFAULT_MOSS_BASE = 'http://127.0.0.1:18083';
/* MOSS 的两个端点：/health 用来判断服务在不在（等价于 SoVITS 那边的 /docs）。 */
const MOSS_HEALTH_PATH = '/health';
const MOSS_GENERATE_PATH = '/api/generate';

/** 引擎名规整：不认识的（含配置文件被手改坏）一律回落到默认引擎，不抛错。 */
export function normalizeEngine(input) {
  return input === ENGINE_MOSS ? ENGINE_MOSS : ENGINE_SOVITS;
}

/* [local patch 0.3.4] 自检的试合成文本从「语音自检，一二三四五，Fairy 朗读正常。」
 * 缩短成四个字：这句话要真跑一次合成，MOSS 在 CPU 上约 0.5 秒/字，
 * 原来那句要等十几秒，只为证明"能出声"不值得。四个字同样能证明链路通。 */
const SELFCHECK_SENTENCE = '孤舟蓑笠';
const DOCS_TIMEOUT_MS = 4_000;
const SYNTH_TIMEOUT_MS = 60_000;
const SYNTH_MAX_BYTES = 6 * 1024 * 1024;
const PCM_BYTES_PER_SECOND = 32_000 * 2;

/** 把用户填的地址规整成 http(s)://host:port 形式。 */
export function normalizeTtsBase(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (raw === '') return { ok: false, error: '地址不能是空的。' };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: '地址格式不对。要写成这样：http://127.0.0.1:9880' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: '地址必须以 http:// 或 https:// 开头。' };
  }
  if (url.host === '') return { ok: false, error: '地址里没有主机名或端口。要写成这样：http://127.0.0.1:9880' };
  return { ok: true, base: `${url.protocol}//${url.host}` };
}

/** 当前生效的运行时配置（文件 → 默认值）。 */
export function readRuntimeConfig() {
  let stored = null;
  let fileProblem = '';
  try {
    stored = JSON.parse(readFileSync(RUNTIME_CONFIG_PATH, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      fileProblem = `配置文件读不出来（内容可能坏了）：${RUNTIME_CONFIG_PATH}`;
      stored = null;
    }
  }
  /* [local patch 0.3.2] 两个引擎各自记住自己的地址，切换时不丢。
   * 老配置里只有 ttsUrl（那会儿只有 SoVITS），读进来当 SoVITS 地址用 —— 老用户升级不受影响。 */
  const engine = normalizeEngine(stored?.engine);
  const legacyBase = typeof stored?.ttsUrl === 'string' ? stored.ttsUrl : '';
  const sovits = normalizeTtsBase(stored?.sovitsBase ?? legacyBase ?? DEFAULT_TTS_BASE);
  const sovitsBase = sovits.ok ? sovits.base : DEFAULT_TTS_BASE;
  const moss = normalizeTtsBase(stored?.mossBase ?? DEFAULT_MOSS_BASE);
  const mossBase = moss.ok ? moss.base : DEFAULT_MOSS_BASE;
  const base = engine === ENGINE_MOSS ? mossBase : sovitsBase;
  const audio = typeof stored?.referenceAudioPath === 'string' && stored.referenceAudioPath.trim() !== ''
    ? stored.referenceAudioPath.trim()
    : resolveDefaultReferenceAudioPath();
  const prompt = typeof stored?.referencePromptPath === 'string' && stored.referencePromptPath.trim() !== ''
    ? stored.referencePromptPath.trim()
    : join(dirname(audio), 'fairy_ref.txt');
  return {
    engine,
    base,
    ttsUrl: engine === ENGINE_MOSS ? `${base}${MOSS_GENERATE_PATH}` : `${base}/tts`,
    docsUrl: engine === ENGINE_MOSS ? `${base}${MOSS_HEALTH_PATH}` : `${base}/docs`,
    sovitsBase,
    mossBase,
    referenceAudioPath: audio,
    referencePromptPath: prompt,
    configured: stored !== null,
    configPath: RUNTIME_CONFIG_PATH,
    defaultBase: DEFAULT_TTS_BASE,
    defaultSovitsBase: DEFAULT_TTS_BASE,
    defaultMossBase: DEFAULT_MOSS_BASE,
    defaultReferenceAudioPath: resolveDefaultReferenceAudioPath(),
    fileProblem,
  };
}

/**
 * [local patch 0.3.2] 用「界面上当前填的」临时覆盖「已保存的」配置。
 *
 * 为什么需要：自检原本读的是磁盘上已保存的配置，于是「把引擎切成 MOSS、点自检」
 * 会去测 SoVITS —— 使用者只会以为自检坏了。
 * 这里只算一份**临时**配置，**绝不写磁盘**；保存仍然只由 saveRuntimeConfig 负责。
 */
export function applyConfigOverrides(config, overrides = {}) {
  const engine = overrides.engine === undefined ? config.engine : normalizeEngine(overrides.engine);
  let sovitsBase = config.sovitsBase;
  let mossBase = config.mossBase;
  const rawBase = typeof overrides.base === 'string' ? overrides.base.trim() : '';
  if (rawBase !== '') {
    const parsed = normalizeTtsBase(rawBase);
    // 地址填错了不要盖成非法值：保留已保存的，让自检照常报「连不上」而不是自己崩掉
    if (parsed.ok) {
      if (engine === ENGINE_MOSS) mossBase = parsed.base;
      else sovitsBase = parsed.base;
    }
  }
  const base = engine === ENGINE_MOSS ? mossBase : sovitsBase;
  const rawAudio = typeof overrides.referenceAudioPath === 'string' ? overrides.referenceAudioPath.trim() : '';
  const audio = rawAudio !== '' ? rawAudio : config.referenceAudioPath;
  return {
    ...config,
    engine,
    base,
    sovitsBase,
    mossBase,
    ttsUrl: engine === ENGINE_MOSS ? `${base}${MOSS_GENERATE_PATH}` : `${base}/tts`,
    docsUrl: engine === ENGINE_MOSS ? `${base}${MOSS_HEALTH_PATH}` : `${base}/docs`,
    referenceAudioPath: audio,
    referencePromptPath: audio === config.referenceAudioPath
      ? config.referencePromptPath
      : join(dirname(audio), 'fairy_ref.txt'),
  };
}

async function writeJsonPrivate(file, value) {
  const temporaryPath = `${file}.${process.pid}.${randomUUID()}.tmp`;
  let committed = false;
  let handle = null;
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  try {
    handle = await open(temporaryPath, 'w', 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.close();
    handle = null;
    await rename(temporaryPath, file);
    committed = true;
  } finally {
    if (handle) await handle.close().catch(() => {});
    if (!committed) await unlink(temporaryPath).catch(() => {});
  }
}

/**
 * 保存设置。字段都做了校验，坏输入直接带着人话报错回去。
 * [local patch 0.3.2] 新增 engine / base：
 *   base 是【当前引擎】的地址，服务端按 engine 归到 sovitsBase 或 mossBase 里，两个地址互不覆盖。
 *   仍接受旧的 ttsUrl 字段名，老客户端/老测试不用改。
 * @param input - { engine, base, referenceAudioPath }，空字符串表示"恢复默认"。
 * @returns 校验后的配置（与 readRuntimeConfig 同形）。
 */
export async function saveRuntimeConfig(input = {}) {
  const current = readRuntimeConfig();
  const engine = input.engine === undefined ? current.engine : normalizeEngine(input.engine);
  const rawBaseInput = typeof input.base === 'string' ? input.base : (typeof input.ttsUrl === 'string' ? input.ttsUrl : '');
  const rawBase = rawBaseInput.trim();
  const rawAudio = typeof input.referenceAudioPath === 'string' ? input.referenceAudioPath.trim() : '';
  let sovitsBase = current.sovitsBase;
  let mossBase = current.mossBase;
  if (rawBase !== '') {
    const normalized = normalizeTtsBase(rawBase);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    if (engine === ENGINE_MOSS) mossBase = normalized.base;
    else sovitsBase = normalized.base;
  }
  if (rawAudio !== '' && !/[\\/]/.test(rawAudio)) {
    return { ok: false, error: '参考音频要填完整路径，例如 C:\\Users\\你\\.dsh\\fairy-voice\\reference\\fairy_ref.wav' };
  }
  await writeJsonPrivate(RUNTIME_CONFIG_PATH, {
    version: 2,
    engine,
    sovitsBase,
    mossBase,
    referenceAudioPath: rawAudio === '' ? DEFAULT_REFERENCE_AUDIO_PATH : rawAudio,
  });
  return { ok: true, config: readRuntimeConfig() };
}

/** 用当前配置构造一次性的 TTS 传输层（改了设置不用重启）。 */
export function buildTtsTransport(config, deps = {}) {
  const { fetchImpl = fetch, ttsTimeoutMs = 180_000, statusTimeoutMs = 3_000 } = deps;
  /* [local patch 0.3.2] 按引擎分派。两条路的对外形状完全一致（status / stream），
   * 所以上层的朗读流程一行都不用改。默认仍是 SoVITS，不选就等于没改过。 */
  if (normalizeEngine(config?.engine) === ENGINE_MOSS) {
    return createMossTtsTransport({
      fetchImpl,
      base: config.base,
      generateUrl: config.ttsUrl,
      healthUrl: config.docsUrl,
      referenceAudioPath: config.referenceAudioPath,
      timeoutMs: ttsTimeoutMs,
      statusTimeoutMs,
    });
  }
  return createLocalTtsTransport({
    fetchImpl,
    ttsUrl: config.ttsUrl,
    docsUrl: config.docsUrl,
    referenceAudioPath: config.referenceAudioPath,
    referencePrompt: readReferencePrompt(config),
    ttsTimeoutMs,
    statusTimeoutMs,
  });
}

const REFERENCE_PROMPT_FALLBACK = '根据用户协议，我无权回复该问题。主人将在合适的时间与合适的场合获知答案。';

/** 参考音频对应的提示文本；读不到时用内置兜底文本（不影响能否出声）。 */
export function readReferencePrompt(config) {
  try {
    const text = readFileSync(config.referencePromptPath, 'utf8').trim();
    return text === '' ? REFERENCE_PROMPT_FALLBACK : text;
  } catch {
    return REFERENCE_PROMPT_FALLBACK;
  }
}

/* ------------------------------------------------------------------ */
/* 自检                                                                */
/* ------------------------------------------------------------------ */

function shortError(error) {
  const code = error?.cause?.code || error?.code || '';
  const message = String(error?.message || error || '未知错误');
  return code === '' ? message : `${message}（${code}）`;
}

/** 把网络错误翻译成"人事儿"。 */
function describeNetworkError(error, base) {
  const code = error?.cause?.code || error?.code || '';
  if (code === 'ECONNREFUSED') {
    return `连不上 ${base}：这台电脑上没有任何程序在监听这个端口（连接被拒绝）。`;
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `连不上 ${base}：这个主机名解析不了，地址可能写错了。`;
  }
  if (code === 'ECONNRESET') return `连上了 ${base}，但对方把连接掐断了。`;
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return `到不了 ${base}：网络不通（跨机器时常见是防火墙没放行）。`;
  if (error?.name === 'AbortError' || String(error?.message).includes('timeout')) {
    return `${base} 能连上，但一直没有回应（超时）。`;
  }
  return `访问 ${base} 失败：${shortError(error)}`;
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 检查一：本地朗读服务是否在跑（按当前引擎看对应的探测地址和端口）。 */
async function checkService(fetchImpl, config) {
  /* [local patch 0.3.2] 两种引擎的探测方式：
   *   SoVITS → GET /docs（有文档页）
   *   MOSS   → GET /health（它的健康检查端点） */
  const isMoss = config.engine === ENGINE_MOSS;
  const title = isMoss ? '本地朗读服务（MOSS-TTS-Nano）' : '本地朗读服务（GPT-SoVITS）';
  const probePath = isMoss ? MOSS_HEALTH_PATH : '/docs';
  const portHint = isMoss ? '18083' : '9880';
  const howToStart = isMoss
    ? '① 启动本机的 MOSS-TTS-Nano 服务（默认监听 18083），启动后这里就会变绿。还没装 MOSS 的话：回到上面的「朗读设置」，点「复制安装说明」，把复制到的那段话发给你的 AI Agent，它会照着写好的说明装；'
    : '① 启动本机的 GPT-SoVITS（默认监听 9880），启动后这里就会变绿；';
  const addressLabel = isMoss ? 'MOSS 地址' : 'SoVITS 地址';
  try {
    const response = await fetchWithTimeout(fetchImpl, config.docsUrl, { method: 'GET' }, DOCS_TIMEOUT_MS);
    if (response.ok) {
      /* [local patch 0.3.2] MOSS 的 /health 会多说几句（引擎、后端、模型加载状态），
       * 直接摊给使用者看 —— 省得为了一句话去翻服务端的命令行窗口。 */
      let detail = `已连上 ${config.base}，服务在正常运行。`;
      if (isMoss) {
        try {
          const health = await response.json();
          const parts = [];
          if (health?.engine) parts.push(`引擎 ${health.engine}`);
          if (health?.backend) parts.push(`后端 ${health.backend}`);
          if (health?.model_loaded === true) parts.push('模型已加载');
          else if (health?.model_loaded === false) parts.push('模型尚未加载（第一次朗读会多等十几秒，属正常）');
          if (typeof health?.cpu_threads === 'number') parts.push(`${health.cpu_threads} 线程`);
          if (parts.length > 0) detail = `已连上 ${config.base} —— ${parts.join('；')}。`;
        } catch { /* 不是我们的服务、或没回 JSON，就只报「连上了」 */ }
      }
      return { id: 'service', title, level: 'ok', detail, fix: '' };
    }
    if (response.status === 404 || response.status === 405) {
      return {
        id: 'service',
        title,
        level: 'fail',
        detail: `${config.base} 上有东西在回应，但它不认 ${probePath} 这个地址（HTTP ${response.status}）——多半不是${isMoss ? ' MOSS-TTS-Nano' : ' GPT-SoVITS，或者用的是老版 api.py'}。`,
        fix: isMoss
          ? `确认这个端口跑的是 MOSS-TTS-Nano 的 Web 服务（app_onnx.py 或 moss-tts-nano serve，默认 ${portHint}）。端口被别的程序占了就换一个，改完点上面的「保存设置」。`
          : '确认这个端口跑的是 GPT-SoVITS 的推理接口（api_v2.py）。如果端口被别的程序占了，改用 SoVITS 实际监听的端口，改完点上面的「保存设置」。',
      };
    }
    return {
      id: 'service',
      title,
      level: 'fail',
      detail: `${config.base} 返回了 HTTP ${response.status}，不是预期的正常响应。`,
      fix: `先打开 ${config.docsUrl} 看看能不能显示正常内容；不能的话，说明服务没起好或被网关拦了。`,
    };
  } catch (error) {
    return {
      id: 'service',
      title,
      level: 'fail',
      detail: describeNetworkError(error, config.base),
      fix: `两种选择：${howToStart}② 如果你已经把服务跑在别的端口或另一台电脑上，把地址填到上面的「${addressLabel}」并保存。注意跨机器时对方要监听 0.0.0.0，并在防火墙放行该端口。`,
    };
  }
}

/** 检查二：参考音频文件在不在。 */
function checkReference(config) {
  const report = (path) => {
    try {
      const info = statSync(path);
      return { exists: true, size: info.size, directory: info.isDirectory() };
    } catch (error) {
      return { exists: false, code: error?.code || '', directory: false, size: 0 };
    }
  };
  const audio = report(config.referenceAudioPath);
  const prompt = report(config.referencePromptPath);
  const directory = dirname(config.referenceAudioPath);
  let neighbours = [];
  try {
    neighbours = readdirSync(directory).filter((name) => /\.(wav|mp3|flac|ogg)$/i.test(name)).slice(0, 8);
  } catch {
    neighbours = [];
  }
  const audioSeconds = audio.exists && audio.size > 44 ? ((audio.size - 44) / PCM_BYTES_PER_SECOND) : 0;
  const detailParts = [];
  detailParts.push(audio.exists
    ? `参考音频已找到：${config.referenceAudioPath}（${Math.round(audio.size / 1024)} KB${audioSeconds > 0 ? `，约 ${audioSeconds.toFixed(1)} 秒` : ''}）`
    : `参考音频没找到：${config.referenceAudioPath}`);
  detailParts.push(prompt.exists
    ? `参考文本已找到：${config.referencePromptPath}`
    : `参考文本没找到：${config.referencePromptPath}（这个缺失不致命，会用内置兜底文本）`);
  if (!audio.exists && neighbours.length > 0) {
    detailParts.push(`不过这个目录里还有这些音频，可能是文件名写错了：${neighbours.join('、')}`);
  }
  if (audio.exists && audio.size > 0 && audio.size < 20_480) {
    detailParts.push('这个音频不到 20 KB，可能太短了，合成质量会受影响（建议 3–10 秒的干净人声）。');
  }
  if (audio.exists && audioSeconds > 20) {
    detailParts.push('这个音频超过 20 秒，SoVITS 用长参考音容易跑偏（建议剪到 3–10 秒）。');
  }
  return {
    id: 'reference',
    title: '参考音频（决定音色）',
    level: audio.exists && audio.size > 0 ? 'ok' : 'fail',
    detail: detailParts.join('　'),
    fix: audio.exists && audio.size > 0
      ? ''
      : `把一段 3–10 秒的干净人声存成 WAV，放到这个目录里：${dirname(config.referenceAudioPath)}（插件启动时会自动把它建好，里面还有一份 README.txt 说明）。或者把音频放到任意位置，再把完整路径填到上面的「参考音频路径」并保存。`,
    meta: { audioExists: audio.exists, promptExists: prompt.exists, audioBytes: audio.size, neighbours },
  };
}

/**
 * 检查三（MOSS 路线）。[local patch 0.3.2]
 * 与下面 SoVITS 那条路的区别：这里【直接复用真正的传输层】，
 * 所以自检测的就是朗读时实际会走的那条路，不是另写一份"看起来差不多"的请求。
 */
async function checkSynthesisMoss(fetchImpl, config) {
  const started = Date.now();
  const transport = buildTtsTransport(config, { fetchImpl, ttsTimeoutMs: SYNTH_TIMEOUT_MS });
  let opened;
  try {
    opened = await transport.stream(SELFCHECK_SENTENCE, undefined);
  } catch (error) {
    return {
      id: 'synthesis',
      title: '实际合成测试（说一句听听）',
      level: 'fail',
      detail: shortError(error),
      fix: 'MOSS 服务连得上，但这一次合成失败了。常见原因：① 参考音频读不到（要填这台电脑上的完整路径）；② MOSS 那边模型还在加载，等十几秒再点一次；③ 看 MOSS 自己的命令行窗口有没有报错。',
    };
  }
  const elapsedMs = Date.now() - started;
  let bytes = 0;
  try {
    for await (const chunk of opened.response.body) {
      bytes += chunk.length;
      if (bytes >= SYNTH_MAX_BYTES) break;
    }
  } catch (error) {
    return {
      id: 'synthesis',
      title: '实际合成测试（说一句听听）',
      level: 'fail',
      detail: `开始出音频了，但中途断了：${shortError(error)}`,
      fix: '重试一次；仍然断的话，看 MOSS 的命令行窗口有没有报错信息。',
    };
  } finally {
    if (typeof opened.release === 'function') opened.release();
  }
  if (bytes === 0) {
    return {
      id: 'synthesis',
      title: '实际合成测试（说一句听听）',
      level: 'fail',
      detail: 'MOSS 说成功了，但一个字节的音频都没返回。',
      fix: '多半是模型没加载好。去 MOSS 的命令行窗口看报错信息，或先跑一次它的 infer_onnx.py 确认能出声。',
    };
  }
  const seconds = bytes / PCM_BYTES_PER_SECOND;
  return {
    id: 'synthesis',
    title: '实际合成测试（说一句听听）',
    level: 'ok',
    detail: `合成成功：${Math.round(bytes / 1024)} KB 音频（约 ${seconds.toFixed(1)} 秒），耗时 ${(elapsedMs / 1000).toFixed(1)} 秒。到这一步后端已经没问题了。`,
    fix: '',
    meta: { bytes, seconds, elapsedMs },
  };
}

/** 检查三：真的合成一句话——这是"到底能不能出声"最硬的证据。 */
async function checkSynthesis(fetchImpl, config, serviceOk) {
  if (!serviceOk) {
    return {
      id: 'synthesis',
      title: '实际合成测试（说一句听听）',
      level: 'fail',
      detail: '上一项没通过，跳过合成测试。先把服务跑起来再点一次自检。',
      fix: '先解决上面「本地朗读服务」那一项。',
    };
  }
  /* [local patch 0.3.2] MOSS 收的是 multipart 表单、回的是 JSON+base64 WAV，
   * 与下面手搓的 SoVITS 请求体不是一回事，所以走单独一条路。
   * SoVITS 那条路一个字节都没动。 */
  if (config.engine === ENGINE_MOSS) return checkSynthesisMoss(fetchImpl, config);
  const started = Date.now();
  let response;
  try {
    response = await fetchWithTimeout(fetchImpl, config.ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: SELFCHECK_SENTENCE,
        text_lang: 'zh',
        ref_audio_path: config.referenceAudioPath,
        prompt_text: readReferencePrompt(config),
        prompt_lang: 'zh',
        text_split_method: 'cut5',
        batch_size: 1,
        media_type: 'raw',
        streaming_mode: 1,
        fragment_interval: 0.14,
        parallel_infer: false,
      }),
    }, SYNTH_TIMEOUT_MS);
  } catch (error) {
    return {
      id: 'synthesis',
      title: '实际合成测试（说一句听听）',
      level: 'fail',
      detail: describeNetworkError(error, config.ttsUrl),
      fix: '服务能连上但合成请求发不出去，通常是 SoVITS 正在加载模型或卡住了。看它的命令行窗口有没有报错，重启一次再试。',
    };
  }
  const elapsedMs = Date.now() - started;
  if (!response.ok) {
    let body = '';
    try {
      body = (await response.text()).slice(0, 400).replace(/\s+/g, ' ');
    } catch { /* 读不到就算了，状态码本身已经有信息量 */ }
    return {
      id: 'synthesis',
      title: '实际合成测试（说一句听听）',
      level: 'fail',
      detail: `服务回了 HTTP ${response.status}${body === '' ? '' : `：${body}`}`,
      fix: '最常见的两个原因：① 参考音频路径在 SoVITS 那台机器上不存在（跨机器时路径要写对方机器上的路径）；② 参考文本内容与音频不匹配。按返回的提示改，改完再点自检。',
    };
  }
  let bytes = 0;
  try {
    if (response.body) {
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes >= SYNTH_MAX_BYTES) break;
      }
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      bytes = buffer.length;
    }
  } catch (error) {
    return {
      id: 'synthesis',
      title: '实际合成测试（说一句听听）',
      level: 'fail',
      detail: `开始出音频了，但中途断了：${shortError(error)}`,
      fix: 'SoVITS 侧不稳定或显存不够。关掉其它占显卡的程序，或把 SoVITS 的模型换成更小的版本再试。',
    };
  }
  if (bytes === 0) {
    return {
      id: 'synthesis',
      title: '实际合成测试（说一句听听）',
      level: 'fail',
      detail: '服务说成功了，但一个字节的音频都没返回。',
      fix: '多半是模型没加载好，去 SoVITS 的命令行窗口看报错信息。',
    };
  }
  const seconds = bytes / PCM_BYTES_PER_SECOND;
  return {
    id: 'synthesis',
    title: '实际合成测试（说一句听听）',
    level: 'ok',
    detail: `合成成功：${Math.round(bytes / 1024)} KB 音频（约 ${seconds.toFixed(1)} 秒），耗时 ${(elapsedMs / 1000).toFixed(1)} 秒。到这一步后端已经没问题了。`,
    fix: '',
    meta: { bytes, seconds, elapsedMs },
  };
}

/**
 * 跑一遍自检。所有检查都会跑完（不因一项失败而中断），
 * 这样使用者一次就能看到全貌。
 * @param options - { fetchImpl, config, withSynthesis }。
 * @returns { ok, headline, checks, config }。
 */
export async function runVoiceSelfCheck({ fetchImpl = fetch, config = readRuntimeConfig(), withSynthesis = true } = {}) {
  const checks = [{
    id: 'host',
    title: '插件宿主（dsh-fairy-voice）',
    level: 'ok',
    detail: '能拿到这份自检结果，说明插件已经在 DSH 里正常加载。',
    fix: '',
  }];
  const service = await checkService(fetchImpl, config);
  checks.push(service);
  checks.push(checkReference(config));
  if (withSynthesis) {
    checks.push(await checkSynthesis(fetchImpl, config, service.level === 'ok'));
  } else {
    checks.push({
      id: 'synthesis',
      title: '实际合成测试（说一句听听）',
      level: 'warn',
      detail: '本次跳过了合成测试。',
      fix: '想验证后端到底能不能出声，就点「开始自检（含试合成）」。',
    });
  }
  const failed = checks.filter((check) => check.level === 'fail');
  const warned = checks.filter((check) => check.level === 'warn');
  const headline = failed.length > 0
    ? `还有 ${failed.length} 项没过：${failed.map((check) => check.title).join('、')}`
    : warned.length > 0
      ? `基本可用（${warned.length} 项提醒）`
      : '全部通过，朗读功能可用了。';
  return { ok: failed.length === 0, headline, checks, config };
}
