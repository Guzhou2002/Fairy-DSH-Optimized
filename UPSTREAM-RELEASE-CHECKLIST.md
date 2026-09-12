# GitHub 发布前检查

这份目录是 Fairy DSH 的公开候选版，不包含生产会话、密钥、缓存、完整
世界观资料或本地 TTS 运行环境。

发布前必须逐项确认：

- 已完成 Fairy 语料、游戏文本和第三方代码的授权审查；
- 已确认原创代码、脚本、测试、配置和文档按 Apache-2.0 发布，并保留
  `LICENSE`、`NOTICE`；第三方内容仍按其原始许可证处理；
- `git clone` 到全新临时目录后，`DSH_HOME` 指向独立测试目录；
- `DSH_HOME="$PWD/.dsh-test-home" ./scripts/test-isolated.sh` 全部通过；
- 不上传 `node_modules`、`.dsh-test-home`、会话、日志、凭据和世界观私有库；
- 已检查所有发布文件中不存在维护者本机绝对路径；
- GitHub Actions 的 Node/pnpm 测试通过；
- 公开 README 已说明 DSH CLI、模型密钥和可选私有资料的配置方式。
