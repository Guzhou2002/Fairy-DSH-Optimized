# Fairy-DSH 整理版

**给 DSH 加一只住在界面里的 Fairy** —— 宠物浮层、HDD 视觉主题、朗读、余额、截图 Dock。

> ⚠️ **这是非官方整理分支。**
> 基于 [橙汁本色](https://github.com/Chengzhibense/Fairy-DSH) 的 **Fairy-DSH** 源代码整理而成，
> 上游原创代码按 **Apache-2.0** 发布。本分支只做**安装分发**和少量本地增强。
>
> **有问题请提到[本仓库 Issues](https://github.com/Guzhou2002/Fairy-DSH-Optimized/issues)
> 或交流群 `1124349108`，请不要打扰上游作者。**

---

## 装起来

### 🟢 完全不懂技术 → 看这条

1. 打开本页右边的 **Releases**，下载 `install.cmd`
2. **双击它**
3. 按屏幕上的中文提示走

缺什么它会自己装、自己说人话。**装一次就行，以后不用再管。**

### 🟡 会敲命令 → 一条就够

```powershell
dsh plugin --profile web add `
  https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/dsh-fairy-visual.tgz `
  https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/dsh-fairy-voice.tgz `
  https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/dsh-balance-meter.tgz `
  https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/dsh-browser-dock.tgz `
  https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/dsh-fairy-startup.tgz
```

> 用的是别的 profile？把 `web` 换成你的 profile 名。

### 🔵 只想要其中一个

把上面那串地址里，你要的那个留下，其他删掉。

---

## 装完做什么

| 步骤 | 做什么 |
| --- | --- |
| 1 | **重启 DSH** |
| 2 | 设置 → **Fairy** → 打开「**启用**」 |
| 3 | （可选）在 Fairy 设置里点「**开始自检**」，看朗读能不能出声 |

> 💡 **第 2 步不做的话，视觉和朗读都不会出现** —— 插件装好之后默认是关着的。

---

## 五个插件分别是什么

| 插件 | 干什么 |
| --- | --- |
| `dsh-fairy-visual` | **核心**。宠物浮层、HDD 主题、界面重绘、设置里的 Fairy 面板 |
| `dsh-fairy-voice` | 朗读回复（可接本机 GPT-SoVITS，也可用浏览器自带语音） |
| `dsh-balance-meter` | 侧栏显示 DeepSeek 余额 |
| `dsh-browser-dock` | 截图 Dock |
| `dsh-fairy-startup` | 启动画面 |

---

## 为什么装起来这么简单

`dsh plugin add` 是 **DSH 官方命令**，它自己会完成三件事：

1. 下载插件
2. **装好依赖**
3. **注册到你的 profile**

所以**不需要任何安装器**。本分支做的事情，就是让每个插件包「**自带全部东西**」，
从而能被这条官方命令直接吃下去。

> 技术细节（实测过程与证据）见 [`docs/安装机制实测.md`](docs/安装机制实测.md)。

---

## 需要什么

| 项 | 说明 |
| --- | --- |
| **DSH** | 已装好、能正常启动 |
| **pnpm** | ⚠️ 装 DSH 时**不会**自带它。用 `install.cmd` 会自动帮你装；手动装是 `npm install -g pnpm` |
| **网络** | 要能连上 npm 仓库。**国内建议挂代理**，否则可能卡在下载依赖那一步 |
| **GPT-SoVITS** | **只有**用朗读功能才需要。不装也能用其他部分 |

---

## 出问题了？

| 现象 | 怎么办 |
| --- | --- |
| 双击 `.cmd` 一闪就没了 | 右键 → 以管理员身份运行；或看它打出来的提示 |
| 卡在安装很久不动 | 网络问题。挂上代理再试一次 |
| 装好了但界面上什么都没有 | 设置 → Fairy → 把「**启用**」打开（这一步不能省） |
| 朗读不出声 | 设置里点「**开始自检**」，它会逐项告诉你卡在哪一层 |
| 想卸载 | `dsh plugin --profile web remove dsh-fairy-visual dsh-fairy-voice dsh-balance-meter` |

---

## 许可与归属

上游原创代码为 **Apache-2.0**，作者 **橙汁本色**。
本仓库是**非官方整理分支**，完整保留 `LICENSE` / `NOTICE` / `THIRD_PARTY_NOTICES.md` / `TRADEMARKS.md`；
所有对上游文件的改动均以 `[local patch 0.2.x]` 注释标注（Apache-2.0 §4(b) 要求的 modified files 提示）。

---


# 📜 附录：旧版说明（v0.2.3 及之前 —— zip + `install.ps1` 方式）

> **这一节保留备查，新装用户不用看。**
> 里面的两个 zip、`install.ps1` 数字键菜单、`link:` 安装方式，
> 在下一个版本里会被上面那套「`dsh plugin add` + tgz」取代。
> 等你看到这段时，旧的 `install.ps1` / `uninstall.ps1` 可能已经被删掉了。

---

# Fairy-DSH 可安装整合包

把 [Chengzhibense/Fairy-DSH](https://github.com/Chengzhibense/Fairy-DSH) 这套 DSH 插件整理成**开箱即装**的形式：
依赖版本已核对、安装脚本带备份与自动回滚、附带隔离环境自检工具。

整理版 `v0.2.3` ｜ 上游 `main @ d639887` ｜ 已在 **DSH 0.1.2-rc.1** 实测通过 ｜ 上游原创代码 Apache-2.0

| | |
| --- | --- |
| 本分支仓库 | https://github.com/Guzhou2002/Fairy-DSH-Optimized |
| 发布下载（Releases） | https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases |
| 上游仓库 | https://github.com/Chengzhibense/Fairy-DSH （作者：橙汁本色） |
| 维护 fork 看这份 | `docs\仓库与上游.md`（含合并上游时的三个坑） |
| 交流群 | 1124349108 |

> **只想赶紧用上？**
> 不用看这份文档，直接打开包里的 **`安装说明.txt`**（傻瓜版，一步步照做即可）。
> 本文档是给想了解细节、排障、二次分发的人看的。

## 两个发布包，给谁用哪个

| 压缩包 | 大小 | 适合谁 | 特点 |
| --- | --- | --- | --- |
| `Fairy-DSH-v0.2.3-一键部署版-含依赖.zip` | 1.7 MB | **发给群友 / 小白用户** | 自带依赖，解压即可装，**不需要 pnpm、不需要联网补依赖** |
| `Fairy-DSH-v0.2.3-一键安装版.zip` | 0.7 MB | 自己用 / 网络通畅 | 体积小一半，首次安装需 pnpm 并联网补依赖（`install.cmd` 会自动做） |

---

## 安装（三步）

### 第 1 步 · 双击 `install.cmd`

会弹出数字键菜单，**不用记任何参数**：

```
  请选择要安装的内容（按数字键）：
    1) 只装核心 UI            dsh-fairy-visual
    2) UI + 语音朗读          dsh-fairy-visual, dsh-fairy-voice
    3) UI + 语音 + 余额挂件    (+ dsh-balance-meter)
    4) 全部 5 个插件
    5) 自定义（输入编号，如 1,3 后回车）
    0) 退出
```

#### 或者：完全不用脚本，一条命令（0.2.1 起）

每个插件包都自带 `dsh.bundle` 声明，所以 `dsh plugin add` 一条命令就完成"安装 + 激活"，
**不需要**再手写 profile 的 `cordis.patch.yml`：

```powershell
# 假设包解压在 C:\Fairy-DSH（推荐路径；放别处就把路径换成你的）
dsh plugin --profile web add link:C:/Fairy-DSH/fairy-visual/dsh-fairy-visual
dsh plugin --profile web add link:C:/Fairy-DSH/fairy-voice/dsh-fairy-voice
```

> 路径用**正斜杠 `/`**。装完必须**重启 DSH**，再在浏览器按 **Ctrl+F5**，
> 最后到 **设置 → Fairy → 启用**。

（`install.cmd` 额外做的只有三件事：把朗读服务面板并进 Fairy 设置栏、清理 0.1.x 遗留的受管块、校验合成结果。）

> **两个发布版的区别**
>
> | 包 | 一条命令能用吗 | 说明 |
> | --- | --- | --- |
> | `Fairy-DSH-v0.2.1.zip` | ❌ 要先补依赖 | 不含 `node_modules`。先在各插件目录跑一次 `pnpm install --prod --ignore-scripts`（`install.cmd` 会自动做），或用下面的自包含版 |
> | `Fairy-DSH-v0.2.1-with-deps.zip` | ✅ 直接可用 | 自带依赖（已改成 **hoisted 扁平布局、零符号链接**），解压后一条命令即可 |
#### 菜单里每一项到底装什么

| 选项 | 实际安装 | 说明 |
| --- | --- | --- |
| **1** | `dsh-fairy-visual` | 只有核心 UI，最稳 |
| **2** | `dsh-fairy-visual` + `dsh-fairy-voice` | 在 1 的基础上加朗读 |
| **3** | 上面两个 + `dsh-balance-meter` | 再加侧栏余额挂件 |
| **4** | **全部 5 个**，见下表 | 包含两个"谨慎/不建议"的插件，**除非你清楚后果，否则别选它** |
| **5** | 你指定的任意组合 | 输入编号：`1=visual 2=voice 3=balance 4=startup 5=dock` |

#### 所谓"全部 5 个插件"是哪五个

| 编号 | 包名 | 作用 | 建议 |
| --- | --- | --- | --- |
| 1 | `dsh-fairy-visual` | HDD 明/暗主题、mascot 浮层、composer 坞（132–420px 可调）、自定义滚动条、背景辉光、侧栏几何、约 49 类语义标记 | ✅ **推荐**，已实测 |
| 2 | `dsh-fairy-voice` | 朗读回复 + 语音简报。**需要本机运行 GPT-SoVITS（127.0.0.1:9880）**，否则朗读按钮为灰色 | ⚠️ 需自备 TTS |
| 3 | `dsh-balance-meter` | 侧栏余额/费用挂件，读 `.credentials.yaml` 调 `api.deepseek.com/user/balance` | ✅ 可用 |
| 4 | `dsh-fairy-startup` | 启动时 `sessions.clear()` 并自动开新会话 | ⚠️ **谨慎**：会丢掉你恢复的会话选择 |
| 5 | `dsh-browser-dock` | Playwright 截图 Dock + MCP 代理 | ❌ **不建议**：`/browser-dock/state` 会把控制 token 交给任何能访问 Web 端口的客户端，页面截图会落盘，takeover 还硬编码 macOS 路径 |

> 选 **4（全部）** 就等于把 `startup` 与 `dock` 也一起装上。这两个我都不推荐默认启用。

#### 如果选了含语音的选项，安装脚本会先给出明确提示

```
  ================================================================
   注意：dsh-fairy-voice 的朗读需要本机运行 GPT-SoVITS
     * 服务地址固定 http://127.0.0.1:9880（上游硬编码，不可配置）
     * 还需要参考音频 ~/.dsh/fairy-voice/runtime/reference/
       fairy_ref.wav 与 fairy_ref.txt
     * 没跑 GPT-SoVITS 时「朗读回复」按钮是灰色的，不会出声
     * 装完后：设置 -> Fairy -> 朗读服务，可点「重新检测」
  ================================================================
```

#### 安装脚本会自动做这些

- 缺依赖时自动 `pnpm install` 补齐（需要联网）
- 先把 `package.json` 与 `cordis.patch.yml` 备份到 `profiles\web\fairy-backup-<时间戳>\`
- 写入 `link:` 依赖，并把受管插件块写进 `cordis.patch.yml`
- 用 `dsh --profile web --dump-config` 校验合成结果，**失败会自动还原** patch 文件

### 第 2 步 · 重启 DSH

插件在启动时装载，重启后生效。

### 第 3 步 · 在界面里启用

**设置 → HDD 视觉与 Fairy 身份 → 启用**

> 插件默认 `enabled: false`，是显式开关 —— 装完不会自己改变你的界面，这点是故意的。

### 卸载

双击 `uninstall.cmd`：

```
    1) 只卸载            移除受管块 + 解除依赖，保留备份目录
    2) 卸载并还原备份    额外从最近一次安装备份还原两个文件
    0) 退出
```

插件源码始终留在本目录，随时可以再装回来。

### 自检（不动你的 profile）

双击 `verify.cmd`：

```
    1) 只验证核心 UI          dsh-fairy-visual
    2) 验证 UI + 语音朗读      dsh-fairy-visual, dsh-fairy-voice
    3) 全部 5 个插件
    0) 退出
```

它在临时目录里新建一套完全独立的 DSH 环境 → 启动 → 无头浏览器探针 → 自动清理。
DSH 升级后建议先跑一次。

---

## 语音朗读：需要本机 GPT-SoVITS

`dsh-fairy-voice` 的朗读**只走上游设计的本地 GPT-SoVITS 路线**（引擎固定为 `fairy`）：

| 项 | 要求 |
| --- | --- |
| TTS 服务 | 默认本机 `http://127.0.0.1:9880`（GPT-SoVITS `api_v2.py` 默认端口）；**0.2.3 起可在设置栏改**，支持别的端口或另一台机器 |
| 参考音频 | `~/.dsh/fairy-voice/runtime/reference/fairy_ref.wav`（**0.2.3 起路径可改**）；建议 3–10 秒干净人声 |
| 参考文本 | 同目录 `fairy_ref.txt`（缺失时用内置回落文案，不影响出声） |

没跑 GPT-SoVITS 时：**朗读按钮是灰色的**、不会出声 —— 这是上游设计，不是故障。

### 先点一次「开始自检」（0.2.3 起，强烈建议）

群友最常见的困惑是"朗读不好使"，但看不出卡在哪一层。设置 → **Fairy** → **朗读功能自检** →
点「开始自检（含试合成）」，会逐项给出结论与修法（7 项）：

| 检查项 | 说明 |
| --- | --- |
| 插件宿主 | 插件有没有在 DSH 里加载 |
| 本地朗读服务 | SoVITS 是否可达；连不上会区分"端口没人监听 / 超时不响应 / 端口上是别的程序" |
| 参考音频 | `.wav`/`.txt` 是否就位；文件太短/太长也会提醒 |
| 实际合成测试 | **真的让 SoVITS 合成一句话**——后端到底能不能出声最硬的证据 |
| 浏览器音频播放能力 | 浏览器能否播 Web Audio |
| 朗读控件是否挂上 | 客户端脚本有没有跑起来 |
| 消息识别 | 插件能不能读到"要朗读的那条回复" |

面板底部的「复制诊断信息」会把全部结果写进剪贴板（含技术细节、**不含任何聊天内容**），
群友可直接粘贴到群里，不用截图、不用看日志。

> 自检面板里会写明：**朗读按钮与自动朗读开关只在真实会话页面出现**，
> 首页和刚新建的空白会话页不显示 —— 这是 DSH 自身的设计（`conversation.input.left` 槽位需要真实 sessionId 才渲染）。

### 设置里只有一个 Fairy 入口

原来有「HDD 视觉与 Fairy 身份」和「语音简报」两个设置入口，0.2.0 起**合并为一个**：
设置 → **Fairy**。里面除了视觉设置，还多了：

- **朗读功能自检**：一键 7 项检查 + 逐项「怎么修」+ 复制诊断信息（0.2.3 起）
- **朗读服务设置**：`SoVITS 地址`、`参考音频路径` 两栏可直接改并保存，**改完即时生效、无需重启 DSH**（0.2.3 起）
- **语音简报（可选）**：原「语音简报」的 API Key 表单搬到这里，功能不变

> 说明：`fairy-voice` **没有语音输入功能**。输入框左侧那个控件是「自动朗读开关 / 音量」，
> 不是麦克风；而且它只在 HDD 模式开启时出现。

> 说明：`fairy-voice` **没有语音输入功能**。输入框左侧那个控件是「自动朗读开关 / 音量」，
> 不是麦克风；而且它只在 HDD 模式开启时出现。

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

客户端侧使用的 `settingsScope` 在 `0.1.2-rc.1` 中依然存在，故 UI 半边正常。

**升级提醒**：上游设计依赖官方 DOM 选择器、ARIA 锚点与 slot 私有契约。
DSH 升级后若界面元素变化，插件会**静默降级**（有 capability 上报机制，不会崩）。
升级后建议先跑一次 `verify.cmd`。

---

## 环境要求

| 项 | 要求 |
| --- | --- |
| 系统 | Windows（脚本为 PowerShell；插件本身跨平台） |
| DSH | `0.1.2-rc.1` 实测通过；上游在 `0.1.1-rc.2` 验收 |
| Node.js | ≥ 20（自检脚本需要 `node`） |
| pnpm | 安装时需要，用于自动补齐插件依赖 |
| 浏览器 | 自检时需要 Chrome 或 Edge（脚本会自动探测） |

首次安装需要联网（从 npm 拉取插件依赖），装好后离线可用。

---

## 命令行参数（给自动化用，平时可全部忽略）

```powershell
.\install.ps1 -Plugins visual,voice,balance,startup,dock,all   # 默认 visual
.\install.ps1 -Profile web -DshHome <路径>                     # 默认 $env:DSH_HOME 或 ~\.dsh
.\install.ps1 -VoiceEngine system|fairy                       # 默认 system
.\install.ps1 -Yes            # 跳过所有确认
.\install.ps1 -WhatIfRun      # 干跑，一个字都不写
.\install.ps1 -SkipDeps       # 缺依赖时直接报错，不联网装
```

`uninstall.ps1`：`-Profile -DshHome -RestoreBackup -Yes`
`verify-isolated.ps1`：`-Plugins -Port -Keep -ChromePath -Yes`
`switch-voice-engine.ps1`：`-Engine -List -Yes -Quiet`

> **非交互环境**（管道、重定向、CI）会自动退回默认值，不会卡在等待按键。

---

## 目录结构

```
Fairy-DSH\
├─ README.md                  本文档（技术向）
├─ 安装说明.txt               ★ 傻瓜版安装步骤（给普通用户的，先看它）
├─ RELEASE-NOTES.md           本整理版的变更记录
├─ LICENSE / NOTICE / TRADEMARKS.md
├─ THIRD_PARTY_NOTICES.md     第三方依赖与许可
├─ UPSTREAM-README.md         上游原 README（保留归属）
├─ docs\验证报告.md           实测证据与风险细节
├─ install.cmd  / install.ps1
├─ uninstall.cmd / uninstall.ps1
├─ verify.cmd   / verify-isolated.ps1
├─ lib\settings-merge.ps1     设置栏合并的共享实现
├─ vendor\（每个插件包内）    内联的 contracts，使包可独立分发
├─ build-release.ps1          重打发布包
├─ patches\abandoned\         已放弃的 system-TTS 实验补丁（含原因）
├─ upstream-originals\        上游原件（永不修改，含 SHA256 清单）
├─ patches\                   本地改动的可追溯 diff
├─ snapshots\                 切换前的自动快照（随用随生，不进发布包）
├─ tools\dom-probe.mjs        无头浏览器 DOM 探针
├─ .agent-presets\fairy\      Fairy 人设 agent preset（可选）
├─ fairy-contracts\           跨插件契约（无依赖）
├─ fairy-visual\dsh-fairy-visual\
├─ balance-meter\dsh-balance-meter\
├─ fairy-startup\dsh-fairy-startup\
├─ fairy-voice\dsh-fairy-voice\
└─ browser-dock\dsh-browser-dock\
```

`.agent-presets\fairy\` 是可选的人设数据；想用就整个复制到 `$env:DSH_HOME\.agent-presets\fairy\`。

---

## 实测结论（本机 DSH 0.1.2-rc.1）

隔离 profile、无头浏览器探针：

```
宿主侧  DSH_FAIRY_LOG {"module":"dsh-fairy-visual","surface":"host","outcome":"success"}
客户端  surface:"client", outcome:"success",  exceptions: []
```

| 检查项 | 结果 |
| --- | --- |
| mascot 浮层 | ✅ 存在，290×290，z-index 99999 |
| 注入样式表 | ✅ `dsh-fairy-visual-style` + `dsh-fairy-mascot-style` |
| HDD 主题 | ✅ `data-dsh-fairy-mode=hdd`、`theme=dark` |
| composer 坞 | ✅ 驱动官方 seat：`height: 132px` + `--dsh-fairy-composer-height` |
| 滚动条 / 辉光 | ✅ 1 个 HDD 滚动层、3 个辉光节点 |
| 语义标记 | ✅ 49 类属性、52 个节点 |
| voice 客户端 | ✅ 样式表已注入，`apply` success |
| JS 异常 | ✅ 0 |
| 唯一降级 | `balanceAction`（ENHANCEMENT 级）—— 因为测试环境没装 `balance-meter`，装上即消失 |

**未覆盖**：hero 文案投影与 composer 拖拽交互（需要真实会话视图，无头环境会弹出系统目录选择框）；
音频输出无法在无头 Chrome 验证（它没有语音包）。

细节见 [`docs/验证报告.md`](docs/验证报告.md)。

---

## 已知限制与注意

1. **和现有 UI 插件抢 DOM**：若你已装了其他改界面的插件（如 `beauticode`、`whale-widget`、
   `live2d-companion`、`liang-slider`、`ui-task-board`），建议先禁用一部分再启用 Fairy。
2. **`fairy-startup`** 每次加载都会清空会话选择，谨慎启用。
3. **`fairy-voice`** 需要本机 GPT-SoVITS；它的长回答（≥260 字）会发往 `api.deepseek.com` 做语音简报，
   密钥明文存于 `~/.dsh/fairy-voice/voice-brain.json`。
4. **`browser-dock`** 会暴露控制 token、缓存页面截图，不建议安装。
5. 上游仓库自带的测试 profile 使用 `danger-full-access` + `approval: never`，
   **本整合包未采用**，安装脚本只写入受管的 insert 条目。
6. 上游仓库不含完整世界观语料、TTS 模型与用户数据；《绝区零》相关素材不随包分发，
   本项目不授予相关版权、商标或官方关联权利。

---

## 本地改动（相对上游）

改动记录在 `patches\0001-fairy-settings-merge.patch`：

### 朗读自检 + 地址/参考音频可配置（0.2.3）

- 宿主新增 `GET /fairy-voice/selfcheck`、`GET|POST /fairy-voice/config`
  （新文件 `fairy-voice/dsh-fairy-voice/lib/server/voice-selfcheck.js`）
- TTS 传输层改为**按当前配置构造**：改地址/参考音频后立即生效，不必重启 DSH
- 自检的"实际合成测试"会真的合成一句话并统计返回字节数，这是后端能否出声最硬的证据
- `fairy-voice` 客户端加了一条**诊断通道**（`globalThis.__FAIRY_VOICE_DIAG__`），
  只上报结构信息（字段名与数量），**不含任何对话内容**；供设置栏判断"控件是否挂上 / 消息能否读到"
- 设置栏 `FairyVoicePanel` 重做：状态横幅 + 7 项检查 + 逐项「怎么修」+ 复制诊断信息 + 两个可配置输入框

### 设置栏合并 + 朗读服务检测（0.2.0）

- `fairy-voice` 不再注册自己的 `settings.section`（原「语音简报」入口）
- `fairy-visual` 的 Fairy 设置栏内追加 `FairyVoicePanel`（0.2.3 起为上面那个自检面板）
  + 语音简报 API Key 表单

打包层面的改动（让包能独立分发）：

- dsh-fairy-contracts 原本是 link:../../fairy-contracts，出了这个仓库就解析不到。
  现已把它的源码**内联进每个插件包的 endor/**，宿主改为相对引用 ../vendor/...，
  并从依赖里移除 —— 于是每个包都可以单独用 git / tarball / npm 安装。
- 依赖改为 **hoisted 扁平布局**（各包 pnpm-workspace.yaml: nodeLinker: hoisted），
  
ode_modules 内零符号链接，解压即用。

依据：官方设置栏是「左侧列表 + 右侧内容、一次显示一个」
（`renderSlot("settings.section", {...}, { only: active })`），两个注册就是两个入口。

**没有**改动任何朗读业务逻辑：引擎仍是上游的 `fairy`（GPT-SoVITS）。

> 历史：0.1.x 曾尝试把引擎切成浏览器内置语音（`system`）以摆脱 GPT-SoVITS 依赖，
> 因官方会话投影结构漂移 + Web Audio 预解锁等一连串问题而**放弃**，
> 相关补丁归档在 `patches\abandoned\`（含失败原因说明）。

---
## 常见问题

**装了没反应？**
确认三步：① 重启过 DSH；② 设置里把「HDD 视觉与 Fairy 身份」打开；
③ `dsh --profile web --dump-config` 能看到 `fairy-visual` 条目。

**语音没出现朗读控件？**
① 确认装了 `dsh-fairy-voice`；② **刷新浏览器页面（F5）**，客户端插件是页面加载时注册的；
③ 输入框左侧那个控制器还需要 HDD 模式开着。

**朗读按钮是灰的？**
说明本机 `127.0.0.1:9880` 上没有 GPT-SoVITS。到 **设置 → Fairy → 朗读服务** 点「重新检测朗读服务」，
红色警示条会写明具体原因；启动 GPT-SoVITS 后即可朗读。

**报 `settingsNamespace` 不存在 / 插件加载失败？**
说明 `@deepseek-ai/dsh-settings` 被解析到了宿主的 `0.1.2-rc.1`。保留插件目录下自己的
`node_modules`，不要提升或覆盖该依赖。

**能装到别的 profile 吗？**
可以：`.\install.ps1 -Profile <名字>`；家目录非默认时加 `-DshHome <路径>`。

**端口 / 临时文件？**
`verify-isolated.ps1` 默认用 3180，可用 `-Port` 改；默认结束即清理，`-Keep` 可保留排查。

---

## 部署机制：dsh.bundle（0.2.1 起）

插件包在 `package.json` 里声明了：

```json
"dsh": { "bundle": { "patch": "./cordis.patch.yml" }, "client": { "platform": "web" } }
```

并各自带一个 `cordis.patch.yml`（只有一条 insert 行）。DSH CLI 在 `plugin add` 之后会把
**声明了 `dsh.bundle` 的依赖自动追加进 `dsh.profile.bundles`**，于是插件自动成为 profile 的一层。

> **0.1.x 的老写法已废弃**：那时靠 `install.ps1` 往 profile 的 `cordis.patch.yml` 里写一个
> 「Fairy-DSH managed block」。现在脚本会在 `[5/6]` 步骤把那个遗留块**清理掉**，
> 否则同一个插件会被注册两次。

---
## 许可与归属

- **上游原创代码**：Apache License 2.0，见 `LICENSE` / `NOTICE` / `UPSTREAM-README.md`
- **第三方依赖**：各自许可，见 `THIRD_PARTY_NOTICES.md`
- **本整合包**：仅做整理与打包（安装/卸载/自检/切换脚本、文档），不改变上游代码逻辑
  （唯一例外见「本地改动」，且可一键回滚）
- **本分支作者**：孤舟蓑笠 ｜ 交流群 1124349108

> ### ⚠ 这是**非官方**分支，出问题请不要找上游作者
>
> 上游作者（橙汁本色）**没有参与本分支的任何改动**。安装器、设置栏合并、朗读自检、
> 人设一键默认这些都是本分支加的，找他解决不了，还会平白打扰人家。
>
> - 本分支的问题 → 提到 [本仓库 Issues](https://github.com/Guzhou2002/Fairy-DSH-Optimized/issues) 或进群说
> - 本分支与上游的关系、如何合并上游更新 → 见 `docs\仓库与上游.md`
