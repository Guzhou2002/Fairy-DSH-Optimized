# `legacy\` —— 已弃用的旧脚本

> 这些文件**不再维护**，保留只为历史参考与排查。
> 新装插件请用根目录的 **`install.cmd`**；重新打包请用 **`pack.ps1`**。

---

## 为什么被弃用

0.3.0 起，分发方式换成了 **DSH 官方命令 `dsh plugin add`**：

- 官方命令自己会完成「**下载 + 装依赖 + 注册 bundle**」三件事
- 所以**不再需要安装器**，也不再需要预装 `node_modules` 的"含依赖包"
- 包体积从 **1.8 MB** 降到约 **472 KB**（5 个 tgz 合计）

完整实测过程与证据见 [`docs\安装机制实测.md`](../docs/安装机制实测.md)。

---

## 文件清单

| 文件 | 原来是什么 | 被什么取代 |
| --- | --- | --- |
| `install-0.2.3.ps1` | 旧安装器：数字键菜单，7 步流程（依赖检查、设置栏合并、人设预设安装、配置备份、`dsh plugin add` 注册、遗留块清理、profile 校验） | `install.cmd` |
| `install-0.3.0-dev.ps1` | 过渡版安装脚本（中文逻辑放在 ps1，`.cmd` 只作纯 ASCII 启动器）。**未发布过** | `install.cmd`（已合并为单文件） |
| `uninstall-0.2.3.ps1`<br>`uninstall-0.2.3.cmd` | 卸载器，5 步，只移除实际存在的依赖 | `dsh plugin --profile web remove <包名>` |
| `build-release-0.2.3.ps1` | 打两个 zip（一键安装版 / 一键部署版-含依赖）+ `.sha256` | `pack.ps1`（打 5 个 tgz） |
| `安装说明-0.2.3.txt` | 傻瓜版图文安装步骤 | `README.md` 顶部 + `install.cmd` 的屏幕提示 |
| `patches\` | 设置栏合并与语音引擎路线的补丁存档（含 `abandoned\`） | `lib\settings-merge.ps1`（改为脚本生成） |

---

## 想拿回来用？

可以，比如旧卸载器：

```powershell
.\legacy\uninstall-0.2.3.ps1 -Profile web
```

**但要清楚它依赖的是旧的分发形态**（`link:` 方式安装、包内自带 `node_modules`），
用在 0.3.0 之后装的插件上不一定合适。真要用，先在一个一次性 profile 里试。

---

## 还有哪些"旧的"没挪进来

| 文件 | 为什么留下 |
| --- | --- |
| `verify-isolated.ps1` / `verify.cmd` | **仍然可用** —— 它是验证工具（临时 `DSH_HOME` 起隔离实例 + 无头探针），不是安装器 |
| `tools\*.mjs` | DOM 探针，验证用 |
| `lib\settings-merge.ps1` | **仍在用** —— 设置栏合并包的生成脚本 |
| `upstream-originals\` | **仍在用** —— 上面那个脚本的输入（上游原件只读副本） |
| `RELEASE-NOTES.md` | 历史发版记录，不删 |
