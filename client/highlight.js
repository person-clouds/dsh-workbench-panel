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
