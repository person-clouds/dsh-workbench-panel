---
audience: ai
status: current
---

# AGENTS.md

> 本仓是独立的 DSH Web 插件仓库「DSH 只读工作台」。跨仓规则仍以 [`/home/zh/www/AGENTS.md`](/home/zh/www/AGENTS.md) 为准；本文件只补充本仓规则。

## 0. 阅读顺序

1. 本文件；
2. [`SPEC.md`](/home/zh/www/dsh-workbench-panel/SPEC.md)：目标、范围、接口、非目标与验收；
3. [`README.md`](/home/zh/www/dsh-workbench-panel/README.md)：三页签、数据来源、安装、配置与安全边界；
4. [`STATUS.md`](/home/zh/www/dsh-workbench-panel/STATUS.md)：版本状态与待办；
5. 跨仓计划：[`PLAN-dsh-workbench-panel.md`](/home/zh/www/doc/plans/PLAN-dsh-workbench-panel.md)。

## 1. 硬约束

- 中文；代码/命令/日志可保留英文。最小变更，只改被要求的内容。
- **只读优先**：唯一写操作是 `POST /dsh-workbench-panel/api/archive` 的显式会话归档；不写用户仓库文件，不执行 git 写命令，不做批量归档。
- 不读写 SA 数据库，不实现 SA 工单/控制/代理，不注入 `systemPrompt`，不监听 `session/event`，不改会话标题；TODO 标题与 `/ok` 不在本包。
- 不读凭据与 `.env`；浏览代码时屏蔽 `.git`、凭据目录、`*.pem`/`*.key`/`*.sqlite`/`*.db` 等。
- 所有内容以 React 元素渲染，禁止 `innerHTML`；不新开端口、不启动第二个 DSH Host。
- 只注册 `/dsh-workbench-panel/api` 前缀；鉴权与来源校验沿用 DSH Connection。
- 提交信息用 `type(scope): 摘要`；每个提交只含本任务文件，不混合其他仓库。

## 2. 改代码后必须验证

```bash
cd /home/zh/www/dsh-workbench-panel
node --check index.js
node --check client.js
node -e "new (require('vm').Script)(require('fs').readFileSync('client.js','utf8'))"
npm test
npm_config_cache=/tmp/npm-cache npm pack --dry-run
```

本机联调：`dsh plugin --profile web add link:/home/zh/www/dsh-workbench-panel`，重启 `dsh web` 后验证侧栏「DSH 工作台」三页签、文档/代码读取与归档；调试验证结束后清理测试进程与端口。

## 3. 文档与提交门禁

- 本仓 Markdown 的断链、行数由工作区中央 `scripts/docs-policy.json` 约束。
- 提交前在 `/home/zh/www` 执行 `./scripts/check.sh --repo dsh-workbench-panel`，失败不得提交。
- 文档链接用本机全路径格式：[`SPEC.md`](/home/zh/www/dsh-workbench-panel/SPEC.md)。
- 改行为、安装方式、配置项或数据来源后，同步 `README.md`、`README.en.md`、`SPEC.md`、`STATUS.md`。

## 4. 发布

构建、npm 发布、GitHub Release 与 DSH 插件市场 PR 流程见 [`PUBLISHING.md`](/home/zh/www/dsh-workbench-panel/PUBLISHING.md)。市场条目只提交 `market/person-clouds__dsh-workbench-panel.yml`，不要改市场仓其他文件。
