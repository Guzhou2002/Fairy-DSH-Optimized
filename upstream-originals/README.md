# 上游原件清单（upstream-originals）
本目录存放**未经任何本地修改**的上游文件，永不覆盖，供回滚与审计使用。

| 文件 | 来源 | 字节 | SHA256 |
| --- | --- | --- | --- |
| fairy-voice-client.js | fairy-voice/dsh-fairy-voice/lib/client.js @ upstream d639887 | 83929 | 9A773BB23B46C37E1ADC6C46939DA5B968415D629137B8BBE015301D4E284ED9 |

上游此文件把朗读引擎硬编码为 'fairy'（本机 GPT-SoVITS）。
本地实验性改动把它切到 'system'（浏览器内置语音），见 patches/。
要回到上游行为：  .\switch-voice-engine.ps1 -Engine fairy
