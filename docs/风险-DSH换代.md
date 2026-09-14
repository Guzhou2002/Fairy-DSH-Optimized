# 风险登记 · DSH 换代时会踩的坑

> **用途**：DSH 一升级就可能坏我们的东西，本文把**已知的换代风险**集中记在一处。
> 每条都写清 **判别信号 / 为什么 / 该做什么 / 证据强度**，照表比对，**别猜**。
>
> ⚠️ 标注「**外部实测·未复验**」的，来自同源项目 Fairy-DSH-Exp
> （`docs\调研-同源项目Fairy-DSH-Exp.md`，仓库 `addsas222/Fairy-DSH-Exp` 的 README 与设计文档）。
> **我方没有在自己机器上复验过**，只当线索；复验过之后请把标注改掉并写上日期。

---

## 0. 本机基线（改任何东西之前先对一遍）

| 项 | 值 |
| --- | --- |
| 本机 DSH | **`0.1.2-rc.1`**（`dsh --version`） |
| live profile | `dsh-fairy-visual` / `dsh-fairy-voice` / `dsh-balance-meter`，以 **`link:`** 装入 |
| 换代前的验证手段 | `.\verify-isolated.ps1 -Plugins visual,voice -Yes -Port 3183` |

---

## 1. 🔴 宿主「混版安装」→ runtime 自身起不来

**判别信号**（看到这条就是它，与我们的插件无关）：

```
SyntaxError: The requested module '@deepseek-ai/dsh-session-query'
  does not provide an export named 'SESSION_QUERY_DEFAULT_PREPARED_SESSION_CACHE_SIZE'
```

- **为什么**：宿主自己的 `@deepseek-ai/*` 版本**不一致**（例如顶层还是 `0.1.2-rc.1`，
  而 `dsh-session-query-sqlite` 已经是 `0.1.5-rc.2`）—— 老的那半缺新的那半要的导出名。
- **该做什么**：让用户把 `@deepseek-ai/*` **全量重装到同一版本**。不是我们的包坏了。
- 🔴 **别和「三条铁律」搞混**（这是最容易搞错的一条）：
  - 铁律①说的是「**插件自己 pin 的** `@deepseek-ai/dsh-settings` 必须留在 `0.1.1-rc.2`，不许提升成宿主的版本」
  - 本条说的是「**宿主自己的包要内部一致**」
  - **两条不矛盾**：插件保持自己 pin 的版本；宿主保持自己内部一致。
- **证据**：外部实测·未复验

---

## 2. 🔴 客户端面孔换代（`0.1.2` → `0.1.5`）

**判别信号**：DSH 升级后，Fairy 的**浮层 / 设置面板整块不出现**，console 有模块解析类报错。

- **背景**：`0.1.5` 里 `dsh-client-runtime` / `dsh-client-ui-slots` / `dsh-client-ui-primitives`
  **不再作为顶层 npm 包**；新面孔是 `dsh-client-modules` / `dsh-client-ui-renderer` 等（约 47 个）。
- **我们的暴露面**：`fairy-visual\dsh-fairy-visual\package.json` 的 `dsh.client.inject` 列了 7 个 `dsh-client-*`，
  生成物 `lib/client.js` 里也有对应引用。
- **缓解证据**（外部实测·未复验，但**很关键**）：
  1. `@deepseek-ai/dsh-client-ui-primitives` 这个 **module specifier 在 0.1.5 里仍然活着** ——
     0.1.5 自己的 36 个官方客户端包照样 `require` 它，由 Web 外壳的**静态模块表**提供。
     → **它不是硬失败点，不要为迁就它去改写 bundle。**
  2. `inject` 在 0.1.5 客户端里是「**加载 / 预取元数据**」（源码注释原文：
     `informational (loading/prefetch metadata, never apply sequencing)`），**不是运行期硬依赖**。
- **仍未验的**：`inject` 里包名解析不到时是**静默还是告警**；浏览器里**是否真的加载成功**。
- **该做什么**：跨到 `≥0.1.5` 之前，**必须在隔离 home 起实例 + 真机页面看槽位渲染** ——
  只跑 `verify-isolated.ps1` **不够**（它证明不了渲染，见 `接手-v0.3.5.md` §3.6）。

---

## 3. 🔴 升级 DSH 后，preset 里那 20+ 个官方包名可能失效

**判别信号**：**又是「点新建会话没反应」**，报错还是

```
agent-preset/invalid: preset "fairy" failed to mount: failed to apply loader entry …
```

但**这次不是 `text` / `prefix` 那回事** —— 看报错点名的是**哪一行**。

- **为什么**：我们的 preset（`agent.cordis.yml`）每一行都按**包名**引用官方插件
  （`tool-bash` / `tool-pwsh` / `tool-fs` / `tool-fs-search` / `tool-jobs` / `skill-filesystem` /
  `tool-skill` / `tool-goal` / `plan-mode` / `compaction` / `subagent` …）。
  官方**改名或抽包** → 那一行挂载失败 → **整个 preset 失败 → 会话创建被回滚**。
- **该做什么**：
  1. 从报错里找出点名的那一行；
  2. 快速二分：把那行 `disabled: true` 再试一次；
  3. 拿新版 DSH 的**内置预设**（`standard` / `ptc` / `cordis`）当参照，对齐包名。
- ⚠️ **这一类是长期会反复出现的**：症状与 v0.3.6 / v0.3.7 那次**一模一样，但根因不同**
  （那次是 schema 键名，这次可能是包名）。**别一看"点新建会话没反应"就只想到 text/prefix。**

---

## 4. 🟡 我们走的是官方 bundle 路线，同源项目不走

| | 我们 | 同源项目 |
| --- | --- | --- |
| 装载方式 | 包内声明 `dsh.bundle.patch` + 自带 `cordis.patch.yml` → `dsh plugin add` **自动写进 `dsh.profile.bundles`** | profile patch 的 `insert` 行 + `inject: [clientModules]` |
| 他们的理由 | — | 「列进 bundles 会要求该包声明 `dsh.bundle`，本仓库的包没有这个声明」（两代都报 `declares no dsh.bundle`） |

- **含义**：**官方若改 bundle 契约，我们受影响、他们不受**；反过来我们一条命令装完、他们不行。
- **判别信号**：`dsh plugin add` 成功，但 `--dump-config` 里**没有**插件条目 / 报 `declares no dsh.bundle`。
- **该做什么**：升级 DSH 后先跑 `dsh --profile web --dump-config`，再跑隔离验证。

---

## 5. 🟡 工具呈现取值、段落 order 跨代改名

| 面 | `0.1.1` 代 | `0.1.2+` / `0.1.5` 代 |
| --- | --- | --- |
| 工具呈现取值 | `native \| code \| both` | `native \| ptc \| both` |
| 段落 order | 字面数字（plan 策略 = 50） | `systemPrompt.getSectionOrder('PLAN_POLICY')`（= 500） |

- **代际探测技巧**：看 **`systemPrompt.getSectionOrder` 存不存在** —— 比钉版本号耐用。
- **我们的暴露面**：目前**低**（我们没自己注册 systemPrompt 段落；preset 里那段 `plan-mode`
  配置是交给官方插件解析的）。**将来若要注入段落，必须用 `getSectionOrder`，不要写死数字。**
- **证据**：外部实测·未复验

---

## 6. 🟡 官方 DOM / ARIA 契约漂移 → 功能在「静默减少」

- **判别信号**：`DSH_FAIRY_LOG` 里 `operation:"capability.missing"` 条目**变多**。
  （已知无害的一条：隔离 profile 没装 `dsh-balance-meter` 时的 `balanceAction`。）
- **该做什么**：跑 `verify-isolated.ps1` 看是否仍 `PASS`；把**新增的缺失项**交给用户判断要不要补。
- **建议**：升级 DSH 后**把当前条目清单记下来当基线**，以后只看增量。

---

## 7. 🟢 已经踩过、且已规避的（留作教训，别再重蹈）

| 坑 | 现在的做法 |
| --- | --- |
| `text:` / `prefix:` **跟 DSH 版本走** | 预设里**两个键都写**（v0.3.7 兼容层） |
| `readdir` 的 `Dirent.isDirectory()` 对**链接/junction 返回假** | 分发 preset **必须复制、不能用链接**（我们本来就是复制） |
| **组 id 与子行 id 同名** → 事件循环同步卡死（CPU 100%、API 全挂） | 组 id 必须 ≠ 子行 id（见 `调研-同源项目Fairy-DSH-Exp.md` §4） |
| profile 行名用**子路径**（如 `pkg/bridge`）→ 槽位 UI 不渲染**且无报错** | 行名必须是**裸包名** |
| 插件自有 `node_modules` 里依赖 harness 子包 → peer 漂移，**加载即崩** | 我们只依赖 `dsh-settings` + `schemastery`，且 `link:` 不装依赖的说法要留意 |

---

## 8. 升级 DSH 时的动作清单（照做，别跳）

1. **备份** `~/.dsh/profiles/web` 与 `~/.dsh/settings.yaml`
2. **记基线**：当前 `capability.missing` 有哪些条目
3. `dsh --profile web --dump-config` → 插件条目还在吗、有没有报错
4. `.\verify-isolated.ps1 -Plugins visual,voice -Yes -Port 3183` → **必须 PASS**
5. **真机重启 + 肉眼看**：浮层在不在、设置页 Fairy 在不在、**点新建会话能不能开出来**
6. 有异常 → **先回滚 DSH 版本**，再回到本文逐条比对（别在坏环境上继续改代码）
