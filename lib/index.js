/**
 * Host 端：DSH 可看可改工作台。
 *
 * 读取 DSH workspaceRegistry 与仓库文件（Markdown、源码树、blob），通过
 * `GET /dsh-workbench-panel/api?view=xxx` 交给浏览器端渲染。写操作只有两种：
 * - `POST /dsh-workbench-panel/api/archive`：显式归档单个会话（原有实现）；
 * - `POST /dsh-workbench-panel/api/write` / `.../revert`：编辑态保存与撤销
 *   （`lib/write.js`，受 `writeEnabled` 开关约束）。
 *
 * 本文件是可插拔的 Host 骨架：视图走 `views` 注册表，POST 走 `posts` 注册表；
 * 其他子计划（如代码搜索）只需 `registerView` / `registerPost` 即可扩展，
 * 不必改 `serveRoute`。仓根 `index.js` 只做入口转发。
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { listParams, paginate, sortBy, timeValue } from './list.js'
import { docsIndex, findRepo, loadRepos, repoBlob, repoTree, reposOverview } from './repos.js'
import { workspaceRepos, workspacesOverview } from './workspaces.js'
import { revertBlob, writeBlob } from './write.js'
import { searchRepo } from './code.js'
import { highlightAvailable, highlightLines, highlightSupported, resolveInstallDir } from './highlight.js'

export const name = 'dsh-workbench-panel'
/** webServer 提供路由，connection 提供 Host / Origin 校验与浏览器鉴权。 */
export const inject = ['webServer', 'connection']

const DEFAULT_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')

export const Config = z.object({
  dshHome: z.string().default(DEFAULT_HOME).description('DSH 主目录；会话标题缓存等状态都在其下。'),
  cacheSeconds: z.number().default(10).description('视图结果在进程内的缓存秒数。'),
  writeEnabled: z.boolean().default(true).description('允许在代码页直接保存/撤销工作区文件；置 false 即回到只读档。'),
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
/**
 * 视图注册表：视图名 → `(ctx, config, params) => object`。
 * 新增视图（如 A 段的 `search`）只需在此登记，`buildView` 与缓存层自动生效。
 */
const views = new Map()

/** 登记一个 GET 视图；同名重复登记以后登记者为准（便于测试覆盖）。 */
export function registerView(viewName, builder) {
  views.set(viewName, builder)
  return builder
}

/**
 * POST 路由注册表：`/dsh-workbench-panel/api/<name>` → handler。
 * handler 签名 `async (ctx, config, body) => ({ status, body })`；只返回对象也可
 * （视为 body + 200）。抛错时按 `error.status`（400/403/409/413）映射，缺省 500。
 */
const posts = new Map()

/** 登记一个 POST 子路由。 */
export function registerPost(name, handler) {
  posts.set(name, handler)
  return handler
}

/** 工作区、会话、文档、仓库、文件树等读请求共用的调度入口。 */
export async function buildView(ctx, config, params) {
  const view = params.get('view') || ''
  const builder = views.get(view)
  if (!builder) return { error: `未知视图：${view}` }
  return builder(ctx, config, params)
}

// —— 内置视图：工作区（面板不展示会话，因此没有 archived/sessionLimit 参数）——
registerView('workspaces', async (ctx, config, params) => {
  const page = listParams(params, { defaultLimit: 8, maxLimit: 20, defaultSort: 'updatedAt', allowedSorts: ['updatedAt', 'createdAt', 'title', 'id'], defaultDir: 'desc' })
  return {
    generatedAt: new Date().toISOString(),
    ...(await workspacesOverview(ctx, page)),
  }
})

// —— 内置视图：文档仓库列表 ——
registerView('docRepos', async (ctx, config, params) => {
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
})

// —— 内置视图：文档索引 ——
registerView('docs', async (ctx, config, params) => {
  const repos = await loadRepos(config, workspaceRepos(ctx))
  return {
    generatedAt: new Date().toISOString(),
    groups: await docsIndex(repos, params.get('repo') || ''),
  }
})

// —— 内置视图：仓库列表 ——
registerView('repos', async (ctx, config, params) => {
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
})

// —— 内置视图：仓库内搜索（文件名 + 内容）——
// 参数：repo、q（2–200 字符，非法由 lib/code.js 抛 status:400）、mode（name|content|both）、offset、limit（≤100）。
// 成功体必带 `matches` 数组（serveRoute 的 400 判定据此区分）；同一查询走 `cachedView` 缓存。
registerView('search', async (ctx, config, params) => {
  const repos = await loadRepos(config, workspaceRepos(ctx))
  const repo = findRepo(repos, params.get('repo') || '')
  if (!repo) return { error: `找不到仓库：${params.get('repo') || ''}` }
  const result = await searchRepo(repo, {
    q: params.get('q') || '',
    mode: params.get('mode') || '',
    offset: params.get('offset'),
    limit: params.get('limit'),
  })
  return {
    generatedAt: new Date().toISOString(),
    repo: { id: repo.id, name: repo.name, description: repo.description, mode: repo.mode, ref: repo.ref },
    ...result,
  }
})

// —— 内置视图：文件树 / 文件内容 ——
registerView('tree', async (ctx, config, params) => {
  const repos = await loadRepos(config, workspaceRepos(ctx))
  const repo = findRepo(repos, params.get('repo') || '')
  if (!repo) return { error: `找不到仓库：${params.get('repo') || ''}` }
  // 文件树每层全部返回，不再分页；搜索视图上限另定，不在此放开。
  const result = await repoTree(repo, params.get('path') || '')
  return {
    generatedAt: new Date().toISOString(),
    repo: { id: repo.id, name: repo.name, description: repo.description, mode: repo.mode, ref: repo.ref },
    ...result,
  }
})

registerView('blob', async (ctx, config, params) => {
  const repos = await loadRepos(config, workspaceRepos(ctx))
  const repo = findRepo(repos, params.get('repo') || '')
  if (!repo) return { error: `找不到仓库：${params.get('repo') || ''}` }
  const result = await repoBlob(repo, params.get('path') || '')
  return {
    generatedAt: new Date().toISOString(),
    repo: { id: repo.id, name: repo.name, description: repo.description, mode: repo.mode, ref: repo.ref },
    ...result,
    // 语法高亮 tokens：非二进制、非超大就尝试；Markdown 也给（编辑态「编辑源文」需要
    // 与代码页一致的高亮，`view=docs` 走同一路径）。失败一律静默（tokens 缺省，
    // 客户端回退纯文本），不把高亮问题升级成请求错误
    ...(await blobTokens(result)),
  }
})

/** blob 的 `tokens` 字段（`TokenLine[]`，每行 `[[文本, { color }]]`）；不需要或失败时返回 `{}`。 */
async function blobTokens(result) {
  if (!result || result.binary || result.tooLarge) return {}
  if (!highlightSupported(result.lang)) return { lang: result.lang }
  const installDir = resolveInstallDir()
  if (!highlightAvailable(installDir)) return { lang: result.lang, note: 'DSH 前端资源不可用，已回退纯文本' }
  try {
    const highlighted = await highlightLines(result.text, result.lang, { installDir })
    // `note`：高亮不可用的原因（诊断用，客户端可忽略）；成功时不带
    if (!highlighted.tokens) return { lang: result.lang, note: highlighted.reason || '' }
    return { lang: result.lang, tokens: highlighted.tokens }
  } catch {
    // 静默：高亮不可用不影响只读浏览
    return { lang: result.lang }
  }
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

export function cachedView(ctx, config, params) {
  return cached(`view:${params.toString()}`, config.cacheSeconds, () => buildView(ctx, config, params))
}

/** 清空进程内视图缓存（测试与写后刷新用）。 */
export function clearViewCache() {
  cache = { key: '', at: 0, value: undefined, pending: undefined }
}

export function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(body)
}

export async function readJsonBody(req, maxBytes = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk)
    size += bytes.length
    if (size > maxBytes) throw Object.assign(new Error(`请求体超过 ${maxBytes} 字节`), { status: 413 })
    chunks.push(bytes)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

/** 单个 POST 请求的公共处理：鉴权已在 serveRoute 完成，这里只管解析与错误映射。 */
async function runPost(ctx, config, handler, req, res, maxBytes) {
  let body
  try {
    body = await readJsonBody(req, maxBytes)
  } catch (error) {
    const status = error && error.status === 413 ? 413 : 400
    return json(res, status, { error: String(error && error.message ? error.message : error) })
  }
  try {
    const result = await handler(ctx, config, body)
    if (result && typeof result.status === 'number' && Object.hasOwn(result, 'body')) return json(res, result.status, result.body)
    return json(res, 200, result)
  } catch (error) {
    const status = [400, 403, 409, 413].includes(error && error.status) ? error.status : 500
    return json(res, status, { error: String(error && error.message ? error.message : error) })
  }
}

/** 已加载仓库中按 id 取仓库；`repo` 参数缺省或未知时抛 400。 */
async function repoById(ctx, config, body) {
  const repos = await loadRepos(config, workspaceRepos(ctx))
  const id = String((body && body.repo) || '').trim()
  const repo = findRepo(repos, id)
  if (!repo) throw Object.assign(new Error(`找不到仓库：${id || '(空)'}`), { status: 400 })
  return repo
}

// —— 内置 POST：保存文件 ——
registerPost('write', async (ctx, config, body) => {
  const repo = await repoById(ctx, config, body)
  return writeBlob(repo, body, { writeEnabled: config.writeEnabled !== false })
})

// —— 内置 POST：撤销到 HEAD ——
registerPost('revert', async (ctx, config, body) => {
  const repo = await repoById(ctx, config, body)
  return revertBlob(repo, body, { writeEnabled: config.writeEnabled !== false })
})

/** 需要放大请求体上限的子路由：write 要承载 ≤2MB 文本（JSON 转义后略大，给 4MB）。 */
const POST_BODY_LIMIT = new Map([['write', 4 * 1024 * 1024]])

/**
 * 注册 `/dsh-workbench-panel/api`：只读视图 + 显式归档 + 写/撤销。
 * - `/api/archive`：保留原实现（直接在这里处理，不走 posts 表）；
 * - `/api/<name>`：查 posts 注册表，命中即按 POST 处理，否则 404。
 */
export function serveRoute(ctx, config) {
  const rejection = req => (ctx.connection.requestRejection ? ctx.connection.requestRejection({ headers: req.headers }) : undefined)
  const prefix = '/dsh-workbench-panel/api/'
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
    if (url.pathname.startsWith(prefix)) {
      const action = url.pathname.slice(prefix.length)
      const handler = posts.get(action)
      if (!handler) return json(res, 404, { error: '未知路由' })
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'POST' })
        res.end()
        return
      }
      return runPost(ctx, config, handler, req, res, POST_BODY_LIMIT.get(action) || 64 * 1024)
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
      // search 成功体以 `matches` 标记（可能同时带 error 之外的提示字段，不能当 400）
      const failed = value && value.error && !value.groups && !value.repos && !value.entries && !value.path && !value.workspaces && !value.sessions && !value.repo && !Array.isArray(value.matches)
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
  ctx.logger.info('dsh-workbench-panel ready: repos=%s write=%s', (config.repos || []).length, config.writeEnabled !== false)
}
