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

| 下载这个 | 装什么 | 给谁用 |
| --- | --- | --- |
| **`install.cmd`** | 3 个：视觉浮层 + 朗读 + 余额 | ✅ **推荐，绝大多数人用这个** |
| `install_full.cmd` | 全部 5 个（多装启动画面 + 截图 Dock，**有已知风险**） | ⚠️ 清楚后果、确实想要的人 |

下载后**双击它**，按屏幕上的中文提示走就行。下面那 5 个 `.tgz` **不用管**。

> 不想用安装器也可以：下 5 个 `.tgz`，用 `dsh plugin --profile web add <文件路径>` 装。
> 上面两个链接**永远指向最新版**，想更新时重新下载再双击一次即可。

---

## 🚀 装完做什么

1. **重启 DSH**（关掉再打开）
2. 设置 → **Fairy** → 打开最上面的「**启用**」开关
   （**不开的话视觉和朗读都不出现 —— 这是设计如此，不是没装上**）
3. 想用朗读：**设置 → Fairy → 朗读自检** → 点「开始自检」，
   它会逐项告诉你卡在哪一层，并给出怎么修

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

**合计 `{{总大小}}` KB。**

> 取数命令：
> ```powershell
> cd C:\Users\1\.dsh\plugins\Fairy-DSH\release
> Get-ChildItem *.tgz,*.cmd | Sort-Object Name | ForEach-Object {
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
- [ ] 有「**🔐 SHA256**」表，且 **7 行齐全**
- [ ] 表格里的字节数 / SHA 与 `release\SHA256SUMS.txt` **逐行一致**
- [ ] 附件名**不带版本号**（`latest/download` 是照字面取文件名的，带版本号下次发版就 404）
- [ ] **7 个附件全部传了** —— 少一个，README / `install.cmd` 里对应的链接就 404
- [ ] 「Choose a tag」选的是**要发的那个 tag**（发完去 `releases/latest` 确认指向正确）
- [ ] 正文里没有"**尚未发版**"之类的残留字样

---

## 发布后核对（一条命令）

```powershell
$env:HTTP_PROXY='http://127.0.0.1:7897'; $env:HTTPS_PROXY='http://127.0.0.1:7897'
$r = Invoke-RestMethod 'https://api.github.com/repos/Guzhou2002/Fairy-DSH-Optimized/releases/latest'
$r.tag_name            # 应等于本次 tag
$r.assets.Count        # 应为 7
$r.assets | ForEach-Object { "{0,-26} {1}" -f $_.name, $_.size }   # 与本机逐字节比对
$r.body.Length         # 明显过短 = 正文又没贴全
```
