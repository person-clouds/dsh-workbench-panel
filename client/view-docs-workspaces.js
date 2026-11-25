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

