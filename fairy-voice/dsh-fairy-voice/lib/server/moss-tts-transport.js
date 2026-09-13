/*
 * Fairy-DSH [local patch 0.3.2]
 *
 * MOSS-TTS-Nano 朗读引擎的传输层。
 *
 * 为什么单独一个文件：上游把朗读写死成 GPT-SoVITS 一条路，local-tts-proxy.js 就是那条路的全部。
 * 这里给出「同形」的第二条路 —— 对外只暴露 status() / stream() 两个方法，
 * 上层（index.js / voice-selfcheck.js）完全不需要知道底下换成了谁。
 *
 * 与 SoVITS 的三处关键差异（决定了本文件为什么这么写）：
 *   1. MOSS 的 /api/generate 是【整段返回】：收 multipart 表单，回 JSON + base64 的 WAV。
 *      所以这里拿不到「流」，只能等整句合成完再往下喂 —— 首字延迟明显比 SoVITS 长。
 *   2. MOSS 出的是 48 kHz 立体声，而客户端要的是 32 kHz 单声道裸 Int16 PCM
 *      （见 client.js 的 PCM_SAMPLE_RATE = 32000 / PCM_BYTES_PER_SAMPLE = 2）。
 *      所以必须自己混音 + 重采样，否则会变调变快。
 *   3. MOSS 的 /api/generate 默认开启 WeTextProcessing 文本规范化，而它是个可选的重量级依赖
 *      （pynini，Windows 上尤其难装），所以这里默认显式关掉 ——
 *      关掉只影响数字/符号的读法，不影响能否出声。
 */
import { readFile } from 'node:fs/promises';

/** 客户端要的 PCM 格式，必须与 client.js 里的常量保持一致。 */
const PCM_SAMPLE_RATE = 32_000;
const PCM_BYTES_PER_SAMPLE = 2;

/** 超时：MOSS 在 CPU 上合成一句话约 8 秒，留足余量。 */
const DEFAULT_SYNTH_TIMEOUT_MS = 180_000;
const DEFAULT_STATUS_TIMEOUT_MS = 3_000;

/** 与 local-tts-proxy.js 用同一套错误码，客户端那边的提示文案不用改。 */
function transportError(message, code) {
  return Object.assign(new Error(message), { code });
}

/** 解析 WAV，返回 { sampleRate, channels, bitsPerSample, data }。只认未压缩 PCM。 */
export function parseWavPcm(buffer) {
  const view = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (view.length < 44) throw transportError('音频数据太短，不像是 WAV。', 'local-service-failed');
  if (view.toString('ascii', 0, 4) !== 'RIFF' || view.toString('ascii', 8, 12) !== 'WAVE') {
    throw transportError('返回的音频不是 WAV 格式（缺少 RIFF/WAVE 标记）。', 'local-service-failed');
  }
  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= view.length) {
    const id = view.toString('ascii', offset, offset + 4);
    const size = view.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      format = {
        audioFormat: view.readUInt16LE(body),
        channels: view.readUInt16LE(body + 2),
        sampleRate: view.readUInt32LE(body + 4),
        bitsPerSample: view.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = view.subarray(body, Math.min(body + size, view.length));
    }
    offset = body + size + (size % 2); // 块按偶数字节对齐
  }
  if (!format || !data) throw transportError('WAV 里没有找到 fmt 或 data 块。', 'local-service-failed');
  if (format.audioFormat !== 1) {
    throw transportError(`只支持未压缩 PCM 的 WAV（收到 format=${format.audioFormat}）。`, 'local-service-failed');
  }
  if (format.bitsPerSample !== 16) {
    throw transportError(`只支持 16 位 WAV（收到 ${format.bitsPerSample} 位）。`, 'local-service-failed');
  }
  return Object.assign({}, format, { data });
}

/**
 * 把 MOSS 出来的 WAV（48 kHz 立体声）转成客户端要的裸 PCM（32 kHz 单声道 Int16LE）。
 * 三步：混音到单声道 → 线性插值重采样 → 回写 Int16。
 */
export function toClientPcm(wavBuffer, targetRate = PCM_SAMPLE_RATE) {
  const wav = parseWavPcm(wavBuffer);
  const frameBytes = wav.channels * PCM_BYTES_PER_SAMPLE;
  const frames = frameBytes > 0 ? Math.floor(wav.data.length / frameBytes) : 0;
  if (frames === 0) throw transportError('WAV 里没有可用的音频采样。', 'local-service-failed');

  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    let sum = 0;
    for (let c = 0; c < wav.channels; c += 1) {
      sum += wav.data.readInt16LE((i * wav.channels + c) * PCM_BYTES_PER_SAMPLE);
    }
    mono[i] = sum / wav.channels / 32768;
  }

  const outFrames = wav.sampleRate === targetRate
    ? frames
    : Math.max(1, Math.floor((frames * targetRate) / wav.sampleRate));
  const out = Buffer.alloc(outFrames * PCM_BYTES_PER_SAMPLE);
  const step = outFrames > 1 ? (frames - 1) / (outFrames - 1) : 0;
  for (let i = 0; i < outFrames; i += 1) {
    const position = step === 0 ? 0 : i * step;
    const index = Math.floor(position);
    const next = index + 1 < frames ? index + 1 : frames - 1;
    const weight = position - index;
    const value = mono[index] * (1 - weight) + mono[next] * weight;
    const clamped = value > 1 ? 1 : value < -1 ? -1 : value;
    out.writeInt16LE(Math.round(clamped * 32767), i * PCM_BYTES_PER_SAMPLE);
  }
  return { data: out, sourceRate: wav.sampleRate, channels: wav.channels, frames: outFrames };
}

/** 把「父信号 → 子控制器」的桥接抽出来，与 local-tts-proxy.js 的行为保持一致。 */
function makeAbortScope(timeoutMs, parentSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onAbort = () => controller.abort(parentSignal?.reason || 'client-aborted');
  if (parentSignal?.aborted) onAbort();
  else parentSignal?.addEventListener('abort', onAbort, { once: true });
  const release = () => {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onAbort);
  };
  return { controller, release };
}

function toTransportError(error, aborted) {
  if (aborted) return transportError(String(aborted), aborted);
  if (error?.code === 'local-service-failed') return error;
  return transportError('MOSS 服务连不上或没有响应。', 'local-service-unavailable');
}

/**
 * @param options - { fetchImpl, base, generateUrl, healthUrl, referenceAudioPath,
 *                    timeoutMs, statusTimeoutMs, cpuThreads }
 * @returns 与 createLocalTtsTransport 同形：{ status(signal), stream(text, signal) }
 */
export function createMossTtsTransport({
  fetchImpl = fetch,
  base = 'http://127.0.0.1:18083',
  generateUrl,
  healthUrl,
  referenceAudioPath,
  timeoutMs = DEFAULT_SYNTH_TIMEOUT_MS,
  statusTimeoutMs = DEFAULT_STATUS_TIMEOUT_MS,
  cpuThreads = 4,
} = {}) {
  const generate = generateUrl || `${base}/api/generate`;
  const health = healthUrl || `${base}/health`;
  const useRealFetch = fetchImpl === fetch;

  async function synthesize(text, signal) {
    let audio;
    try {
      audio = await readFile(referenceAudioPath);
    } catch {
      throw transportError(
        `读不到参考音频：${referenceAudioPath}。MOSS 需要一段 3–10 秒的干净人声来做音色克隆，请先放好它。`,
        'local-service-failed',
      );
    }
    const form = new FormData();
    form.append('text', text);
    // 关掉 WeTextProcessing：它是可选的重依赖（pynini），装不上也要能出声。
    form.append('enable_text_normalization', '0');
    form.append('enable_normalize_tts_text', '1');
    form.append('cpu_threads', String(cpuThreads));
    form.append('prompt_audio', new Blob([audio], { type: 'audio/wav' }), 'fairy_ref.wav');

    const response = await fetchImpl(generate, { method: 'POST', body: form, signal });
    if (!response.ok) {
      throw transportError(`MOSS 合成失败（HTTP ${response.status}）。`, 'local-service-failed');
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw transportError('MOSS 返回的不是 JSON。', 'local-service-failed');
    }
    if (typeof payload?.audio_base64 !== 'string' || payload.audio_base64 === '') {
      throw transportError(payload?.error ? `MOSS 合成失败：${payload.error}` : 'MOSS 没有返回音频。', 'local-service-failed');
    }
    const pcm = toClientPcm(Buffer.from(payload.audio_base64, 'base64'));
    return pcm.data;
  }

  return {
    status(signal) {
      if (!useRealFetch) {
        return Promise.resolve(fetchImpl(health, { method: 'GET' })).then((response) => {
          if (!response.ok) throw transportError(`MOSS 返回 ${response.status}`, 'local-service-unavailable');
          return { available: true, reason: null };
        });
      }
      const scope = makeAbortScope(statusTimeoutMs, signal);
      return fetchImpl(health, { method: 'GET', signal: scope.controller.signal })
        .then((response) => {
          if (!response.ok) throw transportError(`MOSS 返回 ${response.status}`, 'local-service-unavailable');
          return { available: true, reason: null };
        })
        .catch((error) => { throw toTransportError(error, scope.controller.signal.aborted ? scope.controller.signal.reason : null); })
        .finally(scope.release);
    },
    /* 返回 { response, release } —— response.body 是已经转好格式的裸 PCM，
     * 上层拿它直接 pipe 给浏览器即可，与 SoVITS 那条路完全一致。 */
    stream(text, signal) {
      if (!useRealFetch) {
        return synthesize(text, signal).then((pcm) => ({
          response: new Response(pcm, { status: 200, headers: { 'content-type': 'application/octet-stream' } }),
          release: null,
        }));
      }
      const scope = makeAbortScope(timeoutMs, signal);
      return synthesize(text, scope.controller.signal).then(
        (pcm) => ({
          response: new Response(pcm, { status: 200, headers: { 'content-type': 'application/octet-stream' } }),
          release: scope.release,
        }),
        (error) => {
          scope.release();
          throw toTransportError(error, scope.controller.signal.aborted ? scope.controller.signal.reason : null);
        },
      );
    },
  };
}
