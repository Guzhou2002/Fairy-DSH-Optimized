"""Fairy-DSH 配套：MOSS-TTS-Nano 轻量 HTTP 服务。

为什么不用官方的 app_onnx.py：
  官方服务在启动预热时**强制**加载 WeTextProcessing 文本规范化（app.py 第 220-229 行），
  而它依赖的 pynini 在 **Windows 上没有任何 PyPI 轮子**（只有 manylinux 与源码包），
  pip 装 = 现场编译，需要 MSVC 生成工具。官方 README 给的解法是 conda，
  但那等于让使用者为了一句话朗读先装一整套 conda 环境。

本服务走另一条路：直接用 onnx_tts_runtime，**与官方命令行 infer_onnx.py 完全同一条**，
只是不启用文本规范化。代价是数字/符号的读法不做特殊处理，收益是零编译、零 conda。

接口与官方 app_onnx.py 对齐，所以 Fairy 插件那边不需要任何特殊适配：
  GET  /health          -> {"status": "ok", ...}
  POST /api/generate    -> multipart 表单(text, prompt_audio) -> {"audio_base64": ..., "sample_rate": ...}

用法：
  <MOSS 的 venv>\\Scripts\\python.exe server.py [--port 18083] [--cpu-threads 4]
"""
from __future__ import annotations

import argparse
import base64
import os
import sys
import tempfile
import threading
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse

# 默认指向 MOSS-TTS-Nano 的源码目录；装到别处就设环境变量 MOSS_REPO。
DEFAULT_REPO = os.environ.get("MOSS_REPO", r"E:\MOSS-TTS-nano\repo")
sys.path.insert(0, DEFAULT_REPO)

from onnx_tts_runtime import OnnxTtsRuntime  # noqa: E402  (必须在 sys.path 调整之后导入)

app = FastAPI(title="Fairy MOSS-TTS-Nano bridge")

_runtime: OnnxTtsRuntime | None = None
_runtime_lock = threading.Lock()
_cpu_threads = 4


def get_runtime() -> OnnxTtsRuntime:
    """懒加载并复用模型。第一次请求会慢十几秒（要加载 ONNX 权重），之后就好了。"""
    global _runtime
    with _runtime_lock:
        if _runtime is None:
            _runtime = OnnxTtsRuntime(
                model_dir=None,          # None = 用 <repo>/models，缺了会自动下载
                thread_count=_cpu_threads,
                max_new_frames=375,
                do_sample=True,
                sample_mode="fixed",
                execution_provider="cpu",
            )
        return _runtime


@app.get("/health")
def health() -> dict[str, object]:
    """插件自检的第 2 项就是打这个端点，所以必须稳定返回 200。"""
    return {
        "status": "ok",
        "engine": "moss-tts-nano",
        "backend": "onnx-cpu",
        "cpu_threads": _cpu_threads,
        "model_loaded": _runtime is not None,
        "text_normalization": "disabled (by design: pynini has no Windows wheels)",
    }


@app.post("/api/generate")
async def generate(
    text: str = Form(...),
    prompt_audio: UploadFile | None = File(None),
    cpu_threads: int = Form(0),
) -> JSONResponse:
    """与官方同名端点同形：收 multipart，回 JSON + base64 的 WAV。"""
    resolved = str(text or "").strip()
    if resolved == "":
        return JSONResponse(status_code=400, content={"error": "text is required."})
    if prompt_audio is None:
        return JSONResponse(status_code=400, content={"error": "prompt_audio is required (voice cloning needs a reference clip)."})

    threads = int(cpu_threads) if int(cpu_threads or 0) > 0 else _cpu_threads

    suffix = Path(prompt_audio.filename or "ref.wav").suffix or ".wav"
    reference_fd, reference_path = tempfile.mkstemp(suffix=suffix, prefix="fairy_ref_")
    output_fd, output_path = tempfile.mkstemp(suffix=".wav", prefix="fairy_out_")
    os.close(output_fd)
    try:
        with os.fdopen(reference_fd, "wb") as handle:
            handle.write(await prompt_audio.read())
        runtime = get_runtime()
        if threads != runtime.thread_count:
            runtime.thread_count = threads
        result = runtime.synthesize(
            text=resolved,
            voice="",                       # 有参考音频时用不上内置音色
            prompt_audio_path=reference_path,
            output_audio_path=output_path,
            sample_mode="fixed",
            do_sample=True,
            streaming=True,
            max_new_frames=375,
            voice_clone_max_text_tokens=75,
            enable_wetext=False,            # 本服务的设计前提：不做文本规范化
            enable_normalize_tts_text=True,  # 轻量的本地清洗仍然保留
            seed=None,
        )
        with open(result["audio_path"], "rb") as handle:
            wav_bytes = handle.read()
        return JSONResponse(
            content={
                "audio_base64": base64.b64encode(wav_bytes).decode("ascii"),
                "sample_rate": int(result["sample_rate"]),
                "engine": "moss-tts-nano",
            }
        )
    except Exception as error:  # noqa: BLE001 - 要把原因原样带回给调用方，便于自检显示
        return JSONResponse(status_code=500, content={"error": f"{type(error).__name__}: {error}"})
    finally:
        for path in (reference_path, output_path):
            try:
                os.unlink(path)
            except OSError:
                pass


def main() -> None:
    global _cpu_threads
    parser = argparse.ArgumentParser(description="Fairy-DSH 的 MOSS-TTS-Nano 轻量 HTTP 服务")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18083)
    parser.add_argument("--cpu-threads", type=int, default=max(1, min(8, (os.cpu_count() or 4))))
    args = parser.parse_args()
    _cpu_threads = args.cpu_threads

    import uvicorn

    print(f"MOSS-TTS-Nano bridge -> http://{args.host}:{args.port}  (cpu_threads={_cpu_threads})")
    print(f"repo: {DEFAULT_REPO}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
