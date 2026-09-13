# 调研 · CPU 音色克隆引擎（不依赖 NVIDIA 显卡）

> 生成时间：**2026-09-13**（第三轮）。用途：回答群友「没显卡能不能玩音色克隆」，
> 并给 §6 中期目标「语音引擎可插拔」选定第一个备选引擎。
> **本文只做调研记录，不含代码改动，不影响任何已发布产物。**

---

## 1. 结论速览

| 引擎 | 参数 | CPU 实时 | 零样本克隆 | 中文 | 许可 | 适配难度 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **MOSS-TTS-Nano** | 0.1B | ✅ 官方主推 CPU 实时（4 核） | ✅ 参考音频 | ✅ 20 语言含 zh | **Apache-2.0** | 低（有本地 HTTP 服务） | 🟢 **首选候选** |
| GPT-SoVITS（现状） | ~1.5B 级 | ⚠️ 能跑但慢，社区有 CPU 加速 fork | ✅ | ✅ | MIT | — | 已有，但吃机器 |
| index-tts-2.5-mnn | 未核实 | 声称 MNN CPU | ✅ | ✅ | 未核实 | 未知 | 🟡 待核实 |
| CosyVoice2-0.5B | 0.5B | 有 CPU 讨论（博客口径） | ✅ | ✅ | Apache-2.0 | 中 | 🟡 待核实 |
| F5-TTS | 未核实 | 待核实 | ✅ | ✅ | 待核实 | 中 | 🟡 待核实 |
| Kokoro / ChatTTS | — | ✅ | ❌ 固定音色 | — | — | — | ⚪ 不是克隆引擎，只作兜底 TTS |

**一句话**：**MOSS-TTS-Nano 是唯一一个"官方自己就把 CPU 实时 + 零样本克隆 + 中文 + Apache-2.0"四件事同时写进 README 的**，
其余候选都停在「社区说能跑」这一级，需要实测才能定论。

---

## 2. MOSS-TTS-Nano（重点）

来源：<https://github.com/OpenMOSS/MOSS-TTS-Nano>（OpenMOSS / MOSI.AI 出品）

### 2.1 已核实的事实

| 项 | 值 | 出处 |
| --- | --- | --- |
| 参数规模 | **0.1B（100M）** | README「Main Features」 |
| 输出格式 | **48 kHz / 2 声道** | 同上 |
| 语言 | **20 种，含中文（zh）** | README「Supported Languages」表 |
| 克隆方式 | **参考音频零样本克隆**（`--prompt-audio-path` / `--prompt-speech`），支持长文本自动分块克隆 | README Quickstart |
| 架构 | 纯自回归：**Audio Tokenizer + LLM** | 同上 |
| CPU 能力 | 官方口径：**流式生成可跑在 4 核 CPU 上**；ONNX 版在 **MacBook Air M4 单核**流畅 | README「CPU friendly」+ News 2026-04-17 |
| **ONNX CPU 版** | 2026-04-17 发布，**推理期不要 PyTorch**，效率约为原版 **2 倍** | README News + 「ONNX CPU Inference」 |
| 权重 | `OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX` + `.../MOSS-Audio-Tokenizer-Nano-ONNX`（HuggingFace / ModelScope 均有） | README |
| **许可** | **Apache-2.0** | GitHub API `license.spdx_id`（2026-09-13 查） |
| 活跃度 | **4344 stars / 551 forks / 24 open issues**，仓库 2026-09-13 仍有更新 | GitHub API |

> ⚠️ README 的「License」小节文字仍是占位句（"如 LICENSE 未发布则视为未授权再分发"），
> **但 GitHub API 已明确返回 `Apache-2.0`**。以 API 为准；若真要在本仓库二次分发权重，
> 建议顺手把 `LICENSE` 原文抓下来存档进 `THIRD_PARTY_NOTICES.md`。

### 2.2 部署要点（省钱/省空间相关）

- **Python 3.12 + conda** 是官方推荐（本机只有 Python 3.14，**必须用 uv 或 conda 另开 3.12 环境**）
- 依赖有坑：`pynini` / `WeTextProcessing` 在非 conda 环境下要先单独装 pynini wheel（README 已给解法 + Issue #6）
- ONNX 版**不需要 PyTorch** → **磁盘占用比 GPT-SoVITS 小得多**（对 C 盘紧张的现状是利好；具体体积待查 HF 文件大小，本文不编数字）
- 默认模型目录 `./models`，首次运行**自动从 HF 下载**
- 入口：`infer_onnx.py`（命令行）、`app_onnx.py`（本地 web demo，**`http://127.0.0.1:18083`**）、
  CLI `moss-tts-nano generate --backend onnx` / `moss-tts-nano serve --backend onnx`

### 2.3 与本项目的接线关系（关键）

现状：`dsh-fairy-voice` 的朗读实现是**照 GPT-SoVITS 的 HTTP API（默认 `127.0.0.1:9880`）写的**。

MOSS-TTS-Nano 也**自带本地 HTTP 服务**（`app_onnx.py` / `serve`，端口 18083），
对应 §6 的「语音引擎可插拔」：

| 路线 | 做法 | 工作量 |
| --- | --- | --- |
| **A. 加引擎适配层** | 在 `fairy-voice` 里把"请求哪个 TTS 服务"抽象成可选项（`gpt-sovits` / `moss-nano` / 浏览器 `speechSynthesis`），设置页加一个下拉 | 中（要动 `fairy-voice`，**属于朗读逻辑，红线区**，需 `[local patch]` 注释 + README 同步） |
| **B. 写个协议转换小代理** | 起一个本地小程序，对外说 GPT-SoVITS 协议、对内转发给 18083 | 低（**完全不动插件**），但群友要多跑一个进程 |
| C. 直接用浏览器兜底 | `speechSynthesis`（系统 TTS） | 最低，但**不是音色克隆** |

> 🔴 **红线提醒**：`fairy-voice` 的朗读逻辑不许改（见 `docs\交接摘要.md` §0.1）。
> 若最终选 A，属于"新增引擎分支"而非改表现层，但仍须按老规矩加 `[local patch 0.2.x]` 注释并写进 README「本地改动」。

### 2.4 附加发现（可能有用的彩蛋）

- **MOSS-TTS-Nano-Reader**（<https://github.com/OpenMOSS/MOSS-TTS-Nano-Reader>）：
  README News 称其**能在浏览器扩展里直接跑模型，不需要单独的本地推理服务**。
  → 如果成立，这比装 Python 环境对群友友好得多。**本次未能打开该 README（网络失败），列为待核实第一项。**
- **vLLM-Omni** 提供了 MOSS-TTS-Nano 的 serving 示例，含 **OpenAI 兼容的 `/v1/audio/speech` 端点**。
  → 若将来走"服务端部署 + 多群友共用"，这是标准接口。

---

## 3. 其他候选（低置信度，仅作线索）

> ⚠️ 下面这些**全部来自搜索结果标题/博客，未经实测**，不要当结论用。

| 候选 | 线索 | 置信度 |
| --- | --- | --- |
| `index-tts-2.5-mnn` | PyPI 有包（<https://pypi.org/project/index-tts-2.5-mnn/>），走 **MNN** 推理，MNN 本身面向移动/CPU | 中（包真实存在，性能未知） |
| `baicai-1145/GPT-SoVITS-CPUFast` | 第三方 **GPT-SoVITS CPU 加速 fork** | 中（若真有效，是"现有引擎提速"的最低成本路线） |
| CosyVoice2-0.5B | CSDN 博客称流式首包 1.5s / 非流式 3.5s——**来源是博客，非官方** | 低 |
| F5-TTS | 有本地部署教程，CPU 速度未见官方数据 | 低 |
| OpenVoice V2 / zeroweight-ai/ZeroTTS | 搜索中出现，未展开 | 低 |
| GPT-SoVITS 自身 | 社区 issue（RVC-Boss/GPT-SoVITS #2237）称 **V3 比 V2 慢至少 50 倍** | 中（属用户报告） |

---

## 4. 待核实清单（下次调研直接照这个打勾）

1. [ ] MOSS-TTS-Nano-Reader 到底是不是"浏览器内推理、零本地服务"
2. [ ] MOSS-TTS-Nano 本地服务的**具体 HTTP 路由与请求/响应字段**（接线前必须拿到，不能猜）
3. [ ] ONNX 权重**实际磁盘占用**（决定能不能塞进 C 盘）
4. [ ] 中文**自然度 / 情感表现**横向对比 GPT-SoVITS（只能靠耳朵，需实机试听）
5. [ ] 是否支持**非克隆的固定音色**（README 提到 built-in voices，需确认）
6. [ ] `index-tts-2.5-mnn` 与 `GPT-SoVITS-CPUFast` 的真实 CPU 表现

---

## 5. 建议的下一步（三选一，等用户拍板）

| 选项 | 内容 | 成本 |
| --- | --- | --- |
| **① 先试听**（推荐） | 在 D:/E: 用 uv 开 Python 3.12 环境 → 装 ONNX 版 → 拿一句中文 + 参考音频跑 `infer_onnx.py` → **用耳朵决定值不值得继续** | 几百 MB 磁盘 + 一次下载 |
| ② 先看文档 | 只把 §4 的 1/2/3 项查清（Reader 能力、HTTP 接口、模型体积），不动机器 | 约 1 万 token |
| ③ 暂缓 | 先不装任何东西，等 SoVITS 那边定了再说 | 0 |

> 📌 与 SoVITS 的关系：**如果 ① 试听满意，SoVITS 就可以先不装**（省下 6–9 GB 和一堆显卡麻烦），
> 直接走 MOSS 路线；这也顺便满足了"腾空间"的诉求。
