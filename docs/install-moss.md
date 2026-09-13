# 给 AI Agent：安装 MOSS-TTS-Nano（Fairy 朗读的第二个引擎）

> 这份文件是**给 AI Agent 读的任务书**，人类读者请看 [README.md](../README.md) 的「朗读功能」章节。
> 目标读者：用户把本文件喂给他自己的 DSH / Codex / Claude Code Agent，让 Agent 代替他完成安装。

---

## 0. 你要做什么（一句话）

在这个 Windows 机器上装好 **MOSS-TTS-Nano**，让它成为 DSH 里 Fairy 朗读的第二个引擎
（默认那个 GPT-SoVITS 需要显卡；MOSS 只 0.1B，**CPU 就能跑**）。

---

## 1. 先确认前提

| 项 | 要求 |
| --- | --- |
| 系统 | **Windows**（脚本是 PowerShell） |
| 磁盘 | 目标盘至少 **6 GB** 空闲（实际约用 4~5 GB） |
| 网络 | 能连 GitHub、PyPI、HuggingFace；**国内建议先把代理准备好** |
| 必需 | `git` 已装 |

---

## 2. 一条命令搞定

在 Fairy-DSH 仓库目录下：

```powershell
.\tools\install-moss.ps1
```

常用参数：

```powershell
.\tools\install-moss.ps1 -Root D:\MOSS-TTS-nano    # 装到别的盘（C 盘吃紧时用）
.\tools\install-moss.ps1 -Port 18084               # 换端口（18083 被占用时）
.\tools\install-moss.ps1 -Proxy http://127.0.0.1:7897   # 显式指定代理
.\tools\install-moss.ps1 -NoMirror                 # 不用清华 PyPI 镜像
```

脚本自己会做完这 7 步：检查环境 → 装 Python 3.12 → 拉源码 → 建虚拟环境装依赖 →
下载 ONNX 权重 → 部署服务端 → **自检**。

**脚本已经把 6 个坑写死了**，你不用也不应该自己动手去装依赖：

1. 固定用 **Python 3.12**（3.14 上 torch 轮子未必齐）
2. uv 的 Python / 缓存 / HuggingFace 缓存**全部指到目标盘**（C 盘常年吃紧）
3. `huggingface_hub` **必须 <1.0**（1.x 移除了代码里在用的参数）
4. **要装 `transformers`**（官方 README 说 ONNX 版不需要——那对命令行成立，对 HTTP 服务**不成立**）
5. **不装 WeTextProcessing**：它的依赖 `pynini` 在 PyPI 上**没有任何 Windows 轮子**，装了也只会现场编译失败
6. 下载源：先试 HuggingFace 官方（走代理），失败自动回退 `hf-mirror.com`

---

## 3. 装完必须验证（别跳）

**第一步**：跑验证器

```powershell
& "<安装目录>\venv\Scripts\python.exe" "<安装目录>\verify.py"
```

**通过的标准**（三项全过、退出码 0）：

- `/health` 返回 200 且是 JSON
- `/api/generate` **真的合成出音频**（不是"看起来启动了"）
- 音频是 48 kHz / 2 声道 / 有实际时长

**第二步**：告诉用户以后双击 `<安装目录>\start-moss.cmd` 启动服务。

**第三步**：告诉用户在 DSH 里做两件事——

1. **设置 → Fairy → 朗读设置 → 朗读引擎 → 选「MOSS-TTS-Nano」**
2. 地址填 `http://127.0.0.1:18083`（或你实际用的端口）→ 点「**保存设置**」（会自动重跑自检）

参考音频两个引擎**共用同一个**，默认路径：

```
%USERPROFILE%\.dsh\fairy-voice\reference\fairy_ref.wav
```

没有的话放一段 3–10 秒的干净人声 wav 进去；或在设置里把「参考音频路径」改成任意路径。

---

## 4. 失败判定表（**先拿判别信号，再动手**）

| 判别信号 | 判定 | 你该做什么 |
| --- | --- | --- |
| 脚本在 `[2/7]` 就退出，报 `NativeCommandError` | PowerShell 把原生程序的 stderr 当成了致命错误 | 本仓库的脚本已经处理过这一条。若你**自己另写了脚本**，把 `$ErrorActionPreference` 从 `Stop` 改成 `Continue`，并显式检查 `$LASTEXITCODE` |
| `uv` 装不上 / 找不到 Python | 机器上没有任何 Python | 先装一个 Python（3.10+）供 `pip install uv` 用；或直接装 [uv](https://docs.astral.sh/uv/) 官方二进制 |
| 依赖安装失败，报编译错误 | 多半是 `pynini` 被牵连进来 | 🛑 **停**：那是 WeTextProcessing 的依赖，Windows 上装不了。不要试图编译它，本方案不需要它 |
| 下载权重卡住 / 超时 | 网络 | 挂代理重跑脚本（已下好的不会重下）；或用 `-Proxy` 指定 |
| 下载报 `certificate has expired` | `hf-mirror.com` 证书问题 | 别用镜像：去掉 `HF_ENDPOINT`，走官方 + 代理 |
| 合成返回 **500**，正文含 `No module named 'tn'` | 🔴 **你起的是官方 `app_onnx.py`，不是本仓库的 `server.py`** | 换成 `<安装目录>\venv\Scripts\python.exe <安装目录>\server.py`。官方服务在启动预热时**强制**要 WeTextProcessing，而它在 Windows 上装不了 |
| 合成返回 500，正文含 `No module named 'transformers'` | 漏装依赖 | `pip install transformers==4.57.1` |
| 合成返回 500，正文含其它 `No module named 'X'` | 漏装依赖 | 把 X 装上（用 venv 的 pip） |
| 连不上 `127.0.0.1:18083` | 服务没起来 | 双击 `start-moss.cmd`，或手动起 `server.py` |
| 连上了但 `/health` 不是我们的 JSON | 端口被别的程序占了 | 换端口重装：`-Port 18084` |
| 第一次合成要等十几秒 | **正常**：模型首次加载 | 不用管。`/health` 里 `model_loaded` 会告诉你状态 |
| 合成很慢（约 0.45× 实时） | CPU 推理的正常水平 | 不用管；想快就用官方服务的 GPU 路径（但那样就得解决 pynini） |
| 装完 DSH 里还是不出声 | 引擎没切、或没保存 | 确认「朗读引擎」选了 MOSS 且点了「保存设置」，然后跑一次自检看第 2/4 项 |

**🛑 必须停下来问用户的情况**：

1. 需要改动 `~/.dsh` 下**已有**的文件（尤其 `profiles/`）——**一律不许动**
2. 需要删用户的目录、或 `git clean` / `reset --hard` 之类的破坏性操作
3. 需要 `conda` / MSVC / 内核级改动
4. 出现本表**没有**的症状，而你又**给不出判别信号**
5. 用户机器不是 Windows

---

## 5. 明确不要做的事

| 不要 | 为什么 |
| --- | --- |
| **不要改 `~/.dsh/profiles/`** | 那是用户的 DSH 配置，插件安装不该碰它。曾有第三方脚本往这里解压覆盖、把用户的 DSH 弄到起不来 |
| 不要装 `WeTextProcessing` / `pynini` | Windows 上没有轮子，装了只会失败；本方案不需要 |
| 不要把模型权重塞进 Fairy-DSH 仓库 | 730 MB，且分发策略是"脚本去下载" |
| 不要把 MOSS 仓库自带的 `assets/audio/*.wav` 当作长期参考音 | 那是**别人的声音**；让它只用于安装自检，正式使用请让用户自备 |
| 不要用官方 `app_onnx.py` 当服务端 | 见上表 `No module named 'tn'` 那一行 |
| 不要把 `start-moss.cmd` 改成含中文的版本 | 它是**纯 ASCII**，正是为了绕开 936 代码页把 `.cmd` 注释切坏的坑 |

---

## 6. 背景（想省时间可以跳）

- **为什么另写一个 `server.py`**：官方服务启动预热时强制加载 WeTextProcessing（`app.py` 第 220–229 行），
  而 `pynini` 在 PyPI 上 Windows 轮子数为 **0**（只有 manylinux + 源码包）。
  本仓库的 `server.py` 走官方命令行 `infer_onnx.py` 的同一条路（`OnnxTtsRuntime`），
  **接口与官方 `/api/generate` + `/health` 完全对齐**，所以 Fairy 插件那边零改动。
- **代价**：数字和符号不做特殊读法处理（不启用文本规范化）。日常朗读不受影响。
- **许可证**：MOSS-TTS-Nano 的**代码与权重均为 Apache-2.0**，允许再分发与商用。
  但**参考音频（音色）不是代码**，不能分发别人的声音。
