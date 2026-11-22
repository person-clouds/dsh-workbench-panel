/**
 * DSH 会话目录：标题、cwd、归档/pin 与类型。
 *
 * 标题不在 SessionHeader 里。DSH 的实时投影/持久化投影缓存可以在零日志
 * 读取下回答大部分标题；归档会话随后由 `lib/title-cache.js` 永久缓存。
 * 只有当前页中仍缺标题的会话才调用 `readTitleSnapshots`，绝不批量扫描
 * 历史日志。这里只读，不创建、不修改任何 Session。
 */

import { matchesArchived } from './list.js'

/** 会话类型：本插件不区分 SA 角色，统一按普通会话展示。 */
export function sessionKind() {
  return 'session'
}

function recordFromSession(session) {
  const header = session && (session.header || session.meta || {})
  const id = String((header && header.id) || (session && session.id) || '')
  if (!id) return undefined
  return {
    header: {
      id,
      createdAt: Number(header.createdAt || 0),
      cwd: header.cwd ? String(header.cwd) : '',
      origin: header.origin,
      parentSession: header.parentSession,
      isSeeded: Boolean(header.isSeeded),
    },
    live: true,
    persisted: false,
  }
}

/** 从 DSH 实时投影或持久化投影缓存读取标题；两者都零日志读取。 */
function projectedTitle(ctx, record) {
  const header = record && record.header || {}
  const id = String(header.id || '')
  if (!id) return ''
  try {
    const sessions = ctx.get('sessions')
    const live = sessions && typeof sessions.get === 'function' ? sessions.get(id) : undefined
    const projections = ctx.get('sessionProjections')
    if (live && projections && typeof projections.snapshot === 'function') {
      const snapshot = projections.snapshot(live, ['title'])
      const title = snapshot && snapshot.values && snapshot.values.title
      if (title) return String(title)
    }
    const projectionCache = ctx.get('sessionProjectionCache')
    if (projectionCache && typeof projectionCache.cachedSnapshot === 'function') {
      let snapshot = projectionCache.cachedSnapshot(header, ['title'])
      if (!snapshot && typeof projectionCache.cachedPredecessorTitle === 'function') {
        snapshot = projectionCache.cachedPredecessorTitle(header)
      }
      const title = snapshot && snapshot.values && snapshot.values.title
      if (title) return String(title)
    }
  } catch { /* 投影缺失或过期时回退到永久标题缓存 */ }
  return ''
}

function titleRecord(session) {
  return {
    id: session.id,
    title: String(session.title || ''),
    createdAt: Number(session.createdAt || 0),
    kind: session.kind || sessionKind(session.id),
    cwd: String(session.cwd || ''),
    archived: Boolean(session.archived),
  }
}

/**
 * 读取当前 Host 的会话目录。
 * 默认只返回未归档会话；需要全部/已归档时必须显式传 archived=all|archived。
 * 此函数不读日志：标题只取 DSH 投影与永久标题缓存，缺标题留给当前页补。
 * @returns {{sessions: Array<object>, error: string, titles: number}}
 */
export async function sessionCatalog(ctx, options = {}) {
  const registry = ctx.get('workspaceRegistry')
  const archived = new Set(registry && registry.archivedSessionIds ? registry.archivedSessionIds : [])
  const pinned = new Set(registry && registry.pinnedSessionIds ? registry.pinnedSessionIds : [])
  const archiveFilter = options.archived || 'active'
  const query = ctx.get('sessionQuery')
  let records = []
  let error = ''
  if (query && typeof query.listSessions === 'function') {
    try {
      records = await query.listSessions()
    } catch (failure) {
      error = String(failure && failure.message ? failure.message : failure)
    }
  }
  if (records.length === 0) {
    const store = ctx.get('sessions')
    if (store && typeof store.list === 'function') {
      try { records = store.list().map(recordFromSession).filter(Boolean) } catch { /* 保底失败时返回空目录 */ }
    }
  }

  // 先按归档状态过滤，标题仍只做零日志投影/缓存查询。
  const prelim = records.map(record => {
    const header = record.header || {}
    const id = String(header.id || '')
    return {
      id,
      title: projectedTitle(ctx, record),
      createdAt: Number(header.createdAt || 0),
      cwd: header.cwd ? String(header.cwd) : '',
      origin: header.origin || '',
      parentSession: header.parentSession ? String(header.parentSession) : '',
      seeded: Boolean(header.isSeeded),
      live: Boolean(record.live),
      persisted: Boolean(record.persisted),
      archived: archived.has(id),
      pinned: pinned.has(id),
      kind: sessionKind(id),
    }
  }).filter(session => session.id && matchesArchived(session, archiveFilter))

  // 永久标题缓存兜底；这里只读一个 JSON 文件。
  const cache = options.cache
  if (cache && typeof cache.getMany === 'function') {
    try {
      const cached = await cache.getMany(prelim.map(session => session.id))
      for (const session of prelim) {
        const record = cached.get(session.id)
        if (record && record.title) session.title = String(record.title)
      }
    } catch { /* 缓存损坏时继续走按页补标题 */ }
  }

  const sessions = prelim
  sessions.sort((left, right) => right.createdAt - left.createdAt || String(left.id).localeCompare(String(right.id)))
  return { sessions, error, titles: sessions.filter(session => session.title).length }
}

/**
 * 只为传入的当前页会话补标题：先查永久缓存，命中的会话不读日志；
 * 未命中的 id 去重后一次 `readTitleSnapshots`，成功结果写回永久缓存。
 * @param {object} ctx DSH Host 上下文
 * @param {Array<object>} sessions 当前页会话（原地补 title）
 * @param {object} cache SessionTitleCache 实例
 * @returns {Promise<{read:number,cached:number}>} 本次读日志与缓存命中的数量
 */
export async function hydrateSessionTitles(ctx, sessions, cache) {
  const items = (sessions || []).filter(session => session && session.id)
  if (items.length === 0) return { read: 0, cached: 0 }
  const ids = [...new Set(items.map(session => String(session.id)))]
  const known = cache && typeof cache.getMany === 'function' ? await cache.getMany(ids) : new Map()
  const pendingWrites = []
  const missing = []
  for (const session of items) {
    const id = String(session.id)
    const record = known.get(id)
    if (record && record.title) {
      session.title = String(record.title)
      continue
    }
    if (session.title) {
      pendingWrites.push(titleRecord(session))
      continue
    }
    missing.push(session)
  }

  const query = ctx.get('sessionQuery')
  let read = 0
  if (missing.length > 0 && query && typeof query.readTitleSnapshots === 'function') {
    const uniqueIds = [...new Set(missing.map(session => String(session.id)))]
    read = uniqueIds.length
    try {
      const results = await query.readTitleSnapshots(uniqueIds)
      const byId = new Map(missing.map(session => [String(session.id), session]))
      for (const result of results || []) {
        if (!result || result.status !== 'fulfilled' || !result.value || !result.value.title) continue
        const session = byId.get(String(result.sessionId))
        if (!session) continue
        session.title = String(result.value.title.title || '')
        if (session.title) pendingWrites.push(titleRecord(session))
      }
    } catch { /* 单次日志读取失败不阻塞列表，保留“未命名会话” */ }
  }

  if (cache && typeof cache.put === 'function' && pendingWrites.length > 0) {
    try { await cache.put(pendingWrites) } catch { /* 缓存写失败只告警 */ }
  }
  return { read, cached: items.length - missing.length }
}
