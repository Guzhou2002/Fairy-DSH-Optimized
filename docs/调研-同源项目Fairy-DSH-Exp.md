# 调研 · 同源项目 Fairy-DSH-Exp（分支 ponytail）

> 生成时间：**2026-09-13**。作者：孤舟蓑笠 + AI 协作。
> **性质**：外部信息记录，**不是**对本仓库的改动指令。本文所有内容均来自对方的公开文件，**我方未复验**。
> 用途：① 记住生态里还有谁在同源方向干活；② 把对方实测出的「DSH 运行时契约」存档，
> **将来自己合并上游 / 改 `cordis.patch.yml` 时避免踩同一个坑**。

---

## 1. 对象

| 项 | 值 |
| --- | --- |
| 仓库 | https://github.com/addsas222/Fairy-DSH-Exp |
| 作者 | `addsas222`（**不是**上游作者橙汁本色，也**不是**本仓库作者） |
| 关系 | **上游 `Chengzhibense/Fairy-DSH` 的 fork**；`main` = 上游 `d639887`（未改动），全部工作在分支 **`ponytail`** |
| 建立时间 | **2026-09-13 13:59**（当天），最后推送 14:57 |
| 热度 | 1 star / 0 fork / **无 Release** / 无 topics |
| 许可 | 仓库声明 Apache-2.0 |
| 关键文档 | `fairy-system/PONYTAIL-DESIGN.md`（15 KB，本文主要来源）、`README.md`、`RELEASE-CHECKLIST.md`、`fairy-system/UPGRADE_COMPATIBILITY.md` |

> 它**与本仓库无血缘**：目录里没有 `install.cmd` / `install_full.cmd` / `lib/settings-merge.ps1` /
> `docs/` / `tools/` / `release/` / `VERSION`。它是从上游直接分叉后自己另起炉灶。

---

## 2. 两条路线（不是竞争，是分工）

| | 它（Fairy-DSH-Exp / ponytail） | 本仓库（Fairy-DSH-Optimized） |
| --- | --- | --- |
| 定位 | **功能深度**：把上游做成功能完备的实验版 | **最后一公里**：让新手能装上、出问题能自查 |
| 面向 | 开发者 / 折腾党 | QQ 群友（新手） |
| 安装 | `git clone` → 设 `DSH_FAIRY_REPO_ROOT` → **手动把 preset 复制进用户根** → 独立 `DSH_HOME` → `scripts/test-isolated.sh` | 双击 `install.cmd`，或一条 `pnpm` 命令装 `.tgz` |
| 发布 | **无 Release、无版本号、无校验值** | 7 个附件 + SHA256 + 下载回来复算验证 |
| DSH 版本 | **钉死 `0.1.1-rc.2`**，跨到 `≥0.1.5-rc.1` 需重做升级验收 | 已适配 **`0.1.2-rc.1`**（v0.3.1 修完 `useChat`） |
| 诊断 | 有一堆脚本（`verify.js` 31 KB 等），但**没有面向用户的「自检面板」** | 朗读功能自检面板（7 项，逐条给修法） |

**结论**：它的强项是功能面更宽；本仓库的护城河是**新手装得上 + 出问题能自查 + 发版规范**。
对方短期内不构成对本仓库使用者的分流（没有 Release，群友基本装不上）。

---

## 3. 它做了什么（功能面对比）

| 它新增 / 重构 | 说明 | 我们有没有 |
| --- | --- | --- |
| **`fairy-voice` 重构为 TTS provider 注册表** | `local-sovits` / `openai`（兼容 OpenAI/鱼同形 API）/ `edge` / `browser`（客户端 SpeechSynthesis，零服务端）/ `custom-http`（URL+头+`{{text}}` 模板）。**既有 `/fairy-voice/*` 端点路径与响应形状保持不变** | ❌ 我们硬编码单一 GPT-SoVITS |
| **STT（语音输入）provider 注册表** | `whisper-web`（标签页内 transformers.js ONNX，**音频不出机器**）/ `openai` 指向 loopback whisper.cpp·faster-whisper·speaches（loopback 空 key 即视为可用）/ `browser` SpeechRecognition / `deepgram` / `azure` / `custom-http` | ❌ 我们只做了朗读输出 |
| **`fairy-persona` 人格包引擎** | 人格 = 目录（`persona.yml` + `prompt.md` + `tone.json` + 可选 `voice.ref`）；**切换人格 = 原子切换 TTS 音色**；扫描根 `$DSH_HOME/personas/` + 仓库 `persona-packs/` | ❌ 仅"一键设默认预设" |
| **`fairy-modes` 三模式引擎** | 极简 Explore&Check（复用官方 plan-mode）/ PTC Build&Work（`ctx.tools.presentAs('ptc')`）/ 创造 Memory&Dream；会话头 chip | ❌ |
| **`fairy-search` 搜索枢纽** | 元 provider `fairy-search-hub`，按设置路由到 deepseek-official / exa / perplexity / 通用 POST 模板；设置卡 + 连通性测试 | ❌ |
| **`fairy-memory` 长期记忆** | GBrain 主用，Mem0 / 自定义 HTTP / 本地 Markdown 备选 + 控制界面 | ❌ |
| **`fairy-roleplay` 角色扮演** | 第四会话模式；**去 AI 味检查器 L1–L4** + 风格库 | ❌ |
| `fairy-system/skill-audit.js` | 技能/插件冗余审计（Jaccard ≥ 0.6 报 merge 候选） | ❌ |
| `fairy-system/scaffold-plugin.js` | 插件脚手架 | ❌ |

**它大量复用官方能力而非重造**（其文档原话）：`@deepseek-ai/dsh-plan-mode`、
`ctx.tools.presentAs('ptc')`、`dsh-tool-session-query` 的 `session_search`、
`ctx.web.registerSearchProvider`、`dsh-persona` 的 scope 同名覆盖、skills 分层合并。

---

## 4. 🔴 最值得存档的部分：它实测出的「DSH 运行时契约」

> 来源：`fairy-system/PONYTAIL-DESIGN.md` 末节「0.1.1 运行时契约（实测钉死,2026-09-13）」。
> 它自述在 **dsh `0.1.1-rc.2`** 实机、以本地 **`0.1.2-rc.1`** 交叉验证。
> ⚠️ **下列均是对方的结论，本仓库未复验**。但踩坑代价高、症状隐蔽，值得先记着。

| # | 契约 | 违反后的症状（关键） |
| --- | --- | --- |
| 1 | **preset 行名必须是字面字符串** | `!!js` 表达式名 → `discovery.entryListProblem` 判为 "names no plugin"，picker 不可选 |
| 2 | 🔴 **组 id 必须与子行 id 不同** | 同名会让 cordis loader 的 entry **自我为父**，`_disabled()` 的父链 `while` 循环**同步卡死事件循环：CPU 100%、所有 API 挂起**（它用 `--inspect` + CDP 采样定位到 `disabledOf → _disabled → update` 热栈） |
| 3 | **profile 行名必须是裸包名** | 用子路径名（如 `pkg/bridge`）会让客户端 bundle **进不了 boot 图** → 槽位 UI 不渲染**且无任何报错** |
| 4 | **0.1.1 的 section 契约是字面 `order`** | 无 `systemPrompt.getSectionOrder`；官方 plan:policy = 50，故模式段取 51。人格段是单一 `deployment:persona`（order 0），**同名跨层注册会抛错** |
| 5 | **工具呈现取值随 cohort 改名** | 0.1.1 是 `native｜code｜both`（code-only 指令要求恰为 `code`）；**0.1.2+ 改为 `native｜ptc｜both`**。可用 `getSectionOrder` 是否存在做代际探测 |
| 6 | 🔴 **不要依赖 harness 子包做独立安装** | 插件自有 `node_modules` 里 `@deepseek-ai/dsh-tools` 会解析出**漂移的 peer 集合**（`dsh-llm` 缺 `CallId`、`dsh-session` 缺 `isJsonValue`），**加载即崩**。它因此改手写原生 `ToolDefinition`（纯 JSON Schema），零 harness 依赖 |
| 7 | 🔴 **`readdir` 的 `Dirent.isDirectory()` 对链接/junction 返回假** | **用链接/junction 放 preset 会被静默跳过，必须复制**。另：`$DSH_HOME/.agent-presets` 生效，`config.roots` 实测不参与 roster |

**对第 7 条的特别提示**：本仓库 live profile 采用 **`link:`** 安装形态（见 `AGENTS.md` §6.4）。
`link:` 用于**插件目录**没问题（那是 profile 的 loader 解析，与 preset 发现是两套机制）；
但**若将来要把 preset / skills 分发给群友，不能让他们用链接/junction**——会被静默跳过。

**它自报已跑通的端到端链路**（`0.1.1-rc.2`）：`session.create(ponytail)` 356 ms、
`/fairy-modes/set|state` 双向、`fairyMode` 投影、`/fairy-persona/select` → `fairy-persona/change`
→ `/fairy-voice/provider-config` 双向切换、`/fairy-voice/providers` 四提供者可用性、
主会话 header 三 chip 渲染。另注：**人格→语音绑定是事件级联（异步）**，测试需容忍同秒落盘时序。

---

## 5. 可借鉴点（**只借设计，不抄代码**）

| 借鉴 | 为什么值得 |
| --- | --- |
| **`TtsProvider.stream()` 的返回形态**：`AsyncIterable<Uint8Array> ｜ { clientSide: true, utterance }` | 一个接口同时容纳「服务端流式音频」与「浏览器原生朗读」，正好是 §6「语音引擎可插拔」中期目标的现成图纸 |
| **TTS 与 STT 用同一套 provider 注册表范式** | 加引擎 = 加一个 provider，不动朗读主流程（也更符合「不碰表现层」的红线） |
| **loopback 空 key 即视为可用、且不发 Authorization 头** | 本地 TTS/STT 服务通常无鉴权，这个判定能省掉群友一堆配置困惑 |
| **人格 ↔ 音色原子绑定** | 属于「新增」，不碰红线；比"一键设默认预设"更完整 |
| **去 AI 味检查器（L1–L4）** | 纯新增，且是玩家感知最强的功能之一 |
| **代际探测（`getSectionOrder` 存在与否）** | 应对 DSH 跨版本改名，比硬钉版本号更耐用 |

---

## 6. 生态里的第三家

对方 README 提到**社区包 `dsh-web`（作者 `zhu1090093659`）**，并专门写了共存分析
`fairy-system/DSH-WEB-COMPAT.md`（维护 selector/ARIA/slot 契约为唯一 DOM 事实源）。
→ **说明 DSH 插件生态里至少已有三方**，值得后续留意，但与本仓库无直接关系。

---

## 7. 待办 / 后续观察

- [ ] 观察 `ponytail` 分支是否发布 Release（截至 2026-09-13 无）——**有 Release 才构成对群友的实际分流**
- [ ] 观察它是否升到 `0.1.2-rc.1+`（它目前钉 `0.1.1-rc.2`）
- [ ] 若本仓库将来做「语音引擎可插拔」，**先读本文 §5 的接口设计再做方案**
- [ ] 不要跟进它的功能数量。本仓库的 KPI 是**已装上的群友不出问题**，不是功能对齐
