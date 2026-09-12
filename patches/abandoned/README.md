# 已废弃的补丁：system-TTS 实验

0001~0005 属于一次**已放弃的实验**：把 dsh-fairy-voice 的朗读引擎从上游硬编码的
'fairy'（本机 GPT-SoVITS）切到 'system'（浏览器内置语音）。放弃原因：

1. 该插件的消息发现依赖官方会话投影的内部结构（node.data.blocks / finalNode /
   chat.order 等私有契约）。实测在本机 DSH 0.1.2-rc.1 上链条对不上：
   插件收到的快照里没有 chat 字段（诊断显示 chat无 / order-1 / step-1），
   于是"已收录 0 条"，回复上的朗读按钮根本不渲染 —— 与引擎无关，是投影结构漂移。
2. 改引擎还会连带牵出 Web Audio 预解锁、嗓音表异步、错误静默三类坑
   （0002/0003 就是为它们打的），维护成本明显不划算。

结论（0.2.0 起）：**只保留上游的 GPT-SoVITS 路线（engine='fairy'）**，
client.js 恢复为上游原样 + 一个设置栏合并/检测补丁，见 ../0001-fairy-settings-merge.patch。

这些文件仅作历史记录保留，不要再用它们生成 client.js。