# Release 正文模板（发版时照着填）

> **为什么有这个文件**：v0.3.1 与 v0.3.2 **连着两次**，Release 正文都只贴了一部分
> （分别只有 1348 / 1215 字符），缺的恰恰是新人最需要的三块 ——
> **「下载哪个」「装完做什么」「SHA256」**。
> 照着下面填，别再漏。

---

## 用法

1. 从下面的「模板」整段复制
2. 把 `{{占位符}}` 换成本次的值（字节数与 SHA 从 `release\SHA256SUMS.txt` 取）
3. 粘进 GitHub Release 正文
4. **逐条过一遍文末的「提交前自检」** —— 尤其是附件数量

---

## 📦 下载哪个？

| 下载这个 | 干什么 | 给谁用 |
| --- | --- | --- |
| **`install.cmd`** | 装 3 个：视觉浮层 + 朗读 + 余额 | ✅ **推荐，绝大多数人用这个** |
| `install_full.cmd` | 装全部 5 个（多装启动画面 + 截图 Dock，**有已知风险**） | ⚠️ 清楚后果、确实想要的人 |
| **`uninstall.cmd`** | **卸**：卸掉插件与预设，并把你改过的「默认会话预设」还原回去 | 🧹 不用了、想清干净的人 |

下载后**双击它**，按屏幕上的中文提示走就行。下面那 5 个 `.tgz` **不用管**。

> ⚠️ **要卸载的话得下两个文件**：`uninstall.cmd` **和** `uninstall.ps1`，放同一个文件夹里。
> 那个 `.cmd` 只是纯 ASCII 启动器，真正的逻辑在 `.ps1` 里（中文放进 `.ps1` 才能彻底躲开 936 代码页的乱码坑）。
> 只想装、不打算卸的人，这两个**不用下**。
>
> 🔒 **卸载不删用户数据**：参考音频 / 朗读设置 / API Key 都在 `~/.dsh/fairy-voice/`，脚本一个字节都不动，
> 只在最后把路径打给你。

> 不想用安装器也可以：下 5 个 `.tgz`，用 `dsh plugin --profile web add <文件路径>` 装。
> 上面几个链接**永远指向最新版**，想更新时重新下载再双击一次即可。

---

## 🚀 装完做什么

1. **重启 DSH**（关掉再打开）
2. 设置 → **Fairy** → 打开最上面的「**启用**」开关
   （**不开的话视觉和朗读都不出现 —— 这是设计如此，不是没装上**）
3. 想用朗读：**设置 → Fairy → 朗读自检** → 点「开始自检」，
   它会逐项告诉你卡在哪一层，并给出怎么修

---

## 🔧 怎么卸载

**不会打命令：双击 `uninstall.cmd`**（记得 `uninstall.ps1` 也下、放同一个文件夹）。
它会备份配置 → 卸插件 → **还原「新会话默认预设」** → 删预设目录 → 扫历史残留 → 校验 profile → 把保留的用户数据路径打给你。

> 🔴 **为什么卸载脚本一定要还原默认预设**：不还原的话，`settings.yaml` 里还写着"新会话默认用 Fairy"，
> 而预设已被删掉 —— 结果就是**「点新建会话没反应」**。卸载反而把机器弄坏，这个脚本专治它。

会打命令：

```powershell
dsh plugin --profile web remove dsh-fairy-visual dsh-fairy-voice dsh-balance-meter
.\uninstall.ps1 -CleanBundle   # 老版本（0.2.x）留过受管块/残留行时用，会先备份
```

> 卸载**不删** `~/.dsh/fairy-voice/`（参考音频 / 设置 / API Key）—— 要彻底清就自己删那个目录。

---

## 🔐 SHA256

| 文件 | 字节 | SHA256 |
| --- | --- | --- |
| `dsh-fairy-visual.tgz` | `{{字节}}` | `{{SHA}}` |
| `dsh-fairy-voice.tgz` | `{{字节}}` | `{{SHA}}` |
| `dsh-balance-meter.tgz` | `{{字节}}` | `{{SHA}}` |
| `dsh-fairy-startup.tgz` | `{{字节}}` | `{{SHA}}` |
| `dsh-browser-dock.tgz` | `{{字节}}` | `{{SHA}}` |
| `install.cmd` | `{{字节}}` | `{{SHA}}` |
| `install_full.cmd` | `{{字节}}` | `{{SHA}}` |
| `uninstall.cmd` | `{{字节}}` | `{{SHA}}` |
| `uninstall.ps1` | `{{字节}}` | `{{SHA}}` |

**合计 `{{总大小}}` KB。**

> 取数命令：
> ```powershell
> cd C:\Users\1\.dsh\plugins\Fairy-DSH\release
> Get-ChildItem *.tgz,*.cmd,*.ps1 | Sort-Object Name | ForEach-Object {
>   "{0}`t{1}`t{2}" -f $_.Name, $_.Length, (Get-FileHash $_.Name -Algorithm SHA256).Hash
> }
> ```

---

## ⚠️ 说明

- 本分支是**非官方**整理分支，上游作者**没有参与**本分支的任何改动
- `dsh-fairy-startup` 每次启动会清空会话选择；`dsh-browser-dock` 会暴露控制 token —— **默认都不装**
- 朗读需要本机有一个 TTS 服务（GPT-SoVITS 或 MOSS-TTS-Nano），**不装也能用其它部分**

---

## 提交前自检

逐条打勾，**任何一条没勾上都别点发布**：

- [ ] 有「**📦 下载哪个？**」表格，且明确写了"下 `install.cmd`"
- [ ] 有「**🚀 装完做什么**」（重启 DSH + 打开启用开关）
- [ ] 有「**🔧 怎么卸载**」，且写清 `uninstall.cmd` + `uninstall.ps1` **两个都要下**
- [ ] 有「**🔐 SHA256**」表，且 **9 行齐全**（5 tgz + 3 个 `.cmd` + `uninstall.ps1`）
- [ ] 表格里的字节数 / SHA 与 `release\SHA256SUMS.txt` **逐行一致**
- [ ] 附件名**不带版本号**（`latest/download` 是照字面取文件名的，带版本号下次发版就 404）
- [ ] **9 个附件全部传了** —— 少一个，README / `install.cmd` / `uninstall.cmd` 里对应的链接就 404
- [ ] 「Choose a tag」选的是**要发的那个 tag**（发完去 `releases/latest` 确认指向正确）
- [ ] 正文里没有"**尚未发版**"之类的残留字样

---

## 发布后核对（一条命令）

```powershell
$env:HTTP_PROXY='http://127.0.0.1:7897'; $env:HTTPS_PROXY='http://127.0.0.1:7897'
$r = Invoke-RestMethod 'https://api.github.com/repos/Guzhou2002/Fairy-DSH-Optimized/releases/latest'
$r.tag_name            # 应等于本次 tag
$r.assets.Count        # 应为 9
$r.assets | ForEach-Object { "{0,-26} {1}" -f $_.name, $_.size }   # 与本机逐字节比对
$r.body.Length         # 明显过短 = 正文又没贴全
```
