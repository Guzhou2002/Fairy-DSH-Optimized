# Fairy-DSH

**给 DSH 加一只看着您的 Fairy** —— 浮层、HDD 视觉主题、朗读、余额、截图 Dock。

> ⚠️ **这是非官方整理分支。**
> 基于 [橙汁本色](https://github.com/Chengzhibense/Fairy-DSH) 的 **Fairy-DSH** 源代码整理而成，
> 上游原创代码按 **Apache-2.0** 发布。本分支只做**安装分发**和少量本地增强。
>
> **有问题请提到[本仓库 Issues](https://github.com/Guzhou2002/Fairy-DSH-Optimized/issues)
> 或交流群 `1124349108`，请不要打扰上游作者。**

---

## 装起来

### 🤖 让 Agent 帮你装

把下面这段话丢给你的 DSH Agent：

> 从 https://github.com/Guzhou2002/Fairy-DSH-Optimized 安装 `dsh-fairy-visual` 和
> `dsh-balance-meter`和`dsh-fairy-voice` 到我的 web profile，**不要**装 `dsh-fairy-startup` 和 `dsh-browser-dock`。
> 更完整的说明见 **[AGENTS.md](AGENTS.md)**。
> 装完执行 `dsh --profile web --dump-config` 确认已经挂载。


### 🟢 完全不懂技术 → 下载、双击
- 📦 下载哪个？

- **只想装（推荐）**：下 `install.cmd`，双击 —— 自动装 3 个安全插件（视觉浮层 / 朗读 / 余额）
- **想要全部 5 个**：下 `install_full.cmd`，双击（装前会先把风险讲清楚并要求确认）
- 不想用安装器：直接下 5 个 `.tgz`，用 `dsh plugin --profile web add <文件路径>` 装
| 下载这个 | 装什么 | 给谁用 |
| --- | --- | --- |
| **[`install.cmd`](https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/install.cmd)** | 3 个：视觉浮层 + 朗读 + 余额 | ✅ **推荐，绝大多数人用这个** |
| **[`install_full.cmd`](https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/install_full.cmd)** | 全部 5 个（多装启动画面 + 截图 Dock，**有已知风险**） | ⚠️ 清楚后果、确实想要的人 |

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

## 出问题了？

| 现象 | 怎么办 |
| --- | --- |
| 双击 `.cmd` 一闪就没了 | 右键 → 以管理员身份运行；或者从命令行运行它，看它打出来的提示 |
| 卡在安装很久不动 | 网络问题。挂上代理再试一次；脚本里也写了自查办法 |
| 装好了但界面上什么都没有 | 设置 → Fairy → 把「**启用**」打开（这一步不能省） |
| 重启后设置里找不到 Fairy | 跑 `dsh --profile web --dump-config`，看有没有 `fairy-visual` 条目 |
| 朗读不出声 | 设置 → Fairy → 点「**开始自检**」，它会逐项告诉你卡在哪一层 |
| 报 `settingsNamespace` 不存在 | 依赖被解析错了，见下面「兼容性」一节 |
| 想卸载 | `dsh plugin --profile web remove dsh-fairy-visual dsh-fairy-voice dsh-balance-meter` |

---

## 朗读功能：需要本机 GPT-SoVITS

`dsh-fairy-voice` 的朗读**只走上游设计的本地 GPT-SoVITS 路线**：

| 项 | 要求 |
| --- | --- |
| TTS 服务 | 默认本机 `http://127.0.0.1:9880`；**可在设置里改成别的端口或另一台机器** |
| 参考音频 | `~/.dsh/fairy-voice/runtime/reference/fairy_ref.wav`（**路径可在设置里改**）；建议 3–10 秒干净人声 |
| 参考文本 | 同目录 `fairy_ref.txt`（缺失时用内置回落文案，不影响出声） |

没跑 GPT-SoVITS 时：**朗读按钮是灰色的**、不会出声 —— 这是上游设计，不是故障。

### 先点一次「开始自检」（强烈建议）

群友最常见的困惑是"朗读不好使"，却看不出卡在哪一层。设置 → **Fairy** → **朗读功能自检** → 点「开始自检」，
会逐项给出结论与修法（7 项）：插件宿主 / 本地朗读服务 / 参考音频 / **真实合成一句话** /
浏览器音频能力 / 朗读控件是否挂上 / 消息识别。

面板底部的「复制诊断信息」会把结果写进剪贴板（**不含任何聊天内容**），直接粘到群里即可，不用截图、不用看日志。

> 自检面板里也写明了：**朗读按钮与自动朗读开关只在真实会话页面出现**，
> 首页和刚建的空白会话不显示 —— 这是 DSH 自身的设计。

### 设置里只有一个 Fairy 入口

原来有「HDD 视觉与 Fairy 身份」和「语音简报」两个入口，现在合并为一个：设置 → **Fairy**。里面还有：

- **朗读服务设置**：`SoVITS 地址`、`参考音频路径` 可直接改并保存，**改完即时生效、无需重启**
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

上游文件的所有改动都用 `[local patch 0.2.x]` 注释标注（Apache-2.0 §4(b) 对 modified files 的要求）。

### 分发方式（0.3.0 起）

- 分发物从「zip + 安装器」换成 **5 个 `.tgz` + `install.cmd`**：群友只需下载一个文件、双击
- 每个插件包自带 `dsh.bundle` 声明，`dsh plugin add` 一条命令完成「安装 + 激活」
- `dsh-fairy-contracts` 的源码**内联进各包的 `vendor/`**，依赖里移除 —— 于是每个包都能独立分发
- 依赖改为 **hoisted 扁平布局**，包内 `node_modules` 零符号链接

### 消息识别适配：DSH 0.1.2-rc.1（0.3.1）

**症状**：设置 → Fairy 自检第 7 项「消息识别」永远 ❌；`useSession` 快照里根本没有 `chat`。

**根因**：DSH `0.1.2-rc.1` 把聊天内容从 `useSession` 快照中拆了出去。
会话槽位（`conversation.input.left`）另外提供了 `useChat` / `useConversation` / `useProjection` /
`useTrajectory` 等 hook，其中 **`useChat` 返回的正是旧的 `chat` 结构**
（`order` / `nodes` / `timeline.turnOrder` / `timeline.turns` / `legacy.nodes`）。

**改法**（只动「读消息的适配层」，朗读、合成、播放逻辑一行未改）：

- `VoiceController` 增加 `const __fairyChatValue = useChat((value) => value);`
- 选择器改为 `useSession(React.useCallback((v) => readVoiceTimeline(v, __fairyChatValue), [__fairyChatValue]))`
- `readVoiceTimeline(snapshot, __fairyChat)` 新增第二入参：`const chat = __fairyChat || snapshot?.chat;`
  —— 取不到时回落到旧结构，**兼容旧版 DSH**
- 其余 `snapshot?.chat?.legacy?.*` 改读 `chat?.legacy?.*`
- **`runningCalls` 兼容**：新结构的 `legacy` **不再提供 `runningCalls`**（原来用来判断"正在跑工具"）。
  现在改为**双来源**：先走 `legacy.runningCalls`，取不到就从 `chat.nodes.byKey` 里挑
  `status === 'running'` 且 kind 含 `tool` 的节点兜底；两条都空就跳过。
  诊断里的 `runningSource` 会告诉你这次用的是哪条：`legacy` / `nodes` / `none`
  —— 若长时间是 `none`，说明兜底没命中，需要换数据源（见 `docs\接手-2026-09-13.md`）

### 诊断信息与异常提示（0.3.1）

- `fairy-voice` 的诊断通道新增 `structure` 字段：只输出**字段名 + 类型**（最多两层），
  仍然**不含任何字段取值 / 对话内容**；同时上报会话槽位 props、`ctx` 服务名与 `useChat` 的结构
- 设置 → Fairy 面板**最底部**统一为「**诊断信息（排查用）**」一栏（文本框**收窄到 380px**）：
  上面是结构摘要，点「复制诊断信息」后下面出现完整诊断文本
- **右下角异常提示**：检测到「读不到会话消息」（即本次修的这个故障再度发生）时，
  会出现右下角红色提示框（与「预设未启用」提示同位置），带「稍后再说（静默 6 小时）」
  「不再提示（30 天）」；正常时**不出现**
- 判定条件是 `timelineRead === true && hasChat !== true`，因此**不会**因为用户没装 SoVITS、
  或主动关掉 HDD 视觉模式而弹窗

### 朗读自检 + 地址/参考音频可配置（0.2.3）

- 宿主新增 `GET /fairy-voice/selfcheck`、`GET|POST /fairy-voice/config`
- TTS 传输层改为**按当前配置构造**：改地址/参考音频后立即生效，不必重启 DSH
- 自检的「实际合成测试」会真的合成一句话并统计返回字节数，这是后端能否出声最硬的证据
- `fairy-voice` 客户端加了一条**诊断通道**（`globalThis.__FAIRY_VOICE_DIAG__`），
  只上报结构信息（字段名与数量），**不含任何对话内容**

### 设置栏合并（0.2.0）

- `fairy-voice` 不再注册自己的 `settings.section`，统一并进 `fairy-visual` 的 Fairy 面板

> **没有**改动任何朗读业务逻辑：引擎仍是上游的 `fairy`（GPT-SoVITS）。
> 历史：0.1.x 曾尝试切到浏览器内置语音以摆脱 GPT-SoVITS 依赖，因官方会话投影结构漂移等问题**放弃**，
> 相关补丁归档在 `legacy\`。

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
| [`AGENTS.md`](AGENTS.md) | **给 AI Agent 看的**：标准安装指令、可装/不可装清单、坑 |
| `docs\交接摘要.md` | 给接手者：当前状态、待办、踩过的坑（含 `.cmd` 编码陷阱） |
| `docs\安装机制实测.md` | `dsh plugin add` 各种形态的实测记录 |
| `docs\仓库与上游.md` | 怎么合并上游更新 |
| `docs\旧版说明-v0.2.3.md` | **v0.2.3 及之前的旧文档存档**（已不适用，仅备查） |
| `legacy\README.md` | 已废弃的旧脚本说明 |
