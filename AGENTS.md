# AGENTS.md — 给 AI Agent 的安装与操作说明

本文件是写给 **AI Agent（DSH / Codex / Claude Code 等）**看的。人类读者请看 [README.md](README.md)。

仓库：`https://github.com/Guzhou2002/Fairy-DSH-Optimized`
上游（非本分支作者）：`https://github.com/Chengzhibense/Fairy-DSH`

---

## 1. 你的任务边界

用户让你"装 Fairy"时，默认只需要装 **3 个安全插件**：

| 包 | 能否由你自动安装 | 说明 |
| --- | --- | --- |
| `dsh-fairy-visual` | ✅ **可以** | 核心 UI，无外部服务依赖 |
| `dsh-balance-meter` | ✅ **可以** | 余额挂件，无外部服务依赖 |
| `dsh-fairy-voice` | ⚠️ **能装，但朗读不会响** | 朗读需要用户本机跑 GPT-SoVITS（`127.0.0.1:9880`）+ 参考音频。**你无法替他启动 TTS 服务或生成参考音频** |
| `dsh-fairy-startup` | ❌ **不要装** | 每次启动清空用户的会话选择，会丢掉他没结束的对话 |
| `dsh-browser-dock` | ❌ **不要装** | 暴露控制 token、页面截图落盘、takeover 硬编码 macOS 路径 |

**除非用户明确点名要后两个、并且你已把风险讲清楚，否则不要装。**

---

## 2. 标准安装流程

### 第 0 步：确认环境

```powershell
where pnpm      # 没有就让用户先装：npm install -g pnpm
where dsh
dsh --version
```

### 第 1 步：安装（一条命令）

```powershell
dsh plugin --profile web add `
  https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/dsh-fairy-visual.tgz `
  https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/dsh-fairy-voice.tgz `
  https://github.com/Guzhou2002/Fairy-DSH-Optimized/releases/latest/download/dsh-balance-meter.tgz
```

**要点**：

- `--profile web` 是默认 profile 名；**先问用户用的是哪个 profile**，不要假设
- URL 一律用 `releases/latest/download/<包名>.tgz` —— 这是**永久地址**，带版本号会 404
- 每个包自带 `dsh.bundle.patch` 声明，所以**不需要**你手写 `cordis.patch.yml`
- 只装某一个就把其余 URL 删掉即可

### 第 2 步：验证（必做）

```powershell
dsh --profile web --dump-config
```

成功标志：输出里能看到对应插件条目，且**没有报错**。

### 第 3 步：告诉用户手动做两件事

你**无法**替他完成这两步，必须明确提示：

1. **重启 DSH**（插件在启动时装载）
2. **设置 → Fairy → 打开「启用」开关** —— 不开的话视觉和朗读都不出现，这是设计如此

---

## 3. 卸载

```powershell
dsh plugin --profile web remove dsh-fairy-visual dsh-fairy-voice dsh-balance-meter
```

另一个做法是双击仓库根目录的 `install.cmd` 重新安装（它是安装器也是修复器）。

---

## 4. 验收清单

装完请逐条自检，并在回复里告诉用户哪些通过了：

- [ ] `dsh plugin --profile web add` 退出码为 0
- [ ] `dsh --profile web --dump-config` 能看到插件条目、无报错
- [ ] 已提示用户**重启 DSH**
- [ ] 已提示用户**打开「启用」开关**
- [ ] 若装了 `fairy-voice`：已告知用户**朗读需要本机 GPT-SoVITS**，否则按钮是灰的
- [ ] 若用户想要人设：已告知去 **设置 → Fairy → 打开发「Fairy 人设预设」**

---

## 5. 故障判定表（**先拿判别信号，再动手**）

> **用法**：按「判别信号」这一列去比对。**表里没列的原因不要猜** —— 命中 §5.5 任一条就停下来问用户。
> `🛑 停` = 你不许自己试，把**信号原文 + 这一行判断**贴给用户，由他决定。

### 5.0 三条铁律（违反必出事）

1. **不要"统一版本"**：`@deepseek-ai/dsh-settings` 必须保留插件自己 pin 的 `0.1.1-rc.2`。
   提升成宿主的 `0.1.2-rc.1` → 插件在**导入阶段直接失败**。
2. **不要碰正在运行的 DSH**：GUI 监听 `127.0.0.1:3080`。清理进程前先按端口确认归属（曾差点误杀）。
3. **改 `.cmd` / `.ps1` 之前先读 §6.1 / §6.2**：编码错了安装必然失败，而且在开发机上**复现不出来**。

### 5.1 装不上（安装阶段）

| 判别信号 | 判定 | 你该做什么 |
| --- | --- | --- |
| 下载 `.tgz` 卡住 / 超时 / `Failed to connect to github.com:443 after 21xxx ms` | 国内直连 GitHub 常超时 | 让用户挂代理；或改用 `install.cmd`（它有网络自查）。**别默认"绕开代理"** —— 若梯子在跑、代理也配着，"绕开代理"反而会因 schannel 取不到凭据而失败 |
| `schannel: SEC_E_NO_CREDENTIALS` | 三查：`git config --get-regexp proxy` / 注册表 `ProxyServer` / 梯子端口在不在监听 | **先确认梯子在跑，再考虑权限**。详见 `docs\交接摘要.md` §9 坑 15 |
| `dsh: pnpm failed` | pnpm 没装，或网络 | `where pnpm`；缺就 `npm install -g pnpm`，重试 |
| 报 **404** | URL 带了版本号 | 只能用 `releases/latest/download/<包名>.tgz`（**不带版本号**，这是永久地址） |
| 双击安装器**一闪就没了** | 报错随窗口一起消失 | 让用户在**命令行**里跑同一个 `.cmd` 看输出 |
| 🔴 满屏 `'xx' is not recognized as an internal or external command`，**但标题和部分 echo 又显示正常** | **安装器编码坏了**（不是用户操作错）：`.cmd` 存成了 UTF-8，在 `chcp=936` 的机器上 `rem` 注释行被从中间切开当命令执行 | 让用户敲 `chcp` 确认（**936 = 会中招**，65001 = 不会）。若是本仓库要重新发版 → 按 §6.1 用 GBK 写回 |
| `node_modules` 里只有一个 Junction、没有 `@deepseek-ai` 相关目录 | 用了 `link:` 形态 —— **`link:` 不装依赖** | 换成 `file:` / `.tgz`，或先手动装依赖 |
| `plugin add` 成功，但 `dump-config` 里**没有**插件条目 | 包没声明 `dsh.bundle.patch` / 缺 `cordis.patch.yml` | 🛑 **停**：说明包本身有问题，**别手写 `cordis.patch.yml` 去补** |
| 路径解析失败 | 用了 Windows 反斜杠 | `link:` 路径一律用**正斜杠** |
| 用户后来删了本地 `.tgz`，pnpm 就找不到包 | 本地 tgz 会把**绝对路径** `file:C:/.../x.tgz` 写进 profile | 改用**远程 URL** 或 npm 包 |
| 设置里找不到 Fairy **人设预设** | 包内 `.agent-presets/` **不会**被自动复制到 `$DSH_HOME\.agent-presets\` | 手动复制；`install.cmd` 会做这一步 |
| 从很老的版本升级上来，出现重复注册 / `Fairy-DSH managed block` | `0.1.x` 老写法的遗留块 | 🛑 **停**：不要自动清理。先让用户备份 profile，确认后再动 |

### 5.2 装上了但没反应（加载 / 启动阶段）

| 判别信号 | 判定 | 你该做什么 |
| --- | --- | --- |
| 界面一切照旧，毫无变化 | 两种可能，**按顺序排除**：① 没重启 DSH ② 「启用」没开（默认 `false`，设计如此） | 让用户**重启** + **设置 → Fairy → 打开「启用」** |
| 重启后设置里仍然没有 Fairy | 插件没挂上 | `dsh --profile web --dump-config`，看有没有 `fairy-visual` 条目 |
| 加载失败，报 **`settingsNamespace` 不存在** | 依赖被提升成了宿主的 `0.1.2-rc.1` | 🛑 **绝不要"统一版本"**。`settingsNamespace` 只是"校验命名空间格式后原样返回字符串"，与宿主 `register(ns, schema)` 兼容；保留插件自己的 `node_modules` 即可 |
| 🔴 **CPU 100% / 所有 API 挂起 / 会话创建时静默卡死** | 候选：改过 `cordis.patch.yml` 且**组 id 与子行 id 同名** → cordis loader 里 entry 自我为父，`_disabled()` 父链 `while` 同步死循环 | 🛑 **停**，先回滚那行改动，再核对"组 id ≠ 子行 id"。⚠️ 结论来自外部同源项目实测，**本仓库未复验**，见 `docs\调研-同源项目Fairy-DSH-Exp.md` §4 |
| 槽位 UI 不渲染，**且控制台没有任何报错** | 候选：profile 行名用了**子路径**（如 `pkg/bridge`）→ 客户端 bundle 进不了 boot 图 | 🛑 **停**，行名必须是**裸包名**。⚠️ 同上，外部结论未复验 |
| `verify-isolated.ps1` 输出 `degraded official capability [ENHANCEMENT]: balanceAction` | **不是故障**：隔离 profile 没装 `dsh-balance-meter`，官方侧栏没有余额入口，Fairy 找不到锚点 | 不用处理，装了 balance 就消失 |
| DSH 升级后 `DSH_FAIRY_LOG` 里 `operation:"capability.missing"` **条目变多** | 官方 DOM / ARIA 契约漂移，功能在**静默减少** | 跑 `.\verify-isolated.ps1` 看是否仍 `PASS`；把新增条目交给用户 |
| `apply` 不再 success，或出现 `exceptionThrown` | 加载失败 | 🛑 **停**：先 `dsh plugin --profile web remove …` 回滚，再排查 |

### 5.3 装好了但不好用（功能阶段）

| 判别信号 | 判定 | 你该做什么 |
| --- | --- | --- |
| 朗读按钮**是灰的** | 本机没跑 GPT-SoVITS（`127.0.0.1:9880`）—— **这是上游设计，不是故障** | 让用户跑自检面板。**你无法**替他启动 TTS 服务，也无法替他生成参考音频 |
| 自检**第 2 项**失败 | SoVITS 不可达 | 让用户起服务，或改地址 / 端口（设置里可改，**改完即时生效、不用重启**） |
| 自检**第 3 项**失败；或日志有 `ENOENT … fairy_ref.wav` / `fairy_ref.txt` | 缺参考音频 | 提示放 **3–10 秒干净人声**到 `~/.dsh/fairy-voice/reference/`（该目录插件**启动时会自动建好**，里面附有 README.txt）。**`fairy_ref.txt` 缺失不影响出声** —— 宿主优雅回落到内置文案，不报错。历史位置 `runtime/reference/` 仍兼容 |
| 自检**第 7 项「消息识别」** ❌；诊断里 `hasChat:false` / `chatKeys:[]` / `orderLength:-1`；**右下角出现红色提示框** | `chat` 被从 `useSession` 快照里拆走了（`0.1.2-rc.1` 那次改动，**0.3.1 已修**） | 若在 0.3.1 上**再次**出现 = DSH 又改了结构。看诊断里的 **`runningSource`**：长期是 `none` 说明兜底没命中，需要换数据源 |
| 朗读控件 `.dsh-fairy-voice-auto` 数不到 | **三重前置**：装了 `fairy-visual` + HDD 视觉模式已开 + **在真实会话页面** | 首页与刚建的空白会话**不显示**，这是 DSH 自身设计 |
| 宿主 `/prepare` 连不上 9880 却仍成功 | **正常**：`/prepare` 只做本地切句，**只有 `/tts` 才需要** SoVITS | 不用管。这条也是"浏览器引擎可离线"的依据 |
| 界面元素错乱 / 被别的插件挤掉 | 抢 DOM | 让用户先禁用其他改界面的插件：`beauticode` / `whale-widget` / `live2d-companion` / `liang-slider` / `ui-task-board` |
| 用户问"输入框左边那个是不是麦克风" | **不是** | `fairy-voice` **没有任何语音输入能力**（全包检索 `getUserMedia` / `MediaRecorder` / `SpeechRecognition` / `whisper` 均为零命中）。那是「自动朗读开关 / 音量」，且只在 HDD 模式开启时出现 |
| 用户抱怨卡顿 / 长时间运行变慢 | 插件含 `document.body` 级 MutationObserver + rAF 动画 + 定时器，**未做长时间压测** | 如实告知这是**已知未覆盖项**，不要编原因 |

### 5.4 你在这个仓库里干活时的坑

| 判别信号 | 判定 | 你该做什么 |
| --- | --- | --- |
| 合并上游时，git 提示要改 `fairy-visual/…/lib/client.js` 或 `fairy-voice/…/lib/client.js` | 🔴 这两个是**生成物**，不是上游原件 | 🛑 **绝不要直接接受上游改动**（会把设置栏补丁覆盖掉）。正确顺序：先把上游新版存进 `upstream-originals\`，再重新生成 |
| 生成脚本报「锚点匹配数不为 1」 | 上游改了结构 | 同步更新 `lib\settings-merge.ps1` 里的锚点 |
| 合并上游时 `.agent-presets/fairy/` 报 `deleted by us` | 人设预设被**有意**搬进了插件包内 | 🛑 **不能"接受删除"就完事**：要手动把上游新语料同步进 `fairy-visual\dsh-fairy-visual\.agent-presets\fairy\` |
| 上游 `agent.cordis.yml` 又带回 `runtime/index.js` / `runtime/safety-gate.js` 引用 | 那是上游作者的**私有**文件（未发布） | **保持移除状态**，否则预设加载不了 |
| 想跑 `git clean -fd` | 会删掉 `node_modules` 和 `release/` | 🛑 **停**：跑一下插件当场加载不了 |
| 想跑 `git add -A` | `upstream-pull-request\` 是 **git worktree**（与主仓库共享 `.git`） | 🛑 **停**：可能把整份上游代码提交进 `main`。必须逐个 `git add <路径>` |
| 用 `edit` 工具改过 `.ps1` | 会**丢掉 BOM** | 改完必须补 BOM，再用 `Parser::ParseFile` 校验 |
| 改动了任一插件包内容 | SHA256 会变 | 必须重新 `.\pack.ps1` → 更新 `docs\交接摘要.md` §8 的 SHA → 更新 Release 附件 → **tag 对齐** |
| 改了 `lib\settings-merge.ps1`，或换了 `upstream-originals\` 里的原件 | 生成物已过期 | 重新生成，再 `node --check` 两个 `client.js` |
| 改了 `install.cmd` / `install_full.cmd` | 这两个**在** Release 里，SHA 会变 | 按 §6.1 用 GBK 写回，并同步更新 SHA 与 Release 正文 |
| 🔴 想把用户数据（参考音频 / API Key）挪进插件目录「好一起管理」 | **绝不可以** —— 见下面 §5.4.1 | 🛑 **停**。用户数据一律放 `~/.dsh/fairy-voice/` |

#### 5.4.1 🔴 为什么用户数据【绝不能】放进插件目录

**这不是风格问题，是丢数据问题。** 判据在「插件代码装在哪」：

| 装法 | 插件代码落在 | 那个地方安全吗 |
| --- | --- | --- |
| 源码（`git clone` / `link:`） | `~/.dsh/plugins/…` 或你 clone 的目录 | 相对安全，但**升级 = `git pull` / 重 clone** |
| **发布包（`dsh plugin add <tgz>`）** | **profile 下的 `node_modules`** | 🔴 **pnpm 随时会清掉、重建、按版本重装** |

群友绝大多数是第二种。把「参考音频」「语音简报的 API Key」放进插件目录，
等于把它们放在一个**升一次版本就没了**的地方。

**所以规矩是**：

- **用户数据** → `~/.dsh/fairy-voice/`（`reference/` 音色、`runtime/config.json` 设置、`voice-brain.json` 密钥）
- 这个目录由插件**运行时**用 `homedir()` 自己建，**与插件装在哪、怎么装、装几次都无关**
  （见 `lib/index.js` 的 `apply()` 里 `ensureFairyDirectories()` 的调用）
- 这也是**上游本来的设计**，不要"优化"掉

> 判据一句话：**任何会被 `pnpm install` / 插件重装影响到的目录，都不许放用户数据。**

> 📌 **本次改动不影响 SHA**：`README.md` 与 `AGENTS.md` **不在任何 `.tgz` 里**（`pack.ps1` 只打 5 个插件目录 + 两个 `.cmd`）。

### 5.5 🛑 必须停下来交给用户的情况（汇总）

出现下列任何一条，**不要自己试、不要"应该没问题"地继续** —— 把**信号原文 + 你的判断**贴给用户：

1. 要改 profile 的 `cordis.patch.yml` 或 `dsh.profile.bundles`
2. 要删除 / 重建用户的 profile 目录、`settings.yaml`
3. 要"统一"或"提升"任何 `@deepseek-ai/*` 依赖版本
4. 要 `git clean -fd` / `git add -A` / `git reset --hard` / 切换分支
5. 要重命名或移动 release 产物、改任何 `.tgz` 的名字
6. 出现本文表格**没有**收录的症状，而你又**给不出判别信号**
7. 用户机器是 **936 代码页**，而你要改 `.cmd`

---

## 6. 修改本仓库文件时的坑（重要）

### 6.1 `install.cmd` / `install_full.cmd` 必须是 GBK 编码

这两个文件**必须**是 **GBK(936) + 全 CRLF + 无 BOM**，且第 2 行是 `chcp 936`。

**绝不能存成 UTF-8。** UTF-8 的中文在 936 代码页的 Windows 上会让 `cmd.exe` 认错行尾换行符，
于是 `rem` 注释行被从中间切开当成命令执行，满屏
`'xx' is not recognized as an internal or external command`，**安装必然失败**。

- 判别：`chcp` 显示 **936 = 会中招**、显示 65001 = 不会（Windows 11 开了"全局 UTF-8"就会躲过）
- 改完必须用 GBK 严格编码写回，且不能出现 GBK 存不下的字符（emoji 一律不要）
- 参考正确做法：同目录的 `verify.cmd` —— 它是**纯 ASCII 启动器**，中文全放在 `.ps1` 里

### 6.2 `.ps1` 必须 UTF-8 带 BOM

PowerShell 5.1 读无 BOM 的 `.ps1` 会按 GBK 解析，满屏假语法错误。

### 6.3 批处理里调另一个 `.cmd` 必须加 `call`

不加 `call`，当前脚本会把控制权直接交出去、永不返回，后面的步骤全不执行（实测踩过）。

### 6.4 `link:` 安装的路径要用正斜杠

```powershell
dsh plugin --profile web add link:C:/path/to/fairy-visual/dsh-fairy-visual
```

Windows 反斜杠会解析失败。另外 `link:` **不会**装依赖，只有 `file:` / `.tgz` 才会。

### 6.5 别在这个仓库跑 `git clean -fd`

`node_modules` 和 `release/` 都在忽略列表里，跑一下插件当场加载不了。

---

## 7. 不要做的事

1. **不要安装 `dsh-fairy-startup` 和 `dsh-browser-dock`**（除非用户明确要求且已知风险）
2. **不要改动表现层**：`.agent-presets/fairy/` 下的语料、`fairy-visual/src/client/**`（布局、mascot、样式）、
   `fairy-voice` 的朗读逻辑、`LICENSE` / `NOTICE` / `TRADEMARKS.md`
3. **不要动 `upstream` remote**：它的推送地址已被设为 `DISABLED`，防止误推到上游作者仓库
4. **不要把发布包里的 `.tgz` 改名带版本号**：README 用的是 `latest/download/<包名>.tgz` 永久地址，带版本号下次发版会 404
5. **不要在 GitHub Release 附件里用中文文件名**：会被清洗成 `-.zip`

---

## 8. 更多信息

| 文件 | 内容 |
| --- | --- |
| `README.md` | 面向人类的完整说明 |
| **`docs\本地改动.md`** | **本分支相对上游改了什么、为什么改**（README 里那一段太长的正文挪到了这里）。动手改上游文件之前先读它 |
| `docs\改动清单.md` | 相对上游的文件分类清单（新增 / 修改 / 改名 / 删除） |
| **`docs\接手-v0.3.2.md`** | ⭐ **接手仓库先读这个**：上一轮的产出、唯一未完成项、这一轮学到的教训（含 MOSS 的 4 个坑、两个工具层面的坑） |
| `docs\交接摘要.md` | 全量档案：项目当前状态、待办、全部踩坑记录 |
| `docs\Release正文模板.md` | 发版时填 Release 正文用 + **「提交前自检」清单**（v0.3.1/v0.3.2 连着两次正文都没贴全） |
| `docs\安装机制实测.md` | `dsh plugin add` 各形态（`link:` / `file:` / `.tgz` / 远程 URL）的实测结论 |
| `docs\仓库与上游.md` | 如何合并上游更新 |
| `docs\调研-同源项目Fairy-DSH-Exp.md` | 生态里的同源项目 + **DSH 运行时契约**（含"组 id 同名会卡死事件循环"） |
| `docs\调研-CPU音色克隆引擎.md` | 无显卡可玩的音色克隆引擎调研（MOSS-TTS-Nano 等） |
| **`docs\install-moss.md`** | ⭐ **给 AI Agent 的任务书：装 MOSS-TTS-Nano**（朗读的第二引擎，CPU 可跑）。用户说"朗读没显卡跑不动 / 装上 MOSS"时读这一份 |
| `tools\install-moss.ps1` | 上面那份任务书要跑的**一键安装脚本**（6 个坑已写死，幂等，可重跑） |
| `tools\moss-tts-server\` | `server.py`（MOSS 服务端，绕开 pynini）+ `verify.py`（验证器，随时可重跑） |
| `legacy\README.md` | 已废弃的旧脚本 |
