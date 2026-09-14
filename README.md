# Fairy-DSH

**给 DSH 加一只看着您的 Fairy** —— 浮层、HDD 视觉主题、朗读（**可以不依赖显卡！**）、余额、截图 Dock。

> ⚠️ **这是非官方整理分支。**
> 基于 [橙汁本色](https://github.com/Chengzhibense/Fairy-DSH) 的 **Fairy-DSH** 源代码整理而成，
> 上游原创代码按 **Apache-2.0** 发布。本分支只做**安装分发**和少量本地增强。
>
> **有问题请提到[本仓库 Issues](https://github.com/Guzhou2002/Fairy-DSH-Optimized/issues)
> 或交流群 `1124349108`，请不要打扰上游作者。**

> 📌 **当前版本 v0.3.6** —— 版本号见仓库根 [`VERSION`](VERSION)；
> [发布页](https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest) ·
> 本版修了什么见 [`RELEASE-NOTES.md`](RELEASE-NOTES.md)

---

## 装起来

### 🤖 让 Agent 帮你装

把下面这段话丢给你的 DSH Agent：

> 从 https://github.com/Guzhou2002/Fairy-DSH-Optimized 安装 `dsh-fairy-visual` 和
> `dsh-balance-meter`和`dsh-fairy-voice` 到我的 web profile，**不要**装 `dsh-fairy-startup` 和 `dsh-browser-dock`。
> 更完整的说明见 **[AGENTS.md](AGENTS.md)**。
> 装完执行 `dsh --profile web --dump-config` 确认已经挂载。


### 🟢 完全不懂技术 → 下载、双击

| 下载这个 | 装什么 | 给谁用 |
| --- | --- | --- |
| **[`install.cmd`](https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/install.cmd)** | 3 个：视觉浮层 + 朗读 + 余额 | ✅ **推荐，绝大多数人用这个** |
| **[`install_full.cmd`](https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/install_full.cmd)** | 全部 5 个（多装启动画面 + 截图 Dock，**有已知风险**） | ⚠️ 清楚后果、确实想要的人 |

**📦 下载哪个？**

- **只想装（推荐）**：下 `install.cmd`，双击 —— 自动装 3 个安全插件（视觉浮层 / 朗读 / 余额）
- **想要全部 5 个**：下 `install_full.cmd`，双击（装前会先把风险讲清楚并要求确认）
- 不想用安装器：直接下 5 个 `.tgz`，用 `dsh plugin --profile web add <文件路径>` 装

下载完 **双击它**，按屏幕上的中文提示走就行。缺什么它会自己装、自己说人话，失败了也会告诉你卡在哪一步、该怎么办。

> 💡 这两个链接**永远指向最新版** —— 收藏起来，想更新时重新下载再双击一次就行。
>
> ⚠️ 如果你是从 **Releases 页面**进来的，会看到一堆 `.tgz` 文件 ——
> **那些不用管**，只需要下载里面的 `install.cmd`（或 `install_full.cmd`）。

### 🟡 会敲命令 → 一条就够

```powershell
dsh plugin --profile web add `
  https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/dsh-fairy-visual.tgz `
  https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/dsh-fairy-voice.tgz `
  https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/dsh-balance-meter.tgz
```

> 用的是别的 profile？把 `web` 换成你的 profile 名。
> 想装某几个而不是全部？把不要的那几行 URL 删掉。


---

## ⚠️ 装之前先看这张表

| 插件 | 干什么 | 建议 |
| --- | --- | --- |
| `dsh-fairy-visual` | **核心**。宠物浮层、HDD 主题、界面重绘、设置里的 Fairy 面板 | ✅ **推荐** |
| `dsh-fairy-voice` | 朗读回复（可接本机 GPT-SoVITS，也可用浏览器自带语音） | ✅ 可用，朗读需额外配置 |
| `dsh-balance-meter` | 侧栏显示 DeepSeek 余额 | ✅ 可用 |
| `dsh-fairy-startup` | 启动画面 | ⚠️ **谨慎**：每次启动都会清空会话选择并自动开新会话，**你上次没结束的对话可能就找不回来了** |
| `dsh-browser-dock` | 截图 Dock | ❌ **不建议**：控制 token 会交给任何能访问 Web 端口的程序；页面截图会落盘；takeover 功能还硬编码了 macOS 路径，Windows 上根本用不了 |

**`install.cmd` 只装前 3 个。** 后两个必须显式用 `install_full.cmd` 安装，它会先把风险讲清楚再问你。

---

## 装完做什么

| 步骤 | 做什么 |
| --- | --- |
| 1 | **重启 DSH**（关掉再打开） |
| 2 | 设置 → **Fairy** → 把最上面的「**启用**」打开 |
| 3 | （可选）想把 Fairy 当默认人设：同一个设置页里打开「**Fairy 人设预设**」 |
| 4 | （可选）想用朗读：点「**开始自检**」，看能不能出声 |

> 💡 **第 2 步不做的话，视觉和朗读都不会出现** —— 插件装好后默认是关着的，这是故意的。

---

## 需要什么

| 项 | 说明 |
| --- | --- |
| **DSH** | 已装好、能正常启动 |
| **Node.js** | ≥ 20。`install.cmd` 会检查；缺了它会告诉你去哪装 |
| **pnpm** | ⚠️ 装 DSH 时**不会**自带它。用 `install.cmd` 会自动帮你装；手动装是 `npm install -g pnpm` |
| **网络** | 要能连上 GitHub Releases 和 npm 仓库。**国内建议挂代理**，否则可能卡在下载那一步 |
| **GPT-SoVITS** | **只有**用朗读功能才需要。不装也能用其他部分 |

---

## 朗读功能：两条路线（GPT-SoVITS / MOSS-TTS-Nano）

`dsh-fairy-voice` 的朗读有**两个引擎**，默认仍是上游设计的本机 GPT-SoVITS：

| 引擎 | 需要什么 | 适合谁 |
| --- | --- | --- |
| **GPT-SoVITS**（默认，上游原路） | 本机跑 SoVITS（`127.0.0.1:9880`）+ 参考音频。**流式**：边合成边播 | 有显卡、想要最好的音色 |
| **MOSS-TTS-Nano** | 装一套 MOSS（本机 `127.0.0.1:18083`）+ **同一个参考音频**。**CPU 就能跑**，不要显卡 | 没显卡、不想折腾 SoVITS |

在 **设置 → Fairy → 朗读设置 → 朗读引擎** 里切换，**改完即时生效、不用重启**；
两个引擎各自记住自己的地址，来回切换不会丢。**参考音频两份共用**，不用配两遍。

> ⚠️ **MOSS 那条路要自己先装**：在仓库目录跑一条命令即可（坑都写死了，可重复运行）
> ```powershell
> .\tools\install-moss.ps1
> ```
> 不想自己动手的：**设置 → Fairy → 朗读设置** 里有「**复制安装说明**」按钮，
> 把复制到的那段话发给你的 AI Agent，它会照着一份写好的说明去装。
> 装好后本仓库配套的 `tools\moss-tts-server\server.py` 就是它的服务端 ——
> 它为什么存在、为什么不用官方的 `app_onnx.py`，见下面「本地改动」里的说明。
>
> ⚠️ MOSS 是**整句合成完再出声**（不像 SoVITS 那样流式），所以按了朗读要等几秒才开始响，
> 这是设计如此、不是卡住了。本机实测约 **0.45× 实时**（10.5 秒合成 4.7 秒语音）。

### GPT-SoVITS 这条路的具体要求

| 项 | 要求 |
| --- | --- |
| TTS 服务 | 默认本机 `http://127.0.0.1:9880`；**可在设置里改成别的端口或另一台机器** |
| 参考音频 | `~/.dsh/fairy-voice/reference/fairy_ref.wav`（**路径可在设置里改**）；建议 3–10 秒干净人声。该目录**插件启动时自动创建** |
| 参考文本 | 同目录 `fairy_ref.txt`（缺失时用内置回落文案，不影响出声） |

没跑 GPT-SoVITS 时：**朗读按钮是灰色的**、不会出声 —— 这是上游设计，不是故障。

### 你的东西放在哪（和插件代码是分开的）

| | 路径 | 说明 |
| --- | --- | --- |
| **插件代码** | 源码装：你 clone 的目录 / `~/.dsh/plugins/…`<br>`dsh plugin add` 装：**profile 下的 `node_modules`** | 随时可能被重装、清掉、换版本 |
| **你的数据** | `~/.dsh/fairy-voice/` | `reference/`（音色）、`runtime/config.json`（设置）、`voice-brain.json`（语音简报密钥） |

**为什么必须分开**：`dsh plugin add <包>` 会把包**解进 profile 的 `node_modules`**，
而那是 **pnpm 随时会重建**的目录 —— 把音色和 API Key 放进去，**升一次版本就没了**。

所以你的东西一律留在 `~/.dsh/fairy-voice/`：它由插件**运行时**自己创建，
**跟插件装在哪、怎么装、装几次都无关**。

### 先点一次「开始自检」（强烈建议）

群友最常见的困惑是"朗读不好使"，却看不出卡在哪一层。设置 → **Fairy** → **朗读自检** → 点「开始自检」，
会逐项给出结论与修法（7 项）：插件宿主 / 本地朗读服务 / 参考音频 / **真实合成一句话** /
浏览器音频能力 / 朗读控件是否挂上 / 消息识别。

面板底部的「复制诊断信息」会把结果写进剪贴板（**不含任何聊天内容**），直接粘到群里即可，不用截图、不用看日志。

> 自检面板里也写明了：**朗读按钮与自动朗读开关只在真实会话页面出现**，
> 首页和刚建的空白会话不显示 —— 这是 DSH 自身的设计。

### 设置里只有一个 Fairy 入口

原来有「HDD 视觉与 Fairy 身份」和「语音简报」两个入口，现在合并为一个：设置 → **Fairy**。里面还有：

- **朗读设置**：`SoVITS 地址`（或 MOSS 地址）、`参考音频路径` 可直接改并保存，**改完即时生效、无需重启**
- **语音简报（可选）**：原「语音简报」的 API Key 表单搬到了这里

> 说明：`fairy-voice` **没有语音输入功能**。输入框左侧那个控件是「自动朗读开关 / 音量」，
> 不是麦克风；而且它只在 HDD 模式开启时出现。

---

## 自检工具

双击根目录的 **`verify.cmd`**，它会在**临时目录**里新建一套完全独立的 DSH 环境 →
启动 → 无头浏览器探针 → 自动清理。**不会碰你现有的 profile。**

DSH 升级后建议先跑一次（上游依赖官方 DOM 选择器与私有 slot 契约，升级后可能静默降级）。

---

## 兼容性：为什么它能跑在你的版本上

**请勿自行"统一版本"。** `dsh-fairy-visual` 的宿主侧第一行是：

```js
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
```

该导出在 **`0.1.1-rc.2` 存在**，但在 **`0.1.2-rc.1` 已被移除**（改为 `installSettingsSection`）。
插件把依赖**精确 pin 到 `0.1.1-rc.2`**，因此 pnpm 会为它安装一份自己的副本；
而 `settingsNamespace` 只是「校验命名空间格式后原样返回字符串」，与宿主的 `settings.register(ns, schema)` 完全兼容。

> 一旦把这个依赖提升/覆盖成宿主的 `0.1.2-rc.1`，插件会在导入阶段直接失败。

**升级提醒**：上游设计依赖官方 DOM 选择器、ARIA 锚点与 slot 私有契约。
DSH 升级后若界面元素变化，插件会**静默降级**（有 capability 上报机制，不会崩）。

---

## 部署机制：`dsh.bundle`

每个插件包在 `package.json` 里声明了：

```json
"dsh": { "bundle": { "patch": "./cordis.patch.yml" }, "client": { "platform": "web" } }
```

并各自带一个 `cordis.patch.yml`（只有一条 insert 行）。DSH CLI 在 `plugin add` 之后会把
**声明了 `dsh.bundle` 的依赖自动追加进 `dsh.profile.bundles`**，于是插件自动成为 profile 的一层。

> **0.1.x 的老写法已废弃**：那时靠脚本往 profile 的 `cordis.patch.yml` 里写一个「Fairy-DSH managed block」。
> 现在如果你是从很老的版本升级上来的，`install.cmd` 不会再动那个块，遇到重复注册请手动清理。

---

## 环境要求

| 项 | 要求 |
| --- | --- |
| 系统 | Windows（脚本为 PowerShell；插件本身跨平台） |
| DSH | `0.1.2-rc.1` 实测通过；上游在 `0.1.1-rc.2` 验收 |
| Node.js | ≥ 20 |
| pnpm | 安装时需要，用于装插件依赖 |
| 浏览器 | 自检时需要 Chrome 或 Edge（脚本会自动探测） |

首次安装需要联网（从 GitHub 和 npm 拉取），装好后离线可用。

---

## 已知限制与注意

1. **会和别的 UI 插件抢 DOM**：若你已装了其他改界面的插件（如 `beauticode`、`whale-widget`、
   `live2d-companion`、`liang-slider`、`ui-task-board`），建议先禁用一部分再启用 Fairy。
2. **`fairy-startup`** 每次加载都会清空会话选择，谨慎启用（默认不装）。
3. **`fairy-voice`** 的长回答（≥260 字）会发往 `api.deepseek.com` 做语音简报，
   密钥明文存于 `~/.dsh/fairy-voice/voice-brain.json`。
4. **`browser-dock`** 会暴露控制 token、缓存页面截图，不建议安装（默认不装）。
5. 上游仓库自带的测试 profile 使用 `danger-full-access` + `approval: never`，**本整合包未采用**。
6. 上游仓库不含完整世界观语料、TTS 模型与用户数据；《绝区零》相关素材不随包分发，
   本项目不授予相关版权、商标或官方关联权利。

---

## 本地改动（相对上游）

上游文件的所有改动都用 `[local patch 0.x.x]` 注释标注（Apache-2.0 §4(b) 对 modified files 的要求）。

**完整说明已挪到独立文档**（内容太长，放 README 里会喧宾夺主）：

> 📄 **[`docs/本地改动.md`](docs/本地改动.md)**
>
> 朗读引擎可切换 MOSS-TTS-Nano（0.3.2）· 消息识别适配（0.3.1）· 诊断信息与异常提示（0.3.1）
> · 分发方式（0.3.0）· 朗读自检与地址可配置（0.2.3）· 设置栏合并（0.2.0）

一句话版本：**表现层（人设语料 / 布局 / 样式）自始至终一个字节没动**；
改的都是安装分发、设置面板、朗读的读取适配层与引擎分支 —— 每处都有 `[local patch]` 注释，上面那份文档逐条对应。

---

## 许可与归属

- **上游原创代码**：Apache License 2.0，作者 **橙汁本色**，见 `LICENSE` / `NOTICE` / `UPSTREAM-README.md`
- **第三方依赖**：各自许可，见 `THIRD_PARTY_NOTICES.md`
- **本整合包**：仅做整理与打包，不改变上游代码逻辑（例外见「本地改动」）
- **本分支作者**：孤舟蓑笠 ｜ 交流群 1124349108

> ### ⚠️ 这是**非官方**分支，出问题请不要找上游作者
>
> 上游作者（橙汁本色）**没有参与本分支的任何改动**。安装脚本、设置栏合并、朗读自检、
> 人设一键默认这些都是本分支加的，找他解决不了，还会平白打扰人家。
>
> - 本分支的问题 → 提到 [本仓库 Issues](https://github.com/Guzhou2002/Fairy-DSH-Optimized/issues) 或进群说
> - 本分支与上游的关系、如何合并上游更新 → 见 `docs\仓库与上游.md`

---

## 更多文档

| 文件 | 内容 |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | **给 AI Agent 看的**：标准安装指令、可装/不可装清单、**故障判定表（含"该停下来问人"的清单）** |
| **[`docs\本地改动.md`](docs/本地改动.md)** | **本分支相对上游改了什么、为什么改**（分发方式 / 消息识别适配 / 诊断面板 / MOSS 引擎 / 设置栏合并） |
| **[`docs\接手-v0.3.2.md`](docs/接手-v0.3.2.md)** | **接手这份仓库先读这个**：上一轮干了什么、还剩什么没做、这一轮学到的教训 |
| `docs\交接摘要.md` | 全量档案：当前状态、待办、全部踩坑记录（含 `.cmd` 编码陷阱） |
| `docs\Release正文模板.md` | 发版时填 Release 正文用（**带「提交前自检」清单**，防止又漏贴「下载哪个 / 装完做什么 / SHA256」） |
| `docs\安装机制实测.md` | `dsh plugin add` 各种形态的实测记录 |
| `docs\仓库与上游.md` | 怎么合并上游更新 |
| `docs\改动清单.md` | 相对上游的文件分类清单（新增 / 修改 / 改名 / 删除） |
| `docs\install-moss.md` | **给 AI Agent 的任务书**：装 MOSS-TTS-Nano（朗读的第二引擎，CPU 可跑） |
| `docs\调研-同源项目Fairy-DSH-Exp.md` | 生态里的同源项目 + **DSH 运行时契约**（含"组 id 同名会卡死事件循环"） |
| `docs\调研-CPU音色克隆引擎.md` | 无显卡可玩的音色克隆引擎调研（MOSS-TTS-Nano 等） |
| `docs\旧版说明-v0.2.3.md` | **v0.2.3 及之前的旧文档存档**（已不适用，仅备查） |
| `legacy\README.md` | 已废弃的旧脚本说明 |

---

## 出问题了？

> 🔎 **先看这条**：如果只是"朗读不出声"，**不用翻日志** ——
> 设置 → **Fairy** → 点「**开始自检**」，它会逐项告诉你卡在哪一层，并给出修法。
>
> 下面按**症状**分组查。每行都写了「**怎么认出来**」和「**怎么办**」。

### A. 装不上

| 症状 | 怎么认出来 / 怎么办 |
| --- | --- |
| 双击 `.cmd` **一闪就没了** | 窗口瞬间消失，什么都没看到。**从命令行跑一次就能看到它说了什么**：Win+R → 输入 `cmd` → 回车 → 把 `.cmd` 文件**拖进黑窗口** → 回车 |
| 卡在下载很久不动 | 网络问题。挂上代理再试；也可以改用 `install.cmd`（它自带网络自查） |
| 开头一堆乱码 + `'xx' is not recognized as an internal or external command`，**但标题和部分提示又显示正常** | ⚠️ **这是安装器的编码坏了，不是你的操作问题。** 在命令行敲 `chcp`：显示 **936** 说明你这台机器会中招。**重新下载一次安装器**；还不行就进群说 |
| 报 `dsh: pnpm failed` | 没装 pnpm。执行 `npm install -g pnpm`，然后重试 |
| 提示 **404** / 下载不到文件 | 用了带版本号的旧链接。用本文档上面那两个 `latest/download` 链接 —— **它们永远指向最新版** |
| 提示缺 Node / pnpm | Node 要 **≥ 20**；pnpm 用 `npm install -g pnpm`（**装 DSH 时不会自带它**） |

### B. 装上了，但界面上什么都没出现

| 症状 | 怎么办 |
| --- | --- |
| 一点变化都没有 | **99% 是这两步没做**：① **重启 DSH**（关掉再打开）② **设置 → Fairy → 打开最上面的「启用」**。插件装好后**默认是关着的**，这是故意的，不是坏了 |
| 重启了、也开了，还是没有 | 跑 `dsh --profile web --dump-config`，看输出里有没有 `fairy-visual` 这一条 |
| 设置里根本找不到「Fairy」 | 同上；并确认你装的是 `dsh-fairy-visual`（**提供设置面板的就是它**） |
| 报 `settingsNamespace` 不存在 | 依赖被解析错了 —— 见上面「**兼容性**」一节。**千万不要自己"统一版本"** |

### C. 朗读不出声 / 按钮是灰的

| 症状 | 怎么办 |
| --- | --- |
| 朗读按钮**是灰色的** | 先确认：本机有没有跑 GPT-SoVITS（`127.0.0.1:9880`）。没跑的话按钮就是灰的 —— **这是上游设计，不是故障** |
| 跑了 SoVITS 还是不出声 | 设置 → Fairy → 点「**开始自检**」。7 项会逐项告诉你卡在哪层：插件宿主 / 本地朗读服务 / 参考音频 / **真实合成一句话** / 浏览器音频能力 / 朗读控件 / 消息识别 |
| 自检说缺参考音频 | 放一段 **3–10 秒干净人声**到 `~/.dsh/fairy-voice/runtime/reference/fairy_ref.wav`（路径也能在设置里改）。同目录的 `fairy_ref.txt` 缺失**不影响出声**（有内置回落文案） |
| 朗读控件**整个不见** | 有三个前提：装的是 `fairy-visual`、**HDD 视觉模式已开**、而且**必须停在真实会话页面** —— 首页和刚建的空白会话**就是不显示**，这是 DSH 自身的设计 |
| "输入框左边那个是不是麦克风？" | **不是。** `fairy-voice` **完全没有语音输入功能**。那个控件是「自动朗读开关 / 音量」，而且只在 HDD 模式开启时出现 |

### D. 界面乱 / 变慢 / 和别的插件打架

| 症状 | 怎么办 |
| --- | --- |
| 界面元素错位、被挤掉 | Fairy 会和**改界面**的插件抢 DOM。先禁用其他同类插件，再启用 Fairy：`beauticode`、`whale-widget`、`live2d-companion`、`liang-slider`、`ui-task-board` |
| 用久了变卡 | **已知未覆盖项**：Fairy 含页面级动画与监听（`document.body` 级监听 + rAF 动画 + 定时器），**没有做过长时间压测**。卡的话先关掉「启用」开关，再进群反馈 |

### E. 卸载 / 彻底重来

```powershell
dsh plugin --profile web remove dsh-fairy-visual dsh-fairy-voice dsh-balance-meter
```

也可以双击根目录的 **`install.cmd`** 重装一遍 —— 它同时是**安装器**和**修复器**。

### F. 要把问题发到群里

**别截图、别贴日志** —— 设置 → Fairy → 面板**最底部**点「**复制诊断信息**」，
把结果直接粘进群里就行。它**不含任何聊天内容**，只有字段名和状态。

> 🤖 **让 AI Agent 帮你排查**：本仓库的 [`AGENTS.md`](AGENTS.md) 里有一份**更细的故障判定表**
> —— 每一行都写了"看到什么信号 = 卡在哪一层 = 该做什么、什么时候必须停下来问人"。
> 可以把那份文件直接喂给你的 DSH Agent。
