---
audience: shared
status: current
---

[中文](README.md) | [English](README.en.md)

# DSH 可看可改工作台（dsh-workbench-panel）

DSH Web 可看可改工作台：一个侧栏面板查看工作区、仓库文件树与 blob、Markdown 文档索引，支持仓库内搜索、只读高亮与单文件编辑，并显式归档会话。面板本身不展示会话。

## 先说最要紧的

- 写受开关约束：代码页可保存单个文本文件（`writeEnabled` 默认 `true`，置 `false` 即回到只读档）；不新建/改名/删除文件、不做 git 提交、不写仓库外路径。
- 高亮不加重型 IDE：复用 DSH 前端自带的 shiki 与主题令牌（启动预载全部 59 个语法块，约 2 秒 / 280KB，覆盖 21 种语言），编辑用原生 `<textarea>` 叠只读高亮层，零新依赖；某语法块加载失败只让该语言回退纯文本。
- 三页签：工作区看工作区卡片，文档看 Markdown 索引与正文，代码看文件树（每层全部展开）与 blob。
- 不配置也能用：`repos` 留空时只展示 `workspaceRegistry` 自动识别的工作区与仓库。
- 与 npm 上的 `dsh-workbench`（`lee259/dsh-workbench`）是两个项目；本包不做 SA 工单/控制、不注入提示词、不监听 `session/event`、不改会话标题。
- 前提：DSH Web，Node ≥22.5（`engines`）。

## 最短上手

```bash
dsh plugin --profile web add dsh-workbench-panel
```

重启 `dsh web` 后，侧栏出现「DSH 工作台」（图标 id `dsh-workbench-panel`），点开即是三个页签：

```text
[工作区] [文档] [代码]
```

卸载用插件管理器移除 `dsh-workbench-panel`，不删除本目录。开发时的 link 安装与发布流程见 [`PUBLISHING.md`](/home/zh/www/dsh-workbench-panel/PUBLISHING.md)。

## 功能

1. **工作区页**：只读取 `ctx.workspaceRegistry` 的工作区（标题、路径、创建时间、git 标记）；不展示会话、不提供未归档/已归档过滤与未分组桶。
2. **文档页**：先从 `docRepos` 选仓库，再按需加载该仓 Markdown 索引；目录默认收起、逐层展开，点文档用 blob 视图读正文；顶部 `编辑源文` 切到叠层编辑器改 Markdown 正文（`保存` 走两步确认 + `mtimeMs` 乐观锁），`预览` 切回渲染。
3. **代码页**：插件 `repos` 配置 + `workspaceRegistry` 自动识别的仓库；文件树逐层加载且**每层全部展示（不分页）**、blob 只读查看，支持 `git` 与 `worktree` 两种模式。
4. **显式归档**：`POST /api/archive` 调用 `workspaceRegistry.archiveSession()`，幂等；不删除会话日志或目录（面板不再有会话卡片，归档接口保留给脚本与外部调用）。
5. **只读接口**：`GET /dsh-workbench-panel/api?view=...` 提供 `workspaces`、`docRepos`、`docs`、`repos`、`tree`、`blob`（`sessions`/`repoSessions` 已下线）；工作区与仓库列表用 `offset`/`limit`（上限 50）并返回 `total`/`hasMore`，`tree` 不分页、一次返回该层全部子项。
6. **写接口**：`POST /dsh-workbench-panel/api/archive`（会话归档）、`/api/write`（`{ repo, path, text, expectMtimeMs }` 覆盖单个工作区文本文件，`mtimeMs` 过期返回 409）、`/api/revert`（`{ repo, path }` 用 `git checkout --` 恢复单文件）；登录态与来源校验沿用 DSH Connection（未登录 401，不受信来源 403），`writeEnabled=false` 时写与撤销都 403。
7. **缓存**：进程内快照缓存 `cacheSeconds`（默认 10 秒），不落盘；会话标题为当前页缺失项补全后写入 `<dshHome>/state/workbench/session-titles.json`。

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

## 边界与限制

- 只注册 `/dsh-workbench-panel/api`；写操作只有三类：会话归档、单文件覆盖、单文件 git 恢复。
- 只写 `worktree` 模式的仓库、只写已存在或父目录已存在的文本文件；`mode=git` 仓库、超过 2MB、二进制、`..`/绝对路径一律拒绝。
- 代码浏览与搜索屏蔽 `.env*`、`.git`、凭据目录、`*.pem`/`*.key`/`*.sqlite`/`*.db` 等。
- 本版不做：补全/LSP/符号跳转、新建（顶层）/改名/删除文件、终端、跨仓库同时多开、列选/多光标。
- 不读凭据；所有内容以 React 元素渲染，不使用 `innerHTML`。
- 不读 SA 数据库，没有 SA 工单/控制视图，没有后台 fetch 或清理循环。
- 面板依赖 DSH Web 的 `webServer`、`workspaceRegistry`、`sessionQuery` 等服务；DSH 升级后接口变化需要同步适配。

## 去哪看

- 状态、能力清单与验收命令：[STATUS.md](/home/zh/www/dsh-workbench-panel/STATUS.md)
- 方向与选型记录：[PLAN-dsh-workbench-panel-ide.md](/home/zh/www/personalCloud/plans/doc/PLAN-dsh-workbench-panel-ide.md)
- 发布、Release 与市场 PR：[PUBLISHING.md](/home/zh/www/dsh-workbench-panel/PUBLISHING.md)
- 市场条目：[market/person-clouds__dsh-workbench-panel.yml](/home/zh/www/dsh-workbench-panel/market/person-clouds__dsh-workbench-panel.yml)
- 许可证：[MIT](LICENSE)
