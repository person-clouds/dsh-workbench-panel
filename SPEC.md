---
audience: shared
status: current
---

# SPEC：dsh-workbench-panel

## 目标

把 DSH 的工作区/会话、仓库文件树与 blob、Markdown 文档索引收进同一个 Web 侧栏面板，并提供显式会话归档；除归档外完全只读。不新开端口、不启动第二个 DSH Host。

## 用户

- 在 DSH Web 里浏览工作区、会话与仓库内容的个人开发者；
- 需要从侧栏快速查文档、看代码、清理已结束会话，但不需要 SA 工单与运行控制的用户。

## 范围

- Host 端：注册 `/dsh-workbench-panel/api`，读取 `ctx.workspaceRegistry`、`ctx.sessionQuery`、git 对象与工作区文件；只在显式归档时写一次 `workspaceRegistry`。
- Client 端：侧栏图标 `dsh-workbench-panel`（中文名「DSH 工作台」）→ `main` 槽位，三个页签：工作区 / 文档 / 代码。
- 列表统一 `offset`/`limit` 服务端分页，返回 `total`/`hasMore`；会话默认只返回未归档。
- 进程内快照缓存 `cacheSeconds`，不写缓存文件（会话标题缓存除外）。

## 非目标

- 不做 SA 工单、SA 控制、SA API 代理，不读写 `orchestrator.sqlite`；
- 不注入 `systemPrompt`、不监听 `session/event`、不改会话标题；
- 不承接 TODO 标题与 `/ok`（属于 `dsh-workflow-shortcuts` 0.3.0）；
- 不做后台 `git fetch`、保留期清理或任何定时循环；
- 不写用户仓库文件，不读取凭据与 `.env`，不渲染 `innerHTML`，不新增对外端口；
- 不迁移旧仓 `dsh-workbench` 的配置（新包新 id）。

## 接口

- Host bundle：`package.json.dsh.bundle.patch` → `cordis.patch.yml` 插入 `id: dsh-workbench-panel`；
- Client bundle：`dsh.client`（`platform: web`，`immediately: true`），`inject` 只含 `locale`；
- HTTP：`GET /dsh-workbench-panel/api?view=...`

| view | 关键参数 | 返回 |
|---|---|---|
| `workspaces` | `offset`、`limit`、`sessionLimit`、`archived` | 工作区卡片与每卡当前页会话、`total`/`hasMore` |
| `sessions` | `workspace=<id\|ungrouped>`、`offset`、`limit`、`archived` | 该工作区会话页 |
| `docRepos` | `offset`、`limit`、`sort`、`dir` | 文档页可选仓库页 |
| `docs` | `repo=<id>`（可选） | 按仓库分组的 Markdown 索引（`path`、`title`） |
| `repos` | `offset`、`limit`、`sort`、`dir` | 代码页仓库页，默认按更新时间倒序 |
| `repoSessions` | `repo=<id>`、`offset`、`limit`、`archived` | 该仓库关联会话页 |
| `tree` | `repo=<id>`、`path`、`offset`、`limit` | 单层目录项、`total`/`hasMore` |
| `blob` | `repo=<id>`、`path` | 文件内容；超大/二进制返回提示而非内联 |

- 唯一写操作：`POST /dsh-workbench-panel/api/archive`，body `{ "sessionId": "..." }`；已归档时幂等返回 `{ ok: true, archived: true }`。
- 鉴权：沿用 DSH Connection 的 `requestRejection`，未登录 401、来源不可信 403；未知 `view`、找不到仓库/工作区返回 4xx 或带 `error` 的 JSON。
- 缓存键由 `view` 与查询参数组成，`cacheSeconds` 内复用同一结果。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `dshHome` | `$DSH_HOME` 或 `~/.dsh` | DSH 主目录；标题缓存位于其下 `state/workbench/` |
| `cacheSeconds` | `10` | 进程内快照缓存秒数，`0` 表示不缓存 |
| `repos` | `[]` | 插件级仓库清单；留空时只用 `workspaceRegistry` 自动识别的仓库 |

`repos` 每项：

| 字段 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `id` | 是 | — | 仓库标识，页面内唯一 |
| `path` | 是 | — | 本地绝对路径 |
| `name` | 否 | `""` | 展示名，空时回退目录名 |
| `mode` | 否 | `worktree` | `git` 读 git 对象；`worktree` 读工作区文件 |
| `ref` | 否 | `""` | `git` 模式读取的引用，空时用仓库默认分支 |
| `description` | 否 | `""` | 卡片说明 |
| `remote` | 否 | `""` | 远程地址，仅展示 |
| `exclude` | 否 | `[]` | 相对路径前缀，命中的目录/文件不展示 |

## 数据来源与只读边界

- 工作区、会话：`ctx.workspaceRegistry`；会话标题来自 DSH 投影缓存、`ctx.sessionQuery` 与永久标题缓存，缓存文件原子写、失败只告警。
- 文档、代码：`docRepos`/`repos` 合并结果；按真实路径去重，来源只有「插件配置」与「workspaceRegistry 工作区」。
- 归档：唯一写路径 `workspaceRegistry.archiveSession(sessionId, { stopActivity: true })`，不删除日志与目录，不提供批量归档。
- 禁止：读取 `orchestrator.sqlite`、读取凭据/`.env`、执行 git 写命令、`innerHTML`、公网端口。

## 运行方式

```bash
# 本机开发（web profile link）
dsh plugin --profile web add link:/home/zh/www/dsh-workbench-panel
# 重启 dsh web 后，侧栏出现「DSH 工作台」
```

## 验收命令

```bash
node --check index.js
node --check client.js
node -e "new (require('vm').Script)(require('fs').readFileSync('client.js','utf8'))"
npm test
npm_config_cache=/tmp/npm-cache npm pack --dry-run
```

浏览器验收：三页签可切换；工作区会话可按未归档/已归档/全部过滤；文档索引与正文可读；代码树与 blob 可读；归档后列表状态更新；无 console error。

## 约束

- 中文文档与注释；英文版同步维护 [`README.en.md`](/home/zh/www/dsh-workbench-panel/README.en.md)。
- 提交信息用 `type(scope): 摘要`；改动同步 [`README.md`](/home/zh/www/dsh-workbench-panel/README.md)、[`STATUS.md`](/home/zh/www/dsh-workbench-panel/STATUS.md) 与相关计划。
- 发布与市场流程见 [`PUBLISHING.md`](/home/zh/www/dsh-workbench-panel/PUBLISHING.md)。
