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
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createLocalTtsTransport } from './local-tts-proxy.js';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const RUNTIME_DIR = join(homedir(), '.dsh', 'fairy-voice', 'runtime');
export const RUNTIME_CONFIG_PATH = join(RUNTIME_DIR, 'config.json');
export const DEFAULT_REFERENCE_AUDIO_PATH = join(RUNTIME_DIR, 'reference', 'fairy_ref.wav');
const DEFAULT_TTS_BASE = 'http://127.0.0.1:9880';
const SELFCHECK_SENTENCE = '语音自检，一二三四五，Fairy 朗读正常。';
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
  const normalized = normalizeTtsBase(stored?.ttsUrl ?? DEFAULT_TTS_BASE);
  const base = normalized.ok ? normalized.base : DEFAULT_TTS_BASE;
  const audio = typeof stored?.referenceAudioPath === 'string' && stored.referenceAudioPath.trim() !== ''
    ? stored.referenceAudioPath.trim()
    : DEFAULT_REFERENCE_AUDIO_PATH;
  const prompt = typeof stored?.referencePromptPath === 'string' && stored.referencePromptPath.trim() !== ''
    ? stored.referencePromptPath.trim()
    : join(dirname(audio), 'fairy_ref.txt');
  return {
    base,
    ttsUrl: `${base}/tts`,
    docsUrl: `${base}/docs`,
    referenceAudioPath: audio,
    referencePromptPath: prompt,
    configured: stored !== null,
    configPath: RUNTIME_CONFIG_PATH,
    defaultBase: DEFAULT_TTS_BASE,
    defaultReferenceAudioPath: DEFAULT_REFERENCE_AUDIO_PATH,
    fileProblem,
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
 * 保存设置。两个字段都做了校验，坏输入直接带着人话报错回去。
 * @param input - { ttsUrl, referenceAudioPath }，空字符串表示"恢复默认"。
 * @returns 校验后的配置（与 readRuntimeConfig 同形）。
 */
export async function saveRuntimeConfig(input = {}) {
  const current = readRuntimeConfig();
  const rawBase = typeof input.ttsUrl === 'string' ? input.ttsUrl.trim() : '';
  const rawAudio = typeof input.referenceAudioPath === 'string' ? input.referenceAudioPath.trim() : '';
  let base = current.base;
  if (rawBase !== '') {
    const normalized = normalizeTtsBase(rawBase);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    base = normalized.base;
  }
  if (rawAudio !== '' && !/[\\/]/.test(rawAudio)) {
    return { ok: false, error: '参考音频要填完整路径，例如 C:\\Users\\你\\.dsh\\fairy-voice\\runtime\\reference\\fairy_ref.wav' };
  }
  await writeJsonPrivate(RUNTIME_CONFIG_PATH, {
    version: 1,
    ttsUrl: base,
    referenceAudioPath: rawAudio === '' ? DEFAULT_REFERENCE_AUDIO_PATH : rawAudio,
  });
  return { ok: true, config: readRuntimeConfig() };
}

/** 用当前配置构造一次性的 TTS 传输层（改了设置不用重启）。 */
export function buildTtsTransport(config, deps = {}) {
  const { fetchImpl = fetch, ttsTimeoutMs = 180_000, statusTimeoutMs = 3_000 } = deps;
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

/** 检查一：本机 SoVITS 服务是否在跑。 */
async function checkService(fetchImpl, config) {
  try {
    const response = await fetchWithTimeout(fetchImpl, config.docsUrl, { method: 'GET' }, DOCS_TIMEOUT_MS);
    if (response.ok) {
      return {
        id: 'service',
        title: '本地朗读服务（GPT-SoVITS）',
        level: 'ok',
        detail: `已连上 ${config.base}，服务在正常运行。`,
        fix: '',
      };
    }
    if (response.status === 404 || response.status === 405) {
      return {
        id: 'service',
        title: '本地朗读服务（GPT-SoVITS）',
        level: 'fail',
        detail: `${config.base} 上有东西在回应，但它不认 /docs 这个地址（HTTP ${response.status}）——多半不是 GPT-SoVITS，或者用的是老版 api.py。`,
        fix: '确认这个端口跑的是 GPT-SoVITS 的推理接口（api_v2.py）。如果端口被别的程序占了，改用 SoVITS 实际监听的端口，改完点上面的「保存设置」。',
      };
    }
    return {
      id: 'service',
      title: '本地朗读服务（GPT-SoVITS）',
      level: 'fail',
      detail: `${config.base} 返回了 HTTP ${response.status}，不是预期的正常响应。`,
      fix: '先打开 ' + config.docsUrl + ' 看看能不能显示接口文档页；不能的话，说明服务没起好或被网关拦了。',
    };
  } catch (error) {
    return {
      id: 'service',
      title: '本地朗读服务（GPT-SoVITS）',
      level: 'fail',
      detail: describeNetworkError(error, config.base),
      fix: '两种选择：① 启动本机的 GPT-SoVITS（默认监听 9880），启动后这里就会变绿；② 如果你已经把 SoVITS 跑在别的端口或另一台电脑上，把地址填到上面的「SoVITS 地址」并保存。注意跨机器时对方要监听 0.0.0.0，并在防火墙放行该端口。',
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
      : '把一段 3–10 秒的干净人声存成 WAV 放到上述路径；或者把音频放到任意位置，然后把完整路径填到上面的「参考音频路径」并保存。文件名建议照抄默认值，能少踩坑。',
    meta: { audioExists: audio.exists, promptExists: prompt.exists, audioBytes: audio.size, neighbours },
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
