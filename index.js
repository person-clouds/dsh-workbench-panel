/**
 * Host 端：DSH 只读工作台。
 *
 * 读取 DSH workspaceRegistry 与仓库文件（Markdown、源码树、blob），通过
 * `GET /dsh-workbench-panel/api` 交给浏览器端渲染。唯一写操作是显式归档
 * 单个会话（`POST /dsh-workbench-panel/api/archive`），不读写 SA 数据库，
 * 不删除日志，也不在后台定时扫描。
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { archivedFilter, listParams, paginate, sortBy, timeValue } from './lib/list.js'
import { docsIndex, findRepo, loadRepos, repoBlob, repoSessionPage, repoTree, reposOverview } from './lib/repos.js'
import { sessionsPage, workspaceRepos, workspacesOverview } from './lib/workspaces.js'
import { createTitleCache } from './lib/title-cache.js'

export const name = 'dsh-workbench-panel'
/** webServer 提供路由，connection 提供 Host / Origin 校验与浏览器鉴权。 */
export const inject = ['webServer', 'connection']

const DEFAULT_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')

export const Config = z.object({
  dshHome: z.string().default(DEFAULT_HOME).description('DSH 主目录；会话标题缓存等状态都在其下。'),
  cacheSeconds: z.number().default(10).description('视图结果在进程内的缓存秒数。'),
  repos: z.array(z.object({
    id: z.string(),
    name: z.string().default(''),
    path: z.string(),
    mode: z.union([z.const('git'), z.const('worktree')]).default('worktree'),
    ref: z.string().default(''),
    description: z.string().default(''),
    remote: z.string().default(''),
    exclude: z.array(z.string()).default([]),
  })).default([]).description('DSH 级仓库清单；未配置时自动使用 workspaceRegistry 中的工作区路径。'),
})

/** 一次视图请求的进程内缓存：key 由请求形状决定。 */
let cache = { key: '', at: 0, value: undefined, pending: undefined }
/** 同一 Host 进程内复用标题缓存；文件路径变化（dshHome 不同）时另建实例。 */
const titleCaches = new Map()

function titleCacheOf(ctx, config) {
  const key = config.titleFile || `${config.dshHome || DEFAULT_HOME}`
  if (!titleCaches.has(key)) {
    titleCaches.set(key, createTitleCache(config, {
      warn: message => { if (ctx && ctx.logger && typeof ctx.logger.warn === 'function') ctx.logger.warn(message); else console.warn(message) },
    }))
  }
  return titleCaches.get(key)
}

/** 工作区、会话、文档、仓库、文件树等读请求共用的调度入口。 */
async function buildView(ctx, config, params) {
  const view = params.get('view') || ''
  if (view === 'workspaces') {
    const page = listParams(params, { defaultLimit: 8, maxLimit: 20, defaultSort: 'updatedAt', allowedSorts: ['updatedAt', 'createdAt', 'title', 'id'], defaultDir: 'desc' })
    return {
      generatedAt: new Date().toISOString(),
      ...(await workspacesOverview(ctx, {
        ...page,
        archived: archivedFilter(params.get('archived'), 'active'),
        cache: titleCacheOf(ctx, config),
        sessionLimit: Math.max(1, Math.min(Number(params.get('sessionLimit')) || 10, 20)),
      })),
    }
  }
  if (view === 'sessions') {
    const page = listParams(params, { defaultLimit: 10, maxLimit: 50, defaultSort: 'createdAt', allowedSorts: ['createdAt', 'id', 'title'], defaultDir: 'desc' })
    return {
      generatedAt: new Date().toISOString(),
      ...(await sessionsPage(ctx, {
        ...page,
        workspace: params.get('workspace') || 'ungrouped',
        archived: archivedFilter(params.get('archived'), 'active'),
        cache: titleCacheOf(ctx, config),
      })),
    }
  }
  if (view === 'docRepos') {
    const repos = await loadRepos(config, workspaceRepos(ctx))
    const page = listParams(params, { defaultLimit: 12, maxLimit: 50, defaultSort: 'name', allowedSorts: ['name', 'id', 'source'], defaultDir: 'asc' })
    const ordered = sortBy(repos, page.sort, page.dir, (repo, field) => field === 'name' ? repo.name : field === 'source' ? repo.source : repo.id, repo => repo.id)
    const result = paginate(ordered, page)
    return {
      generatedAt: new Date().toISOString(),
      repos: result.items.map(repo => ({ id: repo.id, name: repo.name, description: repo.description, source: repo.source })),
      total: result.total,
      offset: result.offset,
      limit: result.limit,
      hasMore: result.hasMore,
      sort: page.sort,
      dir: page.dir,
    }
  }
  if (view === 'docs') {
    const repos = await loadRepos(config, workspaceRepos(ctx))
    return {
      generatedAt: new Date().toISOString(),
      groups: await docsIndex(repos, params.get('repo') || ''),
    }
  }
  if (view === 'repos') {
    const repos = await loadRepos(config, workspaceRepos(ctx))
    const page = listParams(params, { defaultLimit: 4, maxLimit: 50, defaultSort: 'updatedAt', allowedSorts: ['updatedAt', 'name', 'id', 'source'], defaultDir: 'desc' })
    // 仓库更新时间取最新提交时间（非 git 目录回退到 mtime），先对全量排序再分页。
    const overview = await reposOverview(repos)
    const ordered = sortBy(overview, page.sort, page.dir, (repo, field) => {
      if (field === 'updatedAt') return timeValue(repo.updatedAt)
      if (field === 'name') return repo.name
      if (field === 'source') return repo.source
      return repo.id
    }, repo => repo.id)
    const result = paginate(ordered, page)
    return {
      generatedAt: new Date().toISOString(),
      repos: result.items,
      total: result.total,
      offset: result.offset,
      limit: result.limit,
      hasMore: result.hasMore,
      sort: page.sort,
      dir: page.dir,
    }
  }
  if (view === 'repoSessions') {
    const repos = await loadRepos(config, workspaceRepos(ctx))
    const repo = findRepo(repos, params.get('repo') || '')
    if (!repo) return { error: `找不到仓库：${params.get('repo') || ''}` }
    const page = listParams(params, { defaultLimit: 10, maxLimit: 50, defaultSort: 'createdAt', allowedSorts: ['createdAt', 'id', 'title'], defaultDir: 'desc' })
    return {
      generatedAt: new Date().toISOString(),
      ...(await repoSessionPage(ctx, repo, {
        ...page,
        archived: archivedFilter(params.get('archived'), 'active'),
      }, titleCacheOf(ctx, config))),
    }
  }
  if (view === 'tree' || view === 'blob') {
    const repos = await loadRepos(config, workspaceRepos(ctx))
    const repo = findRepo(repos, params.get('repo') || '')
    if (!repo) return { error: `找不到仓库：${params.get('repo') || ''}` }
    const treePage = listParams(params, { defaultLimit: 50, maxLimit: 50, defaultSort: 'name', allowedSorts: ['name'], defaultDir: 'asc' })
    const result = view === 'tree'
      ? await repoTree(repo, params.get('path') || '', treePage)
      : await repoBlob(repo, params.get('path') || '')
    return {
      generatedAt: new Date().toISOString(),
      repo: { id: repo.id, name: repo.name, description: repo.description, mode: repo.mode, ref: repo.ref },
      ...result,
    }
  }
  return { error: `未知视图：${view}` }
}

function cached(key, ttlSeconds, build) {
  const now = Date.now()
  const fresh = cache.value && cache.key === key && now - cache.at < ttlSeconds * 1000
  if (fresh) return Promise.resolve(cache.value)
  if (cache.pending && cache.key === key) return cache.pending
  cache.key = key
  cache.pending = build()
    .then(value => {
      cache = { key, at: Date.now(), value, pending: undefined }
      return value
    })
    .catch(error => {
      cache.pending = undefined
      throw error
    })
  return cache.pending
}

function cachedView(ctx, config, params) {
  return cached(`view:${params.toString()}`, config.cacheSeconds, () => buildView(ctx, config, params))
}

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(body)
}

async function readJsonBody(req, maxBytes = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk)
    size += bytes.length
    if (size > maxBytes) throw new Error(`请求体超过 ${maxBytes} 字节`)
    chunks.push(bytes)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

/** 注册 `/dsh-workbench-panel/api`：只读视图 + 显式归档单个会话。 */
function serveRoute(ctx, config) {
  const rejection = req => (ctx.connection.requestRejection ? ctx.connection.requestRejection({ headers: req.headers }) : undefined)
  return async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost')
    const refusal = rejection(req)
    if (refusal !== undefined) {
      res.writeHead(refusal, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(refusal === 401 ? 'unauthorized' : 'forbidden')
      return
    }
    if (url.pathname === '/dsh-workbench-panel/api/archive') {
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'POST' })
        res.end()
        return
      }
      try {
        const body = await readJsonBody(req)
        const sessionId = String(body.sessionId || '').trim()
        if (!sessionId) return json(res, 400, { error: '缺少 sessionId' })
        const registry = ctx.get('workspaceRegistry')
        if (!registry || typeof registry.archiveSession !== 'function') return json(res, 503, { error: 'workspaceRegistry 不可用' })
        const archived = Array.isArray(registry.archivedSessionIds) && registry.archivedSessionIds.includes(sessionId)
        if (!archived) await registry.archiveSession(sessionId, { stopActivity: true })
        return json(res, 200, { ok: true, archived: true, sessionId })
      } catch (error) {
        return json(res, 500, { error: String(error && error.message ? error.message : error) })
      }
    }
    if (url.pathname !== '/dsh-workbench-panel/api') {
      json(res, 404, { error: '未知路由' })
      return
    }
    if (req.method !== 'GET') {
      res.writeHead(405, { allow: 'GET, POST' })
      res.end()
      return
    }
    const view = url.searchParams.get('view') || ''
    if (!view) return json(res, 400, { error: '缺少 view 参数' })
    try {
      const value = await cachedView(ctx, config, url.searchParams)
      const failed = value && value.error && !value.groups && !value.repos && !value.entries && !value.path && !value.workspaces && !value.sessions && !value.repo
      json(res, failed ? 400 : 200, value)
    } catch (error) {
      json(res, 500, { error: String(error && error.message ? error.message : error) })
    }
  }
}

export function apply(ctx, config) {
  const route = {
    kind: 'prefix',
    path: '/dsh-workbench-panel/api',
    handler: serveRoute(ctx, config),
  }
  ctx.effect(() => ctx.webServer.register(route), 'dsh-workbench-panel: api route')
  ctx.logger.info('dsh-workbench-panel ready: repos=%s', (config.repos || []).length)
}
