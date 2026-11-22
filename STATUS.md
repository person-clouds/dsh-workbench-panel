# STATUS — dsh-workbench-panel

- 更新时间：2026-11-22
- 版本：`0.1.1`（npm `0.1.1` 发布后 `latest` 可查；GitHub Release 未建，市场条目不写 `tarball`）
- 一句话：DSH 只读工作台，三页签查看工作区/会话、Markdown 文档与仓库代码，仅支持显式归档会话。
- 位置：`/home/zh/www/dsh-workbench-panel`；包名 `dsh-workbench-panel`；公开仓 <https://github.com/person-clouds/dsh-workbench-panel>。
- 计划：[`PLAN-dsh-workbench-panel.md`](/home/zh/www/doc/plans/PLAN-dsh-workbench-panel.md)、[`SPEC.md`](/home/zh/www/dsh-workbench-panel/SPEC.md)

## 0.1.x 能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 工作区页 | 已实现 | `workspaceRegistry` 工作区 + 会话分页；未归档/已归档/全部过滤；未分组桶 |
| 文档页 | 已实现 | `docRepos` 选择仓库，Markdown 索引按需加载，目录逐层展开，blob 读正文 |
| 代码页 | 已实现 | 插件 `repos` + `workspaceRegistry` 仓库；文件树、blob；`git` / `worktree` 模式 |
| 显式归档 | 已实现 | `POST /dsh-workbench-panel/api/archive`；调 `archiveSession(..., { stopActivity: true })`，幂等 |
| Host 只读接口 | 已实现 | `view=workspaces\|sessions\|docRepos\|docs\|repos\|repoSessions\|tree\|blob` |
| 进程内缓存 | 已实现 | `cacheSeconds` 默认 10 秒，不落盘（标题缓存除外） |
| 去 SA 化 | 已实现 | 无 SA 数据库、工单/控制视图、SA 代理、后台 fetch/清理循环 |

`repos` 配置项：`id`、`name`、`path`、`mode=git|worktree`、`ref`、`description`、`remote`、`exclude`；`dshHome` 默认 `$DSH_HOME` 或 `~/.dsh`。

## 未做 / 不在本包

| 项 | 说明 |
|---|---|
| SA 工单、SA 控制、保留期清理 | 不在本包；旧仓 `dsh-workbench` 原样存档 |
| TODO 标题、`/ok` | 已迁到 `dsh-workflow-shortcuts` 0.3.0 |
| 后台 fetch / 自动清理 | 明确不做，无定时循环 |
| 旧仓配置自动迁移 | 不做；新包新 id，重新配置 |
| 市场 PR | 条目与 PR 草稿已备（`market/`），待建仓满 24 小时；流程见 `PUBLISHING.md` |

## 验收

```bash
node --check index.js
node --check client.js
node -e "new (require('vm').Script)(require('fs').readFileSync('client.js','utf8'))"
npm test
npm_config_cache=/tmp/npm-cache npm pack --dry-run
cd /home/zh/www && ./scripts/check.sh --repo dsh-workbench-panel
```

待完成（需用户环境）：

- [ ] web profile 安装 link 并重启 `dsh web`，实测三页签与归档；
- [x] npm 发布 `0.1.0`（2026-11-22，`npm view dsh-workbench-panel version` = `0.1.0`）；安装命令 `dsh plugin --profile web add dsh-workbench-panel`；
- [ ] 建仓满 24 小时后按 `PUBLISHING.md` 提交市场 PR。
