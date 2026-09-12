# 人设预设已移到插件包内

Fairy 人设预设现在随插件包分发，位置：

    fairy-visual/dsh-fairy-visual/.agent-presets/fairy/

原因：包内路径才能让「设置 → Fairy → Fairy 人设预设」开关在
git / tarball / npm 安装的场景下也找得到源文件（宿主按插件包根目录定位）。

安装方式（二选一）：
  * 双击 install.cmd，在第 3 步按提示选择是否现在装好人设预设
  * 或启动 DSH 后，到 设置 → Fairy → 打开「Fairy 人设预设」开关
    之后在界面的预设选择器里选 Fairy，即可让某个会话使用该人设。