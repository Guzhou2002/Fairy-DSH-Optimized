# 人设预设的存放与安装

Fairy 的人设预设**随插件包分发**，实际文件在这里：

```
fairy-visual/dsh-fairy-visual/.agent-presets/fairy/
```

本目录只放这份说明，**不存放预设文件本身**。

---

## 为什么放在插件包里

DSH 是按**插件包根目录**定位预设源文件的。只有放在包内，
`git clone` / tarball / npm 三种安装方式才都能找到它。

上游原本放在仓库根的 `.agent-presets/` —— 那样只装单个插件包时，预设就丢了。

---

## 它是怎么被装上的

预设**不会自动生效**，要复制一份到 DSH 的家目录：

```
插件包内    fairy-visual/dsh-fairy-visual/.agent-presets/fairy/
      ↓  复制
DSH 从这里读  %DSH_HOME%\.agent-presets\fairy\      （默认 %USERPROFILE%\.dsh）
```

**双击 `install.cmd` 就会自动完成这一步**（里面的第 ③ 步）。

装完之后，到 **设置 → Fairy → 打开「Fairy 人设预设」开关**，
再在界面的预设选择器里选 `Fairy`，某个会话就会使用这个人设。

---

## 手动装（等价做法）

没走 `install.cmd` 的话，自己复制也行。**请用 `robocopy`**：

```powershell
robocopy `
  "$env:USERPROFILE\.dsh\profiles\web\node_modules\dsh-fairy-visual\.agent-presets\fairy" `
  "$env:USERPROFILE\.dsh\.agent-presets\fairy" `
  /E
```

> ⚠️ **别用 PowerShell 的 `Copy-Item -Recurse`。**
> 目标目录**已存在**时，它会往里面**再套一层**（变成 `fairy\fairy\`）。
> 历史上就是这么套出一坨重复目录的 —— 内容没丢，但白占地方。
> `robocopy /E` 是**合并**语义，没有这个问题。

> 💡 用了自定义 `DSH_HOME` 的话，把上面两个路径里的 `.dsh` 换成你的实际家目录。
