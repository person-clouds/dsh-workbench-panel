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
    h('div', { className: 'sawb-editor-stack' },
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
      })))
}
