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
