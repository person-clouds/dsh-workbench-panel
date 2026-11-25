# STATUS — dsh-workbench-panel

- 更新时间：2026-11-25
- 版本：`0.2.0`（本地开发中，按 `PLAN-dsh-workbench-panel-ide.md` 实施；npm `latest` 仍是只读的 `0.1.1`，发版由用户确认后执行）
- 一句话：DSH 可看可改工作台，三页签查看工作区/会话、Markdown 文档与仓库代码，支持仓库内搜索、只读高亮、单文件编辑（`writeEnabled`）与显式归档会话。
- 位置：`/home/zh/www/dsh-workbench-panel`；包名 `dsh-workbench-panel`；公开仓 <https://github.com/person-clouds/dsh-workbench-panel>。
- 计划：[`PLAN-dsh-workbench-panel-ide.md`](/home/zh/www/doc/plans/PLAN-dsh-workbench-panel-ide.md)、[`PLAN-dsh-workbench-panel.md`](/home/zh/www/doc/plans/PLAN-dsh-workbench-panel.md)、[`SPEC.md`](/home/zh/www/dsh-workbench-panel/SPEC.md)

## 0.2.0 能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 工作区页 | 已实现 | `workspaceRegistry` 工作区 + 会话分页；未归档/已归档/全部过滤；未分组桶 |
| 文档页 | 已实现 | `docRepos` 选择仓库，Markdown 索引按需加载，目录逐层展开，blob 读正文 |
| 代码页 | 已实现 | 插件 `repos` + `workspaceRegistry` 仓库；文件树、blob；`git` / `worktree` 模式 |
| 显式归档 | 已实现 | `POST /dsh-workbench-panel/api/archive`；调 `archiveSession(..., { stopActivity: true })`，幂等 |
| 搜索 / 高亮 | 实施中 | `view=search` 文件名/内容检索；`blob.tokens` 复用 DSH shiki 与主题令牌 |
| 单文件编辑 | 实施中 | `POST /api/write`（`mtimeMs` 乐观锁、原子替换）与 `/api/revert`（`git checkout --`）；`writeEnabled` 默认 `true` |
| 文件切换 | 实施中 | `☰ 文件` 浮动面板（悬停/钉住、`Alt+1`）+ 打开标签条（≤8，保留草稿与光标） |
| Host 读接口 | 已实现 | `view=workspaces\|sessions\|docRepos\|docs\|repos\|repoSessions\|tree\|blob\|search` |
| 进程内缓存 | 已实现 | `cacheSeconds` 默认 10 秒，不落盘（标题缓存除外） |
| 去 SA 化 | 已实现 | 无 SA 数据库、工单/控制视图、SA 代理、后台 fetch/清理循环 |

`repos` 配置项：`id`、`name`、`path`、`mode=git|worktree`、`ref`、`description`、`remote`、`exclude`；`writeEnabled` 默认 `true`（`false` 即只读档）；`dshHome` 默认 `$DSH_HOME` 或 `~/.dsh`。

## 未做 / 不在本包

| 项 | 说明 |
|---|---|
| SA 工单、SA 控制、保留期清理 | 不在本包；旧仓 `dsh-workbench` 原样存档 |
| TODO 标题、`/ok` | 已迁到 `dsh-workflow-shortcuts` 0.3.0 |
| 后台 fetch / 自动清理 | 明确不做，无定时循环 |
| 旧仓配置自动迁移 | 不做；新包新 id，重新配置 |
| 市场 PR | 已提交 [awesome-dsh-plugin#18074](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/18074)（单文件 `data/plugins/person-clouds__dsh-workbench-panel.yml`，2026-11-23）；合并交由市场维护者 |

## 验收

```bash
npm run build:client
node --check index.js
node --check client.js
node -e "new (require('vm').Script)(require('fs').readFileSync('client.js','utf8'))"
npm test
npm_config_cache=/tmp/npm-cache npm pack --dry-run
cd /home/zh/www && ./scripts/check.sh --repo dsh-workbench-panel
```

待完成（需用户环境）：

- [ ] web profile 安装 link 并重启 `dsh web`，实测三页签、搜索、高亮、编辑保存/撤销与 `☰ 文件` 面板；
- [ ] 本机灰度观察 1 天后，按 [`PUBLISHING.md`](/home/zh/www/dsh-workbench-panel/PUBLISHING.md) 发布 `0.2.0`（npm / GitHub Release / 市场条目同批）；
- [x] npm 发布 `0.1.0`、`0.1.1`（2026-11-22，`npm view dsh-workbench-panel version` = `0.1.1`）；安装命令 `dsh plugin --profile web add dsh-workbench-panel`；
- [x] 建仓满 24 小时后按 `PUBLISHING.md` 提交市场 PR：<https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/18074>（2026-11-23，单文件 diff）。
