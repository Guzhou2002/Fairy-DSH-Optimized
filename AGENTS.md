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

## 5. 常见阻塞（照这个顺序排查）

| 症状 | 原因 | 你该做什么 |
| --- | --- | --- |
| 下载 `.tgz` 超时 | 国内直连 GitHub Releases 经常超时 | 提示用户挂代理；或用 `install.cmd`（它有网络自查提示） |
| `dsh: pnpm failed` | 同上，或 pnpm 没装 | 先 `where pnpm`，再让用户检查网络 |
| 装完界面没变化 | 用户没重启，或没打开「启用」开关 | 按第 3 步提示 |
| 插件加载失败、报 `settingsNamespace` 不存在 | `@deepseek-ai/dsh-settings` 被提升成了宿主的 `0.1.2-rc.1` | **不要**去"统一版本"。插件依赖精确 pin 在 `0.1.1-rc.2`，保留它自己的 `node_modules` |
| 朗读按钮是灰色 | 本机没跑 GPT-SoVITS | 让用户在 **设置 → Fairy → 朗读功能自检** 里点「开始自检」，7 项检查会指出卡在哪层 |

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
| `docs\交接摘要.md` | 项目当前状态、待办、全部踩坑记录 |
| `docs\安装机制实测.md` | `dsh plugin add` 各形态（`link:` / `file:` / `.tgz` / 远程 URL）的实测结论 |
| `docs\仓库与上游.md` | 如何合并上游更新 |
| `legacy\README.md` | 已废弃的旧脚本 |
