/**
 * DSH 工作区与仓库来源。
 *
 * 工作区注册、归档集合和 pin 集合都只读 `ctx.workspaceRegistry`；
 * 会话标题/类型来自 `sessionCatalog`（sessionQuery 投影）。
 * “未分组”是 DSH 客户端同样采用的合成分组：不属于任何工作区的会话。
 */

import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { matchesArchived, paginate, sortBy } from './list.js'
import { hydrateSessionTitles, sessionCatalog, sessionKind } from './sessions.js'

const SESSION_SORTS = ['createdAt', 'id', 'title', 'kind']
const WORKSPACE_SORTS = ['updatedAt', 'createdAt', 'title', 'id']

function sessionValue(session, field) {
  if (field === 'createdAt') return Number(session.createdAt || 0)
  if (field === 'kind') return session.kind || ''
  if (field === 'title') return session.title || ''
  return String(session.id || '')
}

function workspaceValue(workspace, field) {
  if (field === 'updatedAt' || field === 'createdAt') return Number(workspace[field] || 0)
  if (field === 'title') return workspace.title || ''
  return String(workspace.id || '')
}

function sessionOf(known, id, archivedSet) {
  return {
    id,
    title: known ? known.title : '',
    createdAt: known ? known.createdAt : 0,
    archived: Boolean(known ? known.archived : archivedSet.has(id)),
    pinned: Boolean(known ? known.pinned : false),
    kind: known ? known.kind : sessionKind(id),
    live: known ? known.live : false,
    origin: known ? known.origin : '',
  }
}

/** 工作区快照：分页后的工作区 + 每张卡片当前页会话预览。 */
export async function workspacesOverview(ctx, options = {}) {
  const registry = ctx.get('workspaceRegistry')
  if (!registry) return { error: '当前 DSH Host 没有 workspaceRegistry，无法读取工作区。', workspaces: [], ungrouped: { sessions: [] } }
  const archived = options.archived || 'active'
  const sessionLimit = Math.max(1, Math.min(Number(options.sessionLimit) || 10, 20))
  const catalog = await sessionCatalog(ctx, { archived, cache: options.cache })
  const byId = new Map(catalog.sessions.map(session => [session.id, session]))
  const archivedSet = new Set(registry.archivedSessionIds || [])
  const owned = new Set()
  const workspaces = await Promise.all(registry.list().map(async workspace => {
    let status = 'ok'
    try { status = await workspace.status() } catch { status = 'unknown' }
    const ids = (workspace.sessionIds || []).map(String)
    ids.forEach(id => owned.add(id))
    const sessions = ids
      .map(id => sessionOf(byId.get(id), id, archivedSet))
      .filter(session => session.origin !== 'subagent' && matchesArchived(session, archived))
      .sort((left, right) => right.createdAt - left.createdAt || String(left.id).localeCompare(String(right.id)))
    return {
      id: String(workspace.id),
      title: workspace.title,
      path: workspace.path,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      status,
      exists: existsSync(workspace.path),
      git: existsSync(join(workspace.path, '.git')),
      sessions: sessions.slice(0, sessionLimit),
      sessionTotal: sessions.length,
      sessionHasMore: sessions.length > sessionLimit,
    }
  }))
  // 与 DSH 浏览器端一致：排除 subagent 会话；未分组不是工作区，不写回 registry。
  const ungroupedSessions = catalog.sessions
    .filter(session => !owned.has(session.id) && session.origin !== 'subagent')
    .map(session => ({ ...session }))
  const sorted = sortBy(workspaces, options.sort || 'updatedAt', options.dir || 'desc', workspaceValue)
  const page = paginate(sorted, { offset: options.offset || 0, limit: options.limit || 8 })
  const ungroupedPage = ungroupedSessions.slice(0, sessionLimit)
  // 分页与卡片切片确定后才读标题：每次只读当前可见的当前页。
  await Promise.all(page.items.map(workspace => hydrateSessionTitles(ctx, workspace.sessions, options.cache)))
  await hydrateSessionTitles(ctx, ungroupedPage, options.cache)
  const totalSessions = workspaces.reduce((sum, workspace) => sum + workspace.sessionTotal, 0) + ungroupedSessions.length
  return {
    workspaces: page.items,
    ungrouped: {
      title: '未分组',
      sessions: ungroupedPage,
      sessionTotal: ungroupedSessions.length,
      sessionHasMore: ungroupedSessions.length > sessionLimit,
    },
    counts: {
      workspaces: workspaces.length,
      sessions: totalSessions,
      ungrouped: ungroupedSessions.length,
    },
    total: page.total,
    offset: page.offset,
    limit: page.limit,
    hasMore: page.hasMore,
    archived,
    sort: options.sort || 'updatedAt',
    dir: options.dir || 'desc',
    sessionError: catalog.error,
    archivedCount: archivedSet.size,
    pinnedCount: new Set(registry.pinnedSessionIds || []).size,
  }
}

/** 单个工作区/未分组的会话分页；供卡片“下一页”按需加载。 */
export async function sessionsPage(ctx, options = {}) {
  const registry = ctx.get('workspaceRegistry')
  if (!registry) return { error: '当前 DSH Host 没有 workspaceRegistry，无法读取会话。', sessions: [], total: 0, hasMore: false }
  const archived = options.archived || 'active'
  const catalog = await sessionCatalog(ctx, { archived, cache: options.cache })
  const archivedSet = new Set(registry.archivedSessionIds || [])
  const byId = new Map(catalog.sessions.map(session => [session.id, session]))
  const scope = String(options.workspace || '')
  let sessions
  if (scope === 'ungrouped') {
    const owned = new Set()
    for (const workspace of registry.list()) for (const id of (workspace.sessionIds || [])) owned.add(String(id))
    sessions = catalog.sessions.filter(session => !owned.has(session.id) && session.origin !== 'subagent')
  } else {
    const workspace = registry.list().find(item => String(item.id) === scope)
    if (!workspace) return { error: `找不到工作区：${scope}`, sessions: [], total: 0, hasMore: false }
    sessions = (workspace.sessionIds || []).map(id => sessionOf(byId.get(String(id)), String(id), archivedSet))
      .filter(session => session.origin !== 'subagent' && matchesArchived(session, archived))
  }
  const sort = options.sort || 'createdAt'
  const dir = options.dir || 'desc'
  // 标题排序必须先补全标题；其他排序只在分页后补当前页。
  if (sort === 'title') await hydrateSessionTitles(ctx, sessions, options.cache)
  const sorted = sortBy(sessions, sort, dir, sessionValue)
  const page = paginate(sorted, { offset: options.offset || 0, limit: options.limit || 10 })
  if (sort !== 'title') await hydrateSessionTitles(ctx, page.items, options.cache)
  return {
    sessions: page.items,
    total: page.total,
    offset: page.offset,
    limit: page.limit,
    hasMore: page.hasMore,
    archived,
    sort,
    dir,
    error: catalog.error,
    sessionSorts: SESSION_SORTS,
    workspaceSorts: WORKSPACE_SORTS,
  }
}

/** 把工作区路径转成代码浏览器的仓库条目；同一路径只出现一次。 */
export function workspaceRepos(ctx, limit = 80) {
  const registry = ctx.get('workspaceRegistry')
  if (!registry) return []
  const repos = []
  const seen = new Set()
  for (const workspace of registry.list()) {
    const path = workspace.path
    if (!path || seen.has(path) || !existsSync(path)) continue
    seen.add(path)
    repos.push({
      id: `workspace-${String(workspace.id).slice(0, 8)}`,
      name: workspace.title || basename(path),
      path,
      mode: 'worktree',
      ref: '',
      description: 'DSH 工作区',
      remote: '',
      exclude: [],
      source: 'workspace',
    })
    if (repos.length >= limit) break
  }
  return repos
}
