---
audience: shared
status: current
---

# SPEC：dsh-workbench-panel

## 目标

把 DSH 的工作区、仓库文件树与 blob、Markdown 文档索引收进同一个 Web 侧栏面板，并提供仓库内搜索、只读高亮与**受开关约束的单文件编辑**，以及显式会话归档。不新开端口、不启动第二个 DSH Host。

## 用户

- 在 DSH Web 里浏览工作区与仓库内容的个人开发者；
- 需要从侧栏快速查文档、看代码，但不需要 SA 工单与运行控制的用户。

## 范围

- Host 端：注册 `/dsh-workbench-panel/api`，读取 `ctx.workspaceRegistry`、git 对象与工作区文件（面板视图不读 `ctx.sessionQuery`）；写操作只有三类：显式归档会话、`POST /api/write` 覆盖单个工作区文本文件、`POST /api/revert` 用 git 恢复单文件（后两者受 `writeEnabled` 约束）。
- Client 端：侧栏图标 `dsh-workbench-panel`（中文名「DSH 工作台」）→ `main` 槽位，三个页签：工作区 / 文档 / 代码。
- 面板不展示会话：工作区页只列工作区卡片；`sessions`/`repoSessions` 视图已下线，`/api/archive` 保留给脚本与外部调用。
- 仓库列表与文档仓库列表用 `offset`/`limit` 服务端分页并返回 `total`/`hasMore`；**文件树 `tree` 不分页，每层一次返回全部子项**。
- 进程内快照缓存 `cacheSeconds`，不写缓存文件。

## 非目标

- 不做 SA 工单、SA 控制、SA API 代理，不读写 `orchestrator.sqlite`；
- 不注入 `systemPrompt`、不监听 `session/event`、不改会话标题；
- 不承接 TODO 标题与 `/ok`（属于 `dsh-workflow-shortcuts` 0.3.0）；
- 不做后台 `git fetch`、保留期清理或任何定时循环；
- 不做补全/LSP/符号跳转、不做新建/改名/删除/重命名文件、不做 git 暂存与提交、不提供终端、不支持跨仓库同时多开；
- 不写仓库外路径、不写 `mode=git` 仓库、不编辑超过 2MB 或二进制文件、不读取凭据与 `.env`、不渲染 `innerHTML`、不新增对外端口；
- 不迁移旧仓 `dsh-workbench` 的配置（新包新 id）。

## 接口

- Host bundle：`package.json.dsh.bundle.patch` → `cordis.patch.yml` 插入 `id: dsh-workbench-panel`；
- Client bundle：`dsh.client`（`platform: web`，`immediately: true`），`inject` 只含 `locale`；
- HTTP：`GET /dsh-workbench-panel/api?view=...` 读视图；`POST /dsh-workbench-panel/api/<action>` 写动作（`archive`/`write`/`revert`）

| view | 关键参数 | 返回 |
|---|---|---|
| `workspaces` | `offset`、`limit`、`sort`、`dir` | 工作区卡片（标题、路径、创建时间、git 标记），`total`/`hasMore` |
| `docRepos` | `offset`、`limit`、`sort`、`dir` | 文档页可选仓库页 |
| `docs` | `repo=<id>`（可选） | 按仓库分组的 Markdown 索引（`path`、`title`） |
| `repos` | `offset`、`limit`、`sort`、`dir` | 代码页仓库页，默认按更新时间倒序 |
| `tree` | `repo=<id>`、`path` | 该层全部目录项（目录在前）与 `total`；不接受 `offset`/`limit`，无 `hasMore` |
| `blob` | `repo=<id>`、`path` | 文件内容；超大/二进制返回提示而非内联；附 `mtimeMs`、`editable`、`tokens`（高亮行） |
| `search` | `repo=<id>`、`q`（2–200 字符）、`mode=name\|content\|both`、`offset`、`limit` | 文件名/内容命中 `{path, line, column, text}`，单次上限 500 条 |

- 写接口（全部 POST，JSON body）：
  - `/api/archive` `{ "sessionId": "..." }`：会话归档，已归档时幂等返回；
  - `/api/write` `{ "repo", "path", "text", "expectMtimeMs" }`：覆盖单个工作区文本文件，`mtimeMs` 不一致返回 409；
  - `/api/revert` `{ "repo", "path" }`：`git checkout -- <path>` 恢复单文件，仅 git 工作区。
  - `writeEnabled=false` 时 `/api/write` 与 `/api/revert` 一律 403，`archive` 不受影响。
- 鉴权：沿用 DSH Connection 的 `requestRejection`，未登录 401、来源不可信 403；未知 `view`、找不到仓库/工作区返回 4xx 或带 `error` 的 JSON。
- 缓存键由 `view` 与查询参数组成，`cacheSeconds` 内复用同一结果。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `dshHome` | `$DSH_HOME` 或 `~/.dsh` | DSH 主目录；标题缓存位于其下 `state/workbench/` |
| `cacheSeconds` | `10` | 进程内快照缓存秒数，`0` 表示不缓存 |
| `repos` | `[]` | 插件级仓库清单；留空时只用 `workspaceRegistry` 自动识别的仓库 |
| `writeEnabled` | `true` | 是否允许代码页保存/撤销工作区文件；`false` 即回到只读档 |

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

## 数据来源与写边界

- 工作区：`ctx.workspaceRegistry`（标题、路径、创建时间、`status()`、`.git` 标记）；面板视图不再读取会话目录与标题缓存。
- 文档、代码：`docRepos`/`repos` 合并结果；按真实路径去重，来源只有「插件配置」与「workspaceRegistry 工作区」。
- 归档：`workspaceRegistry.archiveSession(sessionId, { stopActivity: true })`，不删除日志与目录，不提供批量归档。
- 编辑（`lib/write.js`）：只写 `worktree` 模式仓库内的文本文件；前置校验 `cleanRel`（拒绝 `..`/绝对路径）、`isSensitive`、`exclude`、`EXCLUDED_DIRS`、无 NUL、≤2MB、`expectMtimeMs` 乐观锁；同目录临时文件 + `rename` 原子替换；成功后清 `listFiles` 缓存。撤销只对 git 工作区执行 `git checkout -- <path>`。
- 唯一允许 `writeFile`/`rename` 的文件是 `lib/write.js`；其余 Host 模块只读。
- 搜索（`lib/code.js`）：候选集只来自 `listFiles`（已排除敏感项），再用 `isSensitive` 二次过滤；优先本机 `rg`，缺失时回退逐行扫描（≤2MB、最多 2000 个文件），单次上限 500 条。
- 高亮（`lib/highlight.js`）：复用 DSH 前端自带的 shiki 资源与 `--shiki-token-*` 主题，失败只回退纯文本。
- 禁止：读取 `orchestrator.sqlite`、读取凭据/`.env`、写仓库外路径、`innerHTML`、公网端口。

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

浏览器验收：三页签可切换；工作区卡片不出现会话列表；文件树每层全部展示且无分页控件；文档索引与正文可读；代码树、搜索与高亮可读；`☰ 文件` 面板与标签条可用；编辑保存后 `git diff` 一致、撤销可恢复；归档接口幂等（`curl` 校验）；无 console error。

## 约束

- 中文文档与注释；英文版同步维护 [`README.en.md`](/home/zh/www/dsh-workbench-panel/README.en.md)。
- 提交信息用 `type(scope): 摘要`；改动同步 [`README.md`](/home/zh/www/dsh-workbench-panel/README.md)、[`STATUS.md`](/home/zh/www/dsh-workbench-panel/STATUS.md) 与相关计划。
- 发布与市场流程见 [`PUBLISHING.md`](/home/zh/www/dsh-workbench-panel/PUBLISHING.md)。
