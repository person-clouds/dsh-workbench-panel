/**
 * 工作区页与文档页（自 A 段原样迁移，接口行为未变）。
 *
 * 工作区页只读 workspaceRegistry。文档页读取 Markdown 索引与 blob；
 * blob 带 `editable` 时文档页可按「编辑源文」直接改 Markdown（写路径复用
 * `POST /api/write`、`expectMtimeMs` 乐观锁，编辑器复用 `EditorPane` 高亮叠层）。
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
  const [edit, setEdit] = React.useState({ on: false, text: '', baseText: '', sel: null, mtimeMs: 0, notice: '', error: false, saving: false })
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
    setEdit({ on: false, text: '', baseText: '', sel: null, mtimeMs: 0, notice: '', error: false, saving: false })
    const controller = new AbortController()
    loadApi({ view: 'blob', repo: repo.id, path }, controller.signal)
      .then(data => setDoc({ phase: 'ready', repo, data, error: '' }))
      .catch(error => setDoc({ phase: 'error', repo, data: undefined, error: errorText(error) }))
  }

  /** 重新取一次 blob：保存后用磁盘内容刷新预览块与高亮 token。 */
  const refreshDoc = () => loadApi({ view: 'blob', repo: doc.repo.id, path: doc.data.path })
    .then(data => setDoc(previous => ({ ...previous, data })))
    .catch(error => setEdit(previous => ({ ...previous, notice: t('readFailed', { message: errorText(error) }), error: true })))

  /** 保存 Markdown：两步确认 → `POST /api/write`（`expectMtimeMs` 乐观锁）→ 刷新预览块。 */
  const saveDoc = () => {
    if (!doc.data || !edit.on) return
    if (!window.confirm(t('confirmSave'))) return
    setEdit(previous => ({ ...previous, saving: true }))
    postApi('/write', {
      repo: doc.repo.id, path: doc.data.path, text: edit.text, expectMtimeMs: edit.mtimeMs,
    })
      .then(data => {
        setEdit(previous => ({
          ...previous, saving: false, mtimeMs: data.mtimeMs, baseText: previous.text,
          notice: t('saveDone'), error: false,
        }))
        return refreshDoc()
      })
      .catch(failure => {
        const conflict = Number(failure && failure.status) === 409
        setEdit(previous => ({
          ...previous, saving: false, error: true,
          notice: conflict ? t('editConflict', { message: errorText(failure) }) : t('saveFailed', { message: errorText(failure) }),
        }))
      })
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
                  badge(doc.data.path, 'muted'),
                  h('span', { className: 'sawb-spacer' }),
                  doc.data.editable && !doc.data.tooLarge
                    ? (edit.on
                        ? h(React.Fragment, null,
                            edit.notice ? h(Notice, { tone: edit.error ? 'error' : undefined }, edit.notice) : null,
                            h('button', { type: 'button', className: 'sawb-btn', onClick: () => setEdit(previous => ({
                              ...previous, on: false,
                              // 退出编辑保留草稿：再次点「编辑源文」可继续改
                            })) }, t('previewMode')),
                            h('button', {
                              type: 'button', className: 'sawb-btn', disabled: edit.saving || edit.text === edit.baseText,
                              onClick: () => saveDoc(),
                            }, edit.saving ? t('saving') : t('save')))
                        : h('button', {
                            type: 'button', className: 'sawb-btn',
                            // 注意：这里是对象字面量，不能写 `sel: null` 之外的简写；
                            // 早期误写成 `sel`（省略键名）导致运行期 ReferenceError: sel is not defined，
                            // 点「编辑源文」直接崩掉整个面板（slot entry crashed）。
                            onClick: () => setEdit({
                              on: true, text: doc.data.text || '', baseText: doc.data.text || '',
                              sel: null, mtimeMs: doc.data.mtimeMs || 0, notice: '', error: false, saving: false,
                            }),
                          }, t('editMarkdown')))
                    : null,
                  doc.data.editable ? null : badge(t('notEditable'), 'muted')),
                doc.data.tooLarge
                  ? h(Notice, null, t('fileTooLarge'))
                  : edit.on
                    ? h('div', { className: 'sawb-code-wrap' },
                        h(EditorPane, {
                          // tokens/lang 必须来自 blob（Host 侧 shiki 结果）：早期写死
                          // `tokens: null, lang: ''`，文档编辑态只有纯白字、无任何着色。
                          t, value: edit.text, tokens: doc.data.tokens, lang: doc.data.lang, scrollKey: doc.data.path,
                          selection: edit.sel,
                          onText: (text, sel) => setEdit(previous => ({ ...previous, text, sel })),
                          onSel: sel => setEdit(previous => ({ ...previous, sel })),
                        }))
                    : h(React.Fragment, null,
                        h('div', { className: 'sawb-banner' },
                          badge(t('previewMode'), 'muted'),
                          h('span', { className: 'sawb-meta' }, t('docsReadOnlyHint'))),
                        h('div', { className: 'sawb-panel' }, h(Markdown, { blocks: doc.data.blocks }))))))
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

