"""Fairy-DSH 配套：MOSS 朗读服务验证器。

用途：**装完之后证明它真的能用**，而不是"看起来启动了"。
安装脚本会调用它，你自己或你的 AI Agent 也可以随时单独跑。

它检查三件事，正好对应插件自检里的第 2、4 项：
  1. /health 通不通、回的是什么（引擎 / 后端 / 模型是否已加载）
  2. /api/generate 能不能真的合成出一句话（这一条才是硬证据）
  3. 拿回来的音频格式对不对（插件要的是 48kHz 源 → 转 32kHz 单声道）

用法：
  <MOSS 的 venv>\\Scripts\\python.exe verify.py [--base http://127.0.0.1:18083] [--reference <参考音频.wav>]

退出码：0 = 全过；1 = 有失败项（供脚本判断）。
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import sys
import wave
from pathlib import Path

try:
    import requests
except ModuleNotFoundError:
    print("[X] 这个 Python 环境里没有 requests。用 MOSS 的 venv 里的 python 跑本脚本。")
    sys.exit(1)

SENTENCE = "语音自检，一二三四五，Fairy 朗读正常。"
OK = "[OK]"
BAD = "[X]"
WARN = "[!]"


def check_health(base: str, timeout: float) -> tuple[bool, dict]:
    print(f"- 探测 {base}/health ...")
    try:
        response = requests.get(f"{base}/health", timeout=timeout)
    except Exception as error:  # noqa: BLE001 - 要把原因原样报出来
        print(f"  {BAD} 连不上：{error}")
        print("      → 服务没起来，或者端口不对。启动命令见文档「怎么启动」。")
        return False, {}
    if response.status_code != 200:
        print(f"  {BAD} 返回 HTTP {response.status_code}：{response.text[:200]}")
        return False, {}
    try:
        health = response.json()
    except ValueError:
        print(f"  {BAD} 返回的不是 JSON：{response.text[:200]}")
        print("      → 这个端口上跑的多半不是我们的 server.py（官方 app_onnx.py 的 /health 也回 JSON，")
        print("        但它的合成端点会因为缺 pynini 而 500，见下面第 2 项）。")
        return False, {}
    print(f"  {OK} {json.dumps(health, ensure_ascii=False)}")
    if health.get("model_loaded") is False:
        print(f"  {WARN} 模型还没加载 —— 第一次合成会多等十几秒，属正常。")
    if "text_normalization" in health:
        print(f"      文本规范化：{health['text_normalization']}")
    return True, health


def check_synthesis(base: str, reference: Path, timeout: float) -> bool:
    print(f"- 用参考音频真合成一句话：{reference}")
    if not reference.is_file():
        print(f"  {BAD} 参考音频不存在：{reference}")
        print("      → 随便找一段 3–10 秒的干净人声 wav 传进来：--reference <路径>")
        return False
    try:
        with reference.open("rb") as handle:
            files = {"prompt_audio": (reference.name, handle.read(), "audio/wav")}
        response = requests.post(
            f"{base}/api/generate",
            data={"text": SENTENCE, "enable_text_normalization": "0", "cpu_threads": "4"},
            files=files,
            timeout=timeout,
        )
    except Exception as error:  # noqa: BLE001
        print(f"  {BAD} 请求失败：{error}")
        return False
    if response.status_code != 200:
        print(f"  {BAD} 返回 HTTP {response.status_code}：{response.text[:300]}")
        body = response.text
        if "No module named 'tn'" in body:
            print("      → 你起的是【官方 app_onnx.py】，不是本仓库的 server.py。")
            print("        官方服务在启动预热时强制要 WeTextProcessing，而 pynini 在 Windows 上没有轮子。")
            print("        换成：<venv python> tools/moss-tts-server/server.py")
        elif "No module named 'transformers'" in body:
            print("      → 依赖没装全：pip install transformers==4.57.1")
        elif "No module named" in body:
            print("      → 缺依赖，把上面那个模块名装上再试。")
        return False
    try:
        payload = response.json()
    except ValueError:
        print(f"  {BAD} 返回的不是 JSON：{response.text[:200]}")
        return False
    encoded = payload.get("audio_base64") or ""
    if encoded == "":
        print(f"  {BAD} 没有返回音频：{json.dumps(payload, ensure_ascii=False)[:300]}")
        return False
    wav_bytes = base64.b64decode(encoded)
    print(f"  {OK} 拿到音频 {len(wav_bytes)} 字节，服务自报采样率 {payload.get('sample_rate')}")
    return check_wav(wav_bytes)


def check_wav(wav_bytes: bytes) -> bool:
    print("- 检查音频格式 ...")
    try:
        with wave.open(io.BytesIO(wav_bytes)) as handle:
            channels = handle.getnchannels()
            rate = handle.getframerate()
            frames = handle.getnframes()
    except Exception as error:  # noqa: BLE001
        print(f"  {BAD} 不是合法的 WAV：{error}")
        return False
    seconds = frames / rate if rate else 0
    print(f"  {OK} {rate} Hz / {channels} 声道 / {seconds:.2f} 秒")
    if seconds < 0.5:
        print(f"  {WARN} 音频短于 0.5 秒，参考音频可能太短或文本太短。")
    print(f"  {OK} 插件侧会自动转成 32000 Hz 单声道再播，所以这里 48kHz 立体声是正常的。")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="验证 MOSS 朗读服务是否真的可用")
    parser.add_argument("--base", default="http://127.0.0.1:18083")
    parser.add_argument("--reference", default="", help="参考音频 wav 路径")
    parser.add_argument("--health-timeout", type=float, default=5.0)
    parser.add_argument("--synth-timeout", type=float, default=300.0)
    args = parser.parse_args()

    base = args.base.rstrip("/")
    print("=" * 60)
    print("MOSS 朗读服务验证")
    print("=" * 60)

    healthy, _ = check_health(base, args.health_timeout)
    if not healthy:
        print("\n结论：服务层没过，先把它跑起来再谈其它。")
        sys.exit(1)

    # 没指定参考音频就找 MOSS 仓库自带的样本；都没有就报错（不猜路径）
    if args.reference:
        reference = Path(args.reference)
    else:
        reference = None
        for candidate in (
            Path(r"E:\MOSS-TTS-nano\repo\assets\audio\zh_1.wav"),
            Path.cwd() / "assets" / "audio" / "zh_1.wav",
        ):
            if candidate.is_file():
                reference = candidate
                break
        if reference is None:
            print(f"\n{BAD} 没找到参考音频，请用 --reference <路径> 指定一段 3–10 秒的干净人声 wav。")
            sys.exit(1)
    synthesised = check_synthesis(base, reference, args.synth_timeout)

    print()
    print("=" * 60)
    if healthy and synthesised:
        print(f"{OK} 全部通过：这个服务可以给 Fairy 朗读用了。")
        print("     下一步：DSH → 设置 → Fairy → 朗读设置 →")
        print(f"     朗读引擎选「MOSS-TTS-Nano」，地址填 {base} → 保存设置")
        sys.exit(0)
    print(f"{BAD} 有项目没过，见上面的提示。")
    sys.exit(1)


if __name__ == "__main__":
    main()
