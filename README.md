---
audience: shared
status: current
---

[中文](README.md) | [English](README.en.md)

# DSH 只读工作台（dsh-workbench-panel）

在 DSH Web 侧栏查看工作区/会话、仓库文件树与 blob、Markdown 文档索引，并提供显式会话归档；除此之外不写任何数据。

> 与 `lee259/dsh-workbench` 无关：npm 上的 `dsh-workbench` 属于另一个项目；本插件包名是 `dsh-workbench-panel`，代码与配置独立，不是它的分支或升级。
>
> 与旧仓 `person-clouds/dsh-workbench` 的区别：本插件不做 SA 工单、不做 SA 控制、不注入 `systemPrompt`、不监听 `session/event`、不改会话标题；TODO 标题与 `/ok` 已迁到 `dsh-workflow-shortcuts` 0.3.0。

## 面板结构

侧栏图标（id `dsh-workbench-panel`，中文名「DSH 工作台」）→ `main` 槽位：

```text
[工作区] [文档] [代码]
```

| 页签 | 内容 |
|---|---|
| 工作区 | 读取 `ctx.workspaceRegistry` 的工作区与会话；会话默认只看**未归档**，可切换未归档/已归档/全部；卡片分页，归档是唯一写操作 |
| 文档 | 先读 `docRepos` 选择仓库，再按需加载该仓 Markdown 索引；目录默认收起、逐层展开，点击文档用 blob 视图读正文 |
| 代码 | 插件 `repos` 配置 + `workspaceRegistry` 自动识别的仓库；文件树逐层加载、blob 只读查看；支持 `git` / `worktree` 两种模式 |

## 数据来源

| 数据 | 来源 | 说明 |
|---|---|---|
| 工作区、会话归属 | `ctx.workspaceRegistry` | 与 DSH Web UI 同一份事实；未分组由 Host 端计算 |
| 会话标题 | DSH 投影缓存 + `ctx.sessionQuery` + 永久标题缓存 | 只补当前页缺标题的会话，缓存写到 `<dshHome>/state/workbench/session-titles.json` |
| 文档索引 | `docRepos`（由 `repos` + 工作区得出） | 只读 Markdown 文件，按仓库分组返回 |
| 仓库与代码 | 插件 `repos` + `workspaceRegistry` 工作区 | 按真实路径去重；`mode=git` 读 git 对象，`mode=worktree` 读工作区文件 |
| 显式归档 | `workspaceRegistry.archiveSession()` | 只在用户点归档时调用；不删除会话日志或目录 |

不读 SA 数据库（`orchestrator.sqlite`），没有 SA 工单/控制视图，没有后台 fetch 或清理循环。

## Host 接口

- `GET /dsh-workbench-panel/api?view=...`，`view` 取值：`workspaces`、`sessions`、`docRepos`、`docs`、`repos`、`repoSessions`、`tree`、`blob`；
- 列表统一用 `offset`/`limit`（上限 50）并返回 `total`/`hasMore`；会话默认 `archived=active`；
- `tree`/`blob` 用 `repo=<id>&path=`；`docs` 可用 `repo=<id>` 只看一个仓库；
- 唯一写操作：`POST /dsh-workbench-panel/api/archive`，body `{ "sessionId": "..." }`，重复归档幂等；
- 进程内快照缓存 `cacheSeconds`（默认 10 秒），不落盘；
- 登录态与来源校验沿用 DSH Connection：未登录 401，不受信来源 403。

## 安装

```bash
# 本机开发：web profile 安装 link（等价于在该 profile 内执行 pnpm add link:...）
dsh plugin --profile web add link:/home/zh/www/dsh-workbench-panel
```

发布后的 npm 包：

```bash
dsh plugin --profile web add dsh-workbench-panel
```

安装后重启 `dsh web`，侧栏出现「DSH 工作台」。卸载用插件管理器移除 `dsh-workbench-panel`，不删除本目录。

## 配置

在 DSH 设置 → 插件 → DSH 工作台里改，或写进 profile 的 `cordis.patch.yml`：

```yaml
- id: dsh-workbench-panel
  name: dsh-workbench-panel
  config:
    dshHome: /home/zh/.dsh        # 默认 $DSH_HOME 或 ~/.dsh
    cacheSeconds: 10              # 进程内快照缓存秒数
    repos: []                     # 留空时只用 workspaceRegistry 自动识别的仓库
    # repos:
    #   - id: doc
    #     name: 文档仓
    #     path: /home/zh/www/doc
    #     mode: git               # git | worktree
    #     ref: origin/main         # git 模式读取的引用
    #     description: 工作区文档
    #     remote: https://github.com/person-clouds/doc.git
    #     exclude: [archive]       # 相对路径前缀，命中的目录/文件不展示
```

`repos` 每项必有 `id`、`path`，其余可选。仓库列表还会自动包含 `workspaceRegistry` 里的工作区路径，同一真实路径只出现一次。

## 验证

```bash
node --check index.js
node --check client.js
node -e "new (require('vm').Script)(require('fs').readFileSync('client.js','utf8'))"
npm test
npm_config_cache=/tmp/npm-cache npm pack --dry-run
```

`npm pack --dry-run` 应包含 `index.js`、`client.js`、`lib/`、`locale/`、`icon.svg`、`icon.png`、`cordis.patch.yml`、README 与 LICENSE，不含 `test/` 与市场草稿。

## 安全边界

- 只注册 `/dsh-workbench-panel/api`；唯一写操作是显式归档会话；
- 不写用户仓库文件，不执行 git 写命令；代码浏览屏蔽 `.env*`、`.git`、凭据目录、`*.pem`/`*.key`/`*.sqlite`/`*.db` 等；
- 不读凭据；所有内容以 React 元素渲染，不使用 `innerHTML`。

## 发布

npm 发布、GitHub Release 与 DSH 插件市场 PR 流程见 [`PUBLISHING.md`](/home/zh/www/dsh-workbench-panel/PUBLISHING.md)；市场条目见 [`market/person-clouds__dsh-workbench-panel.yml`](/home/zh/www/dsh-workbench-panel/market/person-clouds__dsh-workbench-panel.yml)。
