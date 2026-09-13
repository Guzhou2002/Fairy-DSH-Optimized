# 发布说明 · Fairy-DSH 整理版

- **上游**：[Chengzhibense/Fairy-DSH](https://github.com/Chengzhibense/Fairy-DSH) `main @ d639887`
- **许可**：上游原创代码 Apache-2.0（见 `LICENSE` / `NOTICE`），本仓库仅做整理、分发与少量本地增强
- **当前版本**：见仓库根 `VERSION` 文件

---

## v0.3.3 变更

> **这一版是紧急修包**：v0.3.2 的 `dsh-fairy-voice` 装上后**一重启 DSH 就起不来**。

### 🔴 修复：v0.3.2 装上后 DSH 无法启动

**症状**：升级到 v0.3.2 后重启 DSH，启动直接失败并打出：

```
Error: dsh: plugin tree failed to load: failed to apply loader entry fairy-voice (dsh-fairy-voice): ensureFairyDirectories is not defined
ReferenceError: ensureFairyDirectories is not defined
    at .../fairy-voice/dsh-fairy-voice/lib/index.js:655:3
```

**原因**：`dsh-fairy-voice` 的 `lib/index.js` 在启动时调用了 `ensureFairyDirectories()`，
但这个函数定义在 `lib/server/voice-selfcheck.js` 里，而 `index.js` 的 import 清单**漏了它**。
`node --check` 查不出这类错（语法没错，是运行时 ReferenceError，只有真正启动才会暴露），
所以 v0.3.2 一路发布了出去 —— 它**从来没有被真正重启验证过**。

**修复**：在 `index.js` 的 import 清单里补上 `ensureFairyDirectories`。

**影响范围**：**只有 v0.3.2**。该函数是 0.3.2 新增的，v0.3.1 及更早版本没有这行调用，不受影响。

**如果你已经装了 v0.3.2**：直接装本版覆盖即可，不需要先卸载。

### 📦 包版本

- `dsh-fairy-voice` 1.0.2 → **1.0.3**（修复本体）
- `dsh-fairy-visual` 0.1.3 → **0.1.4**（设置面板顶部的版本号横幅跟随更新）
- 其余 3 个包**字节未变**

### ✅ 验证

真实环境重启 DSH 通过：插件正常加载，MOSS-TTS-Nano 端到端合成通过
（48000 Hz 立体声 → 自动转 32000 Hz 单声道）。

---

## v0.3.2 变更

> **这一版给朗读加了第二条路：没显卡也能用。** 另有一组设置面板的可读性重做。

### ✨ 新增：第二个朗读引擎 MOSS-TTS-Nano（CPU 就能跑）

上游的朗读只硬编码一条 GPT-SoVITS 路线 —— 要显卡、要 6–9 GB、要 Python 3.10/3.11。
本版加上 **MOSS-TTS-Nano**（**代码与权重均为 Apache-2.0**）：0.1B 参数，**CPU 实时**。

| 引擎 | 需要什么 | 特点 |
| --- | --- | --- |
| **GPT-SoVITS**（默认，上游原路） | 显卡 + 本机服务（`127.0.0.1:9880`） | **流式**：边合成边播，几乎不用等 |
| **MOSS-TTS-Nano**（新增） | **不用显卡**，本机服务（`127.0.0.1:18083`） | **整句合成完才出声**；本机实测约 **0.45× 实时**（2–3 秒的话要等约 7 秒） |

在 **设置 → Fairy → 朗读设置 → 朗读引擎** 里切换，**改完即时生效、不用重启**；
两个引擎各记各的地址，来回切换不丢；**参考音频两份共用**，不用配两遍。

> 📌 **授权留档**：改动 `fairy-voice` 的朗读逻辑原本属于红线，
> 本次已获上游作者**橙汁本色**明确同意（2026-09-13）。

**改动范围**：新增 `lib/server/moss-tts-transport.js`（与 `local-tts-proxy.js` **同形**，
只暴露 `status()` / `stream()`，负责把 MOSS 回的 48 kHz 立体声转成客户端要的 32 kHz 单声道 Int16）。
**GPT-SoVITS 那条路一个字节没动**，只是前面多了一个 `if (engine === 'moss-nano')` 分支。

### ✨ 新增：MOSS 一键安装（含自带服务端）

| 产物 | 作用 |
| --- | --- |
| `tools/install-moss.ps1` | **一键装完**，把 6 个必踩的坑全写死（Python 3.12 / 缓存不落 C 盘 / `huggingface_hub<1` / 要装 `transformers` / 不装 pynini / 下载源自动回退）。幂等，可重复运行 |
| `tools/moss-tts-server/server.py` | MOSS 的服务端。**绕开官方服务的 pynini 依赖**（`pynini` 在 PyPI 上**没有任何 Windows 轮子**），接口与官方 `/api/generate` + `/health` 完全对齐 |
| `tools/moss-tts-server/verify.py` | 验证器：服务通不通 / **能不能真合成** / 音频格式对不对。装完自动跑，平时也可单独跑 |
| `docs/install-moss.md` | **给 AI Agent 的任务书**（含失败判定表） |

**设置面板里还有「复制安装说明」按钮** —— 点一下就复制好一段话，直接粘给你的 AI Agent，它会照着一份写好的说明装。

### 🔧 改进：设置面板的可读性

| 改动 | 说明 |
| --- | --- |
| **小节重排** | `人设预设 → 朗读设置 → 朗读自检 → 语音简报 → 诊断信息`（**先配置、后验证**；原来是"看结果"挡在"改配置"前面） |
| **改名消歧义** | 「朗读服务设置」→ **朗读设置**；「朗读功能自检」→ **朗读自检** |
| **自检明细默认折叠** | 但**结论那一行（✅/❌）常显** —— 不展开也知道好没好；红字会自己提示"点展开明细看怎么修" |
| **引擎优缺点对照卡** | 替换原来只讲当前引擎的那句话 —— 两个都摆出来，让人按自己机器选 |
| **拆掉顶部大红框** | 「还有必做的事没完成」原来把①人设②语音合在一起、和下面各区块重复；现在**拆进各自的区块**作为子条目，并去掉了"不再提示" |
| **自检第 2 项展示 `/health` 详情** | 引擎 / 后端 / **模型是否已加载** / 线程数 |

### 🐞 修复

| 症状 | 根因 | 修法 |
| --- | --- | --- |
| 点「重新自检」后**引擎跳回 GPT-SoVITS** | 按钮里带着 `loadConfig()`，会重新拉磁盘配置**覆盖整个表单**，把没保存的选择抹掉 | 「重新自检」只跑自检，不再动表单 |
| 引擎切成 MOSS 后，**自检仍去测 SoVITS** | 自检请求不带参数，宿主永远读磁盘上已保存的配置 | 面板把**当前表单值**作为参数传过去，宿主做**临时覆盖**（**不写磁盘**） |

### 🔧 变更：参考音频的位置

- 新位置：**`~/.dsh/fairy-voice/reference/fairy_ref.wav`**
- 插件**启动时自动创建该目录**，并写一份 `README.txt` 说明放什么、怎么放
- 旧位置 `~/.dsh/fairy-voice/runtime/reference/` **保留兼容回退**，老用户升级不会丢文件
- ⚠️ **用户数据一定放 `~/.dsh/fairy-voice/`，不要放插件目录** ——
  `dsh plugin add` 会把包解进 **profile 下的 `node_modules`**，那里 pnpm 随时会重建，升一次版本就没了。
  详见 `AGENTS.md` §5.4.1 与 `docs\交接摘要.md` §9 坑 16

### ✅ 新增：回归测试

`fairy-voice/test/moss-tts.test.js` —— 10 个用例，覆盖 PCM 格式转换与
`applyConfigOverrides`（把上面两个修复钉死）。**这是本仓库第一个全绿的测试文件**
（`test/index.test.js` 等 4 个是从上游继承的陈旧用例，一直红着，与本版无关）。

### 📦 升级提示

- **`dsh-fairy-visual` `0.1.2` → `0.1.3`**（面板改动都在这个包里）
- **`dsh-fairy-voice` `1.0.1` → `1.0.2`**（引擎分支、自检、数据目录）
- 另外 3 个包**字节未变**
- 装法与以往相同；**改完记得重启 DSH**

---

## v0.3.1 变更

> **这一版修的是「语音读不到消息」这个致命问题**，另加一组诊断与提示改进。

### 🐞 修复：语音「消息识别」永远失败

| 症状 | 说明 |
| --- | --- |
| 设置 → Fairy 自检第 7 项永远 ❌ | 「消息识别」判定不通过 |
| 朗读没有内容可读 | 自动朗读拿不到要念的文本 |
| 每条回复下方没有朗读按钮 | 同上（按钮只在能读到消息时才出现） |

**根因**：DSH `0.1.2-rc.1` 把**聊天内容从 `useSession` 快照里拆了出去**。
会话槽位（`conversation.input.left`）另外提供了 `useChat` / `useConversation` /
`useProjection` 等 hook，其中 **`useChat` 返回的才是旧的 `chat` 结构**
（`order` / `nodes` / `timeline` / `legacy`）；插件仍按 `snapshot.chat` 读，永远读空。

**修复**：读消息的适配层改用 `useChat`，并**保留 `snapshot.chat` 回落** → **新旧 DSH 都能用**。
朗读、合成、播放逻辑一行未改（改动均标注 `[local patch 0.3.1]`）。

### 🐞 修复：`runningCalls` 在新结构中消失

新 `chat.legacy` 只有 `nodes / turnTimings / turnEnds / partial`，
原来的 `runningCalls`（判断"正在跑工具"）没了，波形与阶段判断会变钝。
现改为**双来源兜底**：先走 `legacy.runningCalls`，取不到就扫 `chat.nodes.byKey` 中
`status === 'running'` 且 kind 含 `tool` 的节点。诊断字段 `runningSource` 会显示走的是哪条。

### ✨ 设置页底部：统一的「诊断信息（排查用）」

- **结构摘要**：只输出**字段名 + 类型**（最多两层），**不含任何字段取值 / 对话内容**
- 文本框**收窄到 380px**；点「复制诊断信息」产生的文本也归到这一栏
- 文案改准：原来写的「这里只有字段名与类型」并不成立（诊断信息里含本机路径与自检结果）

### ✨ 右下角语音异常提示

检测到「读不到会话消息」（即上面那个故障复发）时，右下角出现红色提示框，
带「稍后再说（静默 6 小时）」「不再提示（30 天）」；**正常时不出现**——
没装 GPT-SoVITS、或主动关掉 HDD 视觉模式都**不会**弹。

### 本版包版本

- `dsh-fairy-visual` 0.1.1 → **0.1.2**
- `dsh-fairy-voice` 1.0.0 → **1.0.1**

> 已装过的群友：重下 `install.cmd` 双击即可（永久地址永远拿最新版）。

---

## v0.3.0 变更（相对 v0.2.3 包）

> **这一版的改动几乎全在「怎么装」，插件功能本身没有变化。**

### 🔴 分发方式：zip + 安装器 → 官方命令 + tgz

| | v0.2.3 | v0.3.0 |
| --- | --- | --- |
| 分发物 | 2 个 zip（含依赖版 1.8 MB） | 5 个 `.tgz` + `install.cmd`，**合计约 476 KB** |
| 群友步骤 | 解压 → 双击 → 走 7 步数字键菜单 | **下载 `install.cmd` → 双击** |
| pnpm | 需要，缺了直接报错中止 | 需要，**新脚本会问一声并自动帮你装** |
| 依赖 | 含依赖版不用联网，轻量版要 | 由 pnpm 在安装时自动补齐 |
| 更新 | 重下 zip 重装 | **重下 `install.cmd` 双击**（永久地址，永远拿最新版） |
| 卸载 | `uninstall.ps1` | `dsh plugin --profile web remove <包名>` |

**为什么能这么简化**（实测结论，见 [`docs/安装机制实测.md`](docs/安装机制实测.md)）：

`dsh plugin add` 是 DSH 官方命令，它**本身就是 `pnpm add`** ——
会自己完成「**下载 + 装依赖 + 注册 bundle**」三件事，所以**不需要安装器**。

唯一障碍是上游把 `dsh-fairy-contracts` 写成了 `link:../../fairy-contracts`
（开发期的相对路径，从 profile 目录解析必然失败），已用 `vendor/` 内联解决。

### ✨ `install.cmd` 会自己说人话

老安装器遇到问题抛的是英文堆栈（比如 `'pnpm' is not recognized...`），
完全不懂技术的使用者看不懂。新脚本：

- **缺 pnpm** → 用中文解释那是什么、装它有什么影响，按 `Y` 就自动装
- **网络不通 / DSH 有问题** → 分别给人话指引，不再抛英文报错
- **不管成功失败都会停住**（老版只在失败时 `pause`，装好了反而窗口一闪就关）

### ✨ 装完会打印各插件版本

```
    +  已安装    dsh-fairy-visual   0.1.1
    +  已安装    dsh-fairy-voice    1.0.0
```
一眼看得出这次装了什么、什么版本。

### 🔧 修复

- **补回「安装 Fairy 人设预设」步骤** ——
  重写脚本时曾漏掉，会导致群友装完插件后**人设预设不生效**。
  改从插件包内复制（`robocopy /E`，合并语义）；实测连跑两次都不产生
  `fairy\fairy\` 嵌套 —— 而老安装器的 PowerShell `Copy-Item` 正是嵌套的成因
  （目标目录已存在时会往里再套一层，用户机器上已积累出重复目录）
- `verify.cmd` 与 `install.cmd` 的同类问题：成功时窗口一闪就关 → 改为总是停住
- **`install.cmd` 调 `dsh` 必须加 `call`** ——
  `dsh` 是 npm 生成的 `dsh.cmd`，而批处理里**不加 `call`** 调用另一个 `.cmd`，
  控制权会直接转交、**当前脚本永不返回**。不修的话脚本在装完插件后就静默终止，
  **后面的人设预设那一步永远执行不到**。（端到端实测才暴露 —— 干跑测试把 `dsh`
  换成了 `echo`，正好绕开了这个坑）
- `install.cmd` 编码明确为 **UTF-8 无 BOM + 全 CRLF**（缺 BOM 会让 PowerShell 5.1 读错）

### 📦 插件包本身

- `dsh-fairy-visual`：`0.1.0` → **`0.1.1`**（设置页顶部声明行改版）
- 其余 4 个包内容与 v0.2.3 完全一致，**版本号不动** ——
  这样「有没有新版本」的判断才准确

### ⚠️ 从旧版升级的注意事项

- 旧的 `install.ps1` / `uninstall.ps1` / `build-release.ps1` / `安装说明.txt` / `patches/`
  **已全部归档到 `legacy/`**，说明见 [`legacy/README.md`](legacy/README.md)
- 老的 `release/*.zip` 保留作回归基准，不在仓库里（已 gitignore）
- 从旧流程（`link:` 安装）切到新流程会**替换** profile 里的依赖记录，属正常

---

## v0.2.3 变更（相对 v0.2.2 包）· 2026-09-12

> 环境：DSH `0.1.2-rc.1`、Node 24.20、pnpm 11.25、Windows

### 新增：Fairy 人设「一键设为默认预设」（设置栏里排在最前）

新手最常见的卡点不是"开关没打开"，而是**不知道还要去别处把预设选中**。现在设置栏里
人设预设排在最前面，两步走完即可：

1. 勾上「第 1 步」的开关 → 预设装进 `$DSH_HOME/.agent-presets/fairy`
2. 点「一键设为默认预设」→ 直接写 DSH 的 `agent-presets.default`，**以后每个新会话自动用 Fairy**

- 写之前会把**原来的默认预设存下来**（`$DSH_HOME/.fairy-persona/default-preset-backup.json`），
  点「取消默认」原样还原（实测：`standard` → `fairy` → `standard`）
- 同时保留手动路径说明：新会话空白页的「Agent 预设」选择器 / 设置 → Agent 预设
- 明确标注 ⚠：**只对新建的会话生效**，当前会话不会变

### 新增：首次打开设置 / 启动时就醒目提示（红色）

- 打开 设置 → Fairy 时，若有必做项没完成，面板**最顶部**显示醒目红框：
  逐条列出"还差什么 / 现在是什么状态 / 点哪个按钮"，相关项做完后红框自然消失
- **启动时**也醒目：未配置好时侧边栏「设置」图标上点一个红点，右下角弹红色提示框
  （「打开设置」直达 / 「不再提示」记住选择；配置好了就什么都不显示）
- 实现方式：宿主用 `webServer.tapIndex()` 往 index.html 注入一小段自包含脚本，
  接口拿不到就静默退出，**绝不影响 DSH 正常启动**

### 新增：朗读功能自检面板（面向完全不懂技术的使用者）

群友反馈"语音朗读不好使"，但旧版只能给一句"未检测到本地朗读服务"，看不出卡在哪一层。
现在设置栏里是一个**一键自检**：7 项检查逐条给「✅ / ⚠️ / ❌ + 大白话说明 + 怎么修」，
失败时第一句就点明是哪一环坏了。

- 宿主侧检查：插件宿主是否加载、本地 SoVITS 是否可达、参考音频是否就位、**真的合成一句话**（后端最硬的证据）
- 客户端侧检查：浏览器能否播音频、朗读控件是否挂上、**消息识别**（能不能读到要朗读的回复）
- 「复制诊断信息」一键把全部结果写进剪贴板，群友直接粘贴到群里即可，不用截图、不用看日志
- 诊断通道只上报结构信息（字段名与数量），**不含任何对话内容**

### 新增：SoVITS 地址与参考音频路径可配置

- 默认仍是 `http://127.0.0.1:9880`，但设置栏里可改——支持跑在别的端口或**另一台机器**上
- 参考音频路径同样可改，不再强制放在 `~/.dsh/fairy-voice/runtime/reference/`
- 保存后**立即生效，无需重启 DSH**；非法输入给人话拒绝（例如地址没带 `http://`、路径不是完整路径）
- 配置落在 `~/.dsh/fairy-voice/runtime/config.json`（只有地址与路径，不含任何密钥）

### 修正

- 自检在"还没打开过任何会话"时不再误报「版本不兼容」，改为提示先进入会话后再自检
- 面板明确写出：朗读按钮与自动朗读开关**只在真实会话页面出现**，首页/空白新会话页不显示（DSH 自身设计）

### 实测
- 面板渲染：无头 Chrome 实跑「设置 → Fairy → 开始自检」，小节顺序为 人设预设 → 朗读功能自检 → 朗读服务设置 → 语音简报；7 项检查、状态条、2 个可配置项、复制按钮全部落地
- 人设一键默认：off → on（宿主 isDefault:true, defaultPreset:fairy）→ 取消 → 还原为 standard，并核对 settings.yaml 落盘
- 首次提示：html 根属性为 todo、设置图标红点伪元素生效、右下角提示框文案与两个按钮完整

- 面板渲染：无头 Chrome 实跑「设置 → Fairy → 开始自检」，7 项检查、状态条、2 个可配置项、复制按钮全部落地
- 配置链路：默认值 → 保存 `http://127.0.0.1:9999` + 自定义参考音频 → 再读为新值 → 自检确实按新地址报错 → 非法地址/相对路径被拒
- 端到端：`dsh plugin add` 一条命令 → 宿主 2/2 `apply success` → 自检可跑

---

## v0.2.2 变更（相对 v0.2.1 包）

### 新增：Fairy 人设（作者语料）真正可用 + 设置里的开关

**修好了上游预设的加载失败。** 上游 `.agent-presets/fairy/agent.cordis.yml` 里有两处引用作者
私有运行时（`runtime/index.js`、`runtime/safety-gate.js`），这两个文件**未随上游仓库发布**，
会让整个预设组合加载失败 —— 这就是"人设看着有、却怎么都弄不出来"的原因。现已移除那两条
（人设文本与官方工具面完整保留），并静态校验 29 条引用全部可解析。

- 预设**随插件包分发**：`fairy-visual/dsh-fairy-visual/.agent-presets/fairy/`
  （放进包内，git / tarball / npm 安装的场景也找得到）
- 宿主新增两条路由：`GET /fairy-persona/status`、`POST /fairy-persona/toggle`
- **设置 → Fairy** 里新增「Fairy 人设预设」开关：打开 = 把预设装进 `$DSH_HOME/.agent-presets/fairy`，
  关闭 = 移除；界面明确提示 **只对新建的会话生效**，并指引到 设置 → Agent 预设 选择 Fairy
- 设置入口标签由「HDD 视觉与 Fairy 身份」统一为 **Fairy**
- 兜底提示修正：宿主路由 404 时明确提示「请重启 DSH」，不再误导为"安装不完整"

### 安装/卸载

- `install.ps1` 增至 7 步，新增 `[3/7] 安装 Fairy 人设预设`
- `uninstall.ps1` 增至 5 步，新增 `[3/5] 移除 Fairy 人设预设`

### 文档

- `安装说明.txt` 新增「第八步：Fairy 人设（可选）」，含三步开启流程与"只对新会话生效"提醒；
  原朗读章节顺移为第九步
- 打包脚本默认输出目录改为包内 `release\`

### 实测

- 路由：`available:true, installed:false` → toggle → 12 个预设文件落地 → toggle 关闭 → 移除干净
- 界面：无头浏览器点开 设置 → Fairy，确认开关与朗读面板渲染正常（截图见提交记录）
- 宿主与两个 client bundle 均 `node --check` 通过

---
## v0.2.1 变更（相对 v0.2.0 包）

### 一键部署：插件自带 `dsh.bundle` 声明

- 5 个插件包都新增自带的 `cordis.patch.yml`，并在 `package.json` 里声明
  `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`
- 效果：**一条命令**完成安装 + 激活，不用再手写 profile 的 `cordis.patch.yml`：

  ```powershell
  dsh plugin --profile web add link:<本目录>\fairy-visual\dsh-fairy-visual
  ```

  （DSH CLI 会把声明了 `dsh.bundle` 的依赖自动追加进 `dsh.profile.bundles`）

- `install.ps1` 相应简化：`[4/6]` 只跑 `dsh plugin add`；新增 `[5/6]` 清理 0.1.x 遗留的
  「Fairy-DSH managed block」（否则同一插件会被注册两次）
- 实测：`cordis.patch.yml` 为空 `[]` 的隔离 profile，一条命令后 bundles 自动包含两个插件，
  启动日志两个插件均 `apply outcome: success`

### 新增自包含版（一条命令即可）

`build-release.ps1 -IncludeDeps` 生成 `Fairy-DSH-v0.2.1-with-deps.zip`（1.75 MB），自带依赖。
为此把 5 个插件包的依赖改成 **hoisted 扁平布局**（各自加 `pnpm-workspace.yaml: nodeLinker: hoisted`），
并把唯一的 `link:` 符号链接解引用为真实副本 —— 于是 `node_modules` 内**零符号链接**，
zip 解压后仍可用，这才让"一条命令"真正成立。

> 实测（从 zip 解压的副本、`cordis.patch.yml` 留空 `[]`）：
> `dsh plugin --profile <p> add link:.../dsh-fairy-visual link:.../dsh-fairy-voice`
> → bundles 自动包含两个插件 → 启动日志两个插件均 `apply outcome: success`。

### 版本

- 包内版本号统一到 `0.2.1`
- 两个 zip 都保留：轻量版 `Fairy-DSH-v0.2.1.zip`（需先补依赖）、自包含版 `-with-deps`（直接可用）

---
## v0.2.0 变更（相对 v0.1.3 包）

### 设置栏合并：设置里只留一个 Fairy 入口

- `fairy-voice` 不再注册自己的 `settings.section`（原「语音简报」入口）
- 语音面板并入 `fairy-visual` 的 Fairy 设置栏 —— 现在只有 **设置 → Fairy** 一个入口
- 依据：官方设置栏是「左侧列表 + 右侧内容、一次显示一个」
  （`renderSlot("settings.section", {...}, { only: active })`），两个注册就是两个入口

### 朗读服务检测 + 醒目提示

Fairy 设置栏内新增「朗读服务」区块：

| 情况 | 表现 |
| --- | --- |
| 已连上本地 TTS | 绿色文案「正常 · 已连接本地 GPT-SoVITS（http://127.0.0.1:9880）」 |
| 没连上 | **红色加粗警示条**「⚠ 未检测到本地朗读服务，朗读功能当前不可用。」+ 具体原因 |

- 挂载时请求宿主 `GET /fairy-voice/status`，并提供「重新检测朗读服务」按钮
- 原「语音简报」的 API Key 表单搬进同一栏
  （`GET /fairy-voice/brain/status`、`POST /fairy-voice/brain/config`，请求格式与上游一致）

### 放弃 system-TTS 实验，只保留 GPT-SoVITS 路线

- 朗读引擎恢复为上游的 `fairy`（本机 GPT-SoVITS，端口 9880 硬编码）；client.js 无任何引擎切换
- `install.ps1` 在选中语音时**先打印醒目提示**（服务地址、参考音频、没跑就是灰按钮）
- 失败原因（官方会话投影结构漂移 → 消息发现为空 → 朗读按钮不渲染；以及 Web Audio 预解锁、
  嗓音表异步、错误静默三类坑）完整记录在 `patches\abandoned\README.md`
- 移除 `switch-voice-engine.ps1/.cmd` 与 `lib\voice-engine.ps1`；新增 `lib\settings-merge.ps1`
- 补丁目录重组：现行补丁为 `patches\0001-fairy-settings-merge.patch`，废弃实验归档至 `patches\abandoned\`

### 安装/卸载联动

- `install.ps1`：选语音 → 应用设置栏合并；未选语音 → 自动还原为上游设置栏
- `uninstall.ps1`：新增 `[2/4]` 步骤，把两个 bundle 还原为上游

---
## v0.1.2 变更（相对 v0.1.1 包）

### 修复：切到 system 引擎后「有控件但不出声、且不报错」

v0.1.1 把朗读引擎切到浏览器内置语音后，暴露出上游三处只适用于 PCM 播放路径的假设：

| 位置 | 问题 | 后果 |
| --- | --- | --- |
| 载入时的预解锁 effect | 无手势即创建 AudioContext | 停在 suspended，`audioReady` 永远 false |
| 播放处理器第一步 `await primeAudio(volume)` | AudioContext.resume() 在自动播放策略下可能长期不 resolve | 整个播放流程卡在该行之后：**不朗读，也无任何错误** |
| 错误提示 `engine === 'fairy' && ...` | system 引擎下所有失败被静默吞掉 | 界面看不出任何异常 |

新增 `patches\0002-voice-system-mode-fixes.patch`：

- system 引擎不再注册预解锁监听
- system 引擎直接跳过 `primeAudio`，把 `audioUnlocked` / `audioReady` 置真后走 `playSystem`
  （语音合成与 AudioContext 无关，不需要解锁）
- 错误提示改为与引擎无关，任何失败都会显示（鼠标悬停看 title）

对 `fairy` 引擎零影响：分支条件均为 `engine === 'system'`，否则走原逻辑。
`node --check` 通过；补丁级别由 `Get-VoicePatchLevel` 识别为 `p2`，
**旧文件（p1）会被 switch-voice-engine / install 自动重刷为 p2**，
无需手动删文件。

> 注意：client.js 是浏览器侧产物，改完**刷新页面（F5）**即生效，不必重启 DSH。

### 版本号

- `install.ps1` / `build-release.ps1` / README 的版本号统一到 `0.1.2`
- 旧的 `Fairy-DSH-v0.1.1.zip` 保留不删（另存为新版本，不覆盖旧的）

---
## v0.1.1 变更（相对 v0.1.0 包）

### 新增：朗读不再依赖本地 TTS

- 新增 `patches\0001-voice-engine-system.patch`：把 `fairy-voice` 的朗读引擎从
  上游硬编码的 `'fairy'`（本机 GPT-SoVITS）切到 `'system'`（浏览器 `speechSynthesis`）。
  上游的 `playSystem()` 实现完整但被注释明确禁用，本包启用它，
  于是**无需 GPT-SoVITS、无需参考音频、可离线朗读**，代价是音色变成系统嗓音。
- 上游原件保留为 `fairy-voice\dsh-fairy-voice\lib\client.js.upstream`，可一键回滚。

### 新增：数字键菜单（无需记参数）

双击 `.cmd` 就能用，不用加任何参数：

- `install` —— 菜单选安装集合（1 只装 UI / 2 加语音 / 3 再加余额 / 4 全部 / 5 自定义 / 0 退出），
  选了语音再问一次朗读引擎（1 浏览器内置语音 / 2 本机 GPT-SoVITS）
- `uninstall` —— 菜单选卸载方式（1 只卸载 / 2 卸载并还原最近一次安装备份 / 0 退出）
- `verify` —— 菜单选验证范围（1 只验 UI / 2 验 UI+语音 / 3 全部）
- `switch-voice-engine` —— 菜单选引擎（1 内置语音 / 2 本机 GPT-SoVITS / 0 退出）

命令行参数全部保留，给自动化与 CI 用；**非交互环境（管道/重定向）会自动退回默认值，
不会卡在等待按键**。菜单按键为单键读取、不回显、带自回显。

### 新增：朗读引擎可切换 + 原件永不覆盖

- 新增 `switch-voice-engine.ps1`（及 `.cmd`）：`-Engine system` / `-Engine fairy` / `-List`
- 新增 `lib\voice-engine.ps1`：共享实现，被切换脚本与 `install.ps1` 共同 dot-source
  （避免 `exit` 跨脚本连带退出的坑）
- 新增 `upstream-originals\`：固化上游原件
  `fairy-voice-client.js`，SHA256 `9A773BB2…4ED9`，**永不修改**，并附清单 README
- 新增 `snapshots\`：**每次切换前**把当前 `client.js` 快照进去，
  文件名含时间戳与当时的引擎名（如 `client.js.20260912-011519.system.bak`），同名自动加序号
- 切换始终**从上游原件重新生成**，不做叠加修改 —— 来回切多少次都不会串味；
  校验失败会自动从快照还原
- `install.ps1` 新增 `-VoiceEngine system|fairy`（默认 `system`），安装时一并完成切换

> 定位：`system` 是"先能用上"的实验形态。作者原始设计是 `fairy`（本机 GPT-SoVITS + 私有音色），
> 待本地 TTS 与参考音频就绪后执行 `.\switch-voice-engine.ps1 -Engine fairy` 即恢复。

### 新增：自检可覆盖多个插件

- `verify-isolated.ps1` 新增 `-Plugins visual,voice`（支持 `all`）。
  选 voice 时会自动带上 visual —— 因为 voice 的输入区控制器依赖
  visual 给 `<html>` 打的 `data-dsh-fairy-visual` 属性。
- `tools\dom-probe.mjs` 增加语音断言：voice 样式表、朗读控件数量/禁用态、
  `speechSynthesis` 可用性与中文嗓音列表。

### 修复

| 问题 | 影响 | 修复 |
| --- | --- | --- |
| `chrome.kill()` 只结束启动器，浏览器子进程残留 | 每次自检后留下一个无头 Chrome 与临时 profile | 探针结束改用 `taskkill /T /F` 收拾整棵进程树 |
| 成功时脚本退出码为 1 | `install.cmd` / `uninstall.cmd` 会误报 `[ERROR]` 并停在 `pause` | 两个脚本显式 `exit 0`；`verify-isolated.ps1` 把任何非 0（含 -1）归一化为 1 |

---

## v0.1.0 变更（初版）

### 修复（发布前实测发现）

| 问题 | 影响 | 修复 |
| --- | --- | --- |
| `Get-Content -Raw` 在 Windows PowerShell 5.1 下按 ANSI 读取无 BOM 的 UTF-8 文件 | 写回时中文被双重编码；实测**吃掉了一个回车**，把下一行 `- id: llm-deepseek` 并进注释，导致该条配置失效 | 改为按字节读入 + UTF-8 严格解码（失败回退 ANSI），并保留原 BOM 与换行风格 |
| `pnpm remove` 收到任一未安装的包名即整体失败 | 只装了部分插件时，卸载会失败并留下「patch 块已删、依赖还在」的烂状态 | 先解析 `package.json`，只移除真正存在的依赖 |

---

## 这份包做了什么

上游仓库是作者的**开发工作区**，直接拿来装会遇到几个坑。本整合包解决了：

| 上游原状 | 本包的处理 |
| --- | --- |
| 插件包 `private: true`，靠 `link:` 引用，未发布 npm | 保留 `link:` 安装方式，并写好安装脚本自动登记 |
| `link:` 不会安装目标包自身的依赖，直接装会缺模块 | 安装脚本检测缺失并自动 `pnpm install`；也可用自带依赖的完整包 |
| 依赖 `@deepseek-ai/dsh-settings` 精确 pin 到 `0.1.1-rc.2`，而新版宿主已移除 `settingsNamespace` | 保留该 pin（**这是能运行的前提**），并在文档中明确警告不要提升版本 |
| 附带作者的测试 profile，含 `danger-full-access` + `approval: never` | **未采用**；安装脚本只写入受管的 insert 条目 |
| 自带 `fairy-system/` 离线验收工具链，面向作者自己的工作区 | 未纳入发布内容 |
| 无安装/卸载/自检脚本 | 新增 `install.ps1/.cmd`、`uninstall.ps1/.cmd`、`verify-isolated.ps1/.cmd` 与 DOM 探针 |
| 文档为开发向 README | 重写 `README.md`，上游原文档保留为 `UPSTREAM-README.md` |

---

## 新增内容

### 脚本

- **`install.ps1` / `install.cmd`** —— 交互式安装
  - 开始时列出将要安装的插件与将要修改的文件，**按任意键**才开始，`Ctrl+C` 可取消
  - 自动检测并补齐缺失依赖（`pnpm install --prod --ignore-scripts`）
  - 覆盖前备份 `package.json` 与 `cordis.patch.yml` 到 `fairy-backup-<时间戳>\`
  - 写入受管块（`# >>> Fairy-DSH managed block` … `# <<<`），重复执行安全
  - 用 `dsh --dump-config` 校验合成结果，**失败自动还原** patch 文件
  - 检测到 DSH 正在运行时给出重启提示
  - 支持 `-WhatIfRun`（干跑）、`-Yes`（免确认）、`-Profile`、`-DshHome`、`-SkipDeps`
- **`uninstall.ps1` / `uninstall.cmd`** —— 移除受管块、解除依赖，可选 `-RestoreBackup` 还原
- **`verify-isolated.ps1` / `verify.cmd`** —— 隔离环境自检
  - 自动探测 Chrome / Edge（含注册表 App Paths）
  - 临时 `DSH_HOME`、独立 profile、独立端口，**不触碰生产 profile**
  - 端到端：建 profile → 启动 → 无头浏览器探针 → 打印结构化结果 → 清理
  - 退出码 0/1 可用于自动化；`-Keep` 保留现场

### 工具与文档

- **`tools/dom-probe.mjs`** —— 无头浏览器 DOM 探针，输出 Fairy 标记统计、
  计算样式、composer 几何、异常列表，并可将宿主/客户端 `DSH_FAIRY_LOG` 一并列出
- **`README.md`** —— 面向使用者的完整文档（安装、启用、兼容性、限制、FAQ）
- **`docs/验证报告.md`** —— 实测方法、数据、唯一降级项、未覆盖项与回归建议
- **`RELEASE-NOTES.md`** —— 本文件

---

## 验证结论

隔离环境中 **宿主侧与客户端侧均 `outcome: success`，JS 异常 0 条**，
49 类语义标记、mascot 浮层、HDD 主题、composer 坞、滚动条与辉光全部实际生效，见 `docs/验证报告.md`。

唯一降级项 `balanceAction` 源于测试 profile 未装 `dsh-balance-meter`，属配置差异。

---

## 已知限制

1. 与其它改写官方 DOM 的 UI 插件同装可能互相干扰，建议按需启用。
2. hero 文案投影与 composer 拖拽交互未在无头环境覆盖（需要真实会话视图）。
3. `fairy-startup` 会清空会话选择；`fairy-voice` 需自备 TTS 且长回答会上云；
   `browser-dock` 会暴露控制 token，不建议安装。
4. 上游依赖官方私有 DOM/ARIA/slot 契约，DSH 升级后可能静默降级 —— 升级后请跑自检。

---

## 安装形态说明

本发布包**不包含 `node_modules`**，安装时由脚本从 npm 拉取插件依赖（体积小、许可干净）。

如需**完全离线、自包含**的版本（依赖已预装、无需 pnpm 与网络），
可在整理机上重新打包为自带依赖的变体。

---

## 致谢

- 插件作者 **Chengzhibense** 及上游项目
- 上游引用的第三方项目：`@playwright/mcp`（Microsoft）、`@upstash/context7-mcp`（Upstash）、
  `dsh-message-edit`（Moeblack）、`dsh-reasoning-effort`（HanaAyane）、`hono`

《绝区零》相关剧情文本、角色资料与官方素材未随包分发，本项目不授予相关版权、商标或官方关联权利。
