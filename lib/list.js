/**
 * 列表查询公共参数：分页、归档筛选、排序白名单。
 *
 * 所有会持续增长的列表都从这里取参数，避免某个视图一次性返回全量。
 * 非法排序字段/方向回退默认值，`limit` 强制上限。
 */

export const DEFAULT_LIMIT = 10
export const MAX_LIMIT = 50

function intParam(value, fallback) {
  const number = Math.floor(Number(value))
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

/** 归档筛选统一口径：active（默认）/ archived / all，同时接受 0/1 别名。 */
export function archivedFilter(raw, fallback = 'active') {
  const value = String(raw || '').trim().toLowerCase()
  if (!value) return fallback
  if (value === '0' || value === 'active' || value === 'unarchived' || value === 'false') return 'active'
  if (value === '1' || value === 'archived' || value === 'true') return 'archived'
  if (value === 'all' || value === '*') return 'all'
  return fallback
}

export function matchesArchived(item, filter) {
  if (filter === 'all') return true
  const archived = Boolean(item && item.archived)
  return filter === 'archived' ? archived : !archived
}

/**
 * 解析列表参数。
 * @param {URLSearchParams} params
 * @param {{defaultLimit?:number,maxLimit?:number,defaultSort?:string,allowedSorts?:string[],defaultDir?:'asc'|'desc'}} options
 */
export function listParams(params, options = {}) {
  const defaultLimit = options.defaultLimit || DEFAULT_LIMIT
  const maxLimit = Math.min(options.maxLimit || MAX_LIMIT, MAX_LIMIT)
  const offset = intParam(params.get('offset'), 0)
  const requested = intParam(params.get('limit'), defaultLimit)
  const limit = Math.max(1, Math.min(requested || defaultLimit, maxLimit))
  const allowedSorts = options.allowedSorts || []
  const sort = allowedSorts.includes(String(params.get('sort') || ''))
    ? String(params.get('sort'))
    : (options.defaultSort || allowedSorts[0] || '')
  const requestedDir = String(params.get('dir') || '').toLowerCase()
  const dir = requestedDir === 'asc' || requestedDir === 'desc' ? requestedDir : (options.defaultDir || 'desc')
  return { offset, limit, sort, dir }
}

export function paginate(items, { offset, limit }) {
  const total = items.length
  const page = items.slice(offset, offset + limit)
  return {
    items: page,
    total,
    offset,
    limit,
    hasMore: offset + page.length < total,
  }
}

/** 稳定排序：先按指定字段，再按唯一键，避免翻页重复/漏项。 */
export function sortBy(items, sort, dir, valueOf, idOf = item => item && item.id) {
  const factor = dir === 'asc' ? 1 : -1
  return [...items].sort((left, right) => {
    const a = valueOf(left, sort)
    const b = valueOf(right, sort)
    if (a < b) return -1 * factor
    if (a > b) return 1 * factor
    return String(idOf(left) || '').localeCompare(String(idOf(right) || '')) * factor
  })
}

export function timeValue(value) {
  const time = Date.parse(value || '')
  return Number.isFinite(time) ? time : 0
}
