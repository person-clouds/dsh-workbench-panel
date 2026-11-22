import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import test from 'node:test'

/**
 * Host 测试不依赖已安装的 DSH 依赖：把 schemastery 换成本用例需要的最小实现。
 * 真正运行时仍由 DSH profile 提供 @deepseek-ai/schemastery。
 */
const SCHEMA_STUB = `
function field(type) {
  const schema = {
    type,
    defaultValue: undefined,
    default(value) {
      schema.defaultValue = value
      return schema
    },
    description() {
      return schema
    }
  }
  return schema
}
function string() { return field('string') }
function number() { return field('number') }
function array() { return field('array') }
function union() { return field('union') }
function const_() { return field('const') }
function object(shape) {
  const schema = function validate(value = {}) {
    const result = {}
    for (const [key, spec] of Object.entries(shape)) {
      if (Object.hasOwn(value, key) && value[key] !== undefined) result[key] = value[key]
      else if (spec.defaultValue !== undefined) result[key] = spec.defaultValue
    }
    return result
  }
  schema.shape = shape
  return schema
}
export default { string, number, array, union, const: const_, object }
`

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@deepseek-ai/schemastery') {
      return { url: `data:text/javascript,${encodeURIComponent(SCHEMA_STUB)}`, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})

const { apply, Config, name } = await import('../index.js')

function fakeContext(options = {}) {
  const routes = []
  const archived = options.archived ?? []
  const calls = { archive: [] }
  const registry = {
    archivedSessionIds: archived,
    pinnedSessionIds: [],
    list: () => [],
    async archiveSession(sessionId) { calls.archive.push(sessionId) },
  }
  const ctx = {
    logger: { info() {}, warn() {}, error() {} },
    effect: (factory) => factory(),
    get: (key) => ({ workspaceRegistry: registry, sessionQuery: undefined, sessionProjectionCache: undefined, sessions: undefined })[key],
    webServer: { register: (route) => { routes.push(route); return () => {} } },
    connection: { requestRejection: options.rejection },
  }
  return { ctx, routes, calls, archived, registry }
}

function fakeResponse() {
  return {
    status: undefined,
    headers: undefined,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers },
    end(body = '') { this.body += String(body) },
  }
}

function request(url, method = 'GET', body = undefined) {
  const req = {
    method,
    url,
    headers: {},
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body))
    },
  }
  return req
}

async function handle(route, req) {
  const res = fakeResponse()
  await route.handler(req, res)
  const isJson = String(res.headers && res.headers['content-type'] || '').includes('application/json')
  return { status: res.status, headers: res.headers, body: res.body && isJson ? JSON.parse(res.body) : res.body }
}

test('插件导出与配置只保留只读工作台需要的字段', () => {
  assert.equal(name, 'dsh-workbench-panel')
  const config = new Config({})
  assert.equal(typeof config.dshHome, 'string')
  assert.equal(config.cacheSeconds, 10)
  assert.deepEqual(config.repos, [])
  assert.equal(Object.hasOwn(config, 'repoDir'), false)
  assert.equal(Object.hasOwn(config, 'stateDir'), false)
  assert.equal(Object.hasOwn(config, 'saApiBase'), false)
  assert.equal(Object.hasOwn(config, 'retentionDays'), false)
})

test('package.json 声明 dsh.bundle 与公开发布信息', async () => {
  const pack = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pack.name, 'dsh-workbench-panel')
  assert.match(pack.version, /^0\.1\.\d+$/)
  assert.equal(pack.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pack.dsh.client.platform, 'web')
  assert.equal(pack.publishConfig.access, 'public')
  assert.ok(pack.files.includes('icon.png'))
  assert.ok(pack.files.includes('locale'))
})

test('源码与配置不包含 SA、工单、清理、TODO 与 /ok 的实现', async () => {
  const files = ['index.js', 'client.js', 'lib/repos.js', 'lib/sessions.js', 'lib/workspaces.js', 'lib/list.js', 'lib/markdown.js', 'lib/title-cache.js', 'cordis.patch.yml', 'package.json']
  const pattern = /superagent|orchestrator|saApiBase|retention|\btickets?\b|\/ok\b|\btodo\b|USER_ACTION_MARKER|systemPrompt/i
  for (const file of files) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(text, pattern, `${file} 不应出现被迁出的 SA/TODO 实现`)
  }
})

test('apply 只注册 /dsh-workbench-panel/api 前缀路由', () => {
  const { ctx, routes } = fakeContext()
  apply(ctx, new Config({}))
  assert.equal(routes.length, 1)
  assert.equal(routes[0].kind, 'prefix')
  assert.equal(routes[0].path, '/dsh-workbench-panel/api')
})

test('缺少 view 返回 400，未知路由返回 404', async () => {
  const { ctx, routes } = fakeContext()
  apply(ctx, new Config({}))
  const missing = await handle(routes[0], request('/dsh-workbench-panel/api'))
  assert.equal(missing.status, 400)
  assert.match(missing.body.error, /view/)
  const unknown = await handle(routes[0], request('/dsh-workbench-panel/other'))
  assert.equal(unknown.status, 404)
})

test('连接层拒绝时直接返回 401', async () => {
  const { ctx, routes } = fakeContext({ rejection: () => 401 })
  apply(ctx, new Config({}))
  const res = await handle(routes[0], request('/dsh-workbench-panel/api?view=workspaces'))
  assert.equal(res.status, 401)
  assert.equal(String(res.headers['content-type']), 'text/plain; charset=utf-8')
  assert.equal(res.body, 'unauthorized')
})

test('workspaces 视图在空仓库表下返回空列表', async () => {
  const { ctx, routes } = fakeContext()
  apply(ctx, new Config({}))
  const res = await handle(routes[0], request('/dsh-workbench-panel/api?view=workspaces'))
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.workspaces, [])
})

test('归档只接受 POST，且重复归档保持幂等', async () => {
  const { ctx, routes, calls, registry } = fakeContext()
  apply(ctx, new Config({}))
  const get = await handle(routes[0], request('/dsh-workbench-panel/api/archive'))
  assert.equal(get.status, 405)

  const empty = await handle(routes[0], request('/dsh-workbench-panel/api/archive', 'POST', {}))
  assert.equal(empty.status, 400)
  assert.match(empty.body.error, /sessionId/)

  const ok = await handle(routes[0], request('/dsh-workbench-panel/api/archive', 'POST', { sessionId: 's1' }))
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.body, { ok: true, archived: true, sessionId: 's1' })
  assert.deepEqual(calls.archive, ['s1'])

  // 已在归档列表中的会话不再重复调用 registry。
  registry.archivedSessionIds = ['s1']
  const idempotent = await handle(routes[0], request('/dsh-workbench-panel/api/archive', 'POST', { sessionId: 's1' }))
  assert.equal(idempotent.status, 200)
  assert.deepEqual(calls.archive, ['s1'])
})
