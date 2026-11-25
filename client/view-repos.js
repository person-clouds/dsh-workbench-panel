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
