/**
 * DSH 工作台（浏览器端）：在侧栏加一个独立面板，读 Host 的 /dsh-workbench-panel/api，
 * 展示工作区、会话、仓库文件树与 Markdown 文档索引。只读，唯一写操作是显式归档会话。
 */
// 浏览器端插件脚本由 dsh-client-modules 以**普通脚本**原样拼接执行（只注册
// window.__ModuleLoader__.load 的工厂），不得出现 import / export：顶层 import
// 会让整条 entry 在 import 阶段失败（"<id> import failed (see console)"）。
// 因此字典直接内联；改动文案时请同步 locale/zh.json、locale/en.json 与本处。
window.__ModuleLoader__.load({
  id: 'dsh-workbench-panel',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const API = '/dsh-workbench-panel/api'
    const PANEL_ID = 'dsh-workbench-panel'
    const NS = 'dshWorkbenchPanel'


    // 语言字典放在 factory 内：顶层 const 在 HMR/重复加载时会造成
    // "Identifier 'zh' has already been declared"，表现为 bundle 未注册。
    const zh = {
      "meta": {
        "title": "DSH 工作台",
        "description": "工作区、会话、仓库文件与文档索引"
      },
      "archiveConfirm": "确认归档？",
      "archiveDone": "已归档该会话。",
      "archiveFailed": "归档失败：{message}",
      "archiveSession": "归档",
      "backToDocList": "返回文档列表",
      "backToDocRepos": "返回仓库列表",
      "backToRepos": "返回仓库列表",
      "backToTree": "返回目录",
      "binaryFile": "二进制文件，不在页面内渲染。",
      "branch": "分支",
      "codeFile": "源码文件",
      "commits": "最近提交",
      "dirCount": "{n} 个目录",
      "dirty": "{n} 个未提交",
      "docFile": "Markdown 文档",
      "docsCount": "{n} 篇",
      "docsRepoCount": "{n} 个仓库",
      "docsRepoHint": "先选择仓库，再按目录层级展开文档。",
      "docsTitle": "文档",
      "docsTreeHint": "目录默认收起，点击逐层展开。",
      "emptyTree": "这个目录是空的。",
      "fileCount": "{n} 个文件",
      "fileTooLarge": "文件超过 2MB，不在页面内渲染。",
      "filterActive": "未归档",
      "filterAllSessions": "全部会话",
      "filterArchived": "已归档",
      "head": "最新提交",
      "listNext": "下一页",
      "listPrev": "上一页",
      "listRange": "显示 {from}-{to} / 共 {total} 项",
      "loadingData": "正在读取…",
      "modeGit": "git 对象（不改工作区）",
      "modeWorktree": "工作区文件",
      "navDocs": "文档",
      "navRepos": "仓库",
      "navWorkspaces": "工作区",
      "noDocs": "没有可读的 Markdown 文档。",
      "noRepos": "没有可用的仓库。",
      "noSessions": "没有会话。",
      "openRepo": "浏览仓库",
      "panel": "DSH 工作台",
      "readFailed": "读取失败：{message}",
      "refresh": "刷新",
      "repoGit": "git 仓库",
      "repoNoGit": "非 git 目录",
      "repoPath": "路径",
      "repoSessionCount": "{n} 个会话",
      "repoSessionsHint": "按会话 cwd 匹配当前仓库（含子目录）；默认只显示未归档会话。",
      "repoSessionsTitle": "仓库会话",
      "repoSourceConfigured": "DSH 配置",
      "repoSourceWorkspace": "工作区自动识别",
      "repoUnavailable": "仓库不可用：{message}",
      "reposHint": "来源为 DSH 插件配置与工作区自动识别。",
      "reposTitle": "仓库",
      "sessionArchived": "已归档",
      "sessionPinned": "已 pin",
      "sessionUntitled": "未命名会话",
      "ungroupedCount": "{n} 个未分组会话",
      "ungroupedHint": "不属于任何工作区的 DSH 会话；与工作区页使用同一套会话目录。",
      "ungroupedTitle": "未分组",
      "workspaceCount": "{n} 个工作区",
      "workspaceCreated": "创建",
      "workspaceMissing": "目录不存在",
      "workspacePath": "路径",
      "workspaceSessionCount": "{n} 个会话",
      "workspacesHint": "这些记录来自当前 DSH Host 的 workspaceRegistry，是唯一写者。",
      "workspacesTitle": "工作区"
    }

    const en = {
      "meta": {
        "title": "DSH Workbench",
        "description": "Workspaces, sessions, repository files and documentation index"
      },
      "archiveConfirm": "Confirm archive?",
      "archiveDone": "Session archived.",
      "archiveFailed": "Archive failed: {message}",
      "archiveSession": "Archive",
      "backToDocList": "Back to docs",
      "backToDocRepos": "Back to repositories",
      "backToRepos": "Back to repositories",
      "backToTree": "Back to directory",
      "binaryFile": "Binary file, not rendered inline.",
      "branch": "Branch",
      "codeFile": "Source file",
      "commits": "Recent commits",
      "dirCount": "{n} dirs",
      "dirty": "{n} uncommitted",
      "docFile": "Markdown document",
      "docsCount": "{n} docs",
      "docsRepoCount": "{n} repos",
      "docsRepoHint": "Pick a repository, then expand its docs by folder.",
      "docsTitle": "Docs",
      "docsTreeHint": "Folders are collapsed by default; expand level by level.",
      "emptyTree": "This directory is empty.",
      "fileCount": "{n} files",
      "fileTooLarge": "File is larger than 2MB and is not rendered inline.",
      "filterActive": "Unarchived",
      "filterAllSessions": "All sessions",
      "filterArchived": "Archived",
      "head": "Latest commit",
      "listNext": "Next",
      "listPrev": "Prev",
      "listRange": "Showing {from}-{to} of {total}",
      "loadingData": "Loading…",
      "modeGit": "Git objects (worktree untouched)",
      "modeWorktree": "Worktree files",
      "navDocs": "Docs",
      "navRepos": "Repos",
      "navWorkspaces": "Workspaces",
      "noDocs": "No readable Markdown documents.",
      "noRepos": "No repository available.",
      "noSessions": "No sessions.",
      "openRepo": "Browse repository",
      "panel": "DSH Workbench",
      "readFailed": "Could not load: {message}",
      "refresh": "Refresh",
      "repoGit": "git repository",
      "repoNoGit": "non-git directory",
      "repoPath": "Path",
      "repoSessionCount": "{n} sessions",
      "repoSessionsHint": "Matched by session cwd under this repository (including subdirectories); unarchived only by default.",
      "repoSessionsTitle": "Repository sessions",
      "repoSourceConfigured": "DSH config",
      "repoSourceWorkspace": "Auto-detected workspace",
      "repoUnavailable": "Repository unavailable: {message}",
      "reposHint": "Sources are DSH plugin configuration plus auto-detected workspaces.",
      "reposTitle": "Repositories",
      "sessionArchived": "archived",
      "sessionPinned": "pinned",
      "sessionUntitled": "Untitled session",
      "ungroupedCount": "{n} ungrouped sessions",
      "ungroupedHint": "DSH sessions that belong to no workspace; built from the same session catalog as the workspace cards.",
      "ungroupedTitle": "Ungrouped",
      "workspaceCount": "{n} workspaces",
      "workspaceCreated": "Created",
      "workspaceMissing": "Directory missing",
      "workspacePath": "Path",
      "workspaceSessionCount": "{n} sessions",
      "workspacesHint": "These records come from the current DSH Host workspaceRegistry, the only writer.",
      "workspacesTitle": "Workspaces"
    }

    // ---------------- 样式：只用 --dsw-alias-* 主题令牌，跟随明暗与字体 ----------------

    const CSS = `
.sawb-root { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); font-size: 13px; line-height: 1.55; }
.sawb-head { display: flex; align-items: center; gap: 10px; padding: 12px clamp(18px, 3vw, 40px); border-bottom: 1px solid var(--dsw-alias-border-l1); flex-wrap: wrap; flex: 0 0 auto; background: var(--dsw-alias-bg-base); }
.sawb-head.sawb-subhead { border-bottom: 0; padding-bottom: 2px; }
.sawb-title { margin: 0; font-size: 15px; font-weight: 600; }
.sawb-meta { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.sawb-spacer { flex: 1; }
.sawb-btn { border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); border-radius: 6px; padding: 3px 10px; font: inherit; font-size: 12px; cursor: pointer; }
.sawb-btn:hover { background: var(--dsw-alias-bg-layer-2); }
.sawb-btn[aria-pressed="true"] { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-brand-primary); }
.sawb-btn.sawb-btn-primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary-inverted); padding: 6px 14px; font-size: 13px; }
.sawb-btn.sawb-btn-primary:hover { filter: brightness(.96); }
.sawb-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.sawb-btn.sawb-btn-sm { padding: 2px 8px; }
.sawb-tabs { display: inline-flex; gap: 2px; padding: 2px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }
.sawb-tabs button { border: 0; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; padding: 3px 12px; border-radius: 6px; cursor: pointer; }
.sawb-tabs button[aria-pressed="true"] { background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.sawb-tabs button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 0; }
.sawb-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 24px clamp(18px, 3vw, 40px) 52px; overscroll-behavior: contain; scrollbar-width: thin; }
.sawb-body.sawb-body-tight { padding-top: 12px; }
.sawb-notice { border: 1px solid var(--dsw-alias-state-warn-primary); border-radius: 8px; padding: 8px 12px; margin: 0 0 12px; font-size: 12px; }
.sawb-notice.sawb-error { border-color: var(--dsw-alias-state-error-primary); }
.sawb-empty { color: var(--dsw-alias-label-secondary); padding: 24px 0; text-align: center; }
.sawb-badge { display: inline-block; padding: 0 7px; border-radius: 999px; font-size: 11px; line-height: 18px; border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.sawb-badge.live { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.sawb-badge.ok { border-color: var(--dsw-alias-state-success-primary); color: var(--dsw-alias-state-success-primary); }
.sawb-badge.muted { border-color: var(--dsw-alias-state-idle-primary); color: var(--dsw-alias-state-idle-primary); }
.sawb-mono { font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; color: var(--dsw-alias-label-secondary); }
.sawb-detail-title { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.4; }
.sawb-section { margin-bottom: 16px; }
.sawb-section h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 13px; font-weight: 600; flex-wrap: wrap; }
.sawb-panel { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); padding: 14px 18px; line-height: 1.75; }
.sawb-md p { margin: 0 0 6px; }
.sawb-md ul, .sawb-md ol { margin: 0 0 6px; padding-left: 20px; }
.sawb-md code { font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; background: var(--dsw-alias-bg-layer-2); border-radius: 4px; padding: 0 4px; }
.sawb-md pre { font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; background: var(--dsw-alias-bg-layer-2); border-radius: 6px; padding: 8px 10px; overflow: auto; margin: 0 0 8px; }
.sawb-md blockquote { margin: 0 0 6px; padding-left: 10px; border-left: 2px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); }
.sawb-table-wrap { width: 100%; overflow-x: auto; margin: 4px 0 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; }
.sawb-md table { width: 100%; border-collapse: collapse; font-size: 12px; }
.sawb-md th, .sawb-md td { padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); text-align: left; vertical-align: top; }
.sawb-md th { background: var(--dsw-alias-bg-layer-2); font-weight: 600; white-space: nowrap; }
.sawb-md tr:last-child td { border-bottom: 0; }
.sawb-md a, .sawb-link { color: var(--dsw-alias-brand-primary); text-decoration: none; overflow-wrap: anywhere; }
.sawb-md a:hover, .sawb-link:hover { text-decoration: underline; }
.sawb-crumbs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 12px; color: var(--dsw-alias-label-secondary); margin-bottom: 12px; }
.sawb-crumbs button { border: 0; background: transparent; color: var(--dsw-alias-brand-primary); font: inherit; padding: 1px 2px; cursor: pointer; }
.sawb-crumbs button:hover { text-decoration: underline; }
.sawb-doc-list { width: 100%; max-width: 1040px; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; overflow: hidden; margin: 0 auto 20px; background: var(--dsw-alias-bg-layer-1); }
.sawb-doc-group-title { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: var(--dsw-alias-bg-layer-2); font-weight: 600; font-size: 13px; }
.sawb-doc-item { display: flex; align-items: center; gap: 12px; width: 100%; border: 0; border-top: 1px solid var(--dsw-alias-border-l1); background: transparent; color: inherit; font: inherit; padding: 10px 16px; text-align: left; cursor: pointer; }
.sawb-doc-item:hover { background: var(--dsw-alias-bg-layer-2); }
.sawb-doc-item .sawb-doc-title { font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sawb-doc-item .sawb-doc-path { margin-left: auto; font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 55%; }
.sawb-repo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 22px; width: 100%; max-width: 1360px; margin: 0 auto; }
.sawb-repo-card { border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; min-width: 0; transition: border-color .15s ease, transform .15s ease; }
.sawb-repo-card:hover { border-color: var(--dsw-alias-brand-primary); transform: translateY(-1px); }
.sawb-repo-card h3 { margin: 0; font-size: 15px; }
.sawb-repo-card p { margin: 0; }
.sawb-repo-info { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-size: 12px; }
.sawb-repo-info dt { color: var(--dsw-alias-label-secondary); }
.sawb-repo-info dd { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sawb-repo-card .sawb-foot-line { margin-top: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sawb-tree { width: 100%; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
.sawb-tree-row { display: flex; align-items: center; gap: 12px; width: 100%; border: 0; border-top: 1px solid var(--dsw-alias-border-l1); background: transparent; color: inherit; font: inherit; padding: 9px 14px; text-align: left; cursor: pointer; }
.sawb-tree-row:first-child { border-top: 0; }
.sawb-tree-row:hover { background: var(--dsw-alias-bg-layer-2); }
.sawb-tree-icon { width: 18px; text-align: center; color: var(--dsw-alias-label-secondary); flex: 0 0 auto; }
.sawb-tree-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sawb-tree-row .sawb-meta { margin-left: auto; }
.sawb-code-wrap { width: 100%; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); overflow: hidden; }
.sawb-code { margin: 0; padding: 10px 0; overflow: auto; max-height: calc(100vh - 280px); font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; line-height: 1.55; tab-size: 2; }
.sawb-code-line { display: flex; min-width: max-content; }
.sawb-code-line:hover { background: var(--dsw-alias-bg-layer-2); }
.sawb-line-no { flex: 0 0 54px; padding: 0 10px 0 8px; text-align: right; color: var(--dsw-alias-state-idle-primary); user-select: none; }
.sawb-line-text { white-space: pre; padding-right: 16px; }
.sawb-file-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.sawb-body > .sawb-file-head,
.sawb-body > .sawb-crumbs,
.sawb-body > .sawb-tree,
.sawb-body > .sawb-code-wrap,
.sawb-body > .sawb-panel { width: 100%; max-width: 1120px; box-sizing: border-box; margin-left: auto; margin-right: auto; }
.sawb-body > .sawb-section { width: 100%; max-width: 1080px; margin-left: auto; margin-right: auto; }
@media (max-width: 900px) {
  .sawb-head { padding-left: 14px; padding-right: 14px; }
  .sawb-body { padding: 16px 14px 36px; }
  .sawb-repo-grid { grid-template-columns: 1fr; gap: 16px; }
  .sawb-doc-item { align-items: flex-start; flex-direction: column; gap: 3px; }
  .sawb-doc-item .sawb-doc-path { margin-left: 0; max-width: 100%; }
}
.sawb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.sawb-card { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; padding: 12px 14px; background: var(--dsw-alias-bg-layer-1); }
.sawb-card h3 { margin: 0 0 6px; font-size: 13px; }
.sawb-kv { display: grid; grid-template-columns: max-content 1fr; gap: 3px 10px; margin: 8px 0 0; }
.sawb-kv dt { color: var(--dsw-alias-label-secondary); }
.sawb-kv dd { margin: 0; overflow-wrap: anywhere; }
.sawb-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.sawb-chip { border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; padding: 0 8px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.sawb-session-list { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
.sawb-session-archive { margin-left: auto; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 18px; padding: 0 6px; cursor: pointer; white-space: nowrap; }
.sawb-session-archive[aria-confirm="true"] { color: var(--dsw-alias-state-error-primary, #c62828); border-color: currentColor; }
.sawb-session-archive:disabled { opacity: 0.6; cursor: default; }
.sawb-session { display: flex; align-items: center; gap: 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; padding: 5px 8px; min-width: 0; background: var(--dsw-alias-bg-base); }
.sawb-session-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.sawb-session-id { flex: 0 1 32%; margin-left: auto; font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 32%; }
.sawb-session-more .sawb-meta { margin-right: auto; }
.sawb-session-page { min-width: 24px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; padding: 1px 6px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11px; cursor: pointer; }
.sawb-session-page:hover { background: var(--dsw-alias-bg-layer-2); }
.sawb-session-page[aria-pressed="true"] { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }
.sawb-pager { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; width: 100%; max-width: 1360px; margin: 16px auto 0; }
.sawb-pager .sawb-meta { margin-right: auto; }
.sawb-pager button:disabled { opacity: .45; cursor: default; }
.sawb-doc-repo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; width: 100%; max-width: 1080px; margin: 0 auto; }
.sawb-doc-repo { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; padding: 14px 16px; background: var(--dsw-alias-bg-layer-1); color: inherit; font: inherit; text-align: left; cursor: pointer; min-width: 0; }
.sawb-doc-repo:hover { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }
.sawb-doc-repo strong { font-size: 13px; }
.sawb-doc-repo .sawb-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.sawb-card.sawb-ungrouped { border-style: dashed; }
.sawb-doc-tree { padding: 6px 0; }
.sawb-doc-folder { display: flex; align-items: center; gap: 6px; width: 100%; border: 0; background: transparent; color: inherit; font: inherit; padding: 5px 16px; cursor: pointer; text-align: left; }
.sawb-doc-folder:hover { background: var(--dsw-alias-bg-layer-2); }
.sawb-doc-folder .sawb-caret { width: 12px; color: var(--dsw-alias-label-secondary); flex: 0 0 auto; }
.sawb-doc-tree .sawb-doc-item { border-top: 0; padding-top: 5px; padding-bottom: 5px; }
.sawb-doc-tree .sawb-doc-item:hover { background: var(--dsw-alias-bg-layer-2); }
.sawb-doc-folder-name { font-weight: 600; font-size: 12px; }
`

    function StyleTag() {
      return h('style', { 'data-plugin': NS }, CSS)
    }

    // ---------------- 小工具 ----------------

    function when(value) {
      if (!value) return '—'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 16)
      const pad = number => String(number).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    function badge(text, tone) {
      return h('span', { className: `sawb-badge ${tone || ''}`.trim() }, text)
    }

    const LIST_PAGE_SIZE = 9
    const REPO_PAGE_SIZE = 4

    /** 分页只保留当前区间，页码过多时显示首尾与当前附近，避免按钮铺满页面。 */
    function usePagedList(items, pageSize = LIST_PAGE_SIZE) {
      const [page, setPage] = React.useState(1)
      const source = items || []
      const pageCount = Math.max(1, Math.ceil(source.length / pageSize))
      React.useEffect(() => {
        if (page > pageCount) setPage(1)
      }, [page, pageCount])
      const safePage = Math.min(page, pageCount)
      return {
        page: safePage,
        setPage,
        pageCount,
        items: source.slice((safePage - 1) * pageSize, safePage * pageSize),
      }
    }

    function pageItems(page, pageCount) {
      if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)
      const wanted = new Set([1, pageCount, page - 1, page, page + 1])
      if (page <= 3) [2, 3, 4].forEach(value => wanted.add(value))
      if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach(value => wanted.add(value))
      const sorted = [...wanted].filter(value => value >= 1 && value <= pageCount).sort((left, right) => left - right)
      const output = []
      sorted.forEach((value, index) => {
        if (index > 0 && value - sorted[index - 1] > 1) output.push('…')
        output.push(value)
      })
      return output
    }

    function Pagination({ page, pageSize = LIST_PAGE_SIZE, total, t, onChange }) {
      const pageCount = Math.max(1, Math.ceil(total / pageSize))
      if (pageCount <= 1) return null
      const from = (page - 1) * pageSize + 1
      const to = Math.min(page * pageSize, total)
      return h('div', { className: 'sawb-pager' },
        h('span', { className: 'sawb-meta' }, t('listRange', { from, to, total })),
        h('button', {
          type: 'button', className: 'sawb-btn sawb-btn-sm', disabled: page <= 1,
          onClick: () => onChange(Math.max(1, page - 1)),
        }, `‹ ${t('listPrev')}`),
        pageItems(page, pageCount).map((value, index) => value === '…'
          ? h('span', { key: `gap:${index}`, className: 'sawb-meta' }, '…')
          : h('button', {
              key: value, type: 'button', className: 'sawb-session-page',
              'aria-pressed': String(page === value),
              onClick: () => onChange(value),
            }, String(value))),
        h('button', {
          type: 'button', className: 'sawb-btn sawb-btn-sm', disabled: page >= pageCount,
          onClick: () => onChange(Math.min(pageCount, page + 1)),
        }, `${t('listNext')} ›`))
    }

    function external(href, text, key) {
      return h('a', { key, className: 'sawb-link', href, target: '_blank', rel: 'noopener noreferrer' }, text)
    }

    /** 行内片段：加粗、行内代码、链接，纯 React 元素，不用 innerHTML。 */
    function Inlines({ parts }) {
      return parts.map((part, index) => {
        if (part.kind === 'bold') return h('strong', { key: index }, part.text)
        if (part.kind === 'code') return h('code', { key: index }, part.text)
        if (part.kind === 'link') return h(React.Fragment, { key: index }, external(part.url, part.text))
        return h(React.Fragment, { key: index }, part.text)
      })
    }

    /** Markdown 块渲染：Host 已把文本切好，这里只做 React 元素映射。 */
    function Markdown({ blocks }) {
      if (!blocks || blocks.length === 0) return null
      return h('div', { className: 'sawb-md' }, blocks.map((block, index) => {
        if (block.kind === 'code') return h('pre', { key: index }, block.text)
        if (block.kind === 'list') {
          const items = block.items.map((item, at) => h('li', { key: at }, h(Inlines, { parts: item.parts })))
          return block.ordered ? h('ol', { key: index }, items) : h('ul', { key: index }, items)
        }
        if (block.kind === 'table') {
          return h('div', { key: index, className: 'sawb-table-wrap' },
            h('table', null,
              h('thead', null, h('tr', null, block.headers.map((cell, at) => h('th', { key: at }, h(Inlines, { parts: cell.parts }))))),
              h('tbody', null, block.rows.map((row, rowIndex) =>
                h('tr', { key: rowIndex }, row.map((cell, at) => h('td', { key: at }, h(Inlines, { parts: cell.parts }))))))))
        }
        if (block.kind === 'heading') return h('p', { key: index }, h('strong', null, h(Inlines, { parts: block.parts })))
        if (block.kind === 'quote') return h('blockquote', { key: index }, h(Inlines, { parts: block.parts }))
        return h('p', { key: index }, h(Inlines, { parts: block.parts }))
      }))
    }

    /** 文档 / 代码视图统一走同一个只读 API，不同 view 参数由 Host 调度。 */
    function loadApi(params, signal) {
      const search = new URLSearchParams()
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
      })
      return fetch(`${API}?${search.toString()}`, {
        credentials: 'same-origin', signal, headers: { accept: 'application/json' },
      }).then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (data && data.error) throw new Error(data.error)
        return data
      })
    }

    /** 唯一写操作：显式归档单个会话（POST JSON）。 */
    function postApi(path, body) {
      return fetch(`${API}${path}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`)
        return data
      })
    }

    function errorText(error) {
      return String(error && error.message ? error.message : error)
    }

    // ---------------- 视图 ----------------

    /** 所有页面都必须经过 Root：保证 style 永远存在，并给内容区稳定的高度/滚动容器。 */
    function Root({ children }) {
      return h('div', { className: 'sawb-root' }, h(StyleTag), children)
    }

    function Tabs({ section, t, onSection }) {
      const items = [
        ['workspaces', t('navWorkspaces')],
        ['repos', t('navRepos')],
        ['docs', t('navDocs')],
      ]
      return h('div', { className: 'sawb-tabs', role: 'tablist' },
        items.map(([key, label]) => h('button', {
          key,
          type: 'button',
          role: 'tab',
          'aria-pressed': String(section === key),
          onClick: () => onSection(key),
        }, label)))
    }

    function CodeBlock({ text }) {
      const lines = String(text || '').split('\n')
      return h('pre', { className: 'sawb-code' }, lines.map((line, index) =>
        h('span', { key: index, className: 'sawb-code-line' },
          h('span', { className: 'sawb-line-no', 'aria-hidden': true }, String(index + 1)),
          h('span', { className: 'sawb-line-text' }, line || ' '))))
    }

    function Breadcrumbs({ repo, path, t, onRoot, onPath }) {
      const parts = String(path || '').split('/').filter(Boolean)
      return h('div', { className: 'sawb-crumbs', 'aria-label': t('repoPath') },
        h('button', { type: 'button', onClick: onRoot }, repo.name),
        parts.map((part, index) => h(React.Fragment, { key: index },
          h('span', null, '/'),
          h('button', { type: 'button', onClick: () => onPath(parts.slice(0, index + 1).join('/')) }, part))))
    }

    function Notice({ children, tone }) {
      return h('div', { className: `sawb-notice${tone === 'error' ? ' sawb-error' : ''}`, role: 'status' }, children)
    }

    /** 会话列表：显示标题，id 作为尾注；无标题时按类型给出可读占位。 */
    /** 会话列表：显示标题，id 作为尾注；无标题时给出可读占位。 */
    function sessionName(session, t) {
      if (session.title) return session.title
      return `${t('sessionUntitled')} · ${session.id.slice(0, 12)}`
    }

    const SESSION_PAGE_SIZE = 10

    /** 会话列表只接收当前页预览；更多页从服务端按工作区/归档筛选加载。 */
    function SessionList({ sessions, t, collapsible = false, total, workspaceId, repoId, archived = 'active' }) {
      const source = sessions || []
      const [items, setItems] = React.useState(source)
      const [page, setPage] = React.useState(1)
      const [totalCount, setTotalCount] = React.useState(Number(total) || source.length)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState('')
      const [confirmId, setConfirmId] = React.useState('')
      const [busyId, setBusyId] = React.useState('')
      const [notice, setNotice] = React.useState({ text: '', error: false })
      React.useEffect(() => {
        setItems(source)
        setPage(1)
        setTotalCount(Number(total) || source.length)
        setError('')
        setConfirmId('')
        setNotice({ text: '', error: false })
      }, [source, total])
      // 两步确认：第一次点击只进入确认态，第二次才真正归档。
      const archive = session => {
        if (confirmId !== session.id) {
          setConfirmId(session.id)
          setNotice({ text: '', error: false })
          return
        }
        setConfirmId('')
        setBusyId(session.id)
        postApi('/archive', { sessionId: session.id })
          .then(() => {
            setItems(list => list.filter(item => item.id !== session.id))
            setTotalCount(count => Math.max(0, count - 1))
            setNotice({ text: t('archiveDone'), error: false })
          })
          .catch(failure => setNotice({ text: t('archiveFailed', { message: errorText(failure) }), error: true }))
          .finally(() => setBusyId(''))
      }
      if (totalCount === 0) return h('div', { className: 'sawb-meta', style: { marginTop: 8 } }, t('noSessions'))
      const changePage = next => {
        setPage(next)
        if ((!workspaceId && !repoId) || next === 1) {
          setItems(source)
          return
        }
        setLoading(true)
        setError('')
        const params = repoId
          ? { view: 'repoSessions', repo: repoId, offset: (next - 1) * SESSION_PAGE_SIZE, limit: SESSION_PAGE_SIZE, archived, sort: 'createdAt', dir: 'desc' }
          : { view: 'sessions', workspace: workspaceId, offset: (next - 1) * SESSION_PAGE_SIZE, limit: SESSION_PAGE_SIZE, archived, sort: 'createdAt', dir: 'desc' }
        loadApi(params)
          .then(data => {
            setItems(data.sessions || [])
            setTotalCount(Number(data.total) || 0)
          })
          .catch(failure => setError(errorText(failure)))
          .finally(() => setLoading(false))
      }
      return h(React.Fragment, null,
        h('div', { className: 'sawb-session-list' }, items.map(session => {
          const name = sessionName(session, t)
          return h('div', { key: session.id, className: 'sawb-session', title: [name, session.id, session.cwd || ''].filter(Boolean).join('\n') },
            session.archived ? badge(t('sessionArchived'), 'muted') : null,
            session.pinned ? badge(t('sessionPinned'), 'muted') : null,
            h('span', { className: 'sawb-session-name', title: name }, name),
            h('span', { className: 'sawb-session-id' }, session.id),
            session.archived ? null : h('button', {
              type: 'button',
              className: 'sawb-session-archive',
              'aria-confirm': String(confirmId === session.id),
              disabled: busyId === session.id,
              title: t('archiveSession'),
              onClick: () => archive(session),
            }, busyId === session.id ? '…' : confirmId === session.id ? t('archiveConfirm') : t('archiveSession')))
        })),
        loading ? h('div', { className: 'sawb-meta' }, t('loadingData')) : null,
        error ? h(Notice, { tone: 'error' }, t('readFailed', { message: error })) : null,
        notice.text ? h(Notice, { tone: notice.error ? 'error' : undefined }, notice.text) : null,
        collapsible && totalCount > SESSION_PAGE_SIZE
          ? h(Pagination, { page, pageSize: SESSION_PAGE_SIZE, total: totalCount, t, onChange: changePage })
          : null)
    }

    /** 把 flat docs 构造成目录树；只在前端派生，不改变 Host 返回结构。 */
    function buildDocTree(docs) {
      const root = { dirs: new Map(), files: [] }
      for (const item of docs) {
        const parts = String(item.path || '').split('/').filter(Boolean)
        let node = root
        parts.slice(0, -1).forEach(part => {
          if (!node.dirs.has(part)) node.dirs.set(part, { name: part, dirs: new Map(), files: [] })
          node = node.dirs.get(part)
        })
        const name = parts[parts.length - 1] || item.path
        node.files.push({ ...item, name })
      }
      return root
    }

    function DocFolder({ name, node, depth, repo, t, onOpen }) {
      const [open, setOpen] = React.useState(false)
      return h(React.Fragment, null,
        h('button', { type: 'button', className: 'sawb-doc-folder', style: { paddingLeft: 16 + depth * 18 }, onClick: () => setOpen(value => !value) },
          h('span', { className: 'sawb-caret' }, open ? '▾' : '▸'),
          h('span', { className: 'sawb-doc-folder-name' }, name),
          badge(String(node.dirs.size + node.files.length), 'muted')),
        open ? h(DocTree, { node, depth: depth + 1, repo, t, onOpen }) : null)
    }

    function DocTree({ node, depth, repo, t, onOpen }) {
      const dirs = [...node.dirs.values()].sort((left, right) => left.name.localeCompare(right.name))
      const files = [...node.files].sort((left, right) => left.path.localeCompare(right.path))
      return h('div', { className: 'sawb-doc-tree' },
        dirs.map(dir => h(DocFolder, { key: `dir:${dir.name}`, name: dir.name, node: dir, depth, repo, t, onOpen })),
        files.map(item => h('button', {
          key: item.path, type: 'button', className: 'sawb-doc-item', style: { paddingLeft: 16 + depth * 18 }, title: item.path,
          onClick: () => onOpen(repo, item.path),
        },
          h('span', { className: 'sawb-doc-title' }, item.title || item.name),
          h('span', { className: 'sawb-doc-path' }, item.path))))
    }

    /** 文档中心：先选仓库，再按目录层级按需读取该仓库的 Markdown 索引。 */
    function DocsView({ t, section, onSection }) {
      const [route, setRoute] = React.useState({ kind: 'repos', repo: undefined })
      const [state, setState] = React.useState({ phase: 'loading', repos: [], groups: [], error: '' })
      const [doc, setDoc] = React.useState({ phase: 'idle', repo: undefined, data: undefined, error: '' })
      const [repoPage, setRepoPage] = React.useState(1)
      const [repoTotal, setRepoTotal] = React.useState(0)

      React.useEffect(() => {
        const controller = new AbortController()
        setState(previous => ({ phase: 'loading', repos: previous.repos, groups: previous.groups, error: '' }))
        const params = route.kind === 'repos'
          ? { view: 'docRepos', offset: (repoPage - 1) * 12, limit: 12 }
          : { view: 'docs', repo: route.repo.id }
        loadApi(params, controller.signal)
          .then(data => {
            setState({ phase: 'ready', repos: data.repos || [], groups: data.groups || [], error: '' })
            setRepoTotal(Number(data.total) || (data.repos || []).length)
          })
          .catch(error => {
            if (error && error.name === 'AbortError') return
            setState({ phase: 'error', repos: [], groups: [], error: errorText(error) })
          })
        return () => controller.abort()
      }, [route, repoPage])

      const openDoc = (repo, path) => {
        setDoc({ phase: 'loading', repo, data: undefined, error: '' })
        const controller = new AbortController()
        loadApi({ view: 'blob', repo: repo.id, path }, controller.signal)
          .then(data => setDoc({ phase: 'ready', repo, data, error: '' }))
          .catch(error => setDoc({ phase: 'error', repo, data: undefined, error: errorText(error) }))
      }

      if (doc.phase !== 'idle') {
        return h(React.Fragment, null,
          h('div', { className: 'sawb-head' },
            h('button', { type: 'button', className: 'sawb-btn', onClick: () => setDoc({ phase: 'idle', repo: undefined, data: undefined, error: '' }) }, `← ${t('backToDocList')}`),
            h('span', { className: 'sawb-spacer' }),
            h('span', { className: 'sawb-meta' }, doc.repo ? doc.repo.name : '')),
          h('div', { className: 'sawb-body' },
            doc.phase === 'error'
              ? h(Notice, { tone: 'error' }, t('readFailed', { message: doc.error }))
              : doc.phase === 'loading' || !doc.data
                ? h('div', { className: 'sawb-empty' }, t('loadingData'))
                : h(React.Fragment, null,
                    h('div', { className: 'sawb-file-head' },
                      h('h2', { className: 'sawb-detail-title' }, doc.data.path.split('/').pop()),
                      badge(doc.data.path, 'muted')),
                    doc.data.tooLarge
                      ? h(Notice, null, t('fileTooLarge'))
                      : h('div', { className: 'sawb-panel' }, h(Markdown, { blocks: doc.data.blocks })))))
      }

      if (route.kind === 'repos') {
        return h(React.Fragment, null,
          h('div', { className: 'sawb-head' },
            h('h2', { className: 'sawb-title' }, t('docsTitle')),
            h('span', { className: 'sawb-meta' }, t('docsRepoHint')),
            h('span', { className: 'sawb-spacer' }),
            h('span', { className: 'sawb-meta' }, t('docsRepoCount', { n: repoTotal })),
            h(Tabs, { section, t, onSection })),
          h('div', { className: 'sawb-body' },
            state.phase === 'error'
              ? h(Notice, { tone: 'error' }, t('readFailed', { message: state.error }))
              : state.phase === 'loading' && state.repos.length === 0
                ? h('div', { className: 'sawb-empty' }, t('loadingData'))
                : state.repos.length === 0
                  ? h('div', { className: 'sawb-empty' }, t('noRepos'))
                  : h(React.Fragment, null,
                      h('div', { className: 'sawb-doc-repo-grid' }, state.repos.map(repo => h('button', {
                        key: repo.id, type: 'button', className: 'sawb-doc-repo',
                        onClick: () => { setDoc({ phase: 'idle', repo: undefined, data: undefined, error: '' }); setRoute({ kind: 'repo', repo }) },
                      },
                        h('strong', null, repo.name),
                        repo.description ? h('span', { className: 'sawb-meta' }, repo.description) : null,
                        h('span', { className: 'sawb-meta sawb-mono' }, repo.id)))),
                      h(Pagination, { page: repoPage, pageSize: 12, total: repoTotal, t, onChange: setRepoPage }))))
      }

      const group = state.groups[0]
      const total = group ? group.docs.length : 0
      return h(React.Fragment, null,
        h('div', { className: 'sawb-head' },
          h('button', { type: 'button', className: 'sawb-btn', onClick: () => { setRepoPage(1); setRoute({ kind: 'repos', repo: undefined }) } }, `← ${t('backToDocRepos')}`),
          h('h2', { className: 'sawb-title' }, route.repo.name),
          h('span', { className: 'sawb-meta' }, t('docsTreeHint')),
          h('span', { className: 'sawb-spacer' }),
          h('span', { className: 'sawb-meta' }, t('docsCount', { n: total })),
          h(Tabs, { section, t, onSection })),
        h('div', { className: 'sawb-body' },
          state.phase === 'error'
            ? h(Notice, { tone: 'error' }, t('readFailed', { message: state.error }))
            : state.phase === 'loading'
              ? h('div', { className: 'sawb-empty' }, t('loadingData'))
              : total === 0
                ? h('div', { className: 'sawb-empty' }, t('noDocs'))
                : h('div', { className: 'sawb-doc-list' },
                    h('div', { className: 'sawb-doc-group-title' },
                      h('span', null, route.repo.name),
                      badge(t('docsCount', { n: total }), 'muted')),
                    h(DocTree, { node: buildDocTree(group.docs), depth: 0, repo: group.repo, t, onOpen: openDoc }))))
    }

    /** 工作区页：DSH Host 是 workspace.json 的唯一写者，这里只读展示工作区与未分组。 */
    function WorkspacesView({ t, section, onSection }) {
      const [state, setState] = React.useState({ phase: 'loading', data: undefined, error: '' })
      const [archived, setArchived] = React.useState('active')
      const [page, setPage] = React.useState(1)
      const load = React.useCallback(signal => {
        setState(previous => ({ phase: 'loading', data: previous.data, error: '' }))
        loadApi({ view: 'workspaces', offset: (page - 1) * 8, limit: 8, archived, sessionLimit: 10, sort: 'updatedAt', dir: 'desc' }, signal)
          .then(data => setState({ phase: 'ready', data, error: '' }))
          .catch(error => {
            if (error && error.name === 'AbortError') return
            setState({ phase: 'error', data: undefined, error: errorText(error) })
          })
      }, [page, archived])
      React.useEffect(() => {
        const controller = new AbortController()
        load(controller.signal)
        return () => controller.abort()
      }, [load])
      const data = state.data
      const workspaces = (data && data.workspaces) || []
      const ungrouped = (data && data.ungrouped) || { sessions: [], sessionTotal: 0 }
      const totalWorkspaces = Number(data && data.total) || 0
      const totalSessions = Number(data && data.counts && data.counts.sessions) || 0
      const filters = [['active', t('filterActive')], ['archived', t('filterArchived')], ['all', t('filterAllSessions')]]
      return h(React.Fragment, null,
        h('div', { className: 'sawb-head' },
          h('h2', { className: 'sawb-title' }, t('workspacesTitle')),
          h('span', { className: 'sawb-meta' }, t('workspacesHint')),
          h('span', { className: 'sawb-spacer' }),
          h('span', { className: 'sawb-meta' }, `${t('workspaceCount', { n: totalWorkspaces })} · ${t('workspaceSessionCount', { n: totalSessions })}`),
          h(Tabs, { section, t, onSection }),
          filters.map(([value, label]) => h('button', {
            key: value, type: 'button', className: 'sawb-btn', 'aria-pressed': String(archived === value),
            onClick: () => { setArchived(value); setPage(1) },
          }, label)),
          h('button', { type: 'button', className: 'sawb-btn', onClick: () => load() }, t('refresh'))),
        h('div', { className: 'sawb-body' },
          state.phase === 'error'
            ? h(Notice, { tone: 'error' }, t('readFailed', { message: state.error }))
            : !data
              ? h('div', { className: 'sawb-empty' }, t('loadingData'))
              : h(React.Fragment, null,
                  data.sessionError ? h(Notice, null, data.sessionError) : null,
                  h('div', { className: 'sawb-grid' },
                    workspaces.map(workspace => h('article', { key: workspace.id, className: 'sawb-card' },
                      h('h3', null, workspace.title || workspace.id),
                      h('dl', { className: 'sawb-kv' },
                        h('dt', null, t('workspacePath')), h('dd', { className: 'sawb-mono', title: workspace.path }, workspace.path),
                        h('dt', null, t('workspaceCreated')), h('dd', null, when(workspace.createdAt))),
                      workspace.exists === false ? h(Notice, { tone: 'error' }, t('workspaceMissing')) : null,
                      h('div', { className: 'sawb-chips' },
                        h('span', { className: 'sawb-chip' }, t('workspaceSessionCount', { n: workspace.sessionTotal })),
                        workspace.git ? h('span', { className: 'sawb-chip' }, t('repoGit')) : null),
                      h(SessionList, {
                        key: `${workspace.id}:${archived}`, sessions: workspace.sessions, total: workspace.sessionTotal,
                        workspaceId: workspace.id, archived, t, collapsible: true,
                      }))),
                    h('article', { key: '__ungrouped', className: 'sawb-card sawb-ungrouped' },
                      h('h3', null, t('ungroupedTitle')),
                      h('p', { className: 'sawb-meta' }, t('ungroupedHint')),
                      h('div', { className: 'sawb-chips' }, h('span', { className: 'sawb-chip' }, t('ungroupedCount', { n: ungrouped.sessionTotal }))),
                      h(SessionList, {
                        key: `ungrouped:${archived}`, sessions: ungrouped.sessions, total: ungrouped.sessionTotal,
                        workspaceId: 'ungrouped', archived, t, collapsible: true,
                      }))),
                  h(Pagination, { page, pageSize: 8, total: totalWorkspaces, t, onChange: setPage }))))
    }

    function RepoCard({ repo, t, onOpen }) {
      const sourceLabel = repo.source === 'workspace' ? t('repoSourceWorkspace') : t('repoSourceConfigured')
      return h('article', { className: 'sawb-repo-card' },
        h('h3', null, repo.name, ' ', badge(sourceLabel, 'muted')),
        h('div', { className: 'sawb-chips' },
          badge(repo.mode === 'git' ? t('modeGit') : t('modeWorktree'), 'muted'),
          badge(repo.git ? t('repoGit') : t('repoNoGit'), repo.git ? 'ok' : 'muted')),
        repo.description ? h('p', { className: 'sawb-meta' }, repo.description) : null,
        repo.ok === false
          ? h(Notice, { tone: 'error' }, t('repoUnavailable', { message: repo.error }))
          : h('dl', { className: 'sawb-repo-info' },
              h('dt', null, t('branch')), h('dd', { className: 'sawb-mono' }, repo.branch || '—'),
              h('dt', null, t('head')), h('dd', { className: 'sawb-mono', title: repo.subject || '' }, `${repo.head || '—'}${repo.subject ? ` · ${repo.subject}` : ''}`),
              h('dt', null, t('repoPath')), h('dd', { className: 'sawb-mono', title: repo.path }, repo.path),
              repo.dirty ? h(React.Fragment, null, h('dt', null, ' '), h('dd', null, badge(t('dirty', { n: repo.dirty }), 'live'))) : null),
        repo.commits && repo.commits.length > 0
          ? h('div', null,
              h('div', { className: 'sawb-meta' }, t('commits')),
              h('ul', { className: 'sawb-meta', style: { margin: '4px 0 0', paddingLeft: 18 } },
                repo.commits.slice(0, 3).map(commit => h('li', { key: commit.short }, h('span', { className: 'sawb-mono' }, commit.short), ' ', commit.subject))))
          : null,
        h('div', { className: 'sawb-foot-line' },
          h('button', { type: 'button', className: 'sawb-btn', disabled: repo.ok === false, onClick: () => onOpen(repo) }, t('openRepo'))))
    }

    /** 代码仓库：仓库列表 → 目录树 → 文件内容。全程只读。 */
    function CodeView({ t, section, onSection }) {
      const [route, setRoute] = React.useState({ kind: 'repos', repo: undefined, path: '' })
      const [repoPage, setRepoPage] = React.useState(1)
      const [treePage, setTreePage] = React.useState(1)
      const [state, setState] = React.useState({ phase: 'loading', data: undefined, error: '' })
      const [repoSessions, setRepoSessions] = React.useState({ phase: 'idle', data: undefined, error: '' })

      React.useEffect(() => { setTreePage(1) }, [route])
      React.useEffect(() => {
        if (route.kind !== 'tree' || route.path) {
          setRepoSessions({ phase: 'idle', data: undefined, error: '' })
          return undefined
        }
        const controller = new AbortController()
        setRepoSessions({ phase: 'loading', data: undefined, error: '' })
        loadApi({ view: 'repoSessions', repo: route.repo.id, offset: 0, limit: SESSION_PAGE_SIZE, archived: 'active', sort: 'createdAt', dir: 'desc' }, controller.signal)
          .then(data => setRepoSessions({ phase: 'ready', data, error: '' }))
          .catch(error => {
            if (error && error.name === 'AbortError') return
            setRepoSessions({ phase: 'error', data: undefined, error: errorText(error) })
          })
        return () => controller.abort()
      }, [route])
      React.useEffect(() => {
        const controller = new AbortController()
        setState({ phase: 'loading', data: undefined, error: '' })
        let params
        if (route.kind === 'repos') params = {
          view: 'repos',
          offset: String((repoPage - 1) * REPO_PAGE_SIZE),
          limit: String(REPO_PAGE_SIZE),
          sort: 'updatedAt',
          dir: 'desc',
        }
        else if (route.kind === 'tree') params = { view: 'tree', repo: route.repo.id, path: route.path, offset: (treePage - 1) * LIST_PAGE_SIZE, limit: LIST_PAGE_SIZE }
        else params = { view: 'blob', repo: route.repo.id, path: route.path }
        loadApi(params, controller.signal)
          .then(data => setState({ phase: 'ready', data, error: '' }))
          .catch(error => {
            if (error && error.name === 'AbortError') return
            setState({ phase: 'error', data: undefined, error: errorText(error) })
          })
        return () => controller.abort()
      }, [route, repoPage, treePage])

      const openRepo = repo => setRoute({ kind: 'tree', repo, path: '' })
      const openTree = (repo, path) => setRoute({ kind: 'tree', repo, path })
      const openBlob = (repo, path) => setRoute({ kind: 'blob', repo, path })

      let content = null
      if (state.phase === 'error') {
        content = h(Notice, { tone: 'error' }, t('readFailed', { message: state.error }))
      } else if (state.phase === 'loading' && !state.data) {
        content = h('div', { className: 'sawb-empty' }, t('loadingData'))
      } else if (route.kind === 'repos') {
        const repos = state.data.repos || []
        const total = Number(state.data.total) || repos.length
        content = repos.length === 0
          ? h('div', { className: 'sawb-empty' }, t('noRepos'))
          : h(React.Fragment, null,
              h('div', { className: 'sawb-repo-grid' }, repos.map(repo => h(RepoCard, { key: repo.id, repo, t, onOpen: openRepo }))),
              h(Pagination, { page: repoPage, pageSize: REPO_PAGE_SIZE, total, t, onChange: setRepoPage }))
      } else if (route.kind === 'tree') {
        const data = state.data
        const entries = data.entries || []
        const dirs = entries.filter(item => item.type === 'dir').length
        const totalEntries = Number(data.total) || entries.length
        content = h(React.Fragment, null,
          h('div', { className: 'sawb-file-head' },
            h('button', { type: 'button', className: 'sawb-btn', onClick: () => { setRepoPage(1); setRoute({ kind: 'repos' }) } }, `← ${t('backToRepos')}`),
            h('button', { type: 'button', className: 'sawb-btn', onClick: () => openTree(route.repo, '') }, t('repoPath')),
            h('span', { className: 'sawb-meta' }, t('dirCount', { n: dirs }) + ' · ' + t('fileCount', { n: entries.length - dirs }) + ` / ${totalEntries}`)),
          h(Breadcrumbs, { repo: route.repo, path: data.path || '', t, onRoot: () => openTree(route.repo, ''), onPath: path => openTree(route.repo, path) }),
          !data.path ? h('section', { className: 'sawb-section' },
            h('h3', null, t('repoSessionsTitle'), ' ', repoSessions.data ? badge(t('repoSessionCount', { n: repoSessions.data.total }), 'muted') : null),
            h('p', { className: 'sawb-meta' }, t('repoSessionsHint')),
            repoSessions.phase === 'error'
              ? h(Notice, { tone: 'error' }, t('readFailed', { message: repoSessions.error }))
              : repoSessions.phase === 'loading' && !repoSessions.data
                ? h('div', { className: 'sawb-meta' }, t('loadingData'))
                : repoSessions.data
                  ? h(SessionList, {
                      key: `repo:${route.repo.id}`, sessions: repoSessions.data.sessions || [], total: repoSessions.data.total,
                      repoId: route.repo.id, archived: 'active', t, collapsible: true,
                    })
                  : null) : null,
          entries.length === 0
            ? h('div', { className: 'sawb-empty' }, t('emptyTree'))
            : h(React.Fragment, null,
                h('div', { className: 'sawb-tree' }, entries.map(entry => h('button', {
                  key: entry.path, type: 'button', className: 'sawb-tree-row',
                  onClick: () => entry.type === 'dir' ? openTree(route.repo, entry.path) : openBlob(route.repo, entry.path),
                },
                  h('span', { className: 'sawb-tree-icon', 'aria-hidden': true }, entry.type === 'dir' ? '▸' : '·'),
                  h('span', { className: 'sawb-tree-name' }, entry.name + (entry.type === 'dir' ? '/' : '')),
                  h('span', { className: 'sawb-meta' }, entry.type === 'dir' ? '' : (entry.lang || ''))))),
                h(Pagination, { page: treePage, pageSize: LIST_PAGE_SIZE, total: totalEntries, t, onChange: setTreePage })))
      } else {
        const data = state.data
        const parent = route.path.includes('/') ? route.path.slice(0, route.path.lastIndexOf('/')) : ''
        content = h(React.Fragment, null,
          h('div', { className: 'sawb-file-head' },
            h('button', { type: 'button', className: 'sawb-btn', onClick: () => openTree(route.repo, parent) }, `← ${t('backToTree')}`),
            h('h2', { className: 'sawb-detail-title' }, route.path.split('/').pop()),
            badge(data.isDoc ? t('docFile') : (data.lang || t('codeFile')), 'muted'),
            h('span', { className: 'sawb-meta' }, `${data.size >= 0 ? Math.ceil(data.size / 1024) + ' KB' : ''}`)),
          h(Breadcrumbs, { repo: route.repo, path: route.path, t, onRoot: () => openTree(route.repo, ''), onPath: path => openTree(route.repo, path) }),
          data.tooLarge
            ? h(Notice, null, t('fileTooLarge'))
            : data.binary
              ? h(Notice, null, t('binaryFile'))
              : data.isDoc
                ? h('div', { className: 'sawb-panel' }, h(Markdown, { blocks: data.blocks }))
                : h('div', { className: 'sawb-code-wrap' }, h(CodeBlock, { text: data.text })))
      }

      return h(React.Fragment, null,
        h('div', { className: 'sawb-head' },
          h('h2', { className: 'sawb-title' }, t('reposTitle')),
          h('span', { className: 'sawb-meta' }, t('reposHint')),
          h('span', { className: 'sawb-spacer' }),
          h(Tabs, { section, t, onSection })),
        h('div', { className: 'sawb-body' }, content))
    }

    /** 三个只读分区共用一个壳：分区切换即整页切换，各分区自己按需加载。 */
    function Workbench({ t }) {
      const [section, setSection] = React.useState('workspaces')
      if (section === 'repos') return h(Root, null, h(CodeView, { t, section, onSection: setSection }))
      if (section === 'docs') return h(Root, null, h(DocsView, { t, section, onSection: setSection }))
      return h(Root, null, h(WorkspacesView, { t, section, onSection: setSection }))
    }

    // ---------------- 注册 ----------------

    const Icon = ({ size }) =>
      h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('rect', { x: 3, y: 4.5, width: 18, height: 15, rx: 2 }),
        h('path', { d: 'M7 9h6M7 12.5h10M7 16h7' }),
        h('circle', { cx: 17, cy: 8, r: 1.6, fill: 'currentColor', stroke: 'none' }))

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // DSH 内置语言 id 是 zh / en；再保留 zh-CN 以兼容浏览器区域标签。
        ctx.effect(() => ctx.locale.register(NS, { zh, 'zh-CN': zh, en }), 'dsh-workbench-panel: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('main', () => ctx.slots.register(
          { name: 'main', key: PANEL_ID, locale: NS },
          (props) => h(Workbench, { t: props.t || t }),
        ))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
          { name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => t('panel'), locale: NS },
          Icon,
        ))
      },
    }
  },
})
