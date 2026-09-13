/*
 * Fairy-DSH [local patch 0.3.2]
 *
 * 针对新增的 MOSS 朗读引擎的回归测试。它们钉住两个**真实修过的 bug**：
 *   1. 48kHz 立体声 → 32kHz 单声道 Int16 的转换（客户端 PCM_SAMPLE_RATE = 32000）
 *   2. 自检必须能按「界面上当前填的」引擎去测，而不是永远读磁盘上已保存的
 *      （原来的 bug：把引擎切成 MOSS 再点自检，它去测了 SoVITS）
 *
 * 还有两个真实 bug 的回归点：
 *   3. 「重新自检」不得重置表单 —— 已由面板侧去掉 loadConfig() 修复，这里用纯函数侧兜住
 *   4. 非法地址不得覆盖已保存的地址
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { toClientPcm, parseWavPcm } from '../lib/server/moss-tts-transport.js';
import { applyConfigOverrides, ENGINE_MOSS, ENGINE_SOVITS } from '../lib/server/voice-selfcheck.js';

/** 造一段未压缩 PCM 的 WAV，用于测试。 */
function makeWav({ sampleRate = 48000, channels = 2, seconds = 0.5, freq = 440 } = {}) {
  const frames = Math.round(sampleRate * seconds);
  const data = Buffer.alloc(frames * channels * 2);
  for (let i = 0; i < frames; i += 1) {
    const value = Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 16000);
    for (let c = 0; c < channels; c += 1) data.writeInt16LE(value, (i * channels + c) * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);                     // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);                    // 16 位
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** 一份「已保存」的 SoVITS 配置，作为覆盖测试的基准。 */
function savedSovitsConfig() {
  const base = 'http://127.0.0.1:9880';
  return {
    engine: ENGINE_SOVITS,
    base,
    ttsUrl: `${base}/tts`,
    docsUrl: `${base}/docs`,
    sovitsBase: base,
    mossBase: 'http://127.0.0.1:18083',
    referenceAudioPath: 'C:\\ref\\fairy_ref.wav',
    referencePromptPath: 'C:\\ref\\fairy_ref.txt',
    configured: true,
    configPath: 'C:\\cfg\\config.json',
  };
}

test('parseWavPcm 读得出 WAV 头信息', () => {
  const parsed = parseWavPcm(makeWav({ sampleRate: 48000, channels: 2 }));
  assert.equal(parsed.sampleRate, 48000);
  assert.equal(parsed.channels, 2);
  assert.equal(parsed.bitsPerSample, 16);
  assert.ok(parsed.data.length > 0);
});

test('toClientPcm 把 48kHz 立体声转成 32kHz 单声道 Int16，且时长不变', () => {
  const result = toClientPcm(makeWav({ sampleRate: 48000, channels: 2, seconds: 0.5 }));
  // 0.5 秒 @ 32000Hz 单声道 16 位 = 16000 帧 * 2 字节
  assert.equal(result.sourceRate, 48000);
  assert.equal(result.channels, 2);
  assert.equal(result.frames, 16000);
  assert.equal(result.data.length, 32000);
  assert.equal(result.data.length % 2, 0, 'Int16 必须字节对齐');
});

test('toClientPcm 已经是 32kHz 单声道时原样通过（不做无谓重采样）', () => {
  const wav = makeWav({ sampleRate: 32000, channels: 1, seconds: 0.25 });
  const result = toClientPcm(wav);
  assert.equal(result.frames, 8000);
  assert.equal(result.data.length, 16000);
});

test('toClientPcm 对坏输入报明确错误码，而不是悄悄出一段噪声', () => {
  for (const bad of [Buffer.alloc(10), Buffer.alloc(64, 0x41)]) {
    assert.throws(() => toClientPcm(bad), (error) => error.code === 'local-service-failed');
  }
});

test('applyConfigOverrides：不传任何覆盖时，配置原样返回', () => {
  const saved = savedSovitsConfig();
  const effective = applyConfigOverrides(saved);
  assert.equal(effective.engine, ENGINE_SOVITS);
  assert.equal(effective.base, 'http://127.0.0.1:9880');
  assert.equal(effective.ttsUrl, 'http://127.0.0.1:9880/tts');
  assert.equal(effective.docsUrl, 'http://127.0.0.1:9880/docs');
});

test('applyConfigOverrides：切成 MOSS 时，探测地址必须跟着换（这是修过的 bug）', () => {
  const effective = applyConfigOverrides(savedSovitsConfig(), {
    engine: ENGINE_MOSS,
    base: 'http://127.0.0.1:18083',
  });
  assert.equal(effective.engine, ENGINE_MOSS);
  // 关键：不再去打 SoVITS 的 /docs，而是 MOSS 的 /health
  assert.equal(effective.docsUrl, 'http://127.0.0.1:18083/health');
  assert.equal(effective.ttsUrl, 'http://127.0.0.1:18083/api/generate');
  // 另一个引擎的地址不能被覆盖掉
  assert.equal(effective.sovitsBase, 'http://127.0.0.1:9880');
  assert.equal(effective.mossBase, 'http://127.0.0.1:18083');
});

test('applyConfigOverrides：切回 SoVITS 时也正确（来回切不串味）', () => {
  const mossSaved = { ...savedSovitsConfig(), engine: ENGINE_MOSS, base: 'http://127.0.0.1:18083' };
  const effective = applyConfigOverrides(mossSaved, {
    engine: ENGINE_SOVITS,
    base: 'http://127.0.0.1:9999',
  });
  assert.equal(effective.engine, ENGINE_SOVITS);
  assert.equal(effective.ttsUrl, 'http://127.0.0.1:9999/tts');
  assert.equal(effective.docsUrl, 'http://127.0.0.1:9999/docs');
  assert.equal(effective.mossBase, 'http://127.0.0.1:18083', 'MOSS 地址应保持原样');
});

test('applyConfigOverrides：地址填错时保留已保存的，不把配置弄成非法值', () => {
  const effective = applyConfigOverrides(savedSovitsConfig(), {
    engine: ENGINE_MOSS,
    base: '这不是一个地址',
  });
  assert.equal(effective.engine, ENGINE_MOSS);
  assert.equal(effective.mossBase, 'http://127.0.0.1:18083', '应回落到已保存的 MOSS 地址');
  assert.equal(effective.docsUrl, 'http://127.0.0.1:18083/health');
});

test('applyConfigOverrides：覆盖参考音频时，参考文本路径跟着一起算', () => {
  const effective = applyConfigOverrides(savedSovitsConfig(), {
    referenceAudioPath: 'D:\\voices\\other.wav',
  });
  assert.equal(effective.referenceAudioPath, 'D:\\voices\\other.wav');
  assert.equal(effective.referencePromptPath, 'D:\\voices\\fairy_ref.txt');
});

test('applyConfigOverrides：空的参考音频不覆盖（保住已保存的）', () => {
  const effective = applyConfigOverrides(savedSovitsConfig(), { referenceAudioPath: '   ' });
  assert.equal(effective.referenceAudioPath, 'C:\\ref\\fairy_ref.wav');
  assert.equal(effective.referencePromptPath, 'C:\\ref\\fairy_ref.txt');
});
