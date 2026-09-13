# 上游原件清单（upstream-originals）

本目录存放**未经任何本地修改**的上游文件。上游基线：

> [`Chengzhibense/Fairy-DSH`](https://github.com/Chengzhibense/Fairy-DSH) 的 `main @ d639887`

**永不覆盖**，供回滚、审计与重建合并包使用。

---

## 文件清单

| 文件 | 来自上游哪个路径 | 字节 |
| --- | --- | --- |
| `fairy-visual-client.js` | `fairy-visual/dsh-fairy-visual/lib/client.js` | 454,743 |
| `fairy-voice-client.js` | `fairy-voice/dsh-fairy-voice/lib/client.js` | 83,929 |
| `fairy-agent.cordis.yml` | `.agent-presets/fairy/agent.cordis.yml` | 12,168 |
| `README.md` | —— 本文件 | —— |

## 谁是"活的"，谁是"参照物"

| 文件 | 状态 |
| --- | --- |
| `fairy-visual-client.js` | ✅ **活的** —— `lib\settings-merge.ps1` 读它来生成合并包 |
| `fairy-voice-client.js` | ✅ **活的** —— 同上 |
| `fairy-agent.cordis.yml` | 📖 **参照物**，没有任何脚本引用它 |

> `fairy-agent.cordis.yml` 留在这里，是因为它是一份**上游原件**：
> 本地版本改过它（删掉了那两条引用作者私有 `runtime/` 的条目），需要对照时用得上。
> 详见 [`docs\仓库与上游.md`](../docs/仓库与上游.md) §4.1。

---

## ⚠️ 别手工改这里的文件

它们是**生成合并包的输入**：

```
upstream-originals/*.js            （上游原件，只读）
        ↓  lib\settings-merge.ps1 注入 FairyNotice / FairyVoicePanel
fairy-visual\…\lib\client.js       （生成物，别手改）
fairy-voice\…\lib\client.js        （生成物，别手改）
```

**上游更新时**的顺手顺序：

1. 把上游新版 `client.js` 存到这里（**替换**原件）
2. 重新跑 `Set-SettingsMerge -Mode merged -Snapshot -Force`
3. `node --check` 两个生成物

完整说明见 [`docs\仓库与上游.md`](../docs/仓库与上游.md) §4.2。

---

## 校验当前内容

哈希**不硬编码在这里**（会过期，反而误导）。需要时现算：

```powershell
Get-ChildItem upstream-originals -File | Get-FileHash -Algorithm SHA256
```

---

## 历史遗留说明

下面这些**曾经出现在本文件里、现在已经不存在了**：

- ~~`.\switch-voice-engine.ps1 -Engine fairy`~~ —— 该脚本从未发布过，仓库里没有它
- ~~引用 `patches/`~~ —— 补丁存档已移到 [`legacy\patches\`](../legacy/patches/)
