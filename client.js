/**
 * 由 `npm run build:client` 从 client/ 各段拼接生成，请勿直接编辑。
 * 源码段顺序：tokens.js → theme.js → highlight.js → view-repos.js → view-docs-workspaces.js → view-editor.js → index.js
 * 顶层只保留 tokens.js、theme.js 的 SAWB_* 常量与入口调用，其余全部在工厂作用域内。
 */
// ---- client/tokens.js ----
/**
 * 工厂内的语言字典与常量。
 *
 * 常量名统一带 `SAWB_` 前缀：生成物 client.js 会被 DSH Web 与所有插件的 client.js
 * **拼进同一个 bundle** 执行，顶层名字必须唯一，否则整条 entry 加载失败
 * （实测通用名 `const API` 与其他插件重名 → "Identifier 'API' has already been declared"，
 * 通用名 `const h = React.createElement` 则让 `React` 在解构前就被引用 → "React is not defined"）。
 *
 * 改动文案时请同步 locale/zh.json、locale/en.json。
 */
const SAWB_API = '/dsh-workbench-panel/api'
const SAWB_PANEL_ID = 'dsh-workbench-panel'
const SAWB_NS = 'dshWorkbenchPanel'

const SAWB_ZH = {
  "meta": {
    "title": "DSH 工作台",
    "description": "工作区、会话、仓库文件与文档索引"
  },
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
  "cancel": "取消",
  "closeTab": "关闭标签",
  "confirmSave": "确认保存？",
  "draftKept": "有未保存的改动，先保存或取消。",
  "edit": "编辑",
  "editConflict": "文件已被外部修改（{message}），请重载后重试。",
  "editing": "编辑中",
  "fileSwitcher": "文件",
  "fileSwitcherHint": "悬停或点击展开；Alt+1 唤出",
  "maxTabs": "最多 {n} 个标签，已替换当前标签。",
  "notEditable": "此文件不可编辑（git 模式、二进制、超大或非文本）。",
  "reload": "重载",
  "revert": "撤销",
  "revertConfirm": "确认撤销该文件的工作区改动？",
  "revertDone": "已撤销到 HEAD 版本。",
  "revertPreview": "将丢弃以下改动：",
  "save": "保存",
  "saveDone": "已保存。",
  "saveFailed": "保存失败：{message}",
  "searchEmpty": "没有命中。",
  "searchHint": "输入至少 2 个字符，在当前仓库内检索文件名或内容。",
  "searchModeBoth": "全部",
  "searchModeContent": "内容",
  "searchModeName": "文件名",
  "searchPlaceholder": "在本仓库内搜索",
  "searchScan": "逐行扫描",
  "searchTotal": "{n} 条命中",
  "searchTruncated": "已达上限",
  "unsavedConfirm": "有未保存的改动，继续将丢弃。",
  "docFile": "Markdown 文档",
  "docsCount": "{n} 篇",
  "docsRepoCount": "{n} 个仓库",
  "docsRepoHint": "先选择仓库，再按目录层级展开文档。",
  "docsTitle": "文档",
  "docsTreeHint": "目录默认收起，点击逐层展开。",
  "emptyTree": "这个目录是空的。",
  "fileCount": "{n} 个文件",
  "fileTooLarge": "文件超过 2MB，不在页面内渲染。",
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
  "openRepo": "浏览仓库",
  "panel": "DSH 工作台",
  "readFailed": "读取失败：{message}",
  "refresh": "刷新",
  "repoGit": "git 仓库",
  "repoNoGit": "非 git 目录",
  "repoPath": "路径",
  "repoSourceConfigured": "DSH 配置",
  "repoSourceWorkspace": "工作区自动识别",
  "repoUnavailable": "仓库不可用：{message}",
  "reposHint": "来源为 DSH 插件配置与工作区自动识别。",
  "reposTitle": "仓库",
  "workspaceCount": "{n} 个工作区",
  "workspaceCreated": "创建",
  "workspaceMissing": "目录不存在",
  "workspacePath": "路径",
  "workspacesHint": "这些记录来自当前 DSH Host 的 workspaceRegistry，是唯一写者。",
  "workspacesTitle": "工作区"
}


const SAWB_EN = {
  "meta": {
    "title": "DSH Workbench",
    "description": "Workspaces, sessions, repository files and documentation index"
  },
  "backToDocList": "Back to docs",
  "backToDocRepos": "Back to repositories",
  "backToRepos": "Back to repositories",
  "backToTree": "Back to directory",
  "binaryFile": "Binary file, not rendered inline.",
  "branch": "Branch",
  "cancel": "Cancel",
  "closeTab": "Close tab",
  "codeFile": "Source file",
  "commits": "Recent commits",
  "confirmSave": "Confirm save?",
  "dirCount": "{n} dirs",
  "dirty": "{n} uncommitted",
  "docFile": "Markdown document",
  "docsCount": "{n} docs",
  "docsRepoCount": "{n} repos",
  "docsRepoHint": "Pick a repository, then expand its docs by folder.",
  "docsTitle": "Docs",
  "docsTreeHint": "Folders are collapsed by default; expand level by level.",
  "draftKept": "Unsaved changes; save or cancel first.",
  "edit": "Edit",
  "editConflict": "File changed outside this editor ({message}); reload and retry.",
  "editing": "Editing",
  "emptyTree": "This directory is empty.",
  "fileCount": "{n} files",
  "fileSwitcher": "Files",
  "fileSwitcherHint": "Hover or click to expand; Alt+1 to toggle",
  "fileTooLarge": "File is larger than 2MB and is not rendered inline.",
  "head": "Latest commit",
  "listNext": "Next",
  "listPrev": "Prev",
  "listRange": "Showing {from}-{to} of {total}",
  "loadingData": "Loading…",
  "maxTabs": "At most {n} tabs; replaced the current tab.",
  "modeGit": "Git objects (worktree untouched)",
  "modeWorktree": "Worktree files",
  "navDocs": "Docs",
  "navRepos": "Repos",
  "navWorkspaces": "Workspaces",
  "noDocs": "No readable Markdown documents.",
  "noRepos": "No repository available.",
  "notEditable": "This file is not editable (git mode, binary, too large or non-text).",
  "openRepo": "Browse repository",
  "panel": "DSH Workbench",
  "readFailed": "Could not load: {message}",
  "refresh": "Refresh",
  "reload": "Reload",
  "repoGit": "git repository",
  "repoNoGit": "non-git directory",
  "repoPath": "Path",
  "repoSourceConfigured": "DSH config",
  "repoSourceWorkspace": "Auto-detected workspace",
  "repoUnavailable": "Repository unavailable: {message}",
  "reposHint": "Sources are DSH plugin configuration plus auto-detected workspaces.",
  "reposTitle": "Repositories",
  "revert": "Revert",
  "revertConfirm": "Revert this file's worktree changes?",
  "revertDone": "Reverted to HEAD.",
  "revertPreview": "These changes will be discarded:",
  "save": "Save",
  "saveDone": "Saved.",
  "saveFailed": "Save failed: {message}",
  "searchEmpty": "No matches.",
  "searchHint": "Type at least 2 characters to search file names or contents in this repository.",
  "searchModeBoth": "All",
  "searchModeContent": "Content",
  "searchModeName": "File name",
  "searchPlaceholder": "Search in this repository",
  "searchScan": "line scan",
  "searchTotal": "{n} matches",
  "searchTruncated": "limit reached",
  "unsavedConfirm": "Unsaved changes will be discarded. Continue?",
  "workspaceCount": "{n} workspaces",
  "workspaceCreated": "Created",
  "workspaceMissing": "Directory missing",
  "workspacePath": "Path",
  "workspacesHint": "These records come from the current DSH Host workspaceRegistry, the only writer.",
  "workspacesTitle": "Workspaces"
}

// ---- client/theme.js ----
/**
 * 面板样式：只用 --dsw-alias-* 主题令牌，跟随明暗与字体。
 *
 * 常量名带 `SAWB_` 前缀，理由同 tokens.js：client.js 与所有插件的 client.js
 * 拼在同一个 bundle 里执行，顶层名字必须唯一。
 */
const SAWB_CSS = `
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
.sawb-code-line.sawb-line-hit { background: var(--dsw-alias-bg-layer-2); box-shadow: inset 2px 0 0 var(--dsw-alias-brand-primary); }
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
.sawb-pager { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; width: 100%; max-width: 1360px; margin: 16px auto 0; }
.sawb-pager .sawb-meta { margin-right: auto; }
.sawb-pager button:disabled { opacity: .45; cursor: default; }
.sawb-doc-repo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; width: 100%; max-width: 1080px; margin: 0 auto; }
.sawb-doc-repo { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; padding: 14px 16px; background: var(--dsw-alias-bg-layer-1); color: inherit; font: inherit; text-align: left; cursor: pointer; min-width: 0; }
.sawb-doc-repo:hover { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }
.sawb-doc-repo strong { font-size: 13px; }
.sawb-doc-repo .sawb-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.sawb-doc-tree { padding: 6px 0; }
.sawb-doc-folder { display: flex; align-items: center; gap: 6px; width: 100%; border: 0; background: transparent; color: inherit; font: inherit; padding: 5px 16px; cursor: pointer; text-align: left; }
.sawb-doc-folder:hover { background: var(--dsw-alias-bg-layer-2); }
.sawb-doc-folder .sawb-caret { width: 12px; color: var(--dsw-alias-label-secondary); flex: 0 0 auto; }
.sawb-doc-tree .sawb-doc-item { border-top: 0; padding-top: 5px; padding-bottom: 5px; }
.sawb-doc-tree .sawb-doc-item:hover { background: var(--dsw-alias-bg-layer-2); }
.sawb-doc-folder-name { font-weight: 600; font-size: 12px; }
.sawb-search-form { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.sawb-input { border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: var(--dsw-alias-bg-base); color: inherit; font: inherit; font-size: 12px; padding: 4px 8px; min-width: 0; }
.sawb-input:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 0; }
/* ---- B 段占位（待 B 落地后替换为正式样式） ---- */
.sawb-tabsbar { display: flex; align-items: center; gap: 2px; flex-wrap: nowrap; overflow-x: auto; border-bottom: 1px solid var(--dsw-alias-border-l1); margin-bottom: 10px; }
.sawb-tab { display: inline-flex; align-items: center; gap: 6px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; padding: 5px 8px; cursor: pointer; white-space: nowrap; }
.sawb-tab[aria-pressed="true"] { color: var(--dsw-alias-label-primary); border-bottom-color: var(--dsw-alias-brand-primary); }
.sawb-tab .sawb-tab-close { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 13px; line-height: 1; padding: 0 2px; }
.sawb-switcher { position: relative; }
.sawb-float { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; width: min(420px, 70vw); max-height: 60vh; display: flex; flex-direction: column; background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.18); overflow: hidden; }
.sawb-float-body { overflow: auto; padding: 4px 0 8px; }
.sawb-editor { display: flex; max-height: calc(100vh - 300px); overflow: auto; font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; line-height: 1.55; tab-size: 2; }
.sawb-edit-area { flex: 1 1 auto; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font: inherit; padding: 10px 12px; resize: none; white-space: pre; overflow: auto; min-height: calc(100vh - 340px); tab-size: 2; }
.sawb-edit-area:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 0; }
.sawb-banner { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; padding: 6px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); font-size: 12px; }
`

// ---- client/index.js ----
/**
 * DSH 工作台（浏览器端）工厂入口。
 *
 * 分段职责：`tokens`（字典与常量）/`theme`（样式）/`highlight`（样式标签、通用小工具、
 * 只读与写接口调用）/`view-repos`（代码页：仓库、文件树、搜索、高亮只读层）/
 * `view-docs-workspaces`（工作区页、文档页，原样迁移）/`view-editor`（编辑态、标签条、
 * `☰ 文件` 面板）。
 *
 * 构建脚本 `scripts/build-client.mjs` 把本目录下的 `tokens.js`、`theme.js`、
 * `highlight.js`、`view-*.js` 与本文件按**固定顺序**拼成单文件 `client.js`。
 * 拼接结果是普通脚本（只调用 `window.__ModuleLoader__.load`），所以：
 *
 * - 各段之间不写 import / export，直接用普通函数与同作用域常量互相调用；
 * - 段的顺序由构建脚本决定（见 scripts/build-client.mjs 的 PARTS），本文件最后一段；
 * - 改完本目录必须重新构建（`npm run build:client`），否则页面看到的仍是旧 client.js。
 *
 * 顺序：tokens → theme → highlight → view-repos → view-docs-workspaces → view-editor → 本文件。
 *
 * 工厂内的代码不会泄漏成全局名（只有 `SAWB_*` 常量与入口这一个调用留在顶层，
 * 且常量名带前缀，避免和共用 bundle 里的其他插件重名）。
 *
 * **跨段共享**：`scripts/build-client.mjs` 会把前六个源码段按顺序拼成本文件里
 * `factory(require) { ... }` 的正文，因此在拼接后的结果里，段与段之间**确实共享同一个
 * 作用域**——`tokens` 段的 `SAWB_*` 常量、`highlight` 段的 `h` 与各渲染函数，都能被后续段
 * 直接使用。但直接编辑 `client/` 源码段本身时它们各自是独立文件，所以：
 *
 * - 段之间不写 import / export，直接按名字互相调用（靠拼接后的同作用域生效）；
 * - 段定义的顺序由构建脚本固定，`index.js` 永远最后拼；
 * - 改完本目录必须重新构建（`npm run build:client`），否则页面看到的仍是旧 client.js。
 */
window.__ModuleLoader__.load({
  id: 'dsh-workbench-panel',
  factory(require) {
    const React = require('react')
    // ======== 以下正文由 scripts/build-client.mjs 从 client/ 各段注入（勿手改） ========
    // ---- client/highlight.js ----
    /**
     * 样式、通用小工具与只读接口调用（A、B 两段共用）。
     *
     * 唯一的请求入口 `loadApi` 只跑 `GET /dsh-workbench-panel/api`；写接口 `postApi`
     * 也在这里定义（A 段只用它的 archive，B 段复用同一份实现）。
     */

    // 各段由构建脚本拼进 factory 内，但段与段之间不共享 `const`：渲染辅助统一在这里定义一次。
    const h = React.createElement

    function StyleTag() {
      return h('style', { 'data-plugin': SAWB_NS }, SAWB_CSS)
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

    function errorText(error) {
      return String(error && error.message ? error.message : error)
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

    function Notice({ children, tone }) {
      return h('div', { className: `sawb-notice${tone === 'error' ? ' sawb-error' : ''}`, role: 'status' }, children)
    }

    /** 文档 / 代码 / 搜索视图统一走同一个只读 API，不同 view 参数由 Host 调度。 */
    function loadApi(params, signal) {
      const search = new URLSearchParams()
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
      })
      return fetch(`${SAWB_API}?${search.toString()}`, {
        credentials: 'same-origin', signal, headers: { accept: 'application/json' },
      }).then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (data && data.error) throw new Error(data.error)
        return data
      })
    }

    function postApi(path, body) {
      return fetch(`${SAWB_API}${path}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok || data.error) {
          const error = new Error(data.error || `HTTP ${response.status}`)
          error.status = response.status
          throw error
        }
        return data
      })
    }

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

    // ---- client/view-repos.js ----
    /**
     * 代码页（子计划 A）：高亮只读渲染、仓库内搜索、文件树。
     *
     * 高亮 token 由 Host `blob` 视图给出（`tokens`：每行 `[[文本, 颜色]]`），
     * 颜色是 DSH 的 `--shiki-token-*` 映射出来的内联色值，所以明暗主题切换
     * 只要重新取一次 blob 即可跟随；取不到 token 时显示纯文本，不影响阅读。
     */
    function CodeBlock({ text }) {
      const lines = String(text || '').split('\n')
      return h('pre', { className: 'sawb-code' }, lines.map((line, index) =>
        h('span', { key: index, className: 'sawb-code-line' },
          h('span', { className: 'sawb-line-no', 'aria-hidden': true }, String(index + 1)),
          h('span', { className: 'sawb-line-text' }, line || ' '))))
    }

    /**
     * 只读代码渲染：`tokens` 来自 Host `blob` 视图（每行 `[[文本, 颜色], ...]`，
     * 颜色由 DSH 的 `--shiki-token-*` 生成），明暗主题切换后重新取 blob 即跟随；
     * `tokens` 缺省时退回纯文本，保证高亮失败不影响阅读。
     * `focusLine` 是搜索结果的行号，渲染后用 `scrollIntoView` 定位并高亮该行。
     */
    /**
     * token 颜色归一化：Host 的 `tokens` 每段是 `[文本, { color }]`（shiki 主题变量），
     * 早期约定过纯字符串；两种都接受，取不到时返回 undefined，退回继承父级颜色。
     */
    function tokenColor(token) {
      if (!token) return undefined
      const value = typeof token === 'string' ? token : token.color
      return value ? { color: value } : undefined
    }

    function CodeViewLines({ text, tokens, focusLine = 0 }) {
      const wrap = React.useRef(null)
      React.useEffect(() => {
        if (!focusLine || !wrap.current) return
        const target = wrap.current.querySelector(`[data-line="${focusLine}"]`)
        if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'center' })
      }, [focusLine, tokens, text])
      const lineClass = index => index + 1 === focusLine ? 'sawb-code-line sawb-line-hit' : 'sawb-code-line'
      if (!Array.isArray(tokens) || tokens.length === 0) {
        return h('pre', { className: 'sawb-code', ref: wrap }, String(text || '').split('\n').map((line, index) =>
          h('span', { key: index, className: lineClass(index), 'data-line': index + 1 },
            h('span', { className: 'sawb-line-no', 'aria-hidden': true }, String(index + 1)),
            h('span', { className: 'sawb-line-text' }, line || ' '))))
      }
      return h('pre', { className: 'sawb-code', ref: wrap }, tokens.map((line, index) =>
        h('span', { key: index, className: lineClass(index), 'data-line': index + 1 },
          h('span', { className: 'sawb-line-no', 'aria-hidden': true }, String(index + 1)),
          h('span', { className: 'sawb-line-text' }, (line && line.length ? line : [['', '']]).map((token, at) =>
            h('span', { key: at, style: tokenColor(token[1]) }, token[0] || ' '))))))
    }

    function Breadcrumbs({ repo, path, t, onRoot, onPath }) {
      const parts = String(path || '').split('/').filter(Boolean)
      return h('div', { className: 'sawb-crumbs', 'aria-label': t('repoPath') },
        h('button', { type: 'button', onClick: onRoot }, repo.name),
        parts.map((part, index) => h(React.Fragment, { key: index },
          h('span', null, '/'),
          h('button', { type: 'button', onClick: () => onPath(parts.slice(0, index + 1).join('/')) }, part))))
    }

    function SearchPanel({ t, repoId, onOpen }) {
      const [q, setQ] = React.useState('')
      const [mode, setMode] = React.useState('both')
      const [state, setState] = React.useState({ phase: 'idle', data: undefined, error: '' })
      const timer = React.useRef(undefined)
      React.useEffect(() => () => clearTimeout(timer.current), [])
      const run = React.useCallback((term, searchMode) => {
        const text = String(term || '').trim()
        if (text.length < 2) {
          setState({ phase: 'idle', data: undefined, error: '' })
          return
        }
        setState(previous => ({ phase: 'loading', data: previous.data, error: '' }))
        loadApi({ view: 'search', repo: repoId, q: text, mode: searchMode, limit: 50 })
          .then(data => setState({ phase: 'ready', data, error: '' }))
          .catch(failure => setState({ phase: 'error', data: undefined, error: errorText(failure) }))
      }, [repoId])
      const change = value => {
        setQ(value)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => run(value, mode), 300)
      }
      const changeMode = value => {
        setMode(value)
        if (q.trim().length >= 2) run(q, value)
      }
      const data = state.data
      return h('div', { className: 'sawb-section' },
        h('form', {
          className: 'sawb-search-form',
          onSubmit: event => { event.preventDefault(); clearTimeout(timer.current); run(q, mode) },
        },
          h('input', {
            className: 'sawb-input', type: 'search', value: q, placeholder: t('searchPlaceholder'), 'aria-label': t('searchPlaceholder'),
            onChange: event => change(event.target.value),
          }),
          ['name', 'content', 'both'].map(value => h('button', {
            key: value, type: 'button', className: 'sawb-btn sawb-btn-sm', 'aria-pressed': String(mode === value),
            onClick: () => changeMode(value),
          }, t(value === 'name' ? 'searchModeName' : value === 'content' ? 'searchModeContent' : 'searchModeBoth')))),
        state.phase === 'error'
          ? h(Notice, { tone: 'error' }, t('readFailed', { message: state.error }))
          : data
            ? h('div', { className: 'sawb-tree' },
                h('div', { className: 'sawb-tree-row' },
                  h('span', { className: 'sawb-meta' }, t('searchTotal', { n: data.total })),
                  data.truncated ? badge(t('searchTruncated'), 'muted') : null,
                  data.engine === 'scan' ? badge(t('searchScan'), 'muted') : null),
                (data.matches || []).length === 0
                  ? h('div', { className: 'sawb-empty' }, t('searchEmpty'))
                  : (data.matches || []).map((match, index) => h('button', {
                      key: `${match.path}:${match.line}:${index}`, type: 'button', className: 'sawb-tree-row', title: match.path,
                      onClick: () => onOpen(match.path, match.line),
                    },
                      h('span', { className: 'sawb-tree-icon', 'aria-hidden': true }, match.kind === 'name' ? '▸' : '·'),
                      h('span', { className: 'sawb-tree-name' }, match.kind === 'name' ? match.path : `${match.path}:${match.line}`),
                      match.text ? h('span', { className: 'sawb-meta', style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, match.text.trim()) : null)))
            : state.phase === 'loading'
              ? h('div', { className: 'sawb-meta' }, t('loadingData'))
              : h('div', { className: 'sawb-meta' }, t('searchHint')))
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

    /**
     * 代码仓库：仓库列表 → 目录树（含搜索）→ 文件内容。
     *
     * 打开文件只回调 `onOpenFile(repo, path, { line })`：B 段的标签条、编辑态与
     * 文件切换面板都挂在同一个回调上，A 段只负责列表、搜索与只读渲染。
     */
    function CodeView({ t, section, onSection, onOpenFile }) {
      const [route, setRoute] = React.useState({ kind: 'repos', repo: undefined, path: '', line: 0 })
      const [repoPage, setRepoPage] = React.useState(1)
      const [state, setState] = React.useState({ phase: 'loading', data: undefined, error: '' })

      React.useEffect(() => {
        const controller = new AbortController()
        setState({ phase: 'loading', data: undefined, error: '' })
        const params = route.kind === 'repos'
          ? { view: 'repos', offset: String((repoPage - 1) * REPO_PAGE_SIZE), limit: String(REPO_PAGE_SIZE), sort: 'updatedAt', dir: 'desc' }
          : { view: 'tree', repo: route.repo.id, path: route.path }
        loadApi(params, controller.signal)
          .then(data => setState({ phase: 'ready', data, error: '' }))
          .catch(error => {
            if (error && error.name === 'AbortError') return
            setState({ phase: 'error', data: undefined, error: errorText(error) })
          })
        return () => controller.abort()
      }, [route, repoPage])

      const openRepo = repo => setRoute({ kind: 'tree', repo, path: '', line: 0 })
      const openTree = (repo, path) => setRoute({ kind: 'tree', repo, path, line: 0 })
      // 打开文件交给外壳（B 段接管标签条与编辑态），A 段只负责把点击意图传上去。
      const openBlob = (repo, path, line) => onOpenFile(repo, path, { line: line || 0 })
      const openHit = (path, line) => openBlob(route.repo, path, line)

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
        content = h(React.Fragment, null,
          h('div', { className: 'sawb-file-head' },
            h('button', { type: 'button', className: 'sawb-btn', onClick: () => { setRepoPage(1); setRoute({ kind: 'repos', repo: undefined, path: '', line: 0 }) } }, `← ${t('backToRepos')}`),
            h('button', { type: 'button', className: 'sawb-btn', onClick: () => openTree(route.repo, '') }, t('repoPath')),
            h('span', { className: 'sawb-meta' }, t('dirCount', { n: dirs }) + ' · ' + t('fileCount', { n: entries.length - dirs }))),
          h(Breadcrumbs, { repo: route.repo, path: data.path || '', t, onRoot: () => openTree(route.repo, ''), onPath: path => openTree(route.repo, path) }),
          !data.path ? h(SearchPanel, { key: `search:${route.repo.id}`, t, repoId: route.repo.id, onOpen: openHit }) : null,
          entries.length === 0
            ? h('div', { className: 'sawb-empty' }, t('emptyTree'))
            : h('div', { className: 'sawb-tree' }, entries.map(entry => h('button', {
                key: entry.path, type: 'button', className: 'sawb-tree-row',
                onClick: () => entry.type === 'dir' ? openTree(route.repo, entry.path) : openBlob(route.repo, entry.path),
              },
                h('span', { className: 'sawb-tree-icon', 'aria-hidden': true }, entry.type === 'dir' ? '▸' : '·'),
                h('span', { className: 'sawb-tree-name' }, entry.name + (entry.type === 'dir' ? '/' : '')),
                h('span', { className: 'sawb-meta' }, entry.type === 'dir' ? '' : (entry.lang || ''))))))
      }

      return h(React.Fragment, null,
        h('div', { className: 'sawb-head' },
          h('h2', { className: 'sawb-title' }, t('reposTitle')),
          h('span', { className: 'sawb-meta' }, t('reposHint')),
          h('span', { className: 'sawb-spacer' }),
          h(Tabs, { section, t, onSection })),
        h('div', { className: 'sawb-body' }, content))
    }

    // ---- client/view-docs-workspaces.js ----
    /**
     * 工作区页与文档页（自 A 段原样迁移，接口行为未变）。
     *
     * 这两页不涉及写能力：工作区页只读 workspaceRegistry，文档页只读 Markdown
     * 索引与 blob。迁移时只调整了函数顺序，渲染逻辑逐行保持不变。
     */

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


    /** 工作区页：DSH Host 是 workspace.json 的唯一写者，这里只读展示工作区（不展示会话）。 */
    function WorkspacesView({ t, section, onSection }) {
      const [state, setState] = React.useState({ phase: 'loading', data: undefined, error: '' })
      const [page, setPage] = React.useState(1)
      const load = React.useCallback(signal => {
        setState(previous => ({ phase: 'loading', data: previous.data, error: '' }))
        loadApi({ view: 'workspaces', offset: (page - 1) * 8, limit: 8, sort: 'updatedAt', dir: 'desc' }, signal)
          .then(data => setState({ phase: 'ready', data, error: '' }))
          .catch(error => {
            if (error && error.name === 'AbortError') return
            setState({ phase: 'error', data: undefined, error: errorText(error) })
          })
      }, [page])
      React.useEffect(() => {
        const controller = new AbortController()
        load(controller.signal)
        return () => controller.abort()
      }, [load])
      const data = state.data
      const workspaces = (data && data.workspaces) || []
      const totalWorkspaces = Number(data && data.total) || 0
      return h(React.Fragment, null,
        h('div', { className: 'sawb-head' },
          h('h2', { className: 'sawb-title' }, t('workspacesTitle')),
          h('span', { className: 'sawb-meta' }, t('workspacesHint')),
          h('span', { className: 'sawb-spacer' }),
          h('span', { className: 'sawb-meta' }, t('workspaceCount', { n: totalWorkspaces })),
          h(Tabs, { section, t, onSection }),
          h('button', { type: 'button', className: 'sawb-btn', onClick: () => load() }, t('refresh'))),
        h('div', { className: 'sawb-body' },
          state.phase === 'error'
            ? h(Notice, { tone: 'error' }, t('readFailed', { message: state.error }))
            : !data
              ? h('div', { className: 'sawb-empty' }, t('loadingData'))
              : h(React.Fragment, null,
                  h('div', { className: 'sawb-grid' },
                    workspaces.map(workspace => h('article', { key: workspace.id, className: 'sawb-card' },
                      h('h3', null, workspace.title || workspace.id),
                      h('dl', { className: 'sawb-kv' },
                        h('dt', null, t('workspacePath')), h('dd', { className: 'sawb-mono', title: workspace.path }, workspace.path),
                        h('dt', null, t('workspaceCreated')), h('dd', null, when(workspace.createdAt))),
                      workspace.exists === false ? h(Notice, { tone: 'error' }, t('workspaceMissing')) : null,
                      workspace.git ? h('div', { className: 'sawb-chips' }, h('span', { className: 'sawb-chip' }, t('repoGit'))) : null))),
                  h(Pagination, { page, pageSize: 8, total: totalWorkspaces, t, onChange: setPage }))))
    }

    // ---- client/view-editor.js ----
    /**
     * 编辑与文件切换（子计划 B，浏览器端）。
     *
     * 三件套：
     * - `FileSwitcher`：文件页左上「☰ 文件」按钮 + 浮动面板（悬停 200ms 浮出、移出 150ms 收起，
     *   点击即钉住；面板内 `Alt+1` 可收起且不抢 DSH 全局快捷键）；
     * - `EditorTabs`：打开标签条，同仓库最多 `EDITOR_MAX_TABS` 个，切走时保留草稿与光标；
     * - `EditorShell` / `FileBody`：只读与编辑两态。编辑是原生 `<textarea>`（Tab 插两空格），
     *   保存走 `POST /api/write`（`expectMtimeMs` 乐观锁），撤销走 `POST /api/revert`。
     *
     * 状态全部在 `EditorShell`：切仓库即清空标签与草稿（有未保存先确认），不做跨仓库多开。
     */

    const EDITOR_MAX_TABS = 8

    function parentPath(path) {
      const text = String(path || '')
      return text.includes('/') ? text.slice(0, text.lastIndexOf('/')) : ''
    }

    function baseName(path) {
      const parts = String(path || '').split('/')
      return parts[parts.length - 1] || path
    }

    /** 是「新标签」还是「同标签」：Ctrl/Cmd+点击 或中键才新开。 */
    function wantsNewTab(event) {
      if (!event) return false
      return event.button === 1 || event.metaKey || event.ctrlKey
    }

    /** 未保存确认：返回 true 表示可以丢弃草稿继续。 */
    function confirmDiscard(t) {
      return typeof window === 'undefined' || window.confirm(t('unsavedConfirm'))
    }

    function findDraft(drafts, repoId, path) {
      return drafts.find(draft => draft.repo === repoId && draft.path === path)
    }

    /** 把一层目录项转成面板用的树节点（目录默认收起）。 */
    function nodeOf(items) {
      const node = { dirs: new Map(), files: [] }
      for (const item of items || []) {
        if (item.type === 'dir') node.dirs.set(item.name, { name: item.name, path: item.path, open: false, loading: false })
        else node.files.push({ name: item.name, path: item.path })
      }
      return node
    }

    function SwitcherNode({ node, depth, expanded, onOpenFile, onToggle }) {
      const dirs = [...node.dirs.values()].sort((left, right) => left.name.localeCompare(right.name))
      const files = [...node.files].sort((left, right) => left.path.localeCompare(right.path))
      return h('div', null,
        dirs.map(dir => {
          const state = expanded[dir.path] || { open: false, loading: false }
          return h(React.Fragment, { key: `dir:${dir.path}` },
            h('button', {
              type: 'button', className: 'sawb-doc-folder', style: { paddingLeft: 10 + depth * 14 },
              onClick: () => onToggle(dir.path),
            },
              h('span', { className: 'sawb-caret' }, state.open ? '▾' : '▸'),
              h('span', { className: 'sawb-doc-folder-name' }, dir.name)),
            state.open
              ? state.loading
                ? h('div', { className: 'sawb-meta', style: { paddingLeft: 24 + depth * 14 } }, '…')
                : h(SwitcherNode, { node: state.node || { dirs: new Map(), files: [] }, depth: depth + 1, expanded, onOpenFile, onToggle })
              : null)
        }),
        files.map(file => h('button', {
          key: file.path, type: 'button', className: 'sawb-doc-item', style: { paddingLeft: 24 + depth * 14 }, title: file.path,
          onClick: event => onOpenFile(file.path, event),
        },
          h('span', { className: 'sawb-doc-title' }, file.name),
          h('span', { className: 'sawb-doc-path' }, parentPath(file.path)))))
    }

    /** 「☰ 文件」浮动面板：逐层树（每层 limit=200）+ 文件名搜索（view=search，mode=name）。 */
    function FileSwitcher({ repo, t, onOpenFile }) {
      const [open, setOpen] = React.useState(false)
      const [pinned, setPinned] = React.useState(false)
      const [root, setRoot] = React.useState({ node: { dirs: new Map(), files: [] }, loaded: false })
      const [expanded, setExpanded] = React.useState({})
      const [q, setQ] = React.useState('')
      const [hits, setHits] = React.useState({ phase: 'idle', matches: [], error: '' })
      const boxRef = React.useRef(null)
      const hoverTimer = React.useRef(undefined)
      const hideTimer = React.useRef(undefined)

      const loadLayer = (path, signal) => loadApi({ view: 'tree', repo: repo.id, path, offset: 0, limit: 200 }, signal)

      React.useEffect(() => {
        if (!open || root.loaded) return undefined
        const controller = new AbortController()
        loadLayer('', controller.signal)
          .then(data => setRoot({ node: nodeOf(data.entries), loaded: true, truncated: data.hasMore }))
          .catch(() => setRoot(previous => ({ ...previous, loaded: true })))
        return () => controller.abort()
      }, [open, root.loaded, repo.id])

      const toggleDir = path => {
        const current = expanded[path] || { open: false }
        if (current.open) {
          setExpanded(previous => ({ ...previous, [path]: { ...current, open: false } }))
          return
        }
        setExpanded(previous => ({ ...previous, [path]: { ...current, open: true, loading: !current.node } }))
        if (current.node) return
        loadLayer(path)
          .then(data => setExpanded(previous => ({ ...previous, [path]: { open: true, loading: false, node: nodeOf(data.entries) } })))
          .catch(() => setExpanded(previous => ({ ...previous, [path]: { open: true, loading: false, node: nodeOf([]) } })))
      }

      // 搜索：只解决「层级太深找不到」，结果与目录树互斥展示。
      React.useEffect(() => {
        const term = q.trim()
        if (term.length < 2) {
          setHits({ phase: 'idle', matches: [], error: '' })
          return undefined
        }
        const controller = new AbortController()
        const timer = setTimeout(() => {
          loadApi({ view: 'search', repo: repo.id, q: term, mode: 'name', limit: 50 }, controller.signal)
            .then(data => setHits({ phase: 'ready', matches: data.matches || [], error: '' }))
            .catch(error => {
              if (error && error.name === 'AbortError') return
              setHits({ phase: 'error', matches: [], error: errorText(error) })
            })
        }, 250)
        return () => { clearTimeout(timer); controller.abort() }
      }, [q, repo.id])

      // 悬停 200ms 浮出、移出面板 150ms 收起；钉住后不自动收起。
      const hoverIn = () => {
        clearTimeout(hoverTimer.current)
        clearTimeout(hideTimer.current)
        hoverTimer.current = setTimeout(() => setOpen(true), 200)
      }
      const hoverOut = () => {
        clearTimeout(hoverTimer.current)
        if (pinned) return
        clearTimeout(hideTimer.current)
        hideTimer.current = setTimeout(() => setOpen(false), 150)
      }
      const pinToggle = () => {
        clearTimeout(hoverTimer.current)
        clearTimeout(hideTimer.current)
        setPinned(value => {
          setOpen(!value)
          return !value
        })
      }

      // 钉住时：点外部或 Esc 关闭。
      React.useEffect(() => {
        if (!pinned || !open) return undefined
        const onDown = event => {
          if (boxRef.current && !boxRef.current.contains(event.target)) {
            setPinned(false)
            setOpen(false)
          }
        }
        const onKey = event => {
          if (event.key === 'Escape') {
            setPinned(false)
            setOpen(false)
          }
        }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('mousedown', onDown)
          document.removeEventListener('keydown', onKey)
        }
      }, [pinned, open])

      // Alt+1 绑在面板节点上（不全局注册），避免与 DSH 快捷键冲突。
      const onKeyDown = event => {
        if (event.altKey && (event.code === 'Digit1' || event.key === '1')) {
          event.preventDefault()
          pinToggle()
          return
        }
        if (event.key === 'Escape' && !pinned) setOpen(false)
      }

      const openIt = (path, event) => {
        onOpenFile(path, event)
        if (!pinned) {
          clearTimeout(hideTimer.current)
          setOpen(false)
        }
      }

      const searching = q.trim().length >= 2
      return h('div', { className: 'sawb-switcher', ref: boxRef, onMouseEnter: hoverIn, onMouseLeave: hoverOut, onKeyDown },
        h('button', {
          type: 'button', className: 'sawb-btn', 'aria-pressed': String(pinned), title: t('fileSwitcherHint'),
          onClick: pinToggle,
        }, `☰ ${t('fileSwitcher')}`),
        open
          ? h('div', { className: 'sawb-float', role: 'dialog', 'aria-label': t('fileSwitcher') },
              h('div', { style: { padding: '8px 8px 4px' } },
                h('input', {
                  className: 'sawb-input', type: 'search', value: q, placeholder: t('searchPlaceholder'), 'aria-label': t('searchPlaceholder'),
                  style: { width: '100%', boxSizing: 'border-box' }, onChange: event => setQ(event.target.value),
                })),
              h('div', { className: 'sawb-float-body' },
                searching
                  ? hits.phase === 'error'
                    ? h(Notice, { tone: 'error' }, t('readFailed', { message: hits.error }))
                    : hits.phase === 'ready' && hits.matches.length === 0
                      ? h('div', { className: 'sawb-empty' }, t('searchEmpty'))
                      : hits.matches.map(match => h('button', {
                          key: match.path, type: 'button', className: 'sawb-doc-item', title: match.path,
                          onClick: event => openIt(match.path, event),
                        }, h('span', { className: 'sawb-doc-title' }, baseName(match.path)), h('span', { className: 'sawb-doc-path' }, parentPath(match.path))))
                  : !root.loaded
                    ? h('div', { className: 'sawb-meta', style: { padding: '4px 10px' } }, t('loadingData'))
                    : root.node.dirs.size === 0 && root.node.files.length === 0
                      ? h('div', { className: 'sawb-empty' }, t('emptyTree'))
                      : h(SwitcherNode, { node: root.node, depth: 0, expanded, onOpenFile: openIt, onToggle: toggleDir })))
          : null)
    }

    /** 打开标签条：路径末段 + 悬停完整路径 + 关闭 ×；未保存标签带圆点。 */
    function EditorTabs({ tabs, active, t, onSelect, onClose }) {
      if (!tabs || tabs.length === 0) return null
      return h('div', { className: 'sawb-tabsbar', role: 'tablist' },
        tabs.map(tab => h('div', { key: tab.path, className: 'sawb-tab', role: 'tab', 'aria-pressed': String(active === tab.path), title: tab.path },
          h('button', { type: 'button', className: 'sawb-tab', style: { border: 0, padding: '0 2px' }, onClick: () => onSelect(tab.path) },
            baseName(tab.path),
            tab.dirty ? h('span', { 'aria-label': t('editing'), style: { color: 'var(--dsw-alias-brand-primary)' } }, '•') : null),
          h('button', {
            type: 'button', className: 'sawb-tab-close', title: t('closeTab'), 'aria-label': t('closeTab'),
            onClick: event => { event.stopPropagation(); onClose(tab.path) },
          }, '×'))))
    }

    /**
     * 代码页外壳：仓库卡片/目录树交给 `CodeView`，文件页由本段渲染；持有标签、草稿与面板状态。
     */
    function EditorShell({ t, section, onSection }) {
      const [route, setRoute] = React.useState({ kind: 'repos' })
      const [tabs, setTabs] = React.useState([])
      const [active, setActive] = React.useState('')
      const [drafts, setDrafts] = React.useState([])
      const [notice, setNotice] = React.useState({ text: '', error: false })
      const [focusLine, setFocusLine] = React.useState(0)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState('')

      const repo = route.repo
      const repoId = repo ? repo.id : ''
      const activeDraft = drafts.find(draft => draft.repo === repoId && draft.path === active)

      const patchDraft = patch => {
        if (!active) return
        setDrafts(previous => previous.map(draft => (draft.repo === repoId && draft.path === active ? { ...draft, ...patch } : draft)))
      }

      /** 切仓库：有未保存草稿先确认；确认后清空标签与草稿。 */
      const changeRepo = next => {
        const switching = repoId && (!next.repo || next.repo.id !== repoId)
        if (switching) {
          const dirty = drafts.some(draft => draft.repo === repoId && draft.dirty)
          if (dirty && !confirmDiscard(t)) return
          setDrafts(previous => previous.filter(draft => draft.repo !== repoId))
          setTabs([])
          setActive('')
        }
        setNotice({ text: '', error: false })
        setRoute(next)
      }

      // 显式收 repoId：`openFile` 里先 setRoute 再立刻取文件，同一 tick 内闭包里的 `repoId`
      // 还是旧值（从仓库卡片/搜索进入时为空串），用闭包值会请求 `repo=` 空参数被 Host 判 400。
      const fetchFile = (repoKey, path, signal) => loadApi({ view: 'blob', repo: repoKey, path }, signal)

      // 同样显式收 repoKey：草稿的 `repo` 必须等于落库时的仓库 id，否则 `activeDraft`
      // 按 `draft.repo === repoId` 找不到它，文件页会一直空白（从卡片/搜索首次进入时）。
      const hydrate = (repoKey, data, path) => ({
        repo: repoKey, path,
        text: data.text || '',
        baseText: data.text || '',
        blocks: data.blocks || [],
        tokens: data.tokens || null,
        mtimeMs: data.mtimeMs || 0,
        size: Number(data.size),
        isDoc: Boolean(data.isDoc),
        tooLarge: Boolean(data.tooLarge),
        binary: Boolean(data.binary),
        lang: data.lang || '',
        canEdit: Boolean(data.editable),
        sel: null,
        dirty: false,
      })

      const openFile = (targetRepo, path, options = {}) => {
        if (!targetRepo || !path) return
        const newTab = options.newTab === true
        if (targetRepo.id !== repoId) {
          // 从树/搜索进入别的仓库时视为切换仓库，草稿规则一致。
          const dirty = drafts.some(draft => draft.repo === repoId && draft.dirty)
          if (repoId && dirty && !confirmDiscard(t)) return
          setDrafts(previous => previous.filter(draft => draft.repo !== targetRepo.id))
          setTabs([])
        }
        setRoute({ kind: 'file', repo: targetRepo })
        setError('')
        setFocusLine(Number(options.line) || 0)
        setNotice({ text: '', error: false })
        const already = targetRepo.id === repoId && drafts.some(draft => draft.path === path)
        if (already) {
          if (newTab && !tabs.includes(path)) {
            setTabs(previous => pushTab(previous, path, active, t, setNotice))
          }
          setActive(path)
          return
        }
        setLoading(true)
        fetchFile(targetRepo.id, path)
          .then(data => {
            const draft = hydrate(targetRepo.id, data, path)
            setDrafts(previous => [...previous.filter(item => !(item.repo === draft.repo && item.path === draft.path)), draft])
            setTabs(previous => pushTab(targetRepo.id === repoId ? previous : [], path, active, t, setNotice))
            setActive(path)
          })
          .catch(failure => setError(errorText(failure)))
          .finally(() => setLoading(false))
      }

      /** 最多 8 个标签：第 9 个替换当前标签，并提示「最多 8 个」。 */
      const pushTab = (list, path, current, translate, warn) => {
        if (list.includes(path)) return list
        if (list.length < EDITOR_MAX_TABS) return [...list, path]
        warn({ text: translate('maxTabs', { n: EDITOR_MAX_TABS }), error: false })
        const index = Math.max(0, list.indexOf(current))
        const next = [...list]
        next[index] = path
        return next
      }

      const closeTab = path => {
        const draft = findDraft(drafts, repoId, path)
        if (draft && draft.dirty && !confirmDiscard(t)) return
        const index = tabs.indexOf(path)
        const next = tabs.filter(item => item !== path)
        setDrafts(previous => previous.filter(item => !(item.repo === repoId && item.path === path)))
        setTabs(next)
        if (active === path) setActive(next[Math.min(index, next.length - 1)] || '')
      }

      /** 重载当前文件：以磁盘为准，丢弃未保存草稿。 */
      const reload = () => {
        if (!activeDraft) return
        fetchFile(activeDraft.repo, activeDraft.path)
          .then(data => setDrafts(previous => previous.map(draft => (draft.repo === repoId && draft.path === activeDraft.path
            ? { ...draft, ...hydrate(draft.repo, data, draft.path), sel: draft.sel }
            : draft))))
          .catch(failure => setNotice({ text: t('saveFailed', { message: errorText(failure) }), error: true }))
      }

      const save = () => {
        const draft = activeDraft
        if (!draft) return
        if (!window.confirm(t('confirmSave'))) return
        postApi('/write', { repo: draft.repo, path: draft.path, text: draft.text, expectMtimeMs: draft.mtimeMs })
          .then(data => {
            patchDraft({ mtimeMs: data.mtimeMs, size: data.size, dirty: false, baseText: draft.text })
            setNotice({ text: t('saveDone'), error: false })
            // 保存后重新取一次：高亮 token 与磁盘内容一致，并顺带验证缓存已失效。
            reload()
          })
          .catch(failure => {
            const conflict = Number(failure && failure.status) === 409
            setNotice({ text: conflict ? t('editConflict', { message: errorText(failure) }) : t('saveFailed', { message: errorText(failure) }), error: true })
          })
      }

      const revert = () => {
        const draft = activeDraft
        if (!draft) return
        if (!window.confirm(t('revertConfirm'))) return
        postApi('/revert', { repo: draft.repo, path: draft.path })
          .then(() => {
            setNotice({ text: t('revertDone'), error: false })
            setDrafts(previous => previous.map(item => (item.repo === draft.repo && item.path === draft.path ? { ...item, dirty: false } : item)))
            reload()
          })
          .catch(failure => setNotice({ text: t('saveFailed', { message: errorText(failure) }), error: true }))
      }

      if (route.kind !== 'file') {
        return h(CodeView, {
          t, section, onSection,
          onOpenFile: (targetRepo, path, options) => openFile(targetRepo, path, options),
        })
      }

      const draft = activeDraft
      const dirtyTabs = new Set(drafts.filter(item => item.repo === repoId && item.dirty).map(item => item.path))
      const tabList = tabs.map(path => ({ path, dirty: dirtyTabs.has(path) }))
      return h(React.Fragment, null,
        h('div', { className: 'sawb-head' },
          h('h2', { className: 'sawb-title' }, t('reposTitle')),
          h('span', { className: 'sawb-meta' }, t('reposHint')),
          h('span', { className: 'sawb-spacer' }),
          h(Tabs, { section, t, onSection })),
        h('div', { className: 'sawb-body' },
          h('div', { className: 'sawb-file-head' },
            h('button', { type: 'button', className: 'sawb-btn', onClick: () => changeRepo({ kind: 'tree', repo, path: parentPath(active) }) }, `← ${t('backToTree')}`),
            h(FileSwitcher, {
              key: `switch:${repoId}`, repo, t,
              onOpenFile: (path, event) => openFile(repo, path, { newTab: wantsNewTab(event) }),
            }),
            h('h2', { className: 'sawb-detail-title' }, baseName(active || route.path)),
            draft ? badge(draft.isDoc ? t('docFile') : (draft.lang || t('codeFile')), 'muted') : null,
            draft && Number.isFinite(draft.size) && draft.size >= 0 ? h('span', { className: 'sawb-meta' }, `${Math.ceil(draft.size / 1024)} KB`) : null,
            h('span', { className: 'sawb-spacer' }),
            draft && draft.canEdit
              ? h(React.Fragment, null,
                  h('button', { type: 'button', className: 'sawb-btn', disabled: !draft.dirty, onClick: reload }, t('reload')),
                  h('button', { type: 'button', className: 'sawb-btn', onClick: revert }, t('revert')),
                  h('button', { type: 'button', className: 'sawb-btn sawb-btn-primary', disabled: !draft.dirty, onClick: save }, t('save')))
              : null),
          h(EditorTabs, {
            tabs: tabList, active, t,
            onSelect: path => { setActive(path); setNotice({ text: '', error: false }); setFocusLine(0) },
            onClose: closeTab,
          }),
          h(Breadcrumbs, { repo, path: active || route.path || '', t, onRoot: () => changeRepo({ kind: 'tree', repo, path: '' }), onPath: path => changeRepo({ kind: 'tree', repo, path }) }),
          error ? h(Notice, { tone: 'error' }, t('readFailed', { message: error })) : null,
          notice.text ? h(Notice, { tone: notice.error ? 'error' : undefined }, notice.text) : null,
          loading && !draft
            ? h('div', { className: 'sawb-empty' }, t('loadingData'))
            : draft
              ? h(FileBody, { key: draft.path, draft, t, focusLine, onChange: (text, sel) => patchDraft({ text, sel, dirty: text !== draft.baseText }) })
              : null))
    }

    /**
     * 文件正文：超大/二进制给提示；可编辑文件给「编辑」按钮切到 textarea。
     * 编辑态只显示 textarea：保证原生输入法、撤销栈与性能；退出编辑（保存/重载）后回到高亮只读层。
     */
    function FileBody({ draft, t, focusLine, onChange }) {
      const [editing, setEditing] = React.useState(false)
      const areaRef = React.useRef(null)
      React.useEffect(() => {
        if (!editing || !areaRef.current) return
        areaRef.current.focus()
        if (draft.sel) {
          try { areaRef.current.setSelectionRange(draft.sel.start, draft.sel.end) } catch { /* 选区越界忽略 */ }
        }
      }, [editing])

      if (draft.tooLarge) return h(Notice, null, t('fileTooLarge'))
      if (draft.binary) return h(Notice, null, t('binaryFile'))
      if (draft.isDoc && !editing) return h('div', { className: 'sawb-panel' }, h(Markdown, { blocks: draft.blocks }))

      if (!draft.canEdit) {
        return h(React.Fragment, null,
          h('div', { className: 'sawb-banner' }, badge(t('notEditable'), 'muted')),
          h('div', { className: 'sawb-code-wrap' }, h(CodeViewLines, { text: draft.text, tokens: draft.tokens, focusLine })))
      }

      if (!editing) {
        return h(React.Fragment, null,
          h('div', { className: 'sawb-banner' },
            h('button', { type: 'button', className: 'sawb-btn', onClick: () => setEditing(true) }, t('edit')),
            draft.dirty ? badge(t('editing'), 'live') : null),
          h('div', { className: 'sawb-code-wrap' }, h(CodeViewLines, { text: draft.text, tokens: draft.tokens, focusLine })))
      }

      return h('div', { className: 'sawb-code-wrap' },
        h('textarea', {
          ref: areaRef,
          className: 'sawb-edit-area',
          spellCheck: false,
          wrap: 'off',
          value: draft.text,
          'aria-label': draft.path,
          onChange: event => onChange(event.target.value, { start: event.target.selectionStart, end: event.target.selectionEnd }),
          onKeyDown: event => {
            // Tab 插两个空格；不拦截其他键，保留浏览器原生撤销栈。
            if (event.key !== 'Tab' || event.shiftKey || event.altKey) return
            event.preventDefault()
            const area = event.currentTarget
            const start = area.selectionStart
            const end = area.selectionEnd
            const text = `${draft.text.slice(0, start)}  ${draft.text.slice(end)}`
            onChange(text, { start: start + 2, end: start + 2 })
            Promise.resolve().then(() => {
              if (areaRef.current) areaRef.current.setSelectionRange(start + 2, start + 2)
            })
          },
          onSelect: event => onChange(draft.text, { start: event.target.selectionStart, end: event.target.selectionEnd }),
        }))
    }
    // ======== 注入结束 ========
    // `h` 在 highlight 段里定义（与各 view 段同为工厂内函数），这里直接使用。

    /** 三个分区共用一个外壳：分区切换即整页切换，各分区按需加载。 */
    function Workbench({ t }) {
      const [section, setSection] = React.useState('workspaces')
      // 代码页由 B 段的 EditorShell 承载：它内部再切仓库卡片/目录树（CodeView）与文件页。
      if (section === 'repos') return h(Root, null, h(EditorShell, { t, section, onSection: setSection }))
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
        ctx.effect(() => ctx.locale.register(SAWB_NS, { zh: SAWB_ZH, 'zh-CN': SAWB_ZH, en: SAWB_EN }), 'dsh-workbench-panel: dictionaries')
        const t = ctx.locale.bind(SAWB_NS)
        ctx.slots.inject('main', () => ctx.slots.register(
          { name: 'main', key: SAWB_PANEL_ID, locale: SAWB_NS },
          (props) => h(Workbench, { t: props.t || t }),
        ))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
          { name: 'sidebar.panellist', id: SAWB_PANEL_ID, order: 20, label: () => t('panel'), locale: SAWB_NS },
          Icon,
        ))
      },
    }
  },
})
